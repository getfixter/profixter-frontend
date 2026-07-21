"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookingConfirmationDialog, {
  type BookingConfirmation,
} from "@/app/components/booking/BookingConfirmationDialog";
import { getAllBookings } from "@/lib/booking-service";

function formatBookingDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OneTimeBookingConfirmation({ bookingId }: { bookingId?: string }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(() =>
    bookingId ? { bookingReference: bookingId, status: "pending" } : null
  );

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    void getAllBookings()
      .then((bookings) => {
        if (!active) return;
        const booking = bookings.find(
          (item) => item._id === bookingId || item.bookingNumber === bookingId
        );
        if (!booking) return;
        setConfirmation({
          bookingReference: booking.bookingNumber || bookingId,
          dateLabel: formatBookingDate(booking.date),
          address: [booking.address, booking.city, booking.state, booking.zip]
            .filter(Boolean)
            .join(", "),
          status: booking.status,
        });
      })
      .catch(() => {
        // The successful return page remains visible if details cannot be refreshed.
      });
    return () => {
      active = false;
    };
  }, [bookingId]);

  const close = useCallback(() => setConfirmation(null), []);

  return (
    <BookingConfirmationDialog
      confirmation={confirmation}
      onClose={close}
      onViewVisit={() => {
        setConfirmation(null);
        router.push("/account?tab=bookings");
      }}
    />
  );
}
