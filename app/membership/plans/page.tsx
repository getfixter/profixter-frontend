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

export default function MembershipPlansPage() {
  const { user } = useAuth();
  const isMember = hasActiveMembership(user);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
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
                : "Every plan is month to month. Start where it makes sense today and change it as your home needs change."}
            </p>

            {isMember && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/book?visit=membership"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[#0B1628] px-5 text-[14px] font-semibold text-white transition hover:bg-[#172033]"
                >
                  Book Fixter
                </Link>
                <Link
                  href="/account?tab=plan"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[#D7DEE9] bg-white px-5 text-[14px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF]"
                >
                  Manage plan
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* The one plan comparison in the product. No duplicate plan data. */}
        <PlansSection hideCancellationUi hideIntro />

        <FAQSection hideCancellationUi />
      </main>

      <Footer />
    </div>
  );
}
