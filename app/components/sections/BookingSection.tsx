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
import { useRouter } from "next/navigation";
import { POPULAR_TASKS } from "./PopularTasksSection";

const SERVICES = [
  { key: "labor_only", label: "Labor Only", minRank: 1 }, // Basic+
  { key: "labor_materials", label: "Labor with Materials Needed", minRank: 2 }, // Plus+
  { key: "get_2_pros", label: "Get 2 Pros", minRank: 3 }, // Premium+
  { key: "general_contractor", label: "General Contractor", minRank: 4 }, // Elite
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];
type DayAvailability = {
  taken: Record<string, number>;
  capacity: number;
  slots: string[];
  remaining?: Record<string, number>;
  availableSlotCount: number;
};

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function dateFromYMD(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
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
            disabled={!slot.available}
            onClick={() => {
              if (!slot.available) return;
              onSelect(slot.time);
            }}
            className={[
              "group relative min-h-[60px] overflow-hidden rounded-[12px] border px-3 py-2.5 text-left transition-all duration-150 ease-out active:scale-[0.99] sm:min-h-[72px] sm:px-3.5 sm:py-3",
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

            <div className="relative z-[1] flex flex-col gap-1">
              <div
                  className={`text-[15px] font-black leading-tight tracking-[-0.01em] sm:text-[16px] ${
                  slot.available ? "" : "line-through"
                } ${isSelected ? "text-[#0B1628]" : ""}`}
              >
                {formatTime12(slot.time)}
              </div>
              {isSelected && (
                <div className="inline-flex items-center gap-1 text-[11px] font-black leading-tight text-[#306EEC]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="flex-shrink-0">
                    <path
                      d="M2.5 6.2L4.8 8.5L9.5 3.7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Selected
                </div>
              )}
            </div>
            <div
              className={`relative z-[1] mt-1 text-[11px] font-semibold ${
                isSelected ? "text-[#306EEC]" : slot.available ? "text-[#64748B]" : "text-[#8C94A3]"
              }`}
            >
              {availabilityLabel}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 sm:mb-4">
      <div className="mb-1.5 inline-flex items-center rounded-full bg-[#EEF5FF] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#306EEC]">
        {step}
      </div>
      <div className="text-[16px] font-extrabold text-[#0B1628]">{title}</div>
      {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-[#64748B]">{subtitle}</div>}
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
  const [loadingSelectedDate, setLoadingSelectedDate] = useState(false);
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookingLoading, setQuickBookingLoading] = useState(false);


  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const dayRequestCacheRef = useRef<Record<string, Promise<DayAvailability | null>>>({});
  const monthRequestCacheRef = useRef<Record<string, Promise<Record<string, DayAvailability>>>>({});
  const loadedMonthsRef = useRef<Record<string, boolean>>({});
  const latestMonthRequestRef = useRef(0);
  const initializationRequestRef = useRef(0);
  const autoSelectedDateRef = useRef(false);
  const dayAvailabilityMapRef = useRef(dayAvailabilityMap);
  dayAvailabilityMapRef.current = dayAvailabilityMap;

  const [service, setService] = useState<ServiceKey | "">("");
  const [note, setNote] = useState<string>("");
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [showServiceMenu, setShowServiceMenu] = useState(false);

  // close service dropdown on outside click
  const serviceWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!serviceWrapRef.current) return;
      if (!serviceWrapRef.current.contains(e.target as Node)) setShowServiceMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookingNumber, setBookingNumber] = useState("");

  // Modal display data
  const [confirmedService, setConfirmedService] = useState("");
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(null);
  const [confirmedTime, setConfirmedTime] = useState("");

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

  const planRank = (p?: string) => {
    const x = String(p || "").toLowerCase();
    // if (x === "free") return 1; // ❌ no free visits anymore
    if (x === "basic") return 1;
    if (x === "plus") return 2;
    if (x === "premium") return 3;
    if (x === "elite") return 4;
    return 0;
  };

  const currentRank = planRank(plan);
  const isServiceAllowed = (minRank: number) => currentRank >= minRank;

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
    loadedMonthsRef.current = {};
    setLoadingMonthKey(null);
    autoSelectedDateRef.current = false;
    setService("");
    setShowServiceMenu(false);
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
      return dayAvailabilityMap[ymd].slots;
    }
    const overrideHours = config.overrides[ymd];
    return overrideHours?.length ? overrideHours : config.defaultHours;
  }, [config, dayAvailabilityMap]);

  const getMonthKey = useCallback((date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, []);

  const toDayAvailability = useCallback((data: {
    taken?: Record<string, number>;
    capacityPerSlot?: number;
    slots?: string[];
    remaining?: Record<string, number>;
    availableSlotCount?: number;
    slotCount?: number;
  }): DayAvailability => {
    const slots = Array.isArray(data.slots) ? data.slots : [];
    const count = Number(data.availableSlotCount ?? data.slotCount ?? slots.length);
    return {
      taken: data.taken || {},
      capacity: data.capacityPerSlot ?? 1,
      slots,
      remaining: data.remaining || {},
      availableSlotCount: Number.isFinite(count) ? count : slots.length,
    };
  }, []);

  const isAvailabilityOpen = useCallback((info?: DayAvailability | null) => {
    return !!info && info.availableSlotCount > 0 && info.slots.length > 0;
  }, []);

  const isDayDisabled = useCallback((date: Date): boolean => {
    if (!config) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const ymd = formatDateYMD(d);
    const info = dayAvailabilityMap[ymd];

    if (d < today) return true;

    return !isAvailabilityOpen(info);
  }, [config, dayAvailabilityMap, isAvailabilityOpen]);

  const isDateSelectable = useCallback((date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return !isDayDisabled(normalized);
  }, [isDayDisabled]);

  const getClosestAvailableDate = useCallback(() => {
    const entries = Object.entries(dayAvailabilityMap)
      .filter(([, info]) => isAvailabilityOpen(info))
      .map(([ymd]) => {
        return dateFromYMD(ymd);
      })
      .filter((date) => isDateSelectable(date))
      .sort((a, b) => a.getTime() - b.getTime());

    return entries[0] || null;
  }, [dayAvailabilityMap, isAvailabilityOpen, isDateSelectable]);

  const fetchDayAvailability = useCallback(async (
    ymd: string
  ): Promise<DayAvailability | null> => {
    if (dayAvailabilityMapRef.current[ymd]) {
      return dayAvailabilityMapRef.current[ymd];
    }

    const existingRequest = dayRequestCacheRef.current[ymd];
    if (existingRequest) return existingRequest;

    const request = getTimeSlots(ymd)
      .then((data) => {
        const nextAvailability = toDayAvailability(data);

        setDayAvailabilityMap((prev) => {
          if (prev[ymd]) return prev;
          const next = { ...prev, [ymd]: nextAvailability };
          dayAvailabilityMapRef.current = next;
          return next;
        });

        return nextAvailability;
      })
      .catch((err) => {
        console.error("Failed to load time slots:", err);
        return null;
      })
      .finally(() => {
        delete dayRequestCacheRef.current[ymd];
      });

    dayRequestCacheRef.current[ymd] = request;
    return request;
  }, [toDayAvailability]);

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

  const monthAvailabilityFromCache = useCallback((monthKey: string) => {
    return Object.fromEntries(
      Object.entries(dayAvailabilityMapRef.current).filter(([ymd]) => ymd.startsWith(monthKey))
    );
  }, []);

  const loadMonthAvailability = useCallback(async (
    monthDate: Date,
    options: { markLoading?: boolean } = {}
  ): Promise<Record<string, DayAvailability>> => {
    if (!config) return {};

    const monthKey = getMonthKey(monthDate);
    if (loadedMonthsRef.current[monthKey]) {
      return monthAvailabilityFromCache(monthKey);
    }

    const existingRequest = monthRequestCacheRef.current[monthKey];
    if (existingRequest) {
      if (options.markLoading === false) return existingRequest;

      const loadingRequestId = ++latestMonthRequestRef.current;
      setLoadingMonthKey(monthKey);
      return existingRequest.finally(() => {
        if (latestMonthRequestRef.current === loadingRequestId) {
          setLoadingMonthKey((current) => (current === monthKey ? null : current));
        }
      });
    }

    const shouldMarkLoading = options.markLoading !== false;
    const loadingRequestId = shouldMarkLoading ? ++latestMonthRequestRef.current : 0;
    if (shouldMarkLoading) setLoadingMonthKey(monthKey);

    const request = (async () => {
      const monthDays: Record<string, DayAvailability> = {};

      try {
        if (config.engine === "reservation") {
          const monthData = await getMonthAvailability(monthKey);
          for (const day of monthData.days) {
            monthDays[day.date] = toDayAvailability(day);
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
            datesToFetch.map(async (ymd) => [ymd, await fetchDayAvailability(ymd)] as const)
          );
          for (const [ymd, detail] of dayResults) {
            if (detail) monthDays[ymd] = detail;
          }
        }

        loadedMonthsRef.current[monthKey] = true;
        setDayAvailabilityMap((prev) => {
          const next = { ...prev, ...monthDays };
          dayAvailabilityMapRef.current = next;
          return next;
        });
        return monthDays;
      } catch (error) {
        console.error("Failed to load month availability:", error);
        return monthAvailabilityFromCache(monthKey);
      } finally {
        delete monthRequestCacheRef.current[monthKey];
        if (shouldMarkLoading && latestMonthRequestRef.current === loadingRequestId) {
          setLoadingMonthKey((current) => (current === monthKey ? null : current));
        }
      }
    })();

    monthRequestCacheRef.current[monthKey] = request;
    return request;
  }, [config, fetchDayAvailability, getMonthKey, monthAvailabilityFromCache, toDayAvailability]);

  const firstAvailableDateInMonth = useCallback((
    monthDate: Date,
    monthAvailability: Record<string, DayAvailability>
  ) => {
    const monthKey = getMonthKey(monthDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Object.entries(monthAvailability)
      .filter(([ymd, info]) => ymd.startsWith(monthKey) && isAvailabilityOpen(info))
      .map(([ymd]) => dateFromYMD(ymd))
      .filter((date) => date >= today)
      .sort((a, b) => a.getTime() - b.getTime())[0] || null;
  }, [getMonthKey, isAvailabilityOpen]);

  useEffect(() => {
    if (!config) return;
    void loadMonthAvailability(currentMonth, { markLoading: true });
  }, [config, currentMonth, loadMonthAvailability]);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    const requestId = ++initializationRequestRef.current;

    const initialize = async () => {
      const startMonth = monthStart(new Date());
      const maxAdvanceDays = Number(config.maxAdvanceDays ?? 90);
      const maxMonths = Math.max(1, Math.ceil(maxAdvanceDays / 31) + 1);

      for (let offset = 0; offset <= maxMonths; offset += 1) {
        const candidateMonth = addMonths(startMonth, offset);
        const monthAvailability = await loadMonthAvailability(candidateMonth, {
          markLoading: offset === 0,
        });
        if (cancelled || initializationRequestRef.current !== requestId) return;

        const firstAvailable = firstAvailableDateInMonth(candidateMonth, monthAvailability);
        if (firstAvailable) {
          const ymd = formatDateYMD(firstAvailable);
          const availability = monthAvailability[ymd] || dayAvailabilityMapRef.current[ymd];
          autoSelectedDateRef.current = true;
          setCurrentMonth(monthStart(firstAvailable));
          setSelectedDate(firstAvailable);
          setSelectedTime("");
          setDisplayedTimes(availability?.slots || []);
          return;
        }
      }

      if (!cancelled && initializationRequestRef.current === requestId) {
        setSelectedDate(null);
        setSelectedTime("");
        setDisplayedTimes([]);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [config, firstAvailableDateInMonth, loadMonthAvailability, selectedAddressId]);



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
      setDisplayedTimes(cached.slots);
      setLoadingSelectedDate(false);
      return;
    }

    setLoadingSelectedDate(true);

    void fetchDayAvailability(dateStr).then((data) => {
      if (cancelled) return;
      setDisplayedTimes(data?.slots || []);
      setLoadingSelectedDate(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, dayAvailabilityMap, fetchDayAvailability]);

  useEffect(() => {
    if (!selectedDate) return;
    const ymd = formatDateYMD(selectedDate);
    const info = dayAvailabilityMap[ymd];
    if (!info || isAvailabilityOpen(info)) return;

    const closest = getClosestAvailableDate();
    if (closest) {
      const closestKey = formatDateYMD(closest);
      const availability = dayAvailabilityMapRef.current[closestKey];
      setCurrentMonth(monthStart(closest));
      setSelectedDate(closest);
      setSelectedTime("");
      setDisplayedTimes(availability?.slots || []);
      return;
    }

    setSelectedDate(null);
    setSelectedTime("");
    setDisplayedTimes([]);
  }, [dayAvailabilityMap, getClosestAvailableDate, isAvailabilityOpen, selectedDate]);

  const handleDayClick = async (dayDate: Date, muted: boolean) => {
    if (muted) return;

    const d = new Date(dayDate);
    d.setHours(0, 0, 0, 0);

    if (isDayDisabled(d)) return;

    const ymd = formatDateYMD(d);
    const cached = dayAvailabilityMap[ymd];

    if (cached) {
      if (cached.slots.length === 0) return;
      setSelectedDate(d);
      setSelectedTime("");
      setDisplayedTimes(cached.slots);
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

    if (data.slots.length === 0) {
      setLoadingSelectedDate(false);
      setSelectedDate((current) => (current && sameDay(current, d) ? null : current));
      return;
    }

    setDisplayedTimes(data.slots);
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
    const firstAvailableSlot = availability?.slots?.[0] || "";
    if (!firstAvailableSlot) return null;

    setCurrentMonth(new Date(closest.getFullYear(), closest.getMonth(), 1));
    setSelectedDate(closest);
    setSelectedTime(firstAvailableSlot);
    setDisplayedTimes(availability.slots);
    autoSelectedDateRef.current = true;

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
    setService("labor_only");
    setShowServiceMenu(false);

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



      const result = await createBooking({
        service: serviceLabel,
        date: bookingDate.toISOString(),
        note: note.trim(),
        addressId,
        images: uploadedPhotos,
        requestedDate: formatDateYMD(selectedDate),
        requestedTime: selectedTime,
      });

      setBookingNumber(result.booking.bookingNumber);
      setConfirmedService(serviceLabel);
      setConfirmedDate(new Date(selectedDate));
      setConfirmedTime(selectedTime);

      setHasActiveBooking(activeBookingCount + 1 >= activeBookingLimit);
      setActiveBookingCount((c) => c + 1);
      setExistingBookingDate(bookingDate);

      setService("");
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

const canBook =
  !loading &&
  !checkingAccess &&
  (hasSubscription || !isAuthenticated) &&
  !hasActiveBooking;


  const wordsCount = note.trim().split(/\s+/).filter(Boolean).length;

  const ymdSelected = selectedDate ? formatDateYMD(selectedDate) : "";
  const selectedAddress = addresses.find(
    (address) => String(address._id) === String(selectedAddressId ?? defaultAddressId ?? "")
  );
  const selectedAddressLabel = selectedAddress
    ? `${selectedAddress.label ? `${selectedAddress.label}: ` : ""}${selectedAddress.line1}, ${selectedAddress.city} ${selectedAddress.state} ${selectedAddress.zip}`
    : "";
  const visibleMonthKey = getMonthKey(currentMonth);
  const visibleMonthLoaded = !!loadedMonthsRef.current[visibleMonthKey] && loadingMonthKey !== visibleMonthKey;
  const visibleMonthHasAvailability = Object.entries(dayAvailabilityMap).some(
    ([ymd, info]) => ymd.startsWith(visibleMonthKey) && isAvailabilityOpen(info)
  );
  const showNoAvailabilityThisMonth = visibleMonthLoaded && !visibleMonthHasAvailability;

  const moveToNextAvailableMonth = async () => {
    if (!config) return;
    const maxAdvanceDays = Number(config.maxAdvanceDays ?? 90);
    const maxMonths = Math.max(1, Math.ceil(maxAdvanceDays / 31) + 1);

    for (let offset = 1; offset <= maxMonths; offset += 1) {
      const candidateMonth = addMonths(currentMonth, offset);
      const monthAvailability = await loadMonthAvailability(candidateMonth, { markLoading: true });
      const firstAvailable = firstAvailableDateInMonth(candidateMonth, monthAvailability);
      if (firstAvailable) {
        const ymd = formatDateYMD(firstAvailable);
        const availability = monthAvailability[ymd] || dayAvailabilityMapRef.current[ymd];
        setCurrentMonth(monthStart(firstAvailable));
        setSelectedDate(firstAvailable);
        setSelectedTime("");
        setDisplayedTimes(availability?.slots || []);
        return;
      }
    }

    setError("No available appointments were found in the next available booking window.");
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
      className="relative w-full overflow-hidden bg-[#F6F8FC] pb-6 pt-6 scroll-mt-[96px] sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20"
    >
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-5 max-w-[720px] sm:mb-8">
          <div className="mb-3 inline-flex items-center gap-2.5 rounded-[8px] border border-[#D9E4FF] bg-white px-3 py-2">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-[#306EEC]"
              style={{ boxShadow: "0 0 8px rgba(48,110,236,0.7)" }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Member booking
            </span>
          </div>

          <h2 className="mb-2 text-[26px] font-black leading-[1.06] text-[#0B1628] sm:text-[40px] sm:leading-[1.02] lg:text-[48px]">
            Book Your Next Visit
          </h2>

          <p className="mb-1.5 max-w-[520px] text-[14px] leading-relaxed text-[#475569] sm:text-[16px]">
            Choose a time, tell us what you need, and we&rsquo;ll handle the rest.
          </p>

          <p className="max-w-[560px] text-[12px] leading-relaxed text-[#64748B] sm:text-[13px]">
            Your visit includes up to 90 minutes of handyman labor. Add notes and photos so our team can come prepared.
          </p>
        </div>


        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-6">

          {/* ── Calendar (left) ── */}
          <div className="order-2 lg:order-1 lg:col-span-5">

            {/* Calendar card */}
            <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-3.5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-5">
                <button
                  aria-label="Prev month"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="w-10 h-10 rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] grid place-items-center text-[#475569] hover:bg-[#EEF5FF] hover:border-[#D9E4FF] transition active:scale-95"
                >
                  <ChevronLeft />
                </button>

                <div className="text-[16px] font-extrabold text-[#0B1628] sm:text-[20px]">
                  {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>

                <button
                  aria-label="Next month"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="w-10 h-10 rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] grid place-items-center text-[#475569] hover:bg-[#EEF5FF] hover:border-[#D9E4FF] transition active:scale-95"
                >
                  <ChevronRight />
                </button>
              </div>

              {loadingMonthKey === visibleMonthKey && (
                <div className="mb-4 rounded-[12px] border border-[#D9E4FF] bg-[#F0F7FF] px-3 py-2 text-[12px] font-semibold text-[#475569]">
                  Checking availability...
                </div>
              )}

              {/* Week headers */}
              <div className="grid grid-cols-7 text-center mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                  <div
                    key={d}
                    className={`text-[12px] font-bold ${i === 0 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-1">
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
                      onClick={() => handleDayClick(day.date, day.muted)}
                      disabled={disabled}
                      className={[
                        "mx-auto w-9 h-9 sm:w-10 sm:h-10 grid place-items-center rounded-[12px] text-[14px] sm:text-[15px] font-semibold transition-all duration-150",
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
              <div className="mt-3 flex items-center gap-2.5 rounded-[14px] border border-[#D9E4FF] bg-white px-4 py-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#306EEC] flex-shrink-0" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="text-[14px] font-semibold text-[#0B1628]">{selectedDateLabel}</span>
              </div>
            )}

            {/* Manage bookings */}
            {isAuthenticated && hasSubscription && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => router.push(manageBookingsPath)}
                  className="inline-flex items-center gap-2 w-full justify-center h-[46px] rounded-[14px] border border-[#C5CBD8] bg-white text-[#475569] text-[14px] font-semibold hover:border-[#306EEC] hover:text-[#306EEC] transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Manage my visits
                </button>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-5">

            <div className="order-1 rounded-[12px] border border-[#D7DEE9] bg-white p-3.5 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
              <StepHeader
                step="1 Details"
                title="Visit details"
                subtitle="Confirm the home and type of help."
              />

              <div className="space-y-4">
                <div>
                  <div className="text-[13px] font-semibold text-[#0B1628] mb-2">Booking address</div>
                  {(addresses?.length || 0) >= 2 ? (
                    <select
                      value={selectedAddressId ?? defaultAddressId ?? ""}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full min-h-[48px] rounded-[12px] border border-[#C5CBD8] bg-[#F8FAFF] px-3 py-2 text-[#0B1628] text-[14px] font-semibold outline-none focus:ring-4 focus:ring-[#306EEC]/15 focus:border-[#306EEC] transition"
                    >
                      {addresses.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.label ? `${a.label}: ` : ""}
                          {a.line1}, {a.city} {a.state} {a.zip}
                        </option>
                      ))}
                    </select>
                  ) : selectedAddressLabel ? (
                    <div className="rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-3 text-[14px] font-semibold text-[#0B1628]">
                      {selectedAddressLabel}
                    </div>
                  ) : (
                    <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                      Add a service address in your account before booking.
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[13px] font-semibold text-[#0B1628] mb-2">Service type</div>
                  <div ref={serviceWrapRef} className="relative">
                    <button
                      type="button"
                      disabled={checkingAccess || !hasSubscription}
                      onClick={() => {
                        if (checkingAccess || !hasSubscription) return;
                        setShowServiceMenu((v) => !v);
                      }}
                      className={[
                        "min-h-[48px] w-full px-4 py-2 rounded-[12px] border text-[14px] font-semibold flex items-center justify-between gap-3 transition",
                        checkingAccess || !hasSubscription
                          ? "border-[#E5E9F2] bg-[#F8FAFF] text-[#94A3B8] cursor-not-allowed"
                          : "border-[#C5CBD8] bg-[#F8FAFF] text-[#0B1628] hover:border-[#306EEC] hover:bg-white",
                      ].join(" ")}
                    >
                      <span className={service ? "text-[#0B1628]" : "text-[#94A3B8]"}>
                        {service ? SERVICES.find((x) => x.key === service)?.label : "Select service type"}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`flex-shrink-0 transition-transform ${showServiceMenu ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    {showServiceMenu && (
                      <div className="absolute top-[54px] left-0 w-full bg-white border border-[#C5CBD8] rounded-[12px] shadow-[0_16px_48px_rgba(15,23,42,0.12)] z-20 overflow-hidden">
                        {SERVICES.map((s) => {
                          const allowed = isServiceAllowed(s.minRank);
                          return (
                            <button
                              key={s.key}
                              type="button"
                              disabled={!allowed}
                              onClick={() => {
                                if (!allowed) return;
                                setService(s.key);
                                setShowServiceMenu(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-[14px] text-left transition border-b border-[#F1F5F9] last:border-0",
                                allowed
                                  ? "text-[#0B1628] font-semibold hover:bg-[#F8FAFF]"
                                  : "text-[#94A3B8] cursor-not-allowed",
                              ].join(" ")}
                            >
                              <span>{s.label}</span>
                              {!allowed && (
                                <span className="text-[11px] bg-[#F1F5F9] px-2 py-0.5 rounded-full text-[#94A3B8] font-normal">
                                  Not available
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {!hasSubscription && isAuthenticated && !checkingAccess && (
                    <div className="mt-2 text-[12px] text-[#64748B]">
                      Booking opens when this address has an active membership.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Time slot card */}
            <div className="order-3 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
              <div className="mb-4 flex items-start justify-between gap-3">
                <StepHeader
                  step="2 Time"
                  title="Choose a time"
                  subtitle="Each visit is up to 90 minutes."
                />
                <button
                  type="button"
                  onClick={() => setQuickBookOpen(true)}
                  disabled={checkingAccess || loadingMonthKey === visibleMonthKey}
                  className="inline-flex h-[38px] flex-shrink-0 items-center gap-2 rounded-[12px] border border-[#306EEC] px-3 text-[12px] font-bold text-[#306EEC] transition hover:bg-[#EEF5FF] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-[13px]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Quick Book
                </button>
              </div>

              {selectedDate && config ? (
                loadingSelectedDate && displayedTimes.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="h-[64px] rounded-[18px] bg-[#F1F5F9] animate-pulse" />
                    ))}
                  </div>
                ) : slotOptions.length > 0 ? (
                  <TimeSlotGrid
                    slotOptions={slotOptions}
                    selectedTime={selectedTime}
                    onSelect={(t) => setSelectedTime(t)}
                  />
                ) : (
                  <div className="rounded-[16px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-5 text-[14px] text-[#64748B] text-center">
                    No times available for this date. Try a different day.
                  </div>
                )
              ) : (
                <div className="rounded-[16px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-5 text-[14px] text-[#64748B] text-center">
                  Select a date on the calendar to see available times.
                </div>
              )}

              {loadingSelectedDate && displayedTimes.length > 0 && (
                <div className="mt-3 text-[12px] text-[#94A3B8]">Updating times...</div>
              )}

            </div>

            {/* Task details card */}
            <div className="order-4 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
              <StepHeader
                step="3 Notes / Photos"
                title="Tell us what you need"
                subtitle="Add a short note and at least one photo."
              />

              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error === "Describe the task in at least a few words.") setError("");
                }}
                placeholder="E.g. leaking faucet, loose door handle, light fixture swap, shelf to hang..."
                className={`w-full min-h-[96px] max-h-[220px] rounded-[16px] border bg-[#F8FAFF] p-3.5 text-[14px] text-[#0B1628] placeholder-[#94A3B8] resize-none transition focus:outline-none focus:ring-4 focus:ring-[#306EEC]/15 focus:border-[#306EEC] sm:min-h-[120px] sm:p-4 sm:text-[15px] ${
                  error === "Describe the task in at least a few words."
                    ? "border-red-300"
                    : "border-[#C5CBD8]"
                }`}
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] text-[#94A3B8]">Minimum 3 words</span>
                <span className={`text-[11px] font-bold ${wordsCount >= 3 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                  {wordsCount} {wordsCount === 1 ? "word" : "words"}
                </span>
              </div>

              {/* Photo upload */}
              <div className="mt-4">
                <div className="text-[13px] font-semibold text-[#0B1628] mb-2">
                  Photos{" "}
                  <span className="text-[#DC2626]">*</span>
                  <span className="ml-1 text-[#64748B] font-normal">required - helps us prepare.</span>
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 h-[46px] rounded-[14px] border border-[#C5CBD8] bg-[#F8FAFF] text-[14px] font-semibold text-[#475569] flex items-center justify-center gap-2 hover:border-[#306EEC] hover:text-[#306EEC] hover:bg-white transition"
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
                    className="flex-1 h-[46px] rounded-[14px] border border-[#C5CBD8] bg-[#F8FAFF] text-[14px] font-semibold text-[#475569] flex items-center justify-center gap-2 hover:border-[#306EEC] hover:text-[#306EEC] hover:bg-white transition"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Add Photos{uploadedPhotos.length > 0 ? ` (${uploadedPhotos.length})` : ""}
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
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
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
            <div className="order-7 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
              <StepHeader step="4 Confirm" title="Ready to book" />
              <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
                {[
                  "1 task per visit, up to 90 min",
                  "Upload at least one photo",
                  "Materials are not included",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="#306EEC" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[12px] text-[#64748B]">{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleBookNow}
                data-track="booking-cta"
                disabled={!canBook}
                className="h-[50px] w-full rounded-[15px] bg-[#306EEC] text-[15px] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0 active:scale-[0.99] sm:h-[58px] sm:rounded-[16px] sm:text-[17px]"
                style={{ boxShadow: canBook ? "0 16px 48px rgba(48,110,236,0.30)" : undefined }}
              >
                {checkingAccess
                  ? "Checking access..."
                  : loading
                  ? "Booking..."
                  : hasActiveBooking
                  ? "Visit limit reached"
                  : "Book Your Visit"}
              </button>

              <div className="mt-3 text-[12px] text-[#94A3B8] text-center">
                You&rsquo;ll receive a confirmation once your visit is reviewed.
              </div>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 sm:px-4"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-white rounded-t-[32px] sm:rounded-[28px] w-full sm:max-w-[520px] shadow-[0_-8px_60px_rgba(0,0,0,0.18)] sm:shadow-[0_32px_100px_rgba(0,0,0,0.25)] max-h-[92vh] overflow-y-auto"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle — mobile only */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
                <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
              </div>

              <div className="px-5 pb-2 pt-4 sm:px-9 sm:pb-9 sm:pt-9">
                {/* Success icon with pulse ring */}
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <span className="absolute inset-0 rounded-full bg-[#DCFCE7] animate-ping opacity-60" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] sm:h-20 sm:w-20">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M5 12.5l4.5 4.5L19 8"
                          stroke="#16A34A"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <h2 className="mb-2 text-center text-[22px] font-extrabold text-[#0B1628] sm:text-[30px]">
                  Booking Confirmed
                </h2>
                <p className="text-[14px] text-[#64748B] text-center mb-6">
                  We&rsquo;ll reach out to confirm your visit details.
                </p>

                {/* Booking details */}
                <div className="rounded-[18px] border border-[#E5E9F2] bg-[#F8FAFF] p-5 space-y-3 mb-5">
                  {(
                    [
                      ["Visit #", bookingNumber],
                      ["Service", confirmedService],
                      [
                        "Date",
                        confirmedDate?.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }),
                      ],
                      ["Time", formatTime12(confirmedTime)],
                    ] as [string, string | undefined][]
                  )
                    .filter(([, v]) => !!v)
                    .map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4">
                        <span className="text-[13px] font-semibold text-[#64748B] flex-shrink-0">{label}</span>
                        <span className="text-[14px] font-semibold text-[#0B1628] text-right">{value}</span>
                      </div>
                    ))}
                </div>

                {/* Pre-visit checklist */}
                <div className="rounded-[18px] border border-[#D9E4FF] bg-[#EEF5FF] p-5 mb-6">
                  <div className="text-[14px] font-extrabold text-[#1D4ED8] mb-3">Before your visit</div>
                  <div className="space-y-2.5">
                    {[
                      "Have all materials & fixtures on-site and ready",
                      "Your Profixter pro may arrive up to 30 min early or late",
                      "Questions? Call Taras: 631-599-1363",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="#306EEC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[13px] text-[#1D4ED8]">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowModal(false);
                    window.location.reload();
                  }}
                  className="h-[50px] w-full rounded-[15px] bg-[#306EEC] text-[15px] font-extrabold text-white transition hover:bg-[#2558c9] active:scale-[0.99] sm:h-[56px] sm:rounded-[16px] sm:text-[16px]"
                  style={{ boxShadow: "0 12px 36px rgba(48,110,236,0.30)" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
