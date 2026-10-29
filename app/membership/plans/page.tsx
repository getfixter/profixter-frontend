"use client";

/**
 * The membership plans, for everybody.
 *
 * WHY THIS ROUTE EXISTS
 * "See membership" used to land on /membership, which switches to the member
 * dashboard once you subscribe. So the one group most likely to want to compare
 * plans, existing members thinking about the next tier up, were the only group
 * that could not see them. Being a customer should not close the brochure.
 *
 * /membership keeps its job as the member's own destination. This is the
 * comparison, and it renders the same PlansSection the acquisition flow uses,
 * so there is one source of plan data, pricing and benefits.
 *
 * PlansSection is already state-aware: it labels the current plan, offers
 * Upgrade or Downgrade against the existing change-plan flow, and shows
 * Start Membership to everyone else. Nothing about billing is invented here.
 */

import { useEffect, useState } from "react";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import PlansSection from "@/app/components/sections/PlansSection";
import FAQSection from "@/app/components/sections/FAQSection";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";
import Link from "next/link";
import { membershipFaqJsonLd } from "@/app/data/membership-faq";
import { absoluteUrl } from "@/lib/seo";
import PlanComparisonTable from "@/app/components/membership/PlanComparisonTable";
import { buttonClass } from "@/app/components/ui/Button";
import Reveal from "@/app/components/ui/Reveal";

export default function MembershipPlansPage() {
  const { user } = useAuth();
  const isMember = hasActiveMembership(user);
  /*
   * The flat comparison is open on a wide screen, where it reads at a glance,
   * and one tap away on a phone, where a seven-row, four-column table is a
   * wall of text under a selector that already answers the question. Either
   * way the table is in the HTML (a closed <details> still renders its
   * content), so every price stays readable to crawlers.
   */
  const [compareOpen, setCompareOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setCompareOpen(true);
  }, []);

  return (
    <div className="pg-flow min-h-screen overflow-x-clip bg-white">
      {/*
        The accordion below renders these questions and answers as real text,
        which is the condition Google puts on FAQ markup. The `true` is the
        same flag the accordion gets, so the markup describes exactly the
        questions this page shows - the selector answers the rest on the way
        past, and a question that is not on the page must not be in the markup.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(membershipFaqJsonLd(absoluteUrl("/membership/plans"), true)),
        }}
      />
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <section className="ui-section ui-section--tight ui-section--soft">
          <div className="ui-container pg-plans__grid">
            <div className="pg-plans__intro pg-intro ui-rise">
              <p className="ui-eyebrow ui-eyebrow--accent">Membership</p>
              <h1 className="ui-display">
                {isMember ? "Compare your plan options." : "Choose the help your home needs."}
              </h1>
              <p className="ui-lede">
                {isMember
                  ? "Your current plan is marked. Move up or down at any time; the change follows your normal billing."
                  : "Book as often as you need. Change plans whenever your home does."}
              </p>

              {isMember && (
                <div className="pg-actions">
                  <Link href="/book?visit=membership" className={buttonClass({ variant: "primary" })}>
                    Book Fixter
                  </Link>
                  <Link href="/account?tab=plan" className={buttonClass({ variant: "secondary" })}>
                    Manage plan
                  </Link>
                </div>
              )}

              {/* Wide screens only: the column beside the selector would otherwise be empty. */}
              <div className="pg-plans__aside">
                <ul className="ui-checks">
                  <li>90-minute visits for any home task</li>
                  <li>The same local team every time</li>
                  <li>Month to month, or 12 months for the price of 10</li>
                </ul>
                <p className="ui-small mt-6">
                  New to the idea?{" "}
                  <Link href="/handyman-membership" className="font-semibold text-[color:var(--ui-accent-ink)]">
                    How a membership works
                  </Link>
                </p>
              </div>
            </div>

            {/* The one plan comparison in the product. No duplicate plan data. */}
            <div className="ui-rise" style={{ animationDelay: "60ms" }}>
              <PlansSection hideCancellationUi hideIntro bare />
            </div>
          </div>
        </section>

        {/*
          The same plans, flat. The selector shows one plan at a time, so on its
          own it puts a single price in the HTML; this puts the whole ladder,
          annual prices included, where a reader comparing on a wide screen - or
          a crawler - can see it without a tap.
        */}
        <section className="ui-section ui-section--tight">
          <Reveal className="ui-container">
            <details
              className="pg-compare"
              open={compareOpen}
              onToggle={(event) => setCompareOpen((event.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white md:hidden">
                <span className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[15px] font-semibold text-[color:var(--ui-ink)]">
                  Compare all four plans
                  <span className="text-[13px] font-medium text-[color:var(--ui-accent-ink)]">
                    {compareOpen ? "Hide" : "Show table"}
                  </span>
                </span>
              </summary>
              <PlanComparisonTable bare intro="" />
            </details>

            <ul className="pg-facts mt-6">
              <li>
                <Link href="/guides/handyman-membership-vs-hiring-per-job" className="font-medium text-[color:var(--ui-accent-ink)]">
                  Membership vs hiring per job
                </Link>
              </li>
              <li>
                <Link href="/book?visit=additional" className="font-medium text-[color:var(--ui-accent-ink)]">
                  Only one thing? Book a One-Time Visit
                </Link>
              </li>
            </ul>
          </Reveal>
        </section>

        {/*
          No gift band here. Somebody comparing four prices for their own house
          is not shopping for a present, and this is the one surface where a
          second pitch costs a decision. Gift keeps its page and footer entry.
        */}
        <FAQSection hideCancellationUi />
      </main>

      <Footer />
    </div>
  );
}
