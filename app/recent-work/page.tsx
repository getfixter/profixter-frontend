import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";

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
      <Footer />
    </main>
  );
}
