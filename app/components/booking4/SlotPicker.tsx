"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMonthAvailability, getTimeSlots } from "@/lib/booking-service";
import { getBookableSlots, normalizeDayAvailability, type AvailabilitySlot } from "@/lib/booking-calendar-availability";

/*
 * Pick a day, then a time - from the real calendar (the same availability the
 * reservation engine books against). `visit="membership"` applies the member
 * seven-day lead time, exactly as the server will.
 *
 * Customer Experience 4.2: only days with at least one bookable time are in the
 * strip, and the earliest opening is chosen for the customer - day and time -
 * so the common case is one tap on Continue. Choosing another day chooses that
 * day's earliest time. A remembered choice is kept while it is still open; if
 * it has gone (taken, or not open to this visit), the next opening is chosen
 * and a short note says so.
 *
 * Within a day, the whole schedule is still shown: times that are taken (or
 * that this visit cannot have) stay visible, greyed and struck through, and
 * cannot be chosen. Only times the server sent as bookable are ever selectable.
 *
 * Choosing - by the customer or by default - reserves nothing. The server
 * re-checks when the booking (or Book a Handyman's hold, on Continue) is made.
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
const firstOpen = (slots: AvailabilitySlot[] | null | undefined) => slots?.find((s) => s.available)?.time || "";

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
  /* undefined: loading; null: no month view (an older API) - every day stays pickable and its own slots decide. */
  const visitKey = visit || "any";
  const [month, setMonth] = useState<{ visit: string; map: Record<string, AvailabilitySlot[]> | null } | null>(null);
  const [freshRaw, setFresh] = useState<{ visit: string; date: string; slots: AvailabilitySlot[] } | null>(null);
  // Answers for another kind of visit (before the member calendar loaded, say) are never used.
  const byDay = month && month.visit === visitKey ? month.map : undefined;
  const fresh = freshRaw && freshRaw.visit === visitKey ? freshRaw : null;
  const [notice, setNotice] = useState("");
  const stripRef = useRef<HTMLDivElement>(null);

  /* A day's schedule: the fresh fetch for the chosen day, else the month view; the customer's own hold counts as open. */
  const slotsFor = useCallback(
    (ymd: string): AvailabilitySlot[] | null => {
      const base = fresh?.date === ymd ? fresh.slots : (byDay?.[ymd] ?? null);
      if (!base || !held || held.date !== ymd) return base;
      const rest = base.filter((s) => s.time !== held.time);
      return [...rest, { time: held.time, available: true }].sort((a, b) => a.time.localeCompare(b.time));
    },
    [fresh, byDay, held]
  );
  const daySlots = date ? slotsFor(date) : null;

  /* Only days that can actually be booked. Until the month view is in, nothing is offered (no guessing). */
  const openDays = useMemo(() => {
    if (byDay === undefined) return [];
    if (byDay === null) return days;
    return days.filter((ymd) => firstOpen(slotsFor(ymd)) !== "");
  }, [byDay, days, slotsFor]);

  useEffect(() => {
    let alive = true;
    // Every month the strip touches - a 45-day window can span three.
    const months = Array.from(new Set(days.map((d) => d.slice(0, 7))));
    Promise.all(months.map((m) => getMonthAvailability(m, { visit }).catch(() => null)))
      .then((results) => {
        if (!alive) return;
        if (results.every((r) => !r)) return setMonth({ visit: visitKey, map: null });
        const map: Record<string, AvailabilitySlot[]> = {};
        for (const month of results) {
          for (const day of month?.days || []) map[day.date] = daySchedule(day);
        }
        setMonth({ visit: visitKey, map });
      })
      .catch(() => alive && setMonth({ visit: visitKey, map: null }));
    return () => {
      alive = false;
    };
  }, [today, days, visit, visitKey]);

  // The chosen day, fresh: the month view can be a minute old.
  useEffect(() => {
    if (!date) return;
    let alive = true;
    getTimeSlots(date, { visit })
      .then((res) => alive && setFresh({ visit: visitKey, date, slots: daySchedule(res) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [date, visit, visitKey]);

  /*
   * Keep a real opening chosen. Nothing chosen yet: the earliest opening. A
   * chosen day that is no longer open, or a chosen time that has gone: the
   * next opening, with a note - never a time sent as if it were still open.
   */
  useEffect(() => {
    if (byDay === undefined) return;
    if (byDay && (!date || !openDays.includes(date))) {
      const first = openDays[0];
      if (!first || (fresh?.date !== first && !byDay[first])) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- says why a choice was changed for them
      if (date && time) setNotice("Your earlier time is no longer open, so we picked the earliest opening.");
      onChange({ date: first, time: firstOpen(slotsFor(first)) });
      return;
    }
    if (!date || !daySlots) return;
    if (time && daySlots.some((s) => s.time === time && s.available)) return;
    const next = firstOpen(daySlots);
    if (!next) return;
    if (time) setNotice("That time is no longer open, so we picked the next one that day.");
    onChange({ date, time: next });
  }, [byDay, openDays, date, time, daySlots, fresh, slotsFor, onChange]);

  // The chosen day in view, in the strip only (never scrolls the page).
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>(`[data-day="${date}"]`);
    if (!strip || !chip) return;
    const left = chip.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + chip.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, left - 8);
    }
  }, [date, openDays.length]);

  const pickDay = (ymd: string) => {
    setNotice("");
    onChange({ date: ymd, time: firstOpen(slotsFor(ymd)) });
  };

  return (
    <div data-slot-picker>
      <div ref={stripRef} className="bk-days" role="group" aria-label="Choose a day" aria-busy={byDay === undefined}>
        {byDay === undefined
          ? Array.from({ length: 6 }, (_, i) => <span key={i} className="bk-day bk-day--ghost" aria-hidden="true" />)
          : openDays.map((ymd) => {
              const l = label(ymd);
              return (
                <button key={ymd} type="button" className="bk-day" aria-pressed={date === ymd} data-day={ymd} onClick={() => pickDay(ymd)}>
                  <span>{l.weekday}</span>
                  <b>{l.day}</b>
                  <span>{l.month}</span>
                </button>
              );
            })}
      </div>
      {byDay !== undefined && openDays.length === 0 && (
        <p className="bk-note">No openings in the next few weeks. Please call us at 631-599-1363.</p>
      )}
      {date && openDays.length > 0 && (
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
                onClick={
                  available
                    ? () => {
                        setNotice("");
                        onChange({ date, time: t });
                      }
                    : undefined
                }
              >
                {formatTime12(t)}
              </button>
            ))
          ) : (
            <p className="bk-note">That day just filled up. Please pick another.</p>
          )}
        </div>
      )}
      {notice ? (
        <p className="bk-note bk-picked" role="status" data-slot-notice>
          {notice}
        </p>
      ) : null}
    </div>
  );
}
