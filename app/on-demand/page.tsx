"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * OnDemandPage
 *
 * A landing page for visitors who want a single handyman visit without
 * subscribing.  It explains pricing clearly and includes a simple booking
 * request form.  Users are also encouraged to consider subscription for
 * savings.
 */
export default function OnDemandPage() {
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with booking backend
    setSubmitted(true);
  };
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-[#0B1220] text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold mb-4">Book a One‑Time Service</h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-6">
          Need something fixed ASAP?  Hire a professional handyman by the hour or day.  Transparent pricing and no commitment.
        </p>
      </section>
      <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-6">Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="p-6 rounded-2xl border border-gray-200 bg-[#F9FAFB]">
              <h3 className="text-xl font-bold mb-2">Hourly Rate</h3>
              <p className="text-gray-500 mb-4">Perfect for small repairs and quick jobs</p>
              <p className="text-4xl font-extrabold text-gray-800 mb-2">$150<span className="text-lg font-semibold">/hr</span></p>
              <p className="text-sm text-gray-500">Materials extra.  Members pay $100/hr.</p>
            </div>
            <div className="p-6 rounded-2xl border border-gray-200 bg-[#F9FAFB]">
              <h3 className="text-xl font-bold mb-2">Full Day Rate</h3>
              <p className="text-gray-500 mb-4">For bigger jobs that need a full day</p>
              <p className="text-4xl font-extrabold text-gray-800 mb-2">$500<span className="text-lg font-semibold">/day</span></p>
              <p className="text-sm text-gray-500">Up to 8 hours.  Includes travel time.  Members receive priority scheduling.</p>
            </div>
          </div>
          <p className="text-gray-600 mb-10 text-center">
            Want regular maintenance or multiple visits?  <Link href="/plans" className="text-[#34A853] font-semibold hover:underline">Check out our subscription plans</Link> and save.
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-4">Request a Booking</h2>
          {submitted ? (
            <div className="p-6 bg-[#E6F8EC] text-[#22543D] rounded-lg">
              Thank you!  Your request has been sent.  We'll contact you shortly to confirm your appointment.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
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
              </div>
              <input
                type="email"
                required
                placeholder="Email address"
                className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
              />
              <input
                type="date"
                required
                className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
              />
              <textarea
                placeholder="Describe the work you need done"
                required
                className="px-4 py-3 rounded-lg border border-gray-300 w-full h-32 focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold text-base hover:opacity-90 transition"
              >
                Submit Request
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}