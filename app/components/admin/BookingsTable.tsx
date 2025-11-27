'use client';

import React, { useState } from 'react';
import type { Booking, User } from '@/lib/admin-service';
import BookingStatusSelect from './BookingStatusSelect';
import BookingImageGallery from './BookingImageGallery';
import { formatAddress, sanitizeTel, formatTimeNY } from '@/lib/utils/timezone-helpers';

interface BookingsTableProps {
  bookings: Booking[];
  updateStatus: (bookingId: string, status: string) => Promise<void>;
  users: User[];
}

export default function BookingsTable({
  bookings,
  updateStatus,
  users,
}: BookingsTableProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

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

  const toggleNote = (bookingId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else {
        next.add(bookingId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      'in-progress': 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-6 bookings-table-section">
      {dayKeys.map((day) => (
        <div key={day} className="space-y-3 md:space-y-4">
          {/* Day Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg md:rounded-xl px-4 md:px-6 py-3 md:py-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-white/20 p-1.5 md:p-2 rounded-lg">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-base md:text-xl">
                    {new Date(day).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </h2>
                  <p className="text-blue-100 text-xs md:text-sm">
                    {groups[day].length} booking{groups[day].length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bookings Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-6">
            {groups[day].map((b) => {
              const u = userMap[b.userId] || {};
              const phone = b.phone || u.phone;
              const fullAddress = formatAddress(b.address, b.city, b.state, b.zip);

              return (
                <div
                  key={b._id}
                  className="bg-white rounded-lg md:rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="bg-blue-600 text-white px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-mono font-bold text-xs md:text-sm">
                          #{b.bookingNumber}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-base md:text-lg">
                            {b.name || u.name || 'Unknown User'}
                          </h3>
                          <p className="text-[10px] md:text-xs text-gray-500 font-mono">ID: {b.userId}</p>
                        </div>
                      </div>
                      <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-[10px] md:text-xs font-semibold ${getStatusColor(b.status)} border`}>
                        {b.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 md:p-6 space-y-3 md:space-y-5">
                    {/* Service & Plan */}
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                      <div className="bg-blue-50 rounded-lg p-3 md:p-4 border border-blue-100">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[10px] md:text-xs font-semibold text-blue-600 uppercase">Service</span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm md:text-base">{b.service}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 md:p-4 border border-purple-100">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          <span className="text-[10px] md:text-xs font-semibold text-purple-600 uppercase">Plan</span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm md:text-base">
                          {b.subscription || u.subscription || 'None'}
                        </p>
                      </div>
                    </div>

                    {/* Time & Status Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-4 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-bold text-gray-900 text-sm md:text-base">{formatTimeNY(b.date)}</span>
                      </div>
                      <BookingStatusSelect
                        bookingId={b._id}
                        currentStatus={b.status}
                        onUpdate={updateStatus}
                      />
                    </div>

                    {/* Contact Info */}
                    {phone && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-3 p-3 md:p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2 md:gap-3">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="font-semibold text-gray-900 text-sm md:text-base">{phone}</span>
                        </div>
                        <div className="flex gap-1.5 md:gap-2">
                          <a
                            href={`tel:${sanitizeTel(phone)}`}
                            className="p-1.5 md:p-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition-all active:scale-95 md:hover:scale-110"
                            title="Call"
                          >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </a>
                          <a
                            href={`sms:${sanitizeTel(phone)}`}
                            className="p-1.5 md:p-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-all active:scale-95 md:hover:scale-110"
                            title="SMS"
                          >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {fullAddress && (
                      <div className="p-3 md:p-4 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-start gap-2 md:gap-3">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs md:text-sm text-gray-700 mb-2">{fullAddress}</p>
                            <div className="flex flex-wrap gap-1.5 md:gap-2">
                              <button
                                onClick={() => navigator.clipboard.writeText(fullAddress)}
                                className="px-2 md:px-3 py-1 md:py-1.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 rounded-lg text-[10px] md:text-xs font-semibold transition-all border border-gray-200 hover:border-gray-300"
                              >
                                📋 Copy
                              </button>
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 md:px-3 py-1 md:py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-[10px] md:text-xs font-semibold transition-all"
                              >
                                📍 Maps
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Note */}
                    {b.note && (
                      <div className="p-3 md:p-4 bg-amber-50 rounded-lg border border-amber-100">
                        <button
                          onClick={() => toggleNote(b._id)}
                          className="flex items-center gap-1.5 md:gap-2 font-semibold text-amber-800 mb-2 hover:text-amber-900 transition-colors text-sm md:text-base"
                        >
                          <svg
                            className={`w-3 h-3 md:w-4 md:h-4 transition-transform ${
                              expandedNotes.has(b._id) ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Note
                        </button>
                        {expandedNotes.has(b._id) && (
                          <p className="text-xs md:text-sm text-gray-700 pl-5 md:pl-6 whitespace-pre-wrap">{b.note}</p>
                        )}
                      </div>
                    )}

                    {/* Images */}
                    {b.images && b.images.length > 0 && (
                      <div className="p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-semibold text-slate-700 text-sm md:text-base">
                            Photos ({b.images.length})
                          </span>
                        </div>
                        <BookingImageGallery images={b.images} bookingNumber={b.bookingNumber} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
