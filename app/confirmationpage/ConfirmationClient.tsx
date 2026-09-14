"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { trackPurchase } from "@/lib/analytics";
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
  useEffect(() => {
    if (!sessionId) return;

    const key = "profixter_purchase_fired";
    if (sessionStorage.getItem(key)) return;

    (async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";

        const r = await fetch(
          `${api}/api/track/last-purchase-by-session?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );

        const data = await r.json();
        if (!data?.ok) throw new Error("no data");

        trackPurchase({
          currency: data.currency || "USD",
          value: Number(data.value) || 0,
          plan: data.plan || "unknown",
          page_type: "stripe_confirmation",
        });
        sessionStorage.setItem(key, "1");
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
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-5 py-10 sm:px-6 sm:py-13">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[8px] border border-[#DCE3F8] bg-white p-7 text-center shadow-[0_28px_80px_rgba(15,23,42,0.12)] animate-fadeIn sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#306EEC] via-[#86EFAC] to-[#D4A574]" />

        {phase === "confirming" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E8F1FF]">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#306EEC] border-t-transparent" />
              </div>
            </div>
            <h1 className="mb-3 text-[26px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[30px]">
              Payment received.
            </h1>
            <p className="mx-auto mb-2 max-w-[420px] text-[15px] font-semibold leading-relaxed text-[#64748B] sm:text-base">
              Setting up your membership &mdash; this usually takes a few seconds.
            </p>
            <p className="mx-auto max-w-[420px] text-sm text-[#8A9099]">
              You can leave this page open. Nothing else needs paying.
            </p>
          </>
        )}

        {phase === "slow" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4E5]">
                <span aria-hidden="true" className="text-[34px]">⏳</span>
              </div>
            </div>
            <h1 className="mb-3 text-[26px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[30px]">
              Your payment went through.
            </h1>
            <p className="mx-auto mb-6 max-w-[440px] text-[15px] font-semibold leading-relaxed text-[#64748B] sm:text-base">
              Your membership is taking a little longer than usual to switch on. Nothing
              has gone wrong and you will not be charged again &mdash; it should appear in
              your account shortly.
            </p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="h-[48px] w-full rounded-[8px] bg-[#0B1628] text-base font-black text-white transition-all hover:bg-[#17263D]"
            >
              Check again
            </button>
            <Link
              href="/account"
              className="mt-3 inline-flex h-[46px] w-full items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white text-[15px] font-bold text-[#0B1628] transition hover:bg-[#F8FAFF]"
            >
              Go to my account
            </Link>
          </>
        )}

        {phase === "confirmed" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E8F1FF] shadow-inner">
                <CheckCircleIcon className="h-14 w-14 text-[#306EEC]" />
              </div>
            </div>

            <h1 className="mb-3 text-[30px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[36px]">
              Your home is now taken care of.
            </h1>

            <p className="mx-auto mb-6 max-w-[420px] text-[15px] font-semibold leading-relaxed text-[#64748B] sm:text-base">
              Your Membership is active. Book your first Member visit and we&apos;ll start
              learning your home, your priorities, and your running list.
            </p>

            {/*
              What they bought and which house it looks after. Shown only once
              the subscription has actually been read back, never guessed from
              the URL.
            */}
            {(planLabel || property) && (
              <dl className="mb-6 grid gap-px overflow-hidden rounded-[8px] border border-[#D7E0F5] bg-[#D7E0F5] text-left">
                {planLabel && (
                  <div className="bg-white px-5 py-3">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A9099]">
                      Your plan
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-black text-[#0B1628]">
                      {planLabel} &middot; {cycleLabel}
                    </dd>
                  </div>
                )}
                {property && (
                  <div className="bg-white px-5 py-3">
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A9099]">
                      Your home
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-black text-[#0B1628]">{property}</dd>
                  </div>
                )}
              </dl>
            )}

            <div className="mb-6 rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] p-5 text-left shadow-sm">
              <h3 className="mb-3 text-base font-black text-[#0B1628]">What&apos;s next</h3>
              <ul className="space-y-3 text-sm font-semibold text-[#64748B]">
                <li>1. Choose your first visit time</li>
                <li>2. Add notes and photos for the work</li>
                <li>3. Profixter confirms the appointment</li>
              </ul>
            </div>

            <button
              onClick={handleBookClick}
              className="h-[48px] w-full rounded-[8px] bg-[#0B1628] text-base font-black text-white shadow-[0_18px_44px_rgba(11,22,40,0.24)] transition-all hover:bg-[#17263D]"
            >
              Book your Fixter
            </button>

            {/*
              Introduced right after the first booking action: the member has just
              paid, and this is the moment the membership stops being a plan and
              becomes a person looking after their home.
            */}
            <YourFixter variant="welcome" className="mt-4 text-left" />

            <div className="mt-4 rounded-[8px] border border-[#E5E7EB] bg-white p-4 text-left">
              <p className="text-sm font-black text-[#0B1628]">How booking works as a Member</p>
              <p className="mt-2 text-sm leading-relaxed text-[#6A6D71]">
                There&rsquo;s no monthly visit allowance. Book as often as you need &mdash;
                your plan simply determines how many visits you can have booked at the same
                time, and scheduling is subject to availability.
              </p>
            </div>
          </>
        )}

        <p className="mt-4 text-sm text-[#6A6D71]">
          Need help? Email{" "}
          <a href={PUBLIC_CONTACT_MAILTO} className="text-[#306EEC] underline">
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
