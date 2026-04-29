"use client";

import { useState } from "react";
import Link from "next/link";

// ─────────────────────────── Types ───────────────────────────────────────────

type Service = "roofing" | "bathroom" | "kitchen";

interface ED {
  service: Service | null;
  // Roofing
  roofScope: "replacement" | "repair" | null;
  roofSize: "small" | "medium" | "large" | "xlarge" | null;
  roofMaterial: "asphalt" | "flat" | "wood" | "metal" | null;
  roofUrgency: "active-leak" | "storm" | "aging" | "planning" | null;
  roofInsurance: "yes" | "maybe" | "no" | null;
  roofFinish: "standard" | "premium" | "ultra" | null;
  // Bathroom
  bathroomScope: "full" | "partial" | null;
  bathroomSize: "small" | "medium" | "large" | null;
  bathroomItems: string[];
  bathroomFinish: "standard" | "premium" | "luxury" | null;
  bathroomPlumbing: "yes" | "maybe" | "no" | null;
  // Kitchen
  kitchenScope: "full" | "partial" | null;
  kitchenSize: "small" | "medium" | "large" | null;
  kitchenItems: string[];
  kitchenFinish: "standard" | "premium" | "luxury" | null;
  kitchenLayout: "yes" | "no" | "unsure" | null;
  kitchenPlumbing: "yes" | "maybe" | "no" | null;
  // Common
  timeline: "asap" | "1month" | "1-3months" | "planning" | null;
  financing: "yes" | "maybe" | "no" | null;
  // Contact
  name: string;
  phone: string;
  email: string;
  address: string;
  contactPref: "phone" | "text" | "email";
  notes: string;
}

const INIT: ED = {
  service: null,
  roofScope: null, roofSize: null, roofMaterial: null, roofUrgency: null,
  roofInsurance: null, roofFinish: null,
  bathroomScope: null, bathroomSize: null, bathroomItems: [], bathroomFinish: null, bathroomPlumbing: null,
  kitchenScope: null, kitchenSize: null, kitchenItems: [], kitchenFinish: null,
  kitchenLayout: null, kitchenPlumbing: null,
  timeline: null, financing: null,
  name: "", phone: "", email: "", address: "", contactPref: "phone", notes: "",
};

// ─────────────────────────── Steps ───────────────────────────────────────────

const STEPS: Record<Service, string[]> = {
  roofing:  ["scope","size","material","urgency","insurance","finish","timeline","financing","contact","estimate"],
  bathroom: ["scope","size","items","finish","plumbing","timeline","financing","contact","estimate"],
  kitchen:  ["scope","size","items","finish","layout","plumbing","timeline","financing","contact","estimate"],
};

// ─────────────────────────── Accent config ───────────────────────────────────

const ACC: Record<Service, { c: string; name: string }> = {
  roofing:  { c: "#E8900A", name: "1-Day Roof Replacement" },
  bathroom: { c: "#3B7DEF", name: "Bathroom Remodeling" },
  kitchen:  { c: "#D97706", name: "Kitchen Remodeling" },
};

const PHONE_DISPLAY = "631-599-1363";
const PHONE_TEL     = "+16315991363";

// ─────────────────────────── Estimate calculator ─────────────────────────────

interface Rng { low: number; high: number }

function calcRange(d: ED): Rng {
  if (!d.service) return { low: 0, high: 0 };

  if (d.service === "roofing") {
    if (d.roofScope === "repair") return { low: 1500, high: 4500 };
    const base: Record<string, Rng> = {
      small:  { low: 8000,  high: 13000 },
      medium: { low: 13000, high: 22000 },
      large:  { low: 22000, high: 36000 },
      xlarge: { low: 34000, high: 55000 },
    };
    const fm: Record<string, number> = { standard: 1, premium: 1.5, ultra: 2.1 };
    const r = base[d.roofSize ?? "medium"];
    const m = fm[d.roofFinish ?? "standard"];
    return { low: Math.round((r.low * m) / 500) * 500, high: Math.round((r.high * m) / 500) * 500 };
  }

  if (d.service === "bathroom") {
    if (d.bathroomScope === "partial") return { low: 4000, high: 11000 };
    const t: Record<string, Record<string, Rng>> = {
      small:  { standard:{low:9000,high:15000},   premium:{low:16000,high:27000},  luxury:{low:30000,high:50000}   },
      medium: { standard:{low:15000,high:25000},  premium:{low:27000,high:44000},  luxury:{low:48000,high:75000}   },
      large:  { standard:{low:25000,high:40000},  premium:{low:44000,high:68000},  luxury:{low:75000,high:115000}  },
    };
    return t[d.bathroomSize ?? "medium"][d.bathroomFinish ?? "standard"] ?? { low: 15000, high: 25000 };
  }

  if (d.service === "kitchen") {
    if (d.kitchenScope === "partial") return { low: 9000, high: 22000 };
    const t: Record<string, Record<string, Rng>> = {
      small:  { standard:{low:28000,high:45000},  premium:{low:48000,high:75000},   luxury:{low:80000,high:125000}  },
      medium: { standard:{low:45000,high:72000},  premium:{low:75000,high:115000},  luxury:{low:120000,high:175000} },
      large:  { standard:{low:68000,high:105000}, premium:{low:108000,high:160000}, luxury:{low:165000,high:240000} },
    };
    return t[d.kitchenSize ?? "medium"][d.kitchenFinish ?? "standard"] ?? { low: 45000, high: 72000 };
  }

  return { low: 0, high: 0 };
}

