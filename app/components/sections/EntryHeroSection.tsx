"use client";

import Image from "next/image";

const TRUST = [
  { label: "5.0 Google Rating", icon: "star" },
  { label: "Licensed HI-71484", icon: "shield" },
  { label: "9+ Years on Long Island", icon: "clock" },
  { label: "Fully Insured", icon: "check" },
] as const;

export default function EntryHeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#080F1E] min-h-[78vh] flex flex-col items-center justify-center">

      {/* Background photo */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.webp"
          alt="Long Island home"
          fill
          className="object-cover object-center"
          style={{ opacity: 0.22 }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080F1E]/60 via-[#080F1E]/50 to-[#080F1E]/95" />
      </div>

      {/* Ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[900px] rounded-full bg-[#306EEC]/6 blur-[200px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-[#D97706]/5 blur-[180px]" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[760px] px-5 text-center py-20">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/18 bg-white/[0.06] px-5 py-2 backdrop-blur-sm mb-8">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#86EFAC]" style={{ boxShadow: "0 0 8px rgba(134,239,172,0.9)" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            Long Island's Premier Home Services Team
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[58px] sm:text-[78px] lg:text-[96px] font-black leading-[0.88] tracking-[-0.05em] text-white mb-6">
          Your home,
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)" }}
          >
            handled.
          </span>
        </h1>

        {/* Sub */}
        <p className="text-[17px] sm:text-[20px] font-medium leading-[1.6] text-white/55 max-w-[560px] mx-auto mb-10">
          One licensed, insured team for everything your home needs —
          regular visits, covered tasks, and everything handled on a simple monthly membership.
        </p>

        {/* Trust chips */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-8">
          {TRUST.map(({ label }) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] font-semibold text-white/55">{label}</span>
            </div>
          ))}
        </div>

        {/* Phone CTA */}
        <a
          href="tel:+16315991363"
          className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] px-6 py-3 hover:bg-white/[0.09] hover:border-white/20 transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-[#306EEC]/20 flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#7BAEFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold text-white/60">
            Questions? Call <span className="text-white/85 font-bold">631-599-1363</span>
          </span>
        </a>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Choose your path</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/40 animate-bounce" aria-hidden="true">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
