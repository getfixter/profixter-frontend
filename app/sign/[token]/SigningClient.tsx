"use client";

import { useEffect, useState } from "react";
import SigningCeremony from "@/app/components/signing/SigningCeremony";
import {
  fetchSigningPayload,
  signedDocumentUrl,
  type SigningPayload,
} from "@/lib/signing-service";

/**
 * Loads the signing payload and hands off to the ceremony, or shows a terminal
 * state.
 *
 * SECURITY: the token stays in props and the URL. It is never written to
 * storage, never logged, and never passed to analytics. Terminal wording is
 * intentionally uniform - an invalid token and someone else's revoked token
 * must not be distinguishable to a stranger probing links.
 */

const TERMINAL_COPY: Record<string, { title: string; body: string }> = {
  completed: {
    title: "Already signed",
    body: "This document has already been signed. Thank you. If you need another copy, contact us and we will send one.",
  },
  declined: {
    title: "Declined",
    body: "This document was declined. If that was not intentional, please get in touch and we will send a new link.",
  },
  expired: {
    title: "Link expired",
    body: "This signing link is no longer active. Contact us and we will send you a fresh one.",
  },
  revoked: {
    title: "Link no longer active",
    body: "This signing link has been replaced. Contact us and we will send you the current one.",
  },
  invalid: {
    title: "Link not valid",
    body: "We could not open this signing link. Please check that you used the most recent link we sent you.",
  },
  error: {
    title: "Something went wrong",
    body: "We could not load this document. Please check your connection and try again.",
  },
};

export default function SigningClient({ token }: { token: string }) {
  const [payload, setPayload] = useState<SigningPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await fetchSigningPayload(token);
      if (active) {
        setPayload(result);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <p className="text-sm font-semibold text-slate-500">Loading your document…</p>
      </div>
    );
  }

  if (!payload || payload.state !== "ready") {
    const copy = TERMINAL_COPY[payload?.state || "error"] || TERMINAL_COPY.error;
    // Someone reopening their own link after signing should be able to read
    // what they signed, not just be told it is done.
    const signedDocumentReady = payload?.executedDocumentAvailable === true;
    const documentWord = payload?.documentType === "CHANGE_ORDER" ? "Change Order" : "Agreement";
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center sm:p-8">
          <p className="text-sm font-black text-slate-900">
            {payload?.company?.legalName || "Premium Island Homes Inc."}
          </p>
          <h1 className="mt-4 text-xl font-black text-slate-900">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {signedDocumentReady
              ? "This document has already been signed. Thank you. You can open your signed copy below."
              : copy.body}
          </p>
          {signedDocumentReady && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <a
                href={signedDocumentUrl(token)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white"
              >
                View Signed {documentWord}
              </a>
              <a
                href={signedDocumentUrl(token, { download: true })}
                download
                className="text-sm font-bold text-slate-600 underline underline-offset-4"
              >
                Download PDF
              </a>
            </div>
          )}
          {payload?.company?.phone && (
            <p className="mt-6 text-sm font-bold text-slate-700">{payload.company.phone}</p>
          )}
        </div>
      </div>
    );
  }

  return <SigningCeremony token={token} payload={payload} />;
}
