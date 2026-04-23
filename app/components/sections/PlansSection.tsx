"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { plans, type Plan } from "@/app/data/content";
import { useAuth } from "@/lib/useAuth";
import type { PlanType } from "@/lib/stripe-links";
import { trackInitiateCheckout } from "@/lib/analytics";
import {
  changeSubscriptionPlan,
  getManagedSubscriptionForAddress,
  type BillingCycle as ManagedBillingCycle,
  type ManagedSubscription,
} from "@/lib/subscription-service";

type Address = {
  _id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
};

type BillingCycle = "monthly" | "annual";

function toNumberPrice(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatMoney(n: number): string {
  const rounded = Math.round(n);
  return String(rounded);
}

function formatDate(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizePlanType(name: string): PlanType | null {
  const x = String(name || "").toLowerCase().trim();
  if (x === "basic") return "basic";
  if (x === "plus") return "plus";
  if (x === "premium") return "premium";
  if (x === "elite") return "elite";
  return null;
}

function getPlanRank(plan: PlanType | null): number {
  if (plan === "basic") return 1;
  if (plan === "plus") return 2;
  if (plan === "premium") return 3;
  if (plan === "elite") return 4;
  return 0;
}

function getPositioningLabel(planName: string): string {
  if (planName === "Basic") return "For simple ongoing home tasks";
  if (planName === "Plus") return "For more flexibility with scheduling";
  if (planName === "Premium") return "For urgent situations and peace of mind";
  if (planName === "Elite") return "For larger projects and full-day tasks";
  return "";
}

function getComparisonLabel(planName: string): string {
  if (planName === "Basic") return "1 active booking";
  if (planName === "Plus") return "2 active bookings";
  if (planName === "Premium") return "1 emergency visit per month";
  if (planName === "Elite") return "1 full-day visit per month (up to 8 hours)";
  return "";
}

function getBadgeLabel(planName: string, badge?: string): string {
  if (planName === "Plus") return "Most Popular";
  return badge || "";
}

function isManagedActiveStatus(status?: string | null): boolean {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

type ChangeActionKind =
  | "subscribe"
  | "active"
  | "active-unknown"
  | "scheduled"
  | "cancel-scheduled"
  | "upgrade"
  | "downgrade";

export default function PlansSection() {
  const [currentSlide, setCurrentSlide] = useState(() => {
    const i = plans.findIndex((p) => p.name === "Plus");
    return i >= 0 ? i : 0;
  });

  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    planName: string;
    planType: PlanType;
    kind: "upgrade" | "downgrade";
  } | null>(null);

  const { user, isAuthenticated, token } = useAuth();

  const addresses: Address[] = ((user as any)?.addresses || []) as Address[];

  const defaultAddress = useMemo(() => {
    if (!user) return null;
    const defaultId = String((user as any)?.defaultAddressId || "");
    return addresses.find((a) => String(a._id) === defaultId) || addresses[0] || null;
  }, [addresses, user]);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const selectedAddress = useMemo(
    () => addresses.find((a) => String(a._id) === String(selectedAddressId)) || null,
    [addresses, selectedAddressId]
  );

  const [addressSubscriptionMap, setAddressSubscriptionMap] = useState<
    Record<string, ManagedSubscription | null | undefined>
  >({});
  const [checkingAddr, setCheckingAddr] = useState(false);

  useEffect(() => {
    if (!selectedAddressId && defaultAddress?._id) {
      setSelectedAddressId(String(defaultAddress._id));
    }
  }, [defaultAddress, selectedAddressId]);

  const checkAddressState = async (addressId: string) => {
    if (!token) return;
    setCheckingAddr(true);
    try {
      const subscription = await getManagedSubscriptionForAddress(addressId);
      setAddressSubscriptionMap((map) => ({ ...map, [addressId]: subscription }));
    } catch (e) {
      console.error("checkAddressState failed:", e);
      setAddressSubscriptionMap((map) => ({ ...map, [addressId]: null }));
    } finally {
      setCheckingAddr(false);
    }
  };

  useEffect(() => {
    if (token && selectedAddressId) {
      if (addressSubscriptionMap[selectedAddressId] === undefined) {
        checkAddressState(selectedAddressId);
      }
    }
  }, [token, selectedAddressId, addressSubscriptionMap]);

  const startCheckout = async (
    plan: PlanType,
    addressId: string,
    email: string,
    cycle: BillingCycle,
    planName: string
  ) => {
    try {
      setActionLoadingPlan(planName);

      const res = await fetch(
        "https://api.profixter.com/api/stripe/checkout/create-checkout-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, addressId, email, billingCycle: cycle }),
        }
      );

      const data = await res.json();

      if (res.status === 409 && data?.code === "ADDRESS_ALREADY_SUBSCRIBED") {
        setActionError("This address already has an active plan.");
        setAddressSubscriptionMap((map) => ({ ...map, [addressId]: map[addressId] || null }));
        return;
      }

      if (data?.url) {
        trackInitiateCheckout({
          plan,
          billing_cycle: cycle,
          address_id: addressId,
        });
        window.location.href = data.url;
        return;
      }

      setActionError(data?.message || "Unable to start subscription. Please try again.");
    } catch (error: any) {
      setActionError(
        error?.response?.data?.message || error?.message || "Unable to start subscription. Please try again."
      );
    } finally {
      setActionLoadingPlan((current) => (current === planName ? null : current));
    }
  };

  const getActionForPlan = (planName: string) => {
    const planType = normalizePlanType(planName);
    const selectedSubscription = selectedAddressId
      ? addressSubscriptionMap[selectedAddressId] || null
      : null;
    const selectedAddressActive = isManagedActiveStatus(selectedSubscription?.status);
    const currentPlan = normalizePlanType(selectedSubscription?.subscriptionType || "");
    const pendingPlan = normalizePlanType(selectedSubscription?.pendingPlan || "");
    const pendingCycle = String(
      selectedSubscription?.pendingBillingCycle || selectedSubscription?.billingCycle || "monthly"
    );

    if (!planType) {
      return {
        kind: "subscribe" as ChangeActionKind,
        label: "Get Started",
        disabled: false,
      };
    }

    if (!selectedAddressActive) {
      return {
        kind: "subscribe" as ChangeActionKind,
        label: "Get Started",
        disabled: false,
      };
    }

    if (selectedSubscription?.cancelAtPeriodEnd) {
      return {
        kind: "cancel-scheduled" as ChangeActionKind,
        label: "Cancellation scheduled",
        disabled: true,
      };
    }

    if (!currentPlan) {
      return {
        kind: "active-unknown" as ChangeActionKind,
        label: "Manage Plan",
        disabled: true,
      };
    }

    const currentRank = getPlanRank(currentPlan);
    const targetRank = getPlanRank(planType);
    const sameCycle =
      String(selectedSubscription?.billingCycle || "monthly") === String(billing || "monthly");

    if (pendingPlan === planType && pendingCycle === String(billing || "monthly")) {
      return {
        kind: "scheduled" as ChangeActionKind,
        label: "Scheduled",
        disabled: true,
      };
    }

    if (targetRank === currentRank && sameCycle) {
      return {
        kind: "active" as ChangeActionKind,
        label: "Current Plan",
        disabled: true,
      };
    }

    if (targetRank === currentRank && !sameCycle) {
      return {
        kind: billing === "annual" ? ("upgrade" as ChangeActionKind) : ("downgrade" as ChangeActionKind),
        label: billing === "annual" ? "Switch now" : "Schedule change",
        disabled: false,
      };
    }

    if (targetRank > currentRank) {
      return {
        kind: "upgrade" as ChangeActionKind,
        label: "Upgrade",
        disabled: false,
      };
    }

    return {
      kind: "downgrade" as ChangeActionKind,
      label: "Downgrade",
      disabled: false,
    };
  };

  const applyPlanChange = async (
    planName: string,
    planType: PlanType,
    kind: "upgrade" | "downgrade"
  ) => {
    if (!selectedAddress) return;

    try {
      setActionLoadingPlan(planName);
      const result = await changeSubscriptionPlan({
        addressId: selectedAddress._id,
        plan: planType,
        billingCycle: billing as ManagedBillingCycle,
      });
      setAddressSubscriptionMap((map) => ({
        ...map,
        [selectedAddress._id]: result.subscription,
      }));
      setActionMessage(
        result.message ||
          (kind === "upgrade"
            ? "Your plan was updated successfully."
            : "Your downgrade is scheduled for the next billing date.")
      );
      setConfirmAction(null);
    } catch (error: any) {
      setActionError(
        error?.response?.data?.message || error?.message || "Unable to update your plan right now."
      );
    } finally {
      setActionLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (actionLoadingPlan) return;
    const planType = normalizePlanType(planName);
    setActionError("");
    setActionMessage("");

    if (!planType) {
      setActionError("Invalid plan selected. Please refresh and try again.");
      return;
    }

    if (!isAuthenticated || !user) {
      window.location.href = "/signin?redirect=/";
      return;
    }

    if (!addresses.length) {
      setActionError("Please add an address to your account first.");
      window.location.href = "/account";
      return;
    }

    if (!selectedAddressId || !selectedAddress) {
      setActionError("Please select an address.");
      return;
    }

    const action = getActionForPlan(planName);

    if (
      action.kind === "active" ||
      action.kind === "active-unknown" ||
      action.kind === "scheduled" ||
      action.kind === "cancel-scheduled"
    ) {
      return;
    }

    if (action.kind === "subscribe") {
      await startCheckout(planType, selectedAddress._id, (user as any).email, billing, planName);
      return;
    }

    setConfirmAction({
      planName,
      planType,
      kind: action.kind === "upgrade" ? "upgrade" : "downgrade",
    });
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % plans.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + plans.length) % plans.length);

  const selectedAddressSubscription = selectedAddressId
    ? addressSubscriptionMap[selectedAddressId] || null
    : null;
  const addressIsActive = isManagedActiveStatus(selectedAddressSubscription?.status);
  const scheduledPlanName = selectedAddressSubscription?.pendingPlan
    ? `${String(selectedAddressSubscription.pendingPlan).charAt(0).toUpperCase()}${String(
        selectedAddressSubscription.pendingPlan
      ).slice(1)}`
    : null;
  const scheduledChangeDate = formatDate(selectedAddressSubscription?.pendingChangeEffectiveDate);

  const touchStartX = useRef<number | null>(null);
  const touchLastX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchLastX.current = touchStartX.current;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchLastX.current = e.touches[0]?.clientX ?? touchLastX.current;
  };

  const onTouchEnd = () => {
    if (touchStartX.current == null || touchLastX.current == null) return;
    const dx = touchLastX.current - touchStartX.current;

    if (Math.abs(dx) > 55) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }

    touchStartX.current = null;
    touchLastX.current = null;
  };

  const getMonthly = (plan: Plan) => toNumberPrice(plan.price);
  const getAnnual = (plan: Plan) => getMonthly(plan) * 11;

  const BillingToggle = ({ compact }: { compact?: boolean }) => (
    <div className={`${compact ? "mt-6" : "mt-8"} w-full`}>
      <div className={`${compact ? "mx-auto max-w-[520px]" : ""}`}>
        <div className="bg-white/10 border border-white/15 rounded-2xl px-3 py-3 sm:px-4 sm:py-4 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.20)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col">
              <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                {billing === "annual" ? "Annual Plan" : "Monthly Plan"}
              </p>
              <p className="text-[#C5CBD8] text-xs sm:text-sm leading-snug mt-1">
                {billing === "annual" ? (
                  <>
                    Pay for <span className="text-white font-semibold">11 months</span>, get{" "}
                    <span className="text-white font-semibold">12</span>
                  </>
                ) : (
                  <>Flexible month-to-month coverage with no long-term contract</>
                )}
              </p>
            </div>

            <div className="grid grid-cols-[72px_auto_72px] items-center gap-3 shrink-0">
              <span
                className={`text-sm font-semibold text-right whitespace-nowrap ${
                  billing === "monthly" ? "text-white" : "text-white/60"
                }`}
              >
                Monthly
              </span>

              <button
                type="button"
                onClick={() => setBilling((b) => (b === "monthly" ? "annual" : "monthly"))}
                aria-label="Toggle billing cycle"
                className={`relative w-[70px] h-[38px] rounded-full border transition-colors duration-300 ${
                  billing === "annual"
                    ? "bg-[#306EEC] border-[#306EEC]/60"
                    : "bg-white/15 border-white/20"
                }`}
              >
                <span
                  className={`absolute top-[4px] left-[4px] w-[30px] h-[30px] rounded-full bg-white shadow-md transition-transform duration-300 ${
                    billing === "annual" ? "translate-x-[32px]" : "translate-x-0"
                  }`}
                />
              </button>

              <span
                className={`text-sm font-semibold text-left whitespace-nowrap ${
                  billing === "annual" ? "text-white" : "text-white/60"
                }`}
              >
                Annually
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div />
            <span className="sm:hidden text-[#C5CBD8] text-[11px]">Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );

  const AddressPicker = () => (
    <div className="w-full mb-6">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.20)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-white text-sm font-semibold mb-2">Select address</p>

              {addresses.length ? (
                <select
                  value={selectedAddressId || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedAddressId(id);
                    if (token && addressSubscriptionMap[id] === undefined) {
                      checkAddressState(id);
                    }
                  }}
                  className="w-full h-[46px] rounded-xl px-3 bg-[#EEF2FF] text-[#313234] font-semibold outline-none focus:ring-4 focus:ring-[#306EEC]/25"
                >
                  {addresses.map((a) => (
                    <option key={a._id} value={a._id}>
                      {(a.label ? `${a.label}: ` : "") + `${a.line1}, ${a.city}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-white/80">No addresses yet</div>
              )}

              <div className="mt-2 text-sm">
                {checkingAddr ? (
                  <span className="text-[#C5CBD8]">Checking plan for this address...</span>
                ) : addressIsActive ? (
                  <div className="space-y-1">
                    <span className="text-[#FCA5A5] font-semibold">
                      Active plan
                      {selectedAddressSubscription?.subscriptionType
                        ? `: ${String(selectedAddressSubscription.subscriptionType).charAt(0).toUpperCase()}${String(selectedAddressSubscription.subscriptionType).slice(1)}`
                        : ""}
                    </span>
                    {scheduledPlanName ? (
                      <div className="text-[#FDE68A] font-semibold">
                        Scheduled next plan: {scheduledPlanName}
                        {scheduledChangeDate ? ` on ${scheduledChangeDate}` : ""}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[#86EFAC] font-semibold">No active plan</span>
                )}
              </div>
            </div>

            <button
              onClick={() => (window.location.href = "/account")}
              className="h-[46px] px-4 rounded-xl bg-white text-[#313234] font-extrabold hover:bg-gray-100 transition active:scale-[0.99]"
            >
              Add / Manage
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const HeaderBlock = ({ compact }: { compact?: boolean }) => (
    <div className={`${compact ? "lg:hidden" : "hidden lg:block"} w-full`}>
      <div className={`${compact ? "text-center" : ""} mb-8 sm:mb-12`}>
        <div className={`mb-6 ${compact ? "flex justify-center" : ""}`}>
          <Image src="/images/logo.svg" alt="Profixter" width={80} height={32} />
        </div>

        <h2
          className={[
            compact ? "text-4xl sm:text-5xl" : "text-[56px]",
            "font-extrabold tracking-[-0.04em]",
            "leading-[1.05]",
            "mb-6",
          ].join(" ")}
        >
          <span className="block text-white">Simple Monthly Plans</span>
          <span className="block text-[#86EFAC]">For Ongoing Home Tasks</span>
          <span className="block text-white">One Visit At A Time</span>
        </h2>

        <p className="text-[#C5CBD8] text-base sm:text-lg leading-relaxed max-w-[520px] mx-auto">
          Ongoing handyman help, one visit at a time. Pick a plan, book online, and keep home
          maintenance predictable.
        </p>
        {!compact && (
          <p className="mt-5 text-[#C5CBD8] text-base leading-[22px]">
            Materials at cost, only if needed, with your approval.
            <br />
            No markup. No contractor games. Just clear pricing.
          </p>
        )}

        <BillingToggle compact={compact} />
      </div>
    </div>
  );

  return (
    <>
      <section
        id="plans"
        className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative overflow-hidden scroll-mt-[140px]"
      >
        <div className="mx-auto max-w-[1240px] px-5 lg:px-5 mb-6">
          <div className="bg-[#86EFAC]/15 border border-[#86EFAC]/30 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#86EFAC]/25 flex items-center justify-center">
                <span className="text-[#1F7A2E] text-lg">Gift</span>
              </div>
              <div>
                <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                  Annual Plan - Pay for 11 months, get 12 months of ongoing handyman help
                </p>
                <p className="text-[#C5CBD8] text-sm">Best value for long-term home maintenance.</p>
              </div>
            </div>

            <div className="text-[#86EFAC] font-extrabold text-sm sm:text-base">
              1 month FREE
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[#306EEC]/10 blur-[120px]" />

        {isAuthenticated && user && addresses.length > 0 && <AddressPicker />}

        {isAuthenticated && user && addresses.length === 0 && (
          <div className="mx-auto max-w-[1240px] px-5 lg:px-5 mb-6">
            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.20)]">
              <p className="text-white font-semibold mb-2">No address on file</p>
              <button
                onClick={() => (window.location.href = "/account")}
                className="h-[46px] px-4 rounded-xl bg-white text-[#313234] font-extrabold hover:bg-gray-100 transition active:scale-[0.99]"
              >
                Add Address
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
          <HeaderBlock compact />

          {(actionMessage || actionError) && (
            <div className="mb-6 space-y-3">
              {actionMessage ? (
                <div className="rounded-[16px] border border-[#86EFAC]/40 bg-[#86EFAC]/15 px-4 py-3 text-sm font-semibold text-white">
                  {actionMessage}
                </div>
              ) : null}
              {actionError ? (
                <div className="rounded-[16px] border border-[#FCA5A5]/40 bg-[#7F1D1D]/35 px-4 py-3 text-sm font-semibold text-white">
                  {actionError}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col lg:flex-row items-start gap-8 sm:gap-10 lg:gap-12">
            <div className="hidden lg:flex flex-shrink-0 w-[360px] pt-4 flex-col justify-between min-h-[560px]">
              <HeaderBlock />
            </div>

            <div className="flex-1 relative w-full">
              <div className="lg:hidden">
                <div
                  className="relative overflow-hidden"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {plans.map((plan, idx) => {
                      const monthly = getMonthly(plan);
                      const annual = getAnnual(plan);
                      const showPrice = billing === "annual" ? annual : monthly;
                      const big = formatMoney(showPrice);
                      const action = getActionForPlan(plan.name);

                      return (
                        <div key={idx} className="w-full flex-shrink-0 px-1">
                          <div className="mx-auto max-w-[440px]">
                            <div className={`${plan.name === "Plus" ? "bg-white border-2 border-[#306EEC] shadow-[0_20px_90px_rgba(48,110,236,0.24)]" : "bg-[#EEF2FF] border border-[#C5CBD8] shadow-[0_20px_80px_rgba(0,0,0,0.35)]"} rounded-[26px] p-6 sm:p-8 flex flex-col min-h-[690px] sm:min-h-[720px] transform transition duration-300 hover:-translate-y-1`}>
                              {getBadgeLabel(plan.name, plan.badge) && (
                                <div className="mb-3 flex justify-center">
                                  <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-4 py-2 rounded-xl border border-white/70 shadow">
                                    <span className="text-[13px] font-extrabold text-white">
                                      {getBadgeLabel(plan.name, plan.badge)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="text-center mb-4 sm:mb-5">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#313234] leading-tight mb-2">
                                  {plan.name}
                                </h3>
                                <p className="text-[#306EEC] font-bold text-sm sm:text-base leading-relaxed mb-2">
                                  {getPositioningLabel(plan.name)}
                                </p>
                                <p className="text-sm sm:text-base text-[#6A6D71] leading-relaxed">
                                  {plan.description}
                                </p>
                              </div>

                              {billing === "annual" && (
                                <div className="mb-3 flex justify-center">
                                  <div className="px-3 py-1 rounded-full bg-[#86EFAC]/20 border border-[#43A047]/25">
                                    <span className="text-[#1F7A2E] font-extrabold text-xs sm:text-sm">
                                      1 month FREE - Pay for 11, get 12
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="mb-5 sm:mb-6 text-center">
                                <div className="flex items-end gap-2 justify-center">
                                  <span className="text-5xl sm:text-6xl font-extrabold text-[#313234] leading-none">
                                    ${big}
                                  </span>
                                  <span className="text-base sm:text-lg text-[#6A6D71] leading-tight pb-1">
                                    {billing === "annual" ? "/year" : "/month"}
                                  </span>
                                </div>

                                {billing === "annual" && (
                                  <div className="mt-2 text-sm sm:text-base text-[#6A6D71]">
                                    Equivalent to{" "}
                                    <span className="font-extrabold text-[#313234]">
                                      ${formatMoney(annual / 12)}
                                    </span>
                                    /mo billed annually
                                  </div>
                                )}
                              </div>

                              {plan.subtitle && (
                                <p className="text-[#306EEC] font-bold text-base sm:text-lg text-center mb-3">
                                  {plan.subtitle}
                                </p>
                              )}

                              <div className="mb-4 text-center text-[12px] sm:text-[13px] font-semibold text-[#6A6D71]">
                                {getComparisonLabel(plan.name)}
                              </div>

                              <div className="space-y-2.5 mb-auto">
                                {plan.features.map((feature: string, featureIdx: number) => (
                                  <div key={featureIdx} className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                      <svg width="14" height="11" viewBox="0 0 16 13" fill="none">
                                        <path
                                          d="M1 6.5L5.5 11L15 1.5"
                                          stroke="#43A047"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-base sm:text-lg font-semibold text-[#313234] leading-tight">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {plan.name === "Basic" && (
                                <div className="mt-4 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                  Each visit covers up to 90 minutes of work.
                                </div>
                              )}

                              {plan.name === "Basic" && (
                                <div className="mt-2 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                  Book as often as availability allows.
                                </div>
                              )}

                              {plan.name === "Premium" && (
                                <div className="mt-4 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                  Emergency visits are limited to one per month and are for urgent situations only.
                                </div>
                              )}

                              {plan.name === "Elite" && (
                                <div className="mt-4 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                  Full-day visit must be scheduled in advance.
                                </div>
                              )}

                              <button
                                onClick={() => handleSubscribe(plan.name)}
                                data-track="plans-cta"
                                disabled={action.disabled || !!actionLoadingPlan || checkingAddr}
                                className={`w-full h-[56px] sm:h-[60px] rounded-2xl text-lg sm:text-xl font-extrabold leading-none transition-all duration-300 mt-6 flex items-center justify-center ${
                                  action.disabled || !!actionLoadingPlan || checkingAddr
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : action.kind === "upgrade" || action.kind === "downgrade"
                                    ? "bg-[#111827] hover:bg-black text-white hover:scale-[1.01]"
                                    : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                                }`}
                              >
                                {actionLoadingPlan === plan.name ? "Updating..." : action.label}
                              </button>

                              <div className="mt-3 grid grid-cols-1 gap-2 text-center text-[12px] font-semibold text-[#313234] sm:grid-cols-3">
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Secure checkout
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  No estimates
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Easy online booking
                                </div>
                              </div>

                              <div className="mt-3 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                You can manage your plan and book online anytime.
                              </div>

                              <div className="mt-3 text-center text-[12px] text-[#6A6D71]">
                                Each visit covers up to 90 minutes of work - Cancel anytime - No contracts
                                <br />
                                <span className="text-[#6A6D71]/80">
                                  Book as often as availability allows - Materials at cost - Transparent pricing
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 justify-center mt-6 mb-4">
                  {plans.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Go to plan ${idx + 1}`}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        idx === currentSlide ? "w-10 bg-[#306EEC]" : "w-2.5 bg-[#C5CBD8] hover:bg-[#306EEC]/50"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-4 justify-center mt-4">
                  <button
                    onClick={prevSlide}
                    className="bg-white hover:bg-gray-50 text-[#313234] w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg border-2 border-[#E5E7EB] active:scale-95"
                    aria-label="Previous plan"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    className="bg-[#306EEC] hover:bg-[#2558c9] text-white w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-[#306EEC]/30 active:scale-95"
                    aria-label="Next plan"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed text-center mt-6 px-4">
                  Your home stops being a list of problems.
                  <br />
                  It becomes handled.
                </p>
              </div>

              <div className="hidden lg:block">
                <div className="relative pb-44">
                  <div className="flex items-end gap-6">
                    <div className={`relative w-[420px] min-h-[560px] rounded-[22px] flex-shrink-0 overflow-hidden ${plans[currentSlide].name === "Plus" ? "bg-white border-2 border-[#306EEC] shadow-[0_22px_100px_rgba(48,110,236,0.28)]" : "bg-[#EEF2FF] border border-[#C5CBD8] shadow-[0_20px_90px_rgba(0,0,0,0.35)]"}`}>
                      {getBadgeLabel(plans[currentSlide].name, plans[currentSlide].badge) && (
                        <div className="absolute top-4 left-4 z-10">
                          <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-4 py-2 rounded-xl border border-[#EEF2FF]/70 shadow-lg">
                            <span className="text-[14px] font-extrabold text-[#EEF2FF]">
                              {getBadgeLabel(plans[currentSlide].name, plans[currentSlide].badge)}
                            </span>
                          </div>
                        </div>
                      )}

                      {billing === "annual" && (
                        <div className="absolute top-4 right-4 z-10">
                          <div className="bg-[#86EFAC]/20 border border-[#43A047]/25 px-3 py-2 rounded-xl shadow-lg">
                            <div className="text-[#1F7A2E] font-extrabold text-[12px] leading-tight">
                              1 month FREE
                            </div>
                            <div className="text-[#313234] font-bold text-[12px] leading-tight">
                              Pay for 11, get 12
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        className={[
                          "p-8 flex flex-col h-full",
                          getBadgeLabel(plans[currentSlide].name, plans[currentSlide].badge) ? "pt-14" : "",
                        ].join(" ")}
                      >
                        <div className="text-center mb-8">
                          <h3 className="text-3xl font-extrabold text-[#313234] mb-2">
                            {plans[currentSlide].name}
                          </h3>
                          <p className="text-[#306EEC] font-bold text-base leading-relaxed mb-2">
                            {getPositioningLabel(plans[currentSlide].name)}
                          </p>
                          <p className="text-base text-[#6A6D71] leading-relaxed">
                            {plans[currentSlide].description}
                          </p>
                        </div>

                        {(() => {
                          const plan = plans[currentSlide];
                          const monthly = getMonthly(plan);
                          const annual = getAnnual(plan);
                          const show = billing === "annual" ? annual : monthly;
                          const action = getActionForPlan(plan.name);

                          return (
                            <>
                              <div className="mb-6">
                                <div className="flex items-end gap-2 justify-center">
                                  <span className="text-[64px] font-extrabold text-[#313234] leading-[0.95]">
                                    ${formatMoney(show)}
                                  </span>
                                  <span className="text-base text-[#6A6D71] pb-2">
                                    {billing === "annual" ? "/year" : "/month"}
                                  </span>
                                </div>

                                {billing === "annual" && (
                                  <div className="mt-2 text-center text-sm text-[#6A6D71]">
                                    Pay for <span className="font-extrabold text-[#313234]">11</span>, get{" "}
                                    <span className="font-extrabold text-[#313234]">12</span> - Equivalent{" "}
                                    <span className="font-extrabold text-[#313234]">
                                      ${formatMoney(annual / 12)}
                                    </span>
                                    /mo billed annually
                                  </div>
                                )}
                              </div>

                              {plan.subtitle && (
                                <p className="text-[18px] font-bold text-[#306EEC] mb-4 text-center">
                                  {plan.subtitle}
                                </p>
                              )}

                              <div className="mb-4 text-center text-[12px] font-semibold text-[#6A6D71]">
                                {getComparisonLabel(plan.name)}
                              </div>

                              <div className="space-y-3 mb-auto">
                                {plan.features.map((feature: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-3">
                                    <div className="w-[34px] h-[34px] rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                      <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
                                        <path
                                          d="M1 6.5L5.5 11L15 1.5"
                                          stroke="#43A047"
                                          strokeWidth="2.25"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-[20px] font-semibold text-[#313234] leading-snug">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {plan.name === "Basic" && (
                                <div className="mt-4 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                  Each visit covers up to 90 minutes of work.
                                </div>
                              )}

                              {plan.name === "Basic" && (
                                <div className="mt-2 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                  Book as often as availability allows.
                                </div>
                              )}

                              {plan.name === "Premium" && (
                                <div className="mt-4 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                  Emergency visits are limited to one per month and are for urgent situations only.
                                </div>
                              )}

                              {plan.name === "Elite" && (
                                <div className="mt-4 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                  Full-day visit must be scheduled in advance.
                                </div>
                              )}

                              <button
                                onClick={() => handleSubscribe(plan.name)}
                                data-track="plans-cta"
                                disabled={action.disabled || !!actionLoadingPlan || checkingAddr}
                                className={`w-full h-[62px] rounded-[14px] text-xl font-extrabold transition-all mt-6 flex items-center justify-center ${
                                  action.disabled || !!actionLoadingPlan || checkingAddr
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : action.kind === "upgrade" || action.kind === "downgrade"
                                    ? "bg-[#111827] hover:bg-black text-white hover:scale-[1.01]"
                                    : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                                }`}
                              >
                                {actionLoadingPlan === plan.name ? "Updating..." : action.label}
                              </button>

                              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px] font-semibold text-[#313234]">
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Secure checkout
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  No estimates
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Easy online booking
                                </div>
                              </div>

                              <div className="mt-3 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                You can manage your plan and book online anytime.
                              </div>

                              <div className="mt-3 text-center text-[12px] text-[#6A6D71]">
                                Each visit covers up to 90 minutes of work - Cancel anytime - No contracts
                                <br />
                                <span className="text-[#6A6D71]/80">
                                  Book as often as availability allows - Materials at cost - Transparent pricing
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex gap-6">
                      {[1, 2].map((offset) => {
                        const index = (currentSlide + offset) % plans.length;
                        const plan = plans[index];
                        const monthly = getMonthly(plan);
                        const annual = getAnnual(plan);
                        const show = billing === "annual" ? annual : monthly;
                        const action = getActionForPlan(plan.name);

                        return (
                          <button
                            key={offset}
                            type="button"
                            onClick={() => setCurrentSlide(index)}
                            className="group relative w-[300px] min-h-[420px] flex-shrink-0 text-left"
                          >
                            <div className={`absolute inset-0 rounded-[16px] p-6 transition-transform duration-300 group-hover:-translate-y-1 ${plan.name === "Plus" ? "bg-white border-2 border-[#306EEC] shadow-[0_14px_70px_rgba(48,110,236,0.22)]" : "bg-[#EEF2FF] border border-[#C5CBD8] shadow-[0_12px_60px_rgba(0,0,0,0.25)]"}`} />
                            {getBadgeLabel(plan.name, plan.badge) && (
                              <div className="absolute top-3 left-3 z-20">
                                <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-3 py-1.5 rounded-lg border border-white/70 shadow">
                                  <span className="text-[12px] font-extrabold text-white">
                                    {getBadgeLabel(plan.name, plan.badge)}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="relative z-10 p-6 flex flex-col h-full">
                              <div className="text-center mb-6">
                                <h3 className="text-xl font-extrabold text-[#313234] mb-2">{plan.name}</h3>
                                <p className="text-[#306EEC] font-bold text-[13px] mb-2">{getPositioningLabel(plan.name)}</p>
                                <p className="text-sm text-[#6A6D71] leading-relaxed">{plan.description}</p>
                              </div>

                              {billing === "annual" && (
                                <div className="mb-3 flex justify-center">
                                  <div className="px-3 py-1 rounded-full bg-[#86EFAC]/20 border border-[#43A047]/25">
                                    <span className="text-[#1F7A2E] font-extrabold text-[11px]">
                                      1 month FREE
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="mb-6 text-center min-h-[86px]">
                                <div className="flex items-end gap-2 justify-center">
                                  <span className="text-5xl font-extrabold text-[#313234]">
                                    ${formatMoney(show)}
                                  </span>
                                  <span className="text-sm text-[#6A6D71] pb-1">
                                    {billing === "annual" ? "/year" : "/month"}
                                  </span>
                                </div>

                                <div className="mt-2 text-[12px] text-[#6A6D71]">
                                  {billing === "annual"
                                    ? `${formatMoney(annual / 12)}/mo billed annually`
                                    : "\u00A0"}
                                </div>
                              </div>

                              {plan.subtitle && (
                                <p className="text-[15px] font-bold text-[#306EEC] mb-4 text-center">
                                  {plan.subtitle}
                                </p>
                              )}

                              <div className="mb-4 text-center text-[12px] font-semibold text-[#6A6D71]">
                                {getComparisonLabel(plan.name)}
                              </div>

                              <div className="space-y-2 mb-auto">
                                {plan.features.slice(0, 3).map((feature: string, idx2: number) => (
                                  <div key={idx2} className="flex items-center gap-2">
                                    <div className="w-[26px] h-[26px] rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                      <svg width="12" height="10" viewBox="0 0 11 9" fill="none">
                                        <path
                                          d="M1 4.5L4 7.5L10 1.5"
                                          stroke="#43A047"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-[15px] font-semibold text-[#313234] leading-snug">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {plan.name === "Basic" && (
                                <div className="mt-4 text-center text-[12px] text-[#306EEC] font-semibold leading-relaxed">
                                  Book as often as availability allows.
                                </div>
                              )}

                              <div className="mt-auto pt-4">
                                <div
                                  className={`w-full h-[40px] rounded-[10px] text-[15px] font-extrabold flex items-center justify-center transition ${
                                    action.kind === "upgrade" || action.kind === "downgrade"
                                      ? "bg-[#111827] text-white"
                                    : action.kind === "active"
                                      ? "bg-gray-300 text-gray-600"
                                      : "bg-[#306EEC] text-white"
                                  }`}
                                >
                                  {action.label}
                                </div>
                              </div>
                            </div>

                            <div className="absolute inset-0 bg-[#313234]/15 backdrop-blur-[2px] rounded-[16px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-16 relative z-30 flex items-center justify-center gap-4">
                    <button
                      onClick={prevSlide}
                      className="bg-white hover:bg-gray-100 text-gray-800 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-md border border-gray-200 active:scale-95"
                      aria-label="Previous plan"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <div className="flex gap-2">
                      {plans.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          aria-label={`Go to plan ${idx + 1}`}
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            idx === currentSlide ? "w-10 bg-[#306EEC]" : "w-2.5 bg-[#C5CBD8] hover:bg-[#306EEC]/50"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={nextSlide}
                      className="bg-white hover:bg-gray-100 text-gray-800 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-md border border-gray-200 active:scale-95"
                      aria-label="Next plan"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:hidden mt-4 text-center text-[12px] text-[#C5CBD8]">
                Tip: swipe left/right to see plans
              </div>
            </div>
          </div>
        </div>
      </section>

      {confirmAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={() => {
            if (!actionLoadingPlan) setConfirmAction(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl">
                {confirmAction.kind === "upgrade" ? "+" : "v"}
              </div>

              <h3 className="text-2xl font-extrabold text-[#313234]">
                {confirmAction.kind === "upgrade" ? "Upgrade plan?" : "Schedule downgrade?"}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6A6D71]">
                {confirmAction.kind === "upgrade"
                  ? "Your plan will update immediately and Stripe will charge the prorated difference now."
                  : "Your current plan stays active until your next billing date. The lower plan will begin after that."}
              </p>

              <div className="mt-5 rounded-[16px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
                <div className="text-sm font-semibold text-[#313234]">
                  {confirmAction.kind === "upgrade" ? "What happens next" : "Scheduled for renewal"}
                </div>
                <div className="mt-2 text-sm text-[#6A6D71]">
                  {confirmAction.kind === "upgrade"
                    ? `${confirmAction.planName} starts right away once Stripe confirms the change.`
                    : `${confirmAction.planName} begins after your current billing period ends.`}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!!actionLoadingPlan}
                  onClick={() => setConfirmAction(null)}
                  className="h-[52px] rounded-[16px] bg-[#306EEC] font-extrabold text-white transition hover:bg-[#2558c9] disabled:opacity-60"
                >
                  Keep current plan
                </button>
                <button
                  type="button"
                  disabled={!!actionLoadingPlan}
                  onClick={() =>
                    applyPlanChange(
                      confirmAction.planName,
                      confirmAction.planType,
                      confirmAction.kind
                    )
                  }
                  className="h-[52px] rounded-[16px] border border-[#D1D5DB] bg-white font-extrabold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  {actionLoadingPlan === confirmAction.planName
                    ? confirmAction.kind === "upgrade"
                      ? "Upgrading..."
                      : "Scheduling..."
                    : confirmAction.kind === "upgrade"
                      ? "Upgrade now"
                      : "Schedule downgrade"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

