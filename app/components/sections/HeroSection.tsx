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

  const ctaConfig = useMemo(() => {
    if (subState === "sub") {
      return {
        primaryLabel: "Book Visit",
        primaryAction: goToBooking,
        secondaryLabel: "View Plans",
        secondaryAction: goToPlans,
      };
    }

    if (isAuthenticated) {
      return {
        primaryLabel: "View Plans",
        primaryAction: goToPlans,
        secondaryLabel: "Book Visit",
        secondaryAction: goToBooking,
      };
    }

    return {
      primaryLabel: "Book Visit",
      primaryAction: goToBooking,
      secondaryLabel: "View Plans",
      secondaryAction: goToPlans,
    };
  }, [subState, isAuthenticated]);

  return (
    <section className="relative w-full overflow-hidden bg-[#e7edf9]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,110,236,0.24),transparent_36%),radial-gradient(circle_at_84%_14%,rgba(255,255,255,0.76),transparent_30%),linear-gradient(180deg,#ebf1fd_0%,#dee7f8_54%,#e9effc_100%)]" />

      <div className="absolute inset-0 z-0">
        <div className="absolute inset-y-0 right-0 w-full lg:w-[58%]">
          <Image
            src="/images/hero-bg.png"
            alt="Well-kept home interior"
            fill
            className="object-cover object-center opacity-36 lg:opacity-62"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#e7edf9] via-[#e7edf9]/72 to-black/12 lg:from-[#e7edf9] lg:via-[#e7edf9]/48 lg:to-black/22" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/12 via-transparent to-[#dbe5f8]/36" />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-6">
        <div className="flex min-h-[700px] flex-col justify-center py-24 sm:min-h-[760px] sm:py-28 lg:min-h-[840px] lg:py-32">
          <div className="max-w-[780px]">
            <div className="inline-flex rounded-full border border-[#b9c9ea] bg-white/78 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#364152] shadow-[0_12px_38px_rgba(42,55,95,0.10)] backdrop-blur">
              Serving Long Island homeowners
            </div>

            <h1 className="mt-6 max-w-[760px] text-[42px] font-black leading-[0.9] tracking-[-0.05em] text-[#0f1728] sm:text-[60px] lg:text-[84px]">
              Personal Handyman Subscription for Homeowners
            </h1>

            <p className="mt-5 max-w-[660px] text-[17px] font-semibold leading-[1.42] text-[#334155] sm:text-[20px]">
              Book a handyman online. No estimates. No surprise pricing. Each visit up to 90 minutes.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 sm:gap-3.5">
              {PRICING_CHIPS.map((price) => (
                <button
                  key={price}
                  type="button"
                  onClick={goToPlans}
                  className="rounded-full border border-[#bacbed] bg-white/92 px-4 py-2.5 text-sm font-extrabold text-[#172033] shadow-[0_14px_30px_rgba(39,58,99,0.10)] transition hover:-translate-y-0.5 hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] active:translate-y-0"
                >
                  {price}
                </button>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={ctaConfig.primaryAction}
                className="inline-flex min-h-[60px] w-full items-center justify-center rounded-[18px] bg-[#306EEC] px-8 text-base font-extrabold text-white shadow-[0_22px_55px_rgba(48,110,236,0.34)] transition hover:-translate-y-0.5 hover:bg-[#2558c9] active:scale-[0.99] sm:min-w-[210px] sm:w-auto sm:text-lg"
              >
                {ctaConfig.primaryLabel}
              </button>

              <button
                type="button"
                onClick={ctaConfig.secondaryAction}
                className="inline-flex min-h-[60px] w-full items-center justify-center rounded-[18px] border border-[#bcc8df] bg-white/88 px-8 text-base font-bold text-[#1f2937] shadow-[0_14px_36px_rgba(42,55,95,0.08)] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] active:scale-[0.99] sm:min-w-[188px] sm:w-auto sm:text-lg"
              >
                {ctaConfig.secondaryLabel}
              </button>
            </div>

            <div className="mt-5 text-sm font-medium text-[#5d6b82]">
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
