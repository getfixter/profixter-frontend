"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

const planDisplayContent: Record<
  Plan["name"],
  {
    description: string;
    features: string[];
  }
> = {
  Basic: {
    description: "A simple way to keep occasional home tasks moving.",
    features: [
      "Request membership visits as needed",
      "1 active appointment at a time",
      "All handyman services included",
      "90-minute visits",
    ],
  },
  Plus: {
    description: "The balanced plan for homeowners who want steady support.",
    features: [
      "Request membership visits as needed",
      "2 active appointments at a time",
      "Basic materials included",
      "90-minute visits",
    ],
  },
  Premium: {
    description: "For homes that need priority support when timing matters.",
    features: [
      "Request membership visits as needed",
      "2 active appointments at a time",
      "Basic materials included",
      "1 Priority Visit per month",
      "Priority Visits help when you need service before the next standard appointment slot, subject to technician availability.",
    ],
  },
  Elite: {
    description: "The most hands-on care for homes with larger ongoing needs.",
    features: [
      "Request membership visits as needed",
      "2 active appointments at a time",
      "1 full project day per month (up to 8 hours)",
      "2 Priority Visits per month",
      "Priority Visits help when you need service before the next standard appointment slot, subject to technician availability.",
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

function getDisplayPrice(plan: Plan, billing: BillingCycle): number {
  const monthly = toNumberPrice(plan.price);
  return billing === "annual" ? monthly * 11 : monthly;
}

function getAnnualPromotion(plan: Plan) {
  const monthly = toNumberPrice(plan.price);
  const original = monthly * 12;
  const discounted = monthly * 10;
  return {
    original,
    discounted,
    monthlyEquivalent: Math.round(discounted / 12),
  };
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
    const preservePlanUrl = `/membership?plan=${encodeURIComponent(plan)}&billingCycle=${encodeURIComponent(
      cycle
    )}&addressId=${encodeURIComponent(addressId)}#plans`;

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
      window.location.href = `/signup?redirect=${encodeURIComponent(
        `/membership?plan=${encodeURIComponent(planType)}&billingCycle=${encodeURIComponent(billing)}#plans`
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
      Premium: { adds: ["Everything in Plus", "One Priority Visit each month", "Direct line to Taras, the founder"] },
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
              "No fixed monthly visit count",
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
            const annual = getAnnualPromotion(plan);
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

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[30px] font-semibold tracking-[-0.03em] text-[#111111]">
                    ${billing === "annual" ? formatMoney(annual.monthlyEquivalent) : formatMoney(plan.price)}
                  </span>
                  <span className="text-[15px] font-medium text-[#86868B]">/mo</span>
                </div>
                {billing === "annual" ? (
                  <p className="mt-1 text-[13px] text-[#6E6E73]">
                    ${formatMoney(annual.discounted)} billed yearly, 12 months for the price of 10
                  </p>
                ) : null}

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
          Standard member visits have no fixed monthly count. Basic keeps one visit on the
          calendar at a time; the other plans allow two. Larger renovations are quoted separately.
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

        {!compact && !hideIntro && <div className="mx-auto mb-6 max-w-[720px] text-center sm:mb-8">
          <h3 className="text-[18px] font-semibold tracking-normal text-[#111111] sm:text-[20px]">
            Membership is the home base
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-[#6E6E73] sm:text-base sm:leading-6">
            Your plan determines appointment capacity, scheduling benefits, and the level of ongoing support available to your home.
          </p>
        </div>}

        {!compact && !hideIntro && <div className="mx-auto mb-7 max-w-[780px] rounded-[8px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:mb-7 sm:p-5">
          <div className="grid items-stretch gap-3 text-left sm:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[8px] bg-[#0B1628] px-4 py-4 text-white">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                Recommended for homeowners
              </div>
              <div className="mt-2 text-[21px] font-semibold tracking-[-0.03em] sm:text-[23px]">
                One trusted team, month after month
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-white/65">
                Better for homeowners who expect the home list to keep growing.
              </div>
            </div>
            <div className="rounded-[8px] bg-[#F8FAFC] px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#64748B]">
                If you only need one visit
              </div>
              <div className="mt-2 text-[19px] font-semibold tracking-[-0.025em] text-[#111111]">
                One-time booking is still available
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-[#6E6E73]">
                Use it when Membership is not the right fit today.
              </div>
            </div>
          </div>
        </div>}

        {compact ? <CompactPlanComparison /> : <><div className="grid gap-4 lg:hidden">
          {mobilePlans.map((plan) => {
              const action = getActionForPlan(plan.name);
              const isPopular = plan.name === "Plus";
              const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
              const displayPrice = getDisplayPrice(plan, billing);
              const content = planDisplayContent[plan.name];

              return (
                <article
                  key={plan.name}
                  className={[
                    "relative flex w-full max-w-full min-w-0 flex-col overflow-hidden rounded-[8px] border bg-white p-5 shadow-[0_16px_54px_rgba(15,23,42,0.07)] transition duration-300 sm:p-7 sm:shadow-[0_20px_70px_rgba(15,23,42,0.07)]",
                    isPopular
                      ? "border-[#111111] ring-2 ring-[#111111]"
                      : "border-[#E5E7EB]",
                  ].join(" ")}
                >
                  {isPopular ? (
                    <div className="absolute right-5 top-5 rounded-[8px] bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white">
                      Most Popular
                    </div>
                  ) : null}

                  <div className="min-w-0 pr-24">
                    <h3 className="text-[21px] font-semibold tracking-normal text-[#111111] sm:text-2xl">
                      {plan.name}
                    </h3>
                  </div>

                  <div className="mt-6 sm:mt-8">
                    <div className="flex items-end gap-1">
                      <span className="text-[34px] font-semibold leading-none tracking-normal text-[#111111] sm:text-5xl">
                        ${formatMoney(displayPrice)}
                      </span>
                      <span className="pb-1 text-sm font-medium text-[#6E6E73]">
                        /{billing === "annual" ? "year" : "mo"}
                      </span>
                    </div>
                    <p className="mt-4 min-h-[46px] text-[14px] leading-5 text-[#6E6E73] sm:mt-5 sm:min-h-[52px] sm:text-[15px] sm:leading-6">
                      {content.description}
                    </p>
                  </div>

                  <ul className="mt-6 space-y-3 sm:mt-7 sm:space-y-4">
                    {content.features.map((feature) => (
                      <li key={feature} className="flex min-w-0 gap-2.5 text-[14px] leading-5 text-[#1D1D1F] sm:gap-3 sm:text-[15px] sm:leading-6">
                        <PlanCheck />
                        <span className="min-w-0 break-words">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.name)}
                    data-track="plans-cta"
                    disabled={disabled}
                    className={[
                      "mt-auto h-12 w-full max-w-full rounded-[8px] border text-sm font-semibold transition duration-200",
                      disabled
                        ? "cursor-not-allowed border-[#D1D5DB] bg-[#D1D5DB] text-white"
                        : isPopular
                          ? "border-[#111111] bg-[#111111] text-white hover:bg-black"
                          : "border-[#111111]/20 bg-white text-[#111111] hover:border-[#111111] hover:bg-[#F8F8F8]",
                    ].join(" ")}
                  >
                    {actionLoadingPlan === plan.name ? "Working..." : !isAuthenticated ? "Create Account" : action.label}
                  </button>
                </article>
              );
            })}
        </div>

        <div className="hidden gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4 lg:grid">
          {plans.map((plan) => {
            const action = getActionForPlan(plan.name);
            const isPopular = plan.name === "Plus";
            const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
            const displayPrice = getDisplayPrice(plan, billing);
            const content = planDisplayContent[plan.name];

            return (
              <article
                key={plan.name}
                className={[
                    "relative flex min-h-[500px] flex-col rounded-[8px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.07)] transition duration-300 sm:p-7",
                    isPopular
                    ? "border-[#111111] ring-2 ring-[#111111]"
                    : "border-[#E5E7EB]",
                ].join(" ")}
              >
                {isPopular ? (
                  <div className="absolute right-5 top-5 rounded-[8px] bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white">
                    Most Popular
                  </div>
                ) : null}

                <div className="min-w-0 pr-24">
                  <h3 className="text-2xl font-semibold tracking-normal text-[#111111]">
                    {plan.name}
                  </h3>
                </div>

                <div className="mt-8">
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-semibold leading-none tracking-normal text-[#111111]">
                      ${formatMoney(displayPrice)}
                    </span>
                    <span className="pb-1 text-sm font-medium text-[#6E6E73]">
                      /{billing === "annual" ? "year" : "mo"}
                    </span>
                  </div>
                  <p className="mt-5 min-h-[46px] break-words text-[15px] leading-6 text-[#6E6E73]">
                    {content.description}
                  </p>
                </div>

                <ul className="mt-7 space-y-4">
                  {content.features.map((feature) => (
                    <li key={feature} className="flex min-w-0 gap-3 text-[15px] leading-6 text-[#1D1D1F]">
                      <PlanCheck />
                      <span className="min-w-0 break-words">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.name)}
                  data-track="plans-cta"
                  disabled={disabled}
                  className={[
                      "mt-auto h-12 w-full max-w-full rounded-[8px] border text-sm font-semibold transition duration-200",
                    disabled
                      ? "cursor-not-allowed border-[#D1D5DB] bg-[#D1D5DB] text-white"
                      : isPopular
                        ? "border-[#111111] bg-[#111111] text-white hover:bg-black"
                        : "border-[#111111]/20 bg-white text-[#111111] hover:border-[#111111] hover:bg-[#F8F8F8]",
                  ].join(" ")}
                >
                  {actionLoadingPlan === plan.name ? "Working..." : !isAuthenticated ? "Create Account" : action.label}
                </button>
              </article>
            );
          })}
        </div></>}

        {!compact && <p className="mx-auto mt-8 max-w-[760px] text-center text-sm leading-6 text-[#6E6E73] sm:text-base">
          All Membership plans include the same trusted team, online booking, and access to every Profixter service.
        </p>}
      </div>
    </section>
  );
}
