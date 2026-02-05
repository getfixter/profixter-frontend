import Image from "next/image";

const STEPS = [
  {
    id: "01",
    title: "Create your Account",
    desc: "Sign up in just a few clicks. Provide basic info to get started and access your first booking.",
    align: "left" as const,
  },
  {
    id: "02",
    title: "Pick your plan",
    desc: "Choose the plan that fits your needs best and unlock exclusive savings with every visit.",
    align: "center" as const,
  },
  {
    id: "03",
    title: "Book first visit and relax",
    desc: "Create your first booking in a minute. Select date and time and enjoy the service.",
    align: "right" as const,
  },
];

export default function StepsSection() {
  return (
    <section
      id="how-it-works"
      className="w-full py-12 sm:py-16 lg:py-20 bg-transparent"
      aria-label="How it works"
    >
      <div className="mx-auto max-w-[1240px] px-5 sm:px-6 lg:px-5">
        <div className="relative">
          {/* Top side notes (desktop only) */}
          <div className="hidden lg:block absolute left-0 top-2 text-base text-[#6a6c71] leading-[19px]">
            Easy steps for easy life.
          </div>
          <div className="hidden lg:block absolute right-0 top-2 text-base text-[#6a6c71] leading-[19px]">
            Your first 7 days on us!
          </div>

          {/* Heading */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-3xl sm:text-5xl lg:text-[64px] font-bold tracking-[-0.05em] leading-tight lg:leading-[89%] text-[#313234]">
              <span>JUST </span>
              <span className="text-[#306eec]">3</span>
              <span> STEPS</span>
            </h2>
            <h2 className="mt-1 text-3xl sm:text-5xl lg:text-[64px] font-bold tracking-[-0.05em] leading-tight lg:leading-[89%] text-[#313234]">
              TO BE <span className="text-[#306eec]">HAPPY</span>
            </h2>
          </div>

          {/* ===== Mobile/Tablet ===== */}
          <div className="lg:hidden grid grid-cols-1 gap-6 sm:gap-8">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className="rounded-[18px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_10px_60px_rgba(0,0,0,0.10)] p-6 sm:p-7"
              >
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="text-6xl sm:text-7xl font-bold leading-none bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                      {s.id}
                    </div>
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#306eec] rounded-full shadow-[0_10px_30px_rgba(48,110,236,0.35)]" />
                  </div>

                  <div className="pt-1">
                    <h3 className="text-xl sm:text-2xl font-semibold text-[#313234] leading-tight">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm sm:text-base text-[#6a6c71] leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ===== Desktop ===== */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Wave line */}
              <div className="absolute left-1/2 top-[88px] -translate-x-1/2 w-[1200px] h-[250px] pointer-events-none">
                <Image
                  src="/images/icons/line.svg"
                  alt=""
                  fill
                  className="object-contain"
                  style={{
                    filter:
                      "drop-shadow(0px 29px 20px rgba(0, 0, 0, 0.25))",
                  }}
                  priority={false}
                />
              </div>

              {/* Desktop steps in 3 columns (no absolute positioning = stable) */}
              <div className="grid grid-cols-3 gap-10 items-start">
                {/* Step 01 */}
                <div className="pt-4">
                  <div className="max-w-[340px]">
                    <h3 className="text-2xl font-semibold text-[#313234] leading-[1.15]">
                      Create your <br />
                      Account
                    </h3>
                    <p className="mt-4 text-base text-[#6a6c71] leading-[19px]">
                      {STEPS[0].desc}
                    </p>

                    <div className="relative mt-10">
                      <div className="text-[128px] font-bold leading-[114px] bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                        01
                      </div>
                      {/* Dot aligned near wave */}
                      <div className="absolute -top-[34px] left-[52px] w-5 h-5 bg-[#306eec] rounded-full shadow-[0_10px_30px_rgba(48,110,236,0.35)]" />
                    </div>
                  </div>
                </div>

                {/* Step 02 */}
                <div className="pt-6 text-center">
                  <div className="mx-auto max-w-[360px]">
                    <div className="relative inline-block">
                      <div className="text-[128px] font-bold leading-[114px] bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                        02
                      </div>
                      <div className="absolute -top-[34px] left-1/2 -translate-x-1/2 w-5 h-5 bg-[#306eec] rounded-full shadow-[0_10px_30px_rgba(48,110,236,0.35)]" />
                    </div>

                    <h3 className="mt-4 text-2xl font-semibold text-[#313234] leading-[1.15]">
                      Pick your plan
                    </h3>
                    <p className="mt-4 text-base text-[#6a6c71] leading-[19px]">
                      {STEPS[1].desc}
                    </p>
                  </div>
                </div>

                {/* Step 03 */}
                <div className="pt-2 text-right">
                  <div className="ml-auto max-w-[340px]">
                    <h3 className="text-2xl font-semibold text-[#313234] leading-[1.15]">
                      Book first visit <br />
                      and relax
                    </h3>
                    <p className="mt-4 text-base text-[#6a6c71] leading-[19px]">
                      {STEPS[2].desc}
                    </p>

                    <div className="relative mt-10 inline-block">
                      <div className="text-[128px] font-bold leading-[114px] bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent">
                        03
                      </div>
                      <div className="absolute -top-[34px] left-[100px] w-5 h-5 bg-[#306eec] rounded-full shadow-[0_10px_30px_rgba(48,110,236,0.35)]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* subtle fade-in animation (safe, no libs) */}
              <style jsx>{`
                @media (prefers-reduced-motion: no-preference) {
                  .grid > div {
                    animation: stepsFade 600ms ease both;
                  }
                  .grid > div:nth-child(2) {
                    animation-delay: 80ms;
                  }
                  .grid > div:nth-child(3) {
                    animation-delay: 160ms;
                  }
                }
                @keyframes stepsFade {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
            </div>
          </div>

          {/* bottom spacing divider (keeps consistent gap before next section) */}
          <div className="h-10 sm:h-14 lg:h-16" />
        </div>
      </div>
    </section>
  );
}
