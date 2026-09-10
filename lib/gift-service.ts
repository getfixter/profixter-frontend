import API from "./api";

/**
 * Gift memberships, from the browser's side.
 *
 * TWO RULES THIS FILE EXISTS TO ENFORCE.
 *
 * 1. NO PRICES ARE DEFINED HERE. Every figure the purchase screen shows comes
 *    from GET /api/gifts/options, which reads the same plan catalogue the live
 *    memberships are billed from. A copy in the frontend would be a second
 *    thing to update when a price moves, and the one that got missed would be
 *    the one a customer was quoted.
 *
 * 2. THE FEATURE FLAG LIVES ON THE SERVER. Every gift route answers 404 while
 *    GIFTS_ENABLED is not "true", so the frontend asks rather than guesses.
 *    There is deliberately no NEXT_PUBLIC_GIFTS_ENABLED: a public env var
 *    could drift out of step with the server and expose a purchase flow that
 *    cannot complete.
 */

export type GiftPlan = "basic" | "plus" | "premium" | "elite";

export type GiftQuote = {
  durationMonths: number;
  totalCents: number;
  perMonthCents: number;
};

export type GiftPlanOption = {
  plan: GiftPlan;
  label: string;
  quotes: GiftQuote[];
};

export type GiftOptions = {
  plans: GiftPlanOption[];
  durations: number[];
  currency: string;
};

export type GiftRecipientInput = {
  firstName: string;
  lastName: string;
  email: string;
};

/** What the purchaser chose about how the gift looks. Never about what it is. */
export type GiftPresentationInput = {
  occasion: string;
  personalMessage: string;
};

export type GiftAddressInput = {
  line1: string;
  city: string;
  state: string;
  zip: string;
};

export type ClaimPreview = {
  plan: GiftPlan;
  durationMonths: number;
  from: string;
  recipientEmail: string;
  recipientFirstName: string;
  recipientLastName: string;
  /* Presentation only. The server sanitises and stores both; see
   * utils/gifts/giftOccasions.js. An unknown occasion arrives as "neutral". */
  occasion: string;
  personalMessage: string;
  addressSnapshot: GiftAddressInput | null;
};

export type MyGift = {
  giftNumber: string;
  plan: GiftPlan;
  durationMonths: number;
  from: string;
  startAt: string | null;
  endAt: string | null;
  activeThrough: string;
  state: "active" | "queued" | "expired" | string;
};

export type MyGifts = {
  active: MyGift | null;
  queued: MyGift[];
  expired: MyGift[];
  billingActionsAvailable: boolean;
};

/**
 * Why a gift call failed, in words a customer can act on.
 *
 * Every screen renders one of these rather than whatever the network threw.
 * A raw axios message or a JSON body reaching a customer is a bug, so the
 * mapping is here once instead of at each call site.
 */
export type GiftErrorCode =
  | "FEATURE_OFF"
  | "SELF_GIFT_NOT_ALLOWED"
  | "INVALID_RECIPIENT_EMAIL"
  | "UNSUPPORTED_DURATION"
  | "UNKNOWN_PLAN"
  | "LINK_EXPIRED"
  | "LINK_SUPERSEDED"
  | "ALREADY_CLAIMED"
  | "RECIPIENT_MISMATCH"
  | "CANCELLED"
  | "ADDRESS_REQUIRED"
  | "ADDRESS_NOT_FOUND"
  | "INVALID"
  | "NETWORK"
  | "UNKNOWN";

export class GiftError extends Error {
  code: GiftErrorCode;
  /** Extra context a screen may want, such as the plan on an expired link. */
  details?: Record<string, unknown>;

  constructor(code: GiftErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "GiftError";
    this.code = code;
    this.details = details;
  }
}

