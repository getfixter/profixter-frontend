"use client";

/**
 * Microsoft Clarity custom events for the booking funnel (2026-11-17).
 *
 * Clarity is loaded by the agency's GTM container (tag 4, project u5lnatsuyv);
 * this file never loads it, never changes its settings and does nothing where
 * it is not running (admin, payment links, tips, signing pages). It only
 * names four moments, so a Clarity funnel and recording filters can find
 * them. Our own funnel counts (lib/meta trackStep) stay the numbers; Clarity
 * is for watching what happened.
 *
 * THE EVENTS. One name per moment and visit type, because a Clarity event is
 * a name only:
 *
 *   booking_started_<type>           first interaction with the booker
 *   booking_details_completed_<type> every required detail given, about to
 *                                    submit or pay (Handyman/Full Day: contact
 *                                    and time done; Free Visit: review sheet open)
 *   booking_request_submitted_<type> the server accepted the request / opened
 *                                    the paid checkout
 *   booking_payment_confirmed_<type> the server reports the payment recorded
 *
 *   <type> = free_visit | handyman | full_day
 *
 * Plus a session tag, booking_type=<type>, so recordings filter by it.
 *
 * NOTHING PERSONAL, EVER: no names, contacts, addresses, job text, photos,
 * payment links or tokens - only these fixed names. Success events fire only
 * after the server has said so, and each fires at most once per page load (and
 * once per id for submissions and payments, across reloads in this tab).
 */

export type ClarityVisitType = "free_visit" | "handyman" | "full_day";
export type ClarityMoment = "booking_started" | "booking_details_completed" | "booking_request_submitted" | "booking_payment_confirmed";

type ClarityFn = (...args: unknown[]) => void;
const fired = new Set<string>();

/*
 * Clarity's own queue stub (the same one its snippet and the GTM template
 * define): a call made before clarity.js has loaded waits in clarity.q and is
 * replayed when it does. Where Clarity never loads, the queue is never read.
 */
function clarity(): ClarityFn | null {
  try {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { clarity?: ClarityFn & { q?: unknown[] } };
    if (typeof w.clarity !== "function") {
      const stub = function (...args: unknown[]) {
        (stub.q = stub.q || []).push(args);
      } as ClarityFn & { q?: unknown[] };
      // Created with its queue: clarity.js reads (and unshifts into) clarity.q as soon as it loads.
      stub.q = [];
      w.clarity = stub;
    }
    return w.clarity as ClarityFn;
  } catch {
    return null;
  }
}

/** The event name for a moment, e.g. booking_request_submitted_handyman. */
export function clarityEventName(moment: ClarityMoment, type: ClarityVisitType): string {
  return `${moment}_${type}`;
}

/**
 * Record one funnel moment. `onceKey`, when given (a booking id, a session
 * id), also stops a repeat across reloads of this tab: a refreshed success
 * page is not a second success.
 */
export function clarityBookingEvent(moment: ClarityMoment, type: ClarityVisitType, onceKey?: string): boolean {
  const name = clarityEventName(moment, type);
  const key = `${name}|${onceKey || ""}`;
  if (fired.has(key)) return false;
  if (onceKey) {
    try {
      const store = `pf_clarity_${name}`;
      const seen = window.sessionStorage.getItem(store) || "";
      if (seen.split(",").includes(onceKey)) {
        fired.add(key);
        return false;
      }
      window.sessionStorage.setItem(store, [seen, onceKey].filter(Boolean).join(",").slice(-2000));
    } catch {
      /* storage blocked: the in-memory guard still applies */
    }
  }
  fired.add(key);
  const fn = clarity();
  if (!fn) return false;
  try {
    fn("set", "booking_type", type);
    fn("event", name);
    return true;
  } catch {
    return false;
  }
}

/* For tests only. */
export function _resetClarityGuards() {
  fired.clear();
}
