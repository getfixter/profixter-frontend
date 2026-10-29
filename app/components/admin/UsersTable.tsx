'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  getCustomerActivity,
  getMembersLoyalty,
  type AddressDetailed,
  type AdminLoyaltyRow,
  type CustomerActivityItem,
  type User,
} from '@/lib/admin-service';
import { formatDateNY, getTodayNY } from '@/lib/utils/timezone-helpers';
import CommunicationHistory from './CommunicationHistory';
import SmsConsentPanel from './SmsConsentPanel';
import CopyAddressButton from './CopyAddressButton';
import { CompletedBookingsChip, CustomerLoyaltyPanel, LoyaltyStrip } from './LoyaltyProgress';
import AdminGiftModal from './AdminGiftModal';
import { GiftIcon } from '@heroicons/react/24/outline';

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
  onDeleteUser: (user: User, confirmation: string) => Promise<void> | void;
  onRunSubscriptionCleanup: () => Promise<void> | void;
  readOnly?: boolean;
  /*
   * Finer than readOnly, for an employee granted All Users but not everything
   * around it. Each defaults to !readOnly, so the owner's table is unchanged.
   * The server enforces each one; these only stop showing a button that would 403.
   */
  canBlacklist?: boolean;
  canDelete?: boolean;
  canFixGhl?: boolean;
  showCustomerPanels?: boolean;
  /* Members view: a loyalty line on every membership row. */
  showLoyalty?: boolean;
  /* Completed visits and Loyalty Progress inside the customer detail. Needs members.read. */
  canViewLoyalty?: boolean;
  /* Owner only: buy a gift membership for this customer through the normal gift checkout. */
  canGift?: boolean;
}

type FlattenedRow = {
  user: User;
  address: AddressDetailed | null;
  addressText: string;
  rowPlan: PlanFilter;
};

type ActivityLimit = 10 | 'all';

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
  if (!address) return 'No address';
  const clean = (value: unknown) => String(value || '').trim();
  const stateZip = [clean(address.state), clean(address.zip)].filter(Boolean).join(' ');
  return [clean(address.line1), clean(address.city), stateZip].filter(Boolean).join(', ') || 'Address details missing';
}

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', apple: 'Apple' };

/*
 * Registration 2.0 signals, as compact chips: what the customer has verified,
 * whether they have a home on file yet, SMS offers consent and how they sign in.
 */
