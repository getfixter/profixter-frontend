"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

/**
 * The booking-step offer of service texts. Registration 2.0.
 *
 * Sign-up asks for no text consent at all: the one-time code is requested by
 * the person and sent through Twilio Verify, outside the A2P campaign. Ongoing
 * SERVICE texts (confirmations, reminders, arrival updates) are offered here,
 * once, as ONE optional box that starts unticked, and in account settings.
 *
 * WHAT THIS MUST NEVER BECOME
 * - pre-ticked: useState(false) below is the consent record's whole premise;
 * - a condition of booking: nothing reads it before the booking is made, and
 *   the booking goes ahead whatever it says;
 * - a marketing opt-in: it sends transactionalEnabled and nothing else, and the
 *   server refuses marketing with source "booking_step" anyway. Marketing texts
 *   are offered in account settings and nowhere else.
 *
 * The wording is consent version "sms_service.booking.v1" in
 * BackEnd/utils/consent/consentText.js, word for word. Change one, change both
 * (as a NEW version there).
 */

const LABEL = "Text me about my visits";
const DETAILS =
  "Booking confirmations, appointment reminders and arrival updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.";

function ServiceTextsOptIn({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 text-left ${className}`} data-service-texts-optin>
      <input
        id="booking-service-texts"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-4 w-4 flex-shrink-0 cursor-pointer rounded border-[#B8C2D3] accent-[#306EEC]"
      />
      <div className="min-w-0 text-[13px] leading-[18px] text-[#475569]">
        <label htmlFor="booking-service-texts" className="cursor-pointer font-semibold text-[#0B1628]">
          {LABEL}
        </label>{" "}
        {/* Outside the label: reading what a consent means must never tick it. */}
        <a
          href="/communication-consent#service-texts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-semibold text-[#306EEC] underline underline-offset-2"
        >
          Details
        </a>
        <p className="mt-0.5 text-[11.5px] leading-4 text-[#8A94A6]">{DETAILS}</p>
      </div>
    </div>
  );
}

/**
 * `const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn()`.
 * Render `serviceTextsOptIn` just above the submit button, and call
 * `await applyServiceTextsOptIn()` only once the booking has been accepted.
 * It never throws.
 */
export function useServiceTextsOptIn(options: { className?: string } = {}): {
  serviceTextsOptIn: ReactNode;
  applyServiceTextsOptIn: () => Promise<void>;
} {
  const { user, isAuthenticated, refreshUser } = useAuth();
  /* Unticked. Never pre-ticked, never restored from anywhere. */
  const [serviceTexts, setServiceTexts] = useState(false);
  const eligible = Boolean(isAuthenticated && user?.phone && user?.smsServiceTexts !== true);

  /* Read at call time: submit handlers are often memoised before the tick. */
  const latest = useRef({ ticked: false, eligible: false });
  useEffect(() => {
    latest.current = { ticked: serviceTexts, eligible };
  }, [serviceTexts, eligible]);

  const applyServiceTextsOptIn = useCallback(async () => {
    const { ticked, eligible: shown } = latest.current;
    if (!ticked || !shown) return;
    try {
      await API.put("/api/users/me/sms-preferences", { transactionalEnabled: true, source: "booking_step" });
      setServiceTexts(false);
      void refreshUser().catch(() => null);
    } catch (err) {
      /* The booking stands either way; the setting can be changed in My Home. */
      console.error("Saving the booking-step service texts choice failed:", err);
    }
  }, [refreshUser]);

  return {
    serviceTextsOptIn: eligible ? (
      <ServiceTextsOptIn checked={serviceTexts} onChange={setServiceTexts} className={options.className} />
    ) : null,
    applyServiceTextsOptIn,
  };
}

export default ServiceTextsOptIn;
