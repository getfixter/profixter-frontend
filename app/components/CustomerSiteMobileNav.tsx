"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getCustomerHomePath, hasActiveMembership } from "@/lib/auth-routing";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  icon: ReactNode;
};

const hiddenPathPrefixes = [
  "/admin",
  // The event kiosk is a full-screen booth display with exactly one action.
  "/event",
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

/**
 * Nav for the current visitor.
 *
 * Members get Home, Book, Projects, Account. Home is the public homepage and
 * Book owns booking, so the separate Membership tab is redundant for them: the
 * membership dashboard is reachable from Account and from Home.
 *
 * Everyone else keeps exactly the nav they have today.
 */
function buildItems({ homeHref, isMember }: { homeHref: string; isMember: boolean }): NavItem[] {
  const items: NavItem[] = [
  {
    label: "Home",
    href: homeHref,
    match: (pathname) => pathname === "/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    // Members never see this item: the list below filters down to Home, Book,
    // Projects and Account for them. "Plans", and straight to the prices - it
    // was "Membership" -> /membership, one page short of what anything costs.
    label: "Plans",
    href: "/membership/plans",
    match: (pathname) =>
      pathname === "/membership" || pathname === "/membership-info" || pathname === "/membership/plans",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
        <path d="M2.5 10h19M6 14.5h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Book",
    // Members land on the visit their membership already covers.
    href: isMember ? "/book?visit=membership" : "/book",
    match: (pathname) => pathname === "/book" || pathname.startsWith("/book/"),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Account",
    href: "/account",
    // Account means the Account route. /membership is a real destination of its
    // own, and highlighting Account there would be a tab claiming a page it does
    // not own. No highlight is the truthful state.
    match: (pathname) => pathname === "/account" || pathname === "/signin" || pathname === "/signup",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      ["/roofing", "/siding", "/kitchen", "/bathroom", "/remodeling", "/estimate", "/kitchen-bathroom"].includes(
        pathname
      ),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20V8l8-4 8 4v12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 20v-6h6v6M4 11l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  ];

  if (!isMember) return items;
  // Home, Book, Projects, Account. Account sits last because it is the least
  // frequent destination of the four.
  const order = ["Home", "Book", "Projects", "Account"];
  return items
    .filter((item) => order.includes(item.label))
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}

/**
 * The phone tab bar, for signed-in customers only (Website 3.0).
 *
 * Before the redesign every visitor got it, and on a marketing page it was a
 * second navigation stacked under the first, eating 76px of every phone screen
 * and covering the booker. A visitor without an account now navigates from the
 * header's "Menu" sheet, which carries the same destinations with labels that
 * say what each one is. Somebody signed in is using Profixter as an app - book,
 * check a project, open their account - and keeps the bar, slimmer (52px).
 */
export default function CustomerSiteMobileNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const isMember = hasActiveMembership(user);
  const items = buildItems({ homeHref: getCustomerHomePath(user), isMember });
  const hidden = hiddenPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const shown = !hidden && isAuthenticated;

  /*
   * Tells the page the bar is there (html.has-tabbar), so fixed things that
   * share the bottom edge - the sticky CTA, the support chat button - can sit
   * above it. See --pf-support-chat-bottom-mobile in app/ui-shell.css.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-tabbar", shown);
    return () => root.classList.remove("has-tabbar");
  }, [shown]);

  if (!shown) return null;

  return (
    <>
      {/*
        customer-site-nav is also a hook for CSS (app/mobile-scale.css and the
        StickyMobileCTA offset), not only a style.
      */}
      <nav aria-label="Customer site navigation" className="customer-site-nav csn lg:hidden">
        <div className={`csn__grid ${items.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`csn-item ${active ? "is-active" : ""}`}
              >
                <span className="csn-item__icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="customer-site-nav-spacer csn-spacer lg:hidden" aria-hidden="true" />
    </>
  );
}
