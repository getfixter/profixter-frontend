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
    description: "2 visits per month",
    features: [
      "2 scheduled visits each month",
      "Each visit is up to 90 minutes",
      "Good for steady small jobs",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: 249,
    description: "4 visits per month",
    subtitle: "Everything in Basic, plus",
    features: [
      "4 scheduled visits each month",
      "Each visit is up to 90 minutes",
      "More coverage for busy homes",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 349,
    description: "Emergency and two-pro coverage",
    subtitle: "Everything in Plus, plus",
    isPopular: true,
    features: [
      "1 emergency visit",
      "1 visit with 2 pros",
      "Priority support",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 499,
    description: "Unlimited visits by calendar schedule",
    subtitle: "Everything in Premium, plus",
    features: [
      "Unlimited scheduled visits",
      "Each visit is up to 90 minutes",
      "Best for heavy ongoing usage",
    ],
  },
];
