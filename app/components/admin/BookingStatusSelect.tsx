'use client';

import React from 'react';

interface BookingStatusSelectProps {
  bookingId: string;
  currentStatus: string;
  onUpdate: (bookingId: string, status: string) => Promise<void>;
}

const statusConfig = {
  Pending: {
    color: 'border-amber-200 bg-amber-50 text-amber-800',
    label: 'Pending',
  },
  Confirmed: {
    color: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    label: 'Confirmed',
  },
  Completed: {
    color: 'border-sky-200 bg-sky-50 text-sky-800',
    label: 'Completed',
  },
  Canceled: {
    color: 'border-rose-200 bg-rose-50 text-rose-800',
    label: 'Canceled',
  },
};

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
  onUpdate,
}: BookingStatusSelectProps) {
  const config =
    statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.Pending;

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      await onUpdate(bookingId, event.target.value);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div className="relative">
      <select
        className={`w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-semibold outline-none transition focus:ring-4 focus:ring-sky-100 ${config.color}`}
        value={currentStatus}
        onChange={handleChange}
      >
        <option value="Pending">Pending</option>
        <option value="Confirmed">Confirmed</option>
        <option value="Completed">Completed</option>
        <option value="Canceled">Canceled</option>
      </select>

      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-current opacity-70"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
