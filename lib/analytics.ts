"use client";

type EventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

function pushDataLayer(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...(params || {}) });
}

export function trackEvent(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;

  pushDataLayer(event, params);

  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", event, params || {});
  }
}

export function trackInitiateCheckout(params?: EventParams) {
  if (typeof window === "undefined") return;

  pushDataLayer("initiate_checkout", params);

  if (typeof window.fbq === "function") {
    window.fbq("track", "InitiateCheckout", params || {});
    window.fbq("trackCustom", "initiate_checkout", params || {});
  }
}

/*
 * trackPurchase used to live here and has been removed.
 *
 * It fired fbq('track','Purchase') with no eventID, so Meta had no way to
 * recognise it as the same conversion the server was also reporting, and every
 * sale was counted twice. It was also being used for memberships, which are
 * Subscribe, not Purchase.
 *
 * Conversions - Lead, Subscribe, Purchase - now live in lib/meta.ts, which
 * mints the shared event id and mirrors each one to the Conversions API.
 * Import from there. This module keeps the non-conversion product analytics
 * that only ever needed to reach the dataLayer.
 */
