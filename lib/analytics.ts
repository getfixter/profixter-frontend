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

/*
 * The few product events that are also worth sending to Meta.
 *
 * Every trackEvent used to be mirrored to fbq('trackCustom'), so Meta received
 * each date tap, time tap and photo added - dozens of custom events per visit
 * that no campaign optimises on, burying the funnel steps that matter. The
 * dataLayer still receives every event exactly as before; Meta now receives
 * only these. Conversions (Lead, Schedule, Subscribe, Purchase) and StartSignup
 * are sent from lib/meta.ts, never from here.
 */
const META_CUSTOM_EVENTS = new Set(["plan_selected", "out_of_area_waitlist"]);

export function trackEvent(event: string, params?: EventParams) {
  if (typeof window === "undefined") return;

  pushDataLayer(event, params);

  /*
   * Transition: until the live campaigns are verified not to use them (custom
   * conversions or audiences built on these events), every event still reaches
   * Meta as before. NEXT_PUBLIC_META_LEGACY_FREE_VISIT_LEAD=false ends both
   * legacy behaviours together (see trackSchedule in lib/meta.ts).
   */
  const legacy = process.env.NEXT_PUBLIC_META_LEGACY_FREE_VISIT_LEAD !== "false";
  if ((legacy || META_CUSTOM_EVENTS.has(event)) && typeof window.fbq === "function") {
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
