'use client';

import { useEffect, useState } from 'react';
import API from '@/lib/api';

/**
 * What this customer has agreed to be texted about.
 *
 * READ-ONLY, AND THERE IS NO BUTTON. THAT IS THE FEATURE.
 *
 * Support needs to answer "why did they not get the reminder", and the answer is
 * almost always one of the three states shown here. What support must never be
 * able to do is fix it from this screen: consent is something the customer
 * performs, and an admin control that set it would manufacture a record saying
 * they did something they did not. A false consent record is worse than none -
 * it is the first thing anybody would examine if a complaint were made. The
 * correct action is to tell the customer where the switch is in their account.
 *
 * The global STOP is read from the carrier-level opt-out through the same
 * function the send path uses, so this panel and the eligibility engine can
 * never disagree about whether a number is blocked.
 */

interface SmsConsent {
  transactionalEnabled: boolean;
  transactionalConsentAt: string | null;
  transactionalConsentSource: string;
  marketingEnabled: boolean;
  marketingConsentAt: string | null;
  marketingConsentSource: string;
  phoneOptedOut: boolean;
  phoneOptOutScope: string;
  phoneOptedOutAt: string | null;
  phoneOptOutSource: string;
}

function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ConsentRow({
  title,
  enabled,
  at,
  source,
}: {
  title: string;
  enabled: boolean;
  at: string | null;
  source: string;
}) {
  const when = formatWhen(at);
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        {/*
          * Evidence, shown only when it exists. An opted-in row with no date is
          * possible on records written before the timestamps were stored, and
          * printing "undefined" there would look like a bug in the consent
          * itself rather than a gap in the paperwork.
          */}
        {enabled && (when || source) ? (
          <div className="mt-0.5 text-xs text-slate-500">
            {when ? `Opted in ${when}` : 'Opted in'}
            {source ? ` · ${source.replace(/_/g, ' ')}` : ''}
          </div>
        ) : null}
        {!enabled && when ? (
          <div className="mt-0.5 text-xs text-slate-500">Previously opted in {when}</div>
        ) : null}
      </div>
      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
          enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {enabled ? 'Opted in' : 'Not opted in'}
      </span>
    </div>
  );
}

/**
 * The fetched state, tagged with the customer it describes.
 *
 * Tagging rather than clearing on the way in: resetting state synchronously at
 * the top of the effect causes a cascading render, and worse, for the moment
 * before the new request lands it would leave one customer's consent on screen
 * under another customer's name. Anything whose `for` does not match the
 * `userId` being rendered is simply not this customer's, and is ignored.
 */
type Loaded = { for: string; consent: SmsConsent | null; failed: boolean };

export function SmsConsentPanel({ userId }: { userId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    API.get<SmsConsent>(`/api/admin/users/${userId}/sms-consent`)
      .then(({ data }) => {
        if (!cancelled) setLoaded({ for: userId, consent: data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ for: userId, consent: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = loaded?.for === userId ? loaded : null;
  if (current?.failed) return null;
  const consent = current?.consent;
  if (!consent) return <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />;

  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        SMS consent
      </div>

      <div className="mt-2 space-y-2">
        <ConsentRow
          title="Service texts"
          enabled={consent.transactionalEnabled}
          at={consent.transactionalConsentAt}
          source={consent.transactionalConsentSource}
        />
        <ConsentRow
          title="Marketing texts"
          enabled={consent.marketingEnabled}
          at={consent.marketingConsentAt}
          source={consent.marketingConsentSource}
        />
      </div>

      {consent.phoneOptedOut ? (
        /*
         * The handset STOP outranks both rows above, so it is stated rather
         * than left for the reader to infer from two green badges and no texts.
         */
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <span className="font-black uppercase tracking-wide">Global STOP</span> — this handset
          texted STOP{formatWhen(consent.phoneOptedOutAt) ? ` on ${formatWhen(consent.phoneOptedOutAt)}` : ''} and
          receives no SMS of any kind, whatever the rows above say. Only a START from that phone
          lifts it.
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Read-only. Only the customer can change these, in their own account settings.
      </p>
    </div>
  );
}

export default SmsConsentPanel;
