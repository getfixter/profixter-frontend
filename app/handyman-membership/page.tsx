import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import PlanComparisonTable from "@/app/components/membership/PlanComparisonTable";
import { plans } from "@/app/data/content";
import { MEMBERSHIP_FAQS, membershipFaqJsonLd } from "@/app/data/membership-faq";
import { absoluteUrl, BUSINESS_PHONE_DISPLAY, SITE_URL } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/breadcrumbs";
import { CUSTOMER_CARE } from "@/lib/fixter";
import { LICENSE_PHRASE, NOT_HANDYMAN_WORK, OPENING_HOURS, STANDARD_VISIT_MINUTES } from "@/lib/business";
import { getFullDayOffer, getOneTimeOffer } from "@/lib/offers";
import {
  COMMUNITIES_PHRASE,
  COMPLETED_VISITS_ROUNDED,
  COUNTY_SPLIT_PHRASE,
  CUSTOMERS_ROUNDED,
  DATA_AS_OF,
  DATA_SINCE,
  MULTI_TASK_REQUEST_PHRASE,
} from "@/lib/profixter-data";

/**
 * What a handyman membership is, how Profixter's works, and when it is the
 * wrong thing to buy.
 *
 * THE CANONICAL KNOWLEDGE SOURCE
 * This is the one page meant to answer every factual question about the
 * membership: what it is, the plans and prices, what is included and excluded,
 * how booking works, the One-Time alternative, where Profixter operates and how
 * to join. Other pages link here rather than restating it.
 *
 * It answers the category question first and sells second, including the case
 * where membership is the wrong answer - a page that only says yes is neither
 * useful to a homeowner deciding nor worth citing.
 *
 * ACCURACY
 * Plan prices and inclusions come from app/data/content.ts and the shared
 * benefit matrix (the same data checkout and the plan cards use); One-Time and
 * Full Day prices are read live from the booking settings; the operating
 * figures are dated aggregates from lib/profixter-data.ts. The pace wording
 * follows the settled rule: no monthly visit ALLOWANCE, and the plan sets how
 * many visits can be booked at the same time. Never "unlimited", never "no
 * limit", never "active booking".
 *
 * Server component on purpose: a retrieval system reading raw HTML gets all of it.
 */

export const revalidate = 3600;

const PUBLISHED = "2026-09-12";
const UPDATED = "2026-10-08";

const SHELL = "mx-auto w-full max-w-[880px] px-5 sm:px-8";
const H2 = "mt-16 scroll-mt-24 text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[#0B1628] sm:mt-20 sm:text-[32px]";
const P = "mt-5 text-[16px] leading-[1.7] text-[#3F4854] sm:text-[17px]";
const LINK = "font-semibold text-[#306EEC] underline underline-offset-2";

