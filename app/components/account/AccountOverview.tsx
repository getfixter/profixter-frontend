"use client";

/**
 * My Account: what you can do next, then the account itself.
 *
 * WHAT THIS PAGE HAS TO ANSWER, IN THE FIRST FEW SECONDS
 *
 *   Am I a member, and what can I do right now.
 *
 * Every customer who signs in without somewhere else to go lands here
 * (useCompleteSignIn), including the brand-new account that has nothing but a
 * verified phone number. So the first screen is a short list of real ways in,
 * not a dashboard of empty states:
 *
 *   Not a member   the free first visit (only when it is on offer, below),
 *                  then Membership, One-Time Visit and Full Day as one list,
 *                  each with the one fact that decides it.
 *   Member         their plan and its benefits with Book a visit as the one
 *                  primary action, the next visit, and four quick actions
 *                  (book, Full Day, plan & Loyalty, visit history). Their
 *                  Fixter sits beside it.
 *
 * Gifting is the shared GiftCallout for both. Nothing asks for an address up
 * front: the home is added on demand (AddHomeSheet) by whichever booking or
 * checkout needs it, and the quiet "Add your home" card is optional.
 *
 * NOTHING HERE IS INVENTED.
 *
 * Plan benefits come from PLAN_DETAILS, the same table the marketing pages
 * and the upgrade prompt read. Prices are the same figures the homepage and
 * the header menu quote (lib/business.ts, PLAN_DETAILS). Membership state
 * comes from the subscriptions endpoint, with the per-address coverage map as
 * the fallback. The next visit, the booking allowance and free-first-visit
 * eligibility all come from /bookings/next — never guessed from "they have no
 * subscription".
 *
 * FREE VISIT WITHOUT A HOME. /bookings/next is per property, so an account
 * with no home cannot be asked. Such an account has never booked anything
 * (every booking is made against a home) and, when it also has no
 * subscription history, the free visit is offered: /book/free then asks for
 * the home and checks it with the server before anything is booked, and says
 * plainly if it is not available. A lapsed member never sees it.
 *
 * EVERY ACTION HERE GOES SOMEWHERE REAL. No dead buttons: each one is an
 * existing route or an existing API call, and the two that depend on Stripe
 * are hidden rather than shown broken when there is no subscription behind
 * them.
 */

import { formatPhoneInput } from "@/lib/auth2";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import GiftCallout from "@/app/components/gift/GiftCallout";
import { buttonClass } from "@/app/components/ui/Button";
import ManagePlanModal from "./ManagePlanModal";
import { AddHomeCard, NamePromptCard } from "./ProfilePrompts";
import { getPrimaryFixter } from "@/lib/fixter";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";
import { BUSINESS_PHONE_DISPLAY, BUSINESS_PHONE_E164 } from "@/lib/seo";
import { ONE_TIME_FALLBACK, STANDARD_VISIT_MINUTES } from "@/lib/business";
import { BOOKING_LINKS } from "@/lib/site-architecture";
import { PLAN_DETAILS, type PlanType } from "@/lib/stripe-links";
import { getNextBooking, type NextBookingResponse } from "@/lib/booking-service";
import {
  createBillingPortalSession,
  getLoyaltyStatus,
  getMySubscriptions,
  getSubscriptionActionErrorMessage,
  needsPaymentRecovery,
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

/* The lowest monthly plan price, the same "From $149/mo" the header menu quotes. */
const FROM_PRICE = Math.min(...PLAN_DETAILS.map((p) => p.price));

function Chevron() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="acct-stack" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your account</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="acct-card">
          <div className="acct-skeleton" style={{ width: 160 }} />
          <div className="acct-skeleton mt-3" style={{ maxWidth: 380 }} />
          <div className="acct-skeleton mt-2" style={{ width: "60%", maxWidth: 260 }} />
        </div>
      ))}
    </div>
  );
}

