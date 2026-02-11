"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { checkSubscription } from "@/lib/booking-service";

type FixterUser = {
  defaultAddressId?: string | null;
};

type SubscriptionResponse = {
  hasSubscription: boolean;
  freeFirstVisitAvailable?: boolean;
  plan?: string;
};

const TIP_URL = "https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00";
const PHONE = "631-599-1363";

function prettyPlan(p?: string) {
  const x = String(p || "").toLowerCase();
  if (x === "basic") return "Basic";
  if (x === "plus") return "Plus";
  if (x === "premium") return "Premium";
  if (x === "elite") return "Elite";
  if (x === "free") return "Free Visit";
  return "";
}

export default function ServiceInfoSection() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as FixterUser;

  const mountedRef = useRef(true);

  const [state, setState] = useState<"guest" | "free" | "sub" | "none">("guest");
  const [plan, setPlan] = useState<string>("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!isAuthenticated) {
        setState("guest");
        setPlan("");
        return;
      }

      const addressId = typedUser?.defaultAddressId;
      if (!addressId) {
        // logged in but no address → treat as no access yet
        setState("none");
        setPlan("");
        return;
      }

      try {
        const sub = (await checkSubscription(addressId)) as SubscriptionResponse;

        const hasSub = !!sub?.hasSubscription;
        const freeOk = !!sub?.freeFirstVisitAvailable;

        if (hasSub) {
          setState("sub");
          setPlan(String(sub?.plan || ""));
          return;
        }

        if (freeOk) {
          setState("free");
          setPlan("free");
          return;
        }

        setState("none");
        setPlan("");
      } catch {
        setState("none");
        setPlan("");
      }
    };

    run();
  }, [isAuthenticated, typedUser?.defaultAddressId]);

  const cta = useMemo(() => {
    if (state === "guest") {
      return {
        title: "Get your home handled — the simple way.",
        sub: "Create an account, claim your first visit, then book your date and time in the calendar below.",
        primaryLabel: "Create account",
        primaryHref: "/signup?redirect=/",
        secondaryLabel: "See what’s included",
        secondaryHref: "/included",
        badge: "Local • Long Island • 5-star service",
      };
    }

    if (state === "free") {
      return {
        title: "You have 1 remaining 100% free visit.",
        sub: "Pick your date and time below — we’ll take care of that one task for you.",
        primaryLabel: "Book my free visit",
        primaryHref: "#pick-day",
        secondaryLabel: "See what’s included",
        secondaryHref: "/included",
        badge: "Free visit available",
      };
    }

    if (state === "sub") {
      const name = prettyPlan(plan);
      return {
        title: `Your plan is active${name ? ` — ${name}` : ""}. Want to see us again?`,
        sub: "Book your next visit in the calendar below. One task per visit, done the right way.",
        primaryLabel: "Book next visit",
        primaryHref: "#pick-day",
        secondaryLabel: "What’s included",
        secondaryHref: "/included",
        badge: "Member access",
      };
    }

    // none
    return {
      title: "You have 0 free visits remaining.",
      sub: "Get month-to-month coverage and book visits anytime using the calendar below.",
      primaryLabel: "Get coverage",
      primaryHref: "#plans",
      secondaryLabel: "See what’s included",
      secondaryHref: "/included",
      badge: "No free visits left",
    };
  }, [state, plan]);

  return (
    <section
      id="how-booking-works"
      className="relative w-full bg-[#eaedfa] pt-12 sm:pt-14 lg:pt-16 pb-6 sm:pb-8"
      aria-label="How booking works"
    >
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[22px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* top stripe */}
          <div className="px-5 sm:px-7 py-4 bg-[#313234] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-[12px] uppercase tracking-wider text-white/70">How it works</div>
            <div className="inline-flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold">
                {cta.badge}
              </span>
              <a
                href={`tel:${PHONE}`}
                className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold hover:bg-white/15 transition"
              >
                Emergency / Projects: {PHONE}
              </a>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
              {/* LEFT: main message */}
              <div className="lg:col-span-7">
                <h2 className="text-[26px] sm:text-[32px] lg:text-[36px] font-extrabold leading-tight text-[#313234]">
                  {cta.title}
                </h2>

                <p className="mt-3 text-[#6A6D71] text-[14px] sm:text-[15px] leading-relaxed max-w-[680px]">
                  {cta.sub}
                </p>

                {/* Key rules — short and clear */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-bold">✅ One task per visit</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      We focus on completing <span className="font-semibold text-[#313234]">one job properly</span>.
                      If it’s extremely small and time allows, we may do a second — but it’s not guaranteed.
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-bold">⏱️ Up to 90 minutes max</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      A visit can be <span className="font-semibold text-[#313234]">shorter</span> if the task is done.
                      We do <span className="font-semibold text-[#313234]">not</span> stay “just to hit 90.”
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-bold">📍 Big service area</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      Our technicians cover a wide area. If we’re running late, we’ll still show up and do it right.
                      Thank you for being patient and respectful.
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-bold">💵 Month-to-month</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      No contracts. Cancel anytime. Use your plan to book visits directly in the calendar below.
                    </div>
                  </div>
                </div>

                {/* Referral + Tip */}
                <div className="mt-5 rounded-[18px] border border-[#C5CBD8] bg-white p-4 sm:p-5">
                  <div className="text-[#313234] font-extrabold">Bonus perks</div>
                  <div className="mt-2 text-[#6A6D71] text-[13px] leading-relaxed">
                    • Invite a friend or family member and get <span className="font-semibold text-[#313234]">$50 off</span>{" "}
                    your next payment. <br />
                    • Want to tip your Fixter? Tips go <span className="font-semibold text-[#313234]">100%</span> to the
                    person who served you.
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <a
                      href={TIP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-[46px] px-5 rounded-[14px] bg-[#313234] hover:bg-black transition text-white font-bold text-[14px] inline-flex items-center justify-center"
                    >
                      Leave a tip
                    </a>

                    <a
                      href={`tel:${PHONE}`}
                      className="h-[46px] px-5 rounded-[14px] border border-[#C5CBD8] bg-[#F6F7FB] hover:bg-white transition text-[#313234] font-bold text-[14px] inline-flex items-center justify-center"
                    >
                      Call for emergency / projects
                    </a>
                  </div>
                </div>
              </div>

              {/* RIGHT: actions + “calendar below” */}
              <div className="lg:col-span-5">
                <div className="rounded-[18px] border border-[#C5CBD8] bg-white p-5 sm:p-6">
                  <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-bold">
                    Next step
                  </div>

                  <div className="mt-2 text-[#313234] text-[18px] sm:text-[20px] font-extrabold leading-tight">
                    Book using the calendar below
                  </div>

                  <div className="mt-2 text-[#6A6D71] text-[13px] leading-relaxed">
                    Pick a date. Choose a time. Tell us the task. Upload photos. We’ll confirm and handle it.
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    {/* Primary */}
                    {cta.primaryHref.startsWith("#") ? (
                      <a
                        href={cta.primaryHref}
                        className="h-[52px] rounded-[16px] bg-[#306EEC] hover:bg-[#2558c9] transition text-white font-extrabold text-[15px] inline-flex items-center justify-center"
                      >
                        {cta.primaryLabel}
                      </a>
                    ) : (
                      <Link
                        href={cta.primaryHref}
                        className="h-[52px] rounded-[16px] bg-[#306EEC] hover:bg-[#2558c9] transition text-white font-extrabold text-[15px] inline-flex items-center justify-center"
                      >
                        {cta.primaryLabel}
                      </Link>
                    )}

                    {/* Secondary */}
                    <Link
                      href={cta.secondaryHref}
                      className="h-[52px] rounded-[16px] border border-[#C5CBD8] bg-[#EEF2FF] hover:bg-white transition text-[#313234] font-extrabold text-[15px] inline-flex items-center justify-center"
                    >
                      {cta.secondaryLabel}
                    </Link>
                  </div>

                  <div className="mt-5 text-[12px] text-[#6A6D71]">
                    Looking for what we do? See the full list on{" "}
                    <Link href="/included" className="text-[#306EEC] font-bold hover:underline">
                      What’s included
                    </Link>
                    .
                  </div>
                </div>

                {/* extra note */}
                <div className="mt-4 rounded-[18px] border border-[#E6E8EF] bg-[#F6F7FB] p-5">
                  <div className="text-[#313234] font-extrabold">Quick note</div>
                  <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                    We’re friendly and professional — and we appreciate the same back.
                    If we’re delayed from a previous job, we’ll still arrive and take care of you.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* bottom hint */}
          <div className="px-5 sm:px-7 py-4 border-t border-[#c5cbd8] bg-white/60">
            <div className="text-[13px] text-[#6A6D71]">
              ↓ Next: scroll a little and use the calendar to book your visit.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
