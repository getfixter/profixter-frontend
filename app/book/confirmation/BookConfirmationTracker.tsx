"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { trackPurchase } from "@/lib/meta";

export default function BookConfirmationTracker({
  bookingId,
  sessionId,
  value,
  currency,
}: {
  bookingId?: string;
  sessionId?: string;
  /** What Stripe actually charged, in dollars. Omitted if the page cannot say. */
  value?: number;
  currency?: string;
}) {
  useEffect(() => {
    trackEvent("one_time_checkout_returned", {
      page: "/book/confirmation",
      result: "success",
      bookingId: bookingId || "",
      sessionId: sessionId || "",
    });
  }, [bookingId, sessionId]);

  /*
   * The browser half of Purchase, for a single paid visit.
   *
   * THE EVENT ID IS DERIVED, NOT FETCHED. The Stripe webhook sends the server
   * half under `sess_<session id>`, and this page is handed the same session
   * id in its query string - so both sides arrive at the same id with no round
   * trip and nothing stored. Meta collapses the pair into one conversion.
   *
   * NO SESSION ID MEANS NO EVENT. Landing here without one means we cannot
   * prove a payment happened or which one it was, and an unverifiable Purchase
   * is worse than a missing one: it would be counted, optimised against, and
   * wrong. The refresh guard exists for the same reason - a reload is not a
   * second sale.
   *
   * `relay: false` because the webhook already reported this to the
   * Conversions API, with the charged amount and the full customer record.
   */
  useEffect(() => {
    if (!sessionId) return;

    const key = `pf_purchase_fired_${sessionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* Blocked storage means we may double-fire on a manual reload, which is
         better than never firing at all. Meta still dedupes on the event id. */
    }

    trackPurchase(
      {
        value: typeof value === "number" && Number.isFinite(value) ? value : 0,
        currency: currency || "USD",
        content_name: "one_time_visit",
        content_type: "product",
        booking_id: bookingId || undefined,
      },
      { eventId: `sess_${sessionId}`, relay: false }
    );
  }, [sessionId, bookingId, value, currency]);

  return null;
}
