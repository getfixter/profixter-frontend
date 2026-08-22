"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";
import { MEMBERSHIP_FAQS } from "@/app/data/membership-faq";

/* The answers now live in app/data/membership-faq.ts, shared with the
   FAQPage markup and the /handyman-membership explainer. */
const FAQS = MEMBERSHIP_FAQS;

type FAQSectionProps = {
  hideCancellationUi?: boolean;
};

export default function FAQSection({ hideCancellationUi = false }: FAQSectionProps = {}) {
  /*
   * The heading used to read "Questions before you become a Member" for
   * everybody, including people who became one months ago. Same answers,
   * but addressed to whoever is actually reading.
   */
  const { user } = useAuth();
  const isMember = hasActiveMembership(user);
  const [open, setOpen] = useState<number | null>(null);
  const faqs = hideCancellationUi
    ? FAQS.filter(({ q }) => !q.toLowerCase().includes("cancellation"))
    : FAQS;

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

      <div className="mx-auto max-w-[860px] px-4 py-9 sm:px-6 sm:py-11">
        <div className="mb-7 text-center sm:mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.04] px-3.5 py-1.5 sm:mb-5 sm:px-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              Frequently Asked Questions
            </span>
          </div>
          <h2 className="text-[23px] font-extrabold leading-[1.12] tracking-[-0.025em] text-white sm:text-[34px] sm:tracking-[-0.03em]">
            {isMember ? "Questions about your membership" : "Questions before you become a Member"}
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-white/42 sm:text-[16px]">
            Clear answers about how ongoing home care works, what fits, and what belongs in a project estimate.
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map(({ q, a }, i) => {
            const isOpen = open === i;

            return (
              <div
                key={q}
                className="overflow-hidden rounded-[8px] border border-white/[0.08] transition-all duration-200"
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
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-6 sm:py-5"
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
                  <p className="px-4 pb-5 text-[13px] leading-[1.68] text-white/52 sm:px-6 sm:pb-6 sm:text-[15px] sm:leading-[1.72]">{a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
