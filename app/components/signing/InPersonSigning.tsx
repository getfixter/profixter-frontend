"use client";

import { useEffect, useState } from "react";
import SigningCeremony from "./SigningCeremony";
import { fetchSigningPayload, type SigningPayload } from "@/lib/signing-service";

/**
 * In-person signing, launched from the Admin.
 *
 * Renders full-screen over the Admin so the customer holding the device sees a
 * signing ceremony and nothing else - no project navigation, no pricing
 * controls, no other customers' data. The only way back is the explicit exit,
 * which the admin uses after handing the device back.
 *
 * It reuses the same ceremony and the same public signing endpoints as remote
 * signing, so the customer experience and the recorded evidence are identical;
 * only the mode recorded on the server differs.
 *
 * The session token lives in props for the lifetime of this component. It is
 * never stored, never logged, and disappears when the ceremony closes.
 */
export default function InPersonSigning({
  token,
  onExit,
}: {
  token: string;
  onExit: () => void;
}) {
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

  // Lock the page behind the ceremony so admin content cannot be scrolled to.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-50">
      {loading && (
        <div className="flex min-h-dvh items-center justify-center px-4">
          <p className="text-sm font-semibold text-slate-500">Preparing the document…</p>
        </div>
      )}

      {!loading && (!payload || payload.state !== "ready") && (
        <div className="flex min-h-dvh items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[10px] border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-lg font-black text-slate-900">This session cannot be opened</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {payload?.message ||
                "The in-person signing session is no longer available. Start a new one from the Agreement."}
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-5 rounded-[8px] bg-slate-900 px-5 py-3 text-sm font-bold text-white"
            >
              Back to Project
            </button>
          </div>
        </div>
      )}

      {!loading && payload?.state === "ready" && (
        <SigningCeremony
          token={token}
          payload={payload}
          onExit={onExit}
          exitLabel="Exit signing"
        />
      )}
    </div>
  );
}
