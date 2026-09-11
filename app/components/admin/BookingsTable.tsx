import { useEffect, useMemo, useState } from "react";
import type { Booking, BookingAdminPatch, BookingAssignee, User } from "@/lib/admin-service";
import BookingStatusSelect from "./BookingStatusSelect";
import BookingImageGallery from "./BookingImageGallery";
import BookingHistory from "./BookingHistory";
import CommunicationHistory from "./CommunicationHistory";
import {
  formatAddress,
  sanitizeTel,
  formatTimeNY,
  formatDateNY,
  toYMDNY,
} from "@/lib/utils/timezone-helpers";

interface BookingsTableProps {
  bookings: Booking[];
  updateStatus: (bookingId: string, status: string, assignedFixterId?: string | null) => Promise<void>;
  users: User[];
  onUpdateBooking: (bookingId: string, patch: BookingAdminPatch) => Promise<void>;
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

/**
 * Which kind of visit this is, for the badge on the card.
 *
 * FULL DAY IS TESTED FIRST, AND THE ORDER IS THE WHOLE FIX.
 *
 * bookingType is the authoritative field - it is the only one of the two with
 * an enum on the model - but accessType is what the other branches key off, and
 * a Full Day carries whichever accessType the customer bought it under. Both
 * spellings exist in production today: one Full Day has accessType "one_time"
 * and one has "membership". Checked in the old order they came out as
 * "One-Time Visit" and "Membership" respectively, so the same job type was
 * mislabelled two different ways depending on how it was paid for.
 *
 * Asking the authoritative field first makes accessType what it actually is
 * here: how it was paid for, not what it is.
 */
function bookingTypeLabel(booking: Booking) {
  if (isFullDayBooking(booking)) return "Full Day";
  if (isOneTimeBooking(booking)) return "One-Time Visit";
  if (booking.accessType === "free_first_visit") return "Free First Visit";
  return "Membership";
}

function isFullDayBooking(booking: Booking) {
  return booking.bookingType === "full_day_visit";
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

/*
 * Full Day is excluded from both one-time branches for the same reason as the
 * badge: one of the two in production carries accessType "one_time", so it was
 * being named "One-Time Visit" and priced "$99 / 90 min" - a real Full Day is
 * neither. Its own service string ("Full Day Fixter") is already correct, so
 * the fix is to stop overriding it rather than to hardcode a second price.
 */
function serviceDisplayName(booking: Booking) {
  if (isFullDayBooking(booking)) return booking.service || "Full Day";
  return isOneTimeBooking(booking) ? "One-Time Visit" : booking.service || "Not set";
}

function serviceDisplayMeta(booking: Booking, user?: User) {
  if (isFullDayBooking(booking)) {
    return booking.subscription || user?.subscription || "Full day visit";
  }
  return isOneTimeBooking(booking)
    ? "$99 / 90 min"
    : booking.subscription || user?.subscription || "No plan";
}

/*
 * "Overdue" means the appointment time has come and gone while the job is still
 * open. booking.date is an absolute instant, so comparing it to now is correct
 * in any timezone the admin happens to be standing in - no NY conversion needed
 * here, and none that could drift. Completed and Canceled jobs are never late:
 * they are finished, whatever the clock says.
 */
function isLate(booking: Booking, now: number) {
  if (!now) return false;
  const status = String(booking.status || "pending").toLowerCase();
  if (["completed", "canceled", "cancelled"].includes(status)) return false;
  const at = new Date(booking.date).getTime();
  return Number.isFinite(at) && at < now;
}

/* Same rule the Unassigned filter chip counts by, so the card and the chip agree. */
function isUnassignedActive(booking: Booking) {
  const status = String(booking.status || "").toLowerCase();
  if (["completed", "canceled", "cancelled"].includes(status)) return false;
  return !String(booking.assignedFixterName || "").trim();
}

/*
 * Only abnormal money states earn a place on the collapsed card. A healthy
 * booking announcing "No separate payment" in green was competing for attention
 * with the things that actually need somebody to act.
 */
function paymentNeedsAttention(booking: Booking) {
  if (booking.reservationIssue?.status) return true;
  const state = String(booking.paymentState || "").toLowerCase();
  return ["pending", "failed", "expired", "refunded"].includes(state);
}

/* YYYY-MM-DD + 1 day, via UTC so a DST change cannot skip or repeat a date. */
function nextYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function dayHeading(ymd: string, sampleISO: string, todayKey: string, tomorrowKey: string) {
  if (ymd === todayKey) return `Today - ${formatDateNY(sampleISO, "EEE, MMM d")}`;
  if (ymd === tomorrowKey) return `Tomorrow - ${formatDateNY(sampleISO, "EEE, MMM d")}`;
  return formatDateNY(sampleISO, "EEEE, MMMM d, yyyy");
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
  const [draftAdminNote, setDraftAdminNote] = useState("");
  const [draftDT, setDraftDT] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);
  const [draftAssigneeId, setDraftAssigneeId] = useState("");
  const [confirmAssignees, setConfirmAssignees] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  /*
   * Zero until the browser has mounted. The server render has no business
   * deciding what is late - it would disagree with the client and React would
   * report a hydration mismatch - so nothing is overdue until we are on the
   * client, and the minute tick keeps the badge honest on a screen left open.
   */
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const toggleExpanded = (bookingId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const userMap = useMemo(
    () =>
      users.reduce<Record<string, User>>((acc, user) => {
        acc[user.userId] = user;
        return acc;
      }, {}),
    [users]
  );

  /*
   * Grouped by the New York calendar day, not the browser's.
   *
   * toDateString() bucketed by whatever timezone the laptop was set to, so an
   * 8pm ET job looked like tomorrow's work to anyone west of the office, and
   * the day headings disagreed with the times printed inside them - which are
   * NY times. The key is now the NY date; the heading is formatted from a real
   * instant in the group so it can never drift either.
   */
  const groups = useMemo(() => {
    const byDay = bookings.reduce<BookingGroups>((acc, booking) => {
      const day = toYMDNY(booking.date);
      (acc[day] ||= []).push(booking);
      return acc;
    }, {});

    /* A service day should read top to bottom the way it will be worked. */
    Object.values(byDay).forEach((dayBookings) =>
      dayBookings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );

    return byDay;
  }, [bookings]);

  /* YYYY-MM-DD sorts chronologically as a string. */
  const dayKeys = useMemo(() => Object.keys(groups).sort(), [groups]);

  const todayKey = now ? toYMDNY(new Date(now)) : "";
  const tomorrowKey = todayKey ? nextYMD(todayKey) : "";

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
    setDraftAdminNote(String(booking.adminNote || ""));
    setDraftDT(nyDateTimeLocalValue(booking.date));
    setDraftPhotos([]);
    setDraftAssigneeId(
      booking.assignedFixterId ||
        assignees.find((assignee) => assignee.isDefaultFixter)?.id ||
        ""
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftNote("");
    setDraftAdminNote("");
    setDraftDT("");
    setDraftPhotos([]);
    setDraftAssigneeId("");
    setSaving(false);
  };

  const saveEdit = async (booking: Booking) => {
    setSaving(true);
    try {
      await onUpdateBooking(booking._id, {
        note: draftNote,
        adminNote: draftAdminNote,
        date: nyLocalToISOString(draftDT),
        ...(canAssign ? { assignedFixterId: draftAssigneeId || null } : {}),
        ...(draftPhotos.length ? { images: draftPhotos } : {}),
      });
      cancelEdit();
    } catch (error) {
      console.error("Save booking edit failed:", error);
      const message =
        (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (error as { message?: string })?.message ||
        "Failed to save booking changes";
      alert(message);
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
    <div className="space-y-4 bookings-table-section">
      {bookings.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div className="text-[13px] text-slate-500">
            <span className="font-semibold text-slate-900">{bookings.length}</span> booking
            {bookings.length !== 1 ? "s" : ""} in view
          </div>

          <button
            type="button"
            onClick={exportCSV}
            className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Export
          </button>
        </div>
      )}

      {dayKeys.map((dayKey) => {
        const dayBookings = groups[dayKey] || [];
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

        const overdueCount = dayBookings.filter((booking) => isLate(booking, now)).length;

        return (
          <section key={dayKey} className="space-y-2">
            {/*
              * The day heading stays put while you scroll its jobs.
              *
              * It used to be a 90px gradient banner that scrolled away, so on a
              * phone you were three jobs deep with no idea which day you were
              * looking at. Slim, sticky and quiet does the same work in a fifth
              * of the height.
              */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  {dayHeading(dayKey, dayBookings[0]?.date || dayKey, todayKey, tomorrowKey)}
                </h2>
                <span className="shrink-0 text-xs text-slate-500">
                  {dayBookings.length} stop{dayBookings.length !== 1 ? "s" : ""}
                </span>
                {overdueCount > 0 && (
                  <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    {overdueCount} overdue
                  </span>
                )}
              </div>

              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Route →
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {dayBookings.map((booking) => {
                const user = userMap[booking.userId];
                const phone = booking.phone || user?.phone || "";
                const email = booking.email || user?.email || "";
                const fullAddress = formatAddress(booking.address, booking.city, booking.state, booking.zip);
                const isEditing = editingId === booking._id;
                const status = String(booking.status || "Pending").toLowerCase();
                const isPending = status === "pending" || !booking.status;
                const hasPhotos = !!booking.images?.length;
                const late = isLate(booking, now);
                const unassigned = isUnassignedActive(booking);
                /* Editing forces the panel open - the fields live inside it. */
                const isExpanded = expandedIds.has(booking._id) || isEditing;

                return (
                  <article
                    key={booking._id}
                    className={`overflow-hidden rounded-xl border bg-white ${
                      late ? "border-rose-200" : unassigned ? "border-amber-200" : "border-slate-200"
                    }`}
                  >
                    {/*
                      * THE SUMMARY - everything needed to triage a job without
                      * opening it: when, who, where, what kind, who is going,
                      * what state it is in, and anything shouting for attention.
                      * Detail that only matters once you have picked a job lives
                      * behind Details, which is also what stops every card in the
                      * list mounting a photo gallery and firing a communications
                      * request nobody asked for.
                      */}
                    <div className="p-3">
                      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-4">
                        <div className="min-w-0 flex-1 xl:flex xl:items-center xl:gap-6">
                          {/*
                            * Identity: when, who, where. On a wide screen the
                            * chips sit beside it rather than under it - a
                            * 1000px column holding 300px of text reads as a
                            * mistake rather than as breathing room.
                            */}
                          <div className="min-w-0 xl:w-[420px] xl:shrink-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* Time is the anchor: the biggest thing on the card. */}
                            <span className="text-[17px] font-bold leading-none tabular-nums text-slate-900">
                              {formatTimeNY(booking.date)}
                            </span>
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${getStatusTone(
                                booking.status
                              )}`}
                            >
                              {booking.status || "Pending"}
                            </span>
                            {late && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 7v5l3 2" />
                                </svg>
                                Overdue
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <h3 className="truncate text-[15px] font-semibold text-slate-900">
                              {booking.name || user?.name || "Unknown user"}
                            </h3>
                            <span className="text-xs font-medium text-indigo-700">
                              {bookingTypeLabel(booking)}
                            </span>
                          </div>

                            {fullAddress && (
                              <p className="mt-0.5 truncate text-[13px] text-slate-600">{fullAddress}</p>
                            )}
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 xl:mt-0 xl:min-w-0 xl:flex-1">
                            {/*
                              * Assigned and unassigned must not look alike: the
                              * one state that needs somebody to act should not
                              * read like the state that needs nothing.
                              */}
                            {booking.assignedFixterName ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                {booking.assignedFixterName}
                              </span>
                            ) : unassigned ? (
                              <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                                <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                  <path d="M12 9v4" />
                                  <path d="M12 17h.01" />
                                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                                </svg>
                                Unassigned
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                                No fixter
                              </span>
                            )}

                            {paymentNeedsAttention(booking) && (
                              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${paymentStateTone(booking)}`}>
                                {paymentStateLabel(booking)}
                              </span>
                            )}

                            {/*
                              * A note or a photo used to be the flat grey word
                              * "Notes" that did nothing. Now it says there is
                              * something to read, and opens it.
                              */}
                            {booking.note && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(booking._id)}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                                title="Has a note"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <path d="M4 6h16M4 12h10M4 18h7" />
                                </svg>
                                Note
                              </button>
                            )}

                            {hasPhotos && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(booking._id)}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                                title="Has photos"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <rect x="3" y="5" width="18" height="14" rx="2" />
                                  <circle cx="8.5" cy="10.5" r="1.5" />
                                  <path d="m21 15-5-5-9 9" />
                                </svg>
                                {booking.images?.length}
                              </button>
                            )}

                            <span className="text-[11px] text-slate-400">#{booking.bookingNumber}</span>
                          </div>
                        </div>

                        {/*
                          * One right-hand rail, because the alternative does not
                          * fit. Below about 840px the identity line, the contact
                          * icons and the four status buttons cannot share a row:
                          * the column left for "8:00 AM / Confirmed / Overdue"
                          * measures 169px at 768px and that line needs 241px, so
                          * the overdue badge wrapped. Stacking the two clusters
                          * into one 264px rail gives the identity 400px at 768px,
                          * and takes a little height off every card above md too.
                          */}
                        <div className="contents md:flex md:w-[264px] md:shrink-0 md:flex-col md:gap-2">
                        <div className="flex items-center gap-1.5">
                          {phone && (
                            <>
                              <a
                                href={`tel:${sanitizeTel(phone)}`}
                                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-700 active:bg-emerald-50 md:h-9 md:w-9"
                                title={`Call ${phone}`}
                                aria-label={`Call ${phone}`}
                              >
                                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </a>
                              <a
                                href={`sms:${sanitizeTel(phone)}`}
                                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 active:bg-slate-100 md:h-9 md:w-9"
                                title="Text"
                                aria-label="Text customer"
                              >
                                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8m-8 4h5m8 5l-3.5-3.5M19 4H5a2 2 0 00-2 2v8a2 2 0 002 2h4l4 4 4-4h2a2 2 0 002-2V6a2 2 0 00-2-2z" />
                                </svg>
                              </a>
                            </>
                          )}

                          {fullAddress && (
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-700 active:bg-blue-50 md:h-9 md:w-9"
                              title="Open in Maps"
                              aria-label="Open in Maps"
                            >
                              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleExpanded(booking._id)}
                            className="ml-auto flex h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 md:h-9"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? "Hide" : "Details"}
                            <svg
                              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              aria-hidden="true"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </div>

                        {/* The most-used control on the screen stays in the summary. */}
                        {!readOnly && (
                          <BookingStatusSelect
                            bookingId={booking._id}
                            currentStatus={booking.status}
                            onUpdate={updateStatus}
                          />
                        )}
                        </div>
                      </div>

                      {/*
                        * Approving a pending job is the single most common thing
                        * done on this screen, so it does not go behind Details.
                        */}
                      {!readOnly && isPending && (
                        <div className="mt-2.5 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 sm:w-fit sm:flex-row sm:items-center">
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
                              className="min-h-[44px] w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-medium text-slate-900 sm:min-h-[38px] sm:w-[320px] sm:flex-none"
                            >
                              <option value="">Unassigned</option>
                              {assignees.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                  {assignee.name} - {assignee.employeePosition}
                                  {assignee.isDefaultFixter ? " (Default)" : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => confirmPending(booking)}
                            disabled={quickActionId === booking._id}
                            className="flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-60 sm:min-h-[38px] sm:shrink-0"
                          >
                            {quickActionId === booking._id ? "Confirming..." : "Confirm / Approve"}
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="space-y-2.5 border-t border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Job detail
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => (isEditing ? cancelEdit() : startEdit(booking))}
                              className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              {isEditing ? "Close edit" : "Edit"}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Time
                            </div>
                            {!isEditing ? (
                              <div className="mt-1 text-sm font-semibold text-slate-900">
                                {formatTimeNY(booking.date)}
                              </div>
                            ) : (
                              <input
                                type="datetime-local"
                                value={draftDT}
                                onChange={(event) => setDraftDT(event.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-sky-400"
                              />
                            )}
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Service
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {serviceDisplayName(booking)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {serviceDisplayMeta(booking, user)}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                                {bookingTypeLabel(booking)}
                              </span>
                              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${paymentStateTone(booking)}`}>
                                {paymentStateLabel(booking)}
                              </span>
                            </div>
                            {booking.selectedTask && (
                              <div className="mt-1.5 text-xs font-medium text-slate-700">
                                Task: {booking.selectedTask}
                              </div>
                            )}
                            {booking.entitlementId && (
                              <div className="mt-1 break-all text-[11px] text-slate-400">
                                Entitlement: {booking.entitlementId}
                              </div>
                            )}
                            {booking.reservationIssue?.status && (
                              <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-800">
                                Reservation review needed
                                {booking.reservationIssue.message && (
                                  <div className="mt-1 font-medium text-rose-700">
                                    {booking.reservationIssue.message}
                                  </div>
                                )}
                                {booking.reservationIssue.holdExpiresAt && (
                                  <div className="mt-1 font-medium text-rose-700">
                                    Protected until {formatTimeNY(booking.reservationIssue.holdExpiresAt)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {isEditing && canAssign && (
                          <label className="block rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Assigned employee
                            <select
                              value={draftAssigneeId}
                              onChange={(event) => setDraftAssigneeId(event.target.value)}
                              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-900 sm:min-h-[38px]"
                            >
                              <option value="">Unassigned</option>
                              {assignees.map((assignee) => (
                                <option key={assignee.id} value={assignee.id}>
                                  {assignee.name} - {assignee.employeePosition}
                                  {assignee.isDefaultFixter ? " (Default)" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Note
                            </div>

                            {isEditing && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(booking)}
                                  disabled={saving}
                                  className="min-h-[36px] rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-60"
                                >
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2.5">
                              <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Customer-facing notes
                                </span>
                                <textarea
                                  value={draftNote}
                                  onChange={(event) => setDraftNote(event.target.value)}
                                  rows={4}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                                  placeholder="Type note here..."
                                />
                              </label>

                              <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Internal admin notes
                                </span>
                                <textarea
                                  value={draftAdminNote}
                                  onChange={(event) => setDraftAdminNote(event.target.value)}
                                  rows={3}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                                  placeholder="Private team note"
                                />
                              </label>

                              <label className="block rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
                                Add appointment photos
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                  multiple
                                  className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800"
                                  onChange={(event) => {
                                    const files = Array.from(event.target.files || []);
                                    setDraftPhotos(files);
                                  }}
                                />
                                {draftPhotos.length > 0 && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    {draftPhotos.length} new photo{draftPhotos.length === 1 ? "" : "s"} selected
                                  </div>
                                )}
                              </label>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="whitespace-pre-wrap text-sm text-slate-700">
                                {booking.note || "No note"}
                              </p>
                              {booking.adminNote && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Internal admin notes
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                    {booking.adminNote}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {(email || fullAddress) && (
                          <div className="flex flex-wrap items-center gap-2">
                            {email && (
                              <a
                                href={`mailto:${email}`}
                                className="inline-flex min-h-[38px] max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                </svg>
                                <span className="truncate">{email}</span>
                              </a>
                            )}
                            {fullAddress && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(fullAddress)}
                                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 12h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy address
                              </button>
                            )}
                          </div>
                        )}

                        {hasPhotos && (
                          <div
                            id={`photos-${booking._id}`}
                            className="rounded-lg border border-slate-200 bg-white p-2.5"
                          >
                            <div className="text-xs font-semibold text-slate-700">
                              Photos ({booking.images?.length})
                            </div>
                            <div className="mt-2">
                              <BookingImageGallery
                                images={booking.images || []}
                                bookingNumber={booking.bookingNumber}
                              />
                            </div>
                          </div>
                        )}

                        <BookingHistory bookingId={booking._id} />

                        {/*
                          * Did the customer actually get told? Scoped to this
                          * booking - the account's password resets and membership
                          * notices would bury the answer - and mounted only now.
                          * It fetches on mount, so rendering one per card meant a
                          * request for every job on the screen whether or not
                          * anybody ever looked at it.
                          */}
                        <CommunicationHistory bookingNumber={String(booking.bookingNumber || "")} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {bookings.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <div className="text-base font-semibold text-slate-900">{emptyMessage}</div>
          <p className="mt-2 text-sm text-slate-500">
            Change the date or filters to widen the tech queue.
          </p>
        </div>
      )}
    </div>
  );
}
