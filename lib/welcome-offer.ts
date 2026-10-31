"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import API from "@/lib/api";

/*
 * The new-customer welcome offer (Customer Experience 4.2): 20% off the first
 * month of a monthly membership, for ten minutes after the account is created.
 *
 * Every decision is the server's (GET /api/stripe/checkout/welcome-offer, and
 * again when checkout opens). The page only counts down: from the server's
 * expiresAt, measured against the server's own clock (serverNow), so a wrong
 * clock on the phone cannot lengthen or shorten it, and a reload asks again
 * and gets the same expiry back - it never restarts.
 *
 * Nothing is shown to anyone the server did not call eligible, and nothing is
 * shown once the time is up.
 */

export type WelcomePlanPrice = { monthlyCents: number; firstMonthCents: number };
export type WelcomeOffer = {
  active: boolean;
  percentOff: number;
  /** Milliseconds left, ticking. 0 when inactive. */
  remainingMs: number;
  plans: Record<string, WelcomePlanPrice>;
  /** Ask the server again (after a refusal at checkout, say). */
  refresh: () => void;
};

type ServerOffer = {
  eligible: boolean;
  serverNow?: string;
  expiresAt?: string;
  percentOff?: number;
  plans?: Record<string, WelcomePlanPrice>;
};

export const WELCOME_OFFER_ERROR_CODES = ["WELCOME_OFFER_ENDED", "WELCOME_OFFER_UNAVAILABLE"];

export function formatCents(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars.toLocaleString("en-US")}` : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * @param enabled  only for a signed-in customer (the endpoint needs the account)
 * @param address  the home being priced, so a house that already had a membership is never shown the offer
 */
export function useWelcomeOffer(enabled: boolean, address?: { addressId?: string; line1?: string; zip?: string } | null): WelcomeOffer {
  const [server, setServer] = useState<{ deadline: number; received: number; percentOff: number; plans: Record<string, WelcomePlanPrice> } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const askedAt = useRef(0);
  const addressId = address?.addressId || "";
  const line1 = address?.line1 || "";
  const zip = address?.zip || "";

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const params = new URLSearchParams();
    if (addressId) params.set("addressId", addressId);
    else if (line1 && zip) {
      params.set("line1", line1);
      params.set("zip", zip);
    }
    const sent = Date.now();
    askedAt.current = sent;
    API.get<ServerOffer>(`/api/stripe/checkout/welcome-offer${params.toString() ? `?${params}` : ""}`)
      .then(({ data }) => {
        if (!alive || askedAt.current !== sent) return;
        if (!data?.eligible || !data.expiresAt || !data.serverNow || !data.plans) return setServer(null);
        // Where the server's clock was when it answered, on this device's clock (half the round trip).
        const received = Date.now();
        const skew = Date.parse(data.serverNow) - (sent + received) / 2;
        const deadline = Date.parse(data.expiresAt) - skew;
        setServer(deadline > received ? { deadline, received, percentOff: data.percentOff || 20, plans: data.plans } : null);
      })
      .catch(() => alive && setServer(null));
    return () => {
      alive = false;
    };
  }, [enabled, addressId, line1, zip, tick]);

  // Coming back to the tab: ask again, the server may have changed its mind (a purchase in another tab).
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  const live = enabled ? server : null;
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  // Never earlier than the answer itself, so a clock last read before it arrived cannot add time.
  const remainingMs = live ? Math.max(0, live.deadline - Math.max(now, live.received)) : 0;
  const active = Boolean(live) && remainingMs > 0;
  return { active, percentOff: live?.percentOff || 20, remainingMs: active ? remainingMs : 0, plans: active && live ? live.plans : {}, refresh };
}
