/**
 * The welcome entry on profixter.com (2026-11-19).
 *
 * A new visitor opening profixter.com sees one question first:
 *
 *   I'm looking for…   [A handyman membership]   [A one-time visit]
 *
 * and then a short booking flow (app/components/welcome/WelcomeFlow). The
 * current homepage stays one tap away through the logo, and that choice is
 * remembered, so they can browse without being sent back.
 *
 * WHO SEES IT, decided before paint by WELCOME_SCRIPT (inlined in <head>, like
 * AUTH_PENDING_SCRIPT in lib/surface.ts), so nobody sees one page flash into
 * another:
 *  - only a full page load of "/" (a client-side link to "/" shows the
 *    homepage, unless the flow is already open in this tab) and always /start,
 *    the pilot URL for preview and testing;
 *  - never anybody signed in (a saved token), never after they chose the
 *    homepage (pf_welcome = "home"), never a search or social crawler (they
 *    index the homepage, which stays the server HTML), never with a #section;
 *  - storage blocked: not shown (the homepage works without storage);
 *  - automated browsers (navigator.webdriver) see the homepage, so the
 *    homepage's own test suites keep testing it; a test of this flow opts in
 *    with localStorage pf_welcome_test=1.
 * Ad visitors (utm_*, fbclid…) DO see it: they are who it is for. Every
 * direct link to any other page is untouched.
 *
 * Plain module, no "use client": the root layout inlines the script.
 */

export const WELCOME_CHOICE_KEY = "pf_welcome";
export const WELCOME_FLOW_KEY = "pf_welcome_flow";
export const WELCOME_ATTR = "data-pf-welcome";
export const WELCOME_PILOT_PATH = "/start";
/* Crawlers and link previewers index the homepage, never the flow. */
const BOT_UA = "bot|crawl|spider|slurp|facebookexternalhit|embedly|lighthouse|inspectiontool|pingdom";

export const WELCOME_SCRIPT = `(function(){try{var p=location.pathname,d=document.documentElement;if(p!=="/"&&p!=="${WELCOME_PILOT_PATH}")return;if(new RegExp("${BOT_UA}","i").test(navigator.userAgent||""))return;if(p==="${WELCOME_PILOT_PATH}"){d.setAttribute("${WELCOME_ATTR}","1");return;}if(location.hash)return;if(navigator.webdriver&&localStorage.getItem("pf_welcome_test")!=="1")return;if(localStorage.getItem("token"))return;if(localStorage.getItem("${WELCOME_CHOICE_KEY}")==="home")return;d.setAttribute("${WELCOME_ATTR}","1");}catch(e){}})();`;

export type WelcomePath = "membership" | "one_time";
export type WelcomeScreen = "choice" | "nudge" | "address" | "time" | "job" | "contact" | "plans" | "pay" | "review";

export type WelcomeFlowState = { screen: WelcomeScreen; path: WelcomePath | ""; at: number };
const FLOW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Is the flow showing on this page (set before paint, or by the pilot URL)? */
export function welcomeShowing(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute(WELCOME_ATTR) === "1";
}

/** They chose the current homepage: remember it and show it now. */
export function chooseHomepage(): void {
  try {
    window.localStorage.setItem(WELCOME_CHOICE_KEY, "home");
  } catch {
    /* not remembered; still shown now */
  }
  if (typeof document !== "undefined") document.documentElement.removeAttribute(WELCOME_ATTR);
}

export function loadWelcomeFlow(): WelcomeFlowState | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(WELCOME_FLOW_KEY) || "null") as WelcomeFlowState | null;
    if (!raw?.screen || typeof raw.at !== "number" || Date.now() - raw.at > FLOW_MAX_AGE_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveWelcomeFlow(state: Omit<WelcomeFlowState, "at">): void {
  try {
    window.localStorage.setItem(WELCOME_FLOW_KEY, JSON.stringify({ ...state, at: Date.now() }));
  } catch {
    /* the screen is not remembered across a reload; everything still works */
  }
}

export function clearWelcomeFlow(): void {
  try {
    window.localStorage.removeItem(WELCOME_FLOW_KEY);
  } catch {
    /* nothing to clear */
  }
}
