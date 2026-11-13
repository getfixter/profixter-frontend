"use client";

import { ArrowPathIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, ClipboardDocumentIcon, CreditCardIcon, ExclamationTriangleIcon, PaperAirplaneIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errorCode, errorMessage, invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import { jobKeys, newIdempotencyKey } from "@/lib/admin/jobs";
import {
  STATUS_TONE,
  amountToCents,
  cardText,
  chargeCustomer,
  closeExtraCharge,
  deliveryText,
  extraKeys,
  extraPaymentLink,
  fetchChargeTarget,
  fetchExtraCharges,
  loadDraft,
  money2,
  refreshExtraCharge,
  retryExtraCard,
  saveDraft,
  type ChargeScope,
  type ChargeTarget,
  type Delivery,
  type Draft,
  type ExtraCharge,
} from "@/lib/admin/extraCharges";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { Button, Field, SkeletonRows, StatusBadge, TextInput, cx, useToast } from "@/app/components/admin/ui";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

/** After any change: every charge list (job and customer), and the job summary or customer billing it shows in. */
function refreshAfterCharge(scope: ChargeScope, bookingId?: string | null) {
  invalidateQueries(extraKeys.all);
  if (scope.kind === "job") invalidateQueries(jobKeys.detail(scope.id));
  else invalidateQueries(["customer", scope.id, "billing"]);
  if (bookingId && !(scope.kind === "job" && scope.id === bookingId)) invalidateQueries(jobKeys.detail(bookingId));
}

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

function sinceText(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Channels({ value, onChange, email = true, sms = true }: { value: ("email" | "sms")[]; onChange: (v: ("email" | "sms")[]) => void; email?: boolean; sms?: boolean }) {
  const items: { key: "email" | "sms"; label: string; ok: boolean }[] = [
    { key: "email", label: "Email", ok: email },
    { key: "sms", label: "Text", ok: sms },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" data-extra-channels="">
      {items.map((c) => (
        <label key={c.key} className={cx("flex min-h-[44px] items-center gap-2 rounded-adm-sm border px-3 text-[15px]", !c.ok ? "border-adm-line text-adm-text-3" : value.includes(c.key) ? "border-adm-accent bg-adm-accent-soft text-adm-ink" : "border-adm-line text-adm-ink")}>
          <input type="checkbox" disabled={!c.ok} checked={value.includes(c.key)} onChange={(e) => onChange(e.target.checked ? [...value, c.key] : value.filter((x) => x !== c.key))} className="h-5 w-5 accent-[var(--adm-accent)]" />
          {c.label}
          {!c.ok && <span className="text-[12px]">(none)</span>}
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charge customer: one screen, "Charge $X" is the confirmation         */
/* ------------------------------------------------------------------ */

export type ChargeExtraStepProps = {
  /** A job (who pays = its stored owner) or a customer profile (a direct charge, no booking). */
  scope: ChargeScope;
  footer: HTMLElement | null;
  onBack: () => void;
  setBusy: (busy: boolean) => void;
  setDirty?: (dirty: boolean) => void;
};

/**
 * Who pays (the booking's own customer, or the profile's own account, and its
 * saved card, from the server), the
 * amount to collect, an optional note, and one button: "Charge $X". Pressing
 * it charges. Success shows only when Stripe says paid; a decline or a bank
 * check shows what happened and offers a payment link for the same charge.
 */
export function ChargeExtraStep({ scope, footer, onBack, setBusy, setDirty }: ChargeExtraStepProps) {
  const toast = useToast();
  const t = useAdminQuery(extraKeys.target(scope), (signal) => fetchChargeTarget(scope, signal), { staleTime: 0 });
  const [target, setTarget] = useState<ChargeTarget | null>(null);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(scope) || { amount: "", note: "" });
  const [showNote, setShowNote] = useState(() => Boolean(loadDraft(scope)?.note));
  const [busy, setLocalBusy] = useState("");
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [repeat, setRepeat] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<("email" | "sms")[]>([]);
  const [result, setResult] = useState<{ charge: ExtraCharge; payUrl?: string; delivery?: Delivery } | null>(null);
  // One key per press of "Charge": a double tap or a retry after a timeout sends the same one.
  const keyRef = useRef(newIdempotencyKey());
  const running = useRef(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (t.data) setTarget(t.data);
  }, [t.data]);
  const cents = amountToCents(draft.amount);
  const min = target?.limits.minCents ?? 50;
  const max = target?.limits.maxCents ?? 500000;
  const amountOk = cents !== null && cents >= min && cents <= max;
  const amountError = draft.amount.trim() && !amountOk ? (cents !== null && cents > max ? `At most ${money2(max)} at once.` : `Enter dollars and cents, at least ${money2(min)}.`) : "";
  const dirty = Boolean(draft.amount.trim() || draft.note.trim()) && !result;
  useEffect(() => setDirty?.(dirty), [dirty, setDirty]);
  useEffect(() => {
    if (!result) saveDraft(scope, draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, scope.kind, scope.id, result]);
  const hasTarget = Boolean(target);
  useEffect(() => {
    if (hasTarget && !draft.amount) amountRef.current?.focus();
    // Focus the amount once, when the customer is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTarget]);

  const finish = (r: { charge: ExtraCharge; payUrl?: string; delivery?: Delivery }) => {
    setResult(r);
    saveDraft(scope, null);
    setDirty?.(false);
    refreshAfterCharge(scope);
  };

  const go = (method: "card" | "link", opts: { send?: boolean; allowRepeat?: boolean } = {}) => async () => {
    if (running.current || !target || !amountOk) return;
    running.current = true;
    setLocalBusy(method === "card" ? "charge" : opts.send ? "send" : "copy");
    setBusy(true);
    setError(null);
    try {
      const r = await chargeCustomer(scope, draft, {
        idempotencyKey: keyRef.current,
        targetFingerprint: target.fingerprint,
        method,
        allowRepeat: Boolean(opts.allowRepeat),
        send: Boolean(opts.send),
        channels: opts.send ? channels : [],
      });
      if (r.payUrl && !opts.send) {
        const ok = await writeToClipboard(r.payUrl);
        toast.show(ok ? "Payment link copied" : "Copy the link below");
      }
      setRepeat("");
      finish(r);
    } catch (err) {
      const code = errorCode(err);
      const data = (err as { response?: { data?: { target?: ChargeTarget } } })?.response?.data;
      if (code === "POSSIBLE_DUPLICATE") {
        setRepeat(errorMessage(err));
      } else {
        if (data?.target) setTarget(data.target); // the customer or card changed: show the new one, press again
        setError({ code, message: errorMessage(err, "That did not go through. What you entered is kept. Try again.") });
      }
    } finally {
      running.current = false;
      setLocalBusy("");
      setBusy(false);
    }
  };

  if (result) return <ResultView scope={scope} result={result} footer={footer} onDone={onBack} onChange={setResult} />;

  if (t.isLoading && !target) return <SkeletonRows count={2} label="Loading the customer and card" />;
  if (!target) return <Problem>{errorMessage(t.error, "The customer and card could not be loaded.")}</Problem>;

  const direct = target.direct;
  const link = target.link;
  const canCharge = direct.allowed && amountOk;
  return (
    <div className="flex flex-col gap-4" data-step="charge-extra" data-stage="charge">
      <div className="rounded-adm-md border border-adm-line px-3 py-2.5" data-extra-identity="">
        <p className="text-[17px] font-semibold text-adm-ink">
          {target.customer.name || "Customer"}
          {target.customer.guest ? <span className="font-normal text-adm-text-2"> (guest)</span> : null}
        </p>
        <p className="text-[13px] text-adm-text-2" data-extra-where={target.booking ? "job" : "direct"}>
          {target.booking ? `Job #${target.booking.number}` : "Direct charge · no booking"}
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-[15px] text-adm-ink" data-extra-card="">
          <CreditCardIcon className="h-5 w-5 flex-none text-adm-text-2" aria-hidden="true" />
          {target.card && direct.allowed ? cardText(target.card) : <span className="text-adm-text-2">No card to charge</span>}
        </p>
      </div>

      {!direct.allowed && (
        <div className="rounded-adm-sm bg-adm-attn-bg px-3 py-2.5 text-[14px] text-adm-attn" data-extra-direct-blocked={direct.code}>
          {direct.message}
        </div>
      )}

      <Field label="Amount to charge" error={amountError || undefined}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[22px] font-semibold text-adm-text-2" aria-hidden="true">
            $
          </span>
          <TextInput
            ref={amountRef}
            value={draft.amount}
            onChange={(e) => {
              setDraft({ ...draft, amount: e.target.value.replace(/[^\d.,]/g, "") });
              setRepeat("");
            }}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            enterKeyHint="done"
            style={{ paddingLeft: "2rem", fontSize: "24px", fontWeight: 600, height: "56px" }}
            name="extra-amount"
            aria-label="Amount to charge, in dollars"
          />
        </div>
      </Field>
      <p className="-mt-2 text-[13px] text-adm-text-2">This is the total the customer pays. Nothing is added to it.</p>

      {showNote ? (
        <Field label="Note (optional)" help="For your records and the customer's receipt.">
          <TextInput value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={500} enterKeyHint="done" name="extra-note" />
        </Field>
      ) : (
        <Button variant="tertiary" icon={<PlusIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => setShowNote(true)} className="self-start" data-extra-add-note="">
          Add a note
        </Button>
      )}

      {repeat && (
        <div className="flex flex-col gap-2 rounded-adm-sm bg-adm-attn-bg px-3 py-2.5 text-[14px] text-adm-attn" data-extra-repeat="">
          <p>{repeat}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setRepeat("")}>
              Don’t charge
            </Button>
            <Button busy={busy === "charge"} onClick={go("card", { allowRepeat: true })} data-extra-repeat-confirm="">
              Charge {money2(cents)} again
            </Button>
          </div>
        </div>
      )}
      {error && <Problem code={error.code}>{error.message}</Problem>}

      {!direct.allowed && link.allowed && amountOk && !sending && (
        <div className="flex flex-wrap gap-2" data-extra-link-actions="">
          <Button variant="secondary" icon={<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />} busy={busy === "copy"} disabled={Boolean(busy)} onClick={go("link")} data-extra-copy-link="">
            Copy payment link
          </Button>
          {link.canSend && (
            <Button variant="secondary" icon={<PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />} disabled={Boolean(busy)} onClick={() => setSending(true)} data-extra-send-link="">
              Send payment link
            </Button>
          )}
        </div>
      )}
      {sending && (
        <div className="flex flex-col gap-2 rounded-adm-sm bg-adm-surface-2 px-3 py-2.5" data-extra-send="">
          <p className="text-[14px] font-semibold text-adm-ink">Send a link for {money2(cents)} by</p>
          <Channels value={channels} onChange={setChannels} email={target.customer.hasEmail} sms={target.customer.hasPhone} />
          <p className="text-[13px] text-adm-text-2">{target.booking ? "Texts go only if this customer may be texted about this visit." : "Texts go only if this customer may be texted."}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSending(false)} disabled={Boolean(busy)}>
              Back
            </Button>
            <Button busy={busy === "send"} disabled={!channels.length} onClick={go("link", { send: true })} data-extra-send-confirm="">
              Send link
            </Button>
          </div>
        </div>
      )}

      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={Boolean(busy)}>
          Cancel
        </Button>
        {direct.allowed && (
          <Button large busy={busy === "charge" && !repeat} disabled={!canCharge || Boolean(repeat)} onClick={go("card")} data-extra-charge="">
            {amountOk ? `Charge ${money2(cents)}` : "Charge"}
          </Button>
        )}
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The result, and what a failure offers                                */
/* ------------------------------------------------------------------ */

function ResultView({
  scope,
  result,
  footer,
  onDone,
  onChange,
}: {
  scope: ChargeScope;
  result: { charge: ExtraCharge; payUrl?: string; delivery?: Delivery };
  footer: HTMLElement | null;
  onDone: () => void;
  onChange: (r: { charge: ExtraCharge; payUrl?: string; delivery?: Delivery }) => void;
}) {
  const c = result.charge;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [channels, setChannels] = useState<("email" | "sms")[]>([]);
  const keyRef = useRef(newIdempotencyKey());
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      onChange({ ...result, charge: await refreshExtraCharge(scope, c.id) });
      refreshAfterCharge(scope);
    } catch (e) {
      setError(errorMessage(e, "Stripe could not be reached. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const linkFor = async (send: boolean) => {
    setBusy(true);
    setError("");
    try {
      const r = await extraPaymentLink(scope, c.id, { idempotencyKey: keyRef.current, send, channels: send ? channels : [] });
      keyRef.current = newIdempotencyKey();
      if (r.payUrl && !send) await writeToClipboard(r.payUrl);
      setSending(false);
      onChange({ charge: r.charge, payUrl: send ? undefined : r.payUrl, delivery: r.delivery || null });
      refreshAfterCharge(scope);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  // Processing: look again by itself a few times, then leave it to Check now.
  const polls = useRef(0);
  useEffect(() => {
    if (c.status !== "processing" && c.status !== "charging") return;
    if (polls.current >= 4) return;
    const tm = window.setTimeout(() => {
      polls.current += 1;
      void refresh();
    }, 4000);
    return () => window.clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.status, c.id]);

  const paid = c.status === "paid";
  const head = paid ? `Paid ${money2(c.totalCents)}` : c.status === "awaiting_payment" ? `Payment link ready for ${money2(c.totalCents)}` : c.status === "failed" ? "Not charged" : c.status === "processing" || c.status === "charging" ? "Processing…" : c.statusLabel;
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
      {deliveryText(result.delivery || null).map((x) => (
        <p key={x} className="text-[14px] text-adm-text-2">
          {x}
        </p>
      ))}
      {error && <Problem>{error}</Problem>}
      {c.status === "failed" && c.actions.includes("copyLink") && !sending && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />} busy={busy} onClick={() => linkFor(false)} data-extra-result-copy="">
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
          <Channels value={channels} onChange={setChannels} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSending(false)} disabled={busy}>
              Back
            </Button>
            <Button busy={busy} disabled={!channels.length} onClick={() => linkFor(true)} data-extra-result-send-confirm="">
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
/* Charges on the job, or all of a customer's (job and direct)          */
/* ------------------------------------------------------------------ */

export function ExtraChargesBlock({ scope, canCharge, onCharge }: { scope: ChargeScope; canCharge: boolean; onCharge: () => void }) {
  const q = useAdminQuery(extraKeys.list(scope), (signal) => fetchExtraCharges(scope, signal), { staleTime: 5_000 });
  const charges = q.data || [];
  return (
    <section className="flex flex-col gap-2" data-extra-block={scope.kind}>
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-adm-ink">Charges{charges.length ? ` · ${charges.length}` : ""}</h3>
        {canCharge && (
          <Button variant="secondary" icon={<CreditCardIcon className="h-4 w-4" aria-hidden="true" />} onClick={onCharge} data-extra-open="">
            Charge customer
          </Button>
        )}
      </div>
      {q.isLoading ? (
        <p className="text-[14px] text-adm-text-2">Loading…</p>
      ) : q.error && !q.data ? (
        <Problem>{errorMessage(q.error, "The charges could not be loaded.")}</Problem>
      ) : charges.length === 0 ? (
        <p className="text-[14px] text-adm-text-2">{scope.kind === "job" ? "No charges on this job." : "No charges for this customer yet."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {charges.map((c) => (
            <ExtraRow key={c.id} scope={scope} charge={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExtraRow({ scope, charge: c }: { scope: ChargeScope; charge: ExtraCharge }) {
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
      refreshAfterCharge(scope, c.bookingId);
    } catch (e) {
      const data = (e as { response?: { data?: { card?: { brand: string; last4: string } } } })?.response?.data;
      if (errorCode(e) === "PREVIEW_CHANGED" && data?.card) setNewCard(data.card);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const card = newCard || c.card;
  return (
    <li className="rounded-adm-md border border-adm-line px-3 py-2.5" data-extra-row={c.status} data-extra-id={c.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="adm-num text-[17px] font-semibold text-adm-ink">{money2(c.totalCents)}</p>
          {scope.kind === "customer" && (
            <p className="text-[13px] font-semibold text-adm-text-2" data-extra-row-where={c.bookingId ? "job" : "direct"}>
              {c.bookingId ? (
                <a href={`/admin/jobs/${encodeURIComponent(c.bookingId)}`} className="text-adm-accent-ink underline-offset-4 hover:underline">
                  {c.where || `Job #${c.bookingNumber}`}
                </a>
              ) : (
                "Direct charge"
              )}
            </p>
          )}
          {c.note && <p className="text-[14px] text-adm-ink">{c.note}</p>}
          <p className="text-[13px] text-adm-text-2">
            {sinceText(c.confirmedAt || c.createdAt)} · by {c.confirmedByName || c.createdByName || "owner"}
            {c.card ? ` · ${cardText(c.card)}` : c.method === "link" ? " · payment link" : ""}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[c.status]}>{c.statusLabel}</StatusBadge>
      </div>
      {c.refundedCents > 0 && <p className="mt-1 text-[13px] text-adm-text-2">Refunded {money2(c.refundedCents)} in Stripe.</p>}
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
                const r = await extraPaymentLink(scope, c.id, { idempotencyKey: keyRef.current, send: false });
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
            <Button
              busy={busy}
              onClick={() =>
                act(async () => {
                  await retryExtraCard(scope, c.id, { idempotencyKey: keyRef.current, expectedCardLast4: card.last4 });
                  setMode("");
                  setNewCard(null);
                })
              }
            >
              Charge {money2(c.totalCents)}
            </Button>
          </div>
        </div>
      )}
      {mode === "send" && (
        <div className="mt-2 flex flex-col gap-2 rounded-adm-sm bg-adm-surface-2 px-3 py-2.5" data-extra-send="">
          <Channels value={channels} onChange={setChannels} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMode("")} disabled={busy}>
              Back
            </Button>
            <Button
              busy={busy}
              disabled={!channels.length}
              onClick={() =>
                act(async () => {
                  const r = await extraPaymentLink(scope, c.id, { idempotencyKey: keyRef.current, send: true, channels });
                  toast.show(deliveryText(r.delivery || null).join(" · ") || "Link made");
                  setMode("");
                })
              }
            >
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
            <Button
              variant="danger"
              busy={busy}
              onClick={() =>
                act(async () => {
                  await closeExtraCharge(scope, c.id);
                  setMode("");
                })
              }
            >
              Close unpaid
            </Button>
          </div>
        </div>
      )}
      {payUrl && (
        <p className="mt-1 break-all text-[13px] text-adm-text-2" data-extra-row-url="">
          {payUrl}
        </p>
      )}
      {error && (
        <div className="mt-2">
          <Problem>{error}</Problem>
        </div>
      )}
    </li>
  );
}
