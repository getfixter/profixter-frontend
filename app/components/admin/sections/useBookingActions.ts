"use client";

import { useCallback } from "react";
import { updateBookingAdmin, updateBookingStatus, type Booking, type BookingAdminPatch } from "@/lib/admin-service";
import { getQueryData, invalidateQueries, setQueryData } from "@/lib/admin/query";
import { keys, type BookingScope } from "@/lib/admin/fetchers";
import { useToast } from "@/app/components/admin/ui";

const SCOPES: BookingScope[] = ["all", "me"];

/** Apply a change to the booking in every cached list that holds it. */
function patchCached(bookingId: string, patch: (b: Booking) => Booking) {
  for (const scope of SCOPES) {
    if (!getQueryData<Booking[]>(keys.bookings(scope))) continue;
    setQueryData<Booking[]>(keys.bookings(scope), (list = []) => list.map((b) => (b._id === bookingId ? patch(b) : b)));
  }
}

/**
 * The booking handlers the old page passed to BookingsTable, now writing
 * into the query cache: a status change updates one booking in place
 * (optimistic, rolled back on failure, reconciled with the server's copy);
 * a field save re-reads the lists. Same endpoints and payloads as before, so
 * every reservation, reminder, message and activity-log side effect is
 * unchanged.
 */
export function useBookingActions() {
  const toast = useToast();

  const updateStatus = useCallback(
    async (bookingId: string, status: string, assignedFixterId?: string | null) => {
      const previous = SCOPES.map((scope) => getQueryData<Booking[]>(keys.bookings(scope))?.find((b) => b._id === bookingId)).find(Boolean);
      patchCached(bookingId, (b) => ({ ...b, status }));
      try {
        const updated = await updateBookingStatus(bookingId, status, assignedFixterId);
        patchCached(bookingId, (b) => ({ ...b, ...updated }));
      } catch (error) {
        if (previous) patchCached(bookingId, () => previous);
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to update booking status";
        toast.show(message);
      }
    },
    [toast]
  );

  const updateBooking = useCallback(
    async (bookingId: string, patch: BookingAdminPatch) => {
      try {
        await updateBookingAdmin(bookingId, patch);
        invalidateQueries("bookings");
        toast.show("Booking saved");
      } catch (error) {
        const e = error as { response?: { data?: { message?: string } }; message?: string };
        toast.show(e?.response?.data?.message || e?.message || "Failed to save booking changes");
        throw error;
      }
    },
    [toast]
  );

  return { updateStatus, updateBooking, notify: toast.show };
}
