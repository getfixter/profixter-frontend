"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Everything the start screen deliberately does not show.
 *
 * This is not a copy of the site header. The header's four tabs are a working
 * nav for somebody already inside the site; this is the one place a visitor who
 * has only seen a photograph and a button can get to anything else, so it is
 * the real destinations and nothing invented:
 *
 *   Membership and Compare plans   - what the product is, and what it costs
 *   Book a visit                   - /book, which explains itself to a stranger
 *   Kitchen & bathroom, Projects   - the work that is not a monthly visit
 *   Gift a membership              - a product of its own, with its own funnel
 *   Service areas, About           - the two questions people actually ask
 *
 * Left out on purpose: Home (this is Home), Account (nobody here has one yet),
 * and the redirect-only URLs /landing, /membership-info, /on-demand, /register,
 * which all forward to something already in this list.
 */
const PRIMARY_LINKS = [
  { label: "Membership", href: "/membership" },
  { label: "Compare plans", href: "/membership/plans" },
  { label: "Book a visit", href: "/book" },
  { label: "Kitchen & bathroom", href: "/kitchen-bathroom" },
  { label: "Large projects", href: "/projects" },
  { label: "Gift a membership", href: "/gift" },
  /*
   * Promoted out of the secondary group. Home no longer explains the company,
   * what a membership covers or why a local company beats a marketplace - all
   * of that moved to About, which makes About the answer to "tell me more"
   * rather than a footer-ish afterthought.
   */
  { label: "About us", href: "/about" },
];

const SECONDARY_LINKS = [
  { label: "Service areas", href: "/locations" },
];

const PHONE = "+16315991363";
const PHONE_DISPLAY = "(631) 599-1363";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function StartMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const sheet = sheetRef.current;
    // Captured now rather than read in the cleanup: the cleanup closes over
    // whatever the ref held when the effect ran, which is the button that was
    // actually pressed.
    const trigger = triggerRef.current;
    /*
     * The page behind a full-screen sheet must not scroll, and on iOS
     * `overflow: hidden` on <body> is the only thing that reliably stops it.
     * The previous offset is restored on close so dismissing the menu never
     * moves the page the visitor was looking at.
     */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus lands inside the sheet, not on the trigger that is now behind it.
    const first = sheet?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !sheet) return;

      // Tab cycles inside the sheet rather than walking into the hero behind it.
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === firstEl || !sheet.contains(active))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Whatever opened the menu gets the focus back when it closes.
      trigger?.focus();
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="start-menu__trigger"
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => {
          setOpen(true);
          trackEvent("start_screen_menu_open", { page: "/" });
        }}
      >
        <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
          <g fill="currentColor">
            <rect x="0" y="0" width="20" height="2" rx="1" />
            <rect x="0" y="6" width="20" height="2" rx="1" />
            <rect x="0" y="12" width="20" height="2" rx="1" />
          </g>
        </svg>
      </button>

      {open ? (
        <div
          className="start-menu__panel"
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Profixter menu"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div ref={sheetRef} className="start-menu__sheet">
            <div className="flex items-center justify-between px-4 pb-3 sm:px-5">
              <Link
                href="/"
                onClick={close}
                aria-label="Profixter home"
                className="start-screen__brand"
              >
                <Image
                  src="/images/logo-footer.svg"
                  alt="Profixter"
                  width={104}
                  height={22}
                />
              </Link>

              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4A5462] transition hover:bg-[#EEF4FF] hover:text-[#306EEC]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path
                    d="M1 1l16 16M17 1L1 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col px-2 sm:px-3" aria-label="Profixter navigation">
              {PRIMARY_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="start-menu__link"
                  onClick={close}
                >
                  {item.label}
                  <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden="true">
                    <path
                      d="M1 1l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      opacity="0.4"
                    />
                  </svg>
                </Link>
              ))}

              <div className="my-2 h-px bg-[#E6ECF7]" />

              {SECONDARY_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="start-menu__link text-[15px] font-medium text-[#4A5462]"
                  onClick={close}
                >
                  {item.label}
                </Link>
              ))}

              <a
                href={`tel:${PHONE}`}
                className="start-menu__link text-[15px] font-medium text-[#4A5462]"
                onClick={close}
              >
                Call {PHONE_DISPLAY}
              </a>
            </nav>

            {/*
              The two things somebody in a menu is most likely to be looking
              for, kept together at the bottom where a thumb reaches: a way in
              for a stranger, and a way back in for a member.
            */}
            <div className="mt-auto grid gap-2.5 px-4 pt-5 sm:px-5">
              <Link
                href="/signup?source=start-screen"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#306EEC] px-6 text-[16px] font-bold text-white transition hover:bg-[#2059D4]"
                onClick={() => {
                  trackEvent("start_screen_get_started", { placement: "menu" });
                  close();
                }}
              >
                Get Started
              </Link>
              <Link
                href="/signin"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#D7E0F5] px-6 text-[16px] font-bold text-[#172033] transition hover:bg-[#EEF4FF]"
                onClick={close}
              >
                Log In
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
