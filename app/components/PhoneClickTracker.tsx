"use client";

import { useEffect } from "react";
import { trackPhoneClick } from "@/lib/meta";

/** The business line, digits only, for comparing hrefs written in any format. */
const BUSINESS_NUMBER = "16315991363";

/**
 * Contact, whenever anybody taps the ProFixter phone number.
 *
 * ONE DELEGATED LISTENER, NOT TWELVE CALL SITES. The number appears in the
 * header, the footer, the start menu, two landing pages, the account screen and
 * the plan panel, and more will be added. Wiring an onClick into each one means
 * the next link somebody adds is silently untracked, and it means twelve
 * diffs to change one decision. A listener in the capture phase on `document`
 * sees every tap on every `tel:` link, including ones that do not exist yet.
 *
 * ONLY OUR OWN NUMBER. Admin screens list customers' phone numbers as tel:
 * links, and a dispatcher ringing a customer is not a sales contact. Comparing
 * digits rather than the literal href also means "+1 (631) 599-1363",
 * "+16315991363" and "tel:16315991363" all count as the same number, which is
 * how they are actually written across the site.
 *
 * Capture phase, because a tel: tap hands the page to the dialler and some
 * links stop propagation of their own accord; capture runs before either can
 * happen. The event is never prevented - the call always goes through.
 */
export default function PhoneClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      try {
        const target = event.target as Element | null;
        const link = target?.closest?.("a[href^='tel:']") as HTMLAnchorElement | null;
        if (!link) return;

        const digits = (link.getAttribute("href") || "").replace(/\D/g, "");
        if (!digits) return;

        // A ten-digit href is the same number without the country code.
        const normalized = digits.length === 10 ? `1${digits}` : digits;
        if (normalized !== BUSINESS_NUMBER) return;

        trackPhoneClick({
          content_name: "phone_call",
          page: window.location.pathname,
        });
      } catch {
        /* Tracking must never interfere with placing a call. */
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
