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
 * free-visit rule (one per customer, service area, photo or example, Labor Only).
 * This component only renders what the server answers.
 *
 * TWO WAYS TO BOOK (`guest`: the homepage and /book/free). A signed-out visitor
 * first chooses, and only the chosen form is shown; the job, day and time are
 * shared, so switching never loses them.
 *
 *  - "Book my free visit" (online): the draft waits in lib/booking-draft while
 *    they sign up or sign in on /signup, which returns to /book/free. There the
 *    home is added (or picked) and missing contact details collected in place,
 *    then the booking is created from the draft with the time they chose. The
 *    server holds the slot and the visit waits in "Pending Confirmation" for
 *    the owner; this screen says so and never calls it confirmed.
 *  - "Have us call you" (callback): name, mobile and email under the day and
 *    time, one press, POST /api/free-visit-requests. No account, no address.
 *    That reserves the slot as a pending request for the owner to call and
 *    confirm, and only once it is saved does the Meta Lead fire, in the browser
 *    here and on the server with the same event id.
 *
 * Both are the same free visit and share one lifetime limit, enforced on the
 * server (utils/freeVisit/eligibility); nothing here decides eligibility.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { useServiceTextsOptIn } from "@/app/components/booking/ServiceTextsOptIn";
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
import { getAttribution, getFbCookies, newEventId, trackLead, trackSchedule, trackStep } from "@/lib/meta";
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
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
/*
 * Shown under the contact fields, and sent back with the request: the server
 * refuses anything but this exact sentence and stores it as the consent the
 * confirmation text is sent on. Change it in routes/freeVisitRequests.js too.
 */
const CONTACT_CONSENT_TEXT =
  "By booking, you agree to be contacted by call or text about your visit. Msg & data rates may apply.";
/* sessionStorage: the out-of-area state has been counted for this tab. */
const OUT_OF_AREA_SHOWN_KEY = "pf_out_of_area_shown";

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
  /* A free visit is already requested or booked and not finished yet. */
  | "active"
  | "outside"
  | "no-address";

type Channel = "" | "online" | "callback";

type Phase = "edit" | "submitting" | "done";

type Confirmation = {
  dateLabel: string;
  timeLabel: string;
  address: string;
  reference?: string;
  /* What they asked for, as they typed it. */
  work?: string;
  /* A homepage request: we call to confirm, so it is not "booked" yet. */
  request?: boolean;
};

type Contact = { name: string; phone: string; email: string };
type ContactErrors = Partial<Record<keyof Contact, string>>;

/* 10 digits, or 11 with the leading US 1. */
function usPhoneDigits(value: string): string {
  const d = value.replace(/\D/g, "");
  const national = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(national) ? national : "";
}

function contactErrorsFor(c: Contact): ContactErrors {
  const out: ContactErrors = {};
  const name = c.name.trim();
  if (!name) out.name = "Enter your full name.";
  else if (name.length < 2 || !/\s/.test(name)) out.name = "Enter your first and last name.";
  if (!usPhoneDigits(c.phone)) out.phone = "Enter a 10-digit US mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim())) out.email = "Enter a valid email address.";
  return out;
}

