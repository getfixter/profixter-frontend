"use client";

import { useMemo, useState } from "react";
import { homepageFaqs } from "@/app/data/content";
import { trackEvent } from "@/lib/analytics";

const STATS = [
  { value: "5.0", label: "Google Rating" },
  { value: "9+", label: "Years on Long Island" },
  { value: "$0", label: "Estimates - ever" },
  { value: "HI-71484", label: "NY State Licensed" },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Faq = (typeof homepageFaqs)[number];

function FaqRow({ faq, isOpen, onToggle }: { faq: Faq; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className={`rounded-[13px] border transition-all duration-200 overflow-hidden ${
        isOpen
          ? "border-[#306EEC]/30 bg-[#EEF5FF]"
          : "border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/[0.14]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left focus:outline-none"
        aria-expanded={isOpen}
      >
        <span
          className={`text-[15px] sm:text-[16px] font-semibold leading-snug transition-colors ${
            isOpen ? "text-[#1D4ED8]" : "text-white/82"
          }`}
        >
          {faq.question}
        </span>
        <span className={isOpen ? "text-[#306EEC]" : "text-white/35"}>
          <ChevronIcon open={isOpen} />
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-[14px] sm:text-[15px] leading-relaxed text-[#334155]">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServicesSection() {
  const items = useMemo(() => homepageFaqs, []);
  const [openId, setOpenId] = useState<string | null>("01");

  const toggle = (id: string) =>
    setOpenId((prev) => (prev === id ? null : id));

  const scrollToPlans = () => {
    trackEvent("view_plans", { placement: "faq" });
    const el = document.getElementById("plans");
    if (!el) return;
    const y =
      el.getBoundingClientRect().top +
      window.scrollY -
      (window.innerWidth >= 1024 ? 160 : 120);
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", "#plans");
  };

  return (
    <section
      id="services"
      className="relative w-full overflow-hidden py-10 sm:py-13 lg:py-12"
      style={{
        background:
          "linear-gradient(160deg, #0B1525 0%, #0D1A30 60%, #0A1220 100%)",
      }}
    >
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1200px] rounded-full blur-[200px] opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)",
        }}
      />
      {/* Dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-8 sm:mb-9 lg:mb-16">
          <div className="max-w-[600px]">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 backdrop-blur-sm mb-7">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#86EFAC]"
                aria-hidden="true"
              >
                <path
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                Common Questions
              </span>
            </div>

            <h2 className="text-[34px] sm:text-[43px] lg:text-[46px] font-black leading-[0.88] tracking-[-0.045em] text-white mb-5">
              FAQ &amp;
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)",
                }}
              >
                quick answers.
              </span>
            </h2>

            <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
              Simple answers about booking, plans, visits, and what to
              expect &mdash; all in one place.
            </p>
          </div>

          {/* Stats - desktop */}
          <div className="hidden lg:grid grid-cols-2 gap-3 flex-shrink-0 w-[280px]">
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-[16px] border border-white/[0.09] bg-white/[0.04] px-4 py-4 text-center"
              >
                <div className="text-[19px] font-extrabold text-white leading-none mb-1">
                  {value}
                </div>
                <div className="text-[11px] font-semibold text-white/35 leading-snug">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ list ── */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-10 items-start">

          {/* Left: accordion */}
          <div className="space-y-3">
            {items.map((faq) => (
              <FaqRow
                key={faq.id}
                faq={faq}
                isOpen={openId === faq.id}
                onToggle={() => toggle(faq.id)}
              />
            ))}
          </div>

          {/* Right: contact card */}
          <div className="flex flex-col gap-4">
            {/* Still have questions */}
            <div
              className="rounded-[14px] border border-white/[0.10] p-7 flex flex-col gap-5"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              }}
            >
              <div>
                <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2">
                  Still have questions?
                </div>
                <p className="text-[16px] font-semibold text-white/80 leading-snug">
                  Call Taras directly. You&rsquo;ll get a real answer from the
                  founder, not a call center.
                </p>
              </div>

              <a
                href="tel:+16315991363"
                className="flex items-center gap-3.5 rounded-[14px] border border-white/[0.12] bg-white/[0.06] px-4 py-4 hover:border-white/[0.22] hover:bg-white/[0.10] transition-all duration-200 group"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#306EEC] group-hover:bg-[#2558c9] transition-colors">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
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
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
                    Call or text Taras
                  </div>
                  <div className="text-[16px] font-bold text-white">
                    631-599-1363
                  </div>
                </div>
              </a>

              <p className="text-[12px] text-white/28 leading-relaxed">
                No sales team. No phone trees. Direct access to the founder
                who oversees every booking.
              </p>
            </div>

            {/* CTA card */}
            <div
              className="rounded-[14px] border border-[#306EEC]/20 p-7 flex flex-col gap-5"
              style={{
                background:
                  "linear-gradient(145deg, rgba(48,110,236,0.12) 0%, rgba(48,110,236,0.06) 100%)",
              }}
            >
              <div>
                <div className="text-[15px] font-bold text-white/80 leading-snug mb-1">
                  Ready to see the plans?
                </div>
                <p className="text-[13px] text-white/45 leading-relaxed">
                  From $149/month. Month-to-month. No contracts.
                </p>
              </div>

              <button
                type="button"
                onClick={scrollToPlans}
                className="w-full rounded-[14px] bg-[#306EEC] py-3.5 text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-[#2558c9]"
                style={{ boxShadow: "0 12px 36px rgba(48,110,236,0.28)" }}
              >
                View Membership Plans
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
