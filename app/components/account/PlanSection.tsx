"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";

type PlanKey = "basic" | "plus" | "premium" | "elite";
type MaybePlanKey = PlanKey | "none";

type UserAddress = {
  _id: string;
  label?: string;
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type MeResponse = {
  subscription?: string; // legacy
  defaultAddressId?: string;
  addresses?: UserAddress[];
};

type SubscriptionItem = {
  _id: string;
  subscriptionType?: string; // preferred
  plan?: string; // fallback
  status?: string;
  addressId?: string | null;
  currentPeriodEnd?: string;
  nextPaymentDate?: string;
  expiresAt?: string;

  // optional server snapshots (if you have them)
  addressSnapshot?: {
    label?: string;
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

export function PlanSection() {
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [plans, setPlans] = useState<
    {
      subId: string;
      plan: PlanKey;
      status: string;
      addressId: string | null;
      addressLabel: string; // "Home: 123 Main St, ..."
    }[]
  >([]);

  const PLAN_PRICES: Record<PlanKey, number> = {
    basic: 149,
    plus: 249,
    premium: 349,
    elite: 499,
  };

  const PLAN_INCLUDES: Record<PlanKey, string[]> = {
    basic: [
      "Book online in minutes",
      "Visit length: up to 90 minutes",
      "Professional handyman service",
      "Materials/fixtures are extra if needed",
      "Friendly support (call/text/email)",
    ],
    plus: [
      "Everything in Basic",
      "Priority scheduling when available",
      "Perfect for regular home maintenance",
      "Up to 90 minutes per visit",
      "Best value for most homes",
    ],
    premium: [
      "Everything in Plus",
      "Higher booking availability (based on capacity)",
      "Ideal for busy households & rentals",
      "Up to 90 minutes per visit",
      "Priority handling for repeat members",
    ],
    elite: [
      "Everything in Premium",
      "Top priority scheduling when available",
      "Best for ongoing projects & heavy usage",
      "Up to 90 minutes per visit",
      "VIP support experience",
    ],
  };

  const WHY_FIXTER: string[] = [
    "$0 labor — you only pay for materials if needed",
    "No contractor chasing — book online any time",
    "Real local Long Island handyman (Suffolk & Nassau)",
    "Transparent pricing + professional service",
    "Most issues handled in one 90-minute visit",
  ];

  const Card = ({
    children,
    className = "",
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`w-full bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6 ${className}`}
      style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.10)" }}
    >
      {children}
    </div>
  );

  const normalizePlan = (p: any): MaybePlanKey => {
    const x = String(p || "").toLowerCase();
    if (x === "basic" || x === "plus" || x === "premium" || x === "elite") return x;
    return "none";
  };

  const formatAddress = (a?: {
    label?: string;
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  }) => {
    if (!a) return "Address: -";
    const line = [a.line1, [a.city, a.state].filter(Boolean).join(" "), a.zip]
      .filter(Boolean)
      .join(", ");
    const prefix = a.label ? `${a.label}: ` : "";
    return `Address: ${prefix}${line || "-"}`;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMe(null);
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, { headers }),
      axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/my`, { headers }),
    ])
      .then(([meRes, subsRes]) => {
        const meData: MeResponse = meRes.data || {};
        setMe(meData);

        const subs: SubscriptionItem[] = subsRes.data?.subscriptions || [];

        const activeSubs = subs.filter((s) =>
          ["active", "trialing"].includes(String(s.status || "").toLowerCase())
        );

        // Map addressId -> address display from /auth/me addresses
        const addrMap = new Map<string, UserAddress>();
        (meData.addresses || []).forEach((a) => {
          if (a?._id) addrMap.set(String(a._id), a);
        });

        // ✅ Build list of plans by subscription
        const derived = activeSubs
          .map((s) => {
            const plan = normalizePlan(s.subscriptionType || s.plan);
            if (plan === "none") return null;

            const addrId = s.addressId ? String(s.addressId) : null;

            // Prefer server snapshot, else map from user addresses
            let addressLabel = "Address: -";
            if (s.addressSnapshot) {
              addressLabel = formatAddress(s.addressSnapshot);
            } else if (addrId && addrMap.has(addrId)) {
              addressLabel = formatAddress(addrMap.get(addrId));
            } else if (!addrId && meData.defaultAddressId && addrMap.has(String(meData.defaultAddressId))) {
              // legacy addrless sub — show default address
              addressLabel = formatAddress(addrMap.get(String(meData.defaultAddressId)));
            }

            return {
              subId: String(s._id),
              plan,
              status: String(s.status || "active"),
              addressId: addrId,
              addressLabel,
            };
          })
          .filter(Boolean) as {
          subId: string;
          plan: PlanKey;
          status: string;
          addressId: string | null;
          addressLabel: string;
        }[];

        // ✅ Legacy fallback (no address-based subs)
        if (!derived.length) {
          const legacyPlan = normalizePlan(meData.subscription);
          if (legacyPlan !== "none") {
            const addr =
              meData.defaultAddressId && addrMap.has(String(meData.defaultAddressId))
                ? formatAddress(addrMap.get(String(meData.defaultAddressId)))
                : "Address: (default)";
            setPlans([
              {
                subId: "legacy",
                plan: legacyPlan,
                status: "active",
                addressId: meData.defaultAddressId ? String(meData.defaultAddressId) : null,
                addressLabel: addr,
              },
            ]);
          } else {
            setPlans([]);
          }
        } else {
          // Sort: elite -> premium -> plus -> basic
          const rank: Record<PlanKey, number> = { basic: 1, plus: 2, premium: 3, elite: 4 };
          derived.sort((a, b) => rank[b.plan] - rank[a.plan]);
          setPlans(derived);
        }

        setLoading(false);
      })
      .catch(() => {
        setMe(null);
        setPlans([]);
        setLoading(false);
      });
  }, []);

  const hasAnyPlan = plans.length > 0;

  // If user has no plan, recommend Plus price
  const recommendedPrice = 249;

  return (
    <>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-6 sm:mb-10">
          My plan{plans.length > 1 ? "s" : ""}
        </h2>

        {loading ? (
          <Card className="max-w-[560px]">
            <div className="text-[#6A6D71] text-sm sm:text-base">Loading your plan…</div>
          </Card>
        ) : !hasAnyPlan ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="max-w-[560px]">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-sm text-[#6A6D71] mb-1">No active subscription</div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">
                    Recommended: <span className="text-[#306EEC]">Plus</span>
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-semibold text-[#313234]">
                      ${recommendedPrice}
                    </span>
                    <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
                  </div>
                </div>

                <div className="shrink-0 px-3 py-2 rounded-full bg-white/70 border border-[#C5CBD8]">
                  <span className="text-xs font-semibold text-[#313234]">Best value</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-[#313234] mb-2">
                  What you get with Plus
                </div>
                <ul className="space-y-2 text-sm text-[#6A6D71]">
                  {PLAN_INCLUDES.plus.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-[#306EEC] font-bold">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/#plans"
                className="mt-6 block text-center w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors"
              >
                Start Plus Plan
              </Link>

              <div className="mt-3 text-xs text-[#6A6D71] opacity-80">
                Cancel anytime • Visit length up to 90 minutes
              </div>
            </Card>

            <Card className="max-w-[560px]">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234] mb-3">
                Why Mr. Fixter works
              </h3>

              <ul className="space-y-2 text-sm text-[#6A6D71]">
                {WHY_FIXTER.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-[#306EEC] font-bold">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-[14px] border border-[#C5CBD8] bg-white/60 p-4">
                <div className="text-sm font-semibold text-[#313234] mb-1">Need help choosing?</div>
                <div className="text-sm text-[#6A6D71]">
                  Call us:{" "}
                  <a href="tel:631-599-1363" className="text-[#306EEC] font-semibold">
                    631-599-1363
                  </a>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ✅ Render ONE card per active subscription/address */}
            <div className="space-y-6">
              {plans.map((p) => {
                const price = PLAN_PRICES[p.plan];
                return (
                  <Card key={p.subId} className="max-w-[560px]">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-[#313234] capitalize">
                        {p.plan} plan
                      </h3>

                      <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-xl font-semibold text-[#313234]">
                          ${price}
                        </span>
                        <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm text-[#6A6D71] mb-4">
                      <span className="font-semibold text-[#313234]">Under:</span>{" "}
                      {p.addressLabel.replace(/^Address:\s*/i, "")}
                    </div>

                    <div className="text-sm font-semibold text-[#313234] mb-2">
                      Included with this plan
                    </div>

                    <ul className="space-y-2 text-sm text-[#6A6D71]">
                      {PLAN_INCLUDES[p.plan].map((x) => (
                        <li key={`${p.subId}-${x}`} className="flex gap-2">
                          <span className="text-[#306EEC] font-bold">•</span>
                          <span>{x}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Link
                        href="/#plans"
                        className="block text-center w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-lg font-semibold hover:bg-[#2557C7] transition-colors"
                      >
                        Upgrade Plan
                      </Link>

                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full py-3 sm:py-4 rounded-[14px] border border-[#C5CBD8] bg-white/60 text-[#313234] font-semibold hover:bg-white transition"
                        type="button"
                      >
                        Cancel plan
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-[#6A6D71] opacity-80">
                      Tip: have materials/fixtures ready (faucets, lights, shelves, hardware).
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Right column helper */}
            <Card className="max-w-[560px]">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234] mb-3">Next steps</h3>

              <ul className="space-y-2 text-sm text-[#6A6D71]">
                <li className="flex gap-2">
                  <span className="text-[#306EEC] font-bold">•</span>
                  <span>Book your next visit on the home page.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#306EEC] font-bold">•</span>
                  <span>Take clear photos so we can prepare before arrival.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#306EEC] font-bold">•</span>
                  <span>Emergency? Call us anytime: 631-599-1363</span>
                </li>
              </ul>

              <div className="mt-6 rounded-[14px] border border-[#C5CBD8] bg-white/60 p-4">
                <div className="text-sm font-semibold text-[#313234] mb-1">Serving Long Island</div>
                <div className="text-sm text-[#6A6D71]">Suffolk & Nassau • Real local handyman</div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-white rounded-[14px] p-6 w-[90%] max-w-[380px] text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-[#313234] mb-4">Cancel your plan</h3>

            <p className="text-[#6A6D71] text-base mb-6">
              To cancel your subscription, please call:
              <br />
              <a href="tel:631-599-1363" className="text-[#306EEC] font-semibold text-lg">
                631-599-1363
              </a>
            </p>

            <button
              onClick={() => setShowCancelModal(false)}
              className="w-full py-3 bg-[#306EEC] text-white rounded-[14px] font-semibold text-base hover:bg-[#2557C7]"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
