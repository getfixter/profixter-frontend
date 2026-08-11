"use client";

import { useState } from "react";
import {
  downloadNativeDocument,
  type DocumentSignature,
} from "@/lib/admin-service";

/**
 * Signature details.
 *
 * Native-first and provider-aware. It answers the questions an admin actually
 * has in front of a customer - has this been signed, how, by whom, and when -
 * and nothing else.
 *
 * Deliberately NOT shown here: SHA-256 hashes, IP addresses, user agents, token
 * state, database ids and storage keys. That material is evidence and lives in
 * the Signature Certificate and the audit record. Putting it in everyday Admin
 * makes the panel unreadable and leaks internals onto a screen that gets turned
 * toward customers.
 *
 * A manual upload is labelled as such and never dressed up as a native
 * ceremony, because it did not go through one.
 */

const STATUS_STYLES: Record<string, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  Ready: "border-blue-200 bg-blue-50 text-blue-700",
  Sent: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Viewed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Awaiting Signature": "border-amber-200 bg-amber-50 text-amber-800",
  "Partially Signed": "border-amber-200 bg-amber-50 text-amber-800",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Declined: "border-rose-200 bg-rose-50 text-rose-700",
  Cancelled: "border-slate-200 bg-slate-50 text-slate-500",
  Expired: "border-slate-200 bg-slate-50 text-slate-500",
  Failed: "border-rose-200 bg-rose-50 text-rose-700",
};

/** What an admin should read, not the raw enum. */
function statusLabel(signature: DocumentSignature) {
  if (signature.signingMode === "MANUAL_UPLOAD") return "Signed — Manual Upload";
  if (signature.status === "Completed") return "Signed";
  if (signature.status === "Cancelled") return "Revoked";
  return signature.status;
}

function methodLabel(signature: DocumentSignature) {
  switch (signature.signingMode) {
    case "IN_PERSON":
      return "In Person";
    case "MANUAL_UPLOAD":
      return "Manual Upload";
    default:
      return "Remote";
  }
}

function formatStamp(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-words text-right text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

interface Props {
  signature: DocumentSignature | null;
  providerConfigured?: boolean;
  webhookConfigured?: boolean;
  working?: string;
  documentWord?: "Agreement" | "Change Order";
  onChanged?: () => Promise<void> | void;
  setError?: (value: string) => void;
  setSuccess?: (value: string) => void;
  setWorking?: (value: string) => void;
}

export default function SignatureDetails({
  signature,
  working = "",
  documentWord = "Agreement",
  setError,
  setWorking,
}: Props) {
  const [busy, setBusy] = useState(false);

  if (!signature) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Signature</p>
        <p className="mt-2 text-sm font-medium text-slate-600">
          This {documentWord.toLowerCase()} has not been sent for signature yet.
        </p>
      </section>
    );
  }

  const isLegacy = signature.provider === "adobe_sign";
  const isManual = signature.signingMode === "MANUAL_UPLOAD";
  const customer = (signature.signers || []).find((s) => s.role === "CUSTOMER");

  const download = async (kind: "frozen" | "executed" | "certificate") => {
    setBusy(true);
    setError?.("");
    setWorking?.("Preparing download...");
    try {
      const blob = await downloadNativeDocument(signature.id, kind);
      const names = {
        frozen: `original-${documentWord.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        executed: `signed-${documentWord.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        certificate: "signature-certificate.pdf",
      };
      downloadBlob(blob, names[kind]);
    } catch {
      setError?.("That document could not be downloaded. Please try again.");
    } finally {
      setBusy(false);
      setWorking?.("");
    }
  };

  const disabled = busy || Boolean(working);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Signature</p>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            STATUS_STYLES[signature.status] || "border-slate-200 bg-slate-100 text-slate-700"
          }`}
        >
          {statusLabel(signature)}
        </span>
      </div>

      <dl className="mt-3">
        <Row label="Signing method" value={methodLabel(signature)} />
        <Row label="Customer" value={customer?.name || "—"} />
        <Row label="Email" value={customer?.email} />
        {!isManual && <Row label="Sent" value={formatStamp(signature.sentAt)} />}
        {!isManual && <Row label="Opened" value={formatStamp(customer?.viewedAt)} />}
        <Row
          label={isManual ? "Recorded" : "Signed"}
          value={formatStamp(signature.completedAt)}
        />
        <Row label="Declined" value={formatStamp(signature.declinedAt)} />
        {isLegacy && <Row label="Provider" value="Adobe Acrobat Sign (historical)" />}
      </dl>

      {isManual && (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-600">
          This document was signed outside ProFixter and uploaded by an administrator. It does not
          carry electronic signature evidence such as a consent record or signing certificate.
        </p>
      )}

      {signature.declineReason && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          Reason given: {signature.declineReason}
        </p>
      )}

      {!isManual && !isLegacy && signature.status === "Completed" && (
        <p className="mt-3 text-[11px] font-medium text-slate-500">
          Electronic disclosure PIH-ESIGN-DISCLOSURE-2026-001 was accepted before signing.
        </p>
      )}

      {signature.status === "Completed" && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => void download("executed")}
            disabled={disabled}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            View Signed {documentWord}
          </button>
          {!isManual && (
            <>
              <button
                type="button"
                onClick={() => void download("frozen")}
                disabled={disabled}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                View Original
              </button>
              <button
                type="button"
                onClick={() => void download("certificate")}
                disabled={disabled}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Signature Certificate
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
