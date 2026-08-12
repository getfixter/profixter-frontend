"use client";

import Image from "next/image";

const HOW_CARDS = [
  {
    n: "01",
    title: "One home care relationship",
    body: "Instead of starting over with a new contractor each time, your home has one familiar team and one simple membership.",
    accent: "#306EEC",
  },
  {
    n: "02",
    title: "Book when the list is ready",
    body: "Log in, choose a day, add notes and photos, and tell us what to handle during your visit.",
    accent: "#4ADE80",
  },
  {
    n: "03",
    title: "The team learns your home",
    body: "Over time, Profixter knows your preferences, recurring issues, access details, and the repairs you care about most.",
    accent: "#86EFAC",
  },
  {
    n: "04",
    title: "Your home improves over time",
    body: "Small items stop piling up. Maintenance becomes easier to plan. Homeownership feels less reactive.",
    accent: "#D4A574",
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative w-full overflow-hidden py-8 sm:py-13 lg:py-12"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[900px] -translate-x-1/2 rounded-full blur-[140px] opacity-50"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-7 max-w-[720px] text-center sm:mb-16 lg:mb-20">
          <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-3.5 py-1.5 shadow-[0_2px_12px_rgba(48,110,236,0.08)] sm:mb-6 sm:px-4 sm:py-2">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#306EEC]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Simple by Design
            </span>
          </div>

          <h2 className="mb-4 text-[26px] font-black leading-[1.02] tracking-[-0.03em] text-[#0B1628] sm:mb-5 sm:text-[40px] sm:leading-[0.92] sm:tracking-[-0.04em] lg:text-[43px]">
            One team. One home.
            <br />
            <span className="text-[#306EEC]">Ongoing care.</span>
          </h2>

          <p className="mx-auto max-w-[540px] text-[15px] leading-relaxed text-[#475569] sm:text-[17px]">
            Membership turns home maintenance into a simple routine instead of a new search every time something breaks.
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

        <div id="founder-story" className="mt-8 scroll-mt-[130px] sm:mt-20 lg:mt-28">
          <div className="mx-auto max-w-[860px] rounded-[16px] border border-[#DDE4F0] bg-white/82 px-5 py-9 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:rounded-[16px] sm:px-10 sm:py-11 sm:shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:px-16 lg:py-14">
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
              <div className="text-[18px] font-extrabold text-[#0B1628] sm:text-[19px]">
                Taras Bandura
              </div>
              <div className="mt-1 text-[13px] font-bold uppercase tracking-[0.18em] text-[#92724E]">
                Founder, Profixter
              </div>
            </div>

            <h3 className="mt-8 text-[26px] font-black leading-[1.06] tracking-[-0.03em] text-[#0B1628] sm:mt-10 sm:text-[36px] sm:leading-[1.02] sm:tracking-[-0.035em]">
              Why Profixter exists
            </h3>

            <div className="mx-auto mt-6 max-w-[680px] space-y-4 text-left text-[15px] leading-[1.72] text-[#334155] sm:mt-8 sm:space-y-5 sm:text-[17px] sm:leading-[1.78]">
              <p>
                After nearly 10 years in home improvement and home maintenance, I kept seeing the same gap.
              </p>
              <p>
                Homeowners could usually find someone for a major renovation. The hard part was finding reliable help for the everyday things: the leak, the loose door, the fixture, the drywall patch, the list that keeps getting pushed off.
              </p>
              <p>
                Every small issue forced people to start over. Search again. Call again. Explain the house again. Hope someone shows up.
              </p>
              <p className="text-[19px] font-extrabold leading-[1.55] text-[#0B1628] sm:text-[19px]">
                Your home needs regular attention, not a new contractor search every month.
              </p>
              <p>
                That&apos;s why Profixter is built around Membership. Members have one team that gets to know the home, keeps the list moving, and helps small issues get handled before they become bigger problems.
              </p>
              <div className="grid gap-2 py-2 text-[15px] font-extrabold leading-relaxed text-[#0B1628] sm:grid-cols-3 sm:text-center">
                <p className="rounded-[16px] bg-[#F8FAFF] px-4 py-3">No starting over.</p>
                <p className="rounded-[16px] bg-[#F8FAFF] px-4 py-3">No contractor chase.</p>
                <p className="rounded-[16px] bg-[#F8FAFF] px-4 py-3">No guesswork.</p>
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
