'use client';

import React from 'react';
import type { User, Booking } from '@/lib/admin-service';

interface QuickStatsProps {
  active: string;
  users: User[];
  bookings: Booking[];
  blacklistCount: number;
}

export default function QuickStats({
  active,
  users,
  bookings,
  blacklistCount,
}: QuickStatsProps) {
  const bookingCounts = bookings.reduce(
    (acc, b) => {
      const status = String(b.status || '').toLowerCase();
      if (status === 'confirmed') acc.confirmed += 1;
      else if (status === 'pending') acc.pending += 1;
      else if (status === 'completed') acc.completed += 1;
      else if (status === 'canceled') acc.canceled += 1;
      return acc;
    },
    { confirmed: 0, pending: 0, completed: 0, canceled: 0 }
  );

  const subscribedCount = users.filter((u) => {
    const addresses = u.addressesDetailed || [];
    return addresses.some((a) => !!a.plan);
  }).length;

  const StatCard = ({ icon, label, value, color }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-2xl`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-600">{label}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mb-6">
      {active === 'users' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="👤" label="Total Users" value={users.length} color="from-purple-500 to-purple-600" />
        </div>
      )}

      {active === 'subscribed' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="✅" label="Subscribed Users" value={subscribedCount} color="from-green-500 to-green-600" />
        </div>
      )}

      {active === 'bookings' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon="📅" label="Total Bookings" value={bookings.length} color="from-blue-500 to-blue-600" />
          <StatCard icon="⏳" label="Pending" value={bookingCounts.pending} color="from-yellow-500 to-yellow-600" />
          <StatCard icon="✓" label="Confirmed" value={bookingCounts.confirmed} color="from-green-500 to-green-600" />
          <StatCard icon="✔" label="Completed" value={bookingCounts.completed} color="from-indigo-500 to-indigo-600" />
          <StatCard icon="✕" label="Canceled" value={bookingCounts.canceled} color="from-gray-500 to-gray-600" />
        </div>
      )}

      {active === 'blacklist' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="⛔" label="Blacklisted" value={blacklistCount} color="from-red-500 to-red-600" />
        </div>
      )}
    </div>
  );
}
