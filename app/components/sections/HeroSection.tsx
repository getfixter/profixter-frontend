"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { checkSubscription } from "@/lib/booking-service";
import { useEffect, useRef, useState } from "react";
import NeedItQuizModal from "@/app/components/NeedItQuizModal";

type FixterUser = {
  defaultAddressId?: string | null;
};

type SubscriptionResponse = {
  hasSubscription: boolean;
  freeFirstVisitAvailable?: boolean;
  message?: string;
};


export default function HeroSection() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const [needItOpen, setNeedItOpen] = useState(false);

  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaError, setCtaError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const goToPlans = () => {
    const el = document.getElementById("plans");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "/#plans";
  };

  const goToBooking = () => {
    const booking = document.getElementById("pick-day");
    if (booking) booking.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "/#pick-day";
  };

  const handleFixTodayClick = async () => {
    if (ctaLoading) return;
    setCtaError("");

    if (!isAuthenticated) {
      window.location.href = "/signin?redirect=/";
      return;
    }

    const addressId = typedUser?.defaultAddressId;
    if (!addressId) {
      goToPlans();
      return;
    }

    try {
      setCtaLoading(true);

      const subscription = (await checkSubscription(addressId)) as SubscriptionResponse;

      // allow booking if they either have a paid plan OR they still have a free first visit available
if (!subscription?.hasSubscription && !subscription?.freeFirstVisitAvailable) {
  goToPlans();
  return;
}

      goToBooking();
    } catch (e) {
      if (mountedRef.current) {
        setCtaError("Couldn’t verify your plan right now. Please try again.");
      }
      goToPlans();
    } finally {
      if (mountedRef.current) setCtaLoading(false);
    }
  };

  return (
    <>
      {/* ✅ Use min-height instead of fixed height */}
      <section className="relative w-full overflow-hidden bg-[#313234]">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-bg.png"
            alt="Professional handyman fixing lights"
            fill
            className="object-cover opacity-90"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/65" />
        </div>

        {/* ✅ Layout wrapper: consistent across phones/iPads */}
        <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-5">
          {/* ✅ min heights that scale nicely */}
          <div className="relative min-h-[720px] sm:min-h-[760px] lg:min-h-[860px] pt-24 sm:pt-24 lg:pt-28 pb-10 sm:pb-12 lg:pb-16">
            {/* ✅ TROPHY OVERLAY (kept behind text on mobile) */}
<div className="pointer-events-none absolute inset-0 z-[1]">
  {/* Desktop trophy (still on top visually because it's far right and not overlapping) */}
  <div className="hidden lg:block absolute right-10 top-32">
    <Image
      src="/images/trophy.png"
      alt="Award trophy"
      width={220}
      height={520}
      className="opacity-95 drop-shadow-[0_25px_80px_rgba(0,0,0,0.45)]"
    />
  </div>

  {/* Mobile trophy (behind text + softer) */}
  <div className="lg:hidden absolute left-1/2 top-[280px] -translate-x-1/2">
    <Image
      src="/images/trophy.png"
      alt="Award trophy"
      width={170}
      height={380}
      className="opacity-40 drop-shadow-[0_25px_80px_rgba(0,0,0,0.35)]"
    />
  </div>
</div>


            {/* Content */}
            <div className="relative z-10 h-full flex flex-col justify-between">
              {/* Headline */}
              <div className="w-full max-w-[1200px] mx-auto">
                {/* Mobile */}
                <div className="lg:hidden">
                  <h1 className="pt-2 text-center">
                    <div className="text-[34px] sm:text-[48px] font-bold leading-[92%] text-white uppercase tracking-tight">
                      Handyman Subscription
                    </div>
                    <div className="text-[34px] sm:text-[48px] font-bold leading-[92%] uppercase tracking-tight">
                      <span className="text-[#5E8BFF]">Your Warranty</span>{" "}
                      <span className="text-white"></span>
                    </div>
                    <div className="text-[34px] sm:text-[48px] font-bold leading-[92%] uppercase tracking-tight text-white">
                      For all fixes
                    </div>
                  </h1>
                </div>

                {/* Desktop */}
                <div className="hidden lg:block lg:pt-6">
                  <h1 className="mb-6">
                    <div className="text-[64px] font-bold leading-[90%] text-white uppercase tracking-[-0.05em]">
                      Handyman Subscription
                    </div>
                    <div className="text-[64px] font-bold leading-[90%] uppercase tracking-[-0.05em]">
                      <span className="text-[#5E8BFF]">Your Warranty</span>{" "}
                      <span className="text-white"></span>
                    </div>
                    <div className="text-[64px] font-bold leading-[90%] uppercase tracking-[-0.05em] text-white">
                      For all fixes
                    </div>
                  </h1>
                </div>
              </div>

              {/* Desktop copy + CTAs */}
              <div className="hidden lg:block w-full max-w-[1200px] mx-auto">
                <div className="lg:ml-[90px] text-left">
                  <div className="mb-4 flex items-center gap-3">
                    <a
                      href="https://share.google/tXfssMqyKFLeqqTHm"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-[#313234]/30 backdrop-blur-[8px] rounded-full border border-white/15 hover:border-white/25 transition"
                    >
                      <Image src="/images/icons/icon-google.svg" alt="" width={16} height={16} className="w-4 h-4" />
                      <span className="text-[14px] font-semibold text-[#EEF2FF]">5.0 stars</span>
                      <span className="text-[14px] text-[#C5CBD8]">Across Long Island</span>
                    </a>

                    <div className="text-[13px] text-[#C5CBD8]">Suffolk & Nassau • Real local handyman</div>
                  </div>

                  <p className="text-[20px] font-medium text-[#C5CBD8] leading-[125%] max-w-[520px] mb-5">
                    One simple plan for small repairs & installs.
                    <br />
                    <span className="text-white font-semibold">$0 labor</span> •{" "}
                    <span className="text-white font-semibold">up to 90 minutes</span> per visit • cancel anytime.
                  </p>

                  <ul className="mb-6 space-y-2 text-[14px] text-[#C5CBD8] max-w-[560px]">
                    <li>• Stop living with “I’ll fix it later” problems</li>
                    <li>• Book online in minutes (no chasing contractors)</li>
                    <li>• Pay only for materials if needed</li>
                  </ul>

                  <button
                    type="button"
                    onClick={handleFixTodayClick}
                    disabled={ctaLoading}
                    className="mt-3 w-[362px] h-[54px] bg-white/10 hover:bg-white/20 transition-colors rounded-[14px] border border-white/25 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="text-[18px] font-semibold text-[#EEF2FF]">
                      {ctaLoading ? "Checking..." : "Book Now"}
                    </span>
                  </button>

                  <Link
                    href="/included"
                    className="mt-3 w-[362px] h-[54px] inline-flex items-center justify-center bg-transparent hover:bg-white/10 transition-colors rounded-[14px] border border-white/25"
                  >
                    <span className="text-[18px] font-semibold text-[#EEF2FF]">What’s included?</span>
                  </Link>

                  {ctaError && <div className="mt-3 text-[13px] text-red-200">{ctaError}</div>}

                  <div className="mt-3 text-[12px] text-[#C5CBD8]">
                    No contracts • Cancel anytime • Friendly, professional service
                  </div>

                  <button
                    type="button"
                    onClick={() => setNeedItOpen(true)}
                    className="mt-4 text-[13px] font-semibold text-[#EEF2FF]/90 underline underline-offset-4 hover:text-white"
                  >
                    Not sure? Take a 20-second quiz
                  </button>
                </div>
              </div>

              {/* Mobile copy + CTAs */}
              <div className="lg:hidden w-full max-w-[700px] mx-auto text-center">
                <div className="mt-4 flex justify-center">
                  <a
                    href="https://share.google/tXfssMqyKFLeqqTHm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-[#313234]/30 backdrop-blur-[8px] rounded-full border border-white/15"
                  >
                    <Image src="/images/icons/icon-google.svg" alt="" width={16} height={16} className="w-4 h-4" />
                    <span className="text-sm font-semibold text-[#EEF2FF]">5.0 stars</span>
                    <span className="text-sm text-[#C5CBD8]">Long Island</span>
                  </a>
                </div>

                <p className="mt-4 text-[15px] sm:text-[18px] font-medium text-[#C5CBD8] leading-[125%] mx-auto">
                  <span className="text-white font-semibold">$0 labor</span> • up to{" "}
                  <span className="text-white font-semibold">90 minutes</span> per visit • cancel anytime.
                </p>

                <div className="mt-4 space-y-2 text-[13px] text-[#C5CBD8]">
                  <div>• Book online in minutes</div>
                  <div>• Small repairs & installs</div>
                  <div>• Materials extra if needed</div>
                </div>

                <button
                  type="button"
                  onClick={handleFixTodayClick}
                  disabled={ctaLoading}
                  className="mt-3 w-full sm:w-[320px] h-[52px] sm:h-[56px] bg-white/10 hover:bg-white/20 transition-colors rounded-[14px] border border-white/25 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="text-lg sm:text-xl font-semibold text-[#EEF2FF]">
                    {ctaLoading ? "Checking..." : "Book Now"}
                  </span>
                </button>

                <Link
                  href="/included"
                  className="mt-3 w-full sm:w-[320px] h-[52px] sm:h-[56px] inline-flex items-center justify-center bg-transparent hover:bg-white/10 transition-colors rounded-[14px] border border-white/25"
                >
                  <span className="text-lg sm:text-xl font-semibold text-[#EEF2FF]">What’s included?</span>
                </Link>

                {ctaError && <div className="mt-3 text-[13px] text-red-200">{ctaError}</div>}

                <button
                  type="button"
                  onClick={() => setNeedItOpen(true)}
                  className="mt-4 text-[13px] font-semibold text-[#EEF2FF]/90 underline underline-offset-4 hover:text-white"
                >
                  Not sure? Take a 20-second quiz
                </button>
              </div>

              {/* Bottom strip */}
              <div className="hidden sm:flex items-end justify-between mt-10">
                <div className="text-sm sm:text-base font-normal text-[#eef2ff] leading-[19px]">
                  Serving Long Island:
                  <br />
                  Suffolk & Nassau
                </div>

                <div className="flex gap-3">
                  <div className="w-[160px] h-[110px] bg-[#eef2ff] rounded-[14px] border border-[#c5cbd8] p-4 shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
                    <div className="text-[22px] font-semibold text-[#313234]">$1,800+</div>
                    <div className="text-[13px] text-[#6a6c71] mt-2">saved yearly with Mr.Fixter plans</div>
                  </div>

                  <div className="w-[160px] h-[110px] bg-[#eef2ff] rounded-[14px] border border-[#c5cbd8] p-4 shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
                    <div className="text-[22px] font-semibold text-[#313234]">Free Visit</div>
                    <div className="text-[13px] text-[#6a6c71] mt-2">First 90 minutes visit on us</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <NeedItQuizModal
        open={needItOpen}
        onClose={() => setNeedItOpen(false)}
        onGoToPlans={() => {
          const el = document.getElementById("plans");
          if (el) el.scrollIntoView({ behavior: "smooth" });
          else window.location.href = "/#plans";
        }}
        ctaLabel="Get Plan"

      />
    </>
  );
}
