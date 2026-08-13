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
  { src: "/images/projects/p2.jpg", label: "Full Kitchen Renovation", detail: "Custom cabinetry & quartz Â· Suffolk County" },
  { src: "/images/projects/p7.jpg", label: "Open-Concept Remodel", detail: "Layout reconfiguration Â· Nassau County" },
  { src: "/images/projects/p8.jpg", label: "Island & Countertop Build", detail: "Waterfall quartz island Â· Long Island" },
  { src: "/images/projects/p9.jpg", label: "Chef's Kitchen", detail: "High-end finishes Â· Suffolk County" },
  { src: "/images/projects/p10.jpg", label: "Cabinet Replacement", detail: "Semi-custom hardwood Â· Nassau County" },
  { src: "/images/projects/p4.jpg", label: "Kitchen & Dining", detail: "Combined open space Â· Long Island" },
];

const FAQS = [
  {
    q: "How long does a full kitchen remodel take?",
    a: "Most full kitchen remodels on Long Island take 3â€“6 weeks from demo day to final punch list. A straightforward cabinet-and-countertop replacement with new flooring and backsplash runs about 3â€“4 weeks. Projects involving layout changes, new plumbing runs, or structural work take 5â€“7 weeks. We give you a precise project schedule â€” not a vague range â€” before any work begins.",
  },
  {
    q: "How much does a kitchen remodel cost on Long Island?",
    a: "A professional full kitchen remodel in Nassau and Suffolk County typically ranges from $30,000â€“$90,000+ depending on size, materials, layout changes, and appliance selection. We don't quote numbers before seeing your kitchen. After a free in-home consultation we provide a detailed written estimate with line items â€” not a rough ballpark. No surprise invoices.",
  },
  {
    q: "Do you handle permits?",
    a: "Yes. We are licensed NY State Home Improvement Contractor HI-71484 and we manage the permit process. Any work involving plumbing relocation, electrical panel changes, or structural modifications requires permits in Long Island municipalities. We pull them, coordinate inspections, and make sure every phase passes. This protects your home's value and your legal standing.",
  },
  {
    q: "Can you help with the design and material selection?",
    a: "Yes â€” and most homeowners find our process more than sufficient. We guide you through cabinet style, finish, and hardware selection; countertop material and edge profile; backsplash tile and pattern; flooring options; and lighting placement. We bring samples to your home so you can see materials in your actual space before committing.",
  },
  {
    q: "Can I live at home during the remodel?",
    a: "Yes, most homeowners do. We contain the work area, protect adjacent rooms and floors, and clean up at the end of each day. You'll need to adapt your cooking routine for the duration â€” most families use a microwave, slow cooker, or eat out more during the project. We can discuss staging to minimize disruption for your specific layout.",
  },
  {
    q: "What if we want to change the layout â€” move the sink, open a wall?",
    a: "We handle layout changes including sink relocations, island additions, and non-load-bearing wall removals. Structural changes (load-bearing walls) require an engineer's approval, which we can coordinate. We'll walk through your layout goals at the consultation and tell you exactly what's feasible, what requires permits, and what it will cost.",
  },
  {
    q: "Do you coordinate appliances during a remodel?",
    a: "Yes. We coordinate delivery timing, measurements, rough-in requirements, and handoffs with your appliance vendor or licensed installer. Profixter does not repair appliances or provide standalone appliance service.",
  },
  {
    q: "What countertop materials do you work with?",
    a: "We work with quartz, granite, marble, quartzite, soapstone, butcher block, and porcelain slab. We'll walk you through the maintenance requirements, durability, and price ranges for each. For Long Island families, quartz and quartzite are most popular for their durability; marble and book-matched stone for premium kitchens. We help you make the right call for how your family actually uses the kitchen.",
  },
  {
    q: "Are you licensed and insured?",
    a: "Yes. NY State Licensed Home Improvement Contractor HI-71484, verifiable through the NYS Department of State. Fully insured for property damage and general liability. Proof of insurance provided before any work begins â€” always. Never hire a kitchen contractor who can't hand you a COI on the spot.",
  },
  {
    q: "What warranty do you offer?",
    a: "We warranty our workmanship on all labor. Cabinet manufacturers provide their own warranties (typically 1â€“5 years on hardware, longer on cabinet boxes depending on grade). Countertop fabricators and appliance manufacturers carry separate warranties. We review all applicable warranties with you at the project closeout so you know exactly what is covered and for how long.",
  },
  {
    q: "Can I finance my kitchen remodel?",
    a: "Yes â€” monthly payment options are available for qualified homeowners. Kitchen remodels are among the most commonly financed home improvement projects, and for good reason â€” the result adds daily value to your life and significant value to your home. Rather than waiting years to save the full amount, many Long Island homeowners choose to start now and enjoy their new kitchen while paying over time. We discuss financing at your free consultation. No commitment required.",
  },
];

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-[8px] border transition-all duration-200 overflow-hidden ${
        open
          ? "border-[#D97706]/30 bg-[#D97706]/[0.04]"
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
            open ? "text-[#FCD34D]" : "text-white/82"
          }`}
        >
          {q}
        </span>
        <svg
          className={`flex-shrink-0 mt-0.5 w-5 h-5 transition-transform duration-300 ${
            open ? "rotate-180 text-[#FCD34D]" : "text-white/30"
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

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function KitchenPage() {
  const [galleryIdx, setGalleryIdx] = useState(0);
  const activePhoto = GALLERY[galleryIdx];

  const callNow = () => {
    trackEvent("kitchen_call_cta", { placement: "kitchen_page" });
    window.location.href = `tel:${PHONE_TEL}`;
  };

  return (
    <div className="min-h-screen bg-[#080F1E] overflow-x-hidden">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            HERO
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full overflow-hidden min-h-[94vh] flex items-center"
          style={{ background: "linear-gradient(160deg, #0C0A04 0%, #141006 45%, #0F0D08 100%)" }}
        >
          {/* Depth glows â€” warm golden */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/4 h-[800px] w-[800px] rounded-full blur-[220px] opacity-50"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.16), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full blur-[160px] opacity-25"
            style={{ background: "radial-gradient(circle, rgba(180,83,9,0.12), transparent 70%)" }} />
          {/* Dot texture */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.020]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          {/* Warm gold top-edge accent */}
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(217,119,6,0.55), transparent)" }} />

          <div className="relative w-full mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-9 sm:py-11 lg:py-32">
            <div className="grid lg:grid-cols-[1fr_500px] gap-8 lg:gap-10 items-center">

              {/* Left: Copy */}
              <div>
                <Link href="/projects" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/30 hover:text-white/55 transition-colors mb-6">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Home Improvement
                </Link>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D97706]/30 bg-[#D97706]/[0.08] px-4 py-2 backdrop-blur-sm mb-8">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#FCD34D]" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="7" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 10v11h20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FCD34D]/90">
                    Full Kitchen Remodeling Â· Long Island
                  </span>
                </div>

                <h1 className="text-[43px] sm:text-[50px] lg:text-[50px] font-black leading-[0.86] tracking-[-0.048em] text-white mb-7">
                  The kitchen
                  <br />
                  your home
                  <br />
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #FCD34D 0%, #D97706 50%, #F59E0B 100%)" }}
                  >
                    deserves.
                  </span>
                </h1>

                <p className="text-[19px] sm:text-[21px] font-bold leading-[1.3] text-white/85 mb-4 max-w-[520px]">
                  Beautiful. Functional. Built for real living.
                  From design to final finish.
                </p>
                <p className="text-[16px] sm:text-[17px] leading-[1.75] text-white/45 max-w-[480px] mb-7">
                  The kitchen is the heart of your home. It&rsquo;s where families
                  gather, where guests remember, where daily life actually
                  happens. We build kitchens that earn that responsibility.
                </p>

                <div className="flex flex-col sm:flex-row gap-3.5 mb-4">
                  <button
                    type="button"
                    onClick={callNow}
                    className="inline-flex min-h-[44px] items-center justify-center gap-3 rounded-[8px] px-10 text-[17px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                    style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 20px 60px rgba(217,119,6,0.40)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Request Free Consultation
                  </button>
                  <a
                    href={`tel:${PHONE_TEL}`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-[8px] border border-white/18 bg-white/[0.06] px-10 text-[17px] font-bold text-white/85 backdrop-blur-sm transition-all hover:bg-white/[0.12] hover:border-white/30"
                  >
                    Call {PHONE_DISPLAY}
                  </a>
                </div>
                <div className="mb-8">
                  <Link
                    href="/estimate"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#FCD34D]/50 hover:text-[#FCD34D]/85 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 9h8M8 13h6M8 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Start your estimate online â†’
                  </Link>
                </div>

                <div className="flex flex-wrap gap-x-7 gap-y-3">
                  {["Licensed HI-71484", "Fully Insured", "Permitted & Inspected", "Workmanship warranty", "Financing available"].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="#FCD34D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] font-semibold text-white/55">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Authority card */}
              <div className="hidden lg:block">
                <div
                  className="relative rounded-[8px] overflow-hidden"
                  style={{
                    background: "linear-gradient(145deg, #1A1100 0%, #221800 50%, #150E00 100%)",
                    boxShadow: "0 48px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(217,119,6,0.15)",
                  }}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0"
                    style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.10) 0%, transparent 55%)" }} />
                  <div aria-hidden="true" className="absolute top-0 left-8 right-8 h-[2px]"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(217,119,6,0.70), transparent)" }} />

                  {/* Decorative kitchen icon */}
                  <div className="absolute top-6 right-6 opacity-[0.07]" aria-hidden="true">
                    <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
                      <rect x="8" y="20" width="80" height="56" rx="6" stroke="#FCD34D" strokeWidth="2" />
                      <path d="M8 36h80" stroke="#FCD34D" strokeWidth="1.5" />
                      <path d="M28 20V16M48 20V16M68 20V16" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="30" cy="54" r="8" stroke="#FCD34D" strokeWidth="1.5" />
                      <circle cx="66" cy="54" r="8" stroke="#FCD34D" strokeWidth="1.5" />
                      <path d="M44 46h8v16h-8z" stroke="#FCD34D" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <div className="relative p-8">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-6">
                      What&rsquo;s Included â€” Every Project
                    </div>

                    <div className="space-y-4 mb-8">
                      {[
                        { title: "Full Demolition", sub: "Everything out â€” cabinets, counters, flooring, fixtures" },
                        { title: "Cabinetry Install", sub: "Semi-custom or custom â€” plumb, level, secured" },
                        { title: "Countertop Fabrication", sub: "Quartz, granite, marble â€” measured, cut, installed" },
                        { title: "Backsplash & Tile", sub: "Design-matched tile, set and grouted clean" },
                        { title: "Plumbing & Electrical", sub: "New runs, relocated drains, panel work permitted" },
                        { title: "Lighting", sub: "Under-cabinet, recessed, island pendants installed" },
                        { title: "Final Punch List", sub: "Walk-through with you before we call it done" },
                      ].map(({ title, sub }) => (
                        <div key={title} className="flex items-start gap-3.5">
                          <div className="mt-0.5 w-5 h-5 rounded-full border border-[#D97706]/40 flex items-center justify-center flex-shrink-0">
                            <svg width="9" height="7" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                              <path d="M1 4l2.5 2.5L9 1" stroke="#FCD34D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
                        className="w-full min-h-[46px] rounded-[8px] text-[15px] font-extrabold text-white flex items-center justify-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                        style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 12px 40px rgba(217,119,6,0.35)" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Get Free Consultation
                      </button>
                      <p className="mt-3 text-[11px] text-center text-white/25">No obligation Â· We come to you</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            CREDENTIAL STRIP
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  label: "Monthly payment options available",
                  strong: "Financing",
                },
              ].map(({ icon, label, strong }) => (
                <div key={strong} className="flex items-center gap-3">
                  <div className="text-[#D97706]/70">{icon}</div>
                  <div>
                    <div className="text-[13px] font-extrabold text-white/75">{strong}</div>
                    <div className="text-[11px] text-white/32 leading-tight">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            WHAT'S INCLUDED
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #FFFBF0 0%, #FEF8E7 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.08), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[680px] mb-9 sm:mb-16">
              <div className="inline-flex items-center gap-2.5 rounded-[6px] border border-[#FDE68A] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(217,119,6,0.10)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#D97706]" aria-hidden="true">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D97706]">Complete Scope</span>
              </div>
              <h2 className="text-[30px] sm:text-[40px] lg:text-[43px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
                Everything handled.
                <br />
                <span style={{ color: "#D97706" }}>Start to finish.</span>
              </h2>
              <p className="text-[15px] sm:text-[17px] leading-relaxed text-[#475569] max-w-[520px]">
                From the moment we pull your first cabinet to the day you cook
                your first meal in your new kitchen â€” every trade, every
                decision, fully coordinated by our team.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: "Full Demolition",
                  body: "Cabinets, countertops, tile, flooring, and fixtures removed cleanly. Debris hauled same day. Walls and ceilings assessed for any surprises before moving forward.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Cabinetry",
                  body: "Semi-custom or custom cabinets installed plumb, level, and anchored to studs. Soft-close hardware, interior organizers, and crown molding finished to spec.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <rect x="2" y="12" width="20" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M10 7.5h4M10 16.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  title: "Countertops",
                  body: "Precise measurements taken post-cabinet install. Quartz, granite, marble, quartzite, or soapstone â€” fabricated, delivered, and set with seamless joints.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="2" y="10" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M4 14v6M20 14v6M7 14v6M17 14v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  title: "Backsplash & Tile",
                  body: "Subway, mosaic, large-format slab, or handmade tile â€” set level, grouted clean, and sealed. We help you choose the pattern that ties the whole space together.",
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
                  title: "Plumbing",
                  body: "Sink and faucet installation, drain relocation, dishwasher water lines, garbage disposal, and pot-filler rough-in if needed. All permitted work inspected.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 22V12M12 12C12 12 7 9 7 5a5 5 0 0110 0c0 4-5 7-5 7z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Electrical & Lighting",
                  body: "Under-cabinet LED, recessed ceiling lights, island pendants, and dedicated circuits for appliances. All electrical permitted and inspected. No shortcuts.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  title: "Flooring",
                  body: "Tile, hardwood, luxury vinyl, or engineered wood â€” installed with proper subfloor prep and clean transitions to adjacent rooms.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  title: "Appliance Coordination",
                  body: "We coordinate delivery timing, cabinet-panel fit, rough-in requirements, and vendor or licensed-installer handoffs. Appliance repair and standalone appliance service are not offered.",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M2 10v11h20V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="16" r="2" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  ),
                },
                {
                  title: "Painting & Final Finish",
                  body: "Walls primed and painted, trim caulked, toe-kick installed, hardware mounted. We don't hand off a kitchen that's 95% done. Full punch list before we leave.",
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
                  className="group rounded-[8px] border border-[#E8DCC8] bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:shadow-[0_16px_56px_rgba(15,23,42,0.11)] hover:-translate-y-0.5"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#FEF3C7] text-[#D97706] transition-all group-hover:bg-[#D97706] group-hover:text-white">
                    {icon}
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">{title}</h3>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex justify-center lg:hidden">
              <button
                type="button"
                onClick={callNow}
                className="inline-flex h-[48px] items-center gap-3 rounded-[8px] px-9 text-[16px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 16px 48px rgba(217,119,6,0.35)" }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Request Free Consultation
              </button>
            </div>

            {/* â”€â”€ Warranty + Financing callout â”€â”€ */}
            <div className="mt-7 sm:mt-8 grid sm:grid-cols-2 gap-5">
              <div className="rounded-[8px] border border-[#FDE68A] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] flex items-start gap-5">
                <div className="flex-shrink-0 h-12 w-12 rounded-[8px] bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D97706] mb-1">Warranty</div>
                  <h4 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">Workmanship warranty included.</h4>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">
                    Workmanship warranty on all labor. Cabinet and appliance manufacturer warranties vary by brand and product grade. All warranty details reviewed at project closeout so you know exactly what&rsquo;s covered.
                  </p>
                </div>
              </div>
              <div className="rounded-[8px] border border-[#FDE68A] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.05)] flex items-start gap-5">
                <div className="flex-shrink-0 h-12 w-12 rounded-[8px] bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D97706] mb-1">Financing</div>
                  <h4 className="text-[16px] font-bold text-[#0B1628] mb-2 leading-snug">Start cooking in your new kitchen sooner.</h4>
                  <p className="text-[13px] leading-relaxed text-[#64748B]">
                    Monthly payment options are available for qualified homeowners. Don&rsquo;t put your kitchen on hold for years while saving â€” most Long Island homeowners who remodel choose to finance. Start enjoying it now and pay over time. Ask about financing at your free consultation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            PROJECT GALLERY
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0B1525 0%, #0D1A30 60%, #0A1220 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.10), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-8 lg:mb-14">
              <div className="max-w-[560px]">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 mb-7 backdrop-blur-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#FCD34D]" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                    Real Long Island Projects
                  </span>
                </div>
                <h2 className="text-[32px] sm:text-[40px] lg:text-[43px] font-black leading-[0.88] tracking-[-0.045em] text-white mb-5">
                  Work we&rsquo;re
                  <br />
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #FCD34D 0%, #D97706 50%, #F59E0B 100%)" }}
                  >
                    proud to show.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
                  Real results from Long Island kitchens â€” the craftsmanship
                  behind every remodel we complete.
                </p>
              </div>

              <div className="flex gap-4 flex-shrink-0">
                {[
                  { v: "3â€“6 wks", l: "Typical remodel" },
                  { v: "9+ yrs", l: "On Long Island" },
                  { v: "5.0 â˜…", l: "Google Rating" },
                ].map(({ v, l }) => (
                  <div key={l} className="rounded-[8px] border border-white/[0.09] bg-white/[0.04] px-4 py-4 text-center min-w-[88px]">
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
                <div className="relative w-full overflow-hidden rounded-[8px] group" style={{ aspectRatio: "16/10" }}>
                  <Image
                    src={activePhoto.src}
                    alt={activePhoto.label}
                    fill
                    className="object-cover transition-all duration-500"
                    sizes="(max-width: 1024px) 92vw, 760px"
                    priority
                  />
                  <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.40)] rounded-[8px]" />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[55%]"
                    style={{ background: "linear-gradient(to top, rgba(8,15,30,0.85) 0%, rgba(8,15,30,0.40) 55%, transparent 100%)" }}
                  />

                  {/* Category chip */}
                  <div className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 px-3.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FCD34D] flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(252,211,77,0.8)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/85">Kitchen</span>
                  </div>

                  {/* Counter */}
                  <div className="absolute top-5 right-5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/50">
                    {galleryIdx + 1} / {GALLERY.length}
                  </div>

                  {/* Bottom label + nav */}
                  <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 flex items-end justify-between">
                    <div>
                      <div className="text-[23px] sm:text-[30px] font-black text-white leading-none tracking-[-0.025em] mb-1">
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
                      className={`relative flex-shrink-0 w-[72px] h-[46px] rounded-[6px] overflow-hidden border-2 transition-all focus:outline-none ${
                        i === galleryIdx
                          ? "border-[#D97706] shadow-[0_0_14px_rgba(217,119,6,0.40)]"
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
                  className="rounded-[8px] border border-white/[0.09] p-6 flex flex-col gap-5"
                  style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)" }}
                >
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Every project</div>
                    <p className="text-[15px] font-semibold text-white/80 leading-snug">
                      The same crew. The same standards. Every single time.
                    </p>
                  </div>
                  {[
                    "Same crew Â· every project",
                    "Licensed NY HI-71484",
                    "Fully insured",
                    "No sub-contractors",
                    "Workmanship warranty",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12.5l4 4 10-10" stroke="#FCD34D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13px] text-white/55">{item}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="rounded-[8px] border border-[#D97706]/20 p-6 flex flex-col gap-4"
                  style={{ background: "linear-gradient(145deg, rgba(217,119,6,0.10) 0%, rgba(217,119,6,0.04) 100%)" }}
                >
                  <div>
                    <p className="text-[15px] font-bold text-white/85 mb-1">Your kitchen could look like this.</p>
                    <p className="text-[13px] text-white/40 leading-relaxed">Free consultation. We come to you. Written estimate, real scope, real price.</p>
                  </div>
                  <button
                    type="button"
                    onClick={callNow}
                    className="w-full min-h-[46px] rounded-[8px] text-[14px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 10px 30px rgba(217,119,6,0.30)" }}
                  >
                    Request Free Consultation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            PROJECT TIMELINE
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #FFFBF0 0%, #FEF8E7 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full blur-[140px] opacity-30"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.08), transparent 70%)" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[720px] text-center mb-9 sm:mb-16">
              <div className="inline-flex items-center gap-2.5 rounded-[6px] border border-[#FDE68A] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(217,119,6,0.08)]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#D97706]" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D97706]">How It Works</span>
              </div>
              <h2 className="text-[30px] sm:text-[40px] lg:text-[43px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
                From first call
                <br />
                <span style={{ color: "#D97706" }}>to finished kitchen.</span>
              </h2>
              <p className="text-[15px] sm:text-[17px] text-[#475569] leading-relaxed">
                A typical Long Island kitchen remodel follows this sequence.
                You&rsquo;ll know exactly where we are at every phase.
              </p>
            </div>

            <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              <div aria-hidden="true" className="hidden lg:block absolute top-[52px] left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px"
                style={{ background: "linear-gradient(90deg, rgba(217,119,6,0.5) 0%, rgba(217,119,6,0.2) 100%)" }} />

              {[
                {
                  time: "Week 1",
                  phase: "Consult & Design",
                  body: "Free in-home consultation. We measure, plan layout, select materials, and give you a written line-item estimate. You approve the scope before any work begins.",
                },
                {
                  time: "Week 2â€“3",
                  phase: "Demo & Rough Work",
                  body: "Demolition, plumbing rough-in, electrical work, drywall repair. Everything permitted and inspected before any finish work begins.",
                },
                {
                  time: "Week 3â€“5",
                  phase: "Cabinets & Countertops",
                  body: "Cabinets installed, plumb and level. Countertops templated after cabinet install, fabricated, and set. This is the transformation â€” walls to a full kitchen.",
                },
                {
                  time: "Week 5â€“6",
                  phase: "Finish & Punch List",
                  body: "Backsplash, flooring, lighting coordination, vendor appliance handoffs, painting, and trim. Full walk-through with you before we sign off. Your kitchen, done right.",
                },
              ].map(({ time, phase, body }, i) => (
                <div key={phase} className="relative flex flex-col">
                  <div className="mb-5 flex items-center gap-4 lg:flex-col lg:items-start">
                    <div
                      className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-[0_4px_20px_rgba(217,119,6,0.12)]"
                      style={{ borderColor: "rgba(217,119,6,0.45)" }}
                    >
                      <span className="text-[15px] font-black" style={{ color: "#D97706" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D97706]/60 lg:hidden">{time}</div>
                  </div>
                  <div className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.18em] text-[#D97706]/60 mb-2">{time}</div>
                  <h3 className="text-[16px] font-bold text-[#0B1628] mb-2.5 leading-snug">{phase}</h3>
                  <p className="text-[13px] sm:text-[14px] text-[#64748B] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 sm:mt-9 rounded-[8px] border border-[#FDE68A] px-6 py-5 text-center bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
              <p className="text-[14px] text-[#64748B] leading-relaxed max-w-[680px] mx-auto">
                <span className="text-[#0B1628] font-semibold">Timeline note:</span> Projects involving layout changes, structural work, or custom cabinet lead times may run 6â€“8 weeks. We give you a precise project schedule â€” not a vague estimate â€” before any work begins.
              </p>
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            WHY HOMEOWNERS CHOOSE US
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #091220 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full blur-[180px] opacity-35"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.08), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-[680px] mb-9">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D97706]/20 bg-[#D97706]/[0.06] px-4 py-2 mb-6 backdrop-blur-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#FCD34D]" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FCD34D]/80">Why Profixter</span>
              </div>
              <h2 className="text-[30px] sm:text-[40px] lg:text-[43px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
                The kitchen is too
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #FCD34D 0%, #D97706 50%, #F59E0B 100%)" }}
                >
                  important to rush.
                </span>
              </h2>
              <p className="text-[15px] sm:text-[17px] text-white/45 leading-relaxed">
                A kitchen you love lasts 20 years. A kitchen done wrong starts costing you in three. Here&rsquo;s how we think about the difference.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  headline: "We measure twice â€” on every single cut.",
                  body: "Countertop templating happens after cabinet install, not before. Cabinets are plumbed and leveled before anything else goes in. This sequence matters. We never rush it.",
                  accent: "#D97706",
                },
                {
                  headline: "You call Taras. Not a call center.",
                  body: "The founder's direct line. Before, during, and after your project. Real accountability from a person who put his name on the license and reviews every kitchen we accept.",
                  accent: "#306EEC",
                },
                {
                  headline: "NY Licensed. Fully Insured. Verifiable.",
                  body: "HI-71484 is verifiable through the NYS Department of State in 30 seconds. Plumbing and electrical work permitted and inspected. Proof of insurance before any work begins.",
                  accent: "#16A34A",
                },
                {
                  headline: "We show you before we change anything.",
                  body: "If we open a wall and find old wiring, mold, or unexpected plumbing, we stop and document it with photos before doing anything. You decide. Your budget, your call.",
                  accent: "#D97706",
                },
                {
                  headline: "No sub-contractors. Our crew, always.",
                  body: "The team who demos your kitchen is the team that installs your cabinets. No strangers from a sub-list. Everyone on your project is vetted, trained, and accountable to us.",
                  accent: "#306EEC",
                },
                {
                  headline: "Your daily life considered.",
                  body: "We stage the project to minimize disruption. You can live at home throughout. We clean up daily, contain the work area, and keep adjacent rooms usable.",
                  accent: "#16A34A",
                },
              ].map(({ headline, body, accent }) => (
                <div key={headline} className="rounded-[8px] border border-white/[0.09] bg-white/[0.03] p-7">
                  <div className="mb-5 h-1.5 w-10 rounded-full" style={{ background: accent }} />
                  <h3 className="text-[16px] font-bold text-white/88 mb-2.5 leading-snug">{headline}</h3>
                  <p className="text-[13px] leading-relaxed text-white/45">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            INVESTMENT CONFIDENCE
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #FFFBF0 0%, #FEF8E7 100%)" }}
        >
          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[8px] border border-[#E8DCC8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="grid lg:grid-cols-[1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#F0E8D8]">

                {/* Left: Value framing */}
                <div className="px-6 py-10 sm:px-10 sm:py-9 lg:px-12 flex flex-col gap-7">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-[6px] border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1.5 mb-5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#D97706]" aria-hidden="true">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D97706]">Investment Confidence</span>
                    </div>
                    <h3 className="text-[23px] sm:text-[26px] font-black leading-tight text-[#0B1628] mb-4">
                      The highest-return
                      renovation in your home.
                    </h3>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      A professionally remodeled kitchen dramatically increases your home&rsquo;s appraised value and is the single most important feature for Long Island home buyers. This is both a quality-of-life upgrade and a sound financial decision.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { stat: "80%+", label: "Average ROI on kitchen remodels" },
                      { stat: "#1", label: "Feature buyers prioritize" },
                      { stat: "9+ yrs", label: "Our Long Island track record" },
                    ].map(({ stat, label }) => (
                      <div key={stat} className="rounded-[8px] border border-[#F0E8D8] bg-[#FFFBF0] p-4 text-center">
                        <div className="text-[19px] font-black text-[#D97706] mb-1">{stat}</div>
                        <div className="text-[10px] font-semibold text-[#64748B] leading-tight">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Transparent pricing */}
                <div className="px-6 py-10 sm:px-10 sm:py-9 lg:px-12 bg-[#FFFDF5] flex flex-col gap-6">
                  <div>
                    <h3 className="text-[19px] sm:text-[23px] font-extrabold leading-tight text-[#0B1628] mb-3">
                      Transparent pricing.
                      No surprise invoices.
                    </h3>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      You receive a written, line-item estimate before any work begins. Not a rough range â€” a real number for the exact scope discussed. If anything changes mid-project, we tell you before touching it.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      "Written line-item estimate â€” not a ballpark",
                      "No change orders without your approval",
                      "Payment by milestone, not all upfront",
                      "Monthly payment options for qualified homeowners",
                      "We can help prioritize scope to fit budget",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[13px] font-semibold text-[#1E293B]">{item}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={callNow}
                    className="inline-flex h-[46px] items-center justify-center gap-2.5 rounded-[8px] text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 12px 36px rgba(217,119,6,0.30)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Request Free Consultation
                  </button>
                  <p className="text-[11px] text-center text-[#94A3B8]">Free Â· No obligation Â· We come to you</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            FAQ
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #080F1E 0%, #0A1421 60%, #091220 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px] opacity-40"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.07), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[1fr_380px] gap-7 lg:gap-9 items-start">

              <div>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D97706]/20 bg-[#D97706]/[0.06] px-4 py-2 mb-7 backdrop-blur-sm">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FCD34D]/70">Real Answers</span>
                </div>
                <h2 className="text-[30px] sm:text-[40px] lg:text-[43px] font-black leading-[0.92] tracking-[-0.04em] text-white mb-5">
                  Common questions.
                  <br />
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, #FCD34D 0%, #D97706 50%, #F59E0B 100%)" }}
                  >
                    Straight answers.
                  </span>
                </h2>
                <p className="text-[15px] sm:text-[17px] text-white/42 leading-relaxed mb-7">
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
                  className="rounded-[8px] border border-white/[0.10] p-7 flex flex-col gap-5"
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
                    className="flex items-center gap-3.5 rounded-[8px] border border-white/[0.12] bg-white/[0.06] px-4 py-4 hover:border-white/[0.22] hover:bg-white/[0.10] transition-all group"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#D97706] group-hover:bg-[#B45309] transition-colors">
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
                  className="rounded-[8px] border border-[#D97706]/20 p-7 flex flex-col gap-4"
                  style={{ background: "linear-gradient(145deg, rgba(217,119,6,0.08) 0%, rgba(217,119,6,0.03) 100%)" }}
                >
                  <div>
                    <p className="text-[15px] font-bold text-white/80 mb-1">Ready for your free consultation?</p>
                    <p className="text-[13px] text-white/40 leading-relaxed">We come to you. No obligation. Written estimate, real scope, real price.</p>
                  </div>
                  <button
                    type="button"
                    onClick={callNow}
                    className="w-full rounded-[8px] py-3.5 text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                    style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 12px 36px rgba(217,119,6,0.25)" }}
                  >
                    Request Consultation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            FOUNDER TRUST
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full py-10 sm:py-13 lg:py-12 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #FFFBF0 0%, #FEF8E7 100%)" }}
        >
          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[8px] border border-[#E8DCC8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="grid lg:grid-cols-[1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-[#F0E8D8]">

                <div className="px-6 py-10 sm:px-10 sm:py-9 lg:px-12 flex flex-col justify-between gap-7">
                  <div className="flex items-center gap-4">
                    <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_24px_rgba(15,23,42,0.14)]">
                      <Image src="/images/Taras.png" alt="Taras Bandura" fill className="object-cover object-top" sizes="72px" />
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-[#0B1628]">Taras Bandura</div>
                      <div className="text-[13px] font-semibold text-[#D97706]">Founder &amp; General Manager</div>
                    </div>
                  </div>

                  <blockquote className="border-l-2 border-[#D97706] pl-5 text-[15px] sm:text-[16px] leading-relaxed text-[#1E293B]">
                    &ldquo;A kitchen remodel is a serious trust. You&rsquo;re disrupting the center of your home and expecting it to come back better than it was. I personally review every project we accept â€” because I only want my team working on jobs we can deliver on. If anything isn&rsquo;t right, you call me directly.&rdquo;
                  </blockquote>

                  <div className="flex flex-wrap gap-5">
                    {["9+ Years Construction", "Licensed HI-71484", "Fully Insured", "Founder-Led"].map((t) => (
                      <div key={t} className="flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#64748B]">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-6 py-10 sm:px-10 sm:py-9 lg:px-12 bg-[#FFFDF5] flex flex-col justify-between gap-6">
                  <div>
                    <div className="text-[21px] sm:text-[23px] font-extrabold leading-tight text-[#0B1628] mb-3">
                      Your kitchen deserves to be done once â€” and done right.
                    </div>
                    <p className="text-[14px] sm:text-[15px] text-[#475569] leading-relaxed">
                      A properly built kitchen lasts 20+ years before it needs real attention. The decisions made behind the cabinets, under the counters, and inside the walls â€” that&rsquo;s what determines whether your kitchen ages well or fails fast.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={callNow}
                      className="inline-flex h-[48px] items-center justify-center gap-2.5 rounded-[8px] text-[16px] font-extrabold text-white transition-all hover:-translate-y-0.5"
                      style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 12px 36px rgba(217,119,6,0.30)" }}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Request Free Consultation
                    </button>
                    <a
                      href={`tel:${PHONE_TEL}`}
                      className="inline-flex h-[46px] items-center justify-center gap-2.5 rounded-[8px] border border-[#E8DCC8] bg-white text-[15px] font-semibold text-[#0B1628] transition hover:border-[#D97706] hover:text-[#D97706]"
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

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            FINAL CTA
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section
          className="relative w-full overflow-hidden py-9 sm:py-32 lg:py-40"
          style={{ background: "linear-gradient(160deg, #0C0A04 0%, #141006 55%, #0F0D08 100%)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full blur-[200px]"
            style={{ background: "radial-gradient(circle, rgba(217,119,6,0.20), transparent 70%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[880px] text-center">

              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D97706]/25 bg-[#D97706]/[0.08] px-4 py-2 backdrop-blur-sm mb-9">
                <span className="h-2 w-2 rounded-full bg-[#FCD34D] flex-shrink-0" style={{ boxShadow: "0 0 10px rgba(252,211,77,0.9)" }} />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FCD34D]/80">
                  Full Kitchen Remodeling Â· Long Island
                </span>
              </div>

              <h2 className="text-[40px] sm:text-[46px] lg:text-[50px] font-black leading-[0.87] tracking-[-0.048em] text-white mb-6">
                The kitchen
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #FCD34D 0%, #D97706 50%, #F59E0B 100%)" }}
                >
                  you&rsquo;ve earned.
                </span>
              </h2>

              <p className="text-[18px] sm:text-[21px] font-semibold text-white/50 leading-[1.4] max-w-[580px] mx-auto mb-7 sm:mb-12">
                A free consultation costs you nothing. Seeing exactly what
                your kitchen could become â€” that changes the whole conversation.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center mb-7">
                <button
                  type="button"
                  onClick={callNow}
                  className="inline-flex min-h-[68px] items-center justify-center gap-3 rounded-[8px] px-12 text-[18px] font-extrabold text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg, #D97706 0%, #B45309 100%)", boxShadow: "0 24px 70px rgba(217,119,6,0.50)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Request Free Consultation
                </button>
                <a
                  href={`tel:${PHONE_TEL}`}
                  className="inline-flex min-h-[68px] items-center justify-center gap-3 rounded-[8px] border border-white/18 bg-white/[0.07] px-12 text-[18px] font-bold text-white/85 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/[0.12]"
                >
                  Call {PHONE_DISPLAY}
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-8 border-t border-white/[0.07]">
                {[
                  "Free consultation Â· No obligation",
                  "Licensed HI-71484",
                  "Fully Insured",
                  "Workmanship warranty",
                  "Financing available",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="#FCD34D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
