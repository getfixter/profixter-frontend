"use client";

/**
 * My Account — the control centre.
 *
 * WHAT THIS PAGE HAS TO ANSWER, IN THE FIRST FEW SECONDS
 *
 *   Who am I, which property am I looking at, am I a member, what plan,
 *   when is my next visit, and what can I do right now.
 *
 * The old landing tab answered none of them. It opened with a welcome card
 * and went on to pre-visit tips, exterior offers and an FAQ — marketing, on
 * the one screen a customer opens to deal with their account. Membership
 * status lived a tab away and the billing portal was below a subscription
 * list inside it, so "manage my plan" was two clicks and a scroll.
 *
 * NOTHING HERE IS INVENTED.
 *
 * Plan benefits come from PLAN_DETAILS, the same table the marketing pages
 * and the upgrade prompt read, so a benefit cannot be true in one place and
 * false in another. Membership state comes from the subscriptions endpoint,
 * with the per-address coverage map as the fallback. The next visit, the
 * booking allowance and free-first-visit eligibility all come from
 * /bookings/next — never guessed from "they have no subscription".
 *
 * EVERY ACTION HERE GOES SOMEWHERE REAL. No dead buttons: each tile is an
 * existing route or an existing API call, and the two that depend on Stripe
 * are hidden rather than shown broken when there is no subscription behind
 * them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import GiftCallout from "@/app/components/gift/GiftCallout";
import ManagePlanModal from "./ManagePlanModal";
import { getPrimaryFixter } from "@/lib/fixter";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_E164 } from "@/lib/seo";
import { PLAN_DETAILS, type PlanType } from "@/lib/stripe-links";
import { getNextBooking, type NextBookingResponse } from "@/lib/booking-service";
import {
  createBillingPortalSession,
  getLoyaltyStatus,
  getMySubscriptions,
  getSubscriptionActionErrorMessage,
  type LoyaltyStatus,
  type ManagedSubscription,
} from "@/lib/subscription-service";

import type { AccountAddress, AccountFormData, ActiveTab } from "./types";

/* -------------------------------------------------------------------------- */

const ACTIVE_STATUSES = ["active", "trialing"];

function isLive(subscription: ManagedSubscription | null | undefined) {
  return ACTIVE_STATUSES.includes(String(subscription?.status || "").toLowerCase());
}

function planKeyOf(value: unknown): PlanType | null {
  const key = String(value || "").trim().toLowerCase();
  return (["basic", "plus", "premium", "elite"] as string[]).includes(key)
    ? (key as PlanType)
    : null;
}

function addressLine(address: AccountAddress | null | undefined) {
  if (!address) return "";
  return [address.line1, address.city, address.state, address.zip]
    .filter((part) => String(part || "").trim())
    .join(", ");
}

/**
 * Monthly or annual, in the customer's words.
 *
 * Stripe's own vocabulary — interval, current_period_end, price nickname —
 * is not what somebody wants to read about their own membership.
 */
function billingLine(subscription: ManagedSubscription | null) {
  if (!subscription) return "";
  const cycle = String(
    (subscription as { billingCycle?: string }).billingCycle || ""
  ).toLowerCase();
  if (cycle === "annual" || cycle === "yearly") return "Billed yearly";
  if (cycle === "monthly") return "Billed monthly";
  return "";
}

/* -------------------------------------------------------------------------- */

const CARD = "rounded-[14px] border border-[#E3E9F4] bg-white";
const H2 = "text-[17px] font-semibold tracking-[-0.01em] text-[#0F172A]";
const MUTED = "text-[13.5px] leading-relaxed text-[#64748B]";

function Skeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your account</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${CARD} p-5`}>
          <div className="h-4 w-40 animate-pulse rounded bg-[#EEF2F9]" />
          <div className="mt-3 h-3 w-full max-w-sm animate-pulse rounded bg-[#F3F6FB]" />
          <div className="mt-2 h-3 w-2/3 max-w-xs animate-pulse rounded bg-[#F3F6FB]" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function AccountOverview({
  formData,
  onSwitchTab,
}: {
  formData: AccountFormData;
  onSwitchTab: (tab: ActiveTab) => void;
}) {
  const addresses = useMemo<AccountAddress[]>(
    () => (formData.addresses || []) as AccountAddress[],
    [formData.addresses]
  );

  const [subscriptions, setSubscriptions] = useState<ManagedSubscription[]>([]);
  const [managePlanOpen, setManagePlanOpen] = useState(false);
  const [managePlanLoyalty, setManagePlanLoyalty] = useState<LoyaltyStatus | null>(null);
  const [next, setNext] = useState<NextBookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState("");

  /*
   * Which property this page is about.
   *
   * DERIVED, not synchronised. State holds only an explicit choice; the
   * fallback is computed. Mirroring the default into state through an
   * effect is the pattern the React Compiler rejects, and it also gives a
   * first render where the two disagree.
   *
   * Order: the property with cover, then the account default, then the
   * first. A customer with one property never sees the switcher at all.
   */
  const [chosenAddressId, setChosenAddressId] = useState<string | null>(null);
  const defaultAddressId = useMemo(() => {
    if (!addresses.length) return "";
    const preferred =
      addresses.find((a) => a.hasActiveSubscription) ||
      addresses.find((a) => String(a._id) === String(formData.defaultAddressId)) ||
      addresses[0];
    return String(preferred._id);
  }, [addresses, formData.defaultAddressId]);
  const addressId = chosenAddressId ?? defaultAddressId;

  const address = useMemo(
    () => addresses.find((a) => String(a._id) === String(addressId)) || null,
    [addresses, addressId]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [subs, nextBooking] = await Promise.all([
        getMySubscriptions().catch(() => ({ subscriptions: [] })),
        addressId ? getNextBooking(addressId).catch(() => null) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setSubscriptions(subs.subscriptions || []);
      setNext(nextBooking);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [addressId]);

  /* The subscription covering the property being viewed, if any. */
  const subscription = useMemo(() => {
    const live = subscriptions.filter(isLive);
    return (
      live.find((s) => String(s.addressId || "") === String(addressId)) ||
      /* A legacy subscription with no address still covers the default one. */
      live.find((s) => !s.addressId) ||
      null
    );
  }, [subscriptions, addressId]);

  /*
   * Membership is decided by the SERVER's coverage flag first, because it is
   * the same answer every other members-only surface uses. The subscription
   * row is what fills in the detail; a gift grants cover without one.
   */
  const covered = Boolean(address?.hasActiveSubscription) || isLive(subscription);
  const planKey =
    planKeyOf(subscription?.subscriptionType) || planKeyOf(address?.plan) || null;
  const plan = planKey ? PLAN_DETAILS.find((p) => p.id === planKey) || null : null;
  const viaGift = covered && !isLive(subscription);

  /* A former member: they had one, and it is over. */
  const lapsed =
    !covered &&
    subscriptions.some((s) =>
      ["canceled", "cancelled", "expired", "past_due", "unpaid"].includes(
        String(s.status || "").toLowerCase()
      )
    );

  const upcoming = next?.future || null;
  const freeVisit = Boolean(next?.freeFirstVisitAvailable) && next?.introVisitServiceable !== false;

  /*
   * Manage Plan now opens OUR summary first, and creating the Stripe session is
   * deferred until the member actually chooses to continue.
   *
   * That ordering is the point. A portal session is a real Stripe object with a
   * live URL, and minting one for somebody who glances at the modal and closes
   * it is waste with no upside. It also means the modal genuinely costs nothing
   * to dismiss, which is what separates it from a retention gate.
   */
  const openManagePlan = useCallback(async () => {
    setPortalError("");
    setManagePlanOpen(true);

    const targetAddressId = subscription?.addressId || addressId || null;
    if (!targetAddressId) return;

    try {
      const status = await getLoyaltyStatus(String(targetAddressId));
      setManagePlanLoyalty(status);
    } catch {
      /*
       * A missing Loyalty panel is a smaller failure than a blocked Manage
       * Plan. The modal still opens, still summarises the membership, and
       * Continue still works.
       */
      setManagePlanLoyalty(null);
    }
  }, [subscription, addressId]);

  const continueToPortal = useCallback(async () => {
    setPortalBusy(true);
    setPortalError("");
    try {
      const { url } = await createBillingPortalSession({
        addressId: subscription?.addressId || addressId || undefined,
      });
      window.location.href = url;
    } catch (err: unknown) {
      /*
       * Shown in place rather than through alert(). A portal that cannot
       * open is a state this page has to survive, not an interruption.
       */
      setPortalError(getSubscriptionActionErrorMessage(err));
      setPortalBusy(false);
    }
  }, [subscription, addressId]);

  const firstName = (formData.name || "").trim().split(/\s+/)[0] || "there";

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-5">
      {/* ─────────────────────────── Identity ─────────────────────────── */}
      <section className={`${CARD} px-5 py-4 sm:px-6`} aria-labelledby="acct-who">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 id="acct-who" className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
              Hello, {firstName}
            </h1>
            <p className="mt-0.5 break-words text-[13.5px] text-[#64748B]">{formData.email}</p>
          </div>

          {/*
            Property context. Only drawn when there is a genuine choice to
            make — a selector with one option is furniture, not a control.
          */}
          {addresses.length > 1 ? (
            <div className="min-w-0 sm:min-w-[280px]">
              <label
                htmlFor="acct-property"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7C8899]"
              >
                Viewing property
              </label>
              <select
                id="acct-property"
                value={addressId}
                onChange={(e) => {
                  setChosenAddressId(e.target.value);
                  setLoading(true);
                }}
                className="mt-1 min-h-[42px] w-full rounded-[9px] border border-[#D5DEEF] bg-white px-3 text-[14px] text-[#0F172A] focus:border-[#306EEC] focus:outline-none focus:ring-2 focus:ring-[#306EEC]/25"
              >
                {addresses.map((a) => (
                  <option key={String(a._id)} value={String(a._id)}>
                    {a.line1}
                    {a.hasActiveSubscription ? " · Member" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : address ? (
            <p className="text-[13.5px] text-[#475569]">{addressLine(address)}</p>
          ) : null}
        </div>
      </section>

      {/* ────────────────────────── Membership ────────────────────────── */}
      <section className={`${CARD} overflow-hidden`} aria-labelledby="acct-plan">
        {covered ? (
          <>
            <div className="border-b border-[#EEF2F9] bg-[#F7FAFF] px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                <div className="min-w-0">
                  <h2 id="acct-plan" className="text-[19px] font-semibold tracking-[-0.015em] text-[#0F172A]">
                    {plan ? `${plan.name} Membership` : "Membership"}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#64748B]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#15803D]">
                      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#22C55E]" />
                      Active
                    </span>
                    {viaGift ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Gift membership</span>
                      </>
                    ) : billingLine(subscription) ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{billingLine(subscription)}</span>
                      </>
                    ) : null}
                    {address ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="break-words">{address.line1}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              {/*
                Benefits, read from the shared plan table rather than written
                out here, so this cannot promise something the plan pages do
                not. Nothing is shown at all when the plan is unknown.
              */}
              {plan ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[14px] leading-6 text-[#334155]">
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="mt-1 shrink-0"
                      >
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke="#306EEC"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : null}

              {/*
                The allowance, only when the server actually told us. A
                "0 of 0" line invented from missing data reads as a fault.
              */}
              {typeof next?.bookingLimit === "number" && next.bookingLimit > 0 ? (
                <p className="mt-4 text-[13px] text-[#64748B]">
                  {next.activeCount || 0} of {next.bookingLimit} active{" "}
                  {next.bookingLimit === 1 ? "booking" : "bookings"} in use
                </p>
              ) : null}

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  href="/book?visit=membership"
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-[9px] bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] sm:flex-none sm:px-7"
                >
                  Book Fixter
                </Link>

                {/*
                  Manage Plan, on the landing screen, going straight to the
                  Stripe portal the account is already configured for:
                  change plan, switch monthly and yearly, update the card,
                  see invoices, cancel. Only rendered when a real
                  subscription sits behind it — a gift has no billing to
                  manage, and a button that opens an error is worse than no
                  button.
                */}
                {isLive(subscription) ? (
                  <button
                    type="button"
                    onClick={openManagePlan}
                    className="inline-flex min-h-[46px] flex-1 items-center justify-center rounded-[9px] border border-[#CBD6E8] bg-white px-5 text-[15px] font-semibold text-[#0F172A] transition hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] disabled:opacity-60 sm:flex-none sm:px-7"
                  >
                    Manage Plan
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onSwitchTab("plan")}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-[9px] px-4 text-[14px] font-semibold text-[#306EEC] transition hover:bg-[#F1F6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
                >
                  Membership details
                </button>
              </div>

              {viaGift ? (
                <p className="mt-3 text-[13px] text-[#64748B]">
                  This membership was a gift, so there is nothing to bill and nothing to cancel.
                </p>
              ) : null}

              {portalError ? (
                <p role="alert" className="mt-3 text-[13px] leading-relaxed text-[#B42318]">
                  {portalError} You can still manage your membership from{" "}
                  <button
                    type="button"
                    onClick={() => onSwitchTab("plan")}
                    className="font-semibold underline underline-offset-2"
                  >
                    Membership details
                  </button>
                  .
                </p>
              ) : null}
            </div>
          </>
        ) : (
          /* ── No membership. Not an empty card: a way in. ── */
          <div className="px-5 py-6 sm:px-6">
            <h2 id="acct-plan" className={H2}>
              {lapsed ? "Your membership has ended" : "No membership yet"}
            </h2>
            <p className={`mt-1.5 max-w-[54ch] ${MUTED}`}>
              {lapsed
                ? "You can start again whenever you like — the same plans, at the same prices."
                : "A membership covers one home: book a Fixter whenever something needs doing, without hunting for somebody first."}
            </p>

            {/*
              The free first visit, ONLY when the server says this property
              is genuinely eligible. Never inferred from "not a member".
            */}
            {freeVisit ? (
              <p className="mt-3 inline-flex rounded-full bg-[#EAF3FF] px-3 py-1.5 text-[13px] font-semibold text-[#1E4FA8]">
                Your first 90-minute visit is free
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/membership/plans"
                className="inline-flex min-h-[46px] items-center justify-center rounded-[9px] bg-[#306EEC] px-7 text-[15px] font-semibold text-white transition hover:bg-[#2558C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
              >
                See Membership Plans
              </Link>
              <Link
                href={freeVisit ? "/book" : "/book?visit=additional"}
                className="inline-flex min-h-[46px] items-center justify-center rounded-[9px] border border-[#CBD6E8] bg-white px-7 text-[15px] font-semibold text-[#0F172A] transition hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
              >
                {freeVisit ? "Book your free visit" : "Book a single visit"}
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ───────────────────────── Next visit ─────────────────────────── */}
      <section className={`${CARD} px-5 py-5 sm:px-6`} aria-labelledby="acct-next">
        <h2 id="acct-next" className={H2}>
          {upcoming ? "Next visit" : "Nothing booked"}
        </h2>

        {upcoming ? (
          <>
            <p className="mt-2 text-[20px] font-semibold tracking-[-0.015em] text-[#0F172A]">
              {new Date(upcoming.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="mt-0.5 text-[15px] text-[#334155]">
              {new Date(upcoming.date).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            {address ? (
              <p className="mt-1 break-words text-[13.5px] text-[#64748B]">{addressLine(address)}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                href="/book#your-visits"
                className="inline-flex min-h-[42px] items-center justify-center rounded-[9px] border border-[#CBD6E8] bg-white px-5 text-[14px] font-semibold text-[#0F172A] transition hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
              >
                View or change this visit
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={`mt-1.5 max-w-[52ch] ${MUTED}`}>
              {covered
                ? "Nothing on the calendar. Book a Fixter whenever something needs doing."
                : "When you book a visit, it will show up here."}
            </p>
            <Link
              href={covered ? "/book?visit=membership" : "/book"}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-[9px] bg-[#306EEC] px-6 text-[14px] font-semibold text-white transition hover:bg-[#2558C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
            >
              Book Fixter
            </Link>
          </>
        )}
      </section>

      {/*
        Gifting, through the SHARED component rather than a second version
        written here. It was in the old overview too; keeping it on the one
        component is what stops the account and the homepage drifting into
        selling slightly different products.
      */}
      <GiftCallout variant="bar" audience={covered ? "member" : "public"} headingId="acct-gift" />

      {/* ───────────────────────── Account tools ──────────────────────── */}
      <section className={`${CARD} px-5 py-5 sm:px-6`} aria-labelledby="acct-tools">
        <h2 id="acct-tools" className={H2}>
          Account
        </h2>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {[
            {
              label: "Personal information",
              hint: "Name, email, phone",
              onClick: () => onSwitchTab("personal"),
            },
            {
              label: "Properties",
              hint: `${addresses.length || "No"} ${addresses.length === 1 ? "property" : "properties"}`,
              onClick: () => onSwitchTab("personal"),
            },
            { label: "Visit history", hint: "Past and upcoming", href: "/book#your-visits" },
            {
              label: "Membership details",
              hint: "Plan, status, changes",
              onClick: () => onSwitchTab("plan"),
            },
            /*
              Billing and invoices are the same destination, because invoice
              history lives inside the Stripe portal and there is no separate
              receipts page to send anybody to. Only offered when there is a
              subscription behind it.
            */
            ...(isLive(subscription)
              ? [
                  {
                    label: "Billing & invoices",
                    hint: "Card, receipts, plan changes",
                    /*
                     * The same door as Manage Plan, so there is one path to
                     * Stripe and one place a portal session is created.
                     */
                    onClick: openManagePlan,
                  },
                ]
              : []),
            { label: "Gift a membership", hint: "Send ProFixter to someone", href: "/gift" },
            { label: "Password & security", hint: "Change your password", onClick: () => onSwitchTab("password") },
          ].map((item) => {
            const inner = (
              <>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-medium text-[#0F172A]">{item.label}</span>
                  <span className="mt-0.5 block text-[12.5px] text-[#7C8899]">{item.hint}</span>
                </span>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-1 shrink-0">
                  <path d="m9 18 6-6-6-6" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            );
            const shared =
              "flex w-full items-start justify-between gap-3 rounded-[9px] px-3 py-3 text-left transition hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]";
            return (
              <li key={item.label}>
                {"href" in item && item.href ? (
                  <Link href={item.href} className={shared}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={item.onClick} className={shared}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/*
        Manage Plan opens here first. Nothing about Stripe is created until the
        member presses Continue, so closing this costs nothing and creates
        nothing.
      */}
      <ManagePlanModal
        open={managePlanOpen}
        subscription={subscription}
        loyalty={managePlanLoyalty}
        busy={portalBusy}
        error={portalError}
        onContinue={continueToPortal}
        onClose={() => {
          setManagePlanOpen(false);
          setPortalError("");
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The column beside the main one on a wide screen, and simply the end of the
 * page on a narrow one. Everything in it is useful but none of it is what
 * somebody came to do, which is exactly what belongs to one side.
 */
export function AccountAside() {
  const fixter = getPrimaryFixter();

  return (
    <div className="space-y-5">
      <section className={`${CARD} px-5 py-5`} aria-labelledby="acct-fixter">
        <h2 id="acct-fixter" className={H2}>
          Your Fixter
        </h2>
        {/*
          Laid out for a narrow column rather than reusing YourFixterRow,
          which is built for the full width of the booking page and folds its
          copy into one word per line at 320px.

          Same record either way - getPrimaryFixter - so there is one source
          for who the Fixter is. The number is DISPLAYED and not linked, which
          is the existing decision in lib/fixter: booking stays in the system
          rather than drifting out one phone call at a time.
        */}
        <div className="mt-3 flex items-center gap-3">
          <Image
            src={fixter.photoSrc}
            alt=""
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 rounded-full object-cover"
            style={{ objectPosition: fixter.photoPosition }}
          />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#0F172A]">{fixter.firstName}</p>
            <p className="text-[12.5px] text-[#7C8899]">Your primary Fixter</p>
            <p className="mt-0.5 text-[13.5px] font-medium tabular-nums text-[#334155]">
              {fixter.phoneDisplay}
            </p>
          </div>
        </div>
        <p className={`mt-3 ${MUTED}`}>
          Questions about the work or your home? Roman is your go-to. Booking stays on this page.
        </p>
      </section>

      <section className={`${CARD} px-5 py-5`} aria-labelledby="acct-help">
        <h2 id="acct-help" className={H2}>
          Need help?
        </h2>
        <p className={`mt-1.5 ${MUTED}`}>
          Call or email and a person will get back to you.
        </p>
        <div className="mt-3.5 flex flex-col gap-2">
          <a
            href={`tel:${BUSINESS_PHONE_E164}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[9px] border border-[#CBD6E8] bg-white px-4 text-[14px] font-semibold text-[#0F172A] transition hover:bg-[#F5F8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
          >
            {BUSINESS_PHONE_DISPLAY}
          </a>
          <a
            href={PUBLIC_CONTACT_MAILTO}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[9px] px-4 text-[14px] font-semibold text-[#306EEC] transition hover:bg-[#F1F6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
          >
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </div>
      </section>

    </div>
  );
}
