"use client";

import React, { useEffect, useRef } from "react";
import type { LoyaltyStatus, ManagedSubscription } from "@/lib/subscription-service";

/**
 * What a member sees between "Manage Plan" and Stripe.
 *
 * NOT A RETENTION POPUP, and the difference is structural rather than a matter
 * of tone. Continue is the primary button, it is never hidden, never delayed and
 * never disabled; the modal has no second step, no confirmation, and no cost to
 * dismissing it. Somebody who wants Stripe reaches Stripe in one tap.
 *
 * What it does instead is answer a question the Stripe portal cannot: what this
 * membership is currently worth. A member about to change or cancel their plan
 * is the one person who most needs to know they are three weeks from two
 * complimentary months — and Stripe has no idea that is true.
 *
 * THE REWARD IS THE LOUDEST THING ON THE SCREEN. Not the progress number, not
 * the explanation, and certainly not a warning. If the benefit is not worth
 * staying for, no amount of copy around it will help, and pretending otherwise
 * would be the dark pattern this deliberately is not.
 *
 * Every figure comes from the Loyalty API for THIS property. Nothing is
 * computed here and nothing is hardcoded, so a member with two houses sees the
 * one they are managing.
 */

const BRAND = "#306EEC";

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

function planName(plan?: string | null): string {
  const key = String(plan || "").toLowerCase();
  if (!key) return "";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** "18 days away" beats "2 months" once the finish line is close enough to picture. */
function proximity(status: LoyaltyStatus): string {
  const days = status.daysUntilNextMilestone;
  if (typeof days === "number" && days >= 0 && days <= 45) {
    if (days === 0) return "It unlocks today";
    if (days === 1) return "You're 1 day away";
    return `You're ${days} days away`;
  }
  const months = status.monthsRemaining;
  if (typeof months === "number" && months > 0) {
    return `${months} more ${months === 1 ? "month" : "months"} to go`;
  }
  return "";
}

function Meter({ counted, target }: { counted: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((counted / target) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-[#475569]">
          {counted} of {target} months completed
        </span>
        <span className="text-[12.5px] font-semibold text-[#64748B]">{pct}%</span>
      </div>
      <div aria-hidden="true" className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E3EAF7]">
        <div
          className="h-full rounded-full bg-[#306EEC] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.max(pct, counted > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/** The reward, given the weight it deserves. */
function RewardBlock({
  eyebrow,
  headline,
  note,
}: {
  eyebrow: string;
  headline: string;
  note?: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#A7C6F7] bg-[#F2F7FF] px-4 py-4 text-left">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#306EEC]">
        {eyebrow}
      </div>
      <div className="mt-1.5 text-[19px] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0B1628] sm:text-[21px]">
        {headline}
      </div>
      {note ? <div className="mt-1.5 text-[13.5px] leading-6 text-[#475569]">{note}</div> : null}
    </div>
  );
}

/**
 * The body, which is entirely a question of which state this membership is in.
 *
 * Annual first, because an annual member has no monthly progress and showing
 * them an empty meter would read as "you have nothing" when in fact they took
 * the same reward up front.
 */
function LoyaltyBody({
  status,
  subscription,
}: {
  status: LoyaltyStatus | null;
  subscription: ManagedSubscription | null;
}) {
  if (!status || !status.enabled) return null;

  if (!status.eligible && status.reason === "annual_membership" && status.annual) {
    return (
      <RewardBlock
        eyebrow="Your annual membership"
        headline={status.annual.headline}
        note={status.annual.detail}
      />
    );
  }

  if (!status.eligible) return null;

  const active = status.activeBenefits || [];
  const running = active.filter((benefit) => benefit.active);
  const pendingFreeMonth = active.find((benefit) => benefit.pendingFreeMonth);
  const renewal = formatDate(subscription?.currentPeriodEnd || subscription?.nextPaymentDate);

  return (
    <div className="space-y-3">
      {/*
        The free month, when it is already applied. The biggest thing the
        programme gives, and the one most worth seeing before touching billing.
      */}
      {pendingFreeMonth ? (
        <RewardBlock
          eyebrow="Already applied"
          headline="Your next month is on us"
          note={
            renewal
              ? `Your ${renewal} renewal will be $0. Nothing to do.`
              : "It is applied automatically. Nothing to do."
          }
        />
      ) : null}

      {/* A complimentary upgrade currently running. */}
      {running.map((benefit) => (
        <RewardBlock
          key={benefit.id}
          eyebrow="Active Loyalty Benefit"
          headline={benefit.headline}
          note={
            benefit.effectiveUntil
              ? `Available through ${formatDate(benefit.effectiveUntil)}.`
              : benefit.detail
          }
        />
      ))}

      {/* Extra Full Days an Elite member is holding right now. */}
      {status.loyaltyFullDaysAvailable > 0 ? (
        <RewardBlock
          eyebrow="Active Loyalty Benefit"
          headline={
            status.loyaltyFullDaysAvailable === 1
              ? "1 extra Full Day, ready to book"
              : `${status.loyaltyFullDaysAvailable} extra Full Days, ready to book`
          }
          note={
            status.nextLoyaltyFullDayExpiresAt
              ? `Use by ${formatDate(status.nextLoyaltyFullDayExpiresAt)}.`
              : "On top of the Full Day your Elite plan includes each month."
          }
        />
      ) : null}

      {/* Where they are headed next. */}
      {status.nextMilestone && status.nextReward ? (
        <div className="rounded-[10px] border border-[#D7E0F5] bg-white px-4 py-4">
          <Meter counted={status.countedMonths} target={status.nextMilestone} />
          <div className="mt-3.5 border-t border-[#EDF1F7] pt-3.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Your next Loyalty Benefit
            </div>
            <div className="mt-1.5 text-[19px] font-semibold leading-[1.25] tracking-[-0.015em] text-[#0B1628] sm:text-[21px]">
              {status.nextReward.headline}
            </div>
            {proximity(status) || status.estimatedUnlockDate ? (
              <div className="mt-1.5 text-[13.5px] font-semibold text-[#306EEC]">
                {proximity(status)}
                {status.estimatedUnlockDate ? ` — around ${formatDate(status.estimatedUnlockDate)}` : ""}
              </div>
            ) : null}
            <p className="mt-2 text-[13px] leading-6 text-[#475569]">
              {status.countedMonths === 0
                ? "Your Loyalty journey has started. Keep your membership active and it unlocks automatically."
                : "Keep your membership active and it unlocks automatically."}
            </p>
          </div>
        </div>
      ) : status.ladderComplete ? (
        <RewardBlock
          eyebrow="Loyalty Benefits"
          headline="You've unlocked every Loyalty Benefit"
          note="Twelve months of continuous membership. Thank you for staying with us."
        />
      ) : null}
    </div>
  );
}

export default function ManagePlanModal({
  open,
  subscription,
  loyalty,
  busy = false,
  error = "",
  onContinue,
  onClose,
}: {
  open: boolean;
  subscription: ManagedSubscription | null;
  loyalty: LoyaltyStatus | null;
  busy?: boolean;
  error?: string;
  /** Only this creates a Stripe portal session. Closing creates nothing. */
  onContinue: () => void;
  onClose: () => void;
}) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /*
   * Escape closes, focus lands on the way out rather than on the reward, and
   * Tab stays inside the dialog. A member who opened this by accident should be
   * able to leave it the way they expect to.
   */
  useEffect(() => {
    if (!open) return undefined;
    continueRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const address =
    subscription?.address?.line1 ||
    subscription?.addressSnapshot?.line1 ||
    "";
  const plan = planName(subscription?.subscriptionType);
  const cycle = subscription?.billingCycle === "annual" ? "Billed yearly" : "Billed monthly";
  const renewal = formatDate(subscription?.currentPeriodEnd || subscription?.nextPaymentDate);
  const hasLoyalty =
    !!loyalty?.enabled && (loyalty.eligible || loyalty.reason === "annual_membership");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-0 sm:items-center sm:px-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      {/*
        A bottom sheet on a phone and a centred dialog on a desktop. The
        difference is not decoration: a tall card centred on a 390px screen puts
        its buttons under the thumb only by accident, and this modal's whole job
        is to make Continue easy to reach.
      */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-plan-title"
        onClick={(event) => event.stopPropagation()}
        /*
         * The extra bottom padding on a phone clears the site's fixed mobile
         * nav, which otherwise sits over the last line of the sheet. Dropped at
         * the breakpoint where the nav is gone and the dialog is centred.
         */
        className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-[16px] bg-white p-5 pb-24 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:rounded-[12px] sm:p-7 sm:pb-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="manage-plan-title"
              className="text-[21px] font-semibold tracking-[-0.02em] text-[#0B1628] sm:text-[24px]"
            >
              Manage your membership
            </h2>
            {plan ? (
              <p className="mt-1 text-[13.5px] text-[#64748B]">
                {plan} · {cycle}
                {renewal ? ` · Renews ${renewal}` : ""}
              </p>
            ) : null}
            {address ? (
              <p className="mt-0.5 truncate text-[13px] text-[#94A3B8]">{address}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              if (!busy) onClose();
            }}
            className="-mr-1 -mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {hasLoyalty ? (
          <div className="mt-5">
            <LoyaltyBody status={loyalty} subscription={subscription} />
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[8px] border border-[#FCA5A5]/60 bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {/*
          Continue is primary and always available. What follows it is a plain
          description of where it goes, because "Manage Plan" on its own does
          not tell anybody they are about to leave ProFixter.
        */}
        <div className="mt-6 grid gap-2.5">
          <button
            ref={continueRef}
            type="button"
            onClick={onContinue}
            disabled={busy}
            className="min-h-[48px] rounded-[9px] bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] disabled:opacity-60"
          >
            {busy ? "Opening…" : "Continue to Manage Plan"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[48px] rounded-[9px] border border-[#CBD6E8] bg-white px-5 text-[15px] font-semibold text-[#0F172A] transition hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] disabled:opacity-60"
          >
            Stay on My Account
          </button>
        </div>

        <p className="mt-3 text-center text-[12.5px] leading-5 text-[#94A3B8]">
          Manage Plan opens our secure billing portal, where you can update your card,
          view invoices and change your plan.
        </p>
      </div>
    </div>
  );
}

export { formatDate as __formatDate, proximity as __proximity, BRAND as __BRAND };
