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

export const PLAN_DETAILS: PlanDetails[] = [
  {
    id: "basic",
    name: "Basic",
    price: 149,
    description: "Ongoing handyman help, one visit at a time",
    features: [
      "1 active booking",
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
      "2 active bookings",
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
      "2 active bookings",
      "1 Emergency Visit per month",
      "Each visit covers up to 90 minutes of work",
      "Emergency Visits help when you need service before the next standard appointment slot, subject to technician availability",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 499,
    description: "Larger projects and full-day tasks",
    subtitle: "Everything in Premium, plus",
    features: [
      "2-3 active bookings",
      "2 Emergency Visits per month",
      "1 full-day visit per month (up to 8 hours)",
      "Each standard visit covers up to 90 minutes of work",
      "Full-day visit must be scheduled in advance",
    ],
  },
];
