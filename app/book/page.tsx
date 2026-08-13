"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { getBookableSlots, normalizeDayAvailability } from "@/lib/booking-calendar-availability";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";
import { useSearchParams } from "next/navigation";
import BookingSection from "@/app/components/sections/BookingSection";
import VisitTypeNav, { parseVisitType } from "@/app/components/booking/VisitTypeNav";
import { YourFixterRow } from "@/app/components/fixter/YourFixter";
import BookingsSection from "@/app/components/account/BookingsSection";
import PriorityVisitPanel from "@/app/components/booking/PriorityVisitPanel";
import MembershipUpgradePrompt, { normalizePlanKey } from "@/app/components/membership/MembershipUpgradePrompt";
import { hasActiveMembership as hasActiveMembershipFor } from "@/lib/auth-routing";

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
const CUSTOMER_MOBILE_NAV_HEIGHT_PX = 76;

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

function slotsForAvailabilityDay(day: Parameters<typeof normalizeDayAvailability>[0]) {
  return getBookableSlots(normalizeDayAvailability(day)).map((slot) => slot.time);
}

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
      <h2 className="text-[19px] font-extrabold leading-tight text-[#0B1628]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-[13px] leading-5 text-[#64748B]">{subtitle}</p>
      )}
    </div>
  );
}


/**
 * The existing $99 one-time / extra visit flow, unchanged.
 *
 * Renamed from BookPage and given a slot for the visit-type navigation. Nothing
 * else in this component was modified: the Stripe checkout, availability calls,
 * slot handling, photo requirement and validation are exactly as they were.
 */
