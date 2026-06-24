'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getEmailLogs } from '@/lib/admin-service';
import type { EmailLogItem, EmailLogResponse } from '@/lib/admin-service';

const STATUS_OPTIONS = ['', 'sent', 'failed'];
const TYPE_OPTIONS = [
  '',
  'transactional',
  'reminder',
  'review',
  'billing',
  'security',
  'admin',
  'campaign',
  'marketing',
];

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Request failed';
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFullTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

function displayNameEmail(name?: string, email?: string) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  if (cleanName && cleanEmail) return `${cleanName} <${cleanEmail}>`;
  return cleanName || cleanEmail || '—';
}

function StatusPill({ status }: { status: EmailLogItem['status'] }) {
  const sent = status === 'sent';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        sent
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-red-50 text-red-700 ring-1 ring-red-200'
      }`}
    >
      {sent ? 'Sent' : 'Failed'}
    </span>
  );
}

export default function EmailHistory() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [emailType, setEmailType] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EmailLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<EmailLogItem | null>(null);

  const filters = useMemo(
    () => ({
      page,
      limit: 25,
      search: search.trim() || undefined,
      status: status || undefined,
      emailType: emailType || undefined,
      templateKey: templateKey.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, emailType, page, search, status, templateKey]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadEmailLogs() {
      setLoading(true);
      setError('');
      try {
        const result = await getEmailLogs(filters);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadEmailLogs();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function resetFilters() {
    setSearch('');
    setStatus('');
    setEmailType('');
    setTemplateKey('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  const items = data?.items || [];
  const latest = items[0] || null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-5 py-5 md:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Delivery visibility
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Email history</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Newest emails are shown first. Search transactional, reminder, campaign, billing, security, and admin emails.
          Full email bodies are not stored.
        </p>
      </header>

      <div className="space-y-5 p-4 md:p-7">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Latest email
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {latest ? (
                <>
                  <StatusPill status={latest.status} />
                  <span className="font-semibold text-slate-950">
                    {latest.templateKey || latest.subject || 'Email'}
                  </span>
                  <span>to {displayNameEmail(latest.recipientName, latest.recipientEmail)}</span>
                  <span className="text-slate-400">•</span>
                  <span>{formatTime(latest.sentAt || latest.failedAt || latest.createdAt)}</span>
                </>
              ) : (
                <span>No emails found yet.</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            Sorted newest first
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1.5 xl:col-span-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Booking #, customer, recipient, subject"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Status
            </span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option ? option[0].toUpperCase() + option.slice(1) : 'All'}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Type
            </span>
            <select
              value={emailType}
              onChange={(event) => {
                setEmailType(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option ? option[0].toUpperCase() + option.slice(1) : 'All'}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Template
            </span>
            <input
              value={templateKey}
              onChange={(event) => {
                setTemplateKey(event.target.value);
                setPage(1);
              }}
              placeholder="booking_reminder_24h"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="hidden grid-cols-[130px_90px_100px_170px_minmax(180px,1fr)_minmax(180px,1fr)_100px_minmax(220px,1.2fr)_minmax(160px,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 xl:grid">
            <div>Time</div>
            <div>Status</div>
            <div>Type</div>
            <div>Template</div>
            <div>Recipient</div>
            <div>Customer</div>
            <div>Booking #</div>
            <div>Subject</div>
            <div>Error</div>
          </div>

          {loading && !items.length ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Loading email history…
            </div>
          ) : !items.length ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No email logs match these filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <article
                  key={item._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(item);
                    }
                  }}
                  className={`grid cursor-pointer gap-3 border-l-4 px-4 py-4 text-sm transition hover:bg-slate-50 xl:grid-cols-[130px_90px_100px_170px_minmax(180px,1fr)_minmax(180px,1fr)_100px_minmax(220px,1.2fr)_minmax(120px,0.8fr)] ${
                    item.status === 'failed'
                      ? 'border-l-red-400 bg-red-50/45'
                      : 'border-l-transparent'
                  }`}
                >
                  <div>
                    <span className="block text-xs font-bold uppercase text-slate-400 xl:hidden">
                      Time
                    </span>
                    <span className="font-medium text-slate-800">
                      {formatTime(item.sentAt || item.failedAt || item.createdAt)}
                    </span>
                  </div>
                  <div>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="text-slate-700">{item.emailType || '—'}</div>
                  <div className="break-all font-semibold text-slate-900">
                    {item.templateKey || '—'}
                  </div>
                  <div className="break-words text-slate-700">
                    {displayNameEmail(item.recipientName, item.recipientEmail)}
                  </div>
                  <div className="break-words text-slate-700">
                    {displayNameEmail(item.customerName, item.customerEmail)}
                  </div>
                  <div className="font-semibold text-slate-800">
                    {item.bookingNumber || '—'}
                  </div>
                  <div className="break-words text-slate-700">{item.subject || '—'}</div>
                  <div className="break-words text-red-700">
                    {item.errorMessage || item.errorCode || (
                      <span className="text-slate-400">View</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {data
              ? `${data.total} result${data.total === 1 ? '' : 's'} · Page ${data.page} of ${data.totalPages}`
              : '—'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={!data || page <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={!data || page >= data.totalPages || loading}
              className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:items-center"
          onClick={() => setSelected(null)}
        >
          <section
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="mb-2">
                  <StatusPill status={selected.status} />
                </div>
                <h3 className="text-lg font-bold text-slate-950">
                  {selected.templateKey || 'Email detail'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatFullTime(selected.sentAt || selected.failedAt || selected.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </header>

            <div className="grid gap-3 px-5 py-5 text-sm sm:grid-cols-2">
              {[
                ['Subject', selected.subject],
                ['Type', selected.emailType],
                ['Source', selected.source],
                ['Recipient', displayNameEmail(selected.recipientName, selected.recipientEmail)],
                ['Customer', displayNameEmail(selected.customerName, selected.customerEmail)],
                ['Booking #', selected.bookingNumber],
                ['Campaign #', selected.campaignNumber],
                ['Provider message ID', selected.providerMessageId],
                ['Error', selected.errorMessage || selected.errorCode || '—'],
                ['Response code', selected.responseCode],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 break-words font-medium text-slate-800">
                    {value || '—'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
