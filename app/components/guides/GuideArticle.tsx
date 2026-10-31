import Link from "next/link";
import { Breadcrumbs, ConversionBand, SeoPageShell } from "@/app/components/seo/SeoPageComponents";
import PlanComparisonTable from "@/app/components/membership/PlanComparisonTable";
import GuideText, { plainText } from "@/app/components/guides/GuideText";
import MembershipCalculator from "@/app/components/guides/MembershipCalculator";
import PrintableChecklist from "@/app/components/guides/PrintableChecklist";
import { plans } from "@/app/data/content";
import { GUIDE_CATEGORY_LABELS, getGuide } from "@/lib/guides";
import type { Guide, GuideBlock } from "@/lib/guides/types";
import { getFullDayOffer, getOneTimeOffer, type FullDayOffer, type OneTimeOffer } from "@/lib/offers";
import { LICENSE_PHRASE, SHORT_DESCRIPTION, STANDARD_VISIT_MINUTES } from "@/lib/business";
import { BUSINESS_PHONE_DISPLAY, DEFAULT_OG_IMAGE, SITE_URL, absoluteUrl } from "@/lib/seo";
import { DATA_AS_OF, TASK_MIX, TOWNS_WITH_COMPLETED_WORK } from "@/lib/profixter-data";

/**
 * One homeowner guide, rendered entirely on the server.
 *
 * The reading column is deliberately narrow and plain. These pages exist to
 * answer a question well enough to be worth citing, and they reach the
 * Profixter options only after the question is answered - the answer box comes
 * first, the conversion band last.
 */

const H2 = "mt-12 scroll-mt-24 text-[24px] font-semibold leading-[1.15] tracking-[-0.03em] text-[color:var(--ui-ink)] sm:text-[29px]";
const H3 = "mt-8 text-[19px] font-semibold leading-tight text-[color:var(--ui-ink)]";
const P = "mt-4 text-[16px] leading-[1.75] text-[color:var(--ui-text-2)] sm:text-[17px]";
const LI = "flex gap-3 text-[16px] leading-[1.7] text-[color:var(--ui-text-2)] sm:text-[17px]";

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function readingMinutes(guide: Guide) {
  const words = guide.body
    .map((block) => {
      if ("text" in block) return block.text;
      if (block.t === "ul" || block.t === "ol") return block.items.join(" ");
      if (block.t === "table") return block.rows.flat().join(" ");
      if (block.t === "qa") return block.items.map((i) => `${i.q} ${i.a}`).join(" ");
      return "";
    })
    .join(" ")
    .split(/\s+/).length;
  return Math.max(2, Math.round(words / 230));
}

function OffersBlock({ oneTime, fullDay }: { oneTime: OneTimeOffer; fullDay: FullDayOffer }) {
  const lowest = Math.min(...plans.map((plan) => plan.price));
  const rows = [
    {
      name: "Free Visit",
      price: "Free",
      body: "A free in-person visit in Nassau and Suffolk to go over your to-do list and find the right service. No labor included.",
      href: "/book/free",
    },
    {
      name: "One-Time Visit",
      price: `$${oneTime.priceDollars}`,
      body: `Up to ${oneTime.minutes} minutes for one small job from a set list. No membership.`,
      href: "/book?visit=additional",
    },
    {
      name: "Membership",
      price: `From $${lowest}/mo`,
      body: `${STANDARD_VISIT_MINUTES}-minute visits for the running list, booked as often as you need. The plan sets how many can be booked at the same time.`,
      href: "/membership/plans",
    },
    {
      name: "Full Day",
      price: `$${fullDay.priceDollars}`,
      body: `About ${fullDay.hours} hours for a longer list or a bigger handyman job.`,
      href: "/book?visit=full-day",
    },
  ];
  return (
    <div className="my-8 grid gap-2.5 sm:grid-cols-2">
      {rows.map((row) => (
        <Link
          key={row.name}
          href={row.href}
          className="group rounded-[10px] border border-[color:var(--ui-line)] bg-white p-4 transition hover:border-[#BFD2FF] hover:shadow-[0_16px_46px_rgba(48,110,236,0.08)]"
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-semibold text-[color:var(--ui-ink)]">{row.name}</span>
            <span className="text-[15px] font-semibold tabular-nums text-[color:var(--ui-accent-ink)]">{row.price}</span>
          </span>
          <span className="mt-1.5 block text-[14px] leading-6 text-[color:var(--ui-text-3)]">{row.body}</span>
        </Link>
      ))}
    </div>
  );
}

