"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  promoCode?: string;
  promoEndsLabel?: string; // display only
  ctaAnchorId?: string; // e.g. "plans"
  delayMs?: number; // default 1200

  // How often it can re-appear:
  // - New visitors: default 24h
  // - Existing customers: default 14 days
  showAgainAfterHoursNew?: number;
  showAgainAfterDaysExisting?: number;

  // "Don't show again" duration (days)
  snoozeDays?: number;

  // Optional: only show if URL contains UTM (good for promo traffic)
  // requireUtm?: boolean;
};

type Stored = {
  closedAt?: number;
  snoozedUntil?: number;
};

export default function SpecialDealPopup({
  promoCode = "SPRING",
  promoEndsLabel = "Apr 3",
  ctaAnchorId = "plans",
  delayMs = 1200,
  showAgainAfterHoursNew = 24,
  showAgainAfterDaysExisting = 14,
  snoozeDays = 60,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const storageKey = useMemo(() => "profixter_special_deal_popup_v2", []);

  // ✅ Only homepage
  const isHome = pathname === "/" || pathname === "";

  // Gentle heuristic: if they have auth token → likely existing customer
  const isExistingCustomer = () => {
    try {
      if (typeof window === "undefined") return false;
      const t =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("profixter_token");
      return !!t;
    } catch {
      return false;
    }
  };

  const readStored = (): Stored => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      return JSON.parse(raw) as Stored;
    } catch {
      return {};
    }
  };

  const writeStored = (data: Stored) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isHome) return;
    if (typeof window === "undefined") return;

    const stored = readStored();

    // If user snoozed, don’t show
    if (stored?.snoozedUntil && Date.now() < stored.snoozedUntil) return;

    // Cooldown depends on customer type
    const existing = isExistingCustomer();
    const cooldownMs = existing
      ? showAgainAfterDaysExisting * 24 * 60 * 60 * 1000
      : showAgainAfterHoursNew * 60 * 60 * 1000;

    if (stored?.closedAt && Date.now() - stored.closedAt < cooldownMs) return;

    const t = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome, delayMs, showAgainAfterHoursNew, showAgainAfterDaysExisting, storageKey]);

  useEffect(() => {
    // Lock background scroll while open
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    writeStored({ ...readStored(), closedAt: Date.now() });
  };

  const snooze = () => {
    setOpen(false);
    const until = Date.now() + snoozeDays * 24 * 60 * 60 * 1000;
    writeStored({ ...readStored(), snoozedUntil: until, closedAt: Date.now() });
  };

  const scrollToPlans = () => {
    close();
    setTimeout(() => {
      const el = document.getElementById(ctaAnchorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.location.href = `/#${ctaAnchorId}`;
    }, 50);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 1300);
    } catch {
      alert(`Promo code: ${promoCode}`);
    }
  };

  if (!isHome) return null;
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        background:
          "radial-gradient(1200px 800px at 50% 30%, rgba(48,110,236,0.18), rgba(0,0,0,0.55))",
      }}
    >
      <div className="w-full max-w-[560px] rounded-[22px] border border-[#c5cbd8] bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#EEF2FF] border-b border-[#c5cbd8]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#c5cbd8]">
                  <span className="text-[12px] font-extrabold text-[#306EEC] uppercase tracking-wide">
                    Special Deal
                  </span>
                  <span className="text-[12px] font-bold text-[#313234]">
                    Limited{promoEndsLabel ? ` • until ${promoEndsLabel}` : ""}
                  </span>
                </div>

                <div className="text-[12px] font-semibold text-[#6A6D71]">
                  ✅ Trusted by <span className="text-[#313234] font-extrabold">Long Island homeowners</span>
                </div>
              </div>

              <h3 className="mt-3 text-[22px] sm:text-[26px] leading-tight font-extrabold text-[#313234]">
                Save <span className="text-[#306EEC]">20%</span> today + get{" "}
                <span className="text-[#306EEC]">$50</span> for referrals
              </h3>

              <p className="mt-2 text-[13px] sm:text-[14px] text-[#6A6D71]">
                Quick checkout discount + referral credit + annual bonus.
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              className="shrink-0 w-10 h-10 rounded-[14px] border border-[#c5cbd8] bg-white grid place-items-center hover:bg-[#f7f9ff] transition active:scale-95"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          <div className="grid gap-3">
            {/* Promo */}
            <div className="rounded-[16px] border border-[#c5cbd8] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-[#EEF2FF] grid place-items-center text-[18px]">
                  🎟️
                </div>

                <div className="flex-1">
                  <div className="font-extrabold text-[#313234]">20% OFF promo code</div>
                  <div className="text-[13px] text-[#6A6D71] mt-1">
                    Enter this code during checkout{promoEndsLabel ? ` (until ${promoEndsLabel})` : ""}.
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] px-4 py-3 font-extrabold text-[#313234] tracking-widest text-center">
                      {promoCode}
                    </div>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="h-[48px] px-4 rounded-[14px] bg-[#306EEC] text-white font-extrabold hover:bg-[#2558c9] transition active:scale-[0.99]"
                    >
                      {hasCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral */}
            <div className="rounded-[16px] border border-[#c5cbd8] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-[#EEF2FF] grid place-items-center text-[18px]">
                  💵
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-[#313234]">$50 referral credit</div>
                  <div className="text-[13px] text-[#6A6D71] mt-1">
                    Refer anyone who becomes a customer → you get{" "}
                    <span className="font-extrabold text-[#313234]">$50 off</span> your next month, just inform us by 631-599-1363 or my@profixter.com.
                  </div>
                </div>
              </div>
            </div>

            {/* Annual */}
            <div className="rounded-[16px] border border-[#c5cbd8] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-[#EEF2FF] grid place-items-center text-[18px]">
                  🏆
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-[#313234]">Annual plan bonus</div>
                  <div className="text-[13px] text-[#6A6D71] mt-1">
                    Buy annual today → <span className="font-extrabold text-[#313234]">pay for 11 months, get 12</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={scrollToPlans}
              className="h-[54px] w-full rounded-[16px] bg-[#306EEC] text-white text-[16px] font-extrabold hover:bg-[#2558c9] transition active:scale-[0.99]"
            >
              View Plans & Claim Deal
            </button>

            <button
              type="button"
              onClick={close}
              className="h-[54px] w-full rounded-[16px] border border-[#c5cbd8] bg-white text-[#313234] text-[16px] font-extrabold hover:bg-[#f7f9ff] transition active:scale-[0.99]"
            >
              Not now
            </button>
          </div>

          {/* Not annoying controls */}
          <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[#6A6D71]">
            <span>*Limited-time promo. Terms may apply.</span>
            <button
              type="button"
              onClick={snooze}
              className="font-semibold text-[#313234] hover:underline"
              title={`Hide for ${snoozeDays} days`}
            >
              Don’t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}