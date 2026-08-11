"use client";

import {
  cancelSignatureRequest,
  downloadSignaturePdf,
  refreshSignatureStatus,
  retrySignatureRetrieval,
  type DocumentSignature,
} from "@/lib/admin-service";

const SIGNATURE_STATUS_STYLES: Record<string, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
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

function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message || (error as Error)?.message || "Something went wrong";
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

export default function SignatureDetails({
  signature,
  providerConfigured,
  webhookConfigured,
  working,
  onChanged,
  setError,
  setSuccess,
  setWorking,
}: {
  signature: DocumentSignature | null;
  providerConfigured: boolean;
  webhookConfigured: boolean;
  working: string;
  onChanged: () => Promise<void>;
  setError: (value: string) => void;
  setSuccess: (value: string) => void;
  setWorking: (value: string) => void;
}) {
  if (!signature) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          E-Signature
        </p>
        <p className="mt-2 text-sm font-medium text-slate-600">
          {providerConfigured
            ? "Not sent for signature yet."
            : "Adobe Acrobat Sign is not configured on the server yet."}
        </p>
      </section>
    );
  }

  const run = async (label: string, action: () => Promise<unknown>, done: string) => {
    setWorking(label);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(done);
      await onChanged();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setWorking("");
    }
  };

  const downloadSigned = async (type: "executed" | "original" | "audit") => {
    setWorking("Preparing download...");
    setError("");
    try {
      const blob = await downloadSignaturePdf(signature.id, type);
      downloadBlob(blob, `${signature.documentNumber || "document"}-${type}.pdf`);
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setWorking("");
    }
  };

  const terminal = ["Completed", "Declined", "Cancelled", "Expired"].includes(signature.status);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          E-Signature
        </p>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            SIGNATURE_STATUS_STYLES[signature.status] || "border-slate-200 bg-slate-100 text-slate-700"
          }`}
        >
          {signature.status}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Provider</dt>
          <dd className="text-sm font-semibold text-slate-800">
            {signature.provider === "adobe_sign" ? "Adobe Acrobat Sign" : signature.provider}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Agreement ID
          </dt>
          <dd className="break-all text-xs font-medium text-slate-600">
            {signature.providerAgreementId || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sent</dt>
          <dd className="text-sm font-semibold text-slate-800">
            {formatDateTime(signature.sentAt) || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Completed
          </dt>
          <dd className="text-sm font-semibold text-slate-800">
            {formatDateTime(signature.completedAt) || "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Signers</p>
        <ul className="mt-2 space-y-2">
          {signature.signers.map((signer) => (
            <li
              key={`${signer.email}-${signer.order}`}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{signer.name || signer.email}</p>
                <p className="text-xs font-medium text-slate-500">
                  {signer.email} · {signer.role === "COMPANY" ? "Company" : "Customer"} · order{" "}
                  {signer.order}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-700">{signer.status}</p>
                {signer.signedAt && (
                  <p className="text-[11px] font-medium text-emerald-700">
                    Signed {formatDateTime(signer.signedAt)}
                  </p>
                )}
                {!signer.signedAt && signer.viewedAt && (
                  <p className="text-[11px] font-medium text-slate-500">
                    Viewed {formatDateTime(signer.viewedAt)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {signature.declineReason && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          Declined: {signature.declineReason}
        </p>
      )}

      {!webhookConfigured && !["Completed", "Declined", "Cancelled", "Expired"].includes(signature.status) && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          The signature webhook is not configured, so status updates will not arrive on their own.
          Use Refresh Status to pull the current state from Adobe.
        </p>
      )}

      {signature.status === "Completed" && signature.documentRetrieval.state === "failed" && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          The signature completed, but downloading the executed PDF failed
          {signature.documentRetrieval.attempts
            ? ` after ${signature.documentRetrieval.attempts} attempt(s)`
            : ""}
          . The signature record is safe — retry the retrieval below.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        {signature.executedPdfAvailable && (
          <button
            type="button"
            onClick={() => downloadSigned("executed")}
            disabled={!!working}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Download Executed PDF
          </button>
        )}
        {signature.auditTrailAvailable && (
          <button
            type="button"
            onClick={() => downloadSigned("audit")}
            disabled={!!working}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Audit Trail
          </button>
        )}
        {signature.originalPdfAvailable && (
          <button
            type="button"
            onClick={() => downloadSigned("original")}
            disabled={!!working}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Original Sent PDF
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            run(
              "Refreshing status...",
              () => refreshSignatureStatus(signature.id),
              "Signature status refreshed."
            )
          }
          disabled={!!working || !providerConfigured}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Refresh Status
        </button>
        {signature.status === "Completed" && !signature.executedPdfAvailable && (
          <button
            type="button"
            onClick={() =>
              run(
                "Retrieving executed PDF...",
                () => retrySignatureRetrieval(signature.id),
                "Executed document retrieved."
              )
            }
            disabled={!!working || !providerConfigured}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Retry Retrieval
          </button>
        )}
        {!terminal && (
          <button
            type="button"
            onClick={() =>
              run(
                "Cancelling...",
                () => cancelSignatureRequest(signature.id, "Cancelled by Premium Island Homes Inc."),
                "Signature request cancelled."
              )
            }
            disabled={!!working || !providerConfigured}
            className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
          >
            Cancel Request
          </button>
        )}
      </div>
    </section>
  );
}
