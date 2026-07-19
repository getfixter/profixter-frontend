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
      "1 Rush Visit per month",
      "Need help sooner? Rush Visits don't require waiting for the next standard appointment slot.",
    ],
  },
  Elite: {
    description: "The most hands-on care for homes with larger ongoing needs.",
    features: [
      "Request membership visits as needed",
      "2 active appointments at a time",
      "1 full project day per month (up to 8 hours)",
      "2 Rush Visits per month",
      "Need help sooner? Rush Visits don't require waiting for the next standard appointment slot.",
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
  hideCancellationUi?: boolean;
  compact?: boolean;
};

export default function PlansSection({ hideCancellationUi = false, compact = false }: PlansSectionProps = {}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [promoCode, setPromoCode] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const [selectedComparisonPlan, setSelectedComparisonPlan] = useState<Plan["name"]>("Plus");
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

    return {
      kind: targetRank > currentRank ? ("upgrade" as ChangeActionKind) : ("downgrade" as ChangeActionKind),
      label: "Change Plan",
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
      <div className="rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:px-5">
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
              className="h-11 w-full rounded-[12px] border border-[#D1D5DB] bg-[#F9FAFB] px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#111827]"
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
    <div className={compact ? "mt-3 flex flex-col items-center" : "mt-7 flex flex-col items-center"}>
      <div className="inline-grid rounded-full bg-[#E8E8ED] p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
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
                  "h-9 min-w-[104px] rounded-full px-5 text-sm font-semibold capitalize transition duration-200",
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

  const CompactPlanComparison = () => {
    const selectedPlan = mobilePlans.find((plan) => plan.name === selectedComparisonPlan) || mobilePlans[0];
    if (!selectedPlan) return null;

    const action = getActionForPlan(selectedPlan.name);
    const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
    const comparisonRows: Array<{
      label: string;
      values: Record<Plan["name"], string>;
    }> = [
      {
        label: "Visits",
        values:
          billing === "annual"
            ? { Basic: "2+/mo", Plus: "4+/mo", Premium: "4+/mo", Elite: "4+/mo" }
            : { Basic: "2+", Plus: "4+", Premium: "4+", Elite: "4+" },
      },
      { label: "Supply", values: { Basic: "-", Plus: "✓", Premium: "✓", Elite: "✓" } },
      { label: "Rush", values: { Basic: "-", Plus: "-", Premium: "1/mo", Elite: "2/mo" } },
      { label: "Full day", values: { Basic: "-", Plus: "-", Premium: "-", Elite: "1/mo" } },
      { label: "Length", values: { Basic: "90 min/visit", Plus: "90 min/visit", Premium: "90 min/visit", Elite: "90 min/visit" } },
    ];
    const summaryFeatures: Record<Plan["name"], string[]> = {
      Basic: ["2+ visits over time", "90-minute visits", "All handyman services"],
      Plus: ["4+ visits over time", "Basic materials included", "90-minute visits"],
      Premium: ["4+ visits over time", "Basic materials included", "1 Rush Visit per month"],
      Elite: ["4+ visits over time", "1 full project day per month", "2 Rush Visits per month"],
    };
    const cellClass = (planName: Plan["name"]) =>
      selectedComparisonPlan === planName
        ? "plan-selection bg-[#EEF4FF] text-[#1F5ED8] shadow-[inset_0_0_0_1px_rgba(48,110,236,0.22)]"
        : "bg-white text-[#1D1D1F] hover:bg-[#F8FAFF]";

    return (
      <div className="mx-auto max-w-[920px]">
        <p className="mb-2 text-center text-[11px] font-medium text-[#86868B] sm:text-[12px]">
          <span aria-hidden="true">&#9757; </span>Tap a plan to select
        </p>
        <div className="overflow-hidden rounded-[18px] border border-[#D9DCE3] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-[68px_repeat(4,minmax(0,1fr))] sm:grid-cols-[112px_repeat(4,minmax(0,1fr))]">
            <div className="border-b border-[#E8E8ED] bg-[#FAFAFC]" aria-hidden="true" />
            {mobilePlans.map((plan) => (
              <button
                key={plan.name}
                type="button"
                onClick={() => setSelectedComparisonPlan(plan.name)}
                aria-pressed={selectedComparisonPlan === plan.name}
                aria-label={`Select ${plan.name} plan`}
                className={`relative min-w-0 border-b border-l border-[#E8E8ED] px-0.5 pb-3 pt-5 text-center transition sm:px-2 sm:pb-4 sm:pt-6 ${cellClass(plan.name)}`}
              >
                {plan.name === "Plus" ? (
                  <span className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#306EEC] px-1.5 py-0.5 text-[6px] font-semibold leading-3 text-white sm:top-1.5 sm:px-2 sm:text-[8px]">
                    Popular
                  </span>
                ) : null}
                <span className="flex min-w-0 items-center justify-center gap-0.5 text-[9px] font-bold leading-3 min-[360px]:text-[10px] sm:gap-1 sm:text-[13px]">
                  <span className="truncate">{plan.name}</span>
                  {selectedComparisonPlan === plan.name ? (
                    <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#306EEC] text-[7px] font-bold leading-none text-white sm:h-3.5 sm:w-3.5 sm:text-[8px]" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </span>
                <span key={billing} className="pricing-crossfade mt-1 block">
                  {billing === "annual" ? (() => {
                    const annual = getAnnualPromotion(plan);
                    return (
                      <>
                        <span className="block text-[8px] leading-3 text-[#86868B] line-through sm:text-[10px]">
                          ${formatMoney(annual.original)}
                        </span>
                        <span className={`block text-[12px] font-bold leading-4 min-[360px]:text-[13px] sm:text-[17px] ${selectedComparisonPlan === plan.name ? "text-[#1F5ED8]" : "text-[#111111]"}`}>
                          ${formatMoney(annual.discounted)}
                        </span>
                        <span className="block whitespace-nowrap text-[7px] font-semibold leading-3 text-[#306EEC] min-[360px]:text-[8px] sm:text-[10px]">
                          Only ${formatMoney(annual.monthlyEquivalent)}/mo
                        </span>
                        <span className="block whitespace-nowrap text-[6px] leading-3 text-[#86868B] min-[360px]:text-[7px] sm:text-[9px]">Billed annually</span>
                        <span className="mx-auto mt-1 block w-fit max-w-full whitespace-nowrap rounded-full bg-[#EAF7EF] px-0.5 py-0.5 text-[5px] font-bold leading-3 text-[#277447] min-[360px]:text-[6px] sm:px-2 sm:text-[9px]">
                          2 MONTHS FREE
                        </span>
                      </>
                    );
                  })() : (
                    <>
                      <span className="block text-[13px] font-semibold leading-4 min-[360px]:text-[14px] sm:text-[17px]">
                        ${formatMoney(getDisplayPrice(plan, billing))}
                      </span>
                      <span className="block text-[8px] leading-3 text-[#86868B] sm:text-[10px]">/mo</span>
                    </>
                  )}
                </span>
              </button>
            ))}

            {comparisonRows.map((row) => (
              <React.Fragment key={row.label}>
                <div className="flex min-h-10 items-center border-b border-[#EEEEF2] bg-[#FAFAFC] px-2 text-[9px] font-semibold leading-3 text-[#6E6E73] sm:min-h-12 sm:px-3 sm:text-[12px]">
                  {row.label}
                </div>
                {mobilePlans.map((plan) => (
                  <button
                    key={`${row.label}-${plan.name}`}
                    type="button"
                    onClick={() => setSelectedComparisonPlan(plan.name)}
                    aria-pressed={selectedComparisonPlan === plan.name}
                    aria-label={`${plan.name}: ${row.label} ${row.values[plan.name]}`}
                    className={`min-w-0 whitespace-nowrap border-b border-l border-[#EEEEF2] px-0.5 text-center font-semibold transition sm:px-2 ${
                      row.label === "Length"
                        ? "text-[6px] tracking-[-0.025em] min-[360px]:text-[7px] sm:text-[11px] sm:tracking-normal"
                        : "text-[11px] sm:text-[13px]"
                    } ${cellClass(plan.name)}`}
                  >
                    {row.values[plan.name]}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <p className="mt-2 px-1 text-[9px] leading-4 text-[#86868B] sm:text-[11px]">
          Available visits depend on appointment completion. Basic supports one active booking at a time. Plus, Premium and Elite support two active bookings at a time.
        </p>

        <div className="mt-4 rounded-[18px] border border-[#D9DCE3] bg-white p-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#306EEC]">{selectedPlan.name}</p>
              <h3 className="mt-1 text-[17px] font-semibold text-[#111111] sm:text-[19px]">{planDisplayContent[selectedPlan.name].description}</h3>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {summaryFeatures[selectedPlan.name].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                <span className="font-bold text-[#306EEC]" aria-hidden="true">✓</span>
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => handleSubscribe(selectedPlan.name)}
            data-track="plans-cta"
            disabled={disabled}
            className={`mt-4 h-12 w-full rounded-full text-[14px] font-semibold text-white transition ${
              disabled ? "cursor-not-allowed bg-[#B8C0CE]" : "bg-[#306EEC] hover:bg-[#2558C9]"
            }`}
          >
            {actionLoadingPlan === selectedPlan.name
              ? "Working..."
              : action.kind === "subscribe"
                ? `Choose ${selectedPlan.name}`
                : action.label}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section id="plans" className={`w-full scroll-mt-[140px] bg-[#F5F5F7] px-4 sm:px-5 ${compact ? "py-12 sm:py-16" : "py-12 sm:py-20 lg:py-24"}`}>
      <div className="mx-auto max-w-[1280px]">
        <div className={`mx-auto max-w-[720px] text-center ${compact ? "mb-7 sm:mb-9" : "mb-8 sm:mb-14"}`}>
          <h2 className="text-[32px] font-semibold tracking-normal text-[#111111] sm:text-5xl">
            Choose the membership for your home
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-[#6E6E73] sm:mt-4 sm:text-lg sm:leading-7">
            Start with the level of support that fits today. You can change plans as your home needs change.
          </p>
          {promoCode ? (
            <div className="mt-5 inline-flex rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-sm font-semibold text-[#166534]">
              Promo code {promoCode} will be applied at checkout
            </div>
          ) : null}
          {compact ? (
            <div className="mx-auto mt-5 max-w-[360px] rounded-[16px] border border-[#D9E4FA] bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(48,110,236,0.06)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#306EEC]">&#127881; Annual special</p>
              <p className="mt-1 text-[13px] leading-5 text-[#4B5563]">
                Pay for <strong className="font-semibold text-[#111111]">10 months</strong>. Get <strong className="font-semibold text-[#111111]">12 months of Membership.</strong>
              </p>
            </div>
          ) : null}
          <BillingToggle />
        </div>

        {isAuthenticated && user && addresses.length > 0 && <AddressPicker />}

        {isAuthenticated && user && addresses.length === 0 && (
          <div className="mx-auto mb-8 max-w-[520px] rounded-[18px] border border-[#E5E7EB] bg-white p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <p className="font-semibold text-[#111827]">Add an address to start a plan.</p>
            <button
              onClick={() => (window.location.href = roleLandingPath)}
              className="mt-4 h-11 rounded-full bg-[#111111] px-6 text-sm font-semibold text-white transition hover:bg-black"
            >
              Add Address
            </button>
          </div>
        )}

        {(actionMessage || actionError) && (
          <div className="mx-auto mb-8 max-w-[720px] space-y-3">
            {actionMessage ? (
              <div className="rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm font-semibold text-[#166534]">
                {actionMessage}
              </div>
            ) : null}
            {actionError ? (
              <div className="rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#991B1B]">
                {actionError}
              </div>
            ) : null}
          </div>
        )}

        {!compact && <div className="mx-auto mb-6 max-w-[720px] text-center sm:mb-8">
          <h3 className="text-[18px] font-semibold tracking-normal text-[#111111] sm:text-2xl">
            Membership is the home base
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-[#6E6E73] sm:text-base sm:leading-6">
            Your plan determines appointment capacity, scheduling benefits, and the level of ongoing support available to your home.
          </p>
        </div>}

        {!compact && <div className="mx-auto mb-7 max-w-[780px] rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:mb-10 sm:p-5">
          <div className="grid items-stretch gap-3 text-left sm:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[18px] bg-[#0B1628] px-4 py-4 text-white">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                Recommended for homeowners
              </div>
              <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] sm:text-[26px]">
                One trusted team, month after month
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-white/65">
                Better for homeowners who expect the home list to keep growing.
              </div>
            </div>
            <div className="rounded-[18px] bg-[#F8FAFC] px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#64748B]">
                If you only need one visit
              </div>
              <div className="mt-2 text-[20px] font-semibold tracking-[-0.025em] text-[#111111]">
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
                    "relative flex w-full max-w-full min-w-0 flex-col overflow-hidden rounded-[24px] border bg-white p-5 shadow-[0_16px_54px_rgba(15,23,42,0.07)] transition duration-300 sm:rounded-[28px] sm:p-7 sm:shadow-[0_20px_70px_rgba(15,23,42,0.07)]",
                    isPopular
                      ? "border-[#111111] ring-2 ring-[#111111]"
                      : "border-[#E5E7EB]",
                  ].join(" ")}
                >
                  {isPopular ? (
                    <div className="absolute right-5 top-5 rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white">
                      Most Popular
                    </div>
                  ) : null}

                  <div className="min-w-0 pr-24">
                    <h3 className="text-[22px] font-semibold tracking-normal text-[#111111] sm:text-2xl">
                      {plan.name}
                    </h3>
                  </div>

                  <div className="mt-6 sm:mt-8">
                    <div className="flex items-end gap-1">
                      <span className="text-[42px] font-semibold leading-none tracking-normal text-[#111111] sm:text-5xl">
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
                      "mt-auto h-12 w-full max-w-full rounded-full border text-sm font-semibold transition duration-200",
                      disabled
                        ? "cursor-not-allowed border-[#D1D5DB] bg-[#D1D5DB] text-white"
                        : isPopular
                          ? "border-[#111111] bg-[#111111] text-white hover:bg-black"
                          : "border-[#111111]/20 bg-white text-[#111111] hover:border-[#111111] hover:bg-[#F8F8F8]",
                    ].join(" ")}
                  >
                    {actionLoadingPlan === plan.name ? "Working..." : action.label}
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
                    "relative flex min-h-[500px] flex-col rounded-[28px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.07)] transition duration-300 sm:p-7",
                    isPopular
                    ? "border-[#111111] ring-2 ring-[#111111]"
                    : "border-[#E5E7EB]",
                ].join(" ")}
              >
                {isPopular ? (
                  <div className="absolute right-5 top-5 rounded-full bg-[#111111] px-3 py-1 text-[12px] font-semibold text-white">
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
                  <p className="mt-5 min-h-[52px] break-words text-[15px] leading-6 text-[#6E6E73]">
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
                      "mt-auto h-12 w-full max-w-full rounded-full border text-sm font-semibold transition duration-200",
                    disabled
                      ? "cursor-not-allowed border-[#D1D5DB] bg-[#D1D5DB] text-white"
                      : isPopular
                        ? "border-[#111111] bg-[#111111] text-white hover:bg-black"
                        : "border-[#111111]/20 bg-white text-[#111111] hover:border-[#111111] hover:bg-[#F8F8F8]",
                  ].join(" ")}
                >
                  {actionLoadingPlan === plan.name ? "Working..." : action.label}
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
