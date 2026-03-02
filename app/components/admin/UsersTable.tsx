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

  // Sort by user creation date descending for easier review. Users with no
  // createdAt will be placed at the bottom. This makes the most recent
  // signups appear first.
  rows.sort((a, b) => {
    const ta = a.user.createdAt ? new Date(a.user.createdAt).getTime() : 0;
    const tb = b.user.createdAt ? new Date(b.user.createdAt).getTime() : 0;
    return tb - ta;
  });

  // Generate and download a CSV of the current rows. Only the currently
  // visible data is exported (flattened per address). All text values are
  // wrapped in quotes and internal quotes are escaped.
  const exportCSV = () => {
    const headers = [
      'User ID',
      'Name',
      'Email',
      'Phone',
      'Address',
      'Plan',
      'Created',
      'Blacklisted',
    ];
    const data = rows.map(({ user, address }) => {
      const addressText = address
        ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}`
        : 'No address';
      const planValue = address?.plan ? String(address.plan).toLowerCase() : 'cancel';
      const created = user.createdAt
        ? new Date(user.createdAt).toLocaleString()
        : '';
      const isBL = blacklistIds.has(user._id) ? 'Yes' : 'No';
      return [
        user.userId,
        user.name || '',
        user.email || '',
        user.phone || '',
        addressText,
        planValue,
        created,
        isBL,
      ];
    });
    const escapeCell = (val: any) => {
      const str = String(val ?? '');
      return '"' + str.replace(/"/g, '""') + '"';
    };
    const csvLines = [headers.map(escapeCell).join(',')].concat(
      data.map((row) => row.map(escapeCell).join(','))
    );
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], {
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

  return (
    <>
      {/* Export button */}
      {rows.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={exportCSV}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:shadow-lg active:scale-95 transition-all"
          >
            Export CSV
          </button>
        </div>
      )}

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
    <th className="px-4 py-4 text-left text-sm font-semibold">Plan</th>
    <th className="px-4 py-4 text-left text-sm font-semibold">Created</th> {/* ✅ ADD */}
    <th className="px-4 py-4 text-left text-sm font-semibold">Actions</th>
  </tr>
</thead>

        <tbody>
          {rows.map(({ user, address }) => {
            const isBL = blacklistIds.has(user._id);
            const addressText = address
              ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}`
              : 'No address';
const planValue = address?.plan ? String(address.plan).toLowerCase() : "cancel";

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
                      value={planValue}
                      onChange={(e) =>
                        onSetAddressPlan(user._id, address._id, e.target.value)
                      }
                    >
                      <option value="basic">Basic</option>
<option value="plus">Plus</option>
<option value="premium">Premium</option>
<option value="elite">Elite</option>
<option value="cancel">Cancel</option>

                    </select>
                  ) : (
                    <em className="text-gray-400 text-sm">—</em>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
  {user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
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

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {rows.map(({ user, address }) => {
          const isBL = blacklistIds.has(user._id);
          const addressText = address
            ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}`
            : 'No address';
          const planValue = address?.plan ? String(address.plan).toLowerCase() : "cancel";

          return (
            <div
              key={`${user._id}-${address?._id || 'noaddr'}`}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-base">{user.name}</h3>
                      {address?.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono">ID: {user.userId}</p>
                    <p className="text-xs text-gray-500">
  Created: {user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
</p>

                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Email */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-600 uppercase">Email</span>
                  </div>
                  <a
                    href={`mailto:${user.email}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline break-all"
                  >
                    {user.email}
                  </a>
                </div>

                {/* Phone */}
                {user.phone && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-green-600 uppercase mb-1">Phone</div>
                        <span className="text-sm font-medium text-gray-900">{user.phone}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <a
                          href={`tel:${user.phone}`}
                          className="p-1.5 bg-green-600 text-white rounded-lg active:bg-green-700"
                          title="Call"
                        >
                          📞
                        </a>
                        <a
                          href={`sms:${user.phone}`}
                          className="p-1.5 bg-blue-600 text-white rounded-lg active:bg-blue-700"
                          title="SMS"
                        >
                          💬
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Address */}
                {address && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-xs font-semibold text-purple-600 uppercase">Address</div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-700 text-xs font-semibold">
                        {address.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{addressText}</p>
                  </div>
                )}

                {/* Plan */}
                {address && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <div className="text-xs font-semibold text-amber-600 uppercase mb-2">Plan</div>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={planValue}

                      onChange={(e) =>
                        onSetAddressPlan(user._id, address._id, e.target.value)
                      }
                    >
                      <option value="basic">Basic</option>
<option value="plus">Plus</option>
<option value="premium">Premium</option>
<option value="elite">Elite</option>
<option value="cancel">Cancel</option>

                    </select>
                  </div>
                )}


                {/* Actions */}
                <div className="pt-2">
                  {!isBL ? (
                    <button
                      onClick={() => onBlacklist(user._id)}
                      className="w-full px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg active:bg-red-100 font-medium text-sm"
                    >
                      ⛔ Block User
                    </button>
                  ) : (
                    <button
                      onClick={() => onUnblacklist(user._id)}
                      className="w-full px-4 py-2.5 bg-green-50 text-green-600 border border-green-200 rounded-lg active:bg-green-100 font-medium text-sm"
                    >
                      ✅ Restore User
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
