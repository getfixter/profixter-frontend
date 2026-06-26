import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import BookConfirmationTracker from "./BookConfirmationTracker";

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
    <main className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <BookConfirmationTracker
        bookingId={params.booking_id}
        sessionId={params.session_id}
      />
      <Header />

      <section className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="mb-5 inline-flex items-center gap-2.5 rounded-[8px] border border-emerald-200 bg-white px-3 py-2">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500"
            style={{ boxShadow: "0 0 8px rgba(16,185,129,0.7)" }}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            One-Time Visit
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-7 lg:col-span-7">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Paid
            </div>
            <h1 className="text-[30px] font-black leading-[1.04] text-[#0B1628] sm:text-[42px]">
              Payment received. Your request is pending approval.
            </h1>
            <p className="mt-4 max-w-[640px] text-[15px] leading-7 text-[#475569] sm:text-[16px]">
              Thank you. Your paid One-Time Handyman Visit request is now with Profixter for approval. If approved, Profixter will come at the scheduled visit time and you will receive confirmation shortly.
            </p>

            <div className="mt-6 rounded-[16px] border border-[#D9E4FF] bg-[#F0F7FF] px-4 py-4 text-[14px] leading-6 text-[#475569]">
              If we cannot approve the job, cannot complete it within the One-Time Visit scope, or need to cancel before service, you will receive a full refund.
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/account?tab=bookings"
                className="inline-flex h-[52px] items-center justify-center rounded-[16px] bg-[#306EEC] px-5 text-[15px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#2558c9] active:scale-[0.99]"
                style={{ boxShadow: "0 16px 48px rgba(48,110,236,0.30)" }}
              >
                View my bookings
              </Link>
              <Link
                href="/home-support"
                className="inline-flex h-[52px] items-center justify-center rounded-[16px] border border-[#C5CBD8] bg-white px-5 text-[15px] font-extrabold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC] active:scale-[0.99]"
              >
                Ask Profixter AI
              </Link>
            </div>
          </div>

          <aside className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-6 lg:col-span-5">
            <h2 className="text-[20px] font-extrabold text-[#0B1628]">
              Calm next steps
            </h2>
            <div className="mt-4 space-y-3">
              {nextSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="rounded-[14px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-3"
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#306EEC]">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-[14px] font-extrabold text-[#0B1628]">
                    {step.label}
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-[#64748B]">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            {params.booking_id && (
              <div className="mt-4 rounded-[14px] border border-[#E5E9F2] bg-white px-4 py-3 text-[13px] font-semibold text-[#64748B]">
                Booking reference
                <div className="mt-1 break-all text-[14px] font-extrabold text-[#0B1628]">
                  {params.booking_id}
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] lg:col-span-2">
            <h2 className="text-[18px] font-extrabold text-[#0B1628]">
              Before the visit
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {prepNotes.map((note) => (
                <div key={note} className="flex gap-2 rounded-[14px] bg-[#F8FAFF] px-4 py-3">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className="mt-0.5 flex-shrink-0 text-[#306EEC]"
                  >
                    <path
                      d="M5 12.5l4 4 10-10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.4"
                    />
                  </svg>
                  <span className="text-[13px] font-semibold leading-5 text-[#475569]">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
            <h2 className="text-[18px] font-extrabold text-[#0B1628]">
              Need to change something?
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
              Call{" "}
              <a href="tel:631-599-1363" className="font-extrabold text-[#306EEC]">
                631-599-1363
              </a>
              . One-Time Visit cancellation or reschedule requests require admin approval and are not handled with a one-click cancel button in your account.
            </p>
            <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
              Larger or multi-day work should use a Project Estimate instead of a One-Time Visit.
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-flex h-[44px] items-center rounded-[14px] border border-[#C5CBD8] px-4 text-[14px] font-extrabold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC]"
            >
              Request a Project Estimate
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
