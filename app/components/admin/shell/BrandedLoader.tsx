"use client";

import { useEffect, useState } from "react";

export const HAMMER_MARK = "/images/profixter-hammer-mark.png";

/**
 * The cold-start loader of the admin (audit L.3), shown while the session is
 * checked. It appears only after 300ms, so a fast start never flashes it, and
 * it never adds delay. The mark pulses gently (the raster cannot be animated
 * cleanly as a "tap": rotating it would turn the cut-off handle too); with
 * reduced motion it is static. role="status" with a text alternative.
 */
export function BrandedLoader({ label = "Loading Profixter Admin" }: { label?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="adm-loader" role="status" aria-live="polite" aria-label={label} style={visible ? undefined : { opacity: 0 }} data-adm-loader="">
      {visible && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a 256px local mark; the optimizer adds nothing here */}
          <img src={HAMMER_MARK} alt="" width={72} height={72} />
          <span>Loading…</span>
        </>
      )}
    </div>
  );
}
