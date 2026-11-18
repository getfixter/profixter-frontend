"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { trackPurchase } from "@/lib/meta";
import { confirmPaidConversion, provePaidVisit } from "@/lib/chatgpt-ads";

export default function BookConfirmationTracker({
  bookingId,
  sessionId,
}: {
  bookingId?: string;
  sessionId?: string;
  /** Accepted for the page's call; the amount now comes from the server's proof. */
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
   * half under `sess_<session id>` for both products, so the pair is one
   * conversion in Meta.
   *
   * PROVEN, NOT ASSUMED (2026-11-17). This used to fire for any session id in
   * the URL, with a list price: a made-up, unpaid or someone else's session
   * was a Purchase Meta could not deduplicate (the webhook never sent its
   * half). It now fires only once the server confirms THIS session is a paid
   * purchase of the signed-in customer (the same proof ChatGPT Ads uses), with
   * Stripe's amount. Signed out or refused: no browser event - the webhook's
   * server event still stands on its own. The guard is set only after a
   * proven fire, so a slow webhook is waited for, and a reload never fires twice.
   *
   * RELAY: never. The webhook already reported it, with the full customer record.
   */
  useEffect(() => {
    if (!sessionId) return;
    const key = `pf_purchase_fired_${sessionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* Blocked storage: Meta still dedupes a repeat on the event id. */
    }
    let cancelled = false;
    void (async () => {
      const proof = await provePaidVisit(sessionId, () => cancelled);
      if (cancelled || proof.state !== "ok") return;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* see above */
      }
      const kind = proof.data.product === "full_day" ? "full_day_visit" : "one_time_visit";
      trackPurchase(
        {
          value: proof.data.amountCents / 100,
          currency: proof.data.currency || "USD",
          /*
           * Transition: a Full Day used to be labelled one_time_visit. Until the
           * campaigns are verified, paid visits keep that label (so a custom
           * conversion filtering on it still counts them) and the real kind
           * travels in visit_type. The legacy switch off sends the real name.
           */
          content_name: process.env.NEXT_PUBLIC_META_LEGACY_FREE_VISIT_LEAD !== "false" ? "one_time_visit" : kind,
          visit_type: kind,
          content_type: "product",
          booking_id: bookingId || undefined,
        },
        { eventId: `sess_${sessionId}`, relay: false }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, bookingId]);

  /*
   * ChatGPT Ads order_created. Stricter than the Meta event above: it fires
   * only once the server confirms THIS Stripe session is a paid purchase of
   * the signed-in customer (GET /api/track/paid-visit-by-session: our webhook
   * marked it paid AND Stripe reports it complete and paid), with Stripe's
   * amount in cents. A URL with a made-up, unpaid, refunded or someone else's
   * session sends nothing. event_id is the session id, so a refresh, a second
   * tab or a late retry is still one order. Returned signed out: the session is
   * parked and proven after the next sign-in on this browser (see
   * confirmPaidConversion).
   */
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void confirmPaidConversion("order", sessionId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return null;
}
