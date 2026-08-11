"use client";

import { useRef, useState } from "react";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import {
  declineSignature,
  signingDocumentUrl,
  submitSignature,
  type SigningPayload,
} from "@/lib/signing-service";

/**
 * The signing ceremony.
 *
 * One implementation for both remote and in-person: the customer sees exactly
 * the same document, disclosure, consent and intent wording either way, and
 * the backend records which mode it was. Two implementations would drift, and
 * the wording is the part that must not drift.
 *
 * Deliberately self-contained - no admin navigation, no site chrome. Whoever is
 * holding the device is signing a legal document and nothing else.
 *
 * Mobile-first: one step per screen, a sticky action bar within thumb reach,
 * and no horizontal overflow at 360px.
 */

type Step = "review" | "disclosure" | "sign" | "done";

interface Props {
  token: string;
  payload: SigningPayload;
  /** Rendered above the ceremony when an admin is running it in person. */
  onExit?: () => void;
  exitLabel?: string;
}

export default function SigningCeremony({ token, payload, onExit, exitLabel }: Props) {
  const [step, setStep] = useState<Step>("review");
  const [consent, setConsent] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SigningPayload | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const padRef = useRef<SignaturePadHandle | null>(null);

  const isChangeOrder = payload.documentType === "CHANGE_ORDER";
  const documentWord = isChangeOrder ? "Change Order" : "Agreement";
  const signLabel = isChangeOrder ? "Sign Change Order" : "Sign Agreement";

  const submit = async () => {
    const dataUrl = padRef.current?.toDataUrl();
    if (!dataUrl) {
      setError("Please draw your signature before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await submitSignature(token, {
        consentAccepted: consent,
        signatureImage: dataUrl,
      });
      if (response.state === "completed") {
        setResult(response);
        setStep("done");
      } else {
        setError(response.message || "We could not complete your signature. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      const response = await declineSignature(token, declineReason);
      setResult(response);
      setStep("done");
    } finally {
      setBusy(false);
      setShowDecline(false);
    }
  };

  /* ------------------------------------------------------------------ */

  const header = (
    <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">
            {payload.company?.legalName || "Premium Island Homes Inc."}
          </p>
          <p className="truncate text-xs font-medium text-slate-500">{payload.documentLabel}</p>
        </div>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
          >
            {exitLabel || "Exit"}
          </button>
        )}
      </div>
    </header>
  );

  /* ---------------- done ---------------- */
  if (step === "done") {
    const declined = result?.state === "declined";
    return (
      <div className="min-h-dvh bg-slate-50">
        {header}
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                declined ? "bg-slate-100" : "bg-emerald-100"
              }`}
              aria-hidden="true"
            >
              <span className={`text-2xl ${declined ? "text-slate-500" : "text-emerald-700"}`}>
                {declined ? "—" : "✓"}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-black text-slate-900">
              {declined ? `${documentWord} Declined` : `${documentWord} Signed`}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-600">
              {declined
                ? "We have recorded your response. Premium Island Homes will be in touch."
                : `Thank you. A copy has been emailed to you, and you can open it any time below.`}
            </p>

            {!declined && (
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <a
                  href={signingDocumentUrl(token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white"
                >
                  View Signed {documentWord}
                </a>
              </div>
            )}

            {payload.company && (
              <p className="mt-8 text-xs font-medium text-slate-500">
                Questions? Call {payload.company.phone}
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  /* ---------------- ceremony ---------------- */
  return (
    <div className="min-h-dvh bg-slate-50 pb-28">
      {header}

      {/* Progress: three short steps, so the customer knows how far this goes. */}
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
        <ol className="flex items-center gap-2" aria-label="Signing progress">
          {(["review", "disclosure", "sign"] as const).map((key, index) => {
            const order = ["review", "disclosure", "sign"];
            const currentIndex = order.indexOf(step);
            const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
            return (
              <li key={key} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    state === "done"
                      ? "bg-emerald-600 text-white"
                      : state === "current"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className="h-1 flex-1 rounded-full bg-slate-200">
                  <span
                    className={`block h-1 rounded-full ${state === "todo" ? "w-0" : "w-full bg-slate-900"}`}
                  />
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        {/* ---------------- review ---------------- */}
        {step === "review" && (
          <section>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
              Review your {documentWord.toLowerCase()}
            </h1>
            <dl className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Customer
                </dt>
                <dd className="break-words text-sm font-semibold text-slate-900">
                  {payload.customerName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Property
                </dt>
                <dd className="break-words text-sm font-semibold text-slate-900">
                  {payload.propertyAddress || "—"}
                </dd>
              </div>
            </dl>

            {/* The exact frozen document, streamed by the server. */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <iframe
                src={signingDocumentUrl(token)}
                title={`${payload.documentLabel} document`}
                className="h-[55vh] w-full sm:h-[65vh]"
              />
            </div>
            <a
              href={signingDocumentUrl(token)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-bold text-slate-700 underline"
            >
              Open full screen or download
            </a>
          </section>
        )}

        {/* ---------------- disclosure ---------------- */}
        {step === "disclosure" && (
          <section>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
              Signing electronically
            </h1>
            <div className="mt-4 space-y-3">
              {(payload.disclosure?.sections || []).map((section) => (
                <details
                  key={section.title}
                  open
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                    {section.title}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
                </details>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer gap-3 rounded-2xl border-2 border-slate-300 bg-white p-4">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400"
              />
              <span className="text-sm font-semibold leading-6 text-slate-800">
                {payload.disclosure?.consentLabel}
              </span>
            </label>
          </section>
        )}

        {/* ---------------- sign ---------------- */}
        {step === "sign" && (
          <section>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Add your signature</h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {payload.disclosure?.padInstruction}
            </p>

            <div className="mt-4">
              <SignaturePad
                ref={padRef}
                onChange={setHasSignature}
                height={220}
                disabled={busy}
              />
            </div>

            <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
              {payload.disclosure?.signIntent}
            </p>

            <button
              type="button"
              onClick={() => setShowDecline(true)}
              className="mt-4 text-sm font-bold text-slate-500 underline"
            >
              I do not want to sign this
            </button>
          </section>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}
      </main>

      {/* Sticky action bar: on a phone this is the only control that matters. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl gap-2">
          {step !== "review" && (
            <button
              type="button"
              onClick={() => setStep(step === "sign" ? "disclosure" : "review")}
              disabled={busy}
              className="rounded-xl border border-slate-300 px-5 py-3.5 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              Back
            </button>
          )}

          {step === "review" && (
            <button
              type="button"
              onClick={() => setStep("disclosure")}
              className="flex-1 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white"
            >
              Continue to Sign
            </button>
          )}

          {step === "disclosure" && (
            <button
              type="button"
              onClick={() => setStep("sign")}
              disabled={!consent}
              className="flex-1 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white disabled:opacity-40"
            >
              {consent ? "Continue" : "Agree to continue"}
            </button>
          )}

          {step === "sign" && (
            <button
              type="button"
              onClick={submit}
              disabled={!hasSignature || !consent || busy}
              className="flex-1 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-40"
            >
              {busy ? "Signing…" : signLabel}
            </button>
          )}
        </div>
      </div>

      {/* ---------------- decline ---------------- */}
      {showDecline && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5">
            <h2 className="text-lg font-black text-slate-900">Decline to sign?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This {documentWord.toLowerCase()} will not be signed. You can tell us why if you
              would like.
            </p>
            <textarea
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              rows={3}
              placeholder="Optional"
              className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={decline}
                disabled={busy}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
