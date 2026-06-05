"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  getCalendarConfig,
  getTimeSlots,
  createBooking,
  getNextBooking,
  CalendarConfig,
} from "@/lib/booking-service";
import { compressImage } from "@/lib/compressImage";
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
              "group relative min-h-[60px] overflow-hidden rounded-[12px] border px-3.5 py-3 text-left transition-all duration-150 ease-out active:scale-[0.99]",
              isSelected
                ? "border-[#306EEC] bg-[#EEF5FF] text-[#0B1628] ring-2 ring-[#306EEC]/20"
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

            <div className="relative z-[1] flex items-start justify-between gap-2">
              <div
                className={`text-[15px] font-black tracking-[-0.01em] ${
                  slot.available ? "" : "line-through"
                } ${isSelected ? "text-white" : ""}`}
              >
                {formatTime12(slot.time)}
              </div>
              {isSelected && (
                <div className="inline-flex items-center gap-1 rounded-full border border-[#306EEC]/20 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#306EEC]">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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
              className={`relative z-[1] mt-1.5 text-[11px] font-semibold ${
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

// ---------- Booking Section ----------
export default function BookingSection() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const bookingUser = user as BookingUser | null;
  const addresses = bookingUser?.addresses || [];
  const defaultAddressId = bookingUser?.defaultAddressId;

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
  const loadedMonthsRef = useRef<Record<string, boolean>>({});
  const autoSelectedDateRef = useRef(false);

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
    autoSelectedDateRef.current = false;
    setService("");
    setShowServiceMenu(false);
    setError("");
    setNotice("");
    setUploadedPhotos([]);
    setPhotoUrls([]);
    setNote("");
  }, [selectedAddressId]);

  const getHoursForDate = (date: Date) => {
    if (!config) return [];
    const ymd = formatDateYMD(date);
    const overrideHours = config.overrides[ymd];
    return overrideHours?.length ? overrideHours : config.defaultHours;
  };

  const getMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const isDateSelectable = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return !isDayDisabled(normalized);
  };

  const getClosestAvailableDate = () => {
    const entries = Object.entries(dayAvailabilityMap)
      .filter(([, info]) => Array.isArray(info?.slots) && info.slots.length > 0)
      .map(([ymd]) => {
        const [year, month, day] = ymd.split("-").map(Number);
        return new Date(year, (month || 1) - 1, day || 1);
      })
      .filter((date) => isDateSelectable(date))
      .sort((a, b) => a.getTime() - b.getTime());

    return entries[0] || null;
  };

  const fetchDayAvailability = async (ymd: string): Promise<DayAvailability | null> => {
    if (dayAvailabilityMap[ymd]) return dayAvailabilityMap[ymd];

    const existingRequest = dayRequestCacheRef.current[ymd];
    if (existingRequest) return existingRequest;

    const request = getTimeSlots(ymd)
      .then((data) => {
        const nextAvailability: DayAvailability = {
          taken: data.taken || {},
          capacity: data.capacityPerSlot ?? 1,
          slots: data.slots || [],
        };

        setDayAvailabilityMap((prev) => {
          if (prev[ymd]) return prev;
          return { ...prev, [ymd]: nextAvailability };
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
  };

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

// 🔥 Preload availability for the whole visible month
useEffect(() => {
  if (!config) return;

  let cancelled = false;

  const preloadMonth = async (monthDate: Date) => {
    const monthKey = getMonthKey(monthDate);
    if (loadedMonthsRef.current[monthKey]) return;

    setLoadingMonthKey(monthKey);

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const datesToFetch: string[] = [];

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);

      const ymd = formatDateYMD(date);
      const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const overrideHours = config.overrides[ymd];

      if (date < today) continue;
      if (diffDays < config.minLeadDays) continue;
      if (config.closedWeekdays.includes(date.getDay())) continue;
      if (config.holidays.includes(ymd)) continue;
      if (overrideHours !== undefined && overrideHours.length === 0) continue;
      if (dayAvailabilityMap[ymd]) continue;

      datesToFetch.push(ymd);
    }

    try {
      await Promise.all(datesToFetch.map((ymd) => fetchDayAvailability(ymd)));
      loadedMonthsRef.current[monthKey] = true;
    } finally {
      if (!cancelled) {
        setLoadingMonthKey((current) => (current === monthKey ? null : current));
      }
    }
  };

  void preloadMonth(currentMonth);
  void preloadMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  return () => {
    cancelled = true;
  };
}, [config, currentMonth, dayAvailabilityMap]);

  useEffect(() => {
    if (!config) return;
    if (selectedDate && isDateSelectable(selectedDate)) return;
    if (autoSelectedDateRef.current) return;

    const closest = getClosestAvailableDate();
    if (!closest) return;

    autoSelectedDateRef.current = true;
    setCurrentMonth(new Date(closest.getFullYear(), closest.getMonth(), 1));
    setSelectedDate(closest);
    setSelectedTime("");
  }, [config, dayAvailabilityMap, selectedDate]);



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
  }, [selectedDate, dayAvailabilityMap]);

const isDayDisabled = (date: Date): boolean => {
  if (!config) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const ymd = formatDateYMD(d);

    // Past days
    if (d < today) return true;

    // Lead time
    const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < config.minLeadDays) return true;

    // Closed weekdays
    if (config.closedWeekdays.includes(d.getDay())) return true;

    // Holiday
    if (config.holidays.includes(ymd)) return true;

    // Override closed
    if (config.overrides[ymd] !== undefined && config.overrides[ymd].length === 0) return true;

    // Fully booked OR no available slots day
const info = dayAvailabilityMap[ymd];
const hours = getHoursForDate(d);

// If no hours configured at all => disable
if (!hours || hours.length === 0) return true;

// If we have capacity info and all are full => disable
if (info) {
  const allFull = hours.every((h) => (info.taken[h] || 0) >= info.capacity);
  if (allFull) return true;
}



    return false;
  };

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
      alert("Please sign in to book a visit");
      window.location.href = "/signin";
      return;
    }

    const addressId = selectedAddressId || defaultAddressId;
    if (!addressId) {
      alert("Please add an address to your account first");
      window.location.href = "/account";
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
      const responseMessage =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const errorMessage = err instanceof Error ? err.message : undefined;
      const message = responseMessage || errorMessage || "We could not create the booking. Please try again.";
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
  const slotOptions = useMemo(() => {
    if (!selectedDate || !config) return [];
    const taken = dayAvailabilityMap[ymdSelected]?.taken || {};
    const capacity = dayAvailabilityMap[ymdSelected]?.capacity || 1;
    const availableSet = new Set(displayedTimes);

    return getHoursForDate(selectedDate).map((time) => {
      const used = taken[time] || 0;
      const available = availableSet.has(time);
      return {
        time,
        available,
        remaining: available ? Math.max(capacity - used, 0) : null,
      };
    });
  }, [selectedDate, config, dayAvailabilityMap, ymdSelected, displayedTimes]);

  return (
    <section
      id="pick-day"
      className="relative w-full overflow-hidden bg-[#F6F8FC] pt-14 sm:pt-20 lg:pt-24 pb-14 sm:pb-18 lg:pb-24 scroll-mt-[110px]"
    >
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-8 sm:mb-10 max-w-[720px]">
          <div className="inline-flex items-center gap-2.5 rounded-[8px] border border-[#D9E4FF] bg-white px-3 py-2 mb-5">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-[#306EEC]"
              style={{ boxShadow: "0 0 8px rgba(48,110,236,0.7)" }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Member booking
            </span>
          </div>

          <h2 className="text-[34px] sm:text-[42px] lg:text-[52px] font-black leading-[1] text-[#0B1628] mb-3">
            Book Your Next Visit
          </h2>

          <p className="text-[15px] sm:text-[17px] text-[#475569] leading-relaxed max-w-[520px] mb-2">
            Choose a time, tell us what you need, and we&rsquo;ll handle the rest.
          </p>

          <p className="text-[13px] leading-relaxed text-[#64748B] max-w-[560px]">
            Your visit includes up to 90 minutes of handyman labor. Add notes and photos so our team can come prepared.
          </p>
        </div>


        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* ── Calendar (left) ── */}
          <div className="order-2 lg:order-1 lg:col-span-5">

            {/* Calendar card */}
            <div className="rounded-[12px] border border-[#D7DEE9] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)] p-5 sm:p-6">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-5">
                <button
                  aria-label="Prev month"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="w-10 h-10 rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] grid place-items-center text-[#475569] hover:bg-[#EEF5FF] hover:border-[#D9E4FF] transition active:scale-95"
                >
                  <ChevronLeft />
                </button>

                <div className="text-[18px] sm:text-[20px] font-extrabold text-[#0B1628]">
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
                  onClick={() => router.push("/account?tab=bookings")}
                  className="inline-flex items-center gap-2 w-full justify-center h-[46px] rounded-[14px] border border-[#C5CBD8] bg-white text-[#475569] text-[14px] font-semibold hover:border-[#306EEC] hover:text-[#306EEC] transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Manage my bookings
                </button>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-5">

            <div className="order-1 rounded-[12px] border border-[#D7DEE9] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)] p-5 sm:p-6 lg:order-none">
              <div className="text-[16px] font-extrabold text-[#0B1628] mb-1">Visit details</div>
              <div className="text-[13px] text-[#64748B] mb-5">
                Confirm the home and type of help before choosing your time.
              </div>

              <div className="space-y-5">
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
            <div className="order-3 rounded-[12px] border border-[#D7DEE9] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)] p-5 sm:p-6 lg:order-none">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[16px] font-extrabold text-[#0B1628]">Choose a time</div>
                  <div className="text-[13px] text-[#64748B] mt-0.5">Each visit is up to 90 minutes</div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickBookOpen(true)}
                  disabled={checkingAccess || loadingMonthKey === visibleMonthKey}
                  className="inline-flex h-[40px] items-center gap-2 rounded-[12px] border border-[#306EEC] px-4 text-[13px] font-bold text-[#306EEC] hover:bg-[#EEF5FF] disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
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
            <div className="order-4 rounded-[12px] border border-[#D7DEE9] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)] p-5 sm:p-6 lg:order-none">
              <div className="text-[16px] font-extrabold text-[#0B1628] mb-1">Describe your task</div>
              <div className="text-[13px] text-[#64748B] mb-4">
                What needs to be done? Most tasks fit within one visit.
              </div>

              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error === "Describe the task in at least a few words.") setError("");
                }}
                placeholder="E.g. leaking faucet, loose door handle, light fixture swap, shelf to hang..."
                className={`w-full min-h-[120px] max-h-[240px] rounded-[16px] border p-4 text-[14px] sm:text-[15px] text-[#0B1628] placeholder-[#94A3B8] resize-none bg-[#F8FAFF] focus:outline-none focus:ring-4 focus:ring-[#306EEC]/15 focus:border-[#306EEC] transition ${
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
              <div className="mt-5">
                <div className="text-[13px] font-semibold text-[#0B1628] mb-2">
                  Photos{" "}
                  <span className="text-[#DC2626]">*</span>
                  <span className="ml-1 text-[#64748B] font-normal">required - helps us prepare</span>
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
            <div className="order-7 rounded-[12px] border border-[#D7DEE9] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)] p-5 sm:p-6 lg:order-none">
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5">
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
                className="w-full h-[58px] rounded-[18px] bg-[#306EEC] text-white text-[16px] sm:text-[17px] font-extrabold transition-all hover:bg-[#2558c9] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 active:scale-[0.99]"
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
                You&rsquo;ll receive a confirmation once your booking is reviewed.
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
              className="w-full max-w-[700px] rounded-[28px] bg-white p-6 sm:p-7 shadow-[0_32px_100px_rgba(0,0,0,0.28)] max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC] mb-1">
                    Quick Booking
                  </div>
                  <h3 className="text-[22px] sm:text-[26px] font-extrabold text-[#0B1628] leading-tight">
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

              <div className="px-6 pt-5 pb-2 sm:px-9 sm:pt-9 sm:pb-9">
                {/* Success icon with pulse ring */}
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <span className="absolute inset-0 rounded-full bg-[#DCFCE7] animate-ping opacity-60" />
                    <div className="relative w-20 h-20 rounded-full bg-[#DCFCE7] flex items-center justify-center">
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

                <h2 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1628] text-center mb-2">
                  Booking Confirmed
                </h2>
                <p className="text-[14px] text-[#64748B] text-center mb-6">
                  We&rsquo;ll reach out to confirm your visit details.
                </p>

                {/* Booking details */}
                <div className="rounded-[18px] border border-[#E5E9F2] bg-[#F8FAFF] p-5 space-y-3 mb-5">
                  {(
                    [
                      ["Booking #", bookingNumber],
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
                      "Your Fixter may arrive up to 30 min early or late",
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
                  className="w-full h-[58px] sm:h-[56px] rounded-[16px] bg-[#306EEC] text-white text-[16px] font-extrabold hover:bg-[#2558c9] transition active:scale-[0.99]"
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
