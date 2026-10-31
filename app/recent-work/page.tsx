import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import Link from "next/link";
import WhatWeDo from "@/app/components/whatwedo/WhatWeDo";
import { getWhatWeDoPairs } from "@/lib/offers";
import { SITE_URL } from "@/lib/seo";
import { COMPLETED_VISITS_ROUNDED, DATA_AS_OF, DATA_SINCE, MULTI_TASK_REQUEST_PHRASE, TASK_MIX } from "@/lib/profixter-data";

export const metadata: Metadata = {
  /*
   * The name on its own. The root layout appends " | Profixter" through its
   * title template, and this page carried the suffix itself as well - so the
   * browser tab, and every search result, read "... | Profixter | Profixter".
   * The Open Graph title below is not templated and keeps its own suffix.
   */
  title: "What We Do",
  /*
   * No longer "photographs of real jobs": the gallery is now before/after
   * pairs, many of them illustrative examples, and the description must not
   * promise otherwise.
   */
  description:
    "Small fixes, done right: outlets, light fixtures, caulking, faucets, doors, trim, drywall and more. See before-and-after examples of the everyday handyman jobs Profixter handles on Long Island.",
  alternates: { canonical: "https://www.profixter.com/recent-work" },
  openGraph: {
    title: "What We Do | Profixter",
    description:
      "Small fixes, done right: before-and-after examples of the everyday handyman jobs Profixter handles on Long Island.",
    url: "https://www.profixter.com/recent-work",
    type: "website",
  },
};

/**
 * The browsable answer to "can they handle my thing?"
 *
 * Not a portfolio. The before/after pairs exist to show what ordinary
 * handyman work looks like - a scorched outlet, grey caulk, a fixture nobody
 * swapped - so a homeowner can find their own job and stop wondering whether
 * it counts. Many are illustrative examples, and the page says so.
 *
 * It keeps its own page (and its old URL) because that library will grow, and
 * because the question is one people ask deliberately. The homepage carries a
 * carousel; this is where every pair lives, with the kind-of-job filter.
 */
/* The pairs are re-read hourly for the structured data below. */
export const revalidate = 3600;

export default async function RecentWorkPage() {
  /*
   * The gallery itself renders in the browser; this gives search engines and
   * assistants the same pairs as data in the served HTML.
   *
   * Honestly labelled. Most pairs are illustrative examples (generated or
   * staged images of the kind of job), not photographs of a specific Profixter
   * job, so when any are, the gallery is named and described as examples and
   * each such image's caption starts "Illustrative example:". A real job pair
   * keeps its caption as written.
   */
  const pairs = await getWhatWeDoPairs(48);
  const illustrative = pairs.some((pair) => pair.illustrative);
  const galleryJsonLd = pairs.length
    ? {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        name: illustrative ? "What We Do: illustrative before-and-after examples" : "What We Do: before and after",
        description: illustrative
          ? "Illustrative before-and-after examples of the small home repairs Profixter handles. The images show the type of work; they are not photographs of specific customer jobs."
          : "Before-and-after photographs of small home repairs completed by Profixter.",
        url: `${SITE_URL}/recent-work`,
        provider: { "@id": `${SITE_URL}/#business` },
        associatedMedia: pairs.map((pair) => ({
          "@type": "ImageObject",
          contentUrl: pair.imageUrl,
          thumbnailUrl: pair.thumbUrl,
          name: pair.illustrative ? `Illustrative example: ${pair.title}` : pair.title,
          caption: pair.illustrative ? `Illustrative example: ${pair.caption}` : pair.caption,
          width: pair.width,
          height: pair.height,
        })),
      }
    : null;
  return (
    <main className="min-h-screen bg-white">
      {galleryJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(galleryJsonLd) }} />
      ) : null}
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      {/* Owns the page's one H1, rendered in the server HTML even before the pairs load. */}
      <WhatWeDo variant="page" />
      {/*
        What the photographs cannot say on their own. The gallery has no
        captions yet, so the page's text was a heading and a sentence; this is
        the same question - "would they do my kind of job?" - answered from the
        visit records, server-rendered, as dated aggregates.
      */}
      <section aria-labelledby="what-members-book" className="ui-section ui-section--soft ui-section--tight">
        <div className="ui-container ui-container--narrow">
          <h2 id="what-members-book" className="ui-h2">
            What Long Island homeowners book most
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--ui-text-2)]">
            From more than {COMPLETED_VISITS_ROUNDED} completed visits across Nassau and Suffolk since {DATA_SINCE}: the
            rough share of visit requests that mention each kind of work, read from what customers wrote when they
            booked. Lists are common: {MULTI_TASK_REQUEST_PHRASE}. As of {DATA_AS_OF}.
          </p>
          <ul className="mt-6 grid gap-2.5">
            {TASK_MIX.map((row) => (
              <li key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_160px_48px]">
                <span className="text-[14px] text-[color:var(--ui-ink)] sm:text-[15px]">{row.label}</span>
                <span aria-hidden="true" className="hidden h-1.5 overflow-hidden rounded-full bg-[color:var(--ui-line)] sm:block">
                  <span className="block h-full rounded-full bg-[#306EEC]" style={{ width: `${(row.percent / 25) * 100}%` }} />
                </span>
                <span className="text-right text-[14px] font-bold tabular-nums text-[color:var(--ui-ink)]">~{row.percent}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14px] leading-relaxed text-[color:var(--ui-text-3)]">
            Got a list like this?{" "}
            <Link href="/guides/handyman-for-small-jobs" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
              How to get small jobs done
            </Link>{" "}
            ·{" "}
            <Link href="/handyman-membership" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
              How the membership works
            </Link>
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
