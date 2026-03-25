'use client';

import React from 'react';
import type { User, Booking } from '@/lib/admin-service';

interface QuickStatsProps {
  active: string;
  users: User[];
  bookings: Booking[];
  blacklistCount: number;
}

function StatCard({
  label,
  value,
  code,
  tone,
}: {
  label: string;
  value: number;
  code: string;
  tone: string;
}) {
  return (
    <div className="min-w-[138px] rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-bold ${tone}`}>
          {code}
        </span>
      </div>
    </div>
  );
}

export default function QuickStats({
  active,
  users,
  bookings,
  blacklistCount,
}: QuickStatsProps) {
  const bookingCounts = bookings.reduce(
    (acc, booking) => {
      const status = String(booking.status || '').toLowerCase();
      if (status === 'confirmed') acc.confirmed += 1;
      else if (status === 'pending') acc.pending += 1;
      else if (status === 'completed') acc.completed += 1;
      else if (status === 'canceled') acc.canceled += 1;
      return acc;
    },
    { confirmed: 0, pending: 0, completed: 0, canceled: 0 }
  );

  const subscribedCount = users.filter((user) => {
    const addresses = user.addressesDetailed || [];
    return addresses.some((address) => !!address.plan);
  }).length;

  const stats =
    active === 'users'
      ? [{ label: 'Users', value: users.length, code: 'US', tone: 'border-violet-200 bg-violet-50 text-violet-700' }]
      : active === 'subscribed'
        ? [{ label: 'Subscribed', value: subscribedCount, code: 'SU', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' }]
        : active === 'bookings'
          ? [
              { label: 'Bookings', value: bookings.length, code: 'BK', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
              { label: 'Pending', value: bookingCounts.pending, code: 'PD', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
              { label: 'Confirmed', value: bookingCounts.confirmed, code: 'CF', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
              { label: 'Completed', value: bookingCounts.completed, code: 'CP', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
              { label: 'Canceled', value: bookingCounts.canceled, code: 'CX', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
            ]
          : active === 'blacklist'
            ? [{ label: 'Blacklisted', value: blacklistCount, code: 'BL', tone: 'border-rose-200 bg-rose-50 text-rose-700' }]
            : active === 'techs'
              ? [{ label: 'Techs', value: 0, code: 'TE', tone: 'border-teal-200 bg-teal-50 text-teal-700' }]
              : [];

  if (stats.length === 0) return null;

  return (
    <div className="mb-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-4 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            code={stat.code}
            tone={stat.tone}
          />
        ))}
      </div>
    </div>
  );
}
