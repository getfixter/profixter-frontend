"use client";

import Link from "next/link";

const DEPARTMENTS = [
  {
    title: "Home Maintenance Membership",
    description:
      "Choose the plan that fits your home - from simple ongoing tasks to larger full-day projects.",
    href: "/membership#plans",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    badge: "Most Popular",
    badgeColor: "#306EEC",
    badgeBg: "rgba(48,110,236,0.10)",
    badgeBorder: "rgba(48,110,236,0.20)",
  },
  {
    title: "General Contractor",
    description:
      "Large renovations, additions, and custom projects handled start to finish.",
    href: "/services/general-contractor",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 20h20M4 20V10l8-6 8 6v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
    badge: null,
  },
  {
    title: "Home Improvement",
    description:
      "Medium-sized jobs like painting, flooring, and cabinetry done right.",
    href: "/services/home-improvement",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 010 1.4l-8 8a1 1 0 01-.4.3l-4 1a1 1 0 01-1.3-1.3l1-4a1 1 0 01.3-.4l8-8a1 1 0 011.4 0l3 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 5.5l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    badge: null,
  },
  {
    title: "One-Time Service",
    description:
      "Need one small fix now? Book a $99 One-Time Visit.",
    href: "/book",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7v5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    badge: null,
  },
];

export default function DepartmentsSection() {
  return (
    <section
      id="departments"
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.12), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mx-auto max-w-[680px] text-center mb-12 sm:mb-14 lg:mb-16">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Our Services
            </span>
          </div>

          <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
            Every way we can
            <br />
            <span className="text-[#306EEC]">help your home.</span>
          </h2>

          <p className="mx-auto max-w-[520px] text-[15px] sm:text-[17px] leading-relaxed text-[#475569]">
            From monthly memberships to one-time repairs and full renovations -
            pick the service that fits your situation.
          </p>
        </div>

        {/* ── Card grid ── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DEPARTMENTS.map((dept) => (
            <Link
              key={dept.href}
              href={dept.href}
              className="group relative flex flex-col rounded-[24px] border border-[#C5CBD8] bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_56px_rgba(15,23,42,0.12)] hover:-translate-y-1 focus:outline-none"
            >
              {/* Badge */}
              {dept.badge && (
                <div
                  className="absolute top-5 right-5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    color: dept.badgeColor,
                    background: dept.badgeBg,
                    border: `1px solid ${dept.badgeBorder}`,
                  }}
                >
                  {dept.badge}
                </div>
              )}

              {/* Icon */}
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#EEF2FF] text-[#306EEC] transition-all duration-200 group-hover:bg-[#306EEC] group-hover:text-white">
                {dept.icon}
              </div>

              {/* Copy */}
              <h3 className="mb-2.5 text-[17px] font-bold text-[#0B1628] leading-snug group-hover:text-[#306EEC] transition-colors">
                {dept.title}
              </h3>
              <p className="flex-grow text-[14px] leading-relaxed text-[#64748B]">
                {dept.description}
              </p>

              {/* Arrow */}
              <div className="mt-6 flex items-center gap-1.5 text-[13px] font-semibold text-[#306EEC] opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
                Learn more
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