function AdditionalVisitBooking({ navSlot }: { navSlot?: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const addresses = useMemo(() => user?.addresses ?? [], [user?.addresses]);
  const [config, setConfig] = useState<OneTimeVisitConfig>(
    FALLBACK_ONE_TIME_CONFIG
  );
  const [configError, setConfigError] = useState("");
  const [addressId, setAddressId] = useState("");
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
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
  const servicePickerTriggerRef = useRef<HTMLButtonElement | null>(null);
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

    const previousOverflow = document.body.style.overflow;
    const trigger = servicePickerTriggerRef.current;
    document.body.style.overflow = "hidden";

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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      trigger?.focus({ preventScroll: true });
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
          setConfigError("Using standard booking details while settings load.");
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
      days: Array<Parameters<typeof normalizeDayAvailability>[0] & { date: string }>
    ) => {
      if (!days.length) return;
      const next = { ...availabilityByDateRef.current };
      for (const day of days) {
        next[day.date] = slotsForAvailabilityDay(day);
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
              (day) => day.date >= startYmd && slotsForAvailabilityDay(day).length > 0
            );
            if (candidate) {
              selectCandidate(candidate.date, slotsForAvailabilityDay(candidate));
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
          const nextSlots = slotsForAvailabilityDay(data);
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
        const nextSlots = slotsForAvailabilityDay(data);
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
  const hasActiveMembership = useMemo(
    () => addresses.some((address) => Boolean(address.hasActiveSubscription)),
    [addresses]
  );
  /** The member's current plan, for the contextual upgrade suggestion. */
  const currentPlanKey = useMemo(() => {
    const subscribed = addresses.find((address) => Boolean(address.hasActiveSubscription));
    return normalizePlanKey(subscribed?.plan);
  }, [addresses]);
  const priceLabel = formatPrice(config.priceCents, config.currency);
  const pageCopy = useMemo(
    () =>
      hasActiveMembership
        ? {
            navLabel: "Book an Extra Visit",
            title: "Book an Extra Visit",
            subtitle:
              "Need another visit before your membership renews? Book an additional visit anytime.",
            taskEyebrow: "Extra visit task",
            unavailable: "Extra visit booking is temporarily unavailable.",
            visitLabel: "Extra visit",
            includeText: `An additional handyman visit up to ${config.durationMinutes} minutes. The visit price covers the visit itself, and Profixter brings the tools.`,
            changeText: "Changes to this extra visit are handled by phone and require admin approval. Call",
            bookingsText:
              "You can review extra visits and included membership visits together from your account.",
          }
        : {
            navLabel: "Book a Handyman",
            title: "Book a Handyman",
            subtitle:
              "Need help around the house? Book a one-time handyman visit in just a few minutes. If you expect to need ongoing help, check out our Membership first.",
            taskEyebrow: "Handyman task",
            unavailable: "Handyman booking is temporarily unavailable.",
            visitLabel: "Visit",
            includeText: `One focused handyman visit up to ${config.durationMinutes} minutes. The visit price covers the visit itself, and Profixter brings the tools.`,
            changeText: "Visit changes are handled by phone and require admin approval. Call",
            bookingsText: "You can review your handyman visits from your account.",
          },
    [config.durationMinutes, hasActiveMembership]
  );
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
      const nextSlots = slotsForAvailabilityDay(data);
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
      setError(pageCopy.unavailable);
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
      {navSlot}

      <section className="relative w-full overflow-hidden pb-5 pt-3 sm:pb-12 sm:pt-10 lg:pt-12">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="mb-3 max-w-[820px] sm:mb-6">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#306EEC] sm:text-[11px]">
              {hasActiveMembership ? "Extra Visit" : "One-Time Visit"}
            </div>
            {/* A shade under the marketing pages: this headline runs long and
                the calendar below it is what the customer came for. */}
            <h1 className="text-[26px] font-black leading-tight tracking-[-0.035em] text-[#071325] sm:text-[36px] lg:text-[40px]">
              {hasActiveMembership ? "Book an Extra Visit" : "Book a one-time handyman visit"}
            </h1>
            <p className="mt-1 max-w-[640px] text-[11px] font-semibold leading-4 text-[#475569] sm:text-[14px] sm:leading-5">
              {hasActiveMembership
                ? "Book an additional visit anytime before your membership renews."
                : "One 90-minute visit, no membership needed. We bring the tools."}
            </p>
            {hasActiveMembership && <Link href="/book?visit=membership" className="mt-1 inline-flex text-[10px] font-bold text-[#306EEC] sm:text-[12px]">Need your included visit? Book here</Link>}
            {configError && (
              <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                {configError}
              </div>
            )}
          </div>

          {false && !hasActiveMembership && (
            <div className="mb-5 overflow-hidden rounded-[16px] border border-[#E5E9F2] bg-white/92 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.06)] sm:mb-7 sm:rounded-[18px] sm:p-6 lg:p-7">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <h2 className="text-[23px] font-black leading-[1.02] tracking-[-0.035em] text-[#0B1628] sm:text-[30px] sm:tracking-[-0.045em]">
                    Own your home?
                  </h2>
                  <p className="mt-3 max-w-[760px] text-[14px] font-semibold leading-6 text-[#475569] sm:text-[16px] sm:leading-7">
                    If you expect to need help more than once, a Profixter Membership is usually the better value.
                  </p>
                  <p className="mt-2 max-w-[780px] text-[14px] font-semibold leading-6 text-[#475569] sm:text-[16px] sm:leading-7">
                    Members don&apos;t pay for every visit, receive priority scheduling, and can request handyman service throughout the year.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <Link
                    href="/membership/plans"
                    onClick={() =>
                      trackEvent("membership_cta_clicked", {
                        placement: "book_non_member_recommendation",
                      })
                    }
                    className="inline-flex h-12 items-center justify-center rounded-full bg-[#0B1628] px-6 text-[14px] font-black text-white shadow-[0_14px_34px_rgba(11,22,40,0.18)] transition hover:-translate-y-0.5 hover:bg-[#1B2A44] active:translate-y-0"
                  >
                    Become a Member
                  </Link>
                  <a
                    href="#booking-form"
                    onClick={() =>
                      trackEvent("one_time_continue_clicked", {
                        placement: "book_non_member_recommendation",
                      })
                    }
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[#D7DEEA] bg-white px-6 text-[14px] font-black text-[#0B1628] transition hover:border-[#C6D7FF] hover:bg-[#F8FAFF]"
                  >
                    Continue with One-Time Visit
                  </a>
                </div>
              </div>
            </div>
          )}

          {hasActiveMembership && (
            <MembershipUpgradePrompt currentPlan={currentPlanKey} className="mb-3 sm:mb-5" />
          )}

          <h2 className="mb-2 text-[16px] font-black text-[#0B1628] sm:mb-3 sm:text-[21px]">Book your extra visit</h2>

          <div id="booking-form" className="grid grid-cols-1 gap-3 scroll-mt-6 sm:gap-4 lg:grid-cols-12 lg:gap-6">
            <div className="order-2 lg:order-1 lg:col-span-5">
              <div className="rounded-[10px] border border-[#E5E9F2] bg-white/95 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:rounded-[16px] sm:p-4">
                <div className="mb-1 flex items-center justify-between sm:mb-3">
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
                    className="grid h-[34px] w-[34px] place-items-center rounded-[7px] border border-[#E5E9F2] bg-[#F8FAFF] text-[12px] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF] active:scale-95 sm:h-10 sm:w-10 sm:rounded-[10px]"
                  >
                    &lt;
                  </button>
                  <div className="text-[11px] font-extrabold text-[#0B1628] sm:text-[17px]">
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
                    className="grid h-[34px] w-[34px] place-items-center rounded-[7px] border border-[#E5E9F2] bg-[#F8FAFF] text-[12px] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF] active:scale-95 sm:h-10 sm:w-10 sm:rounded-[10px]"
                  >
                    &gt;
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center sm:mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => (
                    <div
                      key={day}
                      className={`text-[8px] font-bold sm:text-[11px] ${
                        index === 0 ? "text-[#EF4444]" : "text-[#94A3B8]"
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
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
                          "mx-auto grid h-7 w-7 place-items-center rounded-[7px] text-[10px] font-semibold transition-all duration-150 sm:h-10 sm:w-10 sm:rounded-[10px] sm:text-[14px]",
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
            </div>

            <div className="contents lg:order-2 lg:col-span-7 lg:flex lg:flex-col lg:gap-5">
              <div className="order-1 rounded-[10px] border border-[#E5E9F2] bg-white/95 p-2 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:rounded-[16px] sm:p-4 lg:order-none">
                {isLoading ? (
                  <div className="py-8 text-center text-[14px] font-semibold text-[#64748B]">
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
                        Log In
                      </Link>
                      <Link
                        href="/signup"
                        className="rounded-[14px] border border-[#C5CBD8] px-5 py-3 text-[14px] font-extrabold text-[#0B1628]"
                      >
                        Create Account
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">

                    <div>
                      {selectedAddress ? (
                        <div className="flex min-h-9 items-center gap-1">
                          <span className="text-[#306EEC]" aria-hidden="true">⌖</span>
                          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#0B1628] sm:text-[13px]">{addressLabel(selectedAddress)}</span>
                          {addresses.length > 1 && <button type="button" onClick={() => setAddressPickerOpen((open) => !open)} className="h-9 text-[9px] font-bold text-[#306EEC] sm:text-[11px]">{addressPickerOpen ? "Done" : "Change"}</button>}
                        </div>
                      ) : <div className="text-[10px] font-semibold text-[#64748B]">Choose an address</div>}
                      {(addressPickerOpen || !selectedAddress) && <select
                        value={addressId}
                        onChange={(event) => setAddressId(event.target.value)}
                        aria-label="Booking address"
                        className="mt-1 min-h-9 w-full rounded-[8px] border border-[#C5CBD8] bg-[#F8FAFF] px-2 text-[10px] font-semibold text-[#0B1628] outline-none transition focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15 sm:min-h-11 sm:text-[13px]"
                      ><option value="">Choose address</option>{addresses.map((address) => <option key={address._id} value={address._id}>{addressLabel(address)}</option>)}</select>}
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
                      <div className="mb-1 text-[10px] font-semibold text-[#0B1628] sm:text-[12px]">
                        Small job
                      </div>
                      <button
                        ref={servicePickerTriggerRef}
                        type="button"
                        onClick={() => setServicePickerOpen((open) => !open)}
                        aria-expanded={servicePickerOpen}
                        className={[
                          "group flex min-h-10 w-full items-center justify-between gap-2 rounded-[8px] bg-[#F7F8FB] px-2 py-1 text-left transition duration-200 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#306EEC]/15 sm:min-h-12 sm:rounded-[12px] sm:px-3",
                          selectedTask ? "ring-1 ring-[#D7E4FF]" : "ring-1 ring-[#E5E9F2]",
                        ].join(" ")}
                      >
                        <span className="min-w-0">
                          <span className={`block truncate text-[10px] font-bold sm:text-[13px] ${selectedTask ? "text-[#0B1628]" : "text-[#7C879A]"}`}>
                            {selectedTask || "Choose a small job"}
                          </span>
                        </span>
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0B1628] transition sm:h-9 sm:w-9">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                            className="fixed inset-0 z-[80] bg-[#071325]/20 backdrop-blur-[2px] sm:hidden"
                            aria-label="Close service picker"
                            onClick={() => setServicePickerOpen(false)}
                          />
                          <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="service-picker-title"
                            style={{ "--customer-nav-height": `${CUSTOMER_MOBILE_NAV_HEIGHT_PX}px` } as CSSProperties}
                            className="fixed inset-x-3 bottom-[calc(var(--customer-nav-height)_+_env(safe-area-inset-bottom,0px)_+_8px)] z-[90] flex max-h-[calc(100dvh_-_var(--customer-nav-height)_-_env(safe-area-inset-bottom,0px)_-_24px)] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_30px_90px_rgba(7,19,37,0.28)] sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-[calc(100%+10px)] sm:z-30 sm:max-h-[420px] sm:rounded-[22px]"
                          >
                            <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E5E9F2] px-3 py-2.5">
                              <div>
                                <div id="service-picker-title" className="text-[11px] font-black uppercase tracking-[0.16em] text-[#306EEC]">
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
                            <div
                              className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-2 pb-4 touch-pan-y"
                              style={{ WebkitOverflowScrolling: "touch" }}
                            >
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
                                      "min-h-[46px] whitespace-normal break-words rounded-[12px] px-3 py-2 text-left text-[12px] font-black leading-4 transition duration-150 active:scale-[0.98] sm:min-h-[58px] sm:rounded-[14px] sm:text-[13px]",
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

                    <div className="flex items-center justify-between gap-2 border-t border-[#E5E9F2] pt-2">
                      <p className="text-[10px] font-semibold text-[#64748B] sm:text-[12px]">Larger project? Request a free estimate.</p>
                      <Link
                        href="/projects#estimate"
                        onClick={() =>
                          trackEvent("estimate_cta_clicked", {
                            placement: "book_service_selector_note",
                          })
                        }
                        className="flex-shrink-0 text-[9px] font-bold text-[#306EEC] sm:text-[11px]"
                      >
                        Get Estimate
                      </Link>
                    </div>

                    <div className="hidden">
                      {hasActiveMembership ? (
                        <>
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                            Extra visit
                          </div>
                          <h3 className="mt-2 text-[19px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[21px] sm:leading-[1.02] sm:tracking-[-0.035em]">
                            Use this when you need another visit before your membership renews.
                          </h3>
                          <p className="mt-3 text-[13px] font-semibold leading-5 text-white/72">
                            Your included membership visits stay available through the normal membership booking flow.
                          </p>
                          <Link
                            href="/book?visit=membership"
                            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-[13px] font-black text-[#0B1628] transition hover:bg-[#EEF4FF]"
                          >
                            Book included visit
                          </Link>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                                Need regular help?
                              </div>
                              <h3 className="mt-2 text-[19px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[21px] sm:leading-[1.02] sm:tracking-[-0.035em]">
                                A membership may be better if you expect ongoing visits.
                              </h3>
                            </div>
                            <Link
                              href="/membership/plans"
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
                              "Included member visits",
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
                            href="/membership/plans"
                            onClick={() =>
                              trackEvent("membership_cta_clicked", {
                                placement: "book_service_selector_card_mobile",
                              })
                            }
                            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-white text-[13px] font-black text-[#0B1628] transition hover:bg-[#EEF4FF] sm:hidden"
                          >
                            Compare Membership
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <>
                  <div className="order-3 rounded-[10px] border border-[#E5E9F2] bg-white/95 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:rounded-[16px] sm:p-4 lg:order-none">
                    <h2 className="mb-1 text-[11px] font-extrabold text-[#0B1628] sm:text-[15px]">Time</h2>

                    {autoSelectingDate ? (
                      <div className="rounded-[16px] border border-[#D9E4FF] bg-[#F0F7FF] px-4 py-5 text-center text-[14px] font-semibold text-[#475569]">
                        Finding the soonest available appointment...
                      </div>
                    ) : noAvailabilityMessage ? (
                      <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-5 text-center text-[14px] font-semibold text-amber-800">
                        {noAvailabilityMessage}
                      </div>
                    ) : loadingSlots ? (
                      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                          <div key={item} className="h-9 animate-pulse rounded-[7px] bg-[#F1F5F9] sm:h-11 sm:rounded-[10px]" />
                        ))}
                      </div>
                    ) : slots.length ? (
                      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2">
                        {slots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={[
                              "min-h-9 rounded-[7px] border px-1 text-[10px] font-extrabold transition active:scale-[0.99] sm:min-h-11 sm:rounded-[10px] sm:text-[13px]",
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

                  <div className="order-4 rounded-[10px] border border-[#E5E9F2] bg-white/95 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:rounded-[16px] sm:p-4 lg:order-none">
                    <h2 className="mb-1 text-[11px] font-extrabold text-[#0B1628] sm:text-[15px]">Task details</h2>

                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      placeholder="Describe your task. If we need to bring any materials or special tools, please let us know."
                      className="min-h-12 w-full resize-y rounded-[7px] border border-[#C5CBD8] bg-[#F8FAFF] p-1 text-[10px] text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15 sm:min-h-[82px] sm:rounded-[10px] sm:p-2.5 sm:text-[14px]"
                    />

                    <div className="mt-1">
                      <div className="text-[9px] font-semibold text-[#64748B] sm:mb-1 sm:text-[11px]">
                        Photos required
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[7px] border border-[#C5CBD8] bg-[#F8FAFF] text-[9px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] sm:h-11 sm:text-[13px]"
                        >
                          <svg
                            width="12"
                            height="12"
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
                          className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[7px] border border-[#C5CBD8] bg-[#F8FAFF] text-[9px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC] sm:h-11 sm:text-[13px]"
                        >
                          <svg
                            width="12"
                            height="12"
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
                          Choose Photos{photos.length > 0 ? ` (${photos.length})` : ""}
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
                        <div className="mt-1 grid grid-cols-3 gap-1 sm:mt-3 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5">
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

                  <div className="order-5 rounded-[10px] border border-[#E5E9F2] bg-white/95 p-2 pb-[calc(76px+env(safe-area-inset-bottom,0px))] shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:rounded-[16px] sm:p-4 lg:order-none">
                    <h2 className="mb-1 text-[11px] font-extrabold text-[#0B1628] sm:text-[15px]">Payment summary</h2>

                    <div className="mb-1 grid gap-1 text-[9px] text-[#475569] sm:text-[12px]">
                      <div className="flex justify-between gap-2 rounded-[7px] bg-[#F8FAFF] px-2 py-1.5">
                        <span>Extra Visit</span>
                        <strong className="text-right text-[#0B1628]">
                          {priceLabel} / {config.durationMinutes} minutes
                        </strong>
                      </div>
                      <div className="flex justify-between gap-2 rounded-[7px] bg-[#F8FAFF] px-2 py-1.5">
                        <span>Task</span>
                        <strong className="text-right text-[#0B1628]">
                          {selectedTask || "Not selected"}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-2 rounded-[7px] bg-[#F8FAFF] px-2 py-1.5">
                        <span>Date &amp; time</span>
                        <strong className="text-right text-[#0B1628]">
                          {selectedDate ? dayLabel(selectedDate) : "Not selected"}
                          {selectedTime ? ` at ${formatTime12(selectedTime)}` : ""}
                        </strong>
                      </div>
                      {selectedAddress && (
                        <div className="truncate rounded-[7px] bg-[#F8FAFF] px-2 py-1.5 font-semibold text-[#64748B]">
                          {addressLabel(selectedAddress)}
                        </div>
                      )}
                    </div>

                    <div className="mb-1 text-[9px] leading-3 text-[#64748B] sm:text-[11px] sm:leading-4">
                      Materials are separate. Let us know in the task description if you want us to bring anything.
                    </div>

                    {error && (
                      <div className="mb-1 rounded-[7px] border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-700 sm:text-[13px]">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={submit}
                      disabled={loading || !config.enabled}
                      className="h-11 w-full rounded-[9px] bg-[#306EEC] text-[12px] font-extrabold text-white transition hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] sm:h-[54px] sm:rounded-[14px] sm:text-[15px]"
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

      <section className="mx-auto max-w-[1280px] px-4 pb-8 sm:px-6 lg:px-8">
        <details className="rounded-[12px] border border-[#E5E9F2] bg-white px-3 py-2 text-[#0B1628]">
          <summary className="cursor-pointer text-[11px] font-extrabold sm:text-[13px]">Important information</summary>
          <div className="mt-2 grid gap-2 border-t border-[#E5E9F2] pt-2 text-[10px] leading-4 text-[#64748B] sm:grid-cols-3 sm:text-[12px]">
            <p><strong className="text-[#0B1628]">What&rsquo;s included:</strong> {pageCopy.includeText}</p>
            <p><strong className="text-[#0B1628]">Materials and exclusions:</strong> Materials are separate. Appliance repair and larger projects are excluded.</p>
            <p><strong className="text-[#0B1628]">After payment:</strong> Admin reviews the request. If it cannot be approved, you receive a full refund.</p>
            {/* Straight to the visit list. This used to leave Book for an
                Account tab whose only remaining content was a link back to
                Book. */}
            {isAuthenticated && <Link href="#your-visits" className="font-bold text-[#306EEC]">View Visits</Link>}
          </div>
        </details>
      </section>

      {/*
       * Visits, for people who are not members.
       *
       * The visit list only ever rendered on the membership branch, so somebody
       * who paid for a one-time visit could not see it again anywhere: Account
       * sends them here, and here had nothing to show them. Same component and
       * same anchor the member page uses, so there is still one visit history
       * on the site, and it is still under Book.
       */}
      {isAuthenticated && (
        <section
          id="your-visits"
          className="mx-auto w-full max-w-[1280px] scroll-mt-[84px] px-4 pb-10 pt-2 sm:scroll-mt-[96px] sm:px-6 sm:pb-12 lg:px-8"
        >
          <BookingsSection />
        </section>
      )}

      <Footer />
    </main>
  );
}


/**
 * The booking entrance.
 *
 * Members get three ways in: the visit included with their membership, a paid
 * additional visit, and Priority, which is a phone call rather than a booking.
 *
 * Everyone else sees exactly what they saw before - a single one-time visit
 * page with no tabs. /book is a public marketing destination ("Book a One-Time
 * Visit"), and adding a Membership tab for someone without a membership would
 * be an invitation to a door they cannot open.
 */
function BookExperience() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isMember = hasActiveMembershipFor(user);
  // Same plan source the Extra Visit flow uses: the subscribed address.
  const currentPlanKey = normalizePlanKey(
    (user?.addresses || []).find((address) => Boolean(address.hasActiveSubscription))?.plan
  );

  if (!isMember) return <AdditionalVisitBooking />;

  const visit = parseVisitType(searchParams.get("visit"));
  const nav = <VisitTypeNav active={visit} />;

  if (visit === "additional") return <AdditionalVisitBooking navSlot={nav} />;

  return (
    <main className="min-h-screen bg-[#F8F7F2] text-[#0B1628]">
      <Header />
      {nav}
      {visit === "priority" ? (
        <PriorityVisitPanel currentPlan={currentPlanKey} />
      ) : (
        <>
          {/*
           * Book is where a member comes to deal with visits, so the order is
           * the order of the job: book one, then who is coming, then the ones
           * you already have.
           *
           * The form leads. The Fixter row used to sit above it and delayed
           * the calendar to say something the member already knew.
           */}
          <BookingSection />

          <section className="mx-auto w-full max-w-[1280px] px-4 pt-1 sm:px-6 lg:px-8">
            <YourFixterRow />
          </section>

          {/*
           * Visits live here now, not on Membership. A member looking for
           * "when is my visit" was being sent to the page about their plan.
           * Same component, one implementation, moved to where it is looked for.
           */}
          <section
            id="your-visits"
            className="mx-auto w-full max-w-[1280px] scroll-mt-[84px] px-4 pt-6 sm:scroll-mt-[96px] sm:px-6 sm:pt-8 lg:px-8"
          >
            {/*
              No heading of my own here: BookingsSection already opens with
              "My Visits" and its own subtitle, and stacking a second heading
              on top of it just said the same thing twice.
             */}
            <BookingsSection />
          </section>

          {/* After booking, not before it: the task comes first. */}
          <section className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
            <MembershipUpgradePrompt currentPlan={currentPlanKey} className="max-w-[420px]" />
          </section>
        </>
      )}
      <Footer />
    </main>
  );
}

export default function BookPage() {
  // useSearchParams needs a boundary so the route can still be prerendered.
  return (
    <Suspense fallback={<AdditionalVisitBooking />}>
      <BookExperience />
    </Suspense>
  );
}
