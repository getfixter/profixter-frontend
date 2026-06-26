"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function BookConfirmationTracker({
  bookingId,
  sessionId,
}: {
  bookingId?: string;
  sessionId?: string;
}) {
  useEffect(() => {
    trackEvent("one_time_checkout_returned", {
      page: "/book/confirmation",
      result: "success",
      bookingId: bookingId || "",
      sessionId: sessionId || "",
    });
  }, [bookingId, sessionId]);

  return null;
}
