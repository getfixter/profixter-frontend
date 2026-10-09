"use client";

/**
 * The homepage for anyone who is not already a member: the booking IS the page.
 *
 * Use first, explain second, details only when asked. The first screen states
 * the offer in a line and is the booker; everything below is short, and the
 * long answers sit in a closed FAQ rather than in paragraphs nobody asked for.
 *
 * Members keep the home they already know (HomeMarketing), so nobody who pays
 * for Profixter is shown an offer they cannot use.
 */

import Link from "next/link";
import { useEffect } from "react";
import FreeVisitBooker from "@/app/components/booking/FreeVisitBooker";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";
import GoogleRatingCompact from "@/app/components/home/GoogleRatingCompact";
import Reveal from "@/app/components/ui/Reveal";
import { trackEvent } from "@/lib/analytics";
import { HOME_FAQ as FAQ } from "@/lib/home-faq";

const STEPS = [
  { title: "Pick a time.", body: "Tell us what needs doing and choose a slot. About a minute." },
  { title: "Your Fixter arrives.", body: "A local Profixter pro comes to your home with the tools." },
  { title: "It's done.", body: "Up to 90 minutes of work on your list." },
];

export default function HomeLanding() {
  useEffect(() => {
    trackEvent("landing_viewed", { variant: "free_visit_booker" });
  }, []);

  return (
    <main className="lx-root">
      {/* ============================ HERO + BOOKER ============================ */}
      <section className="lx-hero px-4 pb-10 pt-6 sm:pb-16 sm:pt-12">
        <div className="lx-glow -right-40 -top-40" aria-hidden="true" />
        <div className="lx-wrap grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-16">
          <div className="lg:pt-6">
            <p className="lx-pill fv-enter">
              <b>Free</b> First 90-minute visit
            </p>
            <h1 className="lx-h1 fv-enter mt-4" style={{ animationDelay: "60ms" }}>
              Your handyman.
              <br />
              <span>On demand.</span>
            </h1>
            <p className="lx-lede fv-enter mt-3 max-w-[440px]" style={{ animationDelay: "120ms" }}>
              Tell us what needs fixing and pick a time. A Fixter comes to your home on Long Island.
            </p>
            <ul className="mt-6 hidden flex-wrap gap-x-5 gap-y-2 lg:flex" aria-label="Why Profixter">
              <li className="lx-tick">Licensed &amp; insured</li>
              <li className="lx-tick">Nassau &amp; Suffolk</li>
              <li className="lx-tick">No card needed</li>
            </ul>
            <div className="mt-8 hidden lg:block">
              <Link href="/membership/plans" className="fv-link" onClick={() => trackEvent("see_plans_clicked", { placement: "home_hero" })}>
                Need regular help? See plans →
              </Link>
            </div>
          </div>

          <div className="fv-enter" style={{ animationDelay: "160ms" }}>
            <FreeVisitBooker id="book" variant="compact" />
            <p className="mt-3 text-center text-[14px] text-[#64748B] lg:hidden">
              Need regular help?{" "}
              <Link href="/membership/plans" className="fv-link text-[14px]" onClick={() => trackEvent("see_plans_clicked", { placement: "home_hero" })}>
                See plans
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================= */}
      <section className="lx-section" aria-labelledby="lx-how">
        <div className="lx-wrap">
          <Reveal>
            <p className="lx-eyebrow">How it works</p>
            <h2 id="lx-how" className="lx-h2 mt-2">Book. We come. Done.</h2>
          </Reveal>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 70} as="li" className="lx-step-card h-full">
                <span className="lx-step-num">{i + 1}</span>
                <h3 className="mt-5 text-[21px] font-bold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-6 text-[#5b6577]">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================== MEMBERSHIP ============================== */}
      <section className="px-4" aria-labelledby="lx-plans">
        <div className="lx-wrap">
          <Reveal>
            <div className="lx-dark px-6 py-10 sm:px-12 sm:py-14">
              <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="lx-eyebrow !text-[#8fb2ff]">Membership</p>
                  <h2 id="lx-plans" className="lx-h2 mt-2 max-w-[560px]">Want a handyman all year?</h2>
                  <p className="mt-3 max-w-[520px] text-[16px] leading-7 text-white/70">
                    Plans from $149 a month. Book as often as you need - your plan sets how many visits you can have booked at once.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                  <Link
                    href="/membership/plans"
                    className="fv-cta !bg-white !text-[#0B1628] !shadow-none hover:!bg-[#EEF4FF]"
                    onClick={() => trackEvent("see_plans_clicked", { placement: "home_membership" })}
                  >
                    See plans <span aria-hidden="true">→</span>
                  </Link>
                  <Link href="/handyman-membership" className="text-center text-[14px] font-semibold text-white/70 hover:text-white">
                    How membership works
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* =============================== REAL WORK ============================== */}
      <section className="lx-section !pb-0" aria-labelledby="lx-work">
        <div className="lx-wrap">
          <Reveal>
            <p className="lx-eyebrow">Real work</p>
            <h2 id="lx-work" className="lx-h2 mt-2">Real homes. Real jobs.</h2>
          </Reveal>
        </div>
        <div className="mt-8">
          <RecentWorkSection variant="preview" showHeading={false} />
        </div>
      </section>

      {/* ================================= TRUST ================================ */}
      <section className="lx-section" aria-labelledby="lx-trust">
        <div className="lx-wrap grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <Reveal>
            <h2 id="lx-trust" className="lx-h2">A local company, not a marketplace.</h2>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
              <li className="lx-tick">Licensed HI-71484</li>
              <li className="lx-tick">Fully insured</li>
              <li className="lx-tick">Nassau &amp; Suffolk</li>
            </ul>
          </Reveal>
          <Reveal delay={80}>
            <GoogleRatingCompact />
          </Reveal>
        </div>
      </section>

      {/* ================================== FAQ ================================= */}
      <section className="lx-section !pt-0" aria-labelledby="lx-faq">
        <div className="lx-wrap max-w-[760px]">
          <h2 id="lx-faq" className="text-[24px] font-bold tracking-[-0.02em]">Questions</h2>
          <div className="mt-4 divide-y divide-[#E6EBF3] border-y border-[#E6EBF3]">
            {FAQ.map((item) => (
              <details key={item.q} className="lx-faq group">
                <summary className="flex min-h-[60px] items-center justify-between gap-4 py-4 text-[16px] font-semibold">
                  {item.q}
                  <span className="lx-plus text-[22px] font-light text-[#306EEC]" aria-hidden="true">+</span>
                </summary>
                <div className="pb-5 pr-8 text-[15px] leading-7 text-[#5b6577]">
                  {item.a}
                  {item.link ? (
                    <>
                      {" "}
                      <Link href={item.link.href} className="fv-link text-[15px]">{item.link.label}</Link>
                    </>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
          <p className="mt-6 text-[15px] text-[#5b6577]">
            Something else? Call or text{" "}
            <a href="tel:+16315991363" className="fv-link text-[15px]">631-599-1363</a>
            {" "}or read{" "}
            <Link href="/about" className="fv-link text-[15px]">about us</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
