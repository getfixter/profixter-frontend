"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getNextBooking } from "@/lib/booking-service";
import { useAuth } from "@/lib/useAuth";

type FixterUser = {
  defaultAddressId?: string | null;
};

type NextBookingResponse = {
  hasSubscription?: boolean;
};

const BENEFITS = [
  "90-minute visits",
  "Same trusted team",
  "One monthly price",
];

const TRUST_ROW = [
  "5.0 Google rating",
  "Long Island local",
  "Cancel anytime",
];

export default function HeroSection() {
  const router = useRouter();
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
    else router.push("/#plans");
  };

  const goToBooking = () => {
    const el = document.getElementById("pick-day");
    if (el) scrollToHash("#pick-day");
    else router.push("/#pick-day");
  };

  const ctaConfig =
    subState === "sub"
      ? {
          primaryLabel: "Book Visit",
          primaryAction: goToBooking,
          secondaryLabel: "Get Subscription",
          secondaryAction: goToPlans,
        }
      : isAuthenticated
        ? {
            primaryLabel: "Get Subscription",
            primaryAction: goToPlans,
            secondaryLabel: "Book Visit",
            secondaryAction: goToBooking,
          }
        : {
            primaryLabel: "Create Account",
            primaryAction: () => {
              router.push("/signup");
            },
            secondaryLabel: "Login",
            secondaryAction: () => {
              router.push("/signin");
            },
          };

  return (
    <section className="relative w-full max-w-[100vw] overflow-hidden bg-[#080F1E]">
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.webp"
          alt="Warm Long Island home cared for by Profixter"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07101F]/91 via-[#07101F]/72 to-[#07101F]/24" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07101F]/18 via-transparent to-[#07101F]/66" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-104px)] max-w-[1180px] items-center px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[calc(100svh-116px)] lg:px-8">
        <div className="w-full max-w-[680px] text-left">
          <h1 className="max-w-[350px] text-[40px] font-black leading-[0.98] tracking-[-0.025em] text-white sm:max-w-[680px] sm:text-[60px] sm:leading-[0.98] sm:tracking-[-0.028em] lg:text-[66px]">
            <span className="block">Smart People</span>
            <span className="block">Use</span>
            <span className="block">Handyman Monthly</span>
          </h1>

          <p className="mt-6 max-w-[350px] text-[17px] font-semibold leading-[1.55] text-white/76 sm:max-w-[590px] sm:text-[20px]">
            Same trusted team. One monthly price. No estimates. No surprise invoices.
          </p>

          <div className="mt-7 inline-flex max-w-[350px] items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-2.5 text-[13px] font-extrabold text-white/78 backdrop-blur-md sm:max-w-none">
            <span>Book visit</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#86EFAC]" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>We show up</span>
          </div>

          <div className="mt-7 flex max-w-[350px] flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit}
                className="flex items-center gap-2.5 text-[15px] font-extrabold text-white/86"
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#86EFAC]/18 text-[#86EFAC]">
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                    <path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {benefit}
              </div>
            ))}
          </div>

          <div className="mt-9 flex max-w-[350px] flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={ctaConfig.primaryAction}
              className="inline-flex min-h-[58px] items-center justify-center rounded-[16px] bg-[#306EEC] px-8 text-[16px] font-extrabold text-white shadow-[0_16px_42px_rgba(48,110,236,0.32)] transition hover:bg-[#2558c9] active:scale-[0.99] sm:min-w-[190px]"
            >
              {ctaConfig.primaryLabel}
            </button>

            <button
              type="button"
              onClick={ctaConfig.secondaryAction}
              className="inline-flex min-h-[58px] items-center justify-center rounded-[16px] border border-white/20 bg-white/10 px-8 text-[16px] font-extrabold text-white shadow-[0_14px_36px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white/16 active:scale-[0.99] sm:min-w-[190px]"
            >
              {ctaConfig.secondaryLabel}
            </button>
          </div>

          <div className="mt-7 flex max-w-[350px] flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center">
            <p className="text-[14px] font-bold text-white/50">
              Need roofing or siding?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:w-[210px]">
              <Link
                href="/roofing"
                className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#D4A574]/28 bg-[#D4A574]/12 px-4 text-[14px] font-extrabold text-[#E8C49A] transition hover:bg-[#D4A574]/18"
              >
                Roofing
              </Link>
              <Link
                href="/siding"
                className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-white/16 bg-white/8 px-4 text-[14px] font-extrabold text-white/78 transition hover:bg-white/13 hover:text-white"
              >
                Siding
              </Link>
            </div>
          </div>

          <div className="mt-8 flex max-w-[350px] flex-wrap items-center gap-x-4 gap-y-2 text-white/48 sm:max-w-none sm:gap-x-5">
            {TRUST_ROW.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#43A047]" />
                <span className="text-[13px] font-bold">{item}</span>
              </div>
            ))}
          </div>

          {isAuthenticated && subState === "unknown" ? (
            <p className="mt-4 text-[12px] font-semibold text-[#94A3B8]">
              Checking your plan details...
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
