"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  bootstrapCalendarFoundation,
  cancelShadowTimeOff,
  confirmReservationAutoAssignments,
  createShadowTimeOff,
  deleteShadowDayNote,
  getCalendarFoundationStatus,
  getCalendarCutoverReadiness,
  getCalendarCutoverStatus,
  getShadowCalendarDay,
  getShadowCalendarSummary,
  getShadowCompanyTemplate,
  getShadowTechnicianTemplate,
  getShadowTechnicians,
  getShadowTimeOff,
  previewReservationAutoAssignments,
  restoreShadowDay,
  runShadowSlotAction,
  saveShadowDayNote,
  saveShadowDayOverride,
  updateShadowCompanyTemplate,
  updateShadowTechnicianTemplate,
  updateShadowTimeOff,
} from "@/lib/admin-service";
import type {
  CalendarFoundationStatus,
  CalendarCutoverReadiness,
  CalendarCutoverStatus,
  CalendarScope,
  CalendarWeeklyDay,
  ReservationAutoAssignmentReport,
  ShadowCalendarDay,
  ShadowCalendarDaySummary,
  ShadowCompanyTemplate,
  ShadowTechnician,
  ShadowTechnicianTemplate,
  ShadowTimeOff,
} from "@/lib/admin-service";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const TIME_OFF_TYPES = [
  "vacation",
  "sick",
  "personal",
  "training",
  "other",
] as const;
type TimeOffType = (typeof TIME_OFF_TYPES)[number];
const DEFAULT_APPOINTMENT_STARTS = ["08:00", "10:30", "13:00", "15:30"];

function todayNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function previousDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function messageFrom(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    if (data.message) return data.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60
  ).padStart(2, "0")}`;
}

function startsFromIntervals(
  intervals: CalendarWeeklyDay["intervals"],
  stepMinutes: number
) {
  return intervals.flatMap((interval) => {
    const starts = [];
    const start = timeToMinutes(interval.startTime);
    const end = timeToMinutes(interval.endTime);
    for (let minute = start; minute + 90 <= end; minute += stepMinutes) {
      starts.push({
        time: minutesToTime(minute),
        capacity: interval.capacity,
      });
    }
    return starts;
  });
}

function normalizeWeek(
  schedule: CalendarWeeklyDay[],
  fallbackStepMinutes: number
) {
  return Array.from({ length: 7 }, (_, weekday) => {
    const existing = schedule.find((day) => day.weekday === weekday);
    if (!existing) {
      return { weekday, enabled: false, starts: [], intervals: [] };
    }
    return {
      ...existing,
      starts:
        existing.starts?.length
          ? existing.starts
          : startsFromIntervals(
              existing.intervals || [],
              fallbackStepMinutes
            ),
    };
  });
}

function WeeklyScheduleEditor({
  value,
  onChange,
  capacity,
  fallbackStepMinutes,
}: {
  value: CalendarWeeklyDay[];
  onChange: (value: CalendarWeeklyDay[]) => void;
  capacity: boolean;
  fallbackStepMinutes: number;
}) {
  const days = normalizeWeek(value, fallbackStepMinutes);
  const updateDay = (weekday: number, patch: Partial<CalendarWeeklyDay>) => {
    onChange(
      days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day))
    );
  };

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div key={day.weekday} className="rounded-xl border border-slate-200 p-3">
          <label className="flex items-center justify-between gap-3 font-semibold text-slate-800">
            {LONG_WEEKDAYS[day.weekday]}
            <input
              type="checkbox"
              checked={day.enabled}
              onChange={(event) =>
                updateDay(day.weekday, {
                  enabled: event.target.checked,
                  starts:
                    event.target.checked && day.starts.length === 0
                      ? DEFAULT_APPOINTMENT_STARTS.map((time) => ({ time }))
                      : day.starts,
                  intervals: [],
                })
              }
              className="h-5 w-5"
            />
          </label>
          {day.enabled && (
            <div className="mt-3 space-y-2">
              {day.starts.map((start, index) => (
                <div
                  key={`${day.weekday}-${index}`}
                  className="grid grid-cols-[1fr_auto] gap-2"
                >
                  <input
                    type="time"
                    value={start.time}
                    onChange={(event) => {
                      const starts = [...day.starts];
                      starts[index] = {
                        ...start,
                        time: event.target.value,
                      };
                      updateDay(day.weekday, { starts, intervals: [] });
                    }}
                    className="min-w-0 rounded-lg border border-slate-300 px-2 py-2"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateDay(day.weekday, {
                        starts: day.starts.filter(
                          (_, item) => item !== index
                        ),
                        intervals: [],
                      })
                    }
                    className="rounded-lg border border-slate-200 px-3 text-slate-500"
                    aria-label="Remove appointment start"
                  >
                    ×
                  </button>
                  {capacity && (
                    <input
                      type="number"
                      min={0}
                      value={start.capacity ?? ""}
                      onChange={(event) => {
                        const starts = [...day.starts];
                        starts[index] = {
                          ...start,
                          capacity:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        };
                        updateDay(day.weekday, { starts, intervals: [] });
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Optional capacity"
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateDay(day.weekday, {
                    starts: [...day.starts, { time: "08:00" }],
                    intervals: [],
                  })
                }
                className="text-sm font-semibold text-blue-700"
              >
                + Add appointment start
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminCalendarSettings({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState<CalendarFoundationStatus | null>(null);
  const [technicians, setTechnicians] = useState<ShadowTechnician[]>([]);
  const [month, setMonth] = useState(() => {
    const today = todayNY().split("-").map(Number);
    return new Date(today[0], today[1] - 1, 1);
  });
  const [scopeValue, setScopeValue] = useState("company");
  const [summary, setSummary] = useState<ShadowCalendarDaySummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [day, setDay] = useState<ShadowCalendarDay | null>(null);
  const [timeOff, setTimeOff] = useState<ShadowTimeOff[]>([]);
  const [company, setCompany] = useState<ShadowCompanyTemplate | null>(null);
  const [techTemplate, setTechTemplate] =
    useState<ShadowTechnicianTemplate | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTechId, setSettingsTechId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [cutoverStatus, setCutoverStatus] =
    useState<CalendarCutoverStatus | null>(null);
  const [cutoverReadiness, setCutoverReadiness] =
    useState<CalendarCutoverReadiness | null>(null);
  const [cutoverLoading, setCutoverLoading] = useState(false);
  const [assignmentPreview, setAssignmentPreview] =
    useState<ReservationAutoAssignmentReport | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const scope: CalendarScope =
    scopeValue === "company" ? "company" : "technician";
  const technicianId = scope === "technician" ? scopeValue : null;
  const selectedDateIsPast =
    selectedDate !== null && selectedDate < todayNY();
  const foundationReady =
    !!status?.companyTemplateReady &&
    !!status?.technicianTemplatesReady &&
    !!status?.importedLegacyOverridesReady;

  const loadFoundation = useCallback(async () => {
    const [nextStatus, nextTechnicians] = await Promise.all([
      getCalendarFoundationStatus(),
      getShadowTechnicians(),
    ]);
    setStatus(nextStatus);
    setTechnicians(nextTechnicians.filter((technician) => technician.isActive));
  }, []);

  const loadMonth = useCallback(async () => {
    if (!foundationReady) return;
    setLoading(true);
    try {
      setSummary(
        await getShadowCalendarSummary(
          monthKey(month),
          scope,
          technicianId
        )
      );
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, [foundationReady, month, scope, technicianId]);

  const loadDay = useCallback(async () => {
    if (!selectedDate || !foundationReady) return;
    setBusy(true);
    try {
      const [nextDay, nextTimeOff] = await Promise.all([
        getShadowCalendarDay(selectedDate, scope, technicianId),
        getShadowTimeOff(selectedDate, selectedDate, technicianId),
      ]);
      setDay(nextDay);
      setNote(nextDay.note || "");
      setTimeOff(nextTimeOff);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }, [foundationReady, scope, selectedDate, technicianId]);

  useEffect(() => {
    loadFoundation()
      .catch((error) => setNotice(messageFrom(error)))
      .finally(() => setLoading(false));
  }, [loadFoundation]);

  useEffect(() => {
    if (!isAdmin) return;
    getCalendarCutoverStatus()
      .then(setCutoverStatus)
      .catch((error) => setNotice(messageFrom(error)));
  }, [isAdmin]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const refresh = async () => {
    await Promise.all([loadMonth(), loadDay()]);
  };

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice("");
    try {
      await action();
      setNotice(success);
      await refresh();
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };

  const openSettings = async () => {
    setSettingsOpen(true);
    setBusy(true);
    try {
      setCompany(await getShadowCompanyTemplate());
      if (!settingsTechId && technicians[0]) setSettingsTechId(technicians[0].id);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };

  const runCutoverReadiness = async () => {
    setCutoverLoading(true);
    setNotice("");
    try {
      const [nextStatus, readiness] = await Promise.all([
        getCalendarCutoverStatus(),
        getCalendarCutoverReadiness(60),
      ]);
      setCutoverStatus(nextStatus);
      setCutoverReadiness(readiness);
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setCutoverLoading(false);
    }
  };

  const reconcileFoundation = async () => {
    setBusy(true);
    setNotice("");
    try {
      await bootstrapCalendarFoundation();
      await loadFoundation();
      setCutoverReadiness(null);
      setNotice("Imported schedule reconciled. Run readiness again.");
      await refresh();
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };

  const previewAutoAssignments = async () => {
    setAssignmentLoading(true);
    setNotice("");
    try {
      setAssignmentPreview(await previewReservationAutoAssignments());
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setAssignmentLoading(false);
    }
  };

  const confirmAutoAssignments = async () => {
    const bookingIds =
      assignmentPreview?.bookingIds ||
      assignmentPreview?.plannedAssignments.map((entry) => entry.bookingId) ||
      [];
    if (!bookingIds.length) return;
    setAssignmentLoading(true);
    setNotice("");
    try {
      const result = await confirmReservationAutoAssignments(bookingIds);
      setNotice(
        `${result.created} booking${result.created === 1 ? "" : "s"} assigned`
      );
      setAssignmentPreview(null);
      await runCutoverReadiness();
      await refresh();
    } catch (error) {
      setNotice(messageFrom(error));
    } finally {
      setAssignmentLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsOpen || !settingsTechId) return;
    getShadowTechnicianTemplate(settingsTechId)
      .then(setTechTemplate)
      .catch((error) => setNotice(messageFrom(error)));
  }, [settingsOpen, settingsTechId]);

  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate();
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: count }, (_, index) => summary[index] || null),
    ];
  }, [month, summary]);

  if (!status) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Loading calendar foundation…
      </div>
    );
  }

  if (!foundationReady) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
          Scheduling system
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">
          Calendar foundation is not ready
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Initialize the new foundation before using this control center or
          enabling reservation-backed customer booking.
        </p>
        {!!status?.warnings?.length && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {status.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        {isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              mutate(async () => {
                await bootstrapCalendarFoundation();
                await loadFoundation();
              }, "Calendar foundation initialized")
            }
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Initializing…" : "Initialize Calendar Foundation"}
          </button>
        ) : (
          <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">
            An Admin must initialize the calendar foundation.
          </p>
        )}
        {notice && <p className="mt-3 text-sm text-slate-700">{notice}</p>}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Scheduling engine
            </p>
            <h2 className="text-2xl font-black text-slate-900">
              Calendar Control Center
            </h2>
            <p className="text-sm text-slate-500">
              These controls power customer availability when the reservation
              engine feature flag is enabled.
            </p>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800"
          >
            Templates & Settings
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            value={scopeValue}
            onChange={(event) => {
              setScopeValue(event.target.value);
              setSelectedDate(null);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold"
          >
            <option value="company">All Company</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name} — {technician.position}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1)
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-3"
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                const [year, monthNumber] = todayNY().split("-").map(Number);
                setMonth(new Date(year, monthNumber - 1, 1));
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1)
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-3"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {isAdmin && cutoverStatus && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Customer calendar cutover
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">
                Production readiness
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Read-only checks. Running this panel does not enable the engine
                or write reservations.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={assignmentLoading || cutoverLoading}
                onClick={previewAutoAssignments}
                className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {assignmentLoading
                  ? "Checking assignments..."
                  : "Auto Assign Eligible Technicians"}
              </button>
              <button
                type="button"
                disabled={busy || cutoverLoading}
                onClick={reconcileFoundation}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Reconcile imported schedule
              </button>
              <button
                type="button"
                disabled={
                  cutoverLoading ||
                  !cutoverStatus.featureFlags.availabilityPreviewEnabled
                }
                onClick={runCutoverReadiness}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {cutoverLoading ? "Checking…" : "Run 60-day readiness"}
              </button>
            </div>
          </div>

          {assignmentPreview && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">
                    Assignment dry run
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {assignmentPreview.plannedAssignments.length} booking
                    {assignmentPreview.plannedAssignments.length === 1
                      ? ""
                      : "s"}{" "}
                    can be assigned. No changes have been made.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignmentPreview(null)}
                  className="text-sm font-bold text-slate-600"
                >
                  Dismiss
                </button>
              </div>

              {!!assignmentPreview.plannedAssignments.length && (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {assignmentPreview.plannedAssignments.map((entry) => (
                    <div
                      key={entry.bookingId}
                      className="rounded-lg bg-white p-3 text-sm"
                    >
                      <p className="font-bold text-slate-900">
                        {new Date(entry.requestedStart).toLocaleString()} →{" "}
                        {entry.technicianName || entry.technicianId}
                      </p>
                      <p className="text-slate-600">
                        Booking {entry.bookingId} · {entry.assignmentReason}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!!assignmentPreview.issues.length && (
                <details className="mt-3 rounded-lg bg-white p-3 text-sm">
                  <summary className="cursor-pointer font-bold text-rose-800">
                    Cannot auto-assign ({assignmentPreview.issues.length})
                  </summary>
                  <div className="mt-2 space-y-3">
                    {assignmentPreview.issues.map((issue) => (
                      <div key={`${issue.category}-${issue.bookingId}`}>
                        <p className="font-bold text-slate-900">
                          Booking {issue.bookingId}
                          {issue.slotStart
                            ? ` · ${new Date(issue.slotStart).toLocaleString()}`
                            : ""}
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-slate-600">
                          {(issue.techniciansEvaluated || []).map(
                            (technician) => (
                              <li key={technician.id}>
                                {technician.name || technician.id}:{" "}
                                {technician.reason || "Unavailable"}
                                {technician.scheduleSource
                                  ? ` (${technician.scheduleSource})`
                                  : ""}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {!!assignmentPreview.plannedAssignments.length && (
                <button
                  type="button"
                  disabled={assignmentLoading}
                  onClick={confirmAutoAssignments}
                  className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  {assignmentLoading
                    ? "Assigning..."
                    : `Confirm ${assignmentPreview.plannedAssignments.length} assignment${
                        assignmentPreview.plannedAssignments.length === 1
                          ? ""
                          : "s"
                      }`}
                </button>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [
                "Transaction probe",
                cutoverStatus.transactionProbe.verified
                  ? "Passed"
                  : "Not verified",
                cutoverStatus.transactionProbe.verified,
              ],
              [
                "Reservation engine",
                cutoverStatus.featureFlags.reservationEngineEnabled
                  ? "Enabled"
                  : "Disabled",
                !cutoverStatus.featureFlags.reservationEngineEnabled,
              ],
              [
                "Readiness preview",
                cutoverStatus.featureFlags.availabilityPreviewEnabled
                  ? "Enabled"
                  : "Disabled",
                cutoverStatus.featureFlags.availabilityPreviewEnabled,
              ],
              [
                "Audit",
                cutoverReadiness
                  ? cutoverReadiness.blockers.some(
                      (item) => item.category === "reservationAuditIssues"
                    )
                    ? "Issues found"
                    : "Clean"
                  : "Not run",
                !!cutoverReadiness &&
                  !cutoverReadiness.blockers.some(
                    (item) => item.category === "reservationAuditIssues"
                  ),
              ],
              [
                "Backfill dry-run",
                cutoverReadiness
                  ? cutoverReadiness.blockers.some(
                      (item) =>
                        item.category === "reservationBackfillReadiness"
                    )
                    ? "Blocked"
                    : "Ready"
                  : "Not run",
                !!cutoverReadiness &&
                  !cutoverReadiness.blockers.some(
                    (item) =>
                      item.category === "reservationBackfillReadiness"
                  ),
              ],
            ].map(([label, value, ok]) => (
              <div
                key={String(label)}
                className={`rounded-xl border p-3 ${
                  ok
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {String(label)}
                </p>
                <p className="mt-1 font-black text-slate-900">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>

          {cutoverReadiness ? (
            <div
              className={`mt-4 rounded-xl border p-4 ${
                cutoverReadiness.safeToCutOver
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-rose-300 bg-rose-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-slate-900">
                  Safe to cut over: {cutoverReadiness.decision}
                </p>
                <p className="text-sm font-semibold text-slate-600">
                  {cutoverReadiness.range.from}–{cutoverReadiness.range.to}
                </p>
              </div>
              {!!cutoverReadiness.blockers.length && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-900">
                  {cutoverReadiness.blockers.map((item) => (
                    <li key={item.category}>
                      {item.category}: {item.count}
                    </li>
                  ))}
                </ul>
              )}
              {!!cutoverReadiness.warnings.length && (
                <p className="mt-3 text-sm text-amber-900">
                  Legacy migration differences:{" "}
                  {(cutoverReadiness.migrationDifferences ||
                    cutoverReadiness.warnings)
                    .map((item) => `${item.category} (${item.count})`)
                    .join(", ")}
                </p>
              )}
              {!!cutoverReadiness.backfillReadiness.issues?.length && (
                <details className="mt-3 rounded-lg border border-rose-200 bg-white/80 p-3 text-sm">
                  <summary className="cursor-pointer font-bold text-rose-900">
                    Backfill bookings needing attention (
                    {cutoverReadiness.backfillReadiness.issues.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-slate-700">
                    {cutoverReadiness.backfillReadiness.issues
                      .slice(0, 10)
                      .map((issue) => (
                        <li key={`${issue.category}-${issue.bookingId}`}>
                          {issue.category}: booking {issue.bookingId}
                          {issue.slotStart
                            ? ` at ${new Date(issue.slotStart).toLocaleString()}`
                            : ""}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {Object.entries(cutoverReadiness.mismatchCounts).map(
                  ([key, count]) => (
                    <div
                      key={key}
                      className="rounded-lg bg-white/80 px-3 py-2"
                    >
                      <span className="block text-xs text-slate-500">{key}</span>
                      <strong>{count}</strong>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {cutoverStatus.featureFlags.availabilityPreviewEnabled
                ? "Run readiness to load audit, backfill, and mismatch results."
                : "Set ENABLE_CUSTOMER_AVAILABILITY_PREVIEW=true while keeping ENABLE_RESERVATION_ENGINE=false to run readiness."}
            </p>
          )}

          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            {cutoverStatus.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        </section>
      )}

      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {notice}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 text-center text-lg font-black text-slate-900">
          {month.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </div>
        <div className="grid grid-cols-7 bg-slate-50">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="py-2 text-center text-[10px] font-bold uppercase text-slate-500 sm:text-xs"
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarCells.map((item, index) =>
            item ? (
              <button
                key={item.date}
                type="button"
                onClick={() => setSelectedDate(item.date)}
                className={`min-h-24 border-r border-t border-slate-100 p-1.5 text-left transition hover:bg-blue-50 sm:min-h-32 sm:p-2 ${
                  item.date === todayNY() ? "bg-blue-50" : "bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-black text-slate-900">
                    {Number(item.date.slice(-2))}
                  </span>
                  {item.bookingCount > 0 && (
                    <span
                      title={`${item.bookingCount} booking${
                        item.bookingCount === 1 ? "" : "s"
                      }`}
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white shadow-sm sm:h-6 sm:min-w-6 sm:text-xs"
                    >
                      {item.bookingCount}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-[10px] leading-tight text-slate-400 sm:text-xs">
                  <div className="flex flex-wrap gap-1">
                    {item.closed && <span title="Closed">Closed</span>}
                    {item.reducedCapacity && (
                      <span title="Reduced capacity">-Cap</span>
                    )}
                    {item.hasOverrides && (
                      <span title="Custom settings">Custom</span>
                    )}
                    {item.hasTimeOff && <span title="Time off">Off</span>}
                    {item.hasNote && <span title="Note">Note</span>}
                  </div>
                  {!item.closed && item.openSlotCount > 0 && (
                    <span className="mt-1 block text-emerald-600/70">
                      {item.openSlotCount} open
                    </span>
                  )}
                </div>
              </button>
            ) : (
              <div key={`blank-${index}`} className="min-h-24 bg-slate-50 sm:min-h-32" />
            )
          )}
        </div>
        {loading && (
          <div className="border-t border-slate-200 p-3 text-center text-sm text-slate-500">
            Loading calendar…
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 lg:items-stretch lg:justify-end">
          <button
            type="button"
            aria-label="Close day details"
            onClick={() => setSelectedDate(null)}
            className="absolute inset-0"
          />
          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl lg:h-full lg:max-h-none lg:max-w-xl lg:rounded-none lg:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-start justify-between border-b border-slate-200 bg-white p-4 lg:-mx-6 lg:-mt-6 lg:p-6">
              <div>
                <p className="text-sm font-semibold text-blue-700">
                  {scope === "company"
                    ? "All Company"
                    : technicians.find((item) => item.id === technicianId)?.name}
                </p>
                <h3 className="text-xl font-black text-slate-900">
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                    "en-US",
                    { weekday: "long", month: "long", day: "numeric" }
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="rounded-full bg-slate-100 px-3 py-2 font-bold"
              >
                ×
              </button>
            </div>

            {!day ? (
              <p className="py-10 text-center text-slate-500">Loading day…</p>
            ) : (
              <div className="space-y-5 pt-4">
                {selectedDateIsPast && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    Past days are read-only.
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Bookings", day.bookingCount],
                    ["Capacity", `${day.usedCapacity}/${day.totalCapacity}`],
                    ["Open slots", day.openSlotCount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-100 p-3">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="text-lg font-black text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>

                {!selectedDateIsPast && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        () =>
                          saveShadowDayOverride({
                            scopeType: scope,
                            technicianId,
                            date: selectedDate,
                            mode: "closed",
                          }),
                        "Day closed"
                      )
                    }
                    className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"
                  >
                    Close whole day
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        () =>
                          restoreShadowDay({
                            scopeType: scope,
                            technicianId,
                            date: selectedDate,
                          }),
                        "Default day restored"
                      )
                    }
                    className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
                  >
                    Restore day
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const input = window.prompt(
                        "Appointment starts, comma separated (HH:MM)",
                        DEFAULT_APPOINTMENT_STARTS.join(", ")
                      );
                      const starts = String(input || "")
                        .split(",")
                        .map((time) => time.trim())
                        .filter(Boolean)
                        .map((time) => ({ time }));
                      if (!starts.length) return;
                      void mutate(
                        () =>
                          saveShadowDayOverride({
                            scopeType: scope,
                            technicianId,
                            date: selectedDate,
                            mode: "custom_hours",
                            starts,
                            intervals: [],
                          }),
                        "Custom appointment starts saved"
                      );
                    }}
                    className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
                  >
                    Custom starts
                  </button>
                </div>
                )}

                <div>
                  <label className="text-sm font-bold text-slate-800">Day note</label>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    readOnly={selectedDateIsPast}
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                    placeholder="Add a note for the team"
                  />
                  {!selectedDateIsPast && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          () => saveShadowDayNote(selectedDate, note),
                          "Note saved"
                        )
                      }
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                    >
                      Save note
                    </button>
                    {day.note && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            () => deleteShadowDayNote(selectedDate),
                            "Note removed"
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  )}
                </div>

                <details className="rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer font-bold text-slate-900">
                    {selectedDateIsPast
                      ? "Technician time off"
                      : "Add technician time off"}
                  </summary>
                  {!selectedDateIsPast && (
                    <TimeOffForm
                      key={`${selectedDate}-${technicianId || "company"}`}
                      date={selectedDate}
                      technicians={technicians}
                      initialTechnicianId={technicianId || technicians[0]?.id || ""}
                      onCreate={(input) =>
                        mutate(() => createShadowTimeOff(input), "Time off added")
                      }
                    />
                  )}
                  {timeOff.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      {timeOff.map((entry) => {
                        const technician =
                          typeof entry.technicianId === "object"
                            ? entry.technicianId
                            : technicians.find(
                                (item) => item.id === entry.technicianId
                              );
                        return (
                          <TimeOffEditor
                            key={entry._id}
                            entry={entry}
                            technicianName={technician?.name || "Technician"}
                            timezone={company?.timezone || "America/New_York"}
                            busy={busy}
                            readOnly={selectedDateIsPast}
                            onSave={(input) =>
                              mutate(
                                () => updateShadowTimeOff(entry._id, input),
                                "Time off updated"
                              )
                            }
                            onRemove={() =>
                              mutate(
                                () => cancelShadowTimeOff(entry._id),
                                "Time off removed"
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </details>

                <div className="space-y-3">
                  {day.slots.length === 0 ? (
                    <div className="rounded-xl bg-slate-100 p-4 text-center text-slate-600">
                      No slots on this day.
                    </div>
                  ) : (
                    day.slots.map((slot) => (
                      <div
                        key={slot.time}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-lg font-black text-slate-900">
                              {formatTime(slot.time)}–{formatTime(slot.endTime)}
                            </div>
                            <div className="text-sm text-slate-500">
                              90-minute visit · {slot.usedCapacity} /{" "}
                              {slot.totalCapacity} booked · {slot.remainingCapacity} open
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${
                              slot.open
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {slot.open
                              ? "Open"
                              : slot.totalCapacity === 0
                                ? "Closed"
                                : slot.remainingCapacity === 0
                                  ? "Full"
                                  : "Unavailable"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1">
                          {slot.technicians.map((technician) => (
                            <div
                              key={technician.id}
                              className="flex justify-between text-sm"
                            >
                              <span>{technician.name}</span>
                              <span
                                className={
                                  technician.booked
                                    ? "font-semibold text-blue-700"
                                    : technician.available
                                      ? "text-emerald-700"
                                      : "text-slate-500"
                                }
                              >
                                {technician.booked
                                  ? "Booked"
                                  : technician.available
                                    ? "Available"
                                    : technician.unavailableReason || "Unavailable"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {!selectedDateIsPast && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            ["Close slot", "close"],
                            ["Open slot", "open"],
                            ["Remove 1 spot", "remove_spot"],
                            ["Add 1 spot", "add_spot"],
                          ].map(([label, action]) => (
                            <button
                              key={action}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  () =>
                                    runShadowSlotAction({
                                      scopeType: scope,
                                      technicianId,
                                      date: selectedDate,
                                      startTime: slot.time,
                                      endTime: slot.endTime,
                                      action: action as
                                        | "close"
                                        | "open"
                                        | "remove_spot"
                                        | "add_spot",
                                    }),
                                  `${label} applied`
                                )
                              }
                              className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-bold"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        )}
                        {slot.bookings.length > 0 && (
                          <details className="mt-3 rounded-lg bg-slate-50 p-2 text-sm">
                            <summary className="cursor-pointer font-bold">
                              View bookings ({slot.bookings.length})
                            </summary>
                            <div className="mt-2 space-y-2">
                              {slot.bookings.map((booking) => (
                                <div key={booking.id}>
                                  {booking.customerName || "Customer"} ·{" "}
                                  {booking.service || "Service"}
                                  {booking.assignedFixterName
                                    ? ` · ${booking.assignedFixterName}`
                                    : ""}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {settingsOpen && company && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Templates & Settings
                </h3>
                <p className="text-sm text-slate-500">
                  Customer availability and technician schedules
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-2 font-bold"
              >
                ×
              </button>
            </div>

            <details open className="mt-5 rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-lg font-black">
                Company Schedule
              </summary>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField
                  label="Visit duration (minutes)"
                  value={company.visitDurationMinutes || 90}
                  onChange={() => undefined}
                  disabled
                />
                <NumberField
                  label="Lead minutes"
                  value={company.minLeadMinutes}
                  onChange={(value) =>
                    setCompany({ ...company, minLeadMinutes: value })
                  }
                />
                <NumberField
                  label="Advance days"
                  value={company.maxAdvanceDays}
                  onChange={(value) =>
                    setCompany({ ...company, maxAdvanceDays: value })
                  }
                />
                <NumberField
                  label="Default capacity"
                  value={company.defaultCapacity}
                  onChange={(value) =>
                    setCompany({ ...company, defaultCapacity: value })
                  }
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Add the exact appointment starts customers may book. The
                standard Profixter starts are 8:00 AM, 10:30 AM, 1:00 PM, and
                3:30 PM. Every visit lasts 90 minutes.
              </p>
              <div className="mt-4">
                <WeeklyScheduleEditor
                  value={company.weeklySchedule}
                  capacity
                  fallbackStepMinutes={company.slotMinutes}
                  onChange={(weeklySchedule) =>
                    setCompany({ ...company, weeklySchedule })
                  }
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  mutate(
                    async () => {
                      const saved = await updateShadowCompanyTemplate(company);
                      setCompany(saved);
                    },
                    "Company schedule saved"
                  )
                }
                className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white"
              >
                Save company schedule
              </button>
            </details>

            <details className="mt-4 rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-lg font-black">
                Technician Schedule
              </summary>
              <select
                value={settingsTechId}
                onChange={(event) => setSettingsTechId(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3"
              >
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name} — {technician.position}
                  </option>
                ))}
              </select>
              {techTemplate && (
                <div className="mt-4">
                  <label className="flex items-center justify-between rounded-xl bg-slate-100 p-3 font-bold">
                    Inherit company hours
                    <input
                      type="checkbox"
                      checked={techTemplate.inheritCompanyHours}
                      onChange={(event) =>
                        setTechTemplate({
                          ...techTemplate,
                          inheritCompanyHours: event.target.checked,
                        })
                      }
                      className="h-5 w-5"
                    />
                  </label>
                  {!techTemplate.inheritCompanyHours && (
                    <div className="mt-4">
                      <WeeklyScheduleEditor
                        value={techTemplate.weeklySchedule}
                        capacity={false}
                        fallbackStepMinutes={company.slotMinutes}
                        onChange={(weeklySchedule) =>
                          setTechTemplate({ ...techTemplate, weeklySchedule })
                        }
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        async () => {
                          const saved = await updateShadowTechnicianTemplate(
                            settingsTechId,
                            techTemplate
                          );
                          setTechTemplate(saved);
                        },
                        "Technician schedule saved"
                      )
                    }
                    className="mt-4 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white"
                  >
                    Save technician schedule
                  </button>
                </div>
              )}
            </details>
          </div>
        </div>
      )}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-bold text-slate-600">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

function TimeOffEditor({
  entry,
  technicianName,
  timezone,
  busy,
  readOnly,
  onSave,
  onRemove,
}: {
  entry: ShadowTimeOff;
  technicianName: string;
  timezone: string;
  busy: boolean;
  readOnly: boolean;
  onSave: (input: {
    type: TimeOffType;
    startAt: string;
    endAt: string;
    allDay: boolean;
    reason: string;
  }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const initialStartDate = formatInTimeZone(
    entry.startAt,
    timezone,
    "yyyy-MM-dd"
  );
  const storedEndDate = formatInTimeZone(entry.endAt, timezone, "yyyy-MM-dd");
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<TimeOffType>(entry.type);
  const [allDay, setAllDay] = useState(entry.allDay);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(
    entry.allDay ? previousDate(storedEndDate) : storedEndDate
  );
  const [startTime, setStartTime] = useState(
    formatInTimeZone(entry.startAt, timezone, "HH:mm")
  );
  const [endTime, setEndTime] = useState(
    formatInTimeZone(entry.endAt, timezone, "HH:mm")
  );
  const [reason, setReason] = useState(entry.reason || "");

  const validRange =
    endDate > startDate ||
    (endDate === startDate && (allDay || endTime > startTime));

  const save = async () => {
    const startAt = fromZonedTime(
      `${startDate}T${allDay ? "00:00" : startTime}:00`,
      timezone
    ).toISOString();
    const endAt = fromZonedTime(
      `${allDay ? nextDate(endDate) : endDate}T${allDay ? "00:00" : endTime}:00`,
      timezone
    ).toISOString();
    await onSave({ type, startAt, endAt, allDay, reason });
    setEditing(false);
  };

  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          <b>{technicianName}</b> — {entry.type}
        </span>
        {!readOnly && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="font-bold text-blue-700"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="font-bold text-rose-700 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as TimeOffType)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            {TIME_OFF_TYPES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
          <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold">
            All day
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
              className="h-5 w-5"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              End date
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
              />
            </label>
            {!allDay && (
              <>
                <label className="text-xs font-bold text-slate-600">
                  Start time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  End time
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
                  />
                </label>
              </>
            )}
          </div>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Optional reason"
          />
          <button
            type="button"
            disabled={busy || !validRange}
            onClick={() => void save()}
            className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-50"
          >
            Save time off
          </button>
          {!validRange && (
            <p className="text-xs font-semibold text-rose-700">
              End must be after start.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TimeOffForm({
  date,
  technicians,
  initialTechnicianId,
  onCreate,
}: {
  date: string;
  technicians: ShadowTechnician[];
  initialTechnicianId: string;
  onCreate: (input: {
    technicianId: string;
    type: "vacation" | "sick" | "personal" | "training" | "other";
    date: string;
    allDay: boolean;
    reason: string;
  }) => Promise<void>;
}) {
  const [technicianId, setTechnicianId] = useState(initialTechnicianId);
  const [type, setType] = useState<TimeOffType>("vacation");
  const [reason, setReason] = useState("");

  return (
    <div className="mt-3 grid gap-2">
      <select
        value={technicianId}
        onChange={(event) => setTechnicianId(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2"
      >
        {technicians.map((technician) => (
          <option key={technician.id} value={technician.id}>
            {technician.name}
          </option>
        ))}
      </select>
      <select
        value={type}
        onChange={(event) => setType(event.target.value as typeof type)}
        className="rounded-lg border border-slate-300 px-3 py-2"
      >
        <option value="vacation">Vacation</option>
        <option value="sick">Sick day</option>
        <option value="personal">Personal day</option>
        <option value="training">Training</option>
        <option value="other">Other</option>
      </select>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Optional reason"
      />
      <button
        type="button"
        disabled={!technicianId}
        onClick={() =>
          onCreate({
            technicianId,
            type,
            date,
            allDay: true,
            reason,
          })
        }
        className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-50"
      >
        Add full-day time off
      </button>
    </div>
  );
}
