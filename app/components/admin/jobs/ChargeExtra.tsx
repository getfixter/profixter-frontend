"use client";

import { ArrowPathIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, ClipboardDocumentIcon, CreditCardIcon, ExclamationTriangleIcon, PaperAirplaneIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errorCode, errorMessage, invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import { jobKeys, newIdempotencyKey, type JobDetail } from "@/lib/admin/jobs";
import {
  BASIS_DOCUMENTS,
  TAX_OPTIONS,
  STATUS_TONE,
  amountToCents,
  cardText,
  closeExtraCharge,
  createExtraCharge,
  deliveryText,
  extraKeys,
  extraPaymentLink,
  fetchExtraCharges,
  loadDraft,
  money2,
  previewExtraCharge,
  refreshExtraCharge,
  retryExtraCard,
  saveDraft,
  type Delivery,
  type ExtraCharge,
  type ExtraInput,
  type ExtraPreview,
} from "@/lib/admin/extraCharges";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { Button, Field, StatusBadge, TextInput, Textarea, cx, useToast } from "@/app/components/admin/ui";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Footer({ el, children }: { el: HTMLElement | null; children: ReactNode }) {
  return el ? createPortal(children, el) : null;
}

function Problem({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2.5 text-[14px] text-adm-problem" data-extra-error={code || "error"}>
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className={cx("text-[14px]", muted ? "text-adm-text-2" : "text-adm-ink")}>{label}</dt>
      <dd className={cx("adm-num text-right", strong ? "text-[17px] font-semibold text-adm-ink" : "text-[15px] text-adm-ink")}>{value}</dd>
    </div>
  );
}

function sinceText(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* The step: enter -> review -> (send link) -> result                  */
/* ------------------------------------------------------------------ */

type Stage = "enter" | "review" | "send" | "result";

export type ChargeExtraStepProps = {
  job: JobDetail;
  footer: HTMLElement | null;
  onBack: () => void;
  setBusy: (busy: boolean) => void;
  setDirty?: (dirty: boolean) => void;
};

/**
 * Charge extra (owner only). Fast path: description + amount + tax -> Review
 * (server preview: customer, address, card, tax, total) -> tick the
 * confirmation -> "Charge $123.45". Everything entered survives a failure,
 * and a draft is kept for this job until it is charged.
 */
export function ChargeExtraStep({ job, footer, onBack, setBusy, setDirty }: ChargeExtraStepProps) {
  const toast = useToast();
  const [input, setInput] = useState<ExtraInput>(() => loadDraft(job.id) || { description: "", amount: "", taxTreatment: "", writtenApprovalRef: "" });
  const [stage, setStage] = useState<Stage>("enter");
  const [preview, setPreview] = useState<ExtraPreview | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [channels, setChannels] = useState<("email" | "sms")[]>([]);
  const [busy, setLocalBusy] = useState<string>("");
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [result, setResult] = useState<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery } | null>(null);
  // One key per intent: the confirm and every retry of it (double tap, timeout) send the same one.
  const keyRef = useRef(newIdempotencyKey());
  const running = useRef(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const cents = amountToCents(input.amount);
  const dirty = Boolean(input.description.trim() || input.amount.trim()) && stage !== "result";
  useEffect(() => setDirty?.(dirty), [dirty, setDirty]);
  useEffect(() => {
    if (stage !== "result") saveDraft(job.id, input);
  }, [input, job.id, stage]);
  useEffect(() => {
    if (stage === "enter" && !input.description) descRef.current?.focus();
    // Focus only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setLocalBusy(label);
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError({ code: errorCode(err), message: errorMessage(err, "That did not go through. What you entered is kept. Try again.") });
      const data = (err as { response?: { data?: { preview?: ExtraPreview } } })?.response?.data;
      if (data?.preview) {
        // Something changed (card, customer, tax): show the new details, ask again.
        setPreview(data.preview);
        setAgreed(false);
        setStage("review");
      }
    } finally {
      running.current = false;
      setLocalBusy("");
      setBusy(false);
    }
  };

  const enterErrors = {
    description: input.description.trim().length > 0 && input.description.trim().length < 3 ? "Describe the work in a few words." : "",
    amount: input.amount.trim() && (cents === null || cents < 50) ? "Enter dollars and cents, at least $0.50." : cents !== null && cents > 500000 ? "One extra can be at most $5,000." : "",
  };
  const basisDocs = input.taxTreatment ? BASIS_DOCUMENTS[input.taxTreatment] : undefined;
  const basis = input.taxBasis || { document: "", reference: "", onFile: false };
  const basisOk = !basisDocs || (basisDocs.some((d) => d.value === basis.document) && basis.reference.trim().length >= 4 && basis.onFile);
  const canReview = input.description.trim().length >= 3 && cents !== null && cents >= 50 && cents <= 500000 && Boolean(input.taxTreatment) && basisOk;

  const review = () =>
    run("review", async () => {
      const p = await previewExtraCharge(job.id, input);
      setPreview(p);
      setAgreed(false);
      setStage("review");
    });

  const finish = (r: { charge: ExtraCharge; payUrl?: string; delivery?: Delivery }) => {
    setResult(r);
    setStage("result");
    saveDraft(job.id, null);
    setDirty?.(false);
    invalidateQueries(extraKeys.list(job.id));
    invalidateQueries(jobKeys.detail(job.id));
  };

  const confirm = (method: "card" | "link", opts: { send?: boolean } = {}) =>
    run(method === "card" ? "charge" : opts.send ? "send" : "copy", async () => {
      if (!preview || preview.totalCents === null) return;
      const r = await createExtraCharge(job.id, input, {
        idempotencyKey: keyRef.current,
        previewFingerprint: preview.fingerprint,
        expectedTotalCents: preview.totalCents,
        customerAgreed: agreed,
        method,
        send: Boolean(opts.send),
        channels: opts.send ? channels : [],
      });
      if (r.payUrl && !opts.send) {
        const ok = await writeToClipboard(r.payUrl);
        toast.show(ok ? "Payment link copied" : "Copy the link below");
      }
      finish(r);
    });

  /* ------------------------------ enter ------------------------------ */
  if (stage === "enter") {
    return (
      <div className="flex flex-col gap-4" data-step="charge-extra" data-stage="enter">
        <div className="rounded-adm-sm bg-adm-surface-2 px-3 py-2.5 text-[14px] text-adm-ink" data-extra-who="">
          <p className="font-semibold">{job.customer.name || "Customer"}</p>
          <p className="text-adm-text-2">
            Job #{String(job.bookingNumber || "").replace(/^#/, "")} · {job.address.full || "No address on the job"}
          </p>
        </div>
        <Field label="Additional work" required help="What was added, as agreed with the customer." error={enterErrors.description || undefined}>
          <Textarea ref={descRef} value={input.description} onChange={(e) => setInput({ ...input, description: e.target.value })} rows={2} maxLength={500} enterKeyHint="next" name="extra-description" />
        </Field>
        <Field label="Amount before tax" required error={enterErrors.amount || undefined}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-adm-text-2" aria-hidden="true">
              $
            </span>
            <TextInput
              value={input.amount}
              onChange={(e) => setInput({ ...input, amount: e.target.value.replace(/[^\d.,]/g, "") })}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              enterKeyHint="done"
              style={{ paddingLeft: "1.75rem" }}
              name="extra-amount"
              aria-label="Amount in dollars before tax"
            />
          </div>
        </Field>
        <fieldset className="flex flex-col gap-2" data-extra-tax="">
          <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">Sales tax</legend>
          {TAX_OPTIONS.map((o) => (
            <label key={o.value} className={cx("flex min-h-[44px] cursor-pointer items-start gap-3 rounded-adm-sm border px-3 py-2.5", input.taxTreatment === o.value ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line")}>
              <input
                type="radio"
                name="extra-tax"
                checked={input.taxTreatment === o.value}
                onChange={() => setInput({ ...input, taxTreatment: o.value, taxBasis: BASIS_DOCUMENTS[o.value] ? { document: BASIS_DOCUMENTS[o.value].length === 1 ? BASIS_DOCUMENTS[o.value][0].value : "", reference: "", onFile: false } : undefined })}
                className="mt-0.5 h-5 w-5 flex-none accent-[var(--adm-accent)]"
              />
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold text-adm-ink">{o.label}</span>
                <span className="text-[13px] text-adm-text-2">{o.help}</span>
              </span>
            </label>
          ))}
          {!input.taxTreatment && <p className="text-[13px] text-adm-text-2">Choose one. Nothing is assumed about tax.</p>}
        </fieldset>
        {basisDocs && (
          <fieldset className="flex flex-col gap-3 rounded-adm-md border border-adm-line px-3 py-3" data-extra-basis="">
            <legend className="px-1 text-[13px] font-semibold text-adm-ink">Document that makes it tax free</legend>
            {basisDocs.length > 1 ? (
              <Field label="Document" required>
                <select
                  className="adm-input"
                  name="extra-basis-document"
                  value={basis.document}
                  onChange={(e) => setInput({ ...input, taxBasis: { ...basis, document: e.target.value } })}
                >
                  <option value="">Choose…</option>
                  {basisDocs.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-[14px] text-adm-ink">{basisDocs[0].label}</p>
            )}
            <Field label="Reference" required help="Certificate number, date signed, or where it is filed.">
              <TextInput value={basis.reference} onChange={(e) => setInput({ ...input, taxBasis: { ...basis, reference: e.target.value } })} maxLength={200} enterKeyHint="done" name="extra-basis-reference" />
            </Field>
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3" data-extra-basis-onfile="">
              <input type="checkbox" checked={basis.onFile} onChange={(e) => setInput({ ...input, taxBasis: { ...basis, onFile: e.target.checked } })} className="mt-0.5 h-5 w-5 flex-none accent-[var(--adm-accent)]" name="extra-basis-onfile" />
              <span className="text-[14px] text-adm-ink">I have this document on file for this job.</span>
            </label>
          </fieldset>
        )}
        <Field label="Written approval (optional)" help="Where the customer's written OK is, e.g. “text 2:14 pm” or “signed change order”.">
          <TextInput value={input.writtenApprovalRef || ""} onChange={(e) => setInput({ ...input, writtenApprovalRef: e.target.value })} maxLength={300} enterKeyHint="done" name="extra-approval" />
        </Field>
        {error && <Problem code={error.code}>{error.message}</Problem>}
        <Footer el={footer}>
          <Button variant="secondary" large onClick={onBack} disabled={Boolean(busy)}>
            Cancel
          </Button>
          <Button large busy={busy === "review"} disabled={!canReview} onClick={review} data-extra-review="">
            Review
          </Button>
        </Footer>
      </div>
    );
  }

  /* ------------------------------ review ----------------------------- */
  if ((stage === "review" || stage === "send") && preview) {
    const total = preview.totalCents;
    const direct = preview.direct;
    const link = preview.link;
    const canCharge = direct.allowed && total !== null;
    const channelChoices: { key: "email" | "sms"; label: string; ok: boolean }[] = [
      { key: "email", label: "Email", ok: preview.customer.hasEmail },
      { key: "sms", label: "Text", ok: preview.customer.hasPhone },
    ];
    return (
      <div className="flex flex-col gap-4" data-step="charge-extra" data-stage={stage}>
        <dl className="rounded-adm-md border border-adm-line px-3 py-2.5" data-extra-identity="">
          <Row label="Customer" value={<span className="font-semibold">{preview.customer.name || "Customer"}{preview.customer.guest ? " (guest)" : ""}</span>} />
          <Row label="Job" value={`#${preview.booking.number}`} />
          <div className="py-1">
            <dt className="text-[14px] text-adm-text-2">Service address</dt>
            <dd className="text-[15px] text-adm-ink" data-extra-address="">
              {preview.serviceAddress.full || "No service address"}
            </dd>
          </div>
          <Row label="Card" value={preview.card ? <span data-extra-card="">{cardText(preview.card)}</span> : <span className="text-adm-text-2">No card to charge</span>} />
        </dl>

        <div className="rounded-adm-md border border-adm-line px-3 py-2.5" data-extra-totals="">
          <p className="pb-1 text-[15px] text-adm-ink">{preview.description}</p>
          <dl>
            <Row label="Subtotal" value={money2(preview.subtotalCents)} muted />
            <Row
              label={preview.tax.ok ? (preview.taxCents ? `Sales tax${preview.tax.ratePercent ? ` (${Number(preview.tax.ratePercent)}%)` : ""}` : "Sales tax (none: " + (preview.tax.treatment === "Tax Exempt" ? "tax exempt" : "capital improvement") + ")") : "Sales tax"}
              value={preview.tax.ok ? money2(preview.taxCents) : "—"}
              muted
            />
            <div className="mt-1 border-t border-adm-line pt-1">
              <Row label="Total" value={<span data-extra-total="">{money2(total)}</span>} strong />
            </div>
          </dl>
          {preview.tax.ok && preview.tax.source === "stripe_tax" && <p className="pt-1 text-[12px] text-adm-text-2">Tax by Stripe Tax for the service address{preview.tax.taxCode ? ` · code ${preview.tax.taxCode}` : ""}.</p>}
          {preview.tax.ok && preview.tax.basis && (
            <p className="pt-1 text-[12px] text-adm-text-2" data-extra-basis-review="">
              No tax on the basis of: {preview.tax.basis.label} · {preview.tax.basis.reference}
            </p>
          )}
        </div>

        {!preview.tax.ok && <Problem code={preview.tax.code}>{preview.tax.message}</Problem>}
        {preview.tax.ok && !direct.allowed && (
          <div className="rounded-adm-sm bg-adm-attn-bg px-3 py-2.5 text-[14px] text-adm-attn" data-extra-direct-blocked={direct.code}>
            <p className="font-semibold">The card can’t be charged here</p>
            <p>{direct.message}</p>
          </div>
        )}

        {total !== null && (direct.allowed || link.allowed) && (
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-adm-sm border border-adm-line px-3 py-2.5" data-extra-consent="">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[var(--adm-accent)]" name="extra-agreed" />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-adm-ink">{preview.consentStatement}</span>
              <span className="text-[13px] text-adm-text-2">Saved with your name and the time. It records your confirmation; on its own it does not prove the customer’s consent{input.writtenApprovalRef ? "" : ", so note any written approval"}.</span>
            </span>
          </label>
        )}

        {stage === "send" && (
          <fieldset className="flex flex-col gap-2" data-extra-channels="">
            <legend className="mb-1 text-[13px] font-semibold text-adm-ink">Send the link by</legend>
            <div className="grid grid-cols-2 gap-2">
              {channelChoices.map((c) => (
                <label key={c.key} className={cx("flex min-h-[44px] items-center gap-2 rounded-adm-sm border px-3 text-[15px]", !c.ok ? "border-adm-line text-adm-text-3" : channels.includes(c.key) ? "border-adm-accent bg-adm-accent-soft text-adm-ink" : "border-adm-line text-adm-ink")}>
                  <input type="checkbox" disabled={!c.ok} checked={channels.includes(c.key)} onChange={(e) => setChannels(e.target.checked ? [...channels, c.key] : channels.filter((x) => x !== c.key))} className="h-5 w-5 accent-[var(--adm-accent)]" />
                  {c.label}
                  {!c.ok && <span className="text-[12px]">(none)</span>}
                </label>
              ))}
            </div>
            <p className="text-[13px] text-adm-text-2">Texts go only if this customer may be texted about this visit. Stripe emails the receipt after payment.</p>
          </fieldset>
        )}

        {error && <Problem code={error.code}>{error.message}</Problem>}

        {stage === "review" && link.allowed && total !== null && (
          <div className="flex flex-wrap gap-2" data-extra-link-actions="">
            <Button variant="secondary" icon={<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />} disabled={!agreed || Boolean(busy)} busy={busy === "copy"} onClick={() => confirm("link")} data-extra-copy-link="">
              Copy payment link
            </Button>
            {link.canSend && (
              <Button variant="secondary" icon={<PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />} disabled={!agreed || Boolean(busy)} onClick={() => setStage("send")} data-extra-send-link="">
                Send payment link
              </Button>
            )}
          </div>
        )}

        <Footer el={footer}>
          <Button variant="secondary" large onClick={() => (stage === "send" ? setStage("review") : setStage("enter"))} disabled={Boolean(busy)}>
            {stage === "send" ? "Back" : "Edit"}
          </Button>
          {stage === "send" ? (
            <Button large busy={busy === "send"} disabled={!agreed || channels.length === 0} onClick={() => confirm("link", { send: true })} data-extra-send-confirm="">
              Send link for {money2(total)}
            </Button>
          ) : canCharge ? (
            <Button large busy={busy === "charge"} disabled={!agreed} onClick={() => confirm("card")} data-extra-charge="">
              Charge {money2(total)}
            </Button>
          ) : null}
        </Footer>
      </div>
    );
  }

  /* ------------------------------ result ----------------------------- */
  if (stage === "result" && result) {
    return <ResultView job={job} result={result} footer={footer} onDone={onBack} onChange={(r) => setResult(r)} />;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Result, and the follow-ups a failure offers                         */
/* ------------------------------------------------------------------ */

function ResultView({
  job,
  result,
  footer,
  onDone,
  onChange,
}: {
  job: JobDetail;
  result: { charge: ExtraCharge; payUrl?: string; delivery?: Delivery };
  footer: HTMLElement | null;
  onDone: () => void;
  onChange: (r: { charge: ExtraCharge; payUrl?: string; delivery?: Delivery }) => void;
}) {
  const c = result.charge;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const keyRef = useRef(newIdempotencyKey());
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      onChange({ ...result, charge: await refreshExtraCharge(job.id, c.id) });
      invalidateQueries(extraKeys.list(job.id));
    } catch (e) {
      setError(errorMessage(e, "Stripe could not be reached. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<("email" | "sms")[]>([]);
  const copyLink = async (send = false) => {
    setBusy(true);
    setError("");
    try {
      const r = await extraPaymentLink(job.id, c.id, { idempotencyKey: keyRef.current, send, channels: send ? channels : [] });
      keyRef.current = newIdempotencyKey();
      if (r.payUrl && !send) await writeToClipboard(r.payUrl);
      setSending(false);
      onChange({ charge: r.charge, payUrl: send ? undefined : r.payUrl, delivery: r.delivery || null });
      invalidateQueries(extraKeys.list(job.id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  // Processing: look again by itself a few times, then leave it to the Refresh button.
  const polls = useRef(0);
  useEffect(() => {
    if (c.status !== "processing" && c.status !== "charging") return;
    if (polls.current >= 4) return;
    const t = window.setTimeout(() => {
      polls.current += 1;
      void refresh();
    }, 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.status, c.id]);

  const paid = c.status === "paid";
  const head =
    paid ? `Paid ${money2(c.totalCents)}` : c.status === "awaiting_payment" ? `Payment link ready for ${money2(c.totalCents)}` : c.status === "failed" ? "Not charged" : c.status === "processing" || c.status === "charging" ? "Processing…" : c.statusLabel;
  return (
    <div className="flex flex-col gap-4" data-step="charge-extra" data-stage="result" data-extra-status={c.status}>
      <div className={cx("flex items-start gap-3 rounded-adm-md px-3 py-3", paid ? "bg-adm-ok-bg" : c.status === "failed" ? "bg-adm-problem-bg" : "bg-adm-info-bg")} role="status">
        {paid ? <CheckCircleIcon className="h-6 w-6 flex-none text-adm-ok" aria-hidden="true" /> : c.status === "failed" ? <ExclamationTriangleIcon className="h-6 w-6 flex-none text-adm-problem" aria-hidden="true" /> : <ArrowPathIcon className="h-6 w-6 flex-none text-adm-info" aria-hidden="true" />}
        <div className="flex flex-col gap-1 text-[14px] text-adm-ink">
          <p className="text-[17px] font-semibold">{head}</p>
          {paid && <p>{cardText(c.card) ? `Charged to ${cardText(c.card)}. ` : ""}Stripe emails the customer a receipt.</p>}
          {(c.status === "processing" || c.status === "charging") && <p>Stripe has not confirmed it yet. Nothing is shown as paid until it does. Do not charge again; this updates by itself.</p>}
          {c.status === "failed" && <p>{c.failure?.message || "The payment did not go through. Nothing was charged."}</p>}
          {c.status === "awaiting_payment" && <p>The customer pays on Stripe’s page. This updates when they do.</p>}
        </div>
      </div>
      {result.payUrl && (
        <div className="flex flex-col gap-1 rounded-adm-sm border border-adm-line px-3 py-2" data-extra-pay-url="">
          <p className="text-[13px] text-adm-text-2">Payment link (shown once, works 7 days)</p>
          <p className="break-all text-[14px] text-adm-ink">{result.payUrl}</p>
        </div>
      )}
      {deliveryText(result.delivery || null).map((t) => (
        <p key={t} className="text-[14px] text-adm-text-2">
          {t}
        </p>
      ))}
      {error && <Problem>{error}</Problem>}
      {c.status === "failed" && c.actions.includes("copyLink") && !sending && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />} busy={busy} onClick={() => copyLink(false)} data-extra-result-copy="">
            Copy payment link
          </Button>
          <Button variant="secondary" icon={<PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />} disabled={busy} onClick={() => setSending(true)} data-extra-result-send="">
            Send payment link
          </Button>
        </div>
      )}
      {sending && (
        <div className="flex flex-col gap-2 rounded-adm-sm bg-adm-surface-2 px-3 py-2.5" data-extra-result-channels="">
          <p className="text-[14px] font-semibold text-adm-ink">Send the link for {money2(c.totalCents)} by</p>
          <div className="grid grid-cols-2 gap-2">
            {(["email", "sms"] as const).map((k) => (
              <label key={k} className={cx("flex min-h-[44px] items-center gap-2 rounded-adm-sm border px-3 text-[15px]", channels.includes(k) ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line")}>
                <input type="checkbox" checked={channels.includes(k)} onChange={(e) => setChannels(e.target.checked ? [...channels, k] : channels.filter((x) => x !== k))} className="h-5 w-5 accent-[var(--adm-accent)]" />
                {k === "email" ? "Email" : "Text"}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSending(false)} disabled={busy}>
              Back
            </Button>
            <Button busy={busy} disabled={!channels.length} onClick={() => copyLink(true)} data-extra-result-send-confirm="">
              Send link
            </Button>
          </div>
        </div>
      )}
      <Footer el={footer}>
        {(c.status === "processing" || c.status === "charging") && (
          <Button variant="secondary" large busy={busy} onClick={refresh} data-extra-refresh="">
            Check now
          </Button>
        )}
        <Button large onClick={onDone} data-extra-done="">
          Done
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Additional charges on the job                                       */
/* ------------------------------------------------------------------ */

export function ExtraChargesBlock({ job, canCharge, onCharge }: { job: JobDetail; canCharge: boolean; onCharge: () => void }) {
  const q = useAdminQuery(extraKeys.list(job.id), (signal) => fetchExtraCharges(job.id, signal), { staleTime: 5_000 });
  const charges = q.data || [];
  return (
    <section className="flex flex-col gap-2" data-extra-block="">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-adm-ink">Additional charges{charges.length ? ` · ${charges.length}` : ""}</h3>
        {canCharge && (
          <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" aria-hidden="true" />} onClick={onCharge} data-extra-open="">
            Charge extra
          </Button>
        )}
      </div>
      {q.isLoading ? (
        <p className="text-[14px] text-adm-text-2">Loading…</p>
      ) : q.error && !q.data ? (
        <Problem>{errorMessage(q.error, "The additional charges could not be loaded.")}</Problem>
      ) : charges.length === 0 ? (
        <p className="text-[14px] text-adm-text-2">None on this job.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {charges.map((c) => (
            <ExtraRow key={c.id} job={job} charge={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExtraRow({ job, charge: c }: { job: JobDetail; charge: ExtraCharge }) {
  const toast = useToast();
  const [mode, setMode] = useState<"" | "retry" | "send" | "close">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payUrl, setPayUrl] = useState("");
  const [newCard, setNewCard] = useState<{ brand: string; last4: string } | null>(null);
  const [channels, setChannels] = useState<("email" | "sms")[]>([]);
  const keyRef = useRef(newIdempotencyKey());
  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      keyRef.current = newIdempotencyKey();
      invalidateQueries(extraKeys.list(job.id));
      invalidateQueries(jobKeys.detail(job.id));
    } catch (e) {
      const data = (e as { response?: { data?: { card?: { brand: string; last4: string } } } })?.response?.data;
      if (errorCode(e) === "PREVIEW_CHANGED" && data?.card) setNewCard(data.card);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const card = newCard || c.card;
  const refunded = c.refundedCents > 0;
  return (
    <li className="rounded-adm-md border border-adm-line px-3 py-2.5" data-extra-row={c.status} data-extra-id={c.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-adm-ink">{c.description}</p>
          <p className="text-[13px] text-adm-text-2">
            {c.number} · {sinceText(c.createdAt)} · by {c.createdByName || "owner"}
            {c.card ? ` · ${cardText(c.card)}` : c.method === "link" ? " · payment link" : ""}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[c.status]}>{c.statusLabel}</StatusBadge>
      </div>
      <dl className="mt-1.5 grid grid-cols-3 gap-2 text-[13px]">
        <div>
          <dt className="text-adm-text-2">Subtotal</dt>
          <dd className="adm-num text-adm-ink">{money2(c.subtotalCents)}</dd>
        </div>
        <div>
          <dt className="text-adm-text-2">Tax</dt>
          <dd className="adm-num text-adm-ink">{money2(c.taxCents)}</dd>
        </div>
        <div>
          <dt className="text-adm-text-2">Total</dt>
          <dd className="adm-num font-semibold text-adm-ink">{money2(c.totalCents)}</dd>
        </div>
      </dl>
      {refunded && <p className="mt-1 text-[13px] text-adm-text-2">Refunded {money2(c.refundedCents)} in Stripe.</p>}
      {c.failure && c.status === "failed" && <p className="mt-1 text-[13px] text-adm-problem">{c.failure.message}</p>}
      {c.status === "processing" || c.status === "charging" ? <p className="mt-1 text-[13px] text-adm-text-2">Waiting for Stripe. Do not charge again.</p> : null}
      {c.status === "awaiting_payment" && c.link && <p className="mt-1 text-[13px] text-adm-text-2">Link {c.link.sentVia.length ? `sent by ${c.link.sentVia.join(" and ")}` : "copied"} · works until {sinceText(c.link.expiresAt)}</p>}
      {c.extraPayments.length > 0 && (
        <p className="mt-1 rounded-adm-sm bg-adm-problem-bg px-2 py-1.5 text-[13px] text-adm-problem" data-extra-double="">
          Paid twice: a second payment of {money2(c.extraPayments[0].amountCents)} reached Stripe.{" "}
          <a href={c.extraPayments[0].stripeUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            Refund it in Stripe
          </a>
        </p>
      )}
      {c.tax.recordError && <p className="mt-1 text-[12px] text-adm-attn">Stripe Tax did not record this sale yet ({c.tax.recordError}). It is retried when the job is opened.</p>}
      {c.consent.writtenApprovalRef && <p className="mt-1 text-[12px] text-adm-text-2">Written approval: {c.consent.writtenApprovalRef}</p>}
      {c.tax.basis && <p className="mt-1 text-[12px] text-adm-text-2">No tax: {c.tax.basis.document} · {c.tax.basis.reference}</p>}

      <div className="mt-1 flex flex-wrap gap-x-4">
        {c.stripeUrl && (
          <a href={c.stripeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-adm-accent-ink" data-extra-stripe="">
            {["paid", "partially_refunded"].includes(c.status) ? "Refund in Stripe" : "Open in Stripe"}
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
        {c.receiptUrl && (
          <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-adm-accent-ink" data-extra-receipt="">
            Receipt
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      {c.actions.length > 0 && mode === "" && (
        <div className="mt-1 flex flex-wrap gap-2" data-extra-row-actions="">
          {c.actions.includes("retryCard") && c.card && (
            <Button variant="secondary" icon={<CreditCardIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => setMode("retry")}>
              Try card again
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />}
            busy={busy && !mode}
            onClick={() =>
              act(async () => {
                const r = await extraPaymentLink(job.id, c.id, { idempotencyKey: keyRef.current, send: false });
                if (r.payUrl) {
                  setPayUrl(r.payUrl);
                  const ok = await writeToClipboard(r.payUrl);
                  toast.show(ok ? "Payment link copied" : "Copy the link below");
                }
              })
            }
            data-extra-row-copy=""
          >
            Copy payment link
          </Button>
          <Button variant="secondary" icon={<PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => setMode("send")}>
            Send payment link
          </Button>
          <Button variant="tertiary" onClick={() => setMode("close")}>
            Close unpaid
          </Button>
        </div>
      )}
      {mode === "retry" && card && (
        <div className="mt-2 flex flex-col gap-2 rounded-adm-sm bg-adm-surface-2 px-3 py-2.5" data-extra-retry="">
          <p className="text-[14px] text-adm-ink">
            Charge {cardText(card)} {money2(c.totalCents)} again? Only if the customer fixed the card or asked you to.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode("")} disabled={busy}>
              Back
            </Button>
            <Button busy={busy} onClick={() => act(async () => { await retryExtraCard(job.id, c.id, { idempotencyKey: keyRef.current, expectedCardLast4: card.last4 }); setMode(""); setNewCard(null); })}>
              Charge {money2(c.totalCents)}
            </Button>
          </div>
        </div>
      )}
      {mode === "send" && (
        <div className="mt-2 flex flex-col gap-2 rounded-adm-sm bg-adm-surface-2 px-3 py-2.5" data-extra-send="">
          <div className="grid grid-cols-2 gap-2">
            {(["email", "sms"] as const).map((k) => (
              <label key={k} className={cx("flex min-h-[44px] items-center gap-2 rounded-adm-sm border px-3 text-[15px]", channels.includes(k) ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line")}>
                <input type="checkbox" checked={channels.includes(k)} onChange={(e) => setChannels(e.target.checked ? [...channels, k] : channels.filter((x) => x !== k))} className="h-5 w-5 accent-[var(--adm-accent)]" />
                {k === "email" ? "Email" : "Text"}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode("")} disabled={busy}>
              Back
            </Button>
            <Button busy={busy} disabled={!channels.length} onClick={() => act(async () => { const r = await extraPaymentLink(job.id, c.id, { idempotencyKey: keyRef.current, send: true, channels }); toast.show(deliveryText(r.delivery || null).join(" · ") || "Link made"); setMode(""); })}>
              Send link
            </Button>
          </div>
        </div>
      )}
      {mode === "close" && (
        <div className="mt-2 flex flex-col gap-2 rounded-adm-sm bg-adm-surface-2 px-3 py-2.5" data-extra-close="">
          <p className="text-[14px] text-adm-ink">Close this unpaid charge? Its payment link stops working. Nothing is charged.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode("")} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" busy={busy} onClick={() => act(async () => { await closeExtraCharge(job.id, c.id); setMode(""); })}>
              Close unpaid
            </Button>
          </div>
        </div>
      )}
      {payUrl && <p className="mt-1 break-all text-[13px] text-adm-text-2" data-extra-row-url="">{payUrl}</p>}
      {error && (
        <div className="mt-2">
          <Problem>{error}</Problem>
        </div>
      )}
    </li>
  );
}
