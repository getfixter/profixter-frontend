"use client";

import { useMemo, useState } from "react";
import BookingsTable from "@/app/components/admin/BookingsTable";
import FreeVisitReviewPanel from "@/app/components/admin/FreeVisitReviewPanel";
import type { Booking } from "@/lib/admin-service";
import { can, PERM } from "@/lib/admin-access";
import { fetchAssignees, keys } from "@/lib/admin/fetchers";
import { invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { useBookingActions } from "./useBookingActions";

/** The existing job cards for a set of bookings, with every action they have today. */
export function DayJobs({ bookings, emptyMessage }: { bookings: Booking[]; emptyMessage: string }) {
  const { user } = useAdmin();
  const canAssign = can(user, PERM.BOOKINGS_ASSIGN);
  const assigneesQ = useAdminQuery(keys.assignees, fetchAssignees, { enabled: canAssign, staleTime: 5 * 60_000 });
  const { updateStatus, updateBooking, notify } = useBookingActions();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const sorted = useMemo(() => [...bookings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [bookings]);
  return (
    <>
      <BookingsTable
        bookings={sorted}
        updateStatus={updateStatus}
        onReviewFreeVisit={setReviewId}
        onToast={notify}
        users={[]}
        onUpdateBooking={updateBooking}
        assignees={assigneesQ.data || []}
        canAssign={canAssign}
        emptyMessage={emptyMessage}
      />
      {reviewId && (
        <FreeVisitReviewPanel
          bookingId={reviewId}
          onClose={() => {
            setReviewId(null);
            invalidateQueries("bookings");
          }}
          onChanged={(message) => notify(message)}
        />
      )}
    </>
  );
}
