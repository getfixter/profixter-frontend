"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const projects = [
  { id: 1, image: "/images/projects/p1.jpg" },
  { id: 2, image: "/images/projects/p2.jpg" },
  { id: 3, image: "/images/projects/p3.jpg" },
  { id: 4, image: "/images/projects/p4.jpg" },
  { id: 5, image: "/images/projects/p5.jpg" },
  { id: 6, image: "/images/projects/p6.jpg" },
  { id: 7, image: "/images/projects/p7.jpg" },
  { id: 8, image: "/images/projects/p8.jpg" },
  { id: 9, image: "/images/projects/p9.jpg" },
  { id: 10, image: "/images/projects/p10.jpg" },
];

export default function ProjectsSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () =>
    setCurrentSlide((prev) => (prev + 1) % projects.length);
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev - 1 + projects.length) % projects.length);

  // Smooth auto-advance
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((p) => (p + 1) % projects.length);
    }, 6500);
    return () => clearInterval(t);
  }, []);

  // ✅ scroll to BookingSection (#pick-day)
  const goToBooking = () => {
  const el = document.getElementById("pick-day");
  if (!el) return;

  const HEADER_OFFSET = window.innerWidth >= 1024 ? 160 : 120;
  const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

  window.scrollTo({ top: y, behavior: "smooth" });
  history.replaceState(null, "", "#pick-day");
};

  const active = projects[currentSlide];
  const next1 = projects[(currentSlide + 1) % projects.length];
  const next2 = projects[(currentSlide + 2) % projects.length];

  const ArrowBtn = ({
    dir,
    onClick,
  }: {
    dir: "prev" | "next";
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      type="button"
      className="bg-[#EEF2FF] hover:bg-white text-[#313234] w-[52px] h-[52px] rounded-[12px] flex items-center justify-center transition-colors shadow-md active:scale-[0.99]"
      aria-label={dir === "prev" ? "Previous project" : "Next project"}
    >
      {dir === "prev" ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18L9 12L15 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 6L15 12L9 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );

  return (
    <section
  id="projects"
  className="w-full bg-[#313234] py-12 sm:py-16 lg:py-20 overflow-hidden relative scroll-mt-[140px]"
>
      <div className="max-w-[1240px] mx-auto px-5 sm:px-6 lg:px-5">
        {/* ================= MOBILE / TABLET ================= */}
        <div className="lg:hidden">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold leading-[89%] uppercase mb-2 tracking-[-0.05em]">
              <span className="text-[#EEF2FF]">OUR </span>
              <span className="text-[#306EEC]">LATEST</span>
            </h2>
            <h2 className="text-3xl sm:text-4xl font-bold leading-[89%] uppercase mb-4 text-[#EEF2FF] tracking-[-0.05em]">
              PROJECT
            </h2>

            <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed mb-6 max-w-md mx-auto">
              Real examples of house maintenance work we do and more.
            </p>

            <button
              type="button"
              onClick={goToBooking}
              className="w-full sm:w-auto px-8 h-[56px] sm:h-[60px] bg-[#306EEC] hover:bg-[#2558c7] text-[#EEF2FF] rounded-[14px] text-lg sm:text-xl font-semibold transition-colors"
            >
              Fix it today
            </button>
          </div>

          {/* Carousel card */}
          <div className="relative">
            <div className="relative w-full aspect-square max-w-[450px] mx-auto rounded-[20px] overflow-hidden shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
              <Image
                src={active.image}
                alt="Project Image"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 92vw, 450px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25 pointer-events-none" />
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <ArrowBtn dir="prev" onClick={prevSlide} />
              <ArrowBtn dir="next" onClick={nextSlide} />
            </div>

            <div className="flex gap-2 justify-center mt-4">
              {projects.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={[
                    "h-2 rounded-full transition-all duration-300",
                    idx === currentSlide
                      ? "w-8 bg-[#306EEC]"
                      : "w-2 bg-[#C5CBD8] hover:bg-[#306EEC]/50",
                  ].join(" ")}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed text-center mt-8 max-w-md mx-auto">
            Every project we take on is built on trust, skill, and attention to
            detail.
          </p>
        </div>

        {/* ================= DESKTOP ================= */}
        <div className="hidden lg:grid grid-cols-12 gap-10 items-start">
          {/* Left Content */}
          <div className="col-span-4 pt-3">
            <h2 className="text-[64px] font-bold uppercase tracking-[-0.05em] leading-[0.9]">
              <span className="text-[#EEF2FF]">OUR </span>
              <span className="text-[#306EEC]">LATEST</span>
            </h2>
            <h2 className="text-[64px] font-bold uppercase tracking-[-0.05em] leading-[0.9] text-[#EEF2FF] mt-2">
              PROJECT
            </h2>

            <p className="text-[#C5CBD8] text-base leading-[120%] mt-5 max-w-[320px]">
              Real examples of house maintenance work we do and more.
            </p>

            <button
              type="button"
              onClick={goToBooking}
              className="mt-6 w-[362px] h-[60px] bg-[#306EEC] hover:bg-[#2558c7] text-[#EEF2FF] rounded-[14px] text-[20px] font-semibold transition-colors"
            >
              Fix it today
            </button>

            <p className="text-[#C5CBD8] text-[15px] leading-[120%] max-w-[320px] mt-10">
              Every project we take on is built on trust, skill, and attention to
              detail.
            </p>
          </div>

          {/* Right Side */}
          <div className="col-span-8">
            <div className="relative">
              <div className="flex items-start gap-6">
                {/* Main column = image + arrows underneath */}
                <div className="w-[450px] flex-shrink-0">
                  <div className="relative w-[450px] h-[450px] rounded-[20px] overflow-hidden shadow-[0_10px_80px_rgba(0,0,0,0.25)]">
                    <Image
                      src={active.image}
                      alt="Project Image"
                      fill
                      className="object-cover"
                      sizes="450px"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25 pointer-events-none" />
                  </div>

                  {/* ✅ arrows OUTSIDE image (never fights with BEFORE/AFTER text) */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[#C5CBD8] text-sm">
                      {currentSlide + 1} / {projects.length}
                    </div>
                    <div className="flex gap-3">
                      <ArrowBtn dir="prev" onClick={prevSlide} />
                      <ArrowBtn dir="next" onClick={nextSlide} />
                    </div>
                  </div>

                  {/* Dots (desktop) */}
                  <div className="flex gap-2 mt-4">
                    {projects.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={[
                          "h-2 rounded-full transition-all duration-300",
                          idx === currentSlide
                            ? "w-8 bg-[#306EEC]"
                            : "w-2 bg-[#C5CBD8] hover:bg-[#306EEC]/50",
                        ].join(" ")}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Previews */}
                <div className="flex gap-6 pt-2">
                  {[next1, next2].map((p) => (
                    <div
                      key={p.id}
                      className="relative w-[300px] h-[300px] rounded-[12px] overflow-hidden flex-shrink-0"
                    >
                      <Image
                        src={p.image}
                        alt="Project Preview"
                        fill
                        className="object-cover"
                        sizes="300px"
                      />
                      <div className="absolute inset-0 bg-[#313234]/30 backdrop-blur-[3px] pointer-events-none" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
