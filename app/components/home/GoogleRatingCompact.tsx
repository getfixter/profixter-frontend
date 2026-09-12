"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Somebody else vouching for us, in the smallest space that still persuades.
 *
 * This belongs to the trust band - "A local company, not a marketplace" -
 * alongside the licence number and the service area. Those are things we assert
 * about ourselves; this is the one line on the homepage that is not us talking.
 *
 * Deliberately not the review slider. That component is a 560px card with
 * backdrop blur built for a dark hero, and dropping it here would be the second
 * large homepage band this redesign just finished removing. A rating, a count, a
 * link and one real sentence is enough: the number is the proof and the quote is
 * the texture.
 *
 * FAILS CLOSED. If Google gives us nothing - key revoked, billing lapsed,
 * network down - this renders nothing at all. There is no default rating
 * anywhere in here, because a five-star badge with no reviews behind it is a
 * fabricated claim on the one part of the page whose job is credibility.
 */

interface ApiReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description?: string;
}

interface ApiPayload {
  ok: boolean;
  placeName?: string;
  rating?: number;
  total?: number;
  googleUrl?: string;
  reviews?: ApiReview[];
}

/** Filled to the rounded rating, hollow after it. */
function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          className="h-[15px] w-[15px]"
          viewBox="0 0 20 20"
          fill={i < filled ? "#F5A623" : "none"}
          stroke={i < filled ? "#F5A623" : "#D2D2D7"}
          strokeWidth="1.4"
        >
          <path d="M10 1.6l2.47 5.2 5.53.77-4 4.03.95 5.8L10 14.7l-4.95 2.7.95-5.8-4-4.03 5.53-.77L10 1.6z" />
        </svg>
      ))}
    </span>
  );
}

export default function GoogleRatingCompact({ className = "" }: { className?: string }) {
  const [data, setData] = useState<ApiPayload | null>(null);

  useEffect(() => {
    let alive = true;
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${base}/api/google/reviews`)
      .then((r) => r.json())
      .then((json: ApiPayload) => {
        if (alive) setData(json);
      })
      .catch(() => {
        /* Silence is the correct failure. Nothing renders. */
        if (alive) setData({ ok: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  const reviews = (data?.ok && data.reviews) || [];
  const rating = Number(data?.rating || 0);
  const total = Number(data?.total || 0);

  /* No real rating, no badge. */
  if (!data?.ok || !reviews.length || !(rating > 0) || !(total > 0)) return null;

  /* The most recent review Google gave us, not the most flattering one. */
  const quote = reviews[0];
  const googleUrl = data.googleUrl || "";

  return (
    <div className={`rounded-[8px] border border-[#E5E5EA] bg-white p-5 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Image
          src="/images/icons/icon-google.svg"
          alt=""
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
        />
        <span className="text-[19px] font-semibold tabular-nums tracking-[-0.02em] text-[#111111]">
          {rating.toFixed(1)}
        </span>
        <Stars rating={rating} />
        {googleUrl ? (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] font-medium text-[#6E6E73] underline-offset-4 transition-colors hover:text-[#306EEC] hover:underline"
          >
            {total} Google reviews
          </a>
        ) : (
          <span className="text-[14px] font-medium text-[#6E6E73]">{total} Google reviews</span>
        )}
      </div>

      <blockquote className="mt-3 text-[14.5px] leading-[1.5] text-[#6E6E73]">
        &ldquo;{quote.text.length > 150 ? `${quote.text.slice(0, 150).trimEnd()}…` : quote.text}&rdquo;
      </blockquote>
      <p className="mt-2 text-[13px] text-[#A1A1A6]">
        {quote.author_name}
        {quote.relative_time_description ? ` · ${quote.relative_time_description}` : ""}
      </p>
    </div>
  );
}
