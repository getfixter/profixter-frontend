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

const H2 = "mt-12 scroll-mt-24 text-[24px] font-black leading-[1.15] tracking-[-0.03em] text-[#0B1628] sm:text-[29px]";
const H3 = "mt-8 text-[19px] font-black leading-tight text-[#0B1628]";
const P = "mt-4 text-[16px] leading-[1.75] text-[#334155] sm:text-[17px]";
const LI = "flex gap-3 text-[16px] leading-[1.7] text-[#334155] sm:text-[17px]";

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
      name: "Free first visit",
      price: "Free",
      body: `A ${STANDARD_VISIT_MINUTES}-minute first visit for new Nassau and Suffolk customers, one per home.`,
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
          className="group rounded-[10px] border border-[#DDE5F0] bg-white p-4 transition hover:border-[#BFD2FF] hover:shadow-[0_16px_46px_rgba(48,110,236,0.08)]"
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-black text-[#0B1628]">{row.name}</span>
            <span className="text-[15px] font-black tabular-nums text-[#306EEC]">{row.price}</span>
          </span>
          <span className="mt-1.5 block text-[14px] leading-6 text-[#64748B]">{row.body}</span>
        </Link>
      ))}
    </div>
  );
}

function TaskMixBlock() {
  return (
    <div className="my-8 overflow-x-auto rounded-[12px] border border-[#DDE5F0] bg-white">
      <table className="w-full border-collapse text-left text-[15px]">
        <caption className="px-4 pt-4 text-left text-[13px] leading-5 text-[#64748B]">
          Rough share of Profixter visit requests that mention each kind of work, read by keyword from what customers
          wrote when booking. About 850 completed visits across Nassau and Suffolk, August 2025 to {DATA_AS_OF}. One
          request can mention several.
        </caption>
        <thead>
          <tr className="border-b border-[#E3E8F1]">
            <th scope="col" className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748B]">Kind of work</th>
            <th scope="col" className="px-4 py-3 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748B]">Requests mentioning it</th>
          </tr>
        </thead>
        <tbody>
          {TASK_MIX.map((row) => (
            <tr key={row.label} className="border-b border-[#EEF2F7] last:border-b-0">
              <th scope="row" className="px-4 py-2.5 font-medium text-[#334155]">{row.label}</th>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <span className="inline-flex items-center justify-end gap-2.5">
                  <span aria-hidden="true" className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[#EEF2F7] sm:inline-block">
                    <span className="block h-full rounded-full bg-[#306EEC]" style={{ width: `${(row.percent / 25) * 100}%` }} />
                  </span>
                  <span className="w-10 font-bold text-[#0B1628]">~{row.percent}%</span>
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
        <div key={county} className="rounded-[10px] border border-[#DDE5F0] bg-white p-4">
          <p className="text-[13px] font-black uppercase tracking-[0.1em] text-[#0B1628]">{county}</p>
          <p className="mt-2 text-[14px] leading-6 text-[#475569]">{TOWNS_WITH_COMPLETED_WORK[county].join(", ")}</p>
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
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">The short answer</p>
          <p className="mt-2.5 text-[17px] leading-[1.7] text-[#0B1628] sm:text-[18px]">
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
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[13px] font-black text-[#306EEC]"
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
          <div className="overflow-x-auto rounded-[12px] border border-[#DDE5F0] bg-white">
            <table className="w-full min-w-[520px] border-collapse text-left text-[14.5px] leading-6">
              <caption className="sr-only">{block.caption}</caption>
              <thead>
                <tr className="border-b border-[#E3E8F1] bg-[#F8FAFF]">
                  {block.head.map((cell) => (
                    <th key={cell} scope="col" className="px-4 py-3 text-[12px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={row.join("|")} className="border-b border-[#EEF2F7] align-top last:border-b-0">
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <th key={index} scope="row" className="px-4 py-3 font-semibold text-[#0B1628]">
                          <GuideText text={cell} />
                        </th>
                      ) : (
                        <td key={index} className="px-4 py-3 text-[#334155]">
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
            <p className="mt-2 text-[13px] leading-6 text-[#64748B]">
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
            <p className={`text-[16px] font-black ${block.tone === "profixter" ? "text-white" : "text-[#0B1628]"}`}>
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
        <dl className="mt-5 divide-y divide-[#E3E8F1] border-y border-[#E3E8F1]">
          {block.items.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-[17px] font-black leading-snug text-[#0B1628]">{item.q}</dt>
              <dd className="mt-2 text-[16px] leading-[1.7] text-[#334155]">
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
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
              {GUIDE_CATEGORY_LABELS[guide.category]} · Long Island
            </p>
            <h1 className="mt-4 text-[32px] font-black leading-[1.02] tracking-[-0.04em] text-[#0B1628] sm:text-[44px]">
              {guide.title}
            </h1>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#475569] sm:text-[19px]">{guide.dek}</p>
            <p className="mt-4 text-[13px] font-semibold text-[#64748B]">
              Updated <time dateTime={guide.updated}>{formatDate(guide.updated)}</time> · By Profixter, Lindenhurst, NY ·{" "}
              {readingMinutes(guide)} min read
            </p>

            {guide.body.map((block, index) => (
              <Block key={index} block={block} oneTime={oneTime} fullDay={fullDay} />
            ))}

            {guide.sources?.length ? (
              <section aria-labelledby="sources" className="mt-12 border-t border-[#E3E8F1] pt-6">
                <h2 id="sources" className="text-[15px] font-black uppercase tracking-[0.1em] text-[#0B1628]">
                  Sources
                </h2>
                <ul className="mt-3 grid gap-1.5">
                  {guide.sources.map((source) => (
                    <li key={source.url} className="text-[14px] leading-6 text-[#64748B]">
                      <a href={source.url} rel="noopener" className="underline underline-offset-2 hover:text-[#306EEC]">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <aside className="mt-10 rounded-[12px] border border-[#DDE5F0] bg-white p-5 sm:p-6">
              <p className="text-[13px] font-black uppercase tracking-[0.1em] text-[#0B1628]">About Profixter</p>
              <p className="mt-2 text-[15px] leading-[1.7] text-[#475569]">
                {SHORT_DESCRIPTION} {LICENSE_PHRASE}; fully insured. Questions:{" "}
                <a href={`tel:${BUSINESS_PHONE_DISPLAY}`} className="font-semibold text-[#306EEC]">
                  {BUSINESS_PHONE_DISPLAY}
                </a>
                .{" "}
                <Link href="/handyman-membership" className="font-semibold text-[#306EEC] underline underline-offset-2">
                  How the membership works
                </Link>
              </p>
            </aside>
          </div>
        </article>

        {related.length ? (
          <section className="px-4 pb-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[760px]">
              <h2 className="text-[20px] font-black text-[#0B1628]">Related guides</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/guides/${item.slug}`}
                    className="rounded-[10px] border border-[#DDE5F0] bg-white p-4 transition hover:border-[#BFD2FF]"
                  >
                    <span className="block text-[16px] font-black leading-snug text-[#0B1628]">{item.title}</span>
                    <span className="mt-1.5 block text-[14px] leading-6 text-[#64748B]">{item.summary}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <ConversionBand
          title="When you are ready, pick the way that fits."
          description="One small job: a One-Time Visit. A running list: a membership. New customer in Nassau or Suffolk: start with a free first visit."
        />
      </main>
    </SeoPageShell>
  );
}
