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
  shortCode,
  colorClass,
}: {
  label: string;
  value: number;
  shortCode: string;
  colorClass: string;
}) {
  return (
    <div className="min-w-[148px] rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
        </div>
        <span
          className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-xs font-bold ${colorClass}`}
        >
          {shortCode}
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
      ? [
          {
            label: 'Total Users',
            value: users.length,
            shortCode: 'US',
            colorClass: 'border-violet-200 bg-violet-50 text-violet-800',
          },
        ]
      : active === 'subscribed'
        ? [
            {
              label: 'Subscribed',
              value: subscribedCount,
              shortCode: 'SU',
              colorClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            },
          ]
        : active === 'bookings'
          ? [
              {
                label: 'All Bookings',
                value: bookings.length,
                shortCode: 'BK',
                colorClass: 'border-blue-200 bg-blue-50 text-blue-800',
              },
              {
                label: 'Pending',
                value: bookingCounts.pending,
                shortCode: 'PD',
                colorClass: 'border-amber-200 bg-amber-50 text-amber-800',
              },
              {
                label: 'Confirmed',
                value: bookingCounts.confirmed,
                shortCode: 'CF',
                colorClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
              },
              {
                label: 'Completed',
                value: bookingCounts.completed,
                shortCode: 'CP',
                colorClass: 'border-sky-200 bg-sky-50 text-sky-800',
              },
              {
                label: 'Canceled',
                value: bookingCounts.canceled,
                shortCode: 'CX',
                colorClass: 'border-rose-200 bg-rose-50 text-rose-800',
              },
            ]
          : active === 'blacklist'
            ? [
                {
                  label: 'Blacklisted',
                  value: blacklistCount,
                  shortCode: 'BL',
                  colorClass: 'border-rose-200 bg-rose-50 text-rose-800',
                },
              ]
            : active === 'techs'
              ? [
                  {
                    label: 'Technicians',
                    value: 0,
                    shortCode: 'TE',
                    colorClass: 'border-teal-200 bg-teal-50 text-teal-800',
                  },
                ]
              : [];

  if (stats.length === 0) return null;

  return (
    <div className="mb-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-3 lg:grid lg:min-w-0 lg:grid-cols-4 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            shortCode={stat.shortCode}
            colorClass={stat.colorClass}
          />
        ))}
      </div>
    </div>
  );
}
