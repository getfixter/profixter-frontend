'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from './AdminSheet';
import { getCommunication, readFailure, setCommunication, type CommunicationKey, type CommunicationState } from '@/lib/admin-tools-service';

/*
 * Customer details → Messages: service and marketing, by email and text.
 *
 * A change takes effect at once and the customer is not told. The server
 * records who changed it, when and why (consent ledger + activity log), and
 * refuses to switch back on what the customer stopped themselves: a STOP from
 * their phone, a bounce or a spam complaint.
 */

const LOCK_LABEL: Record<string, string> = {
  no_phone: 'No phone',
  no_email: 'No email',
  stopped: 'Texted STOP',
  blocked: 'Bounced / spam',
  not_marketable: 'Not marketable',
  excluded: 'Excluded',
};

export default function CommunicationPanel({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const [state, setState] = useState<CommunicationState | null>(null);
  const [busy, setBusy] = useState<CommunicationKey | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setState(null);
    getCommunication(userId)
      .then((next) => alive && setState(next))
      .catch((err) => alive && setError(readFailure(err).message));
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = async (key: CommunicationKey, enabled: boolean) => {
    setBusy(key);
    setError('');
    try {
      const result = await setCommunication(userId, key, enabled);
      setState(result.state);
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
    return (
      <div className="flex items-center justify-between gap-3 py-1.5" data-comm-row={key}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{channel === 'email' ? 'Email' : 'SMS'}</div>
          {locked && <div className="text-[11px] font-semibold text-amber-700">{locked}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${item?.enabled ? 'text-emerald-700' : 'text-slate-500'}`} data-comm-value={key}>
            {item ? (item.enabled ? 'On' : 'Off') : '…'}
          </span>
          <Switch
            checked={!!item?.enabled}
            label={`${purpose === 'service' ? 'Service' : 'Marketing'} ${channel === 'email' ? 'email' : 'SMS'}`}
            testId={key}
            disabled={!state || !canEdit || (!!item?.locked && !item.enabled)}
            busy={busy === key}
            onChange={(next) => toggle(key, next)}
          />
        </div>
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
        </div>
      </div>
    </section>
  );
}
