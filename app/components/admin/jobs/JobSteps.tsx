"use client";

import { ArrowTopRightOnSquareIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getFullDayAvailability, getTimeSlots } from "@/lib/booking-service";
import { normalizeDayAvailability } from "@/lib/booking-calendar-availability";
import { errorMessage, fetchQuery, useAdminQuery } from "@/lib/admin/query";
import {
  conflictOf,
  dayLabel,
  describeNotifications,
  fetchAssignmentOptions,
  fetchJob,
  fetchRescheduleOptions,
  jobKeys,
  newIdempotencyKey,
  nyYMD,
  patchJob,
  rescheduleJob,
  timeNY,
  todayYMD,
  transitionJob,
  whenText,
  type JobDetail,
  type Notification,
  type Technician,
} from "@/lib/admin/jobs";
import { Button, Field, Select, TextInput, Textarea, cx, formatCents } from "@/app/components/admin/ui";

/* ------------------------------------------------------------------ */
/* Plumbing shared by every step                                       */
/* ------------------------------------------------------------------ */

export type StepResult = { title: string; lines: { text: string; tone: "ok" | "muted" | "problem" }[]; booking: JobDetail };

export type StepProps = {
  job: JobDetail;
  /** The sheet's footer slot: the step's buttons are portaled into it. */
  footer: HTMLElement | null;
  onBack: () => void;
  onDone: (result: StepResult) => void;
  /** Re-read the job (after a conflict) and leave the step. */
  onRefresh: () => void;
  setBusy: (busy: boolean) => void;
  setDirty?: (dirty: boolean) => void;
};

function Footer({ el, children }: { el: HTMLElement | null; children: ReactNode }) {
  return el ? createPortal(children, el) : null;
}

/**
 * One submit per intent: the idempotency key is made when the step opens and
 * reused on a retry, so a double tap or a flaky network never sends two
 * customer messages; the pressed button shows the spinner; a second press
 * while it runs does nothing.
 */
