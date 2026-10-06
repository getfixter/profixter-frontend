"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureAttribution } from "@/lib/meta";

/**
 * Remember the ad that brought this visitor, before they navigate away from it.
 *
 * The campaign parameters only exist on the landing URL. This app routes on the
 * client, so the very next tap replaces the query string and the only record of
 * which ad was clicked is gone - which is why attribution has to be read on
 * arrival and kept, not read later when an account is finally created.
 *
 * It runs on every route change rather than once on mount because a visitor can
 * land on any page, and because a second ad click into an already-open tab is a
 * real thing. captureAttribution itself decides what to keep: first touch wins,
 * and a navigation carrying no parameters never erases a campaign.
 *
 * Renders nothing and can fail without consequence.
 */
export default function AttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureAttribution();
  }, [pathname, searchParams]);

  return null;
}
