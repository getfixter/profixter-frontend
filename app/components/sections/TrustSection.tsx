"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * TrustSection
 *
 * Answers the single question every homeowner asks before subscribing:
 * "Can I trust these people in my home?"
 *
 * Three trust anchors, each answering a different form of the question:
 *   1. CREDENTIALS — institutional trust (license, insurance, years)
 *   2. LIVE REVIEWS — peer trust (real Google data via /api/google/reviews)
 *   3. FOUNDER     — personal trust (named human, real photo, direct line)
 *
 * Then: SERVICE AREA strip — local Long Island authority anchored by
 * named towns, not "we serve everywhere" claims.
 *
 * Strict rule: only real, verifiable proof. No fabricated customer names,
 * no invented stats, no fake review excerpts. Empty/failed API states
 * gracefully degrade to "Read on Google" CTAs without showing fake content.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types matching the live /api/google/reviews response (see jobs/routes/google.js)
// ────────────────────────────────────────────────────────────────────────────
type ApiReview = {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description?: string;
  time?: number;
  profile_photo_url?: string;
};

type ApiPayload = {
  ok: boolean;
  placeName?: string;
  rating?: number;
  total?: number;
  googleUrl?: string;
  reviews?: ApiReview[];
  error?: string;
};

const FOUNDER_PHONE_DISPLAY = "631-599-1363";
const FOUNDER_PHONE_TEL = "+16315991363";
const GOOGLE_FALLBACK_URL = "https://www.google.com/maps";

// Long Island towns — public service-area claim, not member-tenure claim.
// Conservative listing: well-known towns across both counties.
// Edit this list to match actual operational coverage.
const SUFFOLK_TOWNS = [
  "Babylon",
  "Lindenhurst",
  "Huntington",
  "Smithtown",
  "Brookhaven",
  "Islip",
];
const NASSAU_TOWNS = [
  "Massapequa",
  "Hempstead",
  "Long Beach",
  "Oyster Bay",
  "Glen Cove",
  "Hicksville",
];

