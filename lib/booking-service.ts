import API from "./api";

export interface CalendarConfig {
  timezone: string;
  slotMinutes: number;
  minLeadDays: number;
  closedWeekdays: number[];

  // ✅ support both names
  handymanCapacity?: number;
  maxConcurrent?: number;

  defaultHours: string[];
  overrides: Record<string, string[]>;
  holidays: string[];
}

export interface TimeSlot {
  date: string;
  slots: string[];
  taken: Record<string, number>;
  capacityPerSlot: number;
}

export interface BookingData {
  service: string;
  date: string;
  note: string;
  addressId: string;
  images: File[];
}

export interface Booking {
  _id: string;
  bookingNumber: string;
  date: string;
  service: string;
  status: string;
  user: string;
  addressId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  note: string;
  images: string[];
}

export interface BookingResponse {
  message: string;
  booking: {
    bookingNumber: string;
    service: string;
    date: string;
    time: string;
  };
}

export interface NextBookingResponse {
  plan?: string;
  hasSubscription?: boolean;
  freeFirstVisitAvailable?: boolean;
  bookingLimit?: number;
  activeCount?: number;
  hasAnyBookings?: boolean;

  // ✅ ADD THIS (important for your Pick Day page)
  activeBookings?: Array<{
    _id: string;
    date: string;
    status: string;
    service?: string;
    bookingNumber?: string;
    addressId?: string;
    time?: string;
  }>;

  future?: {
    _id: string;
    date: string;
    status: string;
    service?: string;
    bookingNumber?: string;
    addressId?: string;
  } | null;
}


export interface SubscriptionResponse {
  hasSubscription: boolean;
  subscription?: {
    plan: string;
    status: string;
    expiresAt: string;
  };
  message?: string;
}

export const getCalendarConfig = async (): Promise<CalendarConfig> => {
  const response = await API.get<CalendarConfig>("/api/calendar/config");
  return response.data;
};

export const getTimeSlots = async (date: string): Promise<TimeSlot> => {
  const response = await API.get<TimeSlot>("/api/calendar/slots", {
    params: { date },
  });
  return response.data;
};

export const getNextBooking = async (addressId: string): Promise<NextBookingResponse> => {
  const response = await API.get<NextBookingResponse>("/api/bookings/next", {
    params: { addressId },
  });
  return response.data;
};

export const getMySubscriptions = async (): Promise<{ subscriptions: any[] }> => {
  const response = await API.get<{ subscriptions: any[] }>("/api/subscriptions/my");
  return response.data;
};

/**
 * NOTE:
 * This function ONLY checks subscription records.
 * It does NOT know about your "free visit if never booked" rule.
 * Use getNextBooking() for UI state (free/sub/none).
 */
export const checkSubscription = async (
  addressId?: string | null
): Promise<SubscriptionResponse> => {
  try {
    const data = await getMySubscriptions();
    const allSubs = data.subscriptions || [];

    if (!allSubs.length) {
      return { hasSubscription: false, message: "You don't have any active subscriptions yet." };
    }

    const activeSubs = allSubs.filter((s: any) =>
      ["active", "trialing"].includes(String(s.status || "").toLowerCase())
    );

    if (!activeSubs.length) {
      return {
        hasSubscription: false,
        message: "You don't have an active subscription at the moment. Please purchase a plan to book a visit.",
      };
    }

    let matched: any | undefined;

    if (addressId) {
      matched = activeSubs.find((s: any) => String(s.addressId) === String(addressId));
    }

    // ❌ NO FALLBACK — subscription MUST belong to this address
    if (!matched) {
      return {
        hasSubscription: false,
        message:
          "This address does not have an active subscription. Purchase a subscription for this address to book a visit.",
      };
    }

    return {
      hasSubscription: true,
      subscription: {
        plan: matched.subscriptionType || matched.plan,
        status: matched.status,
        expiresAt: matched.currentPeriodEnd || matched.nextPaymentDate || matched.expiresAt || "",
      },
    };
  } catch (err) {
    console.error("Failed to check subscription:", err);
    return { hasSubscription: false, message: "Unable to verify subscription status." };
  }
};

export const createBooking = async (data: BookingData): Promise<BookingResponse> => {
  const formData = new FormData();
  formData.append("service", data.service);
  formData.append("date", data.date);
  formData.append("note", data.note);
  formData.append("addressId", data.addressId);

  data.images.forEach((img) => formData.append("images", img));

  const token = localStorage.getItem("token") || "";

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/bookings`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create booking");
  }

  return response.json();
};

export const cancelBooking = async (
  bookingId: string
): Promise<{ ok: boolean; action: string; message: string }> => {
  const response = await API.delete<{ ok: boolean; action: string; message: string }>(
    `/api/bookings/cancel/${bookingId}`
  );
  return response.data;
};

export const getAllBookings = async (): Promise<Booking[]> => {
  const response = await API.get("/api/bookings");
  const data = response.data;
  return Array.isArray(data) ? data : data.bookings || [];
};
