'use client';

import React from 'react';
import type { Booking, User } from '@/lib/admin-service';

interface BookingsTableProps {
  bookings: Booking[];
  updateStatus: (bookingId: string, status: string) => void;
  users: User[];
}

export default function BookingsTable({
  bookings,
  updateStatus,
  users,
}: BookingsTableProps) {
  const userMap = Object.fromEntries(users.map((u) => [u.userId, u]));

  // Group by day
  const groups = bookings.reduce((acc, b) => {
    const day = new Date(b.date).toDateString();
    (acc[day] ||= []).push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  const dayKeys = Object.keys(groups).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <>
      {dayKeys.map((day) => (
        <div
          key={day}
          className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mb-4"
        >
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white font-bold text-lg">
            📅 {new Date(day).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">#</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">User</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Phone</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Service</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Time</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Note</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Address</th>
              </tr>
            </thead>
            <tbody>
              {groups[day].map((b) => {
                const u = userMap[b.userId] || {};
                const phone = b.phone || u.phone;
                const address = `${b.address || ''}, ${b.city || ''}, ${
                  b.state || ''
                } ${b.zip || ''}`.trim();

                return (
                  <tr key={b._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="p-3">{b.bookingNumber}</td>
                    <td className="p-3">
                      {b.userId} — {b.name || u.name || '-'}
                    </td>
                    <td className="p-3">
                      {phone && (
                        <div className="flex items-center gap-2">
                          <span>{phone}</span>
                          <a
                            href={`tel:${phone}`}
                            className="text-xl hover:opacity-70"
                            title="Call"
                          >
                            📞
                          </a>
                          <a
                            href={`sms:${phone}`}
                            className="text-xl hover:opacity-70"
                            title="SMS"
                          >
                            💬
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="p-3">{b.service}</td>
                    <td className="p-3">
                      {new Date(b.date).toLocaleString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'America/New_York',
                      })}
                    </td>
                    <td className="p-3">
                      <select
                        className="px-3 py-2 border border-[#e5e7eb] rounded-lg w-full"
                        value={b.status}
                        onChange={(e) => updateStatus(b._id, e.target.value)}
                      >
                        <option>Pending</option>
                        <option>Confirmed</option>
                        <option>Completed</option>
                        <option>Canceled</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <details className="cursor-pointer">
                        <summary className="text-[#306EEC] hover:underline">
                          View
                        </summary>
                        <div className="mt-2 text-sm text-[#64748b]">
                          {b.note}
                        </div>
                      </details>
                    </td>
                    <td className="p-3 text-sm">{address || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
