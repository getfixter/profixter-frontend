"use client";

/**
 * Book the First Free Visit before having an account.
 *
 * One surface, revealed as it is used: describe the job, add a photo or pick
 * the closest example, pick a day, pick a time, and the summary assembles
 * itself under one button. Signup comes last - on /signup, the page carriers
 * review for SMS consent - and the draft built here waits for the visitor in
 * lib/booking-draft.ts. When they come back signed in, the booking is created
 * from the draft without asking for anything again.
 *
 * WHAT THIS DOES NOT DO. It does not decide whether a slot is free, and it does
 * not hold one. Availability is read from the same public calendar endpoints
 * BookingSection uses, and the booking is created by the same POST
 * /api/bookings, which re-checks the slot inside a transaction and owns every
 * free-visit rule (one per address, service area, photo or example, Labor Only).
 * This component only renders what the server answers.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  createBooking,
  getMonthAvailability,
  getNextBooking,
  getTimeSlots,
} from "@/lib/booking-service";
import {
  dateFromYMDLocal,
  getBookableSlots,
  isBookableDay,
  normalizeDayAvailability,
  type DayAvailability,
  type MonthAvailabilityMap,
} from "@/lib/booking-calendar-availability";
import { compressImage } from "@/lib/compressImage";
import { trackEvent } from "@/lib/analytics";
import { trackLead } from "@/lib/meta";
import { hasActiveMembership } from "@/lib/auth-routing";
import { libraryLabel } from "@/lib/booking-library";
import {
  clearDraft,
  loadDraft,
  loadPhotos,
  saveDraft,
  savePhotos,
} from "@/lib/booking-draft";
import PhotoLibraryPicker from "@/app/components/booking/PhotoLibraryPicker";

/** The free first visit is always booked as Labor Only - the server refuses anything else. */
const FREE_VISIT_SERVICE = "Labor Only";
const RESUME_PATH = "/book/free";
const MAX_PHOTOS = 10;
const MONTHS_AHEAD = 4;

