"use client";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  getCalendarConfig,
  getTimeSlots,
  getMonthAvailability,
  createBooking,
  getNextBooking,
  CalendarConfig,
} from "@/lib/booking-service";
import { compressImage } from "@/lib/compressImage";
import { getRoleLandingPath } from "@/lib/auth-routing";
import {
  buildAvailabilityCacheKey,
  CACHE_TTL_MS,
  CalendarMode,
  DayAvailability,
  MonthAvailabilityMap,
  MonthLoadState,
  dateFromYMDLocal,
  firstBookableDateInMonth,
  formatDateYMDLocal,
  getBookableSlots,
  getMonthKeyLocal,
  isBookableDay,
  monthStartLocal,
  addMonthsLocal,
  normalizeDayAvailability,
  resolveInitialCalendarSelection,
} from "@/lib/booking-calendar-availability";
import { useRouter } from "next/navigation";
import { POPULAR_TASKS } from "./PopularTasksSection";

const SERVICES = [
  { key: "labor_only", label: "Labor Only", minRank: 1 }, // Basic+
  { key: "labor_materials", label: "Labor with Materials Needed", minRank: 2 }, // Plus+
  { key: "get_2_pros", label: "Get 2 Pros", minRank: 3 }, // Premium+
  { key: "general_contractor", label: "General Contractor", minRank: 4 }, // Elite
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

type BookingAddress = {
  _id: string;
  label?: string;
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type BookingAccessItem = {
  _id?: string;
  date?: string;
  status?: string;
  service?: string;
  bookingNumber?: string;
  addressId?: string;
  time?: string;
};

type BookingUser = {
  _id?: string;
  id?: string;
  userId?: string;
  email?: string;
  addresses?: BookingAddress[];
  defaultAddressId?: string;
};
const QUICK_BOOKING_DESCRIPTIONS: Record<string, string> = {
  "TV Mounting": "TV mounting help",
  "Light Fixtures": "Light fixture replacement",
  "Faucets & Minor Leaks": "Minor faucet leak",
  "Doors & Locks": "Door or lock repair",
  "Drywall Patches": "Drywall patch repair",
  "Caulking & Sealing": "Caulking and sealing",
  "Furniture Assembly": "Furniture assembly help",
  "Shelves & Wall Hardware": "Shelf installation help",
  "Paint Touch-Ups": "Paint touch up",
  "Home Maintenance Punch Lists": "Home maintenance tasks",
};

// Fallback 9-17 every 30 min
const FALLBACK_HOURS: string[] = (() => {
  const list: string[] = [];
  for (let h = 9; h < 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      list.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return list;
})();

function formatDateYMD(date: Date): string {
  return formatDateYMDLocal(date);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatTime12(t: string): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;

  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: string };
  return err.name === "CanceledError" || err.name === "AbortError" || err.code === "ERR_CANCELED";
}

function TimeSlotGrid({
  slotOptions,
  selectedTime,
  onSelect,
}: {
  slotOptions: Array<{ time: string; available: boolean; remaining: number | null }>;
  selectedTime: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 xl:grid-cols-5">
      {slotOptions.map((slot) => {
        const isSelected = slot.time === selectedTime;
        const availabilityLabel = slot.available
          ? slot.remaining && slot.remaining > 0
            ? `${slot.remaining} left`
            : "Available"
          : "Unavailable";
        return (
          <button
            key={slot.time}
            type="button"
            data-booking-time={slot.time}
            data-booking-time-available={slot.available ? "true" : "false"}
            disabled={!slot.available}
            onClick={() => {
              if (!slot.available) return;
              onSelect(slot.time);
            }}
            className={[
              "group relative min-h-11 overflow-hidden rounded-[10px] border px-1.5 py-1.5 text-center transition-all duration-150 ease-out active:scale-[0.99] sm:min-h-11 sm:px-2.5",
              isSelected
                ? "border-[#306EEC] bg-[#EEF5FF] text-[#0B1628] shadow-[0_8px_24px_rgba(48,110,236,0.12)] ring-2 ring-[#306EEC]/20"
                : slot.available
                  ? "border-[#D7DEE9] bg-white text-[#0B1628] hover:border-[#306EEC] hover:bg-[#F8FAFF]"
                  : "border-[#E2E8F0] bg-[#F1F5F9] text-[#94A3B8]",
              !slot.available ? "cursor-not-allowed" : "",
              isSelected ? "cursor-default" : "",
            ].join(" ")}
          >
            {slot.available && (
              <div
                className={[
                  "pointer-events-none absolute inset-x-0 top-0 h-[44%] transition-opacity duration-200",
                  isSelected ? "bg-[#306EEC]/5 opacity-100" : "bg-[#306EEC]/0 opacity-0 group-hover:opacity-100",
                ].join(" ")}
              />
            )}

            <div className="relative z-[1] flex items-center justify-center gap-1">
              <div
                  className={`text-[13px] font-bold leading-tight tracking-[-0.01em] sm:text-[14px] ${
                  slot.available ? "" : "line-through"
                } ${isSelected ? "text-[#0B1628]" : ""}`}
              >
                {formatTime12(slot.time)}
              </div>
              {isSelected && (
                <div className="inline-flex items-center text-[#306EEC]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="flex-shrink-0">
                    <path
                      d="M2.5 6.2L4.8 8.5L9.5 3.7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
            <span className="sr-only">{availabilityLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Booking Section ----------
export default function BookingSection() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const bookingUser = user as BookingUser | null;
  const addresses = bookingUser?.addresses || [];
  const defaultAddressId = bookingUser?.defaultAddressId;
  const roleLandingPath = getRoleLandingPath(user);
  const manageBookingsPath = roleLandingPath === "/account" ? "/account?tab=bookings" : roleLandingPath;

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Calendar config + month
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [displayedTimes, setDisplayedTimes] = useState<string[]>([]);
  const [dayAvailabilityMap, setDayAvailabilityMap] = useState<Record<string, DayAvailability>>({});
  const [loadingMonthKey, setLoadingMonthKey] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("initializing");
  const [monthLoadStateMap, setMonthLoadStateMap] = useState<Record<string, MonthLoadState>>({});
  const [availabilityRetryToken, setAvailabilityRetryToken] = useState(0);
  const [availabilityError, setAvailabilityError] = useState("");
  const [loadingSelectedDate, setLoadingSelectedDate] = useState(false);
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookingLoading, setQuickBookingLoading] = useState(false);


  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const dayRequestCacheRef = useRef<Record<string, Promise<DayAvailability | null>>>({});
  const monthRequestCacheRef = useRef<Record<string, Promise<MonthLoadState>>>({});
  const monthAvailabilityCacheRef = useRef<Record<string, {
    month: string;
    loadedAt: number;
    data: MonthAvailabilityMap;
  }>>({});
  const initializationGenerationRef = useRef(0);
  const initializationAbortRef = useRef<AbortController | null>(null);
  const monthNavigationAbortRef = useRef<AbortController | null>(null);
  const dayAvailabilityMapRef = useRef(dayAvailabilityMap);
  const currentMonthRef = useRef(currentMonth);
  const selectedDateRef = useRef(selectedDate);
  dayAvailabilityMapRef.current = dayAvailabilityMap;
  currentMonthRef.current = currentMonth;
  selectedDateRef.current = selectedDate;

  const [service, setService] = useState<ServiceKey | "">("");
  const [note, setNote] = useState<string>("");
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Modal display data
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(null);
  const [confirmedTime, setConfirmedTime] = useState("");
  const [confirmedAddress, setConfirmedAddress] = useState("");

  useEffect(() => {
    if (!showModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showModal]);

  // Existing booking + limits
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [activeBookingCount, setActiveBookingCount] = useState<number>(0);
  const [activeBookingLimit, setActiveBookingLimit] = useState<number>(1);
  const [existingBookingDate, setExistingBookingDate] = useState<Date | null>(null);
  const [existingBookingService, setExistingBookingService] = useState("");
  const [existingBookingTime, setExistingBookingTime] = useState("");
  const [existingBookingId, setExistingBookingId] = useState<string | null>(null);
  const [activeBookings, setActiveBookings] = useState<BookingAccessItem[]>([]);

  // Subscription / access (per address)
  const [hasSubscription, setHasSubscription] = useState(false);
  const [, setFreeFirstVisitAvailable] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(false);

  // Plan used to lock services (basic | plus | premium | elite | free)
  const [plan, setPlan] = useState<string>("");

  /* Membership visits submit the API's existing labor-only service value automatically. */
  const memberService: ServiceKey = "labor_only";
  const availabilityUserId =
    bookingUser?._id || bookingUser?.id || bookingUser?.userId || bookingUser?.email || "";
  const selectedAvailabilityAddressId = selectedAddressId || defaultAddressId || "";
  const getAvailabilityCacheKey = useCallback((yearMonth: string) =>
    buildAvailabilityCacheKey({
      yearMonth,
      addressId: selectedAvailabilityAddressId,
      serviceType: "member-booking",
      membershipId: plan || (hasSubscription ? "active-membership" : "no-membership"),
      userId: availabilityUserId,
      timezone: config?.timezone || "America/New_York",
    }), [
      availabilityUserId,
      config?.timezone,
      hasSubscription,
      plan,
      selectedAvailabilityAddressId,
    ]);
  const availabilityContextKey = getAvailabilityCacheKey("context");

  // ✅ pick default address
  useEffect(() => {
    if (defaultAddressId) {
      setSelectedAddressId((prev) => prev ?? String(defaultAddressId));
    }
  }, [defaultAddressId]);

  // ✅ reset when address changes
  useEffect(() => {
    setSelectedDate(null);
    setSelectedTime("");
    setDisplayedTimes([]);
    setDayAvailabilityMap({});
    dayAvailabilityMapRef.current = {};
    dayRequestCacheRef.current = {};
    monthRequestCacheRef.current = {};
    monthAvailabilityCacheRef.current = {};
    setMonthLoadStateMap({});
    setLoadingMonthKey(null);
    setCalendarMode("initializing");
    setAvailabilityError("");
    setService(memberService);
    setShowAddressPicker(false);
    setError("");
    setNotice("");
    setUploadedPhotos([]);
    setPhotoUrls([]);
    setNote("");
  }, [selectedAddressId]);

  const getHoursForDate = useCallback((date: Date) => {
    if (!config) return [];
    const ymd = formatDateYMD(date);
    if (config.engine === "reservation" && dayAvailabilityMap[ymd]) {
      return getBookableSlots(dayAvailabilityMap[ymd]).map((slot) => slot.time);
    }
    const overrideHours = config.overrides[ymd];
    return overrideHours?.length ? overrideHours : config.defaultHours;
  }, [config, dayAvailabilityMap]);

  const getMonthKey = useCallback((date: Date) => getMonthKeyLocal(date), []);

  const isAvailabilityOpen = useCallback((info?: DayAvailability | null) => {
    return isBookableDay(info);
  }, []);

  const isDayDisabled = useCallback((date: Date): boolean => {
    if (!config || calendarMode === "initializing") return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const ymd = formatDateYMD(d);
    const info = dayAvailabilityMap[ymd];

    if (d < today) return true;

    return !isAvailabilityOpen(info);
  }, [calendarMode, config, dayAvailabilityMap, isAvailabilityOpen]);

  const isDateSelectable = useCallback((date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return !isDayDisabled(normalized);
  }, [isDayDisabled]);

  const getClosestAvailableDate = useCallback(() => {
    const entries = Object.entries(dayAvailabilityMap)
      .filter(([, info]) => isAvailabilityOpen(info))
      .map(([ymd]) => {
        return dateFromYMDLocal(ymd);
      })
      .filter((date) => isDateSelectable(date))
      .sort((a, b) => a.getTime() - b.getTime());

    return entries[0] || null;
  }, [dayAvailabilityMap, isAvailabilityOpen, isDateSelectable]);

  const fetchDayAvailability = useCallback(async (
    ymd: string,
    options: { signal?: AbortSignal; generation?: number } = {}
  ): Promise<DayAvailability | null> => {
    if (dayAvailabilityMapRef.current[ymd]) {
      return dayAvailabilityMapRef.current[ymd];
    }

    const requestKey = `${availabilityContextKey}|day|${ymd}`;
    const existingRequest = dayRequestCacheRef.current[requestKey];
    if (existingRequest) return existingRequest;

    const request = getTimeSlots(ymd, { signal: options.signal })
      .then((data) => {
        const nextAvailability = normalizeDayAvailability(data);

        if (
          options.signal?.aborted ||
          (options.generation !== undefined &&
            options.generation !== initializationGenerationRef.current)
        ) {
          return nextAvailability;
        }

        setDayAvailabilityMap((prev) => {
          if (prev[ymd]) return prev;
          const next = { ...prev, [ymd]: nextAvailability };
          dayAvailabilityMapRef.current = next;
          return next;
        });

        return nextAvailability;
      })
      .catch((err) => {
        if (options.signal?.aborted || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return null;
        }
        console.error("Failed to load time slots:", err);
        return null;
      })
      .finally(() => {
        delete dayRequestCacheRef.current[requestKey];
      });

    dayRequestCacheRef.current[requestKey] = request;
    return request;
  }, [availabilityContextKey]);

  // Load calendar config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await getCalendarConfig();
        setConfig(data);
      } catch (err) {
        console.error("Failed to load calendar config:", err);
        setConfig({
          timezone: "America/New_York",
          slotMinutes: 60,
          minLeadDays: 2,
          closedWeekdays: [0],
          handymanCapacity: 1,
          defaultHours: FALLBACK_HOURS,
          overrides: {},
          holidays: [],
        } as CalendarConfig);
      }
    };
    loadConfig();
  }, []);

  const logAvailabilityDiagnostics = useCallback((records: unknown) => {
    if (process.env.NEXT_PUBLIC_BOOKING_CALENDAR_DEBUG === "1") {
      console.info("[booking-calendar:init]", records);
    }
  }, []);

  const loadMonthAvailability = useCallback(async (
    monthDate: Date,
    options: {
      markLoading?: boolean;
      signal?: AbortSignal;
      generation?: number;
      allowCache?: boolean;
    } = {}
  ): Promise<MonthLoadState> => {
    if (!config) {
      return {
        status: "error",
        month: getMonthKey(monthDate),
        error: new Error("Calendar config has not loaded."),
      };
    }

    const monthKey = getMonthKey(monthDate);
    const cacheKey = getAvailabilityCacheKey(monthKey);
    const allowCache = options.allowCache === true;
    const cached = monthAvailabilityCacheRef.current[cacheKey];

    if (
      allowCache &&
      cached &&
      cached.month === monthKey &&
      Date.now() - cached.loadedAt <= CACHE_TTL_MS
    ) {
      return {
        status: "success",
        month: monthKey,
        data: cached.data,
        source: "cache",
      };
    }

    const existingRequest = monthRequestCacheRef.current[cacheKey];
    if (existingRequest) return existingRequest;

    const shouldMarkLoading = options.markLoading !== false;
    if (shouldMarkLoading) {
      setLoadingMonthKey(monthKey);
      setMonthLoadStateMap((prev) => ({
        ...prev,
        [cacheKey]: { status: "loading", month: monthKey },
      }));
    }

    const request = (async (): Promise<MonthLoadState> => {
      const monthDays: MonthAvailabilityMap = {};

      try {
        if (config.engine === "reservation") {
          const monthData = await getMonthAvailability(monthKey, { signal: options.signal });
          if (monthData.month && monthData.month !== monthKey) {
            throw new Error(`Month response mismatch: expected ${monthKey}, got ${monthData.month}`);
          }
          for (const day of monthData.days || []) {
            monthDays[day.date] = normalizeDayAvailability(day);
          }
        } else {
          const year = monthDate.getFullYear();
          const month = monthDate.getMonth();
          const lastDay = new Date(year, month + 1, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const datesToFetch: string[] = [];
          for (let day = 1; day <= lastDay.getDate(); day += 1) {
            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);
            if (date < today) continue;
            datesToFetch.push(formatDateYMD(date));
          }

          const dayResults = await Promise.all(
            datesToFetch.map(async (ymd) => [
              ymd,
              await fetchDayAvailability(ymd, {
                signal: options.signal,
                generation: options.generation,
              }),
            ] as const)
          );
          for (const [ymd, detail] of dayResults) {
            if (detail) monthDays[ymd] = detail;
          }
        }

        if (options.signal?.aborted) {
          return { status: "aborted", month: monthKey };
        }
        if (
          options.generation !== undefined &&
          options.generation !== initializationGenerationRef.current
        ) {
          return { status: "stale", month: monthKey };
        }

        monthAvailabilityCacheRef.current[cacheKey] = {
          month: monthKey,
          loadedAt: Date.now(),
          data: monthDays,
        };
        setDayAvailabilityMap((prev) => {
          const next = { ...prev, ...monthDays };
          dayAvailabilityMapRef.current = next;
          return next;
        });
        const success: MonthLoadState = {
          status: "success",
          month: monthKey,
          data: monthDays,
          source: "network",
        };
        setMonthLoadStateMap((prev) => ({
          ...prev,
          [cacheKey]: success,
        }));
        return success;
      } catch (error) {
        if (options.signal?.aborted || isAbortError(error)) {
          return { status: "aborted", month: monthKey };
        }

        const loadError =
          error instanceof Error ? error : new Error("Failed to load month availability.");
        console.error("Failed to load month availability:", loadError);
        const errorState: MonthLoadState = {
          status: "error",
          month: monthKey,
          error: loadError,
        };
        setMonthLoadStateMap((prev) => ({
          ...prev,
          [cacheKey]: errorState,
        }));
        return errorState;
      } finally {
        delete monthRequestCacheRef.current[cacheKey];
        if (shouldMarkLoading) {
          setLoadingMonthKey((current) => (current === monthKey ? null : current));
        }
      }
    })();

    monthRequestCacheRef.current[cacheKey] = request;
    return request;
  }, [config, fetchDayAvailability, getAvailabilityCacheKey, getMonthKey]);

  useEffect(() => {
    if (!config || calendarMode === "initializing") return;
    monthNavigationAbortRef.current?.abort();
    const controller = new AbortController();
    monthNavigationAbortRef.current = controller;
    void loadMonthAvailability(currentMonth, {
      markLoading: true,
      signal: controller.signal,
      allowCache: true,
    });

    return () => {
      controller.abort();
    };
  }, [calendarMode, config, currentMonth, loadMonthAvailability]);

  useEffect(() => {
    if (!config) return;

    const generation = ++initializationGenerationRef.current;
    const controller = new AbortController();
    initializationAbortRef.current?.abort();
    monthNavigationAbortRef.current?.abort();
    initializationAbortRef.current = controller;
    const visibleMonthBefore = getMonthKey(currentMonthRef.current);
    const selectedDateBefore = selectedDateRef.current ? formatDateYMD(selectedDateRef.current) : null;
    const startMonth = monthStartLocal(new Date());

    setCalendarMode("initializing");
    setAvailabilityError("");
    setCurrentMonth(startMonth);
    setSelectedDate(null);
    setSelectedTime("");
    setDisplayedTimes([]);
    setLoadingSelectedDate(false);
    setError("");

    void resolveInitialCalendarSelection({
      generation,
      getCurrentGeneration: () => initializationGenerationRef.current,
      signal: controller.signal,
      startMonth,
      maxAdvanceDays: Number(config.maxAdvanceDays ?? 90),
      visibleMonthBefore,
      selectedDateBefore,
      loadMonth: (monthDate) =>
        loadMonthAvailability(monthDate, {
          markLoading: getMonthKey(monthDate) === getMonthKey(startMonth),
          signal: controller.signal,
          generation,
          allowCache: false,
        }),
    }).then((result) => {
      logAvailabilityDiagnostics(result.diagnostics);
      if (controller.signal.aborted || generation !== initializationGenerationRef.current) return;

      if (result.status === "success") {
        setAvailabilityError("");
        setCurrentMonth(monthStartLocal(result.date));
        setSelectedDate(result.date);
        setSelectedTime("");
        setDisplayedTimes(result.slots.map((slot) => slot.time));
        setCalendarMode("ready");
        return;
      }

      if (result.status === "none") {
        setAvailabilityError("");
        setCurrentMonth(startMonth);
        setSelectedDate(null);
        setSelectedTime("");
        setDisplayedTimes([]);
        setCalendarMode("ready");
        return;
      }

      if (result.status === "error") {
        setSelectedDate(null);
        setSelectedTime("");
        setDisplayedTimes([]);
        setCalendarMode("ready");
        setAvailabilityError("Unable to load appointment availability.");
      }
    });

    return () => {
      controller.abort();
      if (initializationGenerationRef.current === generation) {
        initializationGenerationRef.current += 1;
      }
    };
  }, [availabilityContextKey, availabilityRetryToken, config, getMonthKey, loadMonthAvailability, logAvailabilityDiagnostics]);



  useEffect(() => {
  const urls = uploadedPhotos.map((f) => URL.createObjectURL(f));
  setPhotoUrls(urls);

  return () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}, [uploadedPhotos]);



// ✅ Check access + limits + next booking (subscription OR free visit)
useEffect(() => {
  const run = async () => {
    const addressId = selectedAddressId || defaultAddressId;

    if (!addressId || !isAuthenticated) {
      setHasSubscription(false);
      setFreeFirstVisitAvailable(false);
      setPlan("");
      setHasActiveBooking(false);
      setActiveBookingCount(0);
      setActiveBookingLimit(1);
      setExistingBookingDate(null);
      setExistingBookingId(null);
      setExistingBookingService("");
      setExistingBookingTime("");
      setSubscriptionError("");
      setActiveBookings([]);
      return;
    }

    setCheckingAccess(true);
    try {
      const data = await getNextBooking(addressId);

      const hasSub = !!data?.hasSubscription;

setHasSubscription(hasSub);
setFreeFirstVisitAvailable(false); // keep if you want, but always false
setPlan(String(data?.plan || ""));

if (!hasSub) {
  setSubscriptionError("This address does not have an active membership for booking.");
} else {
  setSubscriptionError("");
}

      const limit = Number(data?.bookingLimit ?? 1);
      const count = Number(data?.activeCount ?? 0);

      const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;
      const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;

      // ✅ ALL active bookings list (pending + confirmed)
// Prefer array from API, fallback to single `future`
const list: BookingAccessItem[] = Array.isArray(data?.activeBookings)
  ? data.activeBookings
  : data?.future
  ? [data.future]
  : [];

setActiveBookings(
  list
    .filter((b) => b?.date)
    .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime())
);
      // ✅ keep legacy "existingBooking*" in sync using earliest booking
const sorted = list
  .filter((b) => b?.date)
  .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());

const next = sorted[0];

if (next?.date) {
  const dt = new Date(next.date);
  setExistingBookingDate(dt);
  setExistingBookingId(next._id || null);
  setExistingBookingService(next.service || "");

  const hhmm = dt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  setExistingBookingTime(hhmm);
} else {
  setExistingBookingDate(null);
  setExistingBookingId(null);
  setExistingBookingService("");
  setExistingBookingTime("");
}

      setActiveBookingLimit(safeLimit);
      setActiveBookingCount(safeCount);
      setHasActiveBooking(safeCount >= safeLimit);

      
    } catch {
      setHasSubscription(false);
      setFreeFirstVisitAvailable(false);
      setPlan("");
      setSubscriptionError("Unable to verify booking access.");
      setActiveBookings([]);
    } finally {
      setCheckingAccess(false);
    }
  };

  run();
}, [selectedAddressId, defaultAddressId, isAuthenticated]);

  // Load time slots when date selected
  useEffect(() => {
    if (!selectedDate) {
      setDisplayedTimes([]);
      return;
    }

    let cancelled = false;
    const dateStr = formatDateYMD(selectedDate);
    const cached = dayAvailabilityMap[dateStr];

    if (cached) {
      setDisplayedTimes(getBookableSlots(cached).map((slot) => slot.time));
      setLoadingSelectedDate(false);
      return;
    }

    setLoadingSelectedDate(true);

    void fetchDayAvailability(dateStr).then((data) => {
      if (cancelled) return;
      setDisplayedTimes(getBookableSlots(data).map((slot) => slot.time));
      setLoadingSelectedDate(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, dayAvailabilityMap, fetchDayAvailability]);

  const handleDayClick = async (dayDate: Date, muted: boolean) => {
    if (muted) return;

    const d = new Date(dayDate);
    d.setHours(0, 0, 0, 0);

    if (isDayDisabled(d)) return;

    const ymd = formatDateYMD(d);
    const cached = dayAvailabilityMap[ymd];

    if (cached) {
      const slots = getBookableSlots(cached).map((slot) => slot.time);
      if (slots.length === 0) return;
      setSelectedDate(d);
      setSelectedTime("");
      setDisplayedTimes(slots);
      return;
    }

    setSelectedDate(d);
    setSelectedTime("");
    setLoadingSelectedDate(true);

    const data = await fetchDayAvailability(ymd);
    if (!data) {
      setLoadingSelectedDate(false);
      return;
    }

    const slots = getBookableSlots(data).map((slot) => slot.time);
    if (slots.length === 0) {
      setLoadingSelectedDate(false);
      setSelectedDate((current) => (current && sameDay(current, d) ? null : current));
      return;
    }

    setDisplayedTimes(slots);
    setLoadingSelectedDate(false);
  };


  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();

    const days: { date: Date; muted: boolean }[] = [];

    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, muted: true });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), muted: false });
    }
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), muted: true });
    }

    return days;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const compressed: File[] = [];
    for (const file of Array.from(e.target.files)) {
      const c = await compressImage(file);
      compressed.push(c);
    }

    setUploadedPhotos((prev) => [...prev, ...compressed].slice(0, 10));
    if (error === "Add at least one photo so our team can prepare.") {
      setError("");
    }
    e.target.value = ""; // allow re-select same file
  };

  const removePhoto = (idx: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectClosestAvailableDateAndTime = () => {
    const closest = getClosestAvailableDate();
    if (!closest) return null;

    const ymd = formatDateYMD(closest);
    const availability = dayAvailabilityMap[ymd];
    const slots = getBookableSlots(availability).map((slot) => slot.time);
    const firstAvailableSlot = slots[0] || "";
    if (!firstAvailableSlot) return null;

    setCurrentMonth(monthStartLocal(closest));
    setSelectedDate(closest);
    setSelectedTime(firstAvailableSlot);
    setDisplayedTimes(slots);

    return { date: closest, time: firstAvailableSlot };
  };

  const handleQuickBookingSelect = (taskTitle: string) => {
    setQuickBookingLoading(true);
    setError("");
    setNotice("");

    const selected = selectClosestAvailableDateAndTime();
    if (!selected) {
      setQuickBookingLoading(false);
      setError("We are still checking nearby availability. Try Quick Book again in a moment.");
      return;
    }

    if (taskTitle === "Other Small Home Tasks") {
      setNote("");
    } else {
      setNote(QUICK_BOOKING_DESCRIPTIONS[taskTitle] || taskTitle);
    }
    setService(memberService);

    setQuickBookOpen(false);
    setQuickBookingLoading(false);
  };

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return "";
    return selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDate]);

  const handleBookNow = async () => {
    if (!isAuthenticated) {
      alert("Please open My Home to book a visit.");
      window.location.href = "/signin";
      return;
    }

    const addressId = selectedAddressId || defaultAddressId;
    if (!addressId) {
      alert("Please add an address to your account first");
      window.location.href = roleLandingPath;
      return;
    }

    if (!hasSubscription) {
  setError("This address does not have an active membership for booking.");
  return;
}

    if (calendarMode !== "ready" || showAvailabilityLoadError || availabilityError) {
      setAvailabilityError("Unable to load appointment availability.");
      return;
    }

    if ((selectedDate && !selectedDateIsBookable) || (selectedTime && !selectedTimeIsBookable)) {
      setAvailabilityError("This appointment time is no longer available. Please choose another time.");
      return;
    }

    if (!service) {
      setError("Choose a service type.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError("Choose a date and time.");
      return;
    }
    if (note.trim().split(/\s+/).filter(Boolean).length < 3) {
      setError("Describe the task in at least a few words.");
      return;
    }
    if (uploadedPhotos.length === 0) {
      setError("Add at least one photo so our team can prepare.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const bookingDate = new Date(selectedDate);
      bookingDate.setHours(hours, minutes, 0, 0);

      const serviceLabel = SERVICES.find((x) => x.key === service)?.label || "";



      await createBooking({
        service: serviceLabel,
        date: bookingDate.toISOString(),
        note: note.trim(),
        addressId,
        images: uploadedPhotos,
        requestedDate: formatDateYMD(selectedDate),
        requestedTime: selectedTime,
      });

      setConfirmedDate(new Date(selectedDate));
      setConfirmedTime(selectedTime);
      const bookedAddress = addresses.find((address) => address._id === addressId);
      setConfirmedAddress(
        [bookedAddress?.line1, bookedAddress?.city, bookedAddress?.state, bookedAddress?.zip]
          .filter(Boolean)
          .join(", "),
      );

      setHasActiveBooking(activeBookingCount + 1 >= activeBookingLimit);
      setActiveBookingCount((c) => c + 1);
      setExistingBookingDate(bookingDate);

      setService(memberService);
      setSelectedDate(null);
      setSelectedTime("");
      setNote("");
      setUploadedPhotos([]);

      setShowModal(true);
    } catch (err: unknown) {
      const bookingError = err as Error & {
        code?: string;
        suggestions?: Array<{ date: string; time: string }>;
      };
      if (bookingError?.code === "SLOT_UNAVAILABLE" && selectedDate) {
        const ymd = formatDateYMD(selectedDate);
        setSelectedTime("");
        setDayAvailabilityMap((prev) => {
          const next = { ...prev };
          delete next[ymd];
          dayAvailabilityMapRef.current = next;
          return next;
        });
        delete dayRequestCacheRef.current[ymd];
        void fetchDayAvailability(ymd);
      }
      const responseMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const errorMessage = err instanceof Error ? err.message : undefined;
      const suggestionText = bookingError?.suggestions?.length
        ? ` Try ${bookingError.suggestions
            .slice(0, 3)
            .map((item) => `${item.date} at ${item.time}`)
            .join(", ")}.`
        : "";
      const message =
        (responseMessage || errorMessage || "We could not create the booking. Please try again.") +
        suggestionText;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const rebook = async (booking: BookingAccessItem | null) => {
  const id = booking?._id || existingBookingId;
  if (!id) return;

  try {
    const token = localStorage.getItem("token");
    setError("");
    setNotice("");

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/bookings/cancel/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // remove it from list
    setActiveBookings((prev) => prev.filter((b) => String(b._id) !== String(id)));

    // update counts/flags
    setActiveBookingCount((c) => {
  const next = Math.max(0, c - 1);
  setHasActiveBooking(next >= (activeBookingLimit || 1));
  return next;
});

    // prefill service/date/time for rebook
    const svc = booking?.service || existingBookingService;
    const dtRaw = booking?.date || existingBookingDate;
    const timeRaw = booking?.time || existingBookingTime;

    if (svc) {
      const key = SERVICES.find((s) => s.label === svc)?.key || "";
      setService(key as ServiceKey | "");
    }

    if (dtRaw) {
      const dt = new Date(dtRaw);
      const dd = new Date(dt);
      dd.setHours(0, 0, 0, 0);
      setSelectedDate(dd);

      const hhmm =
        timeRaw ||
        dt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

      setSelectedTime(hhmm);
    }

    setTimeout(() => {
      document.getElementById("pick-day")?.scrollIntoView({ behavior: "smooth" });
    }, 150);

    setNotice("Visit canceled. You may now rebook.");
  } catch (err) {
    console.error("Rebook failed:", err);
    setError("Error canceling the visit. Please try again.");
  }
};

  const days = generateCalendarDays();

  const wordsCount = note.trim().split(/\s+/).filter(Boolean).length;

  const ymdSelected = selectedDate ? formatDateYMD(selectedDate) : "";
  const selectedAvailability = ymdSelected ? dayAvailabilityMap[ymdSelected] : null;
  const selectedDateIsBookable = isAvailabilityOpen(selectedAvailability);
  const selectedTimeIsBookable = Boolean(selectedTime && displayedTimes.includes(selectedTime));
  const selectedAddress = addresses.find(
    (address) => String(address._id) === String(selectedAddressId ?? defaultAddressId ?? "")
  );
  const selectedAddressLabel = selectedAddress
    ? `${selectedAddress.label ? `${selectedAddress.label}: ` : ""}${selectedAddress.line1}, ${selectedAddress.city} ${selectedAddress.state} ${selectedAddress.zip}`
    : "";
  const visibleMonthKey = getMonthKey(currentMonth);
  const visibleMonthLoadState = monthLoadStateMap[getAvailabilityCacheKey(visibleMonthKey)];
  const visibleMonthLoaded = visibleMonthLoadState?.status === "success" && loadingMonthKey !== visibleMonthKey;
  const visibleMonthHasAvailability = Object.entries(dayAvailabilityMap).some(
    ([ymd, info]) => ymd.startsWith(visibleMonthKey) && isAvailabilityOpen(info)
  );
  const showNoAvailabilityThisMonth =
    calendarMode !== "initializing" && visibleMonthLoaded && !visibleMonthHasAvailability;
  const showAvailabilityLoadError =
    calendarMode !== "initializing" && (Boolean(availabilityError) || visibleMonthLoadState?.status === "error");
  const availabilityCanSubmit =
    calendarMode === "ready" &&
    !showAvailabilityLoadError &&
    selectedDateIsBookable &&
    selectedTimeIsBookable;
  const requiredBookingFieldsComplete =
    Boolean(service) &&
    Boolean(selectedDate) &&
    Boolean(selectedTime) &&
    wordsCount >= 3 &&
    uploadedPhotos.length > 0;
  const canBook =
    !loading &&
    !checkingAccess &&
    availabilityCanSubmit &&
    requiredBookingFieldsComplete &&
    (hasSubscription || !isAuthenticated) &&
    !hasActiveBooking;

  const moveToNextAvailableMonth = async () => {
    if (!config) return;
    setAvailabilityError("");
    monthNavigationAbortRef.current?.abort();
    const controller = new AbortController();
    monthNavigationAbortRef.current = controller;
    setCalendarMode("manual-navigation");
    const maxAdvanceDays = Number(config.maxAdvanceDays ?? 90);
    const maxMonths = Math.max(1, Math.ceil(maxAdvanceDays / 31) + 1);

    for (let offset = 1; offset <= maxMonths; offset += 1) {
      const candidateMonth = addMonthsLocal(currentMonth, offset);
      const monthAvailability = await loadMonthAvailability(candidateMonth, {
        markLoading: true,
        signal: controller.signal,
        allowCache: true,
      });
      if (controller.signal.aborted || monthAvailability.status === "aborted") return;
      if (monthAvailability.status === "error") {
        setAvailabilityError("Unable to load appointment availability.");
        return;
      }
      if (monthAvailability.status !== "success") return;

      const firstAvailable = firstBookableDateInMonth(candidateMonth, monthAvailability.data);
      if (firstAvailable) {
        const ymd = formatDateYMD(firstAvailable);
        const availability = monthAvailability.data[ymd] || dayAvailabilityMapRef.current[ymd];
        setCurrentMonth(monthStartLocal(firstAvailable));
        setSelectedDate(firstAvailable);
        setSelectedTime("");
        setDisplayedTimes(getBookableSlots(availability).map((slot) => slot.time));
        return;
      }
    }

    setAvailabilityError("No available appointments were found in the next available booking window.");
  };
  const slotOptions = useMemo(() => {
    if (!selectedDate || !config) return [];
    const taken = dayAvailabilityMap[ymdSelected]?.taken || {};
    const capacity = dayAvailabilityMap[ymdSelected]?.capacity || 1;
    const availableSet = new Set(displayedTimes);

    const times =
      config.engine === "reservation"
        ? displayedTimes
        : getHoursForDate(selectedDate);
    return times.map((time) => {
      const used = taken[time] || 0;
      const available = availableSet.has(time);
      return {
        time,
        available,
        remaining: available
          ? dayAvailabilityMap[ymdSelected]?.remaining?.[time] ??
            Math.max(capacity - used, 0)
          : null,
      };
    });
  }, [
    selectedDate,
    config,
    dayAvailabilityMap,
    ymdSelected,
    displayedTimes,
    getHoursForDate,
  ]);

  return (
    <section
      id="pick-day"
      data-calendar-mode={calendarMode}
      data-visible-month={visibleMonthKey}
      data-selected-date={ymdSelected}
      data-available-times={displayedTimes.join(",")}
      className="relative w-full overflow-hidden bg-[#F6F8FC] pb-4 pt-3 scroll-mt-[96px] sm:pb-10 sm:pt-8 lg:pb-14 lg:pt-12"
    >
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-2 flex items-center justify-between gap-3 sm:mb-5">
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.025em] text-[#0B1628] sm:text-[32px] lg:text-[38px]">
            Book Your Visit
          </h2>
          {isAuthenticated && hasSubscription && (
            <button type="button" onClick={() => router.push(manageBookingsPath)} className="flex-shrink-0 text-[12px] font-semibold text-[#64748B] underline decoration-[#CBD5E1] underline-offset-4 transition hover:text-[#306EEC] sm:text-[13px]">
              Manage visits
            </button>
          )}
        </div>


        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-12 lg:gap-5">

          {/* ── Calendar (left) ── */}
          <div className="order-2 lg:order-1 lg:col-span-5">

            {/* Calendar card */}
            <div className="rounded-[13px] border border-[#D7DEE9] bg-white p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.035)] sm:p-4">
              {/* Month navigation */}
              <div className="mb-2 flex items-center justify-between sm:mb-4">
                <button
                  aria-label="Prev month"
                  disabled={calendarMode === "initializing"}
                  onClick={() => {
                    if (calendarMode === "initializing") return;
                    setCalendarMode("manual-navigation");
                    setCurrentMonth(addMonthsLocal(currentMonth, -1));
                  }}
                  className="grid h-11 w-11 place-items-center rounded-[10px] border border-[#E5E9F2] bg-[#F8FAFF] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF] active:scale-95"
                >
                  <ChevronLeft />
                </button>

                <div className="text-[14px] font-extrabold text-[#0B1628] sm:text-[18px]">
                  {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>

                <button
                  aria-label="Next month"
                  disabled={calendarMode === "initializing"}
                  onClick={() => {
                    if (calendarMode === "initializing") return;
                    setCalendarMode("manual-navigation");
                    setCurrentMonth(addMonthsLocal(currentMonth, 1));
                  }}
                  className="grid h-11 w-11 place-items-center rounded-[10px] border border-[#E5E9F2] bg-[#F8FAFF] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF] active:scale-95"
                >
                  <ChevronRight />
                </button>
              </div>

              {loadingMonthKey === visibleMonthKey && (
                <div className="mb-4 rounded-[12px] border border-[#D9E4FF] bg-[#F0F7FF] px-3 py-2 text-[12px] font-semibold text-[#475569]">
                  Checking availability...
                </div>
              )}

              {showAvailabilityLoadError && (
                <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-3 text-center">
                  <div className="text-[13px] font-semibold text-red-700">
                    Unable to load appointment availability.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAvailabilityError("");
                      setAvailabilityRetryToken((value) => value + 1);
                    }}
                    className="mt-2 rounded-[10px] border border-red-300 px-3 py-2 text-[12px] font-bold text-red-700 transition hover:bg-red-100"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Week headers */}
              <div className="mb-0.5 grid grid-cols-7 text-center sm:mb-1">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                  <div
                    key={d}
                    className={`text-[11px] font-bold ${i === 0 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((day, i) => {
                  const disabled = day.muted || isDayDisabled(new Date(day.date));
                  const isSelected = selectedDate ? sameDay(day.date, selectedDate) : false;
                  const isCheckingDay =
                    !day.muted &&
                    !dayAvailabilityMap[formatDateYMD(day.date)] &&
                    loadingMonthKey === visibleMonthKey;
                  const today = new Date();
                  const isToday = sameDay(day.date, today);

                  return (
                    <button
                      key={i}
                      type="button"
                      data-booking-date={formatDateYMD(day.date)}
                      data-booking-date-muted={day.muted ? "true" : "false"}
                      data-booking-date-disabled={disabled ? "true" : "false"}
                      onClick={() => handleDayClick(day.date, day.muted)}
                      disabled={disabled}
                      className={[
                        "mx-auto grid h-9 w-9 place-items-center rounded-[10px] text-[13px] font-semibold transition-all duration-150 sm:h-10 sm:w-10 sm:text-[15px]",
                        day.muted ? "text-[#C5CBD8] cursor-not-allowed" : "",
                        disabled && !day.muted ? "text-[#C5CBD8] cursor-not-allowed" : "",
                        !disabled && !isSelected ? "bg-[#EEF5FF] text-[#1D4ED8] hover:bg-[#DBEAFE] hover:scale-105" : "",
                        isSelected ? "bg-[#306EEC] text-white shadow-[0_8px_24px_rgba(48,110,236,0.35)] scale-105" : "",
                        isToday && !disabled && !isSelected ? "ring-2 ring-[#306EEC]/30" : "",
                      ].join(" ")}
                    >
                      <span className={isCheckingDay ? "opacity-40" : ""}>{day.date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              {showNoAvailabilityThisMonth && (
                <div className="mt-4 rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] px-3 py-3 text-center">
                  <div className="text-[13px] font-semibold text-[#64748B]">
                    No available appointments in this month.
                  </div>
                  <button
                    type="button"
                    onClick={moveToNextAvailableMonth}
                    className="mt-2 rounded-[10px] border border-[#306EEC] px-3 py-2 text-[12px] font-bold text-[#306EEC] transition hover:bg-[#EEF5FF]"
                  >
                    Next available month
                  </button>
                </div>
              )}
            </div>

            {/* Selected date label */}
            {selectedDate && (
              <div className="mt-1 flex items-center gap-1.5 px-1 py-1 sm:mt-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#306EEC] flex-shrink-0" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="text-[13px] font-semibold text-[#0B1628]">{selectedDateLabel}</span>
              </div>
            )}

          </div>

          {/* ── Right column ── */}
          <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-4">

            <div className="order-1 rounded-[13px] border border-[#D7DEE9] bg-white px-2.5 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.035)] sm:p-3.5 lg:order-none">
              {selectedAddressLabel ? (
                <>
                  <div className="flex min-h-11 items-center gap-2">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-[#306EEC]" aria-hidden="true">
                      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0B1628] sm:text-[14px]" title={selectedAddressLabel}>
                      {selectedAddressLabel}
                    </span>
                    {addresses.length >= 2 && (
                      <button type="button" onClick={() => setShowAddressPicker((open) => !open)} className="h-11 flex-shrink-0 px-1 text-[12px] font-bold text-[#306EEC]">
                        {showAddressPicker ? "Done" : "Change"}
                      </button>
                    )}
                  </div>
                  {showAddressPicker && addresses.length >= 2 && (
                    <select
                      autoFocus
                      aria-label="Booking address"
                      value={selectedAddressId ?? defaultAddressId ?? ""}
                      onChange={(event) => setSelectedAddressId(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-[11px] border border-[#C5CBD8] bg-[#F8FAFF] px-3 text-[13px] font-semibold text-[#0B1628] outline-none transition focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15"
                    >
                      {addresses.map((address) => (
                        <option key={address._id} value={address._id}>
                          {address.label ? `${address.label}: ` : ""}{address.line1}, {address.city} {address.state} {address.zip}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-800">
                  Add a service address in your account before booking.
                </div>
              )}
            </div>

            {/* Time slot card */}
            <div className="order-3 rounded-[13px] border border-[#D7DEE9] bg-white p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.035)] sm:p-4 lg:order-none">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-extrabold text-[#0B1628] sm:text-[15px]">Time</h3>
                <button
                  type="button"
                  onClick={() => setQuickBookOpen(true)}
                  disabled={checkingAccess || loadingMonthKey === visibleMonthKey}
                  className="inline-flex h-11 flex-shrink-0 items-center gap-1 rounded-[10px] border border-[#306EEC] px-2 text-[11px] font-bold text-[#306EEC] transition hover:bg-[#EEF5FF] disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5 sm:text-[12px]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Quick Book
                </button>
              </div>

              {selectedDate && config ? (
                loadingSelectedDate && displayedTimes.length === 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="h-11 animate-pulse rounded-[11px] bg-[#F1F5F9]" />
                    ))}
                  </div>
                ) : slotOptions.length > 0 ? (
                  <TimeSlotGrid
                    slotOptions={slotOptions}
                    selectedTime={selectedTime}
                    onSelect={(t) => setSelectedTime(t)}
                  />
                ) : (
                  <div className="rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] px-3 py-3 text-center text-[13px] text-[#64748B]">
                    No times available for this date. Try a different day.
                  </div>
                )
              ) : (
                <div className="rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] px-3 py-3 text-center text-[13px] text-[#64748B]">
                  Select a date on the calendar to see available times.
                </div>
              )}

              {loadingSelectedDate && displayedTimes.length > 0 && (
                <div className="mt-2 text-[11px] text-[#94A3B8]">Updating times...</div>
              )}

            </div>

            {/* Task details card */}
            <div className="order-4 rounded-[13px] border border-[#D7DEE9] bg-white p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.035)] sm:p-4 lg:order-none">
              <h3 className="mb-2 text-[14px] font-extrabold text-[#0B1628] sm:text-[15px]">Task details</h3>

              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error === "Describe the task in at least a few words.") setError("");
                }}
                placeholder="Describe your task. If we need to bring any materials or special tools, please let us know."
                rows={3}
                className={`w-full min-h-[72px] max-h-[170px] rounded-[11px] border bg-[#F8FAFF] p-2.5 text-[13px] text-[#0B1628] placeholder-[#94A3B8] resize-y transition focus:outline-none focus:ring-4 focus:ring-[#306EEC]/15 focus:border-[#306EEC] sm:min-h-[82px] sm:text-[14px] ${
                  error === "Describe the task in at least a few words."
                    ? "border-red-300"
                    : "border-[#C5CBD8]"
                }`}
              />
              {/* Photo upload */}
              <div className="mt-2.5">
                <div className="mb-1.5 text-[11px] font-semibold text-[#64748B]">
                  Photos required
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#C5CBD8] bg-[#F8FAFF] px-0.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] sm:text-[13px]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-[10px] border border-[#C5CBD8] bg-[#F8FAFF] px-0.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] sm:text-[13px]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Choose Photos{uploadedPhotos.length > 0 ? ` (${uploadedPhotos.length})` : ""}
                  </button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Photo previews */}
                {uploadedPhotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {uploadedPhotos.map((_file, idx) => {
                      const url = photoUrls[idx];
                      return (
                        <div
                          key={idx}
                          className="relative rounded-[12px] overflow-hidden border border-[#E5E9F2] bg-[#F8FAFF]"
                          style={{ aspectRatio: "1" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url || ""}
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/75 transition text-[12px] font-bold leading-none"
                            aria-label="Remove photo"
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Subscription warning */}
            {isAuthenticated && !checkingAccess && !hasSubscription && subscriptionError && (
              <div className="order-5 rounded-[12px] border border-red-200 bg-red-50 p-5 lg:order-none">
                <div className="text-[15px] font-extrabold text-red-700 mb-1">Booking unavailable for this address</div>
                <div className="text-[13px] text-red-600 mb-4">{subscriptionError}</div>
                <a
                  href="/account"
                  className="inline-flex h-[40px] items-center px-5 rounded-[12px] bg-[#306EEC] text-white text-[14px] font-bold hover:bg-[#2558c9] transition"
                >
                  Open account
                </a>
              </div>
            )}

            {/* Booking limit warning */}
            {isAuthenticated && hasSubscription && hasActiveBooking && (
              <div className="order-5 rounded-[12px] border border-amber-200 bg-amber-50 p-5 lg:order-none">
                <div className="text-[15px] font-extrabold text-amber-800 mb-1">Visit limit reached</div>
                <div className="text-[13px] text-amber-700 mb-2">
                  You have{" "}
                  <span className="font-semibold">{activeBookingCount}</span> of{" "}
                  <span className="font-semibold">{activeBookingLimit}</span> scheduled{" "}
                  {activeBookingLimit === 1 ? "visit" : "visits"} booked.
                </div>
                {existingBookingDate && (
                  <div className="text-[13px] text-amber-700 mb-4">
                    Next visit:{" "}
                    <span className="font-semibold">
                      {existingBookingDate.toLocaleString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => rebook(activeBookings[0] || null)}
                  className="inline-flex h-[40px] items-center px-5 rounded-[12px] bg-[#306EEC] text-white text-[14px] font-bold hover:bg-[#2558c9] transition"
                >
                  Reschedule visit
                </button>
              </div>
            )}

            {/* Notice / Error banners */}
            {notice && (
              <div className="order-6 rounded-[12px] border border-green-200 bg-green-50 px-5 py-4 text-[14px] text-green-700 font-semibold lg:order-none">
                {notice}
              </div>
            )}
            {error && (
              <div className="order-6 rounded-[12px] border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-700 lg:order-none">
                {error}
              </div>
            )}

            {/* Confirm card */}
            <div className="order-7 pb-[calc(80px+env(safe-area-inset-bottom,0px))] pt-0.5 sm:pb-0 lg:order-none">
              <button
                onClick={handleBookNow}
                data-track="booking-cta"
                disabled={!canBook}
                className="h-12 w-full rounded-[13px] bg-[#306EEC] text-[15px] font-extrabold text-white transition-all hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] sm:h-14 sm:rounded-[15px] sm:text-[16px]"
                style={{ boxShadow: canBook ? "0 10px 30px rgba(48,110,236,0.25)" : undefined }}
              >
                {checkingAccess
                  ? "Checking access..."
                  : calendarMode === "initializing"
                  ? "Loading Availability..."
                  : showAvailabilityLoadError
                  ? "Availability Unavailable"
                  : loading
                  ? "Booking..."
                  : hasActiveBooking
                  ? "Visit limit reached"
                  : "Book Your Visit"}
              </button>

            </div>
          </div>
        </div>

        {/* ── Quick Booking Modal ── */}
        {quickBookOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-0"
            onClick={() => { if (!quickBookingLoading) setQuickBookOpen(false); }}
          >
            <div
              className="max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_32px_100px_rgba(0,0,0,0.28)] sm:rounded-[28px] sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC] mb-1">
                    Quick Booking
                  </div>
                  <h3 className="text-[20px] font-extrabold leading-tight text-[#0B1628] sm:text-[26px]">
                    What can we help with?
                  </h3>
                  <p className="text-[13px] text-[#64748B] mt-1.5">
                    Pick a task and we&rsquo;ll fill in the nearest available day and time.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={quickBookingLoading}
                  onClick={() => setQuickBookOpen(false)}
                  className="flex-shrink-0 w-10 h-10 rounded-full border border-[#E5E9F2] text-[#475569] flex items-center justify-center hover:bg-[#F8FAFF] disabled:opacity-50 transition"
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {POPULAR_TASKS.map((task) => (
                  <button
                    key={task.title}
                    type="button"
                    disabled={quickBookingLoading}
                    onClick={() => handleQuickBookingSelect(task.title)}
                    className="group flex items-start gap-3 rounded-[16px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-4 text-left transition hover:border-[#306EEC] hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-[10px] border border-[#E5E9F2] bg-white flex items-center justify-center text-[#64748B] group-hover:text-[#306EEC] group-hover:border-[#D9E4FF] transition">
                      {task.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#0B1628] leading-snug">
                        {task.title}
                      </div>
                      <div className="text-[12px] text-[#64748B] mt-0.5 leading-relaxed">
                        {task.subtitle}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 text-[12px] text-[#94A3B8]">
                {quickBookingLoading
                  ? "Finding the nearest available slot..."
                  : "Photos are still required before submitting your booking."}
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmation Modal ── */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-[3px] sm:items-center sm:p-5"
            style={{
              paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
            }}
            onClick={() => setShowModal(false)}
            role="presentation"
          >
            <div
              className="flex w-full max-w-[440px] flex-col overflow-hidden rounded-[22px] border border-black/[0.08] bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:rounded-[24px]"
              style={{ maxHeight: "calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px)))" }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-success-title"
            >
              {/* Drag handle — mobile only */}
              <div className="min-h-0 overflow-y-auto px-5 pb-4 pt-6 sm:px-7 sm:pb-5 sm:pt-7">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF8EF] ring-1 ring-[#CDEBD8]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 8" stroke="#16803C" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <h2 id="booking-success-title" className="text-center text-[21px] font-extrabold tracking-[-0.02em] text-[#0B1628] sm:text-[24px]">
                  Visit booked
                </h2>
                <p className="mt-2 text-center text-[15px] font-semibold leading-snug text-[#334155]">
                  {confirmedDate?.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })} at {formatTime12(confirmedTime)}
                </p>
                {confirmedAddress && (
                  <p className="mx-auto mt-2 max-w-full truncate text-center text-[13px] text-[#64748B]" title={confirmedAddress}>
                    {confirmedAddress}
                  </p>
                )}
                <p className="mt-4 text-center text-[14px] leading-relaxed text-[#64748B]">
                  We&rsquo;ll notify you when your visit is confirmed.
                </p>
              </div>
              <div className="flex-shrink-0 border-t border-black/[0.06] px-5 pb-5 pt-4 sm:px-7 sm:pb-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    router.push(manageBookingsPath);
                  }}
                  className="h-12 w-full rounded-[14px] bg-[#306EEC] text-[15px] font-bold text-white shadow-[0_8px_24px_rgba(48,110,236,0.24)] transition hover:bg-[#2558c9] active:scale-[0.99]"
                >
                  View My Visit
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
