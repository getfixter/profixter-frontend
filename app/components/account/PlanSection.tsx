"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";

export function PlanSection() {
  const [plan, setPlan] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [showModal, setShowModal] = useState(false);

  const PLAN_PRICES: Record<string, number> = {
    basic: 149,
    plus: 249,
    premium: 349,
    elite: 499,
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const user = res.data;

        let detectedPlan = user.subscription?.toLowerCase() || "";

        // if addresses contain active sub → use that
        if (Array.isArray(user.addresses)) {
          const active = user.addresses.find((a: any) => a.hasActiveSubscription);
          if (active?.plan) detectedPlan = active.plan.toLowerCase();
        }

        setPlan(detectedPlan || "no plan");
        setPrice(PLAN_PRICES[detectedPlan] || 0);
      })
      .catch(() => {
        setPlan("no plan");
      });
  }, []);

  return (
    <>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">
          My plan
        </h2>

        {/* PLAN CARD */}
        <div
          className="w-full max-w-[400px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6 relative"
          style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.1)" }}
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-medium text-[#313234] capitalize">
              {plan}
            </h3>

            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-medium text-[#313234]">
                ${price}
              </span>
              <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
            </div>
          </div>

          <Link
            href="/#plans"
            className="block text-center w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors"
          >
            Upgrade Plan
          </Link>

          {/* Cancel subscription (tiny link) */}
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-xs text-[#6A6D71] hover:underline opacity-70 hover:opacity-100 transition"
          >
            Cancel subscription
          </button>
        </div>
      </div>

      {/* POPUP MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-[14px] p-6 w-[90%] max-w-[380px] text-center">
            <h3 className="text-xl font-semibold text-[#313234] mb-4">
              Cancel your plan
            </h3>

            <p className="text-[#6A6D71] text-base mb-6">
              To cancel your subscription, please call:<br />
              <span className="text-[#306EEC] font-semibold text-lg">
                631-599-1363
              </span>
            </p>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-3 bg-[#306EEC] text-white rounded-[14px] font-semibold text-base hover:bg-[#2557C7]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