// ────────────────────────────────────────────────────────────────────────────
// Star rendering — pure SVG, no font dependencies, looks consistent on all OS
// ────────────────────────────────────────────────────────────────────────────
function StarRow({
  rating,
  size = 16,
  filled = "#F59E0B",
  empty = "#D9DEE8",
}: {
  rating: number;
  size?: number;
  filled?: string;
  empty?: string;
}) {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex items-center gap-[3px]" aria-label={`Rated ${r} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < r ? filled : empty}
          aria-hidden="true"
        >
          <path d="M12 2.5l2.95 6.13 6.55.86-4.79 4.55 1.21 6.71L12 17.4l-6.07 3.35 1.21-6.71L2.35 9.49l6.55-.86L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CREDENTIALS CARD
// Dark navy "official document" feel. Geist Mono for the license number
// gives that ceremonial-credential weight without adding a font dependency.
// ────────────────────────────────────────────────────────────────────────────
function CredentialsCard() {
  return (
    <div className="relative h-full overflow-hidden rounded-[20px] bg-[#0B1628] text-white shadow-[0_24px_60px_rgba(11,22,40,0.18)]">
      {/* Hairline top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
      {/* Inner glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.05), transparent 60%)" }}
      />
      {/* Official seal — decorative, positioned top-right */}
      <div className="absolute top-5 right-5 opacity-[0.12]" aria-hidden="true">
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
          <circle cx="44" cy="44" r="42" stroke="#D4A574" strokeWidth="1.5" strokeDasharray="3.5 4" />
          <circle cx="44" cy="44" r="34" stroke="#D4A574" strokeWidth="0.8" />
          <circle cx="44" cy="44" r="26" stroke="#D4A574" strokeWidth="0.5" />
          {/* House silhouette */}
          <path d="M44 22L26 36V60H38V48H50V60H62V36L44 22Z" stroke="#D4A574" strokeWidth="2" strokeLinejoin="round" />
          {/* Door */}
          <rect x="40" y="48" width="8" height="12" stroke="#D4A574" strokeWidth="1.5" />
          {/* Stars at top */}
          <path d="M44 14L45.2 17.4H48.8L46 19.4L47 22.8L44 20.8L41 22.8L42 19.4L39.2 17.4H42.8L44 14Z" fill="#D4A574" />
        </svg>
      </div>

      <div className="relative px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-10 flex flex-col h-full">
        {/* Eyebrow */}
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94a3b8]">
          State of New York
        </div>
        <div className="mt-1 text-[12px] font-semibold text-white/85">
          Home Improvement Contractor
        </div>

        {/* License number */}
        <div className="mt-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a3b8]">
            License No.
          </div>
          <div className="mt-2 font-mono text-[34px] sm:text-[38px] font-bold leading-none tracking-[-0.01em] text-white">
            HI-71484
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#86EFAC]/30 bg-[#86EFAC]/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC]" style={{ boxShadow: "0 0 6px rgba(134,239,172,0.8)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86EFAC]">
              Active &amp; Verifiable
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-7 h-px w-full bg-white/10" />

        {/* Credential bullets */}
        <ul className="mt-6 space-y-3">
          {[
            "Fully insured for in-home work",
            "9+ years of construction & home services on Long Island",
            "Founder-led — every booking personally reviewed",
          ].map((line) => (
            <li key={line} className="flex items-start gap-3">
              <svg className="mt-[3px] h-4 w-4 flex-shrink-0 text-[#86EFAC]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[14px] leading-relaxed text-[#E2E8F0]">{line}</span>
            </li>
          ))}
        </ul>

        {/* Verifiable footer */}
        <div className="mt-auto pt-7 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#D4A574]/60 flex-shrink-0" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] text-white/45 leading-relaxed">
            License verifiable · New York State Dept. of State
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LIVE GOOGLE REVIEWS CARD
// Hits the same /api/google/reviews endpoint that GoogleReviewsLiveMini uses.
// Light-themed for this section. Auto-rotates between real reviews on a long
// (15s) interval — gentle, not distracting. Empty/failed states gracefully
// fall back to a "Read on Google" CTA — never shows fake content.
// ────────────────────────────────────────────────────────────────────────────
function LiveReviewsCard() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const ROTATE_MS = 15000;

  useEffect(() => {
    let alive = true;
    const fetchReviews = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${base}/api/google/reviews?t=${Date.now()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiPayload;
        if (!alive) return;
        setData(json);
      } catch {
        if (!alive) return;
        setData({ ok: false });
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchReviews();
    return () => {
      alive = false;
    };
  }, []);

  const reviews = useMemo(() => {
    if (!data?.ok || !Array.isArray(data.reviews)) return [];
    return data.reviews.filter((r) => r.text && r.text.trim().length > 0);
  }, [data]);

  const hasReviews = reviews.length > 0;
  const rating = data?.ok && data.rating ? data.rating : 0;
  const total = data?.ok && data.total ? data.total : 0;
  const googleUrl = data?.ok && data.googleUrl ? data.googleUrl : GOOGLE_FALLBACK_URL;

  // Auto-rotate (only when we have ≥ 2 reviews and not paused)
  useEffect(() => {
    if (paused || reviews.length < 2) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setIdx((i) => (i + 1) % reviews.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [idx, paused, reviews.length]);

  const current = hasReviews ? reviews[idx] : null;

  return (
    <div
      className="relative h-full overflow-hidden rounded-[20px] bg-white border border-[#E5E9F2] shadow-[0_24px_60px_rgba(15,23,42,0.06)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-10 flex flex-col h-full">
        {/* Header row: Google logo + label, rating right-aligned */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/icons/icon-google.svg"
              alt="Google"
              width={20}
              height={20}
              className="h-5 w-5"
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#64748B]">
                Live from Google
              </div>
              <div className="text-[12px] font-semibold text-[#0F172A]">
                Verified customer reviews
              </div>
            </div>
          </div>
        </div>

        {/* Rating display — large + stars */}
        <div className="mt-6 flex items-end gap-3">
          <span className="text-[44px] font-extrabold leading-none tracking-[-0.02em] text-[#0F172A]">
            {loading ? "—" : rating > 0 ? rating.toFixed(1) : "—"}
          </span>
          <div className="pb-1.5">
            <StarRow rating={rating > 0 ? rating : 0} size={18} />
            <div className="mt-1.5 text-[12px] font-semibold text-[#64748B]">
              {loading
                ? "Loading reviews…"
                : total > 0
                  ? `${total} review${total === 1 ? "" : "s"} on Google`
                  : "Reviews on Google"}
            </div>
          </div>
        </div>

        {/* Review excerpt — only shown when we have real data */}
        <div className="mt-6 min-h-[124px] sm:min-h-[136px]">
          {loading ? (
            // Loading skeleton — restrained, no shimmer animation
            <div className="space-y-2">
              <div className="h-3 w-[88%] rounded-full bg-[#EEF2F8]" />
              <div className="h-3 w-[72%] rounded-full bg-[#EEF2F8]" />
              <div className="h-3 w-[60%] rounded-full bg-[#EEF2F8]" />
            </div>
          ) : current ? (
            <>
              <p className="text-[14px] leading-relaxed text-[#1E293B] sm:text-[15px] line-clamp-5">
                <span className="text-[#306EEC] font-bold">&ldquo;</span>
                {current.text}
                <span className="text-[#306EEC] font-bold">&rdquo;</span>
              </p>
              <div className="mt-3 text-[12px] font-semibold text-[#475569]">
                {current.author_name}
                {current.relative_time_description ? (
                  <span className="text-[#94A3B8] font-normal">
                    {" "}
                    · {current.relative_time_description}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            // Graceful empty state — never fake content
            <p className="text-[14px] leading-relaxed text-[#475569] sm:text-[15px]">
              See what Long Island homeowners are saying about Profixter on Google.
            </p>
          )}
        </div>

        {/* Footer: rotation dots (only if multiple) + Google link */}
        <div className="mt-auto pt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {reviews.length > 1 &&
              reviews.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Show review ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-6 bg-[#306EEC]" : "w-1.5 bg-[#CBD5E1] hover:bg-[#306EEC]/60"
                  }`}
                />
              ))}
          </div>

          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#306EEC] hover:text-[#2558C9] transition-colors"
          >
            Read on Google
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 17L17 7M17 7H9M17 7V15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FOUNDER CARD
// The personal-accountability anchor. Real photo, real name, direct phone.
// Warm cream background — only deviation from cold blue palette in this
// section, intentionally signalling "human" vs "institutional"/"data".
// ────────────────────────────────────────────────────────────────────────────
function FounderCard() {
  return (
    <div className="relative h-full overflow-hidden rounded-[20px] bg-[#FBF7F0] border border-[#EFE4D2] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
      <div className="px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-10 flex flex-col h-full">
        {/* Eyebrow */}
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#92724E]">
          Founder · Personally Accountable
        </div>

        {/* Photo + name */}
        <div className="mt-5 flex items-center gap-4">
          <div className="relative h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-[0_8px_22px_rgba(15,23,42,0.14)] sm:h-[76px] sm:w-[76px]">
            <Image
              src="/images/Taras.png"
              alt="Taras Bandura, Profixter founder"
              fill
              className="object-cover object-top"
              sizes="76px"
            />
          </div>
          <div>
            <div className="text-[18px] font-bold leading-tight text-[#0F172A] sm:text-[20px]">
              Taras Bandura
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-[#92724E]">
              Founder &amp; General Manager
            </div>
          </div>
        </div>

        {/* The personal commitment — quoted, signed, real */}
        <blockquote className="mt-7 border-l-2 border-[#D4A574] pl-4 text-[15px] leading-relaxed text-[#1E293B] sm:text-[16px]">
          &ldquo;I review every booking we accept and stand behind every visit.
          If anything ever isn&rsquo;t right, my number is yours — directly.&rdquo;
        </blockquote>

        {/* Direct phone CTA */}
        <a
          href={`tel:${FOUNDER_PHONE_TEL}`}
          className="mt-auto pt-7 group block"
        >
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#0F172A]/10 bg-white px-4 py-3.5 transition-all hover:border-[#0F172A]/30 hover:shadow-[0_8px_22px_rgba(15,23,42,0.10)]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                  Reach Taras directly
                </div>
                <div className="text-[16px] font-bold text-[#0F172A] sm:text-[17px]">
                  {FOUNDER_PHONE_DISPLAY}
                </div>
              </div>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[#94A3B8] group-hover:text-[#0F172A] transition-colors"
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
          </div>
        </a>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE AREA STRIP
// Local Long Island authority. Town list grounds the "we serve LI" claim
// in named places — far more credible than a vague "Suffolk & Nassau"
// statement. Two columns on desktop and mobile (LI shape readability).
// ────────────────────────────────────────────────────────────────────────────
function ServiceAreaStrip() {
  return (
    <div className="mt-6 lg:mt-8 overflow-hidden rounded-[20px] border border-[#E5E9F2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.04)]">
      <div className="grid gap-6 px-6 py-7 sm:gap-8 sm:px-7 sm:py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:px-10 lg:py-9">
        {/* Left: heading + subtitle */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#306EEC]">
            Long Island Coverage
          </div>
          <h3 className="mt-2 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[26px] lg:text-[28px]">
            Member homes across Suffolk &amp; Nassau Counties.
          </h3>
          <p className="mt-3 text-[14px] leading-relaxed text-[#475569] sm:text-[15px]">
            Long Island-based and locally accountable. The same trusted team —
            the people who actually live and work here.
          </p>
        </div>

        {/* Right: two-column town list */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:gap-x-10">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
              Suffolk County
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {SUFFOLK_TOWNS.map((t) => (
                <li
                  key={t}
                  className="text-[14px] font-semibold text-[#0F172A] sm:text-[15px]"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
              Nassau County
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {NASSAU_TOWNS.map((t) => (
                <li
                  key={t}
                  className="text-[14px] font-semibold text-[#0F172A] sm:text-[15px]"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer note — bottom of strip, microcopy */}
      <div className="border-t border-[#E5E9F2] bg-[#F8FAFF] px-6 py-3 sm:px-10 sm:py-3.5">
        <p className="text-[12px] leading-relaxed text-[#64748B]">
          Not sure if we cover your town?{" "}
          <Link
            href="/membership"
            className="font-semibold text-[#306EEC] hover:text-[#2558C9]"
          >
            See how membership works
          </Link>{" "}
          — or call Taras at{" "}
          <a
            href={`tel:${FOUNDER_PHONE_TEL}`}
            className="font-semibold text-[#306EEC] hover:text-[#2558C9]"
          >
            {FOUNDER_PHONE_DISPLAY}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN SECTION
// ────────────────────────────────────────────────────────────────────────────
export default function TrustSection() {
  return (
    <section
      id="trust"
      className="w-full bg-[#EAEDFA] py-12 sm:py-14 lg:py-20"
    >
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        {/* ============== HEADER ============== */}
        <div className="mx-auto max-w-[760px] text-center mb-9 sm:mb-12 lg:mb-14">
          <span className="inline-flex items-center rounded-full border border-[#D9E4FF] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
            Verified &amp; Accountable
          </span>

          <h2 className="mt-5 text-[28px] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#0F172A] sm:text-[40px] lg:text-[48px]">
            Real credentials. Real reviews.
            <br className="hidden sm:block" />
            <span className="text-[#306EEC]"> The same trusted team.</span>
          </h2>

          <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-relaxed text-[#475569] sm:text-[16px]">
            Everything you&rsquo;d want to verify before letting someone into your
            home — clearly listed, in one place.
          </p>
        </div>

        {/* ============== THREE TRUST ANCHORS ============== */}
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
          <CredentialsCard />
          <LiveReviewsCard />
          <FounderCard />
        </div>

        {/* ============== SERVICE AREA STRIP ============== */}
        <ServiceAreaStrip />
      </div>
    </section>
  );
}
