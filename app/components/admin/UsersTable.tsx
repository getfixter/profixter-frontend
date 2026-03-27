'use client';

import React, { useMemo, useState } from 'react';
import type { AddressDetailed, User } from '@/lib/admin-service';
import { formatDateNY, getTodayNY } from '@/lib/utils/timezone-helpers';

type PlanFilter = 'all' | 'basic' | 'plus' | 'premium' | 'elite' | 'cancel';

interface UsersTableProps {
  users: User[];
  onSetAddressPlan: (userId: string, addressId: string, plan: string) => void;
  onSetAddressCancellationDate: (
    userId: string,
    addressId: string,
    cancelOnDate: string | null
  ) => Promise<void> | void;
  blacklistByUserId: Map<string, string>;
  onBlacklist: (userId: string) => void;
  onUnblacklist: (blacklistId: string) => void;
  onRunSubscriptionCleanup: () => Promise<void> | void;
}

type FlattenedRow = {
  user: User;
  address: AddressDetailed | null;
  addressText: string;
  rowPlan: PlanFilter;
};

const PLAN_FILTERS: Array<{
  key: PlanFilter;
  label: string;
  accent: string;
  cardClass: string;
  pillClass: string;
}> = [
  {
    key: 'all',
    label: 'All',
    accent: 'All plans',
    cardClass: 'border-slate-300 bg-slate-900 text-white',
    pillClass: 'bg-slate-900 text-white border-slate-900',
  },
  {
    key: 'basic',
    label: 'Basic',
    accent: 'Entry tier',
    cardClass: 'border-sky-200 bg-sky-50 text-sky-900',
    pillClass: 'bg-sky-100 text-sky-900 border-sky-200',
  },
  {
    key: 'plus',
    label: 'Plus',
    accent: 'Growth tier',
    cardClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    pillClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  },
  {
    key: 'premium',
    label: 'Premium',
    accent: 'High value',
    cardClass: 'border-amber-200 bg-amber-50 text-amber-900',
    pillClass: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  {
    key: 'elite',
    label: 'Elite',
    accent: 'Top tier',
    cardClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900',
    pillClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
  },
  {
    key: 'cancel',
    label: 'Cancel',
    accent: 'No active plan',
    cardClass: 'border-rose-200 bg-rose-50 text-rose-900',
    pillClass: 'bg-rose-100 text-rose-900 border-rose-200',
  },
];

function normalizePlan(plan: unknown): PlanFilter {
  const value = String(plan || '').toLowerCase();
  if (value === 'basic' || value === 'plus' || value === 'premium' || value === 'elite') {
    return value;
  }
  return 'cancel';
}

function getAddressText(address: AddressDetailed | null) {
  return address
    ? `${address.line1 || ''}, ${address.city || ''}, ${address.state || ''} ${address.zip || ''}`
        .replace(/\s+/g, ' ')
        .replace(/,\s*,/g, ',')
        .trim()
    : 'No address';
}

function userMatchesPlan(user: User, plan: PlanFilter) {
  if (plan === 'all') return true;

  const addresses = user.addressesDetailed || [];
  if (plan === 'cancel') {
    return !addresses.some((address) => normalizePlan(address?.plan) !== 'cancel');
  }

  return addresses.some((address) => normalizePlan(address?.plan) === plan);
}

function formatPlanLabel(plan: PlanFilter) {
  return plan === 'cancel' ? 'Cancel' : plan.charAt(0).toUpperCase() + plan.slice(1);
}

export default function UsersTable({
  users,
  onSetAddressPlan,
  onSetAddressCancellationDate,
  blacklistByUserId,
  onBlacklist,
  onUnblacklist,
  onRunSubscriptionCleanup,
}: UsersTableProps) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [savingCancellationByAddress, setSavingCancellationByAddress] = useState<Record<string, boolean>>({});
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  const minCancellationDate = getTodayNY();

  const handleSetCancellationDate = async (
    userId: string,
    addressId: string,
    cancelOnDate: string | null
  ) => {
    setSavingCancellationByAddress((current) => ({
      ...current,
      [addressId]: true,
    }));

    try {
      await onSetAddressCancellationDate(userId, addressId, cancelOnDate);
    } finally {
      setSavingCancellationByAddress((current) => ({
        ...current,
        [addressId]: false,
      }));
    }
  };

  const handleRunCleanup = async () => {
    const ok = window.confirm(
      'Run Fix GHL?\n\nStep 1: sync all DB users into GHL.\nStep 2: remove subscription_purchased tag for users with no active subscription.'
    );

    if (!ok) return;

    setIsRunningCleanup(true);

    try {
      await onRunSubscriptionCleanup();
      window.alert('Fix GHL finished.');
    } catch (error) {
      console.error('Fix GHL failed:', error);
      window.alert('Fix GHL failed. Check console or backend response.');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const rows = useMemo(() => {
    const flattened: FlattenedRow[] = [];

    users.forEach((user) => {
      const addresses = user.addressesDetailed || [];

      if (addresses.length > 0) {
        addresses.forEach((address) => {
          flattened.push({
            user,
            address,
            addressText: getAddressText(address),
            rowPlan: normalizePlan(address?.plan),
          });
        });
      } else {
        flattened.push({
          user,
          address: null,
          addressText: 'No address',
          rowPlan: 'cancel',
        });
      }
    });

    flattened.sort((a, b) => {
      const ta = a.user.createdAt ? new Date(a.user.createdAt).getTime() : 0;
      const tb = b.user.createdAt ? new Date(b.user.createdAt).getTime() : 0;
      return tb - ta;
    });

    return flattened;
  }, [users]);

  const planCounts = useMemo(() => {
    return PLAN_FILTERS.reduce<Record<PlanFilter, number>>(
      (acc, filter) => {
        acc[filter.key] = users.filter((user) => userMatchesPlan(user, filter.key)).length;
        return acc;
      },
      {
        all: 0,
        basic: 0,
        plus: 0,
        premium: 0,
        elite: 0,
        cancel: 0,
      }
    );
  }, [users]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter(({ user, addressText, rowPlan }) => {
      const matchesPlan = planFilter === 'all' ? true : rowPlan === planFilter;
      if (!matchesPlan) return false;

      if (!q) return true;

      return [user.userId, user.name, user.email, user.phone, addressText, rowPlan]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(q));
    });
  }, [planFilter, rows, search]);

  const visibleUserCount = useMemo(() => {
    return new Set(filteredRows.map(({ user }) => user._id)).size;
  }, [filteredRows]);

  const visibleBlacklistedCount = useMemo(() => {
    return new Set(
      filteredRows
        .map(({ user }) => user._id)
        .filter((userId) => blacklistByUserId.has(userId))
    ).size;
  }, [blacklistByUserId, filteredRows]);

  const exportCSV = () => {
    const headers = [
      'User ID',
      'Name',
      'Email',
      'Phone',
      'Address',
      'Plan',
      'Created',
      'Blacklisted',
    ];

    const data = filteredRows.map(({ user, addressText, rowPlan }) => {
      const created = user.createdAt ? new Date(user.createdAt).toLocaleString() : '';
      const isBlacklisted = blacklistByUserId.has(user._id) ? 'Yes' : 'No';

      return [
        user.userId,
        user.name || '',
        user.email || '',
        user.phone || '',
        addressText,
        rowPlan,
        created,
        isBlacklisted,
      ];
    });

    const escapeCell = (value: unknown) => {
      const stringValue = String(value ?? '');
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const csvLines = [headers.map(escapeCell).join(',')].concat(
      data.map((row) => row.map(escapeCell).join(','))
    );

    const blob = new Blob([csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeFilterMeta = PLAN_FILTERS.find((filter) => filter.key === planFilter) || PLAN_FILTERS[0];

  const renderCancellationControls = (user: User, address: AddressDetailed, compact = false) => {
    const scheduledDate = address.scheduledCancellationDate || '';
    const isSaving = Boolean(savingCancellationByAddress[address._id]);

    return (
      <div className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Cancel on day
          </span>
          <input
            type="date"
            min={minCancellationDate}
            value={scheduledDate}
            disabled={isSaving}
            onChange={(event) => handleSetCancellationDate(user._id, address._id, event.target.value || null)}
            className={`block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${
              compact ? 'w-full' : 'max-w-[180px] w-full'
            } ${isSaving ? 'cursor-wait opacity-70' : ''}`}
          />
        </label>

        {scheduledDate ? (
          <div className="text-xs font-medium text-amber-700">
            Cancels on {formatDateNY(scheduledDate)} (NY)
          </div>
        ) : (
          <div className="text-xs text-slate-500">Pick a New York day for auto-cancel.</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(135deg,_#0f172a,_#1e293b_55%,_#334155)] px-5 py-6 text-white md:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                Customer CRM
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                Users and subscriptions at a glance
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-200 md:text-base">
                Filter by plan, review accounts fast, and export the exact CRM slice you are working on.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-300">People</div>
                <div className="mt-2 text-2xl font-semibold">{visibleUserCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-300">Rows</div>
                <div className="mt-2 text-2xl font-semibold">{filteredRows.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-300">Blocked</div>
                <div className="mt-2 text-2xl font-semibold">{visibleBlacklistedCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-300">Plan View</div>
                <div className="mt-2 text-lg font-semibold">{activeFilterMeta.label}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-5 md:px-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Plan distribution</div>
              <div className="text-sm text-slate-500">Counts are based on people. Table results below are address-level records.</div>
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Default filter: All
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {PLAN_FILTERS.map((filter) => {
              const isActive = planFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setPlanFilter(filter.key)}
                  className={`rounded-2xl border p-4 text-left transition-all ${isActive ? `${filter.cardClass} shadow-lg` : 'border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:shadow-md'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${isActive ? 'text-current/75' : 'text-slate-400'}`}>
                        {filter.accent}
                      </div>
                      <div className="mt-2 text-xl font-semibold">{planCounts[filter.key]}</div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${isActive ? 'border-current/15 bg-white/10 text-current' : filter.pillClass}`}
                    >
                      {filter.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:p-5">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ID, name, email, phone, address, or plan"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span> records for{' '}
              <span className="font-semibold text-slate-900">{formatPlanLabel(planFilter)}</span>
            </div>

            <button
              type="button"
              onClick={handleRunCleanup}
              disabled={isRunningCleanup}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
                isRunningCleanup
                  ? 'cursor-wait bg-amber-400'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isRunningCleanup ? 'Fixing GHL...' : 'Fix GHL'}
            </button>

            {filteredRows.length > 0 && (
              <button
                type="button"
                onClick={exportCSV}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-[24px] border border-slate-200 lg:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="px-4 py-4 text-left text-sm font-semibold">ID</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold">Customer</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold">Contact</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold">Address</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold">Plan</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold">Created</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ user, address, addressText, rowPlan }) => {
                  const blacklistId = blacklistByUserId.get(user._id);
                  const isBlacklisted = Boolean(blacklistId);
                  const planMeta = PLAN_FILTERS.find((filter) => filter.key === rowPlan) || PLAN_FILTERS[0];

                  return (
                    <tr
                      key={`${user._id}-${address?._id || 'noaddr'}`}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 text-sm font-medium text-slate-700">{user.userId}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{user.name || 'Unnamed user'}</span>
                            {address?.isDefault && (
                              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                Default
                              </span>
                            )}
                            {isBlacklisted && (
                              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                Blocked
                              </span>
                            )}
                          </div>
                          <a
                            href={`mailto:${user.email}`}
                            className="text-sm text-sky-700 transition hover:text-sky-900 hover:underline"
                          >
                            {user.email}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {user.phone ? (
                          <div className="space-y-2 text-sm text-slate-700">
                            <div>{user.phone}</div>
                            <div className="flex gap-2">
                              <a
                                href={`tel:${user.phone}`}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Call
                              </a>
                              <a
                                href={`sms:${user.phone}`}
                                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                              >
                                SMS
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No phone</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="text-sm text-slate-700">{addressText}</div>
                          {address?.label && (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {address.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {address ? (
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${planMeta.pillClass}`}>
                              {formatPlanLabel(rowPlan)}
                            </span>
                            <select
                              className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                              value={rowPlan}
                              onChange={(event) =>
                                onSetAddressPlan(user._id, address._id, event.target.value)
                              }
                            >
                              <option value="basic">Basic</option>
                              <option value="plus">Plus</option>
                              <option value="premium">Premium</option>
                              <option value="elite">Elite</option>
                              <option value="cancel">Cancel</option>
                            </select>
                            {rowPlan !== 'cancel' && renderCancellationControls(user, address)}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No address record</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Not available'}
                      </td>
                      <td className="px-4 py-4">
                        {isBlacklisted && blacklistId ? (
                          <button
                            type="button"
                            onClick={() => onUnblacklist(blacklistId)}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onBlacklist(user._id)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Block
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 lg:hidden">
          {filteredRows.map(({ user, address, addressText, rowPlan }) => {
            const blacklistId = blacklistByUserId.get(user._id);
            const isBlacklisted = Boolean(blacklistId);
            const planMeta = PLAN_FILTERS.find((filter) => filter.key === rowPlan) || PLAN_FILTERS[0];

            return (
              <article
                key={`${user._id}-${address?._id || 'noaddr'}`}
                className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="bg-slate-950 px-4 py-4 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{user.name || 'Unnamed user'}</div>
                      <div className="mt-1 text-xs text-slate-300">ID {user.userId}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Not available'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {address?.isDefault && (
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-200">
                          Default
                        </span>
                      )}
                      {isBlacklisted && (
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-200">
                          Blocked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Email</div>
                    <a
                      href={`mailto:${user.email}`}
                      className="mt-1 block break-all text-sm font-medium text-sky-700"
                    >
                      {user.email}
                    </a>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Phone</div>
                    {user.phone ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{user.phone}</span>
                        <div className="flex gap-2">
                          <a
                            href={`tel:${user.phone}`}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                          >
                            Call
                          </a>
                          <a
                            href={`sms:${user.phone}`}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                          >
                            SMS
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-slate-400">No phone</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Address</div>
                        <div className="mt-1 text-sm text-slate-700">{addressText}</div>
                      </div>
                      {address?.label && (
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {address.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Plan</div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${planMeta.pillClass}`}>
                        {formatPlanLabel(rowPlan)}
                      </span>
                    </div>
                    {address ? (
                      <>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                          value={rowPlan}
                          onChange={(event) =>
                            onSetAddressPlan(user._id, address._id, event.target.value)
                          }
                        >
                          <option value="basic">Basic</option>
                          <option value="plus">Plus</option>
                          <option value="premium">Premium</option>
                          <option value="elite">Elite</option>
                          <option value="cancel">Cancel</option>
                        </select>
                        {rowPlan !== 'cancel' && renderCancellationControls(user, address, true)}
                      </>
                    ) : (
                      <div className="text-sm text-slate-400">No address record</div>
                    )}
                  </div>

                  {isBlacklisted && blacklistId ? (
                    <button
                      type="button"
                      onClick={() => onUnblacklist(blacklistId)}
                      className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                    >
                      Restore user
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBlacklist(user._id)}
                      className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
                    >
                      Block user
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {filteredRows.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <div className="text-lg font-semibold text-slate-900">No users match this view</div>
            <p className="mt-2 text-sm text-slate-500">
              Try switching the plan filter back to All or clear the search to widen the CRM list.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}