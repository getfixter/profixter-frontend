"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useCallback } from "react";
import { errorMessage, useAdminQuery } from "@/lib/admin/query";
import { fetchMyDay, jobKeys, rememberKey, todayYMD, type JobRow } from "@/lib/admin/jobs";
import { EmptyState, ErrorState, IconButton, PageHeader, SkeletonRows } from "@/app/components/admin/ui";
import { DayGroup } from "@/app/components/admin/jobs/JobRows";
import { useQuietList } from "@/app/components/admin/jobs/useQuietList";
import "@/app/components/admin/jobs/jobs.css";

/**
 * My day (Q-10): the signed-in person's own jobs today and tomorrow, from
 * GET /api/admin/my-day, which the server scopes to the caller whatever
 * their rights. No view switcher, no "All", no customers, no money: a tap
 * opens the same job sheet with only the actions the server allows them
 * (notes, photos, Mark done on their own Confirmed jobs).
 */
export function MyDayBoard() {
  rememberKey(jobKeys.myDay);
  const q = useAdminQuery(jobKeys.myDay, fetchMyDay, { pollMs: 60_000, staleTime: 20_000 });
  const today = useQuietList("today", q.data?.today.rows);
  const tomorrow = useQuietList("tomorrow", q.data?.tomorrow.rows);
  const hrefFor = useCallback((row: JobRow) => `/admin/my-day/${encodeURIComponent(row.id)}`, []);
  const added = today.added + tomorrow.added;
  const apply = () => {
    today.apply();
    tomorrow.apply();
  };

  return (
    <div data-section="my-day">
      <PageHeader title="My day" description="Your jobs today and tomorrow" actions={<IconButton label="Refresh" icon={<ArrowPathIcon />} onClick={() => q.refetch().then(apply)} />} />
      {q.isLoading ? (
        <SkeletonRows count={3} label="Loading your jobs" />
      ) : q.error && !q.data ? (
        <ErrorState title="Your jobs could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : (
        <div>
          {/* Zero height and outside the gap: appearing never moves a row. */}
          {added > 0 && (
            <div className="adm-new-pill" style={{ top: "calc(var(--adm-header-h) + var(--adm-safe-top) + 8px)" }} data-new-pill="">
              <button type="button" onClick={apply}>
                {added} new · Show
              </button>
            </div>
          )}
          <div className="flex flex-col gap-6">
          <Day ymd={q.data?.today.date || todayYMD()} rows={today.rows} hrefFor={hrefFor} empty="No jobs today" />
          <Day ymd={q.data?.tomorrow.date || ""} rows={tomorrow.rows} hrefFor={hrefFor} empty="No jobs tomorrow" />
          </div>
        </div>
      )}
    </div>
  );
}

function Day({ ymd, rows, hrefFor, empty }: { ymd: string; rows: JobRow[]; hrefFor: (row: JobRow) => string; empty: string }) {
  return (
    <DayGroup ymd={ymd} rows={rows} hrefFor={hrefFor} plainHead>
      {!rows.length && <EmptyState message={empty} />}
    </DayGroup>
  );
}
