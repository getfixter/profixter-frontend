"use client";

import { useEffect, useState, type CSSProperties } from "react";

/*
 * How long the chosen time is still held (Book a Handyman, 2026-11-03): a
 * small "Held for you · 27:41" under the summary while the customer signs in,
 * picks a plan and pays. When it runs out it says so plainly; the time is
 * checked again when they continue, and a time that has gone sends them back
 * to pick another with everything else kept.
 */
export default function HoldCountdown({ expiresAt, style }: { expiresAt: string; style?: CSSProperties }) {
  const end = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!Number.isFinite(end)) return null;
  const left = Math.max(0, Math.round((end - now) / 1000));
  if (!left) {
    return (
      <span className="bk-note bk-hold bk-hold--over" data-hold-note data-hold-left="0" style={style} role="status">
        Your hold ended. We&apos;ll check the time again when you continue.
      </span>
    );
  }
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="bk-note bk-hold" data-hold-note data-hold-left={left} style={style}>
      <span className="bk-hold-dot" aria-hidden="true" />
      {/* One run of text, so it reads (and is read aloud) as one line beside the dot. */}
      <span>
        Held for you · <b className="ui-num">{mm}:{ss}</b>
      </span>
    </span>
  );
}
