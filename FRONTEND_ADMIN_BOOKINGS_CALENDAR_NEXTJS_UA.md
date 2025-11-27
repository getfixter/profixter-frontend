# 📅 Адмін Панель: Календар Бронювань з Фотками (Next.js)

## Огляд

Функціональність адмін панелі для перегляду бронювань з інтерактивним календарем, фотографіями та інтеграцією з Google Maps. Базується на існуючій реалізації, адаптована під Next.js App Router.

---

## 🎯 Features

- ✅ **Інтерактивний календар** - react-calendar з бейджами кількості бронювань
- ✅ **Галерея фотографій** - preview + download з AWS S3
- ✅ **Google Maps інтеграція** - одним кліком відкрити адресу
- ✅ **Quick actions** - дзвінок, SMS, копіювання адреси
- ✅ **Фільтрація** - по даті, статусу, пошуку
- ✅ **Групування по днях** - автоматичне розподілення
- ✅ **Зміна статусу** - Pending → Confirmed → Completed → Canceled
- ✅ **Responsive** - mobile-friendly таблиці

---

## 📦 Встановлення Залежностей

```bash
npm install react-calendar
npm install date-fns  # для роботи з датами
```

---

## 📁 Структура Файлів

```
app/
  admin/
    bookings/
      page.tsx                           # Головна сторінка букінгів
    components/
      BookingsCalendar.tsx               # Календар з бейджами
      BookingsTable.tsx                  # Таблиця з фотками
      BookingStatusSelect.tsx            # Dropdown зміни статусу
      BookingImageGallery.tsx            # Галерея фотографій
      BookingsFilters.tsx                # Пошук + фільтри
    styles/
      bookings-calendar.css              # Стилі календаря
      admin-table.css                    # Стилі таблиць
lib/
  utils/
    s3-image-resolver.ts                 # Генерація S3 URLs
    timezone-helpers.ts                  # America/New_York helpers
types/
  admin.ts                               # TypeScript types
```

---

## 🔧 Компоненти

### 1️⃣ BookingsCalendar Component

Інтерактивний календар з індикаторами кількості бронювань.

```tsx
// app/admin/components/BookingsCalendar.tsx
"use client";

import React, { useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "../styles/bookings-calendar.css";
import { formatInTimeZone } from "date-fns-tz";

interface Booking {
  _id: string;
  date: string;
  status: string;
}

interface BookingsCalendarProps {
  bookings: Booking[];
  selectedDate: string | null; // "YYYY-MM-DD"
  onChange: (date: string | null) => void;
}

// YYYY-MM-DD в America/New_York timezone
const ymdNY = (date: Date): string => {
  return formatInTimeZone(date, "America/New_York", "yyyy-MM-dd");
};

export default function BookingsCalendar({
  bookings = [],
  selectedDate,
  onChange,
}: BookingsCalendarProps) {
  // Підрахунок бронювань по днях
  const counts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    bookings.forEach((b) => {
      const key = ymdNY(new Date(b.date));
      countsMap[key] = (countsMap[key] || 0) + 1;
    });
    return countsMap;
  }, [bookings]);

  const value = selectedDate
    ? new Date(`${selectedDate}T12:00:00`)
    : new Date();

  // Badge з кількістю бронювань
  const tileContent = ({ date, view }: any) => {
    if (view !== "month") return null;
    const count = counts[ymdNY(date)] || 0;
    return count ? (
      <span className="bk-cal-dot" title={`${count} booking(s)`}>
        {count}
      </span>
    ) : null;
  };

  // CSS класи для днів
  const tileClassName = ({ date, view }: any) => {
    if (view !== "month") return null;
    const key = ymdNY(date);
    const classes = [];

    if (selectedDate === key) classes.push("bk-cal-selected");
    if (counts[key]) classes.push("bk-cal-has");

    return classes.join(" ");
  };

  // Toggle вибору дня
  const handleDayClick = (date: Date) => {
    const key = ymdNY(date);
    onChange(selectedDate === key ? null : key);
  };

  return (
    <div className="bookings-calendar-wrap">
      <Calendar
        value={value}
        onClickDay={handleDayClick}
        tileContent={tileContent}
        tileClassName={tileClassName}
        showNeighboringMonth={false}
        next2Label={null}
        prev2Label={null}
      />

      <div className="calendar-actions">
        <button
          className="btn btn-ghost"
          onClick={() => onChange(null)}
        >
          Show All
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onChange(ymdNY(new Date()))}
        >
          Today
        </button>
      </div>
    </div>
  );
}
```

