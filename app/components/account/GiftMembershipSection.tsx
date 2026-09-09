"use client";

/**
 * Gift memberships on the account screen.
 *
 * THE RULE THIS COMPONENT ENFORCES: a gift must never look like a recurring
 * subscription. No Cancel, no Resume, no Reactivate, no Change plan, no Manage
 * billing, no retention offer — none of those are rendered, because none of
 * them mean anything for a membership somebody else prepaid and no card of
 * this customer's is on file.
 *
 * That omission is a courtesy, not the protection. The server refuses all six
 * of those actions for a gift-only member independently, and a gift carries no
 * Stripe customer for a billing-portal lookup to find. Hiding the buttons just
 * means nobody is invited to discover that.
 *
 * In their place: Continue Membership, which starts the ORDINARY subscription
 * flow in the recipient's own name with their own payment method. There is no
 * path here that renews or resumes the gift itself.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  formatGiftDate,
  getMyGifts,
  monthsLabel,
  planLabel,
  type MyGift,
  type MyGifts,
} from "@/lib/gift-service";

/** How close to the end we start suggesting they carry on themselves. */
const ENDING_SOON_DAYS = 21;

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function Pill({ tone, children }: { tone: "active" | "queued"; children: React.ReactNode }) {
  const styles =
    tone === "active"
      ? "bg-[#E4F0E9] text-[#2A6B47] border-[#BFDECB]"
      : "bg-[#EEF2FF] text-[#306EEC] border-[#D7E0F5]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {children}
    </span>
  );
}

function ActiveGiftCard({ gift }: { gift: MyGift }) {
  const remaining = daysUntil(gift.endAt);
  const endingSoon = remaining !== null && remaining <= ENDING_SOON_DAYS;

  return (
    <div className="rounded-[10px] border border-[#E0E6F5] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="active">Gift membership</Pill>
        {endingSoon ? (
          <span className="text-[12px] font-medium text-[#6A6D71]">
            {remaining === 0 ? "Ends today" : `${remaining} day${remaining === 1 ? "" : "s"} left`}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[22px] font-semibold leading-tight text-[#313234] sm:text-[26px]">
        {planLabel(gift.plan)}
      </p>

      {gift.from ? (
        <p className="mt-1 break-words text-[14px] text-[#6A6D71]">
          Gifted by <span className="font-medium text-[#313234]">{gift.from}</span>
        </p>
      ) : null}

      <p className="mt-2 text-[14px] text-[#6A6D71]">
        Active through{" "}
        <span className="font-medium text-[#313234]">
          {gift.activeThrough || formatGiftDate(gift.endAt)}
        </span>
      </p>

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Link
          href="/book?visit=membership"
          className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
        >
          Book Fixter
        </Link>
        {endingSoon ? (
          /*
           * Continue Membership starts a NEW subscription owned and paid for
           * by this customer. It is not a renewal of the gift, and there is
           * deliberately no control anywhere that could extend or resume the
           * gift itself.
           */
          <Link
            href="/membership"
            className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
          >
            Continue membership
          </Link>
        ) : null}
      </div>

      <p className="mt-4 border-t border-[#EEF2FF] pt-3 text-[12px] leading-relaxed text-[#6A6D71]">
        This membership was prepaid as a gift. There is nothing to pay and no card on file.
      </p>
    </div>
  );
}

function QueuedGiftRow({ gift, index }: { gift: MyGift; index: number }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-[#313234]">
          {planLabel(gift.plan)}
          <span className="ml-2 text-[13px] font-normal text-[#6A6D71]">
            &middot; {monthsLabel(gift.durationMonths)}
          </span>
        </p>
        {gift.from ? (
          <p className="mt-0.5 break-words text-[12px] text-[#9CA3AF]">Gifted by {gift.from}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] text-[#6A6D71]">
          {index === 0 ? "Starts" : "Then"} {formatGiftDate(gift.startAt)}
        </p>
      </div>
    </li>
  );
}

export default function GiftMembershipSection({
  addressId,
  /** True when a paid subscription already covers this property. */
  hasPaidMembership = false,
  /**
   * Told to the parent when a gift is, or stops, covering this customer.
   *
   * The account screen needs it to suppress its "No active membership" upsell:
   * a gift-only member has a membership, and being told otherwise beside a
   * working one is both wrong and confusing. Reported rather than fetched
   * twice, so there is one request and one answer.
   */
  onActiveGiftChange,
}: {
  addressId?: string | null;
  hasPaidMembership?: boolean;
  onActiveGiftChange?: (active: boolean) => void;
}) {
  const [gifts, setGifts] = useState<MyGifts | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getMyGifts(addressId);
        if (!cancelled) {
          setGifts(result);
          setState("ready");
          onActiveGiftChange?.(Boolean(result.active));
        }
      } catch {
        /*
         * A gift lookup that fails must not change what the account screen
         * says about membership. Reporting "no active gift" here would be a
         * guess; leaving the parent's belief alone keeps the failure silent
         * and harmless.
         */
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // onActiveGiftChange is intentionally not a dependency: parents commonly
    // pass an inline function, and including it would refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressId]);

  /*
   * Nothing to show is the common case and must be silent.
   *
   * Most customers have never received a gift, and the account screen should
   * look exactly as it does today for them. A loading skeleton or an empty
   * "no gifts" panel would be a visible change to everybody for the benefit of
   * almost nobody — so this renders nothing at all, including while loading
   * and on failure.
   */
  if (state !== "ready" || !gifts) return null;
  if (!gifts.active && !gifts.queued.length) return null;

  return (
    <section aria-labelledby="gift-membership-heading" className="mt-6 space-y-4">
      <h2 id="gift-membership-heading" className="sr-only">
        Gift memberships
      </h2>

      {gifts.active ? <ActiveGiftCard gift={gifts.active} /> : null}

      {gifts.queued.length ? (
        <div className="rounded-[10px] border border-[#E0E6F5] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#EEF2FF] px-4 py-3 sm:px-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#6A6D71]">
              {gifts.active || hasPaidMembership ? "Coming next" : "Ready to start"}
            </h3>
            {gifts.queued.length > 1 ? (
              <span className="text-[12px] text-[#9CA3AF]">
                {gifts.queued.length} gifts queued
              </span>
            ) : null}
          </div>
          {/* Chronological: the API returns them ordered by start date. */}
          <ul className="divide-y divide-[#EEF2FF]">
            {gifts.queued.map((gift, index) => (
              <QueuedGiftRow key={gift.giftNumber} gift={gift} index={index} />
            ))}
          </ul>
          {!gifts.active && hasPaidMembership ? (
            <p className="border-t border-[#EEF2FF] px-4 py-3 text-[12px] leading-relaxed text-[#6A6D71] sm:px-5">
              Your gift starts when your current membership ends, so none of the gifted time
              overlaps with what you are paying for.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
