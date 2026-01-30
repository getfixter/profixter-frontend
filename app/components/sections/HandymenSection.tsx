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

  // Safety (in case TEAM is empty while you load content later)
  if (!TEAM?.length) return null;

  return (
    <section className="relative w-full bg-[#313234] py-12 sm:py-16 lg:py-24">
      {/* ================= TITLE (MOBILE) ================= */}
      <div className="container mx-auto px-[20px] max-w-[1240px]">
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
      </div>

      {/* ================= DESKTOP THUMBNAILS + TITLE ================= */}
      <div className="hidden lg:block mt-6 sm:mt-8 lg:mt-10">
        {/* Desktop Thumbnails Strip (clean + obvious navigation) */}
        <div className="container mx-auto px-[20px] max-w-[1240px]">
          <div className="flex items-center gap-3">
            {/* Left arrow */}
            <button
              type="button"
              onClick={() =>
                stripRef.current?.scrollBy({ left: -320, behavior: "smooth" })
              }
              className="w-[44px] h-[44px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors shrink-0 shadow-md"
              aria-label="Scroll thumbnails left"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Scroll strip */}
            <div
              ref={stripRef}
              className="flex-1 overflow-x-auto"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
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
                    className={`relative shrink-0 w-[150px] h-[190px] rounded-[14px] overflow-hidden border-2 transition-colors ${
  i === idx ? "border-white" : "border-transparent"
}`}

                    aria-label={`Show ${m.name}`}
                  >
                    <Image
  src={m.thumb}
  alt={m.name}
  fill
  className="object-cover object-top"
  sizes="260px"
/>
                    {/* subtle overlay so border reads clean */}
                  </button>
                ))}
              </div>
            </div>

            {/* Right arrow */}
            <button
              type="button"
              onClick={() =>
                stripRef.current?.scrollBy({ left: 320, behavior: "smooth" })
              }
              className="w-[44px] h-[44px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors shrink-0 shadow-md"
              aria-label="Scroll thumbnails right"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
        </div>

        {/* Desktop Title on the right */}
        <div className="container mx-auto px-[20px] max-w-[1240px] -mt-[160px]">
          <div className="flex justify-end">
            <div className="max-w-[502px]">
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
              <div className="text-[64px] font-bold leading-[89%] text-[#306eec] text-right uppercase tracking-[-0.05em] -mt-2">
                HANDYMEN
              </div>
              <p className="text-[14px] text-[#c5cbd8] text-right ml-8">
                Skilled professionals who bring comfort and quality to every home.
                Reliable, friendly, and ready to tackle any task — big or small.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MOBILE THUMBNAILS ================= */}
      <div className="lg:hidden mt-6 sm:mt-8 overflow-hidden">
        <div
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 px-[20px]"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {TEAM.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`relative shrink-0 w-[140px] sm:w-[160px] h-[180px] sm:h-[210px] rounded-[14px] overflow-hidden border-2 ${
  i === idx ? "border-white" : "border-transparent"
}`}

              aria-label={`Show ${m.name}`}
            >
              <Image
  src={m.thumb}
  alt={m.name}
  fill
  className="object-cover object-top"
  sizes="160px"
/>

            </button>
          ))}
        </div>
      </div>

      {/* ================= BIO SECTION ================= */}
      <div className="container mx-auto px-[20px] max-w-[1240px] pt-[20px]">
        <div className="mt-6 sm:mt-8 lg:mt-10 grid grid-cols-1 lg:grid-cols-13 gap-6 lg:gap-8">
          {/* Big photo */}
          <div className="lg:col-span-7">
  <div className="relative w-full rounded-[14px] overflow-hidden max-w-[520px] mx-auto bg-[#242526]">
  <div className="relative w-full aspect-[3/4]">
    <Image
      src={person.photo}
      alt={person.name}
      fill
      className="object-cover object-top"
      sizes="(max-width: 1024px) 100vw, 520px"
      priority
    />
  </div>
</div>

</div>


          {/* Text */}
          <div className="lg:col-span-6 flex flex-col pl-[40px]">
            <h3 className="text-xl sm:text-2xl lg:text-[24px] font-semibold text-[#eef2ff] leading-tight lg:leading-[21px]">
              {person.name}
            </h3>

            <p className="mt-4 text-base sm:text-lg lg:text-[20px] leading-relaxed lg:leading-[24px] text-[#c5cbd8] max-w-[320px]">
              {person.blurb}
            </p>

            {/* Spacer */}
            <div className="flex-1 min-h-[20px]" />

            {/* Bottom section with arrows on left and quote on right */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 sm:gap-0 mt-6">
              {/* Arrows */}
              <div className="flex gap-3">
                <button
                  onClick={prev}
                  type="button"
                  className="w-[40px] h-[40px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors"
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
                  className="w-[40px] h-[40px] rounded-[12px] bg-[#eef2ff] text-[#313234] grid place-items-center hover:bg-white transition-colors"
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

              {/* Quote */}
              <div className="sm:text-right md:max-w-[200px]">
                <div className="text-sm sm:text-base text-[#eef2ff]">
                  The Profixter Team:
                </div>
                <div className="text-sm sm:text-[14px] text-[#c5cbd8]">
                  We fix homes but mostly, we bring comfort
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
