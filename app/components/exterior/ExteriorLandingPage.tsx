"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import ExteriorLeadForm from "@/app/components/exterior/ExteriorLeadForm";

type ProjectType = "roofing" | "siding";

type Props = {
  project: ProjectType;
};

const ROOFING_CONFIG = {
  eyebrow: "Premium Roofing · Long Island",
  headline: "One Roof For Life",
  subhead:
    "Stop paying for temporary repairs. Protect your home with a roof built to last - backed by warranty, installed by a local licensed team.",
  cta: "Get Free Roofing Estimate",
  image: "/images/projects/p1.jpg",
  alt: "Completed roofing project on Long Island home",
  trustBadges: ["Licensed HI-71484", "Fully Insured", "Long Island Local", "50-Year Warranty", "Financing Available"],
  benefits: [
    { title: "Built for Long Island Weather", body: "Roofing systems selected for harsh winters, summer storms, and coastal conditions unique to Long Island." },
    { title: "50-Year Warranty Available", body: "Premium manufacturer warranty coverage reviewed and explained clearly before any work begins - no surprises." },
    { title: "Licensed & Fully Insured", body: "Licensed HI-71484. Every job is fully insured, protecting you and your home throughout the project." },
    { title: "Clear Process, No Surprises", body: "Estimate, materials, timeline, and cost are all reviewed together before work begins. You decide, then we build." },
    { title: "Financing Available", body: "Qualified homeowners can finance their roof replacement. No need to delay protecting your home." },
    { title: "Local Long Island Team", body: "We work exclusively on Long Island. This is our neighborhood - we're accountable to this community." },
  ],
  signs: [
    { title: "Recurring Leaks", body: "If the same area keeps leaking after patch repairs, the issue is systemic - not fixable with another patch." },
    { title: "Curling or Missing Shingles", body: "Shingles pulling away or going missing expose the underlayment and dramatically accelerate moisture damage." },
    { title: "Storm or Wind Damage", body: "Post-storm damage that looks minor on the surface can compromise the structural integrity of the full roof system." },
    { title: "Roof Age Becoming a Concern", body: "Most roofs have a 20–25 year lifespan. If yours is approaching that, a professional assessment makes sense now." },
  ],
  warrantyTitle: "50-Year Warranty Options",
  warrantyBody:
    "We work with premium roofing systems that carry long-life manufacturer warranties. Every option is reviewed clearly with you before work begins - what's covered, what isn't, and for how long. No fine print you have to chase down later.",
  faq: [
    { q: "Is the estimate free?", a: "Yes. We review your project and follow up with the right next step for an on-site estimate. No cost, no commitment." },
    { q: "Do you offer financing?", a: "Yes. Financing options are available for qualified homeowners. We'll walk you through options during the estimate process." },
    { q: "Are you licensed and insured?", a: "Yes. Profixter / Premium Island Construction is licensed HI-71484 and fully insured for all exterior project work on Long Island." },
    { q: "How long does a roof replacement take?", a: "Most residential roof replacements on Long Island take 1–2 days depending on the size and complexity of the project." },
    { q: "What roofing materials do you work with?", a: "We work with asphalt shingles, architectural shingles, and premium systems with extended warranty options. We'll recommend what makes sense for your home and budget." },
    { q: "Do you work with insurance claims?", a: "Yes. We can review storm-related damage and help you understand what your options are if an insurance claim may be appropriate." },
  ],
};

