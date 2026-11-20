"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";
import { getMyReferrals, popupDue, rememberPopup, REFERRAL_CARD_PATH, type MyReferrals } from "@/lib/referral";
import ReferralPopup from "./ReferralPopup";

/**
 * The referral popup for EVERYONE on the public site (owner 2026-11-20): signed-out visitors, members and non-members.
 *
 * - Once per browser: it opens by itself on the next visit, and then not again for 30 days, whether it was closed,
 *   used or just seen (lib/referral popupDue / rememberPopup). The Account's "Refer a friend" card opens it any time.
 * - Signed in (customers): "Share my link" - the share sheet, else Copy link. Signed out: "Get my referral link" ->
 *   sign in or create an account -> the referral card (/account?referrals=1). No membership needed. Staff: never.
 * - Never in the way: not over the welcome flow, booking and checkout pages, sign-in, payment / signing links, the
 *   compliance pages or Admin; never while another dialog is open (it waits and opens after that one closes), and
 *   never while somebody is typing in a field.
 */

const NEVER_PREFIXES = [
  "/admin",
  "/event",
  "/signin",
  "/signup",
  "/forgot-password",
  "/confirmationpage",
  "/book",
  "/membership",
  "/start",
  "/pay",
  "/tip",
  "/sign",
  "/visit",
  "/gift/claim",
  "/team-setup",
  "/privacy",
  "/terms",
  "/communication-consent",
  "/sms-consent-example",
  "/halloween",
  "/r",
];

export function popupAllowedOn(pathname: string, search: string): boolean {
  if (NEVER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  // Arriving at the referral card from "Get my referral link": they already have it.
  if (pathname === "/account" && new URLSearchParams(search).get("referrals") === "1") return false;
  return true;
}

/** Something else has the screen: an open dialog, the welcome flow, a field being typed in. */
function busy(): boolean {
  if (document.documentElement.getAttribute("data-pf-welcome") === "1") return true;
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)) return true;
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"]')].some((d) => {
    if (d.closest("[data-referral-popup]")) return false;
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  });
}

const FIRST_LOOK_MS = 1800;
const RECHECK_MS = 800;
/** Once free, a short breath after another dialog closes before this one opens. */
const AFTER_OTHER_MS = 700;

export default function SiteReferralPopup() {
  const pathname = usePathname() || "/";
  const { user, isAuthenticated, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MyReferrals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const staff = Boolean(user && (isAdminUser(user) || (user as { role?: string }).role === "employee"));

  // Open by itself once: when allowed here, due, and nothing else has the screen.
  useEffect(() => {
    if (isLoading || staff || open) return;
    if (!popupAllowedOn(pathname, window.location.search) || !popupDue()) return;
    let wasBusy = false;
    // Somebody already using a form or a booking widget on this page is never interrupted: a later page or visit.
    let engaged = false;
    const FORMISH = "form, input, textarea, select, [data-home-booking], [data-handyman-booker], [data-free-visit-form]";
    const onUse = (e: Event) => {
      const t = e.target as Element | null;
      if (t && typeof t.closest === "function" && t.closest(FORMISH) && !t.closest("[data-referral-popup]")) engaged = true;
    };
    document.addEventListener("pointerdown", onUse, true);
    document.addEventListener("keydown", onUse, true);
    let timer = window.setTimeout(function look() {
      if (engaged || !popupAllowedOn(window.location.pathname, window.location.search) || !popupDue()) return;
      if (busy()) {
        wasBusy = true;
        timer = window.setTimeout(look, RECHECK_MS);
        return;
      }
      if (wasBusy) {
        wasBusy = false;
        timer = window.setTimeout(look, AFTER_OTHER_MS);
        return;
      }
      rememberPopup();
      setOpen(true);
    }, FIRST_LOOK_MS);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onUse, true);
      document.removeEventListener("keydown", onUse, true);
    };
  }, [pathname, isLoading, staff, open]);

  // A signed-in customer's link (loaded when the popup opens).
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getMyReferrals());
    } catch {
      setError("Your link couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (open && isAuthenticated && !data && !loading) void load();
  }, [open, isAuthenticated, data, loading, load]);

  const close = useCallback(() => {
    rememberPopup();
    setOpen(false);
  }, []);

  if (staff) return null;
  return (
    <ReferralPopup
      open={open}
      onClose={close}
      data={data}
      loading={loading}
      error={error}
      onRetry={load}
      signedOut={!isLoading && !isAuthenticated}
      onGetLink={() => {
        rememberPopup();
        setOpen(false);
      }}
    />
  );
}

export { REFERRAL_CARD_PATH };
