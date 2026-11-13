"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminActivityLogs,
  getAdminActivitySummary,
  type AdminActivityLogItem,
  type AdminActivitySummary,
} from "@/lib/admin-service";
import { Button, EmptyState, ErrorState, Field, SearchField, Select, SkeletonRows, TextInput } from "@/app/components/admin/ui";

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
    // Nested values (a customer edit's change list) read as "[object Object]"; their summary is shown instead.
    .filter(([, value]) => value !== undefined && value !== null && value !== "" && typeof value !== "object")
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

const ENTITY_TYPES = ["", "User", "Lead", "Project", "Subscription", "Booking", "Blacklist"];

/** Typing waits this long before asking the server, so a word is one request, not one per letter. */
function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

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
  const [attempt, setAttempt] = useState(0);
  const debouncedSearch = useDebounced(search);
  const debouncedAction = useDebounced(action);

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
        search: debouncedSearch || undefined,
        action: debouncedAction || undefined,
        entityType: entityType || undefined,
        actorUserId: actor || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999` : undefined,
      }),
      getAdminActivitySummary(),
    ])
      .then(([logs, nextSummary]) => {
        if (cancelled) return;
        setItems(Array.isArray(logs?.items) ? logs.items : []);
        setSummary(nextSummary || null);
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
  }, [debouncedAction, actor, dateFrom, dateTo, entityType, debouncedSearch, attempt]);

  const filtered = Boolean(search || action || entityType || actor || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch("");
    setAction("");
    setEntityType("");
    setActor("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-4" data-activity-log>
      <p className="text-[14px] text-adm-text-2">Permanent audit history for high-risk admin actions and secure deletions.</p>

      <dl className="grid grid-cols-3 gap-2" aria-label="Last 24 hours">
        {(
          [
            ["Users deleted", summary?.usersDeleted ?? 0],
            ["Leads deleted", summary?.leadsDeleted ?? 0],
            ["Projects deleted", summary?.projectsDeleted ?? 0],
          ] as Array<[string, number]>
        ).map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-adm-md border border-adm-line bg-adm-surface px-3 py-2.5">
            <dd className="adm-num text-[20px] font-semibold text-adm-ink">{value}</dd>
            <dt className="text-[12px] leading-tight text-adm-text-3">Last 24h · {label}</dt>
          </div>
        ))}
      </dl>

      <section className="rounded-adm-md border border-adm-line bg-adm-surface p-4" aria-label="Filters">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <SearchField label="Search activity" value={search} onChange={setSearch} placeholder="Search user, lead, project number, email..." />
          <Field label="Action">
            <TextInput value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" autoCapitalize="none" />
          </Field>
          <Field label="Entity type">
            <Select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              options={ENTITY_TYPES.map((type) => ({ value: type, label: type || "All entity types" }))}
            />
          </Field>
          <Field label="Admin">
            <Select
              value={actor}
              onChange={(event) => setActor(event.target.value)}
              options={[{ value: "", label: "All admins" }, ...adminOptions.map(([id, name]) => ({ value: id, label: name }))]}
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <Field label="From">
            <TextInput type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </Field>
          <Field label="To">
            <TextInput type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </Field>
        </div>
        {filtered ? (
          <div className="mt-3">
            <Button variant="tertiary" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label="Activity">
        <h3 className="border-b border-adm-line px-4 py-3 text-[15px] font-semibold text-adm-ink">Newest activity first</h3>
        {loading ? (
          <SkeletonRows count={4} leading={false} label="Loading activity" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : items.length === 0 ? (
          <EmptyState message="No activity found." detail={filtered ? "Try fewer filters." : undefined} />
        ) : (
          <ul role="list" className="divide-y divide-adm-line">
            {items.map((item) => (
              <li key={item._id} className="grid gap-1.5 px-4 py-3 lg:grid-cols-[170px_180px_180px_1fr] lg:gap-3">
                <div className="adm-num text-[13px] text-adm-text-2">{formatTime(item.createdAt)}</div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-adm-ink">{item.actorName || "Admin"}</div>
                  <div className="text-[12px] text-adm-text-3">{item.actorRole || "admin"}</div>
                </div>
                <div className="min-w-0">
                  <div className="break-words text-[14px] font-semibold text-adm-ink">{item.action}</div>
                  <div className="text-[12px] text-adm-text-3">{item.entityType}</div>
                </div>
                <div className="min-w-0">
                  <div className="break-words text-[14px] text-adm-ink">{item.entityName || item.entityId || "-"}</div>
                  <div className="mt-0.5 break-words text-[12px] leading-relaxed text-adm-text-3">{detailsText(item.details)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