**Стилі календаря:**

```css
/* app/admin/styles/bookings-calendar.css */

.bookings-calendar-wrap {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Badge з кількістю */
.bk-cal-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  height: 1.4rem;
  font-size: 0.72rem;
  font-weight: 800;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  margin-left: 0.25rem;
  color: #1e40af;
}

/* Вибраний день */
.bk-cal-selected {
  outline: 2px solid rgba(48, 110, 236, 0.35);
  border-radius: 8px;
}

/* День з бронюваннями */
.bk-cal-has .react-calendar__tile {
  background-image: radial-gradient(
    circle at 50% 90%,
    #e2e8f0 8%,
    transparent 9%
  );
}

.bk-cal-has .react-calendar__tile:hover {
  background-color: #f0f9ff;
}

/* Calendar actions */
.calendar-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e5e7eb;
  background: white;
}

.btn:hover {
  background: #f9fafb;
  transform: translateY(-1px);
}

/* Responsive */
@media (max-width: 640px) {
  .react-calendar {
    width: 100%;
  }

  .bk-cal-dot {
    font-size: 0.65rem;
    min-width: 1.2rem;
    height: 1.2rem;
  }
}
```

---

### 2️⃣ BookingsTable Component

Таблиця з фотографіями, Google Maps та швидкими діями.

```tsx
// app/admin/components/BookingsTable.tsx
"use client";

import React from "react";
import { resolveImageURL } from "@/lib/utils/s3-image-resolver";
import { sanitizeTel, formatAddress } from "@/lib/utils/helpers";
import BookingStatusSelect from "./BookingStatusSelect";
import BookingImageGallery from "./BookingImageGallery";

interface Booking {
  _id: string;
  bookingNumber: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  service: string;
  subscription: string;
  status: string;
  note: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  images: any[];
}

interface User {
  userId: string;
  name: string;
  phone: string;
  subscription: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface BookingsTableProps {
  bookings: Booking[];
  users: Record<string, User>;
  onStatusUpdate: (bookingId: string, status: string) => Promise<void>;
}

export default function BookingsTable({
  bookings,
  users,
  onStatusUpdate,
}: BookingsTableProps) {
  // Групування по днях
  const groupedByDay = bookings.reduce((acc, booking) => {
    const day = new Date(booking.date).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(booking);
    return acc;
  }, {} as Record<string, Booking[]>);

  const dayKeys = Object.keys(groupedByDay).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="bookings-table-container">
      {dayKeys.map((day) => (
        <div key={day} className="day-group">
          <div className="day-header">
            {new Date(day).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Phone</th>
                  <th>Service</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Address</th>
                  <th>Images</th>
                </tr>
              </thead>
              <tbody>
                {groupedByDay[day].map((booking) => {
                  const user = users[booking.userId] || {};
                  const phone = booking.phone || user.phone;
                  const address = formatAddress(booking) || formatAddress(user);

                  return (
                    <tr key={booking._id}>
                      {/* Booking Number */}
                      <td data-label="#">{booking.bookingNumber}</td>

                      {/* User */}
                      <td data-label="User">
                        {booking.userId} — {booking.name || user.name || "-"}
                      </td>

                      {/* Plan */}
                      <td data-label="Plan">
                        {booking.subscription || user.subscription || "-"}
                      </td>

                      {/* Phone with quick actions */}
                      <td data-label="Phone">
                        <div className="cell-actions">
                          <span>{phone || "-"}</span>
                          {phone && (
                            <>
                              <a
                                className="icon-btn"
                                href={`tel:${sanitizeTel(phone)}`}
                                title="Call"
                              >
                                📞
                              </a>
                              <a
                                className="icon-btn"
                                href={`sms:${sanitizeTel(phone)}`}
                                title="SMS"
                              >
                                💬
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Service */}
                      <td data-label="Service">{booking.service}</td>

                      {/* Time */}
                      <td data-label="Time">
                        {new Date(booking.date).toLocaleString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "America/New_York",
                        })}
                      </td>

                      {/* Status Select */}
                      <td data-label="Status">
                        <BookingStatusSelect
                          bookingId={booking._id}
                          currentStatus={booking.status}
                          onUpdate={onStatusUpdate}
                        />
                      </td>

                      {/* Note */}
                      <td data-label="Note">
                        <details>
                          <summary style={{ cursor: "pointer" }}>View</summary>
                          <div className="note-box">{booking.note}</div>
                        </details>
                      </td>

                      {/* Address with Google Maps */}
                      <td data-label="Address">
                        <div className="cell-actions">
                          <span className={address ? "" : "is-empty"}>
                            {address || "— no address —"}
                          </span>
                          {address && (
                            <>
                              <button
                                className="icon-btn"
                                onClick={() =>
                                  navigator.clipboard.writeText(address)
                                }
                                title="Copy"
                              >
                                📋
                              </button>
                              <a
                                className="icon-btn"
                                href={`https://maps.google.com/?q=${encodeURIComponent(
                                  address
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open in Google Maps"
                              >
                                📍
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Images Gallery */}
                      <td data-label="Images">
                        <BookingImageGallery
                          images={booking.images}
                          bookingNumber={booking.bookingNumber}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### 3️⃣ BookingImageGallery Component

