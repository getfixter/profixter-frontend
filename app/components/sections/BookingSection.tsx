"use client";


import Link from "next/link";
import LoyaltyBenefitsPanel from "@/app/components/account/LoyaltyBenefitsPanel";
import { getLoyaltyStatus, type LoyaltyStatus } from "@/lib/subscription-service";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { useServiceTextsOptIn } from "@/app/components/booking/ServiceTextsOptIn";
import { trackEvent } from "@/lib/analytics";
import {
  getCalendarConfig,
  getTimeSlots,
  getMonthAvailability,
  createBooking,
  getNextBooking,
  CalendarConfig,
  type AvailabilityVisit,
} from "@/lib/booking-service";
import { compressImage } from "@/lib/compressImage";
import { trackSchedule } from "@/lib/meta";
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
import { useRouter, usePathname } from "next/navigation";
import { POPULAR_TASKS } from "./PopularTasksSection";
import TimeSlotGrid from "@/app/components/booking/TimeSlotGrid";
import PhotoLibraryPicker from "@/app/components/booking/PhotoLibraryPicker";
import BookingConfirmationDialog, {
  type BookingConfirmation,
} from "@/app/components/booking/BookingConfirmationDialog";

const SERVICES = [
  { key: "labor_only", label: "Labor Only", minRank: 1 }, // Basic+
  { key: "labor_materials", label: "Labor with Materials Needed", minRank: 2 }, // Plus+
  { key: "get_2_pros", label: "Get 2 Pros", minRank: 3 }, // Premium+
  { key: "general_contractor", label: "General Contractor", minRank: 4 }, // Elite
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

type BookingFieldErrors = Partial<Record<"address" | "date" | "time" | "note" | "photos", string>>;

function RequiredAsterisk() {
  return (
    <>
      <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
      <span className="sr-only"> required</span>
    </>
  );
}

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

// ---------- Booking Section ----------
export default function BookingSection() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { ensureContact, contactSheet } = useContactCompletion();
  const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn();

  const bookingUser = user as BookingUser | null;
  const addresses = bookingUser?.addresses || [];
  const defaultAddressId = bookingUser?.defaultAddressId;
  const roleLandingPath = getRoleLandingPath(user);
  // The visit list, not the Account tab that only forwards to it.
  const manageBookingsPath =
    roleLandingPath === "/account" ? "/book#your-visits" : roleLandingPath;
  /*
   * Book renders the visit list directly under this form, so "Manage visits"
   * scrolls there rather than navigating. Everywhere else it still routes.
   */
  const pathname = usePathname();
  const onBookPage = pathname === "/book";

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
  const calendarFieldRef = useRef<HTMLDivElement | null>(null);
  const timeFieldRef = useRef<HTMLDivElement | null>(null);
  const noteFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const photosFieldRef = useRef<HTMLDivElement | null>(null);
  const addressFieldRef = useRef<HTMLDivElement | null>(null);
  const dayRequestCacheRef = useRef<Record<string, Promise<DayAvailability | null>>>({});
  const monthRequestCacheRef = useRef<Record<string, Promise<MonthLoadState>>>({});
  const monthAvailabilityCacheRef = useRef<Record<string, {
    month: string;
    loadedAt: number;
    data: MonthAvailabilityMap;
  }>>({});
  const initializationGenerationRef = useRef(0);
  const monthNavigationGenerationRef = useRef(0);
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
  // A Profixter Library example, for when there is no photo to hand. Kept apart
  // from uploadedPhotos: it is never sent as, or shown as, a customer photo.
  const [libraryReference, setLibraryReference] = useState("");
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // UI state
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /* Signed out at the button: where to come back to after signing in (path + query). */
  const [signInNext, setSignInNext] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const closeBookingConfirmation = useCallback(() => setBookingConfirmation(null), []);
  const viewConfirmedVisit = useCallback(() => {
    setBookingConfirmation(null);
    router.push(manageBookingsPath);
  }, [manageBookingsPath, router]);
  const clearFieldError = useCallback((field: keyof BookingFieldErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

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
  const [freeFirstVisitAvailable, setFreeFirstVisitAvailable] = useState(false);
  const [introVisitConsumed, setIntroVisitConsumed] = useState(false);
  const [outOfServiceArea, setOutOfServiceArea] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(false);

  // Plan used to lock services (basic | plus | premium | elite | free)
  const [plan, setPlan] = useState<string>("");

  /*
   * Loyalty for the address being booked against.
   *
   * Fetched after the access check, never awaited by it, and dropped silently
   * on failure — a reminder is not worth a slower or broken booking form.
   */
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null);

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
  /*
   * A member is offered member-visit availability: the server closes the dates
   * a regular membership visit cannot have. The earliest date is the server's
   * answer from /config, used so no automatic pick ever lands before it.
   */
  const availabilityVisit: AvailabilityVisit | undefined = hasSubscription ? "membership" : undefined;
  const memberEarliestBookableDate =
    hasSubscription && config?.earliestBookableDate ? config.earliestBookableDate : null;

  // ✅ pick default address
  useEffect(() => {
    if (defaultAddressId) {
      setSelectedAddressId((prev) => prev ?? String(defaultAddressId));
      clearFieldError("address");
    }
  }, [clearFieldError, defaultAddressId]);

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
    setLibraryReference("");
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

    /*
     * The server's earliest offerable date for a member.
     *
     * Applied silently, exactly like every other reason a day is not offered:
     * the day is simply not selectable, with no notice, tooltip or explanation
     * anywhere — a closed Sunday is not annotated either. Gated on
     * `hasSubscription` because the API scopes the same answer the same way.
     *
     * Presentation only. The API decides this again when the booking is
     * created, and its decision stands whether or not this line ran.
     */
    if (memberEarliestBookableDate && ymd < memberEarliestBookableDate) {
      return true;
    }

    return !isAvailabilityOpen(info);
  }, [calendarMode, config, dayAvailabilityMap, isAvailabilityOpen, memberEarliestBookableDate]);

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

    const request = getTimeSlots(ymd, { signal: options.signal, visit: availabilityVisit })
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
  }, [availabilityContextKey, availabilityVisit]);

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
          const monthData = await getMonthAvailability(monthKey, {
            signal: options.signal,
            visit: availabilityVisit,
          });
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
  }, [availabilityVisit, config, fetchDayAvailability, getAvailabilityCacheKey, getMonthKey]);

  useEffect(() => {
    if (!config || calendarMode === "initializing") return;
    const generation = ++monthNavigationGenerationRef.current;
    const requestedMonth = getMonthKey(currentMonth);
    monthNavigationAbortRef.current?.abort();
    const controller = new AbortController();
    monthNavigationAbortRef.current = controller;
    void loadMonthAvailability(currentMonth, {
      markLoading: true,
      signal: controller.signal,
      allowCache: true,
    }).then((result) => {
      if (
        controller.signal.aborted ||
        generation !== monthNavigationGenerationRef.current ||
        getMonthKey(currentMonthRef.current) !== requestedMonth
      ) {
        return;
      }

      if (result.status === "success" && result.month === requestedMonth) {
        setAvailabilityError("");
        setCalendarMode("ready");
      } else if (result.status === "error") {
        setAvailabilityError("Unable to load appointment availability.");
        setCalendarMode("ready");
      }
    });

    return () => {
      controller.abort();
    };
  }, [calendarMode, config, currentMonth, getMonthKey, loadMonthAvailability]);

  const navigateCalendarMonth = (offset: number) => {
    if (calendarMode === "initializing") return;

    const nextMonth = addMonthsLocal(currentMonthRef.current, offset);
    setAvailabilityError("");
    setCalendarMode("manual-navigation");
    setCurrentMonth(nextMonth);
    setSelectedDate(null);
    setSelectedTime("");
    setDisplayedTimes([]);
    setLoadingSelectedDate(false);
  };

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

    /*
     * Days fetched for another context (before membership was known, or for
     * another address) answered a different question. The day cache is keyed
     * by date alone, so it is emptied rather than trusted.
     */
    dayAvailabilityMapRef.current = {};
    setDayAvailabilityMap({});

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
      earliestBookableDate: memberEarliestBookableDate,
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
  }, [availabilityContextKey, availabilityRetryToken, config, getMonthKey, loadMonthAvailability, logAvailabilityDiagnostics, memberEarliestBookableDate]);



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
      setIntroVisitConsumed(false);
      setOutOfServiceArea(false);
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
      setLoyalty(null);
      return;
    }

    setCheckingAccess(true);
    try {
      const data = await getNextBooking(addressId);

      const hasSub = !!data?.hasSubscription;

const freeVisit = !hasSub && !!data?.freeFirstVisitAvailable;

setHasSubscription(hasSub);
setFreeFirstVisitAvailable(freeVisit);
setIntroVisitConsumed(!hasSub && data?.introVisitStatus === "consumed");
setOutOfServiceArea(!hasSub && data?.introVisitServiceable === false && data?.introVisitStatus === "available");
setPlan(String(data?.plan || ""));

/*
 * Deliberately not awaited into the access check above. The form is usable
 * the moment access is known; the reminder arrives when it arrives, and a
 * failure leaves it absent rather than breaking anything.
 */
if (hasSub) {
  getLoyaltyStatus(addressId)
    .then((status) => setLoyalty(status?.eligible ? status : null))
    .catch(() => setLoyalty(null));
} else {
  setLoyalty(null);
}

// A non-member with an unclaimed introductory visit can book. Only warn when
// there is neither a membership nor an available first visit.
if (!hasSub && !freeVisit) {
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
      setIntroVisitConsumed(false);
      setOutOfServiceArea(false);
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

  /*
   * A selection is only a selection while availability still offers it. When
   * a refresh (a month reload, or the refetch after a SLOT_UNAVAILABLE refusal)
   * says the chosen time is gone, the time is cleared rather than left looking
   * chosen on a slot that can no longer be booked.
   */
  useEffect(() => {
    if (!selectedDate || !selectedTime) return;
    const day = dayAvailabilityMap[formatDateYMD(selectedDate)];
    if (!day) return;
    if (!getBookableSlots(day).some((slot) => slot.time === selectedTime)) {
      setSelectedTime("");
    }
  }, [dayAvailabilityMap, selectedDate, selectedTime]);

  const handleDayClick = async (dayDate: Date, muted: boolean) => {
    if (muted) return;

    const d = new Date(dayDate);
    d.setHours(0, 0, 0, 0);

    if (isDayDisabled(d)) return;
    clearFieldError("date");

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
    if (compressed.length > 0) clearFieldError("photos");
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
      clearFieldError("note");
    }
    clearFieldError("date");
    clearFieldError("time");
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
      /*
       * An inline prompt with links that carry ?next=, not an alert and a bare
       * /signin: the customer signs in and lands back on this booking.
       */
      setSignInNext(`${window.location.pathname}${window.location.search}`);
      return;
    }

    const addressId = selectedAddressId || defaultAddressId;
    const nextFieldErrors: BookingFieldErrors = {};
    if (!addressId) nextFieldErrors.address = "Choose or add a service address.";
    if (!selectedDate) nextFieldErrors.date = "Choose a date.";
    if (!selectedTime) nextFieldErrors.time = "Choose a time.";
    if (note.trim().split(/\s+/).filter(Boolean).length < 3) {
      nextFieldErrors.note = "Tell us what you need help with.";
    }
    // A photo, or the closest Profixter Library example, is required for every
    // booking, including First Visit Free. Technicians review job photos before
    // the visit so they arrive with the right tools and materials; the example
    // lets someone without a photo to hand still book (real photos can follow).
    if (uploadedPhotos.length === 0 && !libraryReference) {
      nextFieldErrors.photos = "Add a photo, or choose the closest example from the Profixter Library.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("");
      const firstMissing = (["address", "date", "time", "note", "photos"] as const).find(
        (field) => nextFieldErrors[field]
      );
      window.requestAnimationFrame(() => {
        const target = firstMissing === "address"
          ? addressFieldRef.current
          : firstMissing === "date"
            ? calendarFieldRef.current
            : firstMissing === "time"
              ? timeFieldRef.current
              : firstMissing === "note"
                ? noteFieldRef.current
                : photosFieldRef.current;
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setFieldErrors({});
    if (!addressId || !selectedDate || !selectedTime) return;

    if (!hasSubscription && !freeFirstVisitAvailable) {
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
    if (!(await ensureContact())) return;
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const bookingDate = new Date(selectedDate);
      bookingDate.setHours(hours, minutes, 0, 0);

      const serviceLabel = SERVICES.find((x) => x.key === service)?.label || "";



      const bookingResult = await createBooking({
        service: serviceLabel,
        date: bookingDate.toISOString(),
        note: note.trim(),
        addressId,
        images: uploadedPhotos,
        libraryReference: libraryReference || undefined,
        requestedDate: formatDateYMD(selectedDate),
        requestedTime: selectedTime,
      });

      /* Only now, with the booking accepted: the box is never a condition of it. */
      await applyServiceTextsOptIn();

      const bookedAddress = addresses.find((address) => address._id === addressId);
      const confirmedDateValue = bookingResult.booking.date || formatDateYMD(selectedDate);
      const confirmedTimeValue = bookingResult.booking.time || selectedTime;
      const confirmedDateOnly = dateFromYMDLocal(confirmedDateValue.slice(0, 10));
      trackEvent(
        freeFirstVisitAvailable ? "free_visit_booked" : "member_visit_booked",
        { bookingReference: String(bookingResult.booking.bookingNumber || "") }
      );

      /*
       * Schedule - the free first visit has been booked.
       *
       * Not a Lead: the Lead was this customer's account being created, and a
       * second one for the same person doubled every cold booker.
       *
       * Fired here, after createBooking has resolved, so it describes a booking
       * the server actually accepted rather than a tap on a button. A slot that
       * was taken a second earlier throws and this line is never reached.
       *
       * Only for the FREE FIRST visit. A member booking another visit is not a
       * new customer, and counting it would teach the ad account to optimise
       * for people who are already paying us.
       *
       * The relay is left on, unlike the signup and checkout events: there is
       * no server-side hook that knows a free visit was booked, so this is the
       * only path to the Conversions API for it. The relay reads the customer's
       * identity from their session rather than from anything sent here.
       */
      if (freeFirstVisitAvailable) {
        trackSchedule({
          content_name: "free_first_visit",
          status: "free_visit_booked",
          booking_reference: String(bookingResult.booking.bookingNumber || ""),
        });
      }

      setBookingConfirmation({
        dateLabel: `${confirmedDateOnly.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })} at ${formatTime12(confirmedTimeValue)}`,
        address: [bookedAddress?.line1, bookedAddress?.city, bookedAddress?.state, bookedAddress?.zip]
          .filter(Boolean)
          .join(", "),
        bookingReference: bookingResult.booking.bookingNumber,
        status: "pending",
        isFreeVisit: freeFirstVisitAvailable,
      });

      setHasActiveBooking(activeBookingCount + 1 >= activeBookingLimit);
      setActiveBookingCount((c) => c + 1);
      setExistingBookingDate(bookingDate);

      setService(memberService);
      setSelectedDate(null);
      setSelectedTime("");
      setNote("");
      setUploadedPhotos([]);
      setLibraryReference("");

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

  const ymdSelected = selectedDate ? formatDateYMD(selectedDate) : "";
  const selectedAvailability = ymdSelected ? dayAvailabilityMap[ymdSelected] : null;
  const selectedDateIsBookable =
    Boolean(selectedDate) && !isDayDisabled(selectedDate as Date) && isAvailabilityOpen(selectedAvailability);
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
  const bookingActionDisabled =
    loading ||
    checkingAccess ||
    calendarMode === "initializing" ||
    showAvailabilityLoadError ||
    (!hasSubscription && !freeFirstVisitAvailable) ||
    hasActiveBooking;

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

      const firstAvailable = firstBookableDateInMonth(
        candidateMonth,
        monthAvailability.data,
        new Date(),
        memberEarliestBookableDate
      );
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
    const selectedDay = dayAvailabilityMap[ymdSelected];

    /*
     * Every time the day's schedule offers, booked ones included, so a booked
     * 8:00 stays on screen as unavailable instead of vanishing. Whether a time
     * can be picked still comes only from `displayedTimes`, the bookable set.
     * An older API without the full list falls back to the previous behaviour.
     */
    const times = selectedDay?.hasCandidateSlots
      ? selectedDay.slots.map((slot) => slot.time)
      : config.engine === "reservation"
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
      className="relative w-full scroll-mt-[96px] pb-6 pt-4 sm:pb-10 sm:pt-6"
    >
      <div className="ui-container relative">

        {/* ── Header ── */}
        <div className="flex items-end justify-between gap-3">
          {/* For a member this is the heading above the form they came for,
              and at 16px it was the same size as the body copy under it. */}
          {/* The page's one H1 on the member tab. */}
          <h1 className="pg-book__title">Book Your Visit</h1>
          {isAuthenticated && hasSubscription && (
            /*
             * On Book, the visit list is now directly below this form, so
             * routing away would send the member to content they can already
             * see. It scrolls instead. Anywhere else it still navigates.
             */
            <a
              href={onBookPage ? "#your-visits" : manageBookingsPath}
              onClick={(event) => {
                if (!onBookPage) return;
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                document
                  .getElementById("your-visits")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex min-h-11 flex-shrink-0 items-center text-[14px] font-semibold text-[color:var(--ui-accent-ink)]"
            >
              Manage visits
            </a>
          )}
        </div>

        <p className="pg-book__sub mb-4 !mt-1">
          Choose a date and time, describe the task, and add at least one photo.
        </p>

        {/*
          A one-line reminder of what staying is earning them, above the form
          and never in front of it.

          Tied to the address they are actually booking against, so a customer
          with two properties sees the right one — and it renders nothing at all
          for a non-member, an annual member, or while the lookup is in flight.
          Booking must not wait for this.
        */}
        {loyalty ? (
          <div className="mb-4">
            <LoyaltyBenefitsPanel status={loyalty} variant="compact" />
          </div>
        ) : null}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-6">

          {/* ── Calendar (left) ── */}
          <div className="order-2 lg:order-1 lg:col-span-5">

            {/* Calendar card */}
            <div
              ref={calendarFieldRef}
              role="group"
              tabIndex={-1}
              aria-labelledby="booking-date-label"
              aria-describedby={fieldErrors.date ? "booking-date-error" : undefined}
              className={`pg-panel outline-none ${fieldErrors.date ? "!border-red-300" : ""}`}
            >
              {/* Month navigation */}
              <div className="pg-cal__head">
                <button
                  aria-label="Prev month"
                  disabled={calendarMode === "initializing"}
                  onClick={() => navigateCalendarMonth(-1)}
                  className="pg-cal__nav [&_svg]:h-4 [&_svg]:w-4"
                >
                  <ChevronLeft />
                </button>

                <div className="text-center">
                  <div id="booking-date-label" className="text-[12px] font-medium text-[color:var(--ui-text-3)]">
                    Date<RequiredAsterisk />
                  </div>
                  <div className="pg-cal__month">
                    {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </div>
                </div>

                <button
                  aria-label="Next month"
                  disabled={calendarMode === "initializing"}
                  onClick={() => navigateCalendarMonth(1)}
                  className="pg-cal__nav [&_svg]:h-4 [&_svg]:w-4"
                >
                  <ChevronRight />
                </button>
              </div>
              {fieldErrors.date ? (
                <p id="booking-date-error" role="alert" className="mt-1 px-1 text-[13px] font-medium text-red-700">
                  {fieldErrors.date}
                </p>
              ) : null}

              {loadingMonthKey === visibleMonthKey && (
                <div className="mb-3 text-[13px] text-[color:var(--ui-text-3)]">
                  Checking availability...
                </div>
              )}

              {showAvailabilityLoadError && (
                <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-3 text-center">
                  <div className="text-[13px] font-semibold text-red-700">
                    Unable to load appointment availability.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAvailabilityError("");
                      setAvailabilityRetryToken((value) => value + 1);
                    }}
                    className="mt-2 rounded-[6px] border border-red-300 px-3 py-2 text-[12px] font-bold text-red-700 transition hover:bg-red-100"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Week headers */}
              <div className="pg-cal__wd" aria-hidden="true">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={`${d}-${i}`}>{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="pg-cal__grid">
                {days.map((day, i) => {
                  const disabled =
                    day.muted ||
                    loadingMonthKey === visibleMonthKey ||
                    isDayDisabled(new Date(day.date));
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
                        "pg-cal__day",
                        day.muted ? "is-muted cursor-not-allowed" : "",
                        disabled && !day.muted ? "cursor-not-allowed" : "",
                        isSelected ? "is-selected" : !disabled ? "is-open" : "",
                        isToday && !disabled && !isSelected ? "ring-1 ring-inset ring-[color:var(--ui-accent)]/40" : "",
                      ].join(" ")}
                    >
                      <span className={isCheckingDay ? "opacity-40" : ""}>{day.date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              {showNoAvailabilityThisMonth && (
                <div className="mt-4 rounded-[var(--ui-r-sm)] bg-[color:var(--ui-bg-soft)] px-3 py-3 text-center">
                  <div className="text-[14px] text-[color:var(--ui-text-2)]">
                    No available appointments in this month.
                  </div>
                  <button
                    type="button"
                    onClick={moveToNextAvailableMonth}
                    className="ui-btn ui-btn--secondary ui-btn--sm mt-2"
                  >
                    Next available month
                  </button>
                </div>
              )}
            </div>

            {/* Selected date label */}
            {selectedDate && (
              <div className="mt-2 flex items-center gap-1.5 px-1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-[color:var(--ui-text-3)]" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="text-[14px] font-medium text-[color:var(--ui-ink)]">{selectedDateLabel}</span>
              </div>
            )}

          </div>

          {/* ── Right column ── */}
          <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-4">

            <div
              ref={addressFieldRef}
              role="group"
              tabIndex={-1}
              aria-describedby={fieldErrors.address ? "booking-address-error" : undefined}
              className={`pg-panel order-1 !py-2 outline-none lg:order-none ${fieldErrors.address ? "!border-red-300" : ""}`}
            >
              {selectedAddressLabel ? (
                <>
                  <div className="flex min-h-11 items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-[color:var(--ui-text-3)]" aria-hidden="true">
                      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    <span className="sr-only">Address<RequiredAsterisk /></span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--ui-ink)]" title={selectedAddressLabel}>
                      {selectedAddressLabel}
                    </span>
                    {addresses.length >= 2 && (
                      <button type="button" onClick={() => setShowAddressPicker((open) => !open)} className="h-11 flex-shrink-0 px-1 text-[14px] font-semibold text-[color:var(--ui-accent-ink)]">
                        {showAddressPicker ? "Done" : "Change"}
                      </button>
                    )}
                  </div>
                  {showAddressPicker && addresses.length >= 2 && (
                    <select
                      autoFocus
                      aria-label="Booking address"
                      value={selectedAddressId ?? defaultAddressId ?? ""}
                      onChange={(event) => {
                        setSelectedAddressId(event.target.value);
                        clearFieldError("address");
                      }}
                      aria-required="true"
                      className="pg-input mb-2 mt-1"
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
                <div className="rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-800">
                  Add a service address in your account before booking.
                </div>
              )}
              {fieldErrors.address ? (
                <p id="booking-address-error" role="alert" className="mt-1 text-[13px] font-medium text-red-700">
                  {fieldErrors.address}
                </p>
              ) : null}
            </div>

            {/* Time slot card */}
            <div
              ref={timeFieldRef}
              role="group"
              tabIndex={-1}
              aria-labelledby="booking-time-label"
              aria-describedby={fieldErrors.time ? "booking-time-error" : undefined}
              className={`pg-panel order-3 outline-none lg:order-none ${fieldErrors.time ? "!border-red-300" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="booking-time-label" className="pg-panel__title !mb-0">Time<RequiredAsterisk /></h3>
                <button
                  type="button"
                  onClick={() => setQuickBookOpen(true)}
                  disabled={checkingAccess || loadingMonthKey === visibleMonthKey}
                  className="ui-btn ui-btn--secondary ui-btn--sm shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Quick Book
                </button>
              </div>

              {selectedDate && config ? (
                loadingSelectedDate && displayedTimes.length === 0 ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="h-12 animate-pulse rounded-[var(--ui-r-sm)] bg-[color:var(--ui-bg-soft)]" />
                    ))}
                  </div>
                ) : slotOptions.length > 0 ? (
                  <TimeSlotGrid
                    slotOptions={slotOptions}
                    selectedTime={selectedTime}
                    onSelect={(t) => {
                      setSelectedTime(t);
                      clearFieldError("time");
                    }}
                  />
                ) : (
                  <div className="rounded-[6px] border border-[#E5E9F2] bg-[#F8FAFF] px-2 py-2 text-center text-[11px] text-[#64748B] sm:rounded-[8px] sm:px-3 sm:py-3 sm:text-[13px]">
                    No times available for this date. Try a different day.
                  </div>
                )
              ) : (
                <div className="rounded-[6px] border border-[#E5E9F2] bg-[#F8FAFF] px-2 py-2 text-center text-[11px] text-[#64748B] sm:rounded-[8px] sm:px-3 sm:py-3 sm:text-[13px]">
                  Select a date on the calendar to see available times.
                </div>
              )}

              {loadingSelectedDate && displayedTimes.length > 0 && (
                <div className="mt-2 text-[13px] text-[color:var(--ui-text-3)]">Updating times...</div>
              )}
              {fieldErrors.time ? (
                <p id="booking-time-error" role="alert" className="mt-2 text-[13px] font-medium text-red-700">
                  {fieldErrors.time}
                </p>
              ) : null}

            </div>

            {/* Task details card */}
            <div className="pg-panel order-4 lg:order-none">
              <h3 className="pg-panel__title">Task details<RequiredAsterisk /></h3>

              <textarea
                ref={noteFieldRef}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (e.target.value.trim().split(/\s+/).filter(Boolean).length >= 3) clearFieldError("note");
                }}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.note)}
                aria-describedby={fieldErrors.note ? "booking-note-error" : undefined}
                placeholder="Describe your task. If we need to bring any materials or special tools, please let us know."
                rows={3}
                className={`pg-input min-h-[96px] max-h-[200px] resize-y ${fieldErrors.note ? "!border-red-300" : ""}`}
              />
              {fieldErrors.note ? (
                <p id="booking-note-error" role="alert" className="mt-1 text-[13px] font-medium text-red-700">
                  {fieldErrors.note}
                </p>
              ) : null}
              {/* Photo upload */}
              <div
                ref={photosFieldRef}
                role="group"
                tabIndex={-1}
                aria-describedby={fieldErrors.photos ? "booking-photos-error" : undefined}
                className="mt-4 outline-none"
              >
                <div className="pg-label !mb-0.5">
                  Photos<RequiredAsterisk />
                </div>
                <p className="pg-hint">
                  A photo of the actual issue helps your Fixter arrive prepared.
                </p>
                {fieldErrors.photos ? (
                  <p id="booking-photos-error" role="alert" className="mb-2 text-[13px] font-medium text-red-700">
                    {fieldErrors.photos}
                  </p>
                ) : null}
                <div className="pg-photo-row">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#C5CBD8] bg-[#F8FAFF] px-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] active:scale-[0.99] sm:h-12 sm:gap-1.5 sm:text-[13px]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#C5CBD8] bg-[#F8FAFF] px-2 text-[12px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] active:scale-[0.99] sm:h-12 sm:gap-1.5 sm:text-[13px]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Choose Photos{uploadedPhotos.length > 0 ? ` (${uploadedPhotos.length})` : ""}
                  </button>
                </div>
                <PhotoLibraryPicker
                  value={libraryReference}
                  context={freeFirstVisitAvailable ? "free_visit" : "member"}
                  onChange={(key) => {
                    setLibraryReference(key);
                    if (key) clearFieldError("photos");
                  }}
                />

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  aria-required="true"
                  aria-describedby={fieldErrors.photos ? "booking-photos-error" : undefined}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  aria-required="true"
                  aria-describedby={fieldErrors.photos ? "booking-photos-error" : undefined}
                  className="hidden"
                />

                {/* Photo previews */}
                {uploadedPhotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {uploadedPhotos.map((_file, idx) => {
                      const url = photoUrls[idx];
                      return (
                        <div
                          key={idx}
                          className="relative overflow-hidden rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-sunk)]"
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
                            className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-[16px] font-bold leading-none text-white transition hover:bg-black/80 active:scale-95"
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

            {/* First Visit Free, eligible non-members only. Members never see this. */}
            {isAuthenticated && !checkingAccess && !hasSubscription && freeFirstVisitAvailable && (
              <div className="pg-panel order-5 lg:order-none">
                <div className="ui-eyebrow ui-eyebrow--accent !mb-1">
                  First Visit Free
                </div>
                <div className="text-[16px] font-semibold leading-tight text-[color:var(--ui-ink)]">
                  Your first 90-minute handyman visit is on us.
                </div>
                <div className="mt-1 text-[14px] leading-[1.5] text-[color:var(--ui-text-2)]">
                  $0 due for your first eligible visit. No membership required, and no credit card needed to book.
                </div>
                <div className="mt-1.5 text-[13px] leading-[1.45] text-[color:var(--ui-text-3)]">
                  One free visit per customer. Standard handyman labor, up to 90 minutes. Materials not included. Subject to availability.
                </div>
              </div>
            )}

            {/* Property outside the service area: friendly, not an error. */}
            {isAuthenticated && !checkingAccess && !hasSubscription && outOfServiceArea && (
              <div className="pg-panel order-5 lg:order-none">
                <div className="text-[16px] font-semibold leading-tight text-[color:var(--ui-ink)]">
                  We don&rsquo;t reach this address yet
                </div>
                <div className="mt-1 text-[14px] leading-[1.5] text-[color:var(--ui-text-2)]">
                  We currently offer First Visit Free for homes in Nassau and Suffolk Counties.
                  If you have another property on Long Island, add it to your account and
                  we&rsquo;ll take it from there.
                </div>
              </div>
            )}

            {/* Free visit completed: natural next step into the existing membership funnel. */}
            {isAuthenticated && !checkingAccess && !hasSubscription && introVisitConsumed && (
              <div className="pg-panel order-5 lg:order-none">
                <div className="text-[16px] font-semibold leading-tight text-[color:var(--ui-ink)]">
                  Your first visit is complete.
                </div>
                <div className="mt-1 text-[15px] font-medium text-[color:var(--ui-ink)]">
                  Keep ProFixter for your home.
                </div>
                <div className="mt-1 text-[14px] leading-[1.5] text-[color:var(--ui-text-2)]">
                  Membership gives you ongoing access to book ProFixter whenever something around your home needs attention.
                </div>
                <Link
                  href="/membership/plans"
                  onClick={() => trackEvent("membership_plans_viewed_after_free_visit", { placement: "booking_section" })}
                  className="ui-btn ui-btn--primary ui-btn--sm mt-3"
                >
                  View Membership Plans
                </Link>
                <div className="mt-2 text-[13px] leading-[1.45] text-[color:var(--ui-text-3)]">
                  Prefer a single visit? A one-time handyman visit is also available.
                </div>
              </div>
            )}

            {/* Subscription warning */}
            {isAuthenticated && !checkingAccess && !hasSubscription && !freeFirstVisitAvailable && !introVisitConsumed && subscriptionError && (
              <div className="order-5 rounded-[var(--ui-r-md)] border border-red-200 bg-red-50 p-4 lg:order-none">
                <div className="mb-1 text-[15px] font-semibold text-red-800">Booking unavailable for this address</div>
                <div className="mb-3 text-[14px] text-red-700">{subscriptionError}</div>
                <a
                  href="/account"
                  className="ui-btn ui-btn--primary ui-btn--sm"
                >
                  Open account
                </a>
              </div>
            )}

            {/* Booking limit warning */}
            {isAuthenticated && hasSubscription && hasActiveBooking && (
              <div className="order-5 rounded-[var(--ui-r-md)] border border-amber-200 bg-amber-50 p-4 lg:order-none">
                {/*
                  The one place a customer meets the concurrency rule as an
                  obstacle, and it used to read "Visit limit reached" — which
                  sounds like a monthly allowance running out and like being
                  punished for using the product. Neither is true. It is a queue,
                  not a cap, so it now says what is actually the case and what
                  happens next.
                */}
                <div className="mb-1 text-[15px] font-semibold text-amber-900">
                  {activeBookingLimit === 1 ? "Your next visit is booked" : "Your visits are booked"}
                </div>
                <div className="mb-2 text-[14px] text-amber-800">
                  You can have{" "}
                  <span className="font-semibold">{activeBookingLimit}</span>{" "}
                  {activeBookingLimit === 1 ? "visit" : "visits"} booked at a time on this plan.
                  Once {activeBookingLimit === 1 ? "it's" : "one is"} done, you can book the next.
                </div>
                {existingBookingDate && (
                  <div className="mb-3 text-[14px] text-amber-800">
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
                  className="ui-btn ui-btn--primary ui-btn--sm"
                >
                  Reschedule visit
                </button>
              </div>
            )}

            {/* Notice / Error banners */}
            {notice && (
              <div className="order-6 rounded-[var(--ui-r-sm)] border border-green-200 bg-green-50 px-4 py-3 text-[14px] font-medium text-green-800 lg:order-none">
                {notice}
              </div>
            )}
            {error && (
              <div className="pg-error order-6 lg:order-none">
                {error}
              </div>
            )}

            {/* Confirm card */}
            <div className="order-7 lg:order-none">
              {signInNext && !isAuthenticated ? (
                <div className="pg-panel mb-3" role="status" data-booking-signin-prompt>
                  <p className="text-[15px] font-semibold text-[color:var(--ui-ink)]">Sign in to book this visit.</p>
                  <p className="mt-0.5 text-[14px] text-[color:var(--ui-text-2)]">You will come straight back here.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Link href={`/signin?next=${encodeURIComponent(signInNext)}`} className="ui-btn ui-btn--primary ui-btn--sm">
                      Sign in
                    </Link>
                    <Link href={`/signup?next=${encodeURIComponent(signInNext)}`} className="ui-btn ui-btn--secondary ui-btn--sm">
                      Create account
                    </Link>
                  </div>
                </div>
              ) : null}
              {serviceTextsOptIn ? <div className="mb-2.5">{serviceTextsOptIn}</div> : null}
              <button
                onClick={handleBookNow}
                data-track="booking-cta"
                disabled={bookingActionDisabled}
                className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
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
              <p className="mt-2 text-center text-[13px] text-[color:var(--ui-text-3)]">
                <span className="text-red-500" aria-hidden="true">*</span> Required to book your visit
              </p>
            </div>
          </div>
        </div>

        {/*
          How booking works and the plan rules, one tap away under the form
          instead of two always-open blocks: the member came to book.
        */}
        <details className="pg-more mt-4 sm:mt-6">
          <summary>How booking works</summary>
          <div className="pg-more__body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="font-semibold text-[color:var(--ui-ink)]">Booking a visit</h3>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Choose a date and time.</li>
                <li>Describe the task.</li>
                <li>Add photos so we bring the right tools and materials.</li>
                <li>Submit. We&rsquo;ll review it and notify you when it is confirmed.</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-[color:var(--ui-ink)]">Active visit limits</h3>
              <p>Basic: 1 active visit at a time. Plus, Premium, and Elite: up to 2 active visits at a time.</p>
              <p className="mt-1">These are simultaneous appointments, not total visits. Once one is completed or canceled, you can book another.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[color:var(--ui-ink)]">Visit details</h3>
              <p>Standard visits are 90 minutes.</p>
              <p className="mt-1">Need same-day or emergency service? <a href="tel:6315991363" aria-label="Call Profixter at 631-599-1363 for same-day or emergency service" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">631-599-1363</a>. Subject to availability and additional fees.</p>
            </div>
            <div>
              <h3 className="font-semibold text-[color:var(--ui-ink)]">Materials and special tools</h3>
              <p>Already have materials? Please have them ready before your visit.</p>
              <p className="mt-1">Need us to bring materials or special tools? Include that in the task details.</p>
            </div>
          </div>
        </details>

        {/* ── Quick Booking Modal ── */}
        {quickBookOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-0"
            onClick={() => { if (!quickBookingLoading) setQuickBookOpen(false); }}
          >
            <div
              className="max-h-[90vh] w-full max-w-[700px] overflow-y-auto rounded-[var(--ui-r-lg)] bg-white p-5 shadow-[var(--ui-shadow-3)] sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="ui-eyebrow">
                    Quick Booking
                  </div>
                  <h3 className="ui-h3">
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
                    className="group flex items-start gap-3 rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white px-4 py-3.5 text-left transition-colors hover:border-[color:var(--ui-line-2)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-[6px] border border-[#E5E9F2] bg-white flex items-center justify-center text-[#64748B] group-hover:text-[#306EEC] group-hover:border-[#D9E4FF] transition">
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
        <BookingConfirmationDialog
          confirmation={bookingConfirmation}
          onClose={closeBookingConfirmation}
          onViewVisit={viewConfirmedVisit}
        />
        {contactSheet}

      </div>
    </section>
  );
}
