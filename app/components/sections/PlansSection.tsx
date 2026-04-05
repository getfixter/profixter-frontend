"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { plans, type Plan } from "@/app/data/content";
import { useAuth } from "@/lib/useAuth";
import type { PlanType } from "@/lib/stripe-links";

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

const TARAS_PHONE_DISPLAY = "631-599-1363";
const TARAS_PHONE_LINK = "tel:6315991363";
const TARAS_SMS_LINK = "sms:6315991363";

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

function normalizePlanType(name: string): PlanType | null {
  const x = String(name || "").toLowerCase().trim();
  if (x === "basic") return "basic";
  if (x === "plus") return "plus";
  if (x === "premium") return "premium";
  if (x === "elite") return "elite";
  return null;
}

function prettyPlanName(plan: PlanType | null): string {
  if (plan === "basic") return "Basic";
  if (plan === "plus") return "Plus";
  if (plan === "premium") return "Premium";
  if (plan === "elite") return "Elite";
  return "";
}

function getPlanRank(plan: PlanType | null): number {
  if (plan === "basic") return 1;
  if (plan === "plus") return 2;
  if (plan === "premium") return 3;
  if (plan === "elite") return 4;
  return 0;
}

export default function PlansSection() {
  const [currentSlide, setCurrentSlide] = useState(() => {
    const i = plans.findIndex((p) => p.name === "Plus");
    return i >= 0 ? i : 0;
  });

  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [upgradePopupOpen, setUpgradePopupOpen] = useState(false);
  const [upgradeTargetPlan, setUpgradeTargetPlan] = useState<PlanType | null>(null);

  const { user, isAuthenticated, token } = useAuth();

  const addresses: Address[] = ((user as any)?.addresses || []) as Address[];
  const currentUserPlan = normalizePlanType((user as any)?.subscription || "");

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

  const [addrActiveMap, setAddrActiveMap] = useState<Record<string, boolean>>({});
  const [checkingAddr, setCheckingAddr] = useState(false);

  useEffect(() => {
    if (!selectedAddressId && defaultAddress?._id) {
      setSelectedAddressId(String(defaultAddress._id));
    }
  }, [defaultAddress, selectedAddressId]);

  const checkAddressActive = async (addressId: string) => {
    if (!token) return;
    setCheckingAddr(true);
    try {
      const res = await fetch(
        `https://api.profixter.com/api/subscriptions/check/address/${addressId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      const active = !!data?.active;
      setAddrActiveMap((m) => ({ ...m, [addressId]: active }));
    } catch (e) {
      console.error("checkAddressActive failed:", e);
      setAddrActiveMap((m) => ({ ...m, [addressId]: false }));
    } finally {
      setCheckingAddr(false);
    }
  };

  useEffect(() => {
    if (token && selectedAddressId) {
      if (addrActiveMap[selectedAddressId] === undefined) {
        checkAddressActive(selectedAddressId);
      }
    }
  }, [token, selectedAddressId, addrActiveMap]);

  const startCheckout = async (
    plan: PlanType,
    addressId: string,
    email: string,
    cycle: BillingCycle
  ) => {
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
      alert("This address already has an active plan.");
      setAddrActiveMap((m) => ({ ...m, [addressId]: true }));
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    } else {
      alert("Unable to start subscription. Please try again.");
    }
  };

  const openUpgradePopup = (plan: PlanType) => {
    setUpgradeTargetPlan(plan);
    setUpgradePopupOpen(true);
  };

  const getActionForPlan = (planName: string) => {
    const planType = normalizePlanType(planName);
    const selectedAddressActive = selectedAddressId ? addrActiveMap[selectedAddressId] === true : false;

    if (!planType) {
      return {
        kind: "subscribe" as const,
        label: "Start Membership",
        disabled: false,
      };
    }

    if (!selectedAddressActive) {
      return {
        kind: "subscribe" as const,
        label: billing === "annual" ? "Start Annual & Save" : "Start Membership",
        disabled: false,
      };
    }

    if (!currentUserPlan) {
      return {
        kind: "active-unknown" as const,
        label: "Already Active",
        disabled: true,
      };
    }

    const currentRank = getPlanRank(currentUserPlan);
    const targetRank = getPlanRank(planType);

    if (targetRank === currentRank) {
      return {
        kind: "active" as const,
        label: "Active",
        disabled: true,
      };
    }

    if (targetRank > currentRank) {
      return {
        kind: "upgrade" as const,
        label: `Upgrade to ${prettyPlanName(planType)}`,
        disabled: false,
      };
    }

    return {
      kind: "lower" as const,
      label: "Active Higher Plan",
      disabled: true,
    };
  };

  const handleSubscribe = (planName: string) => {
    const planType = normalizePlanType(planName);

    if (!planType) {
      alert("Invalid plan selected. Please refresh and try again.");
      return;
    }

    if (!isAuthenticated || !user) {
      window.location.href = "/signin?redirect=/";
      return;
    }

    if (!addresses.length) {
      alert("Please add an address to your account first");
      window.location.href = "/account";
      return;
    }

    if (!selectedAddressId || !selectedAddress) {
      alert("Please select an address");
      return;
    }

    const action = getActionForPlan(planName);

    if (action.kind === "active" || action.kind === "lower" || action.kind === "active-unknown") {
      return;
    }

    if (action.kind === "upgrade") {
      openUpgradePopup(planType);
      return;
    }

    startCheckout(planType, selectedAddress._id, (user as any).email, billing);
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % plans.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + plans.length) % plans.length);

  const addressIsActive = selectedAddressId ? addrActiveMap[selectedAddressId] === true : false;

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
                    if (token && addrActiveMap[id] === undefined) checkAddressActive(id);
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
                  <span className="text-[#C5CBD8]">Checking plan for this address…</span>
                ) : addressIsActive ? (
                  <span className="text-[#FCA5A5] font-semibold">
                    Active plan{currentUserPlan ? `: ${prettyPlanName(currentUserPlan)}` : ""}
                  </span>
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
          <span className="block text-white">Stop Paying</span>
          <span className="block text-[#86EFAC]">For Every Repair</span>
          <span className="block text-white">Get Unlimited Help</span>
        </h2>

        <p className="text-[#C5CBD8] text-base sm:text-lg leading-relaxed max-w-[520px] mx-auto">
          Clear monthly plans for real home maintenance. Pick how many 90-minute visits you need,
          then book them on your schedule.
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
                <span className="text-[#1F7A2E] text-lg">🎁</span>
              </div>
              <div>
                <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                  Annual Plan — Pay for 11 months, get 12 months of scheduled handyman support
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
                            <div className="bg-[#EEF2FF] rounded-[26px] border border-[#C5CBD8] p-6 sm:p-8 flex flex-col shadow-[0_20px_80px_rgba(0,0,0,0.35)] transform transition duration-300 hover:-translate-y-1">
                              {plan.badge && (
                                <div className="mb-3 flex justify-center">
                                  <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-4 py-2 rounded-xl border border-white/70 shadow">
                                    <span className="text-[13px] font-extrabold text-white">
                                      {plan.badge}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="text-center mb-4 sm:mb-5">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#313234] leading-tight mb-2">
                                  {plan.name}
                                </h3>
                                <p className="text-sm sm:text-base text-[#6A6D71] leading-relaxed">
                                  {plan.description}
                                </p>
                              </div>

                              {billing === "annual" && (
                                <div className="mb-3 flex justify-center">
                                  <div className="px-3 py-1 rounded-full bg-[#86EFAC]/20 border border-[#43A047]/25">
                                    <span className="text-[#1F7A2E] font-extrabold text-xs sm:text-sm">
                                      1 month FREE • Pay for 11, get 12
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

                              <button
                                onClick={() => handleSubscribe(plan.name)}
                                disabled={action.disabled}
                                className={`w-full h-[56px] sm:h-[60px] rounded-2xl text-lg sm:text-xl font-extrabold leading-none transition-all duration-300 mt-6 flex items-center justify-center ${
                                  action.disabled
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : action.kind === "upgrade"
                                    ? "bg-[#111827] hover:bg-black text-white hover:scale-[1.01]"
                                    : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                                }`}
                              >
                                {action.label}
                              </button>

                              <div className="mt-3 text-center text-[12px] text-[#6A6D71]">
                                Each visit up to 90 minutes • Cancel anytime • No contracts
                                <br />
                                <span className="text-[#6A6D71]/80">
                                  Materials at cost • No markup • Transparent pricing
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
                    <div className="relative w-[420px] min-h-[560px] bg-[#EEF2FF] rounded-[22px] border border-[#C5CBD8] shadow-[0_20px_90px_rgba(0,0,0,0.35)] flex-shrink-0 overflow-hidden">
                      {plans[currentSlide].badge && (
                        <div className="absolute top-4 left-4 z-10">
                          <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-4 py-2 rounded-xl border border-[#EEF2FF]/70 shadow-lg">
                            <span className="text-[14px] font-extrabold text-[#EEF2FF]">
                              {plans[currentSlide].badge}
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
                          plans[currentSlide].badge ? "pt-14" : "",
                        ].join(" ")}
                      >
                        <div className="text-center mb-8">
                          <h3 className="text-3xl font-extrabold text-[#313234] mb-2">
                            {plans[currentSlide].name}
                          </h3>
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
                                    <span className="font-extrabold text-[#313234]">12</span> • Equivalent{" "}
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

                              <button
                                onClick={() => handleSubscribe(plan.name)}
                                disabled={action.disabled}
                                className={`w-full h-[62px] rounded-[14px] text-xl font-extrabold transition-all mt-6 flex items-center justify-center ${
                                  action.disabled
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : action.kind === "upgrade"
                                    ? "bg-[#111827] hover:bg-black text-white hover:scale-[1.01]"
                                    : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                                }`}
                              >
                                {action.label}
                              </button>

                              <div className="mt-3 text-center text-[12px] text-[#6A6D71]">
                                Each visit up to 90 minutes • Cancel anytime • No contracts
                                <br />
                                <span className="text-[#6A6D71]/80">
                                  Materials at cost • No markup • Transparent pricing
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
                            <div className="absolute inset-0 bg-[#EEF2FF] rounded-[16px] border border-[#C5CBD8] p-6 shadow-[0_12px_60px_rgba(0,0,0,0.25)] transition-transform duration-300 group-hover:-translate-y-1" />
                            {plan.badge && (
                              <div className="absolute top-3 left-3 z-20">
                                <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-3 py-1.5 rounded-lg border border-white/70 shadow">
                                  <span className="text-[12px] font-extrabold text-white">
                                    {plan.badge}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="relative z-10 p-6 flex flex-col h-full">
                              <div className="text-center mb-6">
                                <h3 className="text-xl font-extrabold text-[#313234] mb-2">{plan.name}</h3>
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

                              <div className="mt-auto pt-4">
                                <div
                                  className={`w-full h-[40px] rounded-[10px] text-[15px] font-extrabold flex items-center justify-center transition ${
                                    action.kind === "upgrade"
                                      ? "bg-[#111827] text-white"
                                      : action.kind === "active"
                                      ? "bg-gray-300 text-gray-600"
                                      : "bg-[#306EEC] text-white"
                                  }`}
                                >
                                  {action.kind === "upgrade" ? "Upgrade" : action.kind === "active" ? "Active" : billing === "annual" ? "View Annual" : "View"}
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

      {upgradePopupOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_20px_100px_rgba(0,0,0,0.35)]">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#EEF2FF] flex items-center justify-center text-2xl mb-4">
                📞
              </div>

              <h3 className="text-2xl font-extrabold text-[#313234]">
                Upgrade to {prettyPlanName(upgradeTargetPlan)}
              </h3>

              <p className="mt-3 text-[#6A6D71] leading-relaxed">
                To upgrade your current plan, please call or text Taras directly.
              </p>

              <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <p className="text-sm text-[#6A6D71]">Taras</p>
                <p className="text-2xl font-extrabold text-[#313234]">{TARAS_PHONE_DISPLAY}</p>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={TARAS_PHONE_LINK}
                  className="h-[52px] rounded-[16px] bg-[#306EEC] hover:bg-[#2558c9] text-white font-extrabold inline-flex items-center justify-center transition"
                >
                  Call Taras
                </a>
                <a
                  href={TARAS_SMS_LINK}
                  className="h-[52px] rounded-[16px] bg-[#111827] hover:bg-black text-white font-extrabold inline-flex items-center justify-center transition"
                >
                  Text Taras
                </a>
              </div>

              <button
                type="button"
                onClick={() => setUpgradePopupOpen(false)}
                className="mt-4 h-[48px] px-5 rounded-[14px] border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[#313234] font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
