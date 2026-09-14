import API from "./api";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "canceled"
  | "expired";

export type SubscriptionPlan = "basic" | "plus" | "premium" | "elite";
export type BillingCycle = "monthly" | "annual";

export type ManagedSubscription = {
  _id: string;
  addressId: string | null;
  address?: {
    _id: string;
    label?: string;
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
  } | null;
  addressSnapshot?: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
  } | null;
  subscriptionType: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate?: string | null;
  latestPaymentDate?: string | null;
  nextPaymentDate?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancellationDate?: string | null;
  cancellationReason?: string | null;
  pendingPlan?: SubscriptionPlan | null;
  pendingBillingCycle?: BillingCycle | null;
  pendingStripePriceId?: string | null;
  pendingChangeEffectiveDate?: string | null;
  planPrice?: number | null;
  stripeManaged?: boolean;
};

export type RetentionOfferDebug = {
  route?: string | null;
  apiResponseReason?: string | null;
  couponEnvPresent?: boolean | null;
  subscriptionId?: string | null;
  addressId?: string | null;
  status?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  stripeSubscriptionId?: string | null;
  stripeStatus?: string | null;
  stripeCancelAtPeriodEnd?: boolean | null;
  retentionOffer?: {
    offeredAt?: string | null;
    acceptedAt?: string | null;
    declinedAt?: string | null;
  };
};

export type RetentionOfferResponse = {
  eligible: boolean;
  reason?: string;
  offer?: {
    title?: string;
    discountLabel?: string;
    offeredAt?: string;
  };
  subscription?: ManagedSubscription;
  debug?: RetentionOfferDebug;
};

export type RetentionOfferAcceptResponse = {
  message: string;
  subscription: ManagedSubscription;
  retentionOffer?: {
    acceptedAt?: string;
    nextRenewalDate?: string | null;
    discountDescription?: string | null;
  };
};

/**
 * One property's Loyalty Benefits, exactly as the server describes them.
 *
 * Every headline and every sentence is composed on the server, so the account
 * screen, the cancellation screen and the emails cannot drift apart, and the
 * ladder can change without a front-end deploy. Nothing here is computed on the
 * client — including the dates, which come from the real billing period.
 */
export type LoyaltyReward = {
  headline: string;
  detail: string;
};

export type LoyaltyBenefit = {
  id: string;
  milestone: number;
  kind: "tier_upgrade" | "loyalty_full_day" | "free_month";
  headline: string;
  detail: string;
  rewardPlan: SubscriptionPlan | null;
  status: string;
  grantedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  active: boolean;
  pendingFreeMonth: boolean;
};

export type LoyaltyStatus = {
  enabled: boolean;
  programStartedAt?: string | null;
  eligible: boolean;
  reason?: string;
  addressId?: string;
  plan?: SubscriptionPlan | null;
  countedMonths: number;
  nextMilestone: number | null;
  monthsRemaining: number | null;
  daysUntilNextMilestone: number | null;
  estimatedUnlockDate?: string | null;
  nextReward: LoyaltyReward | null;
  ladderComplete?: boolean;
  activeBenefits: LoyaltyBenefit[];
  loyaltyFullDaysAvailable: number;
  nextLoyaltyFullDayExpiresAt?: string | null;
  history: LoyaltyBenefit[];
  /** Only present for annual members, who take their reward up front. */
  annual?: { headline: string; detail: string };
};

type SubscriptionActionErrorShape = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

export function getSubscriptionActionErrorMessage(error: unknown): string {
  const candidate = error as SubscriptionActionErrorShape;
  const status = Number(candidate?.response?.status || 0);
  const backendMessage = String(
    candidate?.response?.data?.message ||
      candidate?.response?.data?.error ||
      candidate?.message ||
      ""
  ).toLowerCase();

  if (
    status === 401 ||
    backendMessage.includes("no token") ||
    backendMessage.includes("invalid token") ||
    backendMessage.includes("jwt")
  ) {
    return "Please log in or create an account to continue.";
  }

  if (status === 402) {
    return "Your payment needs attention. Please update your payment method.";
  }

  if (status === 409) {
    return "This address already has an active membership. Refresh your account or contact support.";
  }

  if (status === 502 || status === 503 || status === 504) {
    return "Billing is temporarily unavailable. Please call (631) 599-1363 or try again in a few minutes.";
  }

  return "Something went wrong. Please try again or call (631) 599-1363.";
}

export async function getMySubscriptions(): Promise<{ subscriptions: ManagedSubscription[] }> {
  const response = await API.get<{ subscriptions: ManagedSubscription[] }>("/api/subscriptions/my");
  return response.data;
}

export async function getManagedSubscriptionForAddress(
  addressId: string
): Promise<ManagedSubscription | null> {
  const response = await API.get<{ subscription: ManagedSubscription | null }>(
    `/api/subscriptions/manage/address/${addressId}`
  );
  return response.data?.subscription || null;
}

/**
 * Loyalty Benefits for one property.
 *
 * Never throws for a member who has none — the server answers with an
 * ineligible status and a reason, so the caller renders the right thing rather
 * than having to distinguish "no benefits" from "request failed".
 */
export async function getLoyaltyStatus(addressId: string): Promise<LoyaltyStatus | null> {
  const response = await API.get<{ loyalty: LoyaltyStatus }>(
    `/api/subscriptions/loyalty/address/${addressId}`
  );
  return response.data?.loyalty || null;
}

export async function changeSubscriptionPlan(params: {
  addressId: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
}): Promise<{ message: string; subscription: ManagedSubscription }> {
  const response = await API.patch<{ message: string; subscription: ManagedSubscription }>(
    `/api/subscriptions/manage/address/${params.addressId}`,
    {
      plan: params.plan,
      billingCycle: params.billingCycle,
    }
  );
  return response.data;
}

export async function cancelSubscription(params: {
  addressId: string;
  retentionOfferDeclined?: boolean;
}): Promise<{ message: string; subscription: ManagedSubscription }> {
  const response = await API.post<{ message: string; subscription: ManagedSubscription }>(
    `/api/subscriptions/manage/address/${params.addressId}/cancel`,
    params.retentionOfferDeclined ? { retentionOfferDeclined: true } : undefined
  );
  return response.data;
}

export async function requestSubscriptionRetentionOffer(params: {
  addressId: string;
}): Promise<RetentionOfferResponse> {
  const response = await API.post<RetentionOfferResponse>(
    `/api/subscriptions/manage/address/${params.addressId}/retention-offer`
  );
  return response.data;
}

export async function acceptSubscriptionRetentionOffer(params: {
  addressId: string;
}): Promise<RetentionOfferAcceptResponse> {
  const response = await API.post<RetentionOfferAcceptResponse>(
    `/api/subscriptions/manage/address/${params.addressId}/retention-offer/accept`
  );
  return response.data;
}

export async function reactivateSubscription(params: {
  addressId: string;
}): Promise<{ message: string; subscription: ManagedSubscription }> {
  const response = await API.post<{ message: string; subscription: ManagedSubscription }>(
    `/api/subscriptions/manage/address/${params.addressId}/reactivate`
  );
  return response.data;
}

export async function createBillingPortalSession(params?: {
  addressId?: string;
}): Promise<{ url: string }> {
  const response = await API.post<{ url: string }>(
    "/api/subscriptions/create-billing-portal-session",
    params || {}
  );
  return response.data;
}
