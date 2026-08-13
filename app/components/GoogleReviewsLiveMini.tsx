"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function seededHash(seed: string) {
  // simple deterministic hash
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seed: string) {
  const a = [...arr];
  let s = seededHash(seed) || 1;

  // Fisher-Yates with seeded pseudo-random
  for (let i = a.length - 1; i > 0; i--) {
    // xorshift
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s >>>= 0;
    s ^= s << 5;
    s >>>= 0;

    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Stars({ rating = 5 }: { rating?: number }) {
  const r = clamp(Math.round(rating), 0, 5);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={[
            "text-[15px] leading-none",
            i < r ? "text-yellow-300" : "text-white/30",
          ].join(" ")}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 19L8 12L15 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 5L16 12L9 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GoogleReviewsLiveMini() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const timeoutRef = useRef<number | null>(null);
  const touchX = useRef<number | null>(null);

  const DELAY_MS = 15000; // ✅ 15 seconds per review
  const REFRESH_MS = 24 * 60 * 60 * 1000; // ✅ refresh live reviews every 24 hours

  // ✅ Stable random seed for THIS page session (so order doesn't change while sliding)
  const sessionSeedRef = useRef<string>("");
  const fetchNonceRef = useRef<number>(0); // changes when we refetch to reshuffle

  useEffect(() => {
    if (!sessionSeedRef.current) {
      sessionSeedRef.current = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }, []);

  const clearTimer = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const reviews = useMemo(() => {
    const arr = data?.ok ? data.reviews || [] : [];
    const fallback: ApiReview[] = [
      {
        author_name: "Google Reviews",
        rating: 5,
        text: "Trusted local service across Long Island.",
        relative_time_description: "",
      },
    ];

    const base = arr.length ? arr : fallback;

    // ✅ Live list from Google, but shuffled per session + re-fetch nonce
    const seed = `${sessionSeedRef.current}-${fetchNonceRef.current}`;
    const shuffled = seededShuffle(base, seed);

    // ✅ rotate starting point so the first card differs
    const start = base.length > 1 ? seededHash(seed) % base.length : 0;
    return [...shuffled.slice(start), ...shuffled.slice(0, start)];
  }, [data]);

  const safeLen = Math.max(1, reviews.length);

  const rating = data?.ok ? Number(data.rating || 0) : 5;
  const total = data?.ok ? Number(data.total || 0) : 0;
  const googleUrl = data?.ok ? String(data.googleUrl || "") : "";

  const resetTimer = () => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      setIdx((i) => (i + 1) % safeLen);
    }, DELAY_MS);
  };

  const next = () => {
    setIdx((i) => (i + 1) % safeLen);
    resetTimer();
  };
  const prev = () => {
    setIdx((i) => (i - 1 + safeLen) % safeLen);
    resetTimer();
  };

  const goTo = (i: number) => {
    setIdx(clamp(i, 0, safeLen - 1));
    resetTimer();
  };

  // ✅ Fetch now + refresh every 24h (still "live", no DB)
  useEffect(() => {
    let alive = true;

    const fetchReviews = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "";
        // add a cache-buster so CDNs/proxies don't serve stale
        const url = `${base}/api/google/reviews?t=${Date.now()}`;
        const resp = await fetch(url, { cache: "no-store" });
        const json = (await resp.json()) as ApiPayload;

        if (!alive) return;

        setData(json);
        setIdx(0);

        // ✅ reshuffle after each successful refresh
        fetchNonceRef.current += 1;
      } catch {
        if (!alive) return;
        setData({ ok: false, error: "Failed to load reviews" });
        setIdx(0);
      }
    };

    fetchReviews();

    const interval = window.setInterval(fetchReviews, REFRESH_MS);

    return () => {
      alive = false;
      window.clearInterval(interval);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto slide
  useEffect(() => {
    if (paused) return;
    resetTimer();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, safeLen]);

  const current = reviews[idx];

  const ratingLabel =
    rating && Number.isFinite(rating) ? rating.toFixed(1) : String(current?.rating || 5);

  return (
    <div
      className="w-full max-w-[560px] mt-8 sm:mt-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;

        if (start !== null && end !== null) {
          const dx = end - start;
          if (Math.abs(dx) > 40) {
            if (dx < 0) next();
            else prev();
          }
        }
        setPaused(false);
      }}
      aria-label="Google reviews slider"
    >
      <div className="relative rounded-[8px] border border-white/20 bg-white/10 backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10" />

        <div className="relative p-5 sm:p-6">
          {/* Top row */}
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-[6px] border border-white/20 bg-black/20 px-3 py-2">
              <Image
                src="/images/icons/icon-google.svg"
                alt="Google"
                width={16}
                height={16}
                className="w-4 h-4"
              />
              <span className="text-white/90 text-[13px] font-semibold">
                {ratingLabel} on Google
              </span>
              <span className="text-white/70 text-[13px]">{total > 0 ? `(${total})` : ""}</span>
            </div>

            {googleUrl ? (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 text-[13px] font-semibold hover:text-white underline underline-offset-4"
              >
                Read all reviews
              </a>
            ) : (
              <span className="text-white/60 text-[12px]">Swipe or use arrows</span>
            )}
          </div>

          {/* Stars + controls */}
          <div className="mt-3 flex items-center justify-between">
            <Stars rating={rating || current.rating || 5} />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous review"
                className="w-8 h-8 rounded-full border border-white/20 bg-black/20 text-white/85 hover:bg-black/30 transition grid place-items-center"
              >
                <IconChevronLeft />
              </button>

              <button
                type="button"
                onClick={next}
                aria-label="Next review"
                className="w-8 h-8 rounded-full border border-white/20 bg-black/20 text-white/85 hover:bg-black/30 transition grid place-items-center"
              >
                <IconChevronRight />
              </button>
            </div>
          </div>

          {/* Review text (✅ fixed height so Hero never jumps) */}
          <div className="mt-4 min-h-[108px] sm:min-h-[108px] flex items-center">
            <p className="text-white text-[15px] sm:text-[16px] leading-snug line-clamp-4">
              “{current.text}”
            </p>
          </div>

          {/* Author + dots */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-white/80 text-[13px] font-semibold truncate">
              - {current.author_name}
            </div>

            <div className="flex items-center gap-2">
              {reviews.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to review ${i + 1}`}
                  className={[
                    "w-2 h-2 rounded-full transition",
                    i === idx ? "bg-white" : "bg-white/35 hover:bg-white/60",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>

          <div className="mt-2 text-white/55 text-[11px]">
            {current.relative_time_description || " "}
          </div>
        </div>
      </div>
    </div>
  );
}
