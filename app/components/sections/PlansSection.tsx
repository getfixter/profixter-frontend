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

type PlanName = Plan["name"];

/**
 * The seven rows, in one fixed order, for all four plans.
 *
 * WHY A MATRIX AND NOT A LADDER.
 *
 * The ladder showed only what each tier ADDED, which explained the structure
 * and destroyed the value: Premium is a hundred dollars more than Plus and
 * added exactly one line, so the more you paid the emptier the card looked.
 * "Everything in Plus" was an IOU that asked the reader to scroll up and
 * reassemble the total in their head, and nobody does that.
 *
 * So every plan now shows the SAME rows in the SAME positions, and only the
 * marks change. Switching from Plus to Premium leaves row 5 where it is and
 * turns it on, which is a thing you can watch happen. Rows switched on run
 * 3 / 4 / 5 / 7, so the box visibly fills as the price rises and Elite is the
 * only state with nothing greyed out.
 *
 * ACCURACY. Every row here is checked against what the system actually does:
 *
 *   pace      routes/bookings.js: `plan === "basic" ? 1 : plan ? 2 : 0`.
 *             Elite is 2, not 3. Never described as a monthly quantity - it is
 *             a pace, and "allowance"/"limit" wording is settled elsewhere.
 *   fullDay   utils/fullDayEntitlements.js grants one per MEMBERSHIP MONTH,
 *             annual members included. It said "per billing period", which
 *             gave an annual member one for the whole year; the entitlement
 *             now slices the year into months, so "/ month" is true on both
 *             cycles and needs no per-cycle wording here.
 *   priority  Has no backend entitlement or counter anywhere - it is delivered
 *             by scheduling. The copy is the whole definition of the benefit,
 *             which is exactly why it keeps "subject to availability".
 *   supplies  Plus and above include small materials; fixtures, appliances and
 *             project materials are quoted separately.
 */
type BenefitRow = {
  id: string;
  /** How the row reads for a plan that does NOT include it. */
  off: string;
  /**
   * How it reads for a plan that DOES. A string means every plan includes it;
   * a partial record means only the plans named include it, and the wording is
   * allowed to differ where the number itself differs.
   */
  on: string | Partial<Record<PlanName, string>>;
  /** A single short line, shown only when the row is on. Never an explanation. */
  detail?: string;
};

const BENEFIT_ROWS: BenefitRow[] = [
  {
    id: "visits",
    off: "90-minute visits, any home task",
    on: "90-minute visits, any home task",
  },
  {
    id: "team",
    off: "The same local team every time",
    on: "The same local team every time",
  },
  {
    id: "pace",
    off: "Book visits as you need them",
    on: {
      Basic: "Book 1 visit at a time",
      Plus: "Book up to 2 visits at a time",
      Premium: "Book up to 2 visits at a time",
      Elite: "Book up to 2 visits at a time",
    },
    detail: "As often as you need.",
  },
  {
    id: "supplies",
    off: "Small supplies included",
    on: {
      Plus: "Small supplies included",
      Premium: "Small supplies included",
      Elite: "Small supplies included",
    },
    detail: "Screws, anchors, caulk and sealant.",
  },
  {
    id: "priority",
    off: "Priority Visits",
    on: {
      Premium: "1 Priority Visit / month",
      Elite: "2 Priority Visits / month",
    },
    detail: "When it can't wait. Subject to availability.",
  },
  {
    id: "fullDay",
    off: "A Full Day of work",
    on: { Elite: "1 Full Day / month" },
    detail: "Up to 8 hours for a bigger job.",
  },
  {
    id: "projects",
    off: "10% off larger projects",
    on: { Elite: "10% off larger projects" },
  },
];

function benefitIncluded(row: BenefitRow, plan: PlanName): boolean {
  return typeof row.on === "string" ? true : Boolean(row.on[plan]);
}

