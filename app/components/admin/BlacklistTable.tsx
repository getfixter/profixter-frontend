'use client';

import React from 'react';
import type { BlacklistEntry } from '@/lib/admin-service';

interface BlacklistTableProps {
  blacklist: BlacklistEntry[];
  onUnblacklist: (blacklistId: string) => void;
}

export default function BlacklistTable({
  blacklist,
  onUnblacklist,
}: BlacklistTableProps) {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
              <th className="px-4 py-4 text-left text-sm font-semibold">#</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Name</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Email</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Phone</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Address</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Reason</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {blacklist.map((bl) => (
              <tr key={bl._id} className="border-b border-[#edf0f6]">
                <td className="p-3">{bl.userId}</td>
                <td className="p-3">{bl.name || '—'}</td>
                <td className="p-3">
                  <a
                    href={`mailto:${bl.email}`}
                    className="text-[#306EEC] hover:underline"
                  >
                    {bl.email}
                  </a>
                </td>
                <td className="p-3">{bl.phone || '—'}</td>
                <td className="p-3 text-sm">
                  {bl.address || ''}, {bl.city || ''}, {bl.state || ''}{' '}
                  {bl.zip || ''}
                </td>
                <td className="p-3 text-sm text-[#64748b]">{bl.reason || '—'}</td>
                <td className="p-3">
                  <button
                    onClick={() => onUnblacklist(bl._id)}
                    title="Restore"
                    className="px-2 py-1.5 bg-white border border-[#edf0f6] rounded-lg hover:opacity-70 transition-opacity"
                  >
                    ✅
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {blacklist.map((bl) => {
          const fullAddress = [bl.address, bl.city, bl.state, bl.zip]
            .filter(Boolean)
            .join(', ');

          return (
            <div
              key={bl._id}
              className="bg-white rounded-lg shadow-md border border-red-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 border-b border-red-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base">{bl.name || 'Unknown'}</h3>
                    <p className="text-xs text-gray-500 font-mono">ID: {bl.userId}</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold">
                    ⛔ BLOCKED
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Email */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-xs font-semibold text-blue-600 uppercase mb-1">Email</div>
                  <a
                    href={`mailto:${bl.email}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline break-all"
                  >
                    {bl.email}
                  </a>
                </div>

                {/* Phone */}
                {bl.phone && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <div className="text-xs font-semibold text-green-600 uppercase mb-1">Phone</div>
                    <span className="text-sm font-medium text-gray-900">{bl.phone}</span>
                  </div>
                )}

                {/* Address */}
                {fullAddress && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <div className="text-xs font-semibold text-purple-600 uppercase mb-1">Address</div>
                    <p className="text-xs text-gray-700">{fullAddress}</p>
                  </div>
                )}

                {/* Reason */}
                {bl.reason && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Reason</div>
                    <p className="text-sm text-gray-700">{bl.reason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2">
                  <button
                    onClick={() => onUnblacklist(bl._id)}
                    className="w-full px-4 py-2.5 bg-green-50 text-green-600 border border-green-200 rounded-lg active:bg-green-100 font-medium text-sm"
                  >
                    ✅ Restore User
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