function fmtK(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toLocaleString()}`;
}

// ─────────────────────────── Shared sub-components ───────────────────────────

function RadioCard({
  selected, accent, onClick, label, sublabel,
}: {
  selected: boolean; accent: string; onClick: () => void; label: string; sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 flex items-center justify-between gap-4"
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.10)",
        background: selected ? `${accent}1A` : "rgba(255,255,255,0.04)",
        boxShadow: selected ? `0 0 0 1px ${accent}50, 0 8px 32px ${accent}1A` : undefined,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-semibold leading-snug ${selected ? "text-white" : "text-white/80"}`}>
          {label}
        </div>
        {sublabel && (
          <div className={`text-[13px] mt-0.5 leading-snug ${selected ? "text-white/65" : "text-white/40"}`}>
            {sublabel}
          </div>
        )}
      </div>
      <div
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          borderColor: selected ? accent : "rgba(255,255,255,0.22)",
          background: selected ? accent : "transparent",
        }}
      >
        {selected && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

function CheckCard({
  selected, accent, onClick, label, sublabel,
}: {
  selected: boolean; accent: string; onClick: () => void; label: string; sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 flex items-center justify-between gap-4"
      style={{
        borderColor: selected ? accent : "rgba(255,255,255,0.10)",
        background: selected ? `${accent}1A` : "rgba(255,255,255,0.04)",
        boxShadow: selected ? `0 0 0 1px ${accent}50, 0 8px 32px ${accent}1A` : undefined,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-semibold leading-snug ${selected ? "text-white" : "text-white/80"}`}>
          {label}
        </div>
        {sublabel && (
          <div className={`text-[13px] mt-0.5 leading-snug ${selected ? "text-white/65" : "text-white/40"}`}>
            {sublabel}
          </div>
        )}
      </div>
      <div
        className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          borderColor: selected ? accent : "rgba(255,255,255,0.22)",
          background: selected ? accent : "transparent",
        }}
      >
        {selected && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

function StepQ({ headline, sub, children }: { headline: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <h2 className="text-[24px] sm:text-[30px] font-extrabold text-white leading-[1.15] tracking-[-0.025em] mb-2">
        {headline}
      </h2>
      {sub && <p className="text-[14px] sm:text-[15px] text-white/55 mb-7 leading-relaxed">{sub}</p>}
      {!sub && <div className="mb-7" />}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─────────────────────────── Service Selection ───────────────────────────────

const SERVICE_CARDS = [
  {
    id: "roofing" as Service,
    accent: "#E8900A",
    headline: "1-Day Roof Replacement",
    tagline: "Fast. Warranted. Stress-free.",
    points: ["Full replacement or repair", "Material & shingle selection", "Insurance & storm claims", "Financing options", "Timeline & urgency"],
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "bathroom" as Service,
    accent: "#3B7DEF",
    headline: "Full Bathroom Remodeling",
    tagline: "Designed around how you live.",
    points: ["Full remodel or targeted upgrade", "Scope & finish level", "Tile, vanity, shower & more", "Plumbing coordination", "Timeline & financing"],
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
        <path d="M9 6a3 3 0 015.12-2.12A3 3 0 0117 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="6" width="20" height="4" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 10v8a2 2 0 002 2h12a2 2 0 002-2v-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "kitchen" as Service,
    accent: "#D97706",
    headline: "Full Kitchen Remodeling",
    tagline: "The heart of your home, elevated.",
    points: ["Full remodel or targeted update", "Cabinets, countertops & backsplash", "Appliances & layout changes", "Finish level & scope", "Timeline & financing"],
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="opacity-90" aria-hidden="true">
        <rect x="2" y="3" width="20" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2 10v11h20V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 3v7M16 3v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
] as const;

function ServiceSelection({ onSelect }: { onSelect: (s: Service) => void }) {
  const [hovered, setHovered] = useState<Service | null>(null);

  return (
    <div className="min-h-screen bg-[#060B17] flex flex-col">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-white/6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-white">Profixter</span>
        </Link>
        <a
          href={`tel:${PHONE_TEL}`}
          className="text-[13px] font-semibold text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {PHONE_DISPLAY}
        </a>
      </header>

      {/* Hero text */}
      <div className="text-center px-6 pt-14 pb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-1.5 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
            Free · No Obligation · Long Island
          </span>
        </div>
        <h1 className="text-[32px] sm:text-[46px] lg:text-[56px] font-extrabold text-white leading-[1.06] tracking-[-0.035em] mb-4">
          Get Your Personalized
          <br />
          <span className="text-white/40">Project Estimate</span>
        </h1>
        <p className="text-[15px] sm:text-[17px] text-white/50 max-w-[520px] mx-auto leading-relaxed">
          Answer a few questions about your project. We build a realistic estimate range and
          connect you with Taras directly — no sales team.
        </p>
      </div>

      {/* Service cards */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="mx-auto max-w-[1100px] grid sm:grid-cols-3 gap-4 sm:gap-5">
          {SERVICE_CARDS.map((svc) => {
            const isHov = hovered === svc.id;
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => onSelect(svc.id)}
                onMouseEnter={() => setHovered(svc.id)}
                onMouseLeave={() => setHovered(null)}
                className="text-left rounded-[24px] border-2 p-7 flex flex-col transition-all duration-300 hover:-translate-y-1"
                style={{
                  borderColor: isHov ? svc.accent : "rgba(255,255,255,0.08)",
                  background: isHov ? `${svc.accent}0E` : "rgba(255,255,255,0.03)",
                  boxShadow: isHov ? `0 0 0 1px ${svc.accent}30, 0 20px 60px ${svc.accent}18` : "none",
                }}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors"
                  style={{
                    background: isHov ? `${svc.accent}20` : "rgba(255,255,255,0.06)",
                    color: isHov ? svc.accent : "rgba(255,255,255,0.5)",
                  }}
                >
                  {svc.icon}
                </div>
                {/* Headline */}
                <div
                  className="text-[18px] font-extrabold leading-snug mb-1 transition-colors"
                  style={{ color: isHov ? svc.accent : "white" }}
                >
                  {svc.headline}
                </div>
                <div className="text-[13px] text-white/40 mb-5">{svc.tagline}</div>
                {/* Points */}
                <ul className="space-y-2.5 flex-1">
                  {svc.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2.5">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <circle cx="6" cy="6" r="6" fill={isHov ? svc.accent : "rgba(255,255,255,0.12)"} />
                        <path d="M3.5 6l1.5 1.5L8.5 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] text-white/60">{pt}</span>
                    </li>
                  ))}
                </ul>
                {/* CTA */}
                <div
                  className="mt-6 flex items-center gap-2 text-[14px] font-bold transition-colors"
                  style={{ color: isHov ? svc.accent : "rgba(255,255,255,0.35)" }}
                >
                  Start estimate
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom trust */}
      <div className="border-t border-white/6 px-6 py-5">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          {["Licensed HI-71484", "Fully Insured", "9+ Years Long Island", "No Obligation"].map((t) => (
            <span key={t} className="text-[12px] text-white/30 font-medium">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Progress header ─────────────────────────────────

function ProgressHeader({
  service, stepIndex, totalSteps, accent, onLogoClick,
}: {
  service: Service; stepIndex: number; totalSteps: number; accent: string; onLogoClick: () => void;
}) {
  const pct = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <header className="flex flex-col gap-0 border-b border-white/8 bg-[#060B17]">
      {/* Progress bar */}
      <div className="h-[3px] bg-white/8">
        <div
          className="h-full transition-all duration-500 ease-out rounded-full"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
      <div className="flex items-center justify-between px-5 py-4">
        <button type="button" onClick={onLogoClick} className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center group-hover:bg-white/12 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[14px] font-bold text-white">Profixter</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold" style={{ color: accent }}>
            {ACC[service].name}
          </span>
          <span className="text-[11px] text-white/30">
            {stepIndex + 1} / {totalSteps}
          </span>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────── Step nav bar ────────────────────────────────────

function StepNav({
  canProceed, onBack, onNext, nextLabel, accent, isLast, submitting,
}: {
  canProceed: boolean; onBack: () => void; onNext: () => void;
  nextLabel?: string; accent: string; isLast?: boolean; submitting?: boolean;
}) {
  const disabled = !canProceed || !!submitting;
  return (
    <div className="sticky bottom-0 bg-[#060B17] border-t border-white/8 px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onBack}
        disabled={!!submitting}
        className="flex items-center gap-2 text-[14px] font-semibold text-white/40 hover:text-white/70 transition-colors py-2 disabled:opacity-30"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="flex items-center gap-2 px-6 py-3 rounded-[14px] text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
        style={{ background: accent, boxShadow: disabled ? undefined : `0 8px 24px ${accent}40` }}
      >
        {submitting ? (
          <>
            <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Submitting…
          </>
        ) : (
          <>
            {nextLabel ?? (isLast ? "Get My Estimate" : "Continue")}
            {!isLast && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────── Main estimator flow ─────────────────────────────

function EstimatorFlow({ initialService }: { initialService: Service }) {
  const [data, setData] = useState<ED>({ ...INIT, service: initialService });
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [contactError, setContactError] = useState("");

  const service = initialService;
  const { c: accent } = ACC[service];
  const steps = STEPS[service];
  const totalSteps = steps.length - 1; // exclude "estimate" from count
  const currentStep = steps[stepIdx];

  const set = <K extends keyof ED>(k: K, v: ED[K]) => setData((d) => ({ ...d, [k]: v }));

  const toggleItem = (key: "bathroomItems" | "kitchenItems", val: string) => {
    setData((d) => {
      const arr = d[key] as string[];
      return { ...d, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  };

  const goBack = () => {
    if (stepIdx === 0) return; // handled at page level
    setStepIdx((i) => i - 1);
    setContactError("");
  };

  const goNext = async () => {
    if (currentStep === "contact") {
      // Client-side validation
      if (!data.name.trim() || !data.phone.trim() || !data.email.trim() || !data.address.trim()) {
        setContactError("Please fill in all required fields.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        setContactError("Please enter a valid email address.");
        return;
      }
      if (data.phone.replace(/\D/g, "").length < 10) {
        setContactError("Please enter a valid phone number.");
        return;
      }

      setContactError("");
      setSubmitting(true);

      const range = calcRange(data);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${apiUrl}/api/estimates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, estimateLow: range.low, estimateHigh: range.high }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          // 4xx = validation issue — block the user with the server message
          if (res.status < 500) {
            setContactError((json as { message?: string }).message ?? "Please check your details and try again.");
            setSubmitting(false);
            return;
          }
          // 5xx — server error, advance anyway so user isn't blocked
          console.error("Estimate API 5xx:", res.status);
        }
      } catch (err) {
        // Network error — advance anyway; lead submission can be retried server-side
        console.error("Estimate API network error:", err);
      }

      setSubmitting(false);
    }

    setStepIdx((i) => i + 1);
  };

  const canProceed = (): boolean => {
    const s = currentStep;
    if (s === "scope") return service === "roofing" ? !!data.roofScope : service === "bathroom" ? !!data.bathroomScope : !!data.kitchenScope;
    if (s === "size") return service === "roofing" ? !!data.roofSize : service === "bathroom" ? !!data.bathroomSize : !!data.kitchenSize;
    if (s === "material") return !!data.roofMaterial;
    if (s === "urgency") return !!data.roofUrgency;
    if (s === "insurance") return !!data.roofInsurance;
    if (s === "finish") return service === "roofing" ? !!data.roofFinish : service === "bathroom" ? !!data.bathroomFinish : !!data.kitchenFinish;
    if (s === "items") return service === "bathroom" ? data.bathroomItems.length > 0 : data.kitchenItems.length > 0;
    if (s === "plumbing") return service === "bathroom" ? !!data.bathroomPlumbing : !!data.kitchenPlumbing;
    if (s === "layout") return !!data.kitchenLayout;
    if (s === "timeline") return !!data.timeline;
    if (s === "financing") return !!data.financing;
    if (s === "contact") return !!(data.name.trim() && data.phone.trim() && data.email.trim() && data.address.trim());
    return true;
  };

  const isLastStep = currentStep === "contact";
  const range = calcRange(data);

  // ── Step renderers ──────────────────────────────────────────────────────────

  const renderRoofScope = () => (
    <StepQ headline="What type of roofing work do you need?" sub="This helps us scope the right resources and timeline for your project.">
      <RadioCard selected={data.roofScope === "replacement"} accent={accent} onClick={() => set("roofScope", "replacement")} label="Full Roof Replacement" sublabel="Complete tear-off and new roof — the most common and most impactful" />
      <RadioCard selected={data.roofScope === "repair"} accent={accent} onClick={() => set("roofScope", "repair")} label="Repair Only" sublabel="Targeted fix for a specific area — leak, flashing, or damage" />
    </StepQ>
  );

  const renderRoofSize = () => (
    <StepQ headline="What's the approximate size of your roof?" sub="Your best estimate is fine — we confirm exact measurements at the consultation.">
      <RadioCard selected={data.roofSize === "small"} accent={accent} onClick={() => set("roofSize", "small")} label="Under 1,000 sq ft" sublabel="Smaller home, cape cod, or garage" />
      <RadioCard selected={data.roofSize === "medium"} accent={accent} onClick={() => set("roofSize", "medium")} label="1,000 – 2,000 sq ft" sublabel="Average Long Island ranch or colonial" />
      <RadioCard selected={data.roofSize === "large"} accent={accent} onClick={() => set("roofSize", "large")} label="2,000 – 3,000 sq ft" sublabel="Larger home, extended layout" />
      <RadioCard selected={data.roofSize === "xlarge"} accent={accent} onClick={() => set("roofSize", "xlarge")} label="Over 3,000 sq ft" sublabel="Large estate or multi-section roof" />
    </StepQ>
  );

  const renderRoofMaterial = () => (
    <StepQ headline="What's your current roof material?" sub="This affects tear-off complexity and whether material-specific expertise is needed.">
      <RadioCard selected={data.roofMaterial === "asphalt"} accent={accent} onClick={() => set("roofMaterial", "asphalt")} label="Asphalt Shingles" sublabel="Most common — 3-tab or architectural" />
      <RadioCard selected={data.roofMaterial === "flat"} accent={accent} onClick={() => set("roofMaterial", "flat")} label="Flat / TPO / EPDM" sublabel="Low-slope or flat rubber membrane" />
      <RadioCard selected={data.roofMaterial === "wood"} accent={accent} onClick={() => set("roofMaterial", "wood")} label="Cedar / Wood Shake" sublabel="Natural wood shingles or shakes" />
      <RadioCard selected={data.roofMaterial === "metal"} accent={accent} onClick={() => set("roofMaterial", "metal")} label="Metal Roofing" sublabel="Standing seam or metal panels" />
    </StepQ>
  );

  const renderRoofUrgency = () => (
    <StepQ headline="What's the urgency of your roofing situation?">
      <RadioCard selected={data.roofUrgency === "active-leak"} accent={accent} onClick={() => set("roofUrgency", "active-leak")} label="Active Leak — Urgent" sublabel="Water is coming in now or after rain" />
      {data.roofUrgency === "active-leak" && (
        <div className="rounded-2xl px-5 py-4 border border-[#E8900A]/30 bg-[#E8900A]/08 text-[13px] text-[#E8900A]/90 leading-relaxed">
          We prioritize emergency situations. For same-day response, call us directly at{" "}
          <a href={`tel:${PHONE_TEL}`} className="font-bold underline">{PHONE_DISPLAY}</a>.
        </div>
      )}
      <RadioCard selected={data.roofUrgency === "storm"} accent={accent} onClick={() => set("roofUrgency", "storm")} label="Storm or Hail Damage" sublabel="Recent weather event caused visible damage" />
      {data.roofUrgency === "storm" && (
        <div className="rounded-2xl px-5 py-4 border border-[#E8900A]/30 bg-[#E8900A]/08 text-[13px] text-[#E8900A]/90 leading-relaxed">
          We work directly with homeowners navigating insurance claims. We can guide you through the process.
        </div>
      )}
      <RadioCard selected={data.roofUrgency === "aging"} accent={accent} onClick={() => set("roofUrgency", "aging")} label="Aging / Deteriorating" sublabel="No active leak, but the roof is past its prime" />
      <RadioCard selected={data.roofUrgency === "planning"} accent={accent} onClick={() => set("roofUrgency", "planning")} label="Planning Ahead" sublabel="Proactively budgeting for a future replacement" />
    </StepQ>
  );

  const renderRoofInsurance = () => (
    <StepQ headline="Is an insurance claim involved?" sub="We work with homeowners through the claims process at no extra cost.">
      <RadioCard selected={data.roofInsurance === "yes"} accent={accent} onClick={() => set("roofInsurance", "yes")} label="Yes — I'm filing a claim" sublabel="I have a claim open or plan to file" />
      <RadioCard selected={data.roofInsurance === "maybe"} accent={accent} onClick={() => set("roofInsurance", "maybe")} label="Possibly — not sure yet" sublabel="I'd like to understand my options" />
      <RadioCard selected={data.roofInsurance === "no"} accent={accent} onClick={() => set("roofInsurance", "no")} label="No — paying out of pocket" sublabel="Cash, financing, or home equity" />
    </StepQ>
  );

  const renderRoofFinish = () => (
    <StepQ headline="What quality tier are you targeting?" sub="Each tier uses different shingle grades, warranties, and installation standards.">
      <RadioCard selected={data.roofFinish === "standard"} accent={accent} onClick={() => set("roofFinish", "standard")} label="Standard" sublabel="25-year architectural shingles — solid, reliable, most common" />
      <RadioCard selected={data.roofFinish === "premium"} accent={accent} onClick={() => set("roofFinish", "premium")} label="Premium" sublabel="30–40 year shingles — GAF or CertainTeed, upgraded aesthetics" />
      <RadioCard selected={data.roofFinish === "ultra"} accent={accent} onClick={() => set("roofFinish", "ultra")} label="Ultra-Premium" sublabel="50-year shingles — maximum lifespan, transferable warranty, luxury appeal" />
    </StepQ>
  );

  const renderBathroomScope = () => (
    <StepQ headline="What scope of bathroom work are you planning?">
      <RadioCard selected={data.bathroomScope === "full"} accent={accent} onClick={() => set("bathroomScope", "full")} label="Full Bathroom Remodel" sublabel="Complete transformation — gut and rebuild start to finish" />
      <RadioCard selected={data.bathroomScope === "partial"} accent={accent} onClick={() => set("bathroomScope", "partial")} label="Targeted Upgrades" sublabel="Update specific elements — vanity, tile, fixtures, or shower" />
    </StepQ>
  );

  const renderBathroomSize = () => (
    <StepQ headline="How large is the bathroom?" sub="Approximate size is fine — we verify at your free on-site consultation.">
      <RadioCard selected={data.bathroomSize === "small"} accent={accent} onClick={() => set("bathroomSize", "small")} label="Small — under 50 sq ft" sublabel="Half bath, powder room, or compact full bath" />
      <RadioCard selected={data.bathroomSize === "medium"} accent={accent} onClick={() => set("bathroomSize", "medium")} label="Medium — 50 to 80 sq ft" sublabel="Standard full bathroom" />
      <RadioCard selected={data.bathroomSize === "large"} accent={accent} onClick={() => set("bathroomSize", "large")} label="Large — over 80 sq ft" sublabel="Master bath, spa-style, or oversized layout" />
    </StepQ>
  );

  const BATH_ITEMS = [
    { v: "shower", l: "Shower", s: "Walk-in, tile, or custom enclosure" },
    { v: "tub", l: "Bathtub / Soaking Tub", s: "Replacement or tub-to-shower conversion" },
    { v: "vanity", l: "Vanity & Mirror", s: "Cabinet, sink, countertop, hardware" },
    { v: "tile", l: "Wall Tile", s: "Full tile work on walls and surrounds" },
    { v: "flooring", l: "Flooring", s: "Tile, heated floor, or waterproof plank" },
    { v: "toilet", l: "Toilet", s: "Replacement or repositioning" },
    { v: "lighting", l: "Lighting & Electrical", s: "Fixtures, exhaust fan, recessed" },
    { v: "plumbing", l: "Plumbing Updates", s: "Pipes, drain, supply lines" },
  ];

  const renderBathroomItems = () => (
    <StepQ headline="What's included in your remodel?" sub="Select everything that applies — you can discuss priorities at your consultation.">
      {BATH_ITEMS.map((item) => (
        <CheckCard
          key={item.v}
          selected={data.bathroomItems.includes(item.v)}
          accent={accent}
          onClick={() => toggleItem("bathroomItems", item.v)}
          label={item.l}
          sublabel={item.s}
        />
      ))}
    </StepQ>
  );

  const renderBathroomFinish = () => (
    <StepQ headline="What finish level are you envisioning?" sub="This shapes materials, fixtures, tile selections, and the overall feel.">
      <RadioCard selected={data.bathroomFinish === "standard"} accent={accent} onClick={() => set("bathroomFinish", "standard")} label="Standard" sublabel="Clean, quality finishes — functional and attractive" />
      <RadioCard selected={data.bathroomFinish === "premium"} accent={accent} onClick={() => set("bathroomFinish", "premium")} label="Premium" sublabel="Designer tile, upgraded fixtures, spa-adjacent feel" />
      <RadioCard selected={data.bathroomFinish === "luxury"} accent={accent} onClick={() => set("bathroomFinish", "luxury")} label="Luxury" sublabel="Custom everything — heated floors, rain shower, statement design" />
    </StepQ>
  );

  const renderBathroomPlumbing = () => (
    <StepQ headline="Are plumbing updates needed?" sub="Moving fixtures or replacing old supply lines adds to scope — good to know upfront.">
      <RadioCard selected={data.bathroomPlumbing === "yes"} accent={accent} onClick={() => set("bathroomPlumbing", "yes")} label="Yes — pipes or layout need updating" sublabel="Moving fixtures, old pipes, or drain repositioning" />
      <RadioCard selected={data.bathroomPlumbing === "maybe"} accent={accent} onClick={() => set("bathroomPlumbing", "maybe")} label="Possibly — not sure yet" sublabel="We'll assess at the consultation" />
      <RadioCard selected={data.bathroomPlumbing === "no"} accent={accent} onClick={() => set("bathroomPlumbing", "no")} label="No — existing plumbing stays" sublabel="Cosmetic and surface upgrades only" />
    </StepQ>
  );

  const renderKitchenScope = () => (
    <StepQ headline="What scope of kitchen work are you planning?">
      <RadioCard selected={data.kitchenScope === "full"} accent={accent} onClick={() => set("kitchenScope", "full")} label="Full Kitchen Remodel" sublabel="Complete transformation — from cabinets to countertops to flooring" />
      <RadioCard selected={data.kitchenScope === "partial"} accent={accent} onClick={() => set("kitchenScope", "partial")} label="Targeted Updates" sublabel="Upgrade specific elements without a full gut" />
    </StepQ>
  );

  const renderKitchenSize = () => (
    <StepQ headline="What's the approximate size of your kitchen?">
      <RadioCard selected={data.kitchenSize === "small"} accent={accent} onClick={() => set("kitchenSize", "small")} label="Small — under 100 sq ft" sublabel="Galley, condo, or compact layout" />
      <RadioCard selected={data.kitchenSize === "medium"} accent={accent} onClick={() => set("kitchenSize", "medium")} label="Medium — 100 to 200 sq ft" sublabel="Standard Long Island kitchen" />
      <RadioCard selected={data.kitchenSize === "large"} accent={accent} onClick={() => set("kitchenSize", "large")} label="Large — over 200 sq ft" sublabel="Open kitchen, island layout, or extended space" />
    </StepQ>
  );

  const KITCHEN_ITEMS = [
    { v: "cabinets", l: "Cabinetry", s: "Custom or semi-custom cabinet replacement" },
    { v: "countertops", l: "Countertops", s: "Quartz, granite, marble, or butcher block" },
    { v: "backsplash", l: "Backsplash", s: "Tile, stone, or designer panels" },
    { v: "flooring", l: "Flooring", s: "Tile, hardwood, LVP, or heated" },
    { v: "island", l: "Island or Peninsula", s: "New island, reconfiguration, or seating" },
    { v: "appliances", l: "Appliance Coordination", s: "Layout around new appliances" },
    { v: "lighting", l: "Lighting & Electrical", s: "Under-cabinet, pendant, recessed" },
    { v: "plumbing", l: "Plumbing Updates", s: "Sink, faucet, dishwasher line, relocation" },
    { v: "painting", l: "Painting & Trim", s: "Wall paint, crown molding, finish carpentry" },
  ];

  const renderKitchenItems = () => (
    <StepQ headline="What's included in your remodel?" sub="Select everything that applies — we'll prioritize together at your consultation.">
      {KITCHEN_ITEMS.map((item) => (
        <CheckCard
          key={item.v}
          selected={data.kitchenItems.includes(item.v)}
          accent={accent}
          onClick={() => toggleItem("kitchenItems", item.v)}
          label={item.l}
          sublabel={item.s}
        />
      ))}
    </StepQ>
  );

  const renderKitchenFinish = () => (
    <StepQ headline="What finish level are you targeting?" sub="This determines materials, cabinetry quality, and overall investment level.">
      <RadioCard selected={data.kitchenFinish === "standard"} accent={accent} onClick={() => set("kitchenFinish", "standard")} label="Standard" sublabel="Clean, quality finishes — solid cabinets, durable countertops" />
      <RadioCard selected={data.kitchenFinish === "premium"} accent={accent} onClick={() => set("kitchenFinish", "premium")} label="Premium" sublabel="Semi-custom cabinetry, quartz, designer tile, elevated hardware" />
      <RadioCard selected={data.kitchenFinish === "luxury"} accent={accent} onClick={() => set("kitchenFinish", "luxury")} label="Luxury" sublabel="Custom everything — high-end appliances, statement surfaces, full vision" />
    </StepQ>
  );

  const renderKitchenLayout = () => (
    <StepQ headline="Will the kitchen layout change?" sub="Moving walls, plumbing, or electrical adds complexity but creates maximum impact.">
      <RadioCard selected={data.kitchenLayout === "yes"} accent={accent} onClick={() => set("kitchenLayout", "yes")} label="Yes — we want layout changes" sublabel="Moving walls, opening up the space, or repositioning plumbing" />
      <RadioCard selected={data.kitchenLayout === "unsure"} accent={accent} onClick={() => set("kitchenLayout", "unsure")} label="Not sure — open to ideas" sublabel="We'll explore what's possible at the consultation" />
      <RadioCard selected={data.kitchenLayout === "no"} accent={accent} onClick={() => set("kitchenLayout", "no")} label="No — keeping the existing layout" sublabel="Same footprint, surface and finish upgrades" />
    </StepQ>
  );

  const renderKitchenPlumbing = () => (
    <StepQ headline="Are plumbing or electrical updates needed?">
      <RadioCard selected={data.kitchenPlumbing === "yes"} accent={accent} onClick={() => set("kitchenPlumbing", "yes")} label="Yes — updates needed" sublabel="New sink location, dishwasher line, or electrical panel work" />
      <RadioCard selected={data.kitchenPlumbing === "maybe"} accent={accent} onClick={() => set("kitchenPlumbing", "maybe")} label="Possibly — not sure" sublabel="We'll assess and advise at your consultation" />
      <RadioCard selected={data.kitchenPlumbing === "no"} accent={accent} onClick={() => set("kitchenPlumbing", "no")} label="No — existing layout stays" sublabel="No major plumbing or electrical changes needed" />
    </StepQ>
  );

  const renderTimeline = () => (
    <StepQ headline="When are you looking to start?" sub="We'll work around your timeline — no pressure, just helps us plan.">
      <RadioCard selected={data.timeline === "asap"} accent={accent} onClick={() => set("timeline", "asap")} label="As soon as possible" sublabel="Urgency — I want to move quickly" />
      <RadioCard selected={data.timeline === "1month"} accent={accent} onClick={() => set("timeline", "1month")} label="Within 1 month" sublabel="Ready to start soon after planning" />
      <RadioCard selected={data.timeline === "1-3months"} accent={accent} onClick={() => set("timeline", "1-3months")} label="1 to 3 months" sublabel="In the planning stage, no rush" />
      <RadioCard selected={data.timeline === "planning"} accent={accent} onClick={() => set("timeline", "planning")} label="Still planning — 3+ months out" sublabel="Budgeting and researching now" />
    </StepQ>
  );

  const renderFinancing = () => (
    <StepQ headline="Is financing of interest to you?" sub="Monthly payment options are available for qualified homeowners — we cover this at the free consultation.">
      <RadioCard selected={data.financing === "yes"} accent={accent} onClick={() => set("financing", "yes")} label="Yes — I'd like to explore financing" sublabel="Monthly payment options over time" />
      <RadioCard selected={data.financing === "maybe"} accent={accent} onClick={() => set("financing", "maybe")} label="Maybe — I want to understand the options" sublabel="Open to it depending on terms" />
      <RadioCard selected={data.financing === "no"} accent={accent} onClick={() => set("financing", "no")} label="No — I'll pay cash or from savings" sublabel="Not interested in financing at this time" />
    </StepQ>
  );

  const renderContact = () => (
    <div className="w-full">
      <h2 className="text-[24px] sm:text-[30px] font-extrabold text-white leading-[1.15] tracking-[-0.025em] mb-2">
        Where should we send your estimate?
      </h2>
      <p className="text-[14px] sm:text-[15px] text-white/55 mb-7 leading-relaxed">
        Taras reviews every submission personally. You'll hear from him directly — not a call center.
      </p>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
              Full Name <span style={{ color: accent }}>*</span>
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-[14px] px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none border-2 transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderColor: data.name ? accent + "60" : "rgba(255,255,255,0.10)",
              }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
              Phone Number <span style={{ color: accent }}>*</span>
            </label>
            <input
              type="tel"
              value={data.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(631) 000-0000"
              className="w-full rounded-[14px] px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none border-2 transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderColor: data.phone ? accent + "60" : "rgba(255,255,255,0.10)",
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
            Email Address <span style={{ color: accent }}>*</span>
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-[14px] px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none border-2 transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: data.email ? accent + "60" : "rgba(255,255,255,0.10)",
            }}
          />
        </div>

        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
            Project Address <span style={{ color: accent }}>*</span>
          </label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street address, city — Long Island, NY"
            className="w-full rounded-[14px] px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none border-2 transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: data.address ? accent + "60" : "rgba(255,255,255,0.10)",
            }}
          />
        </div>

        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
            Best way to reach you
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(["phone", "text", "email"] as const).map((pref) => (
              <button
                key={pref}
                type="button"
                onClick={() => set("contactPref", pref)}
                className="rounded-[12px] border-2 py-3 text-[13px] font-semibold capitalize transition-all"
                style={{
                  borderColor: data.contactPref === pref ? accent : "rgba(255,255,255,0.10)",
                  background: data.contactPref === pref ? `${accent}1A` : "rgba(255,255,255,0.04)",
                  color: data.contactPref === pref ? "white" : "rgba(255,255,255,0.45)",
                }}
              >
                {pref === "phone" ? "Phone call" : pref === "text" ? "Text me" : "Email me"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
            Additional notes <span className="text-white/20 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything you'd like Taras to know before the consultation..."
            rows={3}
            className="w-full rounded-[14px] px-4 py-3.5 text-[15px] text-white placeholder-white/25 outline-none border-2 transition-all resize-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.10)",
            }}
          />
        </div>

        {contactError && (
          <p className="text-[13px] text-red-400">{contactError}</p>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5 text-white/30" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[12px] text-white/35 leading-relaxed">
            Your information is never sold or shared. We use it only to prepare and discuss your personalized estimate.
          </p>
        </div>
      </div>
    </div>
  );

  const renderEstimate = () => {
    const scopeLabel = (() => {
      if (service === "roofing") return data.roofScope === "repair" ? "Roof Repair" : `${data.roofSize === "small" ? "Small" : data.roofSize === "medium" ? "Mid-Size" : data.roofSize === "large" ? "Large" : "Estate"} Roof Replacement`;
      if (service === "bathroom") return data.bathroomScope === "partial" ? "Targeted Bathroom Upgrades" : `${data.bathroomSize === "small" ? "Small" : data.bathroomSize === "medium" ? "Medium" : "Large"} Bathroom Remodel`;
      return data.kitchenScope === "partial" ? "Targeted Kitchen Updates" : `${data.kitchenSize === "small" ? "Small" : data.kitchenSize === "medium" ? "Mid-Size" : "Large"} Kitchen Remodel`;
    })();

    const finishLabel = (() => {
      if (service === "roofing") return data.roofFinish === "ultra" ? "Ultra-Premium" : data.roofFinish === "premium" ? "Premium" : data.roofFinish ? "Standard" : "";
      if (service === "bathroom") return data.bathroomFinish ? data.bathroomFinish.charAt(0).toUpperCase() + data.bathroomFinish.slice(1) : "";
      return data.kitchenFinish ? data.kitchenFinish.charAt(0).toUpperCase() + data.kitchenFinish.slice(1) : "";
    })();

    return (
      <div className="w-full space-y-6">
        {/* Estimate card */}
        <div
          className="rounded-[24px] border-2 overflow-hidden"
          style={{ borderColor: `${accent}40`, background: `${accent}0C` }}
        >
          {/* Header */}
          <div className="px-7 pt-7 pb-5 border-b" style={{ borderColor: `${accent}20` }}>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-4 text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ background: `${accent}20`, color: accent }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Personalized Estimate
            </div>
            <h2 className="text-[20px] font-extrabold text-white mb-1">{scopeLabel}</h2>
            {finishLabel && (
              <p className="text-[13px] text-white/50">{finishLabel} finish · Long Island, NY</p>
            )}
          </div>

          {/* Range */}
          <div className="px-7 py-8 text-center">
            <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/35 mb-3">
              Estimated Investment Range
            </div>
            <div
              className="text-[48px] sm:text-[58px] font-extrabold tracking-[-0.04em] leading-none mb-3"
              style={{ color: accent }}
            >
              {fmtK(range.low)} – {fmtK(range.high)}
            </div>
            <p className="text-[12px] text-white/35 leading-relaxed max-w-[340px] mx-auto">
              Based on your inputs. Final pricing is determined after a free on-site consultation.
              No obligation. No surprises.
            </p>
          </div>
        </div>

        {/* What happens next */}
        <div className="rounded-[20px] border border-white/8 bg-white/3 p-6 sm:p-7">
          <h3 className="text-[15px] font-bold text-white mb-5">What happens next</h3>
          <div className="space-y-5">
            {[
              { n: "1", t: "We review your estimate details", s: "Taras personally reviews every submission before reaching out." },
              { n: "2", t: "You hear from Taras within 24 hours", s: `Direct contact — not a call center. Via ${data.contactPref === "phone" ? "phone call" : data.contactPref === "text" ? "text message" : "email"}.` },
              { n: "3", t: "Free on-site consultation", s: "We walk the project together, answer every question, and provide a precise written quote. No obligation." },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold flex-shrink-0"
                  style={{ background: `${accent}25`, color: accent }}
                >
                  {step.n}
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white mb-0.5">{step.t}</div>
                  <div className="text-[13px] text-white/45 leading-snug">{step.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <a
            href={`tel:${PHONE_TEL}`}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[16px] text-[15px] font-extrabold text-white transition-all hover:opacity-90 active:scale-[0.99]"
            style={{ background: accent, boxShadow: `0 12px 40px ${accent}40` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Call Taras Now — {PHONE_DISPLAY}
          </a>
          <p className="text-center text-[12px] text-white/30">
            Or we'll reach out within 24 hours · Licensed HI-71484 · Fully insured
          </p>
        </div>

        <div className="text-center pt-2">
          <Link href="/" className="text-[13px] text-white/25 hover:text-white/50 transition-colors">
            ← Back to homepage
          </Link>
        </div>
      </div>
    );
  };

  // ── Step router ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    const s = currentStep;
    if (s === "estimate") return renderEstimate();
    if (s === "contact") return renderContact();
    if (s === "timeline") return renderTimeline();
    if (s === "financing") return renderFinancing();

    if (service === "roofing") {
      if (s === "scope") return renderRoofScope();
      if (s === "size") return renderRoofSize();
      if (s === "material") return renderRoofMaterial();
      if (s === "urgency") return renderRoofUrgency();
      if (s === "insurance") return renderRoofInsurance();
      if (s === "finish") return renderRoofFinish();
    }

    if (service === "bathroom") {
      if (s === "scope") return renderBathroomScope();
      if (s === "size") return renderBathroomSize();
      if (s === "items") return renderBathroomItems();
      if (s === "finish") return renderBathroomFinish();
      if (s === "plumbing") return renderBathroomPlumbing();
    }

    if (service === "kitchen") {
      if (s === "scope") return renderKitchenScope();
      if (s === "size") return renderKitchenSize();
      if (s === "items") return renderKitchenItems();
      if (s === "finish") return renderKitchenFinish();
      if (s === "layout") return renderKitchenLayout();
      if (s === "plumbing") return renderKitchenPlumbing();
    }

    return null;
  };

  const isEstimate = currentStep === "estimate";

  return (
    <div className="min-h-screen bg-[#060B17] flex flex-col">
      <ProgressHeader
        service={service}
        stepIndex={Math.min(stepIdx, totalSteps - 1)}
        totalSteps={totalSteps}
        accent={accent}
        onLogoClick={() => window.location.assign("/estimate")}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-5 sm:px-8 pt-10 pb-20">
          {renderStep()}
        </div>
      </div>

      {!isEstimate && (
        <StepNav
          canProceed={canProceed()}
          onBack={goBack}
          onNext={goNext}
          accent={accent}
          isLast={isLastStep}
          submitting={submitting}
          nextLabel={isLastStep ? "Get My Free Estimate →" : undefined}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Page entry point ─────────────────────────────────

export default function EstimatePage() {
  const [service, setService] = useState<Service | null>(null);

  if (!service) {
    return <ServiceSelection onSelect={setService} />;
  }

  return <EstimatorFlow initialService={service} />;
}
