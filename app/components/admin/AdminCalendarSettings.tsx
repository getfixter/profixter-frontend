"use client";

import React, { useState, useEffect, useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

type CalendarConfigState = {
  timezone: string;
  slotMinutes: number;
  closedWeekdays: number[];
  minLeadDays: number;
  defaultHours: string[];
  overrides: Record<string, string[]>;
  holidays: string[];
  handymanCapacity: number;
};

export default function AdminCalendarSettings() {
  const api =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "3000"
      ? "http://localhost:5000"
      : "";

  const [cfg, setCfg] = useState<CalendarConfigState | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");


 // 30-minute increments from 07:00 to 22:00
const HOURS = useMemo(() => {
  const list: string[] = [];
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      list.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return list;
}, []);

  // Helpers
  const toYMD = (d: Date, tz = "America/New_York") => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);

    const o: any = {};
    parts.forEach((p) => (o[p.type] = p.value));
    return `${o.year}-${o.month}-${o.day}`;
  };

  const uniqSorted = (arr: string[]) =>
    Array.from(new Set(arr)).sort((a, b) => (a > b ? 1 : -1));

  const authHeader = (): HeadersInit => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Build a range of hours from HOURS list
  const buildRange = (start: string, end: string) =>
    HOURS.filter((t) => t >= start && t < end);

  // --------------------------
  // LOAD CALENDAR CONFIG
  // --------------------------
  const load = async () => {
    try {
      setLoading(true);
      setLog("");

      const res = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/api/admin/calendar`,
  { headers: authHeader() }
);


      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setCfg({
        timezone: data.timezone || "America/New_York",
        slotMinutes: data.slotMinutes || 60,
        closedWeekdays: data.closedWeekdays || [],
        minLeadDays: data.minLeadDays ?? 2,
        defaultHours: uniqSorted(data.defaultHours || []),
        overrides: data.overrides || {},
        holidays: data.holidays || [],
        handymanCapacity: data.handymanCapacity ?? 1,
      });
    } catch (err: any) {
      console.error("Admin calendar load error:", err);
      setLog("⚠️ Using fallback config. " + err.message);
      setCfg({
        timezone: "America/New_York",
        slotMinutes: 60,
        closedWeekdays: [0],
        minLeadDays: 2,
        defaultHours: buildRange("09:00", "17:00"),
        overrides: {},
        holidays: [],
        handymanCapacity: 1,
      });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------
  // SAVE CONFIG
  // --------------------------
  const saveAll = async () => {
    if (!cfg) return;
    try {
      setLoading(true);
      setLog("Saving…");

      const body = {
        timezone: cfg.timezone,
        slotMinutes: cfg.slotMinutes,
        closedWeekdays: cfg.closedWeekdays,
        minLeadDays: cfg.minLeadDays,
        defaultHours: cfg.defaultHours,
        overrides: cfg.overrides,
        holidays: cfg.holidays,
        handymanCapacity: cfg.handymanCapacity,
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/calendar`, {
   method: "PUT",
   headers: authHeader(),
   body: JSON.stringify(body),
});


      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Save failed");

      setLog("✅ Saved!");
    } catch (err: any) {
      console.error("Admin calendar save error:", err);
      setLog("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cfg) {
    return (
      <div className="bg-white p-6 rounded-xl shadow text-center">
        Loading settings…
      </div>
    );
  }

  const tz = cfg.timezone;

  const overrideHours = (ymd: string) => cfg.overrides?.[ymd] || [];
  const hasOverride = (ymd: string) =>
    Object.hasOwn(cfg.overrides || {}, ymd);
  const isOverrideClosed = (ymd: string) =>
    hasOverride(ymd) && overrideHours(ymd).length === 0;
  const isHoliday = (ymd: string) => cfg.holidays.includes(ymd);
  const isClosedWeekday = (d: Date) =>
    cfg.closedWeekdays.includes(
      new Date(
        d.toLocaleString("en-US", { timeZone: tz })
      ).getDay()
    );

  // Calendar tile coloring
  const tileClassName = ({ date }: any) => {
    const ymd = toYMD(date, tz);
    if (selectedDate === ymd)
      return "bg-blue-600 text-white rounded-md";
    if (isHoliday(ymd))
      return "bg-red-200 text-red-700 rounded-md";
    if (isOverrideClosed(ymd))
      return "bg-gray-300 text-gray-700 rounded-md";
    if (hasOverride(ymd))
      return "bg-yellow-200 text-yellow-700 rounded-md";
    if (isClosedWeekday(date))
      return "bg-gray-200 text-gray-600 rounded-md";
    return "bg-white";
  };

  // Toggle weekly closed weekday
  const toggleWeekday = (idx: number) =>
    setCfg((p) => ({
      ...p!,
      closedWeekdays: p!.closedWeekdays.includes(idx)
        ? p!.closedWeekdays.filter((x) => x !== idx)
        : [...p!.closedWeekdays, idx].sort(),
    }));

  // Mark a specific date CLOSED
  const markClosed = () => {
    if (!selectedDate) return;
    setCfg((p) => ({
      ...p!,
      overrides: { ...p!.overrides, [selectedDate]: [] },
    }));
  };

  // Use default hours for selected date
  const useDefault = () => {
    if (!selectedDate) return;
    setCfg((p) => {
      const next = { ...p!.overrides };
      delete next[selectedDate];
      return { ...p!, overrides: next };
    });
  };

  // Toggle override hour
  const toggleOverrideHour = (hh: string) => {
    if (!selectedDate) return;
    setCfg((p) => {
      const cur = overrideHours(selectedDate);
      const next = cur.includes(hh)
        ? cur.filter((x) => x !== hh)
        : [...cur, hh];
      return {
        ...p!,
        overrides: {
          ...p!.overrides,
          [selectedDate]: uniqSorted(next),
        },
      };
    });
  };

  // Toggle default daily hour
  const toggleDefaultHour = (hh: string) =>
    setCfg((p) => {
      const has = p!.defaultHours.includes(hh);
      const next = has
        ? p!.defaultHours.filter((x) => x !== hh)
        : [...p!.defaultHours, hh];
      return { ...p!, defaultHours: uniqSorted(next) };
    });

  const addHoliday = (d: string) =>
    setCfg((p) => ({
      ...p!,
      holidays: uniqSorted([...p!.holidays, d]),
    }));

  const removeHoliday = (d: string) =>
    setCfg((p) => ({
      ...p!,
      holidays: p!.holidays.filter((x) => x !== d),
    }));

  // Apply templates to DEFAULT hours
  const setDefaultTemplate = (template: "9-5" | "morning" | "afternoon" | "full" | "clear") => {
    setCfg((p) => {
      if (!p) return p;
      let hours: string[] = [];
      switch (template) {
        case "9-5":
          hours = buildRange("09:00", "17:00");
          break;
        case "morning":
          hours = buildRange("08:00", "12:00");
          break;
        case "afternoon":
          hours = buildRange("13:00", "18:00");
          break;
        case "full":
          hours = buildRange("08:00", "20:00");
          break;
        case "clear":
          hours = [];
          break;
      }
      return { ...p, defaultHours: hours };
    });
  };

  // Apply templates to OVERRIDE hours for selected date
  const setOverrideTemplate = (
    template: "9-5" | "morning" | "afternoon" | "full" | "clear"
  ) => {
    if (!selectedDate) return;
    setCfg((p) => {
      if (!p) return p;
      const next = { ...p.overrides };
      let hours: string[] = [];
      switch (template) {
        case "9-5":
          hours = buildRange("09:00", "17:00");
          break;
        case "morning":
          hours = buildRange("08:00", "12:00");
          break;
        case "afternoon":
          hours = buildRange("13:00", "18:00");
          break;
        case "full":
          hours = buildRange("08:00", "20:00");
          break;
        case "clear":
          hours = [];
          break;
      }
      next[selectedDate] = hours;
      return { ...p, overrides: next };
    });
  };

  // Copy this day's override to all same weekdays THIS MONTH
  const copyOverrideToSameWeekday = () => {
    if (!selectedDate) return;
    const base = new Date(selectedDate + "T12:00:00");
    const weekday = base.getDay();
    const year = base.getFullYear();
    const month = base.getMonth();

    const curHours = overrideHours(selectedDate);
    const closed = isOverrideClosed(selectedDate);

    setCfg((p) => {
      if (!p) return p;
      const overrides = { ...p.overrides };
      const lastDay = new Date(year, month + 1, 0).getDate();

      for (let d = 1; d <= lastDay; d++) {
        const dt = new Date(year, month, d);
        if (dt.getDay() !== weekday) continue;
        const ymd = toYMD(dt, tz);
        overrides[ymd] = closed ? [] : [...curHours];
      }
      return { ...p, overrides };
    });
  };

  // Summary helpers
  const overridesCount = Object.keys(cfg.overrides || {}).length;
  const holidaysCount = cfg.holidays.length;

  // ---- UI RENDER ----
  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* SUMMARY CARD */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-200 flex flex-col md:flex-row gap-6 justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            Calendar Settings Overview
          </h2>
          <p className="text-gray-600 text-sm">
            Control when customers can book a visit. Defaults +
            overrides define all availability.
          </p>
          {log && (
            <p className="mt-2 text-sm text-gray-700">
              <strong>Status:</strong> {log}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
          <div>
            <div className="font-semibold">Timezone</div>
            <div>{cfg.timezone}</div>
          </div>
          <div>
            <div className="font-semibold">Slot length</div>
            <div>{cfg.slotMinutes} min</div>
          </div>
          <div>
            <div className="font-semibold">Min lead days</div>
            <div>{cfg.minLeadDays} day(s)</div>
          </div>
          <div>
            <div className="font-semibold">Capacity / slot</div>
            <div>{cfg.handymanCapacity}</div>
          </div>
          <div>
            <div className="font-semibold">Closed weekdays</div>
            <div>
              {cfg.closedWeekdays.length === 0
                ? "None"
                : cfg.closedWeekdays.join(", ")}
            </div>
          </div>
          <div>
            <div className="font-semibold">Overrides / Holidays</div>
            <div>
              {overridesCount} overrides, {holidaysCount} holidays
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SETTINGS CARD */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
        <h2 className="text-2xl font-bold mb-4">Base Rules</h2>

        {/* Timezone + slot length */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="font-medium block mb-1">
              Timezone:
            </label>
            <input
              type="text"
              value={cfg.timezone}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p!,
                  timezone: e.target.value,
                }))
              }
              className="p-2 border rounded-lg w-full"
              placeholder="America/New_York"
            />
          </div>
          <div>
            <label className="font-medium block mb-1">
              Slot length (minutes):
            </label>
            <select
              value={cfg.slotMinutes}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p!,
                  slotMinutes: Number(e.target.value),
                }))
              }
              className="p-2 border rounded-lg w-full"
            >
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </div>
        </div>

        {/* Closed weekdays */}
        <div className="mb-4">
          <p className="font-medium mb-2">Closed Weekdays:</p>
          <div className="flex gap-4 flex-wrap">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (lbl, idx) => (
                <label key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cfg.closedWeekdays.includes(idx)}
                    onChange={() => toggleWeekday(idx)}
                  />
                  {lbl}
                </label>
              )
            )}
          </div>
        </div>

        {/* Lead days */}
        <div className="mb-4">
          <label className="font-medium">Min lead days:</label>
          <input
            type="number"
            min={0}
            max={30}
            className="ml-3 p-2 border rounded-lg w-24"
            value={cfg.minLeadDays}
            onChange={(e) =>
              setCfg((p) => ({
                ...p!,
                minLeadDays: Number(e.target.value),
              }))
            }
          />
          <p className="text-xs text-gray-500 mt-1">
            Customers cannot book sooner than this many days in
            advance.
          </p>
        </div>

        {/* Capacity */}
        <div className="mb-4">
          <label className="font-medium">
            Handyman capacity per time slot:
          </label>
          <input
            type="number"
            min={1}
            className="ml-3 p-2 border rounded-lg w-24"
            value={cfg.handymanCapacity}
            onChange={(e) =>
              setCfg((p) => ({
                ...p!,
                handymanCapacity:
                  Number(e.target.value) > 0
                    ? Number(e.target.value)
                    : 1,
              }))
            }
          />
          <p className="text-xs text-gray-500 mt-1">
            How many visits can happen at the same time.
          </p>
        </div>

        {/* Default daily hours */}
        <div className="mb-6">
          <p className="font-medium mb-2">Default Hours:</p>
          <div className="flex gap-2 flex-wrap">
            {HOURS.map((hh) => {
              const on = cfg.defaultHours.includes(hh);
              return (
                <button
                  key={hh}
                  type="button"
                  className={`px-3 py-1 rounded-lg border text-xs ${
                    on
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                  onClick={() => toggleDefaultHour(hh)}
                >
                  {hh}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() => setDefaultTemplate("9-5")}
            >
              9–5 default
            </button>

            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() => setDefaultTemplate("morning")}
            >
              Morning (8–12)
            </button>

            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() => setDefaultTemplate("afternoon")}
            >
              Afternoon (13–18)
            </button>

            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() => setDefaultTemplate("full")}
            >
              Full day (8–20)
            </button>

            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() => setDefaultTemplate("clear")}
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR CARD */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
        <h3 className="text-xl font-bold mb-4">
          Calendar Override Editor
        </h3>

        {/* Selected date */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="font-medium">Selected:</label>
          <span className="px-3 py-1 bg-gray-100 rounded-lg">
            {selectedDate || "—"}
          </span>

          <button
            className="px-3 py-1 bg-gray-200 rounded-lg"
            onClick={() => setSelectedDate("")}
          >
            Clear
          </button>

          <button
            className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg"
            onClick={() =>
              setSelectedDate(toYMD(new Date(), tz))
            }
          >
            Today
          </button>
        </div>

        {/* Calendar UI */}
        <Calendar
          onClickDay={(d) => setSelectedDate(toYMD(d, tz))}
          value={
            selectedDate
              ? new Date(selectedDate + "T12:00:00")
              : new Date()
          }
          tileClassName={tileClassName}
          showNeighboringMonth={false}
        />

        {/* Holidays list */}
        <div className="mt-6">
          <p className="font-medium mb-2">Holidays / blocked dates:</p>
          {cfg.holidays.length === 0 ? (
            <p className="text-sm text-gray-500">
              No holidays added yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cfg.holidays.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => removeHoliday(d)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Per date editor */}
        {selectedDate ? (
          <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                className="px-3 py-2 bg-red-200 text-red-700 rounded-lg"
                onClick={markClosed}
                type="button"
              >
                Mark CLOSED (no bookings)
              </button>

              <button
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg"
                onClick={useDefault}
                type="button"
              >
                Use Default Hours
              </button>

              <button
                className="px-3 py-2 bg-yellow-200 text-yellow-700 rounded-lg"
                onClick={() => addHoliday(selectedDate)}
                type="button"
              >
                Add Holiday
              </button>

              {isHoliday(selectedDate) && (
                <button
                  className="px-3 py-2 bg-gray-300 rounded-lg"
                  onClick={() => removeHoliday(selectedDate)}
                  type="button"
                >
                  Remove Holiday
                </button>
              )}

              <button
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg"
                onClick={copyOverrideToSameWeekday}
                type="button"
              >
                Copy this day → all same weekdays this month
              </button>
            </div>

            {/* Override templates */}
            <div className="flex flex-wrap gap-3 mb-4 text-sm">
              <span className="font-medium mr-2">
                Quick templates:
              </span>
              <button
                type="button"
                className="px-3 py-1 bg-gray-200 rounded-lg"
                onClick={() => setOverrideTemplate("9-5")}
              >
                9–5
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-gray-200 rounded-lg"
                onClick={() => setOverrideTemplate("morning")}
              >
                Morning (8–12)
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-gray-200 rounded-lg"
                onClick={() => setOverrideTemplate("afternoon")}
              >
                Afternoon (13–18)
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-gray-200 rounded-lg"
                onClick={() => setOverrideTemplate("full")}
              >
                Full day (8–20)
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-gray-200 rounded-lg"
                onClick={() => setOverrideTemplate("clear")}
              >
                Clear hours
              </button>
            </div>

            {/* Custom hours editor */}
            {!isOverrideClosed(selectedDate) && (
              <>
                <p className="font-medium mb-2">
                  Custom Hours for {selectedDate}:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {HOURS.map((hh) => {
                    const on = overrideHours(selectedDate).includes(
                      hh
                    );
                    return (
                      <button
                        key={hh}
                        type="button"
                        className={`px-3 py-1 rounded-lg border text-xs ${
                          on
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                        onClick={() => toggleOverrideHour(hh)}
                      >
                        {hh}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-500 mt-4">Select a date above.</p>
        )}

        {/* Save / reload */}
        <div className="flex flex-wrap gap-3 mt-8 items-center">
          <button
            className="px-5 py-3 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
            onClick={saveAll}
            disabled={loading}
          >
            Save
          </button>

          <button
            className="px-5 py-3 bg-gray-200 rounded-lg font-medium disabled:opacity-50"
            onClick={load}
            disabled={loading}
          >
            Reload
          </button>

          {log && (
            <span className="text-gray-600 text-sm mt-2 md:mt-0">
              {log}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
