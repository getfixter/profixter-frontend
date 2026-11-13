"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import BookingsTable from "@/app/components/admin/BookingsTable";
import FreeVisitReviewPanel from "@/app/components/admin/FreeVisitReviewPanel";
import { can, PERM } from "@/lib/admin-access";
import { fetchAssignees, fetchBookings, keys } from "@/lib/admin/fetchers";
import { errorMessage, invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import { isFieldFixter } from "@/lib/admin/sections";
import { EmptyState, ErrorState, Sheet, SkeletonRows } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { useBookingActions } from "./useBookingActions";

/**
 * /admin/jobs/[id]: one job in a sheet over the Jobs list, which stays
 * mounted (and scrolled) underneath. The job card is the existing one,
 * opened, with every action it has today; the Jobs track replaces the
 * content with the F.2 detail. Closing returns to the list with its filters.
 */
export function JobDetailSheet({ id, backHref = "/admin/jobs" }: { id: string; backHref?: string }) {
  const { user } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const scope = isFieldFixter(user) ? "me" : "all";
  const canAssign = can(user, PERM.BOOKINGS_ASSIGN);
  const bookingsQ = useAdminQuery(keys.bookings(scope), (signal) => fetchBookings(scope, signal));
  const assigneesQ = useAdminQuery(keys.assignees, fetchAssignees, { enabled: canAssign, staleTime: 5 * 60_000 });
  const { updateStatus, updateBooking, notify } = useBookingActions();
  const [reviewId, setReviewId] = useState<string | null>(null);

  const booking = useMemo(() => (bookingsQ.data || []).find((b) => b._id === id || String(b.bookingNumber || "").replace(/^#/, "") === id), [bookingsQ.data, id]);

  const close = () => {
    const qs = params.toString();
    router.replace(qs ? `${backHref}?${qs}` : backHref, { scroll: false });
  };

  return (
    <>
      <Sheet open={!reviewId} onClose={close} title={booking ? booking.name || `Job ${booking.bookingNumber || ""}` : "Job"} size="full" width="wide" data-sheet="job">
        {bookingsQ.isLoading ? (
          <SkeletonRows count={2} label="Loading the job" />
        ) : bookingsQ.error && !bookingsQ.data ? (
          <ErrorState title="The job could not be loaded" message={errorMessage(bookingsQ.error)} onRetry={bookingsQ.refetch} />
        ) : !booking ? (
          <EmptyState
            message="This job is not in your list"
            detail={scope === "me" ? "It may be assigned to someone else, or it was removed." : "It may have been removed, or the link is out of date."}
          />
        ) : (
          <BookingsTable
            bookings={[booking]}
            updateStatus={updateStatus}
            onReviewFreeVisit={setReviewId}
            onToast={notify}
            users={[]}
            onUpdateBooking={updateBooking}
            assignees={assigneesQ.data || []}
            canAssign={canAssign}
            defaultExpandedIds={[booking._id]}
          />
        )}
      </Sheet>
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
