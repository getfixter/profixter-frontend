"use client";

import { useMemo, useState } from "react";
import type { Booking, BookingAssignee, User } from "@/lib/admin-service";
import BookingStatusSelect from "./BookingStatusSelect";
import BookingImageGallery from "./BookingImageGallery";
import BookingHistory from "./BookingHistory";
import { formatAddress, sanitizeTel, formatTimeNY } from "@/lib/utils/timezone-helpers";

interface BookingsTableProps {
  bookings: Booking[];
  updateStatus: (bookingId: string, status: string, assignedFixterId?: string | null) => Promise<void>;
  users: User[];
  onUpdateBooking: (bookingId: string, patch: { note?: string; date?: string; assignedFixterId?: string | null }) => Promise<void>;
  readOnly?: boolean;
  assignees?: BookingAssignee[];
  canAssign?: boolean;
  emptyMessage?: string;
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

function bookingTypeLabel(booking: Booking) {
  if (isOneTimeBooking(booking)) {
    return "One-Time Visit";
  }
  if (booking.accessType === "free_first_visit") return "Free First Visit";
  return "Membership";
}

function isOneTimeBooking(booking: Booking) {
  return booking.bookingType === "one_time_handyman_visit" || booking.accessType === "one_time";
}

function paymentStateLabel(booking: Booking) {
  if (booking.reservationIssue?.status) return "Reservation Review Needed";
  const state = String(booking.paymentState || "").toLowerCase();
  if (!state || state === "not_required") return "No separate payment";
  return state.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function paymentStateTone(booking: Booking) {
  if (booking.reservationIssue?.status) return "bg-rose-50 text-rose-800";
  const state = String(booking.paymentState || "").toLowerCase();
  if (state === "paid") return "bg-emerald-50 text-emerald-700";
  if (state === "pending") return "bg-amber-50 text-amber-800";
  if (state === "failed" || state === "expired" || state === "refunded") {
    return "bg-rose-50 text-rose-800";
  }
  return "bg-slate-50 text-slate-600";
}

function serviceDisplayName(booking: Booking) {
  return isOneTimeBooking(booking) ? "One-Time Visit" : booking.service || "Not set";
}

function serviceDisplayMeta(booking: Booking, user?: User) {
  return isOneTimeBooking(booking)
    ? "$99 / 90 min"
    : booking.subscription || user?.subscription || "No plan";
}

export default function BookingsTable({
  bookings,
  updateStatus,
  users,
  onUpdateBooking,
  readOnly = false,
  assignees = [],
  canAssign = false,
  emptyMessage = "No bookings in this view",
}: BookingsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftDT, setDraftDT] = useState("");
  const [saving, setSaving] = useState(false);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);
  const [draftAssigneeId, setDraftAssigneeId] = useState("");
  const [confirmAssignees, setConfirmAssignees] = useState<Record<string, string>>({});

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
      "Booking Type",
      "Payment State",
      "Selected Task",
      "Entitlement",
      "Reservation Issue",
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
        serviceDisplayName(booking),
        bookingTypeLabel(booking),
        paymentStateLabel(booking),
        booking.selectedTask || "",
        booking.entitlementId || "",
        booking.reservationIssue?.status
          ? `${booking.reservationIssue.status}: ${booking.reservationIssue.message || ""}`
          : "",
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
    setDraftAssigneeId(
      booking.assignedFixterId ||
        assignees.find((assignee) => assignee.isDefaultFixter)?.id ||
        ""
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftNote("");
    setDraftDT("");
    setDraftAssigneeId("");
    setSaving(false);
  };

  const saveEdit = async (booking: Booking) => {
    setSaving(true);
    try {
      await onUpdateBooking(booking._id, {
        note: draftNote,
        date: nyLocalToISOString(draftDT),
        ...(canAssign ? { assignedFixterId: draftAssigneeId || null } : {}),
      });
      cancelEdit();
    } catch (error) {
      console.error("Save booking edit failed:", error);
      alert("Failed to save booking changes");
      setSaving(false);
    }
  };

