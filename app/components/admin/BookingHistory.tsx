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
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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
            {entries.map((entry) => (
              <article
                key={entry._id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time className="text-xs font-bold text-slate-500">
                    {historyDate(entry.createdAt)}
                  </time>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {entry.actorPosition || entry.actorRole}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-950">
                  {entry.actorName}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{entry.summary}</p>
                {entry.changes.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {entry.changes.map((change) => (
                      <div
                        key={`${entry._id}-${change.field}`}
                        className="text-xs leading-5 text-slate-600"
                      >
                        <strong className="text-slate-800">{change.label}:</strong>{" "}
                        <span className="break-words">{change.oldValue}</span>
                        <span className="px-1 text-slate-400">→</span>
                        <span className="break-words font-semibold text-slate-900">
                          {change.newValue}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
