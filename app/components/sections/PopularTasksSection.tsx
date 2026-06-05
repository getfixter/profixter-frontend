"use client";

import Link from "next/link";

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

const PROJECT_CATEGORIES = [
  "Roofing",
  "Siding",
  "Bathroom Remodeling",
  "Kitchen Remodeling",
  "Basement Finishing",
  "Interior Renovations",
] as const;

const PROJECT_BENEFITS = [
  "One contractor relationship",
  "One trusted team",
  "Ongoing support after the project",
  "More value from your investment",
] as const;

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M6 13l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PopularTasksSection() {
  return (
    <section
      id="larger-projects"
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{
        background:
          "linear-gradient(160deg, #F7F4EE 0%, #EEF3F8 48%, #E6ECF6 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 right-[-120px] h-[560px] w-[560px] rounded-full bg-[#D4A574]/18 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-260px] left-[-160px] h-[620px] w-[620px] rounded-full bg-[#306EEC]/10 blur-[150px]"
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className="max-w-[620px]">
            <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/25 bg-white/70 px-4 py-2 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#D4A574]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#92724E]">
                Larger Home Projects
              </span>
            </div>

            <h2 className="text-[38px] font-black leading-[0.95] tracking-[-0.04em] text-[#0B1628] sm:text-[54px] lg:text-[64px]">
              Do a project with us.
              <br />
              <span className="text-[#306EEC]">Get up to 12 months free.</span>
            </h2>

            <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-[#475569] sm:text-[18px]">
              When you hire us for a larger project, we&apos;ll include up to 12 months of Profixter membership at no additional cost.
            </p>

            <div className="mt-8 rounded-[24px] border border-white/70 bg-white/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:p-6">
              <p className="text-[15px] font-bold leading-relaxed text-[#0B1628] sm:text-[16px]">
                We take care of the project first, then keep helping maintain your home after the work is done.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PROJECT_BENEFITS.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#E8F8EE] text-[#1E9B58]">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[14px] font-semibold leading-snug text-[#334155]">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/estimate"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-[#0B1628] px-7 text-[15px] font-extrabold text-white shadow-[0_18px_44px_rgba(15,23,42,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#14233A]"
              >
                Get Project Estimate
              </Link>
              <Link
                href="/roofing"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] border border-[#CBD5E1] bg-white/65 px-7 text-[15px] font-extrabold text-[#0B1628] transition-all hover:-translate-y-0.5 hover:border-[#94A3B8] hover:bg-white"
              >
                View Roofing &amp; Siding
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur-md sm:p-5 lg:p-6">
              <div className="overflow-hidden rounded-[24px] border border-[#DDE4F0] bg-[#F8FAFC]">
                <div className="relative min-h-[210px] overflow-hidden bg-[#162235] sm:min-h-[240px]">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-85"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, rgba(11,22,40,0.10), rgba(11,22,40,0.70)), url('/images/hero-bg.webp')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="relative flex min-h-[210px] flex-col justify-between gap-12 p-5 sm:min-h-[240px] sm:p-6">
                    <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/16 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-md sm:text-[11px] sm:tracking-[0.16em]">
                      Free Membership Included
                    </div>
                    <div>
                      <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/62">
                        Large Project
                      </div>
                      <div className="mt-1 max-w-[360px] text-[28px] font-black leading-[1] tracking-[-0.035em] text-white sm:text-[34px]">
                        Better work now. Better care after.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-[#DDE4F0] sm:grid-cols-2">
                  {PROJECT_CATEGORIES.map((project) => (
                    <div key={project} className="bg-white px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] font-extrabold text-[#0B1628]">
                          {project}
                        </span>
                        <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#306EEC]">
                          Project
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                {[
                  { title: "Large project", body: "Roof, siding, remodel, or renovation" },
                  { title: "Free membership", body: "Up to 12 months included" },
                  { title: "Ongoing care", body: "Regular handyman support after" },
                ].map((step, index) => (
                  <div key={step.title} className="contents">
                    <div className="rounded-[18px] border border-[#E2E8F0] bg-white/74 p-4 text-center">
                      <div className="text-[13px] font-extrabold text-[#0B1628]">
                        {step.title}
                      </div>
                      <div className="mt-1 text-[12px] font-medium leading-snug text-[#64748B]">
                        {step.body}
                      </div>
                    </div>
                    {index < 2 && (
                      <div className="flex justify-center text-[#94A3B8] sm:rotate-[-90deg]">
                        <ArrowDownIcon />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
