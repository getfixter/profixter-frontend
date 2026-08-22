"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CUSTOMER_CARE } from "@/lib/fixter";
import { trackEvent } from "@/lib/analytics";

export const INQUIRY_ANCHOR = "#project-inquiry";

/**
 * Analytics for the Kitchen & Bathroom landing page.
 *
 * Everything goes through lib/analytics, which pushes to the same dataLayer
 * GTM-KFPSD2P6 already reads and mirrors to the Meta pixel when one is
 * configured. Nothing here installs a second tag or a second measurement path.
 *
 * `estimate_cta_clicked` is deliberately the event the rest of the site
 * already fires for "homeowner asked about a project" - Book fires it from two
 * placements today - so any trigger built on it keeps working and this page
 * simply becomes another placement. The two genuinely new events are the ones
 * the site had no equivalent for: tapping the phone number, and completing a
 * project inquiry.
 */
export const PAGE_ID = "/kitchen-bathroom";

export function trackInquiryCta(placement: string) {
  trackEvent("estimate_cta_clicked", { placement, page: PAGE_ID });
}

export function trackPhoneCta(placement: string) {
  trackEvent("phone_cta_clicked", { placement, page: PAGE_ID });
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const solid =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#306EEC] px-7 text-[15px] font-bold text-white transition-colors duration-200 hover:bg-[#2558C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC] focus-visible:ring-offset-2";

/** Primary action. Scrolls to the form rather than leaving the page. */
export function InquiryButton({
  placement,
  children = "Discuss Your Project",
  className = "",
}: {
  placement: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={INQUIRY_ANCHOR}
      onClick={() => trackInquiryCta(placement)}
      className={`${solid} ${className}`}
    >
      {children}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12h14m-6-6 6 6-6 6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function PhoneGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 3h3l1.5 4-2 1.3a12 12 0 0 0 5.6 5.6l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Call action.
 *
 * The number comes from CUSTOMER_CARE in lib/fixter, which reads
 * BUSINESS_PHONE_DISPLAY in lib/seo - the same source the header, the footer
 * and the structured data use. Nothing on this page hardcodes a number.
 */
export function CallButton({
  placement,
  tone = "light",
  className = "",
}: {
  placement: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const tones = {
    light:
      "border-[#D6D2C9] bg-white/70 text-[#0C1117] hover:border-[#0C1117] hover:bg-white",
    dark: "border-white/25 bg-transparent text-white hover:border-white/70 hover:bg-white/10",
  };
  return (
    <a
      href={CUSTOMER_CARE.callHref}
      onClick={() => trackPhoneCta(placement)}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full border px-7 text-[15px] font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC] focus-visible:ring-offset-2 ${tones[tone]} ${className}`}
    >
      <PhoneGlyph />
      {CUSTOMER_CARE.phoneDisplay}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky bar                                                          */
/* ------------------------------------------------------------------ */

/**
 * The phone-sized conversion bar.
 *
 * Paid search traffic arrives with intent and no patience for scrolling back
 * up, so the two actions follow them down the page. It is deliberately quiet
 * about it:
 *
 *  - it stays out of the way until the hero is behind them, so the first
 *    impression is the photograph and not a toolbar;
 *  - it steps aside once the inquiry form is on screen, because covering the
 *    form with a button that scrolls to the form is worse than nothing;
 *  - it sits above the site's own bottom navigation rather than over it.
 *
 * Desktop never sees it - there is a call to action in view for most of that
 * page already.
 */
export function StickyInquiryBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const form = document.getElementById("project-inquiry");
    if (!hero || !form) return;

    let heroPassed = false;
    let formShown = false;
    const sync = () => setVisible(heroPassed && !formShown);

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroPassed = !entry.isIntersecting;
        sync();
      },
      { threshold: 0 }
    );
    const formObserver = new IntersectionObserver(
      ([entry]) => {
        formShown = entry.isIntersecting;
        sync();
      },
      { threshold: 0 }
    );

    heroObserver.observe(hero);
    formObserver.observe(form);
    return () => {
      heroObserver.disconnect();
      formObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={[
        "fixed inset-x-0 z-[69] px-3 transition-[opacity,transform] duration-300 motion-reduce:transition-none lg:hidden",
        "bottom-[calc(76px+env(safe-area-inset-bottom,0px))]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
      // Hidden from everything, not just from sight, while it is off screen:
      // opacity-0 alone still leaves both links tabbable.
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="mx-auto flex max-w-[520px] items-center gap-2 rounded-full border border-black/5 bg-[#0C1117]/95 p-1.5 shadow-[0_16px_40px_rgba(12,17,23,0.35)] backdrop-blur-md">
        <a
          href={CUSTOMER_CARE.callHref}
          onClick={() => trackPhoneCta("sticky_bar")}
          className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-4 text-[14px] font-bold text-white transition-colors hover:bg-white/10"
        >
          <PhoneGlyph />
          Call
        </a>
        <a
          href={INQUIRY_ANCHOR}
          onClick={() => trackInquiryCta("sticky_bar")}
          className="flex min-h-[46px] flex-[1.6] items-center justify-center rounded-full bg-[#306EEC] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#2558C9]"
        >
          Discuss your project
        </a>
      </div>
    </div>
  );
}
