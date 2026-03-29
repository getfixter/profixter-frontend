"use client";

import Link from "next/link";

export default function GeneralContractorServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0B1220] text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-sm font-semibold mb-5">
            General Contractor Department
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
            General Contractor Services
          </h1>

          <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto mb-8">
            For larger renovations, structural changes, and serious home projects,
            our team can help plan, manage, and complete the work the right way.
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
              See Subscription
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-8 text-center">
            Bigger Projects We Handle
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
            {[
              "Kitchen and bathroom remodels",
              "Home additions and structural changes",
              "Basement finishing and build-outs",
              "Framing, carpentry and custom millwork",
              "Permits, planning and project coordination",
              "Large-scale repairs and renovations",
              "Interior layout and improvement projects",
              "Long-term home upgrade planning",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-gray-200 bg-[#F9FAFB] px-5 py-4 flex items-start gap-3"
              >
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <span className="text-gray-700 text-base">{item}</span>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-[#86EFAC]/40 bg-gradient-to-br from-[#F4FFF7] to-white p-6 sm:p-10 text-center shadow-sm">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">
              Planning a serious home project?
            </h3>

            <p className="text-gray-600 max-w-2xl mx-auto mb-6">
              Start with Profixter and we’ll guide you to the right next step.
              For smaller ongoing work, our subscription service is often the best value.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition"
              >
                Start Now
              </Link>

              <Link
                href="/services/subscription"
                className="inline-block px-6 py-3 rounded-xl border border-gray-300 text-gray-800 font-bold hover:bg-gray-50 transition"
              >
                Need Ongoing Help?
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}