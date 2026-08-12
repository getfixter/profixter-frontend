"use client";

import Link from "next/link";

const ROOFING_PHONE_DISPLAY = "631-599-1363";
const ROOFING_PHONE_TEL = "+16315991363";

const PROOF_STATS = [
  {
    value: "1 Day",
    label: "Most roofs start & finish the same day",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "Licensed",
    label: "NY State Home Improvement Contractor · HI-71484",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "Insured",
    label: "Fully insured for every roofing project",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "Long Island",
    label: "Suffolk & Nassau Counties - locally accountable",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

const WHAT_WE_REPLACE = [
  "Architectural shingles",
  "Flat & low-slope roofs",
  "Storm damage replacement",
  "Full tear-off & installation",
  "Flashing, ridge caps & ventilation",
  "Same-day cleanup & haul-away",
];

export default function RoofingSection() {
  const callNow = () => {
    window.location.href = `tel:${ROOFING_PHONE_TEL}`;
  };

  return (
    <section
      id="roofing"
      className="w-full relative overflow-hidden py-10 sm:py-13 lg:py-12 scroll-mt-[110px]"
      style={{ background: "linear-gradient(160deg, #08101E 0%, #0B1628 60%, #091220 100%)" }}
    >
      {/* Background depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 right-0 bottom-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(48,110,236,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(26,60,120,0.10) 0%, transparent 50%)",
        }}
      />
      {/* Subtle dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-8 sm:mb-16 lg:mb-20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">

            <div className="max-w-[680px]">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 backdrop-blur-sm mb-7">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#D4A574]" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                  High-Ticket Authority Service
                </span>
              </div>

              {/* Headline */}
              <h2 className="text-[36px] sm:text-[43px] lg:text-[50px] font-black leading-[0.88] tracking-[-0.045em] text-white mb-6">
                1-Day Roof
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)",
                  }}
                >
                  Replacement.
                </span>
              </h2>

              <p className="text-[17px] sm:text-[19px] font-semibold text-white/80 leading-[1.4] max-w-[520px]">
                Most roofs on Long Island are started and completed in a single
                day. No multi-week projects. No contractor disappearing acts.
              </p>
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex flex-col items-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={callNow}
                className="inline-flex items-center gap-3 rounded-[13px] px-6 py-5 text-[16px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)",
                  boxShadow: "0 20px 60px rgba(212,165,116,0.30)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Request Free Assessment
              </button>
              <p className="text-[13px] text-white/35">
                Call Taras directly: {ROOFING_PHONE_DISPLAY}
              </p>
            </div>
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_420px] gap-8 lg:gap-8">

          {/* LEFT: Proof stats grid */}
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {PROOF_STATS.map(({ value, label, icon }) => (
              <div
                key={value}
                className="relative rounded-[14px] border border-white/[0.09] p-6 sm:p-7 overflow-hidden group hover:border-white/[0.16] transition-all duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                }}
              >
                {/* Hover glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, rgba(48,110,236,0.08), transparent 70%)",
                  }}
                />
                {/* Icon */}
                <div className="text-[#D4A574] mb-4 opacity-80">{icon}</div>
                {/* Value */}
                <div className="text-[30px] sm:text-[32px] font-black text-white tracking-[-0.03em] leading-none mb-3">
                  {value}
                </div>
                {/* Label */}
                <p className="text-[13px] sm:text-[14px] text-white/50 leading-relaxed">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* RIGHT: What's included card */}
          <div
            className="rounded-[16px] border border-white/[0.10] p-7 sm:p-8 flex flex-col"
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            {/* Card header */}
            <div className="mb-6 pb-6 border-b border-white/[0.09]">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35 mb-3">
                What&rsquo;s Included
              </div>
              <p className="text-[16px] font-bold text-white/82 leading-[1.4]">
                Full roof replacement from start to
                clean-up - in a single day on most projects.
              </p>
            </div>

            {/* Feature list */}
            <ul className="space-y-3.5 mb-8">
              {WHAT_WE_REPLACE.map((item) => (
                <li key={item} className="flex items-center gap-3.5">
                  <div className="w-5 h-5 rounded-full border border-[#D4A574]/40 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="#D4A574"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-[14px] font-semibold text-white/70">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            {/* Disclaimer */}
            <div className="mb-7 rounded-[14px] bg-white/[0.04] border border-white/[0.07] px-4 py-3.5">
              <p className="text-[12px] text-white/40 leading-relaxed">
                &ldquo;Most roofs completed in 1 day&rdquo; applies to standard residential
                re-roofing. Complex projects, multi-story homes, or structural
                repairs may require additional time. Free on-site assessment
                provided before any work begins.
              </p>
            </div>

            {/* CTA */}
            <div className="mt-auto space-y-3">
              <button
                type="button"
                onClick={callNow}
                className="w-full min-h-[48px] rounded-[16px] text-[16px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-3"
                style={{
                  background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)",
                  boxShadow: "0 16px 50px rgba(212,165,116,0.25)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Get Your Free Roof Assessment
              </button>
              <p className="text-[12px] text-center text-white/30">
                No obligation · Call or text Taras: {ROOFING_PHONE_DISPLAY}
              </p>
              <Link
                href="/roofing"
                className="block text-center text-[13px] font-semibold text-[#D4A574]/70 hover:text-[#D4A574] transition-colors"
              >
                See full details &rarr;
              </Link>
              <div className="flex items-center justify-center gap-2 pt-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#D4A574" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] text-white/28">Up to 50-yr warranty</span>
                <span className="text-white/15 text-[10px]">·</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#D4A574" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] text-white/28">Financing available</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Bottom trust bar ───────────────────────────────── */}
        <div className="mt-7 sm:mt-8 rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {[
              "NY State Licensed · HI-71484",
              "Fully Insured",
              "Up to 50-yr warranty",
              "Financing available",
              "Founder-Led",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#D4A574] flex-shrink-0"
                />
                <span className="text-[12px] sm:text-[13px] font-semibold text-white/45">
                  {item}
                </span>
              </div>
            ))}
          </div>
          {/* Mobile CTA */}
          <button
            type="button"
            onClick={callNow}
            className="lg:hidden w-full sm:w-auto rounded-[14px] border border-[#D4A574]/30 bg-[#D4A574]/10 px-6 py-3 text-[14px] font-bold text-[#D4A574] hover:bg-[#D4A574]/18 transition-colors"
          >
            Call for Free Assessment
          </button>
        </div>

      </div>
    </section>
  );
}