  const confirmPending = async (booking: Booking) => {
    setQuickActionId(booking._id);
    try {
      const assigneeId =
        confirmAssignees[booking._id] ||
        booking.assignedFixterId ||
        assignees.find((assignee) => assignee.isDefaultFixter)?.id ||
        undefined;
      await updateStatus(booking._id, "Confirmed", canAssign ? assigneeId : undefined);
    } finally {
      setQuickActionId(null);
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
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                    className="flex-shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 active:bg-slate-100"
                  >
                    Route →
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {dayBookings.map((booking) => {
                const user = userMap[booking.userId];
                const phone = booking.phone || user?.phone || "";
                const email = booking.email || user?.email || "";
                const fullAddress = formatAddress(booking.address, booking.city, booking.state, booking.zip);
                const isEditing = editingId === booking._id;
                const status = String(booking.status || "Pending").toLowerCase();
                const isPending = status === "pending" || !booking.status;
                const hasPhotos = !!booking.images?.length;

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
                              className={`rounded-xl border px-2.5 py-1 text-xs font-semibold ${getStatusTone(
                                booking.status
                              )}`}
                            >
                              {booking.status || "Pending"}
                            </span>
                          </div>
                          <h3 className="mt-2 truncate text-base font-semibold text-slate-900">
                            {booking.name || user?.name || "Unknown user"}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                            {booking.note && <span>Notes</span>}
                            {hasPhotos && <span>Photos ({booking.images?.length})</span>}
                            {email && <span className="truncate">{email}</span>}
                            <span className="rounded-full bg-blue-50 px-2 py-1 font-bold text-blue-700">
                              {booking.assignedFixterName || "Unassigned"}
                            </span>
                          </div>
                        </div>

                        {!readOnly && <button
                          type="button"
                          onClick={() => (isEditing ? cancelEdit() : startEdit(booking))}
                          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          {isEditing ? "Close edit" : "Edit"}
                        </button>}
                      </div>

                      {isEditing && canAssign && (
                        <label className="block rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold uppercase tracking-wide text-blue-700">
                          Assigned employee
                          <select
                            value={draftAssigneeId}
                            onChange={(event) => setDraftAssigneeId(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold normal-case text-slate-900"
                          >
                            <option value="">Unassigned</option>
                            {assignees.map((assignee) => (
                              <option key={assignee.id} value={assignee.id}>
                                {assignee.name} — {assignee.employeePosition}
                                {assignee.isDefaultFixter ? " (Default)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
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
                            {serviceDisplayName(booking)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {serviceDisplayMeta(booking, user)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                              {bookingTypeLabel(booking)}
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${paymentStateTone(booking)}`}>
                              {paymentStateLabel(booking)}
                            </span>
                          </div>
                          {booking.selectedTask && (
                            <div className="mt-2 text-xs font-semibold text-slate-700">
                              Task: {booking.selectedTask}
                            </div>
                          )}
                          {booking.entitlementId && (
                            <div className="mt-1 break-all text-[11px] text-slate-400">
                              Entitlement: {booking.entitlementId}
                            </div>
                          )}
                          {booking.reservationIssue?.status && (
                            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-800">
                              Reservation review needed
                              {booking.reservationIssue.message && (
                                <div className="mt-1 font-semibold text-rose-700">
                                  {booking.reservationIssue.message}
                                </div>
                              )}
                              {booking.reservationIssue.holdExpiresAt && (
                                <div className="mt-1 font-semibold text-rose-700">
                                  Protected until {formatTimeNY(booking.reservationIssue.holdExpiresAt)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {!readOnly && isPending && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                            Pending review
                          </div>
                          {canAssign && (
                            <select
                              value={
                                confirmAssignees[booking._id] ??
                                booking.assignedFixterId ??
                                assignees.find((assignee) => assignee.isDefaultFixter)?.id ??
                                ""
                              }
                              onChange={(event) =>
                                setConfirmAssignees((current) => ({
                                  ...current,
                                  [booking._id]: event.target.value,
                                }))
                              }
                              className="mb-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                            >
                              <option value="">Unassigned</option>
                              {assignees.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                  {assignee.name} — {assignee.employeePosition}
                                  {assignee.isDefaultFixter ? " (Default)" : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => confirmPending(booking)}
                            disabled={quickActionId === booking._id}
                            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 text-base font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] active:bg-emerald-700 disabled:opacity-60"
                          >
                            {quickActionId === booking._id ? "Confirming..." : "Confirm / Approve"}
                          </button>
                        </div>
                      )}

                      {!readOnly && <div className="rounded-2xl border border-slate-200 bg-white p-2">
                        <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Status actions
                        </div>
                        <BookingStatusSelect
                          bookingId={booking._id}
                          currentStatus={booking.status}
                          onUpdate={updateStatus}
                        />
                      </div>}

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
                        <div className={`grid gap-2 ${email ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]"}`}>
                          <a
                            href={`tel:${sanitizeTel(phone)}`}
                            className="flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-white active:bg-emerald-600"
                          >
                            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="min-w-0 truncate">Call {phone}</span>
                          </a>
                          <a
                            href={`sms:${sanitizeTel(phone)}`}
                            className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 active:bg-slate-100"
                            title="Text"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8m-8 4h5m8 5l-3.5-3.5M19 4H5a2 2 0 00-2 2v8a2 2 0 002 2h4l4 4 4-4h2a2 2 0 002-2V6a2 2 0 00-2-2z" />
                            </svg>
                          </a>
                          {email && (
                            <a
                              href={`mailto:${email}`}
                              className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 active:bg-slate-100"
                              title="Email"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                            </a>
                          )}
                        </div>
                      )}

                      {fullAddress && (
                        <div className="space-y-1.5">
                          <p className="px-0.5 text-xs font-medium text-slate-500">{fullAddress}</p>
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2.5 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white active:bg-blue-700"
                            >
                              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Open in Maps
                            </a>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(fullAddress)}
                              className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 active:bg-slate-100"
                              title="Copy address"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
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

                      <BookingHistory bookingId={booking._id} />
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
          <div className="text-lg font-semibold text-slate-900">{emptyMessage}</div>
          <p className="mt-2 text-sm text-slate-500">
            Change the date or filters to widen the tech queue.
          </p>
        </div>
      )}
    </div>
  );
}
