"use client";

/*
 * Small shared pieces of the sales desk (Telemarketer workspace and owner
 * Sales desk). Figures always come from the server; these only lay them out.
 * Verified system events and employee claims are always told apart: every
 * claim is labelled "pending" / "not earnings" and every timeline row has
 * an origin badge.
 */
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, NoSymbolIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { StatusBadge, cx } from "@/app/components/admin/ui";
import { activityLabel, dateText, dateTimeText, dayText, money, prize, stageLabel, timeLeft, type Bonus, type Calc, type Earnings, type Entry, type Suppression, type TimelineItem } from "@/lib/admin/sales";

export function Problem({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <div role="alert" data-sales-error={code || "error"} className="flex items-start gap-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2.5 text-[14px] text-adm-problem">
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function Notice({ children, tone = "info", className, ...rest }: { children: ReactNode; tone?: "info" | "attention" | "ok"; className?: string } & Record<`data-${string}`, string>) {
  const cls = tone === "attention" ? "bg-adm-attn-bg text-adm-attn" : tone === "ok" ? "bg-adm-ok-bg text-adm-ok" : "bg-adm-info-bg text-adm-info";
  const Icon = tone === "ok" ? CheckCircleIcon : tone === "attention" ? ExclamationTriangleIcon : InformationCircleIcon;
  return (
    <div className={cx("flex items-start gap-2 rounded-adm-sm px-3 py-2.5 text-[14px] leading-5", cls, className)} {...rest}>
      <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

/** A white card with an optional heading (the kit's Card, with a data hook). */
export function Panel({ title, action, children, className, ...rest }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  return (
    <section className={cx("min-w-0 rounded-adm-md border border-adm-line bg-adm-surface", className)} {...rest}>
      {(title || action) && (
        <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-2">
          {title && <h2 className="text-[15px] font-semibold text-adm-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Label / value rows. */
export function Facts({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-adm-text-2">{k}</dt>
          <dd className="mb-1 min-w-0 break-words text-adm-ink sm:mb-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stat({ label, value, note, ...rest }: { label: ReactNode; value: ReactNode; note?: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className="min-w-0 rounded-adm-md border border-adm-line bg-adm-surface px-3 py-2.5" {...rest}>
      <div className="adm-num text-[18px] font-semibold text-adm-ink">{value}</div>
      <div className="text-[12px] leading-4 text-adm-text-2">{label}</div>
      {note && <div className="mt-0.5 text-[12px] leading-4 text-adm-text-3">{note}</div>}
    </div>
  );
}

/** An info button that shows a definition (KPI dictionary from the server). */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label={`What "${label}" means`} aria-expanded={open} aria-describedby={open ? id : undefined} title={text} onClick={() => setOpen((v) => !v)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-adm-text-3 hover:text-adm-ink" data-info-tip={label}>
        <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" id={id} className="absolute left-1/2 top-full z-30 mt-1 w-[240px] max-w-[70vw] -translate-x-1/2 rounded-adm-sm border border-adm-line bg-adm-surface p-2 text-left text-[12px] font-normal normal-case leading-4 text-adm-ink shadow-adm-2">
          {text}
        </span>
      )}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const tone = stage === "interested" ? "success" : stage === "lost" ? "problem" : stage === "not_interested" ? "neutral" : stage === "new" ? "attention" : "info";
  return (
    <span className="inline-flex" data-stage-chip={stage}>
      <StatusBadge tone={tone}>{stageLabel(stage)}</StatusBadge>
    </span>
  );
}

export function SuppressionBadges({ call, sms }: { call: boolean; sms: boolean }) {
  if (!call && !sms) return null;
  return (
    <>
      {call && (
        <span data-dnc="call" className="inline-flex h-6 flex-none items-center gap-1 rounded-adm-xs bg-adm-problem-bg px-1.5 text-[12px] font-semibold text-adm-problem">
          <NoSymbolIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Do not call
        </span>
      )}
      {sms && (
        <span data-dnc="sms" className="inline-flex h-6 flex-none items-center gap-1 rounded-adm-xs bg-adm-problem-bg px-1.5 text-[12px] font-semibold text-adm-problem">
          <NoSymbolIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Do not text
        </span>
      )}
    </>
  );
}

export function SuppressionBanner({ s }: { s: Suppression }) {
  if (!s.call && !s.sms) return null;
  const what = s.call && s.sms ? "Do not call or text this person." : s.call ? "Do not call this person." : "Do not text this person.";
  return (
    <div role="alert" data-suppression-banner="" className="rounded-adm-sm border border-adm-problem bg-adm-problem-bg px-3 py-2.5 text-[14px] text-adm-problem">
      <p className="flex items-center gap-2 font-semibold">
        <NoSymbolIcon className="h-5 w-5 flex-none" aria-hidden="true" />
        {what}
      </p>
      {s.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-7 text-[13px]">
          {s.reasons.map((r, i) => (
            <li key={i}>
              {r.channel === "all" ? "Calls and texts" : r.channel === "call" ? "Calls" : "Texts"}: {r.reason || "No reason given"} ({sourceLabel(r.source)}, {dateText(r.at)})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const sourceLabel = (s: string) => ({ telemarketer: "recorded by a telemarketer", owner: "recorded by the owner", ghl: "from GHL", customer: "the customer" })[s] || s;

/** Where a timeline row came from: verified by the system, logged by a person, from GHL, or estimated. */
export function OriginBadge({ origin, by }: { origin: TimelineItem["origin"]; by?: string }) {
  if (origin === "system") return <StatusBadge tone="info">System</StatusBadge>;
  if (origin === "ghl") return <StatusBadge tone="neutral">From GHL</StatusBadge>;
  if (origin === "estimated") return <StatusBadge tone="attention">Estimated</StatusBadge>;
  return (
    <span className="inline-flex h-6 flex-none items-center rounded-adm-xs border border-adm-line-2 px-1.5 text-[12px] font-semibold text-adm-text-2">
      Logged by {by || "an employee"}
    </span>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="text-[14px] text-adm-text-2">Nothing yet.</p>;
  return (
    <ol className="space-y-2" data-timeline="">
      {items.map((t, i) => (
        <li key={t.id || `${t.kind}-${t.at}-${i}`} className={cx("min-w-0 rounded-adm-sm border px-3 py-2", t.kind === "coaching" ? "border-adm-attn bg-adm-attn-bg" : "border-adm-line")} data-origin={t.origin} data-kind={t.kind}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-semibold text-adm-ink">{activityLabel(t.kind)}</span>
            <OriginBadge origin={t.origin} by={t.by} />
            {t.kind === "coaching" && <StatusBadge tone="attention">Owner only</StatusBadge>}
            <span className="adm-num ml-auto text-[12px] text-adm-text-3">{dateTimeText(t.at)}</span>
          </div>
          {t.text && t.text !== activityLabel(t.kind) && <p className="mt-0.5 break-words text-[13px] leading-5 text-adm-text-2">{t.text}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pctValue = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-3 w-full overflow-hidden rounded-full bg-adm-sunk" data-bonus-bar="">
      <div className="h-full rounded-full bg-adm-ok" style={{ width: `${pctValue}%` }} />
    </div>
  );
}

/**
 * The bonus figures exactly as the server's bonusProgress() sent them. Used by
 * the employee (Today, Earnings › Bonus) and the owner (Team, employee detail).
 */
export function BonusSummary({ bonus, compact = false, owner = false }: { bonus: Bonus; compact?: boolean; owner?: boolean }) {
  if (!bonus.started || !bonus.period) {
    return (
      <div data-bonus="" data-bonus-started="false" className="space-y-2">
        <p className="text-[15px] font-semibold text-adm-ink">
          {bonus.threshold} memberships in a bonus month earn {prize(bonus.amountCents)}
        </p>
        <p className="text-[14px] text-adm-text-2" data-bonus-message="">
          {bonus.message}
        </p>
        {bonus.pendingCount > 0 && <p className="text-[13px] text-adm-attn">{bonus.pendingCount} waiting for the owner&apos;s review (not counted yet)</p>}
      </div>
    );
  }
  const inBlock = bonus.inBlock ?? 0;
  const remaining = bonus.remaining ?? bonus.threshold;
  return (
    <div data-bonus="" data-bonus-started="true" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[17px] font-semibold text-adm-ink" data-bonus-progress="">
          <span className="adm-num">{inBlock}</span> of <span className="adm-num">{bonus.threshold}</span> memberships
        </p>
        <p className="text-[14px] font-semibold text-adm-ok" data-bonus-remaining="">
          {remaining} more for {owner ? "the" : "your"} next {prize(bonus.amountCents)}
        </p>
      </div>
      <ProgressBar value={inBlock} max={bonus.threshold} label="Memberships toward the next bonus" />
      <ol className="flex justify-between gap-1" aria-label="Milestones" data-bonus-milestones="">
        {(bonus.milestones || []).map((m) => (
          <li key={m.at} className={cx("adm-num flex h-7 min-w-[40px] items-center justify-center rounded-full px-2 text-[12px] font-semibold", m.reached ? "bg-adm-ok-bg text-adm-ok" : "bg-adm-sunk text-adm-text-3")} data-reached={m.reached ? "true" : "false"}>
            {m.reached ? "✓ " : ""}
            {m.at}
          </li>
        ))}
      </ol>
      <p className="text-[14px] text-adm-ink" data-bonus-message="">
        {bonus.message}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-adm-sm bg-adm-ok-bg px-2.5 py-2" data-bonus-verified="">
          <dt className="text-adm-ok">Verified this bonus month</dt>
          <dd className="adm-num text-[16px] font-semibold text-adm-ink">{bonus.verifiedCount ?? 0}</dd>
        </div>
        <div className="rounded-adm-sm bg-adm-attn-bg px-2.5 py-2" data-bonus-pending="">
          <dt className="text-adm-attn">Pending review (not counted yet)</dt>
          <dd className="adm-num text-[16px] font-semibold text-adm-ink">{bonus.pendingCount}</dd>
        </div>
      </dl>
      <p className="text-[13px] text-adm-text-2" data-bonus-period="">
        Bonus month {bonus.period.number}: {dayText(bonus.period.firstDay, { weekday: false })} – {dayText(bonus.period.lastDay, { weekday: false, year: true })} · <span data-bonus-left="">{timeLeft(bonus.period.msLeft)}</span>
      </p>
      {!compact && (
        <dl className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3" data-bonus-money="">
          <div className="rounded-adm-sm border border-adm-line px-2.5 py-2">
            <dt className="text-adm-text-2">Bonus earned this month</dt>
            <dd className="adm-num text-[15px] font-semibold text-adm-ink">{money(bonus.earnedThisPeriodCents ?? 0)}</dd>
          </div>
          <div className="rounded-adm-sm border border-adm-line px-2.5 py-2">
            <dt className="text-adm-text-2">Awaiting payment</dt>
            <dd className="adm-num text-[15px] font-semibold text-adm-ink">{money(bonus.awaitingPaymentThisPeriodCents ?? 0)}</dd>
          </div>
          <div className="rounded-adm-sm border border-adm-line px-2.5 py-2">
            <dt className="text-adm-text-2">Paid</dt>
            <dd className="adm-num text-[15px] font-semibold text-adm-ink">{money(bonus.paidThisPeriodCents ?? 0)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/** Earnings split: money on statements versus claims that are not earnings yet. */
export function EarningsSnapshot({ e }: { e: Earnings }) {
  return (
    <div data-earnings="" className="space-y-2">
      <dl className="grid grid-cols-2 gap-2 text-[13px]">
        <div className="rounded-adm-sm border border-adm-line px-2.5 py-2" data-earn="open">
          <dt className="text-adm-text-2">On statements not yet approved</dt>
          <dd className="adm-num text-[16px] font-semibold text-adm-ink">{money(e.onOpenStatementsCents)}</dd>
        </div>
        <div className="rounded-adm-sm border border-adm-line px-2.5 py-2" data-earn="approved">
          <dt className="text-adm-text-2">Approved, awaiting payment</dt>
          <dd className="adm-num text-[16px] font-semibold text-adm-ink">{money(e.approvedUnpaidCents)}</dd>
        </div>
        <div className="rounded-adm-sm border border-adm-line px-2.5 py-2" data-earn="paid">
          <dt className="text-adm-text-2">Paid to date</dt>
          <dd className="adm-num text-[16px] font-semibold text-adm-ink">{money(e.paidCents)}</dd>
        </div>
        <div className="rounded-adm-sm border border-dashed border-adm-attn bg-adm-attn-bg px-2.5 py-2" data-earn="pending">
          <dt className="text-adm-attn">Pending claims · not earnings</dt>
          <dd className="adm-num text-[16px] font-semibold text-adm-ink">
            {money(e.pendingClaimsCents)} <span className="text-[12px] font-normal text-adm-text-2">({e.pendingClaimsCount})</span>
          </dd>
        </div>
      </dl>
      <p className="text-[12px] text-adm-text-3">Statement money comes only from verified payments. Pending claims count once the owner approves them.</p>
    </div>
  );
}

/** How a commission was worked out, line by line. */
export function CalcBreakdown({ calc, amountCents }: { calc: Calc; amountCents?: number }) {
  return (
    <div className="space-y-1 text-[13px]" data-calc="">
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
        <dt className="text-adm-text-2">Regular price</dt>
        <dd className="adm-num text-right text-adm-ink">{money(calc.regularCents)}</dd>
        <dt className="text-adm-text-2">Discount{calc.discountSource ? ` (${calc.discountSource})` : ""}</dt>
        <dd className="adm-num text-right text-adm-ink">{calc.discountCents ? `−${money(calc.discountCents)}` : money(0)}</dd>
        <dt className="text-adm-text-2">Paid, excluding tax</dt>
        <dd className="adm-num text-right text-adm-ink">{money(calc.paidPreTaxCents)}</dd>
        {typeof amountCents === "number" && (
          <>
            <dt className="font-semibold text-adm-ink">Commission</dt>
            <dd className="adm-num text-right font-semibold text-adm-ink">{money(amountCents)}</dd>
          </>
        )}
      </dl>
      {calc.explain && <p className="break-words text-adm-text-2">{calc.explain}</p>}
    </div>
  );
}

export function EntryRow({ e, showEmployee }: { e: Entry & { employee?: { name: string } | string }; showEmployee?: boolean }) {
  const kindLabel = e.kind === "bonus" ? "Bonus" : e.kind === "adjustment" ? "Adjustment" : "Commission";
  return (
    <li className="min-w-0 border-b border-adm-line px-4 py-3 last:border-b-0" data-entry={e.id} data-entry-kind={e.kind} data-late={e.late ? "true" : "false"}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[14px] font-semibold text-adm-ink">{kindLabel}</span>
        {e.customer && <span className="text-[13px] text-adm-text-2">{e.customer}</span>}
        {showEmployee && e.employee && <span className="text-[13px] text-adm-text-2">· {typeof e.employee === "string" ? e.employee : e.employee.name}</span>}
        {e.late && (
          <StatusBadge tone="attention" title="Earned in a week that was already approved, so it is on this statement">
            Late: paid {e.paidAt ? dateText(e.paidAt) : dayText(e.earnedWeek)}
          </StatusBadge>
        )}
        <span className={cx("adm-num ml-auto text-[15px] font-semibold", e.amountCents < 0 ? "text-adm-problem" : "text-adm-ink")}>{money(e.amountCents)}</span>
      </div>
      {e.kind === "commission" ? <div className="mt-1"><CalcBreakdown calc={e.calc} /></div> : <p className="mt-0.5 break-words text-[13px] text-adm-text-2">{e.calc.explain || e.reason}</p>}
    </li>
  );
}

export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
