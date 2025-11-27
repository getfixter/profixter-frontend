'use client';

import React, { useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './bookings-calendar.css';
import { toYMDNY } from '@/lib/utils/timezone-helpers';
import type { Booking } from '@/lib/admin-service';

interface BookingsCalendarProps {
  bookings: Booking[];
  selectedDate: string | null;
  onChange: (date: string | null) => void;
}

export default function BookingsCalendar({
  bookings = [],
  selectedDate,
  onChange,
}: BookingsCalendarProps) {
  // Підрахунок бронювань по днях
  const counts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    bookings.forEach((b) => {
      const key = toYMDNY(new Date(b.date));
      countsMap[key] = (countsMap[key] || 0) + 1;
    });
    return countsMap;
  }, [bookings]);

  const value = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();

  // Badge з кількістю бронювань
  const tileContent = ({ date, view }: any) => {
    if (view !== 'month') return null;
    const count = counts[toYMDNY(date)] || 0;
    return count ? (
      <span className="bk-cal-dot" title={`${count} booking(s)`}>
        {count}
      </span>
    ) : null;
  };

  // CSS класи для днів
  const tileClassName = ({ date, view }: any) => {
    if (view !== 'month') return null;
    const key = toYMDNY(date);
    const classes = [];

    if (selectedDate === key) classes.push('bk-cal-selected');
    if (counts[key]) classes.push('bk-cal-has');

    return classes.join(' ');
  };

  // Toggle вибору дня
  const handleDayClick = (date: Date) => {
    const key = toYMDNY(date);
    const newSelection = selectedDate === key ? null : key;
    onChange(newSelection);
    
    // Scroll to bookings if date selected
    if (newSelection) {
      setTimeout(() => {
        const bookingsSection = document.querySelector('.bookings-table-section');
        if (bookingsSection) {
          bookingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  return (
    <div className="bookings-calendar-wrap">
      <div className="calendar-header-horizontal">
        <div className="calendar-header-left">
          <div className="calendar-icon-wrapper">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="calendar-title">Bookings Calendar</h3>
            <p className="calendar-subtitle">Click a date to filter bookings</p>
          </div>
        </div>

        <div className="calendar-actions-horizontal">
          <button
            className="btn btn-ghost"
            onClick={() => onChange(null)}
            disabled={!selectedDate}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Show All
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onChange(toYMDNY(new Date()))}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Today
          </button>
        </div>
      </div>

      {selectedDate && (
        <div className="calendar-selection-banner">
          <div className="selection-content">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="selection-label">Showing bookings for</span>
            <span className="selection-date">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="selection-count">
              {counts[selectedDate] || 0} booking{counts[selectedDate] !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      <div className="calendar-container">
        <Calendar
          value={value}
          onClickDay={handleDayClick}
          tileContent={tileContent}
          tileClassName={tileClassName}
          showNeighboringMonth={false}
          next2Label={null}
          prev2Label={null}
          locale="en-US"
        />
      </div>
    </div>
  );
}
