"use client";

import Link from "next/link";

const CHECK_GOLD = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-[1px]">
    <path d="M5 12.5l4 4 10-10" stroke="#D4A574" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHECK_GREEN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-[1px]">
    <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PHONE_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ExteriorPromoSection() {
  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #060F1C 0%, #09121E 55%, #050D18 100%)" }}
    >
      {/* Gold ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-[180px] opacity-35"
        style={{ background: "radial-gradient(circle, rgba(212,165,116,0.28), transparent 70%)" }}
      />
      {/* Dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Top gold hairline */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,165,116,0.35), transparent)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/20 bg-[#D4A574]/[0.06] px-4 py-2 mb-6 backdrop-blur-sm">
            <span
              className="h-2 w-2 rounded-full bg-[#D4A574] flex-shrink-0"
              style={{ boxShadow: "0 0 9px rgba(212,165,116,0.8)" }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#E8C49A]/80">
              Full Exterior Services
            </span>
          </div>

          <h2 className="text-[36px] sm:text-[52px] lg:text-[62px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
            Big exterior projects?
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}
            >
              Same trusted team handles those too.
            </span>
          </h2>

          <p className="max-w-[580px] mx-auto text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
            Full roof replacements and siding installs — done by the same licensed Long Island crew. 50-year warranty, financing available, no pressure.
          </p>
        </div>

        {/* Two service cards */}
        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">

          {/* ── Roofing card ── */}
          <div
            className="relative group overflow-hidden rounded-[28px] flex flex-col"
            style={{
              background: "linear-gradient(145deg, #0D1F3C 0%, #091629 100%)",
              boxShadow: "0 0 0 1px rgba(212,165,116,0.18), 0 40px 100px rgba(0,0,0,0.45)",
            }}
          >
            {/* Gold top border */}
            <div className="absolute top-0 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-[#D4A574]/80 to-transparent" />
            {/* Hover glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px]"
              style={{ background: "radial-gradient(80% 50% at 50% 0%, rgba(212,165,116,0.07), transparent)" }}
            />

            <div className="relative flex flex-col flex-1 p-7 sm:p-8 lg:p-10">
              {/* Icon */}
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#D4A574]/28 bg-[#D4A574]/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#D4A574" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 22V12h6v10" stroke="#D4A574" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4A574]/65 mb-2">
                Roofing
              </div>
              <h3 className="text-[26px] sm:text-[30px] lg:text-[32px] font-extrabold text-white leading-tight tracking-[-0.025em] mb-3">
                One Roof For Life.
              </h3>
              <p className="text-[14px] sm:text-[15px] text-white/42 leading-relaxed mb-8">
                Full asphalt, metal, and flat roof replacements. Premium materials, clean installation, and a roof your family can forget about for decades.
              </p>

              <ul className="space-y-3 mb-9">
                {[
                  "50-year manufacturer warranty",
                  "Financing available — no large upfront",
                  "Licensed HI-71484 · Fully insured",
                  "Free on-site estimate, no pressure",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    {CHECK_GOLD}
                    <span className="text-[13px] sm:text-[14px] text-white/62 font-medium leading-snug">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 mt-auto">
                <Link
                  href="/roofing"
                  className="inline-flex h-[54px] items-center justify-center rounded-[14px] bg-[#D4A574] px-6 text-[15px] font-extrabold text-[#0A1220] transition-all hover:-translate-y-0.5 hover:bg-[#E0B886]"
                  style={{ boxShadow: "0 14px 38px rgba(212,165,116,0.28)" }}
                >
                  Get Roofing Estimate
                </Link>
                <a
                  href="tel:+16315991363"
                  className="inline-flex h-[46px] items-center justify-center gap-2.5 rounded-[14px] border border-white/[0.09] bg-white/[0.04] px-6 text-[13px] font-semibold text-white/50 transition-all hover:text-white/80 hover:border-white/18"
                >
                  {PHONE_ICON}
                  Call 631-599-1363
                </a>
              </div>
            </div>
          </div>

          {/* ── Siding card ── */}
          <div
            className="relative group overflow-hidden rounded-[28px] flex flex-col"
            style={{
              background: "linear-gradient(145deg, #0E1E30 0%, #0A1626 100%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.45)",
            }}
          >
            {/* White top border */}
            <div className="absolute top-0 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            {/* Hover glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[28px]"
              style={{ background: "radial-gradient(80% 50% at 50% 0%, rgba(134,239,172,0.05), transparent)" }}
            />

            <div className="relative flex flex-col flex-1 p-7 sm:p-8 lg:p-10">
              {/* Icon */}
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="18" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" />
                  <path d="M2 9h20M2 15h20" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 3v18M16 3v18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35 mb-2">
                Siding
              </div>
              <h3 className="text-[26px] sm:text-[30px] lg:text-[32px] font-extrabold text-white leading-tight tracking-[-0.025em] mb-3">
                One Siding For Life.
              </h3>
              <p className="text-[14px] sm:text-[15px] text-white/42 leading-relaxed mb-8">
                Vinyl, fiber cement, and engineered wood siding. Protects your home and looks sharp — installed right the first time, guaranteed for decades.
              </p>

              <ul className="space-y-3 mb-9">
                {[
                  "50-year warranty on premium materials",
                  "Financing available — spread the cost",
                  "Licensed HI-71484 · Fully insured",
                  "Free on-site estimate, no pressure",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    {CHECK_GREEN}
                    <span className="text-[13px] sm:text-[14px] text-white/62 font-medium leading-snug">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 mt-auto">
                <Link
                  href="/siding"
                  className="inline-flex h-[54px] items-center justify-center rounded-[14px] bg-white px-6 text-[15px] font-extrabold text-[#0A1220] transition-all hover:-translate-y-0.5 hover:bg-[#EEF2FF]"
                  style={{ boxShadow: "0 14px 38px rgba(0,0,0,0.22)" }}
                >
                  Get Siding Estimate
                </Link>
                <a
                  href="tel:+16315991363"
                  className="inline-flex h-[46px] items-center justify-center gap-2.5 rounded-[14px] border border-white/[0.09] bg-white/[0.04] px-6 text-[13px] font-semibold text-white/50 transition-all hover:text-white/80 hover:border-white/18"
                >
                  {PHONE_ICON}
                  Call 631-599-1363
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom trust strip */}
        <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 sm:gap-x-7 sm:gap-y-3 rounded-[20px] border border-white/[0.07] bg-white/[0.025] px-4 py-4 sm:px-5">
          {[
            "Licensed HI-71484",
            "9+ Years on Long Island",
            "Fully Insured",
            "50-Year Warranty",
            "Financing Available",
          ].map((item) => (
            <div key={item} className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-1 w-1 rounded-full bg-[#D4A574]/50 flex-shrink-0" />
              <span className="text-[11px] sm:text-[12px] font-semibold text-white/32">{item}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
