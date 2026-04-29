"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import Image from "next/image";

import Header from "@/app/components/sections/Header";
import RoofingSection from "@/app/components/sections/RoofingSection";
import RemodelingSection from "@/app/components/sections/RemodelingSection";
import ProjectsSection from "@/app/components/sections/ProjectsSection";
import TrustSection from "@/app/components/sections/TrustSection";
import FinalCTASection from "@/app/components/sections/FinalCTASection";
import Footer from "@/app/components/sections/Footer";
import { ChatWidget } from "@/app/components/ChatWidget";

const ADMIN_EMAIL = "getfixter@gmail.com";

const TRUST_CHIPS = [
  "Licensed HI-71484",
  "Fully Insured",
  "9+ Years on Long Island",
  "5.0 Google Rating",
] as const;

const SERVICES_PREVIEW = [
  { label: "1-Day Roof Replacement", accent: "#E8900A", icon: "🏠" },
  { label: "Full Bathroom Remodel", accent: "#3B7DEF", icon: "🛁" },
  { label: "Full Kitchen Remodel", accent: "#D97706", icon: "🍳" },
] as const;

function ProjectsHero() {
  return (
    <section
      className="relative w-full overflow-hidden flex flex-col items-center justify-center min-h-[82vh]"
      style={{ background: "linear-gradient(160deg, #07101F 0%, #0B1628 55%, #0E1A30 100%)" }}
    >
      {/* Ambient glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[200px]"
        style={{ background: "radial-gradient(ellipse, rgba(217,119,6,0.10) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[700px] rounded-full blur-[180px]"
        style={{ background: "radial-gradient(ellipse, rgba(48,110,236,0.07) 0%, transparent 70%)" }}
      />

      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.webp"
          alt="Long Island home renovation"
          fill
          className="object-cover object-center"
          style={{ opacity: 0.12 }}
          priority
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(7,16,31,0.55) 0%, rgba(7,16,31,0.4) 50%, rgba(7,16,31,0.97) 100%)" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[820px] px-5 text-center py-20">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.05] px-5 py-2 backdrop-blur-sm mb-8">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FCD34D]" style={{ boxShadow: "0 0 8px rgba(252,211,77,0.9)" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">
            Long Island Home Improvement · Licensed &amp; Insured
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[52px] sm:text-[72px] lg:text-[88px] font-black leading-[0.9] tracking-[-0.04em] text-white mb-6">
          Transform your
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #FCD34D 0%, #F59E0B 40%, #E8900A 100%)" }}
          >
            home completely.
          </span>
        </h1>

        {/* Sub */}
        <p className="text-[17px] sm:text-[20px] font-medium leading-[1.6] text-white/50 max-w-[580px] mx-auto mb-10">
          Roofing, bathroom, and kitchen remodeling done right —
          licensed, insured, and backed by 9+ years on Long Island.
        </p>

        {/* Service chips */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {SERVICES_PREVIEW.map(({ label, accent }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2"
              style={{ borderColor: `${accent}35`, background: `${accent}10` }}
            >
              <span className="text-[12px] font-bold text-white/70">{label}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/estimate"
            className="inline-flex items-center justify-center gap-2.5 min-h-[56px] px-9 rounded-[16px] text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #E8900A 0%, #B45309 100%)", boxShadow: "0 12px 36px rgba(232,144,10,0.30)" }}
          >
            Get Free Estimate
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <a
            href="tel:+16315991363"
            className="inline-flex items-center justify-center gap-2.5 min-h-[56px] px-9 rounded-[16px] text-[15px] font-semibold text-white/80 border border-white/12 bg-white/[0.05] hover:bg-white/[0.09] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            631-599-1363
          </a>
        </div>

        {/* Trust chips */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 mt-10">
          {TRUST_CHIPS.map((label) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[12px] font-semibold text-white/45">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/20">Our services</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/20 animate-bounce" aria-hidden="true">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}

// ── Membership cross-sell strip ───────────────────────────────────────────────

function MembershipCrossSell() {
  return (
    <section
      className="relative w-full overflow-hidden py-14 sm:py-16"
      style={{ background: "linear-gradient(160deg, #04101A 0%, #061525 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(48,110,236,0.09), transparent)" }}
      />
      <div className="relative mx-auto max-w-[900px] px-5 sm:px-8 flex flex-col sm:flex-row items-center gap-7 sm:gap-12">
        <div className="flex-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#306EEC]/25 bg-[#306EEC]/08 px-3.5 py-1.5 mb-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#93C5FD]/75">
              After Your Project
            </span>
          </div>
          <h3 className="text-[22px] sm:text-[26px] font-extrabold text-white leading-[1.15] tracking-[-0.02em] mb-2">
            Protect your home year-round
            <br />with a handyman membership.
          </h3>
          <p className="text-[14px] text-white/45 leading-relaxed">
            Members get priority scheduling, a dedicated team who knows your home, and <span className="text-white/65 font-semibold">10% off projects like this one</span> — an exclusive benefit of every plan.
          </p>
        </div>
        <div className="flex flex-col gap-3 flex-shrink-0 w-full sm:w-auto">
          <Link
            href="/membership"
            className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 rounded-[14px] text-[14px] font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #306EEC 0%, #1D4ED8 100%)", boxShadow: "0 10px 32px rgba(48,110,236,0.28)" }}
          >
            See Membership Plans
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            href="/included"
            className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-white/40 hover:text-white/65 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            See what's included →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {

  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Admin shortcut
  useEffect(() => {
    if (isLoading) return;
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      router.replace("/admin?tab=bookings");
    }
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main className="relative">
        <ProjectsHero />
        <RoofingSection />
        <RemodelingSection />
        <ProjectsSection />
        <TrustSection />
        <MembershipCrossSell />
        <FinalCTASection />
        <Footer />
      </main>

      <ChatWidget />
    </div>
  );
}
