"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getNextBooking } from "@/lib/booking-service";

/**
 * Whether this customer can still have their first visit free.
 *
 * The check itself is not new: it is the same getNextBooking call the
 * membership page has always made, lifted out so Book can ask the same
 * question and get the same answer. Two copies of an eligibility rule is how a
 * site ends up promising a free visit on one page and refusing it on the next.
 *
 * "loading" is a real state and callers must render it as such. Treating it as
 * eligible would flash an offer we cannot honour; treating it as ineligible
 * would hide one the customer is entitled to.
 */
/*
 * "needs_address": signed in, not a member, and no home on file yet. Not an
 * answer about eligibility - the server cannot be asked until there is an
 * address - so callers show the offer with an "add your home" step. Adding the
 * home refreshes `user`, which re-runs this hook and gets the real answer.
 */
export type FreeVisitState = "loading" | "eligible" | "consumed" | "ineligible" | "needs_address";

export function useFreeVisitEligibility(): FreeVisitState {
  const { user, isAuthenticated, isLoading } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

  const [state, setState] = useState<FreeVisitState>("loading");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (isLoading) return;

      // A member is not a prospect, and an anonymous visitor has no property to
      // check yet. Neither one gets the offer from here.
      if (!isAuthenticated || isSubscribed) {
        if (!cancelled) setState("ineligible");
        return;
      }

      const addressId =
        (user as { defaultAddressId?: string | null })?.defaultAddressId ||
        user?.addresses?.[0]?._id;

      if (!addressId) {
        if (!cancelled) setState("needs_address");
        return;
      }

      try {
        const data = await getNextBooking(String(addressId));
        if (cancelled) return;
        if (data?.freeFirstVisitAvailable) setState("eligible");
        else if (data?.introVisitStatus === "consumed") setState("consumed");
        else setState("ineligible");
      } catch {
        // Fail closed: never advertise an offer we could not confirm.
        if (!cancelled) setState("ineligible");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, isSubscribed, user]);

  return state;
}
