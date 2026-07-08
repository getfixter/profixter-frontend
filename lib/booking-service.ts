import API from "./api";

export interface CalendarConfig {
  timezone: string;
  slotMinutes: number;
  minLeadDays: number;
  closedWeekdays: number[];

  // Support both names
  handymanCapacity?: number;
  maxConcurrent?: number;

  defaultHours: string[];
  overrides: Record<string, string[]>;
  holidays: string[];
  engine?: "legacy" | "reservation";
  visitDurationMinutes?: number;
  maxAdvanceDays?: number;
}

export interface TimeSlot {
  date: string;
  slots: string[];
  taken: Record<string, number>;
  capacityPerSlot: number;
  remaining?: Record<string, number>;
  engine?: "legacy" | "reservation";
}

export interface MonthAvailability {
  month: string;
  engine: "reservation";
  visitDurationMinutes: number;
  days: Array<{
    date: string;
    open: boolean;
    slotCount: number;
    slots: string[];
    taken: Record<string, number>;
    remaining: Record<string, number>;
    capacityPerSlot: number;
  }>;
}

export interface BookingData {
  service: string;
  date: string;
  note: string;
  addressId: string;
  images: File[];
  requestedDate?: string;
  requestedTime?: string;
}

export interface OneTimeCheckoutData {
  addressId: string;
  selectedTask: string;
  date: string;
  note: string;
  images: File[];
  requestedDate?: string;
  requestedTime?: string;
}

export interface OneTimeCheckoutResponse {
  url: string;
  bookingId: string;
  entitlementId?: string;
  holdExpiresAt: string;
}

export interface OneTimeVisitConfig {
  enabled: boolean;
  priceCents: number;
  currency: string;
  durationMinutes: number;
  holdMinutes: number;
  cancellationPhone: string;
  allowedServices: string[];
  excludedServices: string[];
  promoNote?: string;
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

export interface BookingDetailUpdateData {
  note?: string;
  images: File[];
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

  // Active bookings for the Pick Day page
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

interface SubscriptionRecord {
  addressId?: string;
  subscriptionType?: string;
  plan?: string;
  status?: string;
  currentPeriodEnd?: string;
  nextPaymentDate?: string;
  expiresAt?: string;
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
export const getMonthAvailability = async (
  month: string
): Promise<MonthAvailability> => {
  const response = await API.get<MonthAvailability>("/api/calendar/month", {
    params: { month },
  });
  return response.data;
};

export const getOneTimeVisitConfig = async (): Promise<OneTimeVisitConfig> => {
  const response = await API.get<OneTimeVisitConfig>("/api/bookings/one-time/config");
  return response.data;
};

export const getNextBooking = async (addressId: string): Promise<NextBookingResponse> => {
  const response = await API.get<NextBookingResponse>("/api/bookings/next", {
    params: { addressId },
  });
  return response.data;
};

export const getMySubscriptions = async (): Promise<{ subscriptions: SubscriptionRecord[] }> => {
  const response = await API.get<{ subscriptions: SubscriptionRecord[] }>("/api/subscriptions/my");
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

    const activeSubs = allSubs.filter((s) =>
      ["active", "trialing"].includes(String(s.status || "").toLowerCase())
    );

    if (!activeSubs.length) {
      return {
        hasSubscription: false,
        message: "You don't have an active subscription at the moment. Please purchase a plan to book a visit.",
      };
    }

    let matched: SubscriptionRecord | undefined;

    if (addressId) {
      matched = activeSubs.find((s) => String(s.addressId) === String(addressId));
    }

    // No fallback - subscription must belong to this address
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
        plan: matched.subscriptionType || matched.plan || "",
        status: matched.status || "",
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
  if (data.requestedDate) formData.append("requestedDate", data.requestedDate);
  if (data.requestedTime) formData.append("requestedTime", data.requestedTime);

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
    const error = new Error(err.message || "Failed to create booking") as Error & {
      code?: string;
      suggestions?: Array<{ date: string; time: string; start: string }>;
    };
    error.code = err.code;
    error.suggestions = err.suggestions;
    throw error;
  }

  return response.json();
};

export const createOneTimeVisitCheckout = async (
  data: OneTimeCheckoutData
): Promise<OneTimeCheckoutResponse> => {
  const formData = new FormData();
  formData.append("addressId", data.addressId);
  formData.append("selectedTask", data.selectedTask);
  formData.append("date", data.date);
  formData.append("note", data.note);
  if (data.requestedDate) formData.append("requestedDate", data.requestedDate);
  if (data.requestedTime) formData.append("requestedTime", data.requestedTime);
  data.images.forEach((img) => formData.append("images", img));

  const token = localStorage.getItem("token") || "";
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/bookings/one-time/checkout`,
    {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error = new Error(err.message || "Failed to start one-time checkout") as Error & {
      code?: string;
      redirectTo?: string;
    };
    error.code = err.code;
    error.redirectTo = err.redirectTo;
    throw error;
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

export const addBookingDetails = async (
  bookingId: string,
  data: BookingDetailUpdateData
): Promise<Booking> => {
  const formData = new FormData();
  if (data.note) formData.append("note", data.note);
  data.images.forEach((img) => formData.append("images", img));

  const token = localStorage.getItem("token") || "";
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/bookings/${bookingId}/add-details`,
    {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update appointment details");
  }

  const result = await response.json();
  return result.booking;
};

export const getAllBookings = async (): Promise<Booking[]> => {
  const response = await API.get("/api/bookings");
  const data = response.data;
  return Array.isArray(data) ? data : data.bookings || [];
};

