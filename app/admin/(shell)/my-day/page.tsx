"use client";

import { toYMDNY } from "@/lib/utils/timezone-helpers";
import { fetchBookings, keys } from "@/lib/admin/fetchers";
import { errorMessage, useAdminQuery } from "@/lib/admin/query";
import { addDaysYMD, todayNY } from "@/lib/admin/search";
import { ErrorState, PageHeader, Section, SkeletonRows } from "@/app/components/admin/ui";
import { DayJobs } from "@/app/components/admin/sections/DayJobs";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/*
 * My day (owner decision Q-10): the signed-in person's own jobs, today and
 * tomorrow. The list asks the server for "assigned to me"; for a field Fixter
 * the server enforces that scope on every booking route (Q-1, track BE-BOOK).
 */
export default function Page() {
  const q = useAdminQuery(keys.bookings("me"), (signal) => fetchBookings("me", signal), { pollMs: 120_000 });
  const today = todayNY();
  const tomorrow = addDaysYMD(today, 1);
  const live = (q.data || []).filter((b) => !["canceled", "cancelled"].includes(String(b.status || "").toLowerCase()));
  const on = (ymd: string) => live.filter((b) => toYMDNY(new Date(b.date)) === ymd);
  return (
    <RequireSection id="my-day">
      <PageHeader title="My day" description="Your jobs today and tomorrow" />
      {q.isLoading ? (
        <SkeletonRows count={3} label="Loading your jobs" />
      ) : q.error && !q.data ? (
        <ErrorState title="Your jobs could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : (
        <div className="flex flex-col gap-6">
          <Section title="Today" count={on(today).length} flush>
            <DayJobs bookings={on(today)} emptyMessage="No jobs today" />
          </Section>
          <Section title="Tomorrow" count={on(tomorrow).length} flush>
            <DayJobs bookings={on(tomorrow)} emptyMessage="No jobs tomorrow" />
          </Section>
        </div>
      )}
    </RequireSection>
  );
}
