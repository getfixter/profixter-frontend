"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { team as TEAM } from "@/app/data/content";

export default function HandymenSection() {
  const [idx, setIdx] = useState(0);
  const person = TEAM[idx];

  const prev = () => setIdx((i) => (i === 0 ? TEAM.length - 1 : i - 1));
  const next = () => setIdx((i) => (i + 1) % TEAM.length);

  // Desktop thumbnails strip refs (future-proof for many techs)
  const stripRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep active thumbnail visible when idx changes (thumb click OR next/prev)
  useEffect(() => {
    const el = itemRefs.current[idx];
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [idx]);

  // Close any "stuck hover" issues on iOS when tapping thumbnails
  useEffect(() => {
    const onTouch = () => {};
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  // Safety (in case TEAM is empty while you load content later)
  if (!TEAM?.length) return null;

  return (
    <section className="relative w-full bg-[#313234] py-12 sm:py-16 lg:py-24 overflow-hidden">
      <div className="container mx-auto px-5 sm:px-6 lg:px-5 max-w-[1240px]">
        {/* ================= TITLE (MOBILE) ================= */}
        <div className="lg:hidden text-center mb-8">
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2 sm:mb-3">
            <h2 className="text-4xl sm:text-5xl font-bold leading-[89%] tracking-[-0.05em] text-[#eef2ff] uppercase">
              MEET OUR
            </h2>
            <Image
              src="/images/title-handymen.png"
              alt="Handymen"
              width={80}
              height={60}
              className="object-contain hidden sm:block"
            />
          </div>

          <h2 className="text-5xl sm:text-6xl font-bold leading-[89%] tracking-[-0.05em] -mt-1 sm:-mt-2 text-[#306eec] uppercase">
            HANDYMEN
          </h2>

          <p className="mt-4 text-sm sm:text-base text-[#c5cbd8] max-w-md mx-auto">
            Skilled professionals who bring comfort and quality to every home.
            Reliable, friendly, and ready to tackle any task — big or small.
          </p>
        </div>

        {/* ================= DESKTOP TITLE + STRIP ================= */}
        <div className="hidden lg:block">
          {/* Title first (more stable than negative margin overlap) */}
          <div className="flex items-start justify-between gap-8 mb-6">
            <div className="max-w-[680px]">
              <div className="flex items-center gap-4">
                <div className="text-[64px] font-bold leading-[89%] text-[#eef2ff] uppercase tracking-[-0.05em]">
                  MEET OUR
                </div>
                <Image
                  src="/images/title-handymen.png"
                  alt="Handymen small"
                  width={120}
                  height={80}
                  className="object-contain"
                />
              </div>
              <div className="text-[64px] font-bold leading-[89%] text-[#306eec] uppercase tracking-[-0.05em] -mt-2">
                HANDYMEN
              </div>
            </div>

            <p className="text-[14px] text-[#c5cbd8] text-right max-w-[420px] pt-3">
              Skilled professionals who bring comfort and quality to every home.
              Reliable, friendly, and ready to tackle any task — big or small.
            </p>
          </div>

          {/* Desktop Thumbnails Strip */}
          <div className="flex items-center gap-3">
            <div
              ref={stripRef}
              className="handy-strip flex-1 overflow-x-auto"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <style jsx>{`
                .handy-strip::-webkit-scrollbar {
                  display: none;
                }
              `}</style>

              <div className="flex gap-6 py-1 pr-6">
                {TEAM.map((m, i) => (
                  <button
                    key={m.id}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={[
                      "relative shrink-0 w-[150px] h-[190px] rounded-[14px] overflow-hidden border-2 transition-all duration-200",
                      i === idx
                        ? "border-white shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
                        : "border-white/0 hover:border-white/40",
                    ].join(" ")}
                    aria-label={`Show ${m.name}`}
                  >
                    <Image
                      src={m.thumb}
                      alt={m.name}
                      fill
                      className="object-cover object-top"
                      sizes="150px"
                    />
                    {/* subtle overlay so the border reads consistently */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25 pointer-events-none" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================= MOBILE THUMBNAILS ================= */}
        <div className="lg:hidden mt-6 sm:mt-8 overflow-hidden">
          <div
            className="handy-strip flex gap-4 sm:gap-6 overflow-x-auto pb-4"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <style jsx>{`
              .handy-strip::-webkit-scrollbar {
                display: none;
              }
            `}</style>

            {TEAM.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setIdx(i)}
                className={[
                  "relative shrink-0 w-[140px] sm:w-[160px] h-[180px] sm:h-[210px] rounded-[14px] overflow-hidden border-2 transition-all duration-200",
                  i === idx ? "border-white" : "border-white/0",
                ].join(" ")}
                aria-label={`Show ${m.name}`}
              >
                <Image
                  src={m.thumb}
                  alt={m.name}
                  fill
                  className="object-cover object-top"
                  sizes="160px"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25 pointer-events-none" />
              </button>
            ))}
          </div>
        </div>

        {/* ================= BIO SECTION ================= */}
        <div className="pt-5">
          {/* IMPORTANT: use 12 columns (Tailwind default), NOT 13 */}
          <div className="mt-6 sm:mt-8 lg:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Big photo + DESKTOP arrows under photo */}
            <div className="lg:col-span-7">
              <div className="relative w-full rounded-[14px] overflow-hidden max-w-[520px] mx-auto bg-[#242526]">
                <div className="relative w-full aspect-[2/3]">
                  <Image
                    src={person.photo}
                    alt={person.name}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 520px"
                    priority
                  />
                </div>
              </div>

              {/* DESKTOP ONLY: arrows aligned with the photo */}
              <div className="hidden lg:flex max-w-[520px] mx-auto items-center justify-between mt-4">
                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    type="button"
                    className="w-[44px] h-[44px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors shadow-md active:scale-[0.99]"
                    aria-label="Previous"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 18L9 12L15 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={next}
                    type="button"
                    className="w-[44px] h-[44px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors shadow-md active:scale-[0.99]"
                    aria-label="Next"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 6L15 12L9 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="text-right">
                  <div className="text-sm text-[#eef2ff]">The Profixter Team:</div>
                  <div className="text-sm text-[#c5cbd8]">
                    We fix homes but mostly, we bring comfort
                  </div>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="lg:col-span-5 flex flex-col lg:pl-6">
              <h3 className="text-xl sm:text-2xl lg:text-[24px] font-semibold text-[#eef2ff] leading-tight">
                {person.name}
              </h3>

              <p className="mt-4 text-base sm:text-lg lg:text-[20px] leading-relaxed text-[#c5cbd8] max-w-[420px]">
                {person.blurb}
              </p>

              <div className="flex-1 min-h-[16px]" />

              {/* Mobile arrows + quote */}
              <div className="lg:hidden flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mt-6">
                <div className="flex gap-3">
                  <button
                    onClick={prev}
                    type="button"
                    className="w-[40px] h-[40px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors active:scale-[0.99]"
                    aria-label="Previous"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M15 18L9 12L15 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={next}
                    type="button"
                    className="w-[40px] h-[40px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors active:scale-[0.99]"
                    aria-label="Next"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 6L15 12L9 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="sm:text-right md:max-w-[240px]">
                  <div className="text-sm sm:text-base text-[#eef2ff]">
                    The Profixter Team:
                  </div>
                  <div className="text-sm sm:text-[14px] text-[#c5cbd8]">
                    We fix homes but mostly, we bring comfort
                  </div>
                </div>
              </div>

              {/* Optional index indicator (tiny, helps UX) */}
              <div className="mt-6 text-xs text-[#c5cbd8]/70">
                {idx + 1} / {TEAM.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
