import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { plans } from "@/app/data/content";
import { MEMBERSHIP_FAQS, membershipFaqJsonLd } from "@/app/data/membership-faq";
import { absoluteUrl, SITE_URL } from "@/lib/seo";
import { CUSTOMER_CARE } from "@/lib/fixter";

/**
 * What a handyman membership is, and when it is the wrong thing to buy.
 *
 * WHY THIS PAGE EXISTS
 * Membership is the part of Profixter that is genuinely different from an
 * ordinary handyman company, and it was the part the site never explained in
 * plain prose. The mechanics lived inside plan cards and an accordion; the
 * prices lived in a client component; nothing anywhere defined the category.
 * An assistant asked "what is a handyman membership" or "is a handyman
 * membership worth it" had nothing here to work from.
 *
 * The page answers the question first and sells second, including the case
 * where membership is the wrong answer. That is not modesty - a page that only
 * says yes is not useful to a homeowner deciding, and is not worth citing.
 *
 * Everything factual here is verified against production: plan prices and
 * descriptions come from app/data/content.ts, the mechanics from the shared
 * membership FAQ, the licence from the About page. No timelines, no savings
 * figures, no claims about competitors.
 *
 * Server component on purpose. Nothing here needs to be interactive, and the
 * whole point is that a retrieval system reading raw HTML gets all of it.
 */

const ANNUAL_MONTHS_CHARGED = 10;
const ANNUAL_MONTHS_RECEIVED = 12;

const SHELL = "mx-auto w-full max-w-[880px] px-5 sm:px-8";
const H2 = "mt-16 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[#0B1628] sm:mt-20 sm:text-[32px]";
const P = "mt-5 text-[16px] leading-[1.7] text-[#3F4854] sm:text-[17px]";

/** When hiring per job is the better answer. Stated first, and meant. */
const ONE_OFF_CASES = [
  "You have one specific task, it is done when it is done, and you do not expect another for a long time.",
  "You are renting, or you are selling and only need a punch list cleared before a closing.",
  "The job is a single large trade item - a full re-pipe, a panel upgrade, a roof - which is project work, not handyman work.",
  "You already have someone reliable you are happy with.",
];

const MEMBERSHIP_CASES = [
  "The list never really empties. Something is always half-done, and the small jobs keep arriving faster than you book them.",
  "You lose more time finding and vetting someone than the repair itself takes.",
  "You want the same people back, who already know the house, rather than explaining it again each time.",
  "You would rather the cost of keeping the house up be a predictable line in the budget than an unpredictable one.",
  "You are trying to stay ahead of maintenance instead of reacting after something fails.",
];

