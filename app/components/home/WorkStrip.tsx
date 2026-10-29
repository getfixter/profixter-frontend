"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRecentWork, type PublicWorkPhoto } from "@/lib/public-recent-work";

/**
 * Real finished jobs, as a quiet strip: a swipeable row on a phone, four
 * across on a desktop.
 *
 * Only photographs an admin approved for the public gallery (the same feed as
 * /recent-work), never anything from a customer's private booking. It renders
 * nothing at all if the feed is empty or fails, so the homepage never shows a
 * row of grey boxes.
 */
export default function WorkStrip({ limit = 6 }: { limit?: number }) {
  const [photos, setPhotos] = useState<PublicWorkPhoto[] | null>(null);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetchRecentWork({ limit, signal: controller.signal })
      .then((data) => setPhotos(data.photos || []))
      .catch(() => {
        if (!controller.signal.aborted) setPhotos([]);
      });
    return () => controller.abort();
  }, [limit]);

  const visible = (photos || []).filter((p) => !broken.has(p.id)).slice(0, limit);

  if (photos === null) {
    return (
      <div className="hm-work" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="hm-work__item">
            <div className="ui-media hm-work__media" />
          </div>
        ))}
      </div>
    );
  }
  if (visible.length === 0) return null;

  return (
    <ul className="hm-work" aria-label="Recent jobs">
      {visible.map((photo, index) => (
        <li key={photo.id} className="hm-work__item">
          <Link href="/recent-work" className="hm-work__link">
            <div className="ui-media hm-work__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                srcSet={`${photo.thumbUrl} 480w, ${photo.imageUrl} 1280w`}
                sizes="(min-width: 1024px) 280px, 62vw"
                alt={photo.caption || photo.title || "Completed work by Profixter"}
                loading={index < 2 ? "eager" : "lazy"}
                decoding="async"
                width={480}
                height={600}
                onError={() => setBroken((current) => new Set(current).add(photo.id))}
              />
            </div>
            {photo.title ? <span className="hm-work__cap">{photo.title}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
