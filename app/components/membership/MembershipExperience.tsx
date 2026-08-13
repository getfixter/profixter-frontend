"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath } from "@/lib/auth-routing";
import { getNextBooking } from "@/lib/booking-service";
import { trackEvent } from "@/lib/analytics";

/** Which non-member flow to render on /membership. */
type IntroState = "loading" | "eligible" | "consumed" | "ineligible";

import Header from "@/app/components/sections/Header";
import BookingSection from "@/app/components/sections/BookingSection";
import PlansSection from "@/app/components/sections/PlansSection";
import FAQSection from "@/app/components/sections/FAQSection";
import YourFixter from "@/app/components/fixter/YourFixter";
import Footer from "@/app/components/sections/Footer";
import StickyMobileCTA from "@/app/components/StickyMobileCTA";
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
    <section id={id} className="bg-[#F6F8FC] px-4 py-10 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        {(title || subtitle) && (
          <div className="mb-5 sm:mb-6">
            {title && (
              <h2 className="text-[21px] font-black leading-tight text-[#0B1628] sm:text-[26px]">
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
      {/*
        Booking lives under Book now. This dashboard keeps the things a member
        comes here for - their visits, their plan, their Fixter - and points at
        the one place booking happens rather than embedding a second entrance
        to it.
      */}
      <section className="bg-white px-4 pb-6 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[560px]">
            <h1 className="text-[26px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#111111] sm:text-[32px]">
              Your membership
            </h1>
            <p className="mt-3 text-[15px] leading-6 text-[#6E6E73] sm:text-[17px]">
              Your visits, your plan, and your Fixter. Ready when you need something done.
            </p>
          </div>
          <Link
            href="/book?visit=membership"
            className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[14px] bg-[#0B1628] px-5 text-[15px] font-semibold text-white transition hover:bg-[#172033] lg:w-auto"
          >
            Book your next visit
          </Link>
        </div>
      </section>

      <section className="bg-[#F6F8FC] px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <Link
            href="/membership/plans"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[#D7DEE9] bg-white px-4 text-[13px] font-bold text-[#306EEC] transition hover:border-[#306EEC] hover:bg-[#F8FAFF]"
          >
            See plans
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/*
        The Fixter sits directly under booking: the member has just seen how to
        get a visit, and this answers "and who is actually coming to my home".
        Constrained rather than full-bleed - it is a person, not a dashboard panel.
      */}
      <section className="bg-[#F6F8FC] px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1180px]">
          <YourFixter className="max-w-[560px]" />
        </div>
      </section>

      {/*
        Visits moved to Book, which is where a member goes to think about them.
        Two full visit centres meant two places to check and two places to keep
        working. Membership keeps the plan; Book keeps the visits.
       */}

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

/**
 * First Visit Free acquisition flow.
 *
 * Reuses the existing BookingSection/calendar rather than introducing a second
 * booking system. Only rendered for authenticated non-members whose property is
 * eligible; members never reach this branch.
 */
function FreeVisitFlow() {
  return (
    <>
      <section className="bg-white px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-10">
        <div className="mx-auto max-w-[820px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
            Profixter
          </p>
          <h1 className="mx-auto mt-3 max-w-[720px] text-[30px] font-semibold leading-[1.06] tracking-[-0.04em] text-[#111111] sm:text-[36px] lg:text-[43px]">
            Your first visit is free.
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-6 text-[#6E6E73] sm:text-[17px] sm:leading-7">
            Pick a day, tell us what needs doing, and our team will take care of it.
            Nothing to pay, and no membership required.
          </p>
          <p className="mx-auto mt-5 max-w-[600px] text-[12px] leading-5 text-[#86868B] sm:text-[13px]">
            90 minutes of handyman labor &middot; No card required &middot; One per home &middot; Subject to availability
          </p>
        </div>
      </section>

      <BookingSection />

      <section className="bg-[#F5F5F7] px-4 py-10 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-[680px] text-center">
          <h2 className="text-[21px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[26px]">
            After your visit
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-[#6E6E73] sm:text-[15px]">
            Most homes have more than one thing on the list. If you&rsquo;d like the same
            team to keep handling it, membership is there when you&rsquo;re ready.
            No obligation either way.
          </p>
          <Link
            href="/membership/plans"
            className="mt-5 inline-flex text-[14px] font-semibold text-[#306EEC] hover:underline"
          >
            See plans
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}

/**
 * Shown to a non-member whose introductory visit has been completed.
 * Replaces the previous dead-end "no active membership" state.
 */
function PostFreeVisitFlow() {
  return (
    <section className="bg-white px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-10">
      <div className="mx-auto max-w-[720px] text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
          Profixter
        </p>
        <h1 className="mx-auto mt-3 max-w-[620px] text-[26px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#111111] sm:text-[34px]">
          Your first visit is complete.
        </h1>
        <p className="mx-auto mt-4 max-w-[540px] text-[15px] leading-6 text-[#6E6E73] sm:text-[17px] sm:leading-7">
          Keep the same team for the rest of your list with a Profixter membership.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 min-[380px]:flex-row">
          <a
            href="#plans"
            onClick={() =>
              trackEvent("membership_plans_viewed_after_free_visit", {
                placement: "post_free_visit_state",
              })
            }
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558C9]"
          >
            See plans
          </a>
          <Link
            href="/book?visit=additional"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-5 text-[15px] font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
          >
            Book a One-Time Visit
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProspectMembershipFlow({
  postFreeVisit = false,
  showFreeVisitOffer = false,
}: { postFreeVisit?: boolean; showFreeVisitOffer?: boolean } = {}) {
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
    ["How often can I book?", "There is no fixed monthly visit count for standard member bookings. Basic keeps one visit on the calendar at a time; the other plans allow two. Book the next as soon as one is done."],
    ["Are materials included?", "Plus and Premium include basic materials. For other materials, tell us what the task needs when you book so the team can prepare."],
    ["Can I change my plan?", "Yes. You can adjust your plan as your home's needs change."],
    ["What if I need a larger project?", "Use Project Estimates for renovations, multi-day work, or tasks that need a larger scope."],
  ];

  return (
    <>
      {postFreeVisit && <PostFreeVisitFlow />}

      <section className={`bg-white px-4 sm:px-6 ${postFreeVisit ? "pb-8 pt-2 sm:pb-11 sm:pt-4" : "pb-8 pt-8 sm:pb-11 sm:pt-11 lg:pb-20 lg:pt-20"}`}>
        <div className="mx-auto max-w-[860px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">Profixter Membership</p>
          <h1 className="mx-auto mt-4 max-w-[820px] text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] text-[#111111] sm:text-[40px] lg:text-[46px]">
            One trusted team for the home list that never ends.
          </h1>
          <p className="mx-auto mt-5 max-w-[660px] text-[16px] leading-6 text-[#6E6E73] sm:text-[18px] sm:leading-7">
            Book small repairs, maintenance, and installations when you need them, without searching for a new contractor every time.
          </p>
          <p className="mt-3 text-[13px] font-medium text-[#86868B]">Ongoing handyman care for Long Island homes.</p>

          {showFreeVisitOffer ? (
            <div className="mx-auto mt-7 max-w-[520px] rounded-[13px] border border-[#E5E5EA] bg-[#F5F5F7] px-5 py-5">
              <p className="text-[19px] font-semibold tracking-[-0.02em] text-[#111111] sm:text-[19px]">
                Your first visit is free.
              </p>
              <p className="mt-1.5 text-[13px] leading-5 text-[#6E6E73] sm:text-[14px]">
                90-minute first visit · No card required · One per home
              </p>
              <Link
                href="/signup?redirect=%2Fmembership"
                onClick={() => trackEvent("free_visit_cta_clicked", { placement: "membership_hero" })}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558C9] sm:w-auto"
              >
                Book Your First Visit Free
              </Link>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col justify-center gap-3 min-[380px]:flex-row">
            <a href="#plans" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-5 text-[15px] font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7]">
              See plans
            </a>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-5 text-[15px] font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7]">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-[100px] bg-[#F5F5F7] px-4 py-8 sm:px-6 sm:py-11">
        <div className="mx-auto max-w-[1040px]">
          <div className="text-center">
            <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[32px]">How membership works</h2>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {steps.map(([title, body], index) => (
              <article key={title} className="rounded-[14px] border border-[#E5E5EA] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[13px] font-bold text-[#306EEC]">{index + 1}</span>
                <h3 className="mt-4 text-[18px] font-semibold text-[#111111]">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-5 text-[#6E6E73]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-8 sm:px-6 sm:py-11">
        <div className="mx-auto max-w-[920px]">
          <div className="text-center">
            <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[32px]">Built for everyday home tasks</h2>
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

      <section className="bg-white px-4 py-8 sm:px-6 sm:py-11">
        <div className="mx-auto max-w-[760px]">
          <h2 className="text-center text-[26px] font-semibold tracking-[-0.025em] text-[#111111] sm:text-[32px]">Membership questions</h2>
          <div className="mt-7 divide-y divide-[#E5E5EA] border-y border-[#E5E5EA]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-[#111111] marker:content-none">
                  {question}<span className="text-[19px] font-normal text-[#86868B] transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="max-w-[680px] pr-8 pt-2 text-[14px] leading-5 text-[#6E6E73]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F5F5F7] px-4 py-9 text-center sm:px-6 sm:py-13">
        <div className="mx-auto max-w-[680px]">
          <h2 className="text-[26px] font-semibold tracking-[-0.03em] text-[#111111] sm:text-[34px]">Ready to make home care easier?</h2>
          <p className="mt-3 text-[15px] leading-6 text-[#6E6E73]">Choose your membership and book your first visit when you&rsquo;re ready.</p>
          <a href="#plans" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558C9]">See plans</a>
          <div className="mt-4">
            <Link href="/book?visit=additional" className="text-[14px] font-semibold text-[#306EEC] hover:underline">Need only one visit? Book an Extra Visit</Link>
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

  // Acquisition state for the default property. Drives which non-member flow
  // renders. Members never trigger this fetch.
  const [introState, setIntroState] = useState<IntroState>("loading");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (isLoading) return;
      if (!isAuthenticated || isSubscribed) {
        if (!cancelled) setIntroState("ineligible");
        return;
      }

      const addressId =
        (user as { defaultAddressId?: string | null })?.defaultAddressId ||
        user?.addresses?.[0]?._id;

      if (!addressId) {
        if (!cancelled) setIntroState("ineligible");
        return;
      }

      try {
        const data = await getNextBooking(String(addressId));
        if (cancelled) return;
        if (data?.freeFirstVisitAvailable) setIntroState("eligible");
        else if (data?.introVisitStatus === "consumed") setIntroState("consumed");
        else setIntroState("ineligible");
      } catch {
        // Fail closed: show the normal membership page rather than promising
        // an offer we could not confirm.
        if (!cancelled) setIntroState("ineligible");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, isSubscribed, user]);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      const landingPath = getRoleLandingPath(user);
      if (landingPath !== "/account") {
        router.replace(landingPath);
      }
    }
  }, [isLoading, user, router]);

  /*
   * An active member has nothing left to do on this page.
   *
   * It used to be their dashboard, but every part of it has since moved to a
   * better home: visits and the booking form to Book, the Fixter to Book and
   * Account, plan management to Account, plan comparison to /membership/plans.
   * What remained was a 5,000px page whose sections linked out to the pages
   * that had replaced them, and which greeted a paying customer with a FAQ
   * headed "Questions before you become a Member".
   *
   * Only the member branch is retired. For a visitor this is still the
   * membership sales page, and for a registered non-member it is still the
   * Free First Visit booking flow, so neither is touched.
   *
   * The plan parameters are the exception. A signup that started from a plan
   * card comes back here as /membership?plan=...&billingCycle=... to resume
   * checkout, and someone can be subscribed by the time that resolves. Sending
   * them away mid-flow would strand the purchase, so a URL carrying plan intent
   * is always allowed through.
   */
  useEffect(() => {
    if (isLoading || !isSubscribed) return;
    const resumingCheckout = new URLSearchParams(window.location.search).has("plan");
    if (resumingCheckout) return;
    router.replace("/account");
  }, [isLoading, isSubscribed, router]);

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
        {/* Member experience - unchanged. */}
        {isSubscribed && (
          <SubscribedCustomerFlow />
        )}

        {/* Non-member: wait for eligibility before choosing a branch so the
            page does not flash the wrong flow. */}
        {isAuthenticated && !isSubscribed && introState === "loading" && (
          <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-[#306EEC] border-t-transparent" />
              <p className="text-sm font-semibold text-[#6E6E73]">Checking your home&hellip;</p>
            </div>
          </div>
        )}

        {isAuthenticated && !isSubscribed && introState === "eligible" && (
          <FreeVisitFlow />
        )}

        {isAuthenticated && !isSubscribed && introState === "consumed" && (
          <ProspectMembershipFlow postFreeVisit />
        )}

        {isAuthenticated && !isSubscribed && introState === "ineligible" && (
          <ProspectMembershipFlow />
        )}

        {!isAuthenticated && (
          <ProspectMembershipFlow showFreeVisitOffer />
        )}
      </main>

      {!isSubscribed && introState !== "eligible" && <StickyMobileCTA />}
    </div>
  );
}
