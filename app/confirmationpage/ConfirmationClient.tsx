"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { trackSubscribe } from "@/lib/meta";
import YourFixter from "@/app/components/fixter/YourFixter";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { getMySubscriptions, type ManagedSubscription } from "@/lib/subscription-service";

/**
 * The moment after paying.
 *
 * This page used to announce "Your Membership is active" the instant Stripe
 * redirected here, and its only button went to /book?visit=membership. But
 * activation happens on a webhook, and /book shows the membership SALES gateway
 * to anybody it does not yet recognise as a member. So a customer could pay
 * $149 to $499, be congratulated, press the one button on the page, and be
 * invited to become a member.
 *
 * Nothing about Stripe or the webhook changed. The page simply stops asserting
 * a state it has not confirmed: it asks the same subscriptions endpoint Account
 * uses until the membership actually appears, and only then congratulates
 * anybody or offers the booking button. The claim now follows the fact.
 */

const ACTIVE_STATUSES = ["active", "trialing"];

/** How long to keep asking before saying so honestly. */
const CONFIRM_TIMEOUT_MS = 45_000;

/**
 * Gentle backoff. Webhooks usually land in a second or two, so the first few
 * checks are quick; after that there is no point hammering an endpoint that is
 * waiting on Stripe.
 */
const POLL_STEPS_MS = [900, 900, 1200, 1800, 2500, 3500, 4500, 6000];

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  plus: "Plus",
  premium: "Premium",
  elite: "Elite",
};

function isLive(subscription: ManagedSubscription) {
  return ACTIVE_STATUSES.includes(String(subscription.status || "").toLowerCase());
}

/** Street line for the property this membership belongs to, if we have one. */
function propertyLine(subscription: ManagedSubscription): string {
  const source = subscription.address || subscription.addressSnapshot || null;
  if (!source) return "";
  const parts = [source.line1, source.city, source.state].filter(Boolean);
  return parts.join(", ");
}

type Phase = "confirming" | "confirmed" | "slow";