function CustomerChips({ user, hasAddress, dark = false }: { user: User; hasAddress: boolean; dark?: boolean }) {
  const chip = dark
    ? 'rounded-full px-2 py-0.5 text-[11px] font-semibold'
    : 'rounded-full border px-2 py-0.5 text-[11px] font-semibold';
  const tone = {
    good: dark ? 'bg-emerald-500/15 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: dark ? 'bg-sky-500/15 text-sky-200' : 'border-sky-200 bg-sky-50 text-sky-700',
    warn: dark ? 'bg-amber-500/15 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800',
    muted: dark ? 'bg-white/10 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600',
  };
  const providers = (user.authProviders || [])
    .map((provider) => PROVIDER_LABELS[String(provider).toLowerCase()])
    .filter((label): label is string => Boolean(label));

  return (
    <div className="flex flex-wrap gap-1">
      {(user.phoneVerifiedAt || user.phoneVerified) && <span className={`${chip} ${tone.good}`}>Phone verified</span>}
      {(user.emailVerifiedAt || user.emailVerified) && <span className={`${chip} ${tone.good}`}>Email verified</span>}
      {!hasAddress && <span className={`${chip} ${tone.warn}`}>No address yet</span>}
      {user.smsPreferences?.marketingEnabled && <span className={`${chip} ${tone.info}`}>SMS offers: on</span>}
      {providers.map((label) => (
        <span key={label} className={`${chip} ${tone.muted}`}>
          {label}
        </span>
      ))}
    </div>
  );
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

function formatActivityTime(value: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function activityBadgeClass(status: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'failed' || value === 'canceled' || value === 'cancelled' || value === 'blocked') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (value === 'sent' || value === 'completed' || value === 'created' || value === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (value === 'pending' || value === 'confirmed') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function titleCaseActivity(value: string) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatActorRole(role: string) {
  const value = String(role || '').trim();
  if (!value) return '';
  const normalized = value.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'general fixter') return 'General Fixter';
  return titleCaseActivity(normalized);
}

function getActorLine(item: CustomerActivityItem) {
  const actorName = String(item.actorName || '').trim();
  const actorRole = formatActorRole(item.actorRole);
  const isSystem = !actorName || actorName.toLowerCase() === 'system' || actorRole.toLowerCase() === 'system';

  if (isSystem) return 'By System';
  return actorRole ? `By ${actorName} · ${actorRole}` : `By ${actorName}`;
}

function shouldShowActivityStatus(item: CustomerActivityItem) {
  const status = String(item.status || '').trim();
  if (!status) return false;

  const type = String(item.type || '').toLowerCase();
  return (
    type.startsWith('email_') ||
    type.includes('subscription') ||
    type.includes('blacklist') ||
    status.toLowerCase() === 'failed' ||
    status.toLowerCase() === 'blocked'
  );
}

function getActivityDescriptionLines(item: CustomerActivityItem) {
  const lines = Array.isArray(item.descriptionLines) && item.descriptionLines.length
    ? item.descriptionLines
    : String(item.description || '').split(/\n+/);

  return lines.map((line) => String(line || '').trim()).filter(Boolean);
}

export default function UsersTable({
  users,
  onSetAddressPlan,
  onSetAddressCancellationDate,
  blacklistByUserId,
  onBlacklist,
  onUnblacklist,
  onDeleteUser,
  onRunSubscriptionCleanup,
  readOnly = false,
  canBlacklist = !readOnly,
  canDelete = !readOnly,
  canFixGhl = !readOnly,
  showCustomerPanels = true,
  showLoyalty = false,
  canViewLoyalty = false,
  canGift = false,
}: UsersTableProps) {
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [savingCancellationByAddress, setSavingCancellationByAddress] = useState<Record<string, boolean>>({});
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [historyLimit, setHistoryLimit] = useState<ActivityLimit>(10);
  const [historyItems, setHistoryItems] = useState<CustomerActivityItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyUnavailableSources, setHistoryUnavailableSources] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [loyaltyByTrack, setLoyaltyByTrack] = useState<Map<string, AdminLoyaltyRow> | null>(null);
  const [loyaltyFailed, setLoyaltyFailed] = useState(false);

  const [giftTarget, setGiftTarget] = useState<{ user: User; addressId: string | null } | null>(null);

  const minCancellationDate = getTodayNY();

  /*
   * Loaded after the list has drawn and on its own, so the members list never
   * waits on the ledger and a failure here costs only the loyalty lines.
   */
  useEffect(() => {
    if (!showLoyalty) return;
    let cancelled = false;
    setLoyaltyFailed(false);
    void getMembersLoyalty()
      .then((response) => {
        if (cancelled) return;
        setLoyaltyByTrack(new Map(response.rows.map((row) => [`${row.userId}:${row.addressId}`, row])));
      })
      .catch((error) => {
        console.error('Failed to load loyalty progress:', error);
        if (!cancelled) setLoyaltyFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [showLoyalty]);

  const renderLoyalty = (user: User, address: AddressDetailed | null) => {
    if (!address) return <span className="text-xs text-slate-400">No address record</span>;
    if (loyaltyFailed) return <span className="text-xs text-slate-400">Loyalty unavailable</span>;
    if (!loyaltyByTrack) return <div className="h-12 animate-pulse rounded-xl bg-slate-100" />;
    return <LoyaltyStrip row={loyaltyByTrack.get(`${user._id}:${address._id}`)} />;
  };

  useEffect(() => {
    if (!historyUser) return;

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');

    void getCustomerActivity(historyUser._id, historyLimit)
      .then((response) => {
        if (cancelled) return;
        setHistoryItems(response.items || []);
        setHistoryTotal(Number(response.total || 0));
        setHistoryUnavailableSources(response.unavailableSources || []);
      })
      .catch((error) => {
        console.error('Failed to load customer activity:', error);
        if (!cancelled) {
          setHistoryError('Unable to load customer history. Please try again.');
          setHistoryItems([]);
          setHistoryTotal(0);
          setHistoryUnavailableSources([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [historyLimit, historyUser]);

  const openHistory = (selectedUser: User) => {
    setHistoryUser(selectedUser);
    setHistoryLimit(10);
    setHistoryItems([]);
    setHistoryTotal(0);
    setHistoryUnavailableSources([]);
    setHistoryError('');
  };

  const closeHistory = () => {
    setHistoryUser(null);
    setHistoryItems([]);
    setHistoryTotal(0);
    setHistoryUnavailableSources([]);
    setHistoryError('');
  };

  const openDeleteUser = (selectedUser: User) => {
    setDeleteUserTarget(selectedUser);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const closeDeleteUser = () => {
    if (deleteLoading) return;
    setDeleteUserTarget(null);
    setDeleteConfirmation('');
    setDeleteError('');
  };

  const expectedDeleteUserConfirmation = deleteUserTarget
    ? `DELETE ${deleteUserTarget.email || deleteUserTarget.userId}`
    : '';

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserTarget || deleteConfirmation !== expectedDeleteUserConfirmation) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await onDeleteUser(deleteUserTarget, deleteConfirmation);
      setDeleteUserTarget(null);
      setDeleteConfirmation('');
      setDeleteError('');
    } catch (error) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setDeleteError(message || (error instanceof Error ? error.message : 'Failed to delete user.'));
    } finally {
      setDeleteLoading(false);
    }
  };

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
    return rows.filter(({ rowPlan }) => {
      const matchesPlan = planFilter === 'all' ? true : rowPlan === planFilter;
      return matchesPlan;
    });
  }, [planFilter, rows]);

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
      'Completed Bookings',
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
        user.completedBookings ?? 0,
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span> records for{' '}
              <span className="font-semibold text-slate-900">{formatPlanLabel(planFilter)}</span>
            </div>

            {canFixGhl && <button
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
            </button>}

            {!readOnly && filteredRows.length > 0 && (
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
                  {showLoyalty && <th className="min-w-[240px] px-4 py-4 text-left text-sm font-semibold">Loyalty</th>}
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
                          {user.email ? (
                            <a
                              href={`mailto:${user.email}`}
                              className="text-sm text-sky-700 transition hover:text-sky-900 hover:underline"
                            >
                              {user.email}
                            </a>
                          ) : (
                            <span className="text-sm text-slate-400">No email</span>
                          )}
                          <CustomerChips user={user} hasAddress={(user.addressesDetailed || []).length > 0} />
                          <div>
                            <CompletedBookingsChip count={user.completedBookings} />
                          </div>
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
                          {address ? (
                            <div className="flex items-start gap-1.5">
                              <div className="text-sm text-slate-700">{addressText}</div>
                              <CopyAddressButton address={address} className="-mt-1" />
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400">—</div>
                          )}
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
                            {!readOnly && <select
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
                            </select>}
                            {!readOnly && rowPlan !== 'cancel' && renderCancellationControls(user, address)}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No address record</span>
                        )}
                      </td>
                      {showLoyalty && <td className="px-4 py-4">{renderLoyalty(user, address)}</td>}
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Not available'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openHistory(user)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                          >
                            History
                          </button>
                          {canGift && (
                            <button
                              type="button"
                              onClick={() => setGiftTarget({ user, addressId: address?._id || null })}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                            >
                              <GiftIcon className="h-4 w-4" aria-hidden="true" />
                              Gift
                            </button>
                          )}
                          {canBlacklist && (isBlacklisted && blacklistId ? (
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
                          ))}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => openDeleteUser(user)}
                              className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">
                        Completed bookings
                        <span className="text-sm font-bold tabular-nums text-white">{user.completedBookings ?? 0}</span>
                      </div>
                      <div className="mt-2">
                        <CustomerChips user={user} hasAddress={(user.addressesDetailed || []).length > 0} dark />
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
                    {user.email ? (
                      <a
                        href={`mailto:${user.email}`}
                        className="mt-1 block break-all text-sm font-medium text-sky-700"
                      >
                        {user.email}
                      </a>
                    ) : (
                      <div className="mt-1 text-sm text-slate-400">No email</div>
                    )}
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
                        {address ? (
                          <div className="mt-1 flex items-start gap-1.5">
                            <div className="text-sm text-slate-700">{addressText}</div>
                            <CopyAddressButton address={address} className="-mt-0.5" />
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-slate-400">—</div>
                        )}
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
                        {!readOnly && <select
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
                        </select>}
                        {!readOnly && rowPlan !== 'cancel' && renderCancellationControls(user, address, true)}
                      </>
                    ) : (
                      <div className="text-sm text-slate-400">No address record</div>
                    )}
                  </div>

                  {showLoyalty && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Loyalty</div>
                      {renderLoyalty(user, address)}
                    </div>
                  )}

                  <div className={canGift ? 'grid grid-cols-[1fr_auto] gap-2' : ''}>
                    <button
                      type="button"
                      onClick={() => openHistory(user)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                    >
                      View history
                    </button>
                    {canGift && (
                      <button
                        type="button"
                        onClick={() => setGiftTarget({ user, addressId: address?._id || null })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                      >
                        <GiftIcon className="h-4 w-4" aria-hidden="true" />
                        Gift
                      </button>
                    )}
                  </div>

                  {canBlacklist && (isBlacklisted && blacklistId ? (
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
                  ))}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => openDeleteUser(user)}
                      className="w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700"
                    >
                      Delete user
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
              Try switching the plan filter back to All or clear the top search to widen the CRM list.
            </p>
          </div>
        )}
      </section>

      {historyUser && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={closeHistory}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                    Customer activity
                  </div>
                  <div className="mt-1 text-xl font-black leading-tight">
                    {historyUser.name || 'Unnamed user'}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    {historyUser.email || historyUser.phone || 'No email'} · ID {historyUser.userId}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {canGift && (
                    <button
                      type="button"
                      onClick={() => setGiftTarget({ user: historyUser, addressId: null })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-3.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25"
                    >
                      <GiftIcon className="h-4 w-4" aria-hidden="true" />
                      Gift
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeHistory}
                    className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:bg-white/10"
                    aria-label="Close customer history"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
              <div className="text-sm text-slate-600">
                Showing{' '}
                <span className="font-semibold text-slate-900">
                  {historyLimit === 'all' ? historyItems.length : Math.min(historyItems.length, 10)}
                </span>{' '}
                of <span className="font-semibold text-slate-900">{historyTotal}</span> events
              </div>
              <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
                {([10, 'all'] as ActivityLimit[]).map((limitOption) => (
                  <button
                    key={String(limitOption)}
                    type="button"
                    onClick={() => setHistoryLimit(limitOption)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      historyLimit === limitOption
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {limitOption === 10 ? 'Last 10' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-5 py-4 sm:px-6">
              {/*
                * What we are ALLOWED to tell them, above what we actually told
                * them. Support reads these in that order: a missing reminder is
                * explained by the consent state far more often than by a
                * delivery failure, and checking the history first sends people
                * looking for a bug that is not there.
                */}
              {/*
                * Visits and loyalty first: the two things asked about most, and
                * read-only, so they sit above everything that can be acted on.
                */}
              {canViewLoyalty && <div className="mb-5 border-b border-slate-200 pb-5">
                <CustomerLoyaltyPanel key={historyUser._id} userId={historyUser._id} fallbackCompleted={historyUser.completedBookings} />
              </div>}

              {showCustomerPanels && <div className="mb-5 border-b border-slate-200 pb-5">
                <SmsConsentPanel userId={historyUser._id} />
              </div>}

              {/*
                * Every email and text this customer was actually sent, above the
                * activity feed. It answers a different question from the activity
                * log - not "what did they do" but "what did we tell them, and did
                * it arrive" - which is the one support calls start with.
                */}
              {showCustomerPanels && <div className="mb-5 border-b border-slate-200 pb-5">
                <CommunicationHistory userId={historyUser._id} />
              </div>}

              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {historyError}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                  <div className="font-semibold text-slate-900">No Profixter activity found yet</div>
                  <div className="mt-1 text-sm text-slate-500">GHL SMS history is intentionally not included here.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyItems.map((item) => {
                    const descriptionLines = getActivityDescriptionLines(item);
                    const showStatus = shouldShowActivityStatus(item);

                    return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-slate-300 sm:p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-extrabold text-slate-950 sm:text-[15px]">{item.title}</div>
                            {item.relatedBookingNumber && (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                                #{item.relatedBookingNumber}
                              </span>
                            )}
                            {showStatus && (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${activityBadgeClass(item.status)}`}>
                                {item.status}
                              </span>
                            )}
                          </div>
                          {descriptionLines.length > 0 && (
                            <div className="mt-2 space-y-1 text-sm leading-relaxed text-slate-600">
                              {descriptionLines.map((line, index) => (
                                <div key={`${item.id}-line-${index}`}>{line}</div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            {getActorLine(item)}
                          </div>
                        </div>
                        <time className="flex-shrink-0 text-xs font-semibold text-slate-500 sm:text-right">
                          {formatActivityTime(item.timestamp)}
                        </time>
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}

              {!historyLoading && historyUnavailableSources.length > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Not yet fully tracked
                  </div>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-500">
                    {historyUnavailableSources.map((source) => (
                      <li key={source}>• {source}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {giftTarget && (
        <AdminGiftModal
          key={`${giftTarget.user._id}:${giftTarget.addressId || ''}`}
          user={giftTarget.user}
          addressId={giftTarget.addressId}
          onClose={() => setGiftTarget(null)}
        />
      )}

      {deleteUserTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={closeDeleteUser}
        >
          <div
            className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">
                  High risk action
                </div>
                <h3 className="mt-1 text-2xl font-black text-slate-950">Delete User</h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteUser}
                disabled={deleteLoading}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close delete user confirmation"
              >
                ×
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <div className="font-bold">This will permanently remove the customer account.</div>
              <div className="mt-1">
                Deletion is blocked if this customer has active subscriptions or future active bookings.
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-sm text-slate-600">
                Type exactly{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-950">
                  {expectedDeleteUserConfirmation}
                </code>
              </div>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                placeholder={expectedDeleteUserConfirmation}
                autoFocus
              />
            </div>

            {deleteError && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteUser}
                disabled={deleteLoading}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={deleteLoading || deleteConfirmation !== expectedDeleteUserConfirmation}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
