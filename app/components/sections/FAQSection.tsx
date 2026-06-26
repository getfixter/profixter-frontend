"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What's included in the membership?",
    a: "Your membership covers small and medium home tasks that fit within your visit time: repairs, installations, maintenance, drywall patches, caulking, paint touch-ups, doors, locks, shelves, fixtures, and similar handyman work. Large remodels, full-room painting, roofing, siding, and major trade work are handled separately.",
  },
  {
    q: "Are there limits per month?",
    a: "There is no hard monthly cap on standard visit requests. Your plan controls how many active appointments you can have at one time, plus benefits like basic materials, Rush Visits, and project time. Appointment availability still depends on the schedule.",
  },
  {
    q: "What does \"active appointment\" mean?",
    a: "An active appointment is a visit that is pending, booked, or scheduled. Once that visit is completed, you can book the next one. Basic includes 1 active appointment at a time. Plus, Premium, and Elite include 2 active appointments at a time.",
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
    q: "How does cancellation work?",
    a: "Plans are month-to-month with no long-term contract. If you cancel, your membership stays active through the end of the current billing period and you will not be charged again.",
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
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.18), transparent)" }}
      />

      <div className="mx-auto max-w-[860px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              Frequently Asked Questions
            </span>
          </div>
          <h2 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[42px]">
            Questions Homeowners Ask
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-white/42 sm:text-[16px]">
            Clear answers before you choose a plan.
          </p>
        </div>

        <div className="space-y-2">
          {FAQS.map(({ q, a }, i) => {
            const isOpen = open === i;

            return (
              <div
                key={q}
                className="overflow-hidden rounded-[18px] border border-white/[0.08] transition-all duration-200"
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
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`text-[15px] font-semibold leading-snug transition-colors sm:text-[16px] ${
                      isOpen ? "text-white" : "text-white/78"
                    }`}
                  >
                    {q}
                  </span>
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300"
                    style={{
                      background: isOpen ? "rgba(48,110,236,0.18)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isOpen ? "rgba(48,110,236,0.30)" : "rgba(255,255,255,0.08)"}`,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke={isOpen ? "#7BAEFF" : "rgba(255,255,255,0.40)"}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>

                <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: isOpen ? "400px" : "0px" }}>
                  <p className="px-6 pb-6 text-[14px] leading-[1.72] text-white/52 sm:text-[15px]">{a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
