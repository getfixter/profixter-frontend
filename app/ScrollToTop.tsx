"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // disable browser scroll restoration
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // remove hash
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname);
    }

    // FORCE TOP (multiple times to beat layout + images)
    window.scrollTo(0, 0);

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  }, [pathname]); // 👈 THIS IS THE KEY FIX

  return null;
}
