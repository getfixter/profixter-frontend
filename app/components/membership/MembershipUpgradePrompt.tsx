"use client";

import Link from "next/link";
import { PLAN_DETAILS } from "@/lib/stripe-links";

/**
 * A contextual nudge toward the next plan, not a pricing table.
 *
 * Shown only where it is genuinely useful: beside booking, where the member is
 * actively using the membership, and on Extra Visit, where buying another visit
 * is itself the signal that the current plan may be too small.
 *
 * Rules it obeys, because an upsell that ignores them becomes an advert:
 *   - one plan, the next one up, never a comparison
 *   - nothing at all for Elite, who have nowhere to go
 *   - it never blocks the task it sits beside
 *
 * The CTA routes into the real change-plan flow in PlanSection rather than
 * inventing a second upgrade path.
 */

export type PlanKey = "basic" | "plus" | "premium" | "elite";

const PLAN_ORDER: PlanKey[] = ["basic", "plus", "premium", "elite"];

/** Priority Visits are a plan benefit, so the prompt names the real numbers. */
export const PRIORITY_VISITS_PER_MONTH: Partial<Record<PlanKey, number>> = {
  premium: 1,
  elite: 2,
};

export function planLabel(key: PlanKey) {
  return PLAN_DETAILS.find((plan) => plan.id === key)?.name || key;
}

export function normalizePlanKey(value: unknown): PlanKey | null {
  const key = String(value || "").trim().toLowerCase();
  return (PLAN_ORDER as string[]).includes(key) ? (key as PlanKey) : null;
}

/**
 * Which plan to suggest.
 *
 * "priority" asks a different question from "normal". Someone on Basic looking
 * at Priority does not need Plus, which includes no Priority Visits at all;
 * they need the first plan that does. So the priority variant jumps to Premium
 * rather than walking one step up the ladder.
 */
export function nextPlanFor(current: PlanKey | null, variant: "normal" | "priority"): PlanKey | null {
  if (!current) return null;
  if (variant === "priority") {
    if (current === "basic" || current === "plus") return "premium";
    if (current === "premium") return "elite";
    return null;
  }
  const index = PLAN_ORDER.indexOf(current);
  return index >= 0 && index < PLAN_ORDER.length - 1 ? PLAN_ORDER[index + 1] : null;
}

function planDetail(key: PlanKey) {
  return PLAN_DETAILS.find((plan) => plan.id === key) || null;
}

export default function MembershipUpgradePrompt({
  currentPlan,
  variant = "normal",
  className = "",
}: {
  currentPlan: PlanKey | null;
  variant?: "normal" | "priority";
  className?: string;
}) {
  const nextKey = nextPlanFor(currentPlan, variant);
  if (!nextKey) return null;

  const plan = planDetail(nextKey);
  if (!plan) return null;

  const priorityVisits = PRIORITY_VISITS_PER_MONTH[nextKey];
  const label = variant === "priority" ? "Priority is included on some plans" : "Get more from your membership";
  const reason =
    variant === "priority"
      ? `${plan.name} includes ${priorityVisits} Priority Visit${priorityVisits === 1 ? "" : "s"} a month.`
      : "Need visits more often? This plan may fit you better.";

  return (
    <aside
      className={`rounded-[16px] border border-[#E4E9F2] bg-white p-4 sm:p-5 ${className}`}
      aria-label="Membership upgrade suggestion"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A94A6]">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#0B1628]">{plan.name}</span>
        <span className="text-[14px] font-medium text-[#6E6E73]">${plan.price}/mo</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-5 text-[#5C6672]">{reason}</p>
      <Link
        href="/membership#my-plan"
        className="mt-3 inline-flex min-h-[40px] items-center text-[14px] font-semibold text-[#306EEC] transition hover:text-[#2558C9]"
      >
        See {plan.name}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="ml-1">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </aside>
  );
}
