"use client";

import { useState } from "react";
import type { PromotionPopup } from "@/lib/promotion-popup";

export default function PromotionPopupCard({
  popup,
  onClose,
  onAction,
  preview = false,
}: {
  popup: PromotionPopup;
  onClose?: () => void;
  onAction?: () => void;
  preview?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!popup.promoCode) return;
    await navigator.clipboard.writeText(popup.promoCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const actionProps = preview
    ? { href: undefined, onClick: (event: React.MouseEvent) => event.preventDefault() }
    : { href: popup.ctaUrl, onClick: onAction };

  return (
    <div className="relative w-full max-w-[460px] overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
      <div className="h-1.5 bg-gradient-to-r from-[#306EEC] via-[#5B8EF3] to-[#D4A574]" />
      <div className="p-5 sm:p-6">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close promotion"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        {popup.eyebrow ? (
          <div className="pr-10 text-[10px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
            {popup.eyebrow}
          </div>
        ) : null}
        <h2 id="promotion-popup-title" className="mt-2 pr-8 text-[23px] font-black leading-[1.12] tracking-[-0.025em] text-[#0B1628] sm:text-[26px]">
          {popup.title || "Your promotion title"}
        </h2>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">
          {popup.message || "Add a short, helpful message for visitors."}
        </p>

        {popup.promoCode ? (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-[8px] border border-dashed border-[#9DBAF7] bg-[#F4F7FF] px-4 py-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                Promo code
              </div>
              <div className="mt-0.5 font-mono text-[17px] font-black tracking-[0.08em] text-[#1D4ED8]">
                {popup.promoCode}
              </div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="h-9 rounded-[6px] border border-[#C7D7F8] bg-white px-3 text-[12px] font-extrabold text-[#1D4ED8] transition hover:bg-[#EEF4FF]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <a
            {...actionProps}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-center text-[14px] font-extrabold text-white transition hover:bg-[#2558C9]"
          >
            {popup.ctaText || "Primary action"}
          </a>
          {popup.secondaryText && popup.secondaryUrl ? (
            <a
              href={preview ? undefined : popup.secondaryUrl}
              onClick={
                preview
                  ? (event) => event.preventDefault()
                  : onAction
              }
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[8px] border border-slate-300 bg-white px-5 text-center text-[14px] font-extrabold text-slate-700 transition hover:bg-slate-50"
            >
              {popup.secondaryText}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
