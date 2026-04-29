"use client";

import { useAuth } from "@/lib/useAuth";

type Task = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

export const POPULAR_TASKS: Task[] = [
  {
    title: "TV Mounting",
    subtitle: "Mounts, shelves & wall installs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Light Fixtures",
    subtitle: "Swaps, installs & dimmer upgrades",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 21h6M12 3a6 6 0 016 6c0 2.5-1.5 4.6-3.5 5.7V17H9.5v-2.3C7.5 13.6 6 11.5 6 9a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Faucets & Minor Leaks",
    subtitle: "Common bathroom & kitchen fixes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v6M5 8h14M6 8v8a2 2 0 002 2h8a2 2 0 002-2V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9 12v4M15 12v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Doors & Locks",
    subtitle: "Handles, alignment & hardware",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M15 14v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Drywall Patches",
    subtitle: "Small holes, dents & touch-ups",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Caulking & Sealing",
    subtitle: "Bathrooms, kitchens & trim",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Furniture Assembly",
    subtitle: "Common home setup jobs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="8" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 8V6a2 2 0 012-2h6a2 2 0 012 2v2M7 18v2M17 18v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Shelves & Wall Hardware",
    subtitle: "Secure, level & clean installs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 9h18v2H3zM3 15h18v2H3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7 11v4M12 11v4M17 11v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Paint Touch-Ups",
    subtitle: "Small refreshes & scuff repairs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12l10-10 10 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 8l-5 5-5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="13" width="6" height="9" rx="1" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    title: "Home Maintenance Lists",
    subtitle: "Multiple small fixes in one visit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Other Small Home Tasks",
    subtitle: "If it fits the visit, we can usually help",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function PopularTasksSection() {
  const { user, isAuthenticated } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr) => addr.hasActiveSubscription);

  const handleTaskClick = () => {
    const targetId = isSubscribed ? "pick-day" : "plans";
    const el = document.getElementById(targetId);
    if (!el) return;
    const y =
      el.getBoundingClientRect().top +
      window.scrollY -
      (window.innerWidth >= 1024 ? 160 : 120);
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", `#${targetId}`);
  };

  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{
        background:
          "linear-gradient(160deg, #0A1320 0%, #0C1829 60%, #091220 100%)",
      }}
    >
      {/* Background depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 70% 20%, rgba(48,110,236,0.07) 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(26,58,120,0.09) 0%, transparent 45%)",
        }}
      />
      {/* Dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-14 lg:mb-16">
          <div className="max-w-[640px]">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 backdrop-blur-sm mb-7">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#86EFAC]"
                aria-hidden="true"
              >
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                What Members Book
              </span>
            </div>

            <h2 className="text-[40px] sm:text-[56px] lg:text-[68px] font-black leading-[0.88] tracking-[-0.045em] text-white mb-5">
              Popular tasks
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)",
                }}
              >
                we handle.
              </span>
            </h2>

            <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
              Common jobs members book each month. Each visit covers up to
              90 minutes of work &mdash; tackle one task or a quick punch list.
            </p>
          </div>

          {/* Stat chips — desktop */}
          <div className="hidden lg:flex flex-col gap-3 flex-shrink-0">
            {[
              { value: "90 min", label: "per visit" },
              { value: "1 team", label: "same pros, every time" },
              { value: "$0", label: "estimates ever" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-[16px] border border-white/[0.08] bg-white/[0.04] px-5 py-3"
              >
                <span className="text-[22px] font-extrabold text-white leading-none">
                  {value}
                </span>
                <span className="text-[13px] text-white/40 font-semibold">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Task grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] rounded-[24px] overflow-hidden border border-white/[0.06]">
          {POPULAR_TASKS.map((task, i) => (
            <button
              key={task.title}
              type="button"
              onClick={handleTaskClick}
              className="group relative flex items-start gap-4 bg-[#0A1320] px-5 py-5 sm:px-6 sm:py-6 text-left transition-all duration-200 hover:bg-white/[0.05] focus:outline-none focus:bg-white/[0.05]"
            >
              {/* Icon */}
              <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] border border-white/[0.09] bg-white/[0.05] text-white/50 group-hover:border-[#86EFAC]/25 group-hover:bg-[#86EFAC]/[0.06] group-hover:text-[#86EFAC] transition-all duration-200">
                {task.icon}
              </div>

              {/* Copy */}
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-white/82 leading-snug group-hover:text-white transition-colors">
                  {task.title}
                </div>
                <div className="mt-0.5 text-[12px] text-white/38 leading-relaxed">
                  {task.subtitle}
                </div>
              </div>

              {/* Arrow — appears on hover */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-1 flex-shrink-0 text-white/15 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                aria-hidden="true"
              >
                <path
                  d="M9 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>

        {/* ── Footer bar ── */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-5 rounded-[20px] border border-white/[0.08] bg-white/[0.03] px-6 py-5">
          <p className="text-[14px] text-white/40 leading-relaxed text-center sm:text-left">
            <span className="text-white/65 font-semibold">
              Not seeing your task?
            </span>{" "}
            If it fits within a 90-minute visit, we can almost always help.
            Describe it when you book.
          </p>

          <button
            type="button"
            onClick={handleTaskClick}
            className="flex-shrink-0 inline-flex items-center gap-2.5 rounded-[14px] bg-[#306EEC] px-6 py-3.5 text-[14px] font-extrabold text-white transition-all duration-300 hover:bg-[#2558c9] hover:-translate-y-0.5 active:scale-[0.99]"
            style={{ boxShadow: "0 12px 36px rgba(48,110,236,0.30)" }}
          >
            {isSubscribed ? "Book a Visit" : "See Membership Plans"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
