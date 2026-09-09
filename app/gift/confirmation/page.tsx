import { Suspense } from "react";
import type { Metadata } from "next";

import GiftConfirmationClient from "./GiftConfirmationClient";

export const metadata: Metadata = {
  title: "Gift confirmed | ProFixter",
  robots: { index: false, follow: false },
};

/**
 * Where Stripe returns the purchaser after a successful gift payment.
 *
 * Reading ?session_id needs useSearchParams, which needs a Suspense boundary
 * in the app router — the same pattern the signin page uses.
 */
export default function GiftConfirmationPage() {
  return (
    <main className="min-h-[70vh] bg-white">
      <Suspense
        fallback={
          <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E0E6F5] border-t-[#306EEC]"
              role="status"
              aria-label="Loading"
            />
          </div>
        }
      >
        <GiftConfirmationClient />
      </Suspense>
    </main>
  );
}
