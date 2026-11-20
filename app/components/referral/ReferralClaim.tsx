"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/useAuth";
import { claimReferral, clearReferral, getReferral } from "@/lib/referral";

/**
 * A signed-in browser that holds a friend's referral code (lib/referral) hands
 * it to the server once: a friend who signed in rather than signed up, or who
 * opened the link after creating an account, is still recorded before they buy.
 * The server decides (first referral wins, never your own link, never someone
 * who already had a membership); the browser forgets the code once it has an
 * answer, and keeps it when the call failed so the next page can try again.
 *
 * Renders nothing.
 */
export default function ReferralClaim() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const tried = useRef("");

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    const held = getReferral();
    if (!held) return;
    const key = `${String((user as { _id?: string })._id || "")}:${held.code}`;
    if (tried.current === key) return;
    tried.current = key;
    void claimReferral(held)
      .then(() => clearReferral())
      .catch(() => {
        /* network or server trouble: kept for the next page */
      });
  }, [isAuthenticated, isLoading, user]);

  return null;
}
