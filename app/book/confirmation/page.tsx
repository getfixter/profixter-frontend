import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import BookConfirmationTracker from "./BookConfirmationTracker";
import OneTimeBookingConfirmation from "./OneTimeBookingConfirmation";

const nextSteps = [
  {
    label: "Payment received",
    body: "Your One-Time Visit checkout is complete.",
  },
  {
    label: "Pending approval",
    body: "Profixter reviews the request, scope, photos, and schedule.",
  },
  {
    label: "Confirmation shortly",
    body: "Once approved, we confirm the visit and technician details.",
  },
];

const prepNotes = [
  "Each visit is up to 90 minutes.",
  "Please prepare or provide materials if materials are needed.",
  "Profixter brings the tools for the visit.",
  "One-Time Visit cancellations and reschedules are handled by phone.",
];

export default async function BookConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string; session_id?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[color:var(--ui-bg-soft)] text-[color:var(--ui-ink)]">
      <BookConfirmationTracker
        bookingId={params.booking_id}
        sessionId={params.session_id}
      />
      <OneTimeBookingConfirmation bookingId={params.booking_id} />
      <Header />

      <section className="ui-section ui-section--tight">
        <div className="ui-container ui-container--narrow">
          <div className="ui-card ui-card--raised !p-6 sm:!p-9">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#e7f5ec] text-[#1f8a4c]" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="ui-eyebrow !mb-0">One-Time Visit · Paid</p>
            </div>
            <h1 className="ui-h2 mt-5">Payment received. Your request is pending approval.</h1>
            <p className="ui-body mt-3 max-w-[60ch]">
              Thank you. Your paid One-Time Handyman Visit request is now with Profixter for approval. If approved, Profixter will come at the scheduled visit time and you will receive confirmation shortly.
            </p>

            {/* The customer's right, in plain sight. */}
            <p className="mt-4 rounded-[var(--ui-r-sm)] bg-[color:var(--ui-bg-soft)] px-4 py-3 text-[14px] leading-[1.55] text-[color:var(--ui-text-2)]">
              If we cannot approve the job, cannot complete it within the One-Time Visit scope, or need to cancel before service, you will receive a full refund.
            </p>

            <ol className="mt-6 grid gap-0 border-t border-[color:var(--ui-line)]">
              {nextSteps.map((step, index) => (
                <li key={step.label} className="flex gap-3 border-b border-[color:var(--ui-line)] py-3">
                  <span className="ui-num w-5 flex-none pt-px text-[13px] font-semibold text-[color:var(--ui-text-3)]">{index + 1}</span>
                  <span>
                    <span className="block text-[15px] font-medium text-[color:var(--ui-ink)]">{step.label}</span>
                    <span className="block text-[14px] leading-[1.5] text-[color:var(--ui-text-3)]">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>

            {params.booking_id && (
              <p className="mt-4 text-[14px] text-[color:var(--ui-text-3)]">
                Booking reference{" "}
                <span className="break-all font-medium text-[color:var(--ui-ink)]">{params.booking_id}</span>
              </p>
            )}

            <div className="pg-actions pg-actions--stack">
              <Link href="/book#your-visits" className="ui-btn ui-btn--primary">
                View my bookings
              </Link>
              <Link href="/membership/plans" className="ui-btn ui-btn--secondary">
                See membership plans
              </Link>
            </div>
          </div>

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
            <details className="pg-more">
              <summary>Need to change something?</summary>
              <div className="pg-more__body">
                <p>
                  Call{" "}
                  <a href="tel:631-599-1363" className="font-semibold text-[color:var(--ui-accent-ink)]">
                    631-599-1363
                  </a>
                  . One-Time Visit cancellation or reschedule requests require admin approval and are not handled with a one-click cancel button in your account.
                </p>
                <p>
                  Your appointment request will be reviewed by our team. We&rsquo;ll contact you if we need any additional details. Planning a bigger project as well? A free Project Estimate is available too.
                </p>
                <Link href="/projects" className="ui-link">
                  Request a Project Estimate
                </Link>
              </div>
            </details>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
