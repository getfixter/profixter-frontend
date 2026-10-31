"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath } from "@/lib/auth-routing";
import { useFreeVisitEligibility } from "@/lib/free-visit";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { trackEvent } from "@/lib/analytics";

import Header from "@/app/components/sections/Header";
import BookingSection from "@/app/components/sections/BookingSection";
import { plans } from "@/app/data/content";
import FAQSection from "@/app/components/sections/FAQSection";
import YourFixter from "@/app/components/fixter/YourFixter";
import Footer from "@/app/components/sections/Footer";
import StickyMobileCTA from "@/app/components/StickyMobileCTA";
import Reveal from "@/app/components/ui/Reveal";
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
    <section id={id} className="ui-section ui-section--soft ui-section--tight">
      <div className="ui-container">
        {(title || subtitle) && (
          <div className="ui-head">
            {title && <h2 className="ui-h2">{title}</h2>}
            {subtitle && (
              <p className="ui-lede">
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
          className="ui-card ui-card--link"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="pg-card__title !text-[16px]">{link.title}</div>
              <p className="pg-card__meta">{link.body}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[color:var(--ui-text-3)]">
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
      <section className="ui-section ui-section--tight">
        <div className="ui-container flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="pg-intro">
            <h1 className="ui-display">Your membership</h1>
            <p className="ui-lede">
              Your visits, your plan, and your Fixter. Ready when you need something done.
            </p>
          </div>
          <Link
            href="/book?visit=membership"
            className="ui-btn ui-btn--primary w-full lg:w-auto"
          >
            Book your next visit
          </Link>
        </div>
      </section>

      <section className="bg-[color:var(--ui-bg-soft)] pt-6">
        <div className="ui-container">
          <Link href="/membership/plans" className="ui-link">
            See plans
          </Link>
        </div>
      </section>

      {/*
        The Fixter sits directly under booking: the member has just seen how to
        get a visit, and this answers "and who is actually coming to my home".
        Constrained rather than full-bleed - it is a person, not a dashboard panel.
      */}
      <section className="bg-[color:var(--ui-bg-soft)] pb-6 pt-4">
        <div className="ui-container">
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
    <div className="pg-flow bg-[color:var(--ui-bg-soft)]">
      <section className="ui-container pt-8 sm:pt-12">
        <div className="pg-intro">
          <p className="ui-tag ui-tag--accent">
            <span className="ui-tag__dot" aria-hidden="true" />
            Free Visit
          </p>
          <h1 className="ui-display mt-3">Let&rsquo;s take a look at your to-do list.</h1>
          <p className="ui-lede">Pick a day and we&rsquo;ll visit your home, go over your list and help you find the right Profixter service. Repairs and labor aren&rsquo;t part of the Free Visit.</p>
          <ul className="pg-facts mt-3">
            <li>Free, in person</li>
            <li>No card required</li>
            <li>One per customer</li>
            <li>Subject to availability</li>
          </ul>
        </div>
      </section>

      <BookingSection />

      <section className="ui-section ui-section--tight bg-white">
        <div className="ui-container ui-container--narrow text-center">
          <h2 className="ui-h3">After your visit</h2>
          <p className="ui-body mx-auto mt-2 max-w-[52ch]">
            If you&rsquo;d like the same team to keep handling your list, membership is
            there when you&rsquo;re ready. No obligation either way.
          </p>
          <Link href="/membership/plans" className="ui-link mt-2">
            See plans
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/**
 * Shown to a non-member whose introductory visit has been completed.
 * Replaces the previous dead-end "no active membership" state.
 */
/** The entry price, read from the plan data rather than typed here. */
const startingPrice = Math.min(...plans.map((plan) => plan.price));

function PostFreeVisitFlow() {
  return (
    <section className="ui-section ui-section--tight">
      <div className="ui-container pg-intro">
        <p className="ui-eyebrow ui-eyebrow--accent">Profixter</p>
        <h1 className="ui-display">Your first visit is complete.</h1>
        <p className="ui-lede">Keep the same team for the rest of your list with a Profixter membership.</p>
        <div className="pg-actions pg-actions--stack">
          <Link
            href="/membership/plans"
            onClick={() =>
              trackEvent("membership_plans_viewed_after_free_visit", {
                placement: "post_free_visit_state",
              })
            }
            className="ui-btn ui-btn--primary"
          >
            Compare plans
          </Link>
          <Link href="/book?visit=additional" className="ui-btn ui-btn--secondary">
            Book a One-Time Visit
          </Link>
        </div>
      </div>
    </section>
  );
}

/* Generic Profixter Library examples (public/images/booking-library), decorative. */
const HERO_TILES = [
  { src: "/images/booking-library/tv_mounting@2x.webp" },
  { src: "/images/booking-library/light_fixture@2x.webp" },
  { src: "/images/booking-library/faucet@2x.webp" },
  { src: "/images/booking-library/shelves@2x.webp" },
];

function ProspectMembershipFlow({
  postFreeVisit = false,
  showFreeVisitOffer = false,
  onAddHome,
}: {
  postFreeVisit?: boolean;
  showFreeVisitOffer?: boolean;
  /** Signed in without a home: the offer's step is adding one, not booking. */
  onAddHome?: () => void;
} = {}) {
  const steps = [
    ["Choose a plan", "The level of home support that fits."],
    ["Book when needed", "A date, notes and photos. That's the request."],
    ["We handle the list", "Your team comes prepared, visit after visit."],
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

  return (
    <>
      {postFreeVisit && <PostFreeVisitFlow />}

      <section className={`ui-section ${postFreeVisit ? "ui-section--flush-top" : "ui-section--tight"}`}>
        <div className="ui-container grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <div>
          <div className="pg-intro ui-rise">
            <p className="ui-eyebrow ui-eyebrow--accent">Profixter Membership</p>
            {postFreeVisit ? (
              <h2 className="ui-h2">One trusted team for the home list that never ends.</h2>
            ) : (
              <h1 className="ui-display">One trusted team for the home list that never ends.</h1>
            )}
            <p className="ui-lede">
              Small repairs, maintenance and installations when you need them, without
              searching for a new contractor every time.
            </p>
            <div className="pg-actions pg-actions--stack">
              <Link href="/membership/plans" className="ui-btn ui-btn--primary ui-btn--lg">
                See plans &amp; prices
              </Link>
              <a href="#how-it-works" className="ui-btn ui-btn--secondary ui-btn--lg">
                How it works
              </a>
            </div>
          </div>

          {showFreeVisitOffer ? (
            <div
              className="ui-card mt-6 flex max-w-[640px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ui-rise"
              style={{ animationDelay: "60ms" }}
            >
              <div>
                <p className="text-[16px] font-semibold text-[color:var(--ui-ink)]">
                  {onAddHome ? "A free visit may be available." : "Let's take a look at your to-do list."}
                </p>
                <p className="ui-small mt-0.5">Free visit · We go over your list together · No labor included</p>
              </div>
              {onAddHome ? (
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("free_visit_cta_clicked", { placement: "membership_hero_add_home" });
                    onAddHome();
                  }}
                  className="ui-btn ui-btn--accent shrink-0"
                >
                  Add your home to check availability
                </button>
              ) : (
                <Link
                  href="/book/free"
                  onClick={() => trackEvent("free_visit_cta_clicked", { placement: "membership_hero" })}
                  className="ui-btn ui-btn--accent shrink-0"
                >
                  Book Your Free Visit
                </Link>
              )}
            </div>
          ) : null}
          </div>

          {/* Wide screens: the kind of job a visit is for, in four pictures. */}
          <div className="hidden grid-cols-2 gap-3 lg:grid ui-rise" style={{ animationDelay: "120ms" }} aria-hidden="true">
            {HERO_TILES.map((tile, index) => (
              <div key={tile.src} className={`ui-media aspect-square ${index % 2 ? "translate-y-6" : ""}`}>
                <Image src={tile.src} alt="" fill sizes="(min-width: 1024px) 260px, 0px" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="ui-section ui-section--soft scroll-mt-[90px]">
        <div className="ui-container">
          <Reveal className="ui-head">
            <h2 className="ui-h2">How membership works</h2>
          </Reveal>
          <ol className="pg-cards pg-cards--3 m-0 list-none p-0">
            {steps.map(([title, body], index) => (
              <Reveal as="li" key={title} delay={index * 60} className="ui-card">
                <span className="ui-num text-[13px] font-semibold text-[color:var(--ui-accent-ink)]">0{index + 1}</span>
                <h3 className="pg-card__title mt-2">{title}</h3>
                <p className="pg-card__meta">{body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="ui-section">
        <div className="ui-container">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <Reveal>
              <h2 className="ui-h2">Built for everyday home tasks</h2>
              <ul className="ui-checks mt-5 sm:grid-cols-2">
                {tasks.map((task) => (
                  <li key={task} className="!text-[15px]">{task}</li>
                ))}
              </ul>
              <p className="ui-small mt-5">
                Larger renovations and multi-day work are handled through Project Estimates.{" "}
                <Link href="/services" className="font-semibold text-[color:var(--ui-accent-ink)] hover:underline">
                  View all services
                </Link>
              </p>
            </Reveal>

            {/*
              A price, not a pricing page. Comparing is the plans page's entire
              job; this only answers "what does it cost to start". The FAQ lives
              on /membership/plans, where an unanswered question stops a purchase.
            */}
            <Reveal delay={60} className="ui-card ui-card--soft self-start !p-6 sm:!p-8" as="div">
              <div id="plans" className="scroll-mt-[90px]">
                <p className="ui-eyebrow">Membership</p>
                <p className="ui-h2 ui-num">From ${startingPrice} a month.</p>
                <p className="ui-body mt-2">
                  Four levels. Month to month, or pay for ten months and get twelve.
                </p>
                <div className="pg-actions">
                  <Link href="/membership/plans" className="ui-btn ui-btn--primary">
                    Compare plans
                  </Link>
                </div>
                <p className="ui-small mt-4">
                  Need only one visit?{" "}
                  <Link href="/book?visit=additional" className="font-semibold text-[color:var(--ui-accent-ink)] hover:underline">
                    Book a One-Time Visit
                  </Link>
                </p>
              </div>
            </Reveal>
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

  /*
   * Acquisition state for the default property. Drives which non-member flow
   * renders. The check moved to a shared hook so Book can ask the same
   * question: the rule now has one implementation rather than two that can
   * drift apart and disagree about whether a visit is free.
   */
  const introState = useFreeVisitEligibility();
  const { openHome, homeSheet } = useAddHome();

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
    <div className="min-h-screen overflow-x-clip bg-white">
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

        {/* No home on file yet: show the offer, with adding the home as its
            step. Saving it re-runs the eligibility check; the server decides. */}
        {isAuthenticated && !isSubscribed && introState === "needs_address" && (
          <ProspectMembershipFlow showFreeVisitOffer onAddHome={openHome} />
        )}

        {!isAuthenticated && (
          <ProspectMembershipFlow showFreeVisitOffer />
        )}
      </main>

      {/* Every branch but the two that bring their own footer. */}
      {!isSubscribed && introState !== "eligible" && !(isAuthenticated && introState === "loading") && <Footer />}

      {!isSubscribed && introState !== "eligible" && <StickyMobileCTA />}
      {homeSheet}
    </div>
  );
}
