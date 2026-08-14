"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import {
  cancelSubscription,
  changeSubscriptionPlan,
  reactivateSubscription,
  getMySubscriptions,
  createBillingPortalSession,
  requestSubscriptionRetentionOffer,
  acceptSubscriptionRetentionOffer,
  getSubscriptionActionErrorMessage,
  type ManagedSubscription,
  type RetentionOfferDebug,
} from "@/lib/subscription-service";

type PlanKey = "basic" | "plus" | "premium" | "elite";

const PLAN_PRICES: Record<PlanKey, number> = {
  basic: 149,
  plus: 249,
  premium: 349,
  elite: 499,
};

/*
 * What an annual member is charged: ten months, for twelve months of
 * membership. Mirrors the live Stripe annual prices.
 */
const ANNUAL_MONTHS_CHARGED = 10;

/**
 * The amount on the member's own subscription card.
 *
 * The backend sends planPrice already matched to the billing cycle, so that is
 * preferred. The fallback has to respect the cycle too: an annual member whose
 * record predates that field would otherwise be shown the monthly figure with a
 * "/year" label beside it.
 */
function planAmountForCycle(
  planPrice: number | null | undefined,
  plan: PlanKey,
  billingCycle?: string | null
): string {
  const monthly = PLAN_PRICES[plan];
  const fallback =
    String(billingCycle || "").toLowerCase() === "annual"
      ? monthly * ANNUAL_MONTHS_CHARGED
      : monthly;
  return Number(planPrice || fallback).toLocaleString("en-US");
}

const PLAN_INCLUDES: Record<PlanKey, string[]> = {
  basic: [
    "Your home, handled",
    "1 active appointment at a time",
    "Each visit covers up to 90 minutes of work",
  ],
  plus: [
    "Everything in Basic, with more capacity",
    "2 active appointments at a time",
    "Same trusted team, every visit",
  ],
  premium: [
    "Everything in Plus, plus faster scheduling",
    "2 active appointments at a time",
    "One Priority Visit per month",
    "Priority Visits help when you need service before the next standard appointment slot, subject to technician availability",
  ],
  elite: [
    "Everything in Premium, plus project time",
    "2 active appointments at a time",
    "Two Priority Visits per month",
    "One full project day per month (up to 8 hours)",
  ],
};

/*
 * Account used to be the one place that showed only the marketing names, so a
 * member's dashboard and the comparison page called the same plan two
 * different things. These now match the tier names used everywhere else.
 */
const PLAN_DISPLAY_NAMES: Record<PlanKey, string> = {
  basic: "Basic",
  plus: "Plus",
  premium: "Premium",
  elite: "Elite",
};

const PLAN_RANK: Record<PlanKey, number> = {
  basic: 1,
  plus: 2,
  premium: 3,
  elite: 4,
};

function classifyChange(
  sub: ManagedSubscription,
  newPlan: PlanKey,
  newCycle: "monthly" | "annual"
): "upgrade" | "downgrade" | "same" {
  const currentPlan = sub.subscriptionType as PlanKey;
  const currentCycle = sub.billingCycle || "monthly";
  const currentRank = PLAN_RANK[currentPlan] ?? 0;
  const newRank = PLAN_RANK[newPlan] ?? 0;

  if (currentRank === newRank && currentCycle === newCycle) return "same";
  if (newRank > currentRank) return "upgrade";
  if (newRank < currentRank) return "downgrade";
  if (currentCycle === "monthly" && newCycle === "annual") return "upgrade";
  return "downgrade";
}

function formatPlanName(plan: string) {
  return String(plan || "")
    .charAt(0)
    .toUpperCase()
    .concat(String(plan || "").slice(1));
}

function formatDate(date?: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAddress(subscription: ManagedSubscription) {
  const address = subscription.address || subscription.addressSnapshot;
  if (!address) return "Address on file";
  const label = "label" in address ? address.label : undefined;
  const prefix = label ? `${label}: ` : "";
  const line = [address.line1, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(", ");
  return `${prefix}${line || "Address on file"}`;
}

function isManageableStatus(status?: string | null) {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

function statusLabel(subscription: ManagedSubscription, options: { hideCancellationUi?: boolean } = {}) {
  if (subscription.cancelAtPeriodEnd && !options.hideCancellationUi) return "Cancels at period end";
  if (subscription.cancellationReason === "payment_failed") return "Payment could not be processed";
  if (subscription.pendingPlan) return "Scheduled change";
  const status = String(subscription.status || "").toLowerCase();
  if (status === "trialing") return "Trialing";
  if (status === "past_due") return "Past due";
  if (status === "unpaid") return "Payment issue";
  if (status === "incomplete") return "Action needed";
  if (status === "canceled" && options.hideCancellationUi) return "Ended";
  if (status === "canceled") return "Canceled";
  if (status === "expired") return "Expired";
  return "Active";
}

function retentionEndpointPath(addressId: string) {
  return `/api/subscriptions/manage/address/${addressId}/retention-offer`;
}

function hasStoredAuthToken() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("token"));
}

type ApiErrorWithResponse = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      reason?: string;
      debug?: RetentionOfferDebug;
    };
  };
  message?: string;
};

