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
export const TRACKER_FREE_PREFIXES = ["/admin", "/sign", "/pay", "/tip", "/visit", "/gift/claim"] as const;
/* /gift/claim/<token> (2026-11-19): the token is the gift. Its sign-in detour carries no token either (lib/gift-claim-return). */

/**
 * A tracker-free path with its secret part removed, for anything that is
 * stored or sent (the first-touch landing path): "/gift/claim/abc" -> "/gift/claim".
 */
export function redactTrackerFreePath(pathname: string | null | undefined): string {
  const p = String(pathname || "");
  const prefix = TRACKER_FREE_PREFIXES.find((x) => p === x || p.startsWith(`${x}/`));
  return prefix || p;
}

/**
 * Production hosts (2026-11-19). GTM (and Clarity, GA4, Google Ads inside it),
 * the Meta Pixel and our own visit/step counters run only here, as the ChatGPT
 * pixel already did (lib/chatgpt-ads-config). A local or Vercel preview build
 * is NODE_ENV=production and used to send real events to every one of them.
 */
export const PRODUCTION_HOSTS = ["www.profixter.com", "profixter.com"] as const;

export function isProductionHost(hostname?: string): boolean {
  const h = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  return (PRODUCTION_HOSTS as readonly string[]).includes(h);
}

/*
 * Browser tests that need the loaders to run set localStorage
 * pf_trackers_allow_host=1. Even then nothing can reach a vendor: off a
 * production host the loaders fetch same-origin paths that are never served
 * (TRACKER_TEST_GTM_PATH, TRACKER_TEST_FBEVENTS_PATH), so the stub queues the
 * calls and no SDK ever sends them.
 */
export const TRACKER_TEST_GTM_PATH = "/__gtm-test.js";
export const TRACKER_TEST_FBEVENTS_PATH = "/__fbevents-test.js";
export const TRACKER_HOST_GUARD = `var pfProd=${JSON.stringify(PRODUCTION_HOSTS)}.indexOf(location.hostname)>=0;if(!pfProd){var pfOk=0;try{pfOk=localStorage.getItem("pf_trackers_allow_host")==="1"}catch(e){}if(!pfOk)return;}`;

export function isTrackerFree(pathname: string | null | undefined): boolean {
  const p = String(pathname || "");
  return TRACKER_FREE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * The first statement of every tracker loader in <head>: stop if this page is
 * tracker-free. The regex is built from the same list as isTrackerFree.
 */
export const TRACKER_GUARD = `if(/^\\/(${TRACKER_FREE_PREFIXES.map((p) => p.slice(1).replace(/\//g, "\\/")).join("|")})(\\/|$)/.test(location.pathname))return;`;
