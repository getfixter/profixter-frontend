'use client';

import React, { useEffect, useState } from 'react';
import { Switch } from './tools/AdminSheet';
import { getReviewedUs, setReviewedUs, type ReviewedUsState } from './customer-profile-api';

/*
 * Customer details → "Reviewed us".
 *
 * One switch the owner sets after seeing this customer's Google review. While
 * it is on, the post-visit "How did we do?" email is never sent to them. It is
 * set by hand only - nothing matches review names - and it tells the customer
 * nothing. Turning it off never sends an email for visits already finished.
 * Staff see it; only the owner can change it (the server decides).
 */
const formatDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export default function ReviewedUsPanel({ userId }: { userId: string }) {
  const [state, setState] = useState<ReviewedUsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setState(null);
    setError('');
    getReviewedUs(userId)
      .then((next) => alive && setState(next))
      .catch(() => alive && setError('Could not load the review status.'));
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = async (next: boolean) => {
    if (!state || busy) return;
    setBusy(true);
    setError('');
    try {
      setState(await setReviewedUs(userId, next));
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`reviewed-us-${userId}`} data-reviewed-us-panel>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`reviewed-us-${userId}`} className="text-sm font-bold text-slate-900">
            Reviewed us
          </h3>
          <p className="mt-0.5 text-xs text-slate-500" data-reviewed-us-detail>
            {!state
              ? error || 'Loading…'
              : state.reviewedUs
                ? `Marked ${formatDay(state.reviewedUs.at)}${state.reviewedUs.byName ? ` by ${state.reviewedUs.byName}` : ''} · no review emails`
                : state.lastAskedAt
                  ? `Not marked · last asked for a review ${formatDay(state.lastAskedAt)}`
                  : 'Not marked · review email after a visit, at most once every 90 days'}
          </p>
        </div>
        {state ? (
          <Switch
            checked={Boolean(state.reviewedUs)}
            onChange={(next) => void toggle(next)}
            label="Customer left us a Google review"
            disabled={!state.canEdit}
            busy={busy}
            testId="reviewed-us"
          />
        ) : null}
      </div>
      {state && error ? (
        <p className="mt-1 text-xs font-semibold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
