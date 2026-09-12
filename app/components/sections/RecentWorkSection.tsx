"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PhotoLightbox from "@/app/components/ui/PhotoLightbox";
import {
  fetchRecentWork,
  fetchRecentWorkCategories,
  type PublicWorkCategory,
  type PublicWorkPhoto,
} from "@/lib/public-recent-work";

/**
 * Our work, for people deciding whether to let us into their house.
 *
 * IT DISAPPEARS WHEN THERE IS NOTHING TO SHOW. A marketing page proving we do
 * good work, showing an empty frame and the words "no photos yet", argues
 * against itself. Until something is published this section renders nothing at
 * all - no heading, no skeleton, no gap.
 *
 * Fixed-ratio tiles rather than a masonry wall. Photos arrive portrait,
 * landscape and square from a dozen phones, and a layout that honours every
 * one of them is a layout that jumps while it loads. A 4:3 tile with the image
 * covering it keeps the grid still, crops predictably, and gives the lightbox
 * something to be for.
 *
 * The grid holds thumbnails - 480px, about 40KB. Nobody downloads a large
 * image until they ask for one by opening it.
 */

const PAGE_SIZE = 12;

interface RecentWorkSectionProps {
  /** A compact teaser (homepage) or the full browsable gallery (its own page). */
  variant?: "preview" | "full";
  limit?: number;
  heading?: string;
  subheading?: string;
}

