"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { plans, type Plan } from "@/app/data/content";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import type { PlanType } from "@/lib/stripe-links";
import { trackInitiateCheckout } from "@/lib/analytics";
import {
  createBillingPortalSession,
  changeSubscriptionPlan,
  getSubscriptionActionErrorMessage,
  getManagedSubscriptionForAddress,
  type BillingCycle as ManagedBillingCycle,
  type ManagedSubscription,
} from "@/lib/subscription-service";

type Address = {
  _id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
};

type BillingCycle = "monthly" | "annual";
type CheckoutResponse = {
  url?: string;
  eventId?: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

function toNumberPrice(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatMoney(n: number): string {
  const rounded = Math.round(n);
  return String(rounded);
}

function formatDate(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function getDisplayName(planName: string): string {
  if (planName === "Basic") return "Home Care Membership";
  if (planName === "Plus") return "Home Care Plus";
  if (planName === "Premium") return "Home Protection";
  if (planName === "Elite") return "Whole-Home Care";
  return planName;
}

function getPositioningLabel(planName: string): string {
  if (planName === "Basic") return "For simple ongoing home tasks";
  if (planName === "Plus") return "Most popular — best balance";
  if (planName === "Premium") return "For faster progress & priority scheduling";
  if (planName === "Elite") return "Everything about your home — handled.";
  return "";
}

function getPriceValueNote(planName: string): string {
  if (planName === "Basic") return "Less than the cost of one typical handyman visit";
  if (planName === "Plus") return "Costs less than calling a handyman twice";
  if (planName === "Premium") return "For homeowners who want things done faster";
  return "";
}

function getComparisonLabel(planName: string): string {
  if (planName === "Basic") return "One scheduled visit each month";
  if (planName === "Plus") return "Two scheduled visits each month";
  if (planName === "Premium") return "Two scheduled visits + emergency response";
  if (planName === "Elite") return "Two scheduled visits + a full project day";
  return "";
}

function getBadgeLabel(planName: string, badge?: string): string {
  if (planName === "Plus") return "Most Popular";
  if (planName === "Premium") return "Most members stay here";
  if (badge === "StartHere") return "Most members start here";
  if (badge === "StayHere") return "Most members stay here";
  return "";
}

function getRetentionLine(planName: string): string {
  if (planName === "Basic")
    return "Most members stay for the long haul — your home keeps getting better, not worse.";
  if (planName === "Plus")
    return "Where most homeowners with active homes start — and stay for years.";
  if (planName === "Premium")
    return "The plan members keep when they have kids, pets, or a finished basement.";
  if (planName === "Elite")
    return "The plan that replaces the contractor list in your phone.";
  return "";
}

function getPlanDisplayLabel(plan: PlanType | null): string {
  if (plan === "basic") return "Basic";
  if (plan === "plus") return "Plus";
  if (plan === "premium") return "Premium";
  if (plan === "elite") return "Elite";
  return "Current";
}

function getMonthlyPlanPrice(plan: PlanType | null): number {
  const matched = plans.find((candidate) => normalizePlanType(candidate.name) === plan);
  return matched ? toNumberPrice(matched.price) : 0;
}

function isManagedActiveStatus(status?: string | null): boolean {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

type ChangeActionKind =
  | "subscribe"
  | "active"
  | "active-unknown"
  | "scheduled"
  | "cancel-scheduled"
  | "upgrade"
  | "downgrade";

export default function PlansSection() {
  const [currentSlide, setCurrentSlide] = useState(() => {
    const i = plans.findIndex((p) => p.name === "Plus");
    return i >= 0 ? i : 0;
  });

  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    planName: string;
    planType: PlanType;
    kind: "upgrade" | "downgrade";
  } | null>(null);

  const { user, isAuthenticated, token } = useAuth();

  const addresses: Address[] = ((user as any)?.addresses || []) as Address[];

  const defaultAddress = useMemo(() => {
    if (!user) return null;
    const defaultId = String((user as any)?.defaultAddressId || "");
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

  useEffect(() => {
    if (!selectedAddressId && defaultAddress?._id) {
      setSelectedAddressId(String(defaultAddress._id));
    }
  }, [defaultAddress, selectedAddressId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
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

    const requestedPlan = normalizePlanType(params.get("plan") || pending?.plan || "");
    const requestedBilling = String(
      params.get("billingCycle") || pending?.billingCycle || ""
    ).toLowerCase();
    const requestedAddressId = params.get("addressId") || pending?.addressId || "";

    if (requestedBilling === "monthly" || requestedBilling === "annual") {
      setBilling(requestedBilling);
    }

    if (requestedPlan) {
      const matchingPlanIndex = plans.findIndex(
        (candidate) => normalizePlanType(candidate.name) === requestedPlan
      );
      if (matchingPlanIndex >= 0) {
        setCurrentSlide(matchingPlanIndex);
      }
    }

    if (
      requestedAddressId &&
      addresses.some((address) => String(address._id) === String(requestedAddressId))
    ) {
      setSelectedAddressId(String(requestedAddressId));
    }
  }, [addresses]);

  const checkAddressState = async (addressId: string) => {
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
  };

  useEffect(() => {
    if (token && selectedAddressId) {
      if (addressSubscriptionMap[selectedAddressId] === undefined) {
        checkAddressState(selectedAddressId);
      }
    }
  }, [token, selectedAddressId, addressSubscriptionMap]);

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
      console.info("[checkout] Checkout request prepared", {
        tokenExists: !!authToken,
        authHeaderAttached: true,
        endpointUrl,
      });

      const res = await API.post<CheckoutResponse>(
        endpointPath,
        { plan, addressId, email, billingCycle: cycle },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          validateStatus: () => true,
        }
      );

      console.info("[checkout] Checkout response received", {
        tokenExists: !!authToken,
        authHeaderAttached: true,
        endpointUrl,
        responseStatus: res.status,
      });

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
          tokenExists: !!authToken,
          authHeaderAttached: true,
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
        tokenExists: !!authToken,
        authHeaderAttached: true,
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
    } catch (error: any) {
      console.error("[checkout] Checkout request crashed", {
        tokenExists: !!authToken,
        authHeaderAttached: true,
        endpointUrl,
        responseStatus: error?.response?.status || null,
        message: error?.message || "Unknown checkout error",
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

    if (!planType) {
      return {
        kind: "subscribe" as ChangeActionKind,
        label: "Get Subscription",
        disabled: false,
      };
    }

    if (!selectedAddressActive) {
      return {
        kind: "subscribe" as ChangeActionKind,
        label: "Get Subscription",
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
        label: billing === "annual" ? "Switch now" : "Schedule change",
        disabled: false,
      };
    }

    if (targetRank > currentRank) {
      return {
        kind: "upgrade" as ChangeActionKind,
        label: "Upgrade",
        disabled: false,
      };
    }

    return {
      kind: "downgrade" as ChangeActionKind,
      label: "Downgrade",
      disabled: false,
    };
  };

  const applyPlanChange = async (
    planName: string,
    planType: PlanType,
    kind: "upgrade" | "downgrade"
  ) => {
    if (!selectedAddress) return;

    try {
      setActionLoadingPlan(planName);
      const result = await changeSubscriptionPlan({
        addressId: selectedAddress._id,
        plan: planType,
        billingCycle: billing as ManagedBillingCycle,
      });
      setAddressSubscriptionMap((map) => ({
        ...map,
        [selectedAddress._id]: result.subscription,
      }));
      setActionMessage(
        kind === "upgrade"
          ? "Your plan has been updated."
          : "Your downgrade has been scheduled."
      );
      setConfirmAction(null);
    } catch (error: any) {
      setActionError(getSubscriptionActionErrorMessage(error));
    } finally {
      setActionLoadingPlan(null);
    }
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
    } catch (error: any) {
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
      await startCheckout(planType, selectedAddress._id, (user as any).email, billing, planName);
      return;
    }

    await openBillingPortalForSelectedAddress(planName);
  };

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % plans.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + plans.length) % plans.length);

  const selectedAddressSubscription = selectedAddressId
    ? addressSubscriptionMap[selectedAddressId] || null
    : null;
  const addressIsActive = isManagedActiveStatus(selectedAddressSubscription?.status);
  const scheduledPlanName = selectedAddressSubscription?.pendingPlan
    ? `${String(selectedAddressSubscription.pendingPlan).charAt(0).toUpperCase()}${String(
        selectedAddressSubscription.pendingPlan
      ).slice(1)}`
    : null;
  const scheduledChangeDate = formatDate(selectedAddressSubscription?.pendingChangeEffectiveDate);
  const selectedAddressCurrentPlan = normalizePlanType(
    selectedAddressSubscription?.subscriptionType || ""
  );
  const selectedAddressRenewalDate = formatDate(
    selectedAddressSubscription?.currentPeriodEnd ||
      selectedAddressSubscription?.nextPaymentDate ||
      null
  );

  const touchStartX = useRef<number | null>(null);
  const touchLastX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchLastX.current = touchStartX.current;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchLastX.current = e.touches[0]?.clientX ?? touchLastX.current;
  };

  const onTouchEnd = () => {
    if (touchStartX.current == null || touchLastX.current == null) return;
    const dx = touchLastX.current - touchStartX.current;

    if (Math.abs(dx) > 55) {
      if (dx < 0) nextSlide();
      else prevSlide();
    }

    touchStartX.current = null;
    touchLastX.current = null;
  };

  const getMonthly = (plan: Plan) => toNumberPrice(plan.price);
  const getAnnual = (plan: Plan) => getMonthly(plan) * 11;

  const BillingToggle = ({ compact }: { compact?: boolean }) => (
    <div className={`${compact ? "mt-6" : "mt-8"} w-full`}>
      <div className={`${compact ? "mx-auto max-w-[520px]" : ""}`}>
        <div className="bg-white/10 border border-white/15 rounded-2xl px-3 py-3 sm:px-4 sm:py-4 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.20)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col">
              <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                {billing === "annual" ? "Annual Plan" : "Monthly Plan"}
              </p>
              <p className="text-[#C5CBD8] text-xs sm:text-sm leading-snug mt-1">
                {billing === "annual" ? (
                  <>
                    Pay for <span className="text-white font-semibold">11 months</span>, get{" "}
                    <span className="text-white font-semibold">12</span>
                  </>
                ) : (
                  <>Month-to-month membership. No long-term contracts.</>
                )}
              </p>
            </div>

            <div className="grid grid-cols-[72px_auto_72px] items-center gap-3 shrink-0">
              <span
                className={`text-sm font-semibold text-right whitespace-nowrap ${
                  billing === "monthly" ? "text-white" : "text-white/60"
                }`}
              >
                Monthly
              </span>

              <button
                type="button"
                onClick={() => setBilling((b) => (b === "monthly" ? "annual" : "monthly"))}
                aria-label="Toggle billing cycle"
                className={`relative w-[70px] h-[38px] rounded-full border transition-colors duration-300 ${
                  billing === "annual"
                    ? "bg-[#306EEC] border-[#306EEC]/60"
                    : "bg-white/15 border-white/20"
                }`}
              >
                <span
                  className={`absolute top-[4px] left-[4px] w-[30px] h-[30px] rounded-full bg-white shadow-md transition-transform duration-300 ${
                    billing === "annual" ? "translate-x-[32px]" : "translate-x-0"
                  }`}
                />
              </button>

              <span
                className={`text-sm font-semibold text-left whitespace-nowrap ${
                  billing === "annual" ? "text-white" : "text-white/60"
                }`}
              >
                Annually
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div />
            <span className="sm:hidden text-[#C5CBD8] text-[11px]">Month-to-month</span>
          </div>
        </div>
      </div>
    </div>
  );

  const AddressPicker = () => (
    <div className="w-full mb-6">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.20)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-white text-sm font-semibold mb-2">Select address</p>

              {addresses.length ? (
                <select
                  value={selectedAddressId || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedAddressId(id);
                    if (token && addressSubscriptionMap[id] === undefined) {
                      checkAddressState(id);
                    }
                  }}
                  className="w-full h-[46px] rounded-xl px-3 bg-[#EEF2FF] text-[#313234] font-semibold outline-none focus:ring-4 focus:ring-[#306EEC]/25"
                >
                  {addresses.map((a) => (
                    <option key={a._id} value={a._id}>
                      {(a.label ? `${a.label}: ` : "") + `${a.line1}, ${a.city}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-white/80">No addresses yet</div>
              )}

              <div className="mt-2 text-sm">
                {checkingAddr ? (
                  <span className="text-[#C5CBD8]">Checking plan for this address...</span>
                ) : addressIsActive ? (
                  <div className="space-y-1">
                    <span className="text-[#86EFAC] font-semibold">
                      Active plan
                      {selectedAddressSubscription?.subscriptionType
                        ? `: ${String(selectedAddressSubscription.subscriptionType).charAt(0).toUpperCase()}${String(selectedAddressSubscription.subscriptionType).slice(1)}`
                        : ""}
                    </span>
                    {scheduledPlanName ? (
                      <div className="text-[#FDE68A] font-semibold">
                        Scheduled next plan: {scheduledPlanName}
                        {scheduledChangeDate ? ` on ${scheduledChangeDate}` : ""}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[#86EFAC] font-semibold">No active plan</span>
                )}
              </div>
            </div>

            <button
              onClick={() => (window.location.href = "/account")}
              className="h-[46px] px-4 rounded-xl bg-white text-[#313234] font-extrabold hover:bg-gray-100 transition active:scale-[0.99]"
            >
              Add / Manage
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const HeaderBlock = ({ compact }: { compact?: boolean }) => (
    <div className={`${compact ? "lg:hidden" : "hidden lg:block"} w-full`}>
      <div className={`${compact ? "text-center" : ""} mb-8 sm:mb-12`}>
        <div className={`mb-6 ${compact ? "flex justify-center" : ""}`}>
          <Image src="/images/logo.svg" alt="Profixter" width={80} height={32} />
        </div>

        <div className={`mb-5 ${compact ? "flex justify-center" : ""}`}>
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
            Monthly Membership Plans
          </span>
        </div>

        <h2
          className={[
            compact ? "text-4xl sm:text-5xl" : "text-[56px]",
            "font-extrabold tracking-[-0.04em]",
            "leading-[1.05]",
            "mb-6",
          ].join(" ")}
        >
          <span className="block text-white">One trusted team.</span>
          <span className="block text-[#86EFAC]">Your home, handled.</span>
          <span className="block text-white">Every month of the year.</span>
        </h2>

        <p className="text-[#C5CBD8] text-base sm:text-lg leading-relaxed max-w-[520px] mx-auto">
          A home care membership for Long Island homeowners. The same team, every visit.
          Predictable monthly billing. No estimates, no surprises.
        </p>
        {!compact && (
          <p className="mt-5 text-[#C5CBD8] text-base leading-[22px]">
            Month-to-month, no long-term contracts.
            <br />
            Materials at cost, only when needed, with your approval.
          </p>
        )}
        {/* Price anchoring table */}
        <div className="mt-5 rounded-[16px] border border-white/12 bg-white/[0.05] px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/35 mb-3">
            What homeowners usually pay
          </p>
          <div className="space-y-2 mb-3">
            {[
              { label: "1 handyman visit", cost: "$150–$300" },
              { label: "2 visits", cost: "$300–$600" },
              { label: "3 visits", cost: "$450–$900" },
            ].map(({ label, cost }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-white/50">{label}</span>
                <span className="text-[13px] font-extrabold text-white/70">{cost}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-[#86EFAC] font-semibold leading-snug border-t border-white/10 pt-3">
            With Profixter, you&rsquo;re covered every month — without starting from scratch every time.
          </p>
        </div>

        {/* Cost control */}
        <p className="mt-4 text-[13px] text-white/45 leading-relaxed">
          No surprise invoices. No per-job pricing. Just one predictable monthly cost.
        </p>

        {/* Value stack */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            "Consistent technician",
            "No small-job estimates",
            "Priority scheduling (Plus+)",
            "Ongoing home care",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true" className="flex-shrink-0">
                <path d="M1 4l2.5 2.5L9 1" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] font-semibold text-white/55 leading-tight">{item}</span>
            </div>
          ))}
        </div>

        {/* Expectation control */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" />
            <path d="M12 8v4M12 16h.01" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-[12px] font-semibold text-white/45">
            Not unlimited labor — a structured way to maintain your home over time.
          </span>
        </div>

        <BillingToggle compact={compact} />
      </div>
    </div>
  );

  return (
    <>
      <section
        id="plans"
        className="w-full py-12 sm:py-16 lg:py-24 relative overflow-hidden scroll-mt-[140px]"
        style={{ background: "linear-gradient(160deg, #1C1E20 0%, #242628 60%, #2A2C2E 100%)" }}
      >
        {/* Background depth treatment */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(48,110,236,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(134,239,172,0.04) 0%, transparent 40%)",
          }}
        />

        {/* Annual promo banner */}
        <div className="relative mx-auto max-w-[1240px] px-5 lg:px-5 mb-8">
          <div
            className="rounded-[18px] border border-[#86EFAC]/25 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{ background: "linear-gradient(135deg, rgba(134,239,172,0.08) 0%, rgba(134,239,172,0.04) 100%)" }}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-[#86EFAC]/15 border border-[#86EFAC]/25 flex items-center justify-center flex-shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 12v10H4V12" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 7H2v5h20V7z" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 22V7" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" stroke="#86EFAC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-white font-extrabold text-base sm:text-lg leading-tight">
                  Annual membership — pay for 11 months, get 12
                </p>
                <p className="text-[#C5CBD8] text-sm mt-0.5">Best value for long-term home care members.</p>
              </div>
            </div>
            <div className="flex-shrink-0 rounded-full bg-[#86EFAC]/15 border border-[#86EFAC]/25 px-4 py-1.5">
              <span className="text-[#86EFAC] font-extrabold text-sm">1 month FREE</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[#306EEC]/8 blur-[140px]" />

        {isAuthenticated && user && addresses.length > 0 && <AddressPicker />}

        {isAuthenticated && user && addresses.length === 0 && (
          <div className="mx-auto max-w-[1240px] px-5 lg:px-5 mb-6">
            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.20)]">
              <p className="text-white font-semibold mb-2">No address on file</p>
              <button
                onClick={() => (window.location.href = "/account")}
                className="h-[46px] px-4 rounded-xl bg-white text-[#313234] font-extrabold hover:bg-gray-100 transition active:scale-[0.99]"
              >
                Add Address
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
          <HeaderBlock compact />

          {(actionMessage || actionError) && (
            <div className="mb-6 space-y-3">
              {actionMessage ? (
                <div className="rounded-[16px] border border-[#86EFAC]/40 bg-[#86EFAC]/15 px-4 py-3 text-sm font-semibold text-white">
                  {actionMessage}
                </div>
              ) : null}
              {actionError ? (
                <div className="rounded-[16px] border border-[#FCA5A5]/40 bg-[#7F1D1D]/35 px-4 py-3 text-sm font-semibold text-white">
                  {actionError}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col lg:flex-row items-start gap-8 sm:gap-10 lg:gap-12">
            <div className="hidden lg:flex flex-shrink-0 w-[360px] pt-4 flex-col justify-between min-h-[560px]">
              <HeaderBlock />
            </div>

            <div className="flex-1 relative w-full">
              <div className="lg:hidden">
                <div
                  className="relative overflow-hidden"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {plans.map((plan, idx) => {
                      const monthly = getMonthly(plan);
                      const annual = getAnnual(plan);
                      const showPrice = billing === "annual" ? annual : monthly;
                      const big = formatMoney(showPrice);
                      const action = getActionForPlan(plan.name);

                      return (
                        <div key={idx} className="w-full flex-shrink-0 px-1">
                          <div className="mx-auto max-w-[440px]">
                            <div className={`${plan.name === "Plus" ? "bg-white border-2 border-[#306EEC] shadow-[0_28px_110px_rgba(48,110,236,0.38)] ring-4 ring-[#306EEC]/10" : "bg-[#EEF2FF] border border-[#C5CBD8] shadow-[0_20px_80px_rgba(0,0,0,0.35)]"} rounded-[26px] p-6 sm:p-8 flex flex-col min-h-[690px] sm:min-h-[720px] transform transition duration-300 hover:-translate-y-1`}>
                              {getBadgeLabel(plan.name, plan.badge) && (
                                <div className="mb-3 flex justify-center">
                                  <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-4 py-2 rounded-xl border border-white/70 shadow">
                                    <span className="text-[13px] font-extrabold text-white">
                                      {getBadgeLabel(plan.name, plan.badge)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="text-center mb-4 sm:mb-5">
                                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#313234] leading-tight mb-2">
                                  {getDisplayName(plan.name)}
                                </h3>
                                <p className="text-[#306EEC] font-bold text-sm sm:text-base leading-relaxed mb-2">
                                  {getPositioningLabel(plan.name)}
                                </p>
                                <p className="text-sm sm:text-base text-[#6A6D71] leading-relaxed">
                                  {plan.description}
                                </p>
                              </div>

                              {billing === "annual" && (
                                <div className="mb-3 flex justify-center">
                                  <div className="px-3 py-1 rounded-full bg-[#86EFAC]/20 border border-[#43A047]/25">
                                    <span className="text-[#1F7A2E] font-extrabold text-xs sm:text-sm">
                                      1 month FREE - Pay for 11, get 12
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="mb-5 sm:mb-6 text-center">
                                <div className="flex items-end gap-2 justify-center">
                                  <span className="text-5xl sm:text-6xl font-extrabold text-[#313234] leading-none">
                                    ${big}
                                  </span>
                                  <span className="text-base sm:text-lg text-[#6A6D71] leading-tight pb-1">
                                    {billing === "annual" ? "/year" : "/month"}
                                  </span>
                                </div>

                                {billing === "annual" && (
                                  <div className="mt-2 text-sm sm:text-base text-[#6A6D71]">
                                    Equivalent to{" "}
                                    <span className="font-extrabold text-[#313234]">
                                      ${formatMoney(annual / 12)}
                                    </span>
                                    /mo billed annually
                                  </div>
                                )}

                                {getPriceValueNote(plan.name) && (
                                  <p className="mt-2 text-[12px] font-semibold text-[#306EEC]">
                                    {getPriceValueNote(plan.name)}
                                  </p>
                                )}
                              </div>

                              {plan.subtitle && (
                                <p className="text-[#306EEC] font-bold text-base sm:text-lg text-center mb-3">
                                  {plan.subtitle}
                                </p>
                              )}

                              <div className="mb-4 text-center text-[12px] sm:text-[13px] font-semibold text-[#6A6D71]">
                                {getComparisonLabel(plan.name)}
                              </div>

                              <div className="space-y-2.5 mb-auto">
                                {plan.features.map((feature: string, featureIdx: number) => (
                                  <div key={featureIdx} className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                      <svg width="14" height="11" viewBox="0 0 16 13" fill="none">
                                        <path
                                          d="M1 6.5L5.5 11L15 1.5"
                                          stroke="#43A047"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-base sm:text-lg font-semibold text-[#313234] leading-tight">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {plan.name === "Premium" && (
                                <div className="mt-4 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                  Emergency visits are limited to one per month, for true urgent situations.
                                </div>
                              )}

                              {plan.name === "Elite" && (
                                <div className="mt-4 text-center text-[12px] sm:text-[13px] text-[#6A6D71] leading-relaxed">
                                  Full project day must be scheduled in advance.
                                </div>
                              )}

                              <button
                                onClick={() => handleSubscribe(plan.name)}
                                data-track="plans-cta"
                                disabled={action.disabled || !!actionLoadingPlan || checkingAddr}
                                className={`w-full h-[56px] sm:h-[60px] rounded-2xl text-lg sm:text-xl font-extrabold leading-none transition-all duration-300 mt-6 flex items-center justify-center ${
                                  action.disabled || !!actionLoadingPlan || checkingAddr
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : action.kind === "upgrade" || action.kind === "downgrade"
                                    ? "bg-[#111827] hover:bg-black text-white hover:scale-[1.01]"
                                    : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                                }`}
                              >
                                {actionLoadingPlan === plan.name ? "Updating..." : action.label}
                              </button>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold text-[#313234]">
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Consistent technician
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  No estimates
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Ongoing home care
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Month-to-month
                                </div>
                              </div>

                              <p className="mt-4 text-center text-[12px] sm:text-[13px] italic text-[#475569] leading-relaxed">
                                {getRetentionLine(plan.name)}
                              </p>

                              <div className="mt-3 text-center text-[11px] text-[#94a3b8] leading-relaxed">
                                Each visit covers up to 90 minutes of work · Materials at cost when needed
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 justify-center mt-6 mb-4">
                  {plans.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Go to plan ${idx + 1}`}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        idx === currentSlide ? "w-10 bg-[#306EEC]" : "w-2.5 bg-[#C5CBD8] hover:bg-[#306EEC]/50"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-4 justify-center mt-4">
                  <button
                    onClick={prevSlide}
                    className="bg-white hover:bg-gray-50 text-[#313234] w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg border-2 border-[#E5E7EB] active:scale-95"
                    aria-label="Previous plan"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    className="bg-[#306EEC] hover:bg-[#2558c9] text-white w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-[#306EEC]/30 active:scale-95"
                    aria-label="Next plan"
                  >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed text-center mt-6 px-4">
                  Your home stops being a list of problems.
                  <br />
                  It becomes handled.
                </p>
              </div>

              <div className="hidden lg:block">
                <div className="relative pb-44">
                  <div className="flex items-end gap-6">
                    <div className={`relative w-[420px] min-h-[560px] rounded-[22px] flex-shrink-0 overflow-hidden ${plans[currentSlide].name === "Plus" ? "bg-white border-2 border-[#306EEC] shadow-[0_32px_120px_rgba(48,110,236,0.42)] ring-4 ring-[#306EEC]/12" : "bg-[#EEF2FF] border border-[#C5CBD8] shadow-[0_20px_90px_rgba(0,0,0,0.35)]"}`}>
                      {getBadgeLabel(plans[currentSlide].name, plans[currentSlide].badge) && (
                        <div className="absolute top-4 left-4 z-10">
                          <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-4 py-2 rounded-xl border border-[#EEF2FF]/70 shadow-lg">
                            <span className="text-[14px] font-extrabold text-[#EEF2FF]">
                              {getBadgeLabel(plans[currentSlide].name, plans[currentSlide].badge)}
                            </span>
                          </div>
                        </div>
                      )}

                      {billing === "annual" && (
                        <div className="absolute top-4 right-4 z-10">
                          <div className="bg-[#86EFAC]/20 border border-[#43A047]/25 px-3 py-2 rounded-xl shadow-lg">
                            <div className="text-[#1F7A2E] font-extrabold text-[12px] leading-tight">
                              1 month FREE
                            </div>
                            <div className="text-[#313234] font-bold text-[12px] leading-tight">
                              Pay for 11, get 12
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        className={[
                          "p-8 flex flex-col h-full",
                          getBadgeLabel(plans[currentSlide].name, plans[currentSlide].badge) ? "pt-14" : "",
                        ].join(" ")}
                      >
                        <div className="text-center mb-8">
                          <h3 className="text-3xl font-extrabold text-[#313234] mb-2">
                            {getDisplayName(plans[currentSlide].name)}
                          </h3>
                          <p className="text-[#306EEC] font-bold text-base leading-relaxed mb-2">
                            {getPositioningLabel(plans[currentSlide].name)}
                          </p>
                          <p className="text-base text-[#6A6D71] leading-relaxed">
                            {plans[currentSlide].description}
                          </p>
                        </div>

                        {(() => {
                          const plan = plans[currentSlide];
                          const monthly = getMonthly(plan);
                          const annual = getAnnual(plan);
                          const show = billing === "annual" ? annual : monthly;
                          const action = getActionForPlan(plan.name);

                          return (
                            <>
                              <div className="mb-6">
                                <div className="flex items-end gap-2 justify-center">
                                  <span className="text-[64px] font-extrabold text-[#313234] leading-[0.95]">
                                    ${formatMoney(show)}
                                  </span>
                                  <span className="text-base text-[#6A6D71] pb-2">
                                    {billing === "annual" ? "/year" : "/month"}
                                  </span>
                                </div>

                                {billing === "annual" && (
                                  <div className="mt-2 text-center text-sm text-[#6A6D71]">
                                    Pay for <span className="font-extrabold text-[#313234]">11</span>, get{" "}
                                    <span className="font-extrabold text-[#313234]">12</span> - Equivalent{" "}
                                    <span className="font-extrabold text-[#313234]">
                                      ${formatMoney(annual / 12)}
                                    </span>
                                    /mo billed annually
                                  </div>
                                )}

                                {getPriceValueNote(plan.name) && (
                                  <p className="mt-2 text-center text-[13px] font-semibold text-[#306EEC]">
                                    {getPriceValueNote(plan.name)}
                                  </p>
                                )}
                              </div>

                              {plan.subtitle && (
                                <p className="text-[18px] font-bold text-[#306EEC] mb-4 text-center">
                                  {plan.subtitle}
                                </p>
                              )}

                              <div className="mb-4 text-center text-[12px] font-semibold text-[#6A6D71]">
                                {getComparisonLabel(plan.name)}
                              </div>

                              <div className="space-y-3 mb-auto">
                                {plan.features.map((feature: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-3">
                                    <div className="w-[34px] h-[34px] rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                      <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
                                        <path
                                          d="M1 6.5L5.5 11L15 1.5"
                                          stroke="#43A047"
                                          strokeWidth="2.25"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-[20px] font-semibold text-[#313234] leading-snug">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {plan.name === "Premium" && (
                                <div className="mt-4 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                  Emergency visits are limited to one per month, for true urgent situations.
                                </div>
                              )}

                              {plan.name === "Elite" && (
                                <div className="mt-4 text-center text-[12px] text-[#6A6D71] leading-relaxed">
                                  Full project day must be scheduled in advance.
                                </div>
                              )}

                              <button
                                onClick={() => handleSubscribe(plan.name)}
                                data-track="plans-cta"
                                disabled={action.disabled || !!actionLoadingPlan || checkingAddr}
                                className={`w-full h-[62px] rounded-[14px] text-xl font-extrabold transition-all mt-6 flex items-center justify-center ${
                                  action.disabled || !!actionLoadingPlan || checkingAddr
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : action.kind === "upgrade" || action.kind === "downgrade"
                                    ? "bg-[#111827] hover:bg-black text-white hover:scale-[1.01]"
                                    : "bg-[#306EEC] hover:bg-[#2558c9] text-[#EEF2FF] hover:scale-[1.01]"
                                }`}
                              >
                                {actionLoadingPlan === plan.name ? "Updating..." : action.label}
                              </button>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold text-[#313234]">
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Consistent technician
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  No estimates
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Ongoing home care
                                </div>
                                <div className="rounded-[12px] border border-[#D9E2F6] bg-white/70 px-3 py-2">
                                  Month-to-month
                                </div>
                              </div>

                              <p className="mt-4 text-center text-[13px] italic text-[#475569] leading-relaxed">
                                {getRetentionLine(plan.name)}
                              </p>

                              <div className="mt-3 text-center text-[11px] text-[#94a3b8] leading-relaxed">
                                Each visit covers up to 90 minutes of work · Materials at cost when needed
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex gap-6">
                      {[1, 2].map((offset) => {
                        const index = (currentSlide + offset) % plans.length;
                        const plan = plans[index];
                        const monthly = getMonthly(plan);
                        const annual = getAnnual(plan);
                        const show = billing === "annual" ? annual : monthly;
                        const action = getActionForPlan(plan.name);

                        return (
                          <button
                            key={offset}
                            type="button"
                            onClick={() => setCurrentSlide(index)}
                            className="group relative w-[300px] min-h-[420px] flex-shrink-0 text-left"
                          >
                            <div className={`absolute inset-0 rounded-[16px] p-6 transition-transform duration-300 group-hover:-translate-y-1 ${plan.name === "Plus" ? "bg-white border-2 border-[#306EEC] shadow-[0_18px_80px_rgba(48,110,236,0.30)] ring-2 ring-[#306EEC]/10" : "bg-[#EEF2FF] border border-[#C5CBD8] shadow-[0_12px_60px_rgba(0,0,0,0.25)]"}`} />
                            {getBadgeLabel(plan.name, plan.badge) && (
                              <div className="absolute top-3 left-3 z-20">
                                <div className="bg-gradient-to-b from-[#306EEC] to-[#1B3E86] px-3 py-1.5 rounded-lg border border-white/70 shadow">
                                  <span className="text-[12px] font-extrabold text-white">
                                    {getBadgeLabel(plan.name, plan.badge)}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="relative z-10 p-6 flex flex-col h-full">
                              <div className="text-center mb-6">
                                <h3 className="text-xl font-extrabold text-[#313234] mb-2">{getDisplayName(plan.name)}</h3>
                                <p className="text-[#306EEC] font-bold text-[13px] mb-2">{getPositioningLabel(plan.name)}</p>
                                <p className="text-sm text-[#6A6D71] leading-relaxed">{plan.description}</p>
                              </div>

                              {billing === "annual" && (
                                <div className="mb-3 flex justify-center">
                                  <div className="px-3 py-1 rounded-full bg-[#86EFAC]/20 border border-[#43A047]/25">
                                    <span className="text-[#1F7A2E] font-extrabold text-[11px]">
                                      1 month FREE
                                    </span>
                                  </div>
                                </div>
                              )}

                              <div className="mb-6 text-center min-h-[86px]">
                                <div className="flex items-end gap-2 justify-center">
                                  <span className="text-5xl font-extrabold text-[#313234]">
                                    ${formatMoney(show)}
                                  </span>
                                  <span className="text-sm text-[#6A6D71] pb-1">
                                    {billing === "annual" ? "/year" : "/month"}
                                  </span>
                                </div>

                                <div className="mt-2 text-[12px] text-[#6A6D71]">
                                  {billing === "annual"
                                    ? `${formatMoney(annual / 12)}/mo billed annually`
                                    : "\u00A0"}
                                </div>
                              </div>

                              {plan.subtitle && (
                                <p className="text-[15px] font-bold text-[#306EEC] mb-4 text-center">
                                  {plan.subtitle}
                                </p>
                              )}

                              <div className="mb-4 text-center text-[12px] font-semibold text-[#6A6D71]">
                                {getComparisonLabel(plan.name)}
                              </div>

                              <div className="space-y-2 mb-auto">
                                {plan.features.slice(0, 3).map((feature: string, idx2: number) => (
                                  <div key={idx2} className="flex items-center gap-2">
                                    <div className="w-[26px] h-[26px] rounded-full border-2 border-[#43A047] flex items-center justify-center flex-shrink-0">
                                      <svg width="12" height="10" viewBox="0 0 11 9" fill="none">
                                        <path
                                          d="M1 4.5L4 7.5L10 1.5"
                                          stroke="#43A047"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-[15px] font-semibold text-[#313234] leading-snug">
                                      {feature}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {plan.name === "Basic" && (
                                <div className="mt-4 text-center text-[12px] text-[#306EEC] font-semibold leading-relaxed">
                                  Same trusted team. Every visit.
                                </div>
                              )}

                              <div className="mt-auto pt-4">
                                <div
                                  className={`w-full h-[40px] rounded-[10px] text-[15px] font-extrabold flex items-center justify-center transition ${
                                    action.kind === "upgrade" || action.kind === "downgrade"
                                      ? "bg-[#111827] text-white"
                                    : action.kind === "active"
                                      ? "bg-gray-300 text-gray-600"
                                      : "bg-[#306EEC] text-white"
                                  }`}
                                >
                                  {action.label}
                                </div>
                              </div>
                            </div>

                            <div className="absolute inset-0 bg-[#313234]/15 backdrop-blur-[2px] rounded-[16px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-16 relative z-30 flex items-center justify-center gap-4">
                    <button
                      onClick={prevSlide}
                      className="bg-white hover:bg-gray-100 text-gray-800 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-md border border-gray-200 active:scale-95"
                      aria-label="Previous plan"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <div className="flex gap-2">
                      {plans.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          aria-label={`Go to plan ${idx + 1}`}
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            idx === currentSlide ? "w-10 bg-[#306EEC]" : "w-2.5 bg-[#C5CBD8] hover:bg-[#306EEC]/50"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={nextSlide}
                      className="bg-white hover:bg-gray-100 text-gray-800 w-12 h-12 rounded-xl flex items-center justify-center transition-colors shadow-md border border-gray-200 active:scale-95"
                      aria-label="Next plan"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:hidden mt-4 text-center text-[12px] text-[#C5CBD8]">
                Tip: swipe left/right to see plans
              </div>
            </div>
          </div>
        </div>
      </section>

      {confirmAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={() => {
            if (!actionLoadingPlan) setConfirmAction(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-[0_20px_100px_rgba(0,0,0,0.35)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-2xl">
                {confirmAction.kind === "upgrade" ? "+" : "v"}
              </div>

              <h3 className="text-2xl font-extrabold text-[#313234]">
                {confirmAction.kind === "upgrade"
                  ? `You're upgrading from ${getPlanDisplayLabel(selectedAddressCurrentPlan)} to ${confirmAction.planName}.`
                  : `You're scheduling a downgrade from ${getPlanDisplayLabel(selectedAddressCurrentPlan)} to ${confirmAction.planName}.`}
              </h3>

              <div className="mt-5 rounded-[16px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
                <div className="grid gap-3 text-sm text-[#313234] sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                      Current plan
                    </div>
                    <div className="mt-1 font-semibold">
                      {getPlanDisplayLabel(selectedAddressCurrentPlan)}
                    </div>
                    <div className="text-[#6A6D71]">
                      ${selectedAddressSubscription?.planPrice || getMonthlyPlanPrice(selectedAddressCurrentPlan)}/month
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                      New plan
                    </div>
                    <div className="mt-1 font-semibold">{confirmAction.planName}</div>
                    <div className="text-[#6A6D71]">
                      ${getMonthlyPlanPrice(confirmAction.planType)}/month
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                      Billing cycle
                    </div>
                    <div className="mt-1 font-semibold capitalize">{billing}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A6D71]">
                      Effective timing
                    </div>
                    <div className="mt-1 font-semibold">
                      {confirmAction.kind === "upgrade"
                        ? "Starts immediately"
                        : "Starts on your next billing date"}
                    </div>
                    {confirmAction.kind === "downgrade" && selectedAddressRenewalDate ? (
                      <div className="text-[#6A6D71]">{selectedAddressRenewalDate}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-[#6A6D71]">
                {confirmAction.kind === "upgrade"
                  ? "Stripe may charge a prorated amount today based on the time left in your billing period."
                  : "You'll keep your current plan until the end of this billing period."}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!!actionLoadingPlan}
                  onClick={() => setConfirmAction(null)}
                  className="h-[52px] rounded-[16px] bg-[#306EEC] font-extrabold text-white transition hover:bg-[#2558c9] disabled:opacity-60"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  disabled={!!actionLoadingPlan}
                  onClick={() =>
                    applyPlanChange(
                      confirmAction.planName,
                      confirmAction.planType,
                      confirmAction.kind
                    )
                  }
                  className="h-[52px] rounded-[16px] border border-[#D1D5DB] bg-white font-extrabold text-[#313234] transition hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  {actionLoadingPlan === confirmAction.planName
                    ? confirmAction.kind === "upgrade"
                      ? "Upgrading..."
                      : "Scheduling..."
                    : confirmAction.kind === "upgrade"
                      ? "Confirm Upgrade"
                      : "Schedule downgrade"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
