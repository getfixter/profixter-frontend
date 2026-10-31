"use client";

import { useEffect, useMemo, useState } from "react";
import { getMonthAvailability, getTimeSlots } from "@/lib/booking-service";
import { getBookableSlots, normalizeDayAvailability } from "@/lib/booking-calendar-availability";

/*
 * Pick a day, then a time - from the real calendar (the same availability the
 * reservation engine books against). `visit="membership"` applies the member
 * seven-day lead time, exactly as the server will.
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
}: {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  visit?: "membership";
}) {
  const today = ymdInNY(new Date());
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)), [today]);
  const [byDay, setByDay] = useState<Record<string, string[]> | null>(null);
  const [fresh, setFresh] = useState<{ date: string; slots: string[] } | null>(null);
  const daySlots = !date ? null : fresh?.date === date ? fresh.slots : (byDay?.[date] ?? null);

  useEffect(() => {
    let alive = true;
    // Every month the strip touches - a 45-day window can span three.
    const months = Array.from(new Set(days.map((d) => d.slice(0, 7))));
    Promise.all(months.map((m) => getMonthAvailability(m, { visit }).catch(() => null)))
      .then((results) => {
        if (!alive) return;
        // No month view at all (an older API): every day stays pickable and the day's own slots decide.
        if (results.every((r) => !r)) return setByDay(null);
        const map: Record<string, string[]> = {};
        for (const month of results) {
          for (const day of month?.days || []) {
            map[day.date] = getBookableSlots(normalizeDayAvailability(day as never)).map((s) => s.time);
          }
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
      .then((res) => alive && setFresh({ date, slots: getBookableSlots(normalizeDayAvailability(res as never)).map((s) => s.time) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [date, visit]);

  const hasAny = (ymd: string) => (byDay ? (byDay[ymd] || []).length > 0 : true);

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
      {byDay && Object.values(byDay).every((list) => !list.length) && (
        <p className="bk-note">No openings in the next few weeks. Please call us at 631-599-1363.</p>
      )}
      {date && (
        <div className="bk-times" role="group" aria-label="Choose a time">
          {daySlots === null ? (
            <p className="bk-note">Checking times…</p>
          ) : daySlots.length ? (
            daySlots.map((t) => (
              <button key={t} type="button" className="bk-time" aria-pressed={time === t} data-time={t} onClick={() => onChange({ date, time: t })}>
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
