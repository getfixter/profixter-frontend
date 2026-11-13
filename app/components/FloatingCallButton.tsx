"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BUSINESS_PHONE_E164 } from "@/lib/seo";
import { surfaceFor } from "@/lib/surface";

/**
 * A small Call button in the bottom-left corner of every customer page
 * (2026-11-03), the mirror of the support chat button on the right. One mount
 * in the root layout; staff pages (/admin, /event) do not get it.
 *
 * It is a plain tel: link to the site's one business number (lib/seo), so the
 * dialler opens and PhoneClickTracker counts the tap like every other one.
 * It shares the chat button's bottom offset (--pf-support-chat-bottom*, see
 * app/ui-shell.css), so it rises with it above the tab bar and the sticky CTA.
 *
 * It never covers something to tap: while someone is typing (on a phone the
 * keyboard lifts fixed things into the form), and whenever a button, link or
 * field is under it as the page scrolls - a booking button passing through the
 * corner, say - it fades out and lets taps through until the corner is clear.
 */
const HREF = `tel:${BUSINESS_PHONE_E164.replace(/[^+\d]/g, "")}`;
const CONTROL = "a[href], button, input, select, textarea, label, summary, [role='button'], [role='tab'], [tabindex]:not([tabindex='-1'])";
const TYPING = "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select, [contenteditable='true']";

export default function FloatingCallButton() {
  const pathname = usePathname() || "/";
  // Staff pages (/admin, /event) mount nothing: no listeners, no 700ms timer.
  if (surfaceFor(pathname) !== "site") return null;
  return <CallButton pathname={pathname} />;
}

function CallButton({ pathname }: { pathname: string }) {
  const [typing, setTyping] = useState(false);
  const [covering, setCovering] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const sync = () => setTyping(Boolean(document.activeElement?.matches?.(TYPING)));
    // After focusout the next field (if any) is not focused yet: look once it is.
    const later = () => setTimeout(sync, 0);
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", later);
    return () => {
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", later);
    };
  }, []);

  /* Something to tap under the button? Checked at its centre and corners, once per frame while scrolling. */
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const dot = el.firstElementChild?.getBoundingClientRect();
      if (!dot || !dot.width) return;
      const points: Array<[number, number]> = [
        [dot.left + dot.width / 2, dot.top + dot.height / 2],
        [dot.left + 2, dot.top + 2],
        [dot.right - 2, dot.top + 2],
        [dot.left + 2, dot.bottom - 2],
        [dot.right - 2, dot.bottom - 2],
      ];
      const under = points.some(([x, y]) =>
        document.elementsFromPoint(x, y).some((hit) => !el.contains(hit) && hit.closest(CONTROL) && !hit.closest("[data-support-chat]"))
      );
      setCovering(under);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    // Capture: the page may scroll an element rather than the window, and scroll does not bubble.
    document.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    // Content that moves without a scroll (a form step, an expanding section).
    const timer = window.setInterval(schedule, 700);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      window.clearInterval(timer);
    };
  }, [pathname]);

  return (
    <a ref={ref} href={HREF} className="pf-call" data-call-button data-typing={typing ? "1" : undefined} data-covering={covering ? "1" : undefined}>
      <span className="pf-call__dot">
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
        </svg>
        <span className="pf-call__label">Call<span className="sr-only"> Profixter</span></span>
      </span>
    </a>
  );
}
