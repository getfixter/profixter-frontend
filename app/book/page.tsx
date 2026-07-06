"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { useAuth } from "@/lib/useAuth";
import {
  createOneTimeVisitCheckout,
  getMonthAvailability,
  getOneTimeVisitConfig,
  getTimeSlots,
} from "@/lib/booking-service";
import { compressImage } from "@/lib/compressImage";
import type { Address } from "@/lib/auth-service";
import type { OneTimeVisitConfig } from "@/lib/booking-service";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";

const ONE_TIME_SERVICE_OPTIONS = [
  "Replace Light Fixture",
  "Replace Faucet",
  "Patch Small Hole",
  "Paint Door",
  "TV Mounting",
  "Caulking & Sealing",
  "Shelves & Mirrors",
  "Assemble Small Furniture",
  "Wall Hangings",
  "Small Fix",
];

const AUTO_SELECT_MONTHS_TO_CHECK = 6;
const FALLBACK_DAYS_TO_CHECK = 120;

const FALLBACK_ONE_TIME_CONFIG: OneTimeVisitConfig = {
  enabled: true,
  priceCents: 9900,
  currency: "usd",
  durationMinutes: 90,
  holdMinutes: 30,
  cancellationPhone: "631-599-1363",
  allowedServices: ONE_TIME_SERVICE_OPTIONS,
  excludedServices: [
    "Appliance repair",
    "Full renovations",
    "Large electrical work",
    "Plumbing remodels",
    "Multi-day projects",
  ],
  promoNote: "",
};

function todayYMD() {
  return formatYMD(new Date());
}

function formatYMD(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime12(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(Math.max(0, cents) / 100);
}

function safeConfig(config: OneTimeVisitConfig) {
  return {
    ...config,
    cancellationPhone:
      config.cancellationPhone || FALLBACK_ONE_TIME_CONFIG.cancellationPhone,
    durationMinutes:
      Number.isFinite(config.durationMinutes) && config.durationMinutes > 0
        ? config.durationMinutes
        : FALLBACK_ONE_TIME_CONFIG.durationMinutes,
    priceCents:
      Number.isFinite(config.priceCents) && config.priceCents >= 0
        ? config.priceCents
        : FALLBACK_ONE_TIME_CONFIG.priceCents,
    currency: config.currency || FALLBACK_ONE_TIME_CONFIG.currency,
  };
}

function bookingDateFromParts(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function addressLabel(address: Address) {
  return `${address.label ? `${address.label}: ` : ""}${address.line1}, ${address.city} ${address.state} ${address.zip}`;
}

function resolveTaskValue(label: string, config: OneTimeVisitConfig) {
  const allowed = config.allowedServices || [];
  return (
    allowed.find((task) => task.toLowerCase() === label.toLowerCase()) ||
    label
  );
}

function calendarDays(currentMonth: Date) {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      ymd: formatYMD(date),
      muted: date.getMonth() !== currentMonth.getMonth(),
    };
  });
}

function dateFromYMD(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
    <div className="mb-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
        {step}
      </div>
      <h2 className="text-[20px] font-extrabold leading-tight text-[#0B1628]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-[13px] leading-5 text-[#64748B]">{subtitle}</p>
      )}
    </div>
  );
}

