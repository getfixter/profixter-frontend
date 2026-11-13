/**
 * Charge customer (owner only): type the final total, press "Charge $X".
 *
 * Two entry points, one flow: from a job (who pays = the booking's stored
 * owner) and from the customer profile with no booking (who pays = that
 * profile's stored account). A ChargeScope says which; everything else is
 * the same calls, the same screen and the same protections.
 *
 * The browser never sends a customer, Stripe customer or payment-method id.
 * GET .../target shows who pays (the booking's own account and its saved card)
 * with a fingerprint; the charge sends that fingerprint back, so a change in
 * between is refused (409 TARGET_CHANGED) instead of charged. The amount is the
 * total: nothing is added on top. Idempotency keys travel in the body (the
 * CORS allow-list has no header for them).
 */
import API from "@/lib/api";

export type Gate = { allowed: boolean; code?: string; message?: string; canSend?: boolean };

/** Where the owner started: a job, or the customer's profile (a direct charge, no booking). */
export type ChargeScope = { kind: "job" | "customer"; id: string };
export const jobScope = (id: string): ChargeScope => ({ kind: "job", id });
export const customerScope = (id: string): ChargeScope => ({ kind: "customer", id });

export type ChargeTarget = {
  scope?: "booking" | "direct";
  /** null for a direct charge from the customer profile. */
  booking: { id: string; number: string; date: string | null; service: string; status: string } | null;
  customer: { name: string; guest: boolean; accountLinked: boolean; hasEmail: boolean; hasPhone: boolean };
  serviceAddress: { line1: string; unit: string; city: string; state: string; zip: string; full: string };
  card: { brand: string; last4: string; expMonth: number | null; expYear: number | null } | null;
  direct: Gate;
  link: Gate;
  fingerprint: string;
  limits: { minCents: number; maxCents: number };
};

export type ExtraStatus = "charging" | "processing" | "awaiting_payment" | "paid" | "failed" | "partially_refunded" | "refunded" | "canceled";

export type ExtraCharge = {
  id: string;
  number: string;
  /** "booking": made on a job; "direct": made from the customer profile, no booking. */
  scope?: "booking" | "direct";
  bookingId?: string | null;
  bookingNumber?: string;
  /** "Job #9001" or "Direct charge". */
  where?: string;
  note: string;
  totalCents: number;
  taxStatus: string;
  status: ExtraStatus;
  statusLabel: string;
  method: "card" | "link";
  createdAt: string;
  createdByName: string;
  confirmedByName: string;
  confirmedAt: string | null;
  customerName: string;
  guest: boolean;
  card: { brand: string; last4: string } | null;
  paidAt: string | null;
  failure: { code: string; declineCode: string; message: string } | null;
  refundedCents: number;
  stripeUrl: string;
  receiptUrl: string;
  extraPayments: { amountCents: number; stripeUrl: string; at: string }[];
  link: { status: string; expiresAt: string; sentVia: string[]; delivery: { email?: string; sms?: string } | null } | null;
  actions: ("retryCard" | "paymentLink" | "copyLink" | "close")[];
};

export type Delivery = { email?: string; sms?: string } | null;
export type Draft = { amount: string; note: string };

export const extraKeys = {
  /** Every charge list, both entry points: a charge made on one screen refreshes the other. */
  all: ["admin", "charges"] as const,
  list: (scope: ChargeScope) => ["admin", "charges", scope.kind, scope.id, "list"] as const,
  target: (scope: ChargeScope) => ["admin", "charges", scope.kind, scope.id, "target"] as const,
};

const base = (scope: ChargeScope) =>
  scope.kind === "customer" ? `/api/admin/customers/${encodeURIComponent(scope.id)}/charges` : `/api/admin/jobs/${encodeURIComponent(scope.id)}/extra-charges`;

export async function fetchExtraCharges(scope: ChargeScope, signal?: AbortSignal): Promise<ExtraCharge[]> {
  const { data } = await API.get(base(scope), { signal });
  return (data?.charges || []) as ExtraCharge[];
}

