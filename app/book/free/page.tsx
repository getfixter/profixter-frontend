import type { Metadata } from "next";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import FreeVisitForm from "@/app/components/booking4/FreeVisitForm";

export const metadata: Metadata = {
  title: "Book Your Free Visit | Profixter",
  description:
    "Let's take a look at your to-do list. Book a free visit on Long Island: we'll visit your home, go over your list and help you find the right Profixter service. No account needed.",
  alternates: { canonical: "/book/free" },
};

/**
 * The Free Visit (from 2026-10-30): a free visit to go over the customer's
 * to-do list - no labor, no account. Name, phone, email, address, a day and a
 * time; the server reserves the slot pending the owner's approval. This is
 * where follow-up emails, the Google Business Profile button and the homepage's
 * "Free Visit" button land.
 */
export default function FreeVisitPage() {
  return (
    <div className="pg-flow pg-flow--free min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="ui-section--soft">
        <FreeVisitForm />
      </main>
      <Footer />
    </div>
  );
}
