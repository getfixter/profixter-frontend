"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { checkSubscription, getNextBooking } from "@/lib/booking-service";

type FixterUser = {
  defaultAddressId?: string | null;
};

// NOTE: checkSubscription() actually returns { subscription: { plan } }
// so we model it correctly here.
type SubscriptionResponse = {
  hasSubscription: boolean;
  subscription?: {
    plan: string;
    status: string;
    expiresAt: string;
  };
  message?: string;
};

// from /api/bookings/next?addressId=...
type NextBookingResponse = {
  hasSubscription?: boolean;
  freeFirstVisitAvailable?: boolean;
  plan?: string;

  // ✅ backend will return this (we added it)
  hasAnyBookings?: boolean;
};

const TIP_URL = "https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00";
const PHONE = "631-599-1363";

// 🔁 Put your real Google “Write a review” link here (the one that opens review box)
const GOOGLE_REVIEW_URL = "https://maps.app.goo.gl/LM5fagx5GidLZfPB6";

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
  const [hasAnyBookings, setHasAnyBookings] = useState<boolean | null>(null); // null=unknown

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

      // ✅ Primary: use /api/bookings/next (it knows free-visit + booking truth)
      try {
        const nb = (await getNextBooking(addressId)) as NextBookingResponse;

        const hasSub = !!nb?.hasSubscription;
        const freeOk = !!nb?.freeFirstVisitAvailable;

        safeSet(() => {
          setPlan(String(nb?.plan || ""));
          setHasAnyBookings(typeof nb?.hasAnyBookings === "boolean" ? nb.hasAnyBookings : null);

          if (hasSub) setState("sub");
          else if (freeOk) setState("free");
          else setState("none");
        });

        return;
      } catch {
        // fall through to subscription-only fallback
      }

      // ✅ Fallback: subscription check only (no booking history info)
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

  const cta = useMemo(() => {
    // ✅ If logged in + backend says never booked anything → treat as 1 free visit
    const shouldShowNewUserFree = isAuthenticated && state === "none" && hasAnyBookings === false;

    if (state === "guest") {
      return {
        title: "Get your home handled — the simple way.",
        sub: "Create an account, then book your date and time in the calendar below.",
        primaryLabel: "Create account",
        primaryHref: "/signup?redirect=/",
        secondaryLabel: "See what’s included",
        secondaryHref: "/included",
        badge: "Local • Long Island • 5-star service",
        rightHint: "New here? Your first visit can be free.",
      };
    }

    if (state === "free" || shouldShowNewUserFree) {
      return {
        title: "You have 1 free visit remaining.",
        sub: "Pick your date and time below — we’ll handle one task for you, professionally and fast.",
        primaryLabel: "Book my free visit",
        primaryHref: "#pick-day",
        secondaryLabel: "See what’s included",
        secondaryHref: "/included",
        badge: "Free visit available",
        rightHint: "Scroll down to the calendar to book.",
      };
    }

    if (state === "sub") {
      const name = prettyPlan(plan);
      return {
        title: `Your plan is active${name ? ` — ${name}` : ""}.`,
        sub: "Book your next visit in the calendar below — we’ll take it from there.",
        primaryLabel: "Book next visit",
        primaryHref: "#pick-day",
        secondaryLabel: "What’s included",
        secondaryHref: "/included",
        badge: name ? `${name} member` : "Member access",
        rightHint: "Want another fix? Book your next slot below.",
      };
    }

    // none (used free already)
    return {
      title: "You have 0 free visits remaining.",
      sub: "Get coverage to book visits anytime using the calendar below.",
      primaryLabel: "Get coverage",
      primaryHref: "#plans",
      secondaryLabel: "See what’s included",
      secondaryHref: "/included",
      badge: "No free visits left",
      rightHint: "Choose a plan, then book in the calendar.",
    };
  }, [state, plan, isAuthenticated, hasAnyBookings]);

  const showMemberCard = state === "sub";
  const showLeaveReviewBtn = state === "sub"; // ✅ “registered + subscribed”

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

            <div className="inline-flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold">
                {cta.badge}
              </span>

              <a
                href={`tel:${PHONE}`}
                className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold hover:bg-white/15 transition"
              >
                Emergency / Projects: {PHONE}
              </a>

              {showLeaveReviewBtn ? (
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-[#306EEC] hover:bg-[#2558c9] transition text-[12px] font-extrabold"
                >
                  Leave a review
                </a>
              ) : null}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
              {/* LEFT */}
              <div className="lg:col-span-7">
                <h2 className="text-[26px] sm:text-[32px] lg:text-[36px] font-extrabold leading-tight text-[#313234]">
                  {cta.title}
                </h2>

                <p className="mt-3 text-[#6A6D71] text-[14px] sm:text-[15px] leading-relaxed max-w-[680px]">
                  {cta.sub}
                </p>

                {/* Key rules */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-bold">✅ One task per visit</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      We focus on completing{" "}
                      <span className="font-semibold text-[#313234]">one job properly</span>. If it’s extremely small and time allows,
                      we may do a second — but it’s not guaranteed.
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-bold">⏱️ Up to 90 minutes max</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      A visit can be{" "}
                      <span className="font-semibold text-[#313234]">shorter</span> if the task is done.
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

                  {/* ✅ This card changes for subscribers */}
                  {!showMemberCard ? (
                    <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                      <div className="text-[#313234] font-bold">✨ Simple access</div>
                      <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                        Coverage gives you access to book visits when you need help — straight from the calendar below.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                      <div className="text-[#313234] font-bold">⭐ Member priority</div>
                      <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                        Your membership is active — book your next visit and we’ll confirm it fast.
                      </div>
                    </div>
                  )}
                </div>

                {/* Referral + Tip */}
                <div className="mt-5 rounded-[18px] border border-[#C5CBD8] bg-white p-4 sm:p-5">
                  <div className="text-[#313234] font-extrabold">Bonus perks</div>
                  <div className="mt-2 text-[#6A6D71] text-[13px] leading-relaxed">
                    • Invite a friend or family member and get{" "}
                    <span className="font-semibold text-[#313234]">$50 off</span> your next payment. <br />
                    • Want to tip your Fixter? Tips go{" "}
                    <span className="font-semibold text-[#313234]">100%</span> to the person who served you.
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

              {/* RIGHT */}
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

                  <div className="mt-4 text-[12px] text-[#6A6D71] font-semibold">
                    {cta.rightHint}
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
