"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import Image from "next/image";

import Header from "@/app/components/sections/Header";
import HeroSection from "@/app/components/sections/HeroSection";
import BookingSection from "@/app/components/sections/BookingSection";
import PlansSection from "@/app/components/sections/PlansSection";
import HowItWorksSection from "@/app/components/sections/HowItWorksSection";
import PopularTasksSection from "@/app/components/sections/PopularTasksSection";
import HandymenSection from "@/app/components/sections/HandymenSection";
import TrustSection from "@/app/components/sections/TrustSection";
import FAQSection from "@/app/components/sections/FAQSection";
import FinalCTASection from "@/app/components/sections/FinalCTASection";
import Footer from "@/app/components/sections/Footer";
import { ChatWidget } from "@/app/components/ChatWidget";

const ADMIN_EMAIL = "getfixter@gmail.com";

// ── Cross-sell strip: subtle project upgrade CTA ─────────────────────────────

function ProjectsCrossSell() {
  return (
    <section
      className="relative w-full overflow-hidden py-14 sm:py-16"
      style={{ background: "linear-gradient(160deg, #1A0E04 0%, #160A02 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(217,119,6,0.10), transparent)" }}
      />
      <div className="relative mx-auto max-w-[900px] px-5 sm:px-8 flex flex-col sm:flex-row items-center gap-7 sm:gap-12">
        <div className="flex-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D97706]/25 bg-[#D97706]/08 px-3.5 py-1.5 mb-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FCD34D]/75">
              Ready to Transform a Room?
            </span>
          </div>
          <h3 className="text-[22px] sm:text-[26px] font-extrabold text-white leading-[1.15] tracking-[-0.02em] mb-2">
            Members save 10% on major
            <br />home improvement projects.
          </h3>
          <p className="text-[14px] text-white/45 leading-relaxed">
            As an active member, you receive 10% off roofing, bathroom remodeling, and kitchen renovation — an exclusive benefit that comes with every plan.
          </p>
        </div>
        <div className="flex flex-col gap-3 flex-shrink-0 w-full sm:w-auto">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center gap-2.5 min-h-[52px] px-8 rounded-[14px] text-[14px] font-extrabold text-white transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 10px 32px rgba(217,119,6,0.28)" }}
          >
            Explore Home Improvement
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            href="/estimate"
            className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-white/40 hover:text-white/65 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 9h8M8 13h6M8 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Get a free project estimate →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MembershipPage() {

  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

  // Admin shortcut
  useEffect(() => {
    if (isLoading) return;
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      router.replace("/admin?tab=bookings");
    }
  }, [isLoading, user, router]);

  // Clear post-login flag
  useEffect(() => {
    const justLoggedIn = sessionStorage.getItem("justLoggedIn");
    if (justLoggedIn) {
      sessionStorage.removeItem("justLoggedIn");
      window.location.reload();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main className="relative">
        <HeroSection />

        {/* ── Subscribed members: booking first ── */}
        {isSubscribed && (
          <>
            <BookingSection />
            <PlansSection />
            <TrustSection />
            <PopularTasksSection />
            <HandymenSection />
            <FAQSection />
            <ProjectsCrossSell />
            <FinalCTASection />
            <Footer />
          </>
        )}

        {/* ── Registered but not subscribed: push to upgrade ── */}
        {isAuthenticated && !isSubscribed && (
          <>
            <PlansSection />
            <HowItWorksSection />
            <TrustSection />
            <PopularTasksSection />
            <HandymenSection />
            <FAQSection />
            <ProjectsCrossSell />
            <FinalCTASection />
            <Footer />
          </>
        )}

        {/* ── Visitors: full discovery flow ── */}
        {!isAuthenticated && (
          <>
            <PlansSection />
            <HowItWorksSection />
            <TrustSection />
            <PopularTasksSection />
            <HandymenSection />
            <FAQSection />
            <ProjectsCrossSell />
            <FinalCTASection />
            <Footer />
          </>
        )}
      </main>

      <ChatWidget />
    </div>
  );
}
