"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";

type PlanKey = "basic" | "plus" | "premium" | "elite" | "none";

export function PlanSection() {
  const [plan, setPlan] = useState<PlanKey>("none");
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const PLAN_PRICES: Record<Exclude<PlanKey, "none">, number> = {
    basic: 149,
    plus: 249,
    premium: 349,
    elite: 499,
  };

  const PLAN_INCLUDES: Record<Exclude<PlanKey, "none">, string[]> = {
    basic: [
      "Book online in minutes",
      "Visit length: up to 90 minutes",
      "Professional handyman service",
      "Materials/fixtures are extra if needed",
      "Friendly support (call/text/email)",
    ],
    plus: [
      "Everything in Basic",
      "Priority scheduling when available",
      "Perfect for regular home maintenance",
      "Up to 90 minutes per visit",
      "Best value for most homes",
    ],
    premium: [
      "Everything in Plus",
      "Higher booking availability (based on capacity)",
      "Ideal for busy households & rentals",
      "Up to 90 minutes per visit",
      "Priority handling for repeat members",
    ],
    elite: [
      "Everything in Premium",
      "Top priority scheduling when available",
      "Best for ongoing projects & heavy usage",
      "Up to 90 minutes per visit",
      "VIP support experience",
    ],
  };

  const WHY_FIXTER: string[] = [
    "$0 labor — you only pay for materials if needed",
    "No contractor chasing — book online any time",
    "Real local Long Island handyman (Suffolk & Nassau)",
    "Transparent pricing + professional service",
    "Most issues handled in one 90-minute visit",
  ];

  const detectedPrice = useMemo(() => {
    if (plan === "none") return 0;
    return PLAN_PRICES[plan];
  }, [plan]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setPlan("none");
      setLoading(false);
      return;
    }

    setLoading(true);

    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const user = res.data; // ✅ flat

        let detectedPlan: string = user.subscription?.toLowerCase() || "";

        if (Array.isArray(user.addresses)) {
          const active = user.addresses.find((a: any) => a?.hasActiveSubscription);
          if (active?.plan) detectedPlan = String(active.plan).toLowerCase();
        }

        const normalized = (["basic", "plus", "premium", "elite"] as const).includes(
          detectedPlan as any
        )
          ? (detectedPlan as PlanKey)
          : "none";

        setPlan(normalized);
        setLoading(false);
      })
      .catch(() => {
        setPlan("none");
        setLoading(false);
      });
  }, []);

  const Card = ({
    children,
    className = "",
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`w-full bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6 ${className}`}
      style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.10)" }}
    >
      {children}
    </div>
  );

  return (
    <>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-6 sm:mb-10">
          My plan
        </h2>

        {loading ? (
          <Card className="max-w-[560px]">
            <div className="text-[#6A6D71] text-sm sm:text-base">Loading your plan…</div>
          </Card>
        ) : plan === "none" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="max-w-[560px]">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-sm text-[#6A6D71] mb-1">No active subscription</div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">
                    Recommended: <span className="text-[#306EEC]">Plus</span>
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-[#313234]">$249</span>
                    <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
                  </div>
                </div>

                <div className="shrink-0 px-3 py-2 rounded-full bg-white/70 border border-[#C5CBD8]">
                  <span className="text-xs font-semibold text-[#313234]">Best value</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-[#313234] mb-2">
                  What you get with Plus
                </div>
                <ul className="space-y-2 text-sm text-[#6A6D71]">
                  {PLAN_INCLUDES.plus.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-[#306EEC] font-bold">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/#plans"
                className="mt-6 block text-center w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors"
              >
                Start Plus Plan
              </Link>

              <div className="mt-3 text-xs text-[#6A6D71] opacity-80">
                Cancel anytime • Visit length up to 90 minutes
              </div>
            </Card>

            <Card className="max-w-[560px]">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234] mb-3">
                Why Mr. Fixter works
              </h3>

              <ul className="space-y-2 text-sm text-[#6A6D71]">
                {WHY_FIXTER.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-[#306EEC] font-bold">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-[14px] border border-[#C5CBD8] bg-white/60 p-4">
                <div className="text-sm font-semibold text-[#313234] mb-1">Need help choosing?</div>
                <div className="text-sm text-[#6A6D71]">
                  Call us:{" "}
                  <a href="tel:631-599-1363" className="text-[#306EEC] font-semibold">
                    631-599-1363
                  </a>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="max-w-[560px]">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-semibold text-[#313234] capitalize">
                  {plan} plan
                </h3>

                <div className="flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl font-semibold text-[#313234]">
                    ${detectedPrice}
                  </span>
                  <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
                </div>
              </div>

              <div className="text-sm font-semibold text-[#313234] mb-2">
                Included with your plan
              </div>
              <ul className="space-y-2 text-sm text-[#6A6D71]">
                {PLAN_INCLUDES[plan].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-[#306EEC] font-bold">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/#plans"
                  className="block text-center w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-lg font-semibold hover:bg-[#2557C7] transition-colors"
                >
                  Upgrade Plan
                </Link>

                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full py-3 sm:py-4 rounded-[14px] border border-[#C5CBD8] bg-white/60 text-[#313234] font-semibold hover:bg-white transition"
                  type="button"
                >
                  Cancel plan
                </button>
              </div>

              <div className="mt-3 text-xs text-[#6A6D71] opacity-80">
                Tip: have materials/fixtures ready (faucets, lights, shelves, hardware).
              </div>
            </Card>

            <Card className="max-w-[560px]">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234] mb-3">
                Next steps
              </h3>

              <ul className="space-y-2 text-sm text-[#6A6D71]">
                <li className="flex gap-2">
                  <span className="text-[#306EEC] font-bold">•</span>
                  <span>Book your next visit on the home page.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#306EEC] font-bold">•</span>
                  <span>Take clear photos so we can prepare before arrival.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#306EEC] font-bold">•</span>
                  <span>Emergency? Call us anytime: 631-599-1363</span>
                </li>
              </ul>

              <div className="mt-6 rounded-[14px] border border-[#C5CBD8] bg-white/60 p-4">
                <div className="text-sm font-semibold text-[#313234] mb-1">Serving Long Island</div>
                <div className="text-sm text-[#6A6D71]">Suffolk & Nassau • Real local handyman</div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-white rounded-[14px] p-6 w-[90%] max-w-[380px] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-[#313234] mb-4">
              Cancel your plan
            </h3>

            <p className="text-[#6A6D71] text-base mb-6">
              To cancel your subscription, please call:
              <br />
              <a
                href="tel:631-599-1363"
                className="text-[#306EEC] font-semibold text-lg"
              >
                631-599-1363
              </a>
            </p>

            <button
              onClick={() => setShowCancelModal(false)}
              className="w-full py-3 bg-[#306EEC] text-white rounded-[14px] font-semibold text-base hover:bg-[#2557C7]"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
