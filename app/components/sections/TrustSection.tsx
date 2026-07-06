"use client";

const GOOGLE_REVIEWS_URL = "https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8";

const MOST_ACTIVE_TOWNS = [
  "Babylon",
  "West Babylon",
  "Lindenhurst",
  "West Islip",
  "Islip",
  "Deer Park",
  "North Babylon",
];

const ALSO_SERVING_TOWNS = [
  "Huntington",
  "Smithtown",
  "Brookhaven",
  "Massapequa",
  "Hempstead",
  "Long Beach",
  "Oyster Bay",
  "Glen Cove",
  "Hicksville",
];

function CheckItem({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-[1px] text-[14px] font-bold ${light ? "text-[#86EFAC]" : "text-[#0F172A]"}`}>
        ✓
      </span>
      <span className={`text-[14px] leading-relaxed ${light ? "text-[#E2E8F0]" : "text-[#1E293B]"}`}>
        {children}
      </span>
    </li>
  );
}

function CredentialsCard() {
  return (
    <div className="relative h-full overflow-hidden rounded-[20px] bg-[#0B1628] text-white shadow-[0_24px_60px_rgba(11,22,40,0.18)]">
      <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.05), transparent 60%)" }}
      />
      <div className="absolute right-5 top-5 opacity-[0.12]" aria-hidden="true">
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
          <circle cx="44" cy="44" r="42" stroke="#D4A574" strokeWidth="1.5" strokeDasharray="3.5 4" />
          <circle cx="44" cy="44" r="34" stroke="#D4A574" strokeWidth="0.8" />
          <path d="M44 22L26 36V60H38V48H50V60H62V36L44 22Z" stroke="#D4A574" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="relative flex h-full flex-col px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94a3b8]">
          State of New York
        </div>
        <div className="mt-1 text-[12px] font-semibold text-white/85">
          Home Improvement Contractor
        </div>

        <div className="mt-7">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a3b8]">
            License No.
          </div>
          <div className="mt-2 font-mono text-[34px] font-bold leading-none tracking-[-0.01em] text-white sm:text-[38px]">
            HI-71484
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#86EFAC]/30 bg-[#86EFAC]/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC]" style={{ boxShadow: "0 0 6px rgba(134,239,172,0.8)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86EFAC]">
              Active &amp; Verifiable
            </span>
          </div>
        </div>

        <div className="mt-7 h-px w-full bg-white/10" />

        <ul className="mt-6 space-y-3">
          <CheckItem light>Licensed Home Improvement Contractor</CheckItem>
          <CheckItem light>Fully insured</CheckItem>
          <CheckItem light>Nearly 10 years in construction</CheckItem>
          <CheckItem light>Founder-led and locally accountable</CheckItem>
        </ul>

        <div className="mt-auto flex items-center gap-2 pt-7">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-[#D4A574]/60" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] leading-relaxed text-white/45">
            License verifiable · New York State Dept. of State
          </span>
        </div>
      </div>
    </div>
  );
}

function GoogleReviewsCard() {
  return (
    <div className="relative h-full overflow-hidden rounded-[20px] border border-[#E5E9F2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
      <div className="flex h-full flex-col px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#64748B]">
          Google Reviews
        </div>

        <div className="mt-6 text-[26px] leading-none text-[#F59E0B]" aria-label="Five star rating">
          ★★★★★
        </div>

        <h3 className="mt-5 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
          4.9 Google Rating
        </h3>

        <p className="mt-4 text-[15px] leading-relaxed text-[#475569]">
          Read what Long Island homeowners say about Profixter.
        </p>

        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex h-12 items-center justify-center rounded-[14px] bg-[#0F172A] px-5 text-[14px] font-bold text-white transition-colors hover:bg-[#111827]"
        >
          View Reviews
        </a>
      </div>
    </div>
  );
}

function TrustReasonsCard() {
  return (
    <div className="relative h-full overflow-hidden rounded-[20px] border border-[#E5E9F2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
      <div className="flex h-full flex-col px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#306EEC]">
          In-Home Trust
        </div>

        <h3 className="mt-5 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[#0F172A]">
          Why homeowners trust us
        </h3>

        <ul className="mt-6 space-y-3">
          <CheckItem>Licensed &amp; insured</CheckItem>
          <CheckItem>Long Island local company</CheckItem>
          <CheckItem>Same trusted team every visit</CheckItem>
          <CheckItem>Nearly 10 years of home service experience</CheckItem>
        </ul>

        <p className="mt-auto pt-7 text-[13px] leading-relaxed text-[#64748B]">
          Homeowners know who is coming to their home and can rely on the same trusted team month after month.
        </p>
      </div>
    </div>
  );
}

function ServiceAreaStrip() {
  return (
    <div className="mt-6 overflow-hidden rounded-[20px] border border-[#E5E9F2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.04)] lg:mt-8">
      <div className="grid gap-7 px-6 py-7 sm:gap-8 sm:px-7 sm:py-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-10 lg:px-10 lg:py-9">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#306EEC]">
            Service Area
          </div>
          <h3 className="mt-2 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0F172A] sm:text-[26px] lg:text-[28px]">
            Serving Nassau &amp; Suffolk Counties
          </h3>
          <p className="mt-3 text-[14px] leading-relaxed text-[#475569] sm:text-[15px]">
            Based in Babylon. Serving homeowners across Long Island.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-[0.82fr_1.18fr] sm:gap-8">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
              Most active in
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {MOST_ACTIVE_TOWNS.map((town) => (
                <li key={town} className="text-[14px] font-semibold text-[#0F172A] sm:text-[15px]">
                  {town}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94A3B8]">
              Also serving Nassau &amp; Suffolk Counties, including
            </div>
            <ul className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {ALSO_SERVING_TOWNS.map((town) => (
                <li key={town} className="text-[14px] font-semibold text-[#0F172A] sm:text-[15px]">
                  {town}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrustSection() {
  return (
    <section id="trust" className="w-full bg-[#EAEDFA] py-10 sm:py-14 lg:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-5 lg:px-5">
        <div className="mx-auto mb-7 max-w-[760px] text-center sm:mb-12 lg:mb-14">
          <span className="inline-flex items-center rounded-full border border-[#D9E4FF] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
            Verified &amp; Accountable
          </span>

          <h2 className="mt-4 text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#0F172A] sm:mt-5 sm:text-[40px] sm:leading-[1.06] sm:tracking-[-0.035em] lg:text-[48px]">
            Why Homeowners Trust Profixter
          </h2>

          <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-relaxed text-[#475569] sm:mt-5 sm:text-[16px]">
            Licensed. Insured. Local. Reviewed.
          </p>
        </div>

        <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
          <CredentialsCard />
          <GoogleReviewsCard />
          <TrustReasonsCard />
        </div>

        <ServiceAreaStrip />
      </div>
    </section>
  );
}
