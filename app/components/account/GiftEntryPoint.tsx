"use client";

/**
 * "Gift a Membership" on the account screen.
 *
 * VISIBILITY IS THE SERVER'S DECISION, NOT THIS FILE'S.
 *
 * It asks the API whether gifting is live and renders nothing when it is not.
 * Every /api/gifts route answers 404 while GIFTS_ENABLED is off, so a build
 * shipped with the flag down shows no entry point anywhere — deploying the
 * code cannot launch the feature.
 *
 * Deliberately not a NEXT_PUBLIC_ env var: a public flag is baked in at build
 * time and can drift out of step with the server, which would advertise a
 * purchase flow that cannot complete.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { getGiftOptions } from "@/lib/gift-service";

export default function GiftEntryPoint() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const options = await getGiftOptions();
        // null means the server says the feature is off.
        if (!cancelled) setAvailable(Boolean(options?.plans?.length));
      } catch {
        // Any failure keeps it hidden. An entry point that might not work is
        // worse than no entry point.
        if (!cancelled) setAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-[10px] border border-[#E0E6F5] bg-[#F8FAFF] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-[16px] font-semibold text-[#313234]">Gift a Membership</h3>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-[#6A6D71]">
          Give someone a ProFixter membership for their home. You pay once, they book the visits,
          and nothing renews.
        </p>
      </div>
      <Link
        href="/gift"
        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[8px] border border-[#306EEC] bg-white px-5 text-[14px] font-semibold text-[#306EEC] transition hover:bg-[#EEF2FF]"
      >
        Gift a Membership
      </Link>
    </div>
  );
}
