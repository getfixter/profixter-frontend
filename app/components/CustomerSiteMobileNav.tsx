"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  icon: ReactNode;
};

const hiddenPathPrefixes = [
  "/admin",
  // Document signing is a focused ceremony. The site nav is fixed to the bottom
  // of the viewport, so it both covers the signing controls and offers the
  // customer a way out of the page mid-signature.
  "/sign",
  "/signin",
  "/signup",
  "/register",
  "/forgot-password",
  "/july4",
  "/review",
  "/tip",
];

const items: NavItem[] = [
  {
    label: "Home",
    href: "/",
    match: (pathname) => pathname === "/",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Membership",
    href: "/membership",
    match: (pathname) => pathname === "/membership" || pathname === "/membership-info",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
        <path d="M2.5 10h19M6 14.5h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Book",
    href: "/book",
    match: (pathname) => pathname === "/book" || pathname.startsWith("/book/"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Account",
    href: "/account",
    match: (pathname) => pathname === "/account" || pathname === "/signin" || pathname === "/signup",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.9" />
        <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    match: (pathname) =>
      pathname === "/projects" ||
      pathname.startsWith("/renovations") ||
      ["/roofing", "/siding", "/kitchen", "/bathroom", "/remodeling", "/estimate"].includes(pathname),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20V8l8-4 8 4v12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 20v-6h6v6M4 11l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function CustomerSiteMobileNav() {
  const pathname = usePathname();
  const hidden = hiddenPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (hidden) return null;

  return (
    <>
      <nav
        aria-label="Customer site navigation"
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#D7E0F5] bg-white/95 px-2 pt-1.5 shadow-[0_-10px_34px_rgba(15,23,42,0.12)] backdrop-blur-md lg:hidden sm:pt-2"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5 gap-1">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[13px] px-1 text-[11px] font-bold transition active:scale-[0.98] sm:min-h-[58px] sm:gap-1 sm:rounded-[14px] sm:text-[11px]",
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
      <div className="h-[calc(76px+env(safe-area-inset-bottom,0px))] lg:hidden" aria-hidden="true" />
    </>
  );
}
