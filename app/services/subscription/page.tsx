"use client";

import Link from "next/link";
import PlanComparisonSection from "../../components/sections/PlanComparisonSection";
import ValuePropsSection from "../../components/sections/ValuePropsSection";

/**
 * Subscription Service Page
 *
 * This page explains the benefits of joining the Profixter subscription
 * handyman service.  It highlights key features, encourages visitors to
 * join, and includes the full plan comparison table and value proposition
 * section to help visitors choose the right membership.  The design is
 * responsive and mobile‑friendly.
 */
export default function SubscriptionServicePage() {
  return (
    <div className="min-h-screen">
      {/* Hero section */}
      <section className="bg-[#0B1220] text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
          Subscription Handyman Service
        </h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto mb-6">
          Unlimited visits, priority scheduling and peace of mind for your home.  Enjoy predictable pricing and
          dedicated professionals who know your space.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold text-base sm:text-lg hover:opacity-90 transition"
          >
            Join Now
          </Link>
          <Link
            href="/plans"
            className="inline-block px-6 py-3 rounded-xl bg-white/10 text-white/90 border border-white/20 font-bold text-base sm:text-lg hover:bg-white/20 transition"
          >
            View Plans
          </Link>
        </div>
      </section>

      {/* Benefits list */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-6 text-center">What You Get</h2>
          <ul className="space-y-4 text-gray-700 text-base sm:text-lg">
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Unlimited handyman visits each month</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Discounted hourly rate for longer jobs ($99/hr)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Access to emergency and after‑hours support</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Dedicated handyman familiar with your home</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Cancel or change your plan anytime</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Include the plan comparison table to help visitors pick a tier */}
      <PlanComparisonSection />
      {/* And reinforce the overall value proposition */}
      <ValuePropsSection />
    </div>
  );
}