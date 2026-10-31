"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

/**
 * The phone-only call to action that slides up once the visitor has scrolled
 * past the first screen of a membership page.
 *
 * It sits directly above the tab bar when there is one (signed-in customers,
 * see CustomerSiteMobileNav) and on the bottom edge when there is not.
 */
export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr: { hasActiveSubscription?: boolean }) => addr.hasActiveSubscription);

  useEffect(() => {
    const threshold = window.innerHeight * 0.8;
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* html.has-sticky-cta lifts the support chat button clear of this bar. */
  const showing = visible && !isSubscribed;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-sticky-cta", showing);
    return () => root.classList.remove("has-sticky-cta");
  }, [showing]);

  if (isSubscribed) return null;

  return (
    <div
      className={`sticky-cta lg:hidden ${isAuthenticated ? "sticky-cta--above-tabs" : ""} ${visible ? "is-visible" : ""}`}
      aria-hidden={!visible}
      inert={!visible}
    >
      {isAuthenticated ? (
        <Link href="/membership/plans" className="ui-btn ui-btn--primary ui-btn--block">
          See plans, from $149/mo
        </Link>
      ) : (
        /* Cold traffic gets the offer, not an account chore. */
        <Link href="/book/free" className="ui-btn ui-btn--primary ui-btn--block sticky-cta__offer">
          <span>Book your free visit</span>
          <span className="sticky-cta__note">We go over your to-do list · No account needed</span>
        </Link>
      )}
    </div>
  );
}
