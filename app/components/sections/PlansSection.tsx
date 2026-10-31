"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { plans, type Plan } from "@/app/data/content";
import { BENEFIT_ROWS, benefitIncluded, benefitLabel } from "@/app/data/plan-benefits";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import type { PlanType } from "@/lib/stripe-links";
import type { Address } from "@/lib/auth-service";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";
import WelcomeOfferBanner from "@/app/components/membership/WelcomeOfferBanner";
import { WELCOME_OFFER_ERROR_CODES, formatCents, useWelcomeOffer, type WelcomeOffer, type WelcomePlanPrice } from "@/lib/welcome-offer";
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

/** "Premium · Annual · $3,490/year" - the same numbers the plan card shows. */
function planSummary(planName: string, billing: BillingCycle): string {
  const plan = plans.find((p) => p.name === planName);
  if (!plan) return planName;
  const { amount, suffix } = getPlanPricing(plan, billing);
  return `${planName} · ${billing === "annual" ? "Annual" : "Monthly"} · $${amount.toLocaleString("en-US")}${suffix === "/mo" ? "/month" : "/year"}`;
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
  welcome = null,
}: {
  plan: Plan;
  billing: BillingCycle;
  amountClassName: string;
  /** The new-customer first-month price, monthly only (lib/welcome-offer). */
  welcome?: WelcomePlanPrice | null;
}) {
  const pricing = getPlanPricing(plan, billing);

  if (welcome) {
    return (
      <>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="wo-was text-[14px]">{formatCents(welcome.monthlyCents)}</span>
          <span className="whitespace-nowrap rounded-[6px] bg-[#EEF4FF] px-2 py-[3px] text-[11px] font-semibold text-[#1F5ED8]">Welcome offer</span>
        </div>
        <div className="flex flex-wrap items-end gap-x-1">
          <span className={amountClassName}>{formatCents(welcome.firstMonthCents)}</span>
          <span className="pb-1 text-sm font-medium text-[#6E6E73]">first month</span>
        </div>
        <p className="mt-1 text-[13px] text-[#6E6E73]">Then {formatCents(welcome.monthlyCents)}/month, plus applicable taxes.</p>
      </>
    );
  }

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
  /** The short four-row list for the Book tab: choose, confirm, checkout. */
  picker?: boolean;
  /**
   * No section chrome (background, padding, page container): the page places
   * the selector itself, as /membership/plans does in its two-column layout.
   */
  bare?: boolean;
};