const QUICK_TASKS = [
  "Mount a TV",
  "Fix a leaky faucet",
  "Hang shelves",
  "Patch drywall",
  "Assemble furniture",
  "Replace a light fixture",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Access =
  | "anonymous"
  | "checking"
  | "eligible"
  | "member"
  | "used"
  | "outside"
  | "no-address";

type Phase = "edit" | "submitting" | "done";

type Confirmation = {
  dateLabel: string;
  timeLabel: string;
  address: string;
  reference?: string;
};

/* ------------------------------------------------------------------ */
/* Date helpers - every date here is a YYYY-MM-DD string in New York. */
/* ------------------------------------------------------------------ */

function nyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthGrid(month: string): Array<string | null> {
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = Array(firstWeekday).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function longDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function time12(t: string): string {
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return t;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function errorCode(err: unknown): string {
  return String((err as { code?: string })?.code || "");
}

function errorMessage(err: unknown): string {
  const e = err as { message?: string; response?: { data?: { message?: string } } };
  return e?.response?.data?.message || e?.message || "";
}

/* ------------------------------------------------------------------ */

export default function FreeVisitBooker({
  id = "book",
  autoResume = false,
  variant = "full",
}: {
  /** Anchor id, so a header link can scroll straight to the booker. */
  id?: string;
  /** On the page signup returns to: create the drafted booking on arrival. */
  autoResume?: boolean;
  /**
   * "compact" is the homepage widget: one field, a strip of open days, times
   * under the chosen day, and a one-line summary once both are picked. Same
   * state, same rules, same booking - only the layout is smaller.
   */
  variant?: "full" | "compact";
}) {
  const compact = variant === "compact";
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  /* --- the job ---------------------------------------------------- */
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [libraryReference, setLibraryReference] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  /* --- the calendar ----------------------------------------------- */
  const [today] = useState(nyToday);
  const [month, setMonth] = useState(() => monthOf(nyToday()));
  const [months, setMonths] = useState<Record<string, MonthAvailabilityMap>>({});
  const [monthError, setMonthError] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [initialMonthResolved, setInitialMonthResolved] = useState(false);

  /* --- flow ------------------------------------------------------- */
  const [phase, setPhase] = useState<Phase>("edit");
  const [access, setAccess] = useState<Access>("anonymous");
  const [addressId, setAddressId] = useState("");
  const [errors, setErrors] = useState<{ note?: string; photos?: string; date?: string; time?: string }>({});
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /* Compact layout: day/time open for choosing, or folded into one summary row. */
  const [whenOpen, setWhenOpen] = useState(true);
  const [gridOpen, setGridOpen] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  /* Photos come back from IndexedDB asynchronously; until then their count is unknown, not zero. */
  const [photosRestored, setPhotosRestored] = useState(false);

  const noteRef = useRef<HTMLTextAreaElement>(null);
  const photosRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const timesRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const tracked = useRef<Set<string>>(new Set());
  const resumeStarted = useRef(false);

  const trackOnce = useCallback((name: string, params: Record<string, string | number | boolean> = {}) => {
    if (tracked.current.has(name)) return;
    tracked.current.add(name);
    trackEvent(name, params);
  }, []);

  /* --- restore a draft -------------------------------------------- */
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setNote(draft.note);
      setLibraryReference(draft.libraryReference);
      if (draft.requestedDate) {
        setSelectedDate(draft.requestedDate);
        setMonth(monthOf(draft.requestedDate));
        setInitialMonthResolved(true);
      }
      setSelectedTime(draft.requestedTime);
      if (draft.requestedDate && draft.requestedTime) setWhenOpen(false);
    }
    void loadPhotos()
      .then((files) => {
        if (files.length) setPhotos(files.slice(0, MAX_PHOTOS));
      })
      .finally(() => setPhotosRestored(true));
    setHydrated(true);
  }, []);

  /*
   * Keep the draft current as the visitor works. Photos are written separately,
   * and their count only once they have been restored - writing 0 while they
   * are still on their way back from IndexedDB is how a photo got lost on the
   * return from signup.
   */
  useEffect(() => {
    if (!hydrated || phase === "done") return;
    saveDraft({
      note,
      libraryReference,
      requestedDate: selectedDate,
      requestedTime: selectedTime,
      ...(photosRestored ? { photoCount: photos.length } : {}),
    });
  }, [hydrated, photosRestored, phase, note, libraryReference, selectedDate, selectedTime, photos.length]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  /* --- who is booking --------------------------------------------- */
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      setAccess("anonymous");
      return;
    }
    if (hasActiveMembership(user)) {
      setAccess("member");
      return;
    }
    const id =
      String((user as { defaultAddressId?: string | null }).defaultAddressId || "") ||
      String(user.addresses?.[0]?._id || "");
    if (!id) {
      setAccess("no-address");
      return;
    }
    setAddressId(id);
    setAccess("checking");
    let cancelled = false;
    getNextBooking(id)
      .then((data) => {
        if (cancelled) return;
        if (data?.freeFirstVisitAvailable) setAccess("eligible");
        else if (data?.hasSubscription) setAccess("member");
        else if (data?.introVisitServiceable === false) setAccess("outside");
        else setAccess("used");
      })
      .catch(() => {
        // Fail closed: never offer a visit the server has not confirmed.
        if (!cancelled) setAccess("used");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user]);

  /* --- availability ----------------------------------------------- */
  const loadMonth = useCallback(async (key: string, force = false) => {
    if (!force && months[key]) return months[key];
    try {
      const data = await getMonthAvailability(key);
      const map: MonthAvailabilityMap = {};
      for (const day of data.days || []) map[day.date] = normalizeDayAvailability(day);
      setMonths((prev) => ({ ...prev, [key]: map }));
      setMonthError((prev) => ({ ...prev, [key]: false }));
      return map;
    } catch {
      setMonthError((prev) => ({ ...prev, [key]: true }));
      return null;
    }
  }, [months]);

  /* Open on the first month that actually has a free day. */
  useEffect(() => {
    if (initialMonthResolved) {
      void loadMonth(month);
      return;
    }
    let cancelled = false;
    (async () => {
      let key = monthOf(today);
      for (let i = 0; i < 3; i++) {
        const map = await loadMonth(key);
        if (cancelled) return;
        const hasDay = map && Object.entries(map).some(([ymd, day]) => ymd >= today && isBookableDay(day));
        if (hasDay || !map) break;
        key = shiftMonth(key, 1);
      }
      if (!cancelled) {
        setMonth(key);
        setInitialMonthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMonthResolved]);

  useEffect(() => {
    if (initialMonthResolved) void loadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, initialMonthResolved]);

  /* The compact strip spans the turn of the month, so it needs next month too. */
  useEffect(() => {
    if (compact && initialMonthResolved) void loadMonth(shiftMonth(monthOf(today), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, initialMonthResolved]);

  const upcomingDays = useMemo(() => {
    const all: string[] = [];
    for (const map of Object.values(months)) {
      for (const [ymd, info] of Object.entries(map)) if (ymd >= today && isBookableDay(info)) all.push(ymd);
    }
    return Array.from(new Set(all)).sort().slice(0, 14);
  }, [months, today]);

  /* The note grows with what is typed, up to a few lines. */
  useEffect(() => {
    if (!compact || !noteRef.current) return;
    const el = noteRef.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [compact, note]);

  const dayFor = useCallback(
    (ymd: string): DayAvailability | undefined => months[monthOf(ymd)]?.[ymd],
    [months]
  );

  const refreshDay = useCallback(async (ymd: string): Promise<DayAvailability | null> => {
    try {
      const data = await getTimeSlots(ymd);
      const day = normalizeDayAvailability(data);
      setMonths((prev) => ({
        ...prev,
        [monthOf(ymd)]: { ...(prev[monthOf(ymd)] || {}), [ymd]: day },
      }));
      return day;
    } catch {
      return null;
    }
  }, []);

  const selectedDay = selectedDate ? dayFor(selectedDate) : undefined;
  const slotOptions = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.slots.filter((s) => s.time);
  }, [selectedDay]);
  const selectedSlotOpen = !!selectedTime && slotOptions.some((s) => s.time === selectedTime && s.available);

  /* --- readiness -------------------------------------------------- */
  const noteOk = wordCount(note) >= 3;
  const photoOk = photos.length > 0 || !!libraryReference;
  const ready = noteOk && photoOk && !!selectedDate && selectedSlotOpen;
  const blocked = access === "member" || access === "used" || access === "outside" || access === "no-address";

  /* --- interactions ----------------------------------------------- */
  const onNoteChange = (value: string) => {
    setNote(value);
    trackOnce("free_visit_flow_started", { step: "describe" });
    if (wordCount(value) >= 3) trackOnce("free_visit_problem_entered");
    if (errors.note) setErrors((e) => ({ ...e, note: undefined }));
  };

  const addQuickTask = (task: string) => {
    const base = note.trim();
    onNoteChange(base ? `${base.replace(/[.\s]+$/, "")}. ${task}` : `${task} - `);
    noteRef.current?.focus();
  };

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    try {
      const compressed: File[] = [];
      for (const f of Array.from(files)) compressed.push(await compressImage(f));
      const next = [...photos, ...compressed].slice(0, MAX_PHOTOS);
      setPhotos(next);
      void savePhotos(next);
      setErrors((e) => ({ ...e, photos: undefined }));
      trackOnce("free_visit_photo_added", { count: next.length });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    void savePhotos(next);
  };

  const pickDate = (ymd: string) => {
    if (ymd === selectedDate) return;
    setSelectedDate(ymd);
    setSelectedTime("");
    setNotice("");
    setErrors((e) => ({ ...e, date: undefined }));
    trackEvent("free_visit_date_selected", { date: ymd });
    trackOnce("free_visit_flow_started", { step: "date" });
    void refreshDay(ymd);
    window.setTimeout(() => {
      timesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
  };

  const pickTime = (time: string) => {
    setSelectedTime(time);
    setNotice("");
    setErrors((e) => ({ ...e, time: undefined }));
    trackEvent("free_visit_time_selected", { date: selectedDate, time });
    if (compact) {
      // Let the chosen time register, then fold day + time into one row.
      window.setTimeout(() => setWhenOpen(false), 260);
      return;
    }
    window.setTimeout(() => {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 160);
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!noteOk) next.note = "Tell us in a few words what needs doing.";
    if (!photoOk) next.photos = "Add a photo, or pick the closest example.";
    if (!selectedDate) next.date = "Pick a day.";
    else if (!selectedSlotOpen) next.time = "Pick a time.";
    setErrors(next);
    if (next.date || next.time) setWhenOpen(true);
    const first = next.note ? noteRef : next.photos ? photosRef : next.date ? calendarRef : next.time ? timesRef : null;
    if (first?.current) {
      first.current.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first === noteRef) noteRef.current?.focus({ preventScroll: true });
    }
    return Object.keys(next).length === 0;
  };

  /* --- creating the booking --------------------------------------- */
  const slotTaken = useCallback(async (ymd: string, message?: string) => {
    setSelectedTime("");
    setWhenOpen(true);
    saveDraft({ requestedTime: "", submitRequested: false });
    setNotice(message || "That time was just taken. Pick another - everything else is saved.");
    await refreshDay(ymd);
    window.setTimeout(() => timesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [refreshDay]);

  const submitBooking = useCallback(async (draftOverride?: {
    note: string; libraryReference: string; date: string; time: string; photos: File[];
  }) => {
    const d = draftOverride || { note, libraryReference, date: selectedDate, time: selectedTime, photos };
    if (!addressId) return;
    setPhase("submitting");
    setFormError("");
    setNotice("");

    /*
     * A fresh look at the day before asking. Not a guarantee - the server's
     * transaction is - but it turns the common case (somebody took the time
     * while this visitor was signing up) into a calm message instead of a
     * failed request.
     */
    const day = await refreshDay(d.date);
    if (day && !getBookableSlots(day).some((s) => s.time === d.time)) {
      setPhase("edit");
      await slotTaken(d.date);
      return;
    }

    try {
      const [h, m] = d.time.split(":").map(Number);
      const when = dateFromYMDLocal(d.date);
      when.setHours(h, m, 0, 0);
      const result = await createBooking({
        service: FREE_VISIT_SERVICE,
        date: when.toISOString(),
        note: d.note.trim(),
        addressId,
        images: d.photos,
        libraryReference: d.libraryReference || undefined,
        requestedDate: d.date,
        requestedTime: d.time,
      });

      const reference = String(result?.booking?.bookingNumber || "");
      trackLead({
        content_name: "free_first_visit",
        status: "free_visit_booked",
        booking_reference: reference,
      });

      const addr = user?.addresses?.find((a) => String(a._id) === String(addressId));
      setConfirmation({
        dateLabel: longDate(d.date),
        timeLabel: time12(d.time),
        address: [addr?.line1, addr?.city].filter(Boolean).join(", "),
        reference,
      });
      setPhase("done");
      await clearDraft();
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    } catch (err) {
      const code = errorCode(err);
      setPhase("edit");
      saveDraft({ submitRequested: false });
      if (code === "SLOT_UNAVAILABLE" || code === "DATE_UNAVAILABLE") {
        await slotTaken(d.date);
      } else if (code === "INTRO_VISIT_CONSUMED" || code === "INTRO_VISIT_CLAIMED") {
        setAccess("used");
      } else if (code === "OUT_OF_SERVICE_AREA") {
        setAccess("outside");
      } else if (code === "PHOTO_REQUIRED") {
        setErrors((e) => ({ ...e, photos: "Add a photo, or pick the closest example." }));
        photosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setFormError(errorMessage(err) || "We couldn't book that just now. Please try again.");
      }
    }
  }, [addressId, id, libraryReference, note, photos, refreshDay, selectedDate, selectedTime, slotTaken, user]);

  const onBook = async () => {
    if (!validate()) return;
    if (access === "anonymous") {
      saveDraft({
        note,
        libraryReference,
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        photoCount: photos.length,
        submitRequested: true,
      });
      await savePhotos(photos);
      trackEvent("free_visit_signup_started", { date: selectedDate, time: selectedTime });
      router.push(`/signup?next=${encodeURIComponent(RESUME_PATH)}&intent=free-visit`);
      return;
    }
    if (access === "eligible") void submitBooking();
  };

  /*
   * Back from signup (or sign-in) with a booking they already asked for: make
   * it. Waits for the photos to come out of IndexedDB and for the server to
   * confirm this address can still have its free visit.
   */
  useEffect(() => {
    if (!autoResume || resumeStarted.current || !hydrated || access !== "eligible") return;
    const draft = loadDraft();
    if (!draft?.submitRequested || !draft.requestedDate || !draft.requestedTime) return;
    resumeStarted.current = true;
    void (async () => {
      const files = await loadPhotos();
      if (files.length) setPhotos(files);
      if (wordCount(draft.note) < 3 || (!files.length && !draft.libraryReference)) {
        // Something did not survive (blocked storage, say): ask for just that.
        saveDraft({ submitRequested: false });
        setErrors({
          note: wordCount(draft.note) < 3 ? "Tell us in a few words what needs doing." : undefined,
          photos: !files.length && !draft.libraryReference ? "Add the photo again, or pick the closest example." : undefined,
        });
        return;
      }
      await submitBooking({
        note: draft.note,
        libraryReference: draft.libraryReference,
        date: draft.requestedDate,
        time: draft.requestedTime,
        photos: files,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResume, hydrated, access]);

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (phase === "done" && confirmation) {
    return (
      <div id={id} className="fv-card fv-enter scroll-mt-24 p-6 text-center sm:p-10" role="status">
        <div className="fv-check mx-auto" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-5 text-[30px] font-bold leading-tight tracking-[-0.03em] text-[#0B1628] sm:text-[38px]">
          You&rsquo;re booked.
        </h2>
        <p className="mt-2 text-[16px] text-[#5b6577]">Your free 90-minute visit is on the calendar.</p>
        <dl className="mx-auto mt-6 grid max-w-[420px] gap-2 text-left">
          <SummaryRow label="When" value={`${confirmation.dateLabel} · ${confirmation.timeLabel}`} />
          {confirmation.address ? <SummaryRow label="Where" value={confirmation.address} /> : null}
          {confirmation.reference ? <SummaryRow label="Booking" value={`#${confirmation.reference}`} /> : null}
        </dl>
        <p className="mx-auto mt-5 max-w-[420px] text-[14px] leading-6 text-[#64748B]">
          We&rsquo;ll confirm by email and text. You can see or change it any time in My Home.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/account" className="fv-cta w-full sm:w-auto">Go to My Home</Link>
          <Link href="/membership/plans" className="fv-link">See membership plans</Link>
        </div>
      </div>
    );
  }

  const grid = monthGrid(month);
  const monthMap = months[month];
  const canGoBack = month > monthOf(today);
  const canGoForward = month < shiftMonth(monthOf(today), MONTHS_AHEAD - 1);
  const submitting = phase === "submitting";

  if (compact) {
    const started = noteFocused || note.trim().length > 0 || photos.length > 0 || !!libraryReference;
    const picked = !!selectedDate && selectedSlotOpen;
    const showWhen = whenOpen || !picked;
    return (
      <div id={id} className="fv-card fv-compact scroll-mt-24" aria-busy={submitting} data-fv-variant="compact">
        {/* The job */}
        <div className={`fv-field ${errors.note ? "fv-field--error" : ""}`}>
          <svg className="fv-field-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          <textarea
            ref={noteRef}
            rows={1}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            onFocus={() => setNoteFocused(true)}
            onBlur={() => setNoteFocused(false)}
            maxLength={1200}
            placeholder="What needs fixing?"
            aria-label="What do you need help with?"
            aria-invalid={!!errors.note}
            className="fv-cinput"
            data-fv="note"
          />
        </div>
        {errors.note ? <p className="fv-error">{errors.note}</p> : null}

        {!note.trim() ? (
          <div className="fv-strip mt-2" aria-label="Common jobs">
            {QUICK_TASKS.map((task) => (
              <button key={task} type="button" className="fv-chip shrink-0" onClick={() => addQuickTask(task)}>
                {task}
              </button>
            ))}
          </div>
        ) : null}

        {/* Photo or example - appears once the job is being described */}
        <div className={`fv-reveal ${started ? "fv-reveal--open" : ""}`}>
          <div>
            <div ref={photosRef} className="fv-proof pt-2.5" data-fv="photos">
              <label className={`fv-mini-btn ${photoBusy ? "opacity-60" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void onPhotos(e.target.files);
                    e.target.value = "";
                  }}
                  disabled={photoBusy || photos.length >= MAX_PHOTOS}
                />
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="M4 8.5A2.5 2.5 0 016.5 6h1.6l1.2-1.6A1 1 0 0110.1 4h3.8a1 1 0 01.8.4L15.9 6h1.6A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5v-8z" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                {photoBusy ? "Adding…" : photos.length ? "Add" : "Add photo"}
              </label>
              {photoUrls.map((url, i) => (
                <div key={url} className="fv-thumb !h-11 !w-11">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`} />
                  <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>×</button>
                </div>
              ))}
              {!photos.length ? (
                <>
                  <PhotoLibraryPicker
                    compact
                    value={libraryReference}
                    onChange={(key) => {
                      setLibraryReference(key);
                      setErrors((e) => ({ ...e, photos: undefined }));
                    }}
                    context="free_visit"
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
        {errors.photos ? <p className="fv-error">{errors.photos}</p> : null}

        {/* When */}
        <div ref={calendarRef} className="mt-3 scroll-mt-28">
          {showWhen ? (
            <>
              <div className="flex items-center justify-between">
                <span className="fv-label">Pick a day</span>
                <button type="button" className="fv-textbtn" onClick={() => setGridOpen((v) => !v)} aria-expanded={gridOpen}>
                  {gridOpen ? "Fewer dates" : "More dates"}
                </button>
              </div>
              {gridOpen ? (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between">
                    <button type="button" className="fv-nav" onClick={() => setMonth(shiftMonth(month, -1))} disabled={!canGoBack} aria-label="Previous month">‹</button>
                    <span className="text-[14px] font-semibold text-[#0B1628]" aria-live="polite">{monthLabel(month)}</span>
                    <button type="button" className="fv-nav" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canGoForward} aria-label="Next month">›</button>
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]" aria-hidden="true">
                    {WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel(month)}>
                    {grid.map((ymd, i) => {
                      if (!ymd) return <div key={`pad-${i}`} />;
                      const open = ymd >= today && isBookableDay(monthMap?.[ymd]);
                      const isSelected = ymd === selectedDate;
                      return (
                        <button
                          key={ymd}
                          type="button"
                          role="gridcell"
                          disabled={!open}
                          aria-selected={isSelected}
                          aria-label={`${longDate(ymd)}${open ? "" : ", unavailable"}`}
                          onClick={() => {
                            pickDate(ymd);
                            setGridOpen(false);
                          }}
                          className={`fv-day fv-day--compact ${isSelected ? "fv-day--selected" : open ? "fv-day--open" : "fv-day--closed"} ${!monthMap ? "fv-shimmer" : ""}`}
                        >
                          {Number(ymd.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="fv-strip mt-1.5 pb-1" role="listbox" aria-label="Open days" data-fv="days">
                  {upcomingDays.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="fv-daypill fv-shimmer" />)
                    : upcomingDays.map((ymd) => {
                        const isSelected = ymd === selectedDate;
                        const [y, m, d] = ymd.split("-").map(Number);
                        const at = new Date(Date.UTC(y, m - 1, d));
                        const wd = at.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
                        const mo = at.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
                        return (
                          <button
                            key={ymd}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            aria-label={longDate(ymd)}
                            onClick={() => pickDate(ymd)}
                            data-booking-date={ymd}
                            data-booking-date-disabled="false"
                            className={`fv-daypill ${isSelected ? "fv-daypill--on" : ""}`}
                          >
                            <span className="fv-daypill-wd">{wd}</span>
                            <span className="fv-daypill-d">{d}</span>
                            <span className="fv-daypill-mo">{mo}</span>
                          </button>
                        );
                      })}
                </div>
              )}
              {monthError[month] ? (
                <p className="fv-error">
                  We couldn&rsquo;t load the calendar.{" "}
                  <button type="button" className="underline" onClick={() => void loadMonth(month, true)}>Try again</button>
                </p>
              ) : null}
              {errors.date ? <p className="fv-error">{errors.date}</p> : null}

              <div ref={timesRef} className={`fv-reveal scroll-mt-28 ${selectedDate ? "fv-reveal--open" : ""}`}>
                <div>
                  {selectedDate ? (
                    <div className="pt-2.5">
                      {notice ? <p className="fv-notice mb-2" role="alert">{notice}</p> : null}
                      {!selectedDay ? (
                        <div className="grid grid-cols-4 gap-1.5">
                          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="fv-slot fv-slot--compact fv-shimmer" />)}
                        </div>
                      ) : slotOptions.length ? (
                        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Times on ${longDate(selectedDate)}`} data-fv="times">
                          {slotOptions.map((slot) => {
                            const isSelected = slot.available && slot.time === selectedTime;
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                disabled={!slot.available}
                                onClick={() => pickTime(slot.time)}
                                data-booking-time={slot.time}
                                data-booking-time-available={slot.available ? "true" : "false"}
                                className={`fv-slot fv-slot--compact ${isSelected ? "fv-slot--selected" : slot.available ? "" : "fv-slot--taken"}`}
                                aria-label={`${time12(slot.time)}${slot.available ? "" : ", booked"}`}
                              >
                                {time12(slot.time)}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[#64748B]">This day just filled up. Pick another.</p>
                      )}
                      {errors.time ? <p className="fv-error">{errors.time}</p> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <button type="button" className="fv-sumrow fv-enter" onClick={() => setWhenOpen(true)} data-fv="when-summary">
              <span className="fv-sumcheck" aria-hidden="true">✓</span>
              <span className="min-w-0 flex-1 truncate text-left">
                {shortDate(selectedDate)} · {time12(selectedTime)}
              </span>
              <span className="text-[13px] font-semibold text-[#306EEC]">Change</span>
            </button>
          )}
        </div>

        <div ref={summaryRef} className="scroll-mt-28">
          <AccessNotice access={access} />
          {formError ? <p className="fv-error" role="alert">{formError}</p> : null}
          {!blocked ? (
            <>
              <button
                type="button"
                className={`fv-cta fv-cta--compact mt-3 w-full ${ready ? "fv-cta--ready" : ""}`}
                onClick={() => void onBook()}
                disabled={submitting || access === "checking"}
                data-fv="book"
              >
                {submitting ? (
                  <><span className="fv-spinner" aria-hidden="true" /> Booking your visit…</>
                ) : (
                  <>Book my free visit <span aria-hidden="true">→</span></>
                )}
              </button>
              <p className="mt-2 text-center text-[13px] text-[#64748B]">90 minutes · free · no card needed</p>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="fv-card scroll-mt-24" aria-busy={submitting}>
      {/* 1. The job */}
      <section className="fv-step" aria-labelledby={`${id}-what`}>
        <StepLabel n={1} done={noteOk && photoOk} />
        <h2 id={`${id}-what`} className="fv-step-title">What do you need help with?</h2>
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          maxLength={1200}
          placeholder="e.g. The bathroom faucet drips and a towel bar came off the wall."
          className={`fv-input mt-3 min-h-[96px] resize-none ${errors.note ? "fv-input--error" : ""}`}
          aria-invalid={!!errors.note}
          aria-describedby={errors.note ? `${id}-note-error` : undefined}
          data-fv="note"
        />
        {errors.note ? <p id={`${id}-note-error`} className="fv-error">{errors.note}</p> : null}
        {/* One swipeable row on a phone, so six suggestions do not cost four rows of height. */}
        <div className="-mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label="Common jobs">
          {QUICK_TASKS.map((task) => (
            <button key={task} type="button" className="fv-chip shrink-0" onClick={() => addQuickTask(task)}>
              + {task}
            </button>
          ))}
        </div>

        <div ref={photosRef} className="mt-5 scroll-mt-28" data-fv="photos">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className={`fv-photo-btn ${photoBusy ? "opacity-60" : ""}`}>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void onPhotos(e.target.files);
                  e.target.value = "";
                }}
                disabled={photoBusy || photos.length >= MAX_PHOTOS}
              />
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M4 8.5A2.5 2.5 0 016.5 6h1.6l1.2-1.6A1 1 0 0110.1 4h3.8a1 1 0 01.8.4L15.9 6h1.6A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5v-8z" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              {photoBusy ? "Adding…" : photos.length ? "Add another photo" : "Add a photo"}
            </label>
            {photoUrls.map((url, i) => (
              <div key={url} className="fv-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} />
                <button type="button" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>×</button>
              </div>
            ))}
          </div>
          {!photos.length ? (
            <div className="mt-1">
              <PhotoLibraryPicker value={libraryReference} onChange={(key) => {
                setLibraryReference(key);
                setErrors((e) => ({ ...e, photos: undefined }));
              }} context="free_visit" />
            </div>
          ) : null}
          {errors.photos ? <p className="fv-error">{errors.photos}</p> : null}
        </div>
      </section>

      {/* 2. The day */}
      <section ref={calendarRef} className="fv-step scroll-mt-28" aria-labelledby={`${id}-when`}>
        <StepLabel n={2} done={!!selectedDate} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 id={`${id}-when`} className="fv-step-title">Pick a day</h2>
          <div className="-mx-2 flex items-center justify-between gap-1 sm:mx-0 sm:justify-end">
            <button type="button" className="fv-nav" onClick={() => setMonth(shiftMonth(month, -1))} disabled={!canGoBack} aria-label="Previous month">‹</button>
            <span className="min-w-[128px] text-center text-[14px] font-semibold text-[#0B1628]" aria-live="polite">{monthLabel(month)}</span>
            <button type="button" className="fv-nav" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canGoForward} aria-label="Next month">›</button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]" aria-hidden="true">
          {WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel(month)} data-fv="calendar">
          {grid.map((ymd, i) => {
            if (!ymd) return <div key={`pad-${i}`} />;
            const info = monthMap?.[ymd];
            const open = ymd >= today && isBookableDay(info);
            const isSelected = ymd === selectedDate;
            return (
              <button
                key={ymd}
                type="button"
                role="gridcell"
                disabled={!open}
                aria-selected={isSelected}
                aria-label={`${longDate(ymd)}${open ? "" : ", unavailable"}`}
                onClick={() => pickDate(ymd)}
                data-booking-date={ymd}
                data-booking-date-disabled={open ? "false" : "true"}
                className={`fv-day ${isSelected ? "fv-day--selected" : open ? "fv-day--open" : "fv-day--closed"} ${!monthMap ? "fv-shimmer" : ""}`}
              >
                {Number(ymd.slice(8))}
              </button>
            );
          })}
        </div>
        {monthError[month] ? (
          <p className="fv-error">
            We couldn&rsquo;t load the calendar.{" "}
            <button type="button" className="underline" onClick={() => void loadMonth(month, true)}>Try again</button>
          </p>
        ) : monthMap && !Object.entries(monthMap).some(([ymd, d]) => ymd >= today && isBookableDay(d)) ? (
          <p className="mt-3 text-[13px] text-[#64748B]">No open days this month - try the next one.</p>
        ) : null}
        {errors.date ? <p className="fv-error">{errors.date}</p> : null}

        {/* 3. The time - slides open under the chosen day */}
        <div ref={timesRef} className={`fv-reveal scroll-mt-28 ${selectedDate ? "fv-reveal--open" : ""}`}>
          <div>
            {selectedDate ? (
              <div className="pt-5">
                <p className="text-[14px] font-semibold text-[#0B1628]">
                  {longDate(selectedDate)}
                </p>
                {notice ? <p className="fv-notice mt-2" role="alert">{notice}</p> : null}
                {!selectedDay ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="fv-slot fv-shimmer h-12" />)}
                  </div>
                ) : slotOptions.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Available times" data-fv="times">
                    {slotOptions.map((slot) => {
                      const isSelected = slot.available && slot.time === selectedTime;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={!slot.available}
                          onClick={() => pickTime(slot.time)}
                          data-booking-time={slot.time}
                          data-booking-time-available={slot.available ? "true" : "false"}
                          className={`fv-slot ${isSelected ? "fv-slot--selected" : slot.available ? "" : "fv-slot--taken"}`}
                          aria-label={`${time12(slot.time)}${slot.available ? "" : ", booked"}`}
                        >
                          {time12(slot.time)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-[14px] text-[#64748B]">This day just filled up. Pick another.</p>
                )}
                {errors.time ? <p className="fv-error">{errors.time}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 4. Summary + the one button */}
      <section ref={summaryRef} className="fv-step fv-step--last scroll-mt-28" aria-label="Your visit">
        <AccessNotice access={access} />
        <div className={`fv-reveal ${selectedDate && selectedSlotOpen ? "fv-reveal--open" : ""}`}>
          <div>
            {selectedDate && selectedSlotOpen ? (
              <div className="fv-summary">
                <div className="fv-summary-row">
                  <span>Free first visit</span>
                  <span className="text-[#0B1628]">$0</span>
                </div>
                <div className="fv-summary-row">
                  <span>{shortDate(selectedDate)} · {time12(selectedTime)}</span>
                  <span>90 min</span>
                </div>
                {noteOk ? (
                  <p className="mt-1 line-clamp-2 text-[13px] text-[#64748B]">
                    {note.trim()}
                    {!photos.length && libraryReference ? ` · Example: ${libraryLabel(libraryReference)}` : ""}
                    {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {formError ? <p className="fv-error" role="alert">{formError}</p> : null}

        {!blocked ? (
          <>
            <button
              type="button"
              className={`fv-cta mt-4 w-full ${ready ? "fv-cta--ready" : ""}`}
              onClick={() => void onBook()}
              disabled={submitting || access === "checking"}
              data-fv="book"
            >
              {submitting ? (
                <><span className="fv-spinner" aria-hidden="true" /> Booking your visit…</>
              ) : (
                <>Book my free visit <span aria-hidden="true">→</span></>
              )}
            </button>
            <p className="mt-3 text-center text-[13px] text-[#64748B]">
              {access === "anonymous"
                ? "Next: your address and contact. About a minute. No card needed."
                : "No card needed."}
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}

function StepLabel({ n, done }: { n: number; done: boolean }) {
  return (
    <div className={`fv-step-n ${done ? "fv-step-n--done" : ""}`} aria-hidden="true">
      {done ? (
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
          <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : n}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-[12px] bg-[#F6F8FC] px-4 py-3">
      <dt className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">{label}</dt>
      <dd className="text-right text-[15px] font-semibold text-[#0B1628]">{value}</dd>
    </div>
  );
}

/** What a signed-in customer who cannot have the free visit sees instead of a button that would fail. */
function AccessNotice({ access }: { access: Access }) {
  if (access === "member") {
    return (
      <div className="fv-panel" data-fv-access="member">
        <p className="font-semibold text-[#0B1628]">You&rsquo;re a member.</p>
        <p className="mt-1 text-[14px] text-[#5b6577]">Book your visit from your member calendar.</p>
        <Link href="/book?visit=membership" className="fv-cta mt-4 w-full">Book as a member</Link>
      </div>
    );
  }
  if (access === "used") {
    return (
      <div className="fv-panel" data-fv-access="used">
        <p className="font-semibold text-[#0B1628]">Your free visit has been used at this address.</p>
        <p className="mt-1 text-[14px] text-[#5b6577]">Book a one-time visit, or get a plan for regular help.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/book?visit=additional" className="fv-cta">Book a one-time visit</Link>
          <Link href="/membership/plans" className="fv-cta fv-cta--quiet">See plans</Link>
        </div>
      </div>
    );
  }
  if (access === "outside") {
    return (
      <div className="fv-panel" data-fv-access="outside">
        <p className="font-semibold text-[#0B1628]">We&rsquo;re not in your area yet.</p>
        <p className="mt-1 text-[14px] text-[#5b6577]">Profixter serves Nassau and Suffolk counties on Long Island.</p>
      </div>
    );
  }
  if (access === "no-address") {
    return (
      <div className="fv-panel" data-fv-access="no-address">
        <p className="font-semibold text-[#0B1628]">Add your home address to book.</p>
        <Link href="/account" className="fv-cta mt-4 w-full">Add address</Link>
      </div>
    );
  }
  return null;
}
