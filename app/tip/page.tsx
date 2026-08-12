"use client";

/**
 * The tip page.
 *
 * WHAT THIS REPLACED
 * A four line server redirect to a static Stripe Payment Link. One URL for
 * every customer and every Fixter, so a tip arrived at Stripe with nothing
 * attached to it and no way to tell whose work it was for.
 *
 * WHAT THE CUSTOMER SEES
 * The same thing as before: click the link in the completion email, land on
 * Stripe, type an amount, pay. This page is a redirect with a spinner, not a
 * form. The only visible difference is a moment on this screen while the
 * server opens a Checkout Session, and Stripe naming the Fixter on the way in.
 *
 * WHY IT REDIRECTS FROM JAVASCRIPT RATHER THAN ON THE SERVER
 * Email clients, link scanners and security appliances fetch links in messages.
 * A server redirect that created a Checkout Session would create one every time
 * a scanner touched the link. Doing it from the browser means only a person
 * opening the page starts a checkout.
 *
 * THE FALLBACK IS THE POINT
 * Whatever goes wrong, this must not become a dead end: a customer who wanted
 * to tip and met a broken page is lost money and a bad last impression. A
 * failure shows a retry and a way to reach a human, and never an error code.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CUSTOMER_CARE } from "@/lib/fixter";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type Phase = "opening" | "failed";

function TipRedirect() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("opening");
  const [attempt, setAttempt] = useState(0);

  /** Redirects and never returns on success; resolves false on any failure. */
  const openCheckout = useCallback(async () => {
    // Accept both spellings so an older link, or one a customer retyped, still
    // resolves. An absent token is not an error: it produces an unattributed
    // tip rather than a refusal.
    const token = searchParams.get("t") || searchParams.get("token") || "";

    try {
      const response = await fetch(`${API_URL}/api/tips/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.url) {
        window.location.replace(data.url);
        return true;
      }
    } catch {
      // Network, DNS, offline. Handled the same as any other failure.
    }

    return false;
  }, [searchParams]);

  useEffect(() => {
    let abandoned = false;
    void openCheckout().then((opened) => {
      if (!abandoned && !opened) setPhase("failed");
    });
    return () => {
      abandoned = true;
    };
  }, [openCheckout, attempt]);

  const retry = () => {
    setPhase("opening");
    setAttempt((value) => value + 1);
  };

  if (phase === "opening") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EEF2FF] px-5">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-[0_18px_48px_rgba(11,22,40,0.10)]">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <h1 className="mt-6 text-lg font-black text-[#0B1628]">
            Opening secure payment
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            One moment. You will choose the amount on the next screen.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF2FF] px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-[0_18px_48px_rgba(11,22,40,0.10)]">
        <h1 className="text-lg font-black text-[#0B1628]">
          We could not open the payment page
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Thank you for wanting to tip your Fixter. Something went wrong on our
          side, not yours.
        </p>

        <button
          type="button"
          onClick={retry}
          className="mt-6 w-full rounded-2xl bg-[#0B1628] px-5 py-3 text-sm font-bold text-white"
        >
          Try again
        </button>

        <p className="mt-5 text-sm text-slate-500">
          Still stuck? Call{" "}
          <a href={CUSTOMER_CARE.callHref} className="font-bold text-blue-700">
            {CUSTOMER_CARE.phoneDisplay}
          </a>{" "}
          and we will sort it out.
        </p>

        <Link
          href="/"
          className="mt-4 inline-block text-sm font-semibold text-slate-400 underline"
        >
          Back to Profixter
        </Link>
      </div>
    </main>
  );
}

function TipFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF2FF] px-5">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </main>
  );
}

export default function TipPage() {
  return (
    <Suspense fallback={<TipFallback />}>
      <TipRedirect />
    </Suspense>
  );
}
