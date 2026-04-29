"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { trackEvent } from "@/lib/analytics";

const PHONE_DISPLAY = "631-599-1363";
const PHONE_TEL = "+16315991363";

const GALLERY = [
  { src: "/images/projects/p1.jpg", label: "Shingle Replacement", detail: "Architectural shingles · Suffolk County" },
  { src: "/images/projects/p2.jpg", label: "Full Tear-Off", detail: "Complete re-roof · Nassau County" },
  { src: "/images/projects/p3.jpg", label: "Flat Roof System", detail: "Low-slope EPDM · Long Island" },
  { src: "/images/projects/p4.jpg", label: "Storm Damage Repair", detail: "Emergency replacement · Suffolk County" },
  { src: "/images/projects/p5.jpg", label: "Ridge & Flashing", detail: "Leak prevention detail · Long Island" },
  { src: "/images/projects/p6.jpg", label: "Architectural Shingles", detail: "Premium dimensional · Nassau County" },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "Will you really finish my roof in one day?",
    a: "For most standard residential re-roofing projects on Long Island — yes. A typical 1,500–2,800 sq ft single-story home with architectural shingles is started and completed the same day. Multi-story homes, complex rooflines, or structural repairs may require an additional day. We'll tell you exactly what to expect before any work begins.",
  },
  {
    q: "How much does a roof replacement cost on Long Island?",
    a: "Roofing costs vary based on size, pitch, material, and any underlying issues found during tear-off. We provide a free on-site assessment with a written estimate before committing to anything. There are no surprise charges — if we find something unexpected, we tell you before touching it.",
  },
  {
    q: "Do you handle permits?",
    a: "Yes. We are a licensed NY State Home Improvement Contractor (HI-71484) and handle the permit process. Many standard residential re-roofing projects in Long Island municipalities are permit-exempt, but we verify requirements for your specific address and handle everything.",
  },
  {
    q: "What if it rains on the scheduled day?",
    a: "We monitor weather closely. If rain is forecast, we reschedule to protect your home and the quality of the installation. Roofing in wet conditions compromises the result and we won't do it.",
  },
  {
    q: "Is cleanup included?",
    a: "Always. Every project includes full tear-off debris removal, nail sweeping (magnetic roller on every square foot of the property), and haul-away. We leave your property cleaner than we found it.",
  },
  {
    q: "What shingle brands do you install?",
    a: "We install architectural (dimensional) asphalt shingles from leading manufacturers. We'll recommend the right product for your home's pitch, exposure, and budget — and show you physical samples before ordering.",
  },
  {
    q: "Are you licensed and insured?",
    a: "Yes. NY State Licensed Home Improvement Contractor HI-71484, verifiable through the NYS Department of State. Fully insured for property damage and liability. We'll provide proof of insurance before work begins — always.",
  },
  {
    q: "Can I stay home during the replacement?",
    a: "Yes, though it's loud and there's activity outside throughout the day. Most homeowners choose to stay home. We'll introduce ourselves, walk you through the plan for the day, and give you a point of contact for any questions.",
  },
  {
    q: "What if you find damage underneath the shingles?",
    a: "If we find rotted decking, damaged fascia, or other issues under the old roof, we stop and show you before proceeding. You decide whether to repair it. We never do additional work without your explicit approval and a clear price.",
  },
  {
    q: "Do you offer any warranty?",
    a: "Yes — both on materials (manufacturer warranty, typically 25–50 years depending on shingle grade) and on our workmanship. Ask us for specifics when we assess your project.",
  },
  {
    q: "Do you offer financing for roof replacements?",
    a: "Yes — monthly payment options are available for qualified homeowners. A roof can't always wait. Financing means you can address your roof now — before further damage reaches your attic, insulation, or ceilings — without waiting until you've saved the full amount. We walk through financing options at your free assessment. No commitment required.",
  },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-[18px] border transition-all duration-200 overflow-hidden ${open ? "border-[#D4A574]/30 bg-[#D4A574]/[0.04]" : "border-white/[0.09] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.14]"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left focus:outline-none"
        aria-expanded={open}
      >
        <span className={`text-[15px] sm:text-[16px] font-semibold leading-snug transition-colors ${open ? "text-[#D4A574]" : "text-white/82"}`}>{q}</span>
        <svg className={`flex-shrink-0 mt-0.5 w-5 h-5 transition-transform duration-300 ${open ? "rotate-180 text-[#D4A574]" : "text-white/30"}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-[14px] sm:text-[15px] leading-relaxed text-white/50">{a}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RoofingPage() {
  const [galleryIdx, setGalleryIdx] = useState(0);
  const activePhoto = GALLERY[galleryIdx];

  const callNow = () => {
    trackEvent("roofing_call_cta", { placement: "roofing_page" });
    window.location.href = `tel:${PHONE_TEL}`;
  };

  return (
    <div className="min-h-screen bg-[#080F1E] overflow-x-hidden">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>

        {/* ═══════════════════════════════════════════════════════
            HERO
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full overflow-hidden min-h-[92vh] flex items-center"
          style={{ background: "linear-gradient(160deg, #060C18 0%, #0A1421 55%, #080F1C 100%)" }}>

          {/* Depth glows */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/4 h-[700px] w-[700px] rounded-full blur-[200px] opacity-50"
            style={{ background: "radial-gradient(circle, rgba(212,165,116,0.12), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full blur-[180px] opacity-30"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }} />
          {/* Dot texture */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.022]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          {/* Amber top-edge accent */}
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(212,165,116,0.40), transparent)" }} />

          <div className="relative w-full mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-24 sm:py-28 lg:py-32">
            <div className="grid lg:grid-cols-[1fr_480px] gap-12 lg:gap-16 items-center">

              {/* Left: Copy */}
              <div>
                <Link href="/projects" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/30 hover:text-white/55 transition-colors mb-6">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Home Improvement
                </Link>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/25 bg-[#D4A574]/[0.07] px-4 py-2 backdrop-blur-sm mb-8">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#D4A574]" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4A574]/80">
                    Premium Roofing · Long Island
                  </span>
                </div>

                <h1 className="text-[58px] sm:text-[78px] lg:text-[96px] font-black leading-[0.86] tracking-[-0.048em] text-white mb-7">
                  1-Day Roof
                  <br />
                  <span className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}>
                    Replacement.
                  </span>
                </h1>

                <p className="text-[20px] sm:text-[23px] font-bold leading-[1.3] text-white/85 mb-4 max-w-[540px]">
                  Most Long Island roofs are started and completed in a single day.
                </p>
                <p className="text-[16px] sm:text-[17px] leading-[1.75] text-white/45 max-w-[500px] mb-10">
                  No multi-week projects. No vanishing contractors. One team,
                  one day, your home protected — and your life back to normal
                  by evening.
                </p>

                <div className="flex flex-col sm:flex-row gap-3.5 mb-10">
                  <button
                    type="button"
                    onClick={callNow}
                    className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-[18px] px-10 text-[17px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                    style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 20px 60px rgba(212,165,116,0.35)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Request Free Assessment
                  </button>
                  <a href={`tel:${PHONE_TEL}`}
                    className="inline-flex min-h-[64px] items-center justify-center gap-2.5 rounded-[18px] border border-white/18 bg-white/[0.06] px-10 text-[17px] font-bold text-white/85 backdrop-blur-sm transition-all hover:bg-white/[0.12] hover:border-white/30">
                    Call {PHONE_DISPLAY}
                  </a>
                </div>

                <div className="flex flex-wrap gap-x-7 gap-y-3">
                  {["Most roofs: 1 day", "Licensed HI-71484", "Fully Insured", "Up to 50-yr warranty", "Financing available"].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="#D4A574" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] font-semibold text-white/55">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Authority card */}
              <div className="hidden lg:block">
                <div className="relative rounded-[28px] overflow-hidden"
                  style={{ background: "linear-gradient(145deg, #0D1E38 0%, #0F2452 50%, #0A1835 100%)", boxShadow: "0 48px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)" }}>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0"
                    style={{ background: "linear-gradient(135deg, rgba(212,165,116,0.08) 0%, transparent 55%)" }} />
                  <div aria-hidden="true" className="absolute top-0 left-8 right-8 h-[2px]"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(212,165,116,0.6), transparent)" }} />

                  <div className="relative p-8">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-6">
                      What&rsquo;s Included — Every Project
                    </div>

                    <div className="space-y-4 mb-8">
                      {[
                        { title: "Full Tear-Off", sub: "Old shingles, felt & nails removed completely" },
                        { title: "New Underlayment", sub: "Ice & water shield + synthetic felt" },
                        { title: "Architectural Shingles", sub: "Premium dimensional shingles, your choice" },
                        { title: "Flashing & Ridge Caps", sub: "All valleys, hips, and ridge lines sealed" },
                        { title: "Ventilation Check", sub: "Intake & exhaust balanced for longevity" },
                        { title: "Full Cleanup", sub: "Magnetic nail sweep · debris haul-away" },
                        { title: "Final Inspection", sub: "Before we leave — we walk the roof together" },
                      ].map(({ title, sub }) => (
                        <div key={title} className="flex items-start gap-3.5">
                          <div className="mt-0.5 w-5 h-5 rounded-full border border-[#D4A574]/40 flex items-center justify-center flex-shrink-0">
                            <svg width="9" height="7" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                              <path d="M1 4l2.5 2.5L9 1" stroke="#D4A574" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-white/85 leading-tight">{title}</div>
                            <div className="text-[12px] text-white/35 mt-0.5">{sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-white/[0.09] pt-6">
                      <button type="button" onClick={callNow}
                        className="w-full min-h-[54px] rounded-[14px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                        style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 12px 40px rgba(212,165,116,0.28)" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Get Free Assessment
                      </button>
                      <p className="mt-3 text-[11px] text-center text-white/25">No obligation · We come to you</p>
                      <Link
                        href="/estimate"
                        className="mt-4 flex items-center justify-center gap-2 text-[12px] font-semibold text-[#D4A574]/55 hover:text-[#D4A574]/90 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M8 9h8M8 13h6M8 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        Or start your estimate online →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            CREDENTIAL STRIP
        ═══════════════════════════════════════════════════════ */}
        <div className="relative border-t border-b border-white/[0.07] bg-black/30 backdrop-blur-md">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:gap-x-14">
              {[
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                  label: "Most roofs completed in 1 day",
                  strong: "1 Day",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                  label: "NY State Home Improvement Contractor",
                  strong: "HI-71484",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" /><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                  label: "Property damage & liability",
                  strong: "Fully Insured",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" /></svg>,
                  label: "Suffolk & Nassau Counties",
                  strong: "Long Island",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                  label: "Founder personally oversees every project",
                  strong: "Founder-Led",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                  label: "Up to 50-yr shingle manufacturer warranty",
                  strong: "50-yr Warranty",
                },
                {
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                  label: "Monthly payment options available",
                  strong: "Financing",
                },
              ].map(({ icon, label, strong }) => (
                <div key={strong} className="flex items-center gap-3">
                  <div className="text-[#D4A574]/70">{icon}</div>
                  <div>
                    <div className="text-[13px] font-extrabold text-white/75">{strong}</div>
                    <div className="text-[11px] text-white/32 leading-tight">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            WHAT'S INCLUDED
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(212,165,116,0.12), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[680px] mb-14 sm:mb-16">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#EFE4D2] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(212,165,116,0.12)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#C49060]" aria-hidden="true">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C49060]">Complete Scope</span>
              </div>
              <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
                Nothing left for
                <br />
                <span style={{ color: "#C49060" }}>you to manage.</span>
              </h2>
              <p className="text-[15px] sm:text-[17px] leading-relaxed text-[#475569] max-w-[520px]">
                From the first nail pulled to the final inspection — every step
                is handled by our team. Here&rsquo;s exactly what your project includes.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: "Full Tear-Off",
                  body: "Every layer of old roofing material — shingles, felt, and staples — removed down to the decking. No layovers.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Decking Inspection",
                  body: "Every sheet of plywood inspected. Soft spots, rot, and damaged boards replaced before anything goes on top.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Ice & Water Shield",
                  body: "Self-adhering waterproof membrane applied to all eaves, valleys, and penetrations — where leaks start.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Synthetic Underlayment",
                  body: "Premium synthetic felt over the full deck — stronger and more moisture-resistant than traditional #15 felt.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>,
                },
                {
                  title: "Architectural Shingles",
                  body: "Dimensional shingles from leading manufacturers — better curb appeal, wind resistance, and longevity than 3-tab.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 20h20M4 20V10l8-6 8 6v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Step & Counter Flashing",
                  body: "All chimneys, skylights, dormers, and walls properly flashed with metal — the #1 source of leak prevention.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Ridge Cap & Hip Shingles",
                  body: "All ridges and hips finished with matching premium cap shingles for a clean, sealed, professional appearance.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 3l14 9-14 9V3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Ventilation Balanced",
                  body: "Ridge vents, soffit vents, and any powered ventilation checked and balanced. Proper airflow extends shingle life by years.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1013 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
                {
                  title: "Magnetic Nail Sweep",
                  body: "Your entire property — driveway, lawn, landscaping — swept with a magnetic roller. Not one nail left behind.",
                  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>,
                },
              ].map(({ title, body, icon }) => (
                <div key={title} className="group rounded-[22px] border border-[#C5CBD8] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_56px_rgba(15,23,42,0.11)] hover:-translate-y-0.5">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#FBF5ED] text-[#C49060] transition-all group-hover:bg-[#C49060] group-hover:text-white">
                    {icon}
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">{title}</h3>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-center lg:hidden">
              <button type="button" onClick={callNow}
                className="inline-flex h-[58px] items-center gap-3 rounded-[16px] px-9 text-[16px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 16px 48px rgba(212,165,116,0.30)" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Request Free Assessment
              </button>
            </div>

            {/* ── Warranty + Financing callout ── */}
            <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 gap-5">
              {/* Warranty */}
              <div className="rounded-[22px] border border-[#EFE4D2] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] flex items-start gap-5">
                <div className="flex-shrink-0 h-12 w-12 rounded-[14px] bg-[#FBF5ED] flex items-center justify-center text-[#C49060]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C49060] mb-1">Warranty</div>
                  <h4 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">Up to 50-year warranty available.</h4>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">
                    Architectural shingles carry manufacturer warranties from 25 to 50 years depending on product grade. Workmanship warranty on our installation included. Details reviewed at your free assessment.
                  </p>
                </div>
              </div>
              {/* Financing */}
              <div className="rounded-[22px] border border-[#D9E4FF] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] flex items-start gap-5">
                <div className="flex-shrink-0 h-12 w-12 rounded-[14px] bg-[#EEF3FF] flex items-center justify-center text-[#306EEC]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC] mb-1">Financing</div>
                  <h4 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">Don&rsquo;t let cost delay a failing roof.</h4>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">
                    Monthly payment options are available for qualified homeowners. Spread your roof replacement over time and protect your home now — before a small problem becomes a ceiling. Ask about financing at your free assessment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            1-DAY TIMELINE
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #091220 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full blur-[180px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(212,165,116,0.09), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[720px] text-center mb-14 sm:mb-16">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/20 bg-[#D4A574]/[0.06] px-4 py-2 mb-6 backdrop-blur-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#D4A574]" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4A574]/70">The 1-Day Process</span>
              </div>
              <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
                From first nail
                <br />
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}>
                  to done by evening.
                </span>
              </h2>
              <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
                A typical Long Island re-roofing project follows this exact
                schedule. Your home is protected the same day we start.
              </p>
            </div>

            <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              <div aria-hidden="true" className="hidden lg:block absolute top-[52px] left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px"
                style={{ background: "linear-gradient(90deg, rgba(212,165,116,0.5) 0%, rgba(212,165,116,0.2) 100%)" }} />

              {[
                { time: "7 – 8 AM", phase: "Setup & Delivery", body: "Crew arrives. Tarps protect landscaping and siding. All materials staged. Plan for the day confirmed." },
                { time: "8 – 11 AM", phase: "Full Tear-Off", body: "Old roofing stripped to decking. Nails cleared. Decking inspected. Any repairs done before proceeding." },
                { time: "11 AM – 4 PM", phase: "Installation", body: "Underlayment, shingles, flashing, ridge caps — installed in sequence. Ventilation balanced." },
                { time: "4 – 6 PM", phase: "Cleanup & Inspection", body: "Magnetic nail sweep of entire property. Debris hauled. Walk-through with you before we leave." },
              ].map(({ time, phase, body }, i) => (
                <div key={phase} className="relative flex flex-col">
                  <div className="mb-5 flex items-center gap-4 lg:flex-col lg:items-start">
                    <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 bg-[#0A1421]"
                      style={{ borderColor: "rgba(212,165,116,0.45)" }}>
                      <span className="text-[15px] font-black" style={{ color: "#D4A574" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4A574]/60 lg:hidden">{time}</div>
                  </div>
                  <div className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4A574]/60 mb-2">{time}</div>
                  <h3 className="text-[16px] font-bold text-white mb-2.5 leading-snug">{phase}</h3>
                  <p className="text-[13px] sm:text-[14px] text-white/42 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 sm:mt-14 rounded-[20px] border border-[#D4A574]/15 px-6 py-5 text-center"
              style={{ background: "linear-gradient(145deg, rgba(212,165,116,0.06) 0%, rgba(212,165,116,0.02) 100%)" }}>
              <p className="text-[14px] text-white/38 leading-relaxed max-w-[680px] mx-auto">
                <span className="text-white/55 font-semibold">Note:</span> &ldquo;1-day completion&rdquo; applies to standard residential re-roofing. Multi-story homes, steep pitches, or significant decking repair may require additional time. We provide a precise timeline at your free assessment.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            PROJECT GALLERY
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0B1525 0%, #0D1A30 60%, #0A1220 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 lg:mb-14">
              <div className="max-w-[560px]">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 mb-7 backdrop-blur-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#D4A574]" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                    Real Long Island Projects
                  </span>
                </div>
                <h2 className="text-[36px] sm:text-[52px] lg:text-[60px] font-black leading-[0.88] tracking-[-0.045em] text-white mb-5">
                  Work we&rsquo;re
                  <br />
                  <span className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}>
                    proud to show.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
                  Real results from Long Island homeowners — the craftsmanship
                  behind every roof we replace.
                </p>
              </div>

              <div className="flex gap-4 flex-shrink-0">
                {[
                  { v: "1 Day", l: "Typical project" },
                  { v: "9+ yrs", l: "On Long Island" },
                  { v: "5.0 ★", l: "Google Rating" },
                ].map(({ v, l }) => (
                  <div key={l} className="rounded-[16px] border border-white/[0.09] bg-white/[0.04] px-4 py-4 text-center min-w-[88px]">
                    <div className="text-[18px] font-extrabold text-white leading-none mb-1.5">{v}</div>
                    <div className="text-[10px] font-semibold text-white/35">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Featured photo + sidebar */}
            <div className="grid lg:grid-cols-[1fr_280px] gap-6 lg:gap-8 items-start">
              <div className="flex flex-col gap-4">

                {/* Featured image */}
                <div className="relative w-full overflow-hidden rounded-[22px] group" style={{ aspectRatio: "16/10" }}>
                  <Image
                    src={activePhoto.src}
                    alt={activePhoto.label}
                    fill
                    className="object-cover transition-all duration-500"
                    sizes="(max-width: 1024px) 92vw, 760px"
                    priority
                  />
                  <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.40)] rounded-[22px]" />
                  <div className="absolute inset-x-0 bottom-0 h-[55%]"
                    style={{ background: "linear-gradient(to top, rgba(8,15,30,0.85) 0%, rgba(8,15,30,0.40) 55%, transparent 100%)" }} />

                  {/* Category chip */}
                  <div className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 px-3.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D4A574] flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(212,165,116,0.8)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/85">Roofing</span>
                  </div>

                  {/* Counter */}
                  <div className="absolute top-5 right-5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/50">
                    {galleryIdx + 1} / {GALLERY.length}
                  </div>

                  {/* Bottom label + nav */}
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 flex items-end justify-between">
                    <div>
                      <div className="text-[26px] sm:text-[32px] font-black text-white leading-none tracking-[-0.025em] mb-1">
                        {activePhoto.label}
                      </div>
                      <div className="text-[11px] font-semibold text-white/45 uppercase tracking-[0.18em]">
                        {activePhoto.detail}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setGalleryIdx((i) => (i - 1 + GALLERY.length) % GALLERY.length)}
                        aria-label="Previous project"
                        className="w-10 h-10 rounded-full border border-white/20 bg-white/[0.10] backdrop-blur-sm flex items-center justify-center hover:bg-white/[0.20] transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => setGalleryIdx((i) => (i + 1) % GALLERY.length)}
                        aria-label="Next project"
                        className="w-10 h-10 rounded-full border border-white/20 bg-white/[0.10] backdrop-blur-sm flex items-center justify-center hover:bg-white/[0.20] transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thumbnail strip */}
                <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {GALLERY.map((g, i) => (
                    <button key={g.src} type="button" onClick={() => setGalleryIdx(i)} aria-label={`View ${g.label}`}
                      className={`relative flex-shrink-0 w-[72px] h-[54px] rounded-[10px] overflow-hidden border-2 transition-all focus:outline-none ${i === galleryIdx ? "border-[#D4A574] shadow-[0_0_14px_rgba(212,165,116,0.30)]" : "border-white/[0.08] opacity-55 hover:opacity-85 hover:border-white/20"}`}>
                      <Image src={g.src} alt={g.label} fill className="object-cover" sizes="72px" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Info sidebar */}
              <div className="flex flex-col gap-4">
                <div className="rounded-[22px] border border-white/[0.09] p-6 flex flex-col gap-5"
                  style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)" }}>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Every project</div>
                    <p className="text-[15px] font-semibold text-white/80 leading-snug">
                      The same crew. The same standards. Every single time.
                    </p>
                  </div>
                  {[
                    "Same crew · every project",
                    "Licensed NY HI-71484",
                    "Fully insured",
                    "No sub-contractors",
                    "Magnetic nail sweep included",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="#D4A574" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] text-white/55">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-[22px] border border-[#D4A574]/20 p-6 flex flex-col gap-4"
                  style={{ background: "linear-gradient(145deg, rgba(212,165,116,0.10) 0%, rgba(212,165,116,0.04) 100%)" }}>
                  <div>
                    <p className="text-[15px] font-bold text-white/85 mb-1">Ready for a free assessment?</p>
                    <p className="text-[13px] text-white/40 leading-relaxed">We come to you. Clear pricing before any work starts.</p>
                  </div>
                  <button type="button" onClick={callNow}
                    className="w-full min-h-[52px] rounded-[14px] text-[14px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 10px 30px rgba(212,165,116,0.25)" }}>
                    Request Free Assessment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            WHY HOMEOWNERS CHOOSE US
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full blur-[140px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(212,165,116,0.10), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[680px] mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#EFE4D2] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(212,165,116,0.10)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#C49060]" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C49060]">Why Profixter</span>
              </div>
              <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
                Serious professionals.
                <br />
                <span style={{ color: "#C49060" }}>Not just roofers.</span>
              </h2>
              <p className="text-[15px] sm:text-[17px] leading-relaxed text-[#475569]">
                What sets us apart isn&rsquo;t just speed — it&rsquo;s how we think about your home and your time.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { headline: "One day. Your home back to normal.", body: "We finish what we start. Most competitors take 2–5 days for a job we complete in one. Your yard is back to normal before dark.", accent: "#C49060" },
                { headline: "You call Taras. Not a call center.", body: "The founder's direct line. Before, during, and after your project. Real accountability from a person who put his name on the license.", accent: "#306EEC" },
                { headline: "NY Licensed. Fully Insured. Verifiable.", body: "HI-71484 is verifiable through the NYS Department of State in 30 seconds. Proof of insurance provided before any work begins. Always.", accent: "#16A34A" },
                { headline: "No sub-contractors. Our crew, always.", body: "We don't farm work out. The team who shows up is our team — vetted, trained, and accountable to us and to you.", accent: "#C49060" },
                { headline: "We show you before we fix it.", body: "If we find damaged decking or unexpected issues, we stop and show you — with photos, on the spot — before touching it. You decide.", accent: "#306EEC" },
                { headline: "Your property respected.", body: "Tarps protect every inch of landscaping and siding. Magnetic nail sweep before we leave. We treat your property like we live there.", accent: "#16A34A" },
              ].map(({ headline, body, accent }) => (
                <div key={headline} className="rounded-[22px] border border-[#C5CBD8] bg-white p-7 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
                  <div className="mb-5 h-1.5 w-10 rounded-full" style={{ background: accent }} />
                  <h3 className="text-[16px] font-bold text-[#0B1628] mb-2.5 leading-snug">{headline}</h3>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FAQ
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #091220 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(212,165,116,0.07), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-14 items-start">

              <div>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/20 bg-[#D4A574]/[0.06] px-4 py-2 mb-7 backdrop-blur-sm">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4A574]/70">Real Answers</span>
                </div>
                <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
                  Common questions.
                  <br />
                  <span className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}>
                    Straight answers.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/42 leading-relaxed mb-10">
                  No canned responses. These are the actual questions homeowners ask before signing.
                </p>
                <div className="space-y-3">
                  {FAQS.map((faq) => <FaqRow key={faq.q} {...faq} />)}
                </div>
              </div>

              {/* Sticky contact */}
              <div className="lg:sticky lg:top-[100px] flex flex-col gap-4">
                <div className="rounded-[22px] border border-white/[0.10] p-7 flex flex-col gap-5"
                  style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)" }}>
                  <div>
                    <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">Still have questions?</div>
                    <p className="text-[16px] font-semibold text-white/80 leading-snug">
                      Call Taras directly. A real answer from the founder who runs every project.
                    </p>
                  </div>
                  <a href={`tel:${PHONE_TEL}`}
                    className="flex items-center gap-3.5 rounded-[14px] border border-white/[0.12] bg-white/[0.06] px-4 py-4 hover:border-white/[0.22] hover:bg-white/[0.10] transition-all group">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#D4A574] group-hover:bg-[#C49060] transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/30">Call or text Taras</div>
                      <div className="text-[17px] font-bold text-white">{PHONE_DISPLAY}</div>
                    </div>
                  </a>
                </div>

                <div className="rounded-[22px] border border-[#D4A574]/20 p-7 flex flex-col gap-4"
                  style={{ background: "linear-gradient(145deg, rgba(212,165,116,0.08) 0%, rgba(212,165,116,0.03) 100%)" }}>
                  <div>
                    <p className="text-[15px] font-bold text-white/80 mb-1">Ready for your free assessment?</p>
                    <p className="text-[13px] text-white/40 leading-relaxed">We come to you. No obligation. Clear pricing before any work starts.</p>
                  </div>
                  <button type="button" onClick={callNow}
                    className="w-full rounded-[14px] py-3.5 text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 12px 36px rgba(212,165,116,0.25)" }}>
                    Request Assessment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FOUNDER TRUST
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full py-16 sm:py-20 lg:py-24 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}>
          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[28px] border border-[#C5CBD8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="grid lg:grid-cols-[1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#E6E8EF]">

                <div className="px-8 py-10 sm:px-10 sm:py-12 lg:px-12 flex flex-col justify-between gap-7">
                  <div className="flex items-center gap-4">
                    <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
                      <Image src="/images/Taras.png" alt="Taras Bandura" fill className="object-cover object-top" sizes="72px" />
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-[#0B1628]">Taras Bandura</div>
                      <div className="text-[13px] font-semibold text-[#C49060]">Founder &amp; General Manager</div>
                    </div>
                  </div>

                  <blockquote className="border-l-2 border-[#D4A574] pl-5 text-[15px] sm:text-[16px] leading-relaxed text-[#1E293B]">
                    &ldquo;I personally review every roofing project we accept. I know what our team can deliver and I only agree to jobs we can do right. When we say one day — I mean it. And if anything isn&rsquo;t right, you call me directly.&rdquo;
                  </blockquote>

                  <div className="flex flex-wrap gap-5">
                    {["9+ Years Construction", "Licensed HI-71484", "Fully Insured", "Founder-Led"].map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#C49060" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#64748B]">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-8 py-10 sm:px-10 sm:py-12 lg:px-12 bg-[#FBF7F0] flex flex-col justify-between gap-6">
                  <div>
                    <div className="text-[22px] sm:text-[26px] font-extrabold leading-tight text-[#0B1628] mb-3">
                      Your roof protects everything you own.
                    </div>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      Don&rsquo;t wait for a leak to make the call. A free assessment
                      costs you nothing. Replacing a ceiling costs a lot more.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button type="button" onClick={callNow}
                      className="inline-flex h-[56px] items-center justify-center gap-2.5 rounded-[14px] text-[16px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                      style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 12px 36px rgba(212,165,116,0.28)" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Request Free Assessment
                    </button>
                    <a href={`tel:${PHONE_TEL}`}
                      className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-[#C5CBD8] bg-white text-[15px] font-semibold text-[#0B1628] transition hover:border-[#D4A574] hover:text-[#C49060]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Call Taras: {PHONE_DISPLAY}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FINAL CTA
        ═══════════════════════════════════════════════════════ */}
        <section className="relative w-full overflow-hidden py-24 sm:py-32 lg:py-40"
          style={{ background: "linear-gradient(160deg, #050D1A 0%, #071224 55%, #060E1C 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px]"
            style={{ background: "radial-gradient(circle, rgba(212,165,116,0.15), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[880px] text-center">

              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D4A574]/20 bg-[#D4A574]/[0.07] px-4 py-2 backdrop-blur-sm mb-9">
                <span className="h-2 w-2 rounded-full bg-[#D4A574] flex-shrink-0" style={{ boxShadow: "0 0 10px rgba(212,165,116,0.9)" }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4A574]/80">
                  Long Island&rsquo;s 1-Day Roof Replacement
                </span>
              </div>

              <h2 className="text-[52px] sm:text-[72px] lg:text-[96px] font-black leading-[0.87] tracking-[-0.048em] text-white mb-6">
                Don&rsquo;t wait for
                <br />
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #D4A574 0%, #E8C49A 50%, #D4A574 100%)" }}>
                  the leak.
                </span>
              </h2>

              <p className="text-[18px] sm:text-[22px] font-semibold text-white/50 leading-[1.4] max-w-[580px] mx-auto mb-10 sm:mb-12">
                A free assessment costs you nothing. Replacing a ceiling — and
                the damage underneath it — costs a great deal more.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center mb-7">
                <button type="button" onClick={callNow}
                  className="inline-flex min-h-[68px] items-center justify-center gap-3 rounded-[18px] px-12 text-[18px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #D4A574 0%, #C49060 100%)", boxShadow: "0 24px 70px rgba(212,165,116,0.40)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Request Free Assessment
                </button>
                <a href={`tel:${PHONE_TEL}`}
                  className="inline-flex min-h-[68px] items-center justify-center gap-3 rounded-[18px] border border-white/18 bg-white/[0.07] px-12 text-[18px] font-bold text-white/85 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/[0.12]">
                  Call {PHONE_DISPLAY}
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-8 border-t border-white/[0.07]">
                {["Free assessment · No obligation", "Licensed HI-71484", "Fully Insured", "Up to 50-yr warranty", "Financing available"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="#D4A574" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[12px] font-semibold text-white/38">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
