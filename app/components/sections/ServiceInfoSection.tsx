"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { checkSubscription, getNextBooking } from "@/lib/booking-service";

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
  freeFirstVisitAvailable?: boolean; // legacy
  plan?: string;
  hasAnyBookings?: boolean; // backend-added
};

const TIP_URL = "https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00";
const PHONE = "631-599-1363";
const GOOGLE_REVIEW_URL = "https://maps.app.goo.gl/LM5fagx5GidLZfPB6";

// ✅ Your YouTube video (embedded)
const YOUTUBE_ID = "HQoAkLNGI9c";

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

      // Primary: /api/bookings/next
      try {
        const nb = (await getNextBooking(addressId)) as NextBookingResponse;
        const hasSub = !!nb?.hasSubscription;

        safeSet(() => {
          setPlan(String(nb?.plan || ""));
          setHasAnyBookings(typeof nb?.hasAnyBookings === "boolean" ? nb.hasAnyBookings : null);
          setState(hasSub ? "sub" : "none");
        });
        return;
      } catch {
        // fallback
      }

      // Fallback: subscription check only
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
    const isNewLoggedIn = isAuthenticated && state === "none" && hasAnyBookings === false;
    const planName = prettyPlan(plan);

    if (state === "guest") {
      return {
        title: "Trusted by Long Island homeowners",
        sub: "Most homeowners don’t need a contractor — they need a reliable pro who shows up, fixes it fast, and doesn’t overcharge. That’s Profixter.",
        primaryLabel: "View plans",
        primaryHref: "#plans",
        secondaryLabel: "Book a visit",
        secondaryHref: "#pick-day",
        badge: "Local • On-demand • Professional",
        hint: "Pick a plan below — then book instantly in the calendar.",
      };
    }

    if (state === "sub") {
      return {
        title: `Your membership is active${planName ? ` — ${planName}` : ""}`,
        sub: "Book your next visit in the calendar below. Upload photos so we bring the right tools and move fast.",
        primaryLabel: "Book next visit",
        primaryHref: "#pick-day",
        secondaryLabel: "What’s included",
        secondaryHref: "/included",
        badge: planName ? `${planName} member` : "Member access",
        hint: "Pick a day → pick a time → describe the task → upload photos.",
      };
    }

    return {
      title: isNewLoggedIn ? "Welcome — pick a plan to start today" : "Pick a plan to book a visit",
      sub: "No free first visit. Subscription is required to book — choose a plan and schedule immediately.",
      primaryLabel: "View plans",
      primaryHref: "#plans",
      secondaryLabel: "What’s included",
      secondaryHref: "/included",
      badge: "Subscription required",
      hint: "Choose a plan below, then book from the calendar.",
    };
  }, [state, plan, isAuthenticated, hasAnyBookings]);

  const showLeaveReviewBtn = state === "sub";

  return (
    <section
      id="how-booking-works"
      className="relative w-full bg-[#eaedfa] pt-10 sm:pt-12 lg:pt-14 pb-6 sm:pb-8"
      aria-label="Service info"
    >
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[22px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* Top stripe */}
          <div className="px-5 sm:px-7 py-4 bg-[#313234] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-[12px] uppercase tracking-wider text-white/70">
              Trusted by Long Island homeowners
            </div>

            <div className="inline-flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold">
                {cta.badge}
              </span>

              <a
                href={`tel:${PHONE}`}
                className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[12px] font-semibold hover:bg-white/15 transition"
              >
                Call: {PHONE}
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* LEFT */}
              <div className="lg:col-span-7">
                <h2 className="text-[26px] sm:text-[32px] lg:text-[36px] font-extrabold leading-tight text-[#313234]">
                  {cta.title}
                </h2>

                <p className="mt-3 text-[#6A6D71] text-[14px] sm:text-[15px] leading-relaxed max-w-[680px]">
                  {cta.sub}
                </p>

                {/* WHY WE’RE THE BEST (tight + high converting) */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-extrabold">⚡ Fast, scheduled, predictable</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      You pick the <span className="font-semibold text-[#313234]">day & time</span> yourself. No waiting for callbacks,
                      no “we’ll let you know.”
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-extrabold">💰 No surprise invoices</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      Subscription pricing means <span className="font-semibold text-[#313234]">clear expectations</span> and no
                      “contractor math” after the job.
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-extrabold">🛠️ Real pros, real standards</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      We show up prepared, communicate clearly, and fix things the right way — not the cheap way.
                    </div>
                  </div>

                  <div className="rounded-[18px] bg-white border border-[#E6E8EF] p-4">
                    <div className="text-[#313234] font-extrabold">📷 Photos = faster service</div>
                    <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                      Upload photos when booking so we bring the right tools and plan ahead — less back-and-forth.
                    </div>
                  </div>
                </div>

                {/* ✅ Video (YouTube embed, perfect on mobile) */}
                <div className="mt-5">
                  <div className="rounded-[18px] border border-[#c5cbd8] bg-white overflow-hidden shadow-sm">
                    <div className="px-4 sm:px-5 py-3 bg-[#F6F7FB] border-b border-[#E6E8EF]">
                      <div className="text-[#313234] font-extrabold text-[14px] sm:text-[15px]">
                        Watch: why Profixter is different (2 minutes)
                      </div>
                      <div className="text-[#6A6D71] text-[12px] mt-0.5">
                        Quick explanation from the founder — this will make the decision easy.
                      </div>
                    </div>

                    <div className="relative aspect-video bg-black">
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${YOUTUBE_ID}?rel=0&modestbranding=1`}
                        title="Profixter Introduction"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>

                {/* HOW BOOKING WORKS (simple + clear) */}
                <div className="mt-5 rounded-[18px] border border-[#C5CBD8] bg-white p-4 sm:p-5">
                  <div className="text-[#313234] font-extrabold">How booking works</div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-4">
                      <div className="text-[#313234] font-extrabold text-[13px]">1) Pick a plan</div>
                      <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                        Choose coverage that matches your home needs.
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-4">
                      <div className="text-[#313234] font-extrabold text-[13px]">2) Book instantly</div>
                      <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                        Pick your day & time right in the calendar.
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-4">
                      <div className="text-[#313234] font-extrabold text-[13px]">3) Describe + upload photos</div>
                      <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                        Helps us prepare so the visit is efficient.
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-4">
                      <div className="text-[#313234] font-extrabold text-[13px]">4) We arrive & handle it</div>
                      <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                        One job per visit, done right (up to 90 minutes).
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bonus perks (tight) */}
                <div className="mt-5 rounded-[18px] border border-[#C5CBD8] bg-white p-4 sm:p-5">
                  <div className="text-[#313234] font-extrabold">Bonus perks</div>
                  <div className="mt-2 text-[#6A6D71] text-[13px] leading-relaxed">
                    • Refer a homeowner → get <span className="font-semibold text-[#313234]">$50 off</span> your next payment. <br />
                    • Tips go <span className="font-semibold text-[#313234]">100%</span> to your Fixter.
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <a
                      href={TIP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-[46px] px-5 rounded-[14px] bg-[#313234] hover:bg-black transition text-white font-extrabold text-[14px] inline-flex items-center justify-center"
                    >
                      Leave a tip
                    </a>

                    <a
                      href={`tel:${PHONE}`}
                      className="h-[46px] px-5 rounded-[14px] border border-[#C5CBD8] bg-[#F6F7FB] hover:bg-white transition text-[#313234] font-extrabold text-[14px] inline-flex items-center justify-center"
                    >
                      Call {PHONE}
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
                    {state === "sub" ? "Book your next visit" : "Start today"}
                  </div>

                  <div className="mt-2 text-[#6A6D71] text-[13px] leading-relaxed">
                    {cta.hint}
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
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

                    {cta.secondaryHref.startsWith("#") ? (
                      <a
                        href={cta.secondaryHref}
                        className="h-[52px] rounded-[16px] border border-[#C5CBD8] bg-[#EEF2FF] hover:bg-white transition text-[#313234] font-extrabold text-[15px] inline-flex items-center justify-center"
                      >
                        {cta.secondaryLabel}
                      </a>
                    ) : (
                      <Link
                        href={cta.secondaryHref}
                        className="h-[52px] rounded-[16px] border border-[#C5CBD8] bg-[#EEF2FF] hover:bg-white transition text-[#313234] font-extrabold text-[15px] inline-flex items-center justify-center"
                      >
                        {cta.secondaryLabel}
                      </Link>
                    )}
                  </div>

                  <div className="mt-5 text-[12px] text-[#6A6D71]">
                    See details on{" "}
                    <Link href="/included" className="text-[#306EEC] font-extrabold hover:underline">
                      What’s included
                    </Link>
                    .
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-[#E6E8EF] bg-[#F6F7FB] p-5">
                  <div className="text-[#313234] font-extrabold">Fast & respectful service</div>
                  <div className="mt-1 text-[#6A6D71] text-[13px] leading-relaxed">
                    If a prior job runs long, we’ll still arrive and do it right. We’re not a marketplace — we’re a real local
                    service with standards.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom hint */}
          <div className="px-5 sm:px-7 py-4 border-t border-[#c5cbd8] bg-white/60">
            <div className="text-[13px] text-[#6A6D71]">↓ Next: scroll down to plans & the booking calendar.</div>
          </div>
        </div>
      </div>
    </section>
  );
}