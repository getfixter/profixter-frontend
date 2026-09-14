"use client";

import React from "react";
import Link from "next/link";
import type { LoyaltyStatus } from "@/lib/subscription-service";

/**
 * Loyalty Benefits, as the member sees them.
 *
 * ONE COMPONENT, TWO PLACES. The account card and the cancellation screen show
 * the same progress from the same data, because a member who is told they are
 * eighteen days from a benefit and then sees something different on the way out
 * has been told one of those things wrongly.
 *
 * Every word of the reward itself comes from the server. Nothing here composes
 * a reward name, works out what a plan is worth, or counts anything — so the
 * ladder can change without touching this file, and the email, the account and
 * the cancel screen cannot drift apart.
 */

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

/**
 * How close they are, in the words that actually move somebody.
 *
 * Days beat months once the finish line is near — "18 days" is a thing you can
 * picture and "2 months" is not — so the copy switches over at six weeks. The
 * figure is real: it comes from the billing period Stripe gave us, not an
 * estimate made on the client.
 */
function proximityLine(status: LoyaltyStatus): string {
  const days = status.daysUntilNextMilestone;
  if (typeof days === "number" && days >= 0 && days <= 45) {
    if (days === 0) return "Your next Loyalty Benefit unlocks today";
    if (days === 1) return "You are 1 day from your next Loyalty Benefit";
    return `You are ${days} days from your next Loyalty Benefit`;
  }
  const months = status.monthsRemaining;
  if (typeof months === "number" && months > 0) {
    return `${months} ${months === 1 ? "month" : "months"} until your next Loyalty Benefit`;
  }
  return "Your next Loyalty Benefit is on the way";
}

