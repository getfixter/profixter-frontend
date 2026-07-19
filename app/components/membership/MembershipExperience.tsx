"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath } from "@/lib/auth-routing";

import Header from "@/app/components/sections/Header";
import BookingSection from "@/app/components/sections/BookingSection";
import PlansSection from "@/app/components/sections/PlansSection";
import FAQSection from "@/app/components/sections/FAQSection";
import Footer from "@/app/components/sections/Footer";
import StickyMobileCTA from "@/app/components/StickyMobileCTA";
import BookingsSection from "@/app/components/account/BookingsSection";
import { PlanSection } from "@/app/components/account/PlanSection";

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

      <section className="bg-[#F6F8FC] px-4 pb-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <Link
            href="/membership-info"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[#D7DEE9] bg-white px-4 text-[13px] font-bold text-[#306EEC] transition hover:border-[#306EEC] hover:bg-[#F8FAFF]"
          >
            View membership details
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      <CustomerPortalSection id="my-visits">
        <BookingsSection />
      </CustomerPortalSection>

      <CustomerPortalSection
        id="my-plan"
        title="Manage Plan"
        subtitle="Review your membership, billing status, and plan settings."
      >
        <PlanSection hideCancellationUi />
      </CustomerPortalSection>

      <CustomerPortalSection
        id="account-settings"
        title="Profile and Account"
        subtitle="Manage your saved addresses, contact details, and security settings."
      >
        <AccountShortcuts />
      </CustomerPortalSection>

      <FAQSection hideCancellationUi />
      <Footer />
    </>
  );
}

function ProspectMembershipFlow() {
  const steps = [
    ["Choose a plan", "Pick the level of home support that fits your needs."],
    ["Book when needed", "Choose a date, add notes and photos, and request your visit."],
    ["We handle the list", "Your Profixter team comes prepared and keeps your home moving."],
  ];
  const tasks = [
    "Small electrical work",
    "Minor plumbing",
    "Mounting and installations",
    "Drywall and patching",
    "Doors, locks, and hardware",
    "Caulking and touch-ups",
    "Furniture assembly",
    "General home maintenance",
  ];
  const faqs = [
    ["What kinds of jobs are included?", "Membership covers everyday handyman repairs, maintenance, and installations. Larger or multi-day work is quoted separately as a Project Estimate."],
    ["How long is each visit?", "Standard membership visits are up to 90 minutes. Elite also includes one full project day each month."],
    ["How often can I book?", "You can request visits as needed. Your plan determines how many appointments can be active at one time and whether Rush Visits are included."],
    ["Are materials included?", "Plus and Premium include basic materials. For other materials, tell us what the task needs when you book so the team can prepare."],
    ["Can I change my plan?", "Yes. You can adjust your plan as your home's needs change."],
    ["What if I need a larger project?", "Use Project Estimates for renovations, multi-day work, or tasks that need a larger scope."],
  ];

  return (
    <>
      <section className="bg-white px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-[860px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">Profixter Membership</p>
          <h1 className="mx-auto mt-4 max-w-[820px] text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] text-[#111111] sm:text-[54px] lg:text-[64px]">
            One trusted team for the home list that never ends.
          </h1>
          <p className="mx-auto mt-5 max-w-[660px] text-[16px] leading-6 text-[#6E6E73] sm:text-[18px] sm:leading-7">
            Book small repairs, maintenance, and installations when you need them&mdash;without searching for a new contractor every time.
          </p>
          <p className="mt-3 text-[13px] font-medium text-[#86868B]">Ongoing handyman care for Long Island homes.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 min-[380px]:flex-row">
            <a href="#plans" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#306EEC] px-7 text-[15px] font-semibold text-white transition hover:bg-[#2558C9]">
              Choose a Plan
            </a>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-7 text-[15px] font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7]">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-[100px] bg-[#F5F5F7] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1040px]">
          <div className="text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[38px]">How membership works</h2>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {steps.map(([title, body], index) => (
              <article key={title} className="rounded-[20px] border border-[#E5E5EA] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[13px] font-bold text-[#306EEC]">{index + 1}</span>
                <h3 className="mt-4 text-[18px] font-semibold text-[#111111]">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-5 text-[#6E6E73]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[920px]">
          <div className="text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[38px]">Built for everyday home tasks</h2>
          </div>
          <ul className="mt-7 grid grid-cols-1 gap-x-8 gap-y-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
            {tasks.map((task) => (
              <li key={task} className="flex items-start gap-2.5 text-[14px] leading-5 text-[#1D1D1F]">
                <svg className="mt-0.5 shrink-0 text-[#306EEC]" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {task}
              </li>
            ))}
          </ul>
          <p className="mt-7 text-center text-[13px] leading-5 text-[#6E6E73]">
            Larger renovations and multi-day work are handled through Project Estimates. <Link href="/services" className="font-semibold text-[#306EEC] hover:underline">View all services</Link>
          </p>
        </div>
      </section>

      <PlansSection hideCancellationUi compact />

      <section className="bg-white px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[760px]">
          <h2 className="text-center text-[28px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[38px]">Membership questions</h2>
          <div className="mt-7 divide-y divide-[#E5E5EA] border-y border-[#E5E5EA]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-[#111111] marker:content-none">
                  {question}<span className="text-[20px] font-normal text-[#86868B] transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="max-w-[680px] pr-8 pt-2 text-[14px] leading-5 text-[#6E6E73]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F5F5F7] px-4 py-14 text-center sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[680px]">
          <h2 className="text-[30px] font-semibold tracking-[-0.03em] text-[#111111] sm:text-[42px]">Ready to make home care easier?</h2>
          <p className="mt-3 text-[15px] leading-6 text-[#6E6E73]">Choose your membership and book your first visit when you&rsquo;re ready.</p>
          <a href="#plans" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#306EEC] px-7 text-[15px] font-semibold text-white transition hover:bg-[#2558C9]">Choose a Plan</a>
          <div className="mt-4">
            <Link href="/book" className="text-[14px] font-semibold text-[#306EEC] hover:underline">Need only one visit? Book an Extra Visit</Link>
          </div>
        </div>
      </section>
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
    if (user) {
      const landingPath = getRoleLandingPath(user);
      if (landingPath !== "/account") {
        router.replace(landingPath);
      }
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
        {isSubscribed && (
          <SubscribedCustomerFlow />
        )}

        {isAuthenticated && !isSubscribed && (
          <ProspectMembershipFlow />
        )}

        {!isAuthenticated && (
          <ProspectMembershipFlow />
        )}
      </main>

      {!isSubscribed && <StickyMobileCTA />}
    </div>
  );
}
