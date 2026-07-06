"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

  useEffect(() => {
    const threshold = window.innerHeight * 0.8;
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isSubscribed) return null;

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
      <div className="bg-white border-t border-[#E2E8F0] shadow-[0_-8px_24px_rgba(15,23,42,0.12)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        {isAuthenticated ? (
          <Link
            href="/membership#plans"
            className="flex w-full h-[52px] items-center justify-center rounded-[13px] bg-[#306EEC] text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(48,110,236,0.30)] active:bg-[#2558c9]"
          >
            Start Membership &mdash; from $149/mo
          </Link>
        ) : (
          <div className="flex gap-3">
            <Link
              href="/signin"
              className="flex-1 inline-flex h-[52px] items-center justify-center rounded-[13px] border border-[#C5CBD8] bg-white text-[14px] font-bold text-[#0B1628] active:bg-[#F1F5F9]"
            >
              My Home
            </Link>
            <Link
              href="/signup?redirect=%2Fmembership%23plans"
              className="flex-[2] inline-flex h-[52px] items-center justify-center rounded-[13px] bg-[#306EEC] text-[14px] font-extrabold text-white shadow-[0_8px_22px_rgba(48,110,236,0.28)] active:bg-[#2558c9]"
            >
              Start Membership
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
