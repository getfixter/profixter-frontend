"use client";

import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/useAuth";

const TRUST_ITEMS = [
  "4.9 Google Rating",
  "Licensed HI-71484",
  "9+ Years on Long Island",
  "Fully Insured",
  "Month-to-Month",
];

export default function FinalCTASection() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const isOnMembership = pathname === "/membership";

  const handlePlansClick = () => {
    trackEvent("view_plans", { placement: "final_cta" });
    if (!isAuthenticated) {
      window.location.href = "/signup?redirect=%2Fmembership%23plans";
      return;
    }

    if (isOnMembership) {
      const el = document.getElementById("plans");
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 1024 ? 160 : 120);
      window.scrollTo({ top: y, behavior: "smooth" });
      history.replaceState(null, "", "#plans");
    } else {
      window.location.href = "/membership";
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden py-8 sm:py-11 lg:py-36"
      style={{
        background:
          "linear-gradient(160deg, #050D1A 0%, #071224 55%, #060E1C 100%)",
      }}
    >
      {/* ── Ambient glows ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px]"
        style={{
          background:
            "radial-gradient(circle, rgba(48,110,236,0.18), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-20 h-[600px] w-[600px] rounded-full blur-[160px]"
        style={{
          background:
            "radial-gradient(circle, rgba(134,239,172,0.06), transparent 70%)",
        }}
      />

      {/* ── Dot matrix texture ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[920px] text-center">

          {/* ── Eyebrow ── */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 backdrop-blur-sm mb-8 sm:mb-7">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-[#86EFAC]"
              style={{ boxShadow: "0 0 10px rgba(134,239,172,0.9)" }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              Long Island&rsquo;s Handyman Membership
            </span>
          </div>

          {/* ── Headline ── */}
          <h2 className="text-[32px] sm:text-[46px] lg:text-[50px] font-black leading-[0.9] sm:leading-[0.87] tracking-[-0.04em] sm:tracking-[-0.048em] text-white mb-6">
            Your home deserves
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)",
              }}
            >
              someone who shows up.
            </span>
          </h2>

          {/* ── Subhead ── */}
          <p className="text-[17px] sm:text-[19px] font-semibold text-white/48 leading-[1.45] max-w-[600px] mx-auto mb-5 sm:mb-6">
            Request help when your home needs it. Same trusted team. No searching, no estimates, no surprises - just your home getting the steady care it deserves.
          </p>

          {/* Risk reversal */}
          <div className="inline-flex items-center gap-2.5 rounded-[6px] border border-white/12 bg-white/[0.05] px-5 py-2 mb-7 sm:mb-12">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[13px] font-semibold text-white/55">From $149/mo · Cancel anytime · No contracts · No setup fees</span>
          </div>

          {/* ── CTAs ── */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center mb-8 sm:mb-9">
            <button
              type="button"
              onClick={() => {
                trackEvent("start_signup", { placement: "final_cta" });
                handlePlansClick();
              }}
              className="inline-flex min-h-[66px] items-center justify-center rounded-[8px] bg-[#306EEC] px-10 text-[17px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2558c9] active:scale-[0.99]"
              style={{ boxShadow: "0 20px 60px rgba(48,110,236,0.45)" }}
            >
              {isAuthenticated ? "View Membership Plans" : "Create Account"}
            </button>
            <a
              href="tel:+16315991363"
              className="inline-flex min-h-[66px] items-center justify-center gap-3 rounded-[8px] border border-white/20 bg-white/[0.07] px-10 text-[17px] font-bold text-white/85 backdrop-blur-sm transition-all duration-300 hover:border-white/35 hover:bg-white/[0.13] hover:text-white active:scale-[0.99]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Call 631-599-1363
            </a>
          </div>

          {/* ── Trust strip ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3.5 pt-8 sm:pt-10 border-t border-white/[0.08]">
            {TRUST_ITEMS.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12.5l4 4 10-10"
                    stroke="#86EFAC"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[13px] font-semibold text-white/40">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
