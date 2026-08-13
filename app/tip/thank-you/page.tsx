"use client";

/**
 * Where Stripe sends the customer back to.
 *
 * Two outcomes, one page. A completed tip gets a thank you; an abandoned one
 * gets a clear "nothing was charged" rather than a page that looks like a
 * failure. Neither says anything about amounts or Fixters: the payment is
 * confirmed by the webhook, and a page that reported success from a URL
 * parameter would be claiming something it cannot know.
 */

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function TipOutcome() {
  const canceled = useSearchParams().get("status") === "canceled";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF2FF] px-5">
      <div className="w-full max-w-sm rounded-[10px] bg-white p-8 text-center shadow-[0_18px_48px_rgba(11,22,40,0.10)]">
        {canceled ? (
          <>
            <h1 className="text-lg font-black text-[#0B1628]">No tip was sent</h1>
            <p className="mt-2 text-sm text-slate-500">
              Nothing was charged. Thank you for choosing Profixter either way.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
              🤍
            </div>
            <h1 className="mt-5 text-lg font-black text-[#0B1628]">Thank you</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your tip goes straight to the Fixter who looked after your home.
              Stripe will email you a receipt.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-[8px] bg-[#0B1628] px-5 py-3 text-sm font-bold text-white"
        >
          Back to Profixter
        </Link>
      </div>
    </main>
  );
}

export default function TipThankYouPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#EEF2FF] px-5">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </main>
      }
    >
      <TipOutcome />
    </Suspense>
  );
}
