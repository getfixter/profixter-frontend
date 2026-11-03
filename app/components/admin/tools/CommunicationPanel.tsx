'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from './AdminSheet';
import {
  getCommunication,
  readFailure,
  requestSmsConfirmation,
  setCommunication,
  type CommunicationKey,
  type CommunicationState,
  type ConsentMethod,
} from '@/lib/admin-tools-service';

/*
 * Customer details → Messages: service and marketing, by email and text.
 *
 * A change takes effect at once and the customer is not told. The server
 * records who changed it, when and why (consent ledger + activity log), and
 * refuses to switch back on what the customer stopped themselves: a STOP from
 * their phone, a bounce or a spam complaint.
 *
 * Marketing SMS also asks HOW the customer agreed, because that decides
 * whether offer texts may go out (server: utils/consent/marketingSmsBasis.js):
 * a call is recorded and completed by the customer's own confirmation, which
 * Admin can request by email with one button; written permission the customer
 * sent is recorded with its evidence.
 */

/*
 * Why an On marketing switch still sends nothing. The consent reasons
 * (needs_confirmation, awaiting_registration) are left out: the line under the
 * SMS switch already explains those, with what to do about them.
 */
const DELIVERY_LABEL: Record<string, string> = {
  marketing_email_paused: 'Not sending: marketing email is paused for everyone',
  texts_off: 'Not sending: texts are switched off for everyone',
  marketing_texts_off: 'Not sending: offer texts are switched off for everyone',
  phone_undeliverable: 'Not sending: the carrier says this number cannot receive texts',
};

const LOCK_LABEL: Record<string, string> = {
  no_phone: 'No phone',
  no_email: 'No email',
  stopped: 'Texted STOP',
  blocked: 'Bounced / spam',
  not_marketable: 'Not marketable',
  excluded: 'Excluded',
};

