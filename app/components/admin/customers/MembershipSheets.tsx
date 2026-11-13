"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatAddressLine } from "@/lib/admin/address";
import { errorCode, errorMessage } from "@/lib/admin/query";
import {
  PLAN_KEYS,
  confirmPlanChange,
  grantComplimentary,
  hasLiveMembership,
  membershipSentence,
  newIdempotencyKey,
  planLabel,
  previewPlanChange,
  scheduleCancellation,
  shortDate,
  type BillingCycle,
  type CustomerAddress,
  type PlanKey,
  type PlanPreview,
} from "@/lib/admin/customers";
import { Button, Field, Sheet, TextInput, Textarea, cx, formatCents } from "@/app/components/admin/ui";

/* ------------------------------------------------------------------ bits */

function todayNY(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
function tomorrowNY(): string {
  const [y, m, d] = todayNY().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
/** "2026-12-01" -> "Dec 1, 2026" (a calendar day, not an instant). */
function ymdLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function Choice({
  name,
  value,
  current,
  onChange,
  label,
  hint,
  disabled,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (value: string) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const checked = value === current;
  return (
    <label
      className={cx(
        "flex min-h-[48px] cursor-pointer items-start gap-3 rounded-adm-sm border px-3 py-2.5",
        checked ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line bg-adm-surface",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="mt-1 h-4 w-4 flex-none accent-[var(--adm-accent)]" />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-adm-ink">{label}</span>
        {hint && <span className="text-[13px] text-adm-text-2">{hint}</span>}
      </span>
    </label>
  );
}

export function Notice({ tone = "info", children, role }: { tone?: "info" | "attention" | "problem"; children: ReactNode; role?: "alert" | "status" }) {
  const cls = tone === "problem" ? "bg-adm-problem-bg text-adm-problem" : tone === "attention" ? "bg-adm-attn-bg text-adm-attn" : "bg-adm-info-bg text-adm-info";
  return (
    <div role={role} className={cx("rounded-adm-sm px-3 py-2 text-[14px] font-medium leading-snug", cls)}>
      {children}
    </div>
  );
}

function HomePicker({ homes, value, onChange, name }: { homes: CustomerAddress[]; value: string; onChange: (id: string) => void; name: string }) {
  if (homes.length <= 1) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">Home</legend>
      {homes.map((h) => (
        <Choice key={h.id} name={name} value={h.id} current={value} onChange={onChange} label={formatAddressLine(h) || h.label || "Address"} hint={membershipSentence(h)} />
      ))}
    </fieldset>
  );
}

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 py-2", strong && "border-t border-adm-line pt-3")}>
      <dt className="text-[14px] text-adm-text-2">{label}</dt>
      <dd className={cx("adm-num text-right text-[15px] text-adm-ink", strong ? "font-semibold" : "font-medium")}>{children}</dd>
    </div>
  );
}

const cycleWord = (c: string | null | undefined) => (c === "annual" ? "annual" : "monthly");
const priceWord = (cents: number | null | undefined, cycle: string | null | undefined) =>
  cents === null || cents === undefined ? "" : `${formatCents(cents)}/${cycle === "annual" ? "yr" : "mo"}`;

/* --------------------------------------------------------- change plan */

const REASON_TEXT: Record<string, string> = {
  CANCELLATION_SCHEDULED: "a cancellation was scheduled",
  PAYMENT_ISSUE: "a payment problem appeared",
  NO_MEMBERSHIP: "the membership ended",
  NOT_STRIPE_MANAGED: "the membership is no longer billed through Stripe",
};

/**
 * Change plan (audit C-01, U-2): never a dropdown. Pick the plan and cycle,
 * see exactly what Stripe will do (preview), then confirm once. The preview
 * expires (countdown); a changed membership (409 STALE) is previewed again
 * automatically with the reason. Confirm carries an idempotency key, so a
 * double tap or a retry never charges twice.
 */
export function ChangePlanSheet({
  open,
  onClose,
  customerId,
  homes,
  initialAddressId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  /** Homes with a Stripe-billed membership that can change. */
  homes: CustomerAddress[];
  initialAddressId?: string | null;
  onChanged: (message: string) => void;
}) {
  const firstHome = homes.find((h) => h.id === initialAddressId) || homes[0];
  const [addressId, setAddressId] = useState(firstHome?.id || "");
  const home = homes.find((h) => h.id === addressId) || firstHome;
  const [plan, setPlan] = useState<PlanKey | "">("");
  const [cycle, setCycle] = useState<BillingCycle>((home?.billingCycle as BillingCycle) || "monthly");
  const [step, setStep] = useState<"choose" | "preview">("choose");
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsRepreview, setNeedsRepreview] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (step !== "preview") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [step]);

  const remainingMs = preview ? new Date(preview.expiresAt).getTime() - now : 0;
  const expired = Boolean(preview) && remainingMs <= 0;

  const runPreview = async (explanation = "") => {
    if (!home || !plan) return;
    setPreviewing(true);
    setError("");
    try {
      const next = await previewPlanChange(customerId, home.id, { plan, cycle });
      setPreview(next);
      setKey(newIdempotencyKey());
      setNow(Date.now());
      setNeedsRepreview(false);
      setNotice(explanation);
      setStep("preview");
    } catch (err) {
      // A refusal (payment issue, cancellation scheduled, same plan...) is said as the server says it.
      setError(errorMessage(err, "The change could not be previewed. Nothing was changed."));
      if (explanation) {
        setPreview(null);
        setStep("choose");
      }
    } finally {
      setPreviewing(false);
    }
  };

  const confirm = async () => {
    if (!home || !preview || expired || needsRepreview || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    setError("");
    try {
      const result = await confirmPlanChange(customerId, home.id, { previewToken: preview.previewToken, idempotencyKey: key });
      onChanged(result?.message || (preview.changeType === "upgrade" ? "Plan upgraded" : "Downgrade scheduled for the renewal"));
      onClose();
    } catch (err) {
      const code = errorCode(err);
      if (code === "STALE" || code === "PREVIEW_EXPIRED") {
        const reason = (err as { response?: { data?: { reason?: string } } })?.response?.data?.reason;
        const why = code === "PREVIEW_EXPIRED" ? "The preview expired" : `The membership changed since the preview${reason && REASON_TEXT[reason] ? ` (${REASON_TEXT[reason]})` : ""}`;
        await runPreview(`${why}, so nothing was charged. This is the new preview: check it and confirm again.`);
      } else if (code === "IN_PROGRESS") {
        setError("This change is already being processed. Wait a moment, then check the membership before trying again.");
        setNeedsRepreview(true);
      } else if (code === "KEY_REUSED") {
        // The key belongs to another customer or home: nothing was done. A fresh preview gets a fresh key.
        setError("Nothing was changed: that request was tied to a different customer or home. Preview again to continue.");
        setNeedsRepreview(true);
      } else {
        setError(errorMessage(err, "The change did not go through. Nothing was changed."));
        // The answer is stored against this key; a fresh preview gets a fresh key.
        setNeedsRepreview(true);
      }
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  if (!home) {
    return (
      <Sheet open={open} onClose={onClose} title="Change plan" data-sheet="change-plan">
        <Notice tone="attention">No home has a membership billed through Stripe that can change here. Sell a membership instead, or change it in Stripe.</Notice>
      </Sheet>
    );
  }

  const isCurrent = (p: PlanKey, c: BillingCycle) => p === home.plan && c === (home.billingCycle || "monthly");
  const minutes = Math.max(0, Math.floor(remainingMs / 60000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  const due = preview?.amountDueNowCents ?? 0;
  const confirmLabel = !preview
    ? "Confirm"
    : preview.changeType === "upgrade"
      ? due > 0
        ? `Charge ${formatCents(due)} and upgrade`
        : "Upgrade now"
      : "Schedule the downgrade";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change plan"
      description={formatAddressLine(home)}
      busy={previewing || confirming}
      data-sheet="change-plan"
      footer={
        step === "choose" ? (
          <Button key="preview" large block busy={previewing} disabled={!plan || isCurrent(plan as PlanKey, cycle)} onClick={() => runPreview()} data-action="preview-plan">
            Preview the change
          </Button>
        ) : (
          <>
            <Button
              key="back"
              variant="secondary"
              large
              disabled={confirming}
              onClick={() => {
                setStep("choose");
                setPreview(null);
                setNotice("");
                setError("");
              }}
            >
              Back
            </Button>
            {expired || needsRepreview ? (
              <Button large busy={previewing} onClick={() => runPreview()} data-action="repreview">
                Preview again
              </Button>
            ) : (
              <Button large variant={preview?.changeType === "upgrade" && due > 0 ? "danger" : "primary"} busy={confirming} onClick={confirm} data-action="confirm-plan">
                {confirmLabel}
              </Button>
            )}
          </>
        )
      }
    >
      {step === "choose" ? (
        <div className="flex flex-col gap-4">
          <HomePicker
            homes={homes}
            value={home.id}
            name="plan-home"
            onChange={(id) => {
              setAddressId(id);
              const h = homes.find((x) => x.id === id);
              setCycle((h?.billingCycle as BillingCycle) || "monthly");
              setPlan("");
              setError("");
            }}
          />
          <p className="text-[14px] text-adm-text-2">
            Now: <span className="font-semibold text-adm-ink">{membershipSentence(home)}</span>
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">New plan</legend>
            {PLAN_KEYS.map((p) => (
              <Choice key={p} name="plan" value={p} current={plan} onChange={(v) => setPlan(v as PlanKey)} label={planLabel(p)} hint={isCurrent(p, cycle) ? "Current plan" : undefined} disabled={isCurrent(p, cycle)} />
            ))}
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">Billing</legend>
            <Choice name="cycle" value="monthly" current={cycle} onChange={(v) => setCycle(v as BillingCycle)} label="Monthly" />
            <Choice name="cycle" value="annual" current={cycle} onChange={(v) => setCycle(v as BillingCycle)} label="Annual" />
          </fieldset>
          <p className="text-[13px] text-adm-text-3">Nothing changes until you confirm on the next step. The preview shows exactly what Stripe will charge.</p>
          {error && <Notice tone="problem" role="alert">{error}</Notice>}
        </div>
      ) : preview ? (
        <div className="flex flex-col gap-4" data-plan-preview="">
          {notice && <Notice tone="attention" role="status">{notice}</Notice>}
          <dl className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-1">
            <Row label="Current">
              {planLabel(preview.current.plan)} · {cycleWord(preview.current.cycle)}
              {preview.current.priceCents !== null && preview.current.priceCents !== undefined && <span className="block text-[13px] text-adm-text-2">{priceWord(preview.current.priceCents, preview.current.cycle)}</span>}
            </Row>
            <Row label="New">
              <span className="font-semibold">
                {planLabel(preview.requested.plan)} · {cycleWord(preview.requested.cycle)}
              </span>
              {preview.requested.priceCents !== null && preview.requested.priceCents !== undefined && <span className="block text-[13px] text-adm-text-2">{priceWord(preview.requested.priceCents, preview.requested.cycle)}</span>}
            </Row>
            <Row label="Takes effect">{preview.effective === "now" ? "Now" : `At renewal${preview.nextRenewalDate ? `, ${shortDate(preview.nextRenewalDate)}` : ""}`}</Row>
            {(preview.creditCents ?? 0) > 0 && <Row label="Credit for unused time">{formatCents(preview.creditCents)}</Row>}
            <Row label="Charged now" strong>
              <span data-preview-due="">{due > 0 ? formatCents(due) : "Nothing now"}</span>
            </Row>
            <Row label="Next renewal">
              {preview.nextRenewalDate ? shortDate(preview.nextRenewalDate) : "—"}
              {preview.nextRenewalAmountCents !== null && preview.nextRenewalAmountCents !== undefined && <span className="block text-[13px] text-adm-text-2">{formatCents(preview.nextRenewalAmountCents)}</span>}
            </Row>
          </dl>
          {preview.warnings.length > 0 && (
            <ul className="flex flex-col gap-2" data-preview-warnings="">
              {preview.warnings.map((w) => (
                <li key={w.code}>
                  <Notice tone="attention">{w.message}</Notice>
                </li>
              ))}
            </ul>
          )}
          {expired ? (
            <Notice tone="attention" role="status">
              <span data-preview-expired="">This preview has expired. Preview again to see the current amount before confirming.</span>
            </Notice>
          ) : (
            <p className="adm-num text-[13px] text-adm-text-3" data-preview-countdown="">
              This preview is valid for {minutes}:{String(seconds).padStart(2, "0")}.
            </p>
          )}
          {preview.changeType === "upgrade" && due > 0 && <p className="text-[13px] text-adm-text-2">Stripe charges the card on file as soon as you confirm. Refunds are made in Stripe.</p>}
          {error && <Notice tone="problem" role="alert">{error}</Notice>}
        </div>
      ) : null}
    </Sheet>
  );
}

/* ---------------------------------------------------------- cancellation */

/**
 * Cancellation (audit F10): choose period end, a date, or clear the one
 * scheduled; then confirm on a second step. Audited server-side with before
 * and after; idempotent.
 */
export function CancellationSheet({
  open,
  onClose,
  customerId,
  homes,
  initialAddressId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  homes: CustomerAddress[];
  initialAddressId?: string | null;
  onChanged: (message: string) => void;
}) {
  const firstHome = homes.find((h) => h.id === initialAddressId) || homes[0];
  const [addressId, setAddressId] = useState(firstHome?.id || "");
  const home = homes.find((h) => h.id === addressId) || firstHome;
  const scheduled = Boolean(home?.cancelAt || home?.planStatus === "ending");
  const [mode, setMode] = useState<"period_end" | "date" | "clear">(scheduled ? "clear" : "period_end");
  const [date, setDate] = useState("");
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  /* A plan change already scheduled on this subscription: setting a date or clearing drops it, so it is asked first. */
  const [pendingPlan, setPendingPlan] = useState<{ plan: string; billingCycle: string; effectiveDate: string } | null>(null);

  if (!home) {
    return (
      <Sheet open={open} onClose={onClose} title="Cancellation" data-sheet="cancellation">
        <Notice tone="attention">No home has a membership to cancel.</Notice>
      </Sheet>
    );
  }

  const periodEnd = home.currentPeriodEnd || home.renewsAt;
  const dateError = mode === "date" && date && date < tomorrowNY() ? "Pick a day from tomorrow on." : "";
  const canReview = mode !== "date" || (date && !dateError);
  const plan = planLabel(home.plan);
  const where = formatAddressLine(home);

  const consequence =
    mode === "clear"
      ? `The scheduled cancellation is removed. The ${plan} membership renews as normal${periodEnd ? ` on ${shortDate(periodEnd)}` : ""}.`
      : mode === "period_end"
        ? `The ${plan} membership ends at the end of the period already paid${periodEnd ? `, on ${shortDate(periodEnd)}` : ""}. Benefits continue until then and it does not renew.`
        : `The ${plan} membership ends on ${ymdLabel(date)}. Benefits continue until then and it is not billed again after that day.`;

  const submit = async (releasePendingPlanChange = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await scheduleCancellation(customerId, home.id, {
        mode,
        ...(mode === "date" ? { date } : {}),
        idempotencyKey: key,
        ...(releasePendingPlanChange ? { releasePendingPlanChange: true } : {}),
      });
      onChanged(result?.message || (mode === "clear" ? "Cancellation cleared" : "Cancellation scheduled"));
      onClose();
    } catch (err) {
      const code = errorCode(err);
      const data = (err as { response?: { data?: { pendingPlanChange?: { plan?: string; billingCycle?: string; effectiveDate?: string } } } })?.response?.data;
      if (code === "PENDING_PLAN_CHANGE") {
        const p = data?.pendingPlanChange || {};
        setPendingPlan({ plan: String(p.plan || ""), billingCycle: String(p.billingCycle || ""), effectiveDate: String(p.effectiveDate || "") });
      } else if (code === "KEY_REUSED") {
        setError("Nothing was changed: that request was tied to a different customer or home. Review it again to continue.");
      } else {
        setError(errorMessage(err, "The cancellation was not saved. Nothing was changed."));
      }
      // A retry is a new attempt with its own key (the stored answer belongs to this one).
      setKey(newIdempotencyKey());
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "clear" && step === "confirm" ? "Clear the cancellation?" : step === "confirm" ? "Schedule the cancellation?" : "Cancellation"}
      description={where}
      busy={busy}
      dirty={step === "choose" && mode === "date" && Boolean(date)}
      data-sheet="cancellation"
      footer={
        step === "choose" ? (
          <Button
            key="review"
            large
            block
            disabled={!canReview}
            onClick={() => {
              // One key per customer + home + action: made when this home's step opens.
              setKey(newIdempotencyKey());
              setError("");
              setPendingPlan(null);
              setStep("confirm");
            }}
            data-action="review-cancellation"
          >
            Review
          </Button>
        ) : (
          <>
            <Button key="back" variant="secondary" large disabled={busy} onClick={() => setStep("choose")}>
              Back
            </Button>
            {pendingPlan ? (
              <Button large variant="danger" busy={busy} onClick={() => submit(true)} data-action="confirm-release-plan-change">
                {mode === "clear" ? "Drop the plan change and clear" : "Drop the plan change and schedule"}
              </Button>
            ) : (
              <Button large variant={mode === "clear" ? "primary" : "danger"} busy={busy} onClick={() => submit()} data-action="confirm-cancellation">
                {mode === "clear" ? "Clear the cancellation" : "Schedule cancellation"}
              </Button>
            )}
          </>
        )
      }
    >
      {step === "choose" ? (
        <div className="flex flex-col gap-4">
          <HomePicker
            homes={homes}
            value={home.id}
            name="cancel-home"
            onChange={(id) => {
              setAddressId(id);
              const h = homes.find((x) => x.id === id);
              setMode(h?.cancelAt || h?.planStatus === "ending" ? "clear" : "period_end");
            }}
          />
          <p className="text-[14px] text-adm-text-2">
            Now: <span className="font-semibold text-adm-ink">{membershipSentence(home)}</span>
          </p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">What should happen?</legend>
            <Choice name="cancel-mode" value="period_end" current={mode} onChange={(v) => setMode(v as "period_end")} label="End at the end of the paid period" hint={periodEnd ? shortDate(periodEnd) : undefined} />
            <Choice name="cancel-mode" value="date" current={mode} onChange={(v) => setMode(v as "date")} label="End on a date I pick" />
            {scheduled && <Choice name="cancel-mode" value="clear" current={mode} onChange={(v) => setMode(v as "clear")} label="Clear the scheduled cancellation" hint={home.cancelAt || home.endsAt ? `Now ends ${shortDate(home.cancelAt || home.endsAt)}` : undefined} />}
          </fieldset>
          {mode === "date" && (
            <Field label="Last day (New York)" error={dateError} required>
              <TextInput type="date" min={tomorrowNY()} value={date} onChange={(e) => setDate(e.target.value)} enterKeyHint="done" />
            </Field>
          )}
          <p className="text-[13px] text-adm-text-3">Cancelling does not refund. Refunds are made in Stripe.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-cancel-confirm="">
          <p className="text-[15px] leading-relaxed text-adm-ink">{consequence}</p>
          <p className="text-[13px] text-adm-text-2">The customer is not emailed by this step. Cancelling does not refund; refunds are made in Stripe.</p>
          {pendingPlan && (
            <div data-pending-plan-change="">
              <Notice tone="attention" role="alert">
                A change to <strong>{planLabel(pendingPlan.plan)}</strong>
                {pendingPlan.billingCycle ? ` (${pendingPlan.billingCycle})` : ""} is already scheduled
                {pendingPlan.effectiveDate ? ` for ${shortDate(pendingPlan.effectiveDate)}` : ""}. To {mode === "clear" ? "clear the cancellation" : "set this date"}, that scheduled plan change will be
                dropped: the membership stays on {plan} and is not switched. Nothing was changed yet.
              </Notice>
            </div>
          )}
          {error && <Notice tone="problem" role="alert">{error}</Notice>}
        </div>
      )}
    </Sheet>
  );
}

/* --------------------------------------------------------- complimentary */

/**
 * Complimentary membership (Q-3): owner only, a separate explicit action
 * with a required reason and a confirmation step. Never a fallback for a
 * missing or failed payment, so it is refused beside any membership that has
 * not ended.
 */
export function ComplimentarySheet({
  open,
  onClose,
  customerId,
  homes,
  initialAddressId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  homes: CustomerAddress[];
  initialAddressId?: string | null;
  onChanged: (message: string) => void;
}) {
  const firstHome = homes.find((h) => h.id === initialAddressId) || homes.find((h) => !hasLiveMembership(h)) || homes[0];
  const [addressId, setAddressId] = useState(firstHome?.id || "");
  const home = homes.find((h) => h.id === addressId) || firstHome;
  const [plan, setPlan] = useState<PlanKey | "">("");
  const [reason, setReason] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  if (!home) {
    return (
      <Sheet open={open} onClose={onClose} title="Complimentary membership" data-sheet="complimentary">
        <Notice tone="attention">Add a home address first.</Notice>
      </Sheet>
    );
  }

  const blocked = hasLiveMembership(home);
  const reasonError = reason.trim().length > 0 && reason.trim().length < 3 ? "Say why, in a few words." : "";
  const endError = endsOn && endsOn < tomorrowNY() ? "Pick a day from tomorrow on." : "";
  const ready = !blocked && plan && reason.trim().length >= 3 && !endError && understood;
  const dirty = Boolean(plan || reason || endsOn);

  const submit = async () => {
    if (!plan || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await grantComplimentary(customerId, home.id, { plan, reason: reason.trim(), ...(endsOn ? { endsOn } : {}) });
      onChanged(result?.message || `Complimentary ${planLabel(plan)} granted`);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "The complimentary membership was not created. Nothing was changed."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === "confirm" ? "Grant a complimentary membership?" : "Complimentary membership"}
      description={formatAddressLine(home)}
      busy={busy}
      dirty={dirty}
      data-sheet="complimentary"
      footer={
        step === "form" ? (
          <Button key="review" large block disabled={!ready} onClick={() => setStep("confirm")} data-action="review-complimentary">
            Review
          </Button>
        ) : (
          <>
            <Button key="back" variant="secondary" large disabled={busy} onClick={() => setStep("form")}>
              Back
            </Button>
            <Button large busy={busy} onClick={submit} data-action="confirm-complimentary">
              Grant free {planLabel(plan || null)}
            </Button>
          </>
        )
      }
    >
      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <HomePicker homes={homes} value={home.id} name="comp-home" onChange={setAddressId} />
          {blocked ? (
            <Notice tone="attention" role="status">
              <span data-comp-disabled="">
                This home already has a membership ({membershipSentence(home)}). A complimentary membership can&apos;t be added beside it, and it is never a fix for a missing or failed payment. End the membership first, or resolve
                the payment in Stripe.
              </span>
            </Notice>
          ) : (
            <>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">Plan</legend>
                {PLAN_KEYS.map((p) => (
                  <Choice key={p} name="comp-plan" value={p} current={plan} onChange={(v) => setPlan(v as PlanKey)} label={planLabel(p)} />
                ))}
              </fieldset>
              <Field label="Reason" required error={reasonError} help="Kept with the membership and in the activity log.">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoCapitalize="sentences" />
              </Field>
              <Field label="Ends on (optional)" error={endError} help="Leave empty for open-ended.">
                <TextInput type="date" min={tomorrowNY()} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </Field>
              <label className="flex min-h-[44px] items-start gap-3 text-[14px] text-adm-ink">
                <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[var(--adm-accent)]" data-comp-understood="" />
                <span>I understand this membership is free: nobody is billed for it.</span>
              </label>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-comp-confirm="">
          <p className="text-[15px] leading-relaxed text-adm-ink">
            {`A free ${planLabel(plan || null)} membership starts now at this home, ${endsOn ? `until ${ymdLabel(endsOn)}` : "open-ended"}. It is not billed through Stripe.`}
          </p>
          <p className="text-[14px] text-adm-text-2">Reason: {reason.trim()}</p>
          {error && <Notice tone="problem" role="alert">{error}</Notice>}
        </div>
      )}
    </Sheet>
  );
}

