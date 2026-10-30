"use client";

/**
 * The signed-in parts of the homepage (2026-10-30).
 *
 *  - MemberPromo: a registered customer without an active membership gets one
 *    compact invitation to explore memberships; a former member gets the
 *    renewal wording instead; a member whose renewal failed is sent to fix the
 *    payment, never to buy again. Never shown to a member. No offers or prices are
 *    invented here - it only points at the plans page.
 *  - HomeExtras: a short row of other things Profixter does, for signed-in
 *    customers. Links only, to pages that already exist.
 *
 * Both render nothing until the membership status is known, so a member never
 * sees a "become a member" flash, and a former member never sees the
 * first-timer copy (see HomePageClient for the page-level gate).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMySubscriptions } from "@/lib/booking-service";
import { trackEvent } from "@/lib/analytics";
import { BOOKING_LINKS } from "@/lib/site-architecture";
import Reveal from "@/app/components/ui/Reveal";

const ENDED = ["canceled", "cancelled", "expired", "incomplete_expired"];
/* Stripe is still retrying the renewal: the membership has not ended. */
const PAYMENT_ATTENTION = ["past_due", "unpaid"];

/**
 * "member" never reaches here; "attention" has a renewal that failed and is
 * still being retried; "lapsed" had a membership that ended; "none" never had one.
 */
type Standing = "none" | "lapsed" | "attention";

function useStanding(enabled: boolean): Standing | null {
  const [standing, setStanding] = useState<Standing | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getMySubscriptions()
      .then((data) => {
        if (cancelled) return;
        const statuses = (data?.subscriptions || []).map((s) => String(s.status || "").toLowerCase());
        if (statuses.some((status) => PAYMENT_ATTENTION.includes(status))) setStanding("attention");
        else setStanding(statuses.some((status) => ENDED.includes(status)) ? "lapsed" : "none");
      })
      .catch(() => {
        // Unknown history reads as never-a-member: the first-timer wording is still true enough.
        if (!cancelled) setStanding("none");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return standing;
}

export function MemberPromo() {
  const standing = useStanding(true);
  if (!standing) return null;
  const lapsed = standing === "lapsed";
  const copy =
    standing === "attention"
      ? {
          title: "Your membership payment needs attention.",
          text: "Update your payment to start booking visits again. No need to buy a new membership.",
          cta: "Update Payment",
          href: "/account?tab=plan",
        }
      : lapsed
        ? { title: "Welcome back. Your handyman is ready.", text: "Restart a monthly handyman membership any time.", cta: "See Memberships", href: "/membership/plans" }
        : { title: "Your home deserves a dedicated handyman.", text: "Explore our monthly handyman memberships.", cta: "Explore Memberships", href: "/membership/plans" };
  return (
    <section className="hm-promo-wrap" aria-labelledby="hm-promo">
      <div className="ui-container">
        <div className="hm-promo ui-rise" data-home-promo={standing}>
          <div className="min-w-0">
            <h2 id="hm-promo" className="hm-promo__title">
              {copy.title}
            </h2>
            <p className="hm-promo__text">{copy.text}</p>
          </div>
          <Link
            href={copy.href}
            className="ui-btn ui-btn--primary hm-promo__cta"
            onClick={() => trackEvent("home_member_promo", { standing })}
          >
            {copy.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

const EXTRAS = [
  {
    key: "gift",
    title: "Gift Profixter",
    text: "Give someone 1–12 months of handyman help.",
    cta: "Send a Gift",
    href: "/gift",
    icon: (
      <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1zm0 0c1.5-3 5-3 5-1s-3 1-5 1z" />
    ),
  },
  {
    key: "kitchen-bath",
    title: "Kitchen & Bathroom",
    text: "Thinking about improving your kitchen or bathroom?",
    cta: "Explore Services",
    href: "/kitchen-bathroom",
    icon: <path d="M5 12h14v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5zM7 12V6a2 2 0 0 1 4 0M8 19l-1 2M16 19l1 2" />,
  },
  {
    key: "full-day",
    title: "Full Day Service",
    text: "More projects? Book a full day of help.",
    cta: "Explore Full Day",
    href: BOOKING_LINKS.fullDay.href,
    icon: <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
  },
] as const;

export function HomeExtras() {
  return (
    <section className="ui-section ui-section--tight" aria-labelledby="hm-extras">
      <div className="ui-container">
        <h2 id="hm-extras" className="hm-extras__title">
          More from Profixter
        </h2>
        <ul className="hm-extras">
          {EXTRAS.map((x, i) => (
            <Reveal as="li" key={x.key} delay={i * 60} className="hm-extra">
              <Link href={x.href} className="hm-extra__link" onClick={() => trackEvent("home_extra", { card: x.key })} data-home-extra={x.key}>
                <span className="hm-extra__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {x.icon}
                  </svg>
                </span>
                <span className="hm-extra__title">{x.title}</span>
                <span className="hm-extra__text">{x.text}</span>
                <span className="hm-extra__cta">
                  {x.cta} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
