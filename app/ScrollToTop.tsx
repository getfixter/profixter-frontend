"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Start each new page at the top, unless the customer asked for a section.
 *
 * This exists because Next restores the previous scroll offset on a route
 * change, which lands people halfway down a page they have never seen. The
 * original fix was blunt: it deleted any hash by rewriting the URL to
 * `window.location.pathname` and then forced the scroll to 0 three times.
 *
 * That broke every deep link on the site. Rewriting to the pathname drops the
 * query string as well as the hash, so `/book?visit=membership#your-visits`
 * arrived as `/book`: wrong tab, wrong scroll position, and the address bar no
 * longer described the page. The forced scroll then beat the browser's own
 * anchor handling, so even the links that survived went to the top anyway.
 *
 * A hash is a request for a particular part of the page, so it is honoured:
 * the URL is left exactly as it arrived, and the target is scrolled to once
 * the layout has settled. Without a hash the original behaviour applies.
 */
export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const hash = window.location.hash;

    if (hash) {
      /*
       * The target keeps moving after first paint: images load, and sections
       * that fetch their own data (the visit list, the plan cards) mount late
       * and push everything below them down. A single scroll lands short, so
       * this re-aligns until the target stops moving, and gives up after a
       * second either way. It also stops the moment the customer scrolls, so
       * it can never fight them for control of the page.
       */
      let cancelled = false;
      let lastTop: number | null = null;
      const stop = () => {
        cancelled = true;
      };

      const settle = () => {
        if (cancelled) return;
        const target = document.querySelector(hash);
        if (!target) return;
        const top = Math.round(target.getBoundingClientRect().top);
        if (lastTop !== null && Math.abs(top - lastTop) < 2) return;
        lastTop = top;
        target.scrollIntoView({ block: "start" });
      };

      window.addEventListener("wheel", stop, { passive: true, once: true });
      window.addEventListener("touchstart", stop, { passive: true, once: true });
      window.addEventListener("keydown", stop, { once: true });

      settle();
      const raf = requestAnimationFrame(settle);
      const timers = [100, 250, 500, 900].map((ms) => setTimeout(settle, ms));

      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchstart", stop);
        window.removeEventListener("keydown", stop);
      };
    }

    window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0));
    const timer = setTimeout(() => window.scrollTo(0, 0), 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
