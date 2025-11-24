'use client';

import React from 'react';
import type { User } from '@/lib/admin-service';

interface UsersTableProps {
  users: User[];
  onSetAddressPlan: (userId: string, addressId: string, plan: string) => void;
  blacklistIds: Set<string>;
  onBlacklist: (userId: string) => void;
  onUnblacklist: (blacklistId: string) => void;
}

export default function UsersTable({
  users,
  onSetAddressPlan,
  blacklistIds,
  onBlacklist,
  onUnblacklist,
}: UsersTableProps) {
  // Flatten: one row per address
  const rows: Array<{ user: User; address: any }> = [];
  users.forEach((u) => {
    const addresses = u.addressesDetailed || [];
    if (addresses.length > 0) {
      addresses.forEach((a) => rows.push({ user: u, address: a }));
    } else {
      rows.push({ user: u, address: null });
    }
  });

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
              <th className="px-4 py-4 text-left text-sm font-semibold">Plan</th>
              <th className="px-4 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
        <tbody>
          {rows.map(({ user, address }) => {
            const isBL = blacklistIds.has(user._id);
            const addressText = address
              ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}`
              : 'No address';
            const plan = address?.plan || 'None';

            return (
              <tr
                key={`${user._id}-${address?._id || 'noaddr'}`}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-4 text-sm text-gray-900">{user.userId}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{user.name}</span>
                    {address?.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        Default
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <a
                    href={`mailto:${user.email}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                  >
                    {user.email}
                  </a>
                </td>
                <td className="px-4 py-4">
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">{user.phone}</span>
                      <a
                        href={`tel:${user.phone}`}
                        className="p-1 hover:bg-green-100 rounded transition-colors"
                        title="Call"
                      >
                        📞
                      </a>
                      <a
                        href={`sms:${user.phone}`}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        title="SMS"
                      >
                        💬
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{addressText}</span>
                    {address && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                        {address.label}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {address ? (
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={plan === 'None' ? 'Cancel' : plan}
                      onChange={(e) =>
                        onSetAddressPlan(user._id, address._id, e.target.value)
                      }
                    >
                      <option>Basic</option>
                      <option>Plus</option>
                      <option>Premium</option>
                      <option>Elite</option>
                      <option>Cancel</option>
                    </select>
                  ) : (
                    <em className="text-gray-400 text-sm">—</em>
                  )}
                </td>
                <td className="px-4 py-4">
                  {!isBL ? (
                    <button
                      onClick={() => onBlacklist(user._id)}
                      title="Blacklist"
                      className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                    >
                      ⛔ Block
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnblacklist(user._id)}
                      title="Restore"
                      className="px-3 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors font-medium text-sm"
                    >
                      ✅ Restore
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
  );
}