function useSubmit(setBusy: (b: boolean) => void) {
  const [key] = useState(newIdempotencyKey);
  const [busy, setLocalBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const running = useRef(false);
  const run = async (fn: (key: string) => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setLocalBusy(true);
    setBusy(true);
    setError(null);
    try {
      await fn(key);
    } catch (err) {
      setError(err);
    } finally {
      running.current = false;
      setLocalBusy(false);
      setBusy(false);
    }
  };
  return { key, busy, error, run, setError };
}

/** A failed action: what happened in plain words, and Refresh for a conflict (409 STALE / INVALID_TRANSITION). */
export function StepError({ error, onRefresh }: { error: unknown; onRefresh: () => void }) {
  if (!error) return null;
  const conflict = conflictOf(error);
  const stale = conflict?.code === "STALE";
  const invalid = conflict?.code === "INVALID_TRANSITION";
  // Canceled or completed by someone else while this move or reassignment was in flight.
  const inactive = conflict?.code === "BOOKING_INACTIVE";
  const message = stale
    ? `This job changed since you opened it${conflict?.currentStatus ? ` (it is now ${conflict.currentStatus})` : ""}. Nothing was changed and nothing was sent.`
    : inactive
      ? "This job was canceled or completed while you were changing it. Nothing was moved and nothing was sent to the customer."
      : invalid
      ? `${conflict?.message || "This change is not allowed in the job's current state."} Nothing was changed.`
      : errorMessage(error, "That did not work. Nothing was changed. Try again.");
  return (
    <div role="alert" className="mt-4 flex flex-col gap-3 rounded-adm-sm bg-adm-problem-bg px-3 py-3 text-[14px] text-adm-problem" data-step-error={conflict?.code || "error"}>
      <p className="flex items-start gap-2 font-medium">
        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {(stale || invalid || inactive) && (
        <Button variant="secondary" onClick={onRefresh} className="self-start" data-refresh-job="">
          Refresh the job
        </Button>
      )}
    </div>
  );
}

function Consequence({ children }: { children: ReactNode }) {
  return <div className="text-[15px] leading-relaxed text-adm-ink">{children}</div>;
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-adm-ink" data-message-list="">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-adm-text-3" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function resultOf(title: string, booking: JobDetail, notifications: Notification[] | undefined, extra: { text: string; tone: "ok" | "muted" | "problem" }[] = []): StepResult {
  const { lines, nothingSent } = describeNotifications(notifications);
  const all = [...extra, ...lines];
  if (nothingSent) all.push({ text: "The customer was not notified: no usable channel.", tone: "problem" });
  return { title, lines: all, booking };
}

function Checkbox({ checked, onChange, label, help, name }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; help?: ReactNode; name: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-adm-sm border border-adm-line px-3 py-2.5" data-check={name}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[var(--adm-accent)]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-adm-ink">{label}</span>
        {help && <span className="text-[13px] text-adm-text-2">{help}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Technician picker (J-20)                                            */
/* ------------------------------------------------------------------ */

/**
 * The Fixters for the job's time from GET /jobs/:id/assignment-options:
 * available first (recommended marked), unavailable greyed with the reason
 * and not selectable; a current Fixter who is no longer active is labelled.
 */
export function TechPicker({ jobId, value, onChange, onLoaded, label = "Fixter" }: { jobId: string; value: string; onChange: (id: string) => void; onLoaded?: (best: string) => void; label?: string }) {
  const q = useAdminQuery(jobKeys.options(jobId), (signal) => fetchAssignmentOptions(jobId, signal), { staleTime: 15_000 });
  const data = q.data;
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!data || loadedRef.current) return;
    loadedRef.current = true;
    const current = data.currentTechnician && data.availableTechnicians.some((t) => t.id === data.currentTechnician?.id) ? data.currentTechnician.id : "";
    onLoaded?.(current || data.recommendedTechnician?.id || data.availableTechnicians[0]?.id || "");
  }, [data, onLoaded]);

  if (q.isLoading) return <p className="text-[14px] text-adm-text-2" role="status">Checking who is free at that time…</p>;
  if (q.error && !data) return <p className="text-[14px] text-adm-problem" role="alert">{errorMessage(q.error, "Fixters could not be loaded.")}</p>;
  if (!data) return null;
  const recommended = data.recommendedTechnician?.id;
  const currentId = data.currentTechnician?.id;
  const available = [...data.availableTechnicians].sort((a, b) => (a.id === recommended ? -1 : b.id === recommended ? 1 : 0));
  const row = (t: Technician, enabled: boolean) => {
    const tags = [t.id === recommended && enabled ? "Recommended" : "", t.id === currentId ? "Current" : "", t.isDefaultFixter ? "Default" : ""].filter(Boolean);
    const load = typeof t.dayBookingCount === "number" ? `${t.dayBookingCount} that day · ${t.weekBookingCount ?? 0} this week` : "";
    return (
      <label
        key={t.id}
        className={cx("flex min-h-[52px] items-center gap-3 border-b border-adm-line px-3 py-2 last:border-b-0", enabled ? "cursor-pointer hover:bg-adm-bg" : "cursor-not-allowed bg-adm-bg")}
        data-tech-option={t.id}
        data-available={enabled ? "true" : "false"}
      >
        <input type="radio" name={`tech-${jobId}`} value={t.id} checked={value === t.id} disabled={!enabled} onChange={() => onChange(t.id)} className="h-5 w-5 flex-none accent-[var(--adm-accent)]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx("text-[15px] font-semibold", enabled ? "text-adm-ink" : "text-adm-text-3")}>
            {t.name}
            {tags.length > 0 && <span className="ml-2 text-[12px] font-semibold text-adm-accent-ink">{tags.join(" · ")}</span>}
          </span>
          <span className={cx("text-[13px]", enabled ? "text-adm-text-2" : "text-adm-text-2")}>{enabled ? load || "Free at this time" : t.reason || "Not available at this time"}</span>
        </span>
      </label>
    );
  };
  return (
    <fieldset className="flex flex-col gap-2" data-tech-picker="">
      <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">{label}</legend>
      {data.slotStart && <p className="text-[13px] text-adm-text-2">For {whenText({ date: data.slotStart, endEstimate: data.slotEnd, type: "" })}</p>}
      <div className="overflow-hidden rounded-adm-sm border border-adm-line bg-adm-surface">
        {available.map((t) => row(t, true))}
        {data.unavailableTechnicians.map((t) => row(t, false))}
        {data.currentTechnician?.inactiveOrRemoved && (
          <div className="flex min-h-[52px] items-center gap-3 bg-adm-bg px-3 py-2" data-tech-option={data.currentTechnician.id} data-available="false">
            <span className="h-5 w-5 flex-none" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold text-adm-text-3">{data.currentTechnician.name || "Previous Fixter"} · Current</span>
              <span className="text-[13px] text-adm-text-2">No longer an active Fixter. Choose someone else.</span>
            </span>
          </div>
        )}
        {!available.length && !data.unavailableTechnicians.length && <p className="px-3 py-3 text-[14px] text-adm-text-2">No Fixters are set up.</p>}
      </div>
      {!available.length && <p className="text-[13px] font-medium text-adm-problem">Nobody is free at this time.</p>}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm & assign                                                    */
/* ------------------------------------------------------------------ */

export function ConfirmStep({ job, footer, onBack, onDone, onRefresh, setBusy }: StepProps) {
  const [tech, setTech] = useState("");
  const s = useSubmit(setBusy);
  const submit = () =>
    s.run(async (key) => {
      const r = await transitionJob(job.id, { action: "confirm", expectedStatus: job.status, expectedUpdatedAt: job.updatedAt, assignedFixterId: tech || undefined, idempotencyKey: key });
      onDone(resultOf("Confirmed", r.booking, r.notifications));
    });
  return (
    <div data-step="confirm">
      <Consequence>
        Confirm {whenText(job)} for <strong>{job.customer.name || "the customer"}</strong>. They get:
        <Bullets items={[job.customer.email ? `the confirmation email (to ${job.customer.email})` : "no email (none on file)", "a confirmation text, if they agreed to service texts", "the usual reminders before the visit"]} />
      </Consequence>
      <div className="mt-4">
        <TechPicker jobId={job.id} value={tech} onChange={setTech} onLoaded={setTech} label="Assign to" />
      </div>
      <StepError error={s.error} onRefresh={onRefresh} />
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Back
        </Button>
        <Button large busy={s.busy} disabled={!tech} onClick={submit} data-confirm="confirm">
          Confirm and notify
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mark done (J-03)                                                    */
/* ------------------------------------------------------------------ */

export function DoneStep({ job, footer, onBack, onDone, onRefresh, setBusy }: StepProps) {
  const s = useSubmit(setBusy);
  const [openedAt] = useState(() => Date.now());
  const notStarted = job.date ? new Date(job.date).getTime() > openedAt : false;
  const submit = () =>
    s.run(async (key) => {
      const r = await transitionJob(job.id, { action: "complete", expectedStatus: job.status, expectedUpdatedAt: job.updatedAt, idempotencyKey: key });
      onDone(resultOf("Marked done", r.booking, r.notifications));
    });
  return (
    <div data-step="done">
      <Consequence>
        Mark the job for <strong>{job.customer.name || "the customer"}</strong> done. This sends:
        <Bullets
          items={[
            job.customer.email ? `the completion email with the tip link (to ${job.customer.email})` : "no completion email (no email on file)",
            "a completion text, if they agreed to service texts",
            "a review request later (automatic)",
          ]}
        />
        <p className="mt-2 text-[14px] text-adm-text-2">The time is released on the calendar. Reopening it later needs Reinstate.</p>
      </Consequence>
      {notStarted && (
        <p className="mt-3 flex items-start gap-2 rounded-adm-sm bg-adm-attn-bg px-3 py-2 text-[14px] font-medium text-adm-attn" data-not-started="">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          This job has not started yet ({whenText(job)}).
        </p>
      )}
      <StepError error={s.error} onRefresh={onRefresh} />
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Back
        </Button>
        <Button large busy={s.busy} onClick={submit} data-confirm="complete">
          Mark done and notify
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reinstate (Q-4)                                                     */
/* ------------------------------------------------------------------ */

export function ReinstateStep({ job, footer, onBack, onDone, onRefresh, setBusy }: StepProps) {
  const [tech, setTech] = useState("");
  const [notify, setNotify] = useState(false);
  const [target, setTarget] = useState<"Confirmed" | "Pending">("Confirmed");
  const s = useSubmit(setBusy);
  const options = useAdminQuery(jobKeys.options(job.id), (signal) => fetchAssignmentOptions(job.id, signal), { staleTime: 0 });
  const free = options.data?.availableTechnicians.length || 0;
  const blocked = Boolean(options.data) && free === 0;
  const submit = () =>
    s.run(async (key) => {
      const r = await transitionJob(job.id, {
        action: "reinstate",
        expectedStatus: job.status,
        expectedUpdatedAt: job.updatedAt,
        targetStatus: target,
        notifyCustomer: notify,
        assignedFixterId: tech || undefined,
        idempotencyKey: key,
      });
      onDone(resultOf(`Reinstated as ${r.booking.status}`, r.booking, notify ? r.notifications : [], notify ? [] : [{ text: "Nothing was sent to the customer.", tone: "muted" }]));
    });
  return (
    <div data-step="reinstate">
      <Consequence>
        Reopen this {job.status.toLowerCase()} job for <strong>{job.customer.name || "the customer"}</strong> at its time, {whenText(job)}, and reserve the slot again.
      </Consequence>
      <div className="mt-3 rounded-adm-sm border border-adm-line px-3 py-2.5 text-[14px]" data-availability={options.isLoading ? "checking" : blocked ? "blocked" : options.error ? "unknown" : "free"} role="status">
        {options.isLoading ? (
          <span className="text-adm-text-2">Checking the time is still free…</span>
        ) : options.error && !options.data ? (
          <span className="text-adm-text-2">Availability could not be checked here. The server checks it again when you reinstate.</span>
        ) : blocked ? (
          <span className="flex items-start gap-2 font-medium text-adm-problem">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            Nobody is free at that time{options.data?.unavailableTechnicians[0]?.reason ? ` (${options.data.unavailableTechnicians[0].reason})` : ""}. It cannot be reinstated; book a new visit instead.
          </span>
        ) : (
          <span className="flex items-start gap-2 font-medium text-adm-ok">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            The time is still free: {free} {free === 1 ? "Fixter can" : "Fixters can"} take it.
          </span>
        )}
      </div>
      {!blocked && options.data && (
        <div className="mt-4">
          <TechPicker jobId={job.id} value={tech} onChange={setTech} onLoaded={setTech} label="Assign to" />
        </div>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <Field label="Reinstate as">
          <Select value={target} onChange={(e) => setTarget(e.target.value as "Confirmed" | "Pending")} options={[{ value: "Confirmed", label: "Confirmed" }, { value: "Pending", label: "Pending (needs review)" }]} />
        </Field>
        <Checkbox
          name="notify"
          checked={notify}
          onChange={setNotify}
          label="Notify the customer"
          help={notify ? "They get the confirmation message again, by email and (if they agreed) text." : "Off: this is a correction. Nothing is sent to the customer."}
        />
      </div>
      <StepError error={s.error} onRefresh={onRefresh} />
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Back
        </Button>
        <Button large busy={s.busy} disabled={blocked || options.isLoading} onClick={submit} data-confirm="reinstate">
          {notify ? "Reinstate and notify" : "Reinstate quietly"}
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel (J-10, Q-9)                                                  */
/* ------------------------------------------------------------------ */

const CANCEL_REASONS = ["Customer asked to cancel", "Could not reach the customer", "No Fixter available", "Duplicate booking", "Weather or emergency", "Other"];

export function CancelStep({ job, footer, onBack, onDone, onRefresh, setBusy, setDirty }: StepProps) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const s = useSubmit(setBusy);
  const request = job.status === "Pending Confirmation";
  useEffect(() => setDirty?.(Boolean(reason || detail)), [reason, detail, setDirty]);
  const paid = job.money?.kind === "paid";
  const fullDayBenefit = job.money?.kind === "full_day_included" || job.money?.kind === "full_day_loyalty";
  const text = [reason, detail.trim()].filter(Boolean).join(": ");
  const submit = () =>
    s.run(async (key) => {
      const r = await transitionJob(job.id, { action: "cancel", expectedStatus: job.status, expectedUpdatedAt: job.updatedAt, reason: text, idempotencyKey: key });
      const extra: { text: string; tone: "ok" | "muted" | "problem" }[] = [];
      if (r.routedTo === "free_visit_decline") extra.push({ text: "The free-visit request was declined; their free visit is not used up.", tone: "muted" });
      if (r.payment?.paid) extra.push({ text: `Paid ${r.payment.paidCents != null ? formatCents(r.payment.paidCents) : "(amount in Stripe)"}: not refunded. Refund in Stripe if needed.`, tone: "problem" });
      if (r.fullDayRestore) {
        extra.push(
          r.fullDayRestore.restored
            ? { text: `The ${r.fullDayRestore.kind === "loyalty" ? "loyalty" : "included"} Full Day went back to the customer.`, tone: "ok" }
            : { text: `The Full Day was not given back${r.fullDayRestore.reason ? ` (${r.fullDayRestore.reason.replace(/_/g, " ")})` : ""}.`, tone: "muted" }
        );
      }
      setDirty?.(false);
      onDone(resultOf(request ? "Request declined" : "Canceled", r.booking, r.notifications, extra));
    });
  return (
    <div data-step="cancel">
      <Consequence>
        {request ? (
          <>Decline the free-visit request from <strong>{job.customer.name || "the customer"}</strong>. The time goes back on the calendar and their free visit is not used up.</>
        ) : (
          <>
            Cancel {whenText(job)} for <strong>{job.customer.name || "the customer"}</strong>. They get the cancellation email, and a text if they agreed to service texts. The time goes back on the calendar.
          </>
        )}
      </Consequence>
      {paid && (
        <div className="mt-3 rounded-adm-sm border border-adm-line px-3 py-2.5 text-[14px]" data-cancel-money="">
          <p className="font-semibold text-adm-ink">
            Paid {job.money.amountCents != null ? formatCents(job.money.amountCents) : "for this visit"}
            {job.money.paidAt ? ` on ${dayLabel(nyYMD(job.money.paidAt))}` : ""}.
          </p>
          <p className="mt-1 text-adm-text-2">Cancelling does not refund. Refunds are made in Stripe.</p>
          <a href={job.money.stripeUrl || "https://dashboard.stripe.com/payments"} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[44px] items-center gap-1 font-semibold text-adm-accent-ink" data-stripe-link="">
            Refund in Stripe
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      )}
      {fullDayBenefit && <p className="mt-3 rounded-adm-sm bg-adm-info-bg px-3 py-2 text-[14px] text-adm-info">{job.money.label}: the Full Day goes back to the customer when it is cancelled.</p>}
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">Reason</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CANCEL_REASONS.map((r) => (
            <label key={r} className={cx("flex min-h-[44px] cursor-pointer items-center gap-2 rounded-adm-sm border px-3 text-[14px]", reason === r ? "border-adm-accent bg-adm-accent-soft font-semibold text-adm-ink" : "border-adm-line text-adm-ink")}>
              <input type="radio" name="cancel-reason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-[var(--adm-accent)]" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Details (optional, staff only)" className="mt-3">
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} maxLength={280} enterKeyHint="done" />
      </Field>
      <StepError error={s.error} onRefresh={onRefresh} />
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Keep the job
        </Button>
        <Button variant="danger" large busy={s.busy} disabled={!reason} onClick={submit} data-confirm="cancel">
          {request ? "Decline request" : "Cancel the job"}
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reschedule (J-09)                                                   */
/* ------------------------------------------------------------------ */

type Slot = { time: string; available: boolean; current?: boolean; reason?: string };

const SLOT_REASON: Record<string, string> = { past: "Past", closed: "Closed", no_fixter: "No Fixter", full: "Full" };

function time12(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return t;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * The slot grid from GET /jobs/:id/reschedule-options: the engine with Admin
 * rules (no customer lead time, so a same-day move can be picked), the job's
 * own seat excluded so its current time reads "Now". Taken times are shown
 * with the reason but cannot be chosen. Against an older backend without the
 * route it falls back to the customer availability Create Visit uses. The
 * engine decides in the end (SLOT_UNAVAILABLE is shown here if it says no).
 */
export function RescheduleStep({ job, footer, onBack, onDone, onRefresh, setBusy, setDirty }: StepProps) {
  const fullDay = job.type === "full_day";
  const current = nyYMD(job.date);
  const [date, setDate] = useState(current && current >= todayYMD() ? current : todayYMD());
  const [time, setTime] = useState("");
  const [notify, setNotify] = useState(true);
  const [slots, setSlots] = useState<{ date: string; list: Slot[] | null; error: string }>({ date: "", list: null, error: "" });
  const [fullDayOk, setFullDayOk] = useState<{ date: string; ok: boolean; reason: string } | null>(null);
  const s = useSubmit(setBusy);
  const currentTime = job.date ? timeNY(job.date) : "";

  useEffect(() => setDirty?.(date !== current || Boolean(time)), [date, time, current, setDirty]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    if (fullDay) {
      getFullDayAvailability(date, date)
        .then((res) => alive && setFullDayOk({ date, ok: Boolean(res.days?.[0]?.available), reason: res.days?.[0]?.reason || "" }))
        .catch(() => alive && setFullDayOk({ date, ok: false, reason: "This day could not be checked." }));
    } else {
      const legacy = () =>
        getTimeSlots(date).then((res) => {
          if (!alive) return;
          const day = normalizeDayAvailability(res as never);
          setSlots({ date, list: day.slots.map((x) => ({ time: x.time, available: x.available === true })), error: "" });
        });
      fetchRescheduleOptions(job.id, date)
        .then((res) => {
          if (!alive) return;
          setSlots({
            date,
            list: res.slots.map((x) => ({ time: x.time, available: x.available && !x.current, current: x.current, reason: x.reason })),
            error: res.closed ? res.note || "Closed this day." : "",
          });
        })
        .catch((error) => {
          if (!alive) return;
          if ((error as { response?: { status?: number } })?.response?.status === 404) return legacy();
          throw error;
        })
        .catch(() => alive && setSlots({ date, list: [], error: "Times could not be loaded for this day." }));
    }
    return () => {
      alive = false;
    };
  }, [date, fullDay, job.id]);

  const list = slots.date === date ? slots.list : null;
  const ready = Boolean(date) && (fullDay ? fullDayOk?.date === date && fullDayOk.ok : Boolean(time));
  const submit = () =>
    s.run(async (key) => {
      if (!job.updatedAt) throw new Error("Reload the job first.");
      const r = await rescheduleJob(job.id, { date, time: fullDay ? undefined : time, expectedUpdatedAt: job.updatedAt, idempotencyKey: key, notifyCustomer: notify });
      setDirty?.(false);
      onDone(resultOf(`Moved to ${whenText(r.booking)}`, r.booking, r.notifications, notify ? [] : [{ text: "You chose not to tell the customer.", tone: "muted" }]));
    });

  return (
    <div data-step="reschedule">
      <Consequence>
        Now: <strong>{whenText(job)}</strong>
        {job.technician ? ` with ${job.technician.name}` : ""}. The current Fixter keeps the job if they are free at the new time; otherwise the recommended Fixter takes it.
      </Consequence>
      <Field label="New day" className="mt-4">
        <TextInput
          type="date"
          min={todayYMD()}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setTime("");
          }}
          data-reschedule-date=""
        />
      </Field>
      {!fullDay && date && (
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-[13px] font-semibold text-adm-ink">New time</legend>
          {list === null ? (
            <p className="text-[14px] text-adm-text-2" role="status">
              Checking times…
            </p>
          ) : slots.error ? (
            <p className="text-[14px] text-adm-problem">{slots.error}</p>
          ) : list.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-slot-grid="">
              {list.map((slot) => {
                const isCurrent = slot.current ?? (date === current && time12(slot.time) === currentTime);
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={time === slot.time}
                    onClick={() => setTime(slot.time)}
                    data-slot={slot.time}
                    className={cx(
                      "flex min-h-[44px] flex-col items-center justify-center rounded-adm-sm border text-[14px] font-semibold",
                      time === slot.time ? "border-adm-accent bg-adm-accent text-white" : slot.available ? "border-adm-line-2 bg-adm-surface text-adm-ink hover:bg-adm-bg" : "border-adm-line bg-adm-bg text-adm-text-3"
                    )}
                  >
                    <span>{time12(slot.time)}</span>
                    {!slot.available && <span className="text-[12px] font-medium">{isCurrent ? "Now" : (slot.reason && SLOT_REASON[slot.reason]) || "Taken"}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[14px] font-medium text-adm-attn">No open times this day.</p>
          )}
        </fieldset>
      )}
      {fullDay && fullDayOk?.date === date && !fullDayOk.ok && <p className="mt-2 text-[14px] font-medium text-adm-attn">{fullDayOk.reason || "This day is not available for a Full Day."}</p>}
      <div className="mt-4">
        <Checkbox
          name="notify"
          checked={notify}
          onChange={setNotify}
          label="Tell the customer"
          help={notify ? (job.status === "Confirmed" ? "The reschedule email, and a text if they agreed to service texts." : "The reschedule email (texts go only for confirmed jobs).") : "Nothing is sent. Tell them yourself."}
        />
      </div>
      <StepError error={s.error} onRefresh={onRefresh} />
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Back
        </Button>
        <Button large busy={s.busy} disabled={!ready} onClick={submit} data-confirm="reschedule">
          {ready ? `Move to ${dayLabel(date)}${fullDay ? "" : ` · ${time12(time)}`}` : "Pick a new time"}
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reassign                                                            */
/* ------------------------------------------------------------------ */

export function ReassignStep({ job, footer, onBack, onDone, onRefresh, setBusy }: StepProps) {
  const [tech, setTech] = useState(job.technician?.id || "");
  const s = useSubmit(setBusy);
  const changed = Boolean(tech) && tech !== (job.technician?.id || "");
  const submit = () =>
    s.run(async () => {
      if (!job.updatedAt) throw new Error("Reload the job first.");
      const r = await patchJob(job.id, { expectedUpdatedAt: job.updatedAt, assignedFixterId: tech });
      onDone(resultOf(`Assigned to ${r.booking.technician?.name || "the new Fixter"}`, r.booking, r.notifications));
    });
  return (
    <div data-step="reassign">
      <Consequence>
        {job.technician ? (
          <>
            Now: <strong>{job.technician.name}</strong>.
          </>
        ) : (
          <>Nobody is assigned yet.</>
        )}{" "}
        {job.status === "Confirmed" ? "The customer gets a text about their new Fixter, if they agreed to service texts." : "The customer is not messaged while the job is pending."}
      </Consequence>
      <div className="mt-4">
        <TechPicker jobId={job.id} value={tech} onChange={setTech} label="Assign to" />
      </div>
      <StepError error={s.error} onRefresh={onRefresh} />
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Back
        </Button>
        <Button large busy={s.busy} disabled={!changed} onClick={submit} data-confirm="reassign">
          Save Fixter
        </Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit the description (J-06, J-07)                                   */
/* ------------------------------------------------------------------ */

/**
 * The customer's description and the older admin note, sent only when they
 * changed, with the updatedAt the editor loaded. If the customer added to the
 * description meanwhile (409 STALE), the current text is shown and nothing
 * typed is lost: re-apply yours on top, or keep theirs.
 */
export function EditStep({ job, footer, onBack, onDone, setBusy, setDirty }: StepProps) {
  const [base, setBase] = useState({ description: job.description, adminNote: job.adminNote, updatedAt: job.updatedAt });
  const [description, setDescription] = useState(job.description);
  const [adminNote, setAdminNote] = useState(job.adminNote);
  const [fresh, setFresh] = useState<JobDetail | null>(null);
  const s = useSubmit(setBusy);
  const dirty = description !== base.description || adminNote !== base.adminNote;
  useEffect(() => setDirty?.(dirty), [dirty, setDirty]);

  const submit = () =>
    s.run(async () => {
      if (!base.updatedAt) throw new Error("Reload the job first.");
      const patch: { expectedUpdatedAt: string; note?: string; adminNote?: string } = { expectedUpdatedAt: base.updatedAt };
      if (description !== base.description) patch.note = description;
      if (adminNote !== base.adminNote) patch.adminNote = adminNote;
      try {
        const r = await patchJob(job.id, patch);
        setDirty?.(false);
        onDone({ title: r.changed.length ? "Saved" : "Nothing changed", lines: [], booking: r.booking });
      } catch (error) {
        if (conflictOf(error)?.code === "STALE") {
          const latest = await fetchQuery(jobKeys.detail(job.id), (signal) => fetchJob(job.id, signal), { force: true });
          setFresh(latest);
        }
        throw error;
      }
    });

  const reapply = () => {
    if (!fresh) return;
    setBase({ description: fresh.description, adminNote: fresh.adminNote, updatedAt: fresh.updatedAt });
    setFresh(null);
    s.setError(null);
  };
  const keepTheirs = () => {
    if (!fresh) return;
    setBase({ description: fresh.description, adminNote: fresh.adminNote, updatedAt: fresh.updatedAt });
    setDescription(fresh.description);
    setAdminNote(fresh.adminNote);
    setFresh(null);
    s.setError(null);
  };

  return (
    <div data-step="edit" className="flex flex-col gap-4">
      <Field label="Customer's description" help="What the customer wrote. They can add to it themselves; nothing is sent when you save.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000} data-edit-description="" />
      </Field>
      <Field label="Admin note (older internal note)" help="Staff only. New internal notes go under Internal notes.">
        <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} maxLength={5000} />
      </Field>
      {fresh ? (
        <div role="alert" className="rounded-adm-sm border border-adm-attn bg-adm-attn-bg px-3 py-3 text-[14px] text-adm-attn" data-stale-text="">
          <p className="font-semibold">The job changed while you were editing. Nothing was saved. This is the current description:</p>
          <p className="mt-2 whitespace-pre-wrap rounded-adm-xs bg-adm-surface px-2 py-2 text-adm-ink">{fresh.description || "(empty)"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reapply} data-reapply="">
              Keep my text and save again
            </Button>
            <Button variant="tertiary" onClick={keepTheirs} data-keep-theirs="">
              Use the current text
            </Button>
          </div>
        </div>
      ) : (
        s.error ? <StepError error={s.error} onRefresh={onBack} /> : null
      )}
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack} disabled={s.busy}>
          Back
        </Button>
        <Button large busy={s.busy} disabled={!dirty || Boolean(fresh)} onClick={submit} data-confirm="edit">
          Save
        </Button>
      </Footer>
    </div>
  );
}
