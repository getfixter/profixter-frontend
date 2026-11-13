"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { surfaceFor } from "@/lib/surface";
import { keepInView } from "@/lib/form-guide";
import { keepFieldUncovered } from "@/lib/admin/keyboard";

/**
 * The phone keyboard never covers the field being typed in (2026-11-03).
 *
 * Three parts, each doing what the browser cannot:
 *
 *  - ANDROID CHROME resizes the page for the keyboard (the viewport's
 *    interactive-widget=resizes-content, app/layout.tsx), so 100dvh sheets and
 *    fixed bars move up with it and the browser scrolls the field into view by
 *    itself. Nothing to do there but the next two points.
 *  - IPHONE SAFARI lays the keyboard over the page and only shrinks the
 *    visual viewport. --kb-inset (the keyboard's height, from visualViewport)
 *    lets a bottom sheet stop above it, and when the visual viewport changes
 *    the focused field is moved into what is left - once per change, measured,
 *    never on a timer.
 *  - THE BARS. While a text field has focus on a touch screen the tab bar, the
 *    sticky call-to-action and the Call button step aside
 *    (html[data-keyboard="open"], ui-shell.css), so they cannot sit on top of
 *    the keyboard and hide the field or its error. They return the moment
 *    focus leaves, so the buttons are all there when the keyboard closes.
 *
 * The customer site and the admin (2026-11-12, audit E.3). The /event kiosk
 * is left alone. The admin differs in one rule: a field is moved only when it
 * is actually covered (below the visible area minus 16px, or under a sheet's
 * sticky footer), and then so that it and its label sit about 24px above the
 * keyboard. A visible field never moves; nothing ever moves on blur.
 */
const TEXT_ENTRY =
  "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=hidden]):not([type=color]), textarea, [contenteditable='true']";

export default function KeyboardAware() {
  const pathname = usePathname() || "/";
  const mode: "site" | "admin" | "off" =
    surfaceFor(pathname) === "site" ? "site" : pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : "off";

  useEffect(() => {
    if (mode === "off") return;
    const reveal = (field: HTMLElement) => (mode === "admin" ? keepFieldUncovered(field) : keepInView(field, { behavior: "auto" }));
    const root = document.documentElement;
    const touch = () => {
      try {
        return window.matchMedia("(pointer: coarse)").matches;
      } catch {
        return false;
      }
    };
    const typingIn = (): HTMLElement | null => {
      const el = document.activeElement as HTMLElement | null;
      return el && el.matches?.(TEXT_ENTRY) ? el : null;
    };

    const vv = window.visualViewport;
    let lastHeight = vv ? vv.height : window.innerHeight;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const inset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      root.style.setProperty("--kb-inset", `${inset}px`);
      const field = typingIn();
      const open = Boolean(field) && touch();
      if (open) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
      const height = vv ? vv.height : window.innerHeight;
      // The keyboard opened or grew: the field moves into what is left of the screen.
      if (open && field && height < lastHeight - 1) reveal(field);
      lastHeight = height;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches?.(TEXT_ENTRY) || !touch()) return schedule();
      root.dataset.keyboard = "open";
      // A keyboard already on screen does not resize again: the newly focused field is checked now.
      requestAnimationFrame(() => reveal(target));
      schedule();
    };
    const onFocusOut = () => {
      // The next field (if any) is focused after focusout: decide once it is.
      requestAnimationFrame(schedule);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      delete root.dataset.keyboard;
      root.style.removeProperty("--kb-inset");
    };
  }, [mode]);

  return null;
}
