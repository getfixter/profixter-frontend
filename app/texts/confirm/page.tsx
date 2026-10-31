"use client";

/**
 * The customer's one-click confirmation of offers by text.
 *
 * Reached from the email Admin sends after a call (backend
 * utils/consent/smsConfirmLink.js). Opening the page changes nothing - link
 * scanners open links - so the consent is the button press, which the server
 * records with this wording, the time, IP and browser.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import API from "@/lib/api";
import { buttonClass } from "@/app/components/ui/Button";

type View = { firstName: string; phoneLast4: string; confirmed: boolean };

const failure = (err: unknown) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  "Something went wrong. Please try again, or call us at 631-599-1363.";

export default function ConfirmTextsPage() {
  const [token, setToken] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);
    if (!t) {
      setError("This link isn't complete. Please open it again from the email.");
      return;
    }
    API.get("/api/consent/sms-confirm", { params: { t } })
      .then((res) => setView(res.data as View))
      .catch((err) => setError(failure(err)));
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await API.post("/api/consent/sms-confirm", { t: token });
      setDone(true);
    } catch (err) {
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmed = done || view?.confirmed;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-4 py-12" data-texts-confirm>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          {confirmed ? "You're all set" : `${view?.firstName ? `${view.firstName}, confirm` : "Confirm"} offers by text`}
        </h1>
        {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
        {view && confirmed && (
          <p className="mt-4 text-base leading-7 text-slate-700" data-texts-confirmed>
            Thanks. We&apos;ll send occasional ProFixter offers to your phone number ending in {view.phoneLast4}. Reply STOP to any text to opt out.
          </p>
        )}
        {view && !confirmed && (
          <>
            <p className="mt-4 text-base leading-7 text-slate-700">
              You told us you&apos;d like occasional ProFixter offers by text message, sent to your phone number ending in {view.phoneLast4}.
            </p>
            <button type="button" className={buttonClass({ variant: "primary", block: true, className: "mt-6" })} disabled={busy} onClick={confirm} data-action="confirm-texts">
              {busy ? "Saving…" : "Yes, text me occasional ProFixter offers"}
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Optional, and not required to buy anything. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.{" "}
              <Link href="/communication-consent#marketing" className="underline">SMS Terms</Link> ·{" "}
              <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link>
            </p>
            <p className="mt-3 text-xs text-slate-500">Didn&apos;t ask for this? Just close this page and nothing changes.</p>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