export default function RecentWorkSection({
  variant = "full",
  limit,
  heading = "Recent work",
  subheading = "Real jobs, finished by the same team that would come to you.",
}: RecentWorkSectionProps) {
  const isPreview = variant === "preview";
  /*
   * Six on the homepage, not eight.
   *
   * Six divides evenly into two columns on a phone, three on a tablet and
   * three on a desktop, so the teaser is always a filled rectangle rather than
   * a row with two orphans on the end. It is also the point where a homepage
   * band still reads as a sample worth following rather than a gallery the
   * visitor has already finished looking at.
   */
  const PREVIEW_SIZE = 6;
  const pageSize = limit ?? (isPreview ? PREVIEW_SIZE : PAGE_SIZE);
  /*
   * On a phone the grid is two wide, so an odd number of photos leaves the
   * last one sitting beside a hole. With a single published photo that hole is
   * half the width of the screen, which reads as a layout that broke rather
   * than a gallery with one picture in it. Letting a trailing odd tile span
   * both columns turns every small count back into a filled rectangle; from
   * the three-column breakpoint up there is enough furniture around it that a
   * short last row looks normal, so the span is dropped.
   */
  const fillTrailingOrphan =
    "[&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1";
  const gridColumns = isPreview
    ? `grid-cols-2 sm:grid-cols-3 ${fillTrailingOrphan}`
    : `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${fillTrailingOrphan}`;

  const [photos, setPhotos] = useState<PublicWorkPhoto[]>([]);
  const [categories, setCategories] = useState<PublicWorkCategory[]>([]);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const requestRef = useRef(0);

  const load = useCallback(
    async (nextPage: number, nextCategory: string, append: boolean) => {
      const ticket = ++requestRef.current;
      if (append) setLoadingMore(true);
      else setStatus("loading");

      try {
        const data = await fetchRecentWork({
          page: nextPage,
          limit: pageSize,
          category: nextCategory || undefined,
        });
        if (ticket !== requestRef.current) return;
        setPhotos((current) => (append ? [...current, ...data.photos] : data.photos));
        setHasMore(isPreview ? false : data.hasMore);
        setTotal(data.total);
        setPage(data.page);
        setStatus("ready");
      } catch {
        if (ticket !== requestRef.current) return;
        setStatus("error");
      } finally {
        if (ticket === requestRef.current) setLoadingMore(false);
      }
    },
    [pageSize, isPreview]
  );

  useEffect(() => {
    load(1, category, false);
  }, [load, category]);

  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    fetchRecentWorkCategories(controller.signal)
      .then(setCategories)
      .catch(() => setCategories([]));
    return () => controller.abort();
  }, [isPreview]);

  const lightboxItems = useMemo(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        url: photo.imageUrl,
        title: photo.title || "",
        subtitle: [photo.location, photo.caption].filter(Boolean).join(" · "),
      })),
    [photos]
  );

  /*
   * Nothing published and nothing loading: render nothing. The alternative is
   * an empty gallery on a page whose job is to be convincing.
   */
  if (status === "ready" && photos.length === 0 && !category) return null;
  if (status === "error" && photos.length === 0) return null;

  return (
    <section
      className="relative w-full overflow-hidden py-12 sm:py-16"
      style={{ background: "linear-gradient(180deg, #080F1E 0%, #060C18 100%)" }}
      aria-labelledby="recent-work-heading"
    >
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.18), transparent)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mb-7 text-center sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.04] px-4 py-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
              Our work
            </span>
          </div>
          <h2
            id="recent-work-heading"
            className="mb-3 text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[36px]"
          >
            {heading}
          </h2>
          <p className="mx-auto max-w-[600px] text-[15px] leading-relaxed text-white/48 sm:text-[17px]">
            {subheading}
          </p>
        </div>

        {/* Category filter, only where there is room to browse and more than one kind. */}
        {!isPreview && categories.length > 1 && (
          /*
            * One scrolling row on a phone, centred and wrapped once there is
            * room. Seven categories stacked four rows deep pushed every
            * photograph below the fold, which on a page whose entire job is
            * showing photographs is the wrong trade.
            */
          <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
            <FilterChip active={!category} onClick={() => setCategory("")}>
              All work
              <span className="ml-1.5 tabular-nums opacity-50">{total}</span>
            </FilterChip>
            {categories.map((option) => (
              <FilterChip
                key={option.slug}
                active={category === option.slug}
                onClick={() => setCategory(option.slug)}
              >
                {option.label}
                <span className="ml-1.5 tabular-nums opacity-50">{option.count}</span>
              </FilterChip>
            ))}
          </div>
        )}

        {status === "loading" ? (
          <div className={`grid gap-3 ${gridColumns}`}>
            {Array.from({ length: pageSize > 8 ? 8 : pageSize }).map((_, index) => (
              <div
                key={index}
                className="aspect-[4/3] animate-pulse rounded-xl bg-white/[0.05]"
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-white/40">
            Nothing in this category yet.
          </p>
        ) : (
          <div className={`grid gap-3 ${gridColumns}`}>
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04] transition duration-300 hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC]"
                aria-label={photo.title ? `View ${photo.title}` : "View photo"}
              >
                {broken.has(photo.id) ? (
                  <span className="absolute inset-0 flex items-center justify-center text-white/20">
                    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 17 5-5 4 4 3-3 6 6" />
                    </svg>
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo.thumbUrl}
                    alt={photo.title || photo.caption || "Completed work by Profixter"}
                    /* The first row is what a visitor sees immediately; the rest can wait. */
                    loading={index < 4 ? "eager" : "lazy"}
                    decoding="async"
                    width={480}
                    height={360}
                    onError={() =>
                      setBroken((current) => new Set(current).add(photo.id))
                    }
                    style={{ height: "100%", width: "100%" }}
                    className="absolute inset-0 object-cover transition duration-500 group-hover:scale-[1.05]"
                  />
                )}

                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
                />
                {(photo.title || photo.location) && (
                  <span className="absolute inset-x-0 bottom-0 translate-y-1 p-2.5 text-left opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    {photo.title && (
                      <span className="block truncate text-[13px] font-semibold text-white">
                        {photo.title}
                      </span>
                    )}
                    {photo.location && (
                      <span className="block truncate text-[11px] text-white/60">
                        {photo.location}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/*
          * The teaser's whole job is to be left. Without this the homepage band
          * is a dead end, and /recent-work stays a URL you have to know.
          */}
        {isPreview && photos.length > 0 && (
          <div className="mt-7 text-center sm:mt-8">
            <Link
              href="/recent-work"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] bg-white px-7 text-[15px] font-semibold text-[#0B1628] transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#060C18]"
            >
              See all our work
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        )}

        {hasMore && (
          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={() => load(page + 1, category, true)}
              disabled={loadingMore}
              className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] border border-white/15 bg-white/[0.06] px-6 text-[14px] font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Show more work"}
            </button>
          </div>
        )}
      </div>

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <PhotoLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[38px] flex-shrink-0 items-center whitespace-nowrap rounded-[8px] border px-3.5 text-[13px] font-semibold transition ${
        active
          ? "border-[#306EEC]/40 bg-[#306EEC]/20 text-white"
          : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:text-white/90"
      }`}
    >
      {children}
    </button>
  );
}
