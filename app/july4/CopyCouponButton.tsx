"use client";

import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

const COUPON_CODE = "JULY4";

export default function CopyCouponButton() {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const copyCoupon = async () => {
    try {
      await navigator.clipboard.writeText(COUPON_CODE);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = COUPON_CODE;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <button
      type="button"
      onClick={copyCoupon}
      aria-label={copied ? "Coupon code JULY4 copied" : "Copy coupon code JULY4"}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#2F6FED] px-4 text-[12px] font-extrabold text-white shadow-[0_7px_18px_rgba(47,111,237,0.24)] transition hover:bg-[#2459C4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6FED] active:scale-[0.98]"
    >
      {copied ? (
        <>
          <CheckIcon className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardDocumentIcon className="h-4 w-4" />
          Copy code
        </>
      )}
    </button>
  );
}