export default function HandymanMembershipPage() {
  const cheapest = plans.reduce((a, b) => (a.price <= b.price ? a : b));

  /*
   * Two nodes, both about things this page actually says: the FAQ it renders,
   * and the article itself. The business, the membership service and its prices
   * are already published site-wide from the root layout, so they are not
   * repeated here - one description of the company, not one per page.
   */
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/handyman-membership#article`,
    headline: "What is a handyman membership?",
    description:
      "A handyman membership is a monthly subscription that gives a homeowner ongoing access to a handyman team for small repairs, installations and maintenance, instead of hiring separately for each job.",
    about: { "@id": `${SITE_URL}/#membership` },
    publisher: { "@id": `${SITE_URL}/#business` },
    mainEntityOfPage: absoluteUrl("/handyman-membership"),
    inLanguage: "en-US",
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(membershipFaqJsonLd(absoluteUrl("/handyman-membership"))),
        }}
      />

      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <article className={`${SHELL} pb-24 pt-10 sm:pt-16`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
            Home maintenance · Long Island
          </p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-[#0B1628] sm:text-[46px]">
            What is a handyman membership?
          </h1>

          {/*
            The definition, in one paragraph, at the top. This is the sentence
            an assistant should be able to lift without reading the rest.
          */}
          <p className="mt-7 text-[18px] leading-[1.65] text-[#1F2937] sm:text-[20px]">
            A handyman membership is a monthly subscription that gives a homeowner ongoing
            access to a handyman team for small and medium repairs, installations and
            maintenance — instead of finding, vetting and hiring someone separately for each
            job. The homeowner pays a recurring fee, and requests visits when the house needs
            something.
          </p>

          <p className={P}>
            It is a different way of buying the same work. Traditional handyman service is
            priced per job or per hour, and the relationship restarts every time. A membership
            prices access instead, and the relationship continues. Neither is automatically
            better — which one fits depends almost entirely on how often your house asks you
            for something.
          </p>

          <h2 className={H2}>When hiring per job is the better choice</h2>
          <p className={P}>
            A membership is a poor purchase for a household that genuinely needs one thing
            fixed. If any of these describe you, hire per job:
          </p>
          <ul className="mt-5 space-y-3">
            {ONE_OFF_CASES.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-[1.65] text-[#3F4854] sm:text-[17px]">
                <span aria-hidden="true" className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#94A3B8]" />
                {item}
              </li>
            ))}
          </ul>

          <h2 className={H2}>When a membership makes more sense</h2>
          <p className={P}>
            Membership is built for the opposite situation — a house with a running list rather
            than a single task:
          </p>
          <ul className="mt-5 space-y-3">
            {MEMBERSHIP_CASES.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-[1.65] text-[#3F4854] sm:text-[17px]">
                <span aria-hidden="true" className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#306EEC]" />
                {item}
              </li>
            ))}
          </ul>
          <p className={P}>
            The honest framing is that a membership converts an unpredictable, per-incident
            cost into a predictable recurring one, and converts a repeated search into a
            standing relationship. If neither of those is a problem you have, it is not worth
            paying for.
          </p>

          <h2 className={H2}>How the Profixter membership works</h2>
          <p className={P}>
            Profixter is a Long Island home-services company based near Babylon, serving
            homeowners across Nassau and Suffolk Counties. It is licensed as a New York Home
            Improvement Contractor under licence HI-71484 and is fully insured. Its handyman
            offering is built around a membership rather than one-off dispatch, though a
            one-time visit is still available for people who want exactly one thing done.
          </p>
          <p className={P}>Concretely:</p>
          <ul className="mt-5 space-y-3">
            {[
              "Each standard visit covers up to 90 minutes of work — repairs, installations, maintenance, drywall patches, caulking, paint touch-ups, doors, locks, shelves and fixtures.",
              "There is no hard monthly cap on standard visit requests. What each plan sets is how many appointments you can have active at one time: Basic allows one, and Plus, Premium and Elite allow two.",
              "Members book online, choose a date, and add notes or photos before the visit.",
              "The same team comes back, so the house does not have to be re-explained.",
              "Plans are month to month. There is no long-term contract, and a cancelled plan runs to the end of the billing period already paid for.",
              "Materials differ by tier: Basic covers labour only, while Plus and Premium include basic materials for small tasks. Fixtures, appliances, special-order and project materials are quoted separately.",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-[1.65] text-[#3F4854] sm:text-[17px]">
                <span aria-hidden="true" className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#306EEC]" />
                {item}
              </li>
            ))}
          </ul>

          <h2 className={H2}>The plans</h2>
          <p className={P}>
            Four tiers, all month to month. Annual billing is charged for{" "}
            {ANNUAL_MONTHS_CHARGED} months and runs for {ANNUAL_MONTHS_RECEIVED}.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[15px]">
              <caption className="sr-only">
                Profixter handyman membership plans and monthly prices
              </caption>
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[13px] uppercase tracking-[0.08em] text-[#64748B]">
                  <th scope="col" className="py-3 pr-4 font-bold">Plan</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Monthly</th>
                  <th scope="col" className="py-3 pr-4 font-bold">Annual</th>
                  <th scope="col" className="py-3 font-bold">Built for</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.name} className="border-b border-[#EEF2F7] align-top">
                    <th scope="row" className="py-4 pr-4 font-bold text-[#0B1628]">{plan.name}</th>
                    <td className="py-4 pr-4 font-semibold text-[#0B1628]">${plan.price}/mo</td>
                    <td className="py-4 pr-4 text-[#3F4854]">
                      ${(plan.price * ANNUAL_MONTHS_CHARGED).toLocaleString("en-US")}/yr
                    </td>
                    <td className="py-4 leading-[1.6] text-[#3F4854]">{plan.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-[15px] leading-[1.7] text-[#3F4854]">
            Premium adds one Priority Visit per month; Elite adds two, plus one full project
            day of up to eight hours and 10% off larger home improvement projects. New Nassau
            and Suffolk customers can start with a free 90-minute first visit, with no card
            required.{" "}
            <Link href="/membership/plans" className="font-semibold text-[#306EEC] underline underline-offset-2">
              Compare the plans in full
            </Link>
            , or{" "}
            <Link href="/book" className="font-semibold text-[#306EEC] underline underline-offset-2">
              book a one-time visit
            </Link>{" "}
            if that is all you need.
          </p>

          <h2 className={H2}>What a membership does not cover</h2>
          <p className={P}>
            This is where memberships are most often oversold, so it is worth being exact.
            Membership is for handyman-scale work. Larger jobs — roofing, siding, full-room
            painting, major electrical or plumbing, and kitchen or bathroom renovation — are
            not handyman visits and are not covered by a plan. Profixter still does that work,
            but it runs through a separate estimate as a general contracting project.
          </p>
          <p className={P}>
            So the two sides of the business are distinct on purpose:{" "}
            <strong className="font-semibold text-[#0B1628]">membership</strong> for the
            ongoing small list, and{" "}
            <Link href="/kitchen-bathroom" className="font-semibold text-[#306EEC] underline underline-offset-2">
              kitchen and bathroom renovation
            </Link>{" "}
            — along with{" "}
            <Link href="/projects" className="font-semibold text-[#306EEC] underline underline-offset-2">
              other larger projects
            </Link>{" "}
            — quoted as real construction work. Members may receive project discounts, and some
            larger projects include up to 12 months of membership.
          </p>

          <h2 className={H2}>Common questions</h2>
          <dl className="mt-6 divide-y divide-[#EEF2F7] border-t border-[#EEF2F7]">
            {MEMBERSHIP_FAQS.map((faq) => (
              <div key={faq.q} className="py-6">
                <dt className="text-[17px] font-bold leading-[1.35] text-[#0B1628]">{faq.q}</dt>
                <dd className="mt-2.5 text-[16px] leading-[1.7] text-[#3F4854]">{faq.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-14 rounded-[12px] border border-[#DDE4EE] bg-[#F8FAFF] p-6 sm:p-8">
            <h2 className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[#0B1628] sm:text-[26px]">
              Not sure which side you need?
            </h2>
            <p className="mt-3 max-w-[54ch] text-[16px] leading-[1.65] text-[#3F4854]">
              If the list is small and ongoing, membership starts at ${cheapest.price} a month.
              If you are planning a renovation, that is an estimate conversation instead. A
              real person can tell you which in a couple of minutes.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/membership/plans"
                className="inline-flex min-h-[50px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[#2558C9]"
              >
                See membership plans
              </Link>
              <a
                href={CUSTOMER_CARE.callHref}
                className="inline-flex min-h-[50px] items-center justify-center rounded-[8px] border border-[#CBD5E1] bg-white px-6 text-[15px] font-bold text-[#0B1628] transition-colors hover:bg-[#F1F5FB]"
              >
                Call {CUSTOMER_CARE.phoneDisplay}
              </a>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
