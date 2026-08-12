"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RECOMMENDED_BUSINESSES,
  RECOMMENDED_MAGIC_WORD,
  type RecommendedBusiness,
} from "@/app/data/recommendedBusinesses";

function CallButton({ tel }: { tel: string }) {
  return (
    <a
      href={`tel:${tel}`}
      className="shrink-0 h-[40px] px-4 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors text-white text-[13px] font-semibold inline-flex items-center justify-center"
    >
      Call
    </a>
  );
}

function BusinessCard({ b }: { b: RecommendedBusiness }) {
  return (
    <div className="rounded-[13px] border border-[#E6E8EF] bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Image */}
      <div className="relative w-full h-[190px] bg-[#F6F7FB]">
        <Image
          src={b.photoSrc}
          alt={`${b.name} - ${b.category}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 380px"
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {/* TOP: TRADE */}
        <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-semibold">
          {b.category}
        </div>

        {/* LICENSED + VERIFIED */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECFDF3] border border-[#ABEFC6] text-[#067647] text-[11px] font-semibold">
            Licensed & Insured
          </div>
          <div className="text-[11px] font-semibold text-[#6A6D71]">
            Verified by <span className="text-[#313234]">Profixter</span>
          </div>
        </div>

        {/* NAME */}
        <div className="mt-2 text-[18px] font-bold text-[#313234]">{b.name}</div>

        {/* Call button */}
        <div className="mt-3 flex justify-end">
          <CallButton tel={b.phoneTel} />
        </div>

        {/* Description */}
        <div className="mt-3 text-[14px] text-[#6A6D71] leading-relaxed">
          {b.description}
        </div>

        {/* Discount box */}
        <div className="mt-4 rounded-[14px] border border-[#E6E8EF] bg-[#F6F7FB] p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#6A6D71] font-semibold">
            For discount say
          </div>
          <div className="mt-1 text-[16px] font-extrabold text-[#313234]">
            “{RECOMMENDED_MAGIC_WORD}”
          </div>
        </div>

        {/* Phone line */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[13px] text-[#6A6D71]">
            Phone:{" "}
            <a
              href={`tel:${b.phoneTel}`}
              className="font-semibold text-[#313234] hover:underline"
            >
              {b.phoneDisplay}
            </a>
          </div>

          <a
            href={`tel:${b.phoneTel}`}
            className="text-[13px] font-semibold text-[#306EEC] hover:underline"
          >
            Tap to call
          </a>
        </div>
      </div>
    </div>
  );
}

function ArrowButton({
  dir,
  onClick,
  disabled,
}: {
  dir: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = dir === "left" ? "Previous" : "Next";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "hidden md:inline-flex items-center justify-center",
        "w-[46px] h-[46px] rounded-full border",
        "bg-white/95 backdrop-blur",
        "border-[#E6E8EF]",
        "shadow-[0_6px_20px_rgba(17,24,39,0.12)]",
        "transition-all duration-200",
        "hover:shadow-[0_10px_30px_rgba(48,110,236,0.25)] hover:border-[#B2DDFF]",
        "hover:ring-4 hover:ring-[#306EEC]/10",
        disabled
          ? "opacity-40 cursor-not-allowed hover:shadow-[0_6px_20px_rgba(17,24,39,0.12)] hover:ring-0 hover:border-[#E6E8EF]"
          : "opacity-100",
      ].join(" ")}
    >
      <span className="text-[18px] leading-none text-[#313234]">
        {dir === "left" ? "‹" : "›"}
      </span>
    </button>
  );
}

function Dot({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        "h-[8px] rounded-full transition-all duration-200",
        active ? "w-[26px] bg-[#306EEC]" : "w-[8px] bg-[#D5DBE7] hover:bg-[#B2DDFF]",
      ].join(" ")}
    />
  );
}

export default function RecommendedBusinessesSection() {
  const items = useMemo(() => RECOMMENDED_BUSINESSES, []);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateArrowsAndDots() {
    const el = scrollerRef.current;
    if (!el) return;

    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;

    setCanLeft(left > 5);
    setCanRight(left < maxScrollLeft - 5);

    // determine active slide by nearest card (center-based)
    const children = Array.from(el.children) as HTMLDivElement[];
    if (!children.length) return;

    const viewportCenter = el.scrollLeft + el.clientWidth / 2;

    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;

    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCenter - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });

    setActiveIndex(bestIdx);
  }

  function scrollByPage(direction: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;

    const amount = Math.max(280, Math.floor(el.clientWidth * 0.9));
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  function scrollToIndex(i: number) {
  const el = scrollerRef.current;
  if (!el) return;
  const child = el.children.item(i) as HTMLElement | null;
  if (!child) return;

  const left = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;

  el.scrollTo({
    left: Math.max(0, left),
    behavior: "smooth",
  });
}

  useEffect(() => {
    updateArrowsAndDots();
    const onResize = () => updateArrowsAndDots();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <section
  id="recommended-pros"
  className="bg-white scroll-mt-[140px] lg:scroll-mt-[180px]"
>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-8 sm:py-11">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-semibold">
              Profixter Trusted Pro Network
            </div>

            <h2 className="mt-2 text-[23px] sm:text-[30px] font-extrabold text-[#313234] leading-[110%]">
              Licensed specialists we trust
            </h2>

            <p className="mt-3 max-w-[980px] text-[14px] sm:text-[15px] text-[#6A6D71] leading-[150%]">
              When a job needs a licensed specialist or bigger scope, we connect you with trusted local pros.
              Tap any phone number to call.
              <span className="text-[#313234] font-semibold">
                {" "}
                For discount say “{RECOMMENDED_MAGIC_WORD}”.
              </span>
            </p>

            <div className="mt-3 text-[13px] text-[#6A6D71]">
              We only list licensed & insured professionals we trust - and we remove anyone who doesn’t deliver.
            </div>
          </div>

          {/* RIGHT SIDE CONTROLS */}
          <div className="flex items-center gap-3">
            {/* Desktop arrows */}
            <div className="hidden md:flex items-center gap-2">
              <ArrowButton
                dir="left"
                onClick={() => scrollByPage("left")}
                disabled={!canLeft}
              />
              <ArrowButton
                dir="right"
                onClick={() => scrollByPage("right")}
                disabled={!canRight}
              />
            </div>

            <a
              href="tel:631-599-1363"
              className="h-[46px] px-5 rounded-[14px] bg-[#EEF2FF] border border-[#C5CBD8] hover:bg-[#E6ECFF] transition-colors text-[#306EEC] text-[14px] font-semibold inline-flex items-center justify-center"
            >
              Not sure who to hire? Ask Profixter
            </a>
          </div>
        </div>

        {/* Slider */}
        <div className="mt-8">
          <div className="relative">
            {/* Fade edges (subtle) */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-[8px] sm:w-[18px] bg-gradient-to-r from-white/90 to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[8px] sm:w-[18px] bg-gradient-to-l from-white/90 to-transparent z-10" />

            <div
              ref={scrollerRef}
              onScroll={updateArrowsAndDots}
              className={[
                "flex gap-4 overflow-x-auto pb-3",
                "scroll-smooth",
                "snap-x snap-mandatory",
                "[-ms-overflow-style:none] [scrollbar-width:none]",
                "[&::-webkit-scrollbar]:hidden",
              ].join(" ")}
            >
              {items.map((b) => (
                <div
                  key={`${b.category}-${b.name}`}
                  className={[
                    "snap-start",
                    "w-[86%] sm:w-[60%] md:w-[420px]",
                    "shrink-0",
                  ].join(" ")}
                >
                  <BusinessCard b={b} />
                </div>
              ))}
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {items.map((b, i) => (
              <Dot
                key={`${b.category}-${b.name}-dot`}
                active={i === activeIndex}
                onClick={() => scrollToIndex(i)}
                label={`Go to ${b.name}`}
              />
            ))}
          </div>

          {/* Small hint on mobile */}
          <div className="mt-2 md:hidden text-[12px] text-[#6A6D71] text-center">
            Swipe left/right to see more →
          </div>
        </div>

        <div className="mt-8 rounded-[13px] border border-[#E6E8EF] bg-[#F6F7FB] p-6">
          <div className="text-[14px] text-[#313234] font-semibold">
            Independent Professionals
          </div>
          <div className="mt-1 text-[14px] text-[#6A6D71] leading-relaxed">
            These businesses operate independently from Profixter. Pricing and discounts are determined by each provider.
          </div>
        </div>
      </div>
    </section>
  );
}
