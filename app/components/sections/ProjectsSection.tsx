"use client";

import { useState } from "react";
import Image from "next/image";
import { trackEvent } from "@/lib/analytics";

const PROJECTS = [
  { id: 1, image: "/images/projects/p1.jpg", label: "Door Painting", category: "Painting" },
  { id: 2, image: "/images/projects/p2.jpg", label: "Door Frame Seal", category: "Exterior" },
  { id: 3, image: "/images/projects/p3.jpg", label: "Ceiling Repair", category: "Drywall" },
  { id: 4, image: "/images/projects/p4.jpg", label: "Exterior Paint", category: "Exterior" },
  { id: 5, image: "/images/projects/p5.jpg", label: "Vanity Refinish", category: "Bathroom" },
  { id: 6, image: "/images/projects/p6.jpg", label: "Cabinet Refresh", category: "Carpentry" },
  { id: 7, image: "/images/projects/p7.jpg", label: "Roof Repair", category: "Roofing" },
  { id: 8, image: "/images/projects/p8.jpg", label: "Floor Replacement", category: "Flooring" },
  { id: 9, image: "/images/projects/p9.jpg", label: "Vanity Install", category: "Bathroom" },
  { id: 10, image: "/images/projects/p10.jpg", label: "AC Install", category: "HVAC" },
];

const AUTHORITY_STATS = [
  { value: "10+", label: "Project types" },
  { value: "9+ yrs", label: "On Long Island" },
  { value: "5.0 ★", label: "Google Rating" },
];

