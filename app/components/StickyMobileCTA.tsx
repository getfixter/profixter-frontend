"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Appears after scrolling past ~80% of the viewport height (past the hero fold)
const SCROLL_THRESHOLD = typeof window !== "undefined" ? window.innerHeight * 0.8 : 600;

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const threshold = window.innerHeight * 0.8;

    const onScroll = () => setVisible(window.scrollY > threshold);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-40
        lg:hidden
        transition-transform duration-300 ease-in-out
        ${visible ? "translate-y-0" : "translate-y-full"}
      `}
      aria-hidden={!visible}
    >
      <div className="bg-white border-t border-[#E2E8F0] shadow-[0_-8px_24px_rgba(15,23,42,0.10)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="flex-1 inline-flex h-[50px] items-center justify-center rounded-[12px] bg-[#306EEC] text-[14px] font-extrabold text-white shadow-[0_8px_20px_rgba(48,110,236,0.28)] active:bg-[#2558c9]"
          >
            Start My Membership
          </Link>
          <Link
            href="#plans"
            className="flex-1 inline-flex h-[50px] items-center justify-center rounded-[12px] border border-[#C5CBD8] bg-white text-[14px] font-semibold text-[#0B1628] active:bg-[#F1F5F9]"
          >
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
