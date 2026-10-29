"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

/**
 * Marketing email, for customers who already have an account.
 *
 * Email follows the opt-out rule: a registered customer gets our occasional
 * marketing email until they turn it off, and every email has a one-click
 * unsubscribe. This switch is the same choice, from the account. Turning it
 * back on is recorded as their own opt-in (with this wording, server side:
 * utils/consent/consentText.js "email_marketing.settings.v1").
 *
 * Booking confirmations, reminders and receipts are not marketing and are not
 * affected either way. A bounced address or a spam complaint can't be undone
 * from here - the server refuses, and the switch is shown locked.
 */

interface EmailPreferenceState {
  marketingEnabled: boolean;
  status: string;
  canChange: boolean;
}

export function EmailPreferences() {
  const [state, setState] = useState<EmailPreferenceState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    API.get<EmailPreferenceState>("/api/users/me/email-preferences")
      .then(({ data }) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        // an unknown state is never shown as a choice
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (next: boolean) => {
    setSaving(true);
    setError("");
    setState((prev) => (prev ? { ...prev, marketingEnabled: next } : prev));
    try {
      const { data } = await API.put<EmailPreferenceState>("/api/users/me/email-preferences", { marketingEnabled: next });
      setState(data);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: EmailPreferenceState & { message?: string } } })?.response;
      if (response?.data?.status) setState(response.data);
      else setState((prev) => (prev ? { ...prev, marketingEnabled: !next } : prev));
      setError(response?.data?.message || "Could not save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  if (!state || state.status === "not_marketable") return null;

  return (
    <section className="acct-card" aria-labelledby="acct-email-prefs" data-testid="email-preferences">
      <h2 id="acct-email-prefs" className="acct-card__title">
        Email
      </h2>
      <label className="acct-check mt-4">
        <input
          type="checkbox"
          checked={state.marketingEnabled}
          disabled={saving || !state.canChange}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="acct-check__label">Email me ProFixter tips and offers.</span>
          <span className="acct-check__help">
            Optional. Seasonal home tips, news and offers, at most once a week. Every email has a one-click unsubscribe.
            Turning this off never stops your booking confirmations, reminders or receipts.
          </span>
        </span>
      </label>
      {!state.canChange ? (
        <p className="acct-note">
          Marketing email is blocked for this address (it bounced or was reported). Contact us if that is a mistake.
        </p>
      ) : null}
      {error ? <p className="acct-error">{error}</p> : null}
    </section>
  );
}

export default EmailPreferences;
