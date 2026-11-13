"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll position across admin navigation (audit K.2, "Filter persistence and
 * scroll"):
 *
 * - Opening a detail inside a section (/admin/jobs -> /admin/jobs/123) changes
 *   nothing: the list stays mounted under the sheet, so it is exactly where it
 *   was when the sheet closes.
 * - Moving to another section starts at the top.
 * - Back (or Forward) to a section restores where that section was left,
 *   from sessionStorage, waiting for its rows to load (up to 2s, and never
 *   once the person starts scrolling themselves).
 */
const KEY = "pfa:scroll:";

function sectionBase(pathname: string): string {
  const m = /^\/admin\/[^/?#]+/.exec(pathname);
  return m ? m[0] : pathname;
}

export function AdminScroll() {
  const pathname = usePathname() || "/admin";
  const base = sectionBase(pathname);
  const previousBase = useRef<string | null>(null);
  const popped = useRef(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Remember the position of the section on screen (skipped while a sheet locks scrolling).
  useEffect(() => {
    let frame = 0;
    const save = () => {
      frame = 0;
      if (document.documentElement.style.overflow === "hidden") return;
      try {
        window.sessionStorage.setItem(KEY + base, String(Math.round(window.scrollY)));
      } catch {
        /* ignore */
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(save);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [base]);

  useEffect(() => {
    const before = previousBase.current;
    previousBase.current = base;
    const wasPop = popped.current;
    popped.current = false;
    if (before === null || before === base) return; // first load, or list <-> detail in one section

    if (!wasPop) {
      window.scrollTo(0, 0);
      return;
    }
    let target = 0;
    try {
      target = Number(window.sessionStorage.getItem(KEY + base) || 0);
    } catch {
      target = 0;
    }
    if (!target) {
      window.scrollTo(0, 0);
      return;
    }
    let cancelled = false;
    const stop = () => {
      cancelled = true;
    };
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });
    const started = Date.now();
    const attempt = () => {
      if (cancelled) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(target, Math.max(0, max)));
      if (max >= target || Date.now() - started > 2000) return;
      requestAnimationFrame(attempt);
    };
    attempt();
    return () => {
      cancelled = true;
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [base]);

  return null;
}
