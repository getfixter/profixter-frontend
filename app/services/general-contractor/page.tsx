"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * General Contractor Service Page
 *
 * This page outlines Profixter's capabilities for large‑scale renovations and
 * custom building projects.  Visitors can request a free consultation via a
 * simple form.  For smaller tasks, they are gently directed back to the
 * subscription plans.
 */
export default function GeneralContractorServicePage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application you would send this data to your backend
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-[#0B1220] text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
          General Contractor Services
        </h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto mb-6">
          From kitchen remodels to home additions, our licensed team manages your renovation from start to finish with precision and care.
        </p>
      </section>

      {/* Capabilities */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-6 text-center">
            Our Capabilities
          </h2>
          <ul className="space-y-4 text-gray-700 text-base sm:text-lg mb-8">
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Full kitchen and bathroom remodels</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Home additions and structural extensions</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Basement finishing and build‑outs</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Custom carpentry and millwork</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Project design, permitting and management</span>
            </li>
          </ul>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-4 text-center">
            Request a Free Consultation
          </h2>
          {submitted ? (
            <div className="p-6 bg-[#E6F8EC] text-[#22543D] rounded-lg text-center">
              Thank you!  We'll reach out soon to discuss your project.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              <input
                type="text"
                required
                placeholder="Your name"
                className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
              />
              <input
                type="tel"
                required
                placeholder="Phone number"
                className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
              />
              <input
                type="email"
                required
                placeholder="Email address"
                className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none sm:col-span-2"
              />
              <textarea
                required
                placeholder="Describe your project"
                className="px-4 py-3 rounded-lg border border-gray-300 w-full h-32 focus:ring-2 focus:ring-[#86EFAC] focus:outline-none sm:col-span-2"
              />
              <button
                type="submit"
                className="sm:col-span-2 px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition w-full"
              >
                Submit Request
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-gray-600">
            For smaller tasks or regular maintenance, explore our{' '}
            <Link href="/plans" className="text-[#34A853] font-semibold hover:underline">
              subscription plans
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}