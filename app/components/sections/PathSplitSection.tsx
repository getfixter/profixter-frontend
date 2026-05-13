"use client";

import Link from "next/link";

export default function PathSplitSection() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #080F1E 0%, #060C18 100%)" }}
    >
      {/* Top border glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.25), transparent)" }}
      />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">

        {/* ── Header ── */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 mb-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
              Long Island · Licensed HI-71484 · 9+ Years
            </span>
          </div>
          <h2 className="text-[30px] sm:text-[44px] lg:text-[54px] font-extrabold text-white leading-[1.08] tracking-[-0.035em] mb-4">
            One team. Every visit.
          </h2>
          <p className="text-[15px] sm:text-[17px] text-white/45 max-w-[540px] mx-auto leading-relaxed">
            A monthly handyman membership that keeps your Long Island home in shape — year after year, no hunting for contractors.
          </p>
        </div>

        {/* ── Membership card ── */}
        <div className="max-w-[680px] mx-auto">
          <div
            className="group relative flex flex-col rounded-[28px] border border-white/8 overflow-hidden transition-all duration-300 hover:border-[#306EEC]/40 hover:-translate-y-1"
            style={{ background: "linear-gradient(145deg, #0C1A3A 0%, #0F2050 60%, #0A1630 100%)" }}
          >
            {/* Accent top line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#306EEC]/0 via-[#306EEC] to-[#306EEC]/0" />

            {/* Ambient glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 left-1/4 h-[300px] w-[300px] rounded-full blur-[100px] opacity-20"
              style={{ background: "#306EEC" }}
            />

            <div className="relative flex flex-col flex-1 p-8 sm:p-10">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#306EEC]/30 bg-[#306EEC]/10 px-3.5 py-1.5 mb-7 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-[#86EFAC]" style={{ boxShadow: "0 0 6px rgba(134,239,172,0.9)" }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7BAEFF]">
                  Handyman Membership
                </span>
              </div>

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-[#306EEC]/20"
                style={{ background: "rgba(48,110,236,0.12)" }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#7BAEFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 22V12h6v10" stroke="#7BAEFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 7l1.5 1.5L17 5" stroke="#86EFAC" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Headline */}
              <h3 className="text-[26px] sm:text-[32px] font-extrabold text-white leading-[1.12] tracking-[-0.025em] mb-3">
                Everything handled,<br />every month.
              </h3>
              <p className="text-[15px] text-white/50 leading-relaxed mb-7 max-w-[480px]">
                One trusted team. Predictable pricing. Regular visits and steady maintenance — your home stays in shape without you lifting a finger.
              </p>

              {/* Divider */}
              <div className="border-t border-white/8 mb-6" />

              {/* Benefits */}
              <ul className="space-y-3 mb-8">
                {[
                  "Regular scheduled visits based on your plan",
                  "Same trusted team, every single visit",
                  "Wide range of tasks covered — no per-task estimates",
                  "Priority scheduling for members",
                  "Month-to-month, cancel anytime",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(48,110,236,0.18)", border: "1px solid rgba(48,110,236,0.30)" }}>
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                        <path d="M1 3.5l2 2L8 1" stroke="#7BAEFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[14px] text-white/70">{b}</span>
                  </li>
                ))}
              </ul>

              {/* Price hint */}
              <div className="flex items-baseline gap-2 mb-7">
                <span className="text-[13px] text-white/35">Plans from</span>
                <span className="text-[24px] font-extrabold text-white tracking-[-0.02em]">$149</span>
                <span className="text-[13px] text-white/35">/mo · Month-to-month</span>
              </div>

              {/* CTA */}
              <div className="mt-auto space-y-3">
                <Link
                  href="/membership"
                  className="w-full min-h-[54px] rounded-[16px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #306EEC 0%, #1D4ED8 100%)", boxShadow: "0 12px 40px rgba(48,110,236,0.32)" }}
                >
                  Get Subscription
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>

                {/* Promo code */}
                <div className="flex items-center justify-center gap-2">
                  <div className="rounded-md border border-[#306EEC]/25 bg-[#306EEC]/08 px-2.5 py-1">
                    <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#7BAEFF]">FIX10</span>
                  </div>
                  <span className="text-[12px] text-white/35">10% off your first month</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Trust bar ── */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {[
            "NY State Licensed · HI-71484",
            "Fully Insured",
            "5.0 Google Rating",
            "9+ Years on Long Island",
            "Founder-Led",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[12px] text-white/35 font-medium">{item}</span>
            </div>
          ))}
        </div>

        {/* ── Need a Bigger Project? ── */}
        <div className="mt-16 max-w-[580px] mx-auto">
          <div
            className="rounded-[20px] border border-white/8 px-7 py-6 text-center"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <h3 className="text-[16px] font-bold text-white/70 mb-2">
              Need a Bigger Home Improvement Project?
            </h3>
            <p className="text-[14px] text-white/38 leading-relaxed mb-5 max-w-[420px] mx-auto">
              For larger repairs, renovations, or general home improvement work outside the handyman membership, call us directly and we&apos;ll discuss the project.
            </p>
            <a
              href="tel:+16315991363"
              className="inline-flex items-center gap-2.5 rounded-[12px] border border-white/12 bg-white/[0.06] px-5 py-3 text-[14px] font-bold text-white/80 transition hover:bg-white/[0.10] hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Call 631-599-1363
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
