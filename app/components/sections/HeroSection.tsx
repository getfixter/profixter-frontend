"use client";

import Image from "next/image";
import { useAuth } from "@/lib/useAuth";
import { checkSubscription } from "@/lib/booking-service";
import { useEffect, useMemo, useRef, useState } from "react";
import NeedItQuizModal from "@/app/components/NeedItQuizModal";
import GoogleReviewsLiveMini from "@/app/components/GoogleReviewsLiveMini";

type FixterUser = {
  defaultAddressId?: string | null;
};

type SubscriptionResponse = {
  hasSubscription: boolean;
  freeFirstVisitAvailable?: boolean;
};

export default function HeroSection() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const [needItOpen, setNeedItOpen] = useState(false);
  const [subState, setSubState] = useState<"unknown" | "free" | "sub" | "none">("unknown");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!isAuthenticated) {
        setSubState("none");
        return;
      }

      const addressId = typedUser?.defaultAddressId;
      if (!addressId) {
        setSubState("none");
        return;
      }

      try {
        const subscription = (await checkSubscription(addressId)) as SubscriptionResponse;

        if (subscription?.hasSubscription) setSubState("sub");
        else if (subscription?.freeFirstVisitAvailable) setSubState("free");
        else setSubState("none");
      } catch {
        setSubState("none");
      }
    };

    run();
  }, [isAuthenticated, typedUser?.defaultAddressId]);

  const goToPlans = () => {
    const el = document.getElementById("plans");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "/#plans";
  };

  const goToBooking = () => {
    const booking = document.getElementById("pick-day");
    if (booking) booking.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "/#pick-day";
  };

  const handleMainCTA = () => {
    if (!isAuthenticated) {
      window.location.href = "/signin?redirect=/";
      return;
    }

    if (subState === "sub" || subState === "free") goToBooking();
    else goToPlans();
  };

  const heroCopy = useMemo(() => {
    if (!isAuthenticated) {
      return {
        badge: "Serving Long Island • Suffolk & Nassau",
        titleA: "Your home.",
        titleB: "Handled.",
        subtitle: "Finally, someone you can trust to take care of the little things — without stress.",
        cta: "Get Your First Fix Free",
      };
    }

    if (subState === "free") {
      return {
        badge: "Welcome — your first visit is on us",
        titleA: "Your first fix",
        titleB: "is free.",
        subtitle: "Relax. We’ve got your home handled from here.",
        cta: "Book My Free Visit",
      };
    }

    if (subState === "sub") {
      return {
        badge: "Member access active",
        titleA: "You’re",
        titleB: "covered.",
        subtitle: "Book your next visit in seconds. We’ll handle the rest.",
        cta: "Book My Next Visit",
      };
    }

    return {
      badge: "Serving Long Island • Suffolk & Nassau",
      titleA: "Let’s take care",
      titleB: "of it.",
      subtitle: "The easy way to keep your home feeling right — all year.",
      cta: "See Plans",
    };
  }, [isAuthenticated, subState]);

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
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />
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
              <div className="text-[44px] sm:text-[64px] lg:text-[76px]">{heroCopy.titleA}</div>
              <div className="text-[44px] sm:text-[64px] lg:text-[76px] text-[#5E8BFF]">{heroCopy.titleB}</div>
            </h1>

            {/* Sub */}
            <p className="mt-6 max-w-[560px] text-[18px] sm:text-[20px] text-white/85">
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

              <button
                type="button"
                onClick={() => setNeedItOpen(true)}
                className="h-[56px] px-8 rounded-[16px] border border-white/30 text-white text-lg font-semibold hover:bg-white/10 transition"
              >
                Take 20-second quiz
              </button>
            </div>

            {/* ✅ Live Google reviews */}
            <GoogleReviewsLiveMini />
          </div>
        </div>
      </section>

      <NeedItQuizModal
        open={needItOpen}
        onClose={() => setNeedItOpen(false)}
        onGoToPlans={() => {
          const el = document.getElementById("plans");
          if (el) el.scrollIntoView({ behavior: "smooth" });
          else window.location.href = "/#plans";
        }}
        ctaLabel="Get Started"
      />
    </>
  );
}
