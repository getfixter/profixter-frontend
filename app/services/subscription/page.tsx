"use client";

import Link from "next/link";
import PlansSection from "../../components/sections/PlansSection";
import ValuePropsSection from "../../components/sections/ValuePropsSection";
import DepartmentsSection from "../../components/sections/DepartmentsSection";

/**
 * Subscription Service Page
 *
 * Keeps the original page accurate and simple, but upgrades the design to feel
 * more premium, modern, and mobile-friendly. The structure is:
 * 1) Strong hero
 * 2) Benefit cards
 * 3) Simple "how it works"
 * 4) Plan comparison
 * 5) Value props
 * 6) Services section
 */
export default function SubscriptionServicePage() {
  const benefits = [
    {
      title: "Clear monthly visit counts",
      text: "Basic includes 2 visits per month, Plus includes 4 visits per month, and every visit is up to 90 minutes.",
      icon: "🔁",
    },
    {
      title: "Lower hourly rate",
      text: "For longer jobs, members get discounted additional labor at $99/hour.",
      icon: "💰",
    },
    {
      title: "Premium support options",
      text: "Premium adds 1 emergency visit and 1 visit with 2 pros when you need stronger coverage.",
      icon: "⚡",
    },
    {
      title: "Dedicated handyman",
      text: "Work with professionals who get familiar with your home and your preferences.",
      icon: "🛠️",
    },
    {
      title: "Elite flexibility",
      text: "Elite gives you unlimited visits by calendar schedule for homes that need ongoing attention.",
      icon: "📦",
    },
    {
      title: "Peace of mind",
      text: "Stop worrying about who to call every time something breaks or needs attention.",
      icon: "🏡",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Choose your plan",
      text: "Pick the membership tier that fits your home, schedule, and level of support.",
    },
    {
      number: "02",
      title: "Book your visits",
      text: "Schedule your included 90-minute visits in the calendar and keep your home in shape year-round.",
    },
    {
      number: "03",
      title: "Enjoy ongoing support",
      text: "Use your membership for repairs, upkeep, and peace of mind without starting from zero every time.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0B1220] text-white">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-[-180px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#306EEC]/20 blur-3xl" />
          <div className="absolute right-[-120px] top-[120px] h-[260px] w-[260px] rounded-full bg-[#86EFAC]/10 blur-3xl" />
          <div className="absolute left-[-120px] bottom-[-40px] h-[220px] w-[220px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 md:px-8 pt-24 pb-16 sm:pt-28 sm:pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[12px] sm:text-sm font-semibold text-white/85">
              Best for homeowners who want ongoing help
            </div>

            <h1 className="mt-5 text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-[-0.03em]">
              Subscription Handyman Service
            </h1>

            <p className="mt-5 text-base sm:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
              Choose a plan based on how many 90-minute visits you want each month.
              Keep it simple: 2 visits, 4 visits, premium support, or unlimited scheduled visits.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-[#86EFAC] text-[#0B1220] font-bold text-base sm:text-lg hover:opacity-90 transition shadow-[0_12px_30px_rgba(134,239,172,0.25)]"
              >
                Join Now
              </Link>

              <a
                href="#plans"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-white/20 bg-white/10 text-white font-bold text-base sm:text-lg hover:bg-white/15 transition"
              >
                View Plans
              </a>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-white font-bold">2 or 4 visits per month</div>
                <div className="mt-1 text-sm text-white/70">
                  Straightforward plans that make it obvious what you get.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-white font-bold">$99/hr extra labor</div>
                <div className="mt-1 text-sm text-white/70">
                  Lower member pricing for longer jobs when extra time is needed.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-white font-bold">90-minute visits</div>
                <div className="mt-1 text-sm text-white/70">
                  Every included visit is up to 90 minutes of handyman labor.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 md:px-8 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F172A]">
              What You Get
            </h2>
            <p className="mt-3 text-[#475569] text-base sm:text-lg">
              Everything important from your original version — now presented in a cleaner,
              stronger way that feels more premium.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {benefits.map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-[#E2E8F0] bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#EEF2FF] text-2xl">
                  {item.icon}
                </div>

                <h3 className="mt-4 text-lg sm:text-xl font-bold text-[#0F172A]">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#475569]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-[28px] border border-[#E2E8F0] bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] p-6 sm:p-8 lg:p-10">
            <div className="max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                How Subscription Works
              </h2>
              <p className="mt-3 text-[#475569] text-base sm:text-lg">
                Simple, predictable, and designed for homeowners who want reliable support.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-[22px] bg-white border border-[#DCE3F1] p-6 shadow-sm"
                >
                  <div className="text-[42px] sm:text-[52px] font-extrabold leading-none text-[#306EEC]/25">
                    {step.number}
                  </div>

                  <h3 className="mt-3 text-lg sm:text-xl font-bold text-[#0F172A]">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-sm sm:text-base text-[#475569] leading-relaxed">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-[#306EEC] text-white font-bold hover:bg-[#2558c9] transition"
              >
                Start Your Membership
              </Link>

              <a
                href="#plans"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-[#C7D2FE] bg-white text-[#0F172A] font-bold hover:bg-[#F8FAFF] transition"
              >
                Compare Plans
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PLAN COMPARISON */}
      <PlansSection />

      {/* VALUE PROPS */}
      <ValuePropsSection />

      {/* SERVICES */}
      <DepartmentsSection />
    </div>
  );
}
