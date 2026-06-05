'use client';

import React, { useState } from 'react';

interface BookingStatusSelectProps {
  bookingId: string;
  currentStatus: string;
  onUpdate: (bookingId: string, status: string) => Promise<void>;
}

const STATUSES: { value: string; label: string; idle: string; active: string }[] = [
  {
    value: 'Pending',
    label: 'Pending',
    idle: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    active: 'border-amber-500 bg-amber-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.35)]',
  },
  {
    value: 'Confirmed',
    label: 'Confirm',
    idle: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    active: 'border-emerald-500 bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]',
  },
  {
    value: 'Completed',
    label: 'Done',
    idle: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    active: 'border-sky-500 bg-sky-500 text-white shadow-[0_2px_8px_rgba(14,165,233,0.35)]',
  },
  {
    value: 'Canceled',
    label: 'Cancel',
    idle: 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700',
    active: 'border-rose-500 bg-rose-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.35)]',
  },
];

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
  onUpdate,
}: BookingStatusSelectProps) {
  const [updating, setUpdating] = useState(false);

  const normalized = String(currentStatus || '').toLowerCase();

  const handleSelect = async (value: string) => {
    if (value.toLowerCase() === normalized || updating) return;
    if (
      value.toLowerCase() === "canceled" &&
      !window.confirm("Cancel this booking? This will update the customer-facing visit status.")
    ) {
      return;
    }

    setUpdating(true);
    try {
      await onUpdate(bookingId, value);
    } catch {
      // error handled by parent
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {STATUSES.map(({ value, label, idle, active }) => {
        const isActive = value.toLowerCase() === normalized;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleSelect(value)}
            disabled={updating}
            className={`rounded-[12px] border py-4 text-[12px] font-bold leading-none transition-all active:scale-95 disabled:opacity-60 ${
              isActive ? active : idle
            }`}
          >
            {updating && isActive ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              label
            )}
          </button>
        );
      })}
    </div>
  );
}
