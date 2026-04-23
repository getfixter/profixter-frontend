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

export function trackPurchase(params?: EventParams) {
  if (typeof window === "undefined") return;

  pushDataLayer("purchase", params);

  if (typeof window.fbq === "function") {
    window.fbq("track", "Purchase", params || {});
    window.fbq("trackCustom", "purchase", params || {});
  }
}
