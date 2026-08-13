"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  getMySubscriptions,
  createBillingPortalSession,
  getSubscriptionActionErrorMessage,
  type ManagedSubscription,
} from "@/lib/subscription-service";
import type { AccountAddress, AccountFormData } from "./types";
import {
  PRIORITY_VISITS_PER_MONTH,
  type PlanKey,
} from "@/app/components/membership/MembershipUpgradePrompt";
import { AskYourFixterLine } from "@/app/components/fixter/YourFixter";

type Booking = {
  _id: string;
  bookingNumber?: string;
  date: string;
  status: string;
  service?: string;
};

const FAQS = [
  {
    q: "How often can I book a visit?",
    a: "Members can request visits as needed. Your plan determines active appointment capacity, materials, Priority Visit benefits, and project benefits. You book online from Your Home.",
  },
  {
    q: "Can I request the same technician every time?",
    a: "Absolutely. The same trusted team is a core promise of the Profixter Membership. They learn your home, your preferences, and your running list.",
  },
  {
    q: "What if I need to reschedule?",
    a: "Call us at 631-599-1363 or reply to your booking confirmation email and we'll find a new slot. We're flexible.",
  },
  {
    q: "What kinds of tasks are covered?",
    a: "Handyman repairs, maintenance, small installations, caulking, mounting, touch-ups, seasonal prep, and more. Each visit covers up to 90 minutes of actual work time.",
  },
  {
    q: "How do I add another property?",
    a: "Go to Profile → Addresses → Add address. Each property can have its own membership and separate booking calendar.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes - month-to-month, no contracts, no cancellation fees. Go to My Plan → Manage Billing. Your service continues until the end of the current billing period.",
  },
  {
    q: "How do I get a copy of my invoice or receipt?",
    a: "Open Manage Billing from My Plan. All invoices, receipts, and payment history are available there. You can also update your payment method from the same place.",
  },
  {
    q: "What if 90 minutes isn't enough for my task list?",
    a: "We'll walk through what can realistically be done during the visit. Larger projects can be quoted separately, or you can book an additional slot next month.",
  },
];

