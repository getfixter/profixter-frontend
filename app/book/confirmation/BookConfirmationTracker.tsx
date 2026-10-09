"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { trackPurchase } from "@/lib/meta";
import { getAllBookings, getFullDayConfig, getOneTimeVisitConfig } from "@/lib/booking-service";

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
   * The browser half of Purchase, for a single paid visit: a One-Time Visit or
   * a Full Day. Both checkouts return to this page.
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
   * WHICH VISIT, AND WHAT IT COST, COME FROM THE SERVER. This used to say
   * "one_time_visit" with a value of 0 for everything, so a paid Full Day was
   * reported as a One-Time Visit worth nothing. The booking named in the URL
   * is read back from the customer's own bookings (its bookingType is set when
   * the checkout is created), and the price from that product's public config.
   * Neither checkout accepts promotion codes - each is one fixed Stripe Price -
   * so the configured price is the amount charged. If the booking cannot be
   * read, the event still fires, as a "paid_visit" with no value, rather than
   * guessing which product it was.
   *
   * RELAY. The webhook reports a One-Time Visit to the Conversions API itself,
   * with Stripe's amount and the full customer record, so that one is
   * relay: false. It reports no Purchase for a Full Day, so a Full Day is
   * relayed from here under the same derived id - if the webhook ever starts
   * sending it too, Meta still counts one.
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

    void (async () => {
      let kind: "one_time_visit" | "full_day_visit" | "paid_visit" = "paid_visit";
      let price: number | undefined;
      let priceCurrency: string | undefined;
      try {
        if (bookingId) {
          const bookings = await getAllBookings();
          const booking = bookings.find((b) => b._id === bookingId || b.bookingNumber === bookingId);
          if (booking?.bookingType === "full_day_visit") kind = "full_day_visit";
          else if (booking?.bookingType === "one_time_handyman_visit") kind = "one_time_visit";
        }
        if (kind !== "paid_visit") {
          const config = kind === "full_day_visit" ? await getFullDayConfig() : await getOneTimeVisitConfig();
          if (Number.isFinite(config?.priceCents) && config.priceCents > 0) {
            price = config.priceCents / 100;
            priceCurrency = config.currency ? String(config.currency).toUpperCase() : undefined;
          }
        }
      } catch {
        /* Signed out, or the API is unreachable: fire only what we can prove. */
      }

      const explicit = typeof value === "number" && Number.isFinite(value) ? value : undefined;
      trackPurchase(
        {
          value: explicit ?? price ?? 0,
          currency: currency || priceCurrency || "USD",
          content_name: kind,
          content_type: "product",
          booking_id: bookingId || undefined,
        },
        { eventId: `sess_${sessionId}`, relay: kind === "full_day_visit" ? undefined : false }
      );
    })();
  }, [sessionId, bookingId, value, currency]);

  return null;
}