/** When hiring per job is the better answer. Stated first, and meant. */
const ONE_OFF_CASES = [
  "You have one specific task, it is done when it is done, and you do not expect another for a long time.",
  "You need help a few times a year rather than a few times a month.",
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

function Bullets({ items, tone = "blue" }: { items: React.ReactNode[]; tone?: "blue" | "grey" }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-[16px] leading-[1.65] text-[#3F4854] sm:text-[17px]">
          <span
            aria-hidden="true"
            className={`mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "blue" ? "bg-[#306EEC]" : "bg-[#94A3B8]"}`}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function HandymanMembershipPage() {
  const [oneTime, fullDay] = await Promise.all([getOneTimeOffer(), getFullDayOffer()]);
  const cheapest = plans.reduce((a, b) => (a.price <= b.price ? a : b));
  const priciest = plans.reduce((a, b) => (a.price >= b.price ? a : b));

  /*
   * The article and the FAQ it renders. The business, the membership service
   * and its prices are published site-wide from the root layout, so they are
   * referenced here by @id rather than repeated.
   */
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/handyman-membership#article`,
    headline: "What is a handyman membership?",
    description:
      "A handyman membership is a monthly subscription that gives a homeowner ongoing access to a handyman team for small repairs, installations and maintenance, instead of hiring separately for each job.",
    datePublished: PUBLISHED,
    dateModified: UPDATED,
    about: { "@id": `${SITE_URL}/#membership` },
    author: { "@id": `${SITE_URL}/#business` },
    publisher: { "@id": `${SITE_URL}/#business` },
    mainEntityOfPage: absoluteUrl("/handyman-membership"),
    inLanguage: "en-US",
  };

  const facts: [string, React.ReactNode][] = [
    ["What it is", "A Long Island handyman and home-maintenance company offering one-time visits and a recurring handyman membership."],
    ["Where", "Nassau and Suffolk Counties. Based in Lindenhurst, Town of Babylon."],
    ["Membership", `$${cheapest.price}–$${priciest.price} a month, or 12 months for the price of 10. Month to month.`],
    ["Visits", `Up to ${STANDARD_VISIT_MINUTES} minutes, everyday home tasks, the same local team.`],
    ["How often", "As often as you need. Your plan sets how many visits you can have booked at the same time."],
    ["Without a membership", `One-Time Visit $${oneTime.priceDollars} (one small job, up to ${oneTime.minutes} minutes); Full Day $${fullDay.priceDollars} (about ${fullDay.hours} hours).`],
    ["New customers", `A free first ${STANDARD_VISIT_MINUTES}-minute visit, one per home.`],
    ["Contact", `${BUSINESS_PHONE_DISPLAY}, ${OPENING_HOURS.display}.`],
    ["License", `${LICENSE_PHRASE}. Fully insured.`],
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(membershipFaqJsonLd(absoluteUrl("/handyman-membership"))),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd([{ label: "Handyman membership", href: "/handyman-membership" }])),
        }}
      />

      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <article className={`${SHELL} pb-10 pt-10 sm:pt-16`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
            Home maintenance · Long Island
          </p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-[#0B1628] sm:text-[46px]">
            What is a handyman membership?
          </h1>
          <p className="mt-3 text-[13px] font-semibold text-[#64748B]">
            Updated <time dateTime={UPDATED}>October 8, 2026</time> · Profixter, Lindenhurst, NY
          </p>

          {/*
            The definition, in one paragraph, at the top. This is the sentence
            an assistant should be able to lift without reading the rest.
          */}
          <p className="mt-7 text-[18px] leading-[1.65] text-[#1F2937] sm:text-[20px]">
            A handyman membership is a monthly subscription that gives a homeowner ongoing access to a handyman team
            for small and medium repairs, installations and maintenance — instead of finding, vetting and hiring
            someone separately for each job. The homeowner pays a recurring fee, and requests visits when the house
            needs something.
          </p>

          <p className={P}>
            It is a different way of buying the same work. Traditional handyman service is priced per job or per hour,
            and the relationship restarts every time. A membership prices access instead, and the relationship
            continues. Neither is automatically better — which one fits depends almost entirely on how often your house
            asks you for something. It is also not the same thing as a home warranty, which pays toward failed systems
            and appliances, or a maintenance subscription that performs a fixed checklist;{" "}
            <Link href="/guides/home-maintenance-plans-compared" className={LINK}>
              the differences are here
            </Link>
            .
          </p>

          <section aria-labelledby="at-a-glance" className="mt-10 rounded-[12px] border border-[#DDE4EE] bg-[#F8FAFF] p-5 sm:p-7">
            <h2 id="at-a-glance" className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#0B1628]">
              Profixter at a glance
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[180px_1fr]">
              {facts.map(([term, detail]) => (
                <div key={term} className="contents">
                  <dt className="text-[14px] font-semibold text-[#0B1628]">{term}</dt>
                  <dd className="text-[15px] leading-[1.6] text-[#3F4854]">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <h2 className={H2}>When hiring per job is the better choice</h2>
          <p className={P}>
            A membership is a poor purchase for a household that genuinely needs one thing fixed. If any of these
            describe you, hire per job:
          </p>
          <Bullets items={ONE_OFF_CASES} tone="grey" />
          <p className={P}>
            On Profixter&apos;s own prices, a Basic membership paid annually only costs less than ${oneTime.priceDollars}{" "}
            One-Time Visits once you need about {Math.ceil((cheapest.price * 10) / oneTime.priceDollars)} visits a year.{" "}
            <Link href="/guides/handyman-membership-vs-hiring-per-job" className={LINK}>
              Run the numbers for your house
            </Link>
            .
          </p>

          <h2 className={H2}>When a membership makes more sense</h2>
          <p className={P}>
            Membership is built for the opposite situation — a house with a running list rather than a single task:
          </p>
          <Bullets items={MEMBERSHIP_CASES} />
          <p className={P}>
            The honest framing is that a membership converts an unpredictable, per-incident cost into a predictable
            recurring one, and converts a repeated search into a standing relationship. If neither of those is a problem
            you have, it is not worth paying for. Lists are the norm, not the exception: in Profixter&apos;s records,{" "}
            {MULTI_TASK_REQUEST_PHRASE}.
          </p>

          <h2 className={H2}>How the Profixter membership works</h2>
          <p className={P}>
            Profixter is a Long Island home-services company based in Lindenhurst, serving homeowners across Nassau and
            Suffolk Counties. Since {DATA_SINCE} it has completed more than {COMPLETED_VISITS_ROUNDED} visits for about{" "}
            {CUSTOMERS_ROUNDED} customers in {COMMUNITIES_PHRASE} (as of {DATA_AS_OF}). Its handyman
            offering is built around a membership rather than one-off dispatch, though a one-time visit is still
            available for people who want exactly one thing done.
          </p>
          <Bullets
            items={[
              `Each standard visit covers up to ${STANDARD_VISIT_MINUTES} minutes of work: repairs, installations, maintenance, drywall patches, caulking, paint touch-ups, doors, locks, shelves and fixtures.`,
              "There is no monthly visit allowance. Book as often as you need: your plan sets how many visits you can have booked at the same time. Basic lets you have one booked at a time; Plus, Premium and Elite let you have up to two. Once a visit is done, you can book the next one.",
              "A bigger job can be split across visits, and Elite includes a Full Day each month for longer work.",
              "The same team comes back, so the house does not have to be re-explained.",
              "Plans are month to month. There is no long-term contract, and a cancelled plan runs to the end of the billing period already paid for.",
              "Materials differ by tier: Basic covers labor only, while Plus and above include small supplies such as screws, anchors, caulk and sealant. Fixtures, appliances, special-order and project materials are quoted separately.",
            ]}
          />

          <h2 className={H2}>How booking works</h2>
          <Bullets
            items={[
              "Members book online: choose the home, pick an available date and time, describe the jobs and add photos.",
              "Visits are scheduled from the dates and times available, and we aim for the soonest open slot.",
              "Premium includes one Priority Visit a month and Elite two, for things that can't wait for the next regular slot. Priority Visits are subject to availability.",
              "All scheduling is subject to availability. Rescheduling early lets the slot go to another member.",
            ]}
          />
        </article>

        <PlanComparisonTable title="The plans" />

        <article className={`${SHELL} pb-24`}>
          <h2 className={H2}>What a membership does not cover</h2>
          <p className={P}>
            This is where memberships are most often oversold, so it is worth being exact. Membership is for
            handyman-scale work. These are not handyman visits and are not covered by a plan:
          </p>
          <Bullets items={[...NOT_HANDYMAN_WORK]} tone="grey" />
          <p className={P}>
            Profixter still does larger work, but it runs through a separate estimate as a project:{" "}
            <Link href="/kitchen-bathroom" className={LINK}>
              kitchen and bathroom renovation
            </Link>{" "}
            and{" "}
            <Link href="/projects" className={LINK}>
              other larger projects
            </Link>
            . Elite members get 10% off those projects.
          </p>

          <h2 className={H2}>One-Time Visit: when to choose it instead</h2>
          <p className={P}>
            If you have one small job and nothing else pending, a membership is the wrong tool. A One-Time Visit is $
            {oneTime.priceDollars} for up to {oneTime.minutes} minutes on one small job from a set list — mounting a TV,
            replacing a light fixture or faucet, patching drywall, caulking, hanging shelves and similar — with no
            membership. A Full Day (${fullDay.priceDollars}, about {fullDay.hours} hours) suits one long list done in one
            go.{" "}
            <Link href="/book?visit=additional" className={LINK}>
              Book a One-Time Visit
            </Link>
            .
          </p>

          <h2 className={H2}>Where Profixter works</h2>
          <p className={P}>
            Nassau and Suffolk Counties: of completed visits so far, {COUNTY_SPLIT_PHRASE}, from the South Shore
            towns around the Lindenhurst base to the North Shore.{" "}
            <Link href="/locations" className={LINK}>
              See the towns we serve
            </Link>
            .
          </p>

          <h2 className={H2}>How to join</h2>
          <ol className="mt-5 space-y-3">
            {[
              <>
                <strong className="font-semibold text-[#0B1628]">Start with a free first visit</strong> if you are a new
                customer: {STANDARD_VISIT_MINUTES} minutes, one per home, no card required.{" "}
                <Link href="/book/free" className={LINK}>
                  Book it
                </Link>
                .
              </>,
              <>
                <strong className="font-semibold text-[#0B1628]">Or choose a plan directly</strong>, monthly or annual.{" "}
                <Link href="/membership/plans" className={LINK}>
                  Compare plans
                </Link>
                .
              </>,
              <>
                <strong className="font-semibold text-[#0B1628]">Book your first member visit</strong> online, with
                notes and photos.
              </>,
            ].map((item, index) => (
              <li key={index} className="flex gap-3 text-[16px] leading-[1.65] text-[#3F4854] sm:text-[17px]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[13px] font-bold text-[#306EEC]"
                >
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>

          <h2 className={H2}>Common questions</h2>
          <dl className="mt-6 divide-y divide-[#EEF2F7] border-t border-[#EEF2F7]">
            {MEMBERSHIP_FAQS.map((faq) => (
              <div key={faq.q} className="py-6">
                <dt className="text-[17px] font-bold leading-[1.35] text-[#0B1628]">{faq.q}</dt>
                <dd className="mt-2.5 text-[16px] leading-[1.7] text-[#3F4854]">{faq.a}</dd>
              </div>
            ))}
          </dl>

          <h2 className={H2}>Related guides</h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              ["/guides/handyman-for-small-jobs", "Getting small jobs done when they're too small for a handyman"],
              ["/guides/handyman-membership-vs-hiring-per-job", "Membership or per job: the calculator"],
              ["/guides/handyman-minimum-charges", "Handyman minimum charges explained"],
              ["/guides/handyman-cost-long-island", "What a handyman costs on Long Island"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className={LINK}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-14 rounded-[12px] border border-[#DDE4EE] bg-[#F8FAFF] p-6 sm:p-8">
            <h2 className="text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-[#0B1628] sm:text-[26px]">
              Not sure which you need?
            </h2>
            <p className="mt-3 max-w-[54ch] text-[16px] leading-[1.65] text-[#3F4854]">
              If the list is small and ongoing, membership starts at ${cheapest.price} a month. If it is one job, book a
              single visit. If you are planning a renovation, that is an estimate conversation instead. A real person
              can tell you which in a couple of minutes.
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
