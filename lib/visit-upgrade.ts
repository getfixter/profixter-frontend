/*
 * "Upgrade to a handyman visit": the customer's own free visit becomes a
 * membership or One-Time visit once they pay (BackEnd routes/visitUpgrade.js,
 * utils/freeVisit/conversion.js customerUpgradeOptions / startCustomerUpgrade).
 *
 * The same conversion Admin's "Convert to paid visit" uses: the visit keeps
 * its day, time, address, Fixter, notes and photos, and nothing about it
 * changes until Stripe confirms the payment. The server decides everything;
 * this only shows its answer.
 */
import API from "@/lib/api";
import { checkoutTracking } from "@/lib/meta";

export type UpgradeKind = "membership" | "one_time";
export type UpgradeCycle = "monthly" | "annual";

/** How an upgrade already under way stands, in the customer's terms. */
export type UpgradeState = {
  status: "open" | "processing" | "converted" | "paid_attention";
  kind: UpgradeKind;
  offerLabel: string;
  startedBy: "admin" | "customer";
  checkoutOpen: boolean;
  convertedStatus: string;
};

/** On each visit in GET /api/bookings. */
export type BookingUpgrade = { freeVisit: boolean; converted: boolean; current: UpgradeState | null };

export type UpgradePlan = { key: string; label: string; monthly: number; annual: number; limit: number; available: boolean };

export type UpgradeOptions = {
  booking: { id: string; bookingNumber: string; status: string; whenLabel: string; address: string; line1: string; zip: string; addressId: string | null; task: string };
  upgradable: boolean;
  problem: { code: string; message: string } | null;
  termsVersion: string;
  offers: {
    membership: { plans: UpgradePlan[]; blocker: { code: string; message: string } | null; firstVisitException: boolean };
    oneTime: { enabled: boolean; priceCents: number };
  };
  terms: {
    one_time: string;
    membership: Record<string, Record<UpgradeCycle, { regular: string; welcome: string }>>;
  };
  current: UpgradeState | null;
};

export type UpgradeChoice = { kind: UpgradeKind; plan?: string; billingCycle?: UpgradeCycle };

export async function fetchUpgradeOptions(bookingId: string): Promise<UpgradeOptions> {
  return (await API.get(`/api/visit-upgrade/${encodeURIComponent(bookingId)}`)).data;
}

/** Opens the customer's own Stripe page; the caller sends the browser there. */
export async function startUpgradeCheckout(
  bookingId: string,
  choice: UpgradeChoice & { termsVersion: string; welcomeOffer: boolean }
): Promise<{ url: string; welcomeOfferApplied: boolean }> {
  return (
    await API.post(`/api/visit-upgrade/${encodeURIComponent(bookingId)}/checkout`, {
      ...choice,
      acceptTerms: true,
      ...checkoutTracking(),
    })
  ).data;
}

export const UPGRADE_PHONE = "631-599-1363";

export function dollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount.toLocaleString("en-US")}` : `$${amount.toFixed(2)}`;
}

/**
 * After Stripe: the payment's state as the server verified it with Stripe
 * (GET /api/visit-upgrade/:id/payment, customerPaymentStatus). The return URL
 * proves nothing - backing out, a slow webhook and a paid page all look alike.
 */
export type PaymentState = "converted" | "processing" | "pending" | "attention" | "settled" | "unpaid" | "unknown";

export type PaymentStatus = {
  bookingId: string;
  state: PaymentState;
  kind?: UpgradeKind;
  offerLabel?: string;
  openPage?: boolean;
  approvalPending?: boolean;
  extraPayment?: boolean;
  stripeConfirmed?: boolean;
};

export async function fetchPaymentStatus(bookingId: string): Promise<PaymentStatus> {
  return (await API.get(`/api/visit-upgrade/${encodeURIComponent(bookingId)}/payment`)).data;
}

/** States that can still change by themselves: asked again for a while. */
export function paymentStateSettles(state: PaymentState | "checking" | "error"): boolean {
  return state === "processing" || state === "pending" || state === "unknown" || state === "error" || state === "checking";
}

export type PaymentNotice = {
  state: PaymentState | "checking" | "error";
  tone: "ok" | "wait" | "attention" | "neutral";
  text: string;
  /** retry: "Check again". reopen: the sheet, only after a verified "unpaid". */
  action?: "retry" | "reopen";
  actionLabel?: string;
};

const DONT_PAY_AGAIN = "Please don't pay again.";

/** "a paid One-Time Visit", "a Plus membership visit". */
export function paidVisitName(kind?: UpgradeKind, offerLabel = ""): string {
  if (kind === "one_time") return "a paid One-Time Visit";
  const plan = offerLabel.replace(/\s*\((monthly|annual)\)$/, "");
  return plan ? `a ${plan} visit` : "a paid visit";
}

/** What the customer is told. Only "unpaid" ever says nothing was charged. */
export function paymentNotice(status: PaymentStatus | null, { error = false, slow = false } = {}): PaymentNotice {
  if (!status && !error) return { state: "checking", tone: "wait", text: "Checking payment status..." };
  if (!status) {
    return {
      state: "error",
      tone: "attention",
      text: `We couldn't confirm your payment status yet. If you completed the payment, it can take a few minutes to show here. ${DONT_PAY_AGAIN}`,
      action: "retry",
      actionLabel: "Check again",
    };
  }
  switch (status.state) {
    case "converted":
      return {
        state: "converted",
        tone: "ok",
        text: `Payment received. Your visit is now ${paidVisitName(status.kind, status.offerLabel)}, on the same day, time and address. ${
          status.approvalPending ? "It's waiting for our confirmation; we'll email you once it's confirmed." : "A confirmation email is on its way."
        }${status.extraPayment ? " We also received a second payment for it, and we'll refund that one." : ""}`,
      };
    case "processing":
      return {
        state: "processing",
        tone: "wait",
        text: slow
          ? `We've received your payment. Updating your visit is taking longer than usual; you'll get an email when it's done. ${DONT_PAY_AGAIN}`
          : `Payment received. We're updating your visit now; this can take a minute. ${DONT_PAY_AGAIN}`,
      };
    case "pending":
      return {
        state: "pending",
        tone: "wait",
        text: `Your payment is still being processed. Your free visit stays booked, and we'll update it as soon as the payment clears. ${DONT_PAY_AGAIN}`,
      };
    case "attention":
      return {
        state: "attention",
        tone: "attention",
        text: `We received your payment, but couldn't update your visit automatically, so nothing about it has changed yet. Our team will contact you to sort it out. ${DONT_PAY_AGAIN}`,
      };
    case "settled":
      return { state: "settled", tone: "neutral", text: `Our team has handled a payment for this visit. Questions? Call us at ${UPGRADE_PHONE}.` };
    case "unpaid":
      return {
        state: "unpaid",
        tone: "neutral",
        text: "Payment not completed. Nothing was charged, and your free visit is still booked.",
        action: "reopen",
        actionLabel: status.openPage ? "Return to payment" : "Upgrade to a handyman visit",
      };
    default:
      return paymentNotice(null, { error: true });
  }
}
