"use client";

const MONTHS = [
  {
    label: "Month 1",
    color: "#306EEC",
    bgColor: "rgba(48,110,236,0.08)",
    borderColor: "rgba(48,110,236,0.22)",
    tasks: ["Fixed sticking door", "Patched drywall near bathroom", "Installed new light fixture"],
  },
  {
    label: "Month 2",
    color: "#4ADE80",
    bgColor: "rgba(74,222,128,0.07)",
    borderColor: "rgba(74,222,128,0.22)",
    tasks: ["Re-caulked shower & kitchen", "Tightened leaking faucet", "Mounted TV & ran cables"],
  },
  {
    label: "Month 3",
    color: "#D4A574",
    bgColor: "rgba(212,165,116,0.08)",
    borderColor: "rgba(212,165,116,0.22)",
    tasks: ["Adjusted closet doors & hardware", "Seasonal HVAC filter check", "Fixed squeaky stair tread"],
  },
] as const;

export default function RealLifeSection() {
  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[900px] rounded-full blur-[140px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Real Member Experience
            </span>
          </div>
          <h2 className="text-[30px] sm:text-[46px] font-extrabold text-[#0B1628] leading-[1.08] tracking-[-0.03em] mb-4">
            This is how most homeowners
            <br className="hidden sm:block" />
            <span className="text-[#306EEC]"> use Profixter</span>
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#475569] max-w-[520px] mx-auto leading-relaxed">
            Not one giant repair day. Just small, consistent care - month after month - that keeps your home in great shape.
          </p>
        </div>

        {/* Month cards */}
        <div className="grid sm:grid-cols-3 gap-5 sm:gap-6 max-w-[960px] mx-auto mb-10">
          {MONTHS.map(({ label, color, bgColor, borderColor, tasks }) => (
            <div
              key={label}
              className="rounded-[22px] p-7 flex flex-col gap-5"
              style={{ background: bgColor, border: `1px solid ${borderColor}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-extrabold text-white"
                  style={{ background: color }}
                >
                  {label.split(" ")[1]}
                </div>
                <span className="text-[15px] font-extrabold text-[#0B1628]">{label}</span>
              </div>
              <ul className="space-y-2.5">
                {tasks.map((task) => (
                  <li key={task} className="flex items-start gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
                      <path d="M5 12.5l4 4 10-10" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[14px] text-[#334155] leading-snug">{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom line */}
        <div className="max-w-[680px] mx-auto text-center">
          <div className="rounded-[20px] border border-[#C5CBD8] bg-white px-8 py-6 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
            <p className="text-[17px] sm:text-[19px] font-extrabold text-[#0B1628] leading-snug mb-2">
              &ldquo;Instead of waiting until everything breaks, you stay ahead of your home.&rdquo;
            </p>
            <p className="text-[14px] text-[#64748B] leading-relaxed">
              Members handle 8–12 tasks over a typical quarter - things that would otherwise pile up into a stressful to-do list or an expensive emergency call.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
