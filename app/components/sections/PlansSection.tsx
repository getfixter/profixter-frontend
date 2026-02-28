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
  // your prices look like whole dollars; keep it clean
  const rounded = Math.round(n);
  return String(rounded);
}

export default function PlansSection() {
  const [currentSlide, setCurrentSlide] = useState(() => {
  const i = plans.findIndex((p) => p.name === "Plus");
  return i >= 0 ? i : 0;
});
  const [billing, setBilling] = useState<BillingCycle>("monthly");

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

  // per-address active status cache
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
      const res = await fetch(`https://api.profixter.com/api/subscriptions/check/address/${addressId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedAddressId]);

  const startCheckout = async (plan: PlanType, addressId: string, email: string, cycle: BillingCycle) => {
    const res = await fetch("https://api.profixter.com/api/stripe/checkout/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, addressId, email, billingCycle: cycle }),
    });

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

  const handleSubscribe = (planName: string) => {
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

    const isActive = addrActiveMap[selectedAddressId] === true;
    if (isActive) {
      alert("This address already has an active plan.");
      return;
    }

    const planTypeMap: Record<string, PlanType> = {
      Basic: "basic",
      Plus: "plus",
      Premium: "premium",
      Elite: "elite",
    };

    const planType = planTypeMap[planName];
    if (!planType) {
      alert("Invalid plan selected. Please refresh and try again.");
      return;
    }

    startCheckout(planType, selectedAddress._id, (user as any).email, billing);
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % plans.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + plans.length) % plans.length);

  const addressIsActive = selectedAddressId ? addrActiveMap[selectedAddressId] === true : false;

  // ----- Mobile swipe support -----
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

  const disabledForAddress = isAuthenticated && !!selectedAddressId && addressIsActive;

  // ---------- Pricing helpers ----------
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
    <>
      Use code <span className="text-white font-semibold">SPRING</span> - 30% off your first month
    </>
  )}
</p>
            </div>

{/* switch */}
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

          {/* little promo badge */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              
              <span className="hidden sm:inline text-[#C5CBD8] text-xs">
                Cancel anytime • No contracts
              </span>
            </div>
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
                  <span className="text-[#FCA5A5] font-semibold">Already has a plan</span>
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
          className={`${
            compact ? "text-5xl sm:text-6xl" : "text-[64px]"
          } font-bold leading-[89%] mb-8 uppercase tracking-[-0.05em] flex flex-col gap-0`}
        >
          <span className="text-white">Choose</span>
          <span className="text-[#306EEC] -mt-2">Your</span>
          <span className="text-white -mt-2">Plan</span>
        </h2>

        <div className="mb-6">
  <p className="text-white text-2xl sm:text-3xl font-normal leading-tight mb-2">
    Code <span className="text-white font-extrabold">SPRING</span>
  </p>
  <p className="text-[#C5CBD8] text-base sm:text-lg leading-relaxed">
    <span className="text-white font-semibold">30% off your first month</span> on monthly plans.
    <br />
    Mr.Fixter - Your Home’s Best Friend.
  </p>
</div>

        {!compact && (
          <p className="text-[#C5CBD8] text-base leading-[19px]">
            Materials at cost. Only if needed,
            <br />
            with your approval - no markups.
          </p>
        )}

        {/* ✅ Billing toggle under header */}
        <BillingToggle compact={compact} />
      </div>
    </div>
  );

  return (
<section
  id="plans"
  className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative overflow-hidden scroll-mt-[140px]"
>
        {/* 🔥 Annual promo banner */}
<div className="mx-auto max-w-[1240px] px-5 lg:px-5 mb-6">
  <div className="bg-[#86EFAC]/15 border border-[#86EFAC]/30 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-[#86EFAC]/25 flex items-center justify-center">
        <span className="text-[#1F7A2E] text-lg">🎁</span>
      </div>
      <div>
        <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
  Annual Plan - Pay 11 months, Get 12
</p>
<p className="text-[#C5CBD8] text-sm">
  Or use code <span className="text-white font-semibold">SPRING</span> for 30% off your first month (monthly plans)
</p>
      </div>
    </div>

    <div className="text-[#86EFAC] font-extrabold text-sm sm:text-base">
  Pay 11 months • Get 12
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
        {/* Mobile/Tablet Header */}
        <HeaderBlock compact />

        <div className="flex flex-col lg:flex-row items-start gap-8 sm:gap-10 lg:gap-12">
          {/* Left Side - Desktop Only */}
          <div className="hidden lg:flex flex-shrink-0 w-[360px] pt-4 flex-col justify-between min-h-[560px]">
            <HeaderBlock />
          </div>

          {/* Right Side */}
          <div className="flex-1 relative w-full">
            {/* Mobile/Tablet carousel */}
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
                    const saving = Math.max(0, Math.round(monthly)); // 1 month free

                    const showPrice = billing === "annual" ? annual : monthly;
                    const big = formatMoney(showPrice);

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

                            {/* ✅ Annual badge */}
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
                              disabled={disabledForAddress}
                              className={`w-full h-[56px] sm:h-[60px] rounded-2xl text-lg sm:text-xl font-extrabold leading-none transition-all duration-300 mt-6 flex items-center justify-center ${
                                disabledForAddress
                                  ? "bg-gray-400 text-white cursor-not-allowed"
                                  : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                              }`}
                            >
                              {disabledForAddress
                                ? "Already has a plan"
                                : billing === "annual"
                                ? "Start Annual (1 month free)"
                                : plan.buttonText}
                            </button>

                            <div className="mt-3 text-center text-[12px] text-[#6A6D71]">
                              Cancel anytime • No contracts
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* dots */}
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

              {/* arrows */}
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
                Materials at cost. Only if needed,
                <br />
                with your approval - no markups.
              </p>
            </div>

            {/* Desktop layout */}
            <div className="hidden lg:block">
<div className="relative pb-44">
  {/* pb-16 guarantees room for controls below cards */}
  <div className="flex items-end gap-6">
                  {/* Main card */}
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
    plans[currentSlide].badge ? "pt-14" : ""
  ].join(" ")}
>
                      <div className="text-center mb-8">
                        <h3 className="text-3xl font-extrabold text-[#313234] mb-2">{plans[currentSlide].name}</h3>
                        <p className="text-base text-[#6A6D71] leading-relaxed">{plans[currentSlide].description}</p>
                      </div>

                      {/* price */}
                      {(() => {
                        const plan = plans[currentSlide];
                        const monthly = getMonthly(plan);
                        const annual = getAnnual(plan);
                        const saving = Math.max(0, Math.round(monthly));
                        const show = billing === "annual" ? annual : monthly;

                        return (
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
    <span className="font-extrabold text-[#313234]">${formatMoney(annual / 12)}</span>
    /mo billed annually
  </div>
)}

                          </div>
                        );
                      })()}

                      {plans[currentSlide].subtitle && (
                        <p className="text-[18px] font-bold text-[#306EEC] mb-4 text-center">
                          {plans[currentSlide].subtitle}
                        </p>
                      )}

                      <div className="space-y-3 mb-auto">
                        {plans[currentSlide].features.map((feature: string, idx: number) => (
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
                            <span className="text-[20px] font-semibold text-[#313234] leading-snug">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleSubscribe(plans[currentSlide].name)}
                        disabled={disabledForAddress}
                        className={`w-full h-[62px] rounded-[14px] text-xl font-extrabold transition-all mt-6 flex items-center justify-center ${
                          disabledForAddress
                            ? "bg-gray-400 text-white cursor-not-allowed"
                            : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                        }`}
                      >
                        {disabledForAddress
                          ? "Already has a plan"
                          : billing === "annual"
                          ? "Start Annual (1 month free)"
                          : plans[currentSlide].buttonText}
                      </button>

                      <div className="mt-3 text-center text-[12px] text-[#6A6D71]">
                        Cancel anytime • No contracts
                      </div>
                    </div>
                  </div>

                  {/* Side preview cards */}
                  <div className="flex gap-6">
                    {[1, 2].map((offset) => {
                      const index = (currentSlide + offset) % plans.length;
                      const plan = plans[index];

                      const monthly = getMonthly(plan);
                      const annual = getAnnual(plan);
                      const show = billing === "annual" ? annual : monthly;

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
  <div className="w-full h-[40px] rounded-[10px] bg-[#306EEC] text-white text-[15px] font-extrabold flex items-center justify-center opacity-90 group-hover:opacity-100 transition">
    {billing === "annual" ? "View Annual" : "View"}

  </div>
</div>

                          </div>

                          <div className="absolute inset-0 bg-[#313234]/15 backdrop-blur-[2px] rounded-[16px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop controls */}
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
  );
}
