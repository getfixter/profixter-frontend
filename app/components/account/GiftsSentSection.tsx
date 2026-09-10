"use client";

/**
 * "Gifts you have sent" — the purchaser's own history.
 *
 * There was no such screen. A gift's confirmation page is reachable exactly
 * once, from a Stripe redirect, so a purchaser who closed the tab had no way
 * back to anything about the gift they had bought — including, once the
 * feature existed, the claim link.
 *
 * Renders nothing when this account has never bought one, so it costs an
 * ordinary customer a single request and no layout.
 */

import { useEffect, useState } from "react";

import GiftClaimLink from "@/app/components/gift/GiftClaimLink";
import {
  formatMoneyCents,
  getPurchasedGifts,
  monthsLabel,
  planLabel,
} from "@/lib/gift-service";

type Sent = Awaited<ReturnType<typeof getPurchasedGifts>>[number];

const DATE = { year: "numeric", month: "short", day: "numeric" } as const;

function statusLine(gift: Sent) {
  if (gift.refundStatus === "full") return { text: "Refunded", tone: "muted" as const };
  if (gift.status === "cancelled") return { text: "Cancelled", tone: "muted" as const };
  if (gift.claimedAt || gift.status === "claimed") {
    return { text: "Claimed", tone: "good" as const };
  }
  if (gift.invitationExpired) return { text: "Invitation expired", tone: "warn" as const };
  return { text: "Waiting to be claimed", tone: "info" as const };
}

const TONE = {
  good: "bg-[#E7F6EA] text-[#1F5D2C]",
  warn: "bg-[#FDF3E4] text-[#8A5A1E]",
  info: "bg-[#EAF1FE] text-[#2A4F9B]",
  muted: "bg-[#F1F2F4] text-[#6A6D71]",
};

export default function GiftsSentSection() {
  const [gifts, setGifts] = useState<Sent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getPurchasedGifts();
        if (!cancelled) setGifts(rows);
      } catch {
        // Silent: a history panel that failed to load is not worth an alarm
        // on a page about somebody's membership.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !gifts.length) return null;

  return (
    <section className="mt-6 rounded-[10px] border border-[#E0E6F5] bg-white p-5">
      <h3 className="text-[16px] font-semibold text-[#313234]">Gifts you have sent</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6A6D71]">
        {gifts.length === 1 ? "One gift" : `${gifts.length} gifts`}, and where each has got to.
      </p>

      <ul className="mt-4 space-y-4">
        {gifts.map((gift) => {
          const status = statusLine(gift);
          const claimed = Boolean(gift.claimedAt) || gift.status === "claimed";
          /*
           * A cancelled or refunded gift is not claimable, so it must not be
           * offered a link either. GiftClaimLink covers the claimed case
           * itself; these two are decided here because the server would
           * refuse them and a button that always errors is worse than none.
           */
          const dead = gift.status === "cancelled" || gift.refundStatus === "full";

          return (
            <li key={gift.giftNumber} className="rounded-[10px] border border-[#EEF2FF] p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#313234]">
                    {planLabel(gift.plan)} &middot; {monthsLabel(gift.durationMonths)}
                  </p>
                  <p className="mt-0.5 break-words text-[13px] text-[#6A6D71]">
                    For {gift.recipientName || gift.recipientEmail}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-[#8A8F98]">
                    {gift.purchasedAt
                      ? new Date(gift.purchasedAt).toLocaleDateString("en-US", DATE)
                      : ""}
                    {gift.amountPaidCents ? ` · ${formatMoneyCents(gift.amountPaidCents)}` : ""}
                    {` · ${gift.giftNumber}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE[status.tone]}`}
                >
                  {status.text}
                </span>
              </div>

              {dead ? null : (
                <GiftClaimLink
                  className="mt-3"
                  giftNumber={gift.giftNumber}
                  recipientFirstName={gift.recipientFirstName}
                  claimed={claimed}
                  invitationExpired={gift.invitationExpired}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
