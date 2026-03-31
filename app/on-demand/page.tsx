"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "";

export default function OnDemandPage() {
  const { user } = useAuth();

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
      }));
    }
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/requests/public`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          serviceType: "on_demand",
          sourcePage: "/services/on-demand",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to send request");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              href="/services/subscription"
              className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold text-base sm:text-lg hover:opacity-90 transition"
            >
              Save With Subscription
            </Link>

            <Link
              href="/signup"
              className="inline-block px-6 py-3 rounded-xl bg-white/10 text-white border border-white/20 font-bold text-base sm:text-lg hover:bg-white/20 transition"
            >
              Create Account
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

          <div className="rounded-3xl border border-[#86EFAC]/40 bg-gradient-to-br from-[#F4FFF7] to-white p-6 sm:p-10 shadow-sm">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3 text-center">
              Request This Service
            </h3>

            <p className="text-gray-600 max-w-2xl mx-auto mb-6 text-center">
              Fill this out and we’ll contact you about your one-time service request.
            </p>

            {submitted ? (
              <div className="max-w-2xl mx-auto rounded-2xl border border-[#86EFAC] bg-[#E6F8EC] p-6 text-center">
                <div className="text-xl font-extrabold text-[#143D28] mb-2">
                  Request received.
                </div>
                <p className="text-[#22543D] mb-5">
                  We’ll review it and contact you soon. But if you want better pricing,
                  easier future booking, and ongoing help, do not stop here.
                </p>

                <div className="text-lg font-bold text-[#143D28] mb-4">
                  Create your Mr. Fixter account now and get the smarter long-term option.
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/signup"
                    className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition"
                  >
                    Create Account Now
                  </Link>

                  <Link
                    href="/services/subscription"
                    className="inline-block px-6 py-3 rounded-xl border border-[#22543D]/20 text-[#143D28] font-bold hover:bg-white transition"
                  >
                    See Subscription Plans
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
                />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
                />
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                  className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
                />
                <textarea
                  name="message"
                  required
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us what you need"
                  rows={5}
                  className="px-4 py-3 rounded-lg border border-gray-300 w-full focus:ring-2 focus:ring-[#86EFAC] focus:outline-none"
                />

                {error ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold hover:opacity-90 transition disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}