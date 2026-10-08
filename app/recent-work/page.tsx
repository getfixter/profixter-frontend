import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import Link from "next/link";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";
import { COMPLETED_VISITS_ROUNDED, DATA_AS_OF, DATA_SINCE, MULTI_TASK_VISIT_PERCENT, TASK_MIX } from "@/lib/profixter-data";

export const metadata: Metadata = {
  /*
   * The name on its own. The root layout appends " | Profixter" through its
   * title template, and this page carried the suffix itself as well - so the
   * browser tab, and every search result, read "... | Profixter | Profixter".
   * The Open Graph title below is not templated and keeps its own suffix.
   */
  title: "What We Do",
  description:
    "See the everyday work a Profixter membership covers - mounting, repairs, installations, replacements, adjustments and maintenance - in photographs of real jobs across Long Island.",
  alternates: { canonical: "https://www.profixter.com/recent-work" },
  openGraph: {
    title: "What We Do | Profixter",
    description:
      "The everyday work a Profixter membership covers - mounting, repairs, installations, replacements and maintenance - shown in real Long Island homes.",
    url: "https://www.profixter.com/recent-work",
    type: "website",
  },
};

/**
 * The browsable answer to "can they handle my thing?"
 *
 * Not a portfolio. The photographs exist to show what ordinary handyman work
 * looks like when a membership covers it - a door that will not close, grey
 * caulk, a fixture nobody swapped - so a homeowner can find their own job in
 * somebody else's house and stop wondering whether it counts.
 *
 * It keeps its own page because that library will grow, and because the
 * question is one people ask deliberately. The homepage carries a six-tile
 * sample; this is where the rest lives, with the category filter.
 */
export default function RecentWorkPage() {
  return (
    <main className="min-h-screen bg-[#060C18]">
      <Header />
      <RecentWorkSection
        variant="full"
        /*
         * Framed as coverage, not as a portfolio.
         *
         * "Real work completed by Profixter" is true and answers the wrong
         * question. Somebody weighing a membership is not asking whether we
         * have done work before; they are asking what they would be able to
         * book. These are the same photographs, introduced as the answer to
         * that question instead.
         *
         * The materials and renovations line stays. It is what keeps this
         * from reading as a promise that anything pictured is always covered
         * at no extra cost, which depends on the plan and the job.
         */
        eyebrow="What your membership covers"
        heading="See the kind of work included"
        subheading="Mounting, repairs, installations, replacements, adjustments and maintenance - real examples of the everyday jobs ProFixter members book, in real Long Island homes. Materials are separate, and bigger renovations are quoted on their own."
      />
      {/*
        What the photographs cannot say on their own. The gallery has no
        captions yet, so the page's text was a heading and a sentence; this is
        the same question - "would they do my kind of job?" - answered from the
        visit records, server-rendered, as dated aggregates.
      */}
      <section aria-labelledby="what-members-book" className="relative bg-[#060C18] pb-16 pt-4">
        <div className="mx-auto max-w-[880px] px-4 sm:px-6">
          <h2 id="what-members-book" className="text-[22px] font-extrabold tracking-[-0.02em] text-white sm:text-[28px]">
            What Long Island homeowners book most
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">
            From more than {COMPLETED_VISITS_ROUNDED} completed visits across Nassau and Suffolk since {DATA_SINCE}: the
            share of visit requests that mention each kind of work. About {MULTI_TASK_VISIT_PERCENT}% of visits cover
            two or more of them. As of {DATA_AS_OF}.
          </p>
          <ul className="mt-6 grid gap-2.5">
            {TASK_MIX.map((row) => (
              <li key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_160px_48px]">
                <span className="text-[14px] text-white/80 sm:text-[15px]">{row.label}</span>
                <span aria-hidden="true" className="hidden h-1.5 overflow-hidden rounded-full bg-white/10 sm:block">
                  <span className="block h-full rounded-full bg-[#306EEC]" style={{ width: `${(row.percent / 25) * 100}%` }} />
                </span>
                <span className="text-right text-[14px] font-bold tabular-nums text-white">~{row.percent}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14px] leading-relaxed text-white/55">
            Got a list like this?{" "}
            <Link href="/guides/handyman-for-small-jobs" className="font-semibold text-[#8FB2FF] underline underline-offset-2">
              How to get small jobs done
            </Link>{" "}
            ·{" "}
            <Link href="/handyman-membership" className="font-semibold text-[#8FB2FF] underline underline-offset-2">
              How the membership works
            </Link>
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
