"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { PAYMENT_LINKS, type PlanType } from "@/lib/stripe-links";

type PlanCard = {
  id: PlanType;
  name: string;
  oldPrice: number;
  price: number;
  description: string;
  badge?: string;
  features: string[];
};

const TARAS_PHONE_DISPLAY = "631-599-1363";
const TARAS_PHONE_LINK = "tel:6315991363";
const TARAS_SMS_LINK = "sms:6315991363";

function prettyPlanName(plan: PlanType | null): string {
  if (plan === "basic") return "Basic";
  if (plan === "plus") return "Plus";
  if (plan === "premium") return "Premium";
  if (plan === "elite") return "Elite";
  return "";
}

function getPlanRank(plan: PlanType | null): number {
  if (plan === "basic") return 1;
  if (plan === "plus") return 2;
  if (plan === "premium") return 3;
  if (plan === "elite") return 4;
  return 0;
}

function normalizePlanType(name: string): PlanType | null {
  const x = String(name || "").toLowerCase().trim();
  if (x === "basic") return "basic";
  if (x === "plus") return "plus";
  if (x === "premium") return "premium";
  if (x === "elite") return "elite";
  return null;
}

export default function PlanComparisonSection() {
  const { user, isAuthenticated } = useAuth();
  const [upgradePopupOpen, setUpgradePopupOpen] = useState(false);
  const [upgradeTargetPlan, setUpgradeTargetPlan] = useState<PlanType | null>(null);

  const plans: PlanCard[] = [
    {
      id: "basic",
      name: "Basic",
      oldPrice: 199,
      price: 149,
      description: "Perfect for occasional help and everyday home tasks",
      features: [
        "2 visits per month (up to 90 minutes each)",
        "Great for repairs, installs, assembly, and small jobs",
        "$99/hour rate for additional time if needed",
      ],
    },
    {
      id: "plus",
      name: "Plus",
      oldPrice: 299,
      price: 249,
      badge: "Most Popular",
      description: "Best for busy homes that need more flexibility",
      features: [
        "Multiple bookings at the same time",
        "Secondary materials and store pickup included",
        "$99/hour rate for additional time if needed",
      ],
    },
    {
      id: "premium",
      name: "Premium",
      oldPrice: 399,
      price: 349,
      description: "For families who want priority and maximum support",
      features: [
        "Emergency service at no extra cost & after-hours support",
        "Two handymen available for more complex work",
        "$99/hour rate for additional time if needed",
      ],
    },
  ];

  const currentUserPlan = normalizePlanType((user as any)?.subscription || "");

  const openUpgradePopup = (plan: PlanType) => {
    setUpgradeTargetPlan(plan);
    setUpgradePopupOpen(true);
  };

  const getActionForPlan = (planId: PlanType) => {
    if (!isAuthenticated) {
      return {
        kind: "signup" as const,
        label: "Start Now",
        disabled: false,
      };
    }

    if (!currentUserPlan) {
      return {
        kind: "continue" as const,
        label: "Continue",
        disabled: false,
      };
    }

    const currentRank = getPlanRank(currentUserPlan);
    const targetRank = getPlanRank(planId);

    if (targetRank === currentRank) {
      return {
        kind: "active" as const,
        label: "Active",
        disabled: true,
      };
    }

    if (targetRank > currentRank) {
      return {
        kind: "upgrade" as const,
        label: `Upgrade to ${prettyPlanName(planId)}`,
        disabled: false,
      };
    }

    return {
      kind: "lower" as const,
      label: "Active Higher Plan",
      disabled: true,
    };
  };

  return (
    <>
      <section
        className="py-14 sm:py-16 md:py-20 bg-[#313234] px-4 sm:px-6 md:px-8"
        id="plans"
      >
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 sm:mb-10">
            <div className="mx-auto max-w-4xl rounded-2xl border border-[#86EFAC]/30 bg-[#86EFAC]/10 px-4 py-3 sm:px-6 sm:py-4 shadow-[0_10px_40px_rgba(0,0,0,0.18)]">
              <p className="text-center text-sm sm:text-base font-bold text-white">
                Use code <span className="text-[#86EFAC]">SPRING</span> for 30% off your first month
              </p>
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-center text-white mb-4 leading-tight">
            Stop Paying for Every Repair
          </h2>

          <p className="text-center text-[#D1D5DB] mb-10 sm:mb-12 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
            Choose the membership that fits your home and get reliable handyman help
            without the stress of hiring someone new every time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => {
              const href = isAuthenticated
                ? PAYMENT_LINKS[plan.id]
                : `/signup?plan=${plan.id}`;

              const action = getActionForPlan(plan.id);

              return (
                <div
                  key={plan.id}
                  id={plan.id}
                  className={`relative rounded-3xl border p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 ${
                    plan.name === "Plus"
                      ? "bg-[#EEF2FF] border-[#306EEC] md:scale-[1.02]"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center rounded-full bg-[#306EEC] px-4 py-1.5 text-xs font-extrabold text-white shadow-lg">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-5">
                    <h3 className="text-2xl font-extrabold text-[#111827] mb-2">
                      {plan.name}
                    </h3>

                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed min-h-[48px]">
                      {plan.description}
                    </p>
                  </div>

                  <div className="text-center mb-5">
                    <div className="flex items-end justify-center gap-2">
                      <span className="text-lg line-through text-gray-400">
                        ${plan.oldPrice}
                      </span>
                      <span className="text-5xl font-extrabold text-[#111827] leading-none">
                        ${plan.price}
                      </span>
                      <span className="text-base text-gray-500 pb-1">/month</span>
                    </div>

                    <p className="mt-2 text-[13px] sm:text-sm font-bold text-green-600">
                      30% OFF first month with code SPRING
                    </p>
                  </div>

                  <ul className="mb-7 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-600 text-green-600 text-sm font-bold shrink-0">
                          ✓
                        </span>
                        <span className="text-sm sm:text-[15px] text-gray-700 font-medium leading-relaxed">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {action.kind === "active" || action.kind === "lower" ? (
                      <div
                        className={`block w-full text-center px-4 py-3.5 rounded-2xl font-extrabold text-sm sm:text-base ${
                          action.kind === "active"
                            ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {action.label}
                      </div>
                    ) : action.kind === "upgrade" ? (
                      <button
                        type="button"
                        onClick={() => openUpgradePopup(plan.id)}
                        className="block w-full text-center px-4 py-3.5 rounded-2xl bg-[#111827] text-white font-extrabold text-sm sm:text-base hover:bg-black transition"
                      >
                        {action.label}
                      </button>
                    ) : (
                      <Link
                        href={href}
                        className="block w-full text-center px-4 py-3.5 rounded-2xl bg-[#86EFAC] text-[#0B1220] font-extrabold text-sm sm:text-base hover:opacity-90 transition"
                      >
                        {action.label}
                      </Link>
                    )}

                    <p className="text-center text-xs text-gray-500 mt-3 leading-relaxed">
                      Cancel anytime • Clear pricing • Reliable local help
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {upgradePopupOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 sm:p-7 shadow-[0_20px_100px_rgba(0,0,0,0.35)]">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-[#EEF2FF] flex items-center justify-center text-2xl mb-4">
                📞
              </div>

              <h3 className="text-2xl font-extrabold text-[#313234]">
                Upgrade to {prettyPlanName(upgradeTargetPlan)}
              </h3>

              <p className="mt-3 text-[#6A6D71] leading-relaxed">
                To upgrade your current plan, please call or text Taras directly.
              </p>

              <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <p className="text-sm text-[#6A6D71]">Taras</p>
                <p className="text-2xl font-extrabold text-[#313234]">
                  {TARAS_PHONE_DISPLAY}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={TARAS_PHONE_LINK}
                  className="h-[52px] rounded-[16px] bg-[#306EEC] hover:bg-[#2558c9] text-white font-extrabold inline-flex items-center justify-center transition"
                >
                  Call Taras
                </a>
                <a
                  href={TARAS_SMS_LINK}
                  className="h-[52px] rounded-[16px] bg-[#111827] hover:bg-black text-white font-extrabold inline-flex items-center justify-center transition"
                >
                  Text Taras
                </a>
              </div>

              <button
                type="button"
                onClick={() => setUpgradePopupOpen(false)}
                className="mt-4 h-[48px] px-5 rounded-[14px] border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[#313234] font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}