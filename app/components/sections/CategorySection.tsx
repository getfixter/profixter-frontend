"use client";

const OLD_WAY = [
  "Something breaks → start searching",
  "Call multiple handymen, leave voicemails",
  "Wait for callbacks that never come",
  "Get quotes and estimates for small jobs",
  "Unpredictable bills every time",
  "Different stranger at your door each visit",
];

const PROFIXTER_WAY = [
  "Membership lets you request help as needed",
  "Book online in 60 seconds",
  "Confirmed slot, same-day response",
  "No estimates for covered work",
  "Flat monthly rate, no surprises",
  "Same trusted professional, every visit",
];

export default function CategorySection() {
  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(180deg, #080F1E 0%, #060C18 100%)" }}
    >
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.18), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full blur-[180px] opacity-25"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.20), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 mb-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              A New Model
            </span>
          </div>
          <h2 className="text-[30px] sm:text-[46px] font-extrabold text-white leading-[1.08] tracking-[-0.03em] mb-4">
            A better way to take care of your home
          </h2>
          <p className="text-[15px] sm:text-[17px] text-white/48 max-w-[600px] mx-auto leading-relaxed">
            Most homeowners wait until something breaks, then start searching for help.
            Profixter flips that: one reliable team, easy online booking, and ongoing help so your home stays under control.
          </p>
        </div>

        {/* Comparison table */}
        <div className="max-w-[900px] mx-auto">

          {/* Column headers */}
          <div className="grid grid-cols-2 gap-4 mb-3 px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/12 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.35)" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-white/30">The old way</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#306EEC]/20 border border-[#306EEC]/30 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#7BAEFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#7BAEFF]">Profixter</span>
            </div>
          </div>

          {/* Rows */}
          <div className="rounded-[24px] overflow-hidden border border-white/[0.07]">
            {OLD_WAY.map((old, i) => (
              <div
                key={i}
                className={`grid grid-cols-2 gap-0 ${i < OLD_WAY.length - 1 ? "border-b border-white/[0.06]" : ""}`}
              >
                {/* Old way cell */}
                <div className="flex items-start gap-3 px-5 py-4 sm:px-7 sm:py-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
                    <path d="M18 6L6 18M6 6l12 12" stroke="rgba(239,68,68,0.55)" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                  <span className="text-[13px] sm:text-[14px] text-white/32 leading-snug">{old}</span>
                </div>

                {/* Profixter cell */}
                <div
                  className="flex items-start gap-3 px-5 py-4 sm:px-7 sm:py-5 border-l border-white/[0.06]"
                  style={{ background: "rgba(48,110,236,0.04)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
                    <path d="M5 12.5l4 4 10-10" stroke="#4ADE80" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[13px] sm:text-[14px] text-white/80 leading-snug">{PROFIXTER_WAY[i]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom statement */}
          <p className="text-center mt-7 text-[14px] sm:text-[15px] text-white/38 leading-relaxed">
            This isn&rsquo;t just a different service.{" "}
            <span className="text-white/65 font-semibold">It&rsquo;s a different system.</span>
          </p>
        </div>

      </div>
    </section>
  );
}