function benefitLabel(row: BenefitRow, plan: PlanName): string {
  if (typeof row.on === "string") return row.on;
  return row.on[plan] || row.off;
}

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
  /*
   * Which plan the one box is showing.
   *
   * Plus, because it is the recommended plan and because opening on a middle
   * tier shows checks AND dashes at once, which is what makes the mechanic
   * obvious without a word of instruction. Restored from ?plan= below, so
   * somebody who picked Elite, signed up and came back does not land on Plus -
   * with four cards there was no selection to lose, and with one box there is.
   */
  const [selectedPlanName, setSelectedPlanName] = useState<PlanName>("Plus");
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

    const requestedPlan = String(
      params.get("plan") || pending?.plan || pending?.planName || ""
    ).toLowerCase();
    const restored = plans.find((plan) => plan.name.toLowerCase() === requestedPlan);
    if (restored) setSelectedPlanName(restored.name);

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
  /**
   * One box. Four tabs. The same seven rows, switching on and off.
   *
   * WHAT REPLACED WHAT. Four parallel cards, then a four-rung ladder, now one
   * selector. Cards and rungs both put four prices and four buttons on screen
   * at once, which is four decisions; this is one decision with four positions,
   * which is how a phone presents a subscription and why it reads instantly.
   *
   * TWO THINGS HOLD THE LAYOUT STILL, both deliberate:
   *
   *  - All four benefit panels are stacked in ONE grid cell, so the cell is
   *    always as tall as Elite and nothing below it moves when the plan
   *    changes. No magic min-height to keep in sync with the copy.
   *  - The savings line above the price is always in the DOM and empty on
   *    monthly, so the Monthly/Annual toggle does not shift the price either.
   *
   * That matters beyond tidiness: the CTA sits directly under the thumb, and a
   * control that moves between a finger going down and coming up is how a tap
   * gets swallowed. Nothing here moves.
   *
   * BUSINESS LOGIC IS UNTOUCHED. getActionForPlan still decides what the button
   * does and says for members, handleSubscribe still runs checkout, and the
   * prices still come from getPlanPricing. This is presentation.
   *
   * CALLED, NOT MOUNTED. This is invoked as renderPlanSelector() rather than
   * rendered as <PlanSelector />. Declared inside the parent, it is a NEW
   * component type on every parent render, so React would unmount and rebuild
   * the whole subtree each time - which throws keyboard focus back to <body>
   * and makes Home/End on the tab strip scroll the page instead of moving
   * between plans. Calling it puts the elements in the parent tree, where they
   * reconcile in place and keep their focus.
   */
  const renderPlanSelector = () => {
    const selectedPlan = plans.find((p) => p.name === selectedPlanName) || plans[0];
    const pricing = getPlanPricing(selectedPlan, billing);
    const action = getActionForPlan(selectedPlan.name);
    const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
    const activeIndex = plans.findIndex((p) => p.name === selectedPlan.name);

    /*
     * "Choose Plus", not "Start Membership". kind === "subscribe" is exactly
     * the fresh-signup case; every member state - upgrade, downgrade, manage,
     * cancellation scheduled - keeps the label its own logic chose.
     */
    const label =
      actionLoadingPlan === selectedPlan.name
        ? "Working..."
        : !isAuthenticated || action.kind === "subscribe"
          ? `Choose ${selectedPlan.displayName}`
          : action.label;

    // Roving focus, so the tab strip behaves like a tab strip on a keyboard.
    const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
      let next = -1;
      if (event.key in moves) {
        next = (activeIndex + moves[event.key] + plans.length) % plans.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = plans.length - 1;
      }
      if (next < 0) return;
      event.preventDefault();
      setSelectedPlanName(plans[next].name);
      document.getElementById(`plan-tab-${plans[next].name}`)?.focus();
    };

    return (
      <div className="plan-box">
        {/* ---------- billing cycle, above the price it frames ---------- */}
        <div className="plan-box__billing" role="group" aria-label="Billing cycle">
          {(["monthly", "annual"] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              aria-pressed={billing === cycle}
              onClick={() => setBilling(cycle)}
              className={`plan-box__cycle${billing === cycle ? " is-active" : ""}`}
            >
              {cycle === "monthly" ? "Monthly" : "Annual"}
              {cycle === "annual" ? (
                <span className="plan-box__chip">2 months free</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ---------------------------- tabs ---------------------------- */}
        <div className="plan-box__tabs" role="tablist" aria-label="Membership plans">
          <span
            className="plan-box__pill"
            aria-hidden="true"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {plans.map((plan) => {
            const isActive = plan.name === selectedPlan.name;
            return (
              <button
                key={plan.name}
                id={`plan-tab-${plan.name}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`plan-panel-${plan.name}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setSelectedPlanName(plan.name)}
                onKeyDown={onTabKeyDown}
                className={`plan-box__tab${isActive ? " is-active" : ""}`}
              >
                {plan.displayName}
                {/*
                  Popular, quietly. A dot marks Plus from the strip; the word
                  itself only appears once Plus is open, so the recommendation
                  never shouts over the other three.
                */}
                {plan.name === "Plus" && !isActive ? (
                  <span className="plan-box__dot" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* ---------------------------- price --------------------------- */}
        <div className="plan-box__price">
          <div className="plan-box__pricetop">
            {selectedPlan.name === "Plus" ? (
              <span className="plan-box__popular">Most popular</span>
            ) : null}
          </div>

          <div className="plan-box__amount" key={`${selectedPlan.name}-${billing}`}>
            <span className="plan-box__figure">${formatMoney(pricing.amount)}</span>
            <span className="plan-box__unit">
              {billing === "annual" ? "/ year" : "/ month"}
            </span>
          </div>

          <p className="plan-box__terms">
            {billing === "annual" ? (
              <>
                Pay for 10 months, get 12.
                <span className="plan-box__terms-sub">
                  About ${formatMoney(Math.round(pricing.amount / MONTHS_PER_YEAR))} a month.
                </span>
              </>
            ) : (
              <>
                Billed monthly.
                <span className="plan-box__terms-sub">Cancel anytime.</span>
              </>
            )}
          </p>
        </div>

        {/* ------------- the seven rows, all four plans stacked ---------- */}
        <div className="plan-box__stack">
          {plans.map((plan) => {
            const isActive = plan.name === selectedPlan.name;
            return (
              <ul
                key={plan.name}
                id={`plan-panel-${plan.name}`}
                role="tabpanel"
                aria-labelledby={`plan-tab-${plan.name}`}
                className={`plan-box__benefits${isActive ? " is-active" : ""}`}
              >
                {BENEFIT_ROWS.map((row, index) => {
                  const included = benefitIncluded(row, plan.name);
                  return (
                    <li
                      key={row.id}
                      className={`plan-box__row${included ? " is-on" : " is-off"}`}
                      /* A short stagger, so switching plans reads as rows
                         lighting up rather than the whole list blinking. The
                         row and its checkmark both read this one delay. */
                      style={
                        {
                          "--plan-row-delay": isActive ? `${index * 22}ms` : "0ms",
                        } as React.CSSProperties
                      }
                    >
                      <span className="plan-box__mark" aria-hidden="true">
                        {included ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M5 12.5l4 4 10-10"
                              stroke="currentColor"
                              strokeWidth="2.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          /* An em dash. Never a cross, never red: this is
                             "not in this plan", not "you have been refused". */
                          <span className="plan-box__dash">&mdash;</span>
                        )}
                      </span>
                      <span className="plan-box__text">
                        <span className="plan-box__name">{benefitLabel(row, plan.name)}</span>
                        {included && row.detail ? (
                          <span className="plan-box__detail">{row.detail}</span>
                        ) : null}
                      </span>
                      <span className="sr-only">{included ? " included" : " not included"}</span>
                    </li>
                  );
                })}
              </ul>
            );
          })}
        </div>

        {/* ----------------------------- CTA ---------------------------- */}
        <button
          type="button"
          onClick={() => handleSubscribe(selectedPlan.name)}
          data-track="plans-cta"
          disabled={disabled}
          className="plan-box__cta"
        >
          {label}
        </button>

        <p className="plan-box__foot">
          There&rsquo;s no monthly visit allowance. Book as often as you need &mdash; your plan
          sets how many visits you can have booked at the same time.
        </p>
      </div>
    );
  };

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
          {compact ? <BillingToggle /> : null}
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

        {/* ========================= THE SELECTOR ========================= */}
        {compact ? <CompactPlanComparison /> : renderPlanSelector()}

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
