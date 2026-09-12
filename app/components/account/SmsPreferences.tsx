"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

/**
 * The two SMS opt-ins, for customers who already have an account.
 *
 * Signup asks new customers both questions. Everybody already in the database
 * was asked neither - marketing because the box did not exist yet, service
 * because it was never a question at all, it simply happened. After the
 * forced-consent finding, "we have their number" stopped counting as an answer,
 * so every existing customer now shows service texts OFF until they say
 * otherwise here. That is not a downgrade of their preferences; it is the first
 * time they have been given one.
 *
 * TWO SWITCHES, NOT ONE, AND NEITHER IMPLIES THE OTHER.
 *
 * A customer may reasonably want appointment reminders and no advertising, and
 * the reverse is at least possible. One combined switch would force them to
 * choose between being reminded and being sold to.
 *
 * THIS TOUCHES SMS AND NOTHING ELSE. Not email, which carries the receipts and
 * confirmations either way and is unaffected by both switches. Not the
 * handset-level STOP, which is the carrier's record and is only lifted by a
 * START from the phone itself. A preference screen that quietly bundled those
 * together is how somebody ends up silencing their own appointment reminders
 * while trying to decline an advert.
 */

interface SmsPreferenceState {
  transactionalEnabled: boolean;
  marketingEnabled: boolean;
  phoneOptedOut: boolean;
  phoneOptOutScope: string;
}

type Channel = "transactionalEnabled" | "marketingEnabled";

const CHANNELS: Array<{ field: Channel; label: string; help: string }> = [
  {
    field: "transactionalEnabled",
    label: "Text me about my ProFixter visits.",
    help: "Optional. Booking confirmations, appointment reminders and service updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.",
  },
  {
    field: "marketingEnabled",
    label: "Text me occasional ProFixter offers.",
    help: "Optional, and separate from the service texts above. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.",
  },
];

export function SmsPreferences() {
  const [state, setState] = useState<SmsPreferenceState | null>(null);
  const [saving, setSaving] = useState<Channel | null>(null);
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

  const toggle = useCallback(async (field: Channel, next: boolean) => {
    setSaving(field);
    setError("");
    /* Optimistic, so the tick responds immediately; reconciled below. */
    setState((prev) => (prev ? { ...prev, [field]: next } : prev));
    try {
      const { data } = await API.put<SmsPreferenceState>("/api/users/me/sms-preferences", {
        [field]: next,
      });
      setState(data);
    } catch (err: unknown) {
      /*
       * The server refuses an opt-in while the handset is under a STOP, and
       * answers with the true state. Showing that state - rather than the tick
       * the customer just made - is what stops the screen claiming a consent
       * the carrier would refuse to act on.
       */
      const response = (
        err as { response?: { status?: number; data?: SmsPreferenceState & { message?: string } } }
      )?.response;
      if (response?.data?.phoneOptedOut !== undefined) setState(response.data);
      else setState((prev) => (prev ? { ...prev, [field]: !next } : prev));
      setError(response?.data?.message || "Could not save that. Please try again.");
    } finally {
      setSaving(null);
    }
  }, []);

  if (!state) return null;

  return (
    <div className="mt-5 rounded-[8px] border border-[#E0E6F5] bg-white px-4 py-4 sm:px-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A9099]">
        Text messages
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-[#6A6D71]">
        Both are optional and separate. Turning them off never affects your email
        confirmations, receipts or reminders, and never affects your membership or
        bookings.
      </p>

      <div className="mt-3 space-y-3">
        {CHANNELS.map(({ field, label, help }) => (
          <label key={field} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={state[field]}
              disabled={saving !== null || state.phoneOptedOut}
              onChange={(e) => toggle(field, e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#306EEC] disabled:opacity-40"
            />
            <span className="text-sm leading-relaxed text-[#313234]">
              <span className="font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-[#6A6D71]">{help}</span>
            </span>
          </label>
        ))}
      </div>

      {state.phoneOptedOut ? (
        /*
         * The handset-level STOP, explained rather than hidden.
         *
         * Only a START from that phone lifts it, and clearing it from here
         * would erase a withdrawal we are required to honour. So both controls
         * are disabled and the reason is stated.
         *
         * A START lifts the block and nothing more: it restores neither
         * checkbox, so whoever comes back still has to turn on what they want.
         */
        <p className="mt-3 rounded-[6px] bg-[#FFF6E9] px-3 py-2 text-xs leading-relaxed text-[#8A5A1B]">
          This phone number has opted out of SMS. Text <span className="font-semibold">START</span>{" "}
          to {"("}631{")"} 888-6340 to lift the block on your phone. That on its own does not
          resume any texts &mdash; come back here afterwards and switch on the ones you want.
        </p>
      ) : null}

      {error && !state.phoneOptedOut ? (
        <p className="mt-2 text-xs font-semibold text-[#B4342B]">{error}</p>
      ) : null}
    </div>
  );
}

export default SmsPreferences;
