import Image from "next/image";

const STEPS = [
  {
    id: "01",
    title: "Create your Account",
    desc: "Sign up in just a few clicks. Provide basic info to get started and access your first booking.",
  },
  {
    id: "02",
    title: "Pick your plan",
    desc: "Choose the plan that fits your needs best and unlock exclusive savings with every visit.",
  },
  {
    id: "03",
    title: "Book first visit & relax",
    desc: "Create your first booking in a minute. Select date and time and enjoy the service.",
  },
];

export default function StepsSection() {
  return (
    <section
      id="how-it-works"
      aria-label="How it works"
      className="relative w-full py-12 sm:py-16 lg:py-20 overflow-hidden"
    >
      {/* ✅ Force readable background on ALL screens */}
      <div className="absolute inset-0 -z-10 bg-[#EEF2FF]" />
      {/* subtle premium glow */}
      <div
        className="absolute -z-10 left-1/2 top-[-520px] h-[980px] w-[980px] -translate-x-1/2 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(48,110,236,0.18) 0%, rgba(48,110,236,0.06) 35%, transparent 70%)",
        }}
      />
      {/* soft bottom fade */}
      <div className="absolute -z-10 inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/[0.03] to-transparent" />

      <div className="mx-auto max-w-[1240px] px-5 sm:px-6 lg:px-5">
        <div className="relative">
          {/* Side notes (desktop only) */}
          <div className="hidden lg:block absolute left-0 top-2 text-sm text-[#6a6c71]">
            Easy steps for easy life.
          </div>
          <div className="hidden lg:block absolute right-0 top-2 text-sm text-[#6a6c71]">
  Use promo Code "Spring" to get 20% off on first month.
</div>


          {/* Heading */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-14">
            <h2 className="text-3xl sm:text-5xl lg:text-[64px] font-extrabold tracking-[-0.05em] leading-[1.0] text-[#313234]">
              <span>JUST </span>
              <span className="text-[#306eec]">3</span>
              <span> STEPS</span>
            </h2>
            <h2 className="mt-1 text-3xl sm:text-5xl lg:text-[64px] font-extrabold tracking-[-0.05em] leading-[1.0] text-[#313234]">
              TO BE <span className="text-[#306eec]">HAPPY</span>
            </h2>
            <p className="mt-4 text-[#6a6c71] text-sm sm:text-base max-w-[680px] mx-auto">
              Quick signup, choose a plan, book online - and we’ll take care of the fixes.
            </p>
          </div>

          

          {/* ✅ Responsive layout:
              - Mobile/iPad: cards (always perfect)
              - Desktop: 3 columns, wave appears only on xl */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 relative">
            {STEPS.map((s, idx) => (
              <div
                key={s.id}
                className={[
                  "relative rounded-[22px] border border-black/10 bg-white/70 backdrop-blur-md",
                  "shadow-[0_16px_80px_rgba(0,0,0,0.10)]",
                  "p-6 sm:p-7 lg:p-8",
                  "transition-transform duration-200",
                  "hover:-translate-y-[2px]",
                ].join(" ")}
              >
                {/* dot */}
                <div className="absolute -top-2.5 left-6 sm:left-7 w-4 h-4 rounded-full bg-[#306eec] shadow-[0_12px_30px_rgba(48,110,236,0.35)]" />

                {/* big number */}
                <div className="flex items-start justify-between gap-4">
                  <div className="text-[64px] sm:text-[72px] lg:text-[84px] font-extrabold leading-none bg-gradient-to-b from-[#313234] to-transparent bg-clip-text text-transparent select-none">
                    {s.id}
                  </div>

                  {/* mini badge */}
                  <div className="mt-2 shrink-0 rounded-full px-3 py-1 text-xs font-semibold bg-[#306eec]/10 text-[#1B3E86] border border-[#306eec]/15">
                    Step {idx + 1}
                  </div>
                </div>

                <h3 className="mt-2 text-xl sm:text-2xl font-extrabold text-[#313234] leading-tight">
                  {s.title}
                </h3>

                <p className="mt-3 text-sm sm:text-base text-[#6a6c71] leading-relaxed">
                  {s.desc}
                </p>

                {/* subtle bottom accent */}
                <div className="mt-6 h-[2px] w-full bg-gradient-to-r from-[#306eec]/40 via-[#306eec]/10 to-transparent" />
              </div>
            ))}
          </div>

          {/* spacing */}
          <div className="h-8 sm:h-10 lg:h-12" />
        </div>
      </div>

      {/* ✅ Small fade-in animation (safe) */}
      <style jsx>{`
        @media (prefers-reduced-motion: no-preference) {
          section :global(.grid > div) {
            animation: stepsFade 520ms ease both;
          }
          section :global(.grid > div:nth-child(2)) {
            animation-delay: 90ms;
          }
          section :global(.grid > div:nth-child(3)) {
            animation-delay: 180ms;
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
    </section>
  );
}
