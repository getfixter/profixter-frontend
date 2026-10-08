import type { Plan } from "@/app/data/content";

type PlanName = Plan["name"];

/**
 * The seven rows, in one fixed order, for all four plans.
 *
 * WHY A MATRIX AND NOT A LADDER.
 *
 * The ladder showed only what each tier ADDED, which explained the structure
 * and destroyed the value: Premium is a hundred dollars more than Plus and
 * added exactly one line, so the more you paid the emptier the card looked.
 * "Everything in Plus" was an IOU that asked the reader to scroll up and
 * reassemble the total in their head, and nobody does that.
 *
 * So every plan now shows the SAME rows in the SAME positions, and only the
 * marks change. Switching from Plus to Premium leaves row 5 where it is and
 * turns it on, which is a thing you can watch happen. Rows switched on run
 * 3 / 4 / 5 / 7, so the box visibly fills as the price rises and Elite is the
 * only state with nothing greyed out.
 *
 * ACCURACY. Every row here is checked against what the system actually does:
 *
 *   pace      routes/bookings.js: `plan === "basic" ? 1 : plan ? 2 : 0`.
 *             Elite is 2, not 3. Never described as a monthly quantity - it is
 *             a pace, and "allowance"/"limit" wording is settled elsewhere.
 *   fullDay   utils/fullDayEntitlements.js grants one per MEMBERSHIP MONTH,
 *             annual members included. It said "per billing period", which
 *             gave an annual member one for the whole year; the entitlement
 *             now slices the year into months, so "/ month" is true on both
 *             cycles and needs no per-cycle wording here.
 *   priority  Has no backend entitlement or counter anywhere - it is delivered
 *             by scheduling. The copy is the whole definition of the benefit,
 *             which is exactly why it keeps "subject to availability".
 *   supplies  Plus and above include small materials; fixtures, appliances and
 *             project materials are quoted separately.
 */
export type BenefitRow = {
  id: string;
  /** How the row reads for a plan that does NOT include it. */
  off: string;
  /**
   * How it reads for a plan that DOES. A string means every plan includes it;
   * a partial record means only the plans named include it, and the wording is
   * allowed to differ where the number itself differs.
   */
  on: string | Partial<Record<PlanName, string>>;
  /** A single short line, shown only when the row is on. Never an explanation. */
  detail?: string;
};

export const BENEFIT_ROWS: BenefitRow[] = [
  {
    id: "visits",
    off: "90-minute visits, any home task",
    on: "90-minute visits, any home task",
  },
  {
    id: "team",
    off: "The same local team every time",
    on: "The same local team every time",
  },
  {
    id: "pace",
    off: "Book visits as you need them",
    on: {
      Basic: "Book 1 visit at a time",
      Plus: "Book up to 2 visits at a time",
      Premium: "Book up to 2 visits at a time",
      Elite: "Book up to 2 visits at a time",
    },
    detail: "As often as you need.",
  },
  {
    id: "supplies",
    off: "Small supplies included",
    on: {
      Plus: "Small supplies included",
      Premium: "Small supplies included",
      Elite: "Small supplies included",
    },
    detail: "Screws, anchors, caulk and sealant.",
  },
  {
    id: "priority",
    off: "Priority Visits",
    on: {
      Premium: "1 Priority Visit / month",
      Elite: "2 Priority Visits / month",
    },
    detail: "When it can't wait. Subject to availability.",
  },
  {
    id: "fullDay",
    off: "A Full Day of work",
    on: { Elite: "1 Full Day / month" },
    detail: "Up to 8 hours for a bigger job.",
  },
  {
    id: "projects",
    off: "10% off larger projects",
    on: { Elite: "10% off larger projects" },
  },
];

export function benefitIncluded(row: BenefitRow, plan: PlanName): boolean {
  return typeof row.on === "string" ? true : Boolean(row.on[plan]);
}

export function benefitLabel(row: BenefitRow, plan: PlanName): string {
  if (typeof row.on === "string") return row.on;
  return row.on[plan] || row.off;
}

/**
 * Annual billing charges ten months and runs for twelve. The live Stripe annual
 * prices are exactly ten times the monthly ones ($1,490 / $2,490 / $3,490 /
 * $4,990). PlansSection and the structured data keep their own copy of the same
 * constant for historical reasons; this is the one new code should use.
 */
export const ANNUAL_MONTHS_CHARGED = 10;

export function annualPrice(plan: Plan): number {
  return plan.price * ANNUAL_MONTHS_CHARGED;
}
