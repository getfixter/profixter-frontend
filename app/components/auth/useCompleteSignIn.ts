"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getAutomaticEntryPath, getRoleLandingKind, safeReturnPath } from "@/lib/auth-routing";
import { trackEvent } from "@/lib/analytics";
import { identify } from "@/lib/meta";
import { clearPendingFlow } from "@/lib/auth2";
import type { User } from "@/lib/auth-service";

export type AuthMethod = "phone" | "email" | "google" | "apple" | "password";

/**
 * The one way every method finishes.
 *
 * Session: the token goes to useAuth().login, which stores it and loads
 * /api/auth/me exactly as password login always has, so the rest of the app
 * cannot tell how somebody signed in.
 *
 * Meta: identify() first, then the caller's onCreated (the browser Lead, with
 * the event id minted before the request, relay:false because the server sends
 * the Conversions API copy) - only for a NEW account.
 *
 * Routing: a carried intent (?next=, a pending plan or promo) wins; otherwise a
 * new customer lands on their account and a returning one goes where password
 * sign-in has always sent them. Nobody is forced to pick a plan or an address.
 */
export function useCompleteSignIn() {
  const router = useRouter();
  const { login } = useAuth();

  return useCallback(
    async (input: {
      token: string;
      created: boolean;
      eventId: string;
      method: AuthMethod;
      /* Fires the browser Lead (relay:false) - kept at the call site, see signup/page.tsx. */
      onCreated?: () => void;
    }): Promise<User> => {
      const user = await login(input.token);
      if (!user) throw new Error("We couldn't open your account. Please try again.");

      identify({ email: user.email || undefined, phone: user.phone || undefined });

      if (input.created) {
        trackEvent("signup_completed", { source: "website_signup", method: input.method });
        input.onCreated?.();
      } else {
        trackEvent("login_completed", { method: input.method });
      }

      clearPendingFlow();

      const params = new URLSearchParams(window.location.search);
      const promo = params.get("promo")?.trim().toUpperCase() || sessionStorage.getItem("pendingPromoCode") || "";
      if (promo) sessionStorage.setItem("pendingPromoCode", promo);

      const returnPath = safeReturnPath(params.get("next"));
      let planPending = false;
      try {
        planPending = Boolean(sessionStorage.getItem("pendingCheckoutPlan"));
      } catch {
        planPending = false;
      }

      let destination: string;
      if (returnPath) destination = returnPath;
      else if (getRoleLandingKind(user) !== "customer") destination = getAutomaticEntryPath(user);
      else if (planPending || promo) destination = "/membership";
      else if (input.created) destination = "/account";
      else destination = getAutomaticEntryPath(user);

      router.replace(destination);
      return user;
    },
    [login, router]
  );
}
