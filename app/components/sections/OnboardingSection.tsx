"use client";

import Link from "next/link";

const STEPS = [
  {
    n: "1",
    title: "Sign up in under 2 minutes",
    body: "Choose your plan, enter your address, and you're a member. No consultation required to start.",
  },
  {
    n: "2",
    title: "Book your first 90-minute visit online",
    body: "Log in, pick from available time slots, and tell us what to tackle. It takes about 60 seconds.",
  },
  {
    n: "3",
    title: "We confirm your time",
    body: "You get a confirmation with your handyman's name and arrival window. No waiting for callbacks.",
  },
  {
    n: "4",
    title: "Your handyman shows up and gets to work",
    body: "Same team, on time. They know what you booked and arrive ready. You don't need to explain anything twice.",
  },
] as const;

const FIRST_VISIT_IDEAS = [
  "Fix a sticking door or sticky cabinet",
  "Patch drywall or touch up paint",
  "Install a light fixture or ceiling fan",
  "Re-caulk bathroom or kitchen",
  "Mount a TV or hang artwork",
  "Tighten a leaking faucet or fixture",
];

export default function OnboardingSection() {
  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28 bg-white"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-start">

          {/* LEFT — What happens after you start */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EEF2FF] px-4 py-1.5 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                After You Sign Up
              </span>
            </div>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold text-[#0B1628] leading-[1.1] tracking-[-0.025em] mb-2">
              What happens after you start?
            </h2>
            <p className="text-[15px] text-[#475569] mb-8 leading-relaxed">
              Four simple steps — from sign-up to your first visit handled.
            </p>

            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <div key={step.n} className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#306EEC] text-white flex items-center justify-center text-[15px] font-extrabold shadow-[0_4px_16px_rgba(48,110,236,0.30)]">
                      {step.n}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-6 bg-[#D9E4FF]" />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <h3 className="text-[15px] font-extrabold text-[#0B1628] mb-1">{step.title}</h3>
                    <p className="text-[14px] text-[#64748B] leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* No-risk reassurance */}
            <div className="mt-8 rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4">
              <p className="text-[14px] font-semibold text-[#166534] leading-relaxed">
                You&rsquo;re not locked in. Try it for a month and see if it fits your home.
              </p>
              <p className="text-[13px] text-[#4ADE80]/80 mt-1">
                Month-to-month · Cancel anytime · No penalties
              </p>
            </div>

            <Link
              href="/signup"
              className="mt-6 inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#306EEC] px-8 text-[15px] font-extrabold text-white shadow-[0_12px_32px_rgba(48,110,236,0.28)] transition hover:-translate-y-0.5 hover:bg-[#2558c9]"
            >
              Start My Membership
            </Link>
          </div>

          {/* RIGHT — What most homeowners book first */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EEF2FF] px-4 py-1.5 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                First Visit Ideas
              </span>
            </div>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold text-[#0B1628] leading-[1.1] tracking-[-0.025em] mb-2">
              What most homeowners book first
            </h2>
            <p className="text-[15px] text-[#475569] mb-8 leading-relaxed">
              Not sure what to start with? Here&rsquo;s what members typically tackle in their first visit.
            </p>

            <ul className="space-y-3 mb-8">
              {FIRST_VISIT_IDEAS.map((idea) => (
                <li key={idea} className="flex items-center gap-3 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFF] px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-[#306EEC]/10 border border-[#306EEC]/20 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[14px] font-semibold text-[#1E293B]">{idea}</span>
                </li>
              ))}
            </ul>

            {/* Social nudge */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFF] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" stroke="#306EEC" strokeWidth="1.8" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[13px] text-[#475569] leading-relaxed">
                  Most members walk away from their first visit with <span className="font-semibold text-[#0B1628]">3–5 tasks completed</span> and a short list queued for next month. The system starts working immediately.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
