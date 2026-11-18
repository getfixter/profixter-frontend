import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import BookConfirmationTracker from "./BookConfirmationTracker";
import PaidVisitStatus from "./PaidVisitStatus";

/*
 * Where Stripe returns after a One-Time Visit or Full Day payment, for
 * customers with or without an account. Everything about the visit - what it
 * is, when, and whether the payment is recorded - comes from the server
 * (PaidVisitStatus); nothing here claims a payment by itself (2026-11-17).
 */

const prepNotes = [
  "A One-Time Visit is up to 90 minutes; a Full Day is about 8 hours with one Fixter.",
  "Please prepare or provide materials if materials are needed.",
  "Profixter brings the tools for the visit.",
  "Cancellations and reschedules are handled by phone.",
];

export default async function BookConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[color:var(--ui-bg-soft)] text-[color:var(--ui-ink)]">
      <BookConfirmationTracker bookingId={params.booking_id} sessionId={params.session_id} />
      <Header />

      <section className="ui-section ui-section--tight">
        <div className="ui-container ui-container--narrow">
          <PaidVisitStatus sessionId={params.session_id} />

          <div className="mt-4 grid gap-3">
            <details className="pg-more">
              <summary>Before the visit</summary>
              <div className="pg-more__body">
                <ul className="ui-checks">
                  {prepNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
