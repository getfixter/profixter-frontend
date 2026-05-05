"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import Header from "@/app/components/sections/Header";
import HeroSection from "@/app/components/sections/HeroSection";
import BookingSection from "@/app/components/sections/BookingSection";
import PlansSection from "@/app/components/sections/PlansSection";
import HowItWorksSection from "@/app/components/sections/HowItWorksSection";
import OnboardingSection from "@/app/components/sections/OnboardingSection";
import RealLifeSection from "@/app/components/sections/RealLifeSection";
import CategorySection from "@/app/components/sections/CategorySection";
import MembershipClaritySection from "@/app/components/sections/MembershipClaritySection";
import PopularTasksSection from "@/app/components/sections/PopularTasksSection";
import HandymenSection from "@/app/components/sections/HandymenSection";
import TrustSection from "@/app/components/sections/TrustSection";
import FAQSection from "@/app/components/sections/FAQSection";
import FinalCTASection from "@/app/components/sections/FinalCTASection";
import Footer from "@/app/components/sections/Footer";
import { ChatWidget } from "@/app/components/ChatWidget";
import StickyMobileCTA from "@/app/components/StickyMobileCTA";
import ReferralSection from "@/app/components/sections/ReferralSection";

const ADMIN_EMAIL = "getfixter@gmail.com";

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
            <ReferralSection />
            <PopularTasksSection />
            <HandymenSection />
            <FAQSection />

            <FinalCTASection />
            <Footer />
          </>
        )}

        {/* ── Registered but not subscribed: push to upgrade ── */}
        {isAuthenticated && !isSubscribed && (
          <>
            <PlansSection />
            <HowItWorksSection />
            <OnboardingSection />
            <RealLifeSection />
            <CategorySection />
            <MembershipClaritySection />
            <TrustSection />
            <PopularTasksSection />
            <HandymenSection />
            <ReferralSection />
            <FAQSection />

            <FinalCTASection />
            <Footer />
          </>
        )}

        {/* ── Visitors: full discovery flow ── */}
        {!isAuthenticated && (
          <>
            <PlansSection />
            <HowItWorksSection />
            <OnboardingSection />
            <RealLifeSection />
            <CategorySection />
            <MembershipClaritySection />
            <TrustSection />
            <PopularTasksSection />
            <HandymenSection />
            <FAQSection />

            <FinalCTASection />
            <Footer />
          </>
        )}
      </main>

      {/* Sticky mobile CTA — shows after hero scrolls out of view */}
      {!isSubscribed && <StickyMobileCTA />}

      <ChatWidget />
    </div>
  );
}
