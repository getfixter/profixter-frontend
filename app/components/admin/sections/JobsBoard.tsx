"use client";

import { ArrowDownTrayIcon, ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisHorizontalIcon, PlusIcon, UserIcon } from "@heroicons/react/24/outline";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CreateVisitSheet from "@/app/components/admin/tools/CreateVisitSheet";
import { can, PERM } from "@/lib/admin-access";
import { fetchAssignees, fetchCustomers, fetchMembers, keys } from "@/lib/admin/fetchers";
import { errorMessage, fetchQuery, useAdminQuery } from "@/lib/admin/query";
import { isFieldFixter } from "@/lib/admin/sections";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import {
  addDays,
  dayLabel,
  fetchJobs,
  fetchNeedsAction,
  isYMD,
  jobKeys,
  refreshJobLists,
  rememberKey,
  rowsToCsv,
  searchJobs,
  todayYMD,
  type JobRow,
  type ListParams,
} from "@/lib/admin/jobs";
import { Button, Chip, EmptyState, ErrorState, FilterBar, IconButton, Menu, PageHeader, SearchField, SkeletonRows, cx, useToast, type MenuItem } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { DateStrip } from "@/app/components/admin/jobs/DateStrip";
import { DayGroup, groupByDay, JobRowItem } from "@/app/components/admin/jobs/JobRows";
import { NeedsActionView } from "@/app/components/admin/jobs/NeedsActionView";
import { useQuietList } from "@/app/components/admin/jobs/useQuietList";
import "@/app/components/admin/jobs/jobs.css";

type View = "action" | "today" | "tomorrow" | "day" | "week" | "all";
const VIEWS: View[] = ["action", "today", "tomorrow", "day", "week", "all"];

