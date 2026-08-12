"use client";

import Image from "next/image";
import MembershipCtaLink from "@/app/components/membership/MembershipCtaLink";

const TRUST = [
  { label: "4.9 Google Rating", icon: "star" },
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
      <div className="relative z-10 mx-auto max-w-[760px] px-5 text-center py-8">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/18 bg-white/[0.06] px-5 py-2 backdrop-blur-sm mb-8">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#86EFAC]" style={{ boxShadow: "0 0 8px rgba(134,239,172,0.9)" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
            Long Island&apos;s Premier Home Services Team
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[43px] sm:text-[50px] lg:text-[50px] font-black leading-[0.88] tracking-[-0.05em] text-white mb-6">
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
        <p className="text-[17px] sm:text-[19px] font-medium leading-[1.6] text-white/55 max-w-[560px] mx-auto mb-7">
          One licensed, insured team for everything your home needs:
          ongoing help, covered tasks, and everything handled through a simple Membership.
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

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <MembershipCtaLink
            className="inline-flex min-h-[48px] items-center justify-center rounded-[13px] bg-[#306EEC] px-6 text-[16px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#2558c9]"
          >
            Start Membership
          </MembershipCtaLink>
          <a
            href="tel:+16315991363"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[13px] border border-white/12 bg-white/[0.05] px-6 text-[15px] font-bold text-white/80 transition hover:border-white/20 hover:bg-white/[0.09]"
          >
            Call 631-599-1363
          </a>
        </div>
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
