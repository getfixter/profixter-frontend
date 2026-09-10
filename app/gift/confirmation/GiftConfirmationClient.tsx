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
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E0E6F5] border-t-[#306EEC]"
          role="status"
          aria-label="Confirming your gift"
        />
        <p className="mt-4 text-sm text-[#6A6D71]">Confirming your gift&hellip;</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E4F0E9]"
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 6 9 17l-5-5"
              stroke="#2A6B47"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mt-5 text-[26px] font-semibold leading-tight text-[#313234] sm:text-[32px]">
          Your gift is on its way
        </h1>
      </div>

      {state === "ready" && gift ? (
        <>
          <p className="mt-4 text-center text-[15px] leading-relaxed text-[#6A6D71]">
            We have emailed{" "}
            <span className="break-words font-medium text-[#313234]">{gift.recipientEmail}</span> an
            invitation to claim {monthsLabel(gift.durationMonths)} of ProFixter{" "}
            {planLabel(gift.plan)}.
          </p>

          {/*
            The card they just sent, at compact size — the same component the
            recipient will open, so "here is what you sent" is literally true.
          */}
          <div className="mt-7 rounded-[14px] bg-[#0B1628] p-4 sm:p-5">
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
            className="mt-7"
            giftNumber={gift.giftNumber}
            recipientFirstName={gift.recipientFirstName}
            claimed={Boolean(gift.claimedAt) || gift.status === "claimed"}
            invitationExpired={gift.invitationExpired}
          />

          <dl className="mt-7 divide-y divide-[#EEF2FF] rounded-[10px] border border-[#E0E6F5] bg-white">
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Recipient</dt>
              <dd className="min-w-0 break-words text-right text-[15px] font-medium text-[#313234]">
                {gift.recipientName || gift.recipientEmail}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Plan</dt>
              <dd className="text-right text-[15px] font-medium text-[#313234]">
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
                <div className="flex items-start justify-between gap-4 px-4 py-2.5 sm:px-5">
                  <dt className="text-[13px] text-[#6A6D71]">Subtotal</dt>
                  <dd className="text-right text-[14px] tabular-nums text-[#313234]">
                    {formatMoneyCents(gift.amountSubtotalCents)}
                  </dd>
                </div>
                {gift.discountCents > 0 ? (
                  <div className="flex items-start justify-between gap-4 px-4 py-2.5 sm:px-5">
                    <dt className="text-[13px] text-[#6A6D71]">Discount</dt>
                    <dd className="text-right text-[14px] tabular-nums text-[#1B7F5A]">
                      &minus;{formatMoneyCents(gift.discountCents)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4 px-4 py-2.5 sm:px-5">
                  <dt className="text-[13px] text-[#6A6D71]">Sales tax</dt>
                  <dd className="text-right text-[14px] tabular-nums text-[#313234]">
                    {formatMoneyCents(gift.taxCents)}
                  </dd>
                </div>
              </>
            ) : null}
            <div className="flex items-start justify-between gap-4 bg-[#F8FAFF] px-4 py-3.5 sm:px-5">
              <dt className="text-[14px] font-semibold text-[#313234]">Total paid</dt>
              <dd className="text-right text-[16px] font-semibold tabular-nums text-[#313234]">
                {formatMoneyCents(gift.amountPaidCents)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Reference</dt>
              <dd className="text-right font-mono text-[13px] text-[#6A6D71]">{gift.giftNumber}</dd>
            </div>
          </dl>
        </>
      ) : (
        /*
         * Payment succeeded — Stripe would not have redirected here otherwise —
         * but our record has not appeared yet. Said plainly, without implying
         * anything went wrong or that they should pay again.
         */
        <p className="mt-4 text-center text-[15px] leading-relaxed text-[#6A6D71]">
          Your payment went through and we are finishing up. The invitation email will arrive
          shortly, and your gift will appear in your account.
        </p>
      )}

      <div className="mt-7 rounded-[10px] border border-[#E0E6F5] bg-[#F8FAFF] p-5">
        <h2 className="text-[15px] font-semibold text-[#313234]">What happens next</h2>
        <ol className="mt-3 space-y-2 text-[14px] leading-relaxed text-[#6A6D71]">
          <li>They claim the gift from the email we sent.</li>
          <li>
            Their {state === "ready" && gift ? monthsLabel(gift.durationMonths) : "membership"} start
            when they claim it, so none of the time is lost while they get round to it.
          </li>
          <li>They book visits themselves, with nothing to pay.</li>
        </ol>
        <p className="mt-4 border-t border-[#E0E6F5] pt-3 text-[13px] leading-relaxed text-[#6A6D71]">
          <strong className="font-semibold text-[#313234]">You will not be charged again.</strong>{" "}
          This was a one-time payment, and it will not repeat.
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/account"
          className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
        >
          Go to your account
        </Link>
        <Link
          href="/gift"
          className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
        >
          Gift another
        </Link>
      </div>
    </div>
  );
}
