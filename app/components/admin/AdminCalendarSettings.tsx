"use client";

import React, { useState, useEffect, useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function AdminCalendarSettings() {
  const api =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "3000"
      ? "http://localhost:5000"
      : "";

  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  // Create hours list: 08:00–22:00
  const HOURS = useMemo(() => {
    const list = [];
    for (let h = 8; h <= 22; h++)
      list.push(`${String(h).padStart(2, "0")}:00`);
    return list;
  }, []);

  // Format date to YYYY-MM-DD in NY timezone
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
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};


  // --------------------------
  // LOAD CALENDAR CONFIG
  // --------------------------
  const load = async () => {
    try {
      setLoading(true);
      setLog("");

      const res = await fetch(`${api}/api/admin/calendar`, {
        headers: authHeader(),
      });
      const data = await res.json();

      if (!res.ok)
        throw new Error(data?.message || `HTTP ${res.status}`);

      setCfg({
        closedWeekdays: data.closedWeekdays || [],
        minLeadDays: data.minLeadDays ?? 2,
        defaultHours: uniqSorted(data.defaultHours || []),
        overrides: data.overrides || {},
        holidays: data.holidays || [],
        timezone: data.timezone || "America/New_York",
        slotMinutes: data.slotMinutes || 60,
        handymanCapacity: data.handymanCapacity ?? 1,
      });
    } catch (err: any) {
      setLog("⚠️ Using fallback config. " + err.message);
      setCfg({
        closedWeekdays: [0],
        minLeadDays: 2,
        defaultHours: ["09:00", "10:00", "11:00", "12:00", "13:00"],
        overrides: {},
        holidays: [],
        timezone: "America/New_York",
        slotMinutes: 60,
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
    try {
      setLoading(true);
      setLog("Saving…");

      const body = {
        closedWeekdays: cfg.closedWeekdays,
        minLeadDays: cfg.minLeadDays,
        defaultHours: cfg.defaultHours,
        overrides: cfg.overrides,
        holidays: cfg.holidays,
        handymanCapacity: cfg.handymanCapacity,
      };

      const res = await fetch(`${api}/api/admin/calendar`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message);

      setLog("✅ Saved!");
    } catch (err: any) {
      setLog("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!cfg)
    return (
      <div className="bg-white p-6 rounded-xl shadow text-center">
        Loading settings…
      </div>
    );

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
    if (selectedDate === ymd) return "bg-blue-600 text-white rounded-md";
    if (isHoliday(ymd)) return "bg-red-200 text-red-700 rounded-md";
    if (isOverrideClosed(ymd)) return "bg-gray-300 text-gray-700 rounded-md";
    if (hasOverride(ymd)) return "bg-yellow-200 text-yellow-700 rounded-md";
    if (isClosedWeekday(date))
      return "bg-gray-200 text-gray-600 rounded-md";
    return "bg-white";
  };

  // Toggle day closed weekly
  const toggleWeekday = (idx: number) =>
    setCfg((p: any) => ({
      ...p,
      closedWeekdays: p.closedWeekdays.includes(idx)
        ? p.closedWeekdays.filter((x: number) => x !== idx)
        : [...p.closedWeekdays, idx].sort(),
    }));

  // Set override: closed
  const markClosed = () => {
    if (!selectedDate) return;
    setCfg((p: any) => ({
      ...p,
      overrides: { ...p.overrides, [selectedDate]: [] },
    }));
  };

  // Remove override → back to default
  const useDefault = () => {
    if (!selectedDate) return;
    setCfg((p: any) => {
      const next = { ...p.overrides };
      delete next[selectedDate];
      return { ...p, overrides: next };
    });
  };

  // Toggle override hour
  const toggleOverrideHour = (hh: string) => {
    if (!selectedDate) return;

    setCfg((p: any) => {
      const cur = overrideHours(selectedDate);
      const next = cur.includes(hh)
        ? cur.filter((x: string) => x !== hh)
        : [...cur, hh];
      return {
        ...p,
        overrides: { ...p.overrides, [selectedDate]: uniqSorted(next) },
      };
    });
  };

  const toggleDefaultHour = (hh: string) =>
    setCfg((p: any) => {
      const has = p.defaultHours.includes(hh);
      const next = has
        ? p.defaultHours.filter((x: string) => x !== hh)
        : [...p.defaultHours, hh];
      return { ...p, defaultHours: uniqSorted(next) };
    });

  const addHoliday = (d: string) =>
    setCfg((p: any) => ({
      ...p,
      holidays: uniqSorted([...p.holidays, d]),
    }));

  const removeHoliday = (d: string) =>
    setCfg((p: any) => ({
      ...p,
      holidays: p.holidays.filter((x: string) => x !== d),
    }));

  // ---- UI RENDER ----
  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* MAIN SETTINGS CARD */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
        <h2 className="text-2xl font-bold mb-4">Calendar Settings</h2>

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
              setCfg((p: any) => ({
                ...p,
                minLeadDays: Number(e.target.value),
              }))
            }
          />
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
              setCfg((p: any) => ({
                ...p,
                handymanCapacity: Number(e.target.value) || 1,
              }))
            }
          />
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
                  className={`px-3 py-1 rounded-lg border ${
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

          <div className="flex gap-3 mt-3">
            <button
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() =>
                setCfg((p: any) => ({
                  ...p,
                  defaultHours: [
                    "09:00",
                    "10:00",
                    "11:00",
                    "12:00",
                    "13:00",
                    "14:00",
                    "15:00",
                    "16:00",
                  ],
                }))
              }
            >
              9–5 default
            </button>

            <button
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() =>
                setCfg((p: any) => ({ ...p, defaultHours: HOURS }))
              }
            >
              Select All
            </button>

            <button
              className="px-4 py-2 bg-gray-200 rounded-lg"
              onClick={() =>
                setCfg((p: any) => ({ ...p, defaultHours: [] }))
              }
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR CARD */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
        <h3 className="text-xl font-bold mb-4">Calendar Override Editor</h3>

        {/* Selected date */}
        <div className="flex items-center gap-4 mb-4">
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
            onClick={() => setSelectedDate(toYMD(new Date(), tz))}
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

        {/* Per date editor */}
        {selectedDate ? (
          <div className="mt-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                className="px-3 py-2 bg-red-200 text-red-700 rounded-lg"
                onClick={markClosed}
              >
                Mark CLOSED
              </button>

              <button
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg"
                onClick={useDefault}
              >
                Use Default Hours
              </button>

              <button
                className="px-3 py-2 bg-yellow-200 text-yellow-700 rounded-lg"
                onClick={() => addHoliday(selectedDate)}
              >
                Add Holiday
              </button>

              {isHoliday(selectedDate) && (
                <button
                  className="px-3 py-2 bg-gray-300 rounded-lg"
                  onClick={() => removeHoliday(selectedDate)}
                >
                  Remove Holiday
                </button>
              )}
            </div>

            {/* Custom hours editor */}
            {!isOverrideClosed(selectedDate) && (
              <>
                <p className="font-medium mb-2">
                  Custom Hours for {selectedDate}:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {HOURS.map((hh) => {
                    const on = overrideHours(selectedDate).includes(hh);
                    return (
                      <button
                        key={hh}
                        className={`px-3 py-1 rounded-lg border ${
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
        <div className="flex gap-3 mt-8">
          <button
            className="px-5 py-3 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700"
            onClick={saveAll}
            disabled={loading}
          >
            Save
          </button>

          <button
            className="px-5 py-3 bg-gray-200 rounded-lg font-medium"
            onClick={load}
            disabled={loading}
          >
            Reload
          </button>

          {log && <span className="text-gray-600">{log}</span>}
        </div>
      </div>
    </div>
  );
}
