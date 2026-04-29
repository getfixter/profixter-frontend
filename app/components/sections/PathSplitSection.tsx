"use client";

import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────

interface PathSplitProps {
  membershipHref?: string;
  projectsHref?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PathSplitSection({
  membershipHref = "/membership",
  projectsHref = "/projects",
}: PathSplitProps) {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #080F1E 0%, #060C18 100%)" }}
    >
      {/* Top border glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.25), rgba(217,119,6,0.20), transparent)" }}
      />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 mb-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
              Long Island · Licensed HI-71484 · 9+ Years
            </span>
          </div>
          <h2 className="text-[30px] sm:text-[44px] lg:text-[54px] font-extrabold text-white leading-[1.08] tracking-[-0.035em] mb-4">
            Two ways we can help.
          </h2>
          <p className="text-[15px] sm:text-[17px] text-white/45 max-w-[540px] mx-auto leading-relaxed">
            Whether you need ongoing home care or a major renovation — same licensed team, same uncompromising standard.
          </p>
        </div>

        {/* ── Two path cards ──────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">

          {/* ══ PATH A: Membership ══════════════════════════════════════════ */}
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
                  Ongoing Home Care
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
              <h3 className="text-[26px] sm:text-[30px] font-extrabold text-white leading-[1.12] tracking-[-0.025em] mb-3">
                Everything handled,
                <br />every month.
              </h3>
              <p className="text-[15px] text-white/50 leading-relaxed mb-7 max-w-[380px]">
                One trusted team. Predictable pricing. Regular visits and steady maintenance — year after year, no hunting for contractors.
              </p>

              {/* Divider */}
              <div className="border-t border-white/8 mb-6" />

              {/* Benefits */}
              <ul className="space-y-3 mb-8">
                {[
                  "Regular scheduled visits based on your plan",
                  "Same trusted team, every visit",
                  "Wide range of tasks covered — no per-task estimates",
                  "Priority scheduling for members",
                  "10% off home improvement projects",
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
                  href={membershipHref}
                  className="w-full min-h-[54px] rounded-[16px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #306EEC 0%, #1D4ED8 100%)", boxShadow: "0 12px 40px rgba(48,110,236,0.32)" }}
                >
                  See Membership Plans
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

              {/* Cross-sell */}
              <div className="mt-5 pt-5 border-t border-white/8">
                <p className="text-[12px] text-white/28 text-center leading-relaxed">
                  Active members save 10% on roofing, bathroom, and kitchen projects — an exclusive member benefit.
                </p>
              </div>
            </div>
          </div>

          {/* ══ PATH B: Projects ════════════════════════════════════════════ */}
          <div
            className="group relative flex flex-col rounded-[28px] border border-white/8 overflow-hidden transition-all duration-300 hover:border-[#D97706]/35 hover:-translate-y-1"
            style={{ background: "linear-gradient(145deg, #1A0E04 0%, #221206 60%, #160B02 100%)" }}
          >
            {/* Accent top line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#D97706]/0 via-[#D97706] to-[#D97706]/0" />

            {/* Ambient glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 right-1/4 h-[300px] w-[300px] rounded-full blur-[100px] opacity-18"
              style={{ background: "#D97706" }}
            />

            <div className="relative flex flex-col flex-1 p-8 sm:p-10">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D97706]/30 bg-[#D97706]/10 px-3.5 py-1.5 mb-7 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FCD34D]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FCD34D]/80">
                  Major Home Improvement
                </span>
              </div>

              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-[#D97706]/20"
                style={{ background: "rgba(217,119,6,0.12)" }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="#FCD34D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Headline */}
              <h3 className="text-[26px] sm:text-[30px] font-extrabold text-white leading-[1.12] tracking-[-0.025em] mb-3">
                Transform your most
                <br />important spaces.
              </h3>
              <p className="text-[15px] text-white/50 leading-relaxed mb-7 max-w-[380px]">
                Roofing, bathroom, kitchen — built right. Licensed, permitted, finished to a standard your home deserves. Free estimate, no obligation.
              </p>

              {/* Divider */}
              <div className="border-t border-white/8 mb-6" />

              {/* Project services */}
              <div className="space-y-3 mb-8">
                {[
                  {
                    href: "/roofing",
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#FCD34D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                    title: "1-Day Roof Replacement",
                    sub: "Up to 50-yr warranty · Storm & insurance ready",
                  },
                  {
                    href: "/remodeling",
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M9 6a3 3 0 015.12-2.12A3 3 0 0117 6" stroke="#FCD34D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="2" y="6" width="20" height="4" rx="2" stroke="#FCD34D" strokeWidth="1.6" />
                        <path d="M4 10v8a2 2 0 002 2h12a2 2 0 002-2v-8" stroke="#FCD34D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ),
                    title: "Full Bathroom Remodeling",
                    sub: "Tile, fixtures, vanity, plumbing · Start to finish",
                  },
                  {
                    href: "/kitchen",
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="7" rx="2" stroke="#FCD34D" strokeWidth="1.6" />
                        <path d="M2 10v11h20V10" stroke="#FCD34D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="16" r="2" stroke="#FCD34D" strokeWidth="1.6" />
                      </svg>
                    ),
                    title: "Full Kitchen Remodeling",
                    sub: "Cabinets, countertops, layout · Complete transformation",
                  },
                ].map(({ href, icon, title, sub }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group/item flex items-center gap-4 rounded-[14px] border border-white/6 bg-white/[0.03] px-4 py-3.5 hover:bg-[#D97706]/08 hover:border-[#D97706]/25 transition-all duration-200"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(217,119,6,0.14)" }}
                    >
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-white/88 group-hover/item:text-white transition-colors leading-snug">{title}</div>
                      <div className="text-[12px] text-white/35 leading-snug mt-0.5">{sub}</div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-white/20 group-hover/item:text-[#FCD34D]/60 transition-colors" aria-hidden="true">
                      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ))}
              </div>

              {/* Warranty + financing strip */}
              <div className="flex items-center gap-5 mb-7">
                {[
                  { icon: "shield", label: "Workmanship warranty" },
                  { icon: "dollar", label: "Financing available" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    {icon === "shield" ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className="text-[12px] text-white/40">{label}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-auto space-y-3">
                <Link
                  href={projectsHref}
                  className="w-full min-h-[54px] rounded-[16px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 12px 40px rgba(217,119,6,0.30)" }}
                >
                  Explore Home Improvement
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <p className="text-center text-[12px] text-white/28">
                  No obligation · Free on-site assessment · Licensed HI-71484
                </p>
              </div>

              {/* Cross-sell */}
              <div className="mt-5 pt-5 border-t border-white/8">
                <p className="text-[12px] text-white/28 text-center leading-relaxed">
                  After your project, protect your home year-round with our membership plans.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Bottom trust bar ────────────────────────────────────────────── */}
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

      </div>
    </section>
  );
}
