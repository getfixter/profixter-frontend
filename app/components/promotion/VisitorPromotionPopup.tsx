"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import {
  getActivePromotionPopup,
  type PromotionPopup,
} from "@/lib/promotion-popup";
import PromotionPopupCard from "./PromotionPopupCard";

const DISMISSED_KEY = "profixter_promotion_popup_dismissed_date";
const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/signin",
  "/signup",
  "/forgot-password",
  "/confirmationpage",
];

/*
 * Pages a promotion may never cover.
 *
 * These four are the compliance surface: the privacy policy, the terms, the
 * SMS terms, and the page that shows a carrier reviewer how consent is
 * collected. A reviewer opening the privacy policy to check our
 * mobile-information language was being shown a modal offering 10% off a gift
 * membership, 700ms after load, on top of the document they came to read.
 *
 * That is bad for a customer looking up how to opt out, and it is worse for
 * review: an overlay selling something on a consent page is the visual
 * definition of the thing A2P vetting is looking for. These pages carry no
 * marketing of any kind now, and that includes what floats above them.
 */
const COMPLIANCE_PATHS = [
  "/privacy",
  "/terms",
  "/communication-consent",
  "/sms-consent-example",
];

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/*
 * The homepage is not a place to interrupt.
 *
 * A first-time visitor arrived at profixter.com and, 700ms later, was asked to
 * buy a handyman membership as a gift for somebody else - before they had read
 * a single line about what a handyman membership is. That is the one page where
 * a stranger is still working out what this company does, and an overlay is the
 * most expensive thing you can put in front of that.
 *
 * The mechanism is untouched and still admin-configurable: promotions continue
 * to run on every other public page, and the Gift product keeps its own page and
 * its footer entry. Only the cold-arrival ambush is gone.
 */
function targetMatches(popup: PromotionPopup, pathname: string) {
  if (PRIVATE_PATHS.some((path) => pathname.startsWith(path))) return false;
  if (COMPLIANCE_PATHS.some((path) => pathname.startsWith(path))) return false;
  if (pathname === "/") return false;
  return popup.target === "all_public";
}

export default function VisitorPromotionPopup() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const [popup, setPopup] = useState<PromotionPopup | null>(null);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, localDateKey());
    setVisible(false);
  }, []);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (localStorage.getItem(DISMISSED_KEY) === localDateKey()) return;

    let cancelled = false;
    void getActivePromotionPopup()
      .then((activePopup) => {
        if (
          cancelled ||
          !activePopup ||
          !targetMatches(activePopup, pathname)
        ) {
          return;
        }
        setPopup(activePopup);
        window.setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 700);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, pathname]);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [dismiss, visible]);

  if (
    isLoading ||
    isAuthenticated ||
    !visible ||
    !popup ||
    !targetMatches(popup, pathname)
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/35 px-3 py-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-popup-title"
        tabIndex={-1}
        className="w-full max-w-[460px] outline-none"
      >
        <PromotionPopupCard popup={popup} onClose={dismiss} onAction={dismiss} />
      </div>
    </div>
  );
}
