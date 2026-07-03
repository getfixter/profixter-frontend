"use client";

import Image from "next/image";
import Link from "next/link";
import {
  COMPANY_LINKS,
  FOOTER_SEO_LINKS,
  FOOTER_PRODUCT_LINKS,
} from "@/lib/site-architecture";

const TRUST_BADGES = [
  "Licensed HI-71484",
  "Fully insured",
  "Nassau & Suffolk County",
];

export default function Footer() {
  return (
    <footer
      id="contact-us"
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(165deg, #050C18 0%, #070F1E 50%, #040A14 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.20), transparent)" }}
      />

      <div className="relative mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-16 lg:px-5">
        <div className="grid grid-cols-1 items-start gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[1.35fr_0.62fr_0.72fr_0.68fr_0.78fr] lg:gap-8">
          <div>
            <Image
              src="/images/logo-footer.svg"
              alt="Profixter"
              width={200}
              height={48}
              className="mb-4 h-auto w-[160px] sm:mb-5 sm:w-[180px]"
            />

            <p className="mb-6 max-w-[430px] text-[14px] leading-relaxed text-[#9AA3B2] sm:mb-7 sm:text-[15px]">
              Monthly home maintenance Membership, $99 One-Time Handyman Visits, and renovation estimates for Long Island homeowners.
            </p>

            <a
              href="tel:+16315991363"
              className="group inline-flex items-center gap-3 rounded-[15px] border border-white/[0.14] bg-white/[0.06] px-4 py-3 transition-all hover:border-white/[0.22] hover:bg-white/[0.12] sm:gap-3.5 sm:rounded-[16px] sm:px-5 sm:py-3.5"
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
                  Call Profixter
                </div>
                <div className="text-[15px] font-bold text-white sm:text-[16px]">
                  631-599-1363
                </div>
              </div>
            </a>
          </div>

          <div>
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 sm:mb-5">
              Products
            </div>
            <nav className="flex flex-col gap-3" aria-label="Footer products">
              {FOOTER_PRODUCT_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[14px] font-medium text-[#9AA3B2] transition-colors hover:text-white sm:text-[15px]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 sm:mb-5">
              Company
            </div>
            <nav className="flex flex-col gap-3" aria-label="Footer company">
              {COMPANY_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[14px] font-medium text-[#9AA3B2] transition-colors hover:text-white sm:text-[15px]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 sm:mb-5">
              Services
            </div>
            <nav className="flex flex-col gap-3" aria-label="Footer services">
              {FOOTER_SEO_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[14px] font-medium text-[#9AA3B2] transition-colors hover:text-white sm:text-[15px]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 sm:mb-5">
              Contact
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="mailto:my@profixter.com"
                className="break-all text-[14px] font-medium text-[#9AA3B2] transition-colors hover:text-white sm:text-[15px]"
              >
                my@profixter.com
              </a>
              <a
                href="https://instagram.com/mrfixter.ny"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-medium text-[#9AA3B2] transition-colors hover:text-white sm:text-[15px]"
              >
                @mrfixter.ny
              </a>
              <p className="text-[13px] leading-6 text-white/32">
                Based near Babylon. Serving Nassau and Suffolk Counties.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-col items-center justify-between gap-3 border-t border-white/[0.09] pt-5 sm:mt-12 sm:flex-row sm:pt-6">
          <p className="text-[13px] text-[#4A5568]">
            &copy; 2026 Profixter. All rights reserved. &middot; NY State Licensed HI-71484
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST_BADGES.map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#86EFAC]" />
                <span className="text-[12px] font-semibold text-white/28">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
