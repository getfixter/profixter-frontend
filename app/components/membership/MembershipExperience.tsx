"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
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
import BookingsSection from "@/app/components/account/BookingsSection";
import CustomerMobileNav from "@/app/components/account/CustomerMobileNav";
import { PlanSection } from "@/app/components/account/PlanSection";

const ADMIN_EMAIL = "getfixter@gmail.com";

function CustomerPortalSection({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="bg-[#F6F8FC] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        {(title || subtitle) && (
          <div className="mb-5 sm:mb-6">
            {title && (
              <h2 className="text-[22px] font-black leading-tight text-[#0B1628] sm:text-[28px]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-[#64748B] sm:text-[15px]">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function AccountShortcuts() {
  const links = [
    {
      href: "/account?tab=personal",
      title: "Profile and Addresses",
      body: "Update saved homes, choose your default address, and review contact details.",
    },
    {
      href: "/account?tab=password",
      title: "Account Security",
      body: "Change your password or manage account access.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-[14px] border border-[#D7DEE9] bg-white p-5 transition hover:border-[#306EEC] hover:bg-[#F8FAFF]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[15px] font-extrabold text-[#0B1628]">{link.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748B]">{link.body}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#D9E4FF] bg-[#EEF5FF] text-[#306EEC]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SubscribedCustomerFlow() {
  return (
    <>
      <BookingSection />

      <CustomerPortalSection id="my-visits">
        <BookingsSection />
      </CustomerPortalSection>

      <CustomerPortalSection
        id="my-plan"
        title="Manage Plan"
        subtitle="Review your membership, billing status, and plan settings."
      >
        <PlanSection />
      </CustomerPortalSection>

      <CustomerPortalSection
        id="account-settings"
        title="Profile and Account"
        subtitle="Manage your saved addresses, contact details, and security settings."
      >
        <AccountShortcuts />
      </CustomerPortalSection>

      <FAQSection />
      <Footer />
    </>
  );
}

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
    <div
      className={`min-h-screen bg-background overflow-x-hidden ${
        isSubscribed ? "pb-[calc(86px+env(safe-area-inset-bottom,0px))] lg:pb-0" : ""
      }`}
    >
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main className="relative">
        {!isSubscribed && <HeroSection />}

        {isSubscribed && (
          <SubscribedCustomerFlow />
        )}

        {isAuthenticated && !isSubscribed && (
          <>
          <BookingSection />
            <PopularTasksSection />
            <IncludedVisitsSection />
            <PlansSection />
            <TrustSection />
            <FAQSection />
            <Footer />
          </>
        )}

        {!isAuthenticated && (
          <><BookingSection />
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
      {isSubscribed && <CustomerMobileNav />}

      {!isSubscribed && <ChatWidget />}
    </div>
  );
}
