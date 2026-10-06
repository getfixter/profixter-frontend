import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import FreeVisitBooker from "@/app/components/booking/FreeVisitBooker";

export const metadata: Metadata = {
  title: "Book Your Free First Visit | Profixter",
  description:
    "Book a free 90-minute handyman visit on Long Island. Describe the job, pick a real time, and a Fixter comes to your home.",
  alternates: { canonical: "/book/free" },
};

/**
 * The free-visit booker on its own page.
 *
 * Signup and sign-in return here (?next=/book/free), and autoResume creates the
 * booking the visitor already asked for from their saved draft, so nothing is
 * entered twice. Opened directly, it is simply the booker.
 */
export default function FreeVisitPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="lx-root lx-hero px-4 pb-16 pt-8 sm:pt-12">
        <div className="mx-auto max-w-[620px]">
          <p className="lx-pill">
            <b>Free</b> First 90-minute visit
          </p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.05] tracking-[-0.04em] text-[#0B1628] sm:text-[44px]">
            Book your free visit.
          </h1>
          <p className="mt-2 text-[16px] text-[#5b6577]">One per home. No card needed.</p>
          <div className="mt-6">
            <FreeVisitBooker id="book" autoResume />
          </div>
        </div>
      </main>
      <div className="relative z-20">
        <Footer />
      </div>
    </div>
  );
}
