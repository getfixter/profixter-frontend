"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isTrackerFree } from "@/lib/tracking-scope";

declare global {
  interface Window {
    /** Set by the GTM and pixel loaders in app/layout.tsx when they actually ran. */
    __pfTrackers?: number;
  }
}

/**
 * Keeps trackers out of /admin and the token pages after client navigation.
 *
 * The loaders in <head> refuse to start on those paths, but a script already
 * running stays running when Next navigates without a reload: open the site,
 * sign in, land in /admin, and GTM (with whatever tags its container holds)
 * would still be in memory beside the owner's token. So entering a
 * tracker-free path from a page that loaded trackers is always a full page
 * load, which starts a clean document without them:
 *
 *  - a click on a link to such a path becomes a normal navigation before Next
 *    sees it (capture phase, so no client-side transition happens at all);
 *  - anything else (router.push after sign-in, for example) is caught when the
 *    path changes and replaced with a reload of the same URL.
 */
export default function TrackerBoundary() {
  const pathname = usePathname();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.__pfTrackers) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !isTrackerFree(url.pathname)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(url.href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (window.__pfTrackers && isTrackerFree(pathname)) {
      window.location.replace(window.location.href);
    }
  }, [pathname]);

  return null;
}