const STATUS_FILTERS = [
  { value: "", label: "Active" },
  { value: "requests", label: "Requests" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
  { value: "all", label: "Everything" },
];
const STATUS_VALUES = new Set(STATUS_FILTERS.map((s) => s.value));
const ALL_SPAN = 28;

/**
 * Old view names (foundation and earlier links) to the new ones, so a saved
 * link still opens the same list: pending/unassigned -> Needs action,
 * upcoming -> Week, confirmed/completed -> All with that status, day -> day.
 */
function readView(params: URLSearchParams): { view: View; status: string } {
  const raw = params.get("view") || "";
  const rawStatus = (params.get("status") || "").toLowerCase();
  const status = rawStatus === "pending" ? "requests" : rawStatus === "pending confirmation" ? "requests" : rawStatus === "cancelled" ? "canceled" : STATUS_VALUES.has(rawStatus) ? rawStatus : "";
  if (raw === "pending" || raw === "unassigned") return { view: "action", status: "" };
  if (raw === "upcoming") return { view: "week", status: "" };
  if (raw === "confirmed" || raw === "completed") return { view: "all", status: raw };
  if (VIEWS.includes(raw as View)) return { view: raw as View, status };
  return { view: "action", status };
}

/**
 * Jobs (F.1): the owner's landing screen.
 *
 * Views: Needs action · Today · Tomorrow · Week · All, with the counts the
 * server computes (the same functions as the badges). A date strip moves the
 * day or week; All is a 4-week window with Earlier / Later. Search covers all
 * dates on the server (text in a POST body, never the URL). The list refreshes
 * quietly on focus and every 60s, and never moves by itself: new jobs raise an
 * "N new" pill. View, date and Fixter live in the URL; the job sheet opens
 * over this list, which stays mounted, so its scroll survives.
 */
export function JobsBoard() {
  const { user } = useAdmin();
  const router = useRouter();
  const pathname = usePathname() || "";
  const params = useSearchParams();
  const toast = useToast();
  const field = isFieldFixter(user);
  const today = todayYMD();

  // A field Fixter's jobs are My day (Q-10); the server scopes them either way.
  useEffect(() => {
    if (!field) return;
    const job = /^\/admin\/jobs\/([^/?#]+)/.exec(pathname);
    router.replace(job ? `/admin/my-day/${job[1]}` : "/admin/my-day");
  }, [field, router, pathname]);

  const { view, status } = readView(params);
  const date = isYMD(params.get("date")) ? (params.get("date") as string) : today;
  const legacyMine = params.get("scope") === "me";
  const tech = params.get("tech") || (legacyMine ? "me" : "");

  const canAssign = can(user, PERM.BOOKINGS_ASSIGN);
  const canCreate = canAssign && can(user, PERM.BOOKINGS_WRITE);
  const canCustomers = can(user, PERM.CUSTOMERS_MANAGE);
  const canMembers = can(user, PERM.MEMBERS_READ);

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      sp.delete("scope");
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `/admin/jobs?${qs}` : "/admin/jobs", { scroll: false });
    },
    [params, router]
  );

  /* ---- what the server is asked ---- */
  const listParams: ListParams = useMemo(() => {
    const t = tech || undefined;
    if (view === "action") return { view: "needs_action", limit: 200 };
    if (view === "all") return { view: "range", from: addDays(date, -14), to: addDays(date, ALL_SPAN - 15), tech: t, status: status || undefined, limit: 100 };
    if (view === "week") return date === today ? { view: "week", tech: t, limit: 200 } : { view: "range", from: date, to: addDays(date, 6), tech: t, limit: 200 };
    if (view === "tomorrow") return { view: "tomorrow", tech: t, limit: 200 };
    if (view === "day" && date !== today) return { view: "range", from: date, to: date, tech: t, limit: 200 };
    return { view: "today", tech: t, limit: 200 };
  }, [view, date, today, tech, status]);
  const listKey = jobKeys.list(listParams);
  rememberKey(listKey);
  const listQ = useAdminQuery(listKey, (signal) => fetchJobs(listParams, signal), { pollMs: 60_000, staleTime: 20_000, enabled: !field });
  const needsQ = useAdminQuery(jobKeys.needs, fetchNeedsAction, { pollMs: 60_000, staleTime: 20_000, enabled: !field && view === "action" });
  const assigneesQ = useAdminQuery(keys.assignees, fetchAssignees, { enabled: canAssign, staleTime: 5 * 60_000 });

  // Counts survive a view change (the last answer is kept until the next one arrives).
  const [counts, setCounts] = useState(listQ.data?.counts || null);
  const latestCounts = listQ.data?.counts || null;
  if (latestCounts && latestCounts !== counts) setCounts(latestCounts);

  /* ---- quiet list ---- */
  const quiet = useQuietList(JSON.stringify(listKey), listQ.data?.rows);
  const [more, setMore] = useState<{ key: string; rows: JobRow[]; cursor: string | null; busy: boolean }>({ key: "", rows: [], cursor: null, busy: false });
  const moreForKey = more.key === JSON.stringify(listKey) ? more : { key: "", rows: [], cursor: null, busy: false };
  const nextCursor = moreForKey.key ? moreForKey.cursor : listQ.data?.nextCursor || null;
  const rows = useMemo(() => {
    const seen = new Set(quiet.rows.map((r) => r.id));
    return [...quiet.rows, ...moreForKey.rows.filter((r) => !seen.has(r.id))];
  }, [quiet.rows, moreForKey.rows]);

  const loadMore = async () => {
    if (!nextCursor) return;
    const k = JSON.stringify(listKey);
    setMore((m) => ({ ...(m.key === k ? m : { key: k, rows: [], cursor: nextCursor }), busy: true }));
    try {
      const page = await fetchQuery(jobKeys.list({ ...listParams, cursor: nextCursor }), (signal) => fetchJobs({ ...listParams, cursor: nextCursor }, signal));
      setMore((m) => ({ key: k, rows: [...(m.key === k ? m.rows : []), ...page.rows], cursor: page.nextCursor, busy: false }));
    } catch (error) {
      setMore((m) => ({ ...m, busy: false }));
      toast.show(errorMessage(error, "More jobs could not be loaded."));
    }
  };

  /* ---- search (all dates) ---- */
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  useHandoffQuery("jobs", setQ);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const searchText = debounced.length >= 2 ? debounced : "";
  const searchKey = jobKeys.search(searchText);
  rememberKey(searchKey);
  const searchQ = useAdminQuery(searchKey, (signal) => searchJobs(searchText, signal), { enabled: Boolean(searchText) && !field, staleTime: 15_000 });
  const inSearch = q.trim().length > 0;

  /* ---- create ---- */
  const [creating, setCreating] = useState(false);
  const customersQ = useAdminQuery(canCustomers ? keys.customers : keys.members, canCustomers ? fetchCustomers : fetchMembers, {
    enabled: creating && (canCustomers || canMembers),
    staleTime: 5 * 60_000,
  });

  /* ---- menus ---- */
  const [menu, setMenu] = useState<null | "tech" | "more" | "more-phone">(null);
  const techRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const phoneMoreRef = useRef<HTMLButtonElement>(null);
  const assignees = assigneesQ.data || [];
  const techName = tech === "me" ? "Mine" : tech === "unassigned" ? "Unassigned" : assignees.find((a) => a.id === tech)?.name || (tech ? "One Fixter" : "");
  const techItems: MenuItem[] = [
    { label: "All Fixters", onSelect: () => setParams({ tech: null }) },
    { label: "Assigned to me", onSelect: () => setParams({ tech: "me" }) },
    { label: "Unassigned", onSelect: () => setParams({ tech: "unassigned" }) },
    ...assignees.map((a) => ({ label: a.name, hint: a.isDefaultFixter ? "Default Fixter" : undefined, onSelect: () => setParams({ tech: a.id }) })),
  ];

  const exportCsv = () => {
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobs-${view}-${listParams.from || date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.show(`Exported ${rows.length} ${rows.length === 1 ? "job" : "jobs"}`);
  };

  const refreshNow = () => (view === "action" ? Promise.all([listQ.refetch(), needsQ.refetch()]).then(quiet.apply) : listQ.refetch().then(quiet.apply));

  const qs = params.toString();
  const hrefFor = useCallback((row: JobRow) => `/admin/jobs/${encodeURIComponent(row.id)}${qs ? `?${qs}` : ""}`, [qs]);

  if (field) return <SkeletonRows count={3} label="Opening My day" />;

  /* ---- view bar ---- */
  const viewChip = (v: View, label: string, count?: number | null, attention = false, extra: Record<string, string | null> = {}) => {
    const selected = v === "today" ? (view === "today" || view === "day") && date === today : v === "tomorrow" ? view === "tomorrow" || (view === "day" && date === addDays(today, 1)) : view === v;
    return (
      <Chip
        onClick={() => setParams({ view: v === "action" ? null : v, date: null, status: v === "all" ? status || null : null, ...extra })}
        selected={selected}
        count={typeof count === "number" ? count : undefined}
        tone={attention && (count || 0) > 0 ? "attention" : "default"}
      >
        {label}
      </Chip>
    );
  };

  const dayViews = view === "today" || view === "tomorrow" || view === "day";
  const stripDate = view === "tomorrow" ? addDays(today, 1) : view === "today" ? today : date;
  const stripLabel = view === "week" ? `${dayLabel(stripDate)} – ${dayLabel(addDays(stripDate, 6))}` : dayLabelWithRelative(stripDate, today);
  const goDay = (ymd: string) => {
    if (view === "week") return setParams({ view: "week", date: ymd === today ? null : ymd });
    if (ymd === today) return setParams({ view: "today", date: null });
    if (ymd === addDays(today, 1)) return setParams({ view: "tomorrow", date: null });
    setParams({ view: "day", date: ymd });
  };

  const isLoading = listQ.isLoading || (view === "action" && needsQ.isLoading && !needsQ.data);
  const loadError = listQ.error && !listQ.data;

  /* ---- content ---- */
  let content: React.ReactNode;
  if (inSearch) {
    content = <SearchResults q={q} text={searchText} query={searchQ} hrefFor={hrefFor} />;
  } else if (isLoading) {
    content = <SkeletonRows count={6} label="Loading jobs" />;
  } else if (loadError) {
    content = <ErrorState title="Jobs could not be loaded" message={errorMessage(listQ.error)} onRetry={listQ.refetch} />;
  } else if (view === "action") {
    content = (
      <NeedsActionView
        needs={needsQ.data ?? null}
        jobRows={rows}
        jobsCount={counts?.needsAction ?? rows.length}
        hrefFor={hrefFor}
        todayCount={counts?.today ?? null}
        onToday={() => setParams({ view: "today", date: null })}
      />
    );
  } else if (dayViews) {
    const ymd = stripDate;
    content = rows.length ? (
      <DayGroup ymd={ymd} rows={rows} hrefFor={hrefFor} />
    ) : (
      <EmptyState message={`No jobs ${ymd === today ? "today" : ymd === addDays(today, 1) ? "tomorrow" : `on ${dayLabel(ymd)}`}`} detail={tech ? `Showing ${techName.toLowerCase() === "mine" ? "your jobs" : techName} only.` : undefined} action={canCreate ? <Button onClick={() => setCreating(true)}>New visit</Button> : undefined} />
    );
  } else {
    const groups = groupByDay(rows);
    content = (
      <div className="flex flex-col gap-4">
        {view === "all" && (
          <div className="flex items-center justify-between gap-2" data-all-window="">
            <Button variant="secondary" icon={<ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => setParams({ view: "all", date: addDays(date, -ALL_SPAN) })}>
              Earlier
            </Button>
            <p className="min-w-0 truncate text-center text-[14px] font-semibold text-adm-ink" aria-live="polite" data-window-label="">
              {dayLabel(listParams.from || date)} – {dayLabel(listParams.to || date)}
            </p>
            <Button variant="secondary" onClick={() => setParams({ view: "all", date: addDays(date, ALL_SPAN) })}>
              <span className="inline-flex items-center gap-2">
                Later
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            </Button>
          </div>
        )}
        {groups.length ? (
          groups.map((g) => <DayGroup key={g.ymd} ymd={g.ymd} rows={g.rows} hrefFor={hrefFor} />)
        ) : (
          <EmptyState message={view === "week" ? "No jobs this week" : "No jobs in these four weeks"} detail={view === "all" ? "Use Earlier or Later, or search all dates." : undefined} />
        )}
        {nextCursor && (
          <Button variant="secondary" block busy={moreForKey.busy} onClick={loadMore} data-load-more="">
            Show more jobs ({Math.max(0, (listQ.data?.total || 0) - rows.length)} more)
          </Button>
        )}
      </div>
    );
  }

  const pending = !inSearch && (quiet.added > 0 || quiet.removed > 0);

  return (
    <div data-section="jobs" data-view={view} className={cx("lg:max-w-[920px]", canCreate && "adm-fab-room")}>
      <PageHeader
        title="Jobs"
        actions={
          <div className="adm-desk-actions items-center gap-2">
            <IconButton label="Refresh" icon={<ArrowPathIcon />} onClick={refreshNow} data-refresh="" />
            <IconButton ref={moreRef} label="More list actions" icon={<EllipsisHorizontalIcon />} onClick={() => setMenu("more")} />
            {canCreate && (
              <Button icon={<PlusIcon className="h-5 w-5" aria-hidden="true" />} onClick={() => setCreating(true)} data-action="open-create-visit-jobs">
                New visit
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-1 flex items-center gap-1">
        <SearchField label="Search jobs on all dates" placeholder="Search all dates: name, phone, address, #" value={q} onChange={setQ} onSearchModeChange={setSearching} className="min-w-0 flex-1" data-jobs-search="" />
        {!searching && (
          <div className="adm-phone-only flex-none items-center">
            <IconButton label="Refresh" icon={<ArrowPathIcon />} onClick={refreshNow} />
            <IconButton ref={phoneMoreRef} label="More list actions" icon={<EllipsisHorizontalIcon />} onClick={() => setMenu("more-phone")} />
          </div>
        )}
      </div>

      {!searching && !inSearch && (
        <>
          <FilterBar label="Job views">
            {viewChip("action", "Needs action", counts?.needsAction, true)}
            {viewChip("today", "Today", counts?.today)}
            {viewChip("tomorrow", "Tomorrow", counts?.tomorrow)}
            {viewChip("week", "Week", counts?.week)}
            {viewChip("all", "All")}
            {canAssign && view !== "action" && (
              <button ref={techRef} type="button" className="adm-chip" aria-pressed={Boolean(tech)} onClick={() => setMenu("tech")} data-tech-filter="">
                <UserIcon className="h-4 w-4" aria-hidden="true" />
                <span>{tech ? techName : "All Fixters"}</span>
              </button>
            )}
          </FilterBar>
          {(dayViews || view === "week") && <DateStrip date={stripDate} step={view === "week" ? 7 : 1} label={stripLabel} onChange={goDay} onPickDay={goDay} />}
          {view === "all" && (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Status">
              {STATUS_FILTERS.map((s) => (
                <Chip key={s.value || "active"} onClick={() => setParams({ view: "all", status: s.value || null })} selected={status === s.value}>
                  {s.label}
                </Chip>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-2">
        {/* Zero height, inside the list's box: appearing never moves a row. */}
        {pending && (
          <div className="adm-new-pill" data-new-pill="">
            <button type="button" onClick={quiet.apply} aria-live="polite">
              {quiet.added > 0 ? `${quiet.added} new · Show` : "List changed · Show"}
            </button>
          </div>
        )}
        {content}
      </div>

      {canCreate && (
        <button type="button" className="adm-fab" aria-label="New visit" onClick={() => setCreating(true)} data-fab="">
          <PlusIcon aria-hidden="true" />
        </button>
      )}

      <Menu open={menu === "tech"} onClose={() => setMenu(null)} anchorRef={techRef} title="Show jobs for" items={techItems} />
      <Menu
        open={menu === "more" || menu === "more-phone"}
        onClose={() => setMenu(null)}
        anchorRef={menu === "more-phone" ? phoneMoreRef : moreRef}
        title="Jobs"
        items={[
          { label: `Export this list (CSV, ${rows.length})`, icon: <ArrowDownTrayIcon />, onSelect: exportCsv, disabled: !rows.length || inSearch },
          ...(canCreate ? [{ label: "New visit", icon: <PlusIcon />, onSelect: () => setCreating(true) }] : []),
        ]}
      />

      {/* The customer picker needs the list first (it chooses "existing" vs "guest" when it opens). */}
      {creating && (customersQ.data || customersQ.error || !(canCustomers || canMembers)) && (
        <CreateVisitSheet
          customers={customersQ.data || []}
          onClose={() => setCreating(false)}
          onCreated={(note) => {
            setCreating(false);
            toast.show(note);
            quiet.requestApply();
            refreshJobLists();
          }}
        />
      )}
    </div>
  );
}

function dayLabelWithRelative(ymd: string, today: string) {
  if (ymd === today) return `Today · ${dayLabel(ymd)}`;
  if (ymd === addDays(today, 1)) return `Tomorrow · ${dayLabel(ymd)}`;
  if (ymd === addDays(today, -1)) return `Yesterday · ${dayLabel(ymd)}`;
  return dayLabel(ymd, { year: ymd.slice(0, 4) !== today.slice(0, 4) });
}

function SearchResults({
  q,
  text,
  query,
  hrefFor,
}: {
  q: string;
  text: string;
  query: { data?: { total: number; limited: boolean; groups: { date: string; rows: JobRow[] }[] }; isLoading: boolean; isFetching: boolean; error: unknown; refetch: () => Promise<void> };
  hrefFor: (row: JobRow) => string;
}) {
  const scope = (
    <p className="mb-2 px-1 text-[13px] font-semibold text-adm-text-2" data-search-scope="">
      Searching all dates
      {query.data && text ? ` · ${query.data.total} ${query.data.total === 1 ? "job" : "jobs"}${query.data.limited ? " (the first 50; type more to narrow)" : ""}` : ""}
    </p>
  );
  if (q.trim().length < 2) return <>{scope}<EmptyState message="Type at least 2 characters" detail="Name, phone (any format), email, street, town or booking number." /></>;
  if (!text || (query.isLoading && !query.data)) return <>{scope}<SkeletonRows count={3} label="Searching" /></>;
  if (query.error && !query.data) return <>{scope}<ErrorState title="Search failed" message={errorMessage(query.error)} onRetry={query.refetch} /></>;
  const groups = query.data?.groups || [];
  if (!groups.length) return <>{scope}<EmptyState message={`No jobs match “${text}”`} detail="Search looks at every date, past and upcoming." /></>;
  return (
    <div className="flex flex-col gap-4" data-search-results="">
      {scope}
      {groups.map((g) => (
        <section key={g.date || "nodate"} className="flex flex-col" aria-label={g.date ? dayLabel(g.date, { year: true }) : "No date"} data-search-day={g.date}>
          <h2 className="adm-day-head adm-day-head--plain flex min-h-[40px] items-center px-1 text-[15px] font-semibold text-adm-ink">
            {g.date ? dayLabelWithRelative(g.date, todayYMD()) : "No date"}
            <span className="adm-num font-normal text-adm-text-2"> · {g.rows.length}</span>
          </h2>
          <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
            {g.rows.map((row) => (
              <JobRowItem key={row.id} row={row} href={hrefFor(row)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
