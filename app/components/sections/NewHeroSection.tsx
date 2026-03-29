"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

/**
 * NewHeroSection
 */
export default function NewHeroSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="w-full bg-gradient-to-b from-[#0B1220] via-[#0B1220] to-transparent text-white pt-24 pb-16 px-4 sm:px-6 md:px-8 flex flex-col items-center animate-fadeIn">
      <div className="max-w-4xl text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4">
          Your Personal Home-Maintenance Team
        </h1>

        <p className="text-lg sm:text-2xl text-white/80 mb-8 max-w-3xl mx-auto">
          Unlimited handyman visits for one low monthly fee or book a professional on-demand.
          Serving Long Island homes with premium care and transparent pricing.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* ✅ MAIN BUTTON */}
          <Link
            href="/services/subscription"
            className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold text-base sm:text-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#86EFAC]"
          >
            See Subscription
          </Link>

          {/* ✅ CONDITIONAL BUTTON */}
          <Link
            href={
              isAuthenticated
                ? "/services/general-contractor"
                : "/signup"
            }
            className="inline-block px-6 py-3 rounded-xl bg-white/10 text-white/90 border border-white/20 font-bold text-base sm:text-lg hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
          >
            {isAuthenticated ? "General Contractor" : "Join Now"}
          </Link>
        </div>
      </div>
    </section>
  );
}