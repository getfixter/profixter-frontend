"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cancelSubscription,
  getMySubscriptions,
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
    "For simple ongoing home tasks",
    "1 active booking",
    "Each visit covers up to 90 minutes of work",
  ],
  plus: [
    "For more flexibility with scheduling",
    "2 active bookings",
    "Book as often as availability allows",
  ],
  premium: [
    "For urgent situations and peace of mind",
    "2 active bookings",
    "1 emergency visit per month",
    "Emergency visits are limited to one per month",
  ],
  elite: [
    "For larger projects and full-day tasks",
    "2-3 active bookings",
    "1 full-day visit per month (up to 8 hours)",
    "Full-day visit must be scheduled in advance",
  ],
};

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
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
                  <div className="mb-1 text-sm text-[#6A6D71]">No active subscription</div>
                  <h3 className="text-lg font-semibold text-[#313234] sm:text-xl">
                    Recommended: <span className="text-[#306EEC]">Plus</span>
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-[#313234]">${PLAN_PRICES.plus}</span>
                    <span className="text-sm text-[#6A6D71] sm:text-base">/month</span>
                  </div>
                </div>

                <div className="shrink-0 rounded-full border border-[#C5CBD8] bg-white/70 px-3 py-2">
                  <span className="text-xs font-semibold text-[#313234]">Most Popular</span>
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
                href="/#plans"
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
                  href="/#plans"
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
                            Renewal
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
                          <div className="font-semibold">Cancellation already scheduled</div>
                          <div className="mt-1">
                            You'll keep access until {cancellationDate || renewalDate || "the end of your current billing period"}.
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Link
                          href="/#plans"
                          className="block w-full rounded-[14px] bg-[#306EEC] py-3 text-center text-base font-semibold text-[#EEF2FF] transition-colors hover:bg-[#2557C7]"
                        >
                          Change plan
                        </Link>

                        <button
                          type="button"
                          disabled={subscription.cancelAtPeriodEnd}
                          onClick={() => setCancelTarget(subscription)}
                          className="w-full rounded-[14px] border border-[#C5CBD8] bg-white/70 py-3 text-base font-semibold text-[#313234] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel subscription"}
                        </button>
                      </div>

                      <div className="mt-3 text-xs text-[#6A6D71]">
                        {subscription.cancelAtPeriodEnd
                          ? `You'll keep easy booking and plan access until ${cancellationDate || renewalDate || "the end of the current period"}.`
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
                    href="/#services"
                    className="flex items-center justify-between rounded-[14px] border border-[#D7E0F5] bg-white/70 px-4 py-3 text-sm font-semibold text-[#313234] transition hover:bg-white"
                  >
                    <span>How often can I book?</span>
                    <span className="text-[#306EEC]">Open</span>
                  </Link>
                  <Link
                    href="/#pick-day"
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
                You'll keep your plan until the end of the current billing period, including easy online booking and predictable monthly pricing.
              </p>

              <div className="mt-5 rounded-[16px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
                <div className="text-sm font-semibold text-[#313234]">Before you cancel</div>
                <div className="mt-2 space-y-1.5 text-sm text-[#6A6D71]">
                  <div>Keep easy booking and no-estimate pricing in place.</div>
                  <div>Different plans let you keep more active bookings when you need them.</div>
                  <div>You can still keep your current plan and continue booking online.</div>
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
    </>
  );
}

