import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import BookConfirmationTracker from "./BookConfirmationTracker";

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
      <section className="mx-auto grid min-h-[70svh] max-w-[820px] content-center px-4 py-12 text-center sm:px-6 lg:px-8">
        <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-sm font-black uppercase tracking-[0.12em] text-emerald-700">
            Paid
          </div>
          <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Payment received.
          </h1>
          <p className="mx-auto mt-4 max-w-[620px] text-base leading-7 text-slate-600">
            Your One-Time Handyman Visit request is paid and waiting for final admin approval. We will review the details, confirm the appointment, and assign the technician.
          </p>

          <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            {[
              ["1", "Paid", "Your checkout was received."],
              ["2", "Pending", "Admin reviews the request."],
              ["3", "Confirmed", "A technician is assigned."],
            ].map(([step, title, body]) => (
              <div key={title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-blue-700">Step {step}</div>
                <div className="mt-1 text-sm font-black text-slate-950">{title}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
              </div>
            ))}
          </div>

          {params.booking_id && (
            <div className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">
              Booking reference: {params.booking_id}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/account?tab=bookings" className="rounded-[8px] bg-blue-600 px-5 py-3 text-sm font-black text-white">
              View my bookings
            </Link>
            <Link href="/home-support" className="rounded-[8px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-900">
              Ask Home Support AI
            </Link>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-500">
            Need to change something? Call 631-599-1363. Reschedules and cancellations require admin approval.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
