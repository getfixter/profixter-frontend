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

export default function MembershipPlansPage() {
  const { user } = useAuth();
  const isMember = hasActiveMembership(user);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
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
        <section className="bg-white px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-12 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#306EEC]">
              Membership
            </p>
            <h1 className="mt-3 max-w-[20ch] text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#111111] sm:text-[38px] lg:text-[40px]">
              {isMember ? "Compare your plan options." : "Choose the level of help your home needs."}
            </h1>
            <p className="mt-3 max-w-[52ch] text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[17px]">
              {isMember
                ? "Your current plan is marked below. You can move up or down at any time, and the change follows your normal billing."
                : "Change it whenever your home does."}
            </p>

            {isMember && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/book?visit=membership"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-[#0B1628] px-5 text-[14px] font-semibold text-white transition hover:bg-[#172033]"
                >
                  Book Fixter
                </Link>
                <Link
                  href="/account?tab=plan"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white px-5 text-[14px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF]"
                >
                  Manage plan
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* The one plan comparison in the product. No duplicate plan data. */}
        <PlansSection hideCancellationUi hideIntro />

        {/*
          The same plans, flat. The cards above show one plan at a time, so on
          their own they put a single price in the HTML; this puts the whole
          ladder, annual prices included, where a reader comparing on a wide
          screen - or a crawler - can see it without a tap.
        */}
        <PlanComparisonTable />

        <section className="px-4 pb-4 sm:px-6 lg:px-8">
          <p className="mx-auto max-w-[1180px] text-[15px] leading-[1.6] text-[#6E6E73]">
            New to the idea?{" "}
            <Link href="/handyman-membership" className="font-semibold text-[#306EEC] underline underline-offset-2">
              How a handyman membership works
            </Link>
            , and{" "}
            <Link href="/guides/handyman-membership-vs-hiring-per-job" className="font-semibold text-[#306EEC] underline underline-offset-2">
              when hiring per job is the better deal
            </Link>
            . Only need one thing done?{" "}
            <Link href="/book?visit=additional" className="font-semibold text-[#306EEC] underline underline-offset-2">
              Book a One-Time Visit
            </Link>
            .
          </p>
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
