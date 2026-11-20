/**
 * ChatGPT Ads measurement pixel: the id, the SDK, and where it never runs.
 *
 * A plain module (no "use client"), like lib/meta-config.ts, because the root
 * layout is a Server Component and inlines these values into the loader in
 * <head>. A constant imported from a client module would reach it as a client
 * reference and render as nothing.
 *
 * The pixel id is a public identifier (it ships in the page source either way),
 * so it lives in code where a change is reviewed, not in a dashboard env var.
 *
 * Docs: https://learn.chatgpt.com/ads/measurement-pixel
 */
import { TRACKER_FREE_PREFIXES } from "./tracking-scope";

export const OAIQ_PIXEL_ID = "RTqbVHz1coRZKU6LyhJo3b";
export const OAIQ_SDK_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

/*
 * Debug logs every SDK call to the browser console. Only in `next dev`: a
 * Vercel production or preview build is NODE_ENV=production, so debug is off
 * on the live site. Event Stream testing does not need debug - it uses the
 * Test view in Ads Manager.
 */
export const OAIQ_DEBUG = process.env.NODE_ENV !== "production";

/*
 * Pages the ChatGPT pixel never loads on, and never reports from.
 *
 * The site-wide tracker-free list (staff tools and token-in-URL pages, see
 * lib/tracking-scope.ts) plus pages that are staff-facing or carry a
 * credential, which this pixel has no business seeing:
 * - /event: the staff-run kiosk.
 * - /team-setup: a Telemarketer's single-use setup link.
 * - /set-password: the forced password change after a temporary password.
 * Technician (Fixter) tools live under /admin, already on the list.
 */
export const OAIQ_EXCLUDED_PREFIXES = [...TRACKER_FREE_PREFIXES, "/event", "/team-setup", "/set-password"] as const;

export function isOaiqExcluded(pathname: string | null | undefined): boolean {
  const p = String(pathname || "");
  return OAIQ_EXCLUDED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/* First statement of the loader in <head>: stop on an excluded page. */
export const OAIQ_GUARD = `if(/^\\/(${OAIQ_EXCLUDED_PREFIXES.map((p) => p.slice(1).replace(/\//g, "\\/")).join("|")})(\\/|$)/.test(location.pathname))return;`;

/**
 * The loader: the excluded-page and GPC guards, the documented stub
 * (window.oaiq queues `arguments` on oaiq.q until the SDK arrives), then init
 * and the first page_viewed.
 *
 * window.__pfOaiq marks a page where the pixel really loaded. This guard is a
 * superset of TRACKER_GUARD, so wherever it loaded GTM and Meta did too and
 * set window.__pfTrackers: TrackerBoundary's full reload into /admin and the
 * token pages therefore unloads this pixel as well. On the extra pages
 * (/event, /team-setup, /set-password) reached by client navigation, the
 * script stays in memory but lib/chatgpt-ads.ts sends nothing there.
 */
/*
 * GLOBAL PRIVACY CONTROL. A browser sending GPC (navigator.globalPrivacyControl
 * === true) has asked not to have its data sold or shared for cross-context
 * advertising, which is what an ad pixel does. For such a browser this pixel
 * never loads: no SDK request, no cookies, no events. window.oaiq is then
 * undefined and every call in lib/chatgpt-ads.ts is a no-op. Meta and GTM are
 * deliberately not changed here (they were out of scope).
 */
export const OAIQ_GPC_GUARD = `try{if(navigator.globalPrivacyControl===true)return;}catch(e){}`;

/*
 * PRODUCTION HOSTS ONLY. The pixel runs on www.profixter.com (and the apex,
 * which redirects there) and nowhere else: not on localhost, not on a Vercel
 * preview, not in a browser test of a local production build.
 *
 * Why: a `next build` is NODE_ENV=production, so before this guard a local
 * build loaded the real SDK with the real pixel id, and every browser test that
 * submitted a (stubbed) free-visit request or callback sent a genuine
 * lead_created to OpenAI, with test_session_id null and a localhost source
 * URL. The repo's suites block Meta and GTM but not OpenAI; one run of
 * test_cx4_ui alone sent six lead_created events. On 2026-11-18 Ads Manager
 * showed 77 lead_created in 24 hours while production saved no lead at all.
 *
 * The one deliberate exception: a test that checks what the site hands the
 * pixel (scripts/test_chatgpt_ads_browser.js) sets localStorage
 * pf_oaiq_allow_host=1. Even then the opt-in can NEVER reach OpenAI: off a
 * production host the loader asks for OAIQ_TEST_SDK_PATH on the page's own
 * origin (never served, so a 404 unless the test answers it with its fake
 * SDK) instead of bzrcdn.openai.com, and inits OAIQ_TEST_PIXEL_ID instead of
 * the real id. A test that sets the flag and forgets the fake SDK just gets no
 * pixel. On a production host the flag changes nothing.
 */
export const OAIQ_HOSTS = ["www.profixter.com", "profixter.com"] as const;
export const OAIQ_TEST_SDK_PATH = "/__oaiq-test-sdk.js";
export const OAIQ_TEST_PIXEL_ID = "test-pixel-not-real";
/* Sets `prod` (a production host); off one, stops unless the test opt-in is set. */
export const OAIQ_HOST_GUARD = `var prod=${JSON.stringify(OAIQ_HOSTS)}.indexOf(location.hostname)>=0;if(!prod){var ok=0;try{ok=localStorage.getItem("pf_oaiq_allow_host")==="1"}catch(e){}if(!ok)return;}`;

/*
 * Delivery signals for lib/chatgpt-ads.ts. __pfOaiqReady: the SDK file loaded,
 * so it has taken over the queue. __pfOaiqFailed: it could not load (blocked,
 * offline). Only a loaded SDK lets an event be remembered as sent, so one that
 * could only be queued is not suppressed on the next page load.
 */
const OAIQ_SIGNALS = `js.onload=function(){w.__pfOaiqReady=1;var r=w.__pfOaiqOnReady||[];w.__pfOaiqOnReady=[];for(var i=0;i<r.length;i++){try{r[i]()}catch(e){}}};js.onerror=function(){w.__pfOaiqFailed=1;w.__pfOaiqOnReady=[]};`;

export const OAIQ_LOADER_SCRIPT = `(function(w,d,s,u){${OAIQ_GUARD}${OAIQ_HOST_GUARD}${OAIQ_GPC_GUARD}if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;w.__pfOaiq=1;w.__pfOaiqOnReady=[];var js=d.createElement(s);js.async=true;js.src=prod?u:${JSON.stringify(OAIQ_TEST_SDK_PATH)};${OAIQ_SIGNALS}var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(js,f);
w.oaiq("init",{pixelId:prod?${JSON.stringify(OAIQ_PIXEL_ID)}:${JSON.stringify(OAIQ_TEST_PIXEL_ID)}${OAIQ_DEBUG ? ",debug:true" : ""}});
w.oaiq("measure","page_viewed",{type:"contents",contents:[{id:location.pathname,name:d.title||location.pathname,content_type:"page"}]});
})(window,document,"script",${JSON.stringify(OAIQ_SDK_URL)});`;
