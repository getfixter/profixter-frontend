"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { checkSubscription, getNextBooking } from "@/lib/booking-service";
import Button from "@/app/components/ui/Button";
import { trackEvent } from "@/lib/analytics";

type FixterUser = {
  defaultAddressId?: string | null;
};

type SubscriptionResponse = {
  hasSubscription: boolean;
  subscription?: {
    plan: string;
    status: string;
    expiresAt: string;
  };
  message?: string;
};

type NextBookingResponse = {
  hasSubscription?: boolean;
  freeFirstVisitAvailable?: boolean;
  plan?: string;
  hasAnyBookings?: boolean;
};

function prettyPlan(p?: string) {
  const x = String(p || "").toLowerCase();
  if (x === "basic") return "Basic";
  if (x === "plus") return "Plus";
  if (x === "premium") return "Premium";
  if (x === "elite") return "Elite";
  return "";
}

export default function ServiceInfoSection() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const mountedRef = useRef(true);
  const [state, setState] = useState<"guest" | "sub" | "none">("guest");
  const [plan, setPlan] = useState<string>("");
  const [hasAnyBookings, setHasAnyBookings] = useState<boolean | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const safeSet = (fn: () => void) => {
      if (!mountedRef.current) return;
      fn();
    };

    const run = async () => {
      if (!isAuthenticated) {
        safeSet(() => {
          setState("guest");
          setPlan("");
          setHasAnyBookings(null);
        });
        return;
      }

      const addressId = typedUser?.defaultAddressId;
      if (!addressId) {
        safeSet(() => {
          setState("none");
          setPlan("");
          setHasAnyBookings(null);
        });
        return;
      }

      try {
        const nb = (await getNextBooking(addressId)) as NextBookingResponse;
        const hasSub = !!nb?.hasSubscription;

        safeSet(() => {
          setPlan(String(nb?.plan || ""));
          setHasAnyBookings(typeof nb?.hasAnyBookings === "boolean" ? nb.hasAnyBookings : null);
          setState(hasSub ? "sub" : "none");
        });
        return;
      } catch {}

      try {
        const sub = (await checkSubscription(addressId)) as SubscriptionResponse;
        const hasSub = !!sub?.hasSubscription;

        safeSet(() => {
          setPlan(String(sub?.subscription?.plan || ""));
          setHasAnyBookings(null);
          setState(hasSub ? "sub" : "none");
        });
      } catch {
        safeSet(() => {
          setState("none");
          setPlan("");
          setHasAnyBookings(null);
        });
      }
    };

    run();
  }, [isAuthenticated, typedUser?.defaultAddressId]);

  const hero = useMemo(() => {
    const planName = prettyPlan(plan);
    const isNewLoggedIn = isAuthenticated && state === "none" && hasAnyBookings === false;

    if (state === "sub") {
      return {
        eyebrow: planName ? `${planName} Member` : "Active Member",
        title: "Personal Handyman Membership for Homeowners",
        sub:
          "Your membership is active. Book your next visit online with clear pricing, predictable service, and no surprise invoices.",
        badge: planName ? `${planName} active` : "Membership active",
      };
    }

    if (state === "none") {
      return {
        eyebrow: isNewLoggedIn ? "Home Ready" : "Membership Required",
        title: "Personal Handyman Membership for Homeowners",
        sub:
          "Choose a clear monthly plan, book online, and stop paying unpredictable per-visit rates. No estimates, no surprises.",
        badge: "Easy online booking",
      };
    }

    return {
      eyebrow: "Long Island Homeowners",
      title: "Personal Handyman Membership for Homeowners",
      sub:
        "Choose a clear monthly plan, book online, and stop paying unpredictable per-visit rates. No estimates, no surprises.",
      badge: "More affordable than per visit",
    };
  }, [state, plan, isAuthenticated, hasAnyBookings]);

  const scrollToHash = (hash: string) => {
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    const HEADER_OFFSET = window.innerWidth >= 1024 ? 160 : 120;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", hash);
  };

  return (
    <section
      id="how-booking-works"
      className="relative w-full bg-[#eaedfa] py-8 sm:py-10 lg:py-12"
      aria-label="Service info"
    >
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="p-5 sm:p-6 lg:p-8">
            <div className="max-w-[860px]">
              <div className="inline-flex flex-wrap items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-[#313234] text-white text-[12px] font-bold uppercase tracking-wider">
                  {hero.eyebrow}
                </span>
                <span className="px-3 py-1 rounded-full bg-white border border-[#C5CBD8] text-[12px] font-semibold text-[#313234]">
                  {hero.badge}
                </span>
              </div>

              <h1 className="text-[30px] sm:text-[34px] lg:text-[43px] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#313234] max-w-[820px]">
                {hero.title}
              </h1>

              <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed text-[#6A6D71] sm:text-[17px]">
                {hero.sub}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                {["$149", "$249", "$349", "$499"].map((price) => (
                  <div
                    key={price}
                    className="px-4 py-2 rounded-[14px] bg-white border border-[#C5CBD8] text-[#313234] text-sm sm:text-base font-extrabold"
                  >
                    {price}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-[420px]">
                <Button
                  type="button"
                  onClick={() => {
                    trackEvent("view_plans", { placement: "hero" });
                    scrollToHash("#plans");
                  }}
                  data-track="hero-cta"
                  size="md"
                  className="h-[46px] rounded-[16px] flex-1"
                >
                  View Plans
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    trackEvent("start_booking", { placement: "hero" });
                    scrollToHash("#pick-day");
                  }}
                  data-track="hero-cta"
                  variant="secondary"
                  size="md"
                  className="h-[46px] rounded-[16px] flex-1"
                >
                  Book Visit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
