"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { oaiqPageView, recoverPendingPaidConversions } from "@/lib/chatgpt-ads";

/**
 * A ChatGPT Ads page_viewed for every client-side route change, the same rule
 * as MetaPageView: the loader in <head> counts the first load, so the first
 * render is skipped; pathname only, so a filter or tab in the query string is
 * not a new page. Excluded pages (admin, token pages, kiosk) are refused
 * inside oaiqPageView.
 *
 * The title is read on the next frame, after Next has applied the new page's
 * metadata, so the event names the page that was viewed rather than the last one.
 *
 * It also retries any paid Stripe return that arrived signed out, on every
 * route change (sign-in always navigates) and when another tab signs in. That
 * is a no-op unless such a return is parked and someone is signed in.
 */
export default function ChatGPTPageView() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    recoverPendingPaidConversions();
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const frame = window.requestAnimationFrame(() => oaiqPageView(pathname));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" && e.newValue) recoverPendingPaidConversions();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}
