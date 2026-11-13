"use client";

import { useState } from "react";
import BookingsCalendar from "@/app/components/admin/BookingsCalendar";
import { can, PERM } from "@/lib/admin-access";
import { toYMDNY } from "@/lib/utils/timezone-helpers";
import { fetchBookings, keys } from "@/lib/admin/fetchers";
import { errorMessage, useAdminQuery } from "@/lib/admin/query";
import { canOpenAvailability } from "@/lib/admin/sections";
import { todayNY } from "@/lib/admin/search";
import { ButtonLink, ErrorState, PageHeader, Section, SkeletonRows, Tabs } from "@/app/components/admin/ui";
import { DayJobs } from "@/app/components/admin/sections/DayJobs";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/*
 * Schedule: the month calendar of jobs and the chosen day's jobs (the
 * calendar that sat above the Jobs list), with Availability one tab away.
 * The per-technician timeline (K.3) is the Schedule track's work.
 */
export default function Page() {
  const { user } = useAdmin();
  const canBookings = can(user, PERM.BOOKINGS_READ);
  const [date, setDate] = useState(todayNY());
  const bookingsQ = useAdminQuery(keys.bookings("all"), (signal) => fetchBookings("all", signal), { enabled: canBookings });
  const day = (bookingsQ.data || []).filter((b) => toYMDNY(new Date(b.date)) === date);
  const tabs = [
    { id: "calendar", label: "Calendar", href: "/admin/schedule" },
    ...(canOpenAvailability(user) ? [{ id: "availability", label: "Availability", href: "/admin/schedule/availability" }] : []),
  ];

  return (
    <RequireSection id="schedule">
      <PageHeader title="Schedule" description="Jobs by day, and when the team is available" />
      <Tabs label="Schedule" value="calendar" items={tabs} className="mb-4" />
      {!canBookings ? (
        <ButtonLink href="/admin/schedule/availability">Open availability</ButtonLink>
      ) : bookingsQ.isLoading ? (
        <SkeletonRows count={4} label="Loading the schedule" />
      ) : bookingsQ.error && !bookingsQ.data ? (
        <ErrorState title="The schedule could not be loaded" message={errorMessage(bookingsQ.error)} onRetry={bookingsQ.refetch} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <BookingsCalendar bookings={bookingsQ.data || []} selectedDate={date} onChange={(d) => d && setDate(d)} />
          </div>
          <Section title={date === todayNY() ? "Today" : date} count={day.length} flush>
            <DayJobs bookings={day} emptyMessage="No jobs on this day" />
          </Section>
        </div>
      )}
    </RequireSection>
  );
}
