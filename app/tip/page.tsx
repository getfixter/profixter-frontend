"use client";

/**
 * The tip page.
 *
 * WHAT THIS REPLACED
 * A four line server redirect to a static Stripe Payment Link. One URL for
 * every customer and every Fixter, so a tip arrived at Stripe with nothing
 * attached to it and no way to tell whose work it was for.
 *
 * TWO WAYS IN, ONE OUTCOME
 * From a completion email the Fixter is already known, so the page is a
 * redirect with a spinner and the customer is never asked a question they
 * should not have to answer. Opened bare, or with a link that no longer
 * resolves, it asks the one question it needs: who helped you today.
 *
 * A FAILED ATTRIBUTION IS NOT A FAILED TIP
 * An invalid, expired or tampered token drops to the chooser rather than an
 * error. Losing the ability to name the Fixter automatically is a small
 * problem; losing a customer who wanted to pay one is not.
 *
 * WHY IT REDIRECTS FROM JAVASCRIPT RATHER THAN ON THE SERVER
 * Email clients, link scanners and security appliances fetch links in messages.
 * A server redirect that created a Checkout Session would create one every time
 * a scanner touched the link. Only a person opening the page starts a checkout.
 *
 * The browser never learns who a Fixter is beyond a first name. Each option
 * carries an opaque handle the server issued and can decrypt, so this page
 * cannot name an employee it was not offered, and the server revalidates the
 * choice before any attribution reaches Stripe.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CUSTOMER_CARE } from "@/lib/fixter";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type Phase = "opening" | "choosing" | "failed";

/** Exactly what the public endpoint returns: a first name and an opaque handle. */
type FixterOption = { choice: string; firstName: string };

function TipFlow() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("opening");
  const [options, setOptions] = useState<FixterOption[]>([]);
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const startCheckout = useCallback(async (body: Record<string, string>) => {
    const response = await fetch(`${API_URL}/api/tips/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);

    if (response.ok && data?.url) {
      window.location.replace(data.url);
      return { redirected: true as const };
    }
    if (response.ok && data?.needsChoice) {
      return { redirected: false as const, fixters: (data.fixters || []) as FixterOption[] };
    }
    return { redirected: false as const, fixters: null };
  }, []);

  /**
   * Decide what this visit is: a known Fixter to pay, or a question to ask.
   * Deliberately free of state updates so the effect below owns them all.
   */
  const begin = useCallback(async (): Promise<{
    outcome: "redirect" | "choose" | "failed";
    fixters: FixterOption[];
  }> => {
    // Accept both spellings so an older link, or one a customer retyped, still
    // resolves. An absent token is not an error, it is the public entrance.
    const token = searchParams.get("t") || searchParams.get("token") || "";

    try {
      if (token) {
        const result = await startCheckout({ token });
        if (result.redirected) return { outcome: "redirect", fixters: [] };
        if (result.fixters?.length) return { outcome: "choose", fixters: result.fixters };
        return { outcome: "failed", fixters: [] };
      }

      const response = await fetch(`${API_URL}/api/tips/fixters`);
      const data = await response.json().catch(() => null);
      const fixters = (data?.fixters || []) as FixterOption[];
      if (response.ok && fixters.length) return { outcome: "choose", fixters };

      // Nobody to choose from. Still take the tip rather than turn them away.
      const fallback = await startCheckout({});
      return { outcome: fallback.redirected ? "redirect" : "failed", fixters: [] };
    } catch {
      // Network, DNS, offline. Handled like any other failure.
      return { outcome: "failed", fixters: [] };
    }
  }, [searchParams, startCheckout]);

  useEffect(() => {
    let abandoned = false;
    void begin().then(({ outcome, fixters }) => {
      if (abandoned || outcome === "redirect") return;
      setOptions(fixters);
      setPhase(outcome === "choose" ? "choosing" : "failed");
    });
    return () => {
      abandoned = true;
    };
  }, [begin, attempt]);

  const retry = () => {
    setPhase("opening");
    setAttempt((value) => value + 1);
  };

  const submitChoice = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const result = await startCheckout({ choice: selected });
      if (result.redirected) return;
      if (result.fixters?.length) {
        // The choice went stale, which usually means that Fixter has just been
        // deactivated. Show the current list rather than a dead end.
        setOptions(result.fixters);
        setSelected("");
        setSubmitting(false);
        return;
      }
      setPhase("failed");
    } catch {
      setPhase("failed");
    }
    setSubmitting(false);
  };

  if (phase === "opening") {
    return (
      <Shell>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <h1 className="mt-6 text-lg font-black text-[#0B1628]">
          Opening secure payment
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          One moment. You will choose the amount on the next screen.
        </p>
      </Shell>
    );
  }

  if (phase === "choosing") {
    return (
      <Shell align="left">
        <h1 className="text-xl font-black text-[#0B1628]">Tip your Fixter</h1>
        <p className="mt-1 text-sm text-slate-500">Who helped you today?</p>

        <div className="mt-5 space-y-2">
          {options.map((option) => {
            const isSelected = selected === option.choice;
            return (
              <button
                key={option.choice}
                type="button"
                onClick={() => setSelected(option.choice)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-3 rounded-[8px] border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-[#0B1628] bg-[#0B1628] text-white"
                    : "border-slate-200 bg-white text-[#0B1628]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                  aria-hidden="true"
                >
                  {option.firstName.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-base font-bold">{option.firstName}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void submitChoice()}
          disabled={!selected || submitting}
          className="mt-5 w-full rounded-[8px] bg-[#0B1628] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {submitting ? "Opening secure payment..." : "Continue"}
        </button>

        <p className="mt-3 text-center text-xs text-slate-400">
          You choose the amount on the next screen.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
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
        className="mt-6 w-full rounded-[8px] bg-[#0B1628] px-5 py-3 text-sm font-bold text-white"
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
    </Shell>
  );
}

function Shell({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF2FF] px-5 py-10">
      <div
        className={`w-full max-w-sm rounded-[10px] bg-white p-7 shadow-[0_18px_48px_rgba(11,22,40,0.10)] ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {children}
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
      <TipFlow />
    </Suspense>
  );
}