export default function PlansSection({ hideCancellationUi = false, compact = false, hideIntro = false, picker = false, bare = false }: PlansSectionProps = {}) {
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
  /* Back from signup with a plan already chosen: confirm it in one step. */
  const [resumeRequested, setResumeRequested] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  /* The funnel step between "See plans" and "plan_selected". Once per mount. */
  useEffect(() => {
    trackEvent("plans_viewed", { layout: picker ? "book_picker" : compact ? "compact" : "full" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { user, isAuthenticated, isLoading, token } = useAuth();
  const { requestHome, homeSheet } = useAddHome();
  const { ensureContact, contactSheet } = useContactCompletion();

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

  /*
   * The new-customer welcome offer (Customer Experience 4.2). The server says
   * who is eligible and until when; it only ever touches a MONTHLY first
   * invoice, so annual prices never change here.
   */
  const offer = useWelcomeOffer(isAuthenticated, selectedAddressId ? { addressId: selectedAddressId } : null);
  const welcomeFor = (planName: string, cycle: BillingCycle = billing): WelcomePlanPrice | null => {
    if (cycle !== "monthly" || !offer.active) return null;
    const type = normalizePlanType(planName);
    return (type && offer.plans[type]) || null;
  };

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
    if (params.get("resume") === "1" && pendingRaw) setResumeRequested(true);

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

  /*
   * Off to create an account, with the plan kept.
   *
   * `next` is what /signup actually reads - this used to send `redirect`,
   * which signup ignored, so new customers landed on /membership with their
   * choice gone and had to find it again. resume=1 asks this page to put a
   * one-line confirmation in front of them on return instead of the grid.
   */
  const sendToSignupWithPlan = (
    plan: PlanType,
    cycle: BillingCycle,
    planName: string,
    addressId?: string
  ) => {
    sessionStorage.setItem(
      "pendingCheckoutPlan",
      JSON.stringify({ plan, billingCycle: cycle, planName, addressId, summary: planSummary(planName, cycle) })
    );
    /* Back to wherever the plan was chosen: the Book tab, or the comparison page. */
    const query = `plan=${encodeURIComponent(plan)}&billingCycle=${encodeURIComponent(cycle)}&resume=1`;
    const back =
      window.location.pathname === "/book" ? `/book?visit=membership&${query}` : `/membership/plans?${query}`;
    window.location.href = `/signup?next=${encodeURIComponent(back)}`;
  };

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

    if (!authToken) {
      console.error("[checkout] Missing auth token before checkout request", {
        tokenExists: false,
        authHeaderAttached: false,
        endpointUrl,
        plan,
        addressId,
        billingCycle: cycle,
      });
      sendToSignupWithPlan(plan, cycle, planName, addressId);
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
          // The price they were shown. The server re-checks and refuses rather than charge another.
          welcomeOffer: Boolean(welcomeFor(planName, cycle)),
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

      if (status === 409 && data?.code === "MEMBERSHIP_PAYMENT_RECOVERY_REQUIRED") {
        // A failed renewal is fixed by paying it, never by a second membership.
        window.location.href = "/account?tab=plan";
        return;
      }

      if (status === 409 && WELCOME_OFFER_ERROR_CODES.includes(String(data?.code || ""))) {
        // Nothing was opened: re-price to the regular price and let them decide again.
        offer.refresh();
        setActionError(String((data as { message?: string })?.message || "The welcome offer has ended. Prices shown are the regular prices."));
        return;
      }

      if (status === 409 && data?.code === "CHECKOUT_ALREADY_OPENING") {
        setActionError("Your secure checkout is already opening. Please wait a moment.");
        return;
      }

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
        sendToSignupWithPlan(plan, cycle, planName, addressId);
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

  /*
   * Only a fresh subscription gets the sheet. A member who somehow arrives
   * with a stale pending plan sees the normal page, so nobody already paying
   * is walked into a new-customer checkout. Waits for the address's
   * subscription lookup, which is what decides that.
   */
  useEffect(() => {
    if (!resumeRequested || !isAuthenticated || !user || !selectedAddressId) return;
    if (addressSubscriptionMap[selectedAddressId] === undefined) return;
    setResumeRequested(false);
    if (getActionForPlan(selectedPlanName).kind === "subscribe") setResumeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeRequested, isAuthenticated, user, selectedAddressId, addressSubscriptionMap, selectedPlanName]);

  /*
   * Back from signup with a plan but no home yet: ask for the home straight
   * away instead of leaving an "Add your home" box to find and tap. This only
   * opens the same AddHomeSheet the button opens; once the home is saved, the
   * effect above shows the usual one-step confirmation before any checkout.
   */
  const resumeHomeAsked = useRef(false);
  useEffect(() => {
    if (!resumeRequested || isLoading || !isAuthenticated || !user || addresses.length > 0) return;
    if (resumeHomeAsked.current) return;
    resumeHomeAsked.current = true;
    void (async () => {
      const home = await requestHome();
      if (!home?.address?._id) {
        setResumeRequested(false);
        return;
      }
      setSelectedAddressId(String(home.address._id));
      // Outside the service area: the sheet has already said so.
      if (home.serviceArea && home.serviceArea.inArea === false) setResumeRequested(false);
    })();
  }, [resumeRequested, isLoading, isAuthenticated, user, addresses.length, requestHome]);

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
      trackEvent("plan_selected", { plan: planType, billing_cycle: billing, signed_in: false });
      sendToSignupWithPlan(planType, billing, planName);
      return;
    }

    if (!addresses.length) {
      /*
       * No home yet: add it here and carry on to checkout with it. A home that
       * was only just saved cannot have a plan, so this is always a fresh
       * subscription.
       */
      const home = await requestHome();
      if (!home?.address?._id) return;
      const newAddressId = String(home.address._id);
      setSelectedAddressId(newAddressId);
      // Outside the service area: the sheet has already said so.
      if (home.serviceArea && home.serviceArea.inArea === false) return;
      if (!(await ensureContact())) return;
      await startCheckout(planType, newAddressId, home.user?.email || user.email, billing, planName);
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
      if (!(await ensureContact())) return;
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
    <div className="mx-auto mb-4 max-w-[560px]">
      <div className="flex items-end gap-3 rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="plans-address" className="ui-eyebrow mb-1.5 block">
            Service address
          </label>
          <select
            id="plans-address"
            value={selectedAddressId || ""}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedAddressId(id);
              if (token && addressSubscriptionMap[id] === undefined) {
                checkAddressState(id);
              }
            }}
            className="h-11 w-full min-w-0 rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line-2)] bg-white px-3 text-[15px] text-[color:var(--ui-ink)] outline-none focus:border-[color:var(--ui-accent)]"
          >
            {addresses.map((a) => (
              <option key={a._id} value={a._id}>
                {(a.label ? `${a.label}: ` : "") + `${a.line1}, ${a.city}`}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0 pb-3 text-[13px] font-medium text-[color:var(--ui-text-3)]">
          {checkingAddr ? "Checking..." : addressIsActive ? "Active plan" : "No active plan"}
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
    const welcome = welcomeFor(selectedPlan.name);
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
        <WelcomeOfferBanner offer={offer} className="plan-box__offer" />
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
        {/*
          Customer Experience 4.2. The line above the figure is fixed-height and
          says what the figure is measured against: the regular 12-month total
          struck through on annual, the regular monthly price struck through
          under the welcome offer, "Most popular" otherwise. The figure is what
          is charged; its unit says how often.
        */}
        <div className="plan-box__price" data-billing={billing}>
          <div className="plan-box__pricetop">
            {billing === "annual" && pricing.regular !== null ? (
              <span className="plan-box__regular" data-annual-regular>
                <s>${formatMoney(pricing.regular)}</s> regular 12-month total
              </span>
            ) : welcome ? (
              <span className="plan-box__regular" data-welcome-regular>
                <s>{formatCents(welcome.monthlyCents)}</s> regular monthly price
              </span>
            ) : selectedPlan.name === "Plus" ? (
              <span className="plan-box__popular">Most popular</span>
            ) : null}
          </div>

          <div className="plan-box__amount" key={`${selectedPlan.name}-${billing}-${welcome ? "w" : "r"}`}>
            <span className="plan-box__figure">{welcome ? formatCents(welcome.firstMonthCents) : `$${formatMoney(pricing.amount)}`}</span>
            <span className="plan-box__unit">
              {billing === "annual" ? "/ year" : welcome ? "first month" : "/ month"}
            </span>
          </div>

          <p className="plan-box__terms">
            {billing === "annual" ? (
              <>
                <b>Pay for 10 months, get 12.</b>
                <span className="plan-box__terms-sub">Billed once a year, plus applicable taxes.</span>
              </>
            ) : welcome ? (
              <>
                <b>{offer.percentOff}% off your first month.</b>
                <span className="plan-box__terms-sub">Then {formatCents(welcome.monthlyCents)}/month afterward, plus applicable taxes.</span>
              </>
            ) : (
              <>
                Billed monthly.
                <span className="plan-box__terms-sub">Cancel anytime.</span>
              </>
            )}
          </p>
        </div>

        {/* ----------------------------- CTA ---------------------------- */}
        {/* Under the price, so price and decision share the first screen on a phone. */}
        <button
          type="button"
          onClick={() => handleSubscribe(selectedPlan.name)}
          data-track="plans-cta"
          disabled={disabled}
          className="plan-box__cta"
        >
          {label}
        </button>
        {billing === "annual" && offer.active ? (
          <p className="plan-box__offer-note">The welcome offer applies to monthly plans only.</p>
        ) : null}

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
                    welcome={welcomeFor(plan.name)}
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

  const resumeSheet =
    resumeOpen && selectedAddress ? (
      <PlanResumeSheet
        planName={selectedPlanName}
        billing={billing}
        welcome={welcomeFor(selectedPlanName)}
        offer={offer}
        address={[selectedAddress.line1, selectedAddress.city].filter(Boolean).join(", ")}
        busy={actionLoadingPlan === selectedPlanName}
        error={actionError}
        onContinue={() => {
          trackEvent("plan_selected", { plan: normalizePlanType(selectedPlanName) || "", billing_cycle: billing, signed_in: true, resumed: true });
          sessionStorage.removeItem("pendingCheckoutPlan");
          void handleSubscribe(selectedPlanName);
        }}
        onClose={() => {
          sessionStorage.removeItem("pendingCheckoutPlan");
          setResumeOpen(false);
        }}
      />
    ) : null;

  /*
   * The picker: the four plans as one short list, for the Book tab.
   *
   * Somebody on Book has already decided they want a Fixter; this is where
   * they choose which plan, not where they are sold the idea. One line per
   * plan - what it adds over the plan below it, read straight from
   * BENEFIT_ROWS - the full list one tap away, and one button. Everything
   * behind the button is the same as the comparison page: the same address
   * check, the same confirmation, the same checkout.
   */
  if (picker) {
    const chosen = plans.find((p) => p.name === selectedPlanName) || plans[1];
    const chosenPricing = getPlanPricing(chosen, billing);
    const chosenAction = isAuthenticated ? getActionForPlan(chosen.name) : null;
    const busy = actionLoadingPlan === chosen.name;
    const chosenWelcome = welcomeFor(chosen.name);
    const priceLabel = (p: Plan) => {
      const w = welcomeFor(p.name);
      if (w) {
        return (
          <>
            <s className="wo-was mr-1 text-[13px]">{formatCents(w.monthlyCents)}</s>
            {formatCents(w.firstMonthCents)}
            <span className="block text-[11px] font-medium text-[color:var(--ui-text-3)]">first month</span>
          </>
        );
      }
      const pr = getPlanPricing(p, billing);
      return `$${pr.amount.toLocaleString("en-US")}${pr.suffix === "/mo" ? "/mo" : "/yr"}`;
    };
    const onContinue = () => {
      if (!isAuthenticated) {
        void handleSubscribe(chosen.name);
        return;
      }
      trackEvent("plan_selected", { plan: normalizePlanType(chosen.name) || "", billing_cycle: billing, signed_in: true });
      // The confirmation sheet needs a home to show; without one, handleSubscribe adds it first.
      if (chosenAction?.kind === "subscribe" && selectedAddress) setResumeOpen(true);
      else void handleSubscribe(chosen.name);
    };

    return (
      <section id="plans" className="scroll-mt-28" data-plan-picker>
        {resumeSheet}
        {homeSheet}
        {contactSheet}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="ui-h3">Choose your membership</h2>
          <div className="inline-flex rounded-[var(--ui-r-sm)] bg-[color:var(--ui-bg-soft)] p-1 shadow-[inset_0_0_0_1px_var(--ui-line)]" role="group" aria-label="Billing">
            {(["monthly", "annual"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                aria-pressed={billing === cycle}
                onClick={() => setBilling(cycle)}
                className={`h-10 rounded-[7px] px-3.5 text-[14px] font-semibold transition ${
                  billing === cycle ? "bg-white text-[color:var(--ui-ink)] shadow-[0_0_0_1px_var(--ui-line)]" : "text-[color:var(--ui-text-2)]"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : (
                  <>Annual <span className="ml-1 text-[12px] font-semibold text-[color:var(--ui-accent-ink)]">2 mo free</span></>
                )}
              </button>
            ))}
          </div>
        </div>

        <WelcomeOfferBanner offer={offer} className="mt-3" />

        {checkoutCanceled ? (
          <p className="mt-3 rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-soft)] px-4 py-2.5 text-[14px] text-[color:var(--ui-text-2)]">
            You didn&rsquo;t finish checking out. Nothing was charged.
          </p>
        ) : null}

        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Membership plans">
          {plans.map((p, index) => {
            const isChosen = p.name === chosen.name;
            const prev = index > 0 ? (plans[index - 1].name as PlanName) : null;
            const adds = BENEFIT_ROWS.filter(
              (row) =>
                typeof row.on !== "string" &&
                benefitIncluded(row, p.name as PlanName) &&
                (!prev || !benefitIncluded(row, prev) || benefitLabel(row, prev) !== benefitLabel(row, p.name as PlanName))
            ).map((row) => benefitLabel(row, p.name as PlanName));
            const line = (prev ? "+ " : "") + adds.join(" · ");
            return (
              <div key={p.name} className={`pk-row ${isChosen ? "pk-row--on" : ""}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isChosen}
                  onClick={() => setSelectedPlanName(p.name as PlanName)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                  data-plan-option={p.name}
                >
                  <span className={`pk-dot ${isChosen ? "pk-dot--on" : ""}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[16px] font-semibold text-[color:var(--ui-ink)]">{p.displayName}</span>
                      {p.badge === "StartHere" ? (
                        <span className="ui-tag ui-tag--accent !min-h-[20px] !px-2 !text-[11px]">Popular</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-[color:var(--ui-text-3)]">{line}</span>
                  </span>
                  <span className="ui-num shrink-0 text-right text-[16px] font-semibold text-[color:var(--ui-ink)]">{priceLabel(p)}</span>
                </button>
                {isChosen ? (
                  <details className="pk-details px-4 pb-3 pl-11">
                    <summary className="cursor-pointer text-[13px] font-semibold text-[color:var(--ui-accent-ink)]">What&rsquo;s included</summary>
                    <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-[color:var(--ui-text-2)]">
                      {BENEFIT_ROWS.filter((row) => benefitIncluded(row, p.name as PlanName)).map((row) => (
                        <li key={row.id} className="flex gap-2">
                          <span className="text-[color:var(--ui-accent)]" aria-hidden="true">✓</span>
                          <span>
                            {benefitLabel(row, p.name as PlanName)}
                            {row.detail ? <span className="text-[color:var(--ui-text-3)]"> - {row.detail}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[13px] leading-5 text-[color:var(--ui-text-3)]">
                      There&rsquo;s no monthly visit allowance. Book as often as you need - your plan simply determines how many visits you can have booked at the same time.{" "}
                      <Link href="/membership/plans" className="font-semibold text-[color:var(--ui-accent-ink)]">Full comparison</Link>
                      {" · "}
                      <Link href="/terms" className="font-semibold text-[color:var(--ui-accent-ink)]">Terms</Link>
                    </p>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>

        {isAuthenticated && addresses.length > 1 ? (
          <label className="mt-3 flex items-center gap-3 text-[13px] font-semibold text-[color:var(--ui-text-2)]">
            For
            <select
              value={selectedAddressId || ""}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedAddressId(id);
                if (token && addressSubscriptionMap[id] === undefined) checkAddressState(id);
              }}
              className="h-11 min-w-0 flex-1 rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line-2)] bg-white px-3 text-[15px] text-[color:var(--ui-ink)]"
            >
              {addresses.map((a) => (
                <option key={a._id} value={a._id}>{`${a.line1}, ${a.city}`}</option>
              ))}
            </select>
          </label>
        ) : null}

        {actionError && !resumeOpen ? <p className="fv-error" role="alert">{actionError}</p> : null}
        {actionMessage ? <p className="mt-2 text-[14px] text-[color:var(--ui-text-2)]">{actionMessage}</p> : null}

        <button
          type="button"
          className="fv-cta mt-4 w-full"
          onClick={onContinue}
          disabled={busy || chosenAction?.disabled}
          data-plan-picker-continue
        >
          {busy ? (
            <><span className="fv-spinner" aria-hidden="true" /> One moment…</>
          ) : (
            chosenWelcome ? (
              <>Choose {chosen.displayName} · {formatCents(chosenWelcome.firstMonthCents)} first month</>
            ) : (
              <>Choose {chosen.displayName} · ${chosenPricing.amount.toLocaleString("en-US")}{chosenPricing.suffix === "/mo" ? "/mo" : "/yr"}</>
            )
          )}
        </button>
        <p className="mt-2 text-center text-[13px] text-[color:var(--ui-text-3)]">
          {billing === "annual"
            ? "Billed once for the year · 12 months for the price of 10"
            : chosenWelcome
              ? `Then ${formatCents(chosenWelcome.monthlyCents)}/month afterward · cancel anytime`
              : "Billed monthly · cancel anytime"}{" "}
          · tax at checkout
        </p>
      </section>
    );
  }

  const body = (
    <>
      {resumeSheet}
      {homeSheet}
      {contactSheet}
      {!hideIntro || promoCode || compact ? (
        <div className={`mx-auto max-w-[720px] text-center ${compact ? "mb-6 sm:mb-8" : "mb-6 sm:mb-8"}`}>
          {!hideIntro && (
            <>
              <h2 className="ui-h2">Choose the membership for your home</h2>
              <p className="ui-lede mx-auto">Change plans whenever your home does.</p>
            </>
          )}
          {promoCode ? (
            <p className="ui-tag ui-tag--accent mt-4">Promo code {promoCode} will be applied at checkout</p>
          ) : null}
          {compact ? (
            <p className="mx-auto mt-4 max-w-[420px] text-[14px] leading-[1.5] text-[color:var(--ui-text-2)]">
              <span className="ui-eyebrow ui-eyebrow--accent mb-1 block">Annual special</span>
              Pay for <strong className="font-semibold text-[color:var(--ui-ink)]">10 months</strong>. Get{" "}
              <strong className="font-semibold text-[color:var(--ui-ink)]">12 months of Membership.</strong>
            </p>
          ) : null}
          {compact ? <BillingToggle /> : null}
        </div>
      ) : null}

      {/*
        Somebody who backed out of Stripe. Not an error, not a warning colour,
        no automatic retry - just an acknowledgement that they are back where
        they were, with the plan still there to press.
      */}
      {checkoutCanceled && (
        <div className="mx-auto mb-4 max-w-[560px] rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white px-4 py-3">
          <p className="text-[14px] font-semibold text-[color:var(--ui-ink)]">
            You didn&rsquo;t finish checking out.
          </p>
          <p className="mt-0.5 text-[14px] leading-5 text-[color:var(--ui-text-2)]">
            Nothing was charged. Your plan is still selected below whenever you
            want to pick it up again.
          </p>
        </div>
      )}

      {isAuthenticated && user && addresses.length > 0 && <AddressPicker />}

      {isAuthenticated && user && addresses.length === 0 && (
        <div className="mx-auto mb-4 flex max-w-[560px] items-center justify-between gap-3 rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white px-4 py-3">
          <p className="text-[14px] font-medium text-[color:var(--ui-ink)]">Add an address to start a plan.</p>
          <button
            type="button"
            onClick={async () => {
              const home = await requestHome();
              if (home?.address?._id) setSelectedAddressId(String(home.address._id));
            }}
            className="ui-btn ui-btn--secondary ui-btn--sm shrink-0"
          >
            Add your home
          </button>
        </div>
      )}

      {(actionMessage || actionError) && (
        <div className="mx-auto mb-4 max-w-[560px] space-y-2">
          {actionMessage ? (
            <div className="rounded-[var(--ui-r-sm)] border border-[#cfe8d8] bg-[#f2faf5] px-4 py-3 text-[14px] font-medium text-[#1f6b3d]">
              {actionMessage}
            </div>
          ) : null}
          {actionError ? (
            <div className="pg-error" role="alert">
              {actionError}
            </div>
          ) : null}
        </div>
      )}

      {/* ========================= THE SELECTOR ========================= */}
      {compact ? <CompactPlanComparison /> : renderPlanSelector()}

      {/* ==================== AFTER THE DECISION ==================== */}
      {/*
        Loyalty and the free visit sit UNDER the decision, never beside it: a
        reason to stay and a way in for somebody not ready, as two quiet rows.
        Nothing about eligibility is touched - this is a link to /book/free.
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
              <b>Let&rsquo;s take a look at your to-do list.</b> The visit is free.
            </p>
            <Link href="/book/free" className="plan-after__link">
              Book a free visit
            </Link>
          </div>
        </div>
      )}

      {/*
        The reassurance a person wants in the second before they enter a card,
        and nothing more: four facts.
      */}
      <ul className="pg-facts pg-trust">
        <li>Licensed Suffolk County HI-71484</li>
        <li>Insured for in-home work</li>
        <li>Nassau &amp; Suffolk</li>
        <li>Secure payment by Stripe</li>
      </ul>
    </>
  );

  if (bare) {
    return (
      <div id="plans" className="scroll-mt-[96px]">
        {body}
      </div>
    );
  }

  return (
    <section id="plans" className={`ui-section ui-section--soft w-full scroll-mt-[96px] ${compact ? "ui-section--tight" : ""}`}>
      <div className="ui-container">{body}</div>
    </section>
  );
}

/**
 * "Here's what you picked." Shown once, after signup, before Stripe.
 *
 * The price is the same figure the plan card shows, tax is named rather than
 * hidden, and the only two choices are to continue or to change the plan.
 */
function PlanResumeSheet({
  planName,
  billing,
  welcome,
  offer,
  address,
  busy,
  error,
  onContinue,
  onClose,
}: {
  planName: string;
  billing: BillingCycle;
  welcome: WelcomePlanPrice | null;
  offer: WelcomeOffer;
  address: string;
  busy: boolean;
  error: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  const plan = plans.find((p) => p.name === planName);
  const pricing = plan ? getPlanPricing(plan, billing) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-[#0B1628]/45 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-resume-title"
      data-plan-resume
    >
      <div className="fv-enter w-full max-w-[440px] rounded-t-[var(--ui-r-lg)] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--ui-shadow-3)] sm:rounded-[var(--ui-r-lg)] sm:p-7">
        <p className="ui-eyebrow">Almost there</p>
        <h2 id="plan-resume-title" className="ui-h3 !text-[22px]">
          {planName} · {billing === "annual" ? "Annual" : "Monthly"}
        </h2>
        {welcome ? <WelcomeOfferBanner offer={offer} className="mt-3" /> : null}
        {welcome ? (
          <p className="mt-2 text-[color:var(--ui-ink)]" data-resume-welcome>
            <s className="wo-was mr-2 text-[18px]">{formatCents(welcome.monthlyCents)}</s>
            <span className="ui-num text-[36px] font-semibold tracking-[-0.04em]">{formatCents(welcome.firstMonthCents)}</span>
            <span className="ml-1 text-[15px] font-medium text-[color:var(--ui-text-3)]">first month</span>
            <span className="mt-1 block text-[14px] text-[color:var(--ui-text-2)]">Then {formatCents(welcome.monthlyCents)}/month afterward, plus applicable taxes.</span>
          </p>
        ) : pricing ? (
          <p className="mt-2 text-[color:var(--ui-ink)]">
            <span className="ui-num text-[36px] font-semibold tracking-[-0.04em]">${pricing.amount.toLocaleString("en-US")}</span>
            <span className="ml-1 text-[15px] font-medium text-[color:var(--ui-text-3)]">{pricing.suffix === "/mo" ? "/ month" : "/ year"}</span>
          </p>
        ) : null}
        <dl className="pg-rows mt-4">
          {address ? (
            <div>
              <dt>Home</dt>
              <dd>{address}</dd>
            </div>
          ) : null}
          <div>
            <dt>Billed</dt>
            <dd>
              {billing === "annual" ? "Yearly, upfront" : "Monthly"} · tax calculated at checkout
            </dd>
          </div>
        </dl>
        {error ? <p className="fv-error" role="alert">{error}</p> : null}
        <button type="button" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block mt-5" onClick={onContinue} disabled={busy} data-plan-resume-continue>
          {busy ? <><span className="fv-spinner" aria-hidden="true" /> Opening checkout…</> : <>Continue to secure checkout <span aria-hidden="true">→</span></>}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--block mt-2" onClick={onClose} disabled={busy}>
          Change plan
        </button>
      </div>
    </div>
  );
}
