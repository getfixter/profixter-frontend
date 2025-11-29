"use client";

import Link from "next/link";

interface PlanSectionProps {
  plan?: string;    // from DB
  price?: number;   // from DB
}

export function PlanSection({ plan = "Premium", price = 349 }: PlanSectionProps) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">
        My plan
      </h2>

      {/* PLAN CARD ONLY */}
      <div
        className="w-full max-w-[400px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6"
        style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.1)" }}
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-medium text-[#313234]">
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
      </div>
    </div>
  );
}
