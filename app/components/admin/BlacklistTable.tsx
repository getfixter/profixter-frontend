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
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[960px]">
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
  );
}
