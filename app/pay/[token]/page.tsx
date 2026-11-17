"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AuthScreen, { AuthHeading } from "@/app/components/auth/AuthScreen";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/seo";
import { getPayLink, openPayLink, readFailure, type PayLinkConversion, type PayLinkState } from "@/lib/admin-tools-service";

/*
 * profixter.com/pay/<token>: a payment link Admin sent by email or text.
 *
 * Nothing is opened at Stripe until the customer presses Pay - a messaging
 * app previewing the link loads this page, never a checkout. The server
 * checks again, at that moment, that paying is still right (a home that
 * already has a membership is never billed twice).
 */
function PayLink() {
  const params = useParams<{ token: string }>();
  const search = useSearchParams();
  const token = String(params?.token || "");
  const returnedPaid = search.get("paid") === "1";
  const [state, setState] = useState<PayLinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [polls, setPolls] = useState(0);

  const load = useCallback(async () => setState(await getPayLink(token)), [token]);

  useEffect(() => {
    let alive = true;
    getPayLink(token).then((next) => alive && setState(next));
    return () => {
      alive = false;
    };
  }, [token]);

  // Back from Stripe: the webhook marks it paid within seconds; look again briefly.
  useEffect(() => {
    const waiting = state?.status === "processing" || (returnedPaid && state?.status === "open");
    if (!waiting || polls >= 12) return;
    const timer = setTimeout(() => {
      setPolls((n) => n + 1);
      void load();
    }, 2500);
    return () => clearTimeout(timer);
  }, [load, returnedPaid, state, polls]);

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const conversionTerms = state?.kind === "visit_conversion" ? state.conversion?.terms : undefined;
      const { url } = await openPayLink(token, conversionTerms ? { acceptTerms: accepted, termsVersion: conversionTerms.version } : undefined);
      window.location.href = url;
    } catch (err) {
      const failure = readFailure(err);
      setError(failure.message);
      setBusy(false);
      void load();
    }
  };

  const call = (
    <p className="auth-fineprint" style={{ marginTop: 16 }}>
      Questions? Call us at <a href={`tel:${BUSINESS_PHONE_DISPLAY.replace(/\D/g, "")}`}>{BUSINESS_PHONE_DISPLAY}</a>.
    </p>
  );

  let body: React.ReactNode;
  if (state?.kind === "visit_conversion") {
    body = (
      <ConversionPay
        state={state}
        returnedPaid={returnedPaid}
        gaveUp={polls >= 12}
        accepted={accepted}
        setAccepted={setAccepted}
        busy={busy}
        error={error}
        onPay={pay}
        call={call}
      />
    );
  } else if (!state) {
    body = <AuthHeading sub="One moment…">Secure payment</AuthHeading>;
  } else if (state.status === "paid" || (returnedPaid && state.status === "open")) {
    body = (
      <>
        <AuthHeading sub={state.status === "paid" ? "We've received your payment. A confirmation is on its way to you." : "Confirming your payment with Stripe…"}>
          {state.status === "paid" ? "Thank you!" : "Almost done"}
        </AuthHeading>
        {call}
      </>
    );
  } else if (state.status === "open") {
    body = (
      <>
        <AuthHeading sub="Payments are processed securely by Stripe.">Pay for {state.itemLabel?.replace(/^your /, "your ") || "your order"}</AuthHeading>
        {error && <p className="auth-error auth-error--form">{error}</p>}
        <button type="button" className="auth-submit" onClick={pay} disabled={busy} data-action="pay">
          {busy ? <span className="auth-spinner" aria-hidden="true" /> : null}
          Pay securely
        </button>
        {call}
      </>
    );
  } else {
    const sub =
      state.status === "not_found"
        ? "This payment link isn't valid."
        : state.status === "canceled"
          ? "This payment is no longer needed."
          : state.message || "This payment link has expired.";
    body = (
      <>
        <AuthHeading sub={sub}>Nothing to pay here</AuthHeading>
        {call}
      </>
    );
  }

  return (
    <AuthScreen>
      <div data-pay-state={state?.status || "loading"}>{body}</div>
    </AuthScreen>
  );
}

