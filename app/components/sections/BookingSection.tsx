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

const SERVICES = [
  { key: "labor_only", label: "Labor Only", minRank: 1 }, // Basic+
  { key: "labor_materials", label: "Labor with Materials Needed", minRank: 2 }, // Plus+
  { key: "get_2_pros", label: "Get 2 Pros", minRank: 3 }, // Premium+
  { key: "general_contractor", label: "General Contractor", minRank: 4 }, // Elite
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

// Fallback 9–17 every 30 min
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

// ---------- Time Dropdown ----------
function TimeDropdown({
  times,
  takenCounts,
  capacity,
  selectedTime,
  onSelect,
}: {
  times: string[];
  takenCounts: Record<string, number>;
  capacity: number;
  selectedTime: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full sm:w-[190px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-[54px] rounded-[12px] border border-[#c5cbd8] bg-[#EEF2FF] px-4 sm:px-5 text-[#313234] text-[16px] sm:text-[18px] flex items-center justify-between shadow-[0_0_200px_rgba(0,0,0,0.08)] hover:bg-white/60 transition"
      >
        <span className={selectedTime ? "font-semibold" : "text-[#6a6c71]"}>
          {selectedTime || "Select time"}
        </span>

        <svg width="20" height="20" viewBox="0 0 24 24" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9L12 15L18 9" stroke="#313234" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute mt-2 w-full bg-white border border-[#c5cbd8] rounded-[12px] shadow-lg z-20 py-2 max-h-[260px] overflow-auto">
          {times.map((time) => {
            const used = takenCounts[time] || 0;
            const isFull = used >= capacity;

            return (
              <button
                key={time}
                type="button"
                disabled={isFull}
                onClick={() => {
                  if (isFull) return;
                  onSelect(time);
                  setOpen(false);
                }}
                className={[
                  "w-full text-left px-4 py-2 text-[16px] sm:text-[18px] flex items-center",
                  isFull ? "text-gray-400 cursor-not-allowed" : "hover:bg-[#EEF2FF] text-[#313234]",
                ].join(" ")}
              >
                <span className={isFull ? "line-through" : ""}>{time}</span>
                {!isFull && used > 0 && (
                  <span className="ml-auto text-xs text-[#6a6c71]">{capacity - used} left</span>
                )}
                {isFull && <span className="ml-auto text-xs text-gray-400">Full</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Booking Section ----------
export default function BookingSection() {
  const { user, isAuthenticated } = useAuth();

  const addresses = ((user as any)?.addresses || []) as any[];
  const defaultAddressId = (user as any)?.defaultAddressId as string | undefined;

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Calendar config + month
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [dayCapacityMap, setDayCapacityMap] = useState<
    Record<string, { taken: Record<string, number>; capacity: number }>
  >({});
  const [preloadingMonth, setPreloadingMonth] = useState(false);


  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

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
  const [activeBookings, setActiveBookings] = useState<any[]>([]);

  // Subscription / access (per address)
  const [hasSubscription, setHasSubscription] = useState(false);
  const [freeFirstVisitAvailable, setFreeFirstVisitAvailable] = useState(false);
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
    setService("");
    setShowServiceMenu(false);
    setError("");
    setUploadedPhotos([]);
    setPhotoUrls([]);
    setNote("");
  }, [selectedAddressId]);

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

  const preloadMonth = async () => {
    setPreloadingMonth(true);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const lastDay = new Date(year, month + 1, 0);

    const updates: Record<string, { taken: Record<string, number>; capacity: number }> = {};

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);

      const ymd = formatDateYMD(date);

      try {
        const data = await getTimeSlots(ymd);

        updates[ymd] = {
          taken: data.taken || {},
          capacity: data.capacityPerSlot ?? 1,
        };
      } catch (e) {
        console.error("Preload failed for", ymd, e);
      }
    }

    setDayCapacityMap((prev) => ({ ...prev, ...updates }));
    setPreloadingMonth(false);
  };

  preloadMonth();
}, [config, currentMonth]);



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
  setSubscriptionError("This address does not have an active subscription. Purchase a subscription to book a visit.");
} else {
  setSubscriptionError("");
}

      const limit = Number(data?.bookingLimit ?? 1);
      const count = Number(data?.activeCount ?? 0);

      const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;
      const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;

      // ✅ ALL active bookings list (pending + confirmed)
// Prefer array from API, fallback to single `future`
const list = Array.isArray(data?.activeBookings)
  ? data.activeBookings
  : data?.future
  ? [data.future]
  : [];

setActiveBookings(
  list
    .filter((b: any) => b?.date)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
);
      // ✅ keep legacy "existingBooking*" in sync using earliest booking
const sorted = list
  .filter((b: any) => b?.date)
  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

      
    } catch (e) {
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
      setAvailableTimes([]);
      return;
    }

    const loadSlots = async () => {
      try {
        const dateStr = formatDateYMD(selectedDate);
        const data = await getTimeSlots(dateStr);

        setAvailableTimes(data.slots || []);

        setDayCapacityMap((prev) => ({
          ...prev,
          [dateStr]: {
            taken: data.taken || {},
            capacity: data.capacityPerSlot ?? 1,
          },
        }));
      } catch (err) {
        console.error("Failed to load time slots:", err);
        setAvailableTimes([]);
      }
    };

    loadSlots();
  }, [selectedDate]);

const isDayDisabled = (date: Date): boolean => {
  if (!config) return true;
  if (preloadingMonth) return true;


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
const info = dayCapacityMap[ymd];
const hours = config.overrides[ymd]?.length ? config.overrides[ymd] : config.defaultHours;

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

  // If already known disabled, block immediately
  if (isDayDisabled(d)) return;

  const ymd = formatDateYMD(d);

  try {
    // 🔥 Check slots BEFORE allowing selection
    const data = await getTimeSlots(ymd);
    const slots = data.slots || [];

    // If no available slots -> block selection
    if (slots.length === 0) {
      // Cache it as fully booked so UI disables it next render
      setDayCapacityMap((prev) => ({
        ...prev,
        [ymd]: {
          taken: data.taken || {},
          capacity: data.capacityPerSlot ?? 1,
        },
      }));
      return; // ❌ DO NOT select this day
    }

    // Cache capacity info
    setDayCapacityMap((prev) => ({
      ...prev,
      [ymd]: {
        taken: data.taken || {},
        capacity: data.capacityPerSlot ?? 1,
      },
    }));

    // ✅ Now it's safe to select
    setSelectedDate(d);
    setSelectedTime("");
    setAvailableTimes(slots);
  } catch (err) {
    console.error("Failed to check slots for day:", err);
    return; // fail safe: don't allow selection
  }
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
    e.target.value = ""; // allow re-select same file
  };

  const removePhoto = (idx: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== idx));
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
  setError("This address does not have an active subscription. Purchase a subscription to book a visit.");
  return;
}


    if (!service) {
      setError("Please select a service");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError("Please select date and time");
      return;
    }
    if (note.trim().split(/\s+/).filter(Boolean).length < 3) {
      setError("Please describe your issue (at least 3 words)");
      return;
    }
    if (uploadedPhotos.length === 0) {
      setError("Please upload at least one photo");
      return;
    }

    setLoading(true);
    setError("");

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
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed to create booking. Please try again.";
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const rebook = async (booking: any) => {
  const id = booking?._id || existingBookingId;
  if (!id) return;

  try {
    const token = localStorage.getItem("token");

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
      setService(key as any);
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

    alert("Visit canceled. You may now rebook.");
  } catch (err) {
    console.error("Rebook failed:", err);
    alert("Error canceling the visit.");
  }
};

  const days = generateCalendarDays();

