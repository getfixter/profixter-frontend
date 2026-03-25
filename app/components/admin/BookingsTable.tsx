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

type BookingGroup = Record<string, Booking[]>;
type BookingCounts = {
  confirmed: number;
  pending: number;
  completed: number;
  canceled: number;
};

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
  const realUTCms = pretendUTC.getTime() - totalOffsetMinutes * 60_000;

  return new Date(realUTCms).toISOString();
}

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function getStatusTone(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (normalized === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (normalized === "completed") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function countStatuses(bookings: Booking[]): BookingCounts {
  return bookings.reduce<BookingCounts>(
    (acc, booking) => {
      const normalized = String(booking.status || "").toLowerCase();
      if (normalized === "confirmed") acc.confirmed += 1;
      else if (normalized === "pending") acc.pending += 1;
      else if (normalized === "completed") acc.completed += 1;
      else if (normalized === "canceled" || normalized === "cancelled") acc.canceled += 1;
      return acc;
    },
    { confirmed: 0, pending: 0, completed: 0, canceled: 0 }
  );
}

function ActionLink({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition ${tone}`}
    >
      {label}
    </a>
  );
}

export default function BookingsTable({
  bookings,
  updateStatus,
  users,
  onUpdateBooking,
}: BookingsTableProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftDT, setDraftDT] = useState("");
  const [saving, setSaving] = useState(false);

  const userMap = useMemo(
    () => users.reduce<Record<string, User>>((acc, user) => {
      acc[user.userId] = user;
      return acc;
    }, {}),
    [users]
  );

  const groups = useMemo(() => {
    return bookings.reduce<BookingGroup>((acc, booking) => {
      const day = new Date(booking.date).toDateString();
      (acc[day] ||= []).push(booking);
      return acc;
    }, {});
  }, [bookings]);

  const dayKeys = useMemo(
    () => Object.keys(groups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [groups]
  );

  const totals = useMemo(() => countStatuses(bookings), [bookings]);

  const toggleNote = (bookingId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

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

    const rows = bookings.map((booking) => {
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
        fullAddress,
      ];
    });

    const csvLines = [headers.map(escapeCsvCell).join(",")].concat(
      rows.map((row) => row.map(escapeCsvCell).join(","))
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
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Booking command center
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {bookings.length} booking{bookings.length !== 1 ? "s" : ""} in this view
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Fast actions and compact cards for phone-first scheduling.
              </p>
            </div>

            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Export CSV
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Pending</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{totals.pending}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Confirmed</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-900">{totals.confirmed}</div>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Completed</div>
              <div className="mt-2 text-2xl font-semibold text-sky-900">{totals.completed}</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Canceled</div>
              <div className="mt-2 text-2xl font-semibold text-rose-900">{totals.canceled}</div>
            </div>
          </div>
        </section>
      )}

      {dayKeys.map((day) => {
        const dayBookings = groups[day] || [];
        const dayCounts = countStatuses(dayBookings);
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
          <section key={day} className="space-y-3 md:space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-4 text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Service day
                  </div>
                  <h3 className="mt-1 text-lg font-semibold md:text-2xl">
                    {new Date(day).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {dayBookings.length} stop{dayBookings.length !== 1 ? "s" : ""} scheduled
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                    Pending {dayCounts.pending}
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    Confirmed {dayCounts.confirmed}
                  </span>
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100">
                    Completed {dayCounts.completed}
                  </span>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 bg-white text-slate-950 px-4 py-2 text-xs font-semibold transition hover:bg-slate-100"
                    >
                      Open route
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-5">
              {dayBookings.map((booking) => {
                const user = userMap[booking.userId];
                const phone = booking.phone || user?.phone || "";
                const fullAddress = formatAddress(booking.address, booking.city, booking.state, booking.zip);
                const isEditing = editingId === booking._id;
                const showNote = expandedNotes.has(booking._id);

                return (
                  <article
                    key={booking._id}
                    className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 md:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-xl bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
                              #{booking.bookingNumber}
                            </span>
                            <span
                              className={`rounded-xl border px-2.5 py-1 text-xs font-semibold ${getStatusTone(booking.status)}`}
                            >
                              {booking.status || "Pending"}
                            </span>
                          </div>
                          <h4 className="mt-3 text-lg font-semibold text-slate-900">
                            {booking.name || user?.name || "Unknown user"}
                          </h4>
                          <div className="mt-1 text-xs text-slate-500">User ID: {booking.userId}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => (isEditing ? cancelEdit() : startEdit(booking))}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                            isEditing
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {isEditing ? "Close edit" : "Edit"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 md:p-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Time</div>
                          {!isEditing ? (
                            <div className="mt-2 text-sm font-semibold text-slate-900">{formatTimeNY(booking.date)}</div>
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
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Service</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{booking.service || "Not set"}</div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Status and plan
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              {booking.subscription || user?.subscription || "No plan"}
                            </div>
                          </div>
                        </div>
                        <BookingStatusSelect
                          bookingId={booking._id}
                          currentStatus={booking.status}
                          onUpdate={updateStatus}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {phone ? (
                          <>
                            <ActionLink
                              href={`tel:${sanitizeTel(phone)}`}
                              label="Call"
                              tone="border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            />
                            <ActionLink
                              href={`sms:${sanitizeTel(phone)}`}
                              label="SMS"
                              tone="border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                            />
                          </>
                        ) : (
                          <>
                            <div className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">
                              No phone
                            </div>
                            <div className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">
                              No SMS
                            </div>
                          </>
                        )}

                        {fullAddress ? (
                          <>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(fullAddress)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              Copy address
                            </button>
                            <ActionLink
                              href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                              label="Open map"
                              tone="border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                            />
                          </>
                        ) : (
                          <>
                            <div className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">
                              No address
                            </div>
                            <div className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">
                              Maps unavailable
                            </div>
                          </>
                        )}
                      </div>

                      {phone && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Phone</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{phone}</div>
                        </div>
                      )}

                      {fullAddress && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Address</div>
                          <div className="mt-1 text-sm text-slate-700">{fullAddress}</div>
                        </div>
                      )}

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Notes</div>
                          {!isEditing && booking.note && (
                            <button
                              type="button"
                              onClick={() => toggleNote(booking._id)}
                              className="text-xs font-semibold text-amber-800"
                            >
                              {showNote ? "Hide" : "View"}
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={draftNote}
                              onChange={(event) => setDraftNote(event.target.value)}
                              rows={4}
                              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                              placeholder="Type note here..."
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit(booking)}
                                disabled={saving}
                                className="flex-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
                              >
                                {saving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : booking.note ? (
                          <>
                            <p className="text-sm text-slate-700">
                              {showNote ? booking.note : `${booking.note.slice(0, 120)}${booking.note.length > 120 ? "..." : ""}`}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">No note yet.</p>
                        )}
                      </div>

                      {booking.images && booking.images.length > 0 && (
                        <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
                            Photos ({booking.images.length})
                          </summary>
                          <div className="mt-3">
                            <BookingImageGallery
                              images={booking.images}
                              bookingNumber={booking.bookingNumber}
                            />
                          </div>
                        </details>
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
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="text-lg font-semibold text-slate-900">No bookings in this view</div>
          <p className="mt-2 text-sm text-slate-500">
            Try a different date, clear filters, or refresh the admin data.
          </p>
        </div>
      )}
    </div>
  );
}
