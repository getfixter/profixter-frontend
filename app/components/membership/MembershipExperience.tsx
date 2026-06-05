"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import Header from "@/app/components/sections/Header";
import HeroSection from "@/app/components/sections/HeroSection";
import BookingSection from "@/app/components/sections/BookingSection";
import PlansSection from "@/app/components/sections/PlansSection";
import HowItWorksSection from "@/app/components/sections/HowItWorksSection";
import PopularTasksSection from "@/app/components/sections/PopularTasksSection";
import IncludedVisitsSection from "@/app/components/sections/IncludedVisitsSection";
import TrustSection from "@/app/components/sections/TrustSection";
import FAQSection from "@/app/components/sections/FAQSection";
import Footer from "@/app/components/sections/Footer";
import { ChatWidget } from "@/app/components/ChatWidget";
import StickyMobileCTA from "@/app/components/StickyMobileCTA";
import ReferralSection from "@/app/components/sections/ReferralSection";

const ADMIN_EMAIL = "getfixter@gmail.com";

export default function MembershipExperience() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

  useEffect(() => {
    if (isLoading) return;
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      router.replace("/admin?tab=bookings");
    }
  }, [isLoading, user, router]);

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

        {isSubscribed && (
          <>
            <BookingSection />
            <PopularTasksSection />
            <IncludedVisitsSection />
            <PlansSection />
            <TrustSection />
            <ReferralSection />
            <FAQSection />
            <Footer />
          </>
        )}

        {isAuthenticated && !isSubscribed && (
          <>
            <PopularTasksSection />
            <IncludedVisitsSection />
            <PlansSection />
            <TrustSection />
            <FAQSection />
            <Footer />
          </>
        )}

        {!isAuthenticated && (
          <>
            <HowItWorksSection />
            <PopularTasksSection />
            <IncludedVisitsSection />
            <PlansSection />
            <TrustSection />
            <FAQSection />
            <Footer />
          </>
        )}
      </main>

      {!isSubscribed && <StickyMobileCTA />}

      <ChatWidget />
    </div>
  );
}
