"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { plans, type Plan } from "@/app/data/content";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
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
    description: "Perfect for occasional home maintenance.",
    features: [
      "No limits per month",
      "1 active appointment at a time",
      "All handyman services included",
      "90-minute visits",
    ],
  },
  Plus: {
    description: "The best balance for active homeowners.",
    features: [
      "No limits per month",
      "2 active appointments at a time",
      "Basic materials included",
      "90-minute visits",
    ],
  },
  Premium: {
    description: "Extra peace of mind when things can't wait.",
    features: [
      "No limits per month",
      "2 active appointments at a time",
      "Basic materials included",
      "1 free emergency visit per month",
    ],
  },
  Elite: {
    description: "Maximum home coverage.",
    features: [
      "No limits per month",
      "2 active appointments at a time",
      "1 full project day per month (up to 8 hours)",
      "2 free emergency visits per month",
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

export default function PlansSection() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [promoCode, setPromoCode] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const { user, isAuthenticated, token } = useAuth();

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
  const [mobilePlanIndex, setMobilePlanIndex] = useState(1);
  const mobileTrackRef = React.useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const scrollMobileCardToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const card = mobileCardRefs.current[index];
    if (card) {
      card.scrollIntoView({ behavior, inline: "center", block: "nearest" });
    }
  }, []);

  useEffect(() => {
    mobileCardRefs.current = mobileCardRefs.current.slice(0, mobilePlans.length);
  }, [mobilePlans.length]);

  useEffect(() => {
    scrollMobileCardToIndex(mobilePlanIndex, "auto");
  }, [mobilePlanIndex, scrollMobileCardToIndex]);

  const handleMobileScroll = useCallback(() => {
    const container = mobileTrackRef.current;
    if (!container) return;

    const containerCenter = container.getBoundingClientRect().left + container.clientWidth / 2;
    let closestIndex = mobilePlanIndex;
    let closestDistance = Number.POSITIVE_INFINITY;

    mobileCardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - containerCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== mobilePlanIndex) {
      setMobilePlanIndex(closestIndex);
    }
  }, [mobilePlanIndex]);

  useEffect(() => {
    const container = mobileTrackRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleMobileScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleMobileScroll);
  }, [handleMobileScroll]);

  const handleMobilePrev = () => setMobilePlanIndex((current) => Math.max(0, current - 1));
  const handleMobileNext = () => setMobilePlanIndex((current) => Math.min(mobilePlans.length - 1, current + 1));

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
      window.location.href = `/signin?redirect=${encodeURIComponent(preservePlanUrl)}`;
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
        window.location.href = `/signin?redirect=${encodeURIComponent(preservePlanUrl)}`;
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
        label: "Get Started",
        disabled: false,
      };
    }

    if (selectedSubscription?.cancelAtPeriodEnd) {
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
        label: "Get Started",
        disabled: false,
      };
    }

    return {
      kind: targetRank > currentRank ? ("upgrade" as ChangeActionKind) : ("downgrade" as ChangeActionKind),
      label: "Get Started",
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
      window.location.href = `/signin?redirect=${encodeURIComponent(
        `/membership?plan=${encodeURIComponent(planType)}&billingCycle=${encodeURIComponent(billing)}`
      )}`;
      return;
    }

    if (!addresses.length) {
      setActionError("Please add an address to your account first.");
      window.location.href = "/account";
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
    <div className="mt-7 flex flex-col items-center">
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
      {billing === "annual" ? (
        <p className="mt-3 text-sm font-medium text-[#6E6E73]">
          Pay for 11 months, get 12 months of service.
        </p>
      ) : null}
    </div>
  );

  return (
    <section id="plans" className="w-full scroll-mt-[140px] bg-[#F5F5F7] px-5 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto mb-10 max-w-[720px] text-center sm:mb-14">
          <h2 className="text-4xl font-semibold tracking-normal text-[#111111] sm:text-5xl">
            Choose Your Plan
          </h2>
          <p className="mt-4 text-base leading-7 text-[#6E6E73] sm:text-lg">
            Start with the plan that fits your home today. Upgrade or downgrade anytime.
          </p>
          {promoCode ? (
            <div className="mt-5 inline-flex rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-sm font-semibold text-[#166534]">
              Promo code {promoCode} will be applied at checkout
            </div>
          ) : null}
          <BillingToggle />
        </div>

        {isAuthenticated && user && addresses.length > 0 && <AddressPicker />}

        {isAuthenticated && user && addresses.length === 0 && (
          <div className="mx-auto mb-8 max-w-[520px] rounded-[18px] border border-[#E5E7EB] bg-white p-5 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <p className="font-semibold text-[#111827]">Add an address to start a plan.</p>
            <button
              onClick={() => (window.location.href = "/account")}
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

        <div className="mx-auto mb-8 max-w-[720px] text-center">
          <h3 className="text-xl font-semibold tracking-normal text-[#111111] sm:text-2xl">
            No Limits Per Month
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#6E6E73] sm:text-base">
            Book as many visits as you need. Your plan determines appointment availability and benefits.
          </p>
        </div>

        <div className="lg:hidden">
          <div
            ref={mobileTrackRef}
            className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory touch-pan-x"
          >
            {mobilePlans.map((plan, index) => {
              const action = getActionForPlan(plan.name);
              const isPopular = plan.name === "Plus";
              const disabled = action.disabled || !!actionLoadingPlan || checkingAddr;
              const displayPrice = getDisplayPrice(plan, billing);
              const content = planDisplayContent[plan.name];

              return (
                <article
                  key={plan.name}
                  ref={(el) => {
                    mobileCardRefs.current[index] = el as HTMLDivElement | null;
                  }}
                  className={[
                    "snap-center flex min-w-[82%] flex-shrink-0 flex-col rounded-[28px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.07)] transition duration-300 sm:min-w-[75%] sm:p-7",
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

                  <div className="pr-24">
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
                    <p className="mt-5 min-h-[52px] text-[15px] leading-6 text-[#6E6E73]">
                      {content.description}
                    </p>
                  </div>

                  <ul className="mt-7 space-y-4">
                    {content.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-[15px] leading-6 text-[#1D1D1F]">
                        <span className="mt-[1px] flex-none text-sm font-semibold text-[#111111]">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.name)}
                    data-track="plans-cta"
                    disabled={disabled}
                    className={[
                      "mt-auto h-12 rounded-full text-sm font-semibold transition duration-200",
                      disabled
                        ? "cursor-not-allowed bg-[#D1D5DB] text-white"
                        : isPopular
                          ? "bg-[#111111] text-white hover:bg-black"
                          : "bg-[#F2F2F2] text-[#111111] hover:bg-[#E5E5E5]",
                    ].join(" ")}
                  >
                    {actionLoadingPlan === plan.name ? "Working..." : action.label}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 px-2">
            <button
              type="button"
              onClick={handleMobilePrev}
              disabled={mobilePlanIndex === 0}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-[#111111] transition hover:bg-[#F8F8F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="sr-only">Previous plan</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {mobilePlans.map((plan, index) => (
                <span
                  key={plan.name}
                  className={[
                    "h-2.5 w-2.5 rounded-full transition-colors",
                    index === mobilePlanIndex ? "bg-[#111111]" : "bg-[#D9D9DB]",
                  ].join(" ")}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleMobileNext}
              disabled={mobilePlanIndex === mobilePlans.length - 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-[#111111] transition hover:bg-[#F8F8F9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="sr-only">Next plan</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
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

                <div className="pr-24">
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
                  <p className="mt-5 min-h-[52px] text-[15px] leading-6 text-[#6E6E73]">
                    {content.description}
                  </p>
                </div>

                <ul className="mt-7 space-y-4">
                  {content.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-[15px] leading-6 text-[#1D1D1F]">
                      <span className="mt-[1px] flex-none text-sm font-semibold text-[#111111]">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.name)}
                  data-track="plans-cta"
                  disabled={disabled}
                  className={[
                    "mt-auto h-12 rounded-full text-sm font-semibold transition duration-200",
                    disabled
                      ? "cursor-not-allowed bg-[#D1D5DB] text-white"
                      : isPopular
                        ? "bg-[#111111] text-white hover:bg-black"
                        : "bg-[#F2F2F2] text-[#111111] hover:bg-[#E5E5E5]",
                  ].join(" ")}
                >
                  {actionLoadingPlan === plan.name ? "Working..." : action.label}
                </button>
              </article>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-[760px] text-center text-sm leading-6 text-[#6E6E73] sm:text-base">
          All plans include the same trusted team, online booking, and access to every Profixter service.
        </p>
      </div>
    </section>
  );
}