export default function ConfirmationClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [phase, setPhase] = useState<Phase>("confirming");
  const [subscription, setSubscription] = useState<ManagedSubscription | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startedAt = useRef<number>(Date.now());
  const cancelled = useRef(false);

  const handleBookClick = () => {
    // The member has just paid and this is their first included visit, so it
    // goes to Book like every other booking action now does.
    window.location.href = "/book?visit=membership";
  };

  /* ------------------------------------------------ activation reconciliation */
  const confirmMembership = useCallback(async () => {
    startedAt.current = Date.now();
    cancelled.current = false;
    setPhase("confirming");

    for (let step = 0; ; step += 1) {
      if (cancelled.current) return;

      try {
        const { subscriptions } = await getMySubscriptions();
        const live = (subscriptions || []).filter(isLive);
        if (live.length) {
          /*
           * Newest first: somebody adding a second property should be shown the
           * membership they just bought, not the one they already had.
           */
          const newest = [...live].sort((a, b) => {
            const at = new Date(a.startDate || 0).getTime();
            const bt = new Date(b.startDate || 0).getTime();
            return bt - at;
          })[0];
          if (!cancelled.current) {
            setSubscription(newest);
            setPhase("confirmed");
          }
          return;
        }
      } catch {
        /* A failed read is not a failed payment. Keep waiting, then say so. */
      }

      if (cancelled.current) return;
      if (Date.now() - startedAt.current > CONFIRM_TIMEOUT_MS) {
        if (!cancelled.current) setPhase("slow");
        return;
      }

      const wait = POLL_STEPS_MS[Math.min(step, POLL_STEPS_MS.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }, []);

  useEffect(() => {
    document.body.style.opacity = "1";
    void confirmMembership();
    return () => {
      cancelled.current = true;
    };
  }, [confirmMembership, attempt]);

  /* ------------------------------------------------------------- attribution */
  /*
   * The browser half of the Subscribe conversion.
   *
   * SUBSCRIBE, NOT PURCHASE. This page fired Purchase for a started membership,
   * and so did the Stripe webhook, which put recurring memberships in the same
   * bucket as one-off visit payments. Purchase now means a single paid visit
   * and nothing else.
   *
   * THE VALUE IS NEVER INVENTED. It is read back from the checkout the server
   * recorded, so it is the amount actually charged - $149/$249/$349/$499 on
   * monthly, ten months' worth on annual - rather than a price looked up from a
   * table the page happens to hold.
   *
   * THE EVENT ID COMES FROM THE SERVER. The webhook already reported this
   * membership to the Conversions API under an id generated when the checkout
   * was created. Reusing it here is what makes Meta treat the two as one
   * conversion; minting a fresh one would double-count every sale. That id
   * only began persisting when the User schema stopped discarding it, so the
   * request is still allowed to come back without one - in which case this
   * fires alone, which is the behaviour that has always been in place.
   */
  useEffect(() => {
    if (!sessionId) return;

    /*
     * One guard per checkout, not per browser session. A single session-wide
     * flag meant a second membership bought in the same tab (another home,
     * say) never reported at all; keyed by the Stripe session, a reload of
     * this confirmation still cannot fire twice.
     */
    const key = `profixter_purchase_fired_${sessionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* Blocked storage: fire; Meta dedupes on the server's event id. */
    }

    (async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";

        const r = await fetch(
          `${api}/api/track/last-purchase-by-session?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );

        const data = await r.json();
        if (!data?.ok) throw new Error("no data");

        trackSubscribe(
          {
            currency: data.currency || "USD",
            value: Number(data.value) || 0,
            content_name: data.plan || "unknown",
            plan: data.plan || "unknown",
            billing_cycle: data.billingCycle || undefined,
            page_type: "stripe_confirmation",
          },
          {
            eventId: data.eventId || undefined,
            /*
             * The webhook is the server side of this event and has already
             * sent it. Relaying again would post the same id to Meta twice
             * from the server for no gain.
             */
            relay: false,
          }
        );
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* see above */
        }
      } catch {
        // no fake purchase
      }
    })();
  }, [sessionId]);

  const planLabel = subscription
    ? PLAN_LABELS[String(subscription.subscriptionType || "").toLowerCase()] || ""
    : "";
  const property = subscription ? propertyLine(subscription) : "";
  const cycleLabel = subscription?.billingCycle === "annual" ? "Annual" : "Monthly";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--ui-bg-soft)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="ui-rise relative w-full max-w-[520px] rounded-[var(--ui-r-lg)] bg-white p-6 text-center shadow-[var(--ui-shadow-3)] sm:p-9">

        {phase === "confirming" && (
          <>
            <div className="mb-5 flex justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-[2.5px] border-[color:var(--ui-ink)] border-t-transparent" />
            </div>
            <h1 className="ui-h2 mb-2">
              Payment received.
            </h1>
            <p className="mx-auto mb-2 max-w-[420px] text-[15px] leading-[1.6] text-[color:var(--ui-text-2)]">
              Setting up your membership &mdash; this usually takes a few seconds.
            </p>
            <p className="ui-small mx-auto max-w-[420px]">
              You can leave this page open. Nothing else needs paying.
            </p>
          </>
        )}

        {phase === "slow" && (
          <>
            <div className="mb-5 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf3e3] text-[#9a5b00]" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h1 className="ui-h2 mb-2">
              Your payment went through.
            </h1>
            <p className="mx-auto mb-6 max-w-[440px] text-[15px] leading-[1.6] text-[color:var(--ui-text-2)]">
              Your membership is taking a little longer than usual to switch on. Nothing
              has gone wrong and you will not be charged again &mdash; it should appear in
              your account shortly.
            </p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="ui-btn ui-btn--primary ui-btn--block"
            >
              Check again
            </button>
            <Link
              href="/account"
              className="ui-btn ui-btn--secondary ui-btn--block mt-2"
            >
              Go to my account
            </Link>
          </>
        )}

        {phase === "confirmed" && (
          <>
            <div className="mb-5 flex justify-center">
              <CheckCircleIcon className="h-12 w-12 text-[color:var(--ui-success)]" aria-hidden="true" />
            </div>

            <h1 className="ui-h2 mb-2">
              Your home is now taken care of.
            </h1>

            <p className="mx-auto mb-6 max-w-[420px] text-[15px] leading-[1.6] text-[color:var(--ui-text-2)]">
              Your Membership is active. Book your first Member visit and we&apos;ll start
              learning your home, your priorities, and your running list.
            </p>

            {/*
              What they bought and which house it looks after. Shown only once
              the subscription has actually been read back, never guessed from
              the URL.
            */}
            {(planLabel || property) && (
              <dl className="mb-5 grid gap-px overflow-hidden rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-[color:var(--ui-line)] text-left">
                {planLabel && (
                  <div className="bg-white px-5 py-3">
                    <dt className="text-[12px] font-medium text-[color:var(--ui-text-3)]">
                      Your plan
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-[color:var(--ui-ink)]">
                      {planLabel} &middot; {cycleLabel}
                    </dd>
                  </div>
                )}
                {property && (
                  <div className="bg-white px-5 py-3">
                    <dt className="text-[12px] font-medium text-[color:var(--ui-text-3)]">
                      Your home
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-[color:var(--ui-ink)]">{property}</dd>
                  </div>
                )}
              </dl>
            )}

            <div className="mb-5 rounded-[var(--ui-r-md)] bg-[color:var(--ui-bg-soft)] p-4 text-left">
              <h3 className="mb-2 text-[14px] font-semibold text-[color:var(--ui-ink)]">What&apos;s next</h3>
              <ul className="space-y-1.5 text-[14px] text-[color:var(--ui-text-2)]">
                <li>1. Choose your first visit time</li>
                <li>2. Add notes and photos for the work</li>
                <li>3. Profixter confirms the appointment</li>
              </ul>
            </div>

            <button
              onClick={handleBookClick}
              className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
            >
              Book your Fixter
            </button>

            {/*
              Introduced right after the first booking action: the member has just
              paid, and this is the moment the membership stops being a plan and
              becomes a person looking after their home.
            */}
            <YourFixter variant="welcome" className="mt-4 text-left" />

            <div className="mt-4 border-t border-[color:var(--ui-line)] pt-4 text-left">
              <p className="text-[14px] font-semibold text-[color:var(--ui-ink)]">How booking works as a Member</p>
              <p className="mt-1 text-[14px] leading-[1.55] text-[color:var(--ui-text-2)]">
                There&rsquo;s no monthly visit allowance. Book as often as you need &mdash;
                your plan simply determines how many visits you can have booked at the same
                time, and scheduling is subject to availability.
              </p>
            </div>
          </>
        )}

        <p className="ui-small mt-5">
          Need help? Email{" "}
          <a href={PUBLIC_CONTACT_MAILTO} className="text-[color:var(--ui-accent-ink)] underline">
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
