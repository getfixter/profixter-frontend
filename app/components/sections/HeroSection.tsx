"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNextBooking } from "@/lib/booking-service";
import { useAuth } from "@/lib/useAuth";

type FixterUser = {
  defaultAddressId?: string | null;
};

type NextBookingResponse = {
  hasSubscription?: boolean;
};

const HERO_PROOF = [
  { value: "5.0 ★", label: "Google Rating" },
  { value: "9+ yrs", label: "On Long Island" },
  { value: "HI-71484", label: "Licensed" },
];

const TRUST_ITEMS = [
  "5.0 Google Rating",
  "Licensed HI-71484",
  "9+ Years on Long Island",
  "Fully Insured",
];

const HIGH_TICKET_SERVICES = [
  { label: "1-Day Roof Replacement", anchor: "/roofing" },
  { label: "Full Bathroom Remodeling", anchor: "/remodeling" },
  { label: "Full Kitchen Remodeling", anchor: "/kitchen" },
];

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

  const goToHowItWorks = () => {
    const el = document.getElementById("how-it-works");
    if (el) scrollToHash("#how-it-works");
    else window.location.href = "/#how-it-works";
  };

  const ctaConfig = useMemo(() => {
    if (subState === "sub") {
      return {
        primaryLabel: "Book a Visit",
        primaryAction: goToBooking,
        secondaryLabel: "View Plans",
        secondaryAction: goToPlans,
      };
    }
    if (isAuthenticated) {
      return {
        primaryLabel: "See Memberships",
        primaryAction: goToPlans,
        secondaryLabel: "Book a Visit",
        secondaryAction: goToBooking,
      };
    }
    return {
      primaryLabel: "See Memberships",
      primaryAction: goToPlans,
      secondaryLabel: "How It Works",
      secondaryAction: goToHowItWorks,
    };
  }, [subState, isAuthenticated]);

  const handleServiceClick = (anchor: string) => {
    if (anchor.startsWith("/")) {
      window.location.href = anchor;
      return;
    }
    const el = document.getElementById(anchor.replace("#", ""));
    if (el) scrollToHash(anchor);
    else window.location.href = `/${anchor}`;
  };

  return (
    <section className="relative w-full overflow-hidden bg-[#080F1E] min-h-screen">

      {/* ── Background ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.webp"
          alt="Well-kept Long Island home"
          fill
          className="object-cover object-center"
          style={{ opacity: 0.38 }}
          priority
        />
        {/* Strong left-side overlay keeps text readable; right side reveals the home */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080F1E] via-[#080F1E]/94 lg:via-[#080F1E]/72 to-[#080F1E]/18" />
        {/* Bottom fade for seamless section transition */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080F1E]/35 via-transparent to-[#080F1E]/92" />
        {/* Subtle dot-matrix texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Ambient glows ──────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-60 -left-60 h-[900px] w-[900px] rounded-full bg-[#306EEC]/7 blur-[220px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-[-80px] h-[700px] w-[700px] rounded-full bg-[#1A3A7A]/9 blur-[200px]"
      />

      {/* ── Main grid ──────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div
          className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16 py-28 sm:py-32 lg:py-36 pb-44 sm:pb-48"
          style={{ minHeight: "calc(100svh - 72px)" }}
        >

          {/* ── LEFT: Copy ───────────────────────────────── */}
          <div className="flex-1 max-w-[660px]">

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 backdrop-blur-sm mb-8">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full bg-[#86EFAC]"
                style={{ boxShadow: "0 0 10px rgba(134,239,172,0.9)" }}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                Long Island&rsquo;s Premier Home Care Membership
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[58px] font-black leading-[0.87] tracking-[-0.048em] text-white sm:text-[80px] lg:text-[104px] mb-7">
              Your Home,
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)",
                }}
              >
                Handled.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-[20px] sm:text-[23px] font-bold leading-[1.28] text-white/90 mb-4 max-w-[560px]">
              The membership Long Island homeowners keep.
            </p>

            {/* Description */}
            <p className="text-[16px] sm:text-[17px] leading-[1.72] text-white/48 max-w-[510px] mb-10">
              One trusted team. Regular monthly visits. Predictable care &mdash;
              no estimates, no surprises, year after year.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3.5 mb-5">
              <button
                type="button"
                onClick={ctaConfig.primaryAction}
                className="inline-flex min-h-[64px] w-full sm:w-auto items-center justify-center rounded-[18px] bg-[#306EEC] px-10 text-[17px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2558c9] active:scale-[0.99]"
                style={{ boxShadow: "0 20px 60px rgba(48,110,236,0.40)" }}
              >
                {ctaConfig.primaryLabel}
              </button>

              <button
                type="button"
                onClick={ctaConfig.secondaryAction}
                className="inline-flex min-h-[64px] w-full sm:w-auto items-center justify-center rounded-[18px] border border-white/20 bg-white/[0.07] px-10 text-[17px] font-bold text-white/88 backdrop-blur-sm transition-all duration-300 hover:border-white/35 hover:bg-white/[0.13] hover:text-white active:scale-[0.99]"
              >
                {ctaConfig.secondaryLabel}
              </button>
            </div>

            {/* Subtle hint */}
            <p className="text-[13px] text-white/30 mb-9">
              {isAuthenticated && subState === "unknown"
                ? "Checking your plan details…"
                : "Memberships from $149/mo · Month-to-month · Long Island"}
            </p>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
              {TRUST_ITEMS.map((text) => (
                <div key={text} className="flex items-center gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12.5l4 4 10-10"
                      stroke="#86EFAC"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-[13px] font-semibold text-white/58">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Premium Visual Panel (desktop) ────── */}
          <div className="hidden lg:flex flex-col gap-4 flex-shrink-0 w-[400px] xl:w-[430px]">

            {/* Premium Membership Card */}
            <div
              className="relative rounded-[28px] p-7 overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #0D1F42 0%, #0F2558 50%, #0A1835 100%)",
                boxShadow:
                  "0 48px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.09)",
              }}
            >
              {/* Card shine */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[28px]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, transparent 55%)",
                }}
              />
              {/* Top accent line */}
              <div
                aria-hidden="true"
                className="absolute top-0 left-10 right-10 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                }}
              />

              <div className="relative">
                {/* Card header */}
                <div className="flex items-center justify-between mb-10">
                  <Image
                    src="/images/logo.svg"
                    alt="Profixter"
                    width={120}
                    height={36}
                    className="brightness-0 invert opacity-90"
                  />
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">
                    Membership
                  </div>
                </div>

                {/* Plan */}
                <div className="mb-8">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/32 mb-1.5">
                    Membership
                  </div>
                  <div className="text-[28px] font-black text-white tracking-[-0.025em] leading-tight">
                    Home Care Plus
                  </div>
                  <div className="text-[14px] text-white/48 mt-1.5 leading-snug">
                    Two scheduled visits per month
                  </div>
                </div>

                {/* Coverage preview */}
                <div className="mb-7 rounded-[16px] bg-white/[0.06] border border-white/[0.08] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/32 mb-3">
                    What&rsquo;s included
                  </div>
                  <div className="space-y-2">
                    {[
                      "Same trusted team, every visit",
                      "No estimates — book and we handle it",
                      "Priority scheduling slots",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#86EFAC] flex-shrink-0" />
                        <span className="text-[13px] text-white/65 leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-between pt-5 border-t border-white/[0.09]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-1">
                      Status
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full bg-[#86EFAC]"
                        style={{ boxShadow: "0 0 7px rgba(134,239,172,0.85)" }}
                      />
                      <span className="text-[13px] font-bold text-[#86EFAC]">
                        Member
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-1">
                      License
                    </div>
                    <div className="font-mono text-[13px] font-bold text-white/75">
                      HI-71484
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Proof stats row */}
            <div className="grid grid-cols-3 gap-3">
              {HERO_PROOF.map(({ value, label }) => (
                <div
                  key={label}
                  className="rounded-[18px] border border-white/[0.09] bg-white/[0.04] p-4 text-center backdrop-blur-sm"
                >
                  <div className="text-[19px] font-extrabold text-white leading-none mb-1.5">
                    {value}
                  </div>
                  <div className="text-[10px] font-semibold text-white/38 leading-tight">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* High-ticket service links */}
            <div className="flex flex-col gap-2">
              {HIGH_TICKET_SERVICES.map(({ label, anchor }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleServiceClick(anchor)}
                  className="group w-full rounded-[14px] border border-white/[0.07] bg-white/[0.03] px-4 py-3 flex items-center justify-between hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-200"
                >
                  <span className="text-[13px] font-semibold text-white/58 group-hover:text-white/82 transition-colors">
                    {label}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white/22 group-hover:text-white/50 transition-colors flex-shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
              {/* Estimate CTA */}
              <Link
                href="/estimate"
                className="group w-full rounded-[14px] border border-[#306EEC]/22 bg-[#306EEC]/[0.06] px-4 py-3 flex items-center justify-between hover:bg-[#306EEC]/[0.13] hover:border-[#306EEC]/40 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-[#7BAEFF]/70" aria-hidden="true">
                    <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 9h8M8 13h6M8 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span className="text-[13px] font-semibold text-[#7BAEFF]/75 group-hover:text-[#7BAEFF] transition-colors">
                    Get Free Project Estimate
                  </span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#7BAEFF]/30 group-hover:text-[#7BAEFF]/70 transition-colors flex-shrink-0" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* ── Mobile proof stats (shown below fold on mobile) ── */}
      <div className="relative z-10 lg:hidden mx-auto max-w-[1280px] px-4 sm:px-6 -mt-28 mb-16">
        <div className="grid grid-cols-3 gap-3">
          {HERO_PROOF.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-[16px] border border-white/[0.09] bg-white/[0.05] p-3.5 text-center backdrop-blur-sm"
            >
              <div className="text-[17px] font-extrabold text-white leading-none mb-1">
                {value}
              </div>
              <div className="text-[10px] font-semibold text-white/38 leading-tight">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom premium services strip ──────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.07] bg-black/28 backdrop-blur-md">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Services — hidden on xs to prevent overflow */}
            <div className="hidden sm:flex flex-wrap items-center gap-5 sm:gap-8">
              {HIGH_TICKET_SERVICES.map(({ label, anchor }, i, arr) => (
                <span key={label} className="flex items-center gap-5 sm:gap-8">
                  <button
                    type="button"
                    onClick={() => handleServiceClick(anchor)}
                    className="text-[12px] sm:text-[13px] font-semibold text-white/50 hover:text-white/80 transition-colors"
                  >
                    {label}
                  </button>
                  {i < arr.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="h-3 w-px bg-white/15 flex-shrink-0"
                    />
                  )}
                </span>
              ))}
            </div>
            {/* License badge */}
            <div className="flex items-center gap-2.5">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white/28"
                aria-hidden="true"
              >
                <path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/28">
                Licensed
              </span>
              <span className="text-white/15 text-[10px]">·</span>
              <span className="font-mono text-[12px] text-white/35">HI-71484</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
