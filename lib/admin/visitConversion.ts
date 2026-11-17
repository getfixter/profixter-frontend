/*
 * "Convert to paid visit" (backend routes/adminFreeVisitConversions.js,
 * utils/freeVisit/conversion.js): a free visit becomes a membership or
 * One-Time visit once the customer pays a link Admin made. Nothing changes on
 * the visit until Stripe confirms the payment; the server decides everything.
 */
import API from "@/lib/api";

export type ConversionKind = "membership" | "one_time";
export type ConversionStatus = "open" | "paid" | "converting" | "converted" | "needs_attention" | "closed" | "expired" | "canceled";

export type Conversion = {
  id: string;
  status: ConversionStatus;
  kind: ConversionKind;
  plan: string;
  billingCycle: string;
  offerLabel: string;
  priceCents: number | null;
  task: string;
  accountSource: "" | "booking" | "linked" | "created" | "customer";
  /* "customer": started by the customer from their own visit card (no link; their own Stripe page). */
  source: "admin" | "customer";
  /* The 20% first-payment offer was on the customer's page (customer-started memberships only). */
  welcomeOfferApplied: boolean;
  userId: string | null;
  contact: { name: string; email: string; phone: string };
  leadTime: { rule: "" | "none" | "first_visit_exemption" | "admin_override"; earliestMemberDate: string; override: { byName: string; at: string; reason: string } | null };
  linkExpiresAt: string | null;
  checkoutOpen: boolean;
  checkoutOpenedAt: string | null;
  termsAcceptedAt: string | null;
  sends: { channel: "email" | "sms"; to: string; result: string; at: string; byName: string }[];
  payment: { paidAt: string; amountCents: number | null; currency: string; sessionId: string } | null;
  convertedAt: string | null;
  attention: { reason: string; message: string; at: string } | null;
  /* The converted visit was canceled afterwards: its payment waits for a decision until resolvedAt. */
  afterCancel: { at: string; byName: string; reason: string; resolvedAt: string | null } | null;
  resolution: {
    kind: PaymentResolutionKind | "visit_reinstated";
    for: "attention" | "after_cancel" | string;
    note: string;
    at: string;
    byName: string;
    firstPaymentRefunded: boolean | null;
    verified: Record<string, unknown> | null;
  } | null;
  /* What Admin still has to settle: a payment that needs attention, or one whose visit was canceled. */
  followUp: "attention" | "after_cancel" | null;
  history: { at: string; event: string; byName: string; detail: Record<string, unknown> | null }[];
  createdAt: string;
  createdByName: string;
};

export type AccountCandidate = { id: string; name: string; email: string; phoneLast4: string; matchedOn: ("email" | "phone")[]; hasThisHome: boolean };

export type ConversionOptions = {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    date: string;
    whenLabel: string;
    address: string;
    name: string;
    email: string;
    phone: string;
    service: string;
    selectedTask: string;
    note: string;
    photos: number;
    assignedFixterName: string;
    converted: unknown;
  };
  convertible: boolean;
  problem: { code: string; message: string } | null;
  /* A homepage guest agreed to texts about the visit only: a payment link cannot be texted to them. */
  smsAvailable: boolean;
  offers: {
    membership: { plans: { key: string; label: string; monthly: number; annual: number; limit: number }[]; blocker: { code: string; message: string } | null };
    oneTime: { enabled: boolean; priceCents: number };
  };
  account: { mode: "booking"; id: string; name: string; email: string; hasThisHome: boolean } | { mode: "guest"; candidates: AccountCandidate[] };
  leadTime: { visitDate: string; earliestMemberDate: string; insideMemberLeadTime: boolean; exemptionEligible: boolean; overrideRequired: boolean };
  current: Conversion | null;
  earlier: Conversion[];
};

export type CreateConversion = {
  kind: ConversionKind;
  plan?: string;
  billingCycle?: "monthly" | "annual";
  task?: string;
  account?: { mode: "link"; userId: string; confirmDifferentEmail?: boolean } | { mode: "create"; firstName?: string; lastName?: string; allowSharedPhone?: boolean };
  overrideLeadTimeReason?: string;
};

const base = (bookingId: string) => `/api/admin/free-visit-conversions/bookings/${encodeURIComponent(bookingId)}`;

export const conversionKeys = { options: (bookingId: string) => ["visitConversion", bookingId] as const };

export async function fetchConversionOptions(bookingId: string, signal?: AbortSignal): Promise<ConversionOptions> {
  return (await API.get(base(bookingId), { signal })).data;
}

