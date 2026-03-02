"use client";

import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { getNextBooking } from "@/lib/booking-service";
import { useEffect, useMemo, useRef, useState } from "react";
import NeedItQuizModal from "@/app/components/NeedItQuizModal";
import GoogleReviewsLiveMini from "@/app/components/GoogleReviewsLiveMini";

// This hero section has been redesigned for clarity and conversion.
// It clearly communicates what the service is (unlimited handyman visits),
// highlights the local service area (Long Island), and uses a single primary call‑to‑action.
// The copy adapts based on the user's authentication and subscription status.

const GOOGLE_REVIEW_WRITE_URL =
  "https://search.google.com/local/writereview?placeid=ChIJjZtSCtd1XogR0kdxepnQJu8";

type FixterUser = {
  defaultAddressId?: string | null;
};

type NextBookingResponse = {
  hasSubscription?: boolean;
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

export default function HeroSection() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const [needItOpen, setNeedItOpen] = useState(false);

  // unknown = still loading (logged‑in only), sub = active subscription, none = no subscription (or no address)
  const [subState, setSubState] = useState<"unknown" | "sub" | "none">("unknown");
  const [plan, setPlan] = useState<string>("");

  const mountedRef = useRef(true);

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
          setSubState("none");
          setPlan("");
        });
        return;
      }

      const addressId = typedUser?.defaultAddressId;
      if (!addressId) {
        safeSet(() => {
          setSubState("none");
          setPlan("");
        });
        return;
      }

      safeSet(() => setSubState("unknown"));

      try {
        const nb = (await getNextBooking(addressId)) as NextBookingResponse;
        const hasSub = !!nb?.hasSubscription;

        safeSet(() => {
          setPlan(String(nb?.plan || ""));
          setSubState(hasSub ? "sub" : "none");
        });
      } catch {
        safeSet(() => {
          setSubState("none");
          setPlan("");
        });
      }
    };

    run();
  }, [isAuthenticated, typedUser?.defaultAddressId]);

  // Offset scroll so anchor never hides under sticky header/promo
  const scrollToHash = (hash: string) => {
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    const HEADER_OFFSET = window.innerWidth >= 1024 ? 180 : 140;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", hash);
  };

  const goToPlans = () => {
    const el = document.getElementById("plans");
    if (el) scrollToHash("#plans");
    else window.location.href = "/#plans";
  };

  const goToBooking = () => {
    const booking = document.getElementById("pick-day");
    if (booking) scrollToHash("#pick-day");
    else window.location.href = "/#pick-day";
  };

  const handleMainCTA = () => {
    if (!isAuthenticated) {
      window.location.href = "/signup?redirect=/";
      return;
    }
    if (subState === "sub") goToBooking();
    else goToPlans();
  };

  // Build dynamic hero copy depending on authentication and subscription state.
  const heroCopy = useMemo(() => {
    // Logged‑in but still loading status
    if (isAuthenticated && subState === "unknown") {
      return {
        badge: "Checking your membership…",
        titleA: "Unlimited Handyman Service",
        titleB: "for Long Island Homes",
        subtitle: "Loading your account…",
        cta: "Continue",
        showQuiz: false,
        showReview: false,
      };
    }

    // Not registered / not logged in
    if (!isAuthenticated) {
      return {
        badge: "Serving Long Island • Suffolk & Nassau",
        titleA: "Unlimited Handyman Service",
        titleB: "for Long Island Homes",
        subtitle:
          "Get unlimited home repairs and maintenance — 2+ visits per month. No contracts. Cancel anytime.",
        cta: "Start First Visit",
        showQuiz: false,
        showReview: false,
      };
    }

    // Has subscription
    if (subState === "sub") {
      const name = prettyPlan(plan);
      return {
        badge: name ? `Membership active • ${name}` : "Membership active",
        titleA: "Unlimited Handyman Service",
        titleB: "for Long Island Homes",
        subtitle:
          "Book your next visit in seconds. Enjoy unlimited visits every month.",
        cta: "Book My Next Visit",
        showQuiz: false,
        showReview: true,
      };
    }

    // Logged in, but no plan
    return {
      badge: "Special Offer for You",
      titleA: "Unlimited Handyman Service",
      titleB: "for Long Island Homes",
      subtitle:
        "Join today and enjoy 30% off your first month. Book as many visits as you need — 2+ per month included.",
      cta: "See Plans",
      showQuiz: false,
      showReview: false,
    };
  }, [isAuthenticated, subState, plan]);

  return (
    <>
      <section className="relative w-full overflow-hidden bg-[#0f1220]">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-bg.png"
            alt="Comfortable home interior"
            fill
            className="object-cover opacity-80"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-6">
          <div className="min-h-[720px] sm:min-h-[780px] lg:min-h-[860px] pt-28 pb-16 flex flex-col justify-center">
            {/* Badge */}
            <div className="mb-6">
              <span className="inline-block px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 text-sm text-white/90">
                {heroCopy.badge}
              </span>
            </div>

            {/* Headline */}
            <h1 className="max-w-[980px] text-white font-extrabold uppercase leading-[0.95] tracking-[-0.04em]">
              <div className="text-[40px] sm:text-[60px] lg:text-[78px]">{heroCopy.titleA}</div>
              <div className="text-[40px] sm:text-[60px] lg:text-[78px] text-[#5E8BFF]">
                {heroCopy.titleB}
              </div>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-[620px] text-[18px] sm:text-[20px] text-white/85">
              {heroCopy.subtitle}
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={handleMainCTA}
                className="h-[56px] px-8 rounded-[16px] bg-[#5E8BFF] text-white text-lg font-bold hover:bg-[#4a76e0] transition active:scale-[0.99]"
              >
                {heroCopy.cta}
              </button>

              {/* Quiz button: hidden by default to reduce decision fatigue */}
              {heroCopy.showQuiz && (
                <button
                  type="button"
                  onClick={() => setNeedItOpen(true)}
                  className="h-[56px] px-8 rounded-[16px] border border-[#5E8BFF] text-white text-lg font-semibold hover:bg-[#5E8BFF]/15 transition"
                >
                  Take 20‑second quiz
                </button>
              )}

              {/* Leave review button (only for active members) */}
              {heroCopy.showReview && isAuthenticated && subState === "sub" && (
                <a
                  href={GOOGLE_REVIEW_WRITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[56px] px-8 rounded-[16px] border border-[#5E8BFF] text-white text-lg font-semibold hover:bg-[#5E8BFF]/15 transition flex items-center justify-center"
                >
                  Leave a review
                </a>
              )}
            </div>

            {/* Live Google reviews */}
            <GoogleReviewsLiveMini />
          </div>
        </div>
      </section>

      {/* Quiz Modal */}
      <NeedItQuizModal
        open={needItOpen}
        onClose={() => setNeedItOpen(false)}
        onGoToPlans={() => {
          const el = document.getElementById("plans");
          if (el) scrollToHash("#plans");
          else window.location.href = "/#plans";
        }}
        ctaLabel="Get Started"
      />
    </>
  );
}