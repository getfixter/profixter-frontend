import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";

export const metadata: Metadata = {
  title: "Recent Work | Profixter",
  description:
    "Photographs of real jobs finished by the Profixter team across Long Island - kitchens, bathrooms, drywall, doors, fixtures and more.",
  alternates: { canonical: "https://www.profixter.com/recent-work" },
  openGraph: {
    title: "Recent Work | Profixter",
    description: "Real jobs finished by the Profixter team across Long Island.",
    url: "https://www.profixter.com/recent-work",
    type: "website",
  },
};

/**
 * The browsable gallery.
 *
 * A page rather than only a homepage strip, because "show me what you have
 * actually done" is a question somebody asks deliberately, and the answer wants
 * room and a category filter rather than eight tiles between two other pitches.
 * The homepage teaser can point here once there is enough work to be worth the
 * trip.
 */
export default function RecentWorkPage() {
  return (
    <main className="min-h-screen bg-[#060C18]">
      <Header />
      <RecentWorkSection
        variant="full"
        heading="Work we have finished"
        subheading="Every photo here is a real job on Long Island, done by the same team that would come to your home."
      />
      <Footer />
    </main>
  );
}