export default function ProjectsSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = PROJECTS[activeIdx];

  const scrollToPlans = () => {
    trackEvent("view_plans", { placement: "projects" });
    const el = document.getElementById("plans");
    if (!el) return;
    const y =
      el.getBoundingClientRect().top +
      window.scrollY -
      (window.innerWidth >= 1024 ? 160 : 120);
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", "#plans");
  };

  return (
    <section
      id="projects"
      className="w-full overflow-hidden relative scroll-mt-[110px] py-10 sm:py-13 lg:py-12"
      style={{
        background:
          "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #0B1628 100%)",
      }}
    >
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[160px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.12), transparent 70%)" }}
      />
      {/* Dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-8 lg:mb-14">
          <div className="max-w-[580px]">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 mb-7 backdrop-blur-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#86EFAC]" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                Our Work - Real Long Island Homes
              </span>
            </div>

            <h2 className="text-[34px] sm:text-[43px] lg:text-[46px] font-black leading-[0.88] tracking-[-0.045em] text-white mb-5">
              Results we&rsquo;re
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, #86EFAC 0%, #4ADE80 50%, #86EFAC 100%)" }}
              >
                proud of.
              </span>
            </h2>

            <p className="text-[15px] sm:text-[17px] text-white/55 leading-relaxed">
              Real results from real Long Island homes - the craftsmanship
              our members see visit after visit.
            </p>
          </div>

          {/* Stats - desktop */}
          <div className="hidden lg:flex gap-4 flex-shrink-0">
            {AUTHORITY_STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-[13px] border border-white/[0.09] bg-white/[0.04] px-5 py-4 text-center min-w-[100px]"
              >
                <div className="text-[21px] font-extrabold text-white leading-none mb-1.5">
                  {value}
                </div>
                <div className="text-[11px] font-semibold text-white/38">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main layout ── */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-6 lg:gap-8 items-start">

          {/* ── Left: featured image + thumbnail strip ── */}
          <div className="flex flex-col gap-4">

            {/* Featured image */}
            <div
              className="relative w-full overflow-hidden rounded-[16px] group"
              style={{ aspectRatio: "16/10" }}
            >
              {/* Main photo */}
              <Image
                src={active.image}
                alt={active.label}
                fill
                className="object-cover transition-all duration-500"
                sizes="(max-width: 1024px) 92vw, 780px"
                priority
              />

              {/* Premium cinematic vignette */}
              <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.40)] rounded-[16px]" />

              {/* Bottom gradient overlay */}
              <div
                className="absolute inset-x-0 bottom-0 h-[55%]"
                style={{ background: "linear-gradient(to top, rgba(8,15,30,0.85) 0%, rgba(8,15,30,0.40) 55%, transparent 100%)" }}
              />

              {/* Top-left category chip */}
              <div className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC] flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/85">
                  {active.category}
                </span>
              </div>

              {/* Top-right: project counter */}
              <div className="absolute top-5 right-5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/50">
                {activeIdx + 1} / {PROJECTS.length}
              </div>

              {/* Bottom overlay: room label + location */}
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-8 flex items-end justify-between">
                <div>
                  <div className="text-[26px] sm:text-[30px] font-black text-white leading-none tracking-[-0.025em] mb-1">
                    {active.label}
                  </div>
                  <div className="text-[12px] font-semibold text-white/45 uppercase tracking-[0.18em]">
                    Long Island, NY
                  </div>
                </div>

                {/* Navigation arrows */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveIdx((i) => (i - 1 + PROJECTS.length) % PROJECTS.length)}
                    aria-label="Previous project"
                    className="w-10 h-10 rounded-full border border-white/20 bg-white/[0.10] backdrop-blur-sm flex items-center justify-center hover:bg-white/[0.20] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveIdx((i) => (i + 1) % PROJECTS.length)}
                    aria-label="Next project"
                    className="w-10 h-10 rounded-full border border-white/20 bg-white/[0.10] backdrop-blur-sm flex items-center justify-center hover:bg-white/[0.20] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Thumbnail strip */}
            <div
              className="flex gap-2.5 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {PROJECTS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  aria-label={`View ${p.label}`}
                  className={`relative flex-shrink-0 w-[72px] h-[46px] rounded-[10px] overflow-hidden border-2 transition-all duration-200 focus:outline-none ${
                    i === activeIdx
                      ? "border-[#86EFAC] shadow-[0_0_14px_rgba(134,239,172,0.22)]"
                      : "border-white/[0.08] hover:border-white/25 opacity-60 hover:opacity-90"
                  }`}
                >
                  <Image src={p.image} alt={p.label} fill className="object-cover" sizes="72px" />
                  {i === activeIdx && (
                    <div className="absolute inset-0 bg-gradient-to-t from-[#86EFAC]/10 to-transparent" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: info + CTA ── */}
          <div className="flex flex-col gap-4">

            {/* Trust card */}
            <div
              className="rounded-[14px] border border-white/[0.09] p-6 flex flex-col gap-5"
              style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)" }}
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 mb-2">
                  Why members stay
                </div>
                <p className="text-[15px] font-semibold text-white/80 leading-snug">
                  The same trusted team who already knows your home.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: "★", text: "4.9 Google Rating" },
                  { icon: "✓", text: "Same team, every visit" },
                  { icon: "✓", text: "No estimates - ever" },
                  { icon: "✓", text: "Licensed HI-71484" },
                  { icon: "✓", text: "9+ years on Long Island" },
                ].map(({ text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="#86EFAC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[13px] text-white/60">{text}</span>
                  </div>
                ))}
              </div>

              {/* Member quote */}
              <div className="pt-1 border-t border-white/[0.07]">
                <p className="text-[12px] text-white/35 leading-relaxed italic">
                  &ldquo;They remembered exactly how we like things done.
                  That&rsquo;s rare.&rdquo;
                </p>
                <p className="mt-1.5 text-[11px] font-bold text-white/25 uppercase tracking-[0.15em]">
                  - Long Island homeowner
                </p>
              </div>
            </div>

            {/* CTA card */}
            <div
              className="rounded-[14px] border border-[#306EEC]/20 p-6 flex flex-col gap-4"
              style={{ background: "linear-gradient(145deg, rgba(48,110,236,0.12) 0%, rgba(48,110,236,0.06) 100%)" }}
            >
              <div>
                <p className="text-[16px] font-bold text-white mb-1">
                  Your home could look like this.
                </p>
                <p className="text-[13px] text-white/45 leading-relaxed">
                  Members get the same trusted team - every single visit. Your
                  home gets better, not just fixed.
                </p>
              </div>
              <button
                type="button"
                onClick={scrollToPlans}
                className="w-full min-h-[46px] rounded-[14px] bg-[#306EEC] text-white text-[15px] font-extrabold transition-all hover:bg-[#2558c9] active:scale-[0.99]"
                style={{ boxShadow: "0 12px 36px rgba(48,110,236,0.30)" }}
              >
                See Membership Plans
              </button>
            </div>

            {/* Mobile stats */}
            <div className="lg:hidden grid grid-cols-3 gap-3">
              {AUTHORITY_STATS.map(({ value, label }) => (
                <div
                  key={label}
                  className="rounded-[14px] border border-white/[0.09] bg-white/[0.04] p-3 text-center"
                >
                  <div className="text-[18px] font-extrabold text-white leading-none mb-1">{value}</div>
                  <div className="text-[10px] font-semibold text-white/38 leading-tight">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
