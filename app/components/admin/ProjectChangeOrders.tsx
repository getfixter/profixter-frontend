"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ESignStatusBadge from "@/app/components/admin/ESignStatusBadge";
import InPersonSigning from "@/app/components/signing/InPersonSigning";
import AdminActionBar, { type AdminAction } from "@/app/components/admin/AdminActionBar";
import SignatureDetails from "@/app/components/admin/SignaturePanel";
import {
  createChangeOrder,
  deleteChangeOrder,
  downloadChangeOrderPdf,
  emailChangeOrder,
  generateChangeOrderPdf,
  getChangeOrderMeta,
  getProjectChangeOrders,
  getProjectContracts,
  getSignatureMeta,
  sendForNativeSignature,
  resendNativeSignature,
  revokeNativeSignature,
  downloadNativeDocument,
  uploadManuallySignedDocument,
  updateChangeOrder,
  voidChangeOrder,
  type ChangeLineDirection,
  type ChangeOrderMeta,
  type ChangeOrderStatus,
  type ContractValueSummary,
  type Project,
  type ProjectChangeOrder,
  type ProjectContract,
  type ScheduleImpactType,
  type SignatureMeta,
} from "@/lib/admin-service";

type LineDraft = {
  id: string;
  description: string;
  direction: ChangeLineDirection;
  amount: string;
};

type FormState = {
  title: string;
  lines: LineDraft[];
  scheduleType: ScheduleImpactType;
  scheduleDays: string;
  scheduleNote: string;
  notes: string;
};

const STATUS_STYLES: Record<ChangeOrderStatus, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  "Ready to Send": "border-blue-200 bg-blue-50 text-blue-700",
  Sent: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Viewed: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Awaiting Signature": "border-amber-200 bg-amber-50 text-amber-800",
  "Partially Signed": "border-amber-200 bg-amber-50 text-amber-800",
  Executed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Declined: "border-rose-200 bg-rose-50 text-rose-700",
  Voided: "border-slate-200 bg-slate-50 text-slate-500",
};

const SCHEDULE_LABELS: Record<ScheduleImpactType, string> = {
  none: "No schedule change",
  add_days: "Extends completion",
  reduce_days: "Shortens completion",
  custom: "Custom description",
};

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(cents || 0) / 100
  );
}