const SIDING_CONFIG = {
  eyebrow: "Premium Siding · Long Island",
  headline: "One Siding For Life",
  subhead:
    "Protect your home and transform curb appeal with siding that lasts longer, looks cleaner, and ends the cycle of patch repairs.",
  cta: "Get Free Siding Estimate",
  image: "/images/hero-bg.webp",
  alt: "Long Island home with premium siding",
  trustBadges: ["Licensed HI-71484", "Fully Insured", "Long Island Local", "Warranty-Backed", "Financing Available"],
  benefits: [
    { title: "Cleaner Exterior, Less Maintenance", body: "Modern siding systems resist weathering, moisture, and discoloration - so your home stays sharp with less ongoing effort." },
    { title: "Built for Long Island Weather", body: "Siding selected for Long Island's coastal humidity, temperature swings, and seasonal storm exposure." },
    { title: "Licensed & Fully Insured", body: "Licensed HI-71484. All siding work is fully insured for your protection." },
    { title: "Stronger Structural Protection", body: "New siding adds a moisture barrier and insulation layer that protects the bones of your home - not just the surface." },
    { title: "Financing Available", body: "Qualified homeowners can finance exterior siding projects. Protect your home without putting it on hold." },
    { title: "Local Long Island Team", body: "We work exclusively on Long Island. No revolving crew. A team you can actually reach." },
  ],
  signs: [
    { title: "Cracked or Warped Panels", body: "Visible cracking or warping means the siding can no longer protect the wall from moisture. That damage is spreading." },
    { title: "Moisture or Mold Issues", body: "Moisture getting behind siding causes structural damage that compounds quickly and gets far more expensive the longer it waits." },
    { title: "Fading and Tired Curb Appeal", body: "Heavily faded siding that no longer cleans up has run its service life. No amount of power washing fixes oxidized material." },
    { title: "Repeated Patch Repairs", body: "Constantly patching individual panels often costs more over time - and never fully solves the underlying exposure." },
  ],
  warrantyTitle: "Long-Lasting Exterior Protection",
  warrantyBody:
    "We help homeowners choose siding systems designed for durability and clean finish. Warranty-backed materials are reviewed and explained before any work begins - so you know exactly what you're getting, and for how long.",
  faq: [
    { q: "Can I request siding only?", a: "Yes. Use the form and select Siding, or select Both if you want roofing reviewed at the same time." },
    { q: "Is financing available?", a: "Yes. Financing options are available for qualified homeowners. We'll walk through the options during your estimate." },
    { q: "How long does siding installation take?", a: "Most residential siding projects on Long Island take 2–5 days depending on the size of the home and scope of work." },
    { q: "What siding materials do you work with?", a: "We work with vinyl, fiber cement, and premium siding systems. We'll recommend what makes sense for your home, budget, and Long Island weather exposure." },
    { q: "Are you licensed and insured?", a: "Yes. Profixter / Premium Island Construction is licensed HI-71484 and fully insured for all exterior work." },
    { q: "Does new siding help with insulation?", a: "Yes. Many modern siding systems include foam backing that improves your home's insulation and can help lower energy costs." },
  ],
};

function CheckMark({ color = "#D4A574" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
      <path d="M5 12.5l4 4 10-10" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-[18px] border transition-colors duration-200 ${
        open ? "border-[#D4A574]/35 bg-[#FDF8F2]" : "border-[#D9E4FF] bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="pr-3 text-[15px] font-extrabold text-[#0B1628]">{question}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`flex-shrink-0 text-[#D4A574] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 text-[14px] leading-relaxed text-[#475569]">{answer}</div>
      )}
    </div>
  );
}

