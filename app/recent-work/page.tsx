import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";

export const metadata: Metadata = {
  title: "What We Fix | Profixter",
  description:
    "Photographs of real handyman jobs finished by Profixter across Long Island - doors, drywall, caulking, fixtures, mounting, shelving and the rest of the everyday list a membership is meant for.",
  alternates: { canonical: "https://www.profixter.com/recent-work" },
  openGraph: {
    title: "What We Fix | Profixter",
    description:
      "Real handyman jobs finished across Long Island, and the kind of work a Profixter membership is meant for.",
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
        eyebrow="What we fix"
        heading="The work a membership is for"
        subheading="Every photo is a real job in a real Long Island home, done by the same team that would come to yours. Bigger renovations are quoted separately."
      />
      <Footer />
    </main>
  );
}