/** Makes the link; nothing is sent. The link itself comes back only here (the server keeps its hash). */
export async function createConversionLink(bookingId: string, body: CreateConversion): Promise<{ conversion: Conversion; payUrl: string; token: string }> {
  return (await API.post(base(bookingId), body)).data;
}

export async function sendConversionLink(bookingId: string, conversionId: string, token: string, channels: ("email" | "sms")[]) {
  return (await API.post(`${base(bookingId)}/${encodeURIComponent(conversionId)}/send`, { token, channels })).data as {
    conversion: Conversion;
    delivery: { email: string; sms: string };
  };
}

export async function cancelConversionLink(bookingId: string, conversionId: string, reason = "") {
  return (await API.post(`${base(bookingId)}/${encodeURIComponent(conversionId)}/cancel`, { reason })).data as { conversion: Conversion };
}

export async function retryConversion(bookingId: string, conversionId: string, overrideLeadTimeReason = "", acceptCurrentVisit = false) {
  return (await API.post(`${base(bookingId)}/${encodeURIComponent(conversionId)}/retry`, { overrideLeadTimeReason, acceptCurrentVisit })).data as { conversion: Conversion };
}

export type PaymentResolutionKind = "refunded" | "kept" | "membership_canceled" | "membership_kept";

export type PaymentResolutionInput = { resolution: PaymentResolutionKind; reason: string; firstPaymentRefunded?: boolean };

/**
 * The payment and, for a membership, the subscription it started, as Stripe
 * has them now (BackEnd utils/freeVisit/paymentResolution.js paymentFacts).
 */
export type PaymentFacts = {
  kind: ConversionKind;
  offerLabel: string;
  amountCents: number | null;
  currency: string;
  paidAt: string | null;
  checkedWithStripe: boolean;
  stripeError: string;
  oneTime?: { paymentIntentId: string; paymentUrl: string | null; refundedCents: number | null; refund: "none" | "partial" | "full" | "unknown" };
  membership?: {
    stripeSubscriptionId: string;
    subscriptionUrl: string | null;
    customerProfileHref: string | null;
    plan: string;
    billingCycle: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    cancelAt: string | null;
    endedAt?: string | null;
    nextPaymentAt: string | null;
    billsAgain: boolean | null;
    source: "stripe" | "record" | "none";
  };
};

/** A paid conversion that needs attention, closed after settling its payment (checked with Stripe). */
export async function closeConversion(bookingId: string, conversionId: string, input: PaymentResolutionInput) {
  return (await API.post(`${base(bookingId)}/${encodeURIComponent(conversionId)}/close`, input)).data as { conversion: Conversion };
}

export async function fetchConversionPayment(bookingId: string, conversionId: string) {
  return (await API.get(`${base(bookingId)}/${encodeURIComponent(conversionId)}/payment`)).data as { conversion: Conversion; facts: PaymentFacts; followUp: Conversion["followUp"] };
}

/** A converted visit canceled afterwards: what was done with its payment (checked with Stripe). */
export async function resolveConversionPayment(bookingId: string, conversionId: string, input: PaymentResolutionInput) {
  return (await API.post(`${base(bookingId)}/${encodeURIComponent(conversionId)}/resolve`, input)).data as { conversion: Conversion; facts: PaymentFacts };
}

/** The status in the owner's words. */
export function conversionStatusText(c: Pick<Conversion, "status" | "checkoutOpen"> & { source?: Conversion["source"] }): string {
  switch (c.status) {
    case "open":
      if (c.source === "customer") {
        return c.checkoutOpen ? "Checkout pending: the customer started the upgrade and has the payment page open" : "Started by the customer: not paid";
      }
      return c.checkoutOpen ? "Checkout pending: the customer has the payment page open" : "Link ready: waiting for the customer to pay";
    case "paid":
    case "converting":
      return "Paid: converting the visit";
    case "converted":
      return "Paid and converted";
    case "needs_attention":
      return "Paid, but the visit was not converted: needs your attention";
    case "closed":
      return "Paid, settled by hand";
    case "expired":
      return "Link expired unpaid";
    case "canceled":
      return "Link withdrawn";
    default:
      return c.status;
  }
}

export function deliveryWords(result: string): string {
  if (result === "sent") return "sent";
  if (!result || result === "not_requested") return "";
  if (result.startsWith("failed")) return "failed";
  if (result.startsWith("skipped")) return `not sent (${result.replace(/^skipped:?/, "") || "skipped"})`;
  return result;
}

export function money(cents: number | null | undefined): string {
  if (cents == null) return "";
  const n = cents / 100;
  return `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;
}
