"use client";

import React, { useMemo, useState } from "react";
import type { Booking, User } from "@/lib/admin-service";
import BookingStatusSelect from "./BookingStatusSelect";
import BookingImageGallery from "./BookingImageGallery";
import { formatAddress, sanitizeTel, formatTimeNY } from "@/lib/utils/timezone-helpers";

interface BookingsTableProps {
  bookings: Booking[];
  updateStatus: (bookingId: string, status: string) => Promise<void>;
  users: User[];
  onUpdateBooking: (bookingId: string, patch: { note?: string; date?: string }) => Promise<void>;
}

type BookingGroups = Record<string, Booking[]>;

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function nyDateTimeLocalValue(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function nyLocalToISOString(local: string) {
  if (!local) return "";

  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const pretendUTC = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(pretendUTC);

  const offset = parts.find((part) => part.type === "timeZoneName")?.value || "GMT-0";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return pretendUTC.toISOString();

  const sign = match[1] === "-" ? -1 : 1;
  const offsetHours = Number(match[2] || 0);
  const offsetMinutes = Number(match[3] || 0);
  const totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes);

  return new Date(pretendUTC.getTime() - totalOffsetMinutes * 60_000).toISOString();
}

function getStatusTone(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (normalized === "pending") return "border-amber-200 bg-amber-50 text-amber-800";
  if (normalized === "completed") return "border-sky-200 bg-sky-50 text-sky-800";
  if (normalized === "canceled" || normalized === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function BookingsTable({
  bookings,
  updateStatus,
  users,
  onUpdateBooking,
}: BookingsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftDT, setDraftDT] = useState("");
  const [saving, setSaving] = useState(false);

  const userMap = useMemo(
    () =>
      users.reduce<Record<string, User>>((acc, user) => {
        acc[user.userId] = user;
        return acc;
      }, {}),
    [users]
  );

  const groups = useMemo(() => {
    return bookings.reduce<BookingGroups>((acc, booking) => {
      const day = new Date(booking.date).toDateString();
      (acc[day] ||= []).push(booking);
      return acc;
    }, {});
  }, [bookings]);

  const dayKeys = useMemo(
    () => Object.keys(groups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [groups]
  );

  const exportCSV = () => {
    const headers = [
      "Booking #",
      "Name",
      "User ID",
      "Service",
      "Subscription",
      "Status",
      "Date (NY)",
      "Note",
      "Phone",
      "Address",
    ];

    const data = bookings.map((booking) => {
      const user = userMap[booking.userId];
      const fullAddress = formatAddress(booking.address, booking.city, booking.state, booking.zip);

      return [
        booking.bookingNumber,
        booking.name || user?.name || "",
        booking.userId || "",
        booking.service || "",
        booking.subscription || user?.subscription || "",
        booking.status || "",
        formatTimeNY(booking.date),
        booking.note ? booking.note.replace(/\n/g, " ") : "",
        booking.phone || user?.phone || "",
        fullAddress || "",
      ];
    });

    const csvLines = [headers.map(escapeCsvCell).join(",")].concat(
      data.map((row) => row.map(escapeCsvCell).join(","))
    );

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookings-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startEdit = (booking: Booking) => {
    setEditingId(booking._id);
    setDraftNote(String(booking.note || ""));
    setDraftDT(nyDateTimeLocalValue(booking.date));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftNote("");
    setDraftDT("");
    setSaving(false);
  };

  const saveEdit = async (booking: Booking) => {
    setSaving(true);
    try {
      await onUpdateBooking(booking._id, {
        note: draftNote,
        date: nyLocalToISOString(draftDT),
      });
      cancelEdit();
    } catch (error) {
      console.error("Save booking edit failed:", error);
      alert("Failed to save booking changes");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 bookings-table-section">
      {bookings.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Tech queue
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {bookings.length} booking{bookings.length !== 1 ? "s" : ""} in view
            </div>
          </div>

          <button
            type="button"
            onClick={exportCSV}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Export
          </button>
        </div>
      )}

      {dayKeys.map((day) => {
        const dayBookings = groups[day] || [];
        const confirmedAddresses = dayBookings
          .filter((booking) => String(booking.status || "").toLowerCase() === "confirmed")
          .map((booking) => formatAddress(booking.address, booking.city, booking.state, booking.zip))
          .filter(Boolean);

        const mapsUrl =
          confirmedAddresses.length > 0
            ? (() => {
                const destination = confirmedAddresses[confirmedAddresses.length - 1];
                const waypoints = confirmedAddresses.slice(0, -1);
                const params = new URLSearchParams({
                  api: "1",
                  origin: "My Location",
                  destination,
                });

                if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
                return `https://www.google.com/maps/dir/?${params.toString()}`;
              })()
            : null;

        return (
          <section key={day} className="space-y-3">
            <div className="rounded-[24px] bg-gradient-to-r from-slate-950 to-slate-800 px-4 py-4 text-white shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                    Service day
                  </div>
                  <h2 className="mt-1 truncate text-base font-semibold">
                    {new Date(day).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    {dayBookings.length} stop{dayBookings.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    Route
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {dayBookings.map((booking) => {
                const user = userMap[booking.userId];
                const phone = booking.phone || user?.phone || "";
                const fullAddress = formatAddress(booking.address, booking.city, booking.state, booking.zip);
                const isEditing = editingId === booking._id;

                return (
                  <article
                    key={booking._id}
                    className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-xl bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                              #{booking.bookingNumber}
                            </span>
                            <span
                              className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(
                                booking.status
                              )}`}
                            >
                              {booking.status || "Pending"}
                            </span>
                          </div>
                          <h3 className="mt-2 truncate text-base font-semibold text-slate-900">
                            {booking.name || user?.name || "Unknown user"}
                          </h3>
                          <p className="text-[11px] text-slate-500">ID: {booking.userId}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => (isEditing ? cancelEdit() : startEdit(booking))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          {isEditing ? "Close edit" : "Edit"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Time
                          </div>
                          {!isEditing ? (
                            <div className="mt-2 text-sm font-semibold text-slate-900">
                              {formatTimeNY(booking.date)}
                            </div>
                          ) : (
                            <input
                              type="datetime-local"
                              value={draftDT}
                              onChange={(event) => setDraftDT(event.target.value)}
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                            />
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Service
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">
                            {booking.service || "Not set"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {booking.subscription || user?.subscription || "No plan"}
                          </div>
                        </div>
                      </div>

                      <BookingStatusSelect
                        bookingId={booking._id}
                        currentStatus={booking.status}
                        onUpdate={updateStatus}
                      />

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                            Note
                          </div>

                          {isEditing && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit(booking)}
                                disabled={saving}
                                className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
                              >
                                {saving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <textarea
                            value={draftNote}
                            onChange={(event) => setDraftNote(event.target.value)}
                            rows={4}
                            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                            placeholder="Type note here..."
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-slate-700">
                            {booking.note || "No note"}
                          </p>
                        )}
                      </div>

                      {phone && (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                          <div className="min-w-0 truncate text-sm font-medium text-slate-900">{phone}</div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${sanitizeTel(phone)}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 transition hover:bg-emerald-100"
                              title="Call"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </a>
                            <a
                              href={`sms:${sanitizeTel(phone)}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-white text-sky-700 transition hover:bg-sky-100"
                              title="Text"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8m-8 4h5m8 5l-3.5-3.5M19 4H5a2 2 0 00-2 2v8a2 2 0 002 2h4l4 4 4-4h2a2 2 0 002-2V6a2 2 0 00-2-2z" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      )}

                      {fullAddress && (
                        <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                          <div className="min-w-0 text-sm text-slate-700">{fullAddress}</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(fullAddress)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
                              title="Copy address"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700 transition hover:bg-rose-100"
                              title="Open maps"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      )}

                      {booking.images && booking.images.length > 0 ? (
                        <div
                          id={`photos-${booking._id}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="text-sm font-semibold text-slate-800">
                            Photos ({booking.images.length})
                          </div>
                          <div className="mt-3">
                            <BookingImageGallery
                              images={booking.images}
                              bookingNumber={booking.bookingNumber}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-sm font-semibold text-slate-400">
                          No photos
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {bookings.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <div className="text-lg font-semibold text-slate-900">No bookings in this view</div>
          <p className="mt-2 text-sm text-slate-500">
            Change the date or filters to widen the tech queue.
          </p>
        </div>
      )}
    </div>
  );
}
