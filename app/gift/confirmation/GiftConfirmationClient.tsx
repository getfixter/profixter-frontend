"use client";

/**
 * After the purchaser pays.
 *
 * WHAT THIS SCREEN DOES NOT DO: activate anything, or claim that it has.
 *
 * The gift is created by the Stripe webhook once payment is confirmed
 * server-side, never by a browser landing on a success URL. So this reads back
 * what the purchaser bought and reports it, rather than being the thing that
 * makes it real. If the webhook has not landed in the second it takes to
 * redirect, the list is simply empty and the copy still tells the truth.
 */

import { useEffect, useState } from "react";
import DigitalGiftCard from "@/app/components/gift/DigitalGiftCard";
import GiftClaimLink from "@/app/components/gift/GiftClaimLink";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  formatMoneyCents,
  getPurchasedGifts,
  monthsLabel,
  planLabel,
} from "@/lib/gift-service";
import "../gift.css";

type Purchased = Awaited<ReturnType<typeof getPurchasedGifts>>[number];

export default function GiftConfirmationClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [gift, setGift] = useState<Purchased | null>(null);
  /* The viewer of this page is the purchaser, so the gift is from them. */
  const { user } = useAuth();

  /*
   * Whether the server sent a real breakdown.
   *
   * Checked rather than assumed: gifts recorded before tax was captured have
   * these fields at their schema defaults, and rendering "Sales tax $0.00"
   * for one of those would be stating something we do not know to be true.
   */
  const hasBreakdown =
    !!gift &&
    typeof gift.amountSubtotalCents === "number" &&
    gift.amountSubtotalCents > 0 &&
    gift.amountSubtotalCents + gift.taxCents - gift.discountCents === gift.amountPaidCents;

  const [state, setState] = useState<"loading" | "ready" | "pending">("loading");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    /*
     * The webhook and the redirect race, and the webhook usually wins by a
     * comfortable margin — but not always. Rather than showing an empty screen
     * to somebody who has just paid several hundred dollars, this looks again
     * a few times before settling into a "we are finishing up" message.
     */
    const poll = async () => {
      attempts += 1;
      try {
        const gifts = await getPurchasedGifts();
        if (cancelled) return;
        if (gifts.length) {
          setGift(gifts[0]);
          setState("ready");
          return;
        }
      } catch {
        // Fall through to the retry, then to the pending state.
      }
      if (cancelled) return;
      if (attempts < 4) setTimeout(poll, 1500);
      else setState("pending");
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state === "loading") {
    return (
      <div className="py-20 text-center">
        <div className="gf-spinner" role="status" aria-label="Confirming your gift" />
        <p className="ui-small mt-4">Confirming your gift&hellip;</p>
      </div>
    );
  }

  return (
    <section className="ui-section ui-section--tight">
      <div className="mx-auto w-full max-w-[600px] px-[var(--ui-gutter)]">
        <div className="text-center">
          <div className="gf-check mx-auto" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="ui-display mt-5">Your gift is on its way</h1>

          {state === "ready" && gift ? (
            <p className="ui-lede mx-auto mt-3">
              We have emailed{" "}
              <span className="break-words font-medium text-[color:var(--ui-ink)]">{gift.recipientEmail}</span>{" "}
              an invitation to claim {monthsLabel(gift.durationMonths)} of ProFixter {planLabel(gift.plan)}.
            </p>
          ) : (
            /*
             * Payment succeeded — Stripe would not have redirected here otherwise —
             * but our record has not appeared yet. Said plainly, without implying
             * anything went wrong or that they should pay again.
             */
            <p className="ui-lede mx-auto mt-3">
              Your payment went through and we are finishing up. The invitation email will arrive
              shortly, and your gift will appear in your account.
            </p>
          )}
        </div>

        {state === "ready" && gift ? (
          <>
            {/*
              The card they just sent, at compact size — the same component the
              recipient will open, so "here is what you sent" is literally true.
            */}
            <div className="gf-preview mt-8">
              <DigitalGiftCard
                occasion={gift.occasion}
                plan={gift.plan}
                durationMonths={gift.durationMonths}
                recipientFirstName={gift.recipientFirstName}
                recipientLastName={gift.recipientLastName}
                from={String(user?.name || "").trim()}
                personalMessage={gift.personalMessage}
                size="compact"
              />
            </div>

            {/*
              A way to deliver it by hand.

              Under the card and above the receipt: it belongs with "what you
              sent", not with "what you paid". Nothing is fetched until the
              purchaser presses the button, because the link is a credential
              and a page load is not a request for one.
            */}
            <GiftClaimLink
              className="mt-6"
              giftNumber={gift.giftNumber}
              recipientFirstName={gift.recipientFirstName}
              claimed={Boolean(gift.claimedAt) || gift.status === "claimed"}
              invitationExpired={gift.invitationExpired}
            />

            <div className="ui-card mt-6">
              <h2 className="ui-h3">Receipt</h2>
              <dl className="gf-summary mt-2">
                <div className="gf-summary__row">
                  <dt>Recipient</dt>
                  <dd className="break-words">{gift.recipientName || gift.recipientEmail}</dd>
                </div>
                <div className="gf-summary__row">
                  <dt>Plan</dt>
                  <dd>
                    {planLabel(gift.plan)} &middot; {monthsLabel(gift.durationMonths)}
                  </dd>
                </div>
                {/*
                  The money, broken out.

                  The review screen quotes $498 and the receipt says $541.58; the
                  difference is sales tax, and until now the purchaser had to work
                  that out for themselves. Every figure here is the authoritative
                  one Stripe returned on the completed session and the server
                  stored — nothing on this page computes or estimates tax.

                  The rows appear only when the server actually sent them. An
                  older gift recorded before these fields existed shows the total
                  alone rather than a breakdown padded out with zeroes that would
                  read as "no tax was charged".
                */}
                {hasBreakdown ? (
                  <>
                    <div className="gf-summary__row">
                      <dt>Subtotal</dt>
                      <dd>{formatMoneyCents(gift.amountSubtotalCents)}</dd>
                    </div>
                    {gift.discountCents > 0 ? (
                      <div className="gf-summary__row">
                        <dt>Discount</dt>
                        <dd className="gf-discount">&minus;{formatMoneyCents(gift.discountCents)}</dd>
                      </div>
                    ) : null}
                    <div className="gf-summary__row">
                      <dt>Sales tax</dt>
                      <dd>{formatMoneyCents(gift.taxCents)}</dd>
                    </div>
                  </>
                ) : null}
                <div className="gf-summary__row gf-summary__total">
                  <dt>Total paid</dt>
                  <dd data-testid="gift-total-paid">{formatMoneyCents(gift.amountPaidCents)}</dd>
                </div>
                <div className="gf-summary__row">
                  <dt>Reference</dt>
                  <dd className="gf-muted font-mono text-[13px]">{gift.giftNumber}</dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}

        <div className="ui-card ui-card--soft mt-6">
          <h2 className="ui-h3">What happens next</h2>
          <ol className="ui-body mt-3 list-decimal space-y-1.5 pl-5 text-[color:var(--ui-text-2)]">
            <li>They claim the gift from the email we sent.</li>
            <li>
              Their {state === "ready" && gift ? monthsLabel(gift.durationMonths) : "membership"} start
              when they claim it, so none of the time is lost while they get round to it.
            </li>
            <li>They book visits themselves, with nothing to pay.</li>
          </ol>
          <p className="ui-small mt-4 border-t border-[color:var(--ui-line)] pt-3">
            <strong className="font-semibold text-[color:var(--ui-ink)]">You will not be charged again.</strong>{" "}
            This was a one-time payment, and it will not repeat.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/account" className="ui-btn ui-btn--primary min-h-[48px] flex-1">
            Go to your account
          </Link>
          <Link href="/gift" className="ui-btn ui-btn--secondary min-h-[48px] flex-1">
            Gift another
          </Link>
        </div>
      </div>
    </section>
  );
}
