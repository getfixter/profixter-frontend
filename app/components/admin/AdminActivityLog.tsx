"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminActivityLogs,
  getAdminActivitySummary,
  type AdminActivityLogItem,
  type AdminActivitySummary,
} from "@/lib/admin-service";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function detailsText(details?: Record<string, unknown>) {
  if (!details) return "";
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

const ENTITY_TYPES = ["", "User", "Lead", "Project", "Subscription", "Booking", "Blacklist"];

export default function AdminActivityLog() {
  const [items, setItems] = useState<AdminActivityLogItem[]>([]);
  const [summary, setSummary] = useState<AdminActivitySummary | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actor, setActor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const adminOptions = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((item) => {
      if (item.actorUserId && item.actorName) seen.set(String(item.actorUserId), item.actorName);
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getAdminActivityLogs({
        limit: 100,
        search: search || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        actorUserId: actor || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999` : undefined,
      }),
      getAdminActivitySummary(),
    ])
      .then(([logs, nextSummary]) => {
        if (cancelled) return;
        setItems(logs.items || []);
        setSummary(nextSummary);
        setError("");
      })
      .catch((loadError) => {
        console.error("Failed to load admin activity:", loadError);
        if (!cancelled) setError("Unable to load admin activity.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [action, actor, dateFrom, dateTo, entityType, search]);

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] bg-slate-950 p-5 text-white shadow-lg md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Security audit</p>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Admin Activity Log</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Permanent audit history for high-risk admin actions and secure deletions.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Users deleted", summary?.usersDeleted ?? 0],
              ["Leads deleted", summary?.leadsDeleted ?? 0],
              ["Projects deleted", summary?.projectsDeleted ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-2xl font-black">{value}</div>
                <div className="text-xs text-slate-300">Last 24h · {label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user, lead, project number, email..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Action"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>{type || "All entity types"}</option>
            ))}
          </select>
          <select
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            <option value="">All admins</option>
            {adminOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-bold text-slate-950">Newest activity first</div>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No activity found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article key={item._id} className="grid gap-3 px-5 py-4 lg:grid-cols-[170px_180px_160px_1fr]">
                <div className="text-sm font-semibold text-slate-600">{formatTime(item.createdAt)}</div>
                <div>
                  <div className="text-sm font-bold text-slate-950">{item.actorName || "Admin"}</div>
                  <div className="text-xs text-slate-500">{item.actorRole || "admin"}</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-950">{item.action}</div>
                  <div className="text-xs text-slate-500">{item.entityType}</div>
                </div>
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-slate-800">
                    {item.entityName || item.entityId || "-"}
                  </div>
                  <div className="mt-1 break-words text-xs leading-relaxed text-slate-500">
                    {detailsText(item.details)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
