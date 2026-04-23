"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNextBooking } from "@/lib/booking-service";
import { useAuth } from "@/lib/useAuth";

type FixterUser = {
  defaultAddressId?: string | null;
};

type NextBookingResponse = {
  hasSubscription?: boolean;
};

const PRICING_CHIPS = ["$149", "$249", "$349", "$499"];

export default function HeroSection() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const [subState, setSubState] = useState<"unknown" | "sub" | "none">("unknown");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const safeSet = (fn: () => void) => {
      if (!mountedRef.current) return;
      fn();
    };

    const run = async () => {
      if (!isAuthenticated) {
        safeSet(() => setSubState("none"));
        return;
      }

      const addressId = typedUser?.defaultAddressId;
      if (!addressId) {
        safeSet(() => setSubState("none"));
        return;
      }

      safeSet(() => setSubState("unknown"));

      try {
        const nextBooking = (await getNextBooking(addressId)) as NextBookingResponse;
        safeSet(() => setSubState(nextBooking?.hasSubscription ? "sub" : "none"));
      } catch {
        safeSet(() => setSubState("none"));
      }
    };

    run();
  }, [isAuthenticated, typedUser?.defaultAddressId]);

  const scrollToHash = (hash: string) => {
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    const headerOffset = window.innerWidth >= 1024 ? 120 : 100;
    const y = el.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", hash);
  };

  const goToPlans = () => {
    const el = document.getElementById("plans");
    if (el) scrollToHash("#plans");
    else window.location.href = "/#plans";
  };

  const goToBooking = () => {
    const el = document.getElementById("pick-day");
    if (el) scrollToHash("#pick-day");
    else window.location.href = "/#pick-day";
  };

  const primaryCtaLabel = useMemo(
    () => (subState === "sub" ? "Book Visit" : "View Plans"),
    [subState]
  );

  const secondaryCtaLabel = useMemo(
    () => (subState === "sub" ? "View Plans" : "Book Visit"),
    [subState]
  );

  return (
    <section className="relative w-full overflow-hidden bg-[#eef3ff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,110,236,0.20),transparent_38%),radial-gradient(circle_at_85%_12%,rgba(255,255,255,0.95),transparent_34%),linear-gradient(180deg,#eff4ff_0%,#e7edfb_52%,#edf2ff_100%)]" />

      <div className="absolute inset-0 z-0">
        <div className="absolute inset-y-0 right-0 w-full lg:w-[58%]">
          <Image
            src="/images/hero-bg.png"
            alt="Well-kept home interior"
            fill
            className="object-cover object-center opacity-30 lg:opacity-55"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#eef3ff] via-[#eef3ff]/78 to-white/12 lg:from-[#eef3ff] lg:via-[#eef3ff]/56 lg:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/28 via-transparent to-[#eef3ff]/55" />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-6">
        <div className="flex min-h-[700px] flex-col justify-center py-24 sm:min-h-[760px] sm:py-28 lg:min-h-[840px] lg:py-32">
          <div className="max-w-[760px]">
            <div className="inline-flex rounded-full border border-[#c8d5f2] bg-white/82 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4d5566] shadow-[0_10px_35px_rgba(42,55,95,0.08)] backdrop-blur">
              Serving Long Island homeowners
            </div>

            <h1 className="mt-6 max-w-[720px] text-[42px] font-extrabold leading-[0.94] tracking-[-0.045em] text-[#101828] sm:text-[58px] lg:text-[78px]">
              Personal Handyman Subscription for Homeowners
            </h1>

            <p className="mt-5 max-w-[620px] text-[17px] font-medium leading-[1.45] text-[#4b5565] sm:text-[20px]">
              Book home repairs online. No estimates. No surprise pricing. Each visit up to 90 minutes.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5 sm:gap-3">
              {PRICING_CHIPS.map((price) => (
                <button
                  key={price}
                  type="button"
                  onClick={goToPlans}
                  className="rounded-full border border-[#c9d7f6] bg-white/88 px-4 py-2 text-sm font-extrabold text-[#1f2a44] shadow-[0_12px_30px_rgba(52,73,121,0.08)] transition hover:border-[#306EEC] hover:text-[#306EEC]"
                >
                  {price}
                </button>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  if (subState === "sub") goToBooking();
                  else goToPlans();
                }}
                className="inline-flex min-h-[58px] items-center justify-center rounded-[18px] bg-[#306EEC] px-7 text-base font-extrabold text-white shadow-[0_18px_45px_rgba(48,110,236,0.28)] transition hover:bg-[#2558c9] active:scale-[0.99] sm:min-w-[188px] sm:text-lg"
              >
                {primaryCtaLabel}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (subState === "sub") goToPlans();
                  else goToBooking();
                }}
                className="inline-flex min-h-[58px] items-center justify-center rounded-[18px] border border-[#c5cfe3] bg-white/84 px-7 text-base font-bold text-[#1f2937] shadow-[0_12px_35px_rgba(42,55,95,0.08)] transition hover:border-[#306EEC] hover:text-[#306EEC] active:scale-[0.99] sm:min-w-[188px] sm:text-lg"
              >
                {secondaryCtaLabel}
              </button>
            </div>

            <div className="mt-4 text-sm text-[#667085]">
              {isAuthenticated && subState === "unknown"
                ? "Checking your plan details..."
                : "Simple monthly plans for Long Island homeowners."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
