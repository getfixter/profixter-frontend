"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GalleryCategory, GalleryPhoto } from "@/app/data/kitchen-bath-gallery";

type Filter = "all" | GalleryCategory;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All work" },
  { id: "kitchens", label: "Kitchens" },
  { id: "bathrooms", label: "Bathrooms" },
  { id: "showers", label: "Showers" },
  { id: "details", label: "Tile & details" },
];

/**
 * Grid geometry.
 *
 * Rows are a fixed height per breakpoint and every tile stretches to fill the
 * area it is given, so a photograph's own proportions never decide the layout.
 * That is what keeps the grid aligned, and it is also why there is no layout
 * shift: the box exists at its final size before the image arrives.
 */
const SPAN_CLASS: Record<GalleryPhoto["span"], string> = {
  feature: "col-span-2 row-span-2",
  wide: "col-span-2 row-span-1",
  tall: "col-span-1 row-span-2",
  standard: "col-span-1 row-span-1",
};

/** Two columns of the grid, or one. Nothing else changes the request size. */
const SIZES_WIDE = "(min-width: 1024px) 50vw, (min-width: 768px) 67vw, 100vw";
const SIZES_NARROW = "(min-width: 1024px) 25vw, (min-width: 768px) 34vw, 50vw";

export default function WorkGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? photos : photos.filter((photo) => photo.category === filter)),
    [photos, filter]
  );

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([["all", photos.length]]);
    for (const photo of photos) {
      map.set(photo.category, (map.get(photo.category) || 0) + 1);
    }
    return map;
  }, [photos]);

  // The lightbox indexes into the filtered list, so changing filter while it
  // is open would point it at a different photograph. Close it instead.
  const changeFilter = (next: Filter) => {
    setOpenIndex(null);
    setFilter(next);
  };

  return (
    <>
      <div
        className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 md:mb-10 [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter work by room"
      >
        {FILTERS.map((item) => {
          const active = filter === item.id;
          const count = counts.get(item.id) || 0;
          if (!count) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => changeFilter(item.id)}
              aria-pressed={active}
              className={[
                "inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-5 text-[13px] font-bold transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC] focus-visible:ring-offset-2",
                active
                  ? "border-[#0C1117] bg-[#0C1117] text-white"
                  : "border-[#DEDAD2] bg-transparent text-[#4A5058] hover:border-[#0C1117] hover:text-[#0C1117]",
              ].join(" ")}
            >
              {item.label}
              <span className={active ? "ml-2 text-white/55" : "ml-2 text-[#9A958B]"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div
        className={[
          "grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-3",
          "[grid-auto-flow:dense]",
          "[grid-auto-rows:150px] min-[420px]:[grid-auto-rows:180px] sm:[grid-auto-rows:220px] lg:[grid-auto-rows:250px] xl:[grid-auto-rows:280px]",
        ].join(" ")}
      >
        {visible.map((photo, index) => {
          const large = photo.span === "feature" || photo.span === "wide";
          return (
            <button
              key={photo.slug}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Open larger view: ${photo.alt}`}
              className={[
                SPAN_CLASS[photo.span],
                "group relative overflow-hidden rounded-[10px] bg-[#EDEAE4]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC] focus-visible:ring-offset-2",
              ].join(" ")}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={large ? SIZES_WIDE : SIZES_NARROW}
                placeholder="blur"
                blurDataURL={photo.blurDataURL}
                className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,0.84,0.44,1)] group-hover:scale-[1.045] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              {/* Reads as a lift on hover rather than a caption card. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[#0C1117]/0 transition-colors duration-500 group-hover:bg-[#0C1117]/12 motion-reduce:transition-none"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-white/92 text-[#0C1117] opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      {openIndex !== null ? (
        <Lightbox
          photos={visible}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

function Lightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (delta: number) => {
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    restoreFocusTo.current = document.activeElement;
    closeRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
      // Send focus back where it came from, so keyboard users land on the tile
      // they opened instead of at the top of the document.
      (restoreFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
        return;
      }
      // Keep Tab inside the dialog: three controls, so cycling them by hand is
      // cheaper and steadier than a generic focus trap.
      if (event.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focusable || focusable.length === 0) return;
        const list = Array.from(focusable);
        const current = list.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey
          ? (current <= 0 ? list.length : current) - 1
          : (current + 1) % list.length;
        event.preventDefault();
        list[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Horizontal intent only, so a vertical flick to dismiss the keyboard or
    // scroll never counts as "next photo".
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Project photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-[100] flex flex-col bg-[#080C11]/97 backdrop-blur-sm"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] sm:px-6">
        <span className="text-[12px] font-bold tracking-[0.16em] text-white/45">
          {String(index + 1).padStart(2, "0")}
          <span className="mx-1.5 text-white/25">/</span>
          {String(photos.length).padStart(2, "0")}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-4 sm:px-16">
        <Image
          // Keying on the slug restarts the fade for each photograph rather
          // than cross-dissolving into a half-decoded one.
          key={photo.slug}
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          sizes="(min-width: 1024px) 80vw, 100vw"
          placeholder="blur"
          blurDataURL={photo.blurDataURL}
          className="animate-fadeIn max-h-full w-auto max-w-full rounded-[8px] object-contain motion-reduce:animate-none"
        />

        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous photo"
          className="absolute left-1 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next photo"
          className="absolute right-1 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p className="mx-auto max-w-[680px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-2 text-center text-[13px] leading-relaxed text-white/55">
        {photo.alt}
        <span className="mt-1.5 block text-[11px] text-white/30 sm:hidden">Swipe to browse</span>
      </p>
    </div>
  );
}