function RetentionDebugDetails({ debug }: { debug: RetentionOfferDebug | null }) {
  if (!debug || process.env.NODE_ENV === "production") return null;

  return (
    <details className="mt-4 rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-3 text-left">
      <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-[0.14em] text-[#306EEC]">
        Retention debug
      </summary>
      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[#475569]">
        {JSON.stringify(debug, null, 2)}
      </pre>
    </details>
  );
}

type PlanSectionProps = {
  hideCancellationUi?: boolean;
};

export function PlanSection({ hideCancellationUi = false }: PlanSectionProps = {}) {
  const showCancellationUi = !hideCancellationUi;
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ManagedSubscription[]>([]);

  const [cancelTarget, setCancelTarget] = useState<ManagedSubscription | null>(null);
  const [cancelMode, setCancelMode] = useState<"checking" | "offer" | "confirm" | "accepted">("confirm");
  const [canceling, setCanceling] = useState(false);
  const [acceptingRetention, setAcceptingRetention] = useState(false);
  const [retentionError, setRetentionError] = useState("");
  const [retentionDebug, setRetentionDebug] = useState<RetentionOfferDebug | null>(null);

  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const [planChangeTarget, setPlanChangeTarget] = useState<ManagedSubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("plus");
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "annual">("monthly");
  const [planChanging, setPlanChanging] = useState(false);
  const [planChangeConfirmOpen, setPlanChangeConfirmOpen] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [billingPortalLoadingId, setBillingPortalLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getMySubscriptions();
        if (!alive) return;

        const ranked = [...(data.subscriptions || [])].sort((a, b) => {
          const activeScore = isManageableStatus(a.status) ? 1 : 0;
          const otherActiveScore = isManageableStatus(b.status) ? 1 : 0;
          if (activeScore !== otherActiveScore) return otherActiveScore - activeScore;

          const aDate = new Date(a.currentPeriodEnd || a.nextPaymentDate || a.startDate || 0).getTime();
          const bDate = new Date(b.currentPeriodEnd || b.nextPaymentDate || b.startDate || 0).getTime();
          return bDate - aDate;
        });

        setSubscriptions(ranked);
      } catch (err: unknown) {
        if (!alive) return;
        setError(getSubscriptionActionErrorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => isManageableStatus(subscription.status)),
    [subscriptions]
  );

  /*
   * The account record and the subscription record are two different calls, and
   * only the second one carries the plan detail this section renders. If it
   * fails or comes back empty we used to fall through to the acquisition card,
   * which told a paying member "No active membership" and offered them a
   * signup. The address flag is enough to know that is wrong, so we say we
   * could not load the plan instead of contradicting what they pay for.
   */
  const { user } = useAuth();
  const addressesSayMember = Boolean(
    user?.addresses?.some((address) => address.hasActiveSubscription === true)
  );
  const planUnavailable = !activeSubscriptions.length && addressesSayMember;

  const historicalSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => !isManageableStatus(subscription.status)),
    [subscriptions]
  );

  const paymentEndedSubscriptions = useMemo(
    () =>
      subscriptions.filter(
        (subscription) =>
          subscription.cancellationReason === "payment_failed" ||
          ["past_due", "unpaid", "incomplete_expired"].includes(
            String(subscription.status || "").toLowerCase()
          )
      ),
    [subscriptions]
  );

  const openCancelFlow = async (subscription: ManagedSubscription) => {
    if (!subscription.addressId) return;

    setCancelTarget(subscription);
    setCancelMode("checking");
    setCanceling(false);
    setAcceptingRetention(false);
    setRetentionError("");
    setRetentionDebug(null);
    setError("");
    setNotice("");

    const endpointPath = retentionEndpointPath(subscription.addressId);
    const authTokenPresent = hasStoredAuthToken();

    console.info("[retention-offer] Checking eligibility", {
      endpointPath,
      authTokenPresent,
      subscriptionId: subscription._id,
      addressId: subscription.addressId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? null,
    });

    try {
      const result = await requestSubscriptionRetentionOffer({
        addressId: subscription.addressId,
      });
      const debug = result.debug || null;
      setRetentionDebug(debug);

      console.info("[retention-offer] Eligibility response", {
        endpointPath,
        authTokenPresent,
        eligible: result.eligible,
        reason: result.reason || null,
        debug,
      });

      const updatedSubscription = result.subscription;
      if (updatedSubscription) {
        setSubscriptions((current) =>
          current.map((item) =>
            item._id === updatedSubscription._id ? updatedSubscription : item
          )
        );
      }

      if (!result.eligible) {
        console.warn("[retention-offer] Offer unavailable", {
          reason: result.reason || "unknown",
          subscriptionId: subscription._id,
          addressId: subscription.addressId,
          status: updatedSubscription?.status || subscription.status,
          cancelAtPeriodEnd:
            updatedSubscription?.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
          debug,
        });
        setRetentionError(
          "This member offer is not available for this membership, but you can still continue cancellation."
        );
      }

      setCancelMode(result.eligible ? "offer" : "confirm");
    } catch (err) {
      const apiError = err as ApiErrorWithResponse;
      const responseDebug = apiError.response?.data?.debug || null;
      setRetentionDebug(responseDebug);
      console.warn("[retention-offer] Eligibility check failed", {
        endpointPath,
        authTokenPresent,
        subscriptionId: subscription._id,
        addressId: subscription.addressId,
        httpStatus: apiError.response?.status || null,
        responseReason: apiError.response?.data?.reason || null,
        responseMessage:
          apiError.response?.data?.message ||
          apiError.response?.data?.error ||
          null,
        debug: responseDebug,
        message:
          apiError.message ||
          (err instanceof Error ? err.message : "Unknown error"),
      });
      setRetentionError(
        "We couldn't check the retention offer right now, but you can still continue cancellation."
      );
      setCancelMode("confirm");
    }
  };

  const handleCancel = async (retentionOfferDeclined = false) => {
    if (!cancelTarget?.addressId) return;

    setCanceling(true);
    setError("");
    setNotice("");

    try {
      const result = await cancelSubscription({
        addressId: cancelTarget.addressId,
        retentionOfferDeclined,
      });

      setSubscriptions((current) =>
        current.map((subscription) =>
          subscription._id === result.subscription._id ? result.subscription : subscription
        )
      );
      setNotice(result.message || "Cancellation scheduled successfully.");
      setCancelTarget(null);
      setRetentionDebug(null);
    } catch (err: unknown) {
      setError(getSubscriptionActionErrorMessage(err));
    } finally {
      setCanceling(false);
    }
  };

  const handleAcceptRetentionOffer = async () => {
    if (!cancelTarget?.addressId) return;

    setAcceptingRetention(true);
    setRetentionError("");
    setError("");
    setNotice("");

    try {
      const result = await acceptSubscriptionRetentionOffer({
        addressId: cancelTarget.addressId,
      });

      setSubscriptions((current) =>
        current.map((subscription) =>
          subscription._id === result.subscription._id ? result.subscription : subscription
        )
      );
      setCancelMode("accepted");
      setNotice("");
    } catch (err: unknown) {
      const message = getSubscriptionActionErrorMessage(err);
      setRetentionError(
        message === "Something went wrong. Please try again or call (631) 599-1363."
          ? "We couldn't apply the discount right now. You can try again or continue cancellation."
          : message
      );
    } finally {
      setAcceptingRetention(false);
    }
  };

  const handleReactivate = async (subscription: ManagedSubscription) => {
    if (!subscription.addressId) return;

    setReactivatingId(subscription._id);
    setError("");
    setNotice("");

    try {
      const result = await reactivateSubscription({ addressId: subscription.addressId });
      setSubscriptions((current) =>
        current.map((s) => (s._id === result.subscription._id ? result.subscription : s))
      );
      setNotice(result.message || "Membership reactivated successfully.");
    } catch (err: unknown) {
      setError(getSubscriptionActionErrorMessage(err));
    } finally {
      setReactivatingId(null);
    }
  };

  const handleManageBilling = async (subscription: ManagedSubscription) => {
    setBillingPortalLoadingId(subscription._id);
    setError("");
    try {
      const { url } = await createBillingPortalSession({
        addressId: subscription.addressId ?? undefined,
      });
      window.location.href = url;
    } catch (err: unknown) {
      setError(getSubscriptionActionErrorMessage(err));
      setBillingPortalLoadingId(null);
    }
  };

  const reviewPlanChange = () => {
    if (!planChangeTarget) return;
    if (planChangeType === "same") {
      setError("You're already on this plan.");
      return;
    }
    setError("");
    setPlanChangeConfirmOpen(true);
  };

  const handlePlanChange = async () => {
    if (!planChangeTarget?.addressId) return;

    setPlanChanging(true);
    setError("");
    setNotice("");

    try {
      const result = await changeSubscriptionPlan({
        addressId: planChangeTarget.addressId,
        plan: selectedPlan,
        billingCycle: selectedCycle,
      });
      setSubscriptions((current) =>
        current.map((s) => (s._id === result.subscription._id ? result.subscription : s))
      );
      setNotice(
        planChangeType === "downgrade"
          ? "Your downgrade has been scheduled."
          : "Your plan has been updated."
      );
      setPlanChangeTarget(null);
      setPlanChangeConfirmOpen(false);
    } catch (err: unknown) {
      setError(getSubscriptionActionErrorMessage(err));
    } finally {
      setPlanChanging(false);
    }
  };

  const Card = ({
    children,
    className = "",
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`w-full rounded-[8px] border border-[#C5CBD8] bg-[#EEF2FF] p-5 sm:p-6 ${className}`}
      style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.10)" }}
    >
      {children}
    </div>
  );

  const planChangeType =
    planChangeTarget
      ? classifyChange(planChangeTarget, selectedPlan, selectedCycle)
      : "same";
  const planChangeCurrentPlan = planChangeTarget?.subscriptionType as PlanKey | undefined;
  const planChangeCurrentPrice = planChangeTarget
    ? planChangeTarget.planPrice || PLAN_PRICES[planChangeCurrentPlan || "plus"]
    : null;
  const planChangeNextPrice = PLAN_PRICES[selectedPlan];
  const planChangeRenewalDate = formatDate(
    planChangeTarget?.currentPeriodEnd || planChangeTarget?.nextPaymentDate || null
  );

  return (
    <>
      <div>
        <h2 className="mb-6 text-xl font-semibold text-[#313234] sm:mb-8 sm:text-2xl">
          My plan{activeSubscriptions.length > 1 ? "s" : ""}
        </h2>

        {notice ? (
          <div className="mb-4 rounded-[8px] border border-[#86EFAC]/50 bg-[#ECFDF3] px-4 py-3 text-sm font-semibold text-[#166534]">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-[8px] border border-[#FCA5A5]/60 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {!loading && paymentEndedSubscriptions.length ? (
          <div className="mb-4 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm font-semibold text-[#92400E]">
            Your Membership ended because payment could not be processed. Please start a new Membership to continue booking.
          </div>
        ) : null}

        {loading ? (
          <Card className="max-w-[620px]">
            <div className="text-sm text-[#6A6D71] sm:text-base">Loading your plan details...</div>
          </Card>
        ) : planUnavailable ? (
          <Card className="max-w-[620px]">
            <h3 className="text-lg font-semibold text-[#313234] sm:text-xl">
              We could not load your plan
            </h3>
            <p className="mt-2 text-sm text-[#6A6D71] sm:text-base">
              Your membership is active. The plan details just did not load this time. Refresh the
              page, or call us on{" "}
              <a className="font-semibold text-[#306EEC]" href="tel:+16315991363">
                631-599-1363
              </a>{" "}
              and we will sort it out.
            </p>
            <Link
              href="/book?visit=membership"
              className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2557C7]"
            >
              Book a visit
            </Link>
          </Card>
        ) : !activeSubscriptions.length ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="max-w-[620px]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 text-sm text-[#6A6D71]">No active membership</div>
                  <h3 className="text-lg font-semibold text-[#313234] sm:text-xl">
                    Recommended: <span className="text-[#306EEC]">{PLAN_DISPLAY_NAMES.plus}</span>
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-[#313234]">${PLAN_PRICES.plus}</span>
                    <span className="text-sm text-[#6A6D71] sm:text-base">/month</span>
                  </div>
                </div>

                <div className="shrink-0 rounded-[6px] border border-[#C5CBD8] bg-white/70 px-3 py-2">
                  <span className="text-xs font-semibold text-[#313234]">Most members start here</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold text-[#313234]">Why members start here</div>
                <ul className="space-y-2 text-sm text-[#6A6D71]">
                  {PLAN_INCLUDES.plus.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-bold text-[#306EEC]">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/membership/plans"
                className="mt-6 block w-full rounded-[8px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7] sm:py-4 sm:text-lg"
              >
                Start Membership
              </Link>

              <div className="mt-3 text-xs text-[#6A6D71] opacity-80">
                Manage your plan and book online anytime.
              </div>
            </Card>

            <Card className="max-w-[620px]">
              <h3 className="mb-3 text-lg font-semibold text-[#313234] sm:text-xl">
                Need help before reaching out?
              </h3>

              <div className="space-y-2 text-sm text-[#6A6D71]">
                <p>What can I book? See common tasks and visit expectations.</p>
                <p>How often can I book? You can book as often as availability allows.</p>
                <p>No estimates. No surprises. Everything stays easy to manage online.</p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href="/membership/plans"
                  className="inline-flex items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                >
                  See plans
                </Link>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                {activeSubscriptions.map((subscription) => {
                  const plan = String(subscription.subscriptionType || "").toLowerCase() as PlanKey;
                  const renewalDate = formatDate(
                    subscription.currentPeriodEnd || subscription.nextPaymentDate || null
                  );
                  const cancellationDate = formatDate(subscription.cancellationDate || null);
                  const pendingPlan = subscription.pendingPlan
                    ? formatPlanName(subscription.pendingPlan)
                    : null;
                  const pendingChangeDate = formatDate(
                    subscription.pendingChangeEffectiveDate || null
                  );
                  const isReactivating = reactivatingId === subscription._id;

                  return (
                    <Card key={subscription._id} className="max-w-[620px]">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-[#306EEC]">
                            {statusLabel(subscription, { hideCancellationUi })}
                          </div>
                          <h3 className="mt-1 text-xl font-semibold text-[#313234] sm:text-2xl">
                            {formatPlanName(plan)} plan
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[#6A6D71]">
                            {formatAddress(subscription)}
                          </p>
                        </div>

                        <div className="rounded-[8px] border border-[#C5CBD8] bg-white/70 px-4 py-3 text-right">
                          <div className="text-2xl font-semibold text-[#313234]">
                            $
                            {planAmountForCycle(
                              subscription.planPrice,
                              plan,
                              subscription.billingCycle
                            )}
                          </div>
                          <div className="text-sm text-[#6A6D71]">
                            /{subscription.billingCycle === "annual" ? "year" : "month"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-[8px] border border-[#D7E0F5] bg-white/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                            Billing
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#313234] capitalize">
                            {subscription.billingCycle}
                          </div>
                        </div>
                        <div className="rounded-[8px] border border-[#D7E0F5] bg-white/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                            {subscription.cancelAtPeriodEnd ? "Active Until" : "Renewal"}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#313234]">
                            {renewalDate || "On file"}
                          </div>
                        </div>
                        <div className="rounded-[8px] border border-[#D7E0F5] bg-white/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                            Status
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#313234]">
                            {statusLabel(subscription, { hideCancellationUi })}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-sm font-semibold text-[#313234]">
                          Included with this plan
                        </div>
                        <ul className="space-y-2 text-sm text-[#6A6D71]">
                          {PLAN_INCLUDES[plan].map((item) => (
                            <li key={`${subscription._id}-${item}`} className="flex gap-2">
                              <span className="font-bold text-[#306EEC]">&bull;</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {showCancellationUi && subscription.cancelAtPeriodEnd ? (
                        <div className="mt-5 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
                          <div className="font-semibold">Cancellation scheduled</div>
                          <div className="mt-1">
                            Your plan stays active until{" "}
                            <strong>{cancellationDate || renewalDate || "the end of your current billing period"}</strong>.
                            No new charges will be made after that date.
                          </div>
                        </div>
                      ) : null}

                      {pendingPlan && !subscription.cancelAtPeriodEnd ? (
                        <div className="mt-5 rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-sm text-[#1D4ED8]">
                          <div className="font-semibold">Scheduled next plan: {pendingPlan}</div>
                          <div className="mt-1">
                            Your current {formatPlanName(plan)} plan stays active until{" "}
                            {pendingChangeDate || renewalDate || "the next billing date"}. After that,
                            {` ${pendingPlan}`} begins automatically.
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        {showCancellationUi && subscription.cancelAtPeriodEnd ? (
                          <button
                            type="button"
                            disabled={isReactivating}
                            onClick={() => handleReactivate(subscription)}
                            className="block w-full rounded-[8px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7] disabled:opacity-60"
                          >
                            {isReactivating ? "Reactivating..." : "Reactivate plan"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={billingPortalLoadingId === subscription._id}
                            onClick={() => handleManageBilling(subscription)}
                            className="block w-full rounded-[8px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7]"
                          >
                            {billingPortalLoadingId === subscription._id
                              ? "Opening billing..."
                              : "Manage Billing"}
                          </button>
                        )}

                        {showCancellationUi ? (
                          <button
                            type="button"
                            disabled={
                              subscription.cancelAtPeriodEnd ||
                              canceling ||
                              acceptingRetention ||
                              (cancelTarget?._id === subscription._id && cancelMode === "checking")
                            }
                            onClick={() => openCancelFlow(subscription)}
                            className="w-full rounded-[8px] border border-[#C5CBD8] bg-white/70 py-3 text-base font-semibold text-[#313234] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {subscription.cancelAtPeriodEnd
                              ? "Cancellation scheduled"
                              : cancelTarget?._id === subscription._id && cancelMode === "checking"
                              ? "Checking options..."
                              : "Cancel Membership"}
                          </button>
                        ) : null}
                      </div>

                      {subscription.stripeManaged ? (
                        <div className="mt-1 text-xs font-semibold text-[#6A6D71]">
                          {showCancellationUi
                            ? "Billing settings include plan changes, payment methods, invoices, and cancellation review."
                            : "Billing settings include plan changes, payment methods, and invoices."}
                        </div>
                      ) : null}

                      <div className="mt-3 text-xs text-[#6A6D71]">
                        {showCancellationUi && subscription.cancelAtPeriodEnd
                          ? `Service continues until ${cancellationDate || renewalDate || "the end of the current period"}. You can reactivate anytime before that.`
                          : pendingPlan
                            ? `${pendingPlan} is scheduled for ${pendingChangeDate || renewalDate || "your next billing date"}, while your current plan stays active now.`
                            : "You can manage your plan and book online anytime."}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <Card className="max-w-[620px] h-fit">
                <h3 className="mb-3 text-lg font-semibold text-[#313234] sm:text-xl">Need help before reaching out?</h3>
                <p className="text-sm leading-relaxed text-[#6A6D71]">
                  Most answers are available in your booking and plan details.
                </p>

                <div className="mt-5 space-y-3">
                  <Link
                    href="/membership/plans"
                    className="flex items-center justify-between rounded-[8px] border border-[#D7E0F5] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                  >
                    <span>How often can I book?</span>
                    <span className="text-[#306EEC]">Open</span>
                  </Link>
                  <Link
                    href="/book?visit=membership"
                    className="flex items-center justify-between rounded-[8px] border border-[#D7E0F5] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                  >
                    <span>Book your next visit</span>
                    <span className="text-[#306EEC]">Go</span>
                  </Link>
                </div>

                <div className="mt-6 rounded-[8px] border border-[#D7E0F5] bg-white/80 p-4">
                  <div className="text-sm font-semibold text-[#313234]">Simple monthly pricing</div>
                  <div className="mt-1 text-sm text-[#6A6D71]">
                    No estimates. No surprises. Each visit covers up to 90 minutes of work.
                  </div>
                </div>
              </Card>
            </div>

            {historicalSubscriptions.length ? (
              <Card className="max-w-[620px]">
                <h3 className="text-lg font-semibold text-[#313234]">Past plan history</h3>
                <div className="mt-4 space-y-3">
                  {historicalSubscriptions.map((subscription) => (
                    <div
                      key={subscription._id}
                      className="rounded-[8px] border border-[#D7E0F5] bg-white/70 px-4 py-3"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-[#313234]">
                          {formatPlanName(subscription.subscriptionType)} plan
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                          {statusLabel(subscription, { hideCancellationUi })}
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-[#6A6D71]">{formatAddress(subscription)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Cancel confirmation modal ── */}
      {showCancellationUi && cancelTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={() => {
            if (!canceling && !acceptingRetention && cancelMode !== "checking") {
              setCancelTarget(null);
              setRetentionError("");
              setRetentionDebug(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[8px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              {cancelMode === "checking" ? (
                <div className="py-4">
                  <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-[#D7E0F5] border-t-[#306EEC]" />
                  <h3 className="text-xl font-extrabold text-[#313234]">
                    Checking your membership...
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6A6D71]">
                    We&apos;re checking whether a retention offer is available for this membership.
                  </p>
                </div>
              ) : cancelMode === "offer" ? (
                <>
                  <div className="mx-auto mb-5 inline-flex rounded-[6px] border border-[#D7E0F5] bg-[#EEF2FF] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#306EEC]">
                    Member offer
                  </div>

                  <h3 className="text-3xl font-extrabold tracking-[-0.02em] text-[#313234]">
                    Before you cancel...
                  </h3>
                  <div className="mx-auto mt-4 max-w-[340px] space-y-3 text-sm leading-relaxed text-[#6A6D71]">
                    <p>We&apos;d love to keep taking care of your home.</p>
                    <p>
                      Stay with Profixter and receive{" "}
                      <strong className="font-extrabold text-[#313234]">
                        30% OFF your next monthly renewal.
                      </strong>
                    </p>
                    <p>Your membership stays exactly the same.</p>
                    <p>
                      The discount applies to your next renewal only. After that, your membership
                      automatically returns to the regular monthly price.
                    </p>
                  </div>

                  {retentionError ? (
                    <div className="mt-5 rounded-[8px] border border-[#FCA5A5]/60 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
                      {retentionError}
                    </div>
                  ) : null}
                  <RetentionDebugDetails debug={retentionDebug} />

                  <div className="mt-6 grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      disabled={acceptingRetention || canceling}
                      onClick={handleAcceptRetentionOffer}
                      className="min-h-[46px] rounded-[8px] bg-[#306EEC] px-4 py-3 text-base font-extrabold text-white transition hover:bg-[#2558c9] disabled:opacity-60"
                    >
                      {acceptingRetention
                        ? "Applying offer..."
                        : "Keep My Membership (30% OFF Next Month)"}
                    </button>
                    <button
                      type="button"
                      disabled={acceptingRetention || canceling}
                      onClick={() => handleCancel(true)}
                      className="min-h-[46px] rounded-[8px] border border-[#D1D5DB] bg-white px-4 py-3 text-base font-extrabold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
                    >
                      {canceling ? "Scheduling cancellation..." : "Continue Cancellation"}
                    </button>
                  </div>
                </>
              ) : cancelMode === "accepted" ? (
                <>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF3] text-2xl font-extrabold text-[#166534]">
                    OK
                  </div>

                  <h3 className="text-3xl font-extrabold tracking-[-0.02em] text-[#313234]">
                    You&apos;re all set!
                  </h3>
                  <p className="mx-auto mt-4 max-w-[340px] text-sm leading-relaxed text-[#6A6D71]">
                    Your next renewal will automatically receive 30% off. After that, your
                    membership returns to the regular monthly price.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setCancelTarget(null);
                      setRetentionError("");
                      setRetentionDebug(null);
                      setNotice("Retention offer accepted. Your membership remains active.");
                    }}
                    className="mt-6 h-[46px] w-full rounded-[8px] bg-[#306EEC] font-extrabold text-white transition hover:bg-[#2558c9]"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl">
                !
              </div>

              <h3 className="text-2xl font-extrabold text-[#313234]">Are you sure you want to cancel?</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6A6D71]">
                You&apos;ll keep your membership until the end of the current billing period.
                Your home stays in regular care until then.
              </p>

              {retentionError ? (
                <div className="mt-5 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-left text-sm font-semibold text-[#92400E]">
                  {retentionError}
                </div>
              ) : null}
              <RetentionDebugDetails debug={retentionDebug} />

              <div className="mt-5 rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
                <div className="text-sm font-semibold text-[#313234]">Before you cancel</div>
                <div className="mt-2 space-y-1.5 text-sm text-[#6A6D71]">
                  <div>Keep predictable monthly billing and the same trusted team.</div>
                  <div>Higher Memberships add more active appointment capacity, Priority Visits, project time, and premium support.</div>
                  <div>You can keep your current membership and continue scheduling visits online.</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={canceling}
                  onClick={() => {
                    setCancelTarget(null);
                    setRetentionError("");
                    setRetentionDebug(null);
                  }}
                  className="h-[46px] rounded-[8px] bg-[#306EEC] font-extrabold text-white transition hover:bg-[#2558c9] disabled:opacity-60"
                >
                  Keep my membership
                </button>
                <button
                  type="button"
                  disabled={canceling}
                  onClick={() => handleCancel(false)}
                  className="h-[46px] rounded-[8px] border border-[#D1D5DB] bg-white font-extrabold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  {canceling ? "Canceling..." : "Cancel anyway"}
                </button>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Plan change modal ── */}
      {planChangeTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={() => {
            if (!planChanging) setPlanChangeTarget(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-[8px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-1 text-xl font-extrabold text-[#313234]">Change plan</h3>
            <p className="mb-5 text-sm text-[#6A6D71]">
              Current: {formatPlanName(planChangeTarget.subscriptionType)},{" "}
              {planChangeTarget.billingCycle}
            </p>

            {/* Plan selector */}
            <div className="mb-4 space-y-2">
              {(["basic", "plus", "premium", "elite"] as PlanKey[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlan(p)}
                  className={`flex w-full items-center justify-between rounded-[8px] border px-4 py-3 text-left transition ${
                    selectedPlan === p
                      ? "border-[#306EEC] bg-[#EEF2FF]"
                      : "border-[#D7E0F5] bg-white/70 hover:bg-white"
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-[#313234]">
                      {PLAN_DISPLAY_NAMES[p]}
                    </div>
                    <div className="text-xs text-[#6A6D71]">{PLAN_INCLUDES[p][0]}</div>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <div className="text-base font-semibold text-[#313234]">${PLAN_PRICES[p]}</div>
                    <div className="text-xs text-[#6A6D71]">/mo</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Billing cycle */}
            <div className="mb-5 flex gap-3">
              {(["monthly", "annual"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCycle(c)}
                  className={`flex-1 rounded-[8px] border py-2.5 text-sm font-semibold capitalize transition ${
                    selectedCycle === c
                      ? "border-[#306EEC] bg-[#EEF2FF] text-[#306EEC]"
                      : "border-[#D7E0F5] bg-white/70 text-[#313234] hover:bg-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Change type note */}
            {planChangeType !== "same" ? (
              <div
                className={`mb-5 rounded-[8px] border p-3 text-sm ${
                  planChangeType === "upgrade"
                    ? "border-[#86EFAC]/50 bg-[#ECFDF3] text-[#166534]"
                    : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                }`}
              >
                {planChangeType === "upgrade"
                  ? "Upgrade is applied immediately. A prorated charge will be made today for the difference."
                  : "Downgrade takes effect at your next billing date. Your current plan stays active until then."}
              </div>
            ) : (
              <div className="mb-5 rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-3 text-sm font-semibold text-[#313234]">
                You&apos;re already on this plan.
              </div>
            )}

            {error ? (
              <div className="mb-4 rounded-[8px] border border-[#FCA5A5]/60 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={planChanging}
                onClick={() => setPlanChangeTarget(null)}
                className="flex-1 rounded-[8px] border border-[#D1D5DB] bg-white py-3 font-semibold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={planChanging || planChangeType === "same"}
                onClick={reviewPlanChange}
                className="flex-1 rounded-[8px] bg-[#306EEC] py-3 font-semibold text-white transition hover:bg-[#2557C7] disabled:opacity-60"
              >
                {planChangeType === "upgrade"
                  ? "Review Upgrade"
                  : planChangeType === "downgrade"
                    ? "Review Downgrade"
                    : "You're already on this plan."}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {planChangeTarget && planChangeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          onClick={() => {
            if (!planChanging) setPlanChangeConfirmOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-[8px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-2xl font-extrabold text-[#313234]">
              {planChangeType === "upgrade"
                ? `You're upgrading from ${formatPlanName(planChangeCurrentPlan || "")} to ${formatPlanName(selectedPlan)}.`
                : `You're scheduling a downgrade from ${formatPlanName(planChangeCurrentPlan || "")} to ${formatPlanName(selectedPlan)}.`}
            </h3>

            <div className="mt-5 grid gap-3 rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-sm text-[#313234] sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">Current plan</div>
                <div className="mt-1 font-semibold">{formatPlanName(planChangeCurrentPlan || "")}</div>
                <div className="text-[#6A6D71]">
                  ${planChangeCurrentPrice ?? 0}/month
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">New plan</div>
                <div className="mt-1 font-semibold">{formatPlanName(selectedPlan)}</div>
                <div className="text-[#6A6D71]">
                  ${planChangeNextPrice}/month
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">Billing cycle</div>
                <div className="mt-1 font-semibold capitalize">{selectedCycle}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">Effective timing</div>
                <div className="mt-1 font-semibold">
                  {planChangeType === "upgrade"
                    ? "Starts immediately"
                    : "Starts on your next billing date"}
                </div>
                {planChangeType === "downgrade" && planChangeRenewalDate ? (
                  <div className="text-[#6A6D71]">{planChangeRenewalDate}</div>
                ) : null}
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#6A6D71]">
              {planChangeType === "upgrade"
                ? "Stripe may charge a prorated amount today based on the time left in your billing period."
                : "You'll keep your current plan until the end of this billing period."}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={planChanging}
                onClick={() => setPlanChangeConfirmOpen(false)}
                className="h-[46px] rounded-[8px] border border-[#D1D5DB] bg-white font-extrabold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={planChanging}
                onClick={handlePlanChange}
                className="h-[46px] rounded-[8px] bg-[#306EEC] font-extrabold text-white transition hover:bg-[#2558c9] disabled:opacity-60"
              >
                {planChanging
                  ? "Updating..."
                  : planChangeType === "upgrade"
                    ? "Confirm Upgrade"
                    : "Schedule Downgrade"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
