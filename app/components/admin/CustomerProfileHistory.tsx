'use client';

import React, { useEffect, useState } from 'react';
import { getCustomerProfileHistory, type ProfileHistoryItem } from './customer-profile-api';

/*
 * Every admin edit to this customer's details: who, when, from what to what.
 * Phone and email arrive masked unless the viewer is the owner; the server
 * decides that, not this component.
 */

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function CustomerProfileHistory({ userId, refreshKey = 0 }: { userId: string; refreshKey?: number }) {
  const [items, setItems] = useState<ProfileHistoryItem[] | null>(null);
  const [masked, setMasked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCustomerProfileHistory(userId)
      .then((response) => {
        if (cancelled) return;
        setItems(response.items || []);
        setMasked(Boolean(response.masked));
        setFailed(false);
      })
      .catch((error) => {
        console.error('Failed to load profile edit history:', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold text-slate-950">Profile edits</h4>
        {masked && <span className="text-[11px] font-semibold text-slate-400">Phone and email masked</span>}
      </div>
      {failed ? (
        <p className="mt-2 text-sm text-slate-400">Edit history unavailable.</p>
      ) : items === null ? (
        <div className="mt-2 h-12 animate-pulse rounded-2xl bg-slate-100" />
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No admin edits yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  By {item.actorName || 'Admin'}
                  {item.actorRole ? ` · ${item.actorRole === 'admin' ? 'Owner' : item.actorRole}` : ''}
                </span>
                <time className="text-xs font-semibold text-slate-500">{formatTime(item.at)}</time>
              </div>
              <ul className="mt-1.5 space-y-1 text-slate-700">
                {item.changes.map((change, index) => (
                  <li key={`${item.id}-${index}`} className="break-words">
                    <span className="font-semibold text-slate-900">{change.label}:</span>{' '}
                    {change.from ? <span className="text-slate-500 line-through decoration-slate-300">{change.from}</span> : <span className="text-slate-400">empty</span>}
                    {' → '}
                    {change.to ? <span>{change.to}</span> : <span className="text-slate-400">removed</span>}
                  </li>
                ))}
              </ul>
              {(item.verificationCleared.phone || item.verificationCleared.email || item.smsConsentReset) && (
                <div className="mt-1.5 text-xs text-amber-800">
                  {[
                    item.verificationCleared.phone && 'Phone verification cleared',
                    item.verificationCleared.email && 'Email verification cleared',
                    item.smsConsentReset && 'SMS consent cleared',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
              {item.reason && <div className="mt-1 text-xs text-slate-500">Note: {item.reason}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
