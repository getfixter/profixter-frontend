/**
 * Charge customer (owner only): type the final total, press "Charge $X".
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

export type ChargeTarget = {
  booking: { id: string; number: string; date: string | null; service: string; status: string };
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
  list: (jobId: string) => ["admin", "jobs", jobId, "extra-charges"] as const,
  target: (jobId: string) => ["admin", "jobs", jobId, "extra-charges", "target"] as const,
};

const base = (jobId: string) => `/api/admin/jobs/${encodeURIComponent(jobId)}/extra-charges`;

export async function fetchExtraCharges(jobId: string, signal?: AbortSignal): Promise<ExtraCharge[]> {
  const { data } = await API.get(base(jobId), { signal });
  return (data?.charges || []) as ExtraCharge[];
}

export async function fetchChargeTarget(jobId: string, signal?: AbortSignal): Promise<ChargeTarget> {
  const { data } = await API.get(`${base(jobId)}/target`, { signal });
  return data.target as ChargeTarget;
}

export async function chargeCustomer(
  jobId: string,
  draft: Draft,
  opts: { idempotencyKey: string; targetFingerprint: string; method: "card" | "link"; allowRepeat?: boolean; send?: boolean; channels?: ("email" | "sms")[] }
): Promise<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery; replayed: boolean }> {
  const { data } = await API.post(base(jobId), { amount: draft.amount, note: draft.note, ...opts });
  return data;
}

export async function refreshExtraCharge(jobId: string, chargeId: string): Promise<ExtraCharge> {
  const { data } = await API.post(`${base(jobId)}/${encodeURIComponent(chargeId)}/refresh`, {});
  return data.charge;
}

export async function retryExtraCard(jobId: string, chargeId: string, body: { idempotencyKey: string; expectedCardLast4: string }): Promise<ExtraCharge> {
  const { data } = await API.post(`${base(jobId)}/${encodeURIComponent(chargeId)}/retry-card`, body);
  return data.charge;
}

export async function extraPaymentLink(
  jobId: string,
  chargeId: string,
  body: { idempotencyKey: string; send: boolean; channels?: ("email" | "sms")[] }
): Promise<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery }> {
  const { data } = await API.post(`${base(jobId)}/${encodeURIComponent(chargeId)}/payment-link`, body);
  return data;
}

export async function closeExtraCharge(jobId: string, chargeId: string): Promise<ExtraCharge> {
  const { data } = await API.post(`${base(jobId)}/${encodeURIComponent(chargeId)}/close`, {});
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

/* What was typed, kept for this job until it is charged, so closing the sheet or a reload loses nothing. */
const draftKey = (jobId: string) => `pfx.chargeDraft.${jobId}`;
export function loadDraft(jobId: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(jobId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(jobId: string, draft: Draft | null) {
  try {
    if (!draft || (!draft.amount && !draft.note)) window.sessionStorage.removeItem(draftKey(jobId));
    else window.sessionStorage.setItem(draftKey(jobId), JSON.stringify(draft));
  } catch {
    /* storage blocked: the sheet still warns before discarding */
  }
}
