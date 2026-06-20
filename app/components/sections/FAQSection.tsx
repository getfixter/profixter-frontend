"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What's included in the membership?",
    a: "Your membership includes small and medium home tasks that fit within your visit time: electrical, plumbing, repairs, installations, maintenance, drywall patches, caulking, paint touch-ups, doors, locks, shelves, fixtures, and more. Large remodels, full-room painting, roofing, siding, and major trade work are handled separately.",
  },
  {
    q: "Are there limits per month?",
    a: "There are no monthly standard-visit limits. Your plan controls how many active appointments you can have at one time, plus benefits like basic materials, Rush Visits, and project time. Need help sooner? Rush Visits don't require waiting for the next standard appointment slot.",
  },
  {
    q: "What does “active appointment” mean?",
    a: "An active appointment is a visit that is currently booked, pending, or scheduled. Once that visit is completed, you can book the next one. Basic includes 1 active appointment at a time. Plus, Premium, and Elite include 2 active appointments at a time.",
  },
  {
    q: "How long is each visit?",
    a: "Each standard visit is up to 90 minutes. It is designed for small and medium tasks, punch lists, repairs, installations, and maintenance items that can usually be completed during that visit.",
  },
  {
    q: "Are materials included?",
    a: "Basic includes labor only. Plus and Premium include basic materials for small tasks. Larger materials, special-order items, fixtures, appliances, and project materials are quoted or approved separately.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month with no long-term contract. If you cancel, your membership stays active through the end of the current billing period and you will not be charged again.",
  },
  {
    q: "What areas do you serve?",
    a: "Profixter is based near Babylon and serves homeowners across Nassau and Suffolk Counties.",
  },
  {
    q: "Do I need to be home during the visit?",
    a: "You can be home if you prefer, but it is not always required. Many members provide access instructions. We document the visit and keep notes so the same trusted team can continue learning your home.",
  },
  {
    q: "What if my job is bigger than a regular visit?",
    a: "Larger projects like roofing, siding, bathroom remodeling, kitchen work, full-room painting, major electrical, major plumbing, or longer repairs are handled as separate project estimates.",
  },
  {
    q: "Are you licensed and insured?",
    a: "Yes. Profixter is licensed as a New York Home Improvement Contractor under license HI-71484 and is fully insured.",
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
            Questions Homeowners Ask
          </h2>
          <p className="text-[15px] sm:text-[16px] text-white/42 mt-4 max-w-[520px] mx-auto leading-relaxed">
            Simple answers before you choose a plan.
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
      </div>
    </section>
  );
}
