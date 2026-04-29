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
}): Promise<{ message: string; subscription: ManagedSubscription }> {
  const response = await API.post<{ message: string; subscription: ManagedSubscription }>(
    `/api/subscriptions/manage/address/${params.addressId}/cancel`
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
