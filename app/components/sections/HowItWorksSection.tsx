"use client";

import Image from "next/image";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

const HOW_CARDS = [
  {
    n: "01",
    title: "You pay monthly",
    body: "One simple monthly price. No hunting for contractors, no separate estimate for every small task. Just a predictable bill.",
    accent: "#306EEC",
  },
  {
    n: "02",
    title: "You book visits",
    body: "Each visit is 90 minutes. Log in, pick a time slot, and tell us what to tackle. Use it for repairs, installs, or regular maintenance.",
    accent: "#4ADE80",
  },
  {
    n: "03",
    title: "We handle your home over time",
    body: "Instead of trying to fix everything at once, we help you stay on top of your home month by month — before small things become expensive problems.",
    accent: "#86EFAC",
  },
  {
    n: "04",
    title: "Need more time?",
    body: "Book additional visits between your regular ones, or upgrade your plan anytime. Your home, your pace.",
    accent: "#D4A574",
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[900px] rounded-full blur-[140px] opacity-50"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mx-auto max-w-[720px] text-center mb-14 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              How It Actually Works
            </span>
          </div>

          <h2 className="text-[32px] sm:text-[50px] lg:text-[64px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
            How the Membership
            <br />
            <span className="text-[#306EEC]">Really Works</span>
          </h2>

          <p className="mx-auto max-w-[560px] text-[15px] sm:text-[17px] leading-relaxed text-[#475569]">
            Most homeowners haven&rsquo;t seen this model before. Here&rsquo;s exactly what you&rsquo;re getting — no guesswork.
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-[52px] left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px"
            style={{
              background:
                "linear-gradient(90deg, rgba(48,110,236,0.25), rgba(74,222,128,0.30), rgba(134,239,172,0.25), rgba(212,165,116,0.20))",
            }}
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-6">
            {HOW_CARDS.map((card) => (
              <div key={card.n} className="relative flex flex-col">
                <div className="flex items-center gap-4 lg:flex-col lg:items-start mb-5">
                  <div
                    className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-[0_8px_28px_rgba(48,110,236,0.14)]"
                    style={{ borderColor: card.accent + "55" }}
                  >
                    <span className="text-[15px] font-black tracking-tight" style={{ color: card.accent }}>
                      {card.n}
                    </span>
                  </div>
                  <h3 className="text-[17px] sm:text-[19px] font-bold leading-snug text-[#0B1628] lg:hidden">
                    {card.title}
                  </h3>
                </div>
                <h3 className="hidden lg:block text-[17px] font-bold leading-snug text-[#0B1628] mb-3">
                  {card.title}
                </h3>
                <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#475569]">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Founder anchor ── */}
        <div className="mt-14 sm:mt-16 lg:mt-20 overflow-hidden rounded-[28px] border border-[#C5CBD8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <div className="grid lg:grid-cols-[1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#E6E8EF]">

            <div className="px-7 py-9 sm:px-10 sm:py-10 lg:px-12 lg:py-12 flex flex-col justify-between gap-7">
              <div className="flex items-center gap-4">
                <div className="relative h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
                  <Image
                    src="/images/Taras.png"
                    alt="Taras Bandura, Profixter founder"
                    fill
                    className="object-cover object-top"
                    sizes="68px"
                  />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-[#0B1628]">Taras Bandura</div>
                  <div className="text-[13px] font-semibold text-[#92724E]">Founder &amp; General Manager</div>
                </div>
              </div>

              <blockquote className="border-l-2 border-[#D4A574] pl-5 text-[15px] sm:text-[16px] leading-relaxed text-[#1E293B]">
                &ldquo;I started this because homeowners kept telling me the same thing — they had no reliable person to call for the small stuff. Not one-time emergencies. Just the steady work a home needs to stay in shape. Now they don&rsquo;t have to search. They book online and we show up — same team, month after month.&rdquo;
              </blockquote>

              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
                9+ Years on Long Island &middot; Licensed HI-71484 &middot; Fully Insured
              </p>
            </div>

            <div className="px-7 py-9 sm:px-10 sm:py-10 lg:px-12 lg:py-12 bg-[#F8FAFF] flex flex-col justify-between gap-6">
              <div>
                <div className="text-[22px] sm:text-[26px] font-extrabold leading-tight text-[#0B1628] mb-3">
                  Still have questions about how this works?
                </div>
                <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                  Call Taras directly — he&rsquo;ll walk you through it in two minutes. No sales pitch. Just a straight answer about whether this ongoing care model fits your home.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href="#plans"
                  onClick={() => trackEvent("view_plans", { placement: "how_it_works" })}
                  className="inline-flex h-[54px] items-center justify-center rounded-[14px] bg-[#306EEC] px-6 text-[15px] font-extrabold text-white shadow-[0_12px_32px_rgba(48,110,236,0.28)] transition hover:-translate-y-0.5 hover:bg-[#2558c9] sm:h-[58px] sm:text-[16px]"
                >
                  Get Subscription
                </Link>
                <a
                  href="tel:6315991363"
                  className="inline-flex h-[50px] items-center justify-center gap-2.5 rounded-[14px] border border-[#C5CBD8] bg-white px-6 text-[14px] font-semibold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC] sm:h-[54px] sm:text-[15px]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Call 631-599-1363
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
