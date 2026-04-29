"use client";

import Image from "next/image";
import { team as TEAM } from "@/app/data/content";

function parseMember(fullName: string) {
  const idx = fullName.indexOf(" - ");
  if (idx === -1) return { name: fullName, role: "" };
  return { name: fullName.slice(0, idx).trim(), role: fullName.slice(idx + 3).trim() };
}

const TRUST_ITEMS = [
  "Background checked",
  "Licensed & insured",
  "9+ years together",
  "Personally vetted by Taras",
];

export default function HandymenSection() {
  if (!TEAM?.length) return null;

  return (
    <section
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      {/* Top ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[900px] rounded-full blur-[140px] opacity-50"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.10), transparent 70%)" }}
      />
      {/* Subtle dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "radial-gradient(circle, #306EEC 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mx-auto max-w-[720px] text-center mb-14 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Your Dedicated Team
            </span>
          </div>

          <h2 className="text-[32px] sm:text-[50px] lg:text-[64px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
            The same pros.
            <br />
            <span className="text-[#306EEC]">Every single visit.</span>
          </h2>

          <p className="mx-auto max-w-[560px] text-[15px] sm:text-[17px] leading-relaxed text-[#475569]">
            No random contractors. No strangers in your home. The same
            trusted professionals who learn your space and improve with
            every visit.
          </p>
        </div>

        {/* ── Team cards ── */}
        <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-[960px] mx-auto">
          {TEAM.map((member) => {
            const { name, role } = parseMember(member.name);
            return (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition-all duration-500 hover:shadow-[0_40px_120px_rgba(15,23,42,0.15)] hover:-translate-y-1.5"
                style={{ border: "1px solid rgba(197,203,216,0.6)" }}
              >
                {/* Photo with premium cinematic treatment */}
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3/2" }}>
                  <Image
                    src={member.photo}
                    alt={name}
                    fill
                    className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.05]"
                    sizes="(max-width: 768px) 100vw, 480px"
                    priority
                  />
                  {/* Premium dark bottom gradient — smooth into white card body */}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(255,255,255,0.95) 100%)" }}
                  />
                  {/* Cinematic vignette */}
                  <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(15,23,42,0.12)] rounded-t-[28px]" />

                  {/* Role badge — top left */}
                  {role && (
                    <div className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-[#306EEC] px-3.5 py-1.5 shadow-[0_4px_20px_rgba(48,110,236,0.40)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/70 flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                        {role}
                      </span>
                    </div>
                  )}

                  {/* Verified badge — top right */}
                  <div className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC] flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(134,239,172,0.8)" }} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/85">Vetted</span>
                  </div>
                </div>

                {/* Content */}
                <div className="px-7 pb-8 pt-5">
                  <h3 className="text-[22px] font-extrabold text-[#0B1628] mb-1 leading-tight">
                    {name}
                  </h3>
                  {role && (
                    <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#306EEC] mb-4">
                      {role}
                    </div>
                  )}
                  <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#475569] line-clamp-4">
                    {member.blurb}
                  </p>

                  {/* Bottom credential strip */}
                  <div className="mt-5 pt-5 border-t border-[#E6E8EF] flex flex-wrap gap-3">
                    {["Background Checked", "Licensed", "Insured"].map((cred) => (
                      <div key={cred} className="inline-flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#306EEC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[11px] font-semibold text-[#475569]">{cred}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Trust strip ── */}
        <div className="mt-14 sm:mt-16 mx-auto max-w-[960px]">
          <div
            className="rounded-[20px] border border-[#C5CBD8] bg-white px-6 py-5 sm:px-8 sm:py-6 shadow-[0_8px_40px_rgba(15,23,42,0.05)]"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-10">
              {TRUST_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4 4 10-10" stroke="#306EEC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[13px] font-semibold text-[#0B1628]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
