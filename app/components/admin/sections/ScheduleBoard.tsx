"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { canOpenAvailability } from "@/lib/admin/sections";
import { errorMessage, useAdminQuery } from "@/lib/admin/query";
import {
  addDays,
  dayLabel,
  fetchSchedule,
  isYMD,
  jobKeys,
  nyYMD,
  relativeDay,
  rememberKey,
  shortName,
  shortTypeLabel,
  timeNY,
  todayYMD,
  topFlag,
  type CapacityDay,
  type JobRow,
  type ScheduleData,
} from "@/lib/admin/jobs";
import { Chip, EmptyState, ErrorState, FilterBar, PageHeader, SkeletonRows, StatusBadge, Tabs, bookingStatusTone, cx, useWideLayout } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { DateStrip } from "@/app/components/admin/jobs/DateStrip";
import { JobRowItem } from "@/app/components/admin/jobs/JobRows";
import { markOpenedFromList } from "@/app/components/admin/jobs/openedFrom";
import "@/app/components/admin/jobs/jobs.css";

const PX_PER_MIN = 1.1;
const UNASSIGNED = "unassigned";
const ACTIVE = new Set(["Pending", "Pending Confirmation", "Confirmed"]);

type Placed = { row: JobRow; start: number; end: number; laneKey: string; conflict: boolean; col: number; cols: number };

/** Minutes since New York midnight. */
function nyMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
}

function hhmm(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function laneKeyOf(row: JobRow) {
  return row.technician?.id || UNASSIGNED;
}

/**
 * Conflicts: one Fixter with two live jobs whose times overlap on the same
 * day (computed from the server's rows; the engine refuses new ones, so a
 * conflict here means something to fix by hand).
 */
function findConflicts(rows: JobRow[]): Set<string> {
  const out = new Set<string>();
  const byTech = new Map<string, { id: string; day: string; s: number; e: number }[]>();
  for (const row of rows) {
    if (!row.technician || !ACTIVE.has(String(row.status)) || !row.date) continue;
    const s = new Date(row.date).getTime();
    const e = row.endEstimate ? new Date(row.endEstimate).getTime() : s + 90 * 60000;
    const list = byTech.get(row.technician.id) || [];
    list.push({ id: row.id, day: nyYMD(row.date), s, e });
    byTech.set(row.technician.id, list);
  }
  for (const list of byTech.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.day === b.day && a.s < b.e && b.s < a.e) {
          out.add(a.id);
          out.add(b.id);
        }
      }
    }
  }
  return out;
}

/** Side-by-side columns for jobs that overlap inside one lane. */
function place(rows: JobRow[], conflicts: Set<string>): Placed[] {
  const items = rows
    .map((row) => {
      const start = nyMinutes(row.date) ?? 8 * 60;
      const endMin = nyMinutes(row.endEstimate);
      const end = endMin !== null && endMin > start ? endMin : start + 90;
      return { row, start, end, laneKey: laneKeyOf(row), conflict: conflicts.has(row.id), col: 0, cols: 1 };
    })
    .sort((a, b) => a.start - b.start);
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols: number[] = [];
    for (const it of cluster) {
      let c = cols.findIndex((end) => end <= it.start);
      if (c < 0) {
        c = cols.length;
        cols.push(it.end);
      } else cols[c] = it.end;
      it.col = c;
    }
    for (const it of cluster) it.cols = Math.max(1, cols.length);
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return items;
}

function toneOf(row: JobRow): string {
  const flag = topFlag(row);
  if (flag?.severity === "problem") return "problem";
  return bookingStatusTone(row.status).tone;
}

/**
 * Schedule (K.3): the day or week by technician, from GET /api/admin/schedule.
 * Phone: a vertical timeline for one day with technician chips (a week is an
 * agenda). Desktop: technician columns x time for a day, or seven day columns
 * for a week. Closed and full slots are shaded from the engine's capacity;
 * conflicts are outlined in red with the alert icon. A tap opens the job
 * sheet (reassign there, with the same availability-aware picker). No drag
 * and drop: the engine's rules need a confirmation step anyway.
 */
