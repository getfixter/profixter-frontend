"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AuthScreen, { AuthHeading } from "@/app/components/auth/AuthScreen";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/seo";
import { getPayLink, openPayLink, readFailure, type PayLinkState } from "@/lib/admin-tools-service";

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
    if (!returnedPaid || state?.status !== "open") return;
    const timer = setTimeout(() => void load(), 2500);
    return () => clearTimeout(timer);
  }, [load, returnedPaid, state]);

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await openPayLink(token);
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
  if (!state) {
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

export default function PayLinkPage() {
  return (
    <Suspense fallback={null}>
      <PayLink />
    </Suspense>
  );
}
