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
import {
  getBookableSlots,
  normalizeDayAvailability,
  type AvailabilitySlot,
} from "@/lib/booking-calendar-availability";
import TimeSlotGrid from "@/app/components/booking/TimeSlotGrid";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";
import { useSearchParams } from "next/navigation";
import BookingSection from "@/app/components/sections/BookingSection";
import VisitTypeNav, { resolveVisitType } from "@/app/components/booking/VisitTypeNav";
import BookOverview, { BOOK_HEADING } from "@/app/components/booking/BookOverview";
import GiftCallout from "@/app/components/gift/GiftCallout";
import { YourFixterRow } from "@/app/components/fixter/YourFixter";
import BookingsSection from "@/app/components/account/BookingsSection";
import ShareFinishedProject from "@/app/components/workPhotos/ShareFinishedProject";
import PriorityVisitPanel from "@/app/components/booking/PriorityVisitPanel";
import FullDayVisitPanel from "@/app/components/booking/FullDayVisitPanel";
import PhotoLibraryPicker from "@/app/components/booking/PhotoLibraryPicker";
import PlansSection from "@/app/components/sections/PlansSection";
import { useFreeVisitEligibility } from "@/lib/free-visit";
import MembershipUpgradePrompt, { normalizePlanKey } from "@/app/components/membership/MembershipUpgradePrompt";
import { hasActiveMembership as hasActiveMembershipFor } from "@/lib/auth-routing";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { useServiceTextsOptIn } from "@/app/components/booking/ServiceTextsOptIn";

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
/* Signing in from the One-Time tab comes back to the One-Time tab. */
const ONE_TIME_RETURN_PATH = "/book?visit=additional";
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

/*
 * Every time the day's schedule offers, booked ones included, for display.
 *
 * Bookable means exactly what slotsForAvailabilityDay says and nothing else,
 * so a listed-but-unavailable time can never become a selectable one, and a
 * day with no bookable time stays closed however many candidates it lists.
 * An API without the full list yields the bookable times only.
 */
