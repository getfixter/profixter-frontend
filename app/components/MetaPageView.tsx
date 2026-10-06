"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A Meta PageView for every client-side route change.
 *
 * The pixel snippet in the root layout fires the PageView for the first load.
 * After that, Next navigates without reloading the page, so the snippet never
 * runs again. This fires one PageView per new pathname instead.
 *
 * The first render is skipped because the snippet has already counted it.
 * fbevents.js's own pushState listener is switched off in the snippet
 * (fbq.disablePushState), so this is the only source of route-change PageViews.
 *
 * Pathname only, not the query string: a filter or a tab written into the URL
 * is not a new page.
 */
export default function MetaPageView() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    try {
      if (typeof window.fbq === "function") window.fbq("track", "PageView");
    } catch {
      /* tracking never breaks navigation */
    }
  }, [pathname]);

  return null;
}
