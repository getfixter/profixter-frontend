"use client";

import Link from "next/link";
import { PAYMENT_LINKS } from "@/lib/stripe-links";

/**
 * PlanComparisonSection
 *
 * Displays Profixter's subscription plans side by side for easy comparison.  Each
 * plan card lists pricing, included features and a CTA.  On small screens
 * the cards stack vertically.  This component can be used on the dedicated
 * Plans page and linked to from the homepage or quiz.
 */
export default function PlanComparisonSection() {
  // Spring discount pricing: oldPrice is crossed out; price is the new promotional price
  const plans = [
    {
      id: "basic",
      name: "Basic",
      oldPrice: 199,
      price: 149,
      description: "For occasional help and small tasks",
      features: [
        "2 guaranteed visits per month (unlimited scheduling)",
        "$99/hour rate for additional hours",
        "Standard scheduling during business hours",
        "Cancel anytime",
      ],
    },
    {
      id: "plus",
      name: "Plus",
      oldPrice: 299,
      price: 249,
      description: "For busy homes needing frequent help",
      features: [
        "Unlimited visits and priority scheduling",
        "$99/hour rate for additional hours",
        "Multiple active bookings",
        "Preferred handyman assigned",
      ],
    },
    {
      id: "premium",
      name: "Premium",
      oldPrice: 399,
      price: 349,
      description: "For families requiring 24/7 support",
      features: [
        "Unlimited visits with emergency & after‑hours support",
        "$99/hour rate for additional hours",
        "Two handymen for complex tasks",
        "Dedicated account manager",
      ],
    },
  ];
  return (
    <section className="py-12 sm:py-16 bg-white px-4 sm:px-6 md:px-8 animate-fadeIn" id="plans">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-8">Choose Your Plan</h2>
        <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          Pick the membership that fits your household.  Cancel anytime and upgrade or downgrade as needed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              id={plan.id}
              className="relative p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition bg-[#F9FAFB]"
            >
              {plan.name === "Plus" && (
                <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#34A853] text-white px-3 py-1 text-xs font-semibold rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">{plan.name}</h3>
              <p className="text-sm text-gray-500 mb-4 text-center">{plan.description}</p>
              <div className="text-center mb-4">
                {/* Show old price crossed out if provided */}
                {plan.oldPrice && (
                  <span className="text-lg line-through text-gray-400 mr-2">
                    ${plan.oldPrice}
                  </span>
                )}
                <span className="text-4xl font-extrabold text-gray-800">
                  ${plan.price}
                </span>
                <span className="text-base text-gray-500">/ month</span>
              </div>
              {/* Spring discount label */}
              <p className="text-center text-[13px] font-semibold text-green-600 mb-4">Spring Discount</p>
              <ul className="mb-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={PAYMENT_LINKS[plan.id]}
                className="block w-full text-center px-4 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition"
              >
                Select Plan
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}