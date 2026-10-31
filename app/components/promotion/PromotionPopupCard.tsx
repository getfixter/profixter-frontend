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

  /*
   * Drawn from the Website 3.0 tokens (ui.css) so the card reads like the rest
   * of the site: navy ink, hairlines, Geist, one navy primary action.
   *
   * Touch targets are sized against the site zoom (site-scale.css draws the
   * customer site at 0.82-0.88), so every control still lands at 44px or more
   * on screen. The admin preview has no zoom and falls back to a plain 44px.
   * The card sets its own font so that preview really is exact, rather than
   * inheriting the admin's typeface. The title and code sizes are in rem so
   * the legacy phone map (mobile-scale.css), which keys on px class names,
   * leaves them alone.
   */
  const target = "min-h-[calc(44px/var(--site-zoom,1))]";

  return (
    <div className="relative w-full max-w-[460px] overflow-hidden rounded-[var(--ui-r-lg)] border border-[color:var(--ui-line)] bg-white font-[family-name:var(--ui-font)] text-[color:var(--ui-text)] shadow-[var(--ui-shadow-3)]">
      <div className="p-5 sm:p-6">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close promotion"
            className="absolute right-2 top-2 flex size-[calc(44px/var(--site-zoom,1))] items-center justify-center rounded-full text-[color:var(--ui-text-3)] transition-colors hover:bg-[color:var(--ui-bg-soft)] hover:text-[color:var(--ui-ink)] sm:right-3 sm:top-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        {popup.eyebrow ? (
          <div className="ui-eyebrow ui-eyebrow--accent pr-11">
            {popup.eyebrow}
          </div>
        ) : null}
        <h2 id="promotion-popup-title" className="mt-1 pr-11 text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.018em] text-[color:var(--ui-ink)] sm:text-[1.5rem]">
          {popup.title || "Your promotion title"}
        </h2>
        <p className="mt-2 whitespace-pre-line text-[length:var(--ui-fs-body)] leading-[1.55] text-[color:var(--ui-text-2)]">
          {popup.message || "Add a short, helpful message for visitors."}
        </p>

        {popup.promoCode ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-soft)] py-1.5 pl-4 pr-1.5">
            <div className="min-w-0">
              <div className="text-[length:var(--ui-fs-small)] leading-[1.3] text-[color:var(--ui-text-3)]">
                Promo code
              </div>
              <div className="font-mono text-[1.125rem] font-semibold leading-[1.3] tracking-[0.08em] break-all text-[color:var(--ui-ink)]">
                {popup.promoCode}
              </div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className={`ui-btn ui-btn--secondary ${target} min-w-[calc(64px/var(--site-zoom,1))] shrink-0 rounded-[8px] px-4`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        {/* Side by side when both labels fit; each takes the full width when they do not. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            {...actionProps}
            className={`ui-btn ui-btn--primary ${target} flex-[1_1_auto] whitespace-normal px-4 py-2 text-center leading-[1.2]`}
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
              className={`ui-btn ui-btn--secondary ${target} flex-[1_1_auto] whitespace-normal px-4 py-2 text-center leading-[1.2]`}
            >
              {popup.secondaryText}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