/** One way in: name and one line on the left, the deciding fact on the right. */
function Way({
  href,
  name,
  price,
  desc,
  lead = false,
}: {
  href: string;
  name: string;
  price: string;
  desc: string;
  lead?: boolean;
}) {
  return (
    <li>
      <Link href={href} className={`acct-way ${lead ? "acct-way--lead" : ""}`} data-acct-way={name}>
        <span className="acct-way__name">{name}</span>
        <span className="acct-way__desc">{desc}</span>
        <span className="acct-way__price">{price}</span>
        <span className="acct-way__go">
          <Chevron />
        </span>
      </Link>
    </li>
  );
}

function Tile({
  href,
  onClick,
  title,
  hint,
}: {
  href?: string;
  onClick?: () => void;
  title: string;
  hint: string;
}) {
  const inner: ReactNode = (
    <>
      <b>{title}</b>
      <span>{hint}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="acct-tile">
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="acct-tile">
          {inner}
        </button>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */

export default function AccountOverview({
  formData,
  onSwitchTab,
  onLogout,
}: {
  formData: AccountFormData;
  onSwitchTab: (tab: ActiveTab) => void;
  onLogout: () => void;
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

  /*
   * A failed renewal Stripe is still retrying: the membership has not ended,
   * and the way back is to pay, not to buy again (2026-10-30).
   */
  const paymentAttention = !covered && subscriptions.some((s) => needsPaymentRecovery(s));

  /* A former member: they had one, and it is over. */
  const lapsed =
    !covered &&
    !paymentAttention &&
    subscriptions.some((s) =>
      ["canceled", "cancelled", "expired"].includes(String(s.status || "").toLowerCase())
    );

  const upcoming = next?.future || null;
  /*
   * The free first visit, ONLY when the server says this property is
   * genuinely eligible - or, for an account with no home yet, when nothing
   * on the account rules it out (see the header). Never inferred from "not a
   * member" alone.
   */
  const freeVisitForHome = Boolean(next?.freeFirstVisitAvailable) && next?.introVisitServiceable !== false;
  const freeVisitBeforeHome = !addresses.length && !covered && subscriptions.length === 0;
  const freeVisit = !covered && (address ? freeVisitForHome : freeVisitBeforeHome);
  const outsideArea = Boolean(address) && !covered && next?.introVisitServiceable === false;

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

  const firstName = (formData.name || "").trim().split(/\s+/)[0] || "";
  /* Registration 2.0: a customer may have only a phone, or only an email. */
  const contactLine = (formData.email || "").trim() || formatPhoneInput(String(formData.phone || ""));

  if (loading) return <Skeleton />;

  const fixter = getPrimaryFixter();

  return (
    <div className="acct-grid">
      <div className="acct-stack">
        {/* ─────────────────────────── Greeting ─────────────────────────── */}
        <header className="acct-hello">
          <div className="min-w-0">
            <h1 className="acct-hello__title">{firstName ? `Hello, ${firstName}` : "Welcome to Profixter"}</h1>
            <p className="acct-hello__meta">
              {[contactLine, addresses.length > 1 ? "" : addressLine(address)].filter(Boolean).join(" · ") ||
                "Your account"}
            </p>
          </div>

          {/*
            Property context. Only drawn when there is a genuine choice to
            make — a selector with one option is furniture, not a control.
          */}
          {addresses.length > 1 ? (
            <div className="w-full min-w-0 sm:w-[300px]">
              <label htmlFor="acct-property" className="acct-label">
                Viewing property
              </label>
              <select
                id="acct-property"
                value={addressId}
                onChange={(e) => {
                  setChosenAddressId(e.target.value);
                  setLoading(true);
                }}
                className="acct-select"
              >
                {addresses.map((a) => (
                  <option key={String(a._id)} value={String(a._id)}>
                    {a.line1}
                    {a.hasActiveSubscription ? " · Member" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </header>

        <NamePromptCard />

        {covered ? (
          <>
            {/* ───────────────────────── Membership ───────────────────────── */}
            <section className="acct-card" aria-labelledby="acct-plan" data-acct-state="member">
              <h2 id="acct-plan" className="acct-card__title">
                {plan ? `${plan.name} Membership` : "Membership"}
              </h2>
              <p className="acct-meta">
                <span className="acct-status">Active</span>
                {viaGift ? <span>Gift membership</span> : billingLine(subscription) ? <span>{billingLine(subscription)}</span> : null}
                {address ? <span className="break-words">{address.line1}</span> : null}
              </p>

              {/*
                Benefits, read from the shared plan table rather than written
                out here, so this cannot promise something the plan pages do
                not. Nothing is shown at all when the plan is unknown.
              */}
              {plan ? (
                <ul className="ui-checks acct-benefits">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              ) : null}

              {/*
                The allowance, only when the server actually told us. A
                "0 of 0" line invented from missing data reads as a fault.
              */}
              {typeof next?.bookingLimit === "number" && next.bookingLimit > 0 ? (
                <p className="ui-small mt-4">
                  {next.activeCount || 0} of {next.bookingLimit} {next.bookingLimit === 1 ? "visit" : "visits"} booked
                  right now
                </p>
              ) : null}

              <div className="acct-card__actions">
                <Link href="/book?visit=membership" className={buttonClass({ variant: "primary" })}>
                  Book a visit
                </Link>

                {/*
                  Manage Plan goes to OUR summary first and then the Stripe
                  portal: change plan, switch monthly and yearly, update the
                  card, see invoices. Only rendered when a real subscription
                  sits behind it — a gift has no billing to manage, and a
                  button that opens an error is worse than no button.
                */}
                {isLive(subscription) ? (
                  <button type="button" onClick={openManagePlan} className={buttonClass({ variant: "secondary" })}>
                    Manage Plan
                  </button>
                ) : null}

                <button type="button" onClick={() => onSwitchTab("plan")} className={buttonClass({ variant: "ghost" })}>
                  Membership details
                </button>
              </div>

              {viaGift ? (
                <p className="ui-small mt-3">
                  This membership was a gift, so there is nothing to bill and nothing to cancel.
                </p>
              ) : null}

              {portalError ? (
                <p role="alert" className="acct-error">
                  {portalError} You can still manage your membership from{" "}
                  <button type="button" onClick={() => onSwitchTab("plan")} className="font-semibold underline underline-offset-2">
                    Membership details
                  </button>
                  .
                </p>
              ) : null}
            </section>

            {/* ───────────────────────── Next visit ───────────────────────── */}
            <section className="acct-card" aria-labelledby="acct-next">
              <div className="acct-next">
                <div className="min-w-0">
                  <h2 id="acct-next" className="acct-label !mb-0">
                    {upcoming ? "Next visit" : "Nothing booked"}
                  </h2>
                  {upcoming ? (
                    <>
                      <p className="acct-next__when">
                        {new Date(upcoming.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                        {" · "}
                        {new Date(upcoming.date).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {address ? <p className="ui-small mt-0.5 break-words">{addressLine(address)}</p> : null}
                    </>
                  ) : (
                    <p className="acct-card__text">Book a Fixter whenever something needs doing.</p>
                  )}
                </div>
                {upcoming ? (
                  <Link href="/book#your-visits" className={buttonClass({ variant: "secondary", size: "sm" })}>
                    View or change
                  </Link>
                ) : null}
              </div>
            </section>

            {/* ──────────────────────── Member actions ─────────────────────── */}
            <section aria-labelledby="acct-actions">
              <h2 id="acct-actions" className="sr-only">
                Member actions
              </h2>
              <ul className="acct-tiles">
                <Tile href="/book?visit=membership" title="Book a visit" hint={`Up to ${STANDARD_VISIT_MINUTES} minutes`} />
                <Tile href={BOOKING_LINKS.fullDay.href} title="Full Day" hint="One Fixter, your whole list" />
                <Tile onClick={() => onSwitchTab("plan")} title="Plan & Loyalty" hint="Your plan and rewards" />
                <Tile href="/book#your-visits" title="Your visits" hint="Upcoming and past" />
              </ul>
            </section>
          </>
        ) : (
          <>
            {/* ───────────── Not a member: the ways in, plainly ───────────── */}
            {freeVisit ? (
              <section className="acct-card acct-offer" aria-labelledby="acct-free" data-acct-state="free-visit">
                <div className="min-w-0">
                  <p className="ui-eyebrow ui-eyebrow--accent">Free Visit</p>
                  <h2 id="acct-free" className="acct-card__title mt-1">
                    Let&rsquo;s take a look at your to-do list.
                  </h2>
                  <p className="acct-card__text">
                    We&rsquo;ll visit your home, go over your list and help you find the right Profixter service. Free, no card needed.
                    {!address ? " We'll check your address when you book." : ""}
                  </p>
                </div>
                <Link href={BOOKING_LINKS.freeVisit.href} className={buttonClass({ variant: "accent" })}>
                  Book your free visit
                </Link>
              </section>
            ) : null}

            {paymentAttention ? (
              <section className="acct-card" aria-labelledby="acct-attention" data-acct-state="payment-attention">
                <h2 id="acct-attention" className="acct-card__title">
                  Your membership payment needs attention
                </h2>
                <p className="acct-card__text">
                  We could not process your renewal. Your membership has not ended, but booking new visits is paused
                  until the payment goes through. There is no need to buy a new membership.
                </p>
                <div className="acct-card__actions">
                  <Link href="/account?tab=plan" className={buttonClass({ variant: "primary" })}>
                    Update payment
                  </Link>
                </div>
              </section>
            ) : null}

            {lapsed ? (
              <section className="acct-card" aria-labelledby="acct-lapsed" data-acct-state="lapsed">
                <h2 id="acct-lapsed" className="acct-card__title">
                  Your membership has ended
                </h2>
                <p className="acct-card__text">
                  You can start again whenever you like — the same plans, at the same prices.
                </p>
                <div className="acct-card__actions">
                  <Link href={BOOKING_LINKS.memberships.href} className={buttonClass({ variant: "primary" })}>
                    See Membership Plans
                  </Link>
                </div>
              </section>
            ) : null}

            {outsideArea ? (
              <p className="acct-note !mt-0" role="status">
                We&rsquo;re not in your area yet. Profixter serves Nassau and Suffolk counties on Long Island.
              </p>
            ) : null}

            <section className="acct-card acct-card--flush" aria-labelledby="acct-plan" data-acct-state="customer">
              <div className="px-[18px] pt-[18px] sm:px-6 sm:pt-[22px]">
                <h2 id="acct-plan" className="acct-card__title">
                  {freeVisit ? "Or choose how to book" : "Ways to book"}
                </h2>
              </div>
              <ul className="acct-ways mt-2">
                <Way
                  lead
                  href={BOOKING_LINKS.memberships.href}
                  name="Membership"
                  price={`From $${FROM_PRICE}/mo`}
                  desc="Book as often as you need."
                />
                <Way
                  href={BOOKING_LINKS.oneTime.href}
                  name="One-Time Visit"
                  price={`$${ONE_TIME_FALLBACK.priceDollars}`}
                  desc={`One small job, up to ${ONE_TIME_FALLBACK.minutes} minutes.`}
                />
                <Way href={BOOKING_LINKS.fullDay.href} name="Full Day" price="All day" desc="One Fixter, your whole list." />
              </ul>
            </section>

            {upcoming ? (
              <section className="acct-card" aria-labelledby="acct-next">
                <div className="acct-next">
                  <div className="min-w-0">
                    <h2 id="acct-next" className="acct-label !mb-0">
                      Next visit
                    </h2>
                    <p className="acct-next__when">
                      {new Date(upcoming.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                      {" · "}
                      {new Date(upcoming.date).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    {address ? <p className="ui-small mt-0.5 break-words">{addressLine(address)}</p> : null}
                    {/^pending confirmation$/i.test(String(upcoming.status || "")) ? (
                      <p className="ui-small mt-1 font-semibold text-amber-700" data-acct="awaiting">Awaiting confirmation from Profixter</p>
                    ) : null}
                  </div>
                  <Link href="/book#your-visits" className={buttonClass({ variant: "secondary", size: "sm" })}>
                    View or change
                  </Link>
                </div>
              </section>
            ) : null}

            <AddHomeCard hasHome={addresses.length > 0} />
          </>
        )}

        {/*
          Gifting, through the SHARED component rather than a second version
          written here. Keeping the account and the homepage on one component
          is what stops them drifting into selling slightly different products.
        */}
        <GiftCallout variant="bar" audience={covered ? "member" : "public"} headingId="acct-gift" />

        {/* ───────────────────────── Account tools ──────────────────────── */}
        <section className="acct-card acct-card--flush" aria-labelledby="acct-tools">
          <h2 id="acct-tools" className="acct-section-title px-[18px] pt-4 sm:px-6">
            Account
          </h2>
          <ul className="acct-list mt-1">
            {[
              {
                label: "Personal information",
                hint: "Name, contact details, homes, text and email choices",
                onClick: () => onSwitchTab("personal"),
              },
              { label: "Visit history", hint: "Past and upcoming", href: "/book#your-visits" },
              {
                label: "Membership details",
                hint: covered ? "Plan, status, changes" : "Plans, gifts you sent or received",
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
              { label: "Password & security", hint: "Password, delete account", onClick: () => onSwitchTab("password") },
            ].map((item) => {
              const inner = (
                <>
                  <span className="min-w-0">
                    <span className="acct-row__label">{item.label}</span>
                    <span className="acct-row__hint">{item.hint}</span>
                  </span>
                  <span className="acct-row__chev">
                    <Chevron />
                  </span>
                </>
              );
              return (
                <li key={item.label}>
                  {"href" in item && item.href ? (
                    <Link href={item.href} className="acct-row">
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={item.onClick} className="acct-row">
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
            <li>
              <button type="button" onClick={onLogout} className="acct-row acct-row--danger">
                <span className="acct-row__label">Log out</span>
              </button>
            </li>
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

      {/*
        The column beside the main one on a wide screen, and simply the end of
        the page on a narrow one. Useful, never the reason somebody came.
      */}
      <aside className="acct-stack" aria-label="Help and your Fixter">
        {covered ? (
          <section className="acct-card" aria-labelledby="acct-fixter">
            <h2 id="acct-fixter" className="acct-label">
              Your Fixter
            </h2>
            {/*
              Same record as the booking page - getPrimaryFixter - so there is
              one source for who the Fixter is. The number is DISPLAYED and not
              linked, which is the existing decision in lib/fixter: booking
              stays in the system rather than drifting out one call at a time.
            */}
            <div className="mt-2 flex items-center gap-3">
              <Image
                src={fixter.photoSrc}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                style={{ objectPosition: fixter.photoPosition }}
              />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[color:var(--ui-ink)]">{fixter.firstName}</p>
                <p className="ui-small">Your primary Fixter</p>
                <p className="ui-num text-[14px] font-medium text-[color:var(--ui-text-2)]">{fixter.phoneDisplay}</p>
              </div>
            </div>
            <p className="acct-card__text">
              Questions about the work or your home? {fixter.firstName} is your go-to.
            </p>
          </section>
        ) : null}

        <section className="acct-card" aria-labelledby="acct-help">
          <h2 id="acct-help" className="acct-label">
            Need help?
          </h2>
          <p className="acct-card__text !mt-1">Call or email and a person will get back to you.</p>
          <div className="mt-3 flex flex-col gap-1">
            <a href={`tel:${BUSINESS_PHONE_E164}`} className={buttonClass({ variant: "secondary", size: "sm", block: true })}>
              {BUSINESS_PHONE_DISPLAY}
            </a>
            <a href={PUBLIC_CONTACT_MAILTO} className={buttonClass({ variant: "ghost", size: "sm", block: true, className: "break-all" })}>
              {PUBLIC_CONTACT_EMAIL}
            </a>
          </div>
        </section>
      </aside>
    </div>
  );
}