function TaskMixBlock() {
  return (
    <div className="relative my-8 overflow-x-auto rounded-[12px] border border-[color:var(--ui-line)] bg-white">
      <table className="w-full border-collapse text-left text-[15px]">
        <caption className="px-4 pt-4 text-left text-[13px] leading-5 text-[color:var(--ui-text-3)]">
          Rough share of Profixter visit requests that mention each kind of work, read by keyword from what customers
          wrote when booking. About 850 completed visits across Nassau and Suffolk, August 2025 to {DATA_AS_OF}. One
          request can mention several.
        </caption>
        <thead>
          <tr className="border-b border-[color:var(--ui-line)]">
            <th scope="col" className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--ui-text-3)]">Kind of work</th>
            <th scope="col" className="px-4 py-3 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--ui-text-3)]">Requests mentioning it</th>
          </tr>
        </thead>
        <tbody>
          {TASK_MIX.map((row) => (
            <tr key={row.label} className="border-b border-[color:var(--ui-line)] last:border-b-0">
              <th scope="row" className="px-4 py-2.5 font-medium text-[color:var(--ui-text-2)]">{row.label}</th>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <span className="inline-flex items-center justify-end gap-2.5">
                  <span aria-hidden="true" className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[#EEF2F7] sm:inline-block">
                    <span className="block h-full rounded-full bg-[#306EEC]" style={{ width: `${(row.percent / 25) * 100}%` }} />
                  </span>
                  <span className="w-10 font-bold text-[color:var(--ui-ink)]">~{row.percent}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TownProofBlock() {
  return (
    <div className="my-8 grid gap-4 sm:grid-cols-2">
      {(Object.keys(TOWNS_WITH_COMPLETED_WORK) as (keyof typeof TOWNS_WITH_COMPLETED_WORK)[]).map((county) => (
        <div key={county} className="rounded-[10px] border border-[color:var(--ui-line)] bg-white p-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ui-ink)]">{county}</p>
          <p className="mt-2 text-[14px] leading-6 text-[color:var(--ui-text-2)]">{TOWNS_WITH_COMPLETED_WORK[county].join(", ")}</p>
        </div>
      ))}
    </div>
  );
}

function Block({ block, oneTime, fullDay }: { block: GuideBlock; oneTime: OneTimeOffer; fullDay: FullDayOffer }) {
  switch (block.t) {
    case "answer":
      return (
        <div className="mt-8 rounded-[12px] border border-[#CFE0FF] bg-[#F3F7FF] p-5 sm:p-6">
          <p className="ui-eyebrow ui-eyebrow--accent !mb-0">The short answer</p>
          <p className="mt-2.5 text-[17px] leading-[1.7] text-[color:var(--ui-ink)] sm:text-[18px]">
            <GuideText text={block.text} />
          </p>
        </div>
      );
    case "p":
      return (
        <p className={P}>
          <GuideText text={block.text} />
        </p>
      );
    case "h2":
      return (
        <h2 id={block.id} className={H2}>
          {block.text}
        </h2>
      );
    case "h3":
      return <h3 className={H3}>{block.text}</h3>;
    case "ul":
      return (
        <ul className="mt-4 grid gap-2.5">
          {block.items.map((item) => (
            <li key={item} className={LI}>
              <span aria-hidden="true" className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#306EEC]" />
              <span>
                <GuideText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-4 grid gap-3">
          {block.items.map((item, index) => (
            <li key={item} className={LI}>
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[13px] font-semibold text-[color:var(--ui-accent-ink)]"
              >
                {index + 1}
              </span>
              <span>
                <GuideText text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="my-7">
          <div className="relative overflow-x-auto rounded-[12px] border border-[color:var(--ui-line)] bg-white">
            <table className="w-full min-w-[520px] border-collapse text-left text-[14.5px] leading-6">
              <caption className="sr-only">{block.caption}</caption>
              <thead>
                <tr className="border-b border-[color:var(--ui-line)] bg-[color:var(--ui-bg-soft)]">
                  {block.head.map((cell) => (
                    <th key={cell} scope="col" className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--ui-text-3)]">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.join("|")} className="border-b border-[color:var(--ui-line)] align-top last:border-b-0">
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={index} scope="row" className="px-4 py-3 font-semibold text-[color:var(--ui-ink)]">
                          <GuideText text={cell} />
                        </th>
                      ) : (
                        <td key={index} className="px-4 py-3 text-[color:var(--ui-text-2)]">
                          <GuideText text={cell} />
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note ? (
            <p className="mt-2 text-[13px] leading-6 text-[color:var(--ui-text-3)]">
              <GuideText text={block.note} />
            </p>
          ) : null}
        </div>
      );
    case "callout":
      return (
        <div
          className={`my-7 rounded-[12px] p-5 sm:p-6 ${
            block.tone === "profixter" ? "bg-[#0B1628] text-white" : "border border-[#E7E2CF] bg-[#FFFBEF]"
          }`}
        >
          {block.title ? (
            <p className={`text-[16px] font-semibold ${block.tone === "profixter" ? "text-white" : "text-[color:var(--ui-ink)]"}`}>
              {block.title}
            </p>
          ) : null}
          <p
            className={`mt-1.5 text-[15.5px] leading-[1.7] ${
              block.tone === "profixter" ? "text-white/80 [&_a]:text-[#9DBDFF] [&_strong]:text-white" : "text-[#3F3A2A]"
            }`}
          >
            <GuideText text={block.text} />
          </p>
        </div>
      );
    case "qa":
      return (
        <dl className="mt-5 divide-y divide-[color:var(--ui-line)] border-y border-[color:var(--ui-line)]">
          {block.items.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-[17px] font-semibold leading-snug text-[color:var(--ui-ink)]">{item.q}</dt>
              <dd className="mt-2 text-[16px] leading-[1.7] text-[color:var(--ui-text-2)]">
                <GuideText text={item.a} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "checklist":
      return (
        <PrintableChecklist title={block.title} intro={block.intro} groups={block.groups} blankLines={block.blankLines} />
      );
    case "component":
      if (block.name === "plan-table")
        return <PlanComparisonTable bare headingLevel={3} title="Profixter membership plans" />;
      if (block.name === "offers") return <OffersBlock oneTime={oneTime} fullDay={fullDay} />;
      if (block.name === "membership-calculator") return <MembershipCalculator oneTimePrice={oneTime.priceDollars} />;
      if (block.name === "task-mix") return <TaskMixBlock />;
      if (block.name === "town-proof") return <TownProofBlock />;
      return null;
    default:
      return null;
  }
}

export default async function GuideArticle({ guide }: { guide: Guide }) {
  const [oneTime, fullDay] = await Promise.all([getOneTimeOffer(), getFullDayOffer()]);
  const url = absoluteUrl(`/guides/${guide.slug}`);
  const related = guide.related.map((slug) => getGuide(slug)).filter((g): g is Guide => Boolean(g));
  const answer = guide.body.find((block) => block.t === "answer");

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: guide.title,
    description: guide.metaDescription,
    abstract: answer && "text" in answer ? plainText(answer.text) : undefined,
    datePublished: guide.published,
    dateModified: guide.updated,
    inLanguage: "en-US",
    mainEntityOfPage: url,
    image: `${SITE_URL}${DEFAULT_OG_IMAGE.url}`,
    author: { "@id": `${SITE_URL}/#business` },
    publisher: { "@id": `${SITE_URL}/#business` },
    about: guide.category === "membership" ? { "@id": `${SITE_URL}/#membership` } : undefined,
    citation: guide.sources?.map((source) => source.url),
  };

  return (
    <SeoPageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <main>
        <article className="px-4 pb-12 pt-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px]">
            <Breadcrumbs
              items={[
                { label: "Guides", href: "/guides" },
                { label: guide.title, href: `/guides/${guide.slug}` },
              ]}
            />
            <p className="ui-eyebrow ui-eyebrow--accent !mb-0">
              {GUIDE_CATEGORY_LABELS[guide.category]} · Long Island
            </p>
            <h1 className="ui-display mt-4">
              {guide.title}
            </h1>
            <p className="mt-4 text-[17px] leading-[1.6] text-[color:var(--ui-text-2)] sm:text-[19px]">{guide.dek}</p>
            <p className="mt-4 text-[13px] font-semibold text-[color:var(--ui-text-3)]">
              Updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time> · By Profixter, Lindenhurst, NY ·{" "}
              {readingMinutes(guide)} min read
            </p>

            {guide.body.map((block, index) => (
              <Block key={index} block={block} oneTime={oneTime} fullDay={fullDay} />
            ))}

            {guide.sources?.length ? (
              <section aria-labelledby="sources" className="mt-12 border-t border-[color:var(--ui-line)] pt-6">
                <h2 id="sources" className="text-[15px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ui-ink)]">
                  Sources
                </h2>
                <ul className="mt-3 grid gap-1.5">
                  {guide.sources.map((source) => (
                    <li key={source.url} className="text-[14px] leading-6 text-[color:var(--ui-text-3)]">
                      <a href={source.url} rel="noopener" className="underline underline-offset-2 hover:text-[color:var(--ui-accent-ink)]">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <aside className="mt-10 rounded-[12px] border border-[color:var(--ui-line)] bg-white p-5 sm:p-6">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ui-ink)]">About Profixter</p>
              <p className="mt-2 text-[15px] leading-[1.7] text-[color:var(--ui-text-2)]">
                {SHORT_DESCRIPTION} {LICENSE_PHRASE}; fully insured. Questions:{" "}
                <a href={`tel:${BUSINESS_PHONE_DISPLAY}`} className="font-semibold text-[color:var(--ui-accent-ink)]">
                  {BUSINESS_PHONE_DISPLAY}
                </a>
                .{" "}
                <Link href="/handyman-membership" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
                  How the membership works
                </Link>
              </p>
            </aside>
          </div>
        </article>

        {related.length ? (
          <section className="px-4 pb-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[760px]">
              <h2 className="text-[20px] font-semibold text-[color:var(--ui-ink)]">Related guides</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/guides/${item.slug}`}
                    className="rounded-[10px] border border-[color:var(--ui-line)] bg-white p-4 transition hover:border-[#BFD2FF]"
                  >
                    <span className="block text-[16px] font-semibold leading-snug text-[color:var(--ui-ink)]">{item.title}</span>
                    <span className="mt-1.5 block text-[14px] leading-6 text-[color:var(--ui-text-3)]">{item.summary}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <ConversionBand
          title="When you are ready, pick the way that fits."
          description="One small job: a One-Time Visit. A running list: a membership. Not sure yet: start with a free visit to go over your to-do list."
        />
      </main>
    </SeoPageShell>
  );
}
