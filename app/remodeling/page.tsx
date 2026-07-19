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
  { src: "/images/projects/p1.jpg", label: "Master Bath Renovation", detail: "Custom tile & fixtures · Suffolk County" },
  { src: "/images/projects/p2.jpg", label: "Walk-In Shower Build", detail: "Floor-to-ceiling tile · Nassau County" },
  { src: "/images/projects/p3.jpg", label: "Double Vanity Install", detail: "Custom cabinetry & lighting · Long Island" },
  { src: "/images/projects/p4.jpg", label: "Full Gut Renovation", detail: "Complete remodel · Suffolk County" },
  { src: "/images/projects/p5.jpg", label: "Frameless Glass Shower", detail: "Luxury enclosure · Nassau County" },
  { src: "/images/projects/p6.jpg", label: "Guest Bath Refresh", detail: "Tile, plumbing & fixtures · Long Island" },
];

const FAQS = [
  {
    q: "How long does a full bathroom remodel take?",
    a: "Most full bathroom remodels on Long Island take 2–4 weeks from demo day to final punch list. The exact timeline depends on scope: a standard tub-to-shower conversion with tile, vanity, and fixtures runs about 2 weeks. A full gut renovation - all new plumbing, layout changes, custom tile - typically runs 3–4 weeks. We give you a precise schedule before any work begins.",
  },
  {
    q: "What does a bathroom remodel cost on Long Island?",
    a: "A professional full bathroom remodel in Nassau and Suffolk County typically ranges from $18,000–$55,000+ depending on the size, materials, and scope. We don't believe in giving you a price before we see your space. We provide a detailed written estimate after a free in-home consultation - with line items, not vague ballparks. No surprises.",
  },
  {
    q: "Do you handle permits?",
    a: "Yes. We are licensed NY State Home Improvement Contractor HI-71484 and we handle the permit process. Plumbing and electrical work requires permits in most Long Island municipalities. We pull them, coordinate with inspectors, and make sure every phase passes. This is non-negotiable - it protects you legally and protects your home's resale value.",
  },
  {
    q: "Do you do design, or do I need to hire a designer?",
    a: "We guide you through all material and fixture selections. For most projects, homeowners work directly with us - we bring samples, help with tile selection, vanity choices, lighting, and layout decisions. For high-complexity custom designs, we can coordinate with a designer. Most Long Island homeowners find our consultation process more than sufficient.",
  },
  {
    q: "Will there be waterproofing behind the tile?",
    a: "Always. We use a waterproofing membrane system - not just cement board - behind all wet areas. Moisture intrusion is the #1 cause of bathroom failures that lead to mold, structural damage, and costly re-dos. We do this correctly every time, which is why our projects don't come back with problems.",
  },
  {
    q: "Can I stay in my home during the remodel?",
    a: "Yes. We respect your home and your routine. We keep the work area contained, protect adjacent flooring and walls, and clean up daily. If the bathroom being remodeled is your only bathroom, we can discuss sequencing or schedule around your needs.",
  },
  {
    q: "What if you find mold or rot behind the walls?",
    a: "We stop, document it with photos, and show you before doing anything. We price any remediation separately and you decide whether to proceed. We never do additional work without your explicit approval. This is standard protocol on every project.",
  },
  {
    q: "Are you licensed and insured?",
    a: "Yes. NY State Licensed Home Improvement Contractor HI-71484, verifiable through the NYS Department of State. Fully insured for property damage and general liability. We provide proof of insurance before any work begins - always. Don't hire a contractor who can't hand you a COI immediately.",
  },
  {
    q: "What tile brands and materials do you work with?",
    a: "We work with a wide range of materials from mid-tier to luxury - porcelain, natural stone, large-format slabs, mosaic, wood-look tile, and more. We bring samples to your home and help you choose based on your style, maintenance tolerance, and budget. We'll tell you honestly which materials perform best in Long Island bathrooms.",
  },
  {
    q: "Do you offer any warranty on the work?",
    a: "Yes - we warranty our workmanship. Manufacturer warranties apply to fixtures and materials. If something we installed fails due to our installation, we come back and fix it. The specifics are in your contract. Ask us at your consultation.",
  },
  {
    q: "Can I finance my bathroom remodel?",
    a: "Yes - monthly payment options are available for qualified homeowners. Financing your bathroom remodel means you don't have to delay the project while saving. You get the result now - the better bathroom, the better start to every morning - and pay over time. We discuss financing at your free consultation. No commitment required, and you decide what works for your situation.",
  },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-[18px] border transition-all duration-200 overflow-hidden ${
        open
          ? "border-[#306EEC]/30 bg-[#306EEC]/[0.04]"
          : "border-white/[0.09] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.14]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left focus:outline-none"
        aria-expanded={open}
      >
        <span
          className={`text-[15px] sm:text-[16px] font-semibold leading-snug transition-colors ${
            open ? "text-[#7BAEFF]" : "text-white/82"
          }`}
        >
          {q}
        </span>
        <svg
          className={`flex-shrink-0 mt-0.5 w-5 h-5 transition-transform duration-300 ${
            open ? "rotate-180 text-[#7BAEFF]" : "text-white/30"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-[14px] sm:text-[15px] leading-relaxed text-white/50">{a}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RemodelingPage() {
  const [galleryIdx, setGalleryIdx] = useState(0);
  const activePhoto = GALLERY[galleryIdx];

  const callNow = () => {
    trackEvent("remodeling_call_cta", { placement: "remodeling_page" });
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
        <section
          className="relative w-full overflow-hidden min-h-[94vh] flex items-center"
          style={{ background: "linear-gradient(160deg, #060C18 0%, #0A1421 55%, #080F1C 100%)" }}
        >
          {/* Depth glows */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/4 h-[700px] w-[700px] rounded-full blur-[200px] opacity-45"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.14), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full blur-[180px] opacity-30"
            style={{ background: "radial-gradient(circle, rgba(134,239,172,0.06), transparent 70%)" }} />
          {/* Dot texture */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.022]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          {/* Blue top-edge accent */}
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.50), transparent)" }} />

          <div className="relative w-full mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-24 sm:py-28 lg:py-32">
            <div className="grid lg:grid-cols-[1fr_500px] gap-12 lg:gap-16 items-center">

              {/* Left: Copy */}
              <div>
                <Link href="/projects" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/30 hover:text-white/55 transition-colors mb-6">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Home Improvement
                </Link>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#306EEC]/30 bg-[#306EEC]/[0.08] px-4 py-2 backdrop-blur-sm mb-8">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#7BAEFF]" aria-hidden="true">
                    <path d="M5 3l14 9-14 9V3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7BAEFF]/90">
                    Full Bathroom Remodeling · Long Island
                  </span>
                </div>

                <h1 className="text-[56px] sm:text-[76px] lg:text-[92px] font-black leading-[0.86] tracking-[-0.048em] text-white mb-7">
                  Your bathroom.
                  <br />
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #7BAEFF 0%, #306EEC 50%, #5B9BFF 100%)" }}
                  >
                    Transformed.
                  </span>
                </h1>

                <p className="text-[20px] sm:text-[22px] font-bold leading-[1.3] text-white/85 mb-4 max-w-[520px]">
                  Beautiful. Functional. Built to last.
                  From design to final finish.
                </p>
                <p className="text-[16px] sm:text-[17px] leading-[1.75] text-white/45 max-w-[480px] mb-10">
                  A bathroom remodel is the highest-return renovation you can
                  make. We do it properly - licensed, permitted, waterproofed,
                  and finished to a standard your home deserves.
                </p>

                <div className="flex flex-col sm:flex-row gap-3.5 mb-4">
                  <button
                    type="button"
                    onClick={callNow}
                    className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-[18px] px-10 text-[17px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                    style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 20px 60px rgba(48,110,236,0.40)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Request Free Consultation
                  </button>
                  <a
                    href={`tel:${PHONE_TEL}`}
                    className="inline-flex min-h-[64px] items-center justify-center gap-2.5 rounded-[18px] border border-white/18 bg-white/[0.06] px-10 text-[17px] font-bold text-white/85 backdrop-blur-sm transition-all hover:bg-white/[0.12] hover:border-white/30"
                  >
                    Call {PHONE_DISPLAY}
                  </a>
                </div>
                <div className="mb-8">
                  <Link
                    href="/estimate"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#7BAEFF]/55 hover:text-[#7BAEFF]/90 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 9h8M8 13h6M8 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Start your estimate online →
                  </Link>
                </div>

                <div className="flex flex-wrap gap-x-7 gap-y-3">
                  {["Licensed HI-71484", "Fully Insured", "Permitted & Inspected", "Workmanship warranty", "Financing available"].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="#7BAEFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] font-semibold text-white/55">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Authority card */}
              <div className="hidden lg:block">
                <div
                  className="relative rounded-[28px] overflow-hidden"
                  style={{
                    background: "linear-gradient(145deg, #0D1E38 0%, #0F2452 50%, #0A1835 100%)",
                    boxShadow: "0 48px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
                  }}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0"
                    style={{ background: "linear-gradient(135deg, rgba(48,110,236,0.10) 0%, transparent 55%)" }} />
                  <div aria-hidden="true" className="absolute top-0 left-8 right-8 h-[2px]"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.7), transparent)" }} />

                  {/* Decorative bathroom icon */}
                  <div className="absolute top-6 right-6 opacity-[0.08]" aria-hidden="true">
                    <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
                      <rect x="8" y="40" width="80" height="40" rx="6" stroke="#7BAEFF" strokeWidth="2" />
                      <path d="M20 40V28a4 4 0 014-4h8a4 4 0 014 4v12" stroke="#7BAEFF" strokeWidth="2" strokeLinecap="round" />
                      <line x1="8" y1="56" x2="88" y2="56" stroke="#7BAEFF" strokeWidth="1.5" />
                      <path d="M40 80v8M56 80v8" stroke="#7BAEFF" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="48" cy="20" r="6" stroke="#7BAEFF" strokeWidth="1.5" />
                      <path d="M48 14v-6M48 32v-6M42 20H36M60 20h-6" stroke="#7BAEFF" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div className="relative p-8">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-6">
                      What&rsquo;s Included - Every Project
                    </div>

                    <div className="space-y-4 mb-8">
                      {[
                        { title: "Full Demolition", sub: "Everything out - tile, fixtures, drywall, plumbing" },
                        { title: "Waterproofing System", sub: "Membrane behind all wet areas - not just cement board" },
                        { title: "Plumbing Updates", sub: "New supply lines, drains, and rough-in as needed" },
                        { title: "Premium Tile Work", sub: "Floor, walls, and shower - set and grouted properly" },
                        { title: "Vanity & Lighting", sub: "Install, connect, level, and finish" },
                        { title: "Shower / Tub Enclosure", sub: "Frameless glass, acrylic, or custom tile surround" },
                        { title: "Final Punch List", sub: "Walk-through with you before we call it done" },
                      ].map(({ title, sub }) => (
                        <div key={title} className="flex items-start gap-3.5">
                          <div className="mt-0.5 w-5 h-5 rounded-full border border-[#306EEC]/40 flex items-center justify-center flex-shrink-0">
                            <svg width="9" height="7" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                              <path d="M1 4l2.5 2.5L9 1" stroke="#7BAEFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
                      <button
                        type="button"
                        onClick={callNow}
                        className="w-full min-h-[54px] rounded-[14px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                        style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 12px 40px rgba(48,110,236,0.32)" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Get Free Consultation
                      </button>
                      <p className="mt-3 text-[11px] text-center text-white/25">No obligation · We come to you</p>
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
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  label: "NY State Home Improvement Contractor",
                  strong: "HI-71484",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  label: "Property damage & liability",
                  strong: "Fully Insured",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  label: "Permits pulled and inspected",
                  strong: "Fully Permitted",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  ),
                  label: "Suffolk & Nassau Counties",
                  strong: "Long Island",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  label: "Founder personally reviews every project",
                  strong: "Founder-Led",
                },
              ].map(({ icon, label, strong }) => (
                <div key={strong} className="flex items-center gap-3">
                  <div className="text-[#7BAEFF]/70">{icon}</div>
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
        <section
          className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[680px] mb-14 sm:mb-16">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.10)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">Complete Scope</span>
              </div>
              <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
                Everything handled.
                <br />
                <span style={{ color: "#306EEC" }}>Start to finish.</span>
              </h2>
              <p className="text-[15px] sm:text-[17px] leading-relaxed text-[#475569] max-w-[520px]">
                From demolition day to the moment you turn on your new shower
                for the first time - every trade, every detail, fully
                coordinated by our team.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: "Full Demolition",
                  body: "Tile, drywall, fixtures, tub, vanity - all removed cleanly. Debris hauled same day. No half-done demo left sitting.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Waterproofing System",
                  body: "Waterproof membrane applied behind every wet area - not just cement board. This is what separates a lasting bathroom from one that fails in three years.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Plumbing Updates",
                  body: "New supply lines, shut-offs, and drain assemblies. Shower valves, tub spouts, and rough-in work handled correctly with proper permits.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0110 0c0 4-5 7-5 7z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Tile Work",
                  body: "Floor, walls, and shower niche - set level, grouted properly, sealed. Large-format tile, subway, mosaic, natural stone. We work with your selection.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.7" />
                      <rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.7" />
                      <rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.7" />
                      <rect x="13" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  ),
                },
                {
                  title: "Vanity & Cabinetry",
                  body: "Single or double vanity installed, leveled, and secured. Plumbing connected. Custom cabinetry or pre-built - both done to a finish standard that lasts.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="2" y="7" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M2 11h20M9 11v9M15 11v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  ),
                },
                {
                  title: "Shower & Tub Enclosures",
                  body: "Walk-in tile showers, frameless glass enclosures, or tub surrounds. Leak-tested before we close anything. No shortcuts on the waterline.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M8 10V8a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      <path d="M12 15v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  title: "Lighting & Electrical",
                  body: "Vanity lighting, recessed fixtures, exhaust fans - installed and wired. All electrical work permitted. We coordinate with licensed electricians.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Flooring",
                  body: "Tile, luxury vinyl, or stone - installed with proper substrate, leveling compound where needed, and transitions finished clean.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  title: "Painting & Final Finish",
                  body: "Walls primed and painted, trim caulked, hardware installed, mirrors hung. We don't hand over a job that looks 95% done. Full punch list before we leave.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M2 20h20M4 20V10l8-6 8 6v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
              ].map(({ title, body, icon }) => (
                <div
                  key={title}
                  className="group rounded-[22px] border border-[#C5CBD8] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_56px_rgba(15,23,42,0.11)] hover:-translate-y-0.5"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#EEF3FF] text-[#306EEC] transition-all group-hover:bg-[#306EEC] group-hover:text-white">
                    {icon}
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">{title}</h3>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-center lg:hidden">
              <button
                type="button"
                onClick={callNow}
                className="inline-flex h-[58px] items-center gap-3 rounded-[16px] px-9 text-[16px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 16px 48px rgba(48,110,236,0.35)" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Request Free Consultation
              </button>
            </div>

            {/* ── Warranty + Financing callout ── */}
            <div className="mt-10 sm:mt-12 grid sm:grid-cols-2 gap-5">
              {/* Warranty */}
              <div className="rounded-[22px] border border-[#D9E4FF] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] flex items-start gap-5">
                <div className="flex-shrink-0 h-12 w-12 rounded-[14px] bg-[#EEF3FF] flex items-center justify-center text-[#306EEC]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC] mb-1">Warranty</div>
                  <h4 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">Workmanship warranty included.</h4>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">
                    Workmanship warranty on all labor. Product and material warranties vary by manufacturer and selection. Full warranty details reviewed and provided before work begins.
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
                  <h4 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">Start your remodel sooner.</h4>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">
                    Monthly payment options are available for qualified homeowners. Don&rsquo;t delay your bathroom remodel while saving the full amount - start enjoying the result now and pay over time. Ask about financing at your free consultation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            PROJECT GALLERY
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0B1525 0%, #0D1A30 60%, #0A1220 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.12), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 lg:mb-14">
              <div className="max-w-[560px]">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 mb-7 backdrop-blur-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#7BAEFF]" aria-hidden="true">
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
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #7BAEFF 0%, #306EEC 50%, #5B9BFF 100%)" }}
                  >
                    proud to show.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
                  Real results from Long Island bathrooms - the craftsmanship
                  behind every remodel we complete.
                </p>
              </div>

              <div className="flex gap-4 flex-shrink-0">
                {[
                  { v: "2–4 wks", l: "Typical remodel" },
                  { v: "9+ yrs", l: "On Long Island" },
                  { v: "5.0 ★", l: "Google Rating" },
                ].map(({ v, l }) => (
                  <div
                    key={l}
                    className="rounded-[16px] border border-white/[0.09] bg-white/[0.04] px-4 py-4 text-center min-w-[88px]"
                  >
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
                  <div
                    className="absolute inset-x-0 bottom-0 h-[55%]"
                    style={{ background: "linear-gradient(to top, rgba(8,15,30,0.85) 0%, rgba(8,15,30,0.40) 55%, transparent 100%)" }}
                  />

                  {/* Category chip */}
                  <div className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 px-3.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7BAEFF] flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(123,174,255,0.8)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/85">Bathroom</span>
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
                      <button
                        type="button"
                        onClick={() => setGalleryIdx((i) => (i - 1 + GALLERY.length) % GALLERY.length)}
                        aria-label="Previous project"
                        className="w-10 h-10 rounded-full border border-white/20 bg-white/[0.10] backdrop-blur-sm flex items-center justify-center hover:bg-white/[0.20] transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGalleryIdx((i) => (i + 1) % GALLERY.length)}
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
                <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {GALLERY.map((g, i) => (
                    <button
                      key={g.src}
                      type="button"
                      onClick={() => setGalleryIdx(i)}
                      aria-label={`View ${g.label}`}
                      className={`relative flex-shrink-0 w-[72px] h-[54px] rounded-[10px] overflow-hidden border-2 transition-all focus:outline-none ${
                        i === galleryIdx
                          ? "border-[#306EEC] shadow-[0_0_14px_rgba(48,110,236,0.35)]"
                          : "border-white/[0.08] opacity-55 hover:opacity-85 hover:border-white/20"
                      }`}
                    >
                      <Image src={g.src} alt={g.label} fill className="object-cover" sizes="72px" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Info sidebar */}
              <div className="flex flex-col gap-4">
                <div
                  className="rounded-[22px] border border-white/[0.09] p-6 flex flex-col gap-5"
                  style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)" }}
                >
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
                    "Waterproofed properly",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="#7BAEFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] text-white/55">{item}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="rounded-[22px] border border-[#306EEC]/20 p-6 flex flex-col gap-4"
                  style={{ background: "linear-gradient(145deg, rgba(48,110,236,0.10) 0%, rgba(48,110,236,0.04) 100%)" }}
                >
                  <div>
                    <p className="text-[15px] font-bold text-white/85 mb-1">Your bathroom could look like this.</p>
                    <p className="text-[13px] text-white/40 leading-relaxed">Free consultation. We come to you. Clear pricing before any work starts.</p>
                  </div>
                  <button
                    type="button"
                    onClick={callNow}
                    className="w-full min-h-[52px] rounded-[14px] text-[14px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 10px 30px rgba(48,110,236,0.28)" }}
                  >
                    Request Free Consultation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            PROJECT TIMELINE
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full blur-[140px] opacity-30"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.08), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[720px] text-center mb-14 sm:mb-16">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">How It Works</span>
              </div>
              <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
                From first call
                <br />
                <span style={{ color: "#306EEC" }}>to finished bathroom.</span>
              </h2>
              <p className="text-[15px] sm:text-[17px] text-[#475569] leading-relaxed">
                A typical Long Island bathroom remodel follows this sequence.
                We keep you informed at every phase - no surprises.
              </p>
            </div>

            <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              <div aria-hidden="true" className="hidden lg:block absolute top-[52px] left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px"
                style={{ background: "linear-gradient(90deg, rgba(48,110,236,0.5) 0%, rgba(48,110,236,0.2) 100%)" }} />

              {[
                {
                  time: "Week 1",
                  phase: "Consult & Design",
                  body: "Free in-home consultation. We measure, assess, discuss materials, and walk you through the scope. Written estimate with line items - no vague quotes.",
                },
                {
                  time: "Week 2",
                  phase: "Demo & Rough Work",
                  body: "Demolition, waterproofing, rough plumbing and electrical. Everything inspected and approved before any finish work begins.",
                },
                {
                  time: "Week 2–3",
                  phase: "Tile & Fixtures",
                  body: "Tile set and grouted. Vanity, shower enclosure, and all fixtures installed. This is where the transformation becomes visible.",
                },
                {
                  time: "Week 3–4",
                  phase: "Final Finish",
                  body: "Painting, trim, hardware, mirrors, and accessories. Full punch list walked through with you before we leave. Your bathroom, done right.",
                },
              ].map(({ time, phase, body }, i) => (
                <div key={phase} className="relative flex flex-col">
                  <div className="mb-5 flex items-center gap-4 lg:flex-col lg:items-start">
                    <div
                      className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-[0_4px_20px_rgba(48,110,236,0.12)]"
                      style={{ borderColor: "rgba(48,110,236,0.45)" }}
                    >
                      <span className="text-[15px] font-black" style={{ color: "#306EEC" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]/60 lg:hidden">{time}</div>
                  </div>
                  <div className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]/60 mb-2">{time}</div>
                  <h3 className="text-[16px] font-bold text-[#0B1628] mb-2.5 leading-snug">{phase}</h3>
                  <p className="text-[13px] sm:text-[14px] text-[#64748B] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div
              className="mt-12 sm:mt-14 rounded-[20px] border border-[#306EEC]/15 px-6 py-5 text-center bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
            >
              <p className="text-[14px] text-[#64748B] leading-relaxed max-w-[680px] mx-auto">
                <span className="text-[#0B1628] font-semibold">Timeline note:</span> Complex projects with layout changes, custom tile work, or structural modifications may run 4–6 weeks. We give you a precise schedule - not an estimate - before any work begins.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            WHY HOMEOWNERS CHOOSE US
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #091220 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full blur-[180px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.09), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[680px] mb-14">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#306EEC]/20 bg-[#306EEC]/[0.06] px-4 py-2 mb-6 backdrop-blur-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#7BAEFF]" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7BAEFF]/80">Why Profixter</span>
              </div>
              <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
                The difference is in
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #7BAEFF 0%, #306EEC 50%, #5B9BFF 100%)" }}
                >
                  how we think.
                </span>
              </h2>
              <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
                Anyone can swing a hammer. What separates a bathroom that lasts from one that disappoints is how the team thinks about your home.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  headline: "Waterproofing is not optional.",
                  body: "We use a membrane system behind every wet area - not just cement board. Most callbacks in bathroom remodeling trace to one skipped step. We don't skip it.",
                  accent: "#306EEC",
                },
                {
                  headline: "You call Taras. Not a call center.",
                  body: "The founder's direct line. Before, during, and after your project. Real accountability from a person who put his name on the license and shows up to every job.",
                  accent: "#D4A574",
                },
                {
                  headline: "NY Licensed. Fully Insured. Verifiable.",
                  body: "HI-71484 is verifiable through the NYS Department of State in 30 seconds. Proof of insurance provided before any work begins. Permits pulled on every project.",
                  accent: "#16A34A",
                },
                {
                  headline: "We show you before we change anything.",
                  body: "If we find mold, rot, or unexpected conditions behind your walls, we stop and document it with photos before proceeding. You decide. No surprises on the bill.",
                  accent: "#306EEC",
                },
                {
                  headline: "No sub-contractors. Our crew, always.",
                  body: "The team who shows up is our team - trained, vetted, and accountable. No strangers from a sub-list. The same hands that demo your bathroom tile your shower.",
                  accent: "#D4A574",
                },
                {
                  headline: "Your home stays livable.",
                  body: "We contain the work area, protect your floors and adjacent rooms, and clean up daily. Your family can live normally during the project - not around it.",
                  accent: "#16A34A",
                },
              ].map(({ headline, body, accent }) => (
                <div key={headline} className="rounded-[22px] border border-white/[0.09] bg-white/[0.03] p-7">
                  <div className="mb-5 h-1.5 w-10 rounded-full" style={{ background: accent }} />
                  <h3 className="text-[16px] font-bold text-white/88 mb-2.5 leading-snug">{headline}</h3>
                  <p className="text-[13px] leading-relaxed text-white/45">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            INVESTMENT CONFIDENCE
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative w-full py-16 sm:py-20 lg:py-24 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
        >
          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[28px] border border-[#C5CBD8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="grid lg:grid-cols-[1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#E6E8EF]">

                {/* Left: Value framing */}
                <div className="px-8 py-10 sm:px-10 sm:py-12 lg:px-12 flex flex-col gap-7">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EEF3FF] px-3 py-1.5 mb-5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">Investment Confidence</span>
                    </div>
                    <h3 className="text-[24px] sm:text-[30px] font-black leading-tight text-[#0B1628] mb-4">
                      A bathroom remodel is the
                      highest-return renovation
                      you can make.
                    </h3>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      Long Island homes with professionally remodeled bathrooms see significant increases in appraised value and resale speed. This is not just comfort - it&rsquo;s a financial decision that pays back.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { stat: "70%+", label: "Average ROI on bathroom remodels" },
                      { stat: "#1", label: "Most impactful interior renovation" },
                      { stat: "9+ yrs", label: "Our Long Island track record" },
                    ].map(({ stat, label }) => (
                      <div key={stat} className="rounded-[16px] border border-[#E6E8EF] bg-[#F8F9FC] p-4 text-center">
                        <div className="text-[20px] font-black text-[#306EEC] mb-1">{stat}</div>
                        <div className="text-[10px] font-semibold text-[#64748B] leading-tight">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Transparent pricing approach */}
                <div className="px-8 py-10 sm:px-10 sm:py-12 lg:px-12 bg-[#F0F4FF] flex flex-col gap-6">
                  <div>
                    <h3 className="text-[20px] sm:text-[24px] font-extrabold leading-tight text-[#0B1628] mb-3">
                      Transparent pricing.
                      No surprise invoices.
                    </h3>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      You receive a written, line-item estimate before any work begins. Not a rough range - a real number for the exact scope discussed. If anything changes, we tell you before touching it.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      "Written line-item estimate - not a ballpark",
                      "No change orders without your approval",
                      "Payment by milestone, not all upfront",
                      "Monthly payment options for qualified homeowners",
                      "We can help you prioritize scope to fit budget",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#306EEC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[13px] font-semibold text-[#1E293B]">{item}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={callNow}
                    className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 12px 36px rgba(48,110,236,0.28)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Request Free Consultation
                  </button>
                  <p className="text-[11px] text-center text-[#94A3B8]">Free · No obligation · We come to you</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FAQ
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative w-full py-16 sm:py-20 lg:py-28 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #091220 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.07), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-14 items-start">

              <div>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#306EEC]/20 bg-[#306EEC]/[0.06] px-4 py-2 mb-7 backdrop-blur-sm">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7BAEFF]/70">Real Answers</span>
                </div>
                <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
                  Common questions.
                  <br />
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #7BAEFF 0%, #306EEC 50%, #5B9BFF 100%)" }}
                  >
                    Straight answers.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/42 leading-relaxed mb-10">
                  No canned responses. These are the actual questions Long Island homeowners ask before signing.
                </p>
                <div className="space-y-3">
                  {FAQS.map((faq) => (
                    <FaqRow key={faq.q} {...faq} />
                  ))}
                </div>
              </div>

              {/* Sticky contact */}
              <div className="lg:sticky lg:top-[100px] flex flex-col gap-4">
                <div
                  className="rounded-[22px] border border-white/[0.10] p-7 flex flex-col gap-5"
                  style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)" }}
                >
                  <div>
                    <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/30 mb-2">Still have questions?</div>
                    <p className="text-[16px] font-semibold text-white/80 leading-snug">
                      Call Taras directly. A real answer from the founder who runs every project.
                    </p>
                  </div>
                  <a
                    href={`tel:${PHONE_TEL}`}
                    className="flex items-center gap-3.5 rounded-[14px] border border-white/[0.12] bg-white/[0.06] px-4 py-4 hover:border-white/[0.22] hover:bg-white/[0.10] transition-all group"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#306EEC] group-hover:bg-[#1E4ED8] transition-colors">
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

                <div
                  className="rounded-[22px] border border-[#306EEC]/20 p-7 flex flex-col gap-4"
                  style={{ background: "linear-gradient(145deg, rgba(48,110,236,0.08) 0%, rgba(48,110,236,0.03) 100%)" }}
                >
                  <div>
                    <p className="text-[15px] font-bold text-white/80 mb-1">Ready for your free consultation?</p>
                    <p className="text-[13px] text-white/40 leading-relaxed">We come to you. No obligation. Written estimate, real scope, real price.</p>
                  </div>
                  <button
                    type="button"
                    onClick={callNow}
                    className="w-full rounded-[14px] py-3.5 text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 12px 36px rgba(48,110,236,0.25)" }}
                  >
                    Request Consultation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FOUNDER TRUST
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative w-full py-16 sm:py-20 lg:py-24 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
        >
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
                      <div className="text-[13px] font-semibold text-[#306EEC]">Founder &amp; General Manager</div>
                    </div>
                  </div>

                  <blockquote className="border-l-2 border-[#306EEC] pl-5 text-[15px] sm:text-[16px] leading-relaxed text-[#1E293B]">
                    &ldquo;A bathroom remodel is an intimate project - you&rsquo;re trusting people in your home, around your family, for weeks. I personally review every project we accept. I know what our team can deliver, and I only agree to jobs we can do right. If anything isn&rsquo;t right, you call me directly.&rdquo;
                  </blockquote>

                  <div className="flex flex-wrap gap-5">
                    {["9+ Years Construction", "Licensed HI-71484", "Fully Insured", "Founder-Led"].map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#306EEC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#64748B]">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-8 py-10 sm:px-10 sm:py-12 lg:px-12 bg-[#F0F4FF] flex flex-col justify-between gap-6">
                  <div>
                    <div className="text-[22px] sm:text-[26px] font-extrabold leading-tight text-[#0B1628] mb-3">
                      Your bathroom deserves to be done once - and done right.
                    </div>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      A properly remodeled bathroom lasts 15–20 years before it needs attention. A poorly done one starts showing problems in 2–3. The difference is in the decisions made behind the walls - where you can&rsquo;t see them.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={callNow}
                      className="inline-flex h-[56px] items-center justify-center gap-2.5 rounded-[14px] text-[16px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                      style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 12px 36px rgba(48,110,236,0.28)" }}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Request Free Consultation
                    </button>
                    <a
                      href={`tel:${PHONE_TEL}`}
                      className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-[#C5CBD8] bg-white text-[15px] font-semibold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC]"
                    >
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
        <section
          className="relative w-full overflow-hidden py-24 sm:py-32 lg:py-40"
          style={{ background: "linear-gradient(160deg, #050D1A 0%, #071224 55%, #060E1C 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px]"
            style={{ background: "radial-gradient(circle, rgba(48,110,236,0.18), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[880px] text-center">

              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#306EEC]/25 bg-[#306EEC]/[0.08] px-4 py-2 backdrop-blur-sm mb-9">
                <span className="h-2 w-2 rounded-full bg-[#7BAEFF] flex-shrink-0" style={{ boxShadow: "0 0 10px rgba(123,174,255,0.9)" }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7BAEFF]/80">
                  Full Bathroom Remodeling · Long Island
                </span>
              </div>

              <h2 className="text-[52px] sm:text-[72px] lg:text-[96px] font-black leading-[0.87] tracking-[-0.048em] text-white mb-6">
                The bathroom
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #7BAEFF 0%, #306EEC 50%, #5B9BFF 100%)" }}
                >
                  you deserve.
                </span>
              </h2>

              <p className="text-[18px] sm:text-[22px] font-semibold text-white/50 leading-[1.4] max-w-[580px] mx-auto mb-10 sm:mb-12">
                A free consultation costs you nothing. Seeing exactly what your
                bathroom could become - that changes everything.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center mb-7">
                <button
                  type="button"
                  onClick={callNow}
                  className="inline-flex min-h-[68px] items-center justify-center gap-3 rounded-[18px] px-12 text-[18px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #306EEC 0%, #1E4ED8 100%)", boxShadow: "0 24px 70px rgba(48,110,236,0.45)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Request Free Consultation
                </button>
                <a
                  href={`tel:${PHONE_TEL}`}
                  className="inline-flex min-h-[68px] items-center justify-center gap-3 rounded-[18px] border border-white/18 bg-white/[0.07] px-12 text-[18px] font-bold text-white/85 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/[0.12]"
                >
                  Call {PHONE_DISPLAY}
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-8 border-t border-white/[0.07]">
                {[
                  "Free consultation · No obligation",
                  "Licensed HI-71484",
                  "Fully Insured",
                  "Workmanship warranty",
                  "Financing available",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="#7BAEFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
