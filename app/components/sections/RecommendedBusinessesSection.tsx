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
    <div className="rounded-[18px] border border-[#E6E8EF] bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
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

        {/* LICENSED BADGE */}
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECFDF3] border border-[#ABEFC6] text-[#067647] text-[11px] font-semibold">
          Licensed & Insured
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
        "w-[44px] h-[44px] rounded-full border shadow-sm",
        "bg-white hover:bg-[#F6F7FB] transition-colors",
        "border-[#E6E8EF]",
        disabled ? "opacity-40 cursor-not-allowed" : "opacity-100",
      ].join(" ")}
    >
      <span className="text-[18px] leading-none text-[#313234]">
        {dir === "left" ? "‹" : "›"}
      </span>
    </button>
  );
}

export default function RecommendedBusinessesSection() {
  const items = useMemo(() => RECOMMENDED_BUSINESSES, []);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;

    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;

    setCanLeft(left > 5);
    setCanRight(left < maxScrollLeft - 5);
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

  useEffect(() => {
    updateArrows();
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <section className="bg-white">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-semibold">
              Trusted Local Network
            </div>

            <h2 className="mt-2 text-[26px] sm:text-[34px] font-extrabold text-[#313234] leading-[110%]">
              Professionals We Recommend
            </h2>

            <p className="mt-3 max-w-[920px] text-[14px] sm:text-[15px] text-[#6A6D71] leading-[150%]">
              Swipe through trusted local pros. Tap any phone number to call.
              <span className="text-[#313234] font-semibold">
                {" "}
                For discount say “{RECOMMENDED_MAGIC_WORD}”.
              </span>
            </p>
          </div>

          <a
            href="tel:631-599-1363"
            className="h-[46px] px-5 rounded-[14px] bg-[#EEF2FF] border border-[#C5CBD8] hover:bg-[#E6ECFF] transition-colors text-[#306EEC] text-[14px] font-semibold inline-flex items-center justify-center"
          >
            Need guidance? Call us
          </a>
        </div>

        {/* Slider */}
        <div className="mt-8 relative">
          {/* Desktop arrows */}
          <div className="absolute -top-[54px] right-0 hidden md:flex items-center gap-2">
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

          <div
            ref={scrollerRef}
            onScroll={updateArrows}
            className={[
              "flex gap-4 overflow-x-auto pb-2",
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

          {/* Small hint on mobile */}
          <div className="mt-2 md:hidden text-[12px] text-[#6A6D71]">
            Swipe left/right to see more →
          </div>
        </div>

        <div className="mt-8 rounded-[18px] border border-[#E6E8EF] bg-[#F6F7FB] p-6">
          <div className="text-[14px] text-[#313234] font-semibold">
            Independent Professionals
          </div>
          <div className="mt-1 text-[14px] text-[#6A6D71] leading-relaxed">
            These businesses operate independently from Mr. Fixter. Pricing and
            discounts are determined by each provider.
          </div>
        </div>
      </div>
    </section>
  );
}