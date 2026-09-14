// lib/stripe-links.ts

export const PAYMENT_LINKS = {
  basic: "https://buy.stripe.com/eVqfZgeAN2pCgAxb3kawo02",
  plus: "https://buy.stripe.com/4gMaEWboB1ly3NL4EWawo03",
  premium: "https://buy.stripe.com/9B614m78lc0c6ZXb3kawo04",
  elite: "https://buy.stripe.com/5kQ28qeANaW8ac93ASawo01",
} as const;

export type PlanType = keyof typeof PAYMENT_LINKS;

export interface PlanDetails {
  id: PlanType;
  name: string;
  price: number;
  description: string;
  subtitle?: string;
  features: string[];
  isPopular?: boolean;
}

/*
 * HOW MANY VISITS A PLAN LETS YOU HAVE BOOKED AT ONCE.
 *
 * Basic is one, every other plan is two — which is exactly what the booking
 * gate enforces (routes/bookings.js: `plan === "basic" ? 1 : 2`). Elite used to
 * be advertised here as "2-3 active bookings", which the system has never
 * allowed; an Elite member reaching for a third was refused by a rule this file
 * had told them they did not have.
 *
 * The wording is deliberately a PACE rather than an allowance. "Book N at a
 * time, as often as you need" is the whole model in one line: the two halves
 * bound each other, so it cannot be read as unlimited service and cannot be
 * read as a monthly ration. Nothing anywhere should say "visits per month" of a
 * standard membership visit — that is the mental model this replaced.
 */
export const PLAN_DETAILS: PlanDetails[] = [
  {
    id: "basic",
    name: "Basic",
    price: 149,
    description: "Ongoing handyman help, one visit at a time",
    features: [
      "Book 1 visit at a time, as often as you need",
      "Each visit covers up to 90 minutes of work",
      "Book when spots are available",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: 249,
    description: "More flexibility with scheduling",
    subtitle: "Everything in Basic, plus",
    features: [
      "Book up to 2 visits at a time, as often as you need",
      "Each visit covers up to 90 minutes of work",
      "Book when spots are available",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 349,
    description: "Faster scheduling and peace of mind",
    subtitle: "Everything in Plus, plus",
    isPopular: true,
    features: [
      "Book up to 2 visits at a time, as often as you need",
      "1 Priority Visit per month",
      "Each visit covers up to 90 minutes of work",
      "Priority Visits help when you need service before the next standard appointment slot, subject to technician availability",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 499,
    description: "Larger projects and full-day tasks",
    subtitle: "Everything in Premium, plus",
    features: [
      "Book up to 2 visits at a time, as often as you need",
      "2 Priority Visits per month",
      "1 full-day visit per month (up to 8 hours)",
      "Each standard visit covers up to 90 minutes of work",
      "Full-day visit must be scheduled in advance",
    ],
  },
];
