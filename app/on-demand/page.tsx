"use client";

import Link from "next/link";

export default function OnDemandPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0B1220] text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm font-semibold mb-5">
            One-Time Service
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
            Book a One-Time Service
          </h1>

          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Need help right now without a subscription? Book a handyman by the hour
            or by the day with simple transparent pricing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold text-base sm:text-lg hover:opacity-90 transition"
            >
              Get Started
            </Link>

            <Link
              href="/services/subscription"
              className="inline-block px-6 py-3 rounded-xl bg-white/10 text-white border border-white/20 font-bold text-base sm:text-lg hover:bg-white/20 transition"
            >
              Save With Subscription
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-8 text-center">
            Simple Pricing
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
            <div className="p-6 rounded-2xl border border-gray-200 bg-[#F9FAFB] text-center">
              <h3 className="text-xl font-bold mb-2 text-gray-900">Hourly Rate</h3>
              <p className="text-gray-500 mb-4">Perfect for small repairs and quick jobs</p>
              <p className="text-4xl font-extrabold text-gray-800 mb-2">
                $149<span className="text-lg font-semibold">/hr</span>
              </p>
              <p className="text-sm text-gray-500">
                Materials extra. Subscribers get a lower rate at $99/hr.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-gray-200 bg-[#F9FAFB] text-center">
              <h3 className="text-xl font-bold mb-2 text-gray-900">Full Day Rate</h3>
              <p className="text-gray-500 mb-4">For larger jobs that need more time</p>
              <p className="text-4xl font-extrabold text-gray-800 mb-2">
                $499<span className="text-lg font-semibold">/day</span>
              </p>
              <p className="text-sm text-gray-500">
                Up to 8 hours. Great for bigger punch lists and full-day work.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#86EFAC]/40 bg-gradient-to-br from-[#F4FFF7] to-white p-6 sm:p-10 text-center shadow-sm">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
              Want better long-term value?
            </h3>

            <p className="text-gray-600 max-w-2xl mx-auto mb-6">
              If you need help more than once, subscription is usually the smarter deal.
              You get ongoing support and lower hourly pricing.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/services/subscription"
                className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition"
              >
                See Subscription
              </Link>

              <Link
                href="/signup"
                className="inline-block px-6 py-3 rounded-xl border border-gray-300 text-gray-800 font-bold hover:bg-gray-50 transition"
              >
                Start Now
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}