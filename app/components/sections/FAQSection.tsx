"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What's included in the membership?",
    a: "Your membership covers a wide range of common home maintenance tasks — from leaky faucets and loose fixtures to caulking, door adjustments, minor electrical, and seasonal prep. Covered tasks are handled during your scheduled visit with no separate estimate needed for included work. A full list is at fixter.co/included.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. All plans are month-to-month with no long-term contracts. When you cancel, your membership stays active through the end of your current billing period — you won't be charged again after that. If a payment fails or goes unpaid, access to membership services will pause until the payment is resolved.",
  },
  {
    q: "What areas do you serve?",
    a: "We serve Long Island homeowners across Nassau and Suffolk County. If you're unsure whether we cover your area, call us at 631-599-1363 — we'll confirm right away.",
  },
  {
    q: "How often will you visit?",
    a: "Visit frequency depends on your plan and scheduling availability. The Basic plan (Home Care Membership) includes one scheduled visit per month. The Plus plan (Home Care Plus) includes two scheduled visits per month. Higher plans include additional services on top of that. All visits are scheduled based on availability at the time of booking.",
  },
  {
    q: "What if I need something between scheduled visits?",
    a: "Members get priority access to request additional visits between their regular appointments, subject to availability. To request a visit, log in to your account and submit a request — our team will confirm a time that works.",
  },
  {
    q: "Do I need to be home during the visit?",
    a: "You're welcome to be home, but it's not required. Many members provide access and trust us to complete the work. We document every visit and share notes directly to your account.",
  },
  {
    q: "What's the difference between membership and a one-time call?",
    a: "With a one-time call, you search for someone, explain your home from scratch each time, and pay retail rates for every visit. With a membership, you have a team that learns your home, visits on a regular schedule, and keeps things maintained before they become problems — all at a predictable monthly rate.",
  },
  {
    q: "Do members get discounts on home improvement projects?",
    a: "Yes. Active members receive 10% off qualifying home improvement projects — including roofing, bathroom remodeling, and kitchen renovation. This is an exclusive member benefit, not a public promotion. Your discount is applied when you book your project through us as an active member.",
  },
  {
    q: "Are you licensed and insured?",
    a: "Yes. We hold NY State Home Improvement Contractor License HI-71484 and carry full liability insurance and workers' compensation. Copies are available on request.",
  },
] as const;

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="relative w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #080F1E 0%, #060C18 100%)" }}
    >
      {/* Top separator */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.18), transparent)" }}
      />

      <div className="mx-auto max-w-[860px] px-5 sm:px-8 py-20 sm:py-28">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 mb-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              Frequently Asked Questions
            </span>
          </div>
          <h2 className="text-[30px] sm:text-[42px] font-extrabold text-white leading-[1.1] tracking-[-0.03em]">
            Everything you need to know.
          </h2>
          <p className="text-[15px] sm:text-[16px] text-white/42 mt-4 max-w-[520px] mx-auto leading-relaxed">
            Still have a question? Call us at{" "}
            <a href="tel:+16315991363" className="text-white/65 hover:text-white transition-colors font-semibold">
              631-599-1363
            </a>{" "}
            — we pick up.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-2">
          {FAQS.map(({ q, a }, i) => {
            const isOpen = open === i;
            return (
              <div
                key={q}
                className="rounded-[18px] border border-white/[0.08] overflow-hidden transition-all duration-200"
                style={{
                  background: isOpen
                    ? "linear-gradient(145deg, rgba(48,110,236,0.06) 0%, rgba(255,255,255,0.025) 100%)"
                    : "rgba(255,255,255,0.025)",
                  borderColor: isOpen ? "rgba(48,110,236,0.22)" : "rgba(255,255,255,0.08)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className={`text-[15px] sm:text-[16px] font-semibold leading-snug transition-colors ${isOpen ? "text-white" : "text-white/78"}`}>
                    {q}
                  </span>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                    style={{
                      background: isOpen ? "rgba(48,110,236,0.18)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isOpen ? "rgba(48,110,236,0.30)" : "rgba(255,255,255,0.08)"}`,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke={isOpen ? "#7BAEFF" : "rgba(255,255,255,0.40)"} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: isOpen ? "400px" : "0px" }}
                >
                  <p className="px-6 pb-6 text-[14px] sm:text-[15px] text-white/52 leading-[1.72]">
                    {a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-[13px] text-white/30 mb-3">Still not sure? We&rsquo;re happy to walk you through it.</p>
          <a
            href="tel:+16315991363"
            className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 hover:bg-white/[0.08] hover:border-white/20 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="rgba(255,255,255,0.50)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[14px] font-semibold text-white/55">631-599-1363</span>
          </a>
        </div>

      </div>
    </section>
  );
}
