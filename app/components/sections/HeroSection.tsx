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

const MEMBERSHIP_QUICK_LINKS = [
  { label: "See what's included", anchor: "/included" },
  { label: "How it works", anchor: "#how-it-works" },
  { label: "View all plans", anchor: "#plans" },
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

  const ctaConfig = useMemo(() => {
    if (subState === "sub") {
      return {
        primaryLabel: "Book Visit",
        primaryAction: goToBooking,
        secondaryLabel: "Get Subscription",
        secondaryAction: goToPlans,
      };
    }
    if (isAuthenticated) {
      return {
        primaryLabel: "Get Subscription",
        primaryAction: goToPlans,
        secondaryLabel: "Book Visit",
        secondaryAction: goToBooking,
      };
    }
    return {
      primaryLabel: "Get Subscription",
      primaryAction: goToPlans,
      secondaryLabel: "Register / Login",
      secondaryAction: () => {
        window.location.href = "/signin";
      },
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
                Long Island&rsquo;s Handyman Membership
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[44px] font-black leading-[0.92] tracking-[-0.04em] text-white sm:text-[60px] lg:text-[78px] mb-7">
              Stop Calling Handymen
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)",
                }}
              >
                Every Time Something Breaks.
              </span>
            </h1>

            {/* Sub-headline */}
            <p className="text-[18px] sm:text-[21px] font-bold leading-[1.32] text-white/90 mb-4 max-w-[560px]">
              Get a reliable handyman every month. Book visits for repairs, maintenance, and small projects — all in one simple membership.
            </p>

            {/* Clarity bullets */}
            <ul className="space-y-2.5 mb-9">
              {[
                "90-minute visits you can book online",
                "Month-to-month. Cancel anytime.",
                "Perfect for ongoing home maintenance (not emergencies)",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
                    <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[15px] sm:text-[16px] font-semibold text-white/80">{item}</span>
                </li>
              ))}
            </ul>

            {/* Supporting line */}
            <p className="text-[14px] sm:text-[15px] italic text-white/38 mb-8 max-w-[500px]">
              Built for homeowners who want control over their home — not chaos.
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

            {/* Risk reversal + urgency */}
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[13px] text-white/35">
                {isAuthenticated && subState === "unknown"
                  ? "Checking your plan details…"
                  : "From $149/mo · Cancel anytime · No long-term contracts"}
              </p>
              <p className="text-[12px] text-white/25 italic">
                Limited monthly capacity — we keep team sizes small to maintain quality.
              </p>
            </div>

            {/* Trust boost strip */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              {[
                { icon: "🛡️", text: "Licensed & insured" },
                { icon: "📍", text: "Local Long Island team" },
                { icon: "👤", text: "Consistent technician" },
                { icon: "⭐", text: "5.0 Google Rating" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-[14px]">{icon}</span>
                  <span className="text-[13px] font-semibold text-white/55">{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-[22px] border border-[#D4A574]/25 bg-white/[0.06] p-4 backdrop-blur-sm sm:p-5 lg:max-w-[620px]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-[390px]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E8C49A]/85">
                    Also Available
                  </div>
                  <div className="mt-2 text-[17px] font-extrabold leading-snug text-white sm:text-[18px]">
                    Need a new roof or siding? We also handle full exterior projects.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-semibold">
                    <a href="/roofing" className="text-[#E8C49A]/80 underline-offset-2 hover:text-[#E8C49A] hover:underline transition-colors">Roofing</a>
                    <a href="/siding" className="text-[#E8C49A]/80 underline-offset-2 hover:text-[#E8C49A] hover:underline transition-colors">Siding</a>
                    <span className="text-white/55">50-year warranty</span>
                    <span className="text-white/55">Financing available</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:w-[190px]">
                  <a
                    href="/roofing"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] bg-[#D4A574] px-4 text-[14px] font-extrabold text-[#111827] transition hover:-translate-y-0.5 hover:bg-[#E0B886]"
                  >
                    Roofing Estimate
                  </a>
                  <a
                    href="/siding"
                    className="inline-flex min-h-[48px] items-center justify-center rounded-[14px] border border-[#D4A574]/30 bg-[#D4A574]/10 px-4 text-[14px] font-extrabold text-[#E8C49A] transition hover:bg-[#D4A574]/18 hover:border-[#D4A574]/45"
                  >
                    Siding Estimate
                  </a>
                </div>
              </div>
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

            {/* Membership quick links */}
            <div className="flex flex-col gap-2">
              {MEMBERSHIP_QUICK_LINKS.map(({ label, anchor }) => (
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
            </div>

            <div className="rounded-[20px] border border-[#D4A574]/20 bg-white/[0.04] p-4 backdrop-blur-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8C49A]/75">
                Exterior Projects
              </div>
              <div className="mt-2 text-[14px] font-semibold leading-snug text-white/75">
                Roof replacement and siding — licensed, insured, Long Island local.
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href="/roofing"
                  className="flex items-center justify-center rounded-[11px] border border-[#D4A574]/28 bg-[#D4A574]/10 px-3 py-2 text-[12px] font-bold text-[#E8C49A] transition hover:bg-[#D4A574]/20"
                >
                  Roofing →
                </a>
                <a
                  href="/siding"
                  className="flex items-center justify-center rounded-[11px] border border-white/12 bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/65 transition hover:bg-white/[0.10]"
                >
                  Siding →
                </a>
              </div>
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
              {MEMBERSHIP_QUICK_LINKS.map(({ label, anchor }, i, arr) => (
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
