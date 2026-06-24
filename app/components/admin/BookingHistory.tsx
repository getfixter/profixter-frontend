"use client";

import { useState } from "react";
import {
  getBookingHistory,
  type BookingHistoryEntry,
} from "@/lib/admin-service";

function historyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTimeNY(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTimeOnlyNY(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function dayKeyNY(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateRangeNY(startIso: string, endIso: string) {
  if (dayKeyNY(startIso) === dayKeyNY(endIso)) {
    return `${formatDateTimeNY(startIso)} – ${formatTimeOnlyNY(endIso)}`;
  }
  return `${formatDateTimeNY(startIso)} – ${formatDateTimeNY(endIso)}`;
}

const ISO_RE = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z";
const ISO_RANGE_RE = new RegExp(`(${ISO_RE})\\s*[–-]\\s*(${ISO_RE})`, "g");
const SINGLE_ISO_RE = new RegExp(ISO_RE, "g");

function formatHistoryValue(value: string) {
  const text = String(value ?? "");
  return text
    .replace(ISO_RANGE_RE, (_match, startIso: string, endIso: string) =>
      formatDateRangeNY(startIso, endIso)
    )
    .replace(SINGLE_ISO_RE, (iso) => formatDateTimeNY(iso));
}

function actionTitle(entry: BookingHistoryEntry) {
  if (entry.summary) return entry.summary;
  return entry.actionType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actorLabel(entry: BookingHistoryEntry) {
  const position = String(entry.actorPosition || "").trim();
  const role = String(entry.actorRole || "").trim().toLowerCase();
  if (position === "Fixter" || position === "General Fixter") return position;
  if (role === "admin") return "admin";
  if (role === "customer") return "customer";
  if (role === "employee") return "employee";
  return "system";
}

function actorBadgeTone(label: string) {
  if (label === "admin") return "border-blue-200 bg-blue-50 text-blue-700";
  if (label === "customer") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "Fixter" || label === "General Fixter") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function BookingHistory({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<BookingHistoryEntry[]>([]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || loaded) return;
    setLoading(true);
    setError("");
    try {
      setEntries(await getBookingHistory(bookingId));
      setLoaded(true);
    } catch {
      setError("History could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-slate-700"
        aria-expanded={open}
      >
        <span>History</span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3">
          {loading && <p className="text-sm text-slate-500">Loading history...</p>}
          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          {!loading && !error && entries.length === 0 && (
            <p className="text-sm text-slate-500">No recorded changes yet.</p>
          )}
          <div className="space-y-3">
            {entries.map((entry) => {
              const label = actorLabel(entry);
              return (
                <article
                  key={entry._id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <time className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        {historyDate(entry.createdAt)}
                      </time>
                      <p className="mt-1 text-sm font-extrabold text-slate-950">
                        {actionTitle(entry)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${actorBadgeTone(
                        label
                      )}`}
                    >
                      {label}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-bold text-slate-800">
                      {entry.actorName || "System"}
                    </span>
                  </p>

                  {entry.changes.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      {entry.changes.map((change) => (
                        <div
                          key={`${entry._id}-${change.field}`}
                          className="text-xs leading-5 text-slate-600"
                        >
                          <strong className="text-slate-800">{change.label}:</strong>
                          <span className="ml-1 break-words">
                            {formatHistoryValue(change.oldValue)}
                          </span>
                          <span className="px-1 text-slate-400">→</span>
                          <span className="break-words font-semibold text-slate-900">
                            {formatHistoryValue(change.newValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
