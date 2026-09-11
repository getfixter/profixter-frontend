"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

/**
 * The marketing-SMS opt-in, for customers who registered before it existed.
 *
 * Signup asks new customers directly. Everyone already in the database was
 * never asked, and without this they would stay unreachable on the channel
 * permanently - not because they declined, but because there was no way to
 * say yes. One checkbox is the whole feature.
 *
 * MARKETING ONLY, AND THAT IS THE POINT.
 *
 * It does not touch service texts about a booked visit, which rest on a
 * different basis and are switched off with STOP rather than here. It does not
 * touch email, GHL or gift messaging. A preference screen that quietly bundles
 * those together is how a customer ends up switching off their own appointment
 * reminders while trying to decline an advert.
 */

interface SmsPreferenceState {
  marketingEnabled: boolean;
  phoneOptedOut: boolean;
  phoneOptOutScope: string;
}

export function SmsMarketingPreference() {
  const [state, setState] = useState<SmsPreferenceState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    API.get<SmsPreferenceState>("/api/users/me/sms-preferences")
      .then(({ data }) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        /*
         * Render nothing rather than a broken control. A checkbox whose real
         * state is unknown is worse than no checkbox: it invites somebody to
         * "fix" a setting that may already be correct, and a failed read here
         * must never be mistaken for a recorded consent.
         */
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (next: boolean) => {
      setSaving(true);
      setError("");
      /* Optimistic, so the tick responds immediately; reconciled below. */
      setState((prev) => (prev ? { ...prev, marketingEnabled: next } : prev));
      try {
        const { data } = await API.put<SmsPreferenceState>(
          "/api/users/me/sms-preferences",
          { marketingEnabled: next }
        );
        setState(data);
      } catch (err: unknown) {
        /*
         * The server refuses an opt-in while the handset is under a STOP, and
         * answers with the true state. Showing that state - rather than the
         * tick the customer just made - is what stops the screen claiming a
         * consent the carrier would refuse to act on.
         */
        const response = (err as { response?: { status?: number; data?: SmsPreferenceState & { message?: string } } })
          ?.response;
        if (response?.data) setState(response.data);
        else setState((prev) => (prev ? { ...prev, marketingEnabled: !next } : prev));
        setError(response?.data?.message || "Could not save that. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  if (!state) return null;

  return (
    <div className="mt-5 rounded-[8px] border border-[#E0E6F5] bg-white px-4 py-4 sm:px-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={state.marketingEnabled}
          disabled={saving || state.phoneOptedOut}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#306EEC] disabled:opacity-40"
        />
        <span className="text-sm leading-relaxed text-[#313234]">
          <span className="font-semibold">Text me occasional ProFixter offers.</span>
          <span className="mt-1 block text-xs text-[#6A6D71]">
            Optional. Message frequency varies. Message and data rates may apply. Reply STOP to opt
            out.
          </span>
        </span>
      </label>

      {state.phoneOptedOut ? (
        /*
         * The handset-level STOP, explained rather than hidden.
         *
         * Only a START from that phone lifts it, and clearing it from here
         * would erase a withdrawal we are required to honour. So the control
         * is disabled and the reason is stated.
         */
        <p className="mt-3 rounded-[6px] bg-[#FFF6E9] px-3 py-2 text-xs leading-relaxed text-[#8A5A1B]">
          This phone number has opted out of SMS. Text <span className="font-semibold">START</span>{" "}
          to {"("}631{")"} 888-6340 to re-enable messages, then you can turn offers back
          on here.
        </p>
      ) : null}

      {error && !state.phoneOptedOut ? (
        <p className="mt-2 text-xs font-semibold text-[#B4342B]">{error}</p>
      ) : null}
    </div>
  );
}

export default SmsMarketingPreference;