function price(cents: number | null | undefined, cycle: string) {
  if (cents == null) return "";
  const n = cents / 100;
  const amount = `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;
  return cycle === "annual" ? `${amount} a year` : cycle === "monthly" ? `${amount} a month` : amount;
}

/* "Basic membership (monthly)" -> "Basic membership". */
function planName(offerLabel: string) {
  return offerLabel.replace(/ \((monthly|annual)\)$/, "");
}

/*
 * A free visit being paid for as a membership or One-Time visit
 * (backend utils/freeVisit/conversion.js). Shows only this visit's day, time
 * and street and the offer; the terms must be ticked before Stripe opens;
 * the visit changes only once Stripe confirms the payment.
 */
function ConversionPay({
  state,
  returnedPaid,
  gaveUp,
  accepted,
  setAccepted,
  busy,
  error,
  onPay,
  call,
}: {
  state: PayLinkState;
  returnedPaid: boolean;
  gaveUp: boolean;
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  busy: boolean;
  error: string;
  onPay: () => void;
  call: React.ReactNode;
}) {
  const c = state.conversion as PayLinkConversion | undefined;
  const becomes = c ? (c.kind === "one_time" ? "a paid One-Time Visit" : `a ${planName(c.offerLabel)} visit`) : "a paid visit";
  const visit = c ? (
    <div className="mb-4 rounded-[10px] border border-[color:var(--ui-line-2)] bg-[color:var(--ui-surface)] p-3 text-left text-[14px] leading-[1.45]" data-conversion-visit="">
      <div className="font-semibold text-[color:var(--ui-ink)]">{c.whenLabel}</div>
      <div className="text-[color:var(--ui-text-2)]">{c.street}</div>
      {c.task ? <div className="mt-1 text-[color:var(--ui-text-2)]">{c.task}</div> : null}
    </div>
  ) : null;

  if (state.status === "converted") {
    return (
      <>
        <AuthHeading
          sub={
            c?.convertedStatus === "Confirmed"
              ? "It's the same day, time and address, and it's confirmed. A confirmation email is on its way."
              : "It's the same day, time and address. We'll confirm the visit with you before the day; a confirmation email is on its way."
          }
        >
          {`Thank you! Your visit is now ${becomes}`}
        </AuthHeading>
        {visit}
        {call}
      </>
    );
  }
  if (state.status === "paid_attention") {
    return (
      <>
        <AuthHeading sub="We couldn't update your visit automatically, so nothing about it has changed yet. We'll call you to sort it out; there's nothing you need to do.">
          We received your payment
        </AuthHeading>
        {call}
      </>
    );
  }
  if (state.status === "processing" || (returnedPaid && state.status === "open")) {
    return (
      <>
        <AuthHeading sub={gaveUp ? "This is taking longer than usual. If you paid, you'll get an email shortly; you can close this page." : "Confirming your payment with Stripe…"}>Almost done</AuthHeading>
        {call}
      </>
    );
  }
  if (state.status === "open" && c) {
    const terms = c.terms;
    return (
      <>
        <AuthHeading sub={`Hi ${c.firstName}, this turns your visit into ${becomes}. Payments are processed securely by Stripe.`}>
          {c.kind === "one_time" ? `One-Time Visit · ${price(c.priceCents, "")}` : `${planName(c.offerLabel)} · ${price(c.priceCents, c.billingCycle)}`}
        </AuthHeading>
        {visit}
        {terms ? (
          <div className="mb-4 flex items-start gap-2.5 text-left" data-conversion-terms="">
            <input
              id="conversion-terms"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-[3px] h-[20px] w-[20px] flex-shrink-0 cursor-pointer accent-[#0B1628]"
            />
            <div className="min-w-0 text-[14px] leading-[1.45] text-[color:var(--ui-text-2)]">
              <label htmlFor="conversion-terms" className="cursor-pointer">
                {terms.text}
              </label>{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[color:var(--ui-ink)] underline underline-offset-2">
                Read the terms
              </a>
            </div>
          </div>
        ) : null}
        {error && <p className="auth-error auth-error--form">{error}</p>}
        <button type="button" className="auth-submit" onClick={onPay} disabled={busy || !accepted} data-action="pay">
          {busy ? <span className="auth-spinner" aria-hidden="true" /> : null}
          Pay securely
        </button>
        {call}
      </>
    );
  }
  const sub =
    state.status === "unavailable"
      ? state.message || "Your visit has changed since this link was sent, so it can't be paid here. Please call us."
      : state.status === "canceled"
        ? "This payment is no longer needed."
        : state.status === "not_found"
          ? "This payment link isn't valid."
          : state.message || "This payment link has expired.";
  return (
    <>
      <AuthHeading sub={sub}>Nothing to pay here</AuthHeading>
      {call}
    </>
  );
}

export default function PayLinkPage() {
  return (
    <Suspense fallback={null}>
      <PayLink />
    </Suspense>
  );
}
