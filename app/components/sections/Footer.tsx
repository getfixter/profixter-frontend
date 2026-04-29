"use client";

import Image from "next/image";
import Link from "next/link";

const MEMBERSHIP_LINKS = [
  { label: "Membership Plans", href: "/membership" },
  { label: "What's Included", href: "/included" },
  { label: "Book a Visit", href: "/membership" },
  { label: "My Account", href: "/account" },
];

const PROJECTS_LINKS = [
  { label: "Home Improvement", href: "/projects" },
  { label: "Roofing", href: "/roofing" },
  { label: "Bathroom Remodeling", href: "/remodeling" },
  { label: "Kitchen Remodeling", href: "/kitchen" },
  { label: "Free Estimate", href: "/estimate" },
];

const TRUST_BADGES = [
  "Licensed HI-71484",
  "Fully Insured",
  "Nassau & Suffolk County",
];

export default function Footer() {
  return (
    <footer
      id="contact-us"
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(165deg, #050C18 0%, #070F1E 50%, #040A14 100%)" }}
    >
      {/* Subtle dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Top edge glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.20), transparent)" }}
      />
      {/* Bottom depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/25" />

      {/* Content */}
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-6 lg:px-5 py-12 sm:py-16">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr] gap-10 lg:gap-8 items-start">

          {/* ── Brand column ── */}
          <div>
            <Image
              src="/images/logo-footer.svg"
              alt="Profixter"
              width={200}
              height={48}
              className="w-[180px] h-auto mb-5"
            />

            <p className="text-[#9AA3B2] text-[15px] leading-relaxed max-w-[400px] mb-7">
              Licensed home services for Long Island homeowners — monthly maintenance memberships
              and complete home improvement by the same trusted team.
            </p>

            {/* Phone */}
            <a
              href="tel:+16315991363"
              className="group inline-flex items-center gap-3.5 rounded-[16px] border border-white/[0.14] bg-white/[0.06] px-5 py-3.5 transition-all hover:bg-white/[0.12] hover:border-white/[0.22]"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#306EEC]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Reach Taras directly
                </div>
                <div className="text-[16px] font-bold text-white">
                  631-599-1363
                </div>
              </div>
            </a>
          </div>

          {/* ── Membership column ── */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-5">
              Membership
            </div>
            <nav className="flex flex-col gap-3.5">
              {MEMBERSHIP_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[15px] font-medium text-[#9AA3B2] transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Projects column ── */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-5">
              Projects
            </div>
            <nav className="flex flex-col gap-3.5">
              {PROJECTS_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[15px] font-medium text-[#9AA3B2] transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Contact column ── */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-5">
              Contact
            </div>
            <div className="flex flex-col gap-3.5">
              <a
                href="mailto:my@profixter.com"
                className="text-[15px] font-medium text-[#9AA3B2] transition-colors hover:text-white break-all"
              >
                my@profixter.com
              </a>
              <a
                href="https://instagram.com/mrfixter.ny"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium text-[#9AA3B2] transition-colors hover:text-white"
              >
                @mrfixter.ny
              </a>

              <div className="mt-2 flex flex-col gap-2.5">
                <Link href="/privacy" className="text-[13px] text-white/30 transition-colors hover:text-white/55">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-[13px] text-white/30 transition-colors hover:text-white/55">
                  Terms of Service
                </Link>
                <Link href="/included" className="text-[13px] text-white/30 transition-colors hover:text-white/55">
                  What can I book?
                </Link>
              </div>
            </div>
          </div>

        </div>

        {/* ── Trust strip ── */}
        <div className="mt-12 border-t border-white/[0.09] pt-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <p className="text-[#4A5568] text-[13px]">
            &copy; 2026 Profixter. All rights reserved. · NY State Licensed HI-71484
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST_BADGES.map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC] flex-shrink-0" />
                <span className="text-[12px] font-semibold text-white/28">{item}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
