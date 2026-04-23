"use client";

import Button from "@/app/components/ui/Button";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export default function FinalCTASection() {
  const scrollToPlans = () => {
    trackEvent("view_plans", { placement: "final_cta" });
    const el = document.getElementById("plans");
    if (!el) return;

    const HEADER_OFFSET = window.innerWidth >= 1024 ? 160 : 120;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", "#plans");
  };

  return (
    <section className="w-full bg-[#eaedfa] py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[24px] border border-[#2558c9]/20 bg-[#306EEC] px-5 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12 text-white shadow-[0_20px_90px_rgba(48,110,236,0.28)]">
          <div className="max-w-[760px]">
            <div className="text-[12px] uppercase tracking-wider text-white/75 font-bold">
              Ready for a Simpler Way?
            </div>
            <h2 className="mt-2 text-[28px] sm:text-[38px] lg:text-[46px] font-extrabold leading-[1.02] tracking-[-0.04em]">
              Stop searching for a handyman every time
            </h2>
            <p className="mt-4 max-w-[620px] text-[15px] leading-relaxed text-white/85 sm:text-[17px]">
              Get reliable home help with simple monthly pricing.
            </p>
            <p className="mt-3 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/75 sm:text-[14px]">
              No estimates. No surprises.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              onClick={() => trackEvent("start_signup", { placement: "final_cta" })}
              data-track="final-cta"
              className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-white px-7 text-[15px] font-semibold text-[#306EEC] transition hover:bg-[#EEF2FF] sm:text-base"
            >
              Get Started
            </Link>
            <Button
              type="button"
              onClick={scrollToPlans}
              data-track="final-cta"
              variant="ghost"
              size="md"
              className="h-[54px] rounded-[16px] border-white px-7 font-semibold text-white hover:bg-white/15"
            >
              View Plans
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