export default function ExteriorLandingPage({ project }: Props) {
  const config = project === "roofing" ? ROOFING_CONFIG : SIDING_CONFIG;
  const otherProject = project === "roofing" ? "siding" : "roofing";
  const otherLabel = project === "roofing" ? "Siding" : "Roofing";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08101E]">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="relative flex min-h-[82vh] items-center overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src={config.image}
              alt={config.alt}
              fill
              priority
              className="object-cover object-center opacity-[0.22]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08101E] via-[#08101E]/95 to-[#08101E]/55" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#08101E]/50 via-transparent to-[#08101E]" />
          </div>

          {/* Ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-48 -top-48 h-[900px] w-[900px] rounded-full bg-[#D4A574]/[0.06] blur-[220px]"
          />

          <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
            <div className="grid gap-10 lg:grid-cols-[1fr_460px] lg:items-center lg:gap-14">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex rounded-full border border-[#D4A574]/28 bg-[#D4A574]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8C49A]">
                  {config.eyebrow}
                </div>

                <h1 className="mt-6 text-[52px] font-black leading-[0.88] tracking-[-0.045em] text-white sm:text-[70px] lg:text-[86px]">
                  {config.headline}
                </h1>

                <p className="mt-5 max-w-[600px] text-[18px] font-semibold leading-[1.48] text-white/75 sm:text-[20px]">
                  {config.subhead}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#estimate-form"
                    className="inline-flex min-h-[62px] items-center justify-center gap-2.5 rounded-[18px] bg-[#D4A574] px-8 text-[16px] font-extrabold text-[#111827] shadow-[0_16px_48px_rgba(212,165,116,0.30)] transition hover:-translate-y-0.5 hover:bg-[#E0B886]"
                  >
                    {config.cta}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                  <a
                    href="tel:+16315991363"
                    className="inline-flex min-h-[62px] items-center justify-center gap-2.5 rounded-[18px] border border-white/18 bg-white/[0.07] px-8 text-[16px] font-bold text-white transition hover:bg-white/[0.12]"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.374 1.9.74 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.32-1.32a2 2 0 012.11-.45c.9.36 1.84.61 2.81.74A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Call 631-599-1363
                  </a>
                </div>

                {/* Trust badges */}
                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                  {config.trustBadges.map((badge) => (
                    <div key={badge} className="flex items-center gap-2 text-[13px] font-semibold text-white/52">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D4A574]" />
                      {badge}
                    </div>
                  ))}
                </div>

                <div className="mt-6 text-[13px] text-white/32">
                  Also available:{" "}
                  <Link
                    href={`/${otherProject}`}
                    className="text-[#E8C49A]/65 underline-offset-2 transition hover:text-[#E8C49A] hover:underline"
                  >
                    {otherLabel} estimates →
                  </Link>
                </div>
              </div>

              {/* Right: Form */}
              <div id="estimate-form" className="scroll-mt-[120px]">
                <ExteriorLeadForm defaultProject={project} accentLabel={config.eyebrow} />
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ─────────────────────────────────── */}
        <section className="border-t border-white/[0.06] bg-[#0A1422] py-5">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                { icon: "🛡️", text: "Licensed HI-71484" },
                { icon: "✓", text: "Fully Insured" },
                { icon: "📍", text: "Long Island Local · 9+ Years" },
                { icon: "⭐", text: "4.9 Google Rating" },
                { icon: "💳", text: "Financing Available" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-2">
                  <span className="text-[14px]">{icon}</span>
                  <span className="text-[13px] font-semibold text-white/48">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BENEFITS ────────────────────────────────────── */}
        <section className="bg-[#EEF2FF] py-16 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C49060]">
                {project === "roofing" ? "Why it matters" : "What you get"}
              </div>
              <h2 className="mt-3 text-[32px] font-black tracking-[-0.03em] text-[#0B1628] sm:text-[40px]">
                {project === "roofing"
                  ? "A roof that protects the entire home"
                  : "Siding that works as hard as it looks"}
              </h2>
              <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#475569]">
                {project === "roofing"
                  ? "From material selection to warranty coverage - everything reviewed clearly before work begins."
                  : "From moisture protection to curb appeal - durable siding that ends the patch-repair cycle."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {config.benefits.map(({ title, body }) => (
                <div
                  key={title}
                  className="rounded-[22px] border border-[#D9E4FF] bg-white p-6 transition hover:border-[#D4A574]/40 hover:shadow-[0_8px_32px_rgba(212,165,116,0.08)]"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FDF8F2]">
                    <CheckMark />
                  </div>
                  <div className="text-[15px] font-extrabold text-[#0B1628]">{title}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#475569]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SIGNS TO ACT ────────────────────────────────── */}
        <section className="bg-[#08101E] py-16 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8C49A]">Signs to act</div>
                <h2 className="mt-3 text-[34px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[40px]">
                  When temporary repairs stop making sense
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-white/48">
                  {project === "roofing"
                    ? "Small leaks and aging shingles don't fix themselves. The longer you wait, the more expensive the damage gets."
                    : "Cracked panels and moisture behind siding compound quickly. Patch repairs only delay the inevitable."}
                </p>
                <a
                  href="#estimate-form"
                  className="mt-7 inline-flex min-h-[54px] items-center justify-center rounded-[16px] bg-[#D4A574] px-7 text-[15px] font-extrabold text-[#111827] shadow-[0_12px_32px_rgba(212,165,116,0.25)] transition hover:-translate-y-0.5 hover:bg-[#E0B886]"
                >
                  Request a Free Estimate
                </a>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {config.signs.map(({ title, body }) => (
                  <div key={title} className="rounded-[20px] border border-white/10 bg-white/[0.05] p-5">
                    <div className="mb-3 h-1.5 w-10 rounded-full bg-[#D4A574]" />
                    <div className="text-[15px] font-extrabold text-white">{title}</div>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/45">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── WARRANTY + FINANCING ─────────────────────────── */}
        <section className="bg-[#EEF2FF] py-16 sm:py-20">
          <div className="mx-auto grid max-w-[1280px] gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            {/* Warranty */}
            <div className="rounded-[26px] border border-[#D9E4FF] bg-white p-7 sm:p-9">
              <div className="mb-4 inline-flex rounded-[10px] bg-[#FDF8F2] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C49060]">
                Warranty
              </div>
              <h2 className="text-[26px] font-black tracking-[-0.03em] text-[#0B1628] sm:text-[30px]">
                {config.warrantyTitle}
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[#475569]">{config.warrantyBody}</p>
              <div className="mt-5 flex items-start gap-2 text-[13px] font-semibold text-[#C49060]">
                <CheckMark color="#C49060" />
                Reviewed and explained clearly before work begins
              </div>
            </div>
            {/* Financing */}
            <div className="rounded-[26px] border border-[#D9E4FF] bg-white p-7 sm:p-9">
              <div className="mb-4 inline-flex rounded-[10px] bg-[#EFF6FF] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                Financing
              </div>
              <h2 className="text-[26px] font-black tracking-[-0.03em] text-[#0B1628] sm:text-[30px]">
                Protect the home now
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[#475569]">
                Financing is available for qualified homeowners, so a necessary exterior project doesn&rsquo;t have to
                stay on hold. We&rsquo;ll walk you through options clearly during your estimate - no pressure.
              </p>
              <div className="mt-5 flex items-start gap-2 text-[13px] font-semibold text-[#306EEC]">
                <CheckMark color="#306EEC" />
                No need to delay protecting your home
              </div>
            </div>
          </div>
        </section>

        {/* ── SUBSCRIBER OFFER ─────────────────────────────── */}
        <section className="bg-[#08101E] py-16 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div
              className="rounded-[32px] border border-[#D4A574]/18 p-8 sm:p-12"
              style={{
                background: "linear-gradient(135deg, #0D1F42 0%, #0F1D3A 60%, #0A1628 100%)",
                boxShadow: "0 0 0 1px rgba(212,165,116,0.08)",
              }}
            >
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="inline-flex rounded-full border border-[#D4A574]/28 bg-[#D4A574]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#E8C49A]">
                    Profixter Members
                  </div>
                  <h2 className="mt-4 text-[30px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[36px]">
                    Exclusive exterior project offers for active members.
                  </h2>
                  <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-white/58">
                    Current members may qualify for preferred project pricing or a complimentary year of handyman
                    membership after completing an exterior project. Ask about current member offers when you request
                    your estimate.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    {[
                      "Ask about current Member exterior project offers.",
                      "Current members may qualify for a free year of handyman membership or preferred project pricing.",
                      "Offer availability depends on project scope.",
                    ].map((line) => (
                      <div key={line} className="flex items-start gap-2.5 text-[13px] text-white/42">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D4A574]" />
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:min-w-[200px] lg:flex-col">
                  <a
                    href="#estimate-form"
                    className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-[#D4A574] px-8 text-[15px] font-extrabold text-[#111827] transition hover:-translate-y-0.5 hover:bg-[#E0B886]"
                  >
                    Request Estimate
                  </a>
                  <a
                    href="tel:+16315991363"
                    className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] border border-white/15 bg-white/[0.05] px-8 text-[15px] font-bold text-white/82 transition hover:bg-white/[0.10]"
                  >
                    Call 631-599-1363
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHY CHOOSE US + FAQ ───────────────────────────── */}
        <section className="bg-[#EEF2FF] py-16 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              {/* Why us */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">Why Profixter</div>
                <h2 className="mt-3 text-[32px] font-black tracking-[-0.035em] text-[#0B1628] sm:text-[38px]">
                  High-ticket work with a homeowner-first process
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-[#475569]">
                  We don&rsquo;t rush estimates, oversell materials, or send crews you&rsquo;ve never met. You get local
                  accountability, honest recommendations, and a team focused on protecting the home - not closing a
                  sale.
                </p>
                <div className="mt-6 space-y-4">
                  {[
                    { title: "Local accountability", body: "We're on Long Island. This is our neighborhood, and we're accountable to it." },
                    { title: "Clear process, no surprises", body: "Estimate → material review → install. You know every step and cost before work starts." },
                    { title: "Real warranty coverage", body: "We explain what's covered, what isn't, and for how long - before you agree to anything." },
                    { title: "Financing options explained", body: "If financing makes sense for your project, we help you understand the options clearly." },
                  ].map(({ title, body }) => (
                    <div key={title} className="flex items-start gap-3.5">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#D4A574]">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[14px] font-extrabold text-[#0B1628]">{title}</div>
                        <div className="mt-0.5 text-[13px] leading-relaxed text-[#475569]">{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div>
                <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#C49060]">
                  Common Questions
                </div>
                <div className="space-y-2.5">
                  {config.faq.map(({ q, a }) => (
                    <FAQItem key={q} question={q} answer={a} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECOND FORM SECTION ───────────────────────────── */}
        <section className="bg-[#08101E] py-16 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_460px] lg:items-start">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8C49A]">Request a callback</div>
                <h2 className="mt-3 text-[34px] font-black leading-tight tracking-[-0.035em] text-white sm:text-[42px]">
                  Know what your project will cost.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-white/50">
                  A real person reviews every request. No automated quotes. No pressure. Just a clear conversation about
                  your home and what it needs.
                </p>
                <div className="mt-7 space-y-3">
                  {[
                    "Free estimate - no cost, no commitment",
                    "Financing available for qualified homeowners",
                    "Licensed HI-71484 · Fully insured",
                    "Local Long Island team · 9+ years",
                    "4.9 Google Rating",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-[14px] font-semibold text-white/55">
                      <CheckMark />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.15em] text-white/28">
                    Prefer to call?
                  </div>
                  <a
                    href="tel:+16315991363"
                    className="mt-2 block text-[26px] font-black tracking-[-0.02em] text-white transition hover:text-[#E8C49A]"
                  >
                    631-599-1363
                  </a>
                </div>
              </div>
              <div id="callback-form" className="scroll-mt-[120px]">
                <ExteriorLeadForm defaultProject={project} accentLabel={config.eyebrow} />
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────── */}
        <section className="bg-[#0A1422] py-14 sm:py-16">
          <div className="mx-auto max-w-[760px] px-4 text-center sm:px-6">
            <h2 className="text-[28px] font-black leading-tight tracking-[-0.03em] text-white sm:text-[34px]">
              {project === "roofing"
                ? "Your roof should not be something you keep worrying about."
                : "Your home's exterior should protect and impress - not stress you out."}
            </h2>
            <p className="mx-auto mt-4 max-w-[500px] text-[15px] leading-relaxed text-white/45">
              Get a free estimate from a Long Island team that will give you a straight answer - and the time to decide.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="#estimate-form"
                className="inline-flex min-h-[58px] w-full items-center justify-center rounded-[18px] bg-[#D4A574] px-9 text-[16px] font-extrabold text-[#111827] shadow-[0_16px_40px_rgba(212,165,116,0.26)] transition hover:-translate-y-0.5 hover:bg-[#E0B886] sm:w-auto"
              >
                {config.cta}
              </a>
              <a
                href="tel:+16315991363"
                className="inline-flex min-h-[58px] w-full items-center justify-center rounded-[18px] border border-white/18 bg-white/[0.07] px-9 text-[16px] font-bold text-white transition hover:bg-white/[0.12] sm:w-auto"
              >
                Call 631-599-1363
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-white/25">
              <span>Licensed HI-71484</span>
              <span aria-hidden="true">·</span>
              <span>Fully Insured</span>
              <span aria-hidden="true">·</span>
              <span>Long Island Local</span>
              <span aria-hidden="true">·</span>
              <span>4.9 Google Rating</span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
