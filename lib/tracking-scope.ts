/**
 * Pages that never load third-party trackers (owner decision Q-5, 2026-11-12).
 *
 * - /admin: staff tools. The owner's session token sits in localStorage, and
 *   any Google Tag Manager tag (the container includes an agency-managed
 *   one), the Meta Pixel or Clarity (loaded through GTM) running on the page
 *   could read it, and recordings could capture customer data on screen.
 * - /sign/<token>, /pay/<token>, /tip?t=<token>: the URL itself is a
 *   credential. A tracker's page view sends the full URL (GTM page_location,
 *   the pixel's `dl`) to a third party. These pages fire no conversion events
 *   of their own; payments and tips are recorded server-side (the Stripe
 *   webhooks and the server's Meta Conversions API path), which is unchanged.
 *
 * The GTM container and the ad configuration are not touched: these pages
 * simply never load them. Plain module (no "use client"): the root layout
 * inlines TRACKER_GUARD into <head>.
 */
export const TRACKER_FREE_PREFIXES = ["/admin", "/sign", "/pay", "/tip"] as const;

export function isTrackerFree(pathname: string | null | undefined): boolean {
  const p = String(pathname || "");
  return TRACKER_FREE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * The first statement of every tracker loader in <head>: stop if this page is
 * tracker-free. The regex is built from the same list as isTrackerFree.
 */
export const TRACKER_GUARD = `if(/^\\/(${TRACKER_FREE_PREFIXES.map((p) => p.slice(1)).join("|")})(\\/|$)/.test(location.pathname))return;`;
