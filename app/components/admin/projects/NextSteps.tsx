"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getProjectChangeOrders, getProjectContracts } from "@/lib/admin-service";
import { errorCode, errorMessage, invalidateQueries } from "@/lib/admin/query";
import {
  billFromSchedule,
  classifyStepEndpoint,
  newIdempotencyKey,
  projectKeys,
  resendSignatureRequest,
  sendSignatureRequest,
  type NextStep,
  type ProjectOverview,
  type StepEndpoint,
} from "@/lib/admin/projects";
import { Button, ConfirmSheet, formatCents, useToast } from "@/app/components/admin/ui";
import { AttentionBadge } from "./badges";

type Recipient = { name: string; email: string; document: string } | null;

type Pending = {
  step: NextStep;
  action: StepEndpoint;
  /** Who receives it (sends) or how much it bills (invoices), resolved before the sheet asks. */
  recipient: Recipient;
  amountCents: number | null;
  loadError: string;
};

const SEVERITY_WORD = { problem: "Problem", attention: "Needs action", info: "Next" } as const;

/** Find the document a signature belongs to, from the overview. */
function documentForSignature(overview: ProjectOverview, signatureId: string): { type: "CONTRACT" | "CHANGE_ORDER"; id: string } | null {
  const agreement = overview.documents.agreements.find((a) => a.signature?.id === signatureId);
  if (agreement) return { type: "CONTRACT", id: agreement.id };
  const co = overview.documents.changeOrders.find((c) => c.signature?.id === signatureId);
  if (co) return { type: "CHANGE_ORDER", id: co.id };
  return null;
}

/** The recipient the server will email: the document's own customer snapshot. */
async function resolveRecipient(projectId: string, type: "CONTRACT" | "CHANGE_ORDER", id: string): Promise<Recipient> {
  if (type === "CONTRACT") {
    const contracts = await getProjectContracts(projectId);
    const c = contracts.find((x) => x._id === id);
    if (!c) return null;
    return { name: c.customerSnapshot?.fullName || "", email: c.customerSnapshot?.email || "", document: `Agreement #${String(c.contractNumber || "").replace(/^#/, "")} v${c.version}` };
  }
  const data = await getProjectChangeOrders(projectId);
  const co = data.changeOrders.find((x) => x._id === id);
  if (!co) return null;
  return { name: co.customerSnapshot?.fullName || "", email: co.customerSnapshot?.email || "", document: `Change order ${co.changeOrderNumber}` };
}

/**
 * The server's next steps, most urgent first, each with the action that
 * resolves it. Customer-visible sends say who receives them; billing says
 * how much and that nothing is sent yet. Every endpoint action carries an
 * idempotency key kept across retries of the same intent, so a double tap or
 * a retry after a dropped connection never bills or sends twice.
 */
