"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { PAYMENT_LINKS, type PlanType } from "@/lib/stripe-links";

type PlanCard = {
  id: PlanType;
  name: string;
  oldPrice: number;
  price: number;
  description: string;
  features: string[];
};

export default function PlanComparisonSection() {
  const { user, isAuthenticated } = useAuth();

  // ✅ Detect active subscription
  const hasSubscription =
    isAuthenticated &&
    ((user?.subscription && user?.subscription !== "") ||
      user?.addresses?.some((a) => a.hasActiveSubscription));

  const plans: PlanCard[] = [
    {
      id: "basic",
      name: "Basic",
      oldPrice: 199,
      price: 149,
      description: "For occasional help and small tasks",
      features: [
        "2 visits per month (90 minutes each)",
        "Standard scheduling during business hours",
        "$99/hour rate for additional hours",
      ],
    },
    {
      id: "plus",
      name: "Plus",
      oldPrice: 299,
      price: 249,
      description: "For busy homes needing frequent help",
      features: [
        "Multiple bookings at the same time",
        "Secondary materials and pickup needs from store included",
        "$99/hour rate for additional hours",
      ],
    },
    {
      id: "premium",
      name: "Premium",
      oldPrice: 399,
      price: 349,
      description: "For families requiring 24/7 support",
      features: [
        "Emergency for no cost & after-hours support",
        "Two handymen for complex tasks",
        "$99/hour rate for additional hours",
      ],
    },
  ];

  return (
    <section className="py-12 sm:py-16 bg-white px-4 sm:px-6 md:px-8 animate-fadeIn" id="plans">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-8">
          Choose Your Plan
        </h2>

        <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto">
          Pick the membership that fits your household. Cancel anytime and upgrade or downgrade as needed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const href = isAuthenticated
              ? PAYMENT_LINKS[plan.id]
              : `/signup?plan=${plan.id}`;

            return (
              <div
                key={plan.id}
                id={plan.id}
                className="relative p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition bg-[#F9FAFB]"
              >
                {plan.name === "Plus" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#34A853] text-white px-3 py-1 text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">
                  {plan.name}
                </h3>

                <p className="text-sm text-gray-500 mb-4 text-center">
                  {plan.description}
                </p>

                <div className="text-center mb-4">
                  <span className="text-lg line-through text-gray-400 mr-2">
                    ${plan.oldPrice}
                  </span>
                  <span className="text-4xl font-extrabold text-gray-800">
                    ${plan.price}
                  </span>
                  <span className="text-base text-gray-500">/ month</span>
                </div>

                <p className="text-center text-[13px] font-semibold text-green-600 mb-4">
                  Spring Discount
                </p>

                <ul className="mb-6 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* ✅ BUTTON LOGIC */}
                {hasSubscription ? (
                  <div className="block w-full text-center px-4 py-3 rounded-xl bg-gray-200 text-gray-500 font-bold cursor-not-allowed">
                    Active
                  </div>
                ) : (
                  <Link
                    href={href}
                    className="block w-full text-center px-4 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition"
                  >
                    {isAuthenticated ? "Continue" : "Sign Up"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}