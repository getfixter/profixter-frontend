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
    description: "Great for steady small jobs",
    features: [
      "Unlimited requests",
      "Basic improvements",
      "Quick fixes",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: 249,
    description: "More momentum each month",
    subtitle: "Everything in Basic, plus",
    features: [
      "Standard materials included",
      "Consultation",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 349,
    description: "Most popular - priority slots",
    subtitle: "Everything in Plus, plus",
    isPopular: true,
    features: [
      "Get 2 pros when needed",
      "Renovation consultation",
      "24/7 emergency help",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 449,
    description: "For busy homes & properties",
    subtitle: "Everything in Premium, plus",
    features: [
      "Seasonal property inspection",
      "Exclusive discount",
    ],
  },
];