const canBook =
  !loading &&
  !checkingAccess &&
  (hasSubscription || !isAuthenticated) &&
  !hasActiveBooking;


  const wordsCount = note.trim().split(/\s+/).filter(Boolean).length;

  // times shown = based on config + availableTimes intersection
  const timesForSelectedDay = useMemo(() => {
    if (!selectedDate || !config) return [];
    const ymd = formatDateYMD(selectedDate);
    const baseTimes = config.overrides?.[ymd]?.length ? config.overrides[ymd] : config.defaultHours || [];
    const finalTimes = availableTimes.length > 0 ? baseTimes.filter((t) => availableTimes.includes(t)) : baseTimes;
    return finalTimes;
  }, [selectedDate, config, availableTimes]);

  const ymdSelected = selectedDate ? formatDateYMD(selectedDate) : "";

  return (
    <section id="pick-day" className="relative w-full pt-28 sm:pt-36 lg:pt-44 pb-12 sm:pb-16 lg:pb-24 bg-[#eaedfa]">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        {/* Header */}
        <div className="mb-8 sm:mb-10 lg:mb-12">
          {/* Desktop edge labels */}
          <div className="hidden lg:flex items-center justify-between text-[12px] font-bold text-[#313234] uppercase">
            <span className="w-[110px] text-left whitespace-nowrap">MAKE IT DONE</span>
            <span className="w-[200px] text-right whitespace-nowrap text-[#306EEC]">
              WHEN<span className="text-[#313234]">&nbsp;YOU&nbsp;</span>WANT
            </span>
          </div>

          {/* Mobile / Tablet */}
          <div className="lg:hidden text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight uppercase">
              <span className="text-[#313234]">Choose your </span>
              <span className="text-[#306EEC]">day</span>
            </h2>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight uppercase mt-1">
              <span className="text-[#313234]">and </span>
              <span className="text-[#306EEC]">time</span>
            </h2>
            <p className="text-[#6A6D71] text-sm sm:text-base mt-3 max-w-md mx-auto">
              Select a day first, then pick an available time.
            </p>
          </div>

          {/* Desktop title (no calc hacks) */}
          <div className="hidden lg:block mt-6">
            <h2 className="text-[56px] leading-[0.95] font-extrabold uppercase tracking-[-0.04em]">
              <span className="text-[#313234]">Choose your own </span>
              <span className="text-[#306EEC]">day</span>
              <span className="text-[#313234]"> and </span>
              <span className="text-[#306EEC]">time</span>
            </h2>
            <p className="mt-3 text-[#6A6D71] text-[16px] font-medium max-w-[560px]">
              Control your schedule yourself. Pick a day, then choose an available time slot.
            </p>
          </div>
        </div>


        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Calendar */}
          <div className="lg:col-span-5">
            <div className="rounded-[18px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.08)] p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <button
                  aria-label="Prev month"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="w-10 h-10 rounded-[14px] border border-[#c5cbd8] bg-white/70 grid place-items-center text-[#313234] hover:bg-white transition active:scale-95"
                >
                  <ChevronLeft />
                </button>

                <div className="text-lg sm:text-xl lg:text-[22px] font-extrabold text-[#313234]">
                  {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>

                <button
                  aria-label="Next month"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="w-10 h-10 rounded-[14px] border border-[#c5cbd8] bg-white/70 grid place-items-center text-[#313234] hover:bg-white transition active:scale-95"
                >
                  <ChevronRight />
                </button>
              </div>

              {/* Week headers */}
              <div className="mt-5 grid grid-cols-7 text-center text-sm sm:text-base font-semibold">
                <div className="text-[#cf3f3f]">Su</div>
                <div className="text-[#6a6c71]">Mo</div>
                <div className="text-[#6a6c71]">Tu</div>
                <div className="text-[#6a6c71]">We</div>
                <div className="text-[#6a6c71]">Th</div>
                <div className="text-[#6a6c71]">Fr</div>
                <div className="text-[#6a6c71]">Sa</div>
              </div>

              {/* Days */}
              <div className="mt-2 grid grid-cols-7 gap-y-2">
                {days.map((day, i) => {
                  const disabled = day.muted || isDayDisabled(new Date(day.date));
                  const isSelected = selectedDate ? sameDay(day.date, selectedDate) : false;

                  const today = new Date();
                  const isToday = sameDay(day.date, today);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleDayClick(day.date, day.muted)}
                      disabled={disabled}
                      className={[
  "mx-auto w-9 h-9 sm:w-10 sm:h-10 grid place-items-center rounded-[14px] text-sm sm:text-base font-semibold transition",
  day.muted ? "text-[#b7bdc8] cursor-not-allowed" : "",
  disabled && !day.muted ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed" : "",

  // ✅ AVAILABLE days (not disabled, not selected) => blue tint
  !disabled && !isSelected ? "bg-[#306EEC]/15 text-[#313234] hover:bg-[#306EEC]/25" : "",

  // ✅ SELECTED day => white / no fill, blue text + ring
  isSelected ? "bg-white text-[#306EEC] ring-4 ring-[#306EEC]/25" : "",

  // Today ring stays subtle
  isToday && !disabled && !isSelected ? "ring-2 ring-[#306EEC]/20" : "",
].join(" ")}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-center text-sm text-[#6a6c71]">
                Emergency? Call{" "}
                <a href="tel:631-599-1363" className="text-[#306EEC] font-semibold hover:underline">
                  631-599-1363
                </a>
              </div>
            </div>

            {selectedDate && (
              <div className="mt-4 text-center text-sm sm:text-base text-[#313234] font-semibold">
                Selected: <span className="text-[#306EEC]">{selectedDateLabel}</span>
              </div>
            )}
            {isAuthenticated && hasSubscription && activeBookings.length > 0 && (
  <div className="mt-4 rounded-[14px] border border-[#c5cbd8] bg-white/60 p-3">
    <div className="text-[12px] font-extrabold text-[#313234] uppercase mb-2">
      Your bookings
    </div>

    <div className="space-y-2">
      {activeBookings.map((b: any) => {
        const dt = new Date(b.date);
        const when = dt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const status = String(b.status || "Pending");
        const statusColor =
          status.toLowerCase() === "confirmed"
            ? "text-green-700"
            : "text-orange-700";

        return (
          <div
            key={String(b._id)}
            className="flex items-center gap-2 text-[12px] text-[#313234]"
          >
            <div className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{when}</span>{" "}
              <span className={["font-semibold", statusColor].join(" ")}>
                {status}
              </span>
            </div>

            <button
              type="button"
              onClick={() => rebook(b)}
              className="shrink-0 px-2 py-1 rounded-lg bg-[#306EEC] text-white text-[11px] font-extrabold hover:bg-[#2558c9] transition"
            >
              Rebook
            </button>
          </div>
        );
      })}
    </div>
  </div>
)}
          </div>

          {/* Right column */}
          <div className="lg:col-span-7">
            {/* Time + info */}
            <div className="rounded-[18px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.08)] p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                {selectedDate && config ? (
                  timesForSelectedDay.length > 0 ? (
                    <TimeDropdown
                      times={timesForSelectedDay}
                      takenCounts={dayCapacityMap[ymdSelected]?.taken || {}}
                      capacity={dayCapacityMap[ymdSelected]?.capacity || 999}
                      selectedTime={selectedTime}
                      onSelect={(t) => setSelectedTime(t)}
                    />
                  ) : (
                    <div className="w-full sm:w-[190px] h-[54px] rounded-[12px] border border-[#c5cbd8] bg-white/60 flex items-center px-4 text-[#6a6c71] text-sm">
                      No available times
                    </div>
                  )
                ) : (
                  <div className="w-full sm:w-[190px] h-[54px] rounded-[12px] border border-[#c5cbd8] bg-white/60 flex items-center px-4 text-[#6a6c71] text-sm">
                    Select a date first
                  </div>
                )}

                <div className="text-sm sm:text-base text-[#6a6c71]">
                  Visit length: <span className="font-semibold text-[#313234]">up to 90 minutes</span>. Please take clear photos.
                </div>
              </div>

              {/* Address selector if 2+ */}
              {(addresses?.length || 0) >= 2 && (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-[#313234] mb-2">Booking address</div>
                  <select
                    value={selectedAddressId ?? defaultAddressId ?? ""}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    className="w-full h-[48px] rounded-[12px] border border-[#c5cbd8] bg-white px-3 text-[#313234] font-semibold outline-none focus:ring-4 focus:ring-[#306EEC]/20"
                  >
                    {addresses.map((a: any) => (
                      <option key={a._id} value={a._id}>
                        {a.label ? `${a.label}: ` : ""}
                        {a.line1}, {a.city} {a.state} {a.zip}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Issue + service + photos */}
            <div className="mt-6 rounded-[18px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.08)] p-4 sm:p-6">
              <div className="text-sm font-semibold text-[#313234] mb-2">Describe the issue</div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Briefly describe your issue (e.g. leaking faucet, light switch not working)..."
                className="w-full min-h-[120px] max-h-[320px] overflow-y-auto bg-white/40 rounded-[14px] border border-[#c5cbd8] p-4 text-sm sm:text-base text-[#313234] placeholder-[#6a6c71] resize-none focus:outline-none focus:ring-4 focus:ring-[#306EEC]/15"
              />

              <div className="mt-2 text-xs text-[#6a6c71]">
                Words: <span className={wordsCount >= 3 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>{wordsCount}</span>{" "}
                (minimum 3)
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Service dropdown */}
                <div ref={serviceWrapRef} className="relative">
                  <button
                    type="button"
                    disabled={checkingAccess || !hasSubscription}
onClick={() => {
  if (checkingAccess || !hasSubscription) return;
  setShowServiceMenu((v) => !v);
}}

                    className={[
                      "h-[46px] px-4 sm:px-5 rounded-[12px] border text-sm sm:text-base whitespace-nowrap transition flex items-center justify-between gap-3 w-full sm:w-[260px]",
checkingAccess || !hasSubscription
  ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
  : "border-[#313234] bg-white/50 text-[#313234] hover:bg-white"
                    ].join(" ")}
                  >
                    <span className={service ? "font-semibold" : ""}>
                      {service ? SERVICES.find((x) => x.key === service)?.label : "Select a service"}
                    </span>
                    <svg width="18" height="18" viewBox="0 0 24 24" className={`transition-transform ${showServiceMenu ? "rotate-180" : ""}`}>
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {showServiceMenu && (
                    <div className="absolute top-[52px] left-0 w-full sm:w-[300px] bg-white border border-[#c5cbd8] rounded-[12px] shadow-lg z-20 overflow-hidden">
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
                              "block w-full text-left px-4 py-3 text-sm sm:text-base transition",
                              allowed ? "hover:bg-[#EEF2FF] text-[#313234]" : "text-gray-400 cursor-not-allowed line-through bg-white",
                            ].join(" ")}
                          >
                            {s.label}
                            {!allowed && (
                              <span className="ml-2 text-xs text-gray-400">(upgrade plan)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Camera */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-[46px] px-4 sm:px-5 rounded-[12px] border border-[#313234] bg-white/50 text-[#313234] text-sm sm:text-base font-semibold flex items-center justify-center gap-2 hover:bg-white transition active:scale-[0.99]"
                >
                  📷 Take a picture
                </button>

                {/* Gallery */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-[46px] px-4 sm:px-5 rounded-[12px] border border-[#313234] bg-white/50 text-[#313234] text-sm sm:text-base font-semibold flex items-center justify-center gap-2 hover:bg-white transition active:scale-[0.99]"
                >
                  🖼️ Add photos {uploadedPhotos.length > 0 ? `(${uploadedPhotos.length})` : ""}
                </button>

                {/* hidden inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  {...({ capture: "environment" } as any)}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Photo previews */}
              {uploadedPhotos.length > 0 && (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-[#313234] mb-2">Photos</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
{uploadedPhotos.map((file, idx) => {
  const url = photoUrls[idx];
  return (
                        <div key={idx} className="relative rounded-[14px] overflow-hidden border border-[#c5cbd8] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url || ""} alt={`Upload ${idx + 1}`} className="w-full h-[120px] object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 grid place-items-center hover:bg-black/70 transition"
                            aria-label="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Subscription warning */}
{isAuthenticated && !checkingAccess && !hasSubscription && subscriptionError && (
              <div className="mt-4 text-red-700 text-sm bg-red-50 border border-red-200 rounded-[14px] p-4">
                <div className="font-extrabold mb-1">🔒 No Active Subscription</div>
                <div className="mb-3">{subscriptionError}</div>
                <a
                  href="#plans"
                  className="inline-flex px-4 py-2 bg-[#306EEC] text-white rounded-xl hover:bg-[#2558c9] transition text-sm font-bold"
                >
                  View Subscription Plans
                </a>
              </div>
            )}

            {/* Active booking limit warning */}
            {isAuthenticated && hasSubscription && hasActiveBooking && (
              <div className="mt-4 text-orange-800 text-sm bg-orange-50 border border-orange-200 rounded-[14px] p-4">
                <div className="font-extrabold mb-1">⚠️ Active booking limit reached</div>
                <div className="text-xs mt-1">
                  You currently have <span className="font-semibold">{activeBookingCount}</span> active booking
                  {activeBookingCount === 1 ? "" : "s"}. Your plan allows{" "}
                  <span className="font-semibold">{activeBookingLimit}</span> at a time.
                </div>

                {existingBookingDate && (
                  <div className="mt-2 text-xs">
                    Next booking:{" "}
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

                <div className="text-xs mt-2 mb-3">To schedule another visit, please complete or cancel an active booking.</div>

                <button
                  type="button"
                  onClick={() => rebook(activeBookings[0] || null)}
                  className="px-4 py-2 bg-[#306EEC] text-white rounded-xl text-xs font-extrabold hover:bg-[#2558c9] transition"
                >
                  Rebook
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 text-red-700 text-sm bg-red-50 border border-red-200 rounded-[14px] p-3">
                {error}
              </div>
            )}

            {/* Book button */}
            <div className="mt-6">
              <button
                onClick={handleBookNow}
                disabled={!canBook}
                className="w-full sm:w-[280px] h-[58px] rounded-[16px] bg-[#306eec] border border-[#306eec] text-[#eef2ff] text-lg sm:text-[20px] font-extrabold hover:bg-[#2558c9] transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
              >
{checkingAccess ? "Checking..." : loading ? "Booking..." : hasActiveBooking ? "Limit reached" : "Book now"}
              </button>

              <div className="mt-2 text-xs text-[#6a6c71]">
                By booking, you confirm the photos and description are accurate for faster service.
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowModal(false)}>
            <div
              className="bg-white rounded-[22px] p-6 sm:p-8 max-w-[560px] w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="text-6xl">🎉</div>
              </div>

              <h2 className="text-[28px] sm:text-[32px] font-extrabold text-[#313234] text-center mb-6">
                Booking Confirmed
              </h2>

              <div className="space-y-2 mb-6 text-sm sm:text-base">
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Booking #:</span>
                  <span className="text-[#6A6D71]">{bookingNumber}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Service:</span>
                  <span className="text-[#6A6D71]">{confirmedService}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Date:</span>
                  <span className="text-[#6A6D71]">
                    {confirmedDate?.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Time:</span>
                  <span className="text-[#6A6D71]">{confirmedTime}</span>
                </div>
              </div>

              <p className="text-[#6A6D71] text-[15px] mb-6">
                Mr. Fixter will reach out to you shortly.
                <br />
                A confirmation email has been sent.
              </p>

              <div className="bg-[#EEF2FF] rounded-[14px] p-4 mb-6 border border-[#c5cbd8]">
                <h3 className="text-[#306EEC] font-extrabold text-[18px] mb-3">Before your visit</h3>
                <p className="text-[#6A6D71] text-[14px] mb-2">
                  Please have all <span className="text-[#306EEC] font-semibold">materials/fixtures on-site and ready</span>{" "}
                  (faucets, lights, shelves, hardware, etc.).
                </p>
                <p className="text-[#6A6D71] text-[14px] mb-2">
                  Your Fixter may arrive <span className="text-[#306EEC] font-semibold">up to 30 minutes before or after</span>{" "}
                  the booked time (traffic & job length).
                </p>
                <p className="text-[#6A6D71] text-[14px]">
                  Emergencies or questions? Call{" "}
                  <a href="tel:631-599-1363" className="text-[#306EEC] font-semibold hover:underline">
                    631-599-1363
                  </a>{" "}
                  or email{" "}
                  <a href="mailto:my@profixter.com" className="text-[#306EEC] font-semibold hover:underline">
                    my@profixter.com
                  </a>
                  .
                </p>
              </div>

              <button
                onClick={() => {
                  setShowModal(false);
                  window.location.reload();
                }}
                className="w-full h-[58px] rounded-[16px] bg-[#306EEC] text-white text-[18px] sm:text-[20px] font-extrabold hover:bg-[#2558c9] transition active:scale-[0.99]"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
