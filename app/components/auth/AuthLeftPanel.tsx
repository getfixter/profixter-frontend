"use client";

import Image from "next/image";
import Link from "next/link";

const TRUST_STATS = [
  { value: "4.9", label: "Google Rating" },
  { value: "9+ yrs", label: "On Long Island" },
  { value: "HI-71484", label: "Licensed" },
  { value: "Insured", label: "Fully Covered" },
];

const BENEFITS = [
  "Same trusted team shows up every visit",
  "Book online in seconds - no phone calls",
  "Ongoing care, not one-time fixes",
];

export default function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full px-12 xl:px-16 py-12 border-r border-white/[0.07]">
      {/* Logo */}
      <Link href="/" className="inline-block">
        <Image src="/images/logo.svg" alt="Profixter" width={90} height={34} />
      </Link>

      {/* Value content */}
      <div className="max-w-[460px]">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 mb-8 backdrop-blur-sm">
          <span
            className="h-2 w-2 rounded-full bg-[#86EFAC] flex-shrink-0"
            style={{ boxShadow: "0 0 8px rgba(134,239,172,0.9)" }}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">
            Long Island&rsquo;s Home Care Membership
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-[40px] xl:text-[50px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-4">
          Your home, handled.
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)",
            }}
          >
            Whenever you need us.
          </span>
        </h2>

        <p className="text-[14px] sm:text-[15px] text-white/45 leading-relaxed mb-9 max-w-[380px]">
          Join Long Island homeowners who&rsquo;ve stopped hunting for contractors.
          One team. One bill. Consistent service when your home needs attention.
        </p>

        {/* Trust stats */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {TRUST_STATS.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-4 py-3.5"
            >
              <div className="text-[17px] font-extrabold text-white leading-none mb-1">
                {value}
              </div>
              <div className="text-[11px] font-semibold text-white/35">{label}</div>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="space-y-2.5 mb-10">
          {BENEFITS.map((b) => (
            <div key={b} className="flex items-center gap-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="flex-shrink-0"
              >
                <path
                  d="M5 12.5l4 4 10-10"
                  stroke="#86EFAC"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[13px] font-medium text-white/60">{b}</span>
            </div>
          ))}
        </div>

        {/* Service offer cards */}
        <div className="border-t border-white/[0.07] pt-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/28 mb-4">
            Also in our portfolio
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/roofing"
              className="group rounded-[14px] border border-[#D4A574]/22 bg-[#D4A574]/[0.06] p-4 transition-all hover:border-[#D4A574]/45 hover:bg-[#D4A574]/[0.11]"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4A574]/60 mb-1.5">
                Roofing
              </div>
              <div className="text-[13px] font-bold text-white leading-snug mb-1">
                Full Roof Replacements
              </div>
              <div className="text-[10px] text-white/30">50-yr warranty · Financing</div>
            </Link>
            <Link
              href="/siding"
              className="group rounded-[14px] border border-white/10 bg-white/[0.04] p-4 transition-all hover:border-white/22 hover:bg-white/[0.08]"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-1.5">
                Siding
              </div>
              <div className="text-[13px] font-bold text-white leading-snug mb-1">
                Siding Installation
              </div>
              <div className="text-[10px] text-white/30">50-yr warranty · Financing</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-[11px] text-white/18">
        &copy; {new Date().getFullYear()} Profixter &middot; Long Island, NY
      </div>
    </div>
  );
}
