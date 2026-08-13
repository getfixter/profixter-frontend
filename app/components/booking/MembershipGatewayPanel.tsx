"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useFreeVisitEligibility } from "@/lib/free-visit";
import { trackEvent } from "@/lib/analytics";

/**
 * The Book Fixter tab, for somebody who does not have a Fixter yet.
 *
 * A member opens this tab and books. A stranger opening the same tab used to
 * see nothing at all, because the whole three-way selector was hidden from
 * them, so the one thing Book never explained was the product Book is named
 * after.
 *
 * This is a gateway, not a sales page. Membership already has a page and a
 * comparison page; repeating either here would turn a booking screen into a
 * third pitch. So: what it is, what it costs to find out, and the way through.
 *
 * The free first visit is only mentioned when the shared eligibility hook says
 * it is real. While that is still resolving the offer is not rendered at all,
 * because flashing "your first visit is free" and then withdrawing it is worse
 * than taking a moment to be sure.
 */
export default function MembershipGatewayPanel() {
  const { isAuthenticated } = useAuth();
  const freeVisit = useFreeVisitEligibility();

  /*
   * An anonymous visitor has no property on file, so there is nothing to check
   * yet and the honest word is "may". A signed-in non-member has been checked,
   * so they get a straight answer.
   */
  const offerFreeVisit = isAuthenticated ? freeVisit === "eligible" : true;
  const freeVisitHref = isAuthenticated ? "/membership" : "/signup?redirect=%2Fmembership";
  const freeVisitLabel = isAuthenticated
    ? "Book your free first visit"
    : "Book your free first visit";

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-6">
        <div className="max-w-[620px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
            Membership
          </p>
          <h1 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0B1628] sm:text-[32px]">
            Get a Fixter for your home.
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[#4A5462] sm:text-[17px] sm:leading-7">
            Membership is the ongoing version of this page. Book a visit whenever
            something comes up, and the same local team takes care of it, so you
            are not looking for a handyman every time.
          </p>

          <ul className="mt-5 grid gap-2.5">
            {[
              "Book visits online whenever you need them",
              "The same trusted team, learning your home",
              "One monthly price, no estimates for small jobs",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] leading-6 text-[#3C4453]">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#306EEC]"
                />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link
              href="/membership/plans"
              onClick={() => trackEvent("see_plans_clicked", { placement: "book_fixter_tab" })}
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558C9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
            >
              See plans
            </Link>
            <Link
              href="/book?visit=additional"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white px-5 text-[15px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
            >
              Just need one visit?
            </Link>
          </div>
        </div>

        {/*
         * The free visit sits beside the proposition on a wide screen and under
         * it on a phone, so on desktop it uses width that was empty rather than
         * making the column taller.
         */}
        {offerFreeVisit && (
          <aside className="rounded-[8px] border border-[#D9E4FF] bg-[#F4F8FF] p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#306EEC]">
              New here?
            </p>
            <p className="mt-2 text-[17px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#0B1628]">
              {isAuthenticated ? "Your first visit is free." : "Your first visit may be free."}
            </p>
            <p className="mt-2 text-[13.5px] leading-5 text-[#4A5462]">
              90 minutes of handyman work, no card required, one per home. It is the
              easiest way to see how we work before deciding anything.
            </p>
            <Link
              href={freeVisitHref}
              onClick={() => trackEvent("free_visit_cta_clicked", { placement: "book_fixter_tab" })}
              className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center rounded-[8px] bg-[#0B1628] px-5 text-[15px] font-semibold text-white transition hover:bg-[#172033] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] sm:w-auto"
            >
              {freeVisitLabel}
            </Link>
            {!isAuthenticated && (
              <p className="mt-2.5 text-[12.5px] leading-4 text-[#6E6E73]">
                We check your address first to confirm it is available.
              </p>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