function candidatesForAvailabilityDay(
  day: Parameters<typeof normalizeDayAvailability>[0]
): AvailabilitySlot[] {
  const normalized = normalizeDayAvailability(day);
  const bookable = getBookableSlots(normalized);
  const bookableTimes = new Set(bookable.map((slot) => slot.time));
  const listed = normalized.hasCandidateSlots ? normalized.slots : bookable;
  return listed.map((slot) => ({ time: slot.time, available: bookableTimes.has(slot.time) }));
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
  const { requestHome, homeSheet } = useAddHome();
  const { ensureContact, contactSheet } = useContactCompletion();
  const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn();
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
  // A Profixter Library example when there is no photo to hand; never a photo.
  const [libraryReference, setLibraryReference] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const servicePickerRef = useRef<HTMLDivElement | null>(null);
  const servicePickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const autoSelectStartedRef = useRef(false);
  const availabilityByDateRef = useRef<Record<string, string[]>>({});
  const [candidatesByDate, setCandidatesByDate] = useState<Record<string, AvailabilitySlot[]>>({});

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

  function cacheDateSlots(ymd: string, nextSlots: string[], candidates?: AvailabilitySlot[]) {
    const next = { ...availabilityByDateRef.current, [ymd]: nextSlots };
    availabilityByDateRef.current = next;
    setAvailabilityByDate(next);
    if (candidates) setCandidatesByDate((prev) => ({ ...prev, [ymd]: candidates }));
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
      const candidates: Record<string, AvailabilitySlot[]> = {};
      for (const day of days) {
        next[day.date] = slotsForAvailabilityDay(day);
        candidates[day.date] = candidatesForAvailabilityDay(day);
      }
      availabilityByDateRef.current = next;
      setAvailabilityByDate(next);
      setCandidatesByDate((prev) => ({ ...prev, ...candidates }));
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
          cacheDateSlots(ymd, nextSlots, candidatesForAvailabilityDay(data));
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
        cacheDateSlots(selectedDate, nextSlots, candidatesForAvailabilityDay(data));
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

  /* Read by the refresh after a SLOT_UNAVAILABLE refusal, which resolves later. */
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  /*
   * A selection is only a selection while availability still offers it: when
   * a refresh drops the chosen time, the time is cleared rather than left
   * looking chosen on a slot that can no longer be booked.
   */
  useEffect(() => {
    if (selectedTime && !slots.includes(selectedTime)) setSelectedTime("");
  }, [selectedTime, slots]);

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
            formHeading: "Book your extra visit",
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
            formHeading: "Book your visit",
          },
    [config.durationMinutes, hasActiveMembership]
  );
  const days = useMemo(() => calendarDays(currentMonth), [currentMonth]);
  const today = todayYMD();
  /* The selected day's full schedule; only times in `slots` are bookable. */
  const slotOptions = (candidatesByDate[selectedDate] ?? slots.map((time) => ({ time, available: true })))
    .map((slot) => ({ time: slot.time, available: slot.available && slots.includes(slot.time), remaining: null }));
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
      cacheDateSlots(ymd, nextSlots, candidatesForAvailabilityDay(data));
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
    if (!photos.length && !libraryReference) {
      setError("Add a photo, or choose the closest example from the Profixter Library.");
      return;
    }

    const bookingDate = bookingDateFromParts(selectedDate, selectedTime);
    if (!bookingDate) {
      setError("Choose a valid date and time.");
      return;
    }

    if (!(await ensureContact())) return;

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
        libraryReference: libraryReference || undefined,
      });
      /* Only now, with the visit accepted for checkout: never a condition of it. */
      await applyServiceTextsOptIn();
      window.location.href = result.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout.";
      setError(message);
      /*
       * The server refused the time because it is taken now. Reload the day so
       * the time shows as unavailable; the effect below then drops it from the
       * selection rather than leaving it looking chosen.
       */
      if ((err as { code?: string })?.code === "SLOT_UNAVAILABLE" && selectedDate) {
        const ymd = selectedDate;
        getTimeSlots(ymd)
          .then((data) => {
            const nextSlots = slotsForAvailabilityDay(data);
            cacheDateSlots(ymd, nextSlots, candidatesForAvailabilityDay(data));
            setSlots((current) => (selectedDateRef.current === ymd ? nextSlots : current));
          })
          .catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }

  const changeMonth = (delta: number) =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));

  return (
    <main className="pg-book pg-flow">
      <Header />
      {navSlot}

      <section className="ui-container pg-book__head pb-10 sm:pb-14">
        {/*
         * Title left, membership alternative right on a wide screen; one quiet
         * line under the subtitle on a phone. Somebody booking one visit may be
         * deciding between one visit and ongoing help, so the other door is
         * named - but never as a panel between the customer and the calendar.
         */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-[720px]">
            <p className="ui-eyebrow ui-eyebrow--accent">
              {hasActiveMembership ? "Extra Visit" : "One-Time Visit"}
            </p>
            <h1 className="pg-book__title">
              {hasActiveMembership ? "Book an Extra Visit" : "Book a one-time handyman visit"}
            </h1>
            <p className="pg-book__sub">
              <span className="ui-num font-semibold text-[color:var(--ui-ink)]">{priceLabel}</span>
              {" · "}
              {hasActiveMembership
                ? "Book an additional visit anytime before your membership renews."
                : "One 90-minute visit, no membership needed. We bring the tools."}
            </p>
            {hasActiveMembership && (
              <Link href="/book?visit=membership" className="ui-link mt-1">
                Need your included visit? Book here
              </Link>
            )}
          </div>

          {!hasActiveMembership && (
            <p className="ui-small shrink-0">
              Prefer ongoing help? Membership from $149/mo.{" "}
              <Link
                href="/membership/plans"
                onClick={() => trackEvent("see_plans_clicked", { placement: "book_one_time" })}
                className="font-semibold text-[color:var(--ui-accent-ink)] hover:underline"
              >
                See plans
              </Link>
            </p>
          )}
        </div>

        {configError && <p className="pg-note mt-4">{configError}</p>}

        {hasActiveMembership && (
          <MembershipUpgradePrompt currentPlan={currentPlanKey} className="mt-4" />
        )}

        <div
          id="booking-form"
          className="mt-5 grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start lg:gap-6"
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4">
            {/* ------------------------- who and what ------------------------- */}
            <div className="pg-panel">
              {isLoading ? (
                <p className="py-6 text-center text-[15px] text-[color:var(--ui-text-3)]">Loading your account...</p>
              ) : !isAuthenticated ? (
                <div className="py-2 text-center sm:py-4">
                  <p className="ui-eyebrow">Home profile</p>
                  <h2 className="ui-h3">Sign in to book</h2>
                  <p className="mx-auto mt-1.5 max-w-[46ch] text-[14px] leading-[1.5] text-[color:var(--ui-text-2)]">
                    We need a home profile for your address, photos, payment status, reminders, and booking history.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Link href={`/signin?next=${encodeURIComponent(ONE_TIME_RETURN_PATH)}`} className="ui-btn ui-btn--primary">
                      Log In
                    </Link>
                    <Link href={`/signup?next=${encodeURIComponent(ONE_TIME_RETURN_PATH)}`} className="ui-btn ui-btn--secondary">
                      Create Account
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div>
                    <span className="pg-label">Address</span>
                    {selectedAddress ? (
                      <div className="flex min-h-11 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--ui-ink)]">
                          {addressLabel(selectedAddress)}
                        </span>
                        {addresses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setAddressPickerOpen((open) => !open)}
                            className="min-h-11 shrink-0 px-1 text-[14px] font-semibold text-[color:var(--ui-accent-ink)]"
                          >
                            {addressPickerOpen ? "Done" : "Change"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[14px] text-[color:var(--ui-text-3)]">Choose an address</p>
                    )}
                    {(addressPickerOpen || !selectedAddress) && (
                      <select
                        value={addressId}
                        onChange={(event) => setAddressId(event.target.value)}
                        aria-label="Booking address"
                        className="pg-input mt-1"
                      >
                        <option value="">Choose address</option>
                        {addresses.map((address) => (
                          <option key={address._id} value={address._id}>
                            {addressLabel(address)}
                          </option>
                        ))}
                      </select>
                    )}
                    {!addresses.length && (
                      <button
                        type="button"
                        onClick={async () => {
                          const home = await requestHome();
                          if (home?.address?._id) setAddressId(String(home.address._id));
                        }}
                        className="ui-link mt-1"
                      >
                        Add your home
                      </button>
                    )}
                  </div>

                  <div ref={servicePickerRef} className="relative">
                    <span className="pg-label">Small job</span>
                    <button
                      ref={servicePickerTriggerRef}
                      type="button"
                      onClick={() => setServicePickerOpen((open) => !open)}
                      aria-expanded={servicePickerOpen}
                      className="pg-input flex items-center justify-between gap-2 text-left"
                    >
                      <span className={`min-w-0 truncate ${selectedTask ? "text-[color:var(--ui-ink)]" : "text-[#8a94a6]"}`}>
                        {selectedTask || "Choose a small job"}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-[color:var(--ui-text-3)]">
                        <path
                          d={servicePickerOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>

                    {servicePickerOpen && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-[80] bg-[#0B1628]/30 sm:hidden"
                          aria-label="Close service picker"
                          onClick={() => setServicePickerOpen(false)}
                        />
                        <div
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="service-picker-title"
                          style={{ "--customer-nav-height": `${CUSTOMER_MOBILE_NAV_HEIGHT_PX}px` } as CSSProperties}
                          className="fixed inset-x-3 bottom-[calc(var(--customer-nav-height)_+_env(safe-area-inset-bottom,0px)_+_8px)] z-[90] flex max-h-[calc(100dvh_-_var(--customer-nav-height)_-_env(safe-area-inset-bottom,0px)_-_24px)] flex-col overflow-hidden rounded-[var(--ui-r-lg)] bg-white shadow-[var(--ui-shadow-3)] sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-[calc(100%+8px)] sm:z-30 sm:max-h-[420px] sm:rounded-[var(--ui-r-md)] sm:border sm:border-[color:var(--ui-line)]"
                        >
                          <div className="flex flex-shrink-0 items-center justify-between border-b border-[color:var(--ui-line)] px-4 py-2">
                            <div id="service-picker-title" className="text-[15px] font-semibold text-[color:var(--ui-ink)]">
                              Select service
                            </div>
                            <button
                              type="button"
                              onClick={() => setServicePickerOpen(false)}
                              className="flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-[color:var(--ui-text-2)] hover:bg-[color:var(--ui-bg-soft)]"
                              aria-label="Close service picker"
                            >
                              &times;
                            </button>
                          </div>
                          <div
                            className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 touch-pan-y"
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
                                    "min-h-[48px] whitespace-normal break-words rounded-[var(--ui-r-sm)] border px-3 py-2 text-left text-[14px] font-medium leading-[1.3] transition-colors",
                                    active
                                      ? "border-[color:var(--ui-ink)] bg-[color:var(--ui-ink)] text-white"
                                      : "border-[color:var(--ui-line)] bg-white text-[color:var(--ui-ink)] hover:border-[color:var(--ui-line-2)]",
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

                  <p className="flex items-center justify-between gap-2 border-t border-[color:var(--ui-line)] pt-3 text-[14px] text-[color:var(--ui-text-3)]">
                    Larger project? Request a free estimate.
                    <Link
                      href="/projects#estimate"
                      onClick={() =>
                        trackEvent("estimate_cta_clicked", {
                          placement: "book_service_selector_note",
                        })
                      }
                      className="shrink-0 font-semibold text-[color:var(--ui-accent-ink)]"
                    >
                      Get Estimate
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* ------------------------------ when ------------------------------ */}
            <div className="pg-panel">
              {isAuthenticated && <h2 className="pg-panel__title">When</h2>}
              <div className="pg-cal__head">
                <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="pg-cal__nav">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div className="pg-cal__month">{monthLabel(currentMonth)}</div>
                <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="pg-cal__nav">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              <div className="pg-cal__wd" aria-hidden="true">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <div key={`${day}-${index}`}>{day}</div>
                ))}
              </div>

              <div className="pg-cal__grid">
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
                      data-booking-date={day.ymd}
                      data-booking-date-muted={day.muted ? "true" : "false"}
                      data-booking-date-selected={selected ? "true" : "false"}
                      disabled={disabled}
                      onClick={() => chooseDate(day.ymd)}
                      className={[
                        "pg-cal__day",
                        day.muted ? "is-muted" : "",
                        selected ? "is-selected" : !disabled ? "is-open" : "",
                      ].join(" ")}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>

              {isAuthenticated && (
                <div className="mt-4 border-t border-[color:var(--ui-line)] pt-4">
                  <p className="pg-label">
                    {selectedDate ? `Times on ${dayLabel(selectedDate)}` : "Time"}
                  </p>
                  {autoSelectingDate ? (
                    <p className="py-3 text-[14px] text-[color:var(--ui-text-3)]">
                      Finding the soonest available appointment...
                    </p>
                  ) : noAvailabilityMessage ? (
                    <p className="pg-note">{noAvailabilityMessage}</p>
                  ) : loadingSlots ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="h-12 animate-pulse rounded-[var(--ui-r-sm)] bg-[color:var(--ui-bg-soft)]" />
                      ))}
                    </div>
                  ) : slots.length ? (
                    <TimeSlotGrid
                      slotOptions={slotOptions}
                      selectedTime={selectedTime}
                      onSelect={setSelectedTime}
                    />
                  ) : (
                    <p className="py-3 text-[14px] text-[color:var(--ui-text-3)]">
                      Choose an available date to see times.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ----------------------------- details ----------------------------- */}
            {isAuthenticated && (
              <div className="pg-panel">
                <h2 className="pg-panel__title">Task details</h2>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Describe your task. If we need to bring any materials or special tools, please let us know."
                  className="pg-input min-h-[96px] resize-y"
                />

                <div className="mt-4">
                  <p className="pg-label !mb-0.5">Photos required</p>
                  <p className="pg-hint">A photo of the actual issue helps your Fixter arrive prepared.</p>
                  <div className="pg-photo-row">
                    <button type="button" onClick={() => cameraInputRef.current?.click()} className="pg-photo-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                      Take Photo
                    </button>
                    <button type="button" onClick={() => galleryInputRef.current?.click()} className="pg-photo-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                      Choose Photos{photos.length > 0 ? ` (${photos.length})` : ""}
                    </button>
                  </div>
                  <PhotoLibraryPicker
                    value={libraryReference}
                    context="one_time"
                    onChange={(key) => {
                      setLibraryReference(key);
                      if (key) setError((current) => (current.includes("Profixter Library") ? "" : current));
                    }}
                  />
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
                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {photos.map((_photo, index) => (
                        <div
                          key={`${_photo.name}-${index}`}
                          className="relative overflow-hidden rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-sunk)]"
                          style={{ aspectRatio: "1" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoUrls[index] || ""} alt={`Task photo ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            aria-label="Remove photo"
                            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[14px] leading-none text-white transition hover:bg-black/75"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ------------------------- summary and pay ------------------------- */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:sticky lg:top-[88px]">
            {isAuthenticated && (
              <div className="pg-panel">
                <h2 className="pg-panel__title">Payment summary</h2>
                <div className="pg-rows">
                  <div>
                    <span className="text-[color:var(--ui-text-3)]">{pageCopy.visitLabel}</span>
                    <strong className="text-right font-medium text-[color:var(--ui-ink)]">
                      {priceLabel} / {config.durationMinutes} minutes
                    </strong>
                  </div>
                  <div>
                    <span className="text-[color:var(--ui-text-3)]">Task</span>
                    <strong className="text-right font-medium text-[color:var(--ui-ink)]">{selectedTask || "Not selected"}</strong>
                  </div>
                  <div>
                    <span className="text-[color:var(--ui-text-3)]">Date &amp; time</span>
                    <strong className="text-right font-medium text-[color:var(--ui-ink)]">
                      {selectedDate ? dayLabel(selectedDate) : "Not selected"}
                      {selectedTime ? ` at ${formatTime12(selectedTime)}` : ""}
                    </strong>
                  </div>
                  {selectedAddress && (
                    <div>
                      <span className="text-[color:var(--ui-text-3)]">Home</span>
                      <strong className="min-w-0 truncate text-right font-medium text-[color:var(--ui-ink)]">
                        {[selectedAddress.line1, selectedAddress.city].filter(Boolean).join(", ")}
                      </strong>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[13px] leading-[1.5] text-[color:var(--ui-text-3)]">
                  Materials are separate. Let us know in the task description if you want us to bring anything.
                </p>

                {error && <p className="pg-error mt-3">{error}</p>}

                {serviceTextsOptIn ? <div className="mt-3">{serviceTextsOptIn}</div> : null}

                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !config.enabled}
                  className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block mt-4"
                >
                  {loading
                    ? "Opening secure checkout..."
                    : config.enabled
                      ? "Continue to payment"
                      : "Booking temporarily unavailable"}
                </button>
              </div>
            )}

            {/* What a customer needs before paying, beside the button, one tap away. */}
            <details className="pg-more">
              <summary>What&rsquo;s included &amp; refunds</summary>
              <div className="pg-more__body">
                <p><strong className="font-semibold text-[color:var(--ui-ink)]">What&rsquo;s included:</strong> {pageCopy.includeText}</p>
                <p><strong className="font-semibold text-[color:var(--ui-ink)]">Materials:</strong> Materials are separate.</p>
                {/* Owner rule (2026-10-27): the site never says a job is excluded or
                    rejected. The owner reviews every request and decides. */}
                <p><strong className="font-semibold text-[color:var(--ui-ink)]">After payment:</strong> Your appointment request will be reviewed by our team. We&rsquo;ll contact you if we need any additional details. If we can&rsquo;t take it on, you receive a full refund.</p>
                <p>
                  <strong className="font-semibold text-[color:var(--ui-ink)]">Changes:</strong> {pageCopy.changeText}{" "}
                  <a href={`tel:${config.cancellationPhone}`} className="font-semibold text-[color:var(--ui-accent-ink)]">
                    {config.cancellationPhone}
                  </a>
                  .
                </p>
                {/* Straight to the visit list. */}
                {isAuthenticated && <Link href="#your-visits" className="ui-link">View Visits</Link>}
              </div>
            </details>
          </div>
        </div>
      </section>

      {/*
       * The invitation to show what we did. After booking and its fine print,
       * before the visit list: it is neither, which is the whole point.
       */}
      {isAuthenticated && (
        <section className="ui-container pb-8">
          <ShareFinishedProject />
        </section>
      )}

      {/*
       * Visits, for people who are not members. Same component and same
       * anchor the member page uses, so there is still one visit history on
       * the site, and it is still under Book.
       */}
      {isAuthenticated && (
        <section id="your-visits" className="ui-container scroll-mt-[84px] pb-12 pt-2 sm:scroll-mt-[96px]">
          <BookingsSection />
        </section>
      )}

      <Footer />
      {homeSheet}
      {contactSheet}
    </main>
  );
}


/**
 * The same visit list the other tabs show, under the same anchor.
 *
 * Split out only because Full Day renders it beside a different panel; it is
 * the one BookingsSection the site has, not a Full Day copy of it.
 */
function FullDayVisitHistory() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return (
    <section id="your-visits" className="ui-container scroll-mt-[84px] pb-12 sm:scroll-mt-[96px]">
      <BookingsSection />
    </section>
  );
}

/**
 * The booking entrance.
 *
 * Three ways to get a Fixter to the house, and everybody sees all three now.
 *
 * The tabs used to be members-only, on the reasoning that offering a
 * membership visit to someone without a membership was a door they could not
 * open. That was backwards: it meant the page named after the product never
 * explained the product, and a visitor who decided partway through booking a
 * one-time visit that they actually wanted ongoing help had nowhere obvious to
 * go. The door is worth showing precisely because it is the one we want them
 * to walk through.
 *
 * So the selector is shared and the panels are state aware. Book Fixter is the
 * booking form for a member and the way in for everyone else; the middle tab is
 * the same one-time flow under whichever name is true for the reader; Priority
 * is a phone call for both, with entitlements shown only to people who have
 * them.
 */
function BookExperience() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const isMember = hasActiveMembershipFor(user);
  const isAnonymous = !isLoading && !isAuthenticated;
  const freeVisit = useFreeVisitEligibility();
  const { openHome, homeSheet } = useAddHome();
  // Same plan source the Extra Visit flow uses: the subscribed address.
  const currentPlanKey = normalizePlanKey(
    (user?.addresses || []).find((address) => Boolean(address.hasActiveSubscription))?.plan
  );

  const visit = resolveVisitType(searchParams.get("visit"));
  const nav = <VisitTypeNav active={visit} isMember={isMember} />;

  if (visit === "additional") return <AdditionalVisitBooking navSlot={nav} />;

  /*
   * Full Day is the same page for everybody: a visitor reads it, picks a day
   * and is asked to sign in at the last step, and a member sees whether the day
   * is on their plan. So it is not behind the membership branch below, and it
   * shows the visit list to anyone signed in, exactly like the other tabs.
   */
  if (visit === "full-day") {
    return (
      <main className="pg-book pg-flow">
        <Header />
        {nav}
        <FullDayVisitPanel />
        <FullDayVisitHistory />
        {/* After the booking, not above it: the day is why they came. */}
        <section className="ui-container pb-12">
          <GiftCallout
            variant="bar"
            audience={isMember ? "member" : "public"}
            headingId="fullday-gift-heading"
          />
        </section>
        <Footer />
      </main>
    );
  }

  /*
   * A non-member landing on ?visit=membership gets the gateway rather than a
   * redirect, so the tab they just pressed is the tab they are looking at and
   * the URL still describes the page.
   */
  if (!isMember && visit === "membership") {
    /*
     * Book Fixter is the membership tab for everybody, so a non-member chooses
     * a plan right here - four short rows, confirm, checkout - instead of
     * reading a pitch and being sent to another page to choose.
     *
     * Their visit history comes along: it is why this tab used to default to
     * One-Time for non-members (Account and the one-time confirmation link to
     * /book#your-visits), and it is the same single list the other tabs show.
     *
     * The Free Visit (a to-do list review, no labor) stays one line away for whoever can still have it;
     * its booker lives on the homepage and at /book/free.
     */
    const showFreeVisit = isAnonymous || freeVisit === "eligible";
    return (
      <main className="pg-book pg-flow">
        <Header />
        {nav}
        <h1 className="sr-only">{BOOK_HEADING}</h1>
        <section className="ui-container ui-container--narrow pb-12 pt-5 sm:pt-8">
          <div className="pg-panel !p-4 sm:!p-6">
            <PlansSection picker />
          </div>
          {showFreeVisit ? (
            <Link
              href="/book/free"
              className="ui-card ui-card--link mt-3 flex items-center justify-between gap-3 !py-3.5 text-[14px]"
              onClick={() => trackEvent("free_visit_cta_clicked", { placement: "book_tab" })}
              data-book-free-visit
            >
              <span className="text-[color:var(--ui-text-2)]">
                <b className="font-semibold text-[color:var(--ui-ink)]">Not sure yet?</b> Book a free visit to go over your to-do list.
              </span>
              <span className="shrink-0 font-semibold text-[color:var(--ui-accent-ink)]">Book it →</span>
            </Link>
          ) : freeVisit === "needs_address" ? (
            /*
             * Signed in without a home yet: the offer stays, with the one step
             * it needs. Saving the home re-runs the eligibility check, and the
             * server decides whether it becomes the link above.
             */
            <div
              className="ui-card mt-3 flex flex-col gap-2 !py-3.5 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              data-book-free-visit="needs-address"
            >
              <span className="text-[color:var(--ui-text-2)]">
                <b className="font-semibold text-[color:var(--ui-ink)]">Not sure yet?</b> Book a free visit to go over your to-do list.
              </span>
              <button
                type="button"
                onClick={() => {
                  trackEvent("free_visit_cta_clicked", { placement: "book_tab_add_home" });
                  openHome();
                }}
                className="min-h-11 shrink-0 text-left font-semibold text-[color:var(--ui-accent-ink)]"
              >
                Add your home to check availability →
              </button>
            </div>
          ) : null}
          {homeSheet}
        </section>
        <FullDayVisitHistory />
        <Footer />
      </main>
    );
  }

  return (
    <main className="pg-book pg-flow">
      <Header />
      {nav}
      {visit === "priority" ? (
        <PriorityVisitPanel currentPlan={currentPlanKey} isMember={isMember} />
      ) : (
        <>
          {/*
           * Gifting, to the people most likely to do it.
           *
           * Members come back to this page every time they want a visit, and
           * they are the audience that needs no convincing about what
           * ProFixter is worth - which is exactly what makes them the right
           * people to ask to give it to somebody else.
           *
           * ABOVE THE FORM, AND COMPACT, and both halves of that matter. Above
           * because a promotion below a tall booking form is a promotion
           * nobody on a phone will ever see. Compact - one row on desktop, a
           * tight stack on mobile - because booking is why they came, and this
           * must cost the form a few dozen pixels rather than a screenful.
           *
           * A banner, not a dialog: nothing here interrupts, blocks, or has to
           * be dismissed before a member can book.
           */}
          <section className="ui-container pt-4 sm:pt-5">
            {/*
             * The pitch follows the reader. This branch also serves the
             * one-time tab, which a non-member reaches from /on-demand, and
             * telling somebody who has never had a visit that they "already
             * know how useful a Fixter is" would be selling them their own
             * experience of nothing.
             */}
            <GiftCallout
              variant="bar"
              audience={isMember ? "member" : "public"}
              headingId="book-gift-heading"
            />
          </section>

          {/*
           * Book is where a member comes to deal with visits, so the order is
           * the order of the job: book one, then who is coming, then the ones
           * you already have.
           *
           * The form leads. The Fixter row used to sit above it and delayed
           * the calendar to say something the member already knew.
           */}
          <BookingSection />

          <section className="ui-container pt-1">
            <YourFixterRow />
          </section>

          {/*
           * Book a visit, see who is coming, then - quietly - show us the
           * last one. Secondary to all of it, and deliberately above the
           * visit list rather than inside it: sharing a finished project is
           * not an action on a booking, and it stopped being one here.
           */}
          <section className="ui-container pt-5">
            <ShareFinishedProject />
          </section>

          {/*
           * Visits live here now, not on Membership. A member looking for
           * "when is my visit" was being sent to the page about their plan.
           * Same component, one implementation, moved to where it is looked for.
           */}
          <section
            id="your-visits"
            className="ui-container scroll-mt-[84px] pt-6 sm:scroll-mt-[96px] sm:pt-8"
          >
            {/*
              No heading of my own here: BookingsSection already opens with
              "My Visits" and its own subtitle, and stacking a second heading
              on top of it just said the same thing twice.
             */}
            <BookingsSection />
          </section>

          {/* After booking, not before it: the task comes first. */}
          <section className="ui-container pb-12 pt-6">
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
    /*
     * The fallback is what the served HTML contains. It describes the booking
     * hub the visitor is about to see, not one tab of it; see BookOverview.
     */
    <Suspense fallback={<BookOverview />}>
      <BookExperience />
    </Suspense>
  );
}
