import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import Reveal from "@/app/components/ui/Reveal";
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

const LINK = "font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2";

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
    <ul className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-[15px] leading-[1.55] text-[color:var(--ui-text-2)]">
          <span
            aria-hidden="true"
            className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "blue" ? "bg-[color:var(--ui-accent)]" : "bg-[color:var(--ui-line-2)]"}`}
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
    ["Free Visit", "A free in-person visit to go over your to-do list and find the right service. No labor included."],
    ["Contact", `${BUSINESS_PHONE_DISPLAY}, ${OPENING_HOURS.display}.`],
    ["License", `${LICENSE_PHRASE}. Fully insured.`],
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-white">
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
        {/*
          Progressive disclosure, nothing deleted. The definition, the facts and
          the two "is it for me" lists are open; every longer section is a
          closed <details> under its own H2, so the whole article is still in
          the HTML for readers who want it and for anything that reads it.
        */}
        <article>
          <section className="ui-section ui-section--tight">
            <div className="ui-container grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
              <div className="ui-rise">
                <p className="ui-eyebrow ui-eyebrow--accent">Home maintenance · Long Island</p>
                <h1 className="ui-display">What is a handyman membership?</h1>
                <p className="ui-small mt-3">
                  Updated <time dateTime={UPDATED}>October 8, 2026</time> · Profixter, Lindenhurst, NY
                </p>

                {/*
                  The definition, in one paragraph, at the top. This is the sentence
                  an assistant should be able to lift without reading the rest.
                */}
                <p className="ui-lede !max-w-[60ch]">
                  A handyman membership is a monthly subscription that gives a homeowner ongoing access to a handyman team
                  for small and medium repairs, installations and maintenance — instead of finding, vetting and hiring
                  someone separately for each job. The homeowner pays a recurring fee, and requests visits when the house
                  needs something.
                </p>

                <div className="pg-actions pg-actions--stack">
                  <Link href="/membership/plans" className="ui-btn ui-btn--primary">
                    See membership plans
                  </Link>
                  <Link href="/book/free" className="ui-btn ui-btn--secondary">
                    Book a free visit
                  </Link>
                </div>

                <details className="pg-more pg-more--plain mt-4">
                  <summary>Membership vs per job, warranty or checklist</summary>
                  <div className="pg-more__body pg-prose !text-[15px]">
                    <p>
                      It is a different way of buying the same work. Traditional handyman service is priced per job or per hour,
                      and the relationship restarts every time. A membership prices access instead, and the relationship
                      continues. Neither is automatically better — which one fits depends almost entirely on how often your house
                      asks you for something. It is also not the same thing as a home warranty, which pays toward failed systems
                      and appliances, or a maintenance subscription that performs a fixed checklist;{" "}
                      <Link href="/guides/home-maintenance-plans-compared">the differences are here</Link>.
                    </p>
                  </div>
                </details>
              </div>

              <section aria-labelledby="at-a-glance" className="ui-card ui-card--soft self-start ui-rise" style={{ animationDelay: "60ms" }}>
                <h2 id="at-a-glance" className="ui-eyebrow !text-[color:var(--ui-ink)]">
                  Profixter at a glance
                </h2>
                <dl className="mt-3 grid gap-3">
                  {facts.map(([term, detail]) => (
                    <div key={term}>
                      <dt className="text-[13px] font-medium text-[color:var(--ui-text-3)]">{term}</dt>
                      <dd className="mt-0.5 text-[14px] leading-[1.5] text-[color:var(--ui-ink)]">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </section>

          <section className="ui-section ui-section--soft ui-section--tight">
            <div className="ui-container grid gap-3 md:grid-cols-2 md:gap-4">
              <Reveal className="ui-card">
                <h2 className="ui-h3">When hiring per job is the better choice</h2>
                <p className="ui-small mt-1.5">
                  A membership is a poor purchase for a household that genuinely needs one thing fixed. If any of these
                  describe you, hire per job:
                </p>
                <Bullets items={ONE_OFF_CASES} tone="grey" />
                <p className="ui-small mt-4">
                  On Profixter&apos;s own prices, a Basic membership paid annually only costs less than ${oneTime.priceDollars}{" "}
                  One-Time Visits once you need about {Math.ceil((cheapest.price * 10) / oneTime.priceDollars)} visits a year.{" "}
                  <Link href="/guides/handyman-membership-vs-hiring-per-job" className={LINK}>
                    Run the numbers for your house
                  </Link>
                  .
                </p>
              </Reveal>
              <Reveal className="ui-card" delay={60}>
                <h2 className="ui-h3">When a membership makes more sense</h2>
                <p className="ui-small mt-1.5">
                  Membership is built for the opposite situation — a house with a running list rather than a single task:
                </p>
                <Bullets items={MEMBERSHIP_CASES} />
                <p className="ui-small mt-4">
                  The honest framing is that a membership converts an unpredictable, per-incident cost into a predictable
                  recurring one, and converts a repeated search into a standing relationship. If neither of those is a problem
                  you have, it is not worth paying for. Lists are the norm, not the exception: in Profixter&apos;s records,{" "}
                  {MULTI_TASK_REQUEST_PHRASE}.
                </p>
              </Reveal>
            </div>
          </section>

          <section className="ui-section ui-section--tight">
            <div className="ui-container ui-container--narrow">
              <div className="pg-folds">
                <Fold title="How the Profixter membership works">
                  <p>
                    Profixter is a Long Island home-services company based in Lindenhurst, serving homeowners across Nassau and
                    Suffolk Counties. Since {DATA_SINCE} it has completed more than {COMPLETED_VISITS_ROUNDED} visits for about{" "}
                    {CUSTOMERS_ROUNDED} customers in {COMMUNITIES_PHRASE} (as of {DATA_AS_OF}). Its handyman
                    offering is built around a membership rather than one-off dispatch, though a one-time visit is still
                    available for people who want exactly one thing done.
                  </p>
                  <ul>
                    {[
                      `Each standard visit covers up to ${STANDARD_VISIT_MINUTES} minutes of work: repairs, installations, maintenance, drywall patches, caulking, paint touch-ups, doors, locks, shelves and fixtures.`,
                      "There is no monthly visit allowance. Book as often as you need: your plan sets how many visits you can have booked at the same time. Basic lets you have one booked at a time; Plus, Premium and Elite let you have up to two. Once a visit is done, you can book the next one.",
                      "A bigger job can be split across visits, and Elite includes a Full Day each month for longer work.",
                      "The same team comes back, so the house does not have to be re-explained.",
                      "Plans are month to month. There is no long-term contract, and a cancelled plan runs to the end of the billing period already paid for.",
                      "Materials differ by tier: Basic covers labor only, while Plus and above include small supplies such as screws, anchors, caulk and sealant. Fixtures, appliances, special-order and project materials are quoted separately.",
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Fold>

                <Fold title="How booking works">
                  <ul>
                    {[
                      "Members book online: choose the home, pick an available date and time, describe the jobs and add photos.",
                      "Visits are scheduled from the dates and times available, and we aim for the soonest open slot.",
                      "Premium includes one Priority Visit a month and Elite two, for things that can't wait for the next regular slot. Priority Visits are subject to availability.",
                      "All scheduling is subject to availability. Rescheduling early lets the slot go to another member.",
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Fold>

                <Fold title="What a membership does not cover">
                  <p>
                    This is where memberships are most often oversold, so it is worth being exact. Membership is for
                    handyman-scale work. These are not handyman visits and are not covered by a plan:
                  </p>
                  <ul>
                    {NOT_HANDYMAN_WORK.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>
                    Profixter still does larger work, but it runs through a separate estimate as a project:{" "}
                    <Link href="/kitchen-bathroom">kitchen and bathroom renovation</Link> and{" "}
                    <Link href="/projects">other larger projects</Link>. Elite members get 10% off those projects.
                  </p>
                </Fold>

                <Fold title="One-Time Visit: when to choose it instead">
                  <p>
                    If you have one small job and nothing else pending, a membership is the wrong tool. A One-Time Visit is $
                    {oneTime.priceDollars} for up to {oneTime.minutes} minutes on one small job from a set list — mounting a TV,
                    replacing a light fixture or faucet, patching drywall, caulking, hanging shelves and similar — with no
                    membership. A Full Day (${fullDay.priceDollars}, about {fullDay.hours} hours) suits one long list done in one
                    go. <Link href="/book?visit=additional">Book a One-Time Visit</Link>.
                  </p>
                </Fold>

                <Fold title="Where Profixter works">
                  <p>
                    Nassau and Suffolk Counties: of completed visits so far, {COUNTY_SPLIT_PHRASE}, from the South Shore
                    towns around the Lindenhurst base to the North Shore.{" "}
                    <Link href="/locations">See the towns we serve</Link>.
                  </p>
                </Fold>

                <Fold title="How to join">
                  <ol>
                    <li>
                      <strong>Start with a free visit</strong> if you are not sure yet: we visit your home, go over your to-do
                      list and help you choose (repairs and labor aren&rsquo;t part of the Free Visit). <Link href="/book/free">Book it</Link>.
                    </li>
                    <li>
                      <strong>Or choose a plan directly</strong>, monthly or annual.{" "}
                      <Link href="/membership/plans">Compare plans</Link>.
                    </li>
                    <li>
                      <strong>Book your first member visit</strong> online, with notes and photos.
                    </li>
                  </ol>
                </Fold>
              </div>
            </div>
          </section>
        </article>

        <div className="bg-[color:var(--ui-bg-soft)]">
          <PlanComparisonTable title="The plans" />
        </div>

        <section className="ui-section ui-section--tight">
          <div className="ui-container ui-container--narrow">
            <h2 className="ui-h2">Common questions</h2>
            <div className="ui-faq mt-5">
              {MEMBERSHIP_FAQS.map((faq) => (
                <details key={faq.q}>
                  <summary>{faq.q}</summary>
                  <p className="ui-faq__a">{faq.a}</p>
                </details>
              ))}
            </div>

            <h2 className="ui-h3 mt-12">Related guides</h2>
            <ul className="pg-list mt-3">
              {[
                ["/guides/handyman-for-small-jobs", "Getting small jobs done when they're too small for a handyman"],
                ["/guides/handyman-membership-vs-hiring-per-job", "Membership or per job: the calculator"],
                ["/guides/handyman-minimum-charges", "Handyman minimum charges explained"],
                ["/guides/handyman-cost-long-island", "What a handyman costs on Long Island"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>

            <div className="ui-card ui-card--dark mt-12 !p-6 sm:!p-8">
              <h2 className="ui-h3 !text-white">Not sure which you need?</h2>
              <p className="mt-2 max-w-[54ch] text-[15px] leading-[1.6] text-[color:var(--ui-on-dark-2)]">
                If the list is small and ongoing, membership starts at ${cheapest.price} a month. If it is one job, book a
                single visit. If you are planning a renovation, that is an estimate conversation instead. A real person
                can tell you which in a couple of minutes.
              </p>
              <div className="pg-actions pg-actions--stack">
                <Link href="/membership/plans" className="ui-btn ui-btn--light">
                  See membership plans
                </Link>
                <a href={CUSTOMER_CARE.callHref} className="ui-btn ui-btn--outline-light">
                  Call {CUSTOMER_CARE.phoneDisplay}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/** A long section, closed under its H2. The content is server-rendered either way. */
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="pg-fold">
      <summary>
        <h2 className="pg-fold__title">{title}</h2>
      </summary>
      <div className="pg-fold__body pg-prose">{children}</div>
    </details>
  );
}
