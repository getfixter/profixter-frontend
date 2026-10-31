"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/useAuth";
import { usePathname, useRouter } from "next/navigation";
import { BOOKING_LINKS, INFO_PAGE, MAIN_NAV_LINKS } from "@/lib/site-architecture";
import { getCustomerHomePath, getRoleLandingPath, hasActiveMembership } from "@/lib/auth-routing";
import Wordmark from "@/app/components/ui/Wordmark";

type NavLink = { label: string; href: string; meta?: string };

const noopSubscribe = () => () => {};

/**
 * The site header, Website 3.0.
 *
 * One quiet bar: the wordmark, the primary destinations on a desktop, and on a
 * phone a control that says "Menu" in words. Behind it, a full-height sheet
 * with the ways to book first and everything else underneath.
 *
 * Who sees what is unchanged from before the redesign:
 * - signed out: the public nav and "Book free visit";
 * - signed in, not a member: Home, Book, Projects, See plans (their free visit
 *   lives in /book), with Account in the profile menu;
 * - member: Home, Book, Projects, Account, and the logo goes to their home.
 * Staff never get here as staff: RoleEntryGate routes them first.
 */
export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetId = useId();
  /*
   * The sheet is portalled to <body>. Inside the header it would be trapped:
   * the bar's backdrop-filter makes it the containing block for fixed
   * descendants, so a "full-height" sheet was exactly 56px tall.
   */
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const accountLabel = useMemo(() => {
    const first = user?.name?.trim().split(/\s+/)[0];
    return first || "Account";
  }, [user?.name]);
  const accountHref = useMemo(() => getRoleLandingPath(user), [user]);
  /*
   * The logo is the Home affordance. For an active member `/` only bounces
   * back to the membership dashboard, so it points straight there.
   */
  const isMember = hasActiveMembership(user);
  const homeHref = useMemo(() => getCustomerHomePath(user), [user]);
  /* The Free Visit (a to-do list review, no labor) books at its own page, /book/free. */
  const freeVisitHref = BOOKING_LINKS.freeVisit.href;

  const navLinks: readonly NavLink[] = useMemo(() => {
    if (isMember) {
      return [
        { label: "Home", href: "/" },
        { label: "Book", href: "/book?visit=membership" },
        { label: "Projects", href: "/projects" },
        { label: "Account", href: "/account" },
      ];
    }
    /*
     * Signed up but not a member: the one thing they came back for is their
     * booking, so they get Book, pointed at the flow they are entitled to, and
     * See plans because joining is still the open question for them.
     */
    if (isAuthenticated) {
      return [
        { label: "Home", href: "/" },
        { label: "Book", href: "/book" },
        { label: "Projects", href: "/projects" },
        { label: "See plans", href: "/membership/plans" },
      ];
    }
    return MAIN_NAV_LINKS;
  }, [isMember, isAuthenticated]);

  /* The menu sheet: the ways to book first, with the one fact that decides each. */
  const sheetPrimary: NavLink[] = useMemo(() => {
    if (isMember) {
      return [
        { label: "Book a visit", href: "/book?visit=membership" },
        { label: "Full Day", href: BOOKING_LINKS.fullDay.href },
        { label: "Projects", href: "/projects" },
        { label: "Account", href: "/account" },
      ];
    }
    if (isAuthenticated) {
      return [
        { label: "Book", href: "/book" },
        { label: "Memberships", href: BOOKING_LINKS.memberships.href, meta: "From $149/mo" },
        { label: "Full Day", href: BOOKING_LINKS.fullDay.href },
        { label: "Projects", href: "/projects" },
      ];
    }
    return [
      { label: "Memberships", href: BOOKING_LINKS.memberships.href, meta: "From $149/mo" },
      { label: "Free Visit", href: freeVisitHref, meta: "Go over your to-do list" },
      { label: "One-Time Visit", href: BOOKING_LINKS.oneTime.href, meta: "$99" },
      { label: "Full Day", href: BOOKING_LINKS.fullDay.href },
      { label: "Gift a membership", href: "/gift" },
    ];
  }, [isMember, isAuthenticated, freeVisitHref]);

  const sheetSecondary: NavLink[] = [
    { label: "Home", href: homeHref },
    ...(isAuthenticated ? [{ label: "Gift a membership", href: "/gift" }] : [{ label: "Projects", href: "/projects" }]),
    INFO_PAGE,
  ];

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Lock the page behind the sheet, and hand focus in and back out. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus({ preventScroll: true });
    } else {
      document.body.style.overflow = "";
      if (wasOpen.current) menuButtonRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = isMenuOpen;
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  /* Any navigation closes it (adjusted during render, not in an effect). */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
  }

  useEffect(() => {
    window.addEventListener("hashchange", closeMenu);
    window.addEventListener("popstate", closeMenu);
    return () => {
      window.removeEventListener("hashchange", closeMenu);
      window.removeEventListener("popstate", closeMenu);
    };
  }, [closeMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    setIsMenuOpen(false);
    router.push("/");
  };

  const isActive = (href: string) => {
    // An in-page anchor (/#book) is a place on the page, not the page itself.
    if (href.includes("#")) return false;
    const path = href.split(/[?#]/)[0];
    if (path === "/") return pathname === "/";
    return pathname === path;
  };

  return (
    <header className="site-header hd">
      <div className="hd__bar ui-container">
        <Link href={homeHref} aria-label="Profixter home" className="hd__brand">
          <Wordmark className="hd__mark" title="Profixter" />
        </Link>

        <nav className="hd__nav" aria-label="Main navigation">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hd__link"
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hd__end">
          {isAuthenticated ? (
            <>
              <div className="hd__desk relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  className="hd__profile"
                  aria-label="Open profile menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <span className="hd__avatar" aria-hidden="true">
                    {accountLabel.slice(0, 1).toUpperCase()}
                  </span>
                  <span>{accountLabel}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 3.5 5 6.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/*
                 * Whatever the nav beside it does not already carry, plus the
                 * way out, so nothing on screen has two doors.
                 */}
                {isProfileMenuOpen && (
                  <div className="hd__dropdown" role="menu">
                    {!navLinks.some((link) => link.href === accountHref) && (
                      <Link href={accountHref} role="menuitem" className="hd__dropitem" onClick={() => setIsProfileMenuOpen(false)}>
                        My Account
                      </Link>
                    )}
                    {!navLinks.some((link) => link.href === "/membership/plans") && (
                      <Link href="/membership/plans" role="menuitem" className="hd__dropitem" onClick={() => setIsProfileMenuOpen(false)}>
                        See plans
                      </Link>
                    )}
                    <Link href="/gift" role="menuitem" className="hd__dropitem" onClick={() => setIsProfileMenuOpen(false)}>
                      Gift a membership
                    </Link>
                    <div className="hd__dropline" />
                    <button type="button" role="menuitem" className="hd__dropitem hd__dropitem--danger" onClick={handleLogout}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
              {!isMember && (
                <Link href={accountHref} className="hd__textlink hd__phone">
                  Account
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/signin" className="hd__textlink">
                Sign in
              </Link>
              <Link href={freeVisitHref} className="ui-btn ui-btn--primary ui-btn--sm hd__desk">
                Book free visit
              </Link>
            </>
          )}

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="hd__menu"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            aria-controls={sheetId}
          >
            <span>Menu</span>
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
              <path d="M1 2h12M1 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* The menu sheet. Mounted always so it can transition; inert when shut. */}
      {mounted
        ? createPortal(
          <div className={`hd-sheet ${isMenuOpen ? "is-open" : ""}`} inert={!isMenuOpen} aria-hidden={!isMenuOpen}>
            <button type="button" className="hd-sheet__scrim" aria-label="Close menu background" tabIndex={-1} onClick={closeMenu} />
            <div id={sheetId} className="hd-sheet__panel" role="dialog" aria-modal="true" aria-label="Mobile navigation">
              <div className="hd-sheet__top">
                <Link href={homeHref} aria-label="Profixter home" className="hd__brand" onClick={closeMenu}>
                  <Wordmark className="hd__mark" title="Profixter" />
                </Link>
                <button ref={closeButtonRef} type="button" onClick={closeMenu} aria-label="Close menu" className="hd__menu">
                  <span>Close</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <nav className="hd-sheet__body" aria-label="Mobile navigation">
                <ul className="hd-sheet__primary">
                  {sheetPrimary.map((item, i) => (
                    <li key={item.label} style={{ ["--i" as string]: i }}>
                      <Link href={item.href} onClick={closeMenu} className="hd-sheet__row" aria-current={isActive(item.href) ? "page" : undefined}>
                        <span>{item.label}</span>
                        {item.meta ? <span className="hd-sheet__meta">{item.meta}</span> : null}
                        <svg className="hd-sheet__chev" width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
                          <path d="M2 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>

                <ul className="hd-sheet__secondary">
                  {sheetSecondary.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} onClick={closeMenu}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <a href="tel:+16315991363">Call 631-599-1363</a>
                  </li>
                </ul>
              </nav>

              <div className="hd-sheet__foot">
                {isAuthenticated ? (
                  <>
                    <p className="hd-sheet__who">
                      Signed in as <b>{accountLabel}</b>
                    </p>
                    {!navLinks.some((link) => link.href === accountHref) ? (
                      <Link href={accountHref} onClick={closeMenu} className="ui-btn ui-btn--primary ui-btn--block">
                        My Account
                      </Link>
                    ) : null}
                    <button type="button" onClick={handleLogout} className="ui-btn ui-btn--ghost ui-btn--block hd-sheet__logout">
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href={freeVisitHref} onClick={closeMenu} className="ui-btn ui-btn--primary ui-btn--block">
                      Book free visit
                    </Link>
                    <Link href="/signin" onClick={closeMenu} className="ui-btn ui-btn--secondary ui-btn--block">
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>,
            document.body
          )
        : null}
    </header>
  );
}