export function NextSteps({ overview, onTab }: { overview: ProjectOverview; onTab: (tab: string, extra?: Record<string, string>) => void }) {
  const router = useRouter();
  const toast = useToast();
  const projectId = overview.project.id;
  const [pending, setPending] = useState<Pending | null>(null);
  const [opening, setOpening] = useState("");
  const keys = useRef(new Map<string, string>());

  const intentKey = (step: NextStep, action: StepEndpoint) =>
    action.kind === "bill" ? `bill:${action.billKind}:${action.scheduleIndex ?? ""}` : action.kind === "send" ? `send:${action.documentId}` : `resend:${action.signatureId}`;

  const keyFor = (intent: string) => {
    let key = keys.current.get(intent);
    if (!key) {
      key = newIdempotencyKey();
      keys.current.set(intent, key);
    }
    return key;
  };

  const navigate = (href: string) => {
    try {
      const url = new URL(href, window.location.origin);
      const same = url.pathname === `/admin/projects/${projectId}`;
      if (same) {
        const extra: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          if (key !== "tab") extra[key] = value;
        });
        onTab(url.searchParams.get("tab") || "overview", extra);
        return;
      }
      if (url.origin === window.location.origin && url.pathname.startsWith("/admin/")) router.push(url.pathname + url.search, { scroll: false });
    } catch {
      /* a malformed href is ignored */
    }
  };

  const open = async (step: NextStep) => {
    if (step.action.type === "navigate") return navigate(step.action.href);
    const action = classifyStepEndpoint(step, projectId);
    if (!action) {
      toast.show("This step is done from its tab.");
      return;
    }
    setOpening(step.key);
    let recipient: Recipient = null;
    let amountCents: number | null = null;
    let loadError = "";
    try {
      if (action.kind === "send") recipient = await resolveRecipient(projectId, action.documentType, action.documentId);
      if (action.kind === "resend") {
        const doc = documentForSignature(overview, action.signatureId);
        if (doc) recipient = await resolveRecipient(projectId, doc.type, doc.id);
      }
      if (action.kind === "bill" && action.billKind === "deposit") {
        const signed = [...overview.documents.agreements].filter((a) => a.status === "Signed").sort((a, b) => b.version - a.version)[0];
        amountCents = signed ? signed.depositAmountCents : null;
      }
      if ((action.kind === "send" || action.kind === "resend") && !recipient) loadError = "The document for this step could not be found. Open its tab instead.";
    } catch (error) {
      loadError = errorMessage(error, "The recipient could not be loaded.");
    } finally {
      setOpening("");
    }
    setPending({ step, action, recipient, amountCents, loadError });
  };

  const confirm = async () => {
    if (!pending) return;
    const { action, step } = pending;
    const intent = intentKey(step, action);
    const idempotencyKey = keyFor(intent);
    try {
      if (action.kind === "bill") {
        const result = await billFromSchedule(projectId, { kind: action.billKind, scheduleIndex: action.scheduleIndex, idempotencyKey });
        const invoiceId = result.invoiceId || result.invoice?.id || result.invoice?._id || "";
        const number = result.invoiceNumber || result.invoice?.invoiceNumber || "";
        keys.current.delete(intent);
        toast.show(result.replayed ? `Invoice #${number} was already created` : `Draft invoice #${number} created. Review it, then send it.`);
        invalidateQueries(projectKeys.overview(projectId));
        invalidateQueries(["projects", "search"]);
        if (invoiceId) onTab("invoices", { invoice: invoiceId });
        return;
      }
      if (action.kind === "send") {
        const result = await sendSignatureRequest(action.documentType, action.documentId, idempotencyKey);
        keys.current.delete(intent);
        toast.show(result.emailed === false ? "Ready to sign, but the email could not be delivered. Use Resend." : `Signing link emailed to ${pending.recipient?.email}`);
      } else {
        const result = await resendSignatureRequest(action.signatureId, idempotencyKey);
        keys.current.delete(intent);
        toast.show(result.emailed === false ? "The email could not be delivered. Try again." : `A new signing link was emailed to ${pending.recipient?.email}`);
      }
      invalidateQueries(projectKeys.overview(projectId));
    } catch (error) {
      // Already billed elsewhere: the invoice exists, so the overview is refreshed for the next look.
      if (errorCode(error) === "ALREADY_BILLED") invalidateQueries(projectKeys.overview(projectId));
      throw error;
    }
  };

  if (!overview.nextSteps.length) {
    return (
      <p className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-3 text-[14px] text-adm-text-2" data-next-steps="none">
        Nothing is waiting on you for this project.
      </p>
    );
  }

  const p = pending;
  const isSend = p?.action.kind === "send" || p?.action.kind === "resend";
  const noEmail = isSend && !p?.recipient?.email;
  const billLabel =
    p?.action.kind === "bill"
      ? p.action.billKind === "deposit"
        ? `Create deposit invoice${p.amountCents ? ` for ${formatCents(p.amountCents)}` : ""}`
        : "Create milestone invoice"
      : "";

  return (
    <>
      <ul role="list" className="flex flex-col gap-2" data-next-steps="">
        {overview.nextSteps.map((step) => {
          const endpoint = step.action.type === "endpoint" ? classifyStepEndpoint(step, projectId) : null;
          const buttonLabel =
            step.action.type === "navigate"
              ? "Open"
              : endpoint?.kind === "bill"
                ? "Create invoice"
                : endpoint?.kind === "resend"
                  ? "Resend link"
                  : endpoint?.kind === "send"
                    ? "Send for signature"
                    : "Open";
          return (
            <li key={`${step.key}-${step.label}`} data-step={step.key} className="flex flex-col gap-2 rounded-adm-md border border-adm-line bg-adm-surface p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <AttentionBadge severity={step.severity}>{SEVERITY_WORD[step.severity] || "Next"}</AttentionBadge>
                <p className="mt-1 text-[15px] font-semibold text-adm-ink">{step.label}</p>
                {step.detail && <p className="text-[13px] text-adm-text-2">{step.detail}</p>}
              </div>
              <Button
                variant={step.severity === "info" ? "secondary" : "primary"}
                busy={opening === step.key}
                onClick={() => open(step)}
                className="flex-none"
                data-step-action={step.key}
              >
                {buttonLabel}
              </Button>
            </li>
          );
        })}
      </ul>

      <ConfirmSheet
        open={Boolean(p)}
        onClose={() => setPending(null)}
        title={p?.action.kind === "bill" ? billLabel : p?.action.kind === "resend" ? "Resend the signing link?" : "Send for signature?"}
        consequence={
          !p ? "" : p.loadError ? (
            p.loadError
          ) : p.action.kind === "bill" ? (
            <>
              Creates a <strong>draft</strong> invoice
              {p.action.billKind === "deposit" && p.amountCents ? <> for <strong>{formatCents(p.amountCents)}</strong></> : <> for {p.step.label.replace(/^Bill next milestone:\s*/i, "")}</>} from the signed agreement. Nothing is sent to the
              customer; review and send it from Invoices.
            </>
          ) : noEmail ? (
            `${p.recipient?.document || "This document"} has no customer email, so a link cannot be emailed. Add the email to the document, or use Sign In Person.`
          ) : (
            <>
              {p.action.kind === "resend" ? "Emails a new secure signing link for " : "Emails a secure signing link for "}
              <strong>{p.recipient?.document}</strong> to <strong>{p.recipient?.name || "the customer"}</strong> at <strong data-recipient="">{p.recipient?.email}</strong>.
              {p.action.kind === "resend" ? " The previous link stops working." : ""}
            </>
          )
        }
        confirmLabel={p?.loadError || noEmail ? "Close" : p?.action.kind === "bill" ? billLabel : `Send to ${p?.recipient?.email || "customer"}`}
        onConfirm={p && !p.loadError && !noEmail ? confirm : () => setPending(null)}
      />
    </>
  );
}
