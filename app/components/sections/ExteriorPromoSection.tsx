"use client";

import Link from "next/link";

const CHECK_GOLD = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-[1px] flex-shrink-0">
    <path d="M5 12.5l4 4 10-10" stroke="#D4A574" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHECK_GREEN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-[1px] flex-shrink-0">
    <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ExteriorPromoSection() {
  return (
    <section
      id="exterior-projects"
      className="relative w-full overflow-hidden py-10 sm:py-13 lg:py-12"
      style={{ background: "linear-gradient(160deg, #060F1C 0%, #09121E 55%, #050D18 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-35 blur-[180px]"
        style={{ background: "radial-gradient(circle, rgba(212,165,116,0.28), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,165,116,0.35), transparent)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-16">
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/20 bg-[#D4A574]/[0.06] px-4 py-2 backdrop-blur-sm">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-[#D4A574]"
              style={{ boxShadow: "0 0 9px rgba(212,165,116,0.8)" }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#E8C49A]/80">
              Exterior Projects
            </span>
          </div>

          <h2 className="mb-5 text-[32px] font-black leading-[0.92] tracking-[-0.04em] text-white sm:text-[40px] lg:text-[43px]">
            Big exterior projects?
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}
            >
              The same trusted team handles those too.
            </span>
          </h2>

          <p className="mx-auto max-w-[620px] text-[15px] leading-relaxed text-white/48 sm:text-[17px]">
            Complete a roofing or siding project and receive up to 12 months of Profixter membership included.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:gap-8">
          <div
            className="group relative flex flex-col overflow-hidden rounded-[16px]"
            style={{
              background: "linear-gradient(145deg, #0D1F3C 0%, #091629 100%)",
              boxShadow: "0 0 0 1px rgba(212,165,116,0.18), 0 40px 100px rgba(0,0,0,0.45)",
            }}
          >
            <div className="absolute left-[15%] right-[15%] top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4A574]/80 to-transparent" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: "radial-gradient(80% 50% at 50% 0%, rgba(212,165,116,0.07), transparent)" }}
            />

            <div className="relative flex flex-1 flex-col p-7 sm:p-8 lg:p-10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#D4A574]/28 bg-[#D4A574]/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#D4A574" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 22V12h6v10" stroke="#D4A574" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#D4A574]/65">
                Roofing
              </div>
              <h3 className="mb-3 text-[23px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[26px] lg:text-[30px]">
                Roofing
              </h3>
              <p className="mb-8 text-[14px] leading-relaxed text-white/42 sm:text-[15px]">
                Complete roof replacement by the same trusted team.
              </p>

              <ul className="mb-9 space-y-3">
                {["Full roof replacement", "Financing available", "Licensed & insured", "Free estimate"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    {CHECK_GOLD}
                    <span className="text-[13px] font-medium leading-snug text-white/62 sm:text-[14px]">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-col gap-3">
                <Link
                  href="/roofing"
                  className="inline-flex h-[46px] items-center justify-center rounded-[14px] bg-[#D4A574] px-6 text-[15px] font-extrabold text-[#0A1220] transition-all hover:-translate-y-0.5 hover:bg-[#E0B886]"
                  style={{ boxShadow: "0 14px 38px rgba(212,165,116,0.28)" }}
                >
                  Get Roofing Estimate
                </Link>
              </div>
            </div>
          </div>

          <div
            className="group relative flex flex-col overflow-hidden rounded-[16px]"
            style={{
              background: "linear-gradient(145deg, #0E1E30 0%, #0A1626 100%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.45)",
            }}
          >
            <div className="absolute left-[15%] right-[15%] top-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: "radial-gradient(80% 50% at 50% 0%, rgba(134,239,172,0.05), transparent)" }}
            />

            <div className="relative flex flex-1 flex-col p-7 sm:p-8 lg:p-10">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="18" rx="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" />
                  <path d="M2 9h20M2 15h20" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M8 3v18M16 3v18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </div>

              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                Siding
              </div>
              <h3 className="mb-3 text-[23px] font-extrabold leading-tight tracking-[-0.025em] text-white sm:text-[26px] lg:text-[30px]">
                Siding
              </h3>
              <p className="mb-8 text-[14px] leading-relaxed text-white/42 sm:text-[15px]">
                Full siding installation by the same trusted team.
              </p>

              <ul className="mb-9 space-y-3">
                {["Full siding replacement", "Financing available", "Licensed & insured", "Free estimate"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    {CHECK_GREEN}
                    <span className="text-[13px] font-medium leading-snug text-white/62 sm:text-[14px]">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-col gap-3">
                <Link
                  href="/siding"
                  className="inline-flex h-[46px] items-center justify-center rounded-[14px] bg-white px-6 text-[15px] font-extrabold text-[#0A1220] transition-all hover:-translate-y-0.5 hover:bg-[#EEF2FF]"
                  style={{ boxShadow: "0 14px 38px rgba(0,0,0,0.22)" }}
                >
                  Get Siding Estimate
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-4 sm:mt-8 sm:gap-x-7 sm:gap-y-3 sm:px-5">
          {["Licensed & Insured", "Long Island Local", "Financing Available", "Free Estimates"].map((item) => (
            <div key={item} className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-1 w-1 flex-shrink-0 rounded-full bg-[#D4A574]/70" />
              <span className="text-[11px] font-semibold text-white/52 sm:text-[12px]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