const FALLBACK_MESSAGES: Record<GiftErrorCode, string> = {
  FEATURE_OFF: "Gift memberships are not available right now.",
  SELF_GIFT_NOT_ALLOWED:
    "A gift has to be for someone else. To start your own membership, choose a plan from your account.",
  INVALID_RECIPIENT_EMAIL: "Enter a valid email address for the recipient.",
  UNSUPPORTED_DURATION: "That gift length is not available.",
  UNKNOWN_PLAN: "Choose a membership plan.",
  LINK_EXPIRED: "This invitation link has expired.",
  LINK_SUPERSEDED: "A newer invitation was sent for this gift.",
  ALREADY_CLAIMED: "This gift has already been claimed.",
  RECIPIENT_MISMATCH: "This gift was sent to a different email address.",
  CANCELLED: "This gift is no longer available.",
  ADDRESS_REQUIRED: "Choose which property this membership is for.",
  ADDRESS_NOT_FOUND: "That property is not on your account.",
  INVALID: "This gift link is not valid.",
  NETWORK: "We could not reach ProFixter. Check your connection and try again.",
  UNKNOWN: "Something went wrong. Please try again.",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toGiftError(error: any): GiftError {
  const status = error?.response?.status;
  const data = error?.response?.data;

  // The server answers 404 on every gift route while the feature is off, so a
  // 404 with no gift-specific code means the feature is simply not live.
  if (status === 404 && !data?.code) {
    return new GiftError("FEATURE_OFF", FALLBACK_MESSAGES.FEATURE_OFF);
  }
  if (!error?.response) {
    return new GiftError("NETWORK", FALLBACK_MESSAGES.NETWORK);
  }

  const code = String(data?.code || "").toUpperCase() as GiftErrorCode;
  const known = code in FALLBACK_MESSAGES ? code : "UNKNOWN";
  // Prefer the server's wording when it sent any: it is written for the
  // specific situation and is more useful than a generic fallback.
  const message = typeof data?.message === "string" && data.message ? data.message : FALLBACK_MESSAGES[known];

  return new GiftError(known, message, data?.gift ? { gift: data.gift } : undefined);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Whether gifting is live, and what it costs.
 *
 * Doubles as the feature check: a FEATURE_OFF error means every entry point
 * should stay hidden. Returns null rather than throwing for that case, because
 * "not available" is a normal answer and not an error worth surfacing.
 */
export async function getGiftOptions(): Promise<GiftOptions | null> {
  try {
    const { data } = await API.get("/api/gifts/options");
    return data as GiftOptions;
  } catch (error) {
    const giftError = toGiftError(error);
    if (giftError.code === "FEATURE_OFF") return null;
    throw giftError;
  }
}

/**
 * Start a gift purchase.
 *
 * Returns a Stripe Checkout URL. Nothing is recorded until Stripe confirms
 * payment on the webhook, so abandoning this leaves no trace.
 */
export async function createGiftCheckoutSession(
  input: {
    plan: GiftPlan;
    durationMonths: number;
    recipient: GiftRecipientInput;
    address: GiftAddressInput;
  } & Partial<GiftPresentationInput>
): Promise<{ url: string; sessionId: string }> {
  try {
    const { data } = await API.post("/api/gifts/checkout-session", input);
    return data;
  } catch (error) {
    throw toGiftError(error);
  }
}

/** What a claim link points at. Public: no account needed to look. */
export async function getClaimPreview(token: string): Promise<ClaimPreview & { hasAccount: boolean }> {
  try {
    const { data } = await API.get(`/api/gifts/claim/${encodeURIComponent(token)}`);
    return { ...data.gift, hasAccount: Boolean(data.hasAccount) };
  } catch (error) {
    throw toGiftError(error);
  }
}

/** Attach the gift to the signed-in account, against a chosen property. */
export async function claimGift(
  token: string,
  addressId: string
): Promise<{
  message: string;
  gift: {
    plan: GiftPlan;
    durationMonths: number;
    from: string;
    startAt: string;
    endAt: string;
    activeThrough: string;
    queued: boolean;
  };
}> {
  try {
    const { data } = await API.post(`/api/gifts/claim/${encodeURIComponent(token)}`, { addressId });
    return data;
  } catch (error) {
    throw toGiftError(error);
  }
}

/** Gifts this account holds: running, queued and finished. */
export async function getMyGifts(addressId?: string | null): Promise<MyGifts> {
  try {
    const { data } = await API.get("/api/gifts/mine", {
      params: addressId ? { addressId } : undefined,
    });
    return data as MyGifts;
  } catch (error) {
    const giftError = toGiftError(error);
    if (giftError.code === "FEATURE_OFF") {
      return { active: null, queued: [], expired: [], billingActionsAvailable: false };
    }
    throw giftError;
  }
}

/** Gifts this account has bought. */
export async function getPurchasedGifts() {
  try {
    const { data } = await API.get("/api/gifts/purchased");
    return data.gifts as Array<{
      giftNumber: string;
      plan: GiftPlan;
      durationMonths: number;
      recipientEmail: string;
      recipientName: string;
      recipientFirstName: string;
      recipientLastName: string;
      /* Presentation the purchaser wrote. Never a claim token: the token is a
       * credential and only ever reaches the recipient's email. */
      occasion: string;
      personalMessage: string;
      status: string;
      state: string;
      /*
       * The money as Stripe reported it on the completed session, passed
       * through by the server. Never recomputed here: the client must not
       * derive tax, and a total that disagrees with the receipt is worse
       * than no breakdown at all.
       */
      amountSubtotalCents: number;
      discountCents: number;
      taxCents: number;
      amountPaidCents: number;
      currency: string;
      automaticTaxStatus: string;
      refundStatus: string;
      purchasedAt: string | null;
      claimedAt: string | null;
    }>;
  } catch (error) {
    const giftError = toGiftError(error);
    if (giftError.code === "FEATURE_OFF") return [];
    throw giftError;
  }
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export function formatMoneyCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(cents / 100) ? 0 : 2,
  }).format(cents / 100);
}

export function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function monthsLabel(months: number): string {
  return `${months} month${months === 1 ? "" : "s"}`;
}

/** A date from the API, in the customer's own words. */
export function formatGiftDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