Галерея фотографій з preview та download.

```tsx
// app/admin/components/BookingImageGallery.tsx
"use client";

import React from "react";
import { resolveImageURL } from "@/lib/utils/s3-image-resolver";
import Image from "next/image";

interface BookingImageGalleryProps {
  images: any[];
  bookingNumber: string;
}

export default function BookingImageGallery({
  images = [],
  bookingNumber,
}: BookingImageGalleryProps) {
  if (!images.length) {
    return <span className="text-muted">No images</span>;
  }

  return (
    <div className="image-gallery">
      {images.map((img, index) => {
        const url = resolveImageURL(img);
        const filename = `booking-${bookingNumber || "img"}-${index + 1}`;

        return (
          <div key={index} className="image-item">
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              title="View full image"
            >
              <Image
                src={url}
                alt={`booking-${index}`}
                width={66}
                height={66}
                className="booking-thumbnail"
                unoptimized // для S3 URLs
              />
            </a>
            <a
              className="icon-btn icon-btn-download"
              href={url}
              download={filename}
              title="Download"
            >
              ⬇️
            </a>
          </div>
        );
      })}
    </div>
  );
}
```

**Стилі галереї:**

```css
/* app/admin/styles/admin-table.css */

.image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 260px;
}

.image-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.booking-thumbnail {
  width: 66px;
  height: 66px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #eef2f7;
  cursor: pointer;
  transition: transform 0.2s;
}

.booking-thumbnail:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.icon-btn {
  background: white;
  border: 1px solid #edf0f6;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #f9fafb;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.icon-btn-download {
  font-size: 14px;
}
```

---

### 4️⃣ BookingStatusSelect Component

Dropdown для зміни статусу бронювання.

```tsx
// app/admin/components/BookingStatusSelect.tsx
"use client";

import React, { useState } from "react";

interface BookingStatusSelectProps {
  bookingId: string;
  currentStatus: string;
  onUpdate: (bookingId: string, status: string) => Promise<void>;
}

const STATUSES = ["Pending", "Confirmed", "Completed", "Canceled"];

export default function BookingStatusSelect({
  bookingId,
  currentStatus,
  onUpdate,
}: BookingStatusSelectProps) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    setLoading(true);
    try {
      await onUpdate(bookingId, newStatus);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      className="status-select"
      value={currentStatus}
      onChange={handleChange}
      disabled={loading}
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
```

**Стилі:**

```css
.status-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 120px;
}

.status-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-select:hover:not(:disabled) {
  border-color: #9ca3af;
}
```

---

### 5️⃣ S3 Image Resolver Utility

Генерація правильних URLs для фотографій з S3.

```typescript
// lib/utils/s3-image-resolver.ts

const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET || "";
const S3_PREFIX = (process.env.NEXT_PUBLIC_S3_PREFIX || "uploads").replace(
  /^\/+|\/+$/g,
  ""
);

export function resolveImageURL(img: any): string {
  if (!img) return "";

  // Object з url полем
  if (typeof img === "object") {
    if (typeof img.url === "string") return img.url;

    // Object з key полем
    if (typeof img.key === "string") {
      return `https://${S3_BUCKET}.s3.amazonaws.com/${img.key.replace(
        /^\/+/,
        ""
      )}`;
    }

    // Інші варіанти (location, Location, src)
    const candidate = img.location || img.Location || img.src || "";
    if (typeof candidate === "string") return candidate;
  }

  // String (прямий URL або key)
  if (typeof img === "string") {
    // Якщо вже повний URL
    if (/^https?:\/\//i.test(img)) return img;

    // Якщо це key - формуємо URL
    const key = img.includes("/")
      ? img.replace(/^\/+/, "")
      : `${S3_PREFIX}/${img}`;
    return `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  return "";
}
```

---

### 6️⃣ Helper Functions

```typescript
// lib/utils/helpers.ts

