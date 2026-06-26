"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { useAuth } from "@/lib/useAuth";
import {
  createOneTimeVisitCheckout,
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
  "Other (Await for confirmation)",
];

const MEMBERSHIP_UPSELL_BENEFITS = [
  "Request ongoing handyman help without paying $99 each visit",
  "Unlock more service flexibility for regular home maintenance",
  "Priority scheduling, project discounts, and rush visit benefits may be included depending on plan",
];

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
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayYMD());
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setSelectedTime("");
    setSlots([]);
    if (!selectedDate) return;

    setLoadingSlots(true);
    getTimeSlots(selectedDate)
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots || []);
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

  async function submit() {
    setError("");
    if (!config.enabled) {
      setError("One-Time Handyman Visit booking is temporarily unavailable.");
      return;
    }
    if (!isAuthenticated) {
      setError("Please sign in or create an account before booking.");
      return;
    }
    if (!addressId) {
      setError("Choose an address for the visit.");
      return;
    }
    if (!selectedTask) {
      setError("Choose the service type you want help with.");
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
    <main className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <Header />

      <section className="relative w-full overflow-hidden pt-6 pb-8 sm:pt-12 sm:pb-14 lg:pt-14">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="mb-5 max-w-[760px] sm:mb-8">
            <div className="mb-3 inline-flex items-center gap-2.5 rounded-[8px] border border-[#D9E4FF] bg-white px-3 py-2">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full bg-[#306EEC]"
                style={{ boxShadow: "0 0 8px rgba(48,110,236,0.7)" }}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                One-Time Visit
              </span>
            </div>
            <h1 className="mb-2 text-[30px] font-black leading-[1.02] text-[#0B1628] sm:text-[42px] lg:text-[52px]">
              Book one handyman visit
            </h1>
            <p className="max-w-[620px] text-[14px] leading-relaxed text-[#475569] sm:text-[16px]">
              Choose a service type, pick an available time, add notes and photos, then pay securely. Admin approval happens after payment and confirmation follows shortly.
            </p>
            {configError && (
              <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                {configError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-6">
            <div className="order-2 lg:order-1 lg:col-span-5">
              <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5">
                <div className="mb-5 flex items-center justify-between">
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
                  <div className="text-[18px] font-extrabold text-[#0B1628] sm:text-[20px]">
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
                    const disabled = day.ymd < today;
                    const selected = day.ymd === selectedDate;
                    return (
                      <button
                        key={day.ymd}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedDate(day.ymd)}
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

              <div className="mt-3 rounded-[14px] border border-[#D9E4FF] bg-white px-4 py-3 text-[14px] font-semibold text-[#0B1628]">
                Selected date: {dayLabel(selectedDate)}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[priceLabel, `${config.durationMinutes} minutes`, "Tools included"].map((item) => (
                  <div key={item} className="rounded-[14px] border border-[#E5E9F2] bg-white px-4 py-3 text-[13px] font-extrabold text-[#0B1628]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
              <div className="order-1 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
                {isLoading ? (
                  <div className="py-12 text-center text-[14px] font-semibold text-[#64748B]">
                    Loading your account...
                  </div>
                ) : !isAuthenticated ? (
                  <div className="space-y-4 py-6 text-center">
                    <StepHeader
                      step="Account"
                      title="Sign in to book"
                      subtitle="We need an account for your address, photos, payment status, reminders, and booking history."
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <Link
                        href="/signin"
                        className="rounded-[14px] bg-[#306EEC] px-5 py-3 text-[14px] font-extrabold text-white"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/signup"
                        className="rounded-[14px] border border-[#C5CBD8] px-5 py-3 text-[14px] font-extrabold text-[#0B1628]"
                      >
                        Create account
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

                    <div>
                      <div className="mb-2 text-[13px] font-semibold text-[#0B1628]">
                        Service type
                      </div>
                      <select
                        value={selectedTask}
                        onChange={(event) => setSelectedTask(event.target.value)}
                        className="min-h-[48px] w-full rounded-[12px] border border-[#C5CBD8] bg-[#F8FAFF] px-3 py-2 text-[14px] font-semibold text-[#0B1628] outline-none transition focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15"
                      >
                        <option value="">Select service type</option>
                        {ONE_TIME_SERVICE_OPTIONS.map((task) => (
                          <option key={task} value={task}>
                            {task}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <>
                  <div className="order-3 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
                    <StepHeader
                      step="2 Time"
                      title="Choose a time"
                      subtitle={`Each visit is up to ${config.durationMinutes} minutes.`}
                    />

                    {loadingSlots ? (
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
                              "min-h-[58px] rounded-[18px] border text-[14px] font-extrabold transition active:scale-[0.99]",
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
                        No times available for this date. Try a different day.
                      </div>
                    )}
                  </div>

                  <div className="order-4 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
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

                  <div className="order-5 rounded-[12px] border border-[#D7DEE9] bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)] sm:p-5 lg:order-none">
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
                        <span>Service type</span>
                        <strong className="text-right text-[#0B1628]">
                          {selectedTask || "Not selected"}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-4 rounded-[14px] bg-[#F8FAFF] px-4 py-3">
                        <span>Time</span>
                        <strong className="text-right text-[#0B1628]">
                          {dayLabel(selectedDate)}
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
                      className="h-[54px] w-full rounded-[16px] bg-[#306EEC] text-[16px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0 active:scale-[0.99]"
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

      <section className="mx-auto max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[12px] border border-[#D7DEE9] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
            <div className="p-5 sm:p-6 lg:p-7">
              <div className="mb-3 inline-flex items-center rounded-full bg-[#EEF5FF] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#306EEC]">
                Better for ongoing help
              </div>
              <h2 className="text-[24px] font-black leading-tight text-[#0B1628] sm:text-[30px]">
                Planning more than one visit? Membership may save you money.
              </h2>
              <p className="mt-3 max-w-[640px] text-[14px] leading-6 text-[#64748B] sm:text-[15px]">
                A One-Time Visit is great for one small job or trying Profixter once. Membership is built for ongoing home maintenance, regular help, and a team that learns your home over time. We care about Members like family.
              </p>

              <div className="mt-5 grid gap-2">
                {MEMBERSHIP_UPSELL_BENEFITS.map((benefit) => (
                  <div key={benefit} className="flex gap-2 rounded-[14px] bg-[#F8FAFF] px-4 py-3">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="mt-0.5 flex-shrink-0 text-[#306EEC]"
                    >
                      <path
                        d="M5 12.5l4 4 10-10"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.4"
                      />
                    </svg>
                    <span className="text-[13px] font-semibold leading-5 text-[#475569]">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E5E9F2] bg-[#F8FAFF] p-5 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
              <div className="rounded-[16px] border border-[#D9E4FF] bg-white p-5">
                <div className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#306EEC]">
                  Quick comparison
                </div>
                <div className="mt-4 space-y-3 text-[14px] leading-6 text-[#475569]">
                  <p>
                    <span className="font-extrabold text-[#0B1628]">One-Time Visit:</span>{" "}
                    one small job, {priceLabel}, up to {config.durationMinutes} minutes.
                  </p>
                  <p>
                    <span className="font-extrabold text-[#0B1628]">Membership:</span>{" "}
                    better long-term value if your home needs help more than once.
                  </p>
                </div>
                <Link
                  href="/membership"
                  onClick={() =>
                    trackEvent("membership_cta_clicked", {
                      placement: "book_membership_upsell",
                    })
                  }
                  className="mt-5 inline-flex h-[48px] w-full items-center justify-center rounded-[14px] bg-[#306EEC] px-5 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#2558c9] active:scale-[0.99]"
                >
                  Compare Membership
                </Link>
                <p className="mt-3 text-center text-[12px] leading-5 text-[#64748B]">
                  This will not interrupt your One-Time Visit checkout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          <h2 className="text-[18px] font-extrabold text-[#0B1628]">What your visit includes</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
            One focused handyman visit up to {config.durationMinutes} minutes. The visit price covers the visit itself, and Profixter brings the tools.
          </p>
        </div>
        <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
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
        <div className="rounded-[12px] border border-[#D7DEE9] bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          <h2 className="text-[18px] font-extrabold text-[#0B1628]">What happens after payment</h2>
          <p className="mt-3 text-[14px] leading-6 text-[#64748B]">
            Admin reviews the paid request and sends confirmation shortly. If we cannot approve the job, cannot complete it within scope, or must cancel before service, you receive a full refund. One-Time Visit changes are handled by calling {config.cancellationPhone}.
          </p>
        </div>
      </section>

      {isAuthenticated && (
        <section className="mx-auto max-w-[1280px] px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-[12px] border border-[#D9E4FF] bg-[#F0F7FF] p-5">
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
