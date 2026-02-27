"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  promoCode?: string;            // e.g. "SPRING"
  promoEndsLabel?: string;       // e.g. "Apr 3"
  ctaAnchorId?: string;          // e.g. "plans"
  delayMs?: number;              // default 900

  // ✅ not annoying rules
  showAgainAfterHoursNew?: number;        // default 24 (new visitors)
  showAgainAfterDaysExisting?: number;    // default 14 (existing customers)
  homepageOnly?: boolean;                // default true
};

export default function SpecialDealPopup({
  promoCode = "SPRING",
  promoEndsLabel = "Apr 3",
  ctaAnchorId = "plans",
  delayMs = 900,
  showAgainAfterHoursNew = 24,
  showAgainAfterDaysExisting = 14,
  homepageOnly = true,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const storageKey = useMemo(() => "profixter_special_deal_popup_v2", []);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const isHomepage = pathname === "/" || pathname === "";
  const isExistingCustomer = () => {
    // Best-effort: if they’re logged in, treat as existing (less frequent popup)
    try {
      const t = localStorage.getItem("token");
      return !!t;
    } catch {
      return false;
    }
  };

  const shouldSuppress = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;

      const data = JSON.parse(raw) as { closedAt?: number; kind?: "new" | "existing" };
      if (!data?.closedAt) return false;

      const elapsedMs = Date.now() - data.closedAt;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const elapsedDays = elapsedHours / 24;

      const kind = data.kind || "new";

      if (kind === "existing") return elapsedDays < showAgainAfterDaysExisting;
      return elapsedHours < showAgainAfterHoursNew;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (homepageOnly && !isHomepage) return;

    if (shouldSuppress()) return;

    const t = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, homepageOnly, isHomepage]);

  useEffect(() => {
    if (!open) return;

    // lock scroll behind modal
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus close button for accessibility
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          closedAt: Date.now(),
          kind: isExistingCustomer() ? "existing" : "new",
        })
      );
    } catch {}
  };

  const scrollToPlans = () => {
    close();
    setTimeout(() => {
      const el = document.getElementById(ctaAnchorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.location.href = `/#${ctaAnchorId}`;
    }, 60);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      alert(`Promo code: ${promoCode}`);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-3 sm:px-5"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        background:
          "radial-gradient(900px 600px at 50% 25%, rgba(48,110,236,0.18), rgba(0,0,0,0.55))",
      }}
    >
      {/* ✅ Mobile: bottom sheet | Desktop: centered modal */}
      <div
        className={[
          "w-full max-w-[560px] overflow-hidden border border-[#c5cbd8] bg-white shadow-2xl",
          "rounded-[18px] sm:rounded-[22px]",
          // bottom-sheet feel on mobile
          "mb-[max(12px,env(safe-area-inset-bottom))] sm:mb-0",
        ].join(" ")}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-[#EEF2FF] border-b border-[#c5cbd8]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-[#c5cbd8]">
                <span className="text-[11px] sm:text-[12px] font-extrabold text-[#306EEC] uppercase tracking-wide">
                  Special Deal
                </span>
                <span className="text-[11px] sm:text-[12px] font-bold text-[#313234]">
                  Limited{promoEndsLabel ? ` • until ${promoEndsLabel}` : ""}
                </span>
              </div>

              <h3 className="mt-2 text-[18px] sm:text-[26px] leading-snug font-extrabold text-[#313234]">
                Save <span className="text-[#306EEC]">20%</span> today{" "}
                <span className="hidden sm:inline">+ get</span>{" "}
                <span className="text-[#306EEC]">$50</span> referral credit
              </h3>

              <p className="mt-1 text-[12px] sm:text-[14px] text-[#6A6D71]">
                Quick checkout wins. No spam — you won’t see this often.
              </p>
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={close}
              className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] border border-[#c5cbd8] bg-white grid place-items-center hover:bg-[#f7f9ff] transition active:scale-95"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body (scrollable on small screens if needed) */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 max-h-[68vh] sm:max-h-none overflow-auto">
          {/* Promo code block (compact) */}
          <div className="rounded-[16px] border border-[#c5cbd8] bg-white p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] bg-[#EEF2FF] grid place-items-center text-[16px] sm:text-[18px]">
                🎟️
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[#313234] text-[14px] sm:text-[16px]">
                  20% OFF for new customers
                </div>
                <div className="text-[12px] sm:text-[13px] text-[#6A6D71] mt-1">
                  Enter code at checkout{promoEndsLabel ? ` (until ${promoEndsLabel})` : ""}.
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] px-3 py-2.5 font-extrabold text-[#313234] tracking-widest text-center text-[14px] sm:text-[16px]">
                    {promoCode}
                  </div>

                  <button
                    type="button"
                    onClick={copyCode}
                    className="h-[42px] sm:h-[48px] px-3.5 sm:px-4 rounded-[14px] bg-[#306EEC] text-white font-extrabold text-[13px] sm:text-[14px] hover:bg-[#2558c9] transition active:scale-[0.99]"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Two compact perks (side-by-side on desktop, stacked on mobile) */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-[#c5cbd8] bg-white p-3.5 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] bg-[#EEF2FF] grid place-items-center text-[16px] sm:text-[18px]">
                  💵
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-[#313234] text-[14px] sm:text-[16px]">
                    $50 referral credit
                  </div>
                  <div className="text-[12px] sm:text-[13px] text-[#6A6D71] mt-1">
                    Friend becomes a customer → you get <span className="font-semibold text-[#313234]">$50 off</span>.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#c5cbd8] bg-white p-3.5 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] bg-[#EEF2FF] grid place-items-center text-[16px] sm:text-[18px]">
                  🏆
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-[#313234] text-[14px] sm:text-[16px]">
                    Annual bonus: 1 month FREE
                  </div>
                  <div className="text-[12px] sm:text-[13px] text-[#6A6D71] mt-1">
                    Pay for <span className="font-semibold text-[#313234]">11</span> months, get{" "}
                    <span className="font-semibold text-[#313234]">12</span>.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={scrollToPlans}
              className="h-[50px] sm:h-[54px] w-full rounded-[16px] bg-[#306EEC] text-white text-[15px] sm:text-[16px] font-extrabold hover:bg-[#2558c9] transition active:scale-[0.99]"
            >
              View Plans & Claim Deal
            </button>

            <button
              type="button"
              onClick={close}
              className="h-[50px] sm:h-[54px] w-full rounded-[16px] border border-[#c5cbd8] bg-white text-[#313234] text-[15px] sm:text-[16px] font-extrabold hover:bg-[#f7f9ff] transition active:scale-[0.99]"
            >
              Not now
            </button>
          </div>

          <div className="mt-2 text-[11px] sm:text-[12px] text-[#6A6D71]">
            *Promo intended for new customers. Limited-time offer.
          </div>
        </div>
      </div>
    </div>
  );
}