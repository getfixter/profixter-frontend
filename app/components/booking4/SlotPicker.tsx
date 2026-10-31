"use client";

import { useEffect, useMemo, useState } from "react";
import { getMonthAvailability, getTimeSlots } from "@/lib/booking-service";
import { getBookableSlots, normalizeDayAvailability, type AvailabilitySlot } from "@/lib/booking-calendar-availability";

/*
 * Pick a day, then a time - from the real calendar (the same availability the
 * reservation engine books against). `visit="membership"` applies the member
 * seven-day lead time, exactly as the server will.
 *
 * The day's whole schedule is shown: times that are taken (or that this visit
 * cannot have) stay visible, greyed and struck through, and cannot be chosen.
 * Only times the server sent as bookable are ever selectable; nothing outside
 * the company's configured schedule is drawn.
 *
 * Nothing here reserves anything; the server re-checks when the booking is
 * made and answers SLOT_UNAVAILABLE if the time has gone.
 */

const TZ = "America/New_York";
const DAYS_SHOWN = 45;

function ymdInNY(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}
function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}
function label(ymd: string) {
  const dt = new Date(`${ymd}T12:00:00Z`);
  return {
    weekday: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: dt.getUTCDate(),
    month: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}
export function formatTime12(t: string) {
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh)) return t;
  return `${hh % 12 || 12}:${String(mm || 0).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
}
/* Bookable and unavailable times together (only `available` ones are bookable). */
function daySchedule(raw: unknown): AvailabilitySlot[] {
  const day = normalizeDayAvailability(raw as never);
  const bookable = new Set(getBookableSlots(day).map((s) => s.time));
  return day.slots.map((s) => ({ time: s.time, available: bookable.has(s.time) }));
}

export function formatWhen(date: string, time: string) {
  if (!date) return "";
  const l = label(date);
  return `${l.weekday}, ${l.month} ${l.day}${time ? ` at ${formatTime12(time)}` : ""}`;
}

export default function SlotPicker({
  date,
  time,
  onChange,
  visit,
  held,
}: {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  visit?: "membership";
  /** The time this customer is holding: the calendar counts it as taken, but it is theirs. */
  held?: { date: string; time: string } | null;
}) {
  const today = ymdInNY(new Date());
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)), [today]);
  const [byDay, setByDay] = useState<Record<string, AvailabilitySlot[]> | null>(null);
  const [fresh, setFresh] = useState<{ date: string; slots: AvailabilitySlot[] } | null>(null);
  const loaded = !date ? null : fresh?.date === date ? fresh.slots : (byDay?.[date] ?? null);
  // The customer's own held time counts as taken in the calendar, but it is theirs to keep.
  const daySlots = useMemo(() => {
    if (!loaded || !held || held.date !== date) return loaded;
    const rest = loaded.filter((s) => s.time !== held.time);
    return [...rest, { time: held.time, available: true }].sort((a, b) => a.time.localeCompare(b.time));
  }, [loaded, held, date]);

  useEffect(() => {
    let alive = true;
    // Every month the strip touches - a 45-day window can span three.
    const months = Array.from(new Set(days.map((d) => d.slice(0, 7))));
    Promise.all(months.map((m) => getMonthAvailability(m, { visit }).catch(() => null)))
      .then((results) => {
        if (!alive) return;
        // No month view at all (an older API): every day stays pickable and the day's own slots decide.
        if (results.every((r) => !r)) return setByDay(null);
        const map: Record<string, AvailabilitySlot[]> = {};
        for (const month of results) {
          for (const day of month?.days || []) map[day.date] = daySchedule(day);
        }
        setByDay(map);
      })
      .catch(() => alive && setByDay(null));
    return () => {
      alive = false;
    };
  }, [today, days, visit]);

  // The chosen day, fresh: the month view can be a minute old.
  useEffect(() => {
    if (!date) return;
    let alive = true;
    getTimeSlots(date, { visit })
      .then((res) => alive && setFresh({ date, slots: daySchedule(res) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [date, visit]);

  // A remembered choice that has since been taken is let go, so it is never sent as if still open.
  useEffect(() => {
    if (!date || !time || fresh?.date !== date || !daySlots) return;
    if (!daySlots.some((s) => s.time === time && s.available)) onChange({ date, time: "" });
  }, [date, time, fresh, daySlots, onChange]);

  const hasAny =(ymd: string) => (byDay ? (byDay[ymd] || []).some((s) => s.available) || held?.date === ymd : true);

  return (
    <div data-slot-picker>
      <div className="bk-days" role="group" aria-label="Choose a day">
        {days.map((ymd) => {
          const l = label(ymd);
          return (
            <button
              key={ymd}
              type="button"
              className="bk-day"
              aria-pressed={date === ymd}
              disabled={!hasAny(ymd)}
              data-day={ymd}
              onClick={() => onChange({ date: ymd, time: "" })}
            >
              <span>{l.weekday}</span>
              <b>{l.day}</b>
              <span>{l.month}</span>
            </button>
          );
        })}
      </div>
      {byDay && Object.values(byDay).every((list) => !list.some((s) => s.available)) && (
        <p className="bk-note">No openings in the next few weeks. Please call us at 631-599-1363.</p>
      )}
      {date && (
        <div className="bk-times" role="group" aria-label="Choose a time">
          {daySlots === null ? (
            <p className="bk-note">Checking times…</p>
          ) : daySlots.some((s) => s.available) ? (
            daySlots.map(({ time: t, available }) => (
              <button
                key={t}
                type="button"
                className="bk-time"
                aria-pressed={available ? time === t : undefined}
                aria-label={available ? undefined : `${formatTime12(t)}, unavailable`}
                disabled={!available}
                data-time={t}
                data-available={available ? "1" : "0"}
                onClick={available ? () => onChange({ date, time: t }) : undefined}
              >
                {formatTime12(t)}
              </button>
            ))
          ) : (
            <p className="bk-note">That day just filled up. Please pick another.</p>
          )}
        </div>
      )}
    </div>
  );
}