export default function BookPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const addresses = useMemo(() => user?.addresses ?? [], [user?.addresses]);
  const [config, setConfig] = useState<OneTimeVisitConfig>(
    FALLBACK_ONE_TIME_CONFIG
  );
  const [configError, setConfigError] = useState("");
  const [addressId, setAddressId] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [autoSelectingDate, setAutoSelectingDate] = useState(true);
  const [noAvailabilityMessage, setNoAvailabilityMessage] = useState("");
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const servicePickerRef = useRef<HTMLDivElement | null>(null);
  const autoSelectStartedRef = useRef(false);
  const availabilityByDateRef = useRef<Record<string, string[]>>({});

  useEffect(() => {
    trackEvent("book_started", { page: "/book" });
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("canceled") === "true") {
      trackEvent("one_time_checkout_returned", {
        page: "/book",
        result: "canceled",
        bookingId: searchParams.get("booking_id") || "",
      });
    }
  }, []);

  useEffect(() => {
    if (!servicePickerOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        servicePickerRef.current &&
        !servicePickerRef.current.contains(event.target as Node)
      ) {
        setServicePickerOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setServicePickerOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [servicePickerOpen]);

  useEffect(() => {
    let cancelled = false;
    getOneTimeVisitConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig(safeConfig(data));
        setConfigError("");
      })
      .catch(() => {
        if (!cancelled) {
          setConfig(FALLBACK_ONE_TIME_CONFIG);
          setConfigError("Using standard one-time visit details while settings load.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addressId && user?.defaultAddressId) {
      setAddressId(String(user.defaultAddressId));
    } else if (!addressId && addresses[0]?._id) {
      setAddressId(String(addresses[0]._id));
    }
  }, [addressId, addresses, user?.defaultAddressId]);

  function cacheDateSlots(ymd: string, nextSlots: string[]) {
    const next = { ...availabilityByDateRef.current, [ymd]: nextSlots };
    availabilityByDateRef.current = next;
    setAvailabilityByDate(next);
  }

  useEffect(() => {
    if (autoSelectStartedRef.current) return;
    autoSelectStartedRef.current = true;

    let cancelled = false;

    const rememberMonth = (
      days: Array<{ date: string; slots?: string[] }>
    ) => {
      if (!days.length) return;
      const next = { ...availabilityByDateRef.current };
      for (const day of days) {
        next[day.date] = day.slots || [];
      }
      availabilityByDateRef.current = next;
      setAvailabilityByDate(next);
    };

    const selectCandidate = (ymd: string, nextSlots: string[]) => {
      const date = dateFromYMD(ymd);
      if (!date) return;
      cacheDateSlots(ymd, nextSlots);
      setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setSelectedDate(ymd);
      setSelectedTime("");
      setSlots(nextSlots);
      setNoAvailabilityMessage("");
    };

    const findSoonestAvailableDate = async () => {
      setAutoSelectingDate(true);
      setNoAvailabilityMessage("");
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const startYmd = todayYMD();

      try {
        for (let offset = 0; offset < AUTO_SELECT_MONTHS_TO_CHECK; offset += 1) {
          const monthDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + offset,
            1
          );
          try {
            const month = await getMonthAvailability(monthKey(monthDate));
            if (cancelled) return;
            const monthDays = [...(month.days || [])].sort((a, b) =>
              a.date.localeCompare(b.date)
            );
            rememberMonth(monthDays);
            const candidate = monthDays.find(
              (day) => day.date >= startYmd && (day.slots || []).length > 0
            );
            if (candidate) {
              selectCandidate(candidate.date, candidate.slots || []);
              return;
            }
          } catch {
            break;
          }
        }

        for (let offset = 0; offset < FALLBACK_DAYS_TO_CHECK; offset += 1) {
          const ymd = formatYMD(addDays(startDate, offset));
          const data = await getTimeSlots(ymd);
          if (cancelled) return;
          const nextSlots = data.slots || [];
          cacheDateSlots(ymd, nextSlots);
          if (nextSlots.length > 0) {
            selectCandidate(ymd, nextSlots);
            return;
          }
        }

        if (!cancelled) {
          setSelectedDate("");
          setSelectedTime("");
          setSlots([]);
          setNoAvailabilityMessage(
            "No available dates are currently open. Please call 631-599-1363 and we will help you find the next option."
          );
        }
      } catch {
        if (!cancelled) {
          setSelectedDate("");
          setSelectedTime("");
          setSlots([]);
          setNoAvailabilityMessage(
            "We could not load available dates right now. Please refresh or call 631-599-1363."
          );
        }
      } finally {
        if (!cancelled) setAutoSelectingDate(false);
      }
    };

    void findSoonestAvailableDate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSelectedTime("");
    setSlots([]);
    if (!selectedDate) {
      setLoadingSlots(false);
      return;
    }

    const cachedSlots = availabilityByDateRef.current[selectedDate];
    if (cachedSlots) {
      setSlots(cachedSlots);
      setLoadingSlots(false);
      return;
    }

    setLoadingSlots(true);
    getTimeSlots(selectedDate)
      .then((data) => {
        if (cancelled) return;
        const nextSlots = data.slots || [];
        cacheDateSlots(selectedDate, nextSlots);
        setSlots(nextSlots);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load available times. Please try another date.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => String(address._id) === String(addressId)),
    [addresses, addressId]
  );
  const priceLabel = formatPrice(config.priceCents, config.currency);
  const days = useMemo(() => calendarDays(currentMonth), [currentMonth]);
  const today = todayYMD();
  const wordsCount = note.trim().split(/\s+/).filter(Boolean).length;
  const photoUrls = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos]
  );

  useEffect(() => {
    return () => {
      photoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoUrls]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: File[] = [];
    for (const file of Array.from(files)) {
      next.push(await compressImage(file));
    }
    setPhotos((current) => [...current, ...next].slice(0, 10));
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  }

  async function chooseDate(ymd: string) {
    if (ymd < today) return;

    setError("");
    setNoAvailabilityMessage("");

    const cachedSlots = availabilityByDateRef.current[ymd];
    if (cachedSlots) {
      if (cachedSlots.length === 0) return;
      const date = dateFromYMD(ymd);
      if (date) setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setSelectedDate(ymd);
      setSelectedTime("");
      setSlots(cachedSlots);
      return;
    }

    setLoadingSlots(true);
    try {
      const data = await getTimeSlots(ymd);
      const nextSlots = data.slots || [];
      cacheDateSlots(ymd, nextSlots);
      if (!nextSlots.length) return;

      const date = dateFromYMD(ymd);
      if (date) setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setSelectedDate(ymd);
      setSelectedTime("");
      setSlots(nextSlots);
    } catch {
      setError("Unable to load available times. Please try another date.");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submit() {
    setError("");
    if (!config.enabled) {
      setError("One-Time Handyman Visit booking is temporarily unavailable.");
      return;
    }
    if (!isAuthenticated) {
      setError("Please open My Home or add your property before booking.");
      return;
    }
    if (!addressId) {
      setError("Choose an address for the visit.");
      return;
    }
    if (!selectedTask) {
      setError("Choose what you need help with.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError("Choose an available date and time.");
      return;
    }
    if (wordsCount < 3) {
      setError("Describe the task in at least a few words.");
      return;
    }
    if (!photos.length) {
      setError("Add at least one photo so our team can prepare.");
      return;
    }

    const bookingDate = bookingDateFromParts(selectedDate, selectedTime);
    if (!bookingDate) {
      setError("Choose a valid date and time.");
      return;
    }

    setLoading(true);
    try {
      const taskForApi = resolveTaskValue(selectedTask, config);
      trackInitiateCheckout({
        product: "one_time_handyman_visit",
        selectedTask: taskForApi,
        price: config.priceCents / 100,
      });
      trackEvent("one_time_checkout_started", {
        selectedTask: taskForApi,
        date: selectedDate,
        time: selectedTime,
      });
      const result = await createOneTimeVisitCheckout({
        addressId,
        selectedTask: taskForApi,
        date: bookingDate.toISOString(),
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        note: note.trim(),
        images: photos,
      });
      window.location.href = result.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F7F2] text-[#0B1628]">
      <Header />

      <section className="relative w-full overflow-hidden pb-6 pt-5 sm:pb-14 sm:pt-14 lg:pt-16">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="mb-5 max-w-[820px] sm:mb-10">
            <div className="mb-3 inline-flex items-center gap-2.5 rounded-full bg-white px-3.5 py-1.5 shadow-sm sm:mb-4 sm:px-4 sm:py-2">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full bg-[#306EEC]"
                style={{ boxShadow: "0 0 8px rgba(48,110,236,0.7)" }}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                One-Time Visit
              </span>
            </div>
            <h1 className="mb-3 text-[40px] font-black leading-[0.92] tracking-[-0.052em] text-[#071325] sm:mb-4 sm:text-[72px] sm:leading-[0.88] sm:tracking-[-0.06em] lg:text-[86px]">
              Book a handyman.
            </h1>
            <p className="max-w-[640px] text-[15px] font-semibold leading-6 text-[#475569] sm:text-[20px] sm:leading-7">
              Choose the job, pick a time, add photos, and pay securely. We confirm after review.
            </p>
            {configError && (
              <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                {configError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-6">
            <div className="order-2 lg:order-1 lg:col-span-5">
              <div className="rounded-[24px] bg-white/95 p-3.5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex items-center justify-between sm:mb-5">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF] active:scale-95"
                  >
                    &lt;
                  </button>
                  <div className="text-[16px] font-extrabold text-[#0B1628] sm:text-[20px]">
                    {monthLabel(currentMonth)}
                  </div>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(
                          currentMonth.getFullYear(),
                          currentMonth.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF] active:scale-95"
                  >
                    &gt;
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-7 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => (
                    <div
                      key={day}
                      className={`text-[12px] font-bold ${
                        index === 0 ? "text-[#EF4444]" : "text-[#94A3B8]"
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {days.map((day) => {
                    const knownSlots = availabilityByDate[day.ymd];
                    const disabled =
                      day.ymd < today ||
                      (knownSlots !== undefined && knownSlots.length === 0);
                    const selected = day.ymd === selectedDate;
                    return (
                      <button
                        key={day.ymd}
                        type="button"
                        disabled={disabled}
                        onClick={() => chooseDate(day.ymd)}
                        className={[
                          "mx-auto grid h-9 w-9 place-items-center rounded-[12px] text-[14px] font-semibold transition-all duration-150 sm:h-10 sm:w-10 sm:text-[15px]",
                          day.muted ? "text-[#C5CBD8]" : "",
                          disabled ? "cursor-not-allowed text-[#C5CBD8]" : "",
                          !disabled && !selected
                            ? "bg-[#EEF5FF] text-[#1D4ED8] hover:scale-105 hover:bg-[#DBEAFE]"
                            : "",
                          selected
                            ? "scale-105 bg-[#306EEC] text-white shadow-[0_8px_24px_rgba(48,110,236,0.35)]"
                            : "",
                        ].join(" ")}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 rounded-[10px] border-l-2 border-[#C8D3E3] bg-[#F7FAFE] px-3.5 py-2.5 text-[13px] font-semibold text-[#34435C] sm:px-4 sm:py-3 sm:text-[14px]">
                {selectedDate
                  ? `Selected date: ${dayLabel(selectedDate)}`
                  : autoSelectingDate
                    ? "Finding the soonest available date..."
                    : "No available date selected yet."}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[priceLabel, `${config.durationMinutes} minutes`, "Tools included"].map((item) => (
                  <div key={item} className="rounded-[10px] border-l-2 border-[#D6DEE9] bg-[#F7FAFE] px-3.5 py-2.5 text-[12px] font-extrabold text-[#34435C] sm:px-4 sm:py-3 sm:text-[13px]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
              <div className="order-1 rounded-[24px] bg-white/95 p-3.5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:order-none">
                {isLoading ? (
                  <div className="py-12 text-center text-[14px] font-semibold text-[#64748B]">
                    Loading your account...
                  </div>
                ) : !isAuthenticated ? (
                  <div className="space-y-4 py-6 text-center">
                    <StepHeader
                      step="Home profile"
                      title="Add your property first"
                      subtitle="We need a home profile for your address, photos, payment status, reminders, and booking history."
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <Link
                        href="/signin"
                        className="rounded-[14px] bg-[#306EEC] px-5 py-3 text-[14px] font-extrabold text-white"
                      >
                        My Home
                      </Link>
                      <Link
                        href="/signup"
                        className="rounded-[14px] border border-[#C5CBD8] px-5 py-3 text-[14px] font-extrabold text-[#0B1628]"
                      >
                        Add Property
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <StepHeader
                      step="1 Details"
                      title="Visit details"
                      subtitle="Choose the home and the type of small job."
                    />

                    <div>
                      <div className="mb-2 text-[13px] font-semibold text-[#0B1628]">
                        Booking address
                      </div>
                      <select
                        value={addressId}
                        onChange={(event) => setAddressId(event.target.value)}
                        className="min-h-[48px] w-full rounded-[12px] border border-[#C5CBD8] bg-[#F8FAFF] px-3 py-2 text-[14px] font-semibold text-[#0B1628] outline-none transition focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15"
                      >
                        <option value="">Choose address</option>
                        {addresses.map((address) => (
                          <option key={address._id} value={address._id}>
                            {addressLabel(address)}
                          </option>
                        ))}
                      </select>
                      {!addresses.length && (
                        <Link
                          href="/account?tab=personal"
                          className="mt-2 inline-flex text-[13px] font-bold text-[#306EEC]"
                        >
                          Add an address in your account -&gt;
                        </Link>
                      )}
                    </div>

                    <div ref={servicePickerRef} className="relative">
                      <div className="mb-2 text-[13px] font-semibold text-[#0B1628]">
                        What do you need help with?
                      </div>
                      <button
                        type="button"
                        onClick={() => setServicePickerOpen((open) => !open)}
                        aria-expanded={servicePickerOpen}
                        className={[
                          "group flex min-h-[62px] w-full items-center justify-between gap-3 rounded-[20px] bg-[#F7F8FB] px-3.5 py-3 text-left shadow-inner transition duration-200 hover:bg-white hover:shadow-[0_18px_48px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-4 focus:ring-[#306EEC]/15 sm:min-h-[70px] sm:gap-4 sm:rounded-[24px] sm:px-4",
                          selectedTask ? "ring-1 ring-[#D7E4FF]" : "ring-1 ring-[#E5E9F2]",
                        ].join(" ")}
                      >
                        <span className="min-w-0">
                          <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#7C879A]">
                            One-Time Visit task
                          </span>
                          <span className={`mt-1 block truncate text-[16px] font-black tracking-[-0.018em] sm:text-[18px] sm:tracking-[-0.02em] ${selectedTask ? "text-[#0B1628]" : "text-[#7C879A]"}`}>
                            {selectedTask || "Choose a small job"}
                          </span>
                        </span>
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0B1628] shadow-sm transition group-hover:scale-105 sm:h-10 sm:w-10">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d={servicePickerOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.2"
                            />
                          </svg>
                        </span>
                      </button>

                      {servicePickerOpen && (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-[60] bg-[#071325]/20 backdrop-blur-[2px] sm:hidden"
                            aria-label="Close service picker"
                            onClick={() => setServicePickerOpen(false)}
                          />
                          <div className="fixed inset-x-3 bottom-3 z-[70] rounded-[26px] bg-white p-2.5 shadow-[0_30px_90px_rgba(7,19,37,0.28)] sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-[calc(100%+10px)] sm:z-30 sm:rounded-[26px] sm:p-3">
                            <div className="mb-2 flex items-center justify-between px-2 py-1">
                              <div>
                                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#306EEC]">
                                  Select service
                                </div>
                                <div className="mt-0.5 text-[13px] font-semibold text-[#64748B]">
                                  One tap to choose.
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setServicePickerOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F6FA] text-[#34435C]"
                                aria-label="Close service picker"
                              >
                                &times;
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {ONE_TIME_SERVICE_OPTIONS.map((task) => {
                                const active = selectedTask === task;
                                return (
                                  <button
                                    key={task}
                                    type="button"
                                    onClick={() => {
                                      setSelectedTask(task);
                                      setServicePickerOpen(false);
                                    }}
                                    className={[
                                      "min-h-[52px] rounded-[16px] px-3 text-left text-[12px] font-black leading-4 transition duration-150 active:scale-[0.98] sm:min-h-[58px] sm:rounded-[18px] sm:text-[13px]",
                                      active
                                        ? "bg-[#0B1628] text-white shadow-[0_16px_34px_rgba(11,22,40,0.22)]"
                                        : "bg-[#F5F7FA] text-[#0B1628] hover:bg-[#EEF4FF]",
                                    ].join(" ")}
                                  >
                                    {task}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="rounded-[20px] border border-[#E5E9F2] bg-[#F8FAFF] p-3.5 sm:rounded-[22px] sm:p-4">
                      <div className="text-[14px] font-black text-[#0B1628]">
                        Don&apos;t see your task?
                      </div>
                      <p className="mt-1 text-[13px] font-semibold leading-5 text-[#64748B]">
                        This service is designed for specific small handyman jobs. If your project is different or larger,
                        request a free Renovation Estimate instead.
                      </p>
                      <Link
                        href="/projects#estimate"
                        onClick={() =>
                          trackEvent("estimate_cta_clicked", {
                            placement: "book_service_selector_note",
                          })
                        }
                        className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-[13px] font-black text-[#0B1628] shadow-sm ring-1 ring-[#DDE4F0] transition hover:-translate-y-0.5 hover:bg-[#EEF4FF]"
                      >
                        Request Renovation Estimate -&gt;
                      </Link>
                    </div>

                    <div className="overflow-hidden rounded-[22px] bg-[#0B1628] p-3.5 text-white shadow-[0_18px_54px_rgba(7,19,37,0.14)] sm:rounded-[26px] sm:p-5 sm:shadow-[0_24px_70px_rgba(7,19,37,0.16)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                            Already a Member?
                          </div>
                          <h3 className="mt-2 text-[19px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[22px] sm:leading-[1.02] sm:tracking-[-0.035em]">
                            Members do not pay {priceLabel} every visit.
                          </h3>
                        </div>
                        <Link
                          href="/membership#plans"
                          onClick={() =>
                            trackEvent("membership_cta_clicked", {
                              placement: "book_service_selector_card",
                            })
                          }
                          className="hidden flex-shrink-0 rounded-full bg-white px-4 py-2 text-[12px] font-black text-[#0B1628] transition hover:bg-[#EEF4FF] sm:inline-flex"
                        >
                          Compare
                        </Link>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {[
                          "Better long-term value",
                          "More service flexibility",
                          "Priority scheduling and project discounts may be included",
                        ].map((benefit) => (
                          <div key={benefit} className="flex items-center gap-2 text-[13px] font-semibold text-white/78">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#86EFAC]">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M5 12.5l4 4 10-10"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2.6"
                                />
                              </svg>
                            </span>
                            {benefit}
                          </div>
                        ))}
                      </div>
                      <Link
                        href="/membership#plans"
                        onClick={() =>
                          trackEvent("membership_cta_clicked", {
                            placement: "book_service_selector_card_mobile",
                          })
                        }
                        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-white text-[13px] font-black text-[#0B1628] transition hover:bg-[#EEF4FF] sm:hidden"
                      >
                        Compare Membership
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <>
                  <div className="order-3 rounded-[24px] bg-white/95 p-3.5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:order-none">
                    <StepHeader
                      step="2 Time"
                      title="Choose a time"
                      subtitle={`Each visit is up to ${config.durationMinutes} minutes.`}
                    />

                    {autoSelectingDate ? (
                      <div className="rounded-[16px] border border-[#D9E4FF] bg-[#F0F7FF] px-4 py-5 text-center text-[14px] font-semibold text-[#475569]">
                        Finding the soonest available appointment...
                      </div>
                    ) : noAvailabilityMessage ? (
                      <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-5 text-center text-[14px] font-semibold text-amber-800">
                        {noAvailabilityMessage}
                      </div>
                    ) : loadingSlots ? (
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                          <div key={item} className="h-[58px] animate-pulse rounded-[18px] bg-[#F1F5F9]" />
                        ))}
                      </div>
                    ) : slots.length ? (
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {slots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={[
                              "min-h-[50px] rounded-[16px] border text-[13px] font-extrabold transition active:scale-[0.99] sm:min-h-[58px] sm:rounded-[18px] sm:text-[14px]",
                              selectedTime === slot
                                ? "border-[#306EEC] bg-[#306EEC] text-white shadow-[0_10px_28px_rgba(48,110,236,0.28)]"
                                : "border-[#E5E9F2] bg-[#F8FAFF] text-[#1D4ED8] hover:border-[#D9E4FF] hover:bg-[#EEF5FF]",
                            ].join(" ")}
                          >
                            {formatTime12(slot)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-5 text-center text-[14px] text-[#64748B]">
                        Choose an available date to see times.
                      </div>
                    )}
                  </div>

                  <div className="order-4 rounded-[24px] bg-white/95 p-3.5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:order-none">
                    <StepHeader
                      step="3 Notes / Photos"
                      title="Tell us what you need"
                      subtitle="Add a short note and at least one photo so the team can prepare."
                    />

                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={4}
                      placeholder="Example: Replace the bathroom faucet. I already bought the new faucet and shutoff valves are under the sink."
                      className="min-h-[110px] w-full resize-none rounded-[16px] border border-[#C5CBD8] bg-[#F8FAFF] p-3.5 text-[14px] text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-[#94A3B8]">Minimum 3 words</span>
                      <span className={`text-[11px] font-bold ${wordsCount >= 3 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {wordsCount} {wordsCount === 1 ? "word" : "words"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-[13px] font-semibold text-[#0B1628]">
                        Photos <span className="text-[#DC2626]">*</span>
                        <span className="ml-1 font-normal text-[#64748B]">
                          required - helps us prepare.
                        </span>
                      </div>
                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#C5CBD8] bg-[#F8FAFF] text-[14px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC]"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                            />
                            <circle
                              cx="12"
                              cy="13"
                              r="4"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                          </svg>
                          Take Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#C5CBD8] bg-[#F8FAFF] text-[14px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC]"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <circle
                              cx="8.5"
                              cy="8.5"
                              r="1.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <path
                              d="M21 15l-5-5L5 21"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                            />
                          </svg>
                          Add Photos{photos.length > 0 ? ` (${photos.length})` : ""}
                        </button>
                      </div>
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => {
                          handleFiles(event.target.files);
                          event.currentTarget.value = "";
                        }}
                        className="hidden"
                      />
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          handleFiles(event.target.files);
                          event.currentTarget.value = "";
                        }}
                        className="hidden"
                      />
                      {photos.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
                          {photos.map((_photo, index) => (
                            <div
                              key={`${_photo.name}-${index}`}
                              className="relative overflow-hidden rounded-[12px] border border-[#E5E9F2] bg-[#F8FAFF]"
                              style={{ aspectRatio: "1" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrls[index] || ""}
                                alt={`Task photo ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                aria-label="Remove photo"
                                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[12px] font-bold leading-none text-white transition hover:bg-black/75"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="order-5 rounded-[24px] bg-white/95 p-3.5 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:order-none">
                    <StepHeader
                      step="4 Payment"
                      title="Review and continue"
                      subtitle="Payment starts the admin approval review and holds your selected slot during checkout."
                    />

                    <div className="mb-4 grid gap-2 text-[14px] text-[#475569]">
                      <div className="flex justify-between gap-4 rounded-[14px] bg-[#F8FAFF] px-4 py-3">
                        <span>Visit</span>
                        <strong className="text-right text-[#0B1628]">
                          {priceLabel} / {config.durationMinutes} minutes
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 rounded-[14px] bg-[#F8FAFF] px-4 py-3">
                        <span>Help needed</span>
                        <strong className="text-right text-[#0B1628]">
                          {selectedTask || "Not selected"}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 rounded-[14px] bg-[#F8FAFF] px-4 py-3">
                        <span>Time</span>
                        <strong className="text-right text-[#0B1628]">
                          {selectedDate ? dayLabel(selectedDate) : "Not selected"}
                          {selectedTime ? ` at ${formatTime12(selectedTime)}` : ""}
                        </strong>
                      </div>
                      {selectedAddress && (
                        <div className="rounded-[14px] bg-[#F8FAFF] px-4 py-3 text-[13px] font-semibold text-[#64748B]">
                          Booking for {addressLabel(selectedAddress)}
                        </div>
                      )}
                    </div>

                    <div className="mb-4 rounded-[16px] border border-[#D9E4FF] bg-[#F0F7FF] px-4 py-3 text-[13px] leading-6 text-[#475569]">
                      You do not pay anything else for the visit itself. If materials are needed, please have them ready or approved separately. Profixter brings the tools.
                    </div>

                    <div className="mb-4 rounded-[16px] border border-[#E5E9F2] bg-[#F8FAFF] px-4 py-3 text-[13px] leading-6 text-[#64748B]">
                      One-Time Visit reschedule or cancellation requests are handled by phone and require admin approval. Call{" "}
                      <a
                        href={`tel:${config.cancellationPhone}`}
                        className="font-extrabold text-[#306EEC]"
                      >
                        {config.cancellationPhone}
                      </a>{" "}
                      if plans change.
                    </div>

                    {error && (
                      <div className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={submit}
                      disabled={loading || !config.enabled}
                      className="h-[50px] w-full rounded-[15px] bg-[#306EEC] text-[15px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0 active:scale-[0.99] sm:h-[54px] sm:rounded-[16px] sm:text-[16px]"
                      style={{ boxShadow: !loading && config.enabled ? "0 16px 48px rgba(48,110,236,0.30)" : undefined }}
                    >
                      {loading
                        ? "Opening secure checkout..."
                        : config.enabled
                          ? "Continue to payment"
                          : "Booking temporarily unavailable"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-3 px-4 pb-8 sm:gap-4 sm:px-6 sm:pb-10 lg:grid-cols-3 lg:px-8">
        <div className="rounded-[24px] bg-white/88 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
          <h2 className="text-[18px] font-extrabold text-[#0B1628]">What your visit includes</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
            One focused handyman visit up to {config.durationMinutes} minutes. The visit price covers the visit itself, and Profixter brings the tools.
          </p>
        </div>
        <div className="rounded-[24px] bg-white/88 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
          <h2 className="text-[18px] font-extrabold text-[#0B1628]">Before we arrive</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
            Please prepare or provide materials if materials are needed. Appliance repair is not offered. Larger or multi-day work should use a{" "}
            <Link
              href="/projects"
              onClick={() => trackEvent("estimate_cta_clicked", { placement: "book_scope_card" })}
              className="font-extrabold text-[#306EEC]"
            >
              Project Estimate
            </Link>
            .
          </p>
        </div>
        <div className="rounded-[24px] bg-white/88 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
          <h2 className="text-[18px] font-extrabold text-[#0B1628]">What happens after payment</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
            Admin reviews the paid request and sends confirmation shortly. If we cannot approve the job, cannot complete it within scope, or must cancel before service, you receive a full refund. One-Time Visit changes are handled by calling {config.cancellationPhone}.
          </p>
        </div>
      </section>

      {isAuthenticated && (
        <section className="mx-auto max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-[28px] bg-[#EEF5FF] p-5 shadow-[0_18px_54px_rgba(48,110,236,0.08)]">
            <h2 className="text-[18px] font-extrabold text-[#0B1628]">Your bookings</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748B]">
              You can review One-Time Visits and Member visits together from your account.
            </p>
            <Link
              href="/account?tab=bookings"
              className="mt-4 inline-flex h-[44px] items-center rounded-[14px] bg-[#306EEC] px-5 text-[14px] font-extrabold text-white"
            >
              View my bookings
            </Link>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}