export async function fetchChargeTarget(scope: ChargeScope, signal?: AbortSignal): Promise<ChargeTarget> {
  const { data } = await API.get(`${base(scope)}/target`, { signal });
  return data.target as ChargeTarget;
}

export async function chargeCustomer(
  scope: ChargeScope,
  draft: Draft,
  opts: { idempotencyKey: string; targetFingerprint: string; method: "card" | "link"; allowRepeat?: boolean; send?: boolean; channels?: ("email" | "sms")[] }
): Promise<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery; replayed: boolean }> {
  const { data } = await API.post(base(scope), { amount: draft.amount, note: draft.note, ...opts });
  return data;
}

export async function refreshExtraCharge(scope: ChargeScope, chargeId: string): Promise<ExtraCharge> {
  const { data } = await API.post(`${base(scope)}/${encodeURIComponent(chargeId)}/refresh`, {});
  return data.charge;
}

export async function retryExtraCard(scope: ChargeScope, chargeId: string, body: { idempotencyKey: string; expectedCardLast4: string }): Promise<ExtraCharge> {
  const { data } = await API.post(`${base(scope)}/${encodeURIComponent(chargeId)}/retry-card`, body);
  return data.charge;
}

export async function extraPaymentLink(
  scope: ChargeScope,
  chargeId: string,
  body: { idempotencyKey: string; send: boolean; channels?: ("email" | "sms")[] }
): Promise<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery }> {
  const { data } = await API.post(`${base(scope)}/${encodeURIComponent(chargeId)}/payment-link`, body);
  return data;
}

export async function closeExtraCharge(scope: ChargeScope, chargeId: string): Promise<ExtraCharge> {
  const { data } = await API.post(`${base(scope)}/${encodeURIComponent(chargeId)}/close`, {});
  return data.charge;
}

/** Always two decimals: the button states the exact amount ("Charge $123.00"). */
export function money2(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function amountToCents(amount: string): number | null {
  const m = String(amount || "").replace(/[$,\s]/g, "").match(/^(\d{1,6})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0"));
}

export function cardText(card: { brand: string; last4: string } | null | undefined): string {
  if (!card?.last4) return "";
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card";
  return `${brand} •••• ${card.last4}`;
}

export function deliveryText(delivery: Delivery): string[] {
  if (!delivery) return [];
  const out: string[] = [];
  const word = (s: string | undefined) => (!s || s === "not_requested" ? null : s === "sent" ? "sent" : s.startsWith("failed") ? "failed" : `not sent (${s.replace(/^skipped:?/, "").replace(/_/g, " ") || "held by the texting rules"})`);
  const e = word(delivery.email);
  const s = word(delivery.sms);
  if (e) out.push(`Email ${e}`);
  if (s) out.push(`Text ${s}`);
  return out;
}

export const STATUS_TONE: Record<ExtraStatus, "attention" | "info" | "success" | "neutral" | "problem"> = {
  charging: "info",
  processing: "info",
  awaiting_payment: "attention",
  paid: "success",
  failed: "problem",
  partially_refunded: "neutral",
  refunded: "neutral",
  canceled: "neutral",
};

/* What was typed, kept for this job (or customer) until it is charged, so closing the sheet or a reload loses nothing. */
const draftKey = (scope: ChargeScope) => (scope.kind === "customer" ? `pfx.chargeDraft.customer.${scope.id}` : `pfx.chargeDraft.${scope.id}`);
export function loadDraft(scope: ChargeScope): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(scope));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(scope: ChargeScope, draft: Draft | null) {
  try {
    if (!draft || (!draft.amount && !draft.note)) window.sessionStorage.removeItem(draftKey(scope));
    else window.sessionStorage.setItem(draftKey(scope), JSON.stringify(draft));
  } catch {
    /* storage blocked: the sheet still warns before discarding */
  }
}