const PRE_VISIT_TIPS = [
  "Have all materials, fixtures, and parts on-site and ready - we focus on labor, not supply runs.",
  "Clear access to work areas before we arrive to make the most of the 90-minute window.",
  "Write your full task list in advance and walk through it with your technician at the start.",
  "Your Profixter pro may arrive up to 30 min early or late - keep your phone nearby.",
  "For plumbing or electrical work, know where your shutoffs and breaker panel are.",
  "Happy with the visit? A Google review and a tip go a long way for your tech.",
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#E6E8EF] last:border-0">
      <button
        type="button"
        className="w-full flex items-center justify-between py-4 text-left gap-4"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[14px] sm:text-[15px] font-semibold text-[#0B1628]">{q}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`flex-shrink-0 transition-transform duration-200 text-[#306EEC] ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <p className="pb-4 text-[13px] sm:text-[14px] leading-relaxed text-[#475569]">{a}</p>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  accent = "#306EEC",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#E6E8EF] bg-white p-4 sm:p-5 flex flex-col gap-2">
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
        style={{ background: accent + "18" }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] mb-0.5">{label}</div>
        <div className="text-[18px] sm:text-[19px] font-extrabold text-[#0B1628] leading-none">{value}</div>
        {sub && <div className="text-[11px] text-[#94A3B8] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function OverviewSection({
  formData,
}: {
  formData: AccountFormData;
  /** Still accepted so the Account shell can keep passing it, but the quick
      actions link straight to Book rather than switching tabs. */
  onSwitchTab?: (tab: "plan" | "bookings" | "personal" | "password") => void;
}) {
  const [subs, setSubs] = useState<ManagedSubscription[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : null;

    const load = async () => {
      try {
        const [subData, bookingRes] = await Promise.all([
          getMySubscriptions().catch(() => ({ subscriptions: [] })),
          headers
            ? axios.get(`${apiBase}/api/bookings`, { headers }).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);
        if (!alive) return;
        setSubs(subData.subscriptions || []);
        const list: Booking[] = Array.isArray(bookingRes.data)
          ? bookingRes.data
          : bookingRes.data?.bookings || [];
        setBookings(list);
      } finally {
        if (alive) setLoadingData(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [apiBase]);

  const activeSub = subs.find(
    (s) => s.status === "active" || s.status === "trialing"
  );

  const planName = activeSub
    ? String(activeSub.subscriptionType || "")
        .charAt(0)
        .toUpperCase()
        .concat(String(activeSub.subscriptionType || "").slice(1))
    : (() => {
        const addr = ((formData.addresses || []) as AccountAddress[]).find(
          (a) => a.hasActiveSubscription && a.plan
        );
        return addr
          ? String(addr.plan).charAt(0).toUpperCase() + String(addr.plan).slice(1)
          : null;
      })();

  /*
   * Reuses the entitlement table Priority already reads from rather than
   * restating the numbers here, so the two can never drift apart.
   */
  const planBenefitLine = (() => {
    if (loadingData || !planName) return undefined;
    const key = planName.toLowerCase() as PlanKey;
    const priority = PRIORITY_VISITS_PER_MONTH[key];
    if (priority) {
      return `Includes ${priority} Priority Visit${priority === 1 ? "" : "s"} a month`;
    }
    return activeSub?.planPrice ? `$${activeSub.planPrice}/mo` : undefined;
  })();

  const nextVisit = bookings
    .filter((b) => {
      const s = b.status.toLowerCase();
      return (s === "pending" || s === "confirmed") && new Date(b.date) >= new Date();
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const nextVisitFormatted = nextVisit
    ? new Date(nextVisit.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  const handleOpenBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const { url } = await createBillingPortalSession({
        addressId: activeSub?.addressId ?? undefined,
      });
      window.location.href = url;
    } catch (err: unknown) {
      alert(getSubscriptionActionErrorMessage(err));
      setBillingLoading(false);
    }
  };

  const firstName = (formData.name || "").split(" ")[0] || "there";

  return (
    <div className="space-y-6">

      {/* ── Welcome card ── */}
      <div
        className="rounded-[14px] overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0B1628 0%, #0F2050 60%, #0B1A3A 100%)" }}
      >
        <div className="relative px-6 py-7 sm:px-6 sm:py-8">
          {/* Background dot texture */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="h-2 w-2 rounded-full bg-[#86EFAC] flex-shrink-0"
                  style={{ boxShadow: "0 0 8px rgba(134,239,172,0.9)" }}
                />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
                  {planName ? `${planName} Plan - Active Member` : "Profixter Member"}
                </span>
              </div>
              <h2 className="text-[23px] sm:text-[26px] font-black text-white leading-tight tracking-[-0.02em]">
                Welcome back, {firstName}!
              </h2>
              <p className="text-[13px] text-white/45 mt-1.5 max-w-[380px]">
                Your home is in good hands. Here&rsquo;s everything you need in one place.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              {/* Book owns booking now, so this goes straight there rather
                  than by way of the membership page. */}
              <a
                href="/book?visit=membership"
                className="inline-flex items-center justify-center h-[44px] px-5 rounded-[12px] bg-[#306EEC] text-white text-[13px] font-extrabold hover:bg-[#2558c9] transition"
                style={{ boxShadow: "0 8px 24px rgba(48,110,236,0.35)" }}
              >
                Book a visit
              </a>
              {activeSub && (
                <button
                  type="button"
                  onClick={handleOpenBillingPortal}
                  disabled={billingLoading}
                  className="inline-flex items-center justify-center h-[44px] px-5 rounded-[12px] border border-white/20 bg-white/[0.07] text-white text-[13px] font-semibold hover:bg-white/[0.14] transition disabled:opacity-50"
                >
                  {billingLoading ? "Opening…" : "Manage Plan"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/*
       * Two tiles, not four.
       *
       * The dashboard used to open with a greeting, a button and four numbers,
       * two of which said nothing a member needs: "Visits Completed: 0" is a
       * record of not having used the thing they pay for, and "Addresses: 1
       * service location(s)" is a row count with a developer's plural. What is
       * left answers the two questions somebody actually opens this page with:
       * when is someone coming, and what am I paying for.
       */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
          label="Next Visit"
          value={loadingData ? "-" : nextVisitFormatted || "None booked"}
          sub={nextVisit?.service || (loadingData ? undefined : "Book one whenever something comes up")}
          accent="#306EEC"
        />
        <StatTile
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
          label="Your Plan"
          value={loadingData ? "-" : planName || "No plan"}
          /*
           * Priority Visits are the reason Premium and Elite cost what they do,
           * and Account never mentioned them, so the benefit was invisible on
           * the page members open most. Simple benefit text, no counter: we do
           * not have reliable remaining-usage data to show.
           */
          sub={planBenefitLine}
          accent="#D4A574"
        />
      </div>

      {/*
       * Roman, on the page a member opens most.
       *
       * "You have a Fixter for your home" is the whole proposition, and Account
       * was the one member surface that never showed a person. Reuses the
       * existing compact row and the centralised Fixter data rather than
       * introducing another card.
       */}
      <AskYourFixterLine />

      {/* ── Quick actions ── */}
      <div className="rounded-[13px] border border-[#E6E8EF] bg-white p-5 sm:p-6">
        <h3 className="text-[15px] font-bold text-[#0B1628] mb-4">Quick Actions</h3>
        {/* Booking is the dark button at the top of this page. A second tile
            for the same destination on the same screen was two labels for one
            action. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            {
              /* Straight to the visit list on Book. It used to open the
                 Account bookings tab, which since the move only holds a
                 signpost pointing at Book, so the member paid an extra tap to
                 be told where their visits are. */
              label: "View Visits",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
                </svg>
              ),
              href: "/book?visit=membership#your-visits",
              color: "#16A34A",
              bg: "#F0FDF4",
              external: false,
            },
            {
              label: "Leave a Tip ❤️",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              ),
              /*
               * The tip page, not the raw Stripe link it used to point at.
               * That link skipped the Fixter chooser, so every tip left from
               * Account arrived with nobody attached to it and had to be
               * assigned by hand in Admin afterwards.
               */
              href: "/tip",
              color: "#D4A574",
              bg: "#FFFBEB",
              external: false,
            },
            {
              label: "Google Review ⭐",
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ),
              href: "https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8",
              color: "#7C3AED",
              bg: "#F5F3FF",
              external: true,
            },
          ].map(({ label, icon, href, color, bg, external }) => {
            const content = (
              <div
                className="rounded-[14px] p-4 flex flex-col items-start gap-3 border border-transparent hover:border-current/10 transition cursor-pointer"
                style={{ background: bg }}
              >
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                  style={{ background: color + "22", color }}
                >
                  {icon}
                </div>
                <span className="text-[13px] font-bold" style={{ color: "#0B1628" }}>
                  {label}
                </span>
              </div>
            );
            return (
              <a
                key={label}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="block"
              >
                {content}
              </a>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Pre-visit tips ── */}
        <div className="rounded-[13px] border border-[#E6E8EF] bg-white p-5 sm:p-6">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-4 mb-1"
            onClick={() => setTipsOpen((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A574" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-[15px] font-bold text-[#0B1628]">Before Your Visit</div>
                <div className="text-[12px] text-[#94A3B8]">How to make the most of 90 minutes</div>
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className={`flex-shrink-0 transition-transform duration-200 text-[#94A3B8] ${tipsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {!tipsOpen && (
            <p className="text-[12px] text-[#94A3B8] mt-2 pl-12">
              Tap to see {PRE_VISIT_TIPS.length} tips for the best visit experience.
            </p>
          )}

          {tipsOpen && (
            <div className="mt-4 space-y-3">
              {PRE_VISIT_TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#D4A574]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-[#D4A574]">{i + 1}</span>
                  </div>
                  <p className="text-[13px] text-[#475569] leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Exterior offers ── */}
        <div className="rounded-[13px] border border-[#E6E8EF] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-[10px] bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A574" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-bold text-[#0B1628]">Exterior Services</div>
              <div className="text-[12px] text-[#94A3B8]">Same licensed Long Island team</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/roofing"
              className="group rounded-[12px] border border-[#D4A574]/22 bg-[#FFFBEB] p-4 block transition hover:border-[#D4A574]/50"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D4A574]/70 mb-1.5">Roofing</div>
              <div className="text-[13px] font-bold text-[#0B1628] leading-snug mb-1">Full Roof Replacements</div>
              <div className="text-[11px] text-[#94A3B8]">50-yr warranty · Financing</div>
              <div className="text-[11px] font-semibold text-[#D4A574] mt-2 group-hover:underline">Get estimate →</div>
            </a>
            <a
              href="/siding"
              className="group rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFF] p-4 block transition hover:border-[#306EEC]/30"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#94A3B8] mb-1.5">Siding</div>
              <div className="text-[13px] font-bold text-[#0B1628] leading-snug mb-1">Siding Installation</div>
              <div className="text-[11px] text-[#94A3B8]">50-yr warranty · Financing</div>
              <div className="text-[11px] font-semibold text-[#306EEC] mt-2 group-hover:underline">Get estimate →</div>
            </a>
          </div>
          <div className="mt-4 rounded-[10px] bg-[#F8FAFF] border border-[#E6E8EF] px-4 py-3">
            <p className="text-[12px] text-[#64748B] leading-relaxed">
              <span className="font-semibold text-[#0B1628]">Member perk:</span> As a Profixter Member, mention your Membership when requesting an exterior estimate. We take care of our regulars.
            </p>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="rounded-[13px] border border-[#E6E8EF] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-[10px] bg-[#EEF5FF] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#306EEC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#0B1628]">Common Questions</div>
            <div className="text-[12px] text-[#94A3B8]">Most answers you&apos;ll ever need</div>
          </div>
        </div>
        <div>
          {FAQS.map(({ q, a }) => (
            <FaqItem key={q} q={q} a={a} />
          ))}
        </div>
        <div className="mt-5 rounded-[12px] bg-[#0B1628] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[13px] font-bold text-white">Still have a question?</div>
            <div className="text-[12px] text-white/45 mt-0.5">Call Taras directly - straight answer in 2 minutes.</div>
          </div>
          <a
            href="tel:+16315991363"
            className="inline-flex items-center gap-2 h-[40px] px-5 rounded-[10px] bg-[#306EEC] text-white text-[13px] font-extrabold hover:bg-[#2558c9] transition flex-shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
            </svg>
            631-599-1363
          </a>
        </div>
      </div>

    </div>
  );
}
