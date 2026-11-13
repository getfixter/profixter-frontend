/**
 * Charge extra (owner only): agreed additional work on a booking, charged to
 * the saved card of the account that owns the booking, or paid through a
 * booking-specific Stripe link.
 *
 * The browser never sends a customer, Stripe customer or payment-method id:
 * the server resolves them from the booking, shows them back in the preview,
 * and the confirm sends only the preview's fingerprint and total, so a change
 * in between is refused (409 PREVIEW_CHANGED) instead of charged.
 * Idempotency keys travel in the body (the CORS allow-list has no header for them).
 */
import API from "@/lib/api";

export type TaxTreatment = "Taxable Repair / Maintenance" | "Capital Improvement - No Sales Tax" | "Tax Exempt" | "Not Determined";

export const TAX_OPTIONS: { value: TaxTreatment; label: string; help: string }[] = [
  { value: "Taxable Repair / Maintenance", label: "Taxable repair or maintenance", help: "Stripe Tax adds the tax for the service address." },
  { value: "Capital Improvement - No Sales Tax", label: "Capital improvement, no tax", help: "Only with the customer's signed NY Form ST-124 on file." },
  { value: "Tax Exempt", label: "Tax exempt", help: "Only with an exemption certificate or government purchase order on file." },
];

/** The documents that make "no tax" true, per treatment (the server holds the same list). */
export const BASIS_DOCUMENTS: Record<string, { value: string; label: string }[]> = {
  "Capital Improvement - No Sales Tax": [{ value: "ST-124", label: "NY Form ST-124, Certificate of Capital Improvement (signed by the customer)" }],
  "Tax Exempt": [
    { value: "ST-119.1", label: "NY Form ST-119.1, Exempt Organization Certificate" },
    { value: "ST-121", label: "NY Form ST-121, Exempt Use Certificate" },
    { value: "GOVERNMENT_PO", label: "Government purchase order" },
    { value: "OTHER_CERTIFICATE", label: "Another NY exemption certificate" },
  ],
};
export type TaxBasis = { document: string; reference: string; onFile: boolean };

export type Gate = { allowed: boolean; code?: string; message?: string; canSend?: boolean };

export type ExtraPreview = {
  booking: { id: string; number: string; date: string | null; service: string; status: string };
  customer: { name: string; guest: boolean; accountLinked: boolean; hasEmail: boolean; hasPhone: boolean };
  serviceAddress: { line1: string; unit: string; city: string; state: string; zip: string; full: string };
  card: { brand: string; last4: string; expMonth: number | null; expYear: number | null } | null;
  description: string;
  subtotalCents: number;
  taxCents: number | null;
  totalCents: number | null;
  tax: { ok: boolean; treatment: string; source?: string; ratePercent?: string; taxCode?: string; taxabilityReason?: string; code?: string; message?: string; basis?: { document: string; label: string; reference: string } | null };
  direct: Gate;
  link: Gate;
  consentStatement: string;
  fingerprint: string;
};

export type ExtraStatus = "charging" | "processing" | "awaiting_payment" | "paid" | "failed" | "partially_refunded" | "refunded" | "canceled";

export type ExtraCharge = {
  id: string;
  number: string;
  description: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  tax: { treatment: string; source: string; ratePercent: string; taxCode: string; recorded: boolean; recordError: string; basis: { document: string; label: string; reference: string } | null };
  status: ExtraStatus;
  statusLabel: string;
  method: "card" | "link";
  createdAt: string;
  createdByName: string;
  consent: { statement: string; confirmedByName: string; confirmedAt: string | null; writtenApprovalRef: string };
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

export type ExtraInput = { description: string; amount: string; taxTreatment: TaxTreatment | ""; writtenApprovalRef?: string; taxBasis?: TaxBasis };
export type Delivery = { email?: string; sms?: string } | null;

export const extraKeys = {
  list: (jobId: string) => ["admin", "jobs", jobId, "extra-charges"] as const,
};

const base = (jobId: string) => `/api/admin/jobs/${encodeURIComponent(jobId)}/extra-charges`;

export async function fetchExtraCharges(jobId: string, signal?: AbortSignal): Promise<ExtraCharge[]> {
  const { data } = await API.get(base(jobId), { signal });
  return (data?.charges || []) as ExtraCharge[];
}

export async function previewExtraCharge(jobId: string, input: ExtraInput): Promise<ExtraPreview> {
  const { data } = await API.post(`${base(jobId)}/preview`, { description: input.description, amount: input.amount, taxTreatment: input.taxTreatment || "Not Determined", taxBasis: basisFor(input) });
  return data.preview as ExtraPreview;
}

export async function createExtraCharge(
  jobId: string,
  input: ExtraInput,
  confirm: { idempotencyKey: string; previewFingerprint: string; expectedTotalCents: number; customerAgreed: boolean; method: "card" | "link"; send?: boolean; channels?: ("email" | "sms")[] }
): Promise<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery; replayed: boolean }> {
  const { data } = await API.post(base(jobId), {
    description: input.description,
    amount: input.amount,
    taxTreatment: input.taxTreatment || "Not Determined",
    writtenApprovalRef: input.writtenApprovalRef || "",
    taxBasis: basisFor(input),
    ...confirm,
  });
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

/** The basis travels only with a no-tax treatment; taxable work never carries one. */
function basisFor(input: ExtraInput): TaxBasis | undefined {
  return input.taxTreatment && BASIS_DOCUMENTS[input.taxTreatment] && input.taxBasis ? input.taxBasis : undefined;
}

/** Always two decimals: the button must state the exact total ("Charge $123.00"). */
export function money2(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "123.4" -> "123.40" for display; invalid input stays as typed. */
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

/* A draft kept for this job only, so a closed sheet or a reload does not lose what was typed. */
const draftKey = (jobId: string) => `pfx.extraDraft.${jobId}`;
export function loadDraft(jobId: string): ExtraInput | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(jobId));
    return raw ? (JSON.parse(raw) as ExtraInput) : null;
  } catch {
    return null;
  }
}
export function saveDraft(jobId: string, input: ExtraInput | null) {
  try {
    if (!input || (!input.description && !input.amount)) window.sessionStorage.removeItem(draftKey(jobId));
    else window.sessionStorage.setItem(draftKey(jobId), JSON.stringify(input));
  } catch {
    /* storage blocked: the sheet still warns before discarding */
  }
}
