"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string, tab: string | null) => boolean;
  icon: ReactNode;
};

const items: NavItem[] = [
  {
    label: "Home",
    href: "/account?tab=overview",
    match: (pathname, tab) => pathname === "/account" && (!tab || tab === "overview"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Book",
    href: "/membership#pick-day",
    match: (pathname) => pathname === "/membership",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Visits",
    href: "/account?tab=bookings",
    match: (pathname, tab) => pathname === "/account" && tab === "bookings",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Plan",
    href: "/account?tab=plan",
    match: (pathname, tab) => pathname === "/account" && tab === "plan",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M2.5 9h19M6.5 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/account?tab=personal",
    match: (pathname, tab) => pathname === "/account" && (tab === "personal" || tab === "password"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

export default function CustomerMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();

  const tab = searchParams.get("tab");
  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

  if (isLoading || !isSubscribed) return null;

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#D7E0F5] bg-white/95 px-2 pt-1.5 shadow-[0_-10px_34px_rgba(15,23,42,0.12)] backdrop-blur-md lg:hidden sm:pt-2"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto grid max-w-[520px] grid-cols-5 gap-1">
        {items.map((item) => {
          const active = item.match(pathname, tab);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[13px] px-1 text-[10px] font-extrabold transition active:scale-[0.98] sm:min-h-[58px] sm:gap-1 sm:rounded-[14px] sm:text-[11px]",
                active
                  ? "bg-[#EEF5FF] text-[#306EEC]"
                  : "text-[#64748B] hover:bg-[#F8FAFF] hover:text-[#0B1628]",
              ].join(" ")}
            >
              <span className={active ? "text-[#306EEC]" : "text-[#94A3B8]"}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
