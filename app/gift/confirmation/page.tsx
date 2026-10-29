import { Suspense } from "react";
import type { Metadata } from "next";

import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import GiftConfirmationClient from "./GiftConfirmationClient";
import "../gift.css";

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
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="min-h-[70vh]">
        <Suspense
          fallback={
            <div className="py-20 text-center">
              <div className="gf-spinner" role="status" aria-label="Loading" />
            </div>
          }
        >
          <GiftConfirmationClient />
        </Suspense>
      </main>
      <Footer compact />
    </div>
  );
}
