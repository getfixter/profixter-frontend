"use client";

import Image from "next/image";

const HOW_CARDS = [
  {
    n: "01",
    title: "One simple monthly price",
    body: "No hunting for contractors, no estimate for every small job. Pay once a month - and your home is covered. You always know exactly what you're spending.",
    accent: "#306EEC",
  },
  {
    n: "02",
    title: "Book any time you're ready",
    body: "Each visit is 90 minutes. Log in, pick a day that works, and tell us what to tackle. No phone tag, no waiting around. You're in control.",
    accent: "#4ADE80",
  },
  {
    n: "03",
    title: "Same team. Every single visit.",
    body: "No rotating strangers. The same trusted pros show up each time - they learn your home, your preferences, your running list. It gets better the longer you're a member.",
    accent: "#86EFAC",
  },
  {
    n: "04",
    title: "Your home improves over time",
    body: "Instead of scrambling when things break, you stay ahead of it - month by month. Small issues handled before they become expensive ones.",
    accent: "#D4A574",
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative w-full overflow-hidden py-12 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[900px] -translate-x-1/2 rounded-full blur-[140px] opacity-50"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-[720px] text-center sm:mb-16 lg:mb-20">
          <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-3.5 py-1.5 shadow-[0_2px_12px_rgba(48,110,236,0.08)] sm:mb-6 sm:px-4 sm:py-2">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#306EEC]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Simple by Design
            </span>
          </div>

          <h2 className="mb-4 text-[28px] font-black leading-[1.02] tracking-[-0.03em] text-[#0B1628] sm:mb-5 sm:text-[50px] sm:leading-[0.92] sm:tracking-[-0.04em] lg:text-[60px]">
            One team. One bill.
            <br />
            <span className="text-[#306EEC]">No surprises.</span>
          </h2>

          <p className="mx-auto max-w-[540px] text-[15px] leading-relaxed text-[#475569] sm:text-[17px]">
            Most homeowners haven&apos;t seen this model before. Here&apos;s exactly what to expect - clear and simple.
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] top-[52px] hidden h-px lg:block"
            style={{
              background:
                "linear-gradient(90deg, rgba(48,110,236,0.25), rgba(74,222,128,0.30), rgba(134,239,172,0.25), rgba(212,165,116,0.20))",
            }}
          />

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4 lg:gap-6">
            {HOW_CARDS.map((card) => (
              <div key={card.n} className="relative flex flex-col">
                <div className="mb-4 flex items-center gap-3.5 sm:mb-5 sm:gap-4 lg:flex-col lg:items-start">
                  <div
                    className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-[0_8px_28px_rgba(48,110,236,0.14)] sm:h-14 sm:w-14"
                    style={{ borderColor: card.accent + "55" }}
                  >
                    <span className="text-[15px] font-black tracking-tight" style={{ color: card.accent }}>
                      {card.n}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold leading-snug text-[#0B1628] sm:text-[19px] lg:hidden">
                    {card.title}
                  </h3>
                </div>
                <h3 className="mb-3 hidden text-[17px] font-bold leading-snug text-[#0B1628] lg:block">
                  {card.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-[#475569] sm:text-[15px]">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div id="founder-story" className="mt-12 scroll-mt-[130px] sm:mt-20 lg:mt-28">
          <div className="mx-auto max-w-[860px] rounded-[24px] border border-[#DDE4F0] bg-white/82 px-5 py-9 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[28px] sm:px-10 sm:py-16 sm:shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:px-16 lg:py-20">
            <div className="mx-auto mb-6 h-px w-16 bg-[#D4A574]" />

            <div className="relative mx-auto h-[132px] w-[132px] overflow-hidden rounded-full border-[5px] border-white shadow-[0_18px_48px_rgba(15,23,42,0.16)] sm:h-[156px] sm:w-[156px]">
              <Image
                src="/images/Taras.png"
                alt="Taras Bandura, founder of Profixter"
                fill
                className="object-cover object-top"
                sizes="156px"
              />
            </div>

            <div className="mt-5">
              <div className="text-[18px] font-extrabold text-[#0B1628] sm:text-[20px]">
                Taras Bandura
              </div>
              <div className="mt-1 text-[13px] font-bold uppercase tracking-[0.18em] text-[#92724E]">
                Founder, Profixter
              </div>
            </div>

            <h3 className="mt-8 text-[29px] font-black leading-[1.06] tracking-[-0.03em] text-[#0B1628] sm:mt-10 sm:text-[48px] sm:leading-[1.02] sm:tracking-[-0.035em]">
              Why I Created Profixter
            </h3>

            <div className="mx-auto mt-6 max-w-[680px] space-y-4 text-left text-[15px] leading-[1.72] text-[#334155] sm:mt-8 sm:space-y-5 sm:text-[17px] sm:leading-[1.82]">
              <p>
                After nearly 10 years in home improvement and home maintenance, I noticed the same problem over and over again.
              </p>
              <p>
                Homeowners weren&apos;t struggling to find someone for a major renovation. They were struggling to find someone reliable for the small things.
              </p>
              <p>
                A leaking faucet. A loose door. A light fixture. Drywall repairs. A growing list of small jobs that never seemed important enough for contractors to prioritize.
              </p>
              <p>
                Every time something needed attention, homeowners had to start from scratch. They searched online, called multiple companies, waited for callbacks, scheduled estimates, compared prices, and hoped someone would actually show up.
              </p>
              <p>I kept thinking there had to be a better way.</p>
              <p className="text-[19px] font-extrabold leading-[1.55] text-[#0B1628] sm:text-[21px]">
                Your home needs regular attention, not just emergency repairs.
              </p>
              <p>That&apos;s why I created Profixter.</p>
              <p>
                Instead of finding a new handyman every time something breaks, members have a trusted team that gets to know their home over time. We show up regularly, help with ongoing maintenance, and take care of the small issues before they become expensive problems.
              </p>
              <div className="space-y-2 py-2 text-[17px] font-extrabold leading-relaxed text-[#0B1628]">
                <p>No estimate for every small task.</p>
                <p>No surprise invoices.</p>
                <p>No starting over every time.</p>
              </div>
              <p>Just a simple, predictable way to take care of your home.</p>
              <div className="pt-3 text-[#0B1628]">
                <p className="font-extrabold">Taras Bandura</p>
                <p className="text-[14px] font-semibold text-[#64748B]">Founder, Profixter</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
