"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The GIFT code, as a chip you can copy.
 *
 * The code is live in Stripe and permanent, so it is written here as a
 * constant rather than fetched: a network round trip to learn a word that
 * never changes would delay every placement that shows it, and a failed
 * request would leave a hole in a marketing card.
 *
 * Copy is a convenience, never the only way through. The code is selectable
 * text first and a button second, so a viewer with the clipboard API blocked
 * — an iframe without permission, an older browser, a locked-down device —
 * can still read it and type it in.
 */

export const GIFT_PROMO_CODE = "GIFT";
export const GIFT_PROMO_LABEL = "10% off";

export default function GiftPromoCode({
  tone = "light",
  className = "",
}: {
  /** "light" sits on a pale surface, "dark" on the navy gift band. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GIFT_PROMO_CODE);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /*
       * Clipboard denied. Deliberately silent: the code is already on screen
       * and readable, so an error message would be telling somebody about a
       * failure that costs them nothing.
       */
    }
  }, []);

  const dark = tone === "dark";

  return (
    <button
      type="button"
      onClick={copy}
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold tracking-[0.06em] transition sm:text-[13px] ${
        dark
          ? "border-[#D4A574]/45 bg-[#D4A574]/12 text-[#E8CFAE] hover:bg-[#D4A574]/20"
          : "border-[#D4A574]/60 bg-[#FDF6EC] text-[#8A6A3E] hover:bg-[#FAEBD6]"
      } ${className}`}
      aria-label={`Copy promotion code ${GIFT_PROMO_CODE} for ${GIFT_PROMO_LABEL}`}
    >
      <span className="font-mono tracking-[0.12em]">{GIFT_PROMO_CODE}</span>
      <span aria-hidden="true" className={dark ? "text-[#D4A574]/50" : "text-[#C7A97B]"}>
        &middot;
      </span>
      <span className="font-medium tracking-normal">{GIFT_PROMO_LABEL}</span>
      <span
        aria-hidden="true"
        className={`ml-0.5 text-[11px] font-medium tracking-normal ${
          dark ? "text-[#B9A88C]" : "text-[#A9906B]"
        }`}
      >
        {copied ? "Copied" : "Copy"}
      </span>
      {/* Announced once, out of band, so the label above can stay short. */}
      <span className="sr-only" role="status">
        {copied ? `${GIFT_PROMO_CODE} copied to clipboard` : ""}
      </span>
    </button>
  );
}
