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
