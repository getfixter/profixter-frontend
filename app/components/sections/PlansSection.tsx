"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { plans, type Plan } from "@/app/data/content";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath } from "@/lib/auth-routing";
import type { PlanType } from "@/lib/stripe-links";
import type { Address } from "@/lib/auth-service";
import { trackInitiateCheckout } from "@/lib/analytics";
import {
  createBillingPortalSession,
  getSubscriptionActionErrorMessage,
  getManagedSubscriptionForAddress,
  type ManagedSubscription,
} from "@/lib/subscription-service";

type BillingCycle = "monthly" | "annual";
type CheckoutResponse = {
  url?: string;
  eventId?: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

type ChangeActionKind =
  | "subscribe"
  | "active"
  | "active-unknown"
  | "scheduled"
  | "cancel-scheduled"
  | "upgrade"
  | "downgrade";

/**
 * What each tier ADDS, not what each tier has.
 *
 * These lists used to be absolute, and they were absolute inconsistently:
 * Basic was the only plan that said "All handyman services included", Elite was
 * the only plan that did NOT say "Basic materials included", and "90-minute
 * visits" vanished at Premium. Read literally - which is how a homeowner
 * comparing four boxes reads them - the $499 plan appeared to include less than
 * the $249 one, and Elite's project discount was missing altogether.
 *
 * Nothing about the plans changed. The ladder is now stated cumulatively, so
 * each card carries only its own differences and inherits everything below it.
 * That fixes the false implications, makes the reason to pay more the only
 * thing on the card, and makes the cards shorter at the same time.
 *
 * The Priority Visit caveat used to be repeated verbatim inside two cards,
 * where it took about a quarter of each. It is now stated once under the grid.
 */
/**
 * What each rung ADDS, and nothing else.
 *
 * This replaced a per-plan description plus a full feature list. Three of
 * Basic's four bullets - "All handyman services included", "90-minute visits",
 * "Request membership visits as needed" - are true of every plan, so they were
 * the foundation masquerading as Basic's benefits, and every card above had to
 * say "Everything in X" to point back at them.
 *
 * The foundation is stated once above the ladder now. These are the seven real
 * differences between the four plans.
 */
const planLadder: Record<
  Plan["name"],
  { inherits: string | null; adds: string[] }
> = {
  Basic: {
    inherits: null,
    adds: ["1 visit at a time"],
  },
  Plus: {
    inherits: "Everything in Basic",
    adds: ["2 visits at a time", "Basic materials included"],
  },
  Premium: {
    inherits: "Everything in Plus",
    adds: ["1 Priority Visit a month"],
  },
  Elite: {
    inherits: "Everything in Premium",
    adds: [
      "2 Priority Visits a month",
      "1 full project day a month (up to 8 hours)",
      "10% off home improvement projects",
    ],
  },
};

function toNumberPrice(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function normalizePlanType(name: string): PlanType | null {
  const x = String(name || "").toLowerCase().trim();
  if (x === "basic") return "basic";
  if (x === "plus") return "plus";
  if (x === "premium") return "premium";
  if (x === "elite") return "elite";
  return null;
}

function getPlanRank(plan: PlanType | null): number {
  if (plan === "basic") return 1;
  if (plan === "plus") return 2;
  if (plan === "premium") return 3;
  if (plan === "elite") return 4;
  return 0;
}

function isManagedActiveStatus(status?: string | null): boolean {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

/*
 * Annual members are charged for ten months and get twelve.
 *
 * Ten is the whole offer, so it is stated once here rather than spelled into
 * each card. These figures mirror the live Stripe annual prices exactly
 * ($1,490 / $2,490 / $3,490 / $4,990); the backend still resolves the real
 * Stripe price id from the plan and cycle, so this is presentation only and
 * cannot put a price on screen that checkout would not honour.
 */
const ANNUAL_MONTHS_CHARGED = 10;
const MONTHS_PER_YEAR = 12;

type PlanPricing = {
  /** The number the customer actually pays this cycle. */
  amount: number;
  suffix: "/mo" | "/year";
  /** Twelve months at the monthly rate, shown struck through. Null on monthly. */
  regular: number | null;
};

function getPlanPricing(plan: Plan, billing: BillingCycle): PlanPricing {
  const monthly = toNumberPrice(plan.price);

  if (billing !== "annual") {
    return { amount: monthly, suffix: "/mo", regular: null };
  }

  return {
    amount: monthly * ANNUAL_MONTHS_CHARGED,
    suffix: "/year",
    regular: monthly * MONTHS_PER_YEAR,
  };
}

/**
 * The price area of a plan card.
 *
 * Monthly renders exactly what it always did: one number and "/mo". Annual adds
 * a single line above it carrying the struck-through twelve-month price and the
 * saving, so the deal is legible before the eye reaches the big number, the big
 * number stays the strongest thing in the block, and the card grows by one line
 * rather than by a promotional panel.
 *
 * The line wraps as a unit on narrow phones instead of splitting the amount from
 * its label, and the annual figure carries "/year" so an upfront yearly charge is
 * never labelled "/mo".
 */
function PlanPriceBlock({
  plan,
  billing,
  amountClassName,
}: {
  plan: Plan;
  billing: BillingCycle;
  amountClassName: string;
}) {
  const pricing = getPlanPricing(plan, billing);

  return (
    <>
      {pricing.regular !== null ? (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] font-medium text-[#86868B] line-through decoration-[#B0B0B8] decoration-1">
            ${formatMoney(pricing.regular)}
          </span>
          <span className="whitespace-nowrap rounded-[6px] bg-[#EEF4FF] px-2 py-[3px] text-[11px] font-semibold tracking-[0.01em] text-[#1F5ED8]">
            2 months free
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-x-1">
        <span className={amountClassName}>${formatMoney(pricing.amount)}</span>
        <span className="pb-1 text-sm font-medium text-[#6E6E73]">{pricing.suffix}</span>
      </div>
    </>
  );
}

type PlansSectionProps = {
  /**
   * Suppress this section's own introduction.
   *
   * On /membership this section is one part of a longer sales page and needs
   * its own heading. On /membership/plans the whole page is the comparison and
   * already opens with an H1 saying the same thing, so the section's heading,
   * its subheading and the "home base" explainer stacked three introductions
   * on top of each other before the first price appeared. Set it there and the
   * page reads: context, H1, one sentence, billing toggle, plans.
   */
  hideIntro?: boolean;
  hideCancellationUi?: boolean;
  compact?: boolean;
};

export default function PlansSection({ hideCancellationUi = false, compact = false, hideIntro = false }: PlansSectionProps = {}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [promoCode, setPromoCode] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [checkoutCanceled, setCheckoutCanceled] = useState(false);
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const { user, isAuthenticated, token } = useAuth();
  const roleLandingPath = getRoleLandingPath(user);

  const addresses: Address[] = useMemo(() => user?.addresses || [], [user?.addresses]);

  const defaultAddress = useMemo(() => {
    if (!user) return null;
    const defaultId = String(user.defaultAddressId || "");
    return addresses.find((a) => String(a._id) === defaultId) || addresses[0] || null;
  }, [addresses, user]);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const selectedAddress = useMemo(
    () => addresses.find((a) => String(a._id) === String(selectedAddressId)) || null,
    [addresses, selectedAddressId]
  );
  const [addressSubscriptionMap, setAddressSubscriptionMap] = useState<
    Record<string, ManagedSubscription | null | undefined>
  >({});
  const [checkingAddr, setCheckingAddr] = useState(false);

  const mobilePlanOrder = useMemo(
    () => ["Basic", "Plus", "Premium", "Elite"] as const,
    []
  );
  const mobilePlans = useMemo(
    () =>
      mobilePlanOrder
        .map((name) => plans.find((plan) => plan.name === name))
        .filter((plan): plan is Plan => Boolean(plan)),
    [mobilePlanOrder]
  );

  useEffect(() => {
    if (!selectedAddressId && defaultAddress?._id) {
      setSelectedAddressId(String(defaultAddress._id));
    }
  }, [defaultAddress, selectedAddressId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const requestedPromo = String(
      params.get("promo") || sessionStorage.getItem("pendingPromoCode") || ""
    )
      .trim()
      .toUpperCase();
    const pendingRaw = sessionStorage.getItem("pendingCheckoutPlan");
    let pending: {
      plan?: string;
      billingCycle?: BillingCycle;
      planName?: string;
      addressId?: string;
    } | null = null;

    if (pendingRaw) {
      try {
        pending = JSON.parse(pendingRaw);
      } catch {
        pending = null;
      }
    }

    const requestedBilling = String(
      params.get("billingCycle") || pending?.billingCycle || ""
    ).toLowerCase();
    const requestedAddressId = params.get("addressId") || pending?.addressId || "";

    if (requestedBilling === "monthly" || requestedBilling === "annual") {
      setBilling(requestedBilling);
    }

    /*
      Backing out of Stripe is ordinary behaviour, not an error. Stripe used to
      return these people to the homepage with their plan in a query string
      nothing read, so the selection was effectively thrown away. They now come
      back here, with the cycle and address restored above, and a line telling
      them where they are.
    */
    if (params.get("canceled") === "true") setCheckoutCanceled(true);

    if (requestedPromo) {
      setPromoCode(requestedPromo);
      sessionStorage.setItem("pendingPromoCode", requestedPromo);
    }

    if (
      requestedAddressId &&
      addresses.some((address) => String(address._id) === String(requestedAddressId))
    ) {
      setSelectedAddressId(String(requestedAddressId));
    }
  }, [addresses]);

  const checkAddressState = useCallback(async (addressId: string) => {
    if (!token) return;
    setCheckingAddr(true);
    try {
      const subscription = await getManagedSubscriptionForAddress(addressId);
      setAddressSubscriptionMap((map) => ({ ...map, [addressId]: subscription }));
    } catch (e) {
      console.error("checkAddressState failed:", e);
      setAddressSubscriptionMap((map) => ({ ...map, [addressId]: null }));
    } finally {
      setCheckingAddr(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedAddressId && addressSubscriptionMap[selectedAddressId] === undefined) {
      checkAddressState(selectedAddressId);
    }
  }, [token, selectedAddressId, addressSubscriptionMap, checkAddressState]);

  const startCheckout = async (
    plan: PlanType,
    addressId: string,
    email: string,
    cycle: BillingCycle,
    planName: string
  ) => {
    const apiBase = String(API.defaults.baseURL || process.env.NEXT_PUBLIC_API_URL || "");
    const authToken = token || localStorage.getItem("token");
    const endpointPath = "/api/stripe/checkout/create-checkout-session";
    const endpointUrl = `${apiBase.replace(/\/$/, "")}${endpointPath}`;
    /*
      Where to land after signing up: the page that actually holds the
      comparison. This pointed at /membership#plans, which was correct while the
      grid was duplicated there - it is not any more, and a customer returning
      from signup would have found a price and no way to resume.
    */
    const preservePlanUrl = `/membership/plans?plan=${encodeURIComponent(plan)}&billingCycle=${encodeURIComponent(
      cycle
    )}&addressId=${encodeURIComponent(addressId)}`;

    if (!authToken) {
      console.error("[checkout] Missing auth token before checkout request", {
        tokenExists: false,
        authHeaderAttached: false,
        endpointUrl,
        plan,
        addressId,
        billingCycle: cycle,
      });
      sessionStorage.setItem(
        "pendingCheckoutPlan",
        JSON.stringify({ plan, billingCycle: cycle, planName, addressId })
      );
      window.location.href = `/signup?redirect=${encodeURIComponent(preservePlanUrl)}`;
      return;
    }

    const requestCheckoutSession = async (): Promise<{
      status: number;
      data: CheckoutResponse;
    }> => {
      const res = await API.post<CheckoutResponse>(
        endpointPath,
        {
          plan,
          addressId,
          email,
          billingCycle: cycle,
          ...(promoCode ? { code: promoCode } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          validateStatus: () => true,
        }
      );

      return { status: res.status, data: res.data || {} };
    };

    try {
      setActionLoadingPlan(planName);
      setActionError("");

      let { status, data } = await requestCheckoutSession();

      if (status === 409 && data?.code === "ADDRESS_ALREADY_SUBSCRIBED") {
        setActionError(
          "This address already has an active membership. Refresh your account or contact support."
        );
        setAddressSubscriptionMap((map) => ({ ...map, [addressId]: map[addressId] || null }));
        return;
      }

      if (!data?.url && status >= 200 && status < 300) {
        console.error("[checkout] Checkout session response missing redirect URL; retrying once", {
          endpointUrl,
          responseStatus: status,
          response: data,
          plan,
          addressId,
          billingCycle: cycle,
        });
        ({ status, data } = await requestCheckoutSession());
      }

      if (data?.url) {
        trackInitiateCheckout({
          plan,
          billing_cycle: cycle,
          address_id: addressId,
        });
        window.location.href = data.url;
        return;
      }

      console.error("[checkout] Checkout session creation failed", {
        endpointUrl,
        responseStatus: status,
        response: data,
        plan,
        addressId,
        billingCycle: cycle,
      });

      if (status === 401) {
        sessionStorage.setItem(
          "pendingCheckoutPlan",
          JSON.stringify({ plan, billingCycle: cycle, planName, addressId })
        );
        window.location.href = `/signup?redirect=${encodeURIComponent(preservePlanUrl)}`;
        return;
      }

      setActionError(
        getSubscriptionActionErrorMessage({
          response: {
            status,
            data,
          },
        })
      );
    } catch (error: unknown) {
      console.error("[checkout] Checkout request crashed", {
        endpointUrl,
        responseStatus:
          typeof error === "object" && error && "response" in error
            ? (error.response as { status?: number } | undefined)?.status || null
            : null,
        message:
          typeof error === "object" && error && "message" in error
            ? String(error.message)
            : "Unknown checkout error",
        plan,
        addressId,
        billingCycle: cycle,
      });
      setActionError(getSubscriptionActionErrorMessage(error));
    } finally {
      setActionLoadingPlan((current) => (current === planName ? null : current));
    }
  };

  const getActionForPlan = (planName: string) => {
    const planType = normalizePlanType(planName);
    const selectedSubscription = selectedAddressId
      ? addressSubscriptionMap[selectedAddressId] || null
      : null;
    const selectedAddressActive = isManagedActiveStatus(selectedSubscription?.status);
    const currentPlan = normalizePlanType(selectedSubscription?.subscriptionType || "");
    const pendingPlan = normalizePlanType(selectedSubscription?.pendingPlan || "");
    const pendingCycle = String(
      selectedSubscription?.pendingBillingCycle || selectedSubscription?.billingCycle || "monthly"
    );

    if (!planType || !selectedAddressActive) {
      /*
       * The subscription record is the only thing that can tell us whether
       * this is an upgrade, a downgrade or a fresh signup, so we cannot label
       * the button properly until it loads. What we must not do meanwhile is
       * offer a subscription to somebody who already has one: the address
       * itself carries hasActiveSubscription, and if that says member, then a
       * missing or slow subscription lookup should read as "still loading",
       * not as "you are a stranger".
       */
      const addressSaysMember = Boolean(selectedAddress?.hasActiveSubscription);
      const stillResolving =
        selectedAddressId !== null && addressSubscriptionMap[selectedAddressId] === undefined;

      if (addressSaysMember) {
        // active-unknown is a no-op on click, so this stays disabled rather
        // than offering an action it cannot carry out. Plan management for
        // this case lives in Account.
        return {
          kind: "active-unknown" as ChangeActionKind,
          label: stillResolving ? "Checking your plan..." : "Manage Plan",
          disabled: true,
        };
      }

      return {
        kind: "subscribe" as ChangeActionKind,
        label: "Start Membership",
        disabled: false,
      };
    }

    if (selectedSubscription?.cancelAtPeriodEnd && !hideCancellationUi) {
      return {
        kind: "cancel-scheduled" as ChangeActionKind,
        label: "Cancellation scheduled",
        disabled: true,
      };
    }

    if (!currentPlan) {
      return {
        kind: "active-unknown" as ChangeActionKind,
        label: "Manage Plan",
        disabled: true,
      };
    }

    const currentRank = getPlanRank(currentPlan);
    const targetRank = getPlanRank(planType);
    const sameCycle =
      String(selectedSubscription?.billingCycle || "monthly") === String(billing || "monthly");

    if (pendingPlan === planType && pendingCycle === String(billing || "monthly")) {
      return {
        kind: "scheduled" as ChangeActionKind,
        label: "Scheduled",
        disabled: true,
      };
    }

    if (targetRank === currentRank && sameCycle) {
      return {
        kind: "active" as ChangeActionKind,
        label: "Current Plan",
        disabled: true,
      };
    }

    if (targetRank === currentRank && !sameCycle) {
      return {
        kind: billing === "annual" ? ("upgrade" as ChangeActionKind) : ("downgrade" as ChangeActionKind),
        label: "Change Plan",
        disabled: false,
      };
    }

    /*
     * The direction was already known here and thrown away at the label: every
     * plan above and below the member's own read "Change Plan", so the one
     * question a member opens this page to answer, which way is up, was the
     * one thing the buttons would not say.
     *
     * Presentation only. The kind, and therefore the billing path taken, is
     * exactly what it was.
     */
    const isUpgrade = targetRank > currentRank;
    return {
      kind: isUpgrade ? ("upgrade" as ChangeActionKind) : ("downgrade" as ChangeActionKind),
      label: isUpgrade ? "Upgrade" : "Change Plan",
      disabled: false,
    };
  };

  const openBillingPortalForSelectedAddress = async (planName: string) => {
    if (!selectedAddress) return;
    try {
      setActionLoadingPlan(planName);
      setActionError("");
      const { url } = await createBillingPortalSession({
        addressId: selectedAddress._id,
      });
      window.location.href = url;
    } catch (error: unknown) {
      setActionError(getSubscriptionActionErrorMessage(error));
    } finally {
      setActionLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (actionLoadingPlan) return;
    const planType = normalizePlanType(planName);
    setActionError("");
    setActionMessage("");

    if (!planType) {
      setActionError("Invalid plan selected. Please refresh and try again.");
      return;
    }

    if (!isAuthenticated || !user) {
      sessionStorage.setItem(
        "pendingCheckoutPlan",
        JSON.stringify({ plan: planType, billingCycle: billing, planName })
      );
      /* Back to the comparison, which is where the grid now lives. */
      window.location.href = `/signup?redirect=${encodeURIComponent(
        `/membership/plans?plan=${encodeURIComponent(planType)}&billingCycle=${encodeURIComponent(billing)}`
      )}`;
      return;
    }

    if (!addresses.length) {
      setActionError("Please add an address to your account first.");
      window.location.href = roleLandingPath;
      return;
    }

    if (!selectedAddressId || !selectedAddress) {
      setActionError("Please select an address.");
      return;
    }

    const action = getActionForPlan(planName);

    if (
      action.kind === "active" ||
      action.kind === "active-unknown" ||
      action.kind === "scheduled" ||
      action.kind === "cancel-scheduled"
    ) {
      if (action.kind === "active") {
        setActionMessage("You're already on this plan.");
      }
      return;
    }

    if (action.kind === "subscribe") {
      await startCheckout(planType, selectedAddress._id, user.email, billing, planName);
      return;
    }

    await openBillingPortalForSelectedAddress(planName);
  };

  const selectedAddressSubscription = selectedAddressId
    ? addressSubscriptionMap[selectedAddressId] || null
    : null;
  const addressIsActive = isManagedActiveStatus(selectedAddressSubscription?.status);

  const AddressPicker = () => (
    <div className="mx-auto mb-8 max-w-[720px]">
      <div className="rounded-[8px] border border-[#E5E7EB] bg-white px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
              Service address
            </label>
            <select
              value={selectedAddressId || ""}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedAddressId(id);
                if (token && addressSubscriptionMap[id] === undefined) {
                  checkAddressState(id);
                }
              }}
              className="h-11 w-full rounded-[8px] border border-[#D1D5DB] bg-[#F9FAFB] px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111827]"
            >
              {addresses.map((a) => (
                <option key={a._id} value={a._id}>
                  {(a.label ? `${a.label}: ` : "") + `${a.line1}, ${a.city}`}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm font-semibold text-[#4B5563] sm:min-w-[130px] sm:text-right">
            {checkingAddr ? "Checking..." : addressIsActive ? "Active plan" : "No active plan"}
          </div>
        </div>
      </div>
    </div>
  );

  const BillingToggle = () => (
    <div className={compact ? "mt-3 flex flex-col items-center lg:mt-5" : "mt-7 flex flex-col items-center"}>
      <div className="inline-grid rounded-[8px] bg-[#E8E8ED] p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] lg:p-1.5">
        <div className="grid grid-cols-2 gap-1">
          {(["monthly", "annual"] as const).map((cycle) => {
            const active = billing === cycle;

            return (
              <button
                key={cycle}
                type="button"
                aria-pressed={active}
                onClick={() => setBilling(cycle)}
                className={[
                  // h-9 was 36px on phones and tablets, where the toggle is
                  // most likely to be tapped rather than clicked.
                  "h-11 min-w-[104px] rounded-[6px] px-5 text-sm font-semibold capitalize transition duration-200 lg:min-w-[124px] lg:px-7 lg:text-[15px]",
                  active
                    ? "bg-white text-[#111111] shadow-[0_6px_18px_rgba(15,23,42,0.10)]"
                    : "text-[#6E6E73] hover:text-[#111111]",
                ].join(" ")}
              >
                {cycle}
              </button>
            );
          })}
        </div>
      </div>

      {/*
        * The annual offer said once, where the choice is actually made.
        *
        * Only when this section carries no annual note of its own: the compact
        * layout already opens with the "Annual special" panel above this toggle,
        * and the same sentence twice within one screen reads as advertising
        * rather than as a detail of the product.
        */}
      {!compact ? (
        /*
          The terms of the cycle you are actually looking at.
          
          "Every plan is month to month" used to sit above this as the page's
          governing sentence, and it stayed there while Annual was selected -
          telling somebody reading a once-a-year price that they were buying
          month to month. Each cycle now states its own terms.
        */
        <p className="mt-3 max-w-[340px] text-center text-[13px] leading-5 text-[#6E6E73] sm:max-w-none">
          {billing === "annual" ? (
            <>
              Billed once for the year &mdash;{" "}
              <span className="font-semibold text-[#111111]">12 months for the price of 10</span>.
            </>
          ) : (
            <>
              <span className="font-semibold text-[#111111]">Month to month.</span> Cancel any
              time. Choose annual and get 12 months for the price of 10.
            </>
          )}
        </p>
      ) : null}
    </div>
  );

  const PlanCheck = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-[4px] flex-none text-[#111111]">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  /**
   * Mobile-first plan presentation.
   *
   * Replaces the previous 5-column comparison grid, which forced 6-8px type on
   * a phone. Each plan is an independent card a customer can understand on its
   * own; the shared basics are stated once above the list instead of repeated
   * as table rows.
   */
  const CompactPlanComparison = () => {
    const planCopy: Record<Plan["name"], { adds: string[] }> = {
      Basic: { adds: [] },
      Plus: { adds: ["Everyday materials included", "A second visit can be on the calendar at once"] },
      Premium: { adds: ["Everything in Plus", "One Priority Visit each month"] },
      Elite: { adds: ["Everything in Premium", "Two Priority Visits each month", "One full project day each month", "10% off larger home projects"] },
    };

    return (
      <div className="mx-auto max-w-[640px] lg:max-w-[1120px]">
        {/* Shared basics, said once. */}
        <div className="rounded-[8px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#306EEC]">
            Every membership
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              "No monthly visit allowance",
              "90 minutes of work per visit",
              "The same local team each time",
              "Month to month, cancel any time",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.45] text-[#1D1D1F]">
                <svg className="mt-[3px] shrink-0 text-[#306EEC]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 12.5 4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {mobilePlans.map((plan) => {
            const action = getActionForPlan(plan.name);
            const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
            const isPopular = plan.name === "Plus";
            const adds = planCopy[plan.name].adds;

            return (
              <article
                key={plan.name}
                className={[
                  "relative flex flex-col rounded-[8px] border bg-white p-5 sm:p-6",
                  isPopular ? "border-[#306EEC] ring-1 ring-[#306EEC]" : "border-[#E5E5EA]",
                ].join(" ")}
              >
                {isPopular ? (
                  <span className="absolute right-5 top-5 rounded-[8px] bg-[#EEF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#1F5ED8]">
                    Most chosen
                  </span>
                ) : null}

                <h3 className="pr-24 text-[19px] font-semibold tracking-[-0.02em] text-[#111111]">
                  {plan.displayName}
                </h3>
                <p className="mt-1 text-[14px] leading-[1.45] text-[#6E6E73]">{plan.tagline}</p>

                <div className="mt-4">
                  <PlanPriceBlock
                    plan={plan}
                    billing={billing}
                    amountClassName="text-[30px] font-semibold tracking-[-0.03em] text-[#111111]"
                  />
                </div>

                {adds.length ? (
                  <ul className="mt-4 space-y-2 border-t border-[#EDEDF0] pt-4">
                    {adds.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.45] text-[#1D1D1F]">
                        <svg className="mt-[3px] shrink-0 text-[#306EEC]" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="m5 12.5 4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 border-t border-[#EDEDF0] pt-4 text-[15px] leading-[1.45] text-[#6E6E73]">
                    {plan.description}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.name)}
                  data-track="plans-cta"
                  disabled={disabled}
                  className={[
                    "mt-5 h-[46px] w-full rounded-[8px] text-[15px] font-semibold transition active:scale-[0.99]",
                    disabled
                      ? "cursor-not-allowed bg-[#D1D5DB] text-white"
                      : isPopular
                        ? "bg-[#306EEC] text-white hover:bg-[#2558C9]"
                        : "border border-[#D2D2D7] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7]",
                  ].join(" ")}
                >
                  {actionLoadingPlan === plan.name
                    ? "Working..."
                    : !isAuthenticated
                      ? `Start with ${plan.displayName}`
                      : action.kind === "subscribe"
                        ? `Start with ${plan.displayName}`
                        : action.label}
                </button>
              </article>
            );
          })}
        </div>

        <p className="mt-5 text-[13px] leading-5 text-[#86868B]">
          There&rsquo;s no monthly visit allowance. Basic keeps one visit on the calendar at a
          time; the other plans allow two. Larger renovations are quoted separately.
        </p>
      </div>
    );
  };

  return (
    <section id="plans" className={`w-full scroll-mt-[140px] bg-[#F5F5F7] px-4 sm:px-5 ${compact ? "py-8 sm:py-11" : "py-8 sm:py-13 lg:py-12"}`}>
      <div className="mx-auto max-w-[1280px]">
        <div className={`mx-auto max-w-[720px] text-center ${compact ? "mb-7 sm:mb-9" : "mb-8 sm:mb-9"}`}>
          {/*
           * sm:text-5xl was a Tailwind preset, so the compactness sweep never
           * saw it and this section heading ended up larger than the H1 of
           * every page it appears on. It is a section heading and now sizes
           * like one.
           */}
          {!hideIntro && (
            <>
              <h2 className="text-[23px] font-semibold tracking-normal text-[#111111] sm:text-[30px]">
                Choose the membership for your home
              </h2>
              <p className="mt-3 text-[15px] leading-6 text-[#6E6E73] sm:mt-4 sm:text-lg sm:leading-7">
                Start with the level of support that fits today. You can change plans as your home needs change.
              </p>
            </>
          )}
          {promoCode ? (
            <div className="mt-5 inline-flex rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-sm font-semibold text-[#166534]">
              Promo code {promoCode} will be applied at checkout
            </div>
          ) : null}
          {compact ? (
            <div className="mx-auto mt-5 max-w-[360px] rounded-[8px] border border-[#D9E4FA] bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(48,110,236,0.06)] lg:mt-6 lg:max-w-[480px] lg:rounded-[10px] lg:px-6 lg:py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#306EEC] lg:text-[12px]">Annual special</p>
              <p className="mt-1 text-[13px] leading-5 text-[#4B5563] lg:mt-1.5 lg:text-[15px] lg:leading-6">
                Pay for <strong className="font-semibold text-[#111111]">10 months</strong>. Get <strong className="font-semibold text-[#111111]">12 months of Membership.</strong>
              </p>
            </div>
          ) : null}
          <BillingToggle />
        </div>

        {/*
          Somebody who backed out of Stripe. Not an error, not a warning colour,
          no automatic retry - just an acknowledgement that they are back where
          they were, with the plan still there to press.
        */}
        {checkoutCanceled && (
          <div className="mx-auto mt-6 max-w-[560px] rounded-[8px] border border-[#D7E0F5] bg-[#F8FAFF] px-5 py-4 text-center">
            <p className="text-[14px] font-semibold text-[#0B1628]">
              You didn&rsquo;t finish checking out.
            </p>
            <p className="mt-1 text-[13.5px] leading-5 text-[#6E6E73]">
              Nothing was charged. Your plan is still selected below whenever you
              want to pick it up again.
            </p>
          </div>
        )}

        {isAuthenticated && user && addresses.length > 0 && <AddressPicker />}

        {isAuthenticated && user && addresses.length === 0 && (
          <div className="mx-auto mb-8 max-w-[520px] rounded-[8px] border border-[#E5E7EB] bg-white p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <p className="font-semibold text-[#111827]">Add an address to start a plan.</p>
            <button
              onClick={() => (window.location.href = roleLandingPath)}
              className="mt-4 h-11 rounded-[8px] bg-[#111111] px-6 text-sm font-semibold text-white transition hover:bg-black"
            >
              Add Address
            </button>
          </div>
        )}

        {(actionMessage || actionError) && (
          <div className="mx-auto mb-8 max-w-[720px] space-y-3">
            {actionMessage ? (
              <div className="rounded-[8px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
                {actionMessage}
              </div>
            ) : null}
            {actionError ? (
              <div className="rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#991B1B]">
                {actionError}
              </div>
            ) : null}
          </div>
        )}

        {/* ===================== THE FOUNDATION, ONCE ===================== */}
        {!compact && (
          <div className="plan-foundation">
            <p className="plan-foundation__label">Every membership</p>
            <ul className="plan-foundation__items">
              {["90-minute visits", "The same local team", "Book online", "No estimates for small jobs"].map((f) => (
                <li key={f}>
                  <PlanCheck />
                  {f}
                </li>
              ))}
            </ul>
            {/*
              The sentence the entire product hangs on. It used to sit below all
              four cards, so a customer read the plans under the assumption they
              were buying a monthly allowance and was corrected afterwards.
            */}
            <p className="plan-foundation__rule">
              <b>Book as often as you need.</b> Your plan sets how many visits you can have
              booked at the same time.
            </p>
          </div>
        )}

        {/* ========================== THE LADDER ========================== */}
        {compact ? <CompactPlanComparison /> : (
          <>
            <div className="plan-ladder">
              {plans.map((plan) => {
                const action = getActionForPlan(plan.name);
                const isPopular = plan.name === "Plus";
                const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
                const rung = planLadder[plan.name];
                /*
                 * "Choose Plus", not "Start Membership".
                 *
                 * A signed-in non-member saw the same four words on all four
                 * buttons, so the control stopped saying which plan it bought.
                 * kind === "subscribe" is exactly the fresh-signup case; every
                 * member state - upgrade, downgrade, manage, cancellation
                 * scheduled - keeps the label its own logic chose.
                 */
                const label =
                  actionLoadingPlan === plan.name
                    ? "Working..."
                    : !isAuthenticated || action.kind === "subscribe"
                      ? `Choose ${plan.displayName}`
                      : action.label;

                return (
                  <article
                    key={plan.name}
                    className={`plan-rung${isPopular ? " plan-rung--popular" : ""}`}
                  >
                    {isPopular ? <span className="plan-rung__badge">Popular</span> : null}

                    <div className="plan-rung__head">
                      <h3 className="plan-rung__name">{plan.displayName}</h3>
                      <PlanPriceBlock
                        plan={plan}
                        billing={billing}
                        amountClassName="plan-rung__price"
                      />
                    </div>

                    {rung.inherits ? <p className="plan-rung__inherits">{rung.inherits}</p> : null}

                    <ul className="plan-rung__adds">
                      {rung.adds.map((a) => (
                        <li key={a}>
                          {rung.inherits ? (
                            <span className="plan-rung__plus" aria-hidden="true">
                              +
                            </span>
                          ) : (
                            <PlanCheck />
                          )}
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSubscribe(plan.name)}
                      data-track="plans-cta"
                      disabled={disabled}
                      className="plan-rung__cta"
                    >
                      {label}
                    </button>
                  </article>
                );
              })}
            </div>

            <p className="plan-note">
              Priority Visit &mdash; service before the next standard appointment slot, subject
              to Fixter availability.
            </p>
          </>
        )}

        {/* ==================== AFTER THE DECISION ==================== */}
        {/*
          Loyalty moved below the plans, and shortened.

          It used to sit between the billing toggle and the cards - a reason to
          STAY, printed into the middle of the moment somebody is deciding what
          to BUY. Same fact either way; it reads better as the thing you find
          once the choice is made.

          The free visit sits here for the same reason and in the same register:
          a way out for somebody not ready, placed UNDER the decision rather
          than beside it, so it never competes with choosing a plan. Nothing
          about eligibility is touched - this is a link to /book.
        */}
        {!compact && (
          <div className="plan-after">
            <div className="plan-after__card">
              <p className="plan-after__label">Loyalty Benefits</p>
              {billing === "annual" ? (
                <p className="plan-after__body">
                  <b>Already built in.</b> Annual members pay for 10 months and get 12.
                </p>
              ) : (
                <p className="plan-after__body">
                  <b>Stay, and it gets better.</b> At 3 and 6 months, the plan above yours,
                  free. At 12 months, a month on us.
                </p>
              )}
              <Link href="/membership/loyalty" className="plan-after__link">
                How it works
              </Link>
            </div>

            <div className="plan-after__card">
              <p className="plan-after__label">Not ready to choose?</p>
              <p className="plan-after__body">
                <b>Your first 90-minute visit is free.</b> No card required.
              </p>
              <Link href="/book" className="plan-after__link">
                Book a free visit
              </Link>
            </div>
          </div>
        )}

        <div className={`mx-auto max-w-[720px] ${compact ? "mt-6" : "mt-7"}`}>

          {/*
            The reassurance a person wants in the second before they enter a
            card, and nothing more. Home carries the full trust band; this is
            four facts and a link.
          */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[#E5E5EA] pt-5 text-[13px] text-[#6E6E73]">
            <span>Licensed <span className="font-medium text-[#111111]">NY HIC HI-71484</span></span>
            <span aria-hidden="true" className="text-[#D2D2D7]">&middot;</span>
            <span>Insured for in-home work</span>
            <span aria-hidden="true" className="text-[#D2D2D7]">&middot;</span>
            <span>Nassau &amp; Suffolk</span>
            <span aria-hidden="true" className="text-[#D2D2D7]">&middot;</span>
            <span>Secure payment by Stripe</span>
          </div>

          <p className="mt-4 text-center text-[13.5px] text-[#6E6E73]">
            Not sure it covers your list?{" "}
            <Link href="/recent-work" className="font-semibold text-[#306EEC] underline-offset-4 hover:underline">
              See what we do
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
