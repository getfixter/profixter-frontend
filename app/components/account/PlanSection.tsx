"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cancelSubscription,
  changeSubscriptionPlan,
  reactivateSubscription,
  getMySubscriptions,
  createBillingPortalSession,
  type ManagedSubscription,
} from "@/lib/subscription-service";

type PlanKey = "basic" | "plus" | "premium" | "elite";

const PLAN_PRICES: Record<PlanKey, number> = {
  basic: 149,
  plus: 249,
  premium: 349,
  elite: 499,
};

const PLAN_INCLUDES: Record<PlanKey, string[]> = {
  basic: [
    "Home Care Membership — your home, handled",
    "One scheduled visit each month",
    "Each visit covers up to 90 minutes of work",
  ],
  plus: [
    "Home Care Plus — stay ahead of your home",
    "Two scheduled visits each month",
    "Same trusted team, every visit",
  ],
  premium: [
    "Home Protection — cared for and protected",
    "Two scheduled visits each month",
    "One emergency visit per month when something can't wait",
  ],
  elite: [
    "Whole-Home Care — everything about your home, handled",
    "Two scheduled visits each month",
    "One full project day per month (up to 8 hours)",
  ],
};

const PLAN_DISPLAY_NAMES: Record<PlanKey, string> = {
  basic: "Home Care Membership",
  plus: "Home Care Plus",
  premium: "Home Protection",
  elite: "Whole-Home Care",
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

function statusLabel(subscription: ManagedSubscription) {
  if (subscription.cancelAtPeriodEnd) return "Cancels at period end";
  if (subscription.cancellationReason === "payment_failed") return "Payment could not be processed";
  if (subscription.pendingPlan) return "Scheduled change";
  const status = String(subscription.status || "").toLowerCase();
  if (status === "trialing") return "Trialing";
  if (status === "past_due") return "Past due";
  if (status === "unpaid") return "Payment issue";
  if (status === "incomplete") return "Action needed";
  if (status === "canceled") return "Canceled";
  if (status === "expired") return "Expired";
  return "Active";
}

export function PlanSection() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ManagedSubscription[]>([]);

  const [cancelTarget, setCancelTarget] = useState<ManagedSubscription | null>(null);
  const [canceling, setCanceling] = useState(false);

  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const [planChangeTarget, setPlanChangeTarget] = useState<ManagedSubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("plus");
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "annual">("monthly");
  const [planChanging, setPlanChanging] = useState(false);

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
      } catch (err: any) {
        if (!alive) return;
        setError(err?.response?.data?.message || "Unable to load your plan details right now.");
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

  const handleCancel = async () => {
    if (!cancelTarget?.addressId) return;

    setCanceling(true);
    setError("");
    setNotice("");

    try {
      const result = await cancelSubscription({ addressId: cancelTarget.addressId });

      setSubscriptions((current) =>
        current.map((subscription) =>
          subscription._id === result.subscription._id ? result.subscription : subscription
        )
      );
      setNotice(result.message || "Cancellation scheduled successfully.");
      setCancelTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to cancel your subscription right now.");
    } finally {
      setCanceling(false);
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
      setNotice(result.message || "Subscription reactivated successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to reactivate your subscription right now.");
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
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to open billing portal right now.");
      setBillingPortalLoadingId(null);
    }
  };

  const openPlanChange = (subscription: ManagedSubscription) => {
    setSelectedPlan(subscription.subscriptionType as PlanKey);
    setSelectedCycle((subscription.billingCycle as "monthly" | "annual") || "monthly");
    setPlanChangeTarget(subscription);
    setError("");
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
      setNotice(result.message || "Plan updated successfully.");
      setPlanChangeTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to change plan right now.");
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
      className={`w-full rounded-[18px] border border-[#C5CBD8] bg-[#EEF2FF] p-5 sm:p-6 ${className}`}
      style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.10)" }}
    >
      {children}
    </div>
  );

  const planChangeType =
    planChangeTarget
      ? classifyChange(planChangeTarget, selectedPlan, selectedCycle)
      : "same";

  return (
    <>
      <div>
        <h2 className="mb-6 text-xl font-semibold text-[#313234] sm:mb-8 sm:text-2xl">
          My plan{activeSubscriptions.length > 1 ? "s" : ""}
        </h2>

        {notice ? (
          <div className="mb-4 rounded-[16px] border border-[#86EFAC]/50 bg-[#ECFDF3] px-4 py-3 text-sm font-semibold text-[#166534]">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-[16px] border border-[#FCA5A5]/60 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {!loading && paymentEndedSubscriptions.length ? (
          <div className="mb-4 rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm font-semibold text-[#92400E]">
            Your subscription ended because payment could not be processed. Please start a new subscription to continue booking.
          </div>
        ) : null}

        {loading ? (
          <Card className="max-w-[620px]">
            <div className="text-sm text-[#6A6D71] sm:text-base">Loading your plan details...</div>
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

                <div className="shrink-0 rounded-full border border-[#C5CBD8] bg-white/70 px-3 py-2">
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
                href="/membership"
                className="mt-6 block w-full rounded-[14px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7] sm:py-4 sm:text-lg"
              >
                Get Started
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
                  href="/included"
                  className="inline-flex items-center justify-center rounded-[14px] border border-[#C5CBD8] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                >
                  What can I book?
                </Link>
                <Link
                  href="/membership"
                  className="inline-flex items-center justify-center rounded-[14px] border border-[#C5CBD8] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                >
                  View Plans
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
                            {statusLabel(subscription)}
                          </div>
                          <h3 className="mt-1 text-xl font-semibold text-[#313234] sm:text-2xl">
                            {formatPlanName(plan)} plan
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[#6A6D71]">
                            {formatAddress(subscription)}
                          </p>
                        </div>

                        <div className="rounded-[16px] border border-[#C5CBD8] bg-white/70 px-4 py-3 text-right">
                          <div className="text-2xl font-semibold text-[#313234]">
                            ${subscription.planPrice || PLAN_PRICES[plan]}
                          </div>
                          <div className="text-sm text-[#6A6D71]">
                            /{subscription.billingCycle === "annual" ? "year" : "month"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                            Billing
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#313234] capitalize">
                            {subscription.billingCycle}
                          </div>
                        </div>
                        <div className="rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                            {subscription.cancelAtPeriodEnd ? "Active Until" : "Renewal"}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#313234]">
                            {renewalDate || "On file"}
                          </div>
                        </div>
                        <div className="rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                            Status
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#313234]">
                            {statusLabel(subscription)}
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

                      {subscription.cancelAtPeriodEnd ? (
                        <div className="mt-5 rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
                          <div className="font-semibold">Cancellation scheduled</div>
                          <div className="mt-1">
                            Your plan stays active until{" "}
                            <strong>{cancellationDate || renewalDate || "the end of your current billing period"}</strong>.
                            No new charges will be made after that date.
                          </div>
                        </div>
                      ) : null}

                      {pendingPlan && !subscription.cancelAtPeriodEnd ? (
                        <div className="mt-5 rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-sm text-[#1D4ED8]">
                          <div className="font-semibold">Scheduled next plan: {pendingPlan}</div>
                          <div className="mt-1">
                            Your current {formatPlanName(plan)} plan stays active until{" "}
                            {pendingChangeDate || renewalDate || "the next billing date"}. After that,
                            {` ${pendingPlan}`} begins automatically.
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        {subscription.cancelAtPeriodEnd ? (
                          <button
                            type="button"
                            disabled={isReactivating}
                            onClick={() => handleReactivate(subscription)}
                            className="block w-full rounded-[14px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7] disabled:opacity-60"
                          >
                            {isReactivating ? "Reactivating..." : "Reactivate plan"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPlanChange(subscription)}
                            className="block w-full rounded-[14px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7]"
                          >
                            Change plan
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={subscription.cancelAtPeriodEnd || canceling}
                          onClick={() => setCancelTarget(subscription)}
                          className="w-full rounded-[14px] border border-[#C5CBD8] bg-white/70 py-3 text-base font-semibold text-[#313234] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel subscription"}
                        </button>
                      </div>

                      {subscription.stripeManaged ? (
                        <button
                          type="button"
                          disabled={billingPortalLoadingId === subscription._id}
                          onClick={() => handleManageBilling(subscription)}
                          className="mt-1 w-full rounded-[14px] border border-[#D7E0F5] bg-white/70 py-2.5 text-sm font-semibold text-[#306EEC] transition hover:bg-white disabled:opacity-60"
                        >
                          {billingPortalLoadingId === subscription._id ? "Opening..." : "Manage Billing"}
                        </button>
                      ) : null}

                      <div className="mt-3 text-xs text-[#6A6D71]">
                        {subscription.cancelAtPeriodEnd
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
                    href="/included"
                    className="flex items-center justify-between rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                  >
                    <span>What can I book?</span>
                    <span className="text-[#306EEC]">Open</span>
                  </Link>
                  <Link
                    href="/membership"
                    className="flex items-center justify-between rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                  >
                    <span>How often can I book?</span>
                    <span className="text-[#306EEC]">Open</span>
                  </Link>
                  <Link
                    href="/membership"
                    className="flex items-center justify-between rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                  >
                    <span>Book your next visit</span>
                    <span className="text-[#306EEC]">Go</span>
                  </Link>
                </div>

                <div className="mt-6 rounded-[16px] border border-[#D7E0F5] bg-white/80 p-4">
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
                      className="rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold text-[#313234]">
                          {formatPlanName(subscription.subscriptionType)} plan
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                          {statusLabel(subscription)}
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
      {cancelTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={() => {
            if (!canceling) setCancelTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl">
                !
              </div>

              <h3 className="text-2xl font-extrabold text-[#313234]">Are you sure you want to cancel?</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6A6D71]">
                You'll keep your membership until the end of the current billing period — your home stays in regular care until then.
              </p>

              <div className="mt-5 rounded-[16px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
                <div className="text-sm font-semibold text-[#313234]">Before you cancel</div>
                <div className="mt-2 space-y-1.5 text-sm text-[#6A6D71]">
                  <div>Keep predictable monthly billing and the same trusted team.</div>
                  <div>Higher memberships add more scheduled visits, emergency response, or a full project day each month.</div>
                  <div>You can keep your current membership and continue scheduling visits online.</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={canceling}
                  onClick={() => setCancelTarget(null)}
                  className="h-[52px] rounded-[16px] bg-[#306EEC] font-extrabold text-white transition hover:bg-[#2558c9] disabled:opacity-60"
                >
                  Keep my plan
                </button>
                <button
                  type="button"
                  disabled={canceling}
                  onClick={handleCancel}
                  className="h-[52px] rounded-[16px] border border-[#D1D5DB] bg-white font-extrabold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  {canceling ? "Canceling..." : "Cancel anyway"}
                </button>
              </div>
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
            className="w-full max-w-lg rounded-[22px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-1 text-xl font-extrabold text-[#313234]">Change plan</h3>
            <p className="mb-5 text-sm text-[#6A6D71]">
              Current: {formatPlanName(planChangeTarget.subscriptionType)} &mdash;{" "}
              {planChangeTarget.billingCycle}
            </p>

            {/* Plan selector */}
            <div className="mb-4 space-y-2">
              {(["basic", "plus", "premium", "elite"] as PlanKey[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlan(p)}
                  className={`flex w-full items-center justify-between rounded-[14px] border px-4 py-3 text-left transition ${
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
                  className={`flex-1 rounded-[12px] border py-2.5 text-sm font-semibold capitalize transition ${
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
                className={`mb-5 rounded-[12px] border p-3 text-sm ${
                  planChangeType === "upgrade"
                    ? "border-[#86EFAC]/50 bg-[#ECFDF3] text-[#166534]"
                    : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                }`}
              >
                {planChangeType === "upgrade"
                  ? "Upgrade is applied immediately. A prorated charge will be made today for the difference."
                  : "Downgrade takes effect at your next billing date. Your current plan stays active until then."}
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-[12px] border border-[#FCA5A5]/60 bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={planChanging}
                onClick={() => setPlanChangeTarget(null)}
                className="flex-1 rounded-[14px] border border-[#D1D5DB] bg-white py-3 font-semibold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={planChanging || planChangeType === "same"}
                onClick={handlePlanChange}
                className="flex-1 rounded-[14px] bg-[#306EEC] py-3 font-semibold text-white transition hover:bg-[#2557C7] disabled:opacity-60"
              >
                {planChanging
                  ? "Updating..."
                  : planChangeType === "upgrade"
                    ? "Upgrade now"
                    : planChangeType === "downgrade"
                      ? "Schedule downgrade"
                      : "Select a different plan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