function ProgressMeter({ counted, target }: { counted: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((counted / target) * 100)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[15px] font-semibold text-[#313234]">
          {counted} of {target} months completed
        </div>
        <div className="text-[13px] font-semibold text-[#6A6D71]">{pct}%</div>
      </div>
      {/*
        A real denominator and a real fill. The bar is decorative to a screen
        reader — the sentence above already says the same thing in words — so it
        is hidden rather than announced twice.
      */}
      <div
        aria-hidden="true"
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#E3EAF7]"
      >
        <div
          className="h-full rounded-full bg-[#306EEC] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.max(pct, counted > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function BenefitRow({
  headline,
  detail,
  meta,
  tone = "active",
}: {
  headline: string;
  detail?: string;
  meta?: string;
  tone?: "active" | "quiet";
}) {
  const active = tone === "active";
  return (
    <div
      className={`rounded-[8px] border px-4 py-3 ${
        active ? "border-[#A7C6F7] bg-[#F2F7FF]" : "border-[#D7E0F5] bg-white/70"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-[14.5px] font-semibold text-[#313234]">{headline}</div>
        {meta ? (
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#306EEC]">
            {meta}
          </div>
        ) : null}
      </div>
      {detail ? <div className="mt-1 text-[13.5px] leading-relaxed text-[#6A6D71]">{detail}</div> : null}
    </div>
  );
}

/**
 * The booking-page form of the same data: one row, no meter, no small print.
 *
 * Reinforcement, not an obstacle. It sits above the form and costs it a single
 * line, because somebody who came to book a visit came to book a visit — the
 * moment is right for a reminder and wrong for anything that has to be read.
 */
function CompactStrip({ status }: { status: LoyaltyStatus }) {
  const active = (status.activeBenefits || []).find((benefit) => benefit.active || benefit.pendingFreeMonth);

  const headline = active
    ? active.headline
    : status.nextReward?.headline || "";
  if (!headline) return null;

  const lead = active
    ? "Active Loyalty Benefit"
    : status.countedMonths > 0 && status.nextMilestone
      ? `${status.countedMonths} of ${status.nextMilestone} months · Next Loyalty Benefit`
      : "Next Loyalty Benefit";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#306EEC]">
        {lead}
      </span>
      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-[1.35] text-[#0B1628]">
        {headline}
      </span>
      <Link
        href="/membership/loyalty"
        className="text-[12.5px] font-semibold text-[#306EEC] underline-offset-2 hover:underline"
      >
        Details
      </Link>
    </div>
  );
}

export default function LoyaltyBenefitsPanel({
  status,
  variant = "account",
}: {
  status: LoyaltyStatus | null;
  /**
   * "cancel" trims it to the one thing that matters on the way out.
   * "compact" is the single-row form used above the booking form.
   */
  variant?: "account" | "cancel" | "compact";
}) {
  if (!status || !status.enabled) return null;

  /*
   * The compact form has no annual variant and no launch-date note: a booking
   * page is not where either belongs, and an annual member booking a visit
   * needs no reminder about how their billing works.
   */
  if (variant === "compact") {
    if (!status.eligible) return null;
    return <CompactStrip status={status} />;
  }

  /*
   * Annual members are not on this ladder, and must never be shown an empty
   * meter that reads as "you have nothing". They already took the reward up
   * front, and the screen says so rather than staying silent.
   */
  if (!status.eligible && status.reason === "annual_membership" && status.annual) {
    if (variant === "cancel") return null;
    return (
      <div className="rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#306EEC]">
          Loyalty Benefits
        </div>
        <div className="mt-2 text-[15px] font-semibold text-[#313234]">
          {status.annual.headline}
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[#6A6D71]">{status.annual.detail}</p>
      </div>
    );
  }

  if (!status.eligible) return null;

  const active = status.activeBenefits || [];
  const isCancel = variant === "cancel";

  return (
    <div
      className={
        isCancel
          ? "rounded-[8px] border border-[#A7C6F7] bg-[#F2F7FF] p-4 text-left"
          : "rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#306EEC]">
          Loyalty Benefits
        </div>
        {!isCancel ? (
          <Link
            href="/membership/loyalty"
            className="text-[12.5px] font-semibold text-[#306EEC] underline-offset-2 hover:underline"
          >
            How it works
          </Link>
        ) : null}
      </div>

      {/* ── What they already hold ───────────────────────────────── */}
      {active.length ? (
        <div className="mt-3 space-y-2">
          {active.map((benefit) => (
            <BenefitRow
              key={benefit.id}
              headline={benefit.headline}
              detail={benefit.pendingFreeMonth ? undefined : benefit.detail}
              meta={benefit.pendingFreeMonth ? "Applied" : "Unlocked"}
            />
          ))}
          {active.some((benefit) => benefit.active && benefit.effectiveUntil) ? (
            <div className="text-[12.5px] text-[#6A6D71]">
              Active through{" "}
              <strong className="font-semibold text-[#313234]">
                {formatDate(active.find((b) => b.active)?.effectiveUntil)}
              </strong>
              .
            </div>
          ) : null}
        </div>
      ) : null}

      {status.loyaltyFullDaysAvailable > 0 ? (
        <div className="mt-2">
          <BenefitRow
            headline={
              status.loyaltyFullDaysAvailable === 1
                ? "1 extra Full Day, ready to book"
                : `${status.loyaltyFullDaysAvailable} extra Full Days, ready to book`
            }
            detail="On top of the Full Day your Elite plan already includes each month."
            meta={
              status.nextLoyaltyFullDayExpiresAt
                ? `Use by ${formatDate(status.nextLoyaltyFullDayExpiresAt)}`
                : undefined
            }
          />
        </div>
      ) : null}

      {/* ── Where they are headed ────────────────────────────────── */}
      {status.nextMilestone ? (
        <div className={active.length || status.loyaltyFullDaysAvailable ? "mt-4" : "mt-3"}>
          <ProgressMeter counted={status.countedMonths} target={status.nextMilestone} />

          <div className="mt-3 rounded-[8px] border border-[#D7E0F5] bg-white px-4 py-3">
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#6A6D71]">
              Your next Loyalty Benefit
            </div>
            <div className="mt-1 text-[15.5px] font-semibold text-[#313234]">
              {status.nextReward?.headline}
            </div>
            {status.nextReward?.detail && !isCancel ? (
              <div className="mt-1 text-[13.5px] leading-relaxed text-[#6A6D71]">
                {status.nextReward.detail}
              </div>
            ) : null}
            <div className="mt-2 text-[13px] font-semibold text-[#306EEC]">
              {proximityLine(status)}
              {status.estimatedUnlockDate ? ` — around ${formatDate(status.estimatedUnlockDate)}` : ""}
            </div>
          </div>
        </div>
      ) : status.ladderComplete ? (
        /*
         * Year two has not been decided, so nothing is promised. Saying they
         * have completed the ladder is true; an empty meter would read as a
         * mistake, and an invented next rung would be one.
         */
        <div className="mt-3 rounded-[8px] border border-[#D7E0F5] bg-white px-4 py-3">
          <div className="text-[15px] font-semibold text-[#313234]">
            You have unlocked every Loyalty Benefit
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#6A6D71]">
            Twelve months of continuous membership. Thank you for staying with us.
          </p>
        </div>
      ) : null}

      {/* ── The honest small print ───────────────────────────────── */}
      {isCancel ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#6A6D71]">
          Ending your membership stops your progress toward this. If you come back within
          45 days, your progress is still here.
        </p>
      ) : status.countedMonths === 0 && status.programStartedAt ? (
        /*
         * Shown only at zero, and only to explain why. A nine-year member
         * looking at "0 of 3" deserves to be told the clock started for
         * everybody on the same day rather than left to assume we lost their
         * history.
         */
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#6A6D71]">
          Loyalty Benefits started on {formatDate(status.programStartedAt)}. Everyone&apos;s
          progress began together on that date.
        </p>
      ) : null}
    </div>
  );
}
