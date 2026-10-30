/**
 * Which pages are customer-facing ("site") and which are staff tools.
 *
 * Plain module, no "use client": the root layout (a Server Component) inlines
 * SURFACE_SCRIPT into <head>, and a value imported from a client module would
 * reach it as a client reference rather than the string.
 *
 * app/mobile-scale.css applies the phone type and spacing scale to
 * html[data-surface="site"] only; the admin and the event kiosk keep theirs.
 */
export const STAFF_PREFIXES = ["/admin", "/event"];

export function surfaceFor(pathname: string): "site" | "staff" {
  return STAFF_PREFIXES.some((s) => pathname === s || pathname.startsWith(`${s}/`)) ? "staff" : "site";
}

/** Sets the attribute before first paint, so there is no flash of the old scale. */
export const SURFACE_SCRIPT = `(function(){try{var p=location.pathname;var s=${JSON.stringify(
  STAFF_PREFIXES
)};document.documentElement.dataset.surface=s.some(function(x){return p===x||p.indexOf(x+"/")===0})?"staff":"site";}catch(e){}})();`;

/**
 * iOS only: stop Safari zooming the page in when a form field is focused.
 *
 * The customer site is drawn at a scale below 1 (app/site-scale.css), so a
 * 16px field renders smaller than 16px, which is what makes iOS Safari zoom
 * in on focus and leave the page zoomed. maximum-scale=1 turns that off. On
 * iOS 10+ it does NOT stop the user pinch-zooming (Safari ignores it for
 * that), and no other platform gets it, so pinch zoom stays available
 * everywhere - Android Chrome would honour it, hence the iOS check.
 */
export const IOS_VIEWPORT_SCRIPT = `(function(){try{var ua=navigator.userAgent;var ios=/iP(hone|ad|od)/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);if(!ios)return;var fix=function(){var m=document.querySelector('meta[name="viewport"]');if(m&&m.content.indexOf("maximum-scale")<0)m.content+=", maximum-scale=1";};fix();document.addEventListener("DOMContentLoaded",fix);}catch(e){}})();`;