// Видалення всього крім цифр та +
export function sanitizeTel(phone: string): string {
  return String(phone || "").replace(/[^\d+]/g, "");
}

// Форматування адреси
export function formatAddress(obj: any): string {
  if (!obj) return "";

  const parts = [
    obj.line1 || obj.address,
    obj.city,
    obj.county,
    obj.state,
    obj.zip,
  ].filter(Boolean);

  return parts.join(", ");
}
```

---

### 7️⃣ Timezone Helpers

```typescript
// lib/utils/timezone-helpers.ts
import { formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "America/New_York";

// YYYY-MM-DD в NY timezone
export function ymdNY(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

// HH:mm в NY timezone
export function hhmmNY(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "HH:mm");
}

// Повне форматування
export function formatDateTimeNY(date: Date): string {
  return formatInTimeZone(
    date,
    TIMEZONE,
    "EEEE, MMMM d, yyyy 'at' h:mm a"
  );
}
```

---

### 8️⃣ TypeScript Types

```typescript
// types/admin.ts

export interface Booking {
  _id: string;
  bookingNumber: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  service: string;
  subscription: string;
  status: "Pending" | "Confirmed" | "Completed" | "Canceled";
  note: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  images: BookingImage[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingImage {
  key?: string;
  url?: string;
  location?: string;
  Location?: string;
  src?: string;
}

export interface User {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  subscription: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}
```

---

## 📄 Головна Сторінка Bookings

```tsx
// app/admin/bookings/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import BookingsCalendar from "../components/BookingsCalendar";
import BookingsTable from "../components/BookingsTable";
import { Booking, User } from "@/types/admin";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Fetch bookings and users
  useEffect(() => {
    async function fetchData() {
      if (!token) return;

      setLoading(true);
      try {
        const [bookingsRes, usersRes] = await Promise.all([
          fetch("/api/admin/bookings", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const bookingsData = await bookingsRes.json();
        const usersData = await usersRes.json();

        setBookings(bookingsData);

        // Конвертуємо users в map по userId
        const usersMap = usersData.reduce((acc: any, user: User) => {
          acc[user.userId] = user;
          return acc;
        }, {});
        setUsers(usersMap);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  // Update booking status
  const handleStatusUpdate = async (bookingId: string, status: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      // Refresh bookings
      const bookingsRes = await fetch("/api/admin/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bookingsData = await bookingsRes.json();
      setBookings(bookingsData);
    } catch (error) {
      console.error("Status update error:", error);
      throw error;
    }
  };

  // Фільтрація бронювань
  const filteredBookings = useMemo(() => {
    let result = bookings;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((b) =>
        [b.userId, b.name, b.service, b.email].some((field) =>
          String(field || "").toLowerCase().includes(query)
        )
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(
        (b) => b.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Date filter
    if (selectedDate) {
      result = result.filter((b) => {
        const bookingDate = new Date(b.date)
          .toISOString()
          .split("T")[0];
        return bookingDate === selectedDate;
      });
    }

    // Sort by date
    return result.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [bookings, searchQuery, statusFilter, selectedDate]);

  // Booking counts
  const bookingCounts = useMemo(() => {
    return bookings.reduce(
      (acc, b) => {
        const status = b.status.toLowerCase();
        if (acc[status] !== undefined) acc[status] += 1;
        return acc;
      },
      { confirmed: 0, pending: 0, completed: 0, canceled: 0 }
    );
  }, [bookings]);

  if (loading) {
    return (
      <div className="admin-loading">
        <div>Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="admin-bookings-page">
      <div className="admin-header">
        <h1>📅 Bookings Management</h1>
        <div className="booking-stats">
          <span className="stat">Total: {bookings.length}</span>
          <span className="stat stat-confirmed">
            Confirmed: {bookingCounts.confirmed}
          </span>
          <span className="stat stat-pending">
            Pending: {bookingCounts.pending}
          </span>
          <span className="stat stat-completed">
            Completed: {bookingCounts.completed}
          </span>
          <span className="stat stat-canceled">
            Canceled: {bookingCounts.canceled}
          </span>
        </div>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, ID, service..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="admin-layout">
        <div className="calendar-sidebar">
          <BookingsCalendar
            bookings={filteredBookings}
            selectedDate={selectedDate}
            onChange={setSelectedDate}
          />
        </div>

        <div className="bookings-main">
          <BookingsTable
            bookings={filteredBookings}
            users={users}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 🎨 Основні Стилі

```css
/* app/admin/styles/admin-table.css */

.admin-bookings-page {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.admin-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.booking-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat {
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  background: #f3f4f6;
  color: #374151;
}

.stat-confirmed {
  background: #dcfce7;
  color: #166534;
}

.stat-pending {
  background: #fef3c7;
  color: #92400e;
}

.stat-completed {
  background: #dbeafe;
  color: #1e40af;
}

.stat-canceled {
  background: #fee2e2;
  color: #991b1b;
}

.admin-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input,
.filter-select {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  min-width: 200px;
}

.search-input {
  flex: 1;
}

.admin-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 24px;
}

.calendar-sidebar {
  position: sticky;
  top: 24px;
  align-self: start;
}

.bookings-main {
  min-width: 0;
}

/* Day groups */
.day-group {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.day-header {
  background: #f9fafb;
  padding: 12px 16px;
  font-weight: 700;
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
}

/* Table styles */
.table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1200px;
}

.admin-table th,
.admin-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  text-align: left;
  vertical-align: top;
}

.admin-table thead th {
  background: #111827;
  color: white;
  font-weight: 700;
  position: sticky;
  top: 0;
  z-index: 10;
}

.admin-table tbody tr:hover {
  background: #f9fafb;
}

.cell-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.note-box {
  max-height: 140px;
  overflow: auto;
  padding: 8px;
  white-space: pre-wrap;
  border: 1px dashed #e5e7eb;
  border-radius: 6px;
  margin-top: 6px;
  font-size: 14px;
  background: #fafafa;
}

.is-empty {
  color: #9ca3af;
  font-style: italic;
}

/* Responsive */
@media (max-width: 1200px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .calendar-sidebar {
    position: static;
  }
}

@media (max-width: 768px) {
  .admin-table thead {
    display: none;
  }

  .admin-table td {
    display: block;
    text-align: right;
    padding-left: 50%;
    position: relative;
  }

  .admin-table td::before {
    content: attr(data-label);
    position: absolute;
    left: 14px;
    font-weight: bold;
    text-align: left;
  }
}
```

---

## ⚙️ Environment Variables

```bash
# .env.local
NEXT_PUBLIC_S3_BUCKET=your-bucket-name
NEXT_PUBLIC_S3_PREFIX=uploads
NEXT_PUBLIC_API_URL=https://profixter.com
```

---

## ✅ Features Summary

| Feature | Description |
|---------|-------------|
| 📅 **Interactive Calendar** | react-calendar з бейджами кількості бронювань |
| 🖼️ **Image Gallery** | Preview thumbnails з AWS S3, download кнопки |
| 📍 **Google Maps** | Одним кліком відкрити адресу в Google Maps |
| 📞 **Quick Actions** | Call, SMS, Copy address прямо з таблиці |
| 🔄 **Status Management** | Dropdown зміна статусу з backend sync |
| 🔍 **Filters** | Date, status, search по імені/ID/service |
| 📊 **Day Grouping** | Автоматичне групування по днях |
| 📱 **Responsive** | Mobile-friendly з adaptive таблицями |
| 🎨 **Modern UI** | Clean design з hover effects |
| ⚡ **TypeScript** | Повна типізація для безпеки |

---

## 🚀 Готово!

Тепер у вас є повна реалізація адмін панелі для бронювань:
- ✅ Інтерактивний календар з індикаторами
- ✅ Галерея фотографій з S3
- ✅ Google Maps інтеграція
- ✅ Швидкі дії (call, SMS, copy)
- ✅ Зміна статусів бронювань
- ✅ Фільтрація та пошук
- ✅ Responsive дизайн
- ✅ TypeScript types

Всі компоненти готові для Next.js App Router! 🎉