function signedMoneyFromCents(cents: number) {
  const value = Number(cents || 0);
  const body = moneyFromCents(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function centsFromMoney(value: string) {
  const number = Number(String(value || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
}

function dollarsFromCents(cents: number) {
  if (!cents) return "";
  return (Number(cents || 0) / 100).toFixed(2);
}

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

function emptyForm(): FormState {
  return {
    title: "",
    lines: [{ id: "line-1", description: "", direction: "add", amount: "" }],
    scheduleType: "none",
    scheduleDays: "",
    scheduleNote: "",
    notes: "",
  };
}

function formFromChangeOrder(changeOrder: ProjectChangeOrder): FormState {
  return {
    title: changeOrder.title || "",
    lines: (changeOrder.lines || []).map((line, index) => ({
      id: line._id || `line-${index}`,
      description: line.description,
      direction: line.direction,
      amount: dollarsFromCents(line.amountCents),
    })),
    scheduleType: changeOrder.scheduleImpact?.type || "none",
    scheduleDays: changeOrder.scheduleImpact?.days ? String(changeOrder.scheduleImpact.days) : "",
    scheduleNote: changeOrder.scheduleImpact?.note || "",
    notes: changeOrder.notes || "",
  };
}

function buildPayload(form: FormState) {
  return {
    title: form.title.trim(),
    lines: form.lines
      .filter((line) => line.description.trim())
      .map((line, index) => ({
        description: line.description.trim(),
        direction: line.direction,
        amountCents: line.direction === "none" ? 0 : centsFromMoney(line.amount),
        order: index,
      })),
    scheduleImpact: {
      type: form.scheduleType,
      days:
        form.scheduleType === "add_days" || form.scheduleType === "reduce_days"
          ? Number(form.scheduleDays || 0)
          : 0,
      note: form.scheduleNote.trim(),
    },
    notes: form.notes.trim(),
  };
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

function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  window.open(url, "_blank", "noopener,noreferrer");
  // Give the new tab time to load before releasing the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ================================================================== */

export default function ProjectChangeOrders({ project }: { project: Project }) {
  const [meta, setMeta] = useState<ChangeOrderMeta | null>(null);
  const [signatureMeta, setSignatureMeta] = useState<SignatureMeta | null>(null);
  const [contracts, setContracts] = useState<ProjectContract[]>([]);
  const [changeOrders, setChangeOrders] = useState<ProjectChangeOrder[]>([]);
  const [summaries, setSummaries] = useState<ContractValueSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [contractId, setContractId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [composing, setComposing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showEmail, setShowEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ recipient: "", subject: "", message: "" });
  const [showSend, setShowSend] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  /** In-person signing credential. Memory only - never persisted or logged. */
  const [inPersonToken, setInPersonToken] = useState<string | null>(null);


  const selected = useMemo(
    () => changeOrders.find((item) => item._id === selectedId) || null,
    [changeOrders, selectedId]
  );

  const amendable = useMemo(() => {
    const allowed = meta?.amendableContractStatuses || ["Generated", "Emailed", "Signed"];
    return contracts.filter((contract) => allowed.includes(contract.status));
  }, [contracts, meta]);

  const activeSummary = useMemo(() => {
    const target = selected?.contractId || contractId;
    return summaries.find((summary) => summary.contractId === target) || null;
  }, [summaries, selected, contractId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextMeta, nextSignatureMeta, nextContracts, nextData] = await Promise.all([
        getChangeOrderMeta(),
        getSignatureMeta(),
        getProjectContracts(project._id),
        getProjectChangeOrders(project._id),
      ]);
      setMeta(nextMeta);
      setSignatureMeta(nextSignatureMeta);
      setContracts(nextContracts);
      setChangeOrders(nextData.changeOrders);
      setSummaries(nextData.contractSummaries);

      setSelectedId((current) =>
        current && nextData.changeOrders.some((item) => item._id === current)
          ? current
          : nextData.changeOrders[0]?._id || ""
      );
      setContractId((current) => {
        if (current) return current;
        const allowed = nextMeta.amendableContractStatuses || [];
        const currentContract = nextContracts.find(
          (contract) => contract.current && allowed.includes(contract.status)
        );
        return (
          currentContract?._id ||
          nextContracts.find((contract) => allowed.includes(contract.status))?._id ||
          ""
        );
      });
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the editor in step with whichever change order is selected.
  useEffect(() => {
    if (composing) return;
    setForm(selected ? formFromChangeOrder(selected) : emptyForm());
  }, [selected, composing]);

  const totals = useMemo(() => {
    const net = form.lines.reduce((sum, line) => {
      if (line.direction === "none") return sum;
      const cents = centsFromMoney(line.amount);
      return sum + (line.direction === "deduct" ? -cents : cents);
    }, 0);
    const before = composing
      ? activeSummary?.executedContractCents ?? 0
      : selected?.contractAmountBeforeChangeCents ?? 0;
    return { net, before, after: Math.max(before + net, 0) };
  }, [form.lines, composing, activeSummary, selected]);

  const isEditable = composing || selected?.status === "Draft";

  /* ------------------------------ actions ------------------------------ */

  const startNew = () => {
    setComposing(true);
    setSelectedId("");
    setForm(emptyForm());
    setError("");
    setSuccess("");
  };

  const cancelNew = () => {
    setComposing(false);
    setSelectedId(changeOrders[0]?._id || "");
    setError("");
  };

  const selectChangeOrder = (id: string) => {
    setComposing(false);
    setSelectedId(id);
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    const payload = buildPayload(form);
    if (!payload.title) {
      setError("A change order title is required");
      return null;
    }
    if (!payload.lines.length) {
      setError("Add at least one change line with a description");
      return null;
    }

    setWorking("Saving...");
    setError("");
    setSuccess("");
    try {
      if (composing) {
        if (!contractId) {
          setError("Select the contract this change order amends");
          return null;
        }
        const created = await createChangeOrder(contractId, payload);
        setComposing(false);
        setSelectedId(created._id);
        setSuccess(`Change order ${created.changeOrderNumber} created.`);
        await load();
        return created;
      }
      if (!selected) return null;
      const updated = await updateChangeOrder(selected._id, payload);
      setChangeOrders((current) =>
        current.map((item) => (item._id === updated._id ? updated : item))
      );
      setSuccess("Change order saved.");
      return updated;
    } catch (saveError) {
      setError(errorMessage(saveError));
      return null;
    } finally {
      setWorking("");
    }
  };

  const handleGenerate = async () => {
    const saved = await handleSave();
    const target = saved || selected;
    if (!target) return;
    setWorking("Generating PDF...");
    setError("");
    try {
      const generated = await generateChangeOrderPdf(target._id);
      setSelectedId(generated._id);
      setSuccess("PDF generated and stored on this project.");
      await load();
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setWorking("");
    }
  };

  const handlePdf = async (
    action: "preview" | "download",
    type: "generated" | "executed"
  ) => {
    if (!selected) return;
    setWorking(action === "preview" ? "Opening PDF..." : "Preparing download...");
    setError("");
    try {
      const blob = await downloadChangeOrderPdf(selected._id, type);
      if (action === "preview") {
        openBlobInNewTab(blob);
      } else {
        const fallback = `${selected.changeOrderNumber}${type === "executed" ? "-executed" : ""}.pdf`;
        const fileName =
          type === "executed"
            ? selected.executedPdf?.fileName || fallback
            : selected.generatedPdf?.fileName || fallback;
        downloadBlob(blob, fileName);
      }
    } catch (pdfError) {
      setError(errorMessage(pdfError));
    } finally {
      setWorking("");
    }
  };

  const openEmail = () => {
    if (!selected) return;
    setEmailForm({
      recipient: selected.customerSnapshot?.email || "",
      subject: `Change Order ${selected.changeOrderNumber} - Premium Island Homes`,
      message: [
        `Hi ${selected.customerSnapshot?.fullName || "there"},`,
        "",
        `Attached is Change Order ${selected.changeOrderNumber} for your project.`,
        "Please review the described changes, the price adjustment, and any schedule impact. If everything looks correct, sign and return the change order so we can proceed.",
        "",
        "Thank you,",
        "Premium Island Homes Inc.",
      ].join("\n"),
    });
    setShowEmail(true);
  };

  const handleEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setWorking("Emailing change order...");
    setError("");
    try {
      const emailed = await emailChangeOrder(selected._id, emailForm);
      setChangeOrders((current) =>
        current.map((item) => (item._id === emailed._id ? emailed : item))
      );
      setShowEmail(false);
      setSuccess("Change order emailed and history saved.");
    } catch (emailError) {
      setError(errorMessage(emailError));
    } finally {
      setWorking("");
    }
  };

  /**
   * Turn a backend failure into copy an admin can act on. A missing company
   * signature is a configuration problem, not an error the customer caused, and
   * the raw message would expose server internals.
   */
  const signingError = (caught: unknown) => {
    const response = (caught as { response?: { data?: { code?: string } } })?.response;
    if (response?.data?.code === "SIGNING_NOT_CONFIGURED") {
      return "Company signature needs to be configured before this Change Order can be sent for signing.";
    }
    return errorMessage(caught);
  };

  const handleSendForSignature = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setWorking("Sending for signature...");
    setError("");
    try {
      const result = await sendForNativeSignature({
        documentType: "CHANGE_ORDER",
        documentId: selected._id,
        mode: "REMOTE",
        message: sendMessage,
      });
      setShowSend(false);
      setSendMessage("");
      setSuccess(
        result.emailed
          ? "Change Order sent. The customer has been emailed a secure signing link."
          : "Change Order is ready to sign, but the email could not be delivered. Use Resend Link."
      );
      await load();
    } catch (sendError) {
      setError(signingError(sendError));
    } finally {
      setWorking("");
    }
  };

  /** In person: freeze, then hand this device to the customer. No email. */
  const handleSignInPerson = async () => {
    if (!selected) return;
    setWorking("Preparing signing session...");
    setError("");
    try {
      const result = await sendForNativeSignature({
        documentType: "CHANGE_ORDER",
        documentId: selected._id,
        mode: "IN_PERSON",
      });
      setInPersonToken(result.signingUrl.split("/sign/")[1] || null);
    } catch (sendError) {
      setError(signingError(sendError));
    } finally {
      setWorking("");
    }
  };

  const handleResend = async () => {
    if (!selected?.signature) return;
    setWorking("Resending...");
    setError("");
    try {
      await resendNativeSignature(selected.signature.id);
      setSuccess("A new signing link has been emailed. The previous link no longer works.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  };

  const handleRevoke = async () => {
    if (!selected?.signature) return;
    if (!window.confirm("Revoke this signature request? The link will stop working.")) return;
    setWorking("Revoking...");
    try {
      await revokeNativeSignature(selected.signature.id, "Revoked by admin");
      setSuccess("Signature request revoked.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  };

  const handleNativeDownload = async (kind: "frozen" | "executed" | "certificate") => {
    if (!selected?.signature) return;
    setWorking("Preparing download...");
    try {
      const blob = await downloadNativeDocument(selected.signature.id, kind);
      const names = {
        frozen: `${selected.changeOrderNumber}-original.pdf`,
        executed: `${selected.changeOrderNumber}-signed.pdf`,
        certificate: `${selected.changeOrderNumber}-certificate.pdf`,
      };
      downloadBlob(blob, names[kind]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  };

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected) return;
    setWorking("Uploading signed Change Order...");
    setError("");
    try {
      await uploadManuallySignedDocument("CHANGE_ORDER", selected._id, file);
      setSuccess("Signed Change Order recorded as a manual upload.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  };


  const handleVoid = async () => {
    if (!selected) return;
    const reason = window.prompt("Reason for voiding this change order?") ?? "";
    setWorking("Voiding...");
    setError("");
    try {
      await voidChangeOrder(selected._id, reason);
      setSuccess("Change order voided.");
      await load();
    } catch (voidError) {
      setError(errorMessage(voidError));
    } finally {
      setWorking("");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete draft ${selected.changeOrderNumber}? This cannot be undone.`)) return;
    setWorking("Deleting...");
    setError("");
    try {
      await deleteChangeOrder(selected._id);
      setSelectedId("");
      setSuccess("Draft deleted.");
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setWorking("");
    }
  };

  /* ------------------------------ line editing ------------------------------ */

  const addLine = () => {
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        { id: `line-${Date.now()}`, description: "", direction: "add", amount: "" },
      ],
    }));
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line
      ),
    }));
  };

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_line, lineIndex) => lineIndex !== index),
    }));
  };

  /* ------------------------------ render ------------------------------ */

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
        Loading change orders...
      </div>
    );
  }

  /*
   * The actions that apply to this Change Order in its current state. Same
   * principle as the Agreement bar: what you are most likely to tap next comes
   * first, and nothing gets squeezed - the remainder go to More.
   */
  const barActions: AdminAction[] = (() => {
    const busy = !!working;

    if (composing) {
      return [
        { key: "save", label: "Save", longLabel: "Save Change Order", disabled: busy, onClick: () => void handleSave() },
        {
          key: "generate",
          label: "Generate",
          longLabel: "Generate PDF",
          tone: "primary",
          disabled: busy,
          onClick: () => void handleGenerate(),
        },
        { key: "cancel-new", label: "Cancel", longLabel: "Cancel", tone: "danger", onClick: cancelNew },
      ];
    }

    if (!selected) {
      return [
        {
          key: "new",
          label: "New Change Order",
          tone: "primary",
          disabled: !amendable.length,
          onClick: startNew,
        },
      ];
    }

    const status = selected.status;
    const signatureLive =
      !!selected.signature &&
      !["Completed", "Declined", "Cancelled", "Expired"].includes(selected.signature.status);
    const executed = status === "Executed" || selected.signature?.status === "Completed";
    const hasPdf = Boolean(selected.generatedPdf?.available);

    const download: AdminAction = {
      key: "download",
      label: "PDF",
      longLabel: "Download Change Order",
      disabled: busy || !hasPdf,
      onClick: () => void handlePdf("download", "generated"),
    };
    const email: AdminAction = {
      key: "email",
      label: "Email",
      longLabel: "Email Change Order",
      disabled: busy || status === "Executed" || !hasPdf,
      onClick: openEmail,
    };
    const uploadSigned: AdminAction = {
      key: "upload-signed",
      label: "Upload",
      longLabel: "Upload Signed Change Order",
      disabled: busy || status === "Executed",
      file: { accept: "application/pdf,.pdf", onChange: handleManualUpload },
    };

    if (executed) {
      return [
        {
          key: "view-signed",
          label: "View Signed",
          longLabel: "Download Signed Change Order",
          tone: "success",
          disabled: busy || selected.signature?.status !== "Completed",
          onClick: () => void handleNativeDownload("executed"),
        },
        {
          key: "certificate",
          label: "Certificate",
          longLabel: "Signature Certificate",
          disabled: busy || selected.signature?.status !== "Completed",
          onClick: () => void handleNativeDownload("certificate"),
        },
        {
          key: "original",
          label: "Original",
          longLabel: "View Original Change Order",
          disabled: busy || selected.signature?.status !== "Completed",
          onClick: () => void handleNativeDownload("frozen"),
        },
        ...(selected.executedPdf?.available
          ? [
              {
                key: "download-executed",
                label: "Executed",
                longLabel: "Download Executed Copy",
                disabled: busy,
                onClick: () => void handlePdf("download", "executed"),
              } as AdminAction,
            ]
          : []),
        download,
      ];
    }

    if (signatureLive) {
      return [
        download,
        { key: "resend", label: "Resend", longLabel: "Resend Signing Link", tone: "primary", disabled: busy, onClick: () => void handleResend() },
        { key: "revoke", label: "Revoke", longLabel: "Revoke Signature Request", tone: "danger", disabled: busy, onClick: () => void handleRevoke() },
        uploadSigned,
        email,
      ];
    }

    if (hasPdf) {
      return [
        { key: "send-signature", label: "Send", longLabel: "Send for Signature", tone: "primary", disabled: busy, onClick: () => setShowSend(true) },
        { key: "in-person", label: "In Person", longLabel: "Sign In Person", tone: "success", disabled: busy, onClick: () => void handleSignInPerson() },
        email,
        download,
        uploadSigned,
        ...(status !== "Voided"
          ? [{ key: "void", label: "Void", longLabel: "Void Change Order", tone: "danger", disabled: busy, onClick: () => void handleVoid() } as AdminAction]
          : []),
      ];
    }

    return [
      { key: "generate", label: "Generate", longLabel: "Generate PDF", tone: "primary", disabled: busy, onClick: () => void handleGenerate() },
      ...(status === "Draft"
        ? [{ key: "delete", label: "Delete", longLabel: "Delete Draft", tone: "danger", disabled: busy, onClick: () => void handleDelete() } as AdminAction]
        : []),
      { key: "new", label: "New", longLabel: "New Change Order", disabled: !amendable.length, onClick: startNew },
    ];
  })();

  if (inPersonToken) {
    return (
      <InPersonSigning
        token={inPersonToken}
        onExit={() => {
          setInPersonToken(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Change Orders
            </p>
            <h3 className="mt-2 text-2xl font-black">
              {composing
                ? "New Change Order"
                : selected?.changeOrderNumber || "No change orders yet"}
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selected && !composing && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[selected.status]}`}
                >
                  {selected.status}
                </span>
              )}
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                {project.projectNumber}
              </span>
              {activeSummary && (
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                  Agreement #{activeSummary.contractNumber}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {composing ? (
              <button
                type="button"
                onClick={cancelNew}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={startNew}
                disabled={!amendable.length}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
              >
                New Change Order
              </button>
            )}
            {isEditable && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!!working}
                  className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!!working}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  Generate PDF
                </button>
              </>
            )}
          </div>
        </div>
        {working && <p className="mt-4 text-sm font-semibold text-blue-200">{working}</p>}
        {!amendable.length && (
          <p className="mt-4 text-sm font-semibold text-amber-200">
            A Change Order amends an issued Agreement. Generate an Agreement on the Agreement tab first.
          </p>
        )}
      </section>

      <ESignStatusBadge meta={signatureMeta} />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {/* Contract value roll-up */}
      {summaries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Agreement Value
          </p>
          <div className="mt-3 space-y-3">
            {summaries.map((summary) => (
              <div
                key={summary.contractId}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-sm font-black text-slate-900">
                  Agreement #{summary.contractNumber}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Original
                    </dt>
                    <dd className="text-sm font-bold text-slate-900 tabular-nums">
                      {moneyFromCents(summary.originalContractCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Executed changes
                    </dt>
                    <dd className="text-sm font-bold text-slate-900 tabular-nums">
                      {signedMoneyFromCents(summary.executedAdjustmentCents)}
                      <span className="ml-1 text-xs font-semibold text-slate-500">
                        ({summary.executedCount})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      Current Agreement
                    </dt>
                    <dd className="text-sm font-black text-emerald-700 tabular-nums">
                      {moneyFromCents(summary.executedContractCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      If pending sign
                    </dt>
                    <dd className="text-sm font-bold text-slate-600 tabular-nums">
                      {summary.pendingCount
                        ? moneyFromCents(summary.projectedContractCents)
                        : "—"}
                      {summary.pendingCount > 0 && (
                        <span className="ml-1 text-xs font-semibold text-slate-500">
                          ({summary.pendingCount})
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">
            Only executed change orders move the Agreement amount. Pending ones are shown separately.
          </p>
        </section>
      )}

      {/* List */}
      {changeOrders.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">History</p>
          <div className="mt-3 space-y-2">
            {changeOrders.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => selectChangeOrder(item._id)}
                className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition ${
                  item._id === selectedId && !composing
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-slate-900">
                    {item.changeOrderNumber}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[item.status]}`}
                  >
                    {item.status}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-slate-700">
                    {signedMoneyFromCents(item.netAdjustmentCents)}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-600">{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Editor / detail */}
      {(composing || selected) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {composing && (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Amends Agreement
              </span>
              <select
                value={contractId}
                onChange={(event) => setContractId(event.target.value)}
                className={inputClass}
              >
                {amendable.map((contract) => (
                  <option key={contract._id} value={contract._id}>
                    Agreement #{contract.contractNumber} — {contract.status} —{" "}
                    {moneyFromCents(contract.adjustedContractPriceCents || 0)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
              disabled={!isEditable}
              placeholder="Add recessed lighting and revise trim package"
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-600`}
            />
          </label>

          {/* Change lines */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Changes
              </span>
              {isEditable && (
                <button
                  type="button"
                  onClick={addLine}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Add line
                </button>
              )}
            </div>

            <div className="mt-2 space-y-2">
              {form.lines.map((line, index) => (
                <div
                  key={line.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <textarea
                    value={line.description}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
                    disabled={!isEditable}
                    rows={2}
                    placeholder="Describe exactly what changes"
                    className={`${inputClass} mt-0 disabled:bg-white disabled:text-slate-600`}
                  />
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="flex-1 min-w-[140px]">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Direction
                      </span>
                      <select
                        value={line.direction}
                        onChange={(event) =>
                          updateLine(index, {
                            direction: event.target.value as ChangeLineDirection,
                            ...(event.target.value === "none" ? { amount: "" } : {}),
                          })
                        }
                        disabled={!isEditable}
                        className={`${inputClass} disabled:bg-white disabled:text-slate-600`}
                      >
                        <option value="add">Add to Agreement</option>
                        <option value="deduct">Deduct from Agreement</option>
                        <option value="none">No cost change</option>
                      </select>
                    </label>
                    <label className="flex-1 min-w-[140px]">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Amount
                      </span>
                      <input
                        value={line.amount}
                        onChange={(event) => updateLine(index, { amount: event.target.value })}
                        disabled={!isEditable || line.direction === "none"}
                        inputMode="decimal"
                        placeholder="0.00"
                        className={`${inputClass} tabular-nums disabled:bg-white disabled:text-slate-400`}
                      />
                    </label>
                    {isEditable && form.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="rounded-xl border border-rose-200 px-3 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Money summary */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="flex items-baseline justify-between sm:block">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Agreement before
                </dt>
                <dd className="text-sm font-bold tabular-nums text-slate-900">
                  {moneyFromCents(totals.before)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between sm:block">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  This change order
                </dt>
                <dd
                  className={`text-sm font-bold tabular-nums ${
                    totals.net > 0
                      ? "text-emerald-700"
                      : totals.net < 0
                        ? "text-rose-700"
                        : "text-slate-600"
                  }`}
                >
                  {signedMoneyFromCents(totals.net)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between sm:block">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  New Agreement total
                </dt>
                <dd className="text-base font-black tabular-nums text-slate-900">
                  {moneyFromCents(totals.after)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Schedule */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Schedule impact
              </span>
              <select
                value={form.scheduleType}
                onChange={(event) =>
                  setForm((c) => ({
                    ...c,
                    scheduleType: event.target.value as ScheduleImpactType,
                  }))
                }
                disabled={!isEditable}
                className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-600`}
              >
                {(meta?.scheduleImpactTypes || ["none", "add_days", "reduce_days", "custom"]).map(
                  (type) => (
                    <option key={type} value={type}>
                      {SCHEDULE_LABELS[type]}
                    </option>
                  )
                )}
              </select>
            </label>
            {(form.scheduleType === "add_days" || form.scheduleType === "reduce_days") && (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Calendar days
                </span>
                <input
                  value={form.scheduleDays}
                  onChange={(event) => setForm((c) => ({ ...c, scheduleDays: event.target.value }))}
                  disabled={!isEditable}
                  inputMode="numeric"
                  className={`${inputClass} tabular-nums disabled:bg-slate-50 disabled:text-slate-600`}
                />
              </label>
            )}
            {form.scheduleType === "custom" && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Describe the schedule impact
                </span>
                <textarea
                  value={form.scheduleNote}
                  onChange={(event) => setForm((c) => ({ ...c, scheduleNote: event.target.value }))}
                  disabled={!isEditable}
                  rows={2}
                  className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-600`}
                />
              </label>
            )}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Additional notes
            </span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))}
              disabled={!isEditable}
              rows={3}
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-600`}
            />
          </label>

          {/*
            Document actions. The mobile action bar carries these within thumb
            reach, so this row is the desktop home for them rather than a second
            copy on a phone.
          */}
          {selected && !composing && (
            <div className="mt-5 hidden flex-wrap gap-2 border-t border-slate-200 pt-4 xl:flex">
              {selected.generatedPdf?.available && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePdf("preview", "generated")}
                    disabled={!!working}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdf("download", "generated")}
                    disabled={!!working}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={openEmail}
                    disabled={!!working || selected.status === "Executed"}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Email
                  </button>
                  {!["Executed", "Voided", "Declined"].includes(selected.status) &&
                    selected.signature?.status !== "Completed" && (
                      <>
                        <button type="button" onClick={handleSignInPerson} disabled={!!working}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
                          Sign In Person
                        </button>
                        <button type="button" onClick={() => setShowSend(true)} disabled={!!working}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40">
                          Send for Signature
                        </button>
                      </>
                    )}

                  {selected.signature &&
                    !["Completed", "Declined", "Cancelled", "Expired"].includes(selected.signature.status) && (
                      <>
                        <button type="button" onClick={handleResend} disabled={!!working}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                          Resend Link
                        </button>
                        <button type="button" onClick={handleRevoke} disabled={!!working}
                          className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                          Revoke Request
                        </button>
                      </>
                    )}

                  {selected.signature?.status === "Completed" && (
                    <>
                      <button type="button" onClick={() => void handleNativeDownload("executed")} disabled={!!working}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
                        Download Signed Change Order
                      </button>
                      <button type="button" onClick={() => void handleNativeDownload("certificate")} disabled={!!working}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                        Signature Certificate
                      </button>
                      <button type="button" onClick={() => void handleNativeDownload("frozen")} disabled={!!working}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                        View Original
                      </button>
                    </>
                  )}

                  <label className={`rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 ${selected.status === "Executed" ? "opacity-40" : "cursor-pointer hover:bg-slate-50"}`}>
                    Upload Signed Change Order
                    <input type="file" accept="application/pdf,.pdf" onChange={handleManualUpload}
                      disabled={!!working || selected.status === "Executed"} className="hidden" />
                  </label>
                </>
              )}
              {selected.executedPdf?.available && (
                <button
                  type="button"
                  onClick={() => handlePdf("download", "executed")}
                  disabled={!!working}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  Download Executed
                </button>
              )}
              {selected.status !== "Executed" && selected.status !== "Voided" && (
                <button
                  type="button"
                  onClick={handleVoid}
                  disabled={!!working}
                  className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  Void
                </button>
              )}
              {selected.status === "Draft" && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!!working}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                >
                  Delete Draft
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Signature details */}
      {selected && !composing && (
        <SignatureDetails
          signature={selected.signature || null}
          providerConfigured={signatureMeta?.configured ?? false}
          webhookConfigured={signatureMeta?.webhookConfigured ?? false}
          working={working}
          onChanged={load}
          setError={setError}
          setSuccess={setSuccess}
          setWorking={setWorking}
        />
      )}

      {/* Audit */}
      {selected && !composing && (selected.auditHistory?.length || 0) > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Document History
          </p>
          <ul className="mt-3 space-y-2">
            {[...(selected.auditHistory || [])].reverse().map((event, index) => (
              <li
                key={event._id || `${event.event}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
              >
                <span className="text-sm font-bold text-slate-800">{event.event}</span>
                <span className="text-xs font-medium text-slate-500">
                  {formatDateTime(event.at)}
                  {event.adminEmail ? ` · ${event.adminEmail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Email modal */}
      {showEmail && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleEmail}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <h4 className="text-lg font-black text-slate-900">
              Email {selected.changeOrderNumber}
            </h4>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">To</span>
              <input
                value={emailForm.recipient}
                onChange={(event) =>
                  setEmailForm((c) => ({ ...c, recipient: event.target.value }))
                }
                className={inputClass}
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Subject
              </span>
              <input
                value={emailForm.subject}
                onChange={(event) => setEmailForm((c) => ({ ...c, subject: event.target.value }))}
                className={inputClass}
                required
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Message
              </span>
              <textarea
                value={emailForm.message}
                onChange={(event) => setEmailForm((c) => ({ ...c, message: event.target.value }))}
                rows={7}
                className={inputClass}
                required
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!working}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                Send Email
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Send for signature modal */}
      {showSend && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSendForSignature}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <h4 className="text-lg font-black text-slate-900">
              Send {selected.changeOrderNumber} for signature
            </h4>
            {!signatureMeta?.configured ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Adobe Acrobat Sign is not configured on the server yet. Add the Adobe credentials
                before sending documents for signature.
              </p>
            ) : (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {selected.customerSnapshot?.email
                  ? `${selected.customerSnapshot.fullName || "The customer"} will receive a signing link at ${selected.customerSnapshot.email}.`
                  : "This change order has no customer email on file."}
                {signatureMeta?.companySignerConfigured
                  ? " Premium Island Homes will countersign after the customer signs."
                  : ""}
              </p>
            )}
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Message to signer (optional)
              </span>
              <textarea
                value={sendMessage}
                onChange={(event) => setSendMessage(event.target.value)}
                rows={4}
                className={inputClass}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSend(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !!working ||
                  !signatureMeta?.configured ||
                  !selected.customerSnapshot?.email
                }
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Send for Signature
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminActionBar
        actions={barActions}
        hidden={showEmail || showSend}
        label="Change Order actions"
      />
    </div>
  );
}
