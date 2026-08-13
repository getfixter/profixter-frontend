"use client";

import Image from "next/image";

/**
 * RemodelingSection
 *
 * High-ticket authority section for Full Bathroom & Kitchen Remodeling.
 * Two premium service cards with strong visual hierarchy, clear value props,
 * and direct CTA to contact Taras directly.
 *
 * Both services are positioned as complete transformations -
 * not handyman-level patches.
 */

const REMODELING_PHONE_DISPLAY = "631-599-1363";
const REMODELING_PHONE_TEL = "+16315991363";

const SERVICES = [
  {
    id: "bathroom",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 6a3 3 0 015.12-2.12A3 3 0 0117 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="6" width="20" height="4" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 10v8a2 2 0 002 2h12a2 2 0 002-2v-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 10v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    label: "Full Bathroom Remodeling",
    headline: "Complete bathroom transformations - start to finish.",
    description:
      "Full gut-and-rebuild or strategic upgrades. We handle tile, fixtures, plumbing coordination, vanities, lighting, and every detail in between. One team. One project. No subcontractor chaos.",
    features: [
      "Full tile & fixture replacement",
      "Vanity, mirror & lighting upgrades",
      "Shower & tub conversion",
      "Plumbing & ventilation coordination",
      "Waterproofing & moisture barrier",
      "Clean finish on every surface",
    ],
    accent: "#306EEC",
    accentSoft: "rgba(48,110,236,0.10)",
    accentBorder: "rgba(48,110,236,0.20)",
    bgGradient:
      "linear-gradient(145deg, #FAFBFF 0%, #F2F5FF 100%)",
    image: "/images/projects/p3.jpg",
  },
  {
    id: "kitchen",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="20" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2 10v11h20V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 3v7M16 3v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    label: "Full Kitchen Remodeling",
    headline: "A kitchen that matches how you actually live.",
    description:
      "Cabinets, countertops, backsplash, appliance vendor coordination, lighting, and layout - all managed by a single trusted team. We bring the vision together without the month-long disruption of juggling multiple contractors.",
    features: [
      "Custom cabinetry & hardware",
      "Countertop & backsplash installation",
      "Appliance vendor coordination",
      "Island & layout reconfiguration",
      "Under-cabinet & pendant lighting",
      "Finish carpentry & trim work",
    ],
    accent: "#0F172A",
    accentSoft: "rgba(15,23,42,0.07)",
    accentBorder: "rgba(15,23,42,0.14)",
    bgGradient:
      "linear-gradient(145deg, #FAF9F7 0%, #F3F0EC 100%)",
    image: "/images/projects/p7.jpg",
  },
] as const;

function ServiceCard({
  service,
}: {
  service: (typeof SERVICES)[number];
}) {
  const callNow = () => {
    window.location.href = `tel:${REMODELING_PHONE_TEL}`;
  };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[8px] shadow-[0_32px_80px_rgba(15,23,42,0.10)] border border-[#E5E9F2] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_44px_100px_rgba(15,23,42,0.14)]"
      style={{ background: service.bgGradient }}
    >
      {/* Image */}
      <div className="relative h-[220px] sm:h-[260px] overflow-hidden">
        <Image
          src={service.image}
          alt={service.label}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 92vw, 580px"
        />
        {/* Gradient over image */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.30) 100%)",
          }}
        />
        {/* Service label chip */}
        <div className="absolute bottom-4 left-5">
          <div
            className="inline-flex items-center gap-2 rounded-[6px] px-3.5 py-1.5"
            style={{
              background: service.bgGradient,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ color: service.accent, opacity: 0.85 }}>
              {service.icon}
            </div>
            <span
              className="text-[12px] font-bold uppercase tracking-[0.14em]"
              style={{ color: service.accent }}
            >
              {service.label}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-7 sm:p-8">
        {/* Headline */}
        <h3 className="text-[21px] sm:text-[23px] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#0F172A] mb-3">
          {service.headline}
        </h3>

        {/* Description */}
        <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed mb-7">
          {service.description}
        </p>

        {/* Features */}
        <ul className="space-y-2.5 mb-8">
          {service.features.map((feat) => (
            <li key={feat} className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: service.accentSoft,
                  border: `1px solid ${service.accentBorder}`,
                }}
              >
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                  <path
                    d="M1 3.5l2 2L8 1"
                    stroke={service.accent}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-[14px] font-semibold text-[#334155]">
                {feat}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={callNow}
            className="w-full min-h-[48px] rounded-[8px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
            style={{
              background:
                service.accent === "#306EEC"
                  ? "linear-gradient(135deg, #306EEC 0%, #1D4ED8 100%)"
                  : "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              boxShadow:
                service.accent === "#306EEC"
                  ? "0 16px 48px rgba(48,110,236,0.28)"
                  : "0 16px 48px rgba(15,23,42,0.22)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Get a Free Consultation
          </button>
          <p className="text-center text-[12px] text-[#94A3B8]">
            No obligation · Free on-site assessment
          </p>
          <div className="flex items-center justify-center gap-3 pt-0.5">
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] text-[#94A3B8]">Workmanship warranty</span>
            </div>
            <span className="text-[#CBD5E1] text-[10px]">·</span>
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] text-[#94A3B8]">Financing available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RemodelingSection() {
  return (
    <section
      id="remodeling"
      className="w-full bg-[#EAEDFA] py-10 sm:py-13 lg:py-12 scroll-mt-[110px]"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mx-auto max-w-[760px] text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-2.5 rounded-[6px] border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              High-Ticket Remodeling
            </span>
          </div>

          <h2 className="text-[30px] sm:text-[36px] lg:text-[43px] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#0F172A] mb-5">
            Complete Home
            <br />
            <span className="text-[#306EEC]">Transformations.</span>
          </h2>

          <p className="text-[15px] sm:text-[17px] text-[#475569] leading-relaxed max-w-[560px] mx-auto">
            Full bathroom and kitchen remodels - managed by the same licensed,
            insured team you already trust for your home care membership.
            One team, no subcontractor chaos.
          </p>
        </div>

        {/* ── Service cards ──────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
          {SERVICES.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        {/* ── Bottom authority strip ─────────────────────────── */}
        <div className="mt-7 sm:mt-8 overflow-hidden rounded-[8px] border border-[#E5E9F2] bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)]">
          <div className="px-6 py-7 sm:px-10 sm:py-8 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-7">
            {/* Left: Quote */}
            <div className="flex-1">
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-[#0F172A]">
                <span className="font-bold">Every remodeling project is personally reviewed and overseen by Taras.</span>{" "}
                <span className="text-[#475569]">
                  You get direct access to the founder - not a sales team.
                  Real estimates, real timelines, real accountability.
                </span>
              </p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
                Taras Bandura · Founder · Licensed HI-71484 · 9+ years on Long Island
              </p>
            </div>
            {/* Right: Phone CTA */}
            <a
              href={`tel:${REMODELING_PHONE_TEL}`}
              className="flex-shrink-0 group inline-flex items-center gap-3 rounded-[8px] border border-[#0F172A]/12 bg-[#F8FAFF] px-5 py-4 hover:border-[#306EEC]/30 hover:bg-[#EEF5FF] transition-all duration-200 sm:min-w-[220px]"
            >
              <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0 group-hover:bg-[#306EEC] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Reach Taras directly
                </div>
                <div className="text-[16px] font-bold text-[#0F172A]">
                  {REMODELING_PHONE_DISPLAY}
                </div>
              </div>
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