const METHODS: Array<{ key: ConsentMethod; label: string; written: boolean }> = [
  { key: 'phone_call', label: 'Phone call', written: false },
  { key: 'customer_email', label: 'Customer emailed us', written: true },
  { key: 'customer_text', label: 'Customer texted us', written: true },
  { key: 'signed_form', label: 'Signed form', written: true },
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export default function CommunicationPanel({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const [state, setState] = useState<CommunicationState | null>(null);
  const [busy, setBusy] = useState<CommunicationKey | 'confirm' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /* The "how did they agree" form for marketing SMS; null when closed. */
  const [form, setForm] = useState<{ method: ConsentMethod; evidence: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setState(null);
    setForm(null);
    getCommunication(userId)
      .then((next) => alive && setState(next))
      .catch((err) => alive && setError(readFailure(err).message));
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = async (key: CommunicationKey, enabled: boolean, how: { method?: ConsentMethod; evidence?: string } = {}) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const result = await setCommunication(userId, key, enabled, how);
      setState(result.state);
      setForm(null);
    } catch (err) {
      setError(readFailure(err).message);
    } finally {
      setBusy(null);
    }
  };

  const emailConfirmation = async () => {
    setBusy('confirm');
    setError('');
    setNotice('');
    try {
      const result = await requestSmsConfirmation(userId);
      setState(result.state);
      setNotice(`Confirmation request emailed to ${result.sentTo}.`);
    } catch (err) {
      setError(readFailure(err).message);
    } finally {
      setBusy(null);
    }
  };

  const row = (purpose: 'service' | 'marketing', channel: 'email' | 'sms') => {
    const item = state?.[purpose]?.[channel];
    const key = `${purpose}.${channel}` as CommunicationKey;
    const locked = item?.locked && !item.enabled ? LOCK_LABEL[item.locked] || item.locked : '';
    const notSending = item?.enabled && item.delivery && !item.delivery.sending ? DELIVERY_LABEL[item.delivery.reason || ''] || '' : '';
    /* Switching marketing SMS on asks how the customer agreed first. */
    const onChange = (next: boolean) =>
      key === 'marketing.sms' && next ? setForm({ method: 'phone_call', evidence: '' }) : toggle(key, next);
    return (
      <div className="flex items-center justify-between gap-3 py-1.5" data-comm-row={key}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{channel === 'email' ? 'Email' : 'SMS'}</div>
          {locked && <div className="text-[11px] font-semibold text-amber-700">{locked}</div>}
          {notSending && <div className="text-[11px] font-semibold text-amber-700" data-comm-not-sending={key}>{notSending}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${item?.enabled ? (notSending ? 'text-amber-700' : 'text-emerald-700') : 'text-slate-500'}`} data-comm-value={key}>
            {item ? (item.enabled ? 'On' : 'Off') : '…'}
          </span>
          <Switch
            checked={!!item?.enabled}
            label={`${purpose === 'service' ? 'Service' : 'Marketing'} ${channel === 'email' ? 'email' : 'SMS'}`}
            testId={key}
            disabled={!state || !canEdit || (!!item?.locked && !item.enabled)}
            busy={busy === key}
            onChange={onChange}
          />
        </div>
      </div>
    );
  };

  const methodForm = () => {
    if (!form) return null;
    const written = METHODS.find((m) => m.key === form.method)?.written;
    const short = written && form.evidence.trim().length < 8;
    return (
      <div className="mt-1 rounded-xl bg-slate-50 p-2.5" data-sms-consent-form>
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">How did the customer agree?</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {METHODS.map((m) => (
            <label key={m.key} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <input
                type="radio"
                name={`sms-consent-method-${userId}`}
                value={m.key}
                checked={form.method === m.key}
                onChange={() => setForm({ ...form, method: m.key })}
              />
              {m.label}
            </label>
          ))}
        </div>
        {written ? (
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            rows={3}
            placeholder="When they sent it, from which email or number, and what it said"
            value={form.evidence}
            onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            data-sms-consent-evidence
          />
        ) : (
          <p className="mt-2 text-[11px] leading-4 text-slate-600">
            The call is recorded. Offer texts start once the customer confirms; you can email them the request next.
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-600" onClick={() => setForm(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50"
            disabled={short || busy === 'marketing.sms'}
            onClick={() => toggle('marketing.sms', true, { method: form.method, evidence: form.evidence })}
            data-action="save-sms-consent"
          >
            Turn on
          </button>
        </div>
      </div>
    );
  };

  /* Under marketing SMS: can offer texts actually go out, and what's missing if not. */
  const consentLine = () => {
    const sms = state?.marketing?.sms;
    const consent = sms?.consent;
    if (!sms?.enabled || !consent || form) return null;
    const requested = consent.confirmRequestedAt ? `Request emailed ${formatDate(consent.confirmRequestedAt)}.` : '';
    const actions = canEdit && (
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <button type="button" className="text-[11px] font-bold text-sky-700 underline disabled:opacity-50" disabled={busy === 'confirm'} onClick={emailConfirmation} data-action="email-sms-confirmation">
          {busy === 'confirm' ? 'Sending…' : 'Email confirmation request'}
        </button>
        <button type="button" className="text-[11px] font-bold text-sky-700 underline" onClick={() => setForm({ method: 'customer_email', evidence: '' })} data-action="add-written-consent">
          Record written permission
        </button>
      </div>
    );
    if (consent.status === 'qualifies') {
      return (
        <p className="mt-1 text-[11px] font-semibold text-emerald-700" data-sms-consent="qualifies">
          Offer texts allowed: {consent.basis === 'customer_electronic' ? "customer's own opt-in" : 'written permission on record'}.
        </p>
      );
    }
    if (consent.status === 'awaiting_registration') {
      return (
        <div className="mt-1 text-[11px] leading-4 text-amber-800" data-sms-consent="awaiting_registration">
          Written permission recorded. Offer texts start once the Twilio registration is updated, or sooner if the customer confirms in their account. {requested}
          {actions}
        </div>
      );
    }
    return (
      <div className="mt-1 text-[11px] leading-4 text-amber-800" data-sms-consent="needs_confirmation">
        Phone call recorded. Offer texts start when the customer confirms. {requested}
        {actions}
      </div>
    );
  };

  return (
    <section data-communication-panel>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-700">Messages</h4>
        <span className="text-[11px] text-slate-500">Changes apply now · customer not notified</span>
      </div>
      {error && <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
      {notice && <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{notice}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Service messages</div>
          {row('service', 'email')}
          {row('service', 'sms')}
        </div>
        <div className="rounded-2xl border border-slate-200 px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Marketing messages</div>
          {row('marketing', 'email')}
          {row('marketing', 'sms')}
          {methodForm()}
          {consentLine()}
        </div>
      </div>
    </section>
  );
}
