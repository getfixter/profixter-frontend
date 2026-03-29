"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Home Improvement Service Page
 *
 * This page showcases Profixter's capabilities for mid‑sized projects like
 * painting, flooring and cabinetry.  It includes a simple form for
 * requesting a quote and directs visitors to subscription plans for
 * ongoing maintenance.
 */
export default function HomeImprovementServicePage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-[#0B1220] text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">
          Home Improvement Services
        </h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-3xl mx-auto mb-6">
          From painting and flooring to cabinet refacing and lighting upgrades, our skilled craftsmen
          handle the projects that make your house a home.
        </p>
      </section>

      {/* Services list */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-6 text-center">
            What We Do
          </h2>
          <ul className="space-y-4 text-gray-700 text-base sm:text-lg mb-8">
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Interior and exterior painting & drywall repair</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Flooring installation: hardwood, laminate, tile and more</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Cabinet refacing and custom built‑ins</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Light fixture installation and upgrades</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600">✓</span>
              <span>Minor plumbing and electrical work</span>
            </li>
          </ul>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-4 text-center">
            Request a Free Quote
          </h2>
          {submitted ? (
            <div className="p-6 bg-[#E6F8EC] text-[#22543D] rounded-lg text-center">
              Thank you!  We'll contact you shortly to discuss your project.
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
                placeholder="Tell us about your project"
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
            Looking for regular maintenance?  Explore our{' '}
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