export function ScheduleBoard() {
  const { user } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const wide = useWideLayout();
  const today = todayYMD();
  const mode = params.get("mode") === "week" ? "week" : "day";
  const date = isYMD(params.get("date")) ? (params.get("date") as string) : today;
  const lane = params.get("tech") || "";
  const from = date;
  const to = mode === "week" ? addDays(date, 6) : date;

  const setParams = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const query = sp.toString();
    router.replace(query ? `/admin/schedule?${query}` : "/admin/schedule", { scroll: false });
  };

  const key = jobKeys.schedule(from, to, "");
  rememberKey(key);
  const q = useAdminQuery(key, (signal) => fetchSchedule(from, to, "", signal), { pollMs: 60_000, staleTime: 20_000 });
  const data = q.data;

  const allRows = useMemo(() => (data?.lanes || []).flatMap((l) => l.rows), [data]);
  const conflicts = useMemo(() => findConflicts(allRows), [allRows]);
  const lanes = useMemo(() => {
    const list = (data?.lanes || []).map((l) => ({ key: l.technician?.id || UNASSIGNED, name: l.technician?.name || "Unassigned", rows: l.rows }));
    return lane ? list.filter((l) => l.key === lane) : list;
  }, [data, lane]);
  const rowsShown = useMemo(() => lanes.flatMap((l) => l.rows), [lanes]);

  const qs = params.toString();
  const hrefFor = useCallback((row: JobRow) => `/admin/schedule/jobs/${encodeURIComponent(row.id)}${qs ? `?${qs}` : ""}`, [qs]);

  const tabs = [
    { id: "board", label: "Schedule", href: "/admin/schedule" },
    ...(canOpenAvailability(user) ? [{ id: "availability", label: "Availability", href: "/admin/schedule/availability" }] : []),
  ];
  const stripLabel = mode === "week" ? `${dayLabel(from)} – ${dayLabel(to)}` : relativeDay(date) === dayLabel(date) || relativeDay(date) === dayLabel(date, { year: true }) ? dayLabel(date, { year: date.slice(0, 4) !== today.slice(0, 4) }) : `${relativeDay(date)} · ${dayLabel(date)}`;
  const go = (ymd: string) => setParams({ date: ymd === today ? null : ymd });

  return (
    <div data-section="schedule" data-mode={mode}>
      <PageHeader title="Schedule" description="Jobs by Fixter, and when the team is available" />
      {tabs.length > 1 && <Tabs label="Schedule" value="board" items={tabs} className="mb-3" />}
      <FilterBar label="Schedule view">
        <Chip onClick={() => setParams({ mode: null })} selected={mode === "day"}>
          Day
        </Chip>
        <Chip onClick={() => setParams({ mode: "week" })} selected={mode === "week"}>
          Week
        </Chip>
        <span className="mx-1 h-6 w-px flex-none bg-adm-line-2" aria-hidden="true" />
        <Chip onClick={() => setParams({ tech: null })} selected={!lane}>
          All
        </Chip>
        {(data?.lanes || []).map((l) => {
          const k = l.technician?.id || UNASSIGNED;
          return (
            <Chip key={k} onClick={() => setParams({ tech: k })} selected={lane === k} count={l.rows.length} tone={k === UNASSIGNED && l.rows.length ? "attention" : "default"}>
              {l.technician ? shortName(l.technician.name) || l.technician.name : "Unassigned"}
            </Chip>
          );
        })}
      </FilterBar>
      <DateStrip date={date} step={mode === "week" ? 7 : 1} label={stripLabel} onChange={go} onPickDay={go} />
      {conflicts.size > 0 && (
        <p className="mb-2 flex items-center gap-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] font-medium text-adm-problem" role="status" data-conflicts={conflicts.size}>
          <ExclamationTriangleIcon className="h-4 w-4 flex-none" aria-hidden="true" />
          {conflicts.size} jobs overlap for the same Fixter. Open one to change its Fixter or time.
        </p>
      )}
      {data?.capacityError && <p className="mb-2 text-[13px] text-adm-text-2">Capacity could not be loaded: {data.capacityError.message}</p>}

      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading the schedule" />
      ) : q.error && !data ? (
        <ErrorState title="The schedule could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : !data ? null : mode === "day" ? (
        wide ? (
          <DayColumns data={data} date={date} lanes={lanes} conflicts={conflicts} hrefFor={hrefFor} />
        ) : (
          <DayTimeline data={data} date={date} rows={rowsShown} conflicts={conflicts} hrefFor={hrefFor} />
        )
      ) : wide ? (
        <WeekColumns data={data} from={from} rows={rowsShown} conflicts={conflicts} hrefFor={hrefFor} />
      ) : (
        <WeekAgenda data={data} from={from} rows={rowsShown} conflicts={conflicts} hrefFor={hrefFor} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function hoursFor(rowsPlaced: Placed[], cap: CapacityDay | undefined): { start: number; end: number } {
  let start = 7 * 60;
  let end = 19 * 60;
  for (const p of rowsPlaced) {
    start = Math.min(start, Math.floor(p.start / 60) * 60);
    end = Math.max(end, Math.ceil(p.end / 60) * 60);
  }
  for (const s of cap?.slots || []) {
    start = Math.min(start, Math.floor(hhmm(s.time) / 60) * 60);
    end = Math.max(end, Math.ceil(hhmm(s.endTime || s.time) / 60) * 60);
  }
  return { start: Math.max(0, start), end: Math.min(24 * 60, end) };
}

function hourLabel(min: number) {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
}

/** Shading behind the jobs: closed day, full slots (no seats left), open slots plain. */
function Bands({ cap, start }: { cap: CapacityDay | undefined; start: number }) {
  if (!cap) return null;
  if (cap.closed) return <div className="adm-sched-band" data-state="closed" style={{ top: 0, bottom: 0 }} aria-hidden="true" />;
  return (
    <>
      {cap.slots
        .filter((s) => !s.open || s.remainingCapacity <= 0)
        .map((s) => (
          <div
            key={s.time}
            className="adm-sched-band"
            data-state={!s.open ? "closed" : "full"}
            style={{ top: (hhmm(s.time) - start) * PX_PER_MIN, height: Math.max(8, (hhmm(s.endTime || s.time) - hhmm(s.time)) * PX_PER_MIN) }}
            aria-hidden="true"
          />
        ))}
    </>
  );
}

function capText(cap: CapacityDay | undefined): string {
  if (!cap) return "";
  if (cap.closed) return cap.note ? `Closed · ${cap.note}` : "Closed";
  const open = cap.slots.reduce((sum, s) => sum + (s.open ? Math.max(0, s.remainingCapacity) : 0), 0);
  return `${open} of ${cap.totalCapacity} seats open${cap.note ? ` · ${cap.note}` : ""}`;
}

function JobBlock({ p, start, href }: { p: Placed; start: number; href: string }) {
  const top = (p.start - start) * PX_PER_MIN;
  const height = Math.max(40, (p.end - p.start) * PX_PER_MIN - 2);
  const width = 100 / p.cols;
  const flag = topFlag(p.row);
  return (
    <Link
      href={href}
      scroll={false}
      onClick={markOpenedFromList}
      className="adm-sched-job"
      data-tone={toneOf(p.row)}
      data-conflict={p.conflict ? "true" : undefined}
      data-sched-job={p.row.id}
      style={{ top, height, left: `calc(${p.col * width}% + 4px)`, width: `calc(${width}% - 8px)`, right: "auto" }}
      aria-label={[p.row.customer?.name || "Customer", timeNY(p.row.date), shortTypeLabel(p.row), p.row.status, p.row.technician?.name || "Unassigned", p.conflict ? "conflicts with another job" : flag?.label || ""].filter(Boolean).join(", ")}
    >
      <span className="flex items-center gap-1 text-[12px] font-semibold text-adm-text-2">
        {p.conflict && <ExclamationTriangleIcon className="h-3.5 w-3.5 flex-none text-adm-problem" aria-hidden="true" />}
        <span className="adm-num">{p.row.type === "full_day" ? "Full day" : timeNY(p.row.date)}</span>
      </span>
      <span className="block truncate text-[14px] font-semibold text-adm-ink">{p.row.customer?.name || "Customer"}</span>
      <span className="block truncate text-[12px] text-adm-text-2">{[shortTypeLabel(p.row), p.row.town].filter(Boolean).join(" · ")}</span>
    </Link>
  );
}

/** Phone, one day: a vertical timeline (all lanes, or the chosen technician). */
function DayTimeline({ data, date, rows, conflicts, hrefFor }: { data: ScheduleData; date: string; rows: JobRow[]; conflicts: Set<string>; hrefFor: (r: JobRow) => string }) {
  const cap = data.capacity?.days.find((d) => d.date === date);
  const placed = place(rows, conflicts);
  const { start, end } = hoursFor(placed, cap);
  const height = (end - start) * PX_PER_MIN;
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[13px] text-adm-text-2" data-capacity="">
        {rows.length} {rows.length === 1 ? "job" : "jobs"}
        {cap ? ` · ${capText(cap)}` : ""}
      </p>
      {!rows.length && <EmptyState message="No jobs this day" />}
      <div className="adm-sched grid-cols-[48px_minmax(0,1fr)]" data-timeline="">
        <div className="relative" style={{ height }}>
          {Array.from({ length: Math.floor((end - start) / 60) + 1 }, (_, i) => (
            <span key={i} className="absolute left-1 -translate-y-1/2 text-[12px] text-adm-text-3" style={{ top: i * 60 * PX_PER_MIN }}>
              {i === 0 ? "" : hourLabel(start + i * 60)}
            </span>
          ))}
        </div>
        <div className="adm-sched-col" style={{ height }}>
          <Bands cap={cap} start={start} />
          {Array.from({ length: Math.floor((end - start) / 60) }, (_, i) => (
            <div key={i} className="adm-sched-hour" style={{ top: (i + 1) * 60 * PX_PER_MIN }} aria-hidden="true" />
          ))}
          {placed.map((p) => (
            <JobBlock key={p.row.id} p={p} start={start} href={hrefFor(p.row)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Desktop, one day: technician columns x time. */
function DayColumns({ data, date, lanes, conflicts, hrefFor }: { data: ScheduleData; date: string; lanes: { key: string; name: string; rows: JobRow[] }[]; conflicts: Set<string>; hrefFor: (r: JobRow) => string }) {
  const cap = data.capacity?.days.find((d) => d.date === date);
  const placedByLane = lanes.map((l) => ({ ...l, placed: place(l.rows, conflicts) }));
  const { start, end } = hoursFor(placedByLane.flatMap((l) => l.placed), cap);
  const height = (end - start) * PX_PER_MIN;
  if (!lanes.length) return <EmptyState message="No jobs this day" detail={cap ? capText(cap) : undefined} />;
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[13px] text-adm-text-2" data-capacity="">
        {cap ? capText(cap) : ""}
      </p>
      <div className="adm-sched-scroll rounded-adm-md">
        <div className="adm-sched" style={{ gridTemplateColumns: `56px repeat(${lanes.length}, minmax(180px, 1fr))` }} data-day-columns="">
          <div className="sticky left-0 z-10 bg-adm-surface" />
          {placedByLane.map((l) => (
            <div key={l.key} className="border-b border-l border-adm-line px-2 py-2 text-[14px] font-semibold text-adm-ink" data-lane={l.key}>
              <span className={l.key === UNASSIGNED ? "text-adm-attn" : ""}>{l.name}</span>
              <span className="adm-num font-normal text-adm-text-2"> · {l.rows.length}</span>
            </div>
          ))}
          <div className="relative" style={{ height }}>
            {Array.from({ length: Math.floor((end - start) / 60) + 1 }, (_, i) => (
              <span key={i} className="absolute left-2 -translate-y-1/2 text-[12px] text-adm-text-3" style={{ top: i * 60 * PX_PER_MIN }}>
                {i === 0 ? "" : hourLabel(start + i * 60)}
              </span>
            ))}
          </div>
          {placedByLane.map((l) => (
            <div key={l.key} className="adm-sched-col" style={{ height }}>
              <Bands cap={cap} start={start} />
              {Array.from({ length: Math.floor((end - start) / 60) }, (_, i) => (
                <div key={i} className="adm-sched-hour" style={{ top: (i + 1) * 60 * PX_PER_MIN }} aria-hidden="true" />
              ))}
              {l.placed.map((p) => (
                <JobBlock key={p.row.id} p={p} start={start} href={hrefFor(p.row)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function days7(from: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(from, i));
}

/** Desktop, a week: seven day columns with the jobs in time order. */
function WeekColumns({ data, from, rows, conflicts, hrefFor }: { data: ScheduleData; from: string; rows: JobRow[]; conflicts: Set<string>; hrefFor: (r: JobRow) => string }) {
  const days = days7(from);
  return (
    <div className="adm-sched-scroll rounded-adm-md">
      <div className="adm-sched grid-cols-[repeat(7,minmax(140px,1fr))]" data-week-columns="">
        {days.map((d) => {
          const cap = data.capacity?.days.find((c) => c.date === d);
          const list = rows.filter((r) => nyYMD(r.date) === d).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return (
            <div key={d} className={cx("flex min-h-[320px] flex-col gap-1.5 border-l border-adm-line p-2 first:border-l-0", cap?.closed && "adm-sched-closed")} data-week-day={d}>
              <div className="mb-1">
                <p className={cx("text-[14px] font-semibold", d === todayYMD() ? "text-adm-accent-ink" : "text-adm-ink")}>{dayLabel(d)}</p>
                <p className="text-[12px] text-adm-text-2">
                  {list.length} {list.length === 1 ? "job" : "jobs"}
                  {cap ? ` · ${capText(cap)}` : ""}
                </p>
              </div>
              {list.map((r) => (
                <Link
                  key={r.id}
                  href={hrefFor(r)}
                  scroll={false}
                  onClick={markOpenedFromList}
                  className="adm-sched-job !relative !left-0 !right-0 block"
                  data-tone={toneOf(r)}
                  data-conflict={conflicts.has(r.id) ? "true" : undefined}
                  data-sched-job={r.id}
                  aria-label={[r.customer?.name || "Customer", timeNY(r.date), r.technician?.name || "Unassigned", r.status, conflicts.has(r.id) ? "conflicts with another job" : ""].filter(Boolean).join(", ")}
                >
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-adm-text-2">
                    {conflicts.has(r.id) && <ExclamationTriangleIcon className="h-3.5 w-3.5 text-adm-problem" aria-hidden="true" />}
                    <span className="adm-num">{r.type === "full_day" ? "Full day" : timeNY(r.date)}</span>
                  </span>
                  <span className="block truncate text-[14px] font-semibold text-adm-ink">{r.customer?.name || "Customer"}</span>
                  <span className={cx("block truncate text-[12px]", r.technician ? "text-adm-text-2" : "font-semibold text-adm-attn")}>{r.technician ? shortName(r.technician.name) : "Unassigned"}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Phone, a week: an agenda by day with capacity and conflicts. */
function WeekAgenda({ data, from, rows, conflicts, hrefFor }: { data: ScheduleData; from: string; rows: JobRow[]; conflicts: Set<string>; hrefFor: (r: JobRow) => string }) {
  const days = days7(from);
  return (
    <div className="flex flex-col gap-4" data-week-agenda="">
      {days.map((d) => {
        const cap = data.capacity?.days.find((c) => c.date === d);
        const list = rows.filter((r) => nyYMD(r.date) === d).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        return (
          <section key={d} aria-label={dayLabel(d)} data-week-day={d}>
            <div className="flex min-h-[40px] items-center justify-between gap-2 px-1">
              <h2 className="text-[15px] font-semibold text-adm-ink">
                {relativeDay(d)}
                <span className="adm-num font-normal text-adm-text-2"> · {list.length}</span>
              </h2>
              {cap && (cap.closed ? <StatusBadge tone="neutral">Closed</StatusBadge> : <span className="text-[13px] text-adm-text-2">{capText(cap)}</span>)}
            </div>
            {list.length ? (
              <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
                {list.map((r) => (
                  <JobRowItem key={r.id} row={r} href={hrefFor(r)} conflict={conflicts.has(r.id)} />
                ))}
              </ul>
            ) : (
              <p className={cx("rounded-adm-md border border-dashed border-adm-line-2 px-4 py-3 text-[14px] text-adm-text-2", cap?.closed && "adm-sched-closed")}>{cap?.closed ? "Closed" : "No jobs"}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
