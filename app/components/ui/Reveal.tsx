"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Reveals its children once, when they first scroll into view.
 *
 * Robust by construction, because the old version was not: it rendered its
 * children at opacity 0 from the server and waited for an IntersectionObserver
 * to fade them in. Anything that never scrolled - a full-page screenshot, a
 * print, a browser where the observer failed - saw large empty sections.
 *
 * Now:
 * - the server renders the content VISIBLE (no attribute at all);
 * - after mount, only an element that is still below the fold is "armed"
 *   (hidden, see [data-reveal] in app/ui.css); anything already on screen is
 *   left alone, so there is never a flash of disappearing content;
 * - the observer releases it as it scrolls in;
 * - if the visitor has not scrolled at all after a short grace period, every
 *   element still waiting is released anyway. A page somebody is not scrolling
 *   gains nothing from hidden sections, and a screenshot gets the whole page.
 * - No IntersectionObserver, or prefers-reduced-motion: nothing is ever hidden.
 *
 * Content stays in the DOM throughout, so it is always readable to crawlers.
 */

const GRACE_MS = 1600;

export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** Stagger in ms, for sequencing siblings. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Already in (or above) the viewport: never hide what the visitor can see.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) return;

    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      node.style.transitionDelay = delay ? `${delay}ms` : "";
      node.dataset.reveal = "in";
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) release();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
    );

    let scrolled = false;
    const onScroll = () => {
      scrolled = true;
    };
    const timer = window.setTimeout(() => {
      if (!scrolled) release();
    }, GRACE_MS);

    node.dataset.reveal = "armed";
    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true, once: true });

    return () => {
      // Never leave an element hidden behind an effect that no longer runs.
      if (!done) delete node.dataset.reveal;
      done = true;
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [delay]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