/* The ad's parameters as they are on this page's URL. */
function urlParamsNow(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "gbraid", "wbraid", "campaign_id", "adset_id", "ad_id",
    ]) {
      const value = params.get(key);
      if (value) out[key] = value;
    }
  } catch {
    /* no URL params */
  }
  return out;
}

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
  guest = false,
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
  /**
   * The homepage and /book/free: a signed-out visitor books in one step with
   * name, mobile and email instead of going through /signup. Signed-in
   * visitors keep the account booking exactly as before.
   */
  guest?: boolean;
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
  const [channel, setChannel] = useState<Channel>("");
  const [addressId, setAddressId] = useState("");
  /* More than one home on the account: back from signup, they pick before it books. */
  const [addressPicked, setAddressPicked] = useState(false);
  const { requestHome, homeSheet } = useAddHome();
  const { ensureContact, contactSheet } = useContactCompletion();
  const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn();
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
  /* --- the person, homepage guest request only ---------------------- */
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "" });
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});

  const noteRef = useRef<HTMLTextAreaElement>(null);
  const photosRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const timesRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const tracked = useRef<Set<string>>(new Set());
  const resumeStarted = useRef(false);
  const contactRef = useRef<HTMLDivElement>(null);
  /*
   * One id per submission, kept across retries of the same press (a dropped
   * connection, a double tap) so the server sees one lead and Meta one Lead.
   * Replaced only after a success.
   */
  const requestEventId = useRef("");
  const leadFired = useRef(false);
  /* One online submit at a time: a double tap must not send two. */
  const submitting$ = useRef(false);
  /* The add-home sheet opens by itself once per visit, never in a loop. */
  const homePrompted = useRef(false);

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
      if (draft.channel) setChannel(draft.channel);
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
      channel,
      ...(photosRestored ? { photoCount: photos.length } : {}),
    });
  }, [hydrated, photosRestored, phase, note, libraryReference, selectedDate, selectedTime, photos.length, channel]);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  /* --- who is booking --------------------------------------------- */
  const homes = useMemo(() => (isAuthenticated && user?.addresses ? user.addresses : []), [isAuthenticated, user]);

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
    if (!homes.length) {
      setAddressId("");
      setAccess("no-address");
      return;
    }
    // Keep the home they picked; otherwise the default, then the first.
    setAddressId((current) =>
      current && homes.some((a) => String(a._id) === current)
        ? current
        : String((user as { defaultAddressId?: string | null }).defaultAddressId || "") || String(homes[0]?._id || "")
    );
  }, [isLoading, isAuthenticated, user, homes]);

  /* Can this home have the free visit? Asked again whenever the home changes. */
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || hasActiveMembership(user) || !addressId) return;
    setAccess("checking");
    let cancelled = false;
    getNextBooking(addressId)
      .then((data) => {
        if (cancelled) return;
        if (data?.freeFirstVisitAvailable) setAccess("eligible");
        else if (data?.hasSubscription) setAccess("member");
        else if (data?.introVisitServiceable === false) setAccess("outside");
        else if (data?.introVisitStatus === "claimed") setAccess("active");
        else setAccess("used");
      })
      .catch(() => {
        // Fail closed: never offer a visit the server has not confirmed.
        if (!cancelled) setAccess("used");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user, addressId]);

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
  /* Signed out where guests are welcome: they choose online or a callback first. */
  const choosing = guest && !isLoading && access === "anonymous";
  /* The callback request: name and number, no /signup. */
  const guestMode = choosing && channel === "callback";
  /* Back from signup with more than one home: which one, before it books. */
  const needsHomePick = autoResume && homes.length > 1 && !addressPicked;
  const noteOk = wordCount(note) >= 3;
  /* The request asks for a photo only if they have one; the owner sees the job on the call. */
  const photoOk = guestMode || photos.length > 0 || !!libraryReference;
  const contactOk = !guestMode || Object.keys(contactErrorsFor(contact)).length === 0;
  const ready = noteOk && photoOk && !!selectedDate && selectedSlotOpen && contactOk;

  /* --- funnel steps (anonymous, once per browser per day) --------- */
  const stepsSent = useRef<Set<string>>(new Set());
  const step = useCallback((name: Parameters<typeof trackStep>[0]) => {
    if (stepsSent.current.has(name)) return;
    stepsSent.current.add(name);
    trackStep(name);
  }, []);
  useEffect(() => {
    if (access === "anonymous" || access === "eligible") step("booking_page_view");
  }, [access, step]);
  useEffect(() => {
    if (note.trim() || selectedDate) step("booker_started");
  }, [note, selectedDate, step]);
  useEffect(() => {
    if (selectedSlotOpen) step("slot_selected");
  }, [selectedSlotOpen, step]);
  const blocked = access === "member" || access === "used" || access === "active" || access === "outside" || access === "no-address";
  const waitlist = useMemo(
    () => ({
      zip: String(user?.addresses?.find((a) => String(a._id) === String(addressId))?.zip || ""),
      email: String(user?.email || ""),
    }),
    [user, addressId]
  );

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
    const nextContact = guestMode ? contactErrorsFor(contact) : {};
    setContactErrors(nextContact);
    if (next.date || next.time) setWhenOpen(true);
    const firstContact = (["name", "phone", "email"] as const).find((k) => nextContact[k]);
    const first = next.note ? noteRef : next.photos ? photosRef : next.date ? calendarRef : next.time ? timesRef : firstContact ? contactRef : null;
    if (first?.current) {
      first.current.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first === noteRef) noteRef.current?.focus({ preventScroll: true });
      if (first === contactRef) {
        contactRef.current?.querySelector<HTMLInputElement>(`[data-fv-contact="${firstContact}"]`)?.focus({ preventScroll: true });
      }
    }
    return Object.keys(next).length === 0 && !firstContact;
  };

  const onContactChange = (field: keyof Contact, value: string) => {
    setContact((c) => ({ ...c, [field]: value }));
    if (contactErrors[field]) setContactErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError("");
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
    if (!addressId || submitting$.current) return;
    submitting$.current = true;
    try {
      if (!(await ensureContact())) return;
      setPhase("submitting");
      setFormError("");
      setNotice("");
      /* The same id for every retry of this submission; replaced only after it succeeds. */
      const priorAttempt = loadDraft()?.clientRequestId || "";
      const clientRequestId = priorAttempt || newEventId();
      saveDraft({ clientRequestId });

      /*
       * A fresh look at the day before asking. Not a guarantee - the server's
       * transaction is - but it turns the common case (somebody took the time
       * while this visitor was signing up) into a calm message instead of a
       * failed request. Skipped when this submission was already sent once: the
       * time may be gone because it is THEIRS (a refresh while it was booking),
       * and only the server can tell that apart from somebody else taking it.
       */
      if (!priorAttempt) {
        const day = await refreshDay(d.date);
        if (day && !getBookableSlots(day).some((s) => s.time === d.time)) {
          setPhase("edit");
          await slotTaken(d.date);
          return;
        }
      }

      try {
        const [h, m] = d.time.split(":").map(Number);
        const when = dateFromYMDLocal(d.date);
        when.setHours(h, m, 0, 0);
        const payload = {
          service: FREE_VISIT_SERVICE,
          date: when.toISOString(),
          note: d.note.trim(),
          addressId,
          images: d.photos,
          libraryReference: d.libraryReference || undefined,
          requestedDate: d.date,
          requestedTime: d.time,
          clientRequestId,
        };
        let result: Awaited<ReturnType<typeof createBooking>> & { duplicate?: boolean };
        try {
          result = await createBooking(payload);
        } catch (err) {
          /*
           * "Already booked" right after a refresh can be this same submission,
           * still finishing on the server. Ask once more with the same id: if it
           * was ours, the server hands back that booking.
           */
          if (errorCode(err) !== "INTRO_VISIT_CLAIMED") throw err;
          await new Promise((r) => window.setTimeout(r, 2500));
          result = await createBooking(payload);
        }

        const reference = String(result?.booking?.bookingNumber || "");
        /* Only now, with the booking accepted: the box is never a condition of it. */
        await applyServiceTextsOptIn();
        /*
         * Schedule, not a second Lead: the Lead was this person's account,
         * created a minute ago on /signup. Not again for a submission the server
         * had already booked (a refresh mid-submit).
         */
        if (!result?.duplicate) {
          trackSchedule({
            content_name: "free_first_visit",
            status: "free_visit_booked",
            booking_reference: reference,
          });
        }

        const addr = user?.addresses?.find((a) => String(a._id) === String(addressId));
        /* A booking the server had already made shows its own time, not whatever is selected now. */
        const madeAt = result?.duplicate && result.booking?.date ? new Date(result.booking.date) : null;
        const shownDate = madeAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(madeAt) : d.date;
        const shownTime = madeAt && result.booking?.time ? String(result.booking.time) : d.time;
        setConfirmation({
          dateLabel: longDate(shownDate),
          timeLabel: time12(shownTime),
          address: [addr?.line1, addr?.city, addr?.state, addr?.zip].filter(Boolean).join(", "),
          reference,
          work: d.note.trim(),
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
        } else if (code === "INTRO_VISIT_CONSUMED") {
          setAccess("used");
        } else if (code === "INTRO_VISIT_CLAIMED") {
          setAccess("active");
        } else if (code === "OUT_OF_SERVICE_AREA") {
          setAccess("outside");
        } else if (code === "PHOTO_REQUIRED") {
          setErrors((e) => ({ ...e, photos: "Add a photo, or pick the closest example." }));
          photosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          setFormError(errorMessage(err) || "We couldn't book that just now. Please try again.");
        }
      }
    } finally {
      submitting$.current = false;
    }
  }, [addressId, applyServiceTextsOptIn, ensureContact, id, libraryReference, note, photos, refreshDay, selectedDate, selectedTime, slotTaken, user]);

  /*
   * The homepage request, in one press. The Lead fires only after the server
   * has saved it, once, with the event id the server used for its own Lead -
   * so Meta keeps one conversion, and a failed request never counts as one.
   */
  const submitGuestRequest = async () => {
    setPhase("submitting");
    setFormError("");
    setNotice("");
    if (!requestEventId.current) requestEventId.current = newEventId();
    const eventId = requestEventId.current;

    try {
      const form = new FormData();
      const { fbp, fbc } = getFbCookies();
      const fields: Record<string, string> = {
        name: contact.name.trim(),
        phone: usPhoneDigits(contact.phone),
        email: contact.email.trim(),
        note: note.trim(),
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        libraryReference: photos.length ? "" : libraryReference,
        consentText: CONTACT_CONSENT_TEXT,
        eventId,
        pageUrl: window.location.href,
        sourcePage: window.location.pathname || "/",
        urlParams: JSON.stringify(urlParamsNow()),
        attribution: JSON.stringify(getAttribution()),
        fbp,
        fbc,
      };
      for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
      for (const file of photos) form.append("images", file, file.name || "photo.jpg");

      const res = await fetch(`${API_BASE}/api/free-visit-requests`, { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean; code?: string; field?: keyof Contact | "note" | "date"; message?: string;
      };

      if (res.ok && body.success) {
        if (!leadFired.current) {
          leadFired.current = true;
          trackLead(
            { content_name: "free_first_visit", status: "free_visit_requested", lead_type: "free_visit_request" },
            // The server already sent its half with this id; no second relay.
            { eventId, relay: false }
          );
        }
        requestEventId.current = "";
        setConfirmation({ dateLabel: longDate(selectedDate), timeLabel: time12(selectedTime), address: "", request: true });
        setPhase("done");
        await clearDraft();
        window.setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
        return;
      }

      setPhase("edit");
      if (body.code === "SLOT_UNAVAILABLE" || body.code === "DATE_UNAVAILABLE") {
        await slotTaken(selectedDate, body.code === "DATE_UNAVAILABLE" ? "Please pick another day - everything else is saved." : undefined);
      } else if (body.field === "name" || body.field === "phone" || body.field === "email") {
        setContactErrors((e) => ({ ...e, [body.field as keyof Contact]: body.message }));
        contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (body.field === "note") {
        setErrors((e) => ({ ...e, note: body.message }));
        noteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setFormError(body.message || "We couldn't send that just now. Please try again, or call or text 631-599-1363.");
      }
    } catch {
      setPhase("edit");
      setFormError("We couldn't reach our server. Check your connection and try again.");
    }
  };

  /*
   * Add the home inline, then carry on: the refreshed user re-runs the
   * "who is booking" effect above, which asks the server about the free visit.
   */
  const addHomeAndContinue = async () => {
    const home = await requestHome();
    if (home?.address?._id) {
      setAddressId(String(home.address._id));
      setAddressPicked(true);
    }
  };

  const onBook = async () => {
    if (!validate()) return;
    if (guestMode) {
      await submitGuestRequest();
      return;
    }
    if (access === "anonymous") {
      saveDraft({
        note,
        libraryReference,
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        photoCount: photos.length,
        submitRequested: true,
        channel: "online",
        clientRequestId: newEventId(),
      });
      await savePhotos(photos);
      trackEvent("free_visit_signup_started", { date: selectedDate, time: selectedTime });
      step("signup_view");
      router.push(`/signup?next=${encodeURIComponent(RESUME_PATH)}&intent=free-visit`);
      return;
    }
    if (access === "eligible") {
      setAddressPicked(true);
      void submitBooking();
    }
  };

  /*
   * Back from signup (or sign-in) with a booking they already asked for: make
   * it. Waits for the photos to come out of IndexedDB and for the server to
   * confirm this address can still have its free visit.
   */
  useEffect(() => {
    if (!autoResume || !hydrated) return;
    const draft = loadDraft();
    if (!draft?.submitRequested || !draft.requestedDate || !draft.requestedTime) return;
    /* Signed up with no home yet: ask for it here, once, then carry on. */
    if (access === "no-address" && !homePrompted.current) {
      homePrompted.current = true;
      void addHomeAndContinue();
      return;
    }
    if (resumeStarted.current || access !== "eligible" || needsHomePick) return;
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
  }, [autoResume, hydrated, access, needsHomePick]);

  /* Back from signup with several homes: the one question left is which, so bring it into view. */
  useEffect(() => {
    if (!needsHomePick || !hydrated || access !== "eligible" || !loadDraft()?.submitRequested) return;
    window.setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  }, [needsHomePick, hydrated, access]);

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (phase === "done" && confirmation?.request) {
    return (
      <div id={id} className="fv-card fv-enter scroll-mt-24 p-6 text-center sm:p-10" role="status" data-fv="request-done">
        <div className="fv-check mx-auto" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="ui-h2 mt-5">
          Request received!
        </h2>
        <p className="mx-auto mt-3 max-w-[420px] text-[16px] leading-[1.6] text-[color:var(--ui-text-2)]">
          We&rsquo;ll call to confirm your free visit.
        </p>
        <dl className="mx-auto mt-5 grid max-w-[420px] gap-2 text-left">
          <SummaryRow label="Requested" value={`${confirmation.dateLabel} · ${confirmation.timeLabel}`} />
        </dl>
        <p className="mx-auto mt-5 max-w-[420px] text-[14px] leading-6 text-[color:var(--ui-text-3)]">
          We&rsquo;ve sent the details to your email and phone. Questions? Call or text{" "}
          <a href="tel:+16315991363" className="fv-link whitespace-nowrap text-[14px]">631-599-1363</a>.
        </p>
      </div>
    );
  }

  if (phase === "done" && confirmation) {
    return (
      <div id={id} className="fv-card fv-enter scroll-mt-24 p-6 text-center sm:p-10" role="status" data-fv="booked">
        <div className="fv-check mx-auto" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="ui-h2 mt-5">
          Your free visit is booked!
        </h2>
        <p className="fv-awaiting mx-auto mt-3" data-fv="awaiting">
          <span className="fv-awaiting__dot" aria-hidden="true" />
          Awaiting confirmation from Profixter.
        </p>
        <dl className="mx-auto mt-5 grid max-w-[420px] gap-2 text-left">
          <SummaryRow label="Date" value={confirmation.dateLabel} />
          <SummaryRow label="Time" value={confirmation.timeLabel} />
          {confirmation.address ? <SummaryRow label="Address" value={confirmation.address} /> : null}
          {confirmation.work ? <SummaryRow label="Work" value={confirmation.work} /> : null}
          {confirmation.reference ? <SummaryRow label="Booking" value={`#${confirmation.reference}`} /> : null}
        </dl>
        <p className="mx-auto mt-5 max-w-[420px] text-[14px] leading-6 text-[color:var(--ui-text-3)]">
          The time is held for you. We&rsquo;ll let you know as soon as it&rsquo;s confirmed.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/account" className="fv-cta w-full sm:w-auto">Go to My Home</Link>
          <Link href="/membership/plans" className="fv-link">See membership plans</Link>
        </div>
      </div>
    );
  }

  const chooseChannel = (next: Exclude<Channel, "">) => {
    setChannel(next);
    setFormError("");
    trackEvent("free_visit_channel_selected", { channel: next });
  };

  /* Signed out: the choice comes first, and nothing else until it is made. */
  if (choosing && !channel) {
    return (
      <div id={id} className={`fv-card scroll-mt-24 ${compact ? "fv-compact" : ""}`} data-fv="chooser">
        <ChannelChooser onChoose={chooseChannel} />
      </div>
    );
  }

  const switcher = choosing ? <ChannelSwitch value={channel} onChange={chooseChannel} /> : null;
  const homePicker =
    isAuthenticated && homes.length > 1 && access !== "member" ? (
      <HomePicker
        homes={homes}
        value={addressId}
        prompt={needsHomePick}
        onChange={(next) => {
          setAddressId(next);
          setAddressPicked(true);
        }}
      />
    ) : null;
  const ctaLabel = guestMode ? "Request my free visit" : access === "anonymous" ? "Continue" : "Book my free visit";
  const ctaBusy = guestMode ? "Sending…" : "Booking your visit…";
  const ctaHint = guestMode
    ? "We'll call to confirm. No card needed."
    : access === "anonymous"
      ? "Next: sign in or create your account. No card needed."
      : "90 minutes · free · no card needed";

  const grid = monthGrid(month);
  const monthMap = months[month];
  const canGoBack = month > monthOf(today);
  const canGoForward = month < shiftMonth(monthOf(today), MONTHS_AHEAD - 1);
  const submitting = phase === "submitting";

  /* Who to call - guest requests only. The same fields in both layouts. */
  const contactBlock = guestMode ? (
    <div ref={contactRef} className="mt-3 grid scroll-mt-28 gap-2.5" data-fv="contact">
      <span className="fv-label">Your details</span>
      <ContactField
        field="name"
        label="Full name"
        value={contact.name}
        error={contactErrors.name}
        onChange={onContactChange}
        inputProps={{ type: "text", autoComplete: "name", autoCapitalize: "words", enterKeyHint: "next", maxLength: 120 }}
      />
      <ContactField
        field="phone"
        label="Mobile number"
        value={contact.phone}
        error={contactErrors.phone}
        onChange={onContactChange}
        inputProps={{ type: "tel", inputMode: "tel", autoComplete: "tel-national", enterKeyHint: "next", maxLength: 20 }}
      />
      <ContactField
        field="email"
        label="Email"
        value={contact.email}
        error={contactErrors.email}
        onChange={onContactChange}
        inputProps={{ type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false, enterKeyHint: "done", maxLength: 200 }}
      />
      <p className="text-[13px] leading-[1.45] text-[color:var(--ui-text-3)]" data-fv="consent">
        {CONTACT_CONSENT_TEXT}{" "}
        <Link href="/terms" target="_blank" rel="noopener" className="underline underline-offset-2">Terms</Link>
        {" · "}
        <Link href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2">Privacy Policy</Link>
      </p>
    </div>
  ) : null;

  if (compact) {
    const started = noteFocused || note.trim().length > 0 || photos.length > 0 || !!libraryReference;
    const picked = !!selectedDate && selectedSlotOpen;
    const showWhen = whenOpen || !picked;
    return (
      <div id={id} className="fv-card fv-compact scroll-mt-24" aria-busy={submitting} data-fv-variant="compact">
        {switcher}
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
          <div className="fv-strip fv-strip--wrap mt-2" aria-label="Common jobs">
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
                    <span className="text-[14px] font-semibold text-[color:var(--ui-ink)]" aria-live="polite">{monthLabel(month)}</span>
                    <button type="button" className="fv-nav" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canGoForward} aria-label="Next month">›</button>
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-text-3)]" aria-hidden="true">
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
                        <p className="text-[13px] text-[color:var(--ui-text-3)]">This day just filled up. Pick another.</p>
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

        {contactBlock}

        <div ref={summaryRef} className="scroll-mt-28">
          {homePicker}
          <AccessNotice access={access} waitlist={waitlist} onAddHome={addHomeAndContinue} />
          {homeSheet}
          {contactSheet}
          {formError ? <p className="fv-error" role="alert">{formError}</p> : null}
          {!blocked ? (
            <>
              {serviceTextsOptIn ? <div className="mt-3">{serviceTextsOptIn}</div> : null}
              <button
                type="button"
                className={`fv-cta fv-cta--compact mt-3 w-full ${ready ? "fv-cta--ready" : ""}`}
                onClick={() => void onBook()}
                disabled={submitting || access === "checking"}
                data-fv="book"
              >
                {submitting ? (
                  <><span className="fv-spinner" aria-hidden="true" /> {ctaBusy}</>
                ) : (
                  <>{ctaLabel} <span aria-hidden="true">→</span></>
                )}
              </button>
              <p className="mt-2 text-center text-[13px] text-[color:var(--ui-text-3)]" data-fv="cta-hint">{ctaHint}</p>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="fv-card scroll-mt-24" aria-busy={submitting}>
      {switcher}
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
            <span className="min-w-[128px] text-center text-[14px] font-semibold text-[color:var(--ui-ink)]" aria-live="polite">{monthLabel(month)}</span>
            <button type="button" className="fv-nav" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canGoForward} aria-label="Next month">›</button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-text-3)]" aria-hidden="true">
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
          <p className="mt-3 text-[13px] text-[color:var(--ui-text-3)]">No open days this month - try the next one.</p>
        ) : null}
        {errors.date ? <p className="fv-error">{errors.date}</p> : null}

        {/* 3. The time - slides open under the chosen day */}
        <div ref={timesRef} className={`fv-reveal scroll-mt-28 ${selectedDate ? "fv-reveal--open" : ""}`}>
          <div>
            {selectedDate ? (
              <div className="pt-5">
                <p className="text-[14px] font-semibold text-[color:var(--ui-ink)]">
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
                  <p className="mt-3 text-[14px] text-[color:var(--ui-text-3)]">This day just filled up. Pick another.</p>
                )}
                {errors.time ? <p className="fv-error">{errors.time}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 4. Summary + the one button */}
      <section ref={summaryRef} className="fv-step fv-step--last scroll-mt-28" aria-label="Your visit">
        {homePicker}
        <AccessNotice access={access} waitlist={waitlist} onAddHome={addHomeAndContinue} />
          {homeSheet}
          {contactSheet}
        <div className={`fv-reveal ${selectedDate && selectedSlotOpen ? "fv-reveal--open" : ""}`}>
          <div>
            {selectedDate && selectedSlotOpen ? (
              <div className="fv-summary">
                <div className="fv-summary-row">
                  <span>Free first visit</span>
                  <span className="text-[color:var(--ui-ink)]">$0</span>
                </div>
                <div className="fv-summary-row">
                  <span>{shortDate(selectedDate)} · {time12(selectedTime)}</span>
                  <span>90 min</span>
                </div>
                {noteOk ? (
                  <p className="mt-1 line-clamp-2 text-[13px] text-[color:var(--ui-text-3)]">
                    {note.trim()}
                    {!photos.length && libraryReference ? ` · Example: ${libraryLabel(libraryReference)}` : ""}
                    {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {contactBlock}

        {formError ? <p className="fv-error" role="alert">{formError}</p> : null}

        {!blocked ? (
          <>
            {serviceTextsOptIn ? <div className="mt-4">{serviceTextsOptIn}</div> : null}
            <button
              type="button"
              className={`fv-cta mt-4 w-full ${ready ? "fv-cta--ready" : ""}`}
              onClick={() => void onBook()}
              disabled={submitting || access === "checking"}
              data-fv="book"
            >
              {submitting ? (
                <><span className="fv-spinner" aria-hidden="true" /> {ctaBusy}</>
              ) : (
                <>{ctaLabel} <span aria-hidden="true">→</span></>
              )}
            </button>
            <p className="mt-3 text-center text-[13px] text-[color:var(--ui-text-3)]" data-fv="cta-hint">{ctaHint}</p>
          </>
        ) : null}
      </section>
    </div>
  );
}

/* The first thing a signed-out visitor sees: two ways to the same free visit. */
function ChannelChooser({ onChoose }: { onChoose: (channel: "online" | "callback") => void }) {
  return (
    <div className="fv-choose" role="group" aria-label="How would you like to book?">
      <button type="button" className="fv-option fv-option--primary" onClick={() => onChoose("online")} data-fv-channel="online">
        <span className="fv-option__title">Book My Free Visit</span>
        <span className="fv-option__body">Book online in minutes. No phone call needed.</span>
        <span className="fv-option__go" aria-hidden="true">→</span>
      </button>
      <button type="button" className="fv-option" onClick={() => onChoose("callback")} data-fv-channel="callback">
        <span className="fv-option__title">Have Us Call You</span>
        <span className="fv-option__body">Choose a time, leave your number, and we&rsquo;ll handle the rest.</span>
        <span className="fv-option__go" aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/* Once chosen: a quiet switch, so changing your mind keeps the job, day and time. */
function ChannelSwitch({ value, onChange }: { value: Channel; onChange: (channel: "online" | "callback") => void }) {
  return (
    <div className="fv-switch" role="radiogroup" aria-label="How would you like to book?" data-fv="switch">
      {(
        [
          ["online", "Book online"],
          ["callback", "Have us call"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={`fv-switch__opt ${value === key ? "fv-switch__opt--on" : ""}`}
          onClick={() => onChange(key)}
          data-fv-switch={key}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type Home = { _id?: string; label?: string; line1?: string; unit?: string; city?: string; state?: string; zip?: string };

/* An account with more than one home says which one this visit is for. */
function HomePicker({
  homes,
  value,
  prompt,
  onChange,
}: {
  homes: Home[];
  value: string;
  prompt: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className={`fv-home mt-3 ${prompt ? "fv-home--prompt" : ""}`} data-fv="home-picker">
      <span className="fv-label">{prompt ? "Which home is this visit for?" : "Visit address"}</span>
      <select className="fv-input mt-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
        {homes.map((h) => (
          <option key={String(h._id)} value={String(h._id)}>
            {[h.label, [h.line1, h.unit ? `Unit ${h.unit}` : "", h.city].filter(Boolean).join(", ")].filter(Boolean).join(": ")}
          </option>
        ))}
      </select>
    </label>
  );
}

/* One contact input: the placeholder names it on screen, the sr-only label names it to assistive tech. */
function ContactField({
  field,
  label,
  value,
  error,
  onChange,
  inputProps,
}: {
  field: keyof Contact;
  label: string;
  value: string;
  error?: string;
  onChange: (field: keyof Contact, value: string) => void;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const inputId = `fv-contact-${field}`;
  return (
    <div>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input
        id={inputId}
        {...inputProps}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={label}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`fv-input ${error ? "fv-input--error" : ""}`}
        data-fv-contact={field}
      />
      {error ? <p id={`${inputId}-error`} className="fv-error !mt-1">{error}</p> : null}
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
    <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--ui-line)] py-3">
      <dt className="text-[14px] text-[color:var(--ui-text-3)]">{label}</dt>
      <dd className="text-right text-[15px] font-medium text-[color:var(--ui-ink)]">{value}</dd>
    </div>
  );
}

/** What a signed-in customer who cannot have the free visit sees instead of a button that would fail. */
function AccessNotice({
  access,
  waitlist,
  onAddHome,
}: {
  access: Access;
  waitlist: { zip: string; email: string };
  onAddHome: () => void;
}) {
  if (access === "member") {
    return (
      <div className="fv-panel" data-fv-access="member">
        <p className="font-semibold text-[color:var(--ui-ink)]">You&rsquo;re a member.</p>
        <p className="mt-1 text-[14px] text-[color:var(--ui-text-2)]">Book your visit from your member calendar.</p>
        <Link href="/book?visit=membership" className="fv-cta mt-4 w-full">Book as a member</Link>
      </div>
    );
  }
  if (access === "active") {
    return (
      <div className="fv-panel" data-fv-access="active">
        <p className="font-semibold text-[color:var(--ui-ink)]">You already have a free visit request.</p>
        <p className="mt-1 text-[14px] text-[color:var(--ui-text-2)]">One free visit per customer. We&rsquo;ll be in touch to confirm it.</p>
        <Link href="/account" className="fv-cta mt-4 w-full">Go to My Home</Link>
      </div>
    );
  }
  if (access === "used") {
    return (
      <div className="fv-panel" data-fv-access="used">
        <p className="font-semibold text-[color:var(--ui-ink)]">You&rsquo;ve already used your free visit.</p>
        <p className="mt-1 text-[14px] text-[color:var(--ui-text-2)]">Book a one-time visit, or get a plan for regular help.</p>
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
        <p className="font-semibold text-[color:var(--ui-ink)]">We&rsquo;re not in your area yet.</p>
        <p className="mt-1 text-[14px] text-[color:var(--ui-text-2)]">Profixter serves Nassau and Suffolk counties on Long Island.</p>
        <OutOfAreaWaitlist zip={waitlist.zip} defaultEmail={waitlist.email} />
      </div>
    );
  }
  if (access === "no-address") {
    return (
      <div className="fv-panel" data-fv-access="no-address">
        <p className="font-semibold text-[color:var(--ui-ink)]">Add your home address to book.</p>
        <button type="button" onClick={onAddHome} className="fv-cta mt-4 w-full">Add your home</button>
      </div>
    );
  }
  return null;
}

type WaitlistState = "idle" | "sending" | "done";

/*
 * Out of area: leave an email instead of hitting a dead end.
 *
 * Email only. There is deliberately no phone field and no SMS box here - the
 * one place SMS consent is collected is /signup, which carriers review. The
 * checkbox starts unticked and must be ticked: the server refuses the request
 * without consentEmail, and absence is never consent.
 *
 * The browser only reports the step to analytics (out_of_area_shown once per
 * tab, out_of_area_waitlist on success). Neither is a Meta conversion: a
 * household we cannot serve is not a lead to optimise for.
 */
function OutOfAreaWaitlist({ zip, defaultEmail }: { zip: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<WaitlistState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(OUT_OF_AREA_SHOWN_KEY)) return;
      sessionStorage.setItem(OUT_OF_AREA_SHOWN_KEY, "1");
    } catch {
      /* blocked storage: count it anyway */
    }
    trackEvent("out_of_area_shown", { source: "free_visit_booker" });
  }, []);

  useEffect(() => {
    if (!email && defaultEmail) setEmail(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (!consent) {
      setMessage("Tick the box so we can email you.");
      return;
    }
    setState("sending");
    setMessage("");
    const { visitorId, ...attribution } = getAttribution();
    try {
      const res = await fetch(`${API_BASE}/api/service-area/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          zip,
          consentEmail: true,
          source: "free_visit_booker",
          ...(visitorId ? { visitorId } : {}),
          ...(Object.keys(attribution).length ? { attribution } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string };
      if (res.ok && body?.ok !== false) {
        setState("done");
        trackEvent("out_of_area_waitlist", { source: "free_visit_booker" });
        return;
      }
      setState("idle");
      if (res.status === 429) {
        setMessage("Too many tries just now. Please try again later.");
      } else if (body?.code === "INVALID_EMAIL") {
        setMessage("Enter a valid email address.");
      } else if (body?.code === "CONSENT_REQUIRED") {
        setMessage("Tick the box so we can email you.");
      } else if (body?.code === "IN_SERVICE_AREA") {
        setMessage("Good news: we already serve that ZIP. Reload this page to book, or call or text 631-599-1363.");
      } else {
        setMessage("We couldn't save that just now. Please try again.");
      }
    } catch {
      setState("idle");
      setMessage("We couldn't reach our server. Check your connection and try again.");
    }
  };

  if (state === "done") {
    return (
      <p className="mt-4 text-[14px] font-semibold text-[color:var(--ui-ink)]" role="status" data-fv-waitlist="done">
        Thanks. We&rsquo;ll email you when Profixter starts serving your area.
      </p>
    );
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={(e) => void submit(e)} noValidate data-fv-waitlist="form">
      <label className="grid gap-1.5">
        <span className="fv-label">Tell me when you serve my area</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className="fv-input"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (message) setMessage("");
          }}
          placeholder="you@example.com"
          data-fv-waitlist="email"
        />
      </label>
      <label className="flex items-start gap-2.5 text-[14px] leading-5 text-[#3b4658]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (message) setMessage("");
          }}
          required
          data-fv-waitlist="consent"
        />
        <span>Email me when Profixter starts serving my area</span>
      </label>
      {message ? (
        <p className="fv-error !mt-0" role="alert" data-fv-waitlist="message">{message}</p>
      ) : null}
      <button type="submit" className="fv-cta w-full" disabled={state === "sending"} data-fv-waitlist="submit">
        {state === "sending" ? "Saving…" : "Notify me"}
      </button>
    </form>
  );
}
