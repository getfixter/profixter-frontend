"use client";

import { useEffect } from "react";
import { trackReviewOpen } from "@/lib/meta";
import { GOOGLE_WRITE_REVIEW_URL, type ReviewVia } from "@/lib/google-review";

const VIAS: ReviewVia[] = ["email", "account", "home"];

/**
 * Counts the open (anonymously, by day and by where the link was) and goes
 * straight on to Google's review form. The count never waits on the network:
 * it is sent with keepalive and the page leaves at once. Links without ?via=
 * - every review email sent before 2026-11-03 - work exactly the same and are
 * counted as "other".
 */
export default function ReviewRedirect() {
  useEffect(() => {
    let via: ReviewVia = "other";
    try {
      const asked = new URLSearchParams(window.location.search).get("via") as ReviewVia | null;
      if (asked && VIAS.includes(asked)) via = asked;
    } catch {
      /* counted as "other" */
    }
    trackReviewOpen(via);
    window.location.replace(GOOGLE_WRITE_REVIEW_URL);
  }, []);

  return (
    <main className="ui-container flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16 text-center" data-review-redirect>
      <p className="text-[16px] font-semibold text-[color:var(--ui-ink)]">Opening Google reviews…</p>
      <a href={GOOGLE_WRITE_REVIEW_URL} className="ui-link">
        Continue to Google
      </a>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${GOOGLE_WRITE_REVIEW_URL}`} />
      </noscript>
    </main>
  );
}
