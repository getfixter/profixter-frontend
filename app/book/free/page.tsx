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
 * Signed out, it is the one-step guest request (name, mobile, email) - this is
 * where follow-up emails and the Google Business Profile button land, so nobody
 * is sent through /signup first. Signup and sign-in still return here
 * (?next=/book/free), and autoResume creates the
 * booking the visitor already asked for from their saved draft, so nothing is
 * entered twice. Opened directly, it is simply the booker.
 */
export default function FreeVisitPage() {
  return (
    <div className="pg-flow pg-flow--free min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="ui-section ui-section--tight ui-section--soft">
        <div className="ui-container pg-plans__grid">
          <div className="pg-plans__intro pg-intro ui-rise">
            <p className="ui-tag ui-tag--accent">
              <span className="ui-tag__dot" aria-hidden="true" />
              Free first visit
            </p>
            <h1 className="ui-display mt-4">Book your free visit.</h1>
            <p className="ui-lede">90 minutes with a Fixter. One per customer. No card needed.</p>
            <div className="pg-plans__aside">
              <ul className="ui-checks">
                <li>Describe the job and add a photo or an example</li>
                <li>Pick a real open time</li>
                <li>New Nassau &amp; Suffolk customers</li>
              </ul>
            </div>
          </div>
          <div className="ui-rise" style={{ animationDelay: "60ms" }}>
            <FreeVisitBooker id="book" autoResume guest />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
