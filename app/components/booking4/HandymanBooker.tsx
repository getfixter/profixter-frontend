"use client";

import "./booking4.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import API from "@/lib/api";
import { checkoutTracking } from "@/lib/meta";
import { referralField } from "@/lib/referral";
import AddressField, { type AddressValue, type ServiceAreaState } from "@/app/components/address/AddressField";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import ConfirmEmailOffer from "@/app/components/auth/ConfirmEmailOffer";
import { useAuth } from "@/lib/useAuth";
import { addHome, missingContact } from "@/lib/auth2";
import { createBooking, createOneTimeVisitCheckout, getOneTimeVisitConfig } from "@/lib/booking-service";
import { PLAN_DETAILS } from "@/lib/stripe-links";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";
import {
  EMPTY_HANDYMAN_DRAFT,
  clearHandymanDraft,
  loadHandymanDraft,
  loadHandymanPhotos,
  newClientRequestId,
  saveHandymanDraft,
  saveHandymanPhotos,
  type HandymanDraft,
} from "@/lib/handyman-draft";
import SlotPicker, { formatWhen } from "./SlotPicker";
import PhotoPicker from "./PhotoPicker";
import WelcomeOfferBanner from "@/app/components/membership/WelcomeOfferBanner";
import { WELCOME_OFFER_ERROR_CODES, formatCents, offerPrice, useWelcomeOffer } from "@/lib/welcome-offer";
import HoldCountdown from "./HoldCountdown";
import { useServiceTextsOptIn } from "@/app/components/booking/ServiceTextsOptIn";
import { afterLayout, revealFirstError, scrollBehavior } from "@/lib/form-guide";
import { GUEST_CHECKOUT_CONSENT_TEXT, GuestCheckoutError, abandonGuestCheckout, guestOneTimeCheckout } from "@/lib/guest-checkout";
import { clarityBookingEvent } from "@/lib/clarity";
import { announceBookingSucceeded } from "@/lib/booking-events";

/* Annual members pay for ten months and get twelve (as on the plans page; Stripe holds the real price). */
const ANNUAL_MONTHS_CHARGED = 10;
const PLAN_IDS: string[] = PLAN_DETAILS.map((p) => p.id);

/*
 * Book a Handyman (Customer Experience 4.0).
 *
 *   1. What needs doing - the job, the address, optional photos
 *   2. When - a real open time, held for them from here (POST /api/bookings/hold)
 *   3. Your details - signed out only: name, mobile, email (2026-11-17: no
 *      account needed to pay for a One-Time Visit; "I have an account" stays
 *      one tap away). Signed in, this step does not exist.
 *   4. How to book - the member's included visit, a One-Time Visit, or a
 *      membership. A guest pays for a One-Time Visit as a guest
 *      (lib/guest-checkout, BackEnd routes/guestBookings); a membership belongs
 *      to an account, so choosing one asks for the account here, with
 *      everything typed kept.
 *   5. Pay (Stripe) - then the request waits for the owner's approval
 *
 * The draft (lib/handyman-draft) survives sign-in, Stripe and back, a refresh
 * and a failed payment. Step 2 opens on the earliest opening already chosen
 * (Customer Experience 4.2); nothing is held until they press Continue. Every money rule is the server's: one checkout per
 * press (clientRequestId), the slot held while paying, no second membership for
 * a home, the member seven-day lead time.
 *
 * Membership first visit (2026-11-03): somebody without a membership books
 * the job and the time first, then picks a plan (monthly or annual) and pays.
 * Before Stripe opens, the visit (job, home, photos, time, hold) is saved on
 * the server (POST /api/bookings/first-visit-draft) and the checkout names it;
 * the Stripe webhook books it when the payment is confirmed, whether or not
 * the customer comes back (BackEnd utils/membershipFirstVisitFulfillment.js).
 * Back here, the page only shows what the server made - or, if the webhook is
 * slow, asks the server to finish it once Stripe says paid. The new
 * membership's first visit is not held to the member seven days.
 * `intent="membership"` (and /book/handyman?membership=<plan>&cycle=) opens
 * with the membership chosen.
 *
 * `embedded`: the same flow inside the homepage's booking panel
 * (home/HomeBookingPanel) - no h1 (the page has its own), drawn compact. Signing
 * in and both checkouts still return to /book/handyman, where the saved draft
 * picks up exactly where the homepage left it.
 */

const TZ = "America/New_York";
const MEMBER_LEAD_DAYS = 7;

type Step = 1 | 2 | 3 | 4;
type Choice = "" | "member" | "one_time" | "membership";

function todayNY() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}
function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
/** The instant a New York wall-clock time is, as ISO. */
function nyIso(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const shown = new Date(guess.toLocaleString("en-US", { timeZone: TZ }));
  const offset = guess.getTime() - shown.getTime();
  return new Date(guess.getTime() + offset).toISOString();
}
/*
 * One tap instead of typing (Customer Experience 4.2). From the jobs customers
 * book most (lib/profixter-data TASK_MIX). A tap adds its sentence on its own
 * line - never replacing what is there, never twice - and the text stays theirs
 * to edit. Each is at least three words, the description's minimum.
 */
const JOB_SHORTCUTS: Array<{ label: string; text: string }> = [
  { label: "Replace faucet", text: "Replace an existing faucet." },
  { label: "Fix door", text: "Fix a door that sticks or won't latch." },
  { label: "Light fixture", text: "Install a light fixture." },
  { label: "Patch drywall", text: "Patch and repair drywall." },
  { label: "Replace outlet", text: "Replace an outlet or switch." },
  { label: "Fix cabinet", text: "Fix a cabinet door or hinge." },
  { label: "Showerhead", text: "Replace a showerhead." },
  { label: "Install shelves", text: "Install wall shelves." },
  { label: "Paint touch-up", text: "Touch up paint on walls or trim." },
];
const hasTask = (task: string, text: string) => task.toLowerCase().includes(text.toLowerCase().replace(/\.$/, ""));
function addTask(task: string, text: string) {
  if (hasTask(task, text)) return task;
  const kept = task.replace(/\s+$/, "");
  return kept ? `${kept}\n${text}` : text;
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
const phoneDigits = (value: string) => {
  const d = String(value || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};
/* The guest details step, the same rules the server applies (routes/guestBookings readGuest). */
function contactErrors(d: { name: string; phone: string; email: string }) {
  const found: Record<string, string> = {};
  if (d.name.trim().length < 2 || !/\s/.test(d.name.trim())) found.name = "Enter your first and last name.";
  if (phoneDigits(d.phone).length !== 10) found.phone = "Enter a 10-digit mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) found.email = "Enter a valid email.";
  return found;
}
function sameAddress(a: { line1?: string; zip?: string }, b: { line1?: string; zip?: string }) {
  const norm = (v?: string) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a.line1) === norm(b.line1) && norm(a.zip) === norm(b.zip);
}

export default function HandymanBooker({
  embedded = false,
  fromFreeVisit = false,
  intent,
}: { embedded?: boolean; fromFreeVisit?: boolean; intent?: "membership" } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, refreshUser } = useAuth();
  const { ensureContact, contactSheet } = useContactCompletion();
  // The optional, unticked "Text me about my visits" (consent sms_service.booking.v1), saved only once the booking goes through.
  const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn();

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<HandymanDraft>(EMPTY_HANDYMAN_DRAFT);
  const [photos, setPhotos] = useState<File[]>([]);
  const [typedAddress, setTypedAddress] = useState<AddressValue | null>(null);
  // Typed into the address box but not picked from the list yet (AddressField onPendingText).
  const [addressText, setAddressText] = useState("");
  const [addressMode, setAddressMode] = useState<"lookup" | "manual">("lookup");
  const [area, setArea] = useState<ServiceAreaState>("unknown");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [choice, setChoice] = useState<Choice>("");
  const [plan, setPlan] = useState("basic");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [price, setPrice] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ tone: "info" | "warn" | "ok"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { when: string; pending?: boolean; draftId?: string; kind?: "member" | "membership_first" }>(null);
  // Still asking the server whether a paid first visit is booked (the "See my visits" button waits for the answer).
  const [checkingVisit, setCheckingVisit] = useState(false);
  const [memberLead, setMemberLead] = useState(false);
  const pressing = useRef(false);
  const resumed = useRef(false);
  const started = useRef(false);
  /* First touch of the booker: the start of this funnel (Clarity; counted once per page). */
  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    clarityBookingEvent("booking_started", "handyman");
  };
  const rootRef = useRef<HTMLDivElement>(null);

  const update = useCallback((patch: Partial<HandymanDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveHandymanDraft(next);
      return next;
    });
  }, []);

  /* Restore the draft (and its photos) once. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = loadHandymanDraft();
      const savedPhotos = saved?.photoCount ? await loadHandymanPhotos() : [];
      if (!alive) return;
      if (saved) {
        setDraft(saved);
        setChoice(saved.choice || "");
        if (saved.plan) setPlan(saved.plan);
        if (saved.cycle === "annual") setCycle("annual");
        if (saved.address) {
          setTypedAddress({ ...saved.address, unit: saved.address.unit || "", placeId: saved.address.placeId || "", lat: saved.address.lat ?? null, lng: saved.address.lng ?? null, formatted: [saved.address.line1, saved.address.city, saved.address.state, saved.address.zip].filter(Boolean).join(", "), verified: Boolean(saved.address.placeId) });
          setUseNewAddress(true);
        }
      }
      setPhotos(savedPhotos);
      // Came to book a membership (a plan button, or the membership booking tab): it is chosen at Step 4.
      const wantPlan = String(params.get("membership") || "").toLowerCase();
      if (intent === "membership" || PLAN_IDS.includes(wantPlan)) {
        const nextPlan = PLAN_IDS.includes(wantPlan) ? wantPlan : saved?.plan || "basic";
        const wantCycle = params.get("cycle");
        const nextCycle: "monthly" | "annual" = wantCycle === "annual" ? "annual" : wantCycle === "monthly" ? "monthly" : saved?.cycle || "monthly";
        setChoice("membership");
        setPlan(nextPlan);
        setCycle(nextCycle);
        saveHandymanDraft({ choice: "membership", plan: nextPlan, cycle: nextCycle });
      }
      setReady(true);
      trackEvent("handyman_booking_viewed", { resumed: Boolean(saved) });
    })();
    getOneTimeVisitConfig()
      .then((c) => alive && setPrice(c.enabled ? Math.round(c.priceCents / 100) : null))
      .catch(() => alive && setPrice(99));
    return () => {
      alive = false;
    };
    // Once, on arrival: the draft, and the plan the customer came for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) void saveHandymanPhotos(photos);
    if (ready) saveHandymanDraft({ photoCount: photos.length });
  }, [photos, ready]);

  /*
   * The option, plan and billing they chose live in the draft too. They are
   * their own state, and every update() saves the whole draft, so a draft that
   * did not carry them wrote an empty choice over the plan picked on the plans
   * page (Choose Plus, then a time, then sign-up came back to "Choose an
   * option" with no plan). Kept in step here, the next save (holding the
   * time, going to sign up) carries them. Only the working copy: writing
   * storage from here would bring back a draft just cleared after booking.
   */
  useEffect(() => {
    if (!ready) return;
    setDraft((prev) => (prev.choice === choice && prev.plan === plan && prev.cycle === cycle ? prev : { ...prev, choice, plan, cycle }));
  }, [ready, choice, plan, cycle]);

  const homes = useMemo(() => user?.addresses || [], [user]);
  const selectedHome = homes.find((h) => h._id === draft.addressId) || null;
  const isMemberHome = Boolean(selectedHome?.hasActiveSubscription);
  // The first visit of a membership bought after booking it: any open time, not the member seven days.
  const exemptHome = Boolean(selectedHome?.firstVisitExempt);
  const earliestMember = addDays(todayNY(), MEMBER_LEAD_DAYS);
  // A member home books only its included visit, so it only sees times that visit can take.
  const memberCalendar = memberLead || (isMemberHome && !exemptHome);
  // The new-customer welcome offer, for the home being booked (the server decides; this only shows it).
  const offerHome = selectedHome ? { addressId: selectedHome._id } : draft.address ? { line1: draft.address.line1, zip: draft.address.zip } : null;
  const offer = useWelcomeOffer(Boolean(user) && step === 4 && !isMemberHome, offerHome);
  const planCents = (id: string, fallback: number) => offer.plans[id]?.monthlyCents ?? fallback * 100;
  const chosenOffer = offerPrice(offer, plan, cycle);
  // The Membership card's "from" price: the lowest plan, on the cycle shown.
  const teaserOffer = offerPrice(offer, "basic", cycle);
  /* The plan's price this cycle, in cents: the server's own when it sent them, else the published price. */
  const cycleCents = (id: string, monthly: number) =>
    cycle === "annual" ? (offer.plans[id]?.annualCents ?? monthly * ANNUAL_MONTHS_CHARGED * 100) : planCents(id, monthly);
  /* A changed day or time is a new suggestion until they press Continue on it. */
  const onWhen = useCallback(
    (w: { date: string; time: string }) =>
      setDraft((prev) => {
        if (prev.date === w.date && prev.time === w.time) return prev;
        const next = { ...prev, date: w.date, time: w.time, timeConfirmed: false };
        saveHandymanDraft(next);
        return next;
      }),
    []
  );

  /* Where to start once we know who they are. */
  useEffect(() => {
    if (!ready || isLoading || resumed.current) return;
    resumed.current = true;
    const canceled = params.get("canceled");
    const resume = params.get("resume");
    if (params.get("from") === "free-visit" || fromFreeVisit) setBanner({ tone: "info", text: "Your details came with you. Tell us what needs doing." });
    if (canceled === "1") {
      const id = params.get("booking_id") || draft.pendingBookingId;
      if (id && user) API.post(`/api/bookings/one-time/${id}/abandon`).catch(() => undefined);
      // A guest's checkout is released by the press's own id, which only this browser has.
      else if (id && draft.clientRequestId) void abandonGuestCheckout(id, draft.clientRequestId);
      update({ pendingBookingId: "", clientRequestId: "" });
      setBanner({ tone: "warn", text: "Checkout canceled. Nothing was charged, and your details are saved." });
    }
    if (canceled === "membership") setBanner({ tone: "warn", text: "Membership checkout canceled. Nothing was charged." });
    const hasJob = words(draft.task) >= 3 && (draft.addressId || draft.address);
    // A time the picker chose for them is a suggestion; only one they pressed Continue on counts.
    const hasTime = Boolean(draft.date && draft.time) && Boolean(draft.timeConfirmed || draft.holdToken);
    // A member home books its included visit, which the time picked before
    // signing in may be too soon for: say so now, not after a press.
    const tooSoonForMember = Boolean(user && isMemberHome && !exemptHome && hasTime && draft.date < earliestMember && resume !== "membership");
    if (tooSoonForMember) {
      dropHold();
      update({ time: "", timeConfirmed: false });
      setBanner({ tone: "info", text: "Member visits are booked at least 7 days ahead, so we picked the earliest member time. Change it if you like." });
      setStep(2);
    } else if (user && hasJob && hasTime) setStep(4);
    else if (!user && hasJob && hasTime && !Object.keys(contactErrors(draft)).length) {
      // A guest with every detail (back from Stripe, or handed over from the Free Visit): One-Time is what they can pay for.
      setChoice((c) => c || draft.choice || "one_time");
      setStep(4);
    }
    else if (hasJob) setStep(hasTime ? 3 : 2);
    // Back from signing in: keep holding their time (extends it, or holds it
    // afresh if it lapsed). Not after a checkout - their own pending booking
    // still has the time until Stripe lets it go.
    if (hasJob && hasTime && !tooSoonForMember && !canceled && !resume && !draft.pendingBookingId) {
      void holdTime(draft.date, draft.time, draft.holdToken);
    }
    if (resume === "membership" && user) {
      void finishAfterMembership();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isLoading]);

  // A new step can open above the screen (the job card is taller than the calendar): bring its top back - on the homepage and on Book alike.
  useEffect(() => {
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }, [step]);

  // A press found something missing: take them to the first field it is about (lib/form-guide).
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    afterLayout(() => revealFirstError(rootRef.current));
  }, [errors]);

  // A signed-in customer with homes: preselect their first one if none chosen.
  useEffect(() => {
    if (!user || draft.addressId || useNewAddress || !homes.length) return;
    const match = draft.address ? homes.find((h) => sameAddress(h, draft.address || {})) : null;
    update({ addressId: (match || homes[0])._id });
  }, [user, homes, draft.addressId, draft.address, useNewAddress, update]);

  const goStep2 = () => {
    const found: Record<string, string> = {};
    if (words(draft.task) < 3) found.task = "Tell us in a few words what needs doing.";
    const typed = !user || useNewAddress || !homes.length;
    if (typed) {
      /*
       * 2026-11-17: "Please enter the service address" was shown to people who
       * HAD typed it but not picked it from the list (the field only reports a
       * picked or fully entered address). Say which of the two it is.
       */
      if (!typedAddress?.line1 || !typedAddress.city || !typedAddress.zip) {
        found.address = addressText
          ? addressMode === "manual"
            ? "Finish the address: street, city and a 5-digit ZIP."
            : "Choose your address from the list under the box, or tap \u201cCan\u2019t find your address?\u201d to type it in."
          : "Enter the service address: start typing, then choose it from the list.";
      } else if (area === "outside") found.address = "We serve Nassau and Suffolk counties. That address is outside our area for now.";
    } else if (!draft.addressId) found.address = "Choose the home for this visit.";
    setErrors(found);
    if (Object.keys(found).length) return;
    if (typed && typedAddress) {
      update({ address: { line1: typedAddress.line1, unit: typedAddress.unit, city: typedAddress.city, state: typedAddress.state || "NY", zip: typedAddress.zip, placeId: typedAddress.placeId, lat: typedAddress.lat, lng: typedAddress.lng }, addressId: "" });
    }
    trackEvent("handyman_job_described", { photos: photos.length });
    setStep(2);
  };

  /*
   * Hold the chosen time while they sign in and choose how to book. A taken
   * time sends them back to pick another; any other failure goes on without a
   * hold - the booking re-checks the time when it is made.
   */
  const holdTime = async (date: string, time: string, token: string): Promise<boolean> => {
    try {
      const res = await API.post("/api/bookings/hold", { requestedDate: date, requestedTime: time, token: token || null });
      update({ holdToken: res.data?.token || "", holdFor: res.data?.token ? `${date} ${time}` : "", holdExpiresAt: res.data?.holdExpiresAt || "" });
      return true;
    } catch (error) {
      const f = failure(error, "");
      if (f.code === "SLOT_UNAVAILABLE") {
        update({ time: "", timeConfirmed: false, holdToken: "", holdFor: "", holdExpiresAt: "" });
        setErrors({ when: "That time was just taken, so we picked the next opening - everything else is saved." });
        setStep(2);
        return false;
      }
      return true;
    }
  };

  /* Their held time cannot be used (the member seven-day rule): let it go now. */
  const dropHold = () => {
    if (draft.holdToken) API.post("/api/bookings/hold/release", { token: draft.holdToken }).catch(() => undefined);
    update({ holdToken: "", holdFor: "", holdExpiresAt: "" });
  };

  const goStep3 = async () => {
    if (busy) return;
    if (!draft.date || !draft.time) {
      setErrors({ when: "Pick a day and a time." });
      return;
    }
    if (memberCalendar && draft.date < earliestMember) {
      setErrors({ when: "Member visits are booked at least 7 days ahead. Pick a later day." });
      return;
    }
    setErrors({});
    setBusy(true);
    const held = await holdTime(draft.date, draft.time, draft.holdToken);
    setBusy(false);
    if (!held) return;
    update({ timeConfirmed: true });
    trackEvent("handyman_time_selected", {});
    if (user) clarityBookingEvent("booking_details_completed", "handyman");
    setStep(user ? 4 : 3);
  };

  /* Signed out: the details a paid visit needs. Everything else is already saved. */
  const goGuestStep4 = () => {
    const found = contactErrors(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    update({ name: draft.name.trim(), email: draft.email.trim(), phone: phoneDigits(draft.phone) });
    trackEvent("handyman_guest_details_entered", {});
    clarityBookingEvent("booking_details_completed", "handyman");
    setChoice((c) => c || "one_time");
    setStep(4);
  };

  const signIn = (mode: "signin" | "signup") => {
    saveHandymanDraft({ ...draft });
    trackEvent("handyman_auth_started", { mode });
    router.push(`/${mode}?next=${encodeURIComponent("/book/handyman")}&intent=handyman`);
  };

  /* The home on the account this visit is for, adding a typed one if needed. */
  const resolveAddressId = async (): Promise<string | null> => {
    if (draft.addressId && homes.some((h) => h._id === draft.addressId)) return draft.addressId;
    if (!draft.address) return null;
    const existing = homes.find((h) => sameAddress(h, draft.address || {}));
    if (existing) {
      update({ addressId: existing._id });
      return existing._id;
    }
    const created = await addHome({ ...draft.address, label: homes.length ? "Home" : "Primary" });
    await refreshUser();
    update({ addressId: created.address._id });
    return created.address._id;
  };

  const failure = (error: unknown, fallback: string) => {
    const data = (error as { response?: { data?: { message?: string; code?: string } }; message?: string })?.response?.data;
    return { message: data?.message || (error as Error)?.message || fallback, code: data?.code || "" };
  };

  const bookMemberVisit = async (addressId: string) => {
    const res = await createBooking({
      service: draft.task.trim().slice(0, 120),
      date: nyIso(draft.date, draft.time),
      note: draft.task.trim(),
      addressId,
      requestedDate: draft.date,
      requestedTime: draft.time,
      images: photos,
      clientRequestId: draft.clientRequestId || newClientRequestId(),
      holdToken: draft.holdToken || undefined,
    });
    trackEvent("member_visit_booked", { source: "book_a_handyman" });
    clarityBookingEvent("booking_request_submitted", "handyman", String(res?.booking?.bookingNumber || ""));
    await applyServiceTextsOptIn();
    await clearHandymanDraft();
    setDone({ when: formatWhen(draft.date, draft.time), kind: "member" });
    announceBookingSucceeded("handyman");
    return res;
  };

  /*
   * Back from a membership checkout whose visit the server books: show what it
   * made. The webhook usually has; if not yet, wait a little, then ask the
   * server to finish it (it checks the payment with Stripe first). Nothing is
   * booked from here.
   */
  const showServerFirstVisit = async (draftId: string) => {
    type View = { status: string; reason?: string; requestedDate: string; requestedTime: string; booking?: { bookingNumber: string } | null };
    let view: View | null = null;
    for (let i = 0; i < 8; i++) {
      try {
        view = (await API.get(`/api/bookings/first-visit-draft/${draftId}`)).data as View;
      } catch {
        view = null;
      }
      if (view && !["draft", "checkout_open", "paid", "fulfilling"].includes(view.status)) break;
      if (i === 4) {
        try {
          view = (await API.post(`/api/bookings/first-visit-draft/${draftId}/fulfill`)).data as View;
          if (view && !["draft", "checkout_open", "paid", "fulfilling"].includes(view.status)) break;
        } catch {
          /* keep waiting */
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    await refreshUser();
    if (view?.status === "booked" || view?.status === "rebooked") {
      trackEvent("member_visit_booked", { source: "membership_first_visit" });
      clarityBookingEvent("booking_payment_confirmed", "handyman", draftId);
      await clearHandymanDraft();
      setDone({ when: formatWhen(view.requestedDate, view.requestedTime), kind: "membership_first" });
      announceBookingSucceeded("handyman");
      return;
    }
    if (view?.status === "needs_admin") {
      // Their membership is active; the time could not be kept. They pick another (the server already told the owner).
      update({ firstVisitDraftId: "", time: "", timeConfirmed: false, holdToken: "", holdFor: "", holdExpiresAt: "", clientRequestId: "" });
      setChoice("member");
      if (view.reason === "member_lead_time") setMemberLead(true);
      setBanner({
        tone: "info",
        text:
          view.reason === "member_lead_time"
            ? "Your membership is active. Member visits are booked at least 7 days ahead, so please pick a time below - we've also emailed you."
            : "Your membership is active. The time you chose was just taken, so please pick another below - we've also emailed you, and we can book it by phone.",
      });
      setStep(2);
      return;
    }
    if (view?.status === "expired") {
      setBanner({ tone: "warn", text: "That checkout expired before it was paid. Nothing was charged - your details are saved." });
      update({ firstVisitDraftId: "" });
      setStep(4);
      return;
    }
    // Paid but not finished yet (Stripe or the membership still on its way): the server books it and emails them.
    await clearHandymanDraft();
    setDone({ when: formatWhen(view?.requestedDate || draft.date, view?.requestedTime || draft.time), pending: true, draftId, kind: "membership_first" });
    announceBookingSucceeded("handyman");
  };

  /*
   * Paid, but the server had not booked the visit yet: keep asking, read-only,
   * for up to two minutes. Booked turns the screen into the normal "requested"
   * one; anything else (Admin will call, or still waiting) keeps the honest
   * pending text, and the button stops waiting either way.
   */
  useEffect(() => {
    const draftId = done?.pending ? done.draftId : "";
    if (!draftId) return;
    let alive = true;
    let tries = 0;
    let timer = 0;
    setCheckingVisit(true);
    const ask = async () => {
      tries += 1;
      let status = "";
      let view: { status?: string; requestedDate?: string; requestedTime?: string } | null = null;
      try {
        view = (await API.get(`/api/bookings/first-visit-draft/${draftId}`)).data;
        status = String(view?.status || "");
      } catch {
        status = "";
      }
      if (!alive) return;
      if (status === "booked" || status === "rebooked") {
        await refreshUser();
        if (!alive) return;
        trackEvent("member_visit_booked", { source: "membership_first_visit" });
        setDone((prev) => ({ when: (view?.requestedDate && view?.requestedTime ? formatWhen(view.requestedDate, view.requestedTime) : "") || prev?.when || "" }));
        setCheckingVisit(false);
        return;
      }
      const stillWorking = !status || ["draft", "checkout_open", "paid", "fulfilling"].includes(status);
      if (!stillWorking || tries >= 30) {
        setCheckingVisit(false);
        return;
      }
      timer = window.setTimeout(ask, 4000);
    };
    void ask();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done?.pending, done?.draftId]);

  /* Back from a membership checkout: book the visit they described. */
  const finishAfterMembership = async () => {
    setBusy(true);
    try {
      const saved = loadHandymanDraft();
      if (!saved) return;
      if (saved.firstVisitDraftId) {
        await showServerFirstVisit(saved.firstVisitDraftId);
        return;
      }
      // Stripe's webhook can land a few seconds after the customer does: give it a moment before saying so.
      let fresh = await refreshUser();
      let home = (fresh?.addresses || []).find((h) => h._id === saved.addressId);
      for (let i = 0; i < 6 && fresh && !home?.hasActiveSubscription; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        fresh = await refreshUser();
        home = (fresh?.addresses || []).find((h) => h._id === saved.addressId);
      }
      if (!fresh) return;
      if (!home?.hasActiveSubscription) {
        setBanner({ tone: "info", text: "Your membership is being set up. Give it a moment, then press Book my visit." });
        setChoice("member");
        setStep(4);
        return;
      }
      if (!saved.date || (saved.date < earliestMember && !home.firstVisitExempt)) {
        setMemberLead(true);
        dropHold();
        update({ time: "", timeConfirmed: false });
        setBanner({ tone: "ok", text: "Welcome to Profixter! Member visits are booked at least 7 days ahead, so we picked the earliest one. Change it if you like, then Continue." });
        setStep(2);
        return;
      }
      setChoice("member");
      await bookMemberVisit(home._id);
    } catch (error) {
      const f = failure(error, "We couldn't book that time.");
      setBanner({ tone: "warn", text: f.code === "SLOT_UNAVAILABLE" ? "That time was just taken. Pick another - your membership is active." : f.message });
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  /*
   * A guest's One-Time Visit: straight to Stripe, no account. The server holds
   * the time, names the booking, and keeps the owner's review; the page only
   * opens the checkout it is given (or, for a press it has already been paid
   * for, the status of that payment).
   */
  const submitGuest = async () => {
    const clientRequestId = draft.clientRequestId || newClientRequestId();
    update({ clientRequestId, choice: "one_time" });
    trackEvent("handyman_option_selected", { choice: "one_time", guest: true });
    trackInitiateCheckout({ content_name: "one_time_visit", value: price ?? undefined, currency: "USD" });
    const address = draft.address;
    if (!address) {
      setStep(1);
      setErrors({ address: "Enter the service address: start typing, then choose it from the list." });
      return;
    }
    try {
      const res = await guestOneTimeCheckout({
        contact: { name: draft.name.trim(), phone: phoneDigits(draft.phone), email: draft.email.trim() },
        address: { line1: address.line1, unit: address.unit, city: address.city, state: address.state || "NY", zip: address.zip, lat: address.lat, lng: address.lng },
        note: draft.task.trim(),
        selectedTask: draft.task.trim().slice(0, 120),
        requestedDate: draft.date,
        requestedTime: draft.time,
        holdToken: draft.holdToken || undefined,
        photos,
        clientRequestId,
        tracking: checkoutTracking(),
      });
      if ("alreadyPaid" in res) {
        // This press was already paid for: show where it stands, never a second checkout.
        window.location.assign(res.sessionId ? `/book/confirmation?booking_id=${res.bookingId}&session_id=${res.sessionId}` : "/book/confirmation");
        return;
      }
      update({ pendingBookingId: res.bookingId, holdToken: "", holdFor: "", holdExpiresAt: "" });
      clarityBookingEvent("booking_request_submitted", "handyman", res.bookingId);
      window.location.assign(res.url);
    } catch (error) {
      const e = error instanceof GuestCheckoutError ? error : new GuestCheckoutError(0, "ERROR", "Something went wrong. Please try again.");
      if (e.code === "SLOT_UNAVAILABLE") {
        update({ time: "", timeConfirmed: false, clientRequestId: "", holdToken: "", holdFor: "", holdExpiresAt: "" });
        setErrors({ when: "That time was just taken, so we picked the next opening - everything else is saved." });
        setStep(2);
      } else if (e.field === "address") {
        update({ clientRequestId: "" });
        setErrors({ address: e.message });
        setStep(1);
      } else if (e.field === "task") {
        update({ clientRequestId: "" });
        setErrors({ task: e.message });
        setStep(1);
      } else if (e.field === "name" || e.field === "phone" || e.field === "email") {
        update({ clientRequestId: "" });
        setErrors({ [e.field]: e.message });
        setStep(3);
      } else if (e.code === "GUEST_CHECKOUT_UNAVAILABLE") {
        setBanner({ tone: "info", text: "Please sign in or create an account to book this visit - everything you entered is saved." });
        setStep(3);
      } else {
        // A network failure keeps the press id: trying again reopens the same checkout, never a second one.
        if (e.code !== "NETWORK") update({ clientRequestId: "" });
        setBanner({ tone: "warn", text: e.message });
      }
    }
  };

  const submit = async () => {
    if (pressing.current || !choice) return;
    pressing.current = true;
    setBusy(true);
    setBanner(null);
    try {
      if (!user) {
        if (choice === "membership") {
          // A membership belongs to an account: ask for it now, with the draft and the hold kept.
          signIn("signup");
          return;
        }
        await submitGuest();
        return;
      }
      if (!(await ensureContact())) return;
      const addressId = await resolveAddressId();
      if (!addressId) {
        setStep(1);
        setErrors({ address: "Please enter the service address." });
        return;
      }
      const clientRequestId = draft.clientRequestId || newClientRequestId();
      update({ clientRequestId, choice, plan, cycle });
      trackEvent("handyman_option_selected", { choice, plan: choice === "membership" ? plan : undefined });

      if (choice === "member") {
        if (draft.date < earliestMember && !exemptHome) {
          setMemberLead(true);
          dropHold();
          update({ time: "", timeConfirmed: false });
          setBanner({ tone: "info", text: "Member visits are booked at least 7 days ahead, so we picked the earliest member time. Change it if you like." });
          setStep(2);
          return;
        }
        await bookMemberVisit(addressId);
        return;
      }

      if (choice === "one_time") {
        trackInitiateCheckout({ content_name: "one_time_visit", value: price ?? undefined, currency: "USD" });
        const res = await createOneTimeVisitCheckout({
          addressId,
          selectedTask: draft.task.trim().slice(0, 120),
          date: nyIso(draft.date, draft.time),
          note: draft.task.trim(),
          images: photos,
          requestedDate: draft.date,
          requestedTime: draft.time,
          clientRequestId,
          returnTo: "handyman",
          holdToken: draft.holdToken || undefined,
        });
        // The booking took the time over; the hold is spent.
        update({ pendingBookingId: res.bookingId, holdToken: "", holdFor: "", holdExpiresAt: "" });
        clarityBookingEvent("booking_request_submitted", "handyman", res.bookingId);
        await applyServiceTextsOptIn();
        window.location.assign(res.url);
        return;
      }

      // Membership: the visit is saved on the server first; the payment books it (webhook), not this page.
      trackInitiateCheckout({ content_name: `membership_${plan}`, currency: "USD" });
      const fvForm = new FormData();
      fvForm.append("addressId", addressId);
      fvForm.append("note", draft.task.trim());
      fvForm.append("requestedDate", draft.date);
      fvForm.append("requestedTime", draft.time);
      fvForm.append("holdToken", draft.holdToken || "");
      for (const file of photos) fvForm.append("images", file, file.name || "photo.jpg");
      const saved = await API.post("/api/bookings/first-visit-draft", fvForm);
      const firstVisitDraftId = String(saved.data?.draftId || "");
      update({ firstVisitDraftId });
      // welcomeOffer: the price they were shown. The server re-checks it and refuses rather than charge another.
      const res = await API.post("/api/stripe/checkout/create-checkout-session", {
        plan,
        addressId,
        billingCycle: cycle,
        returnTo: "handyman",
        welcomeOffer: Boolean(chosenOffer),
        firstVisit: { draftId: firstVisitDraftId, holdToken: draft.holdToken || "", requestedDate: draft.date, requestedTime: draft.time },
        ...checkoutTracking(),
        ...referralField(),
      });
      // An expired hold is renewed under a new token: keep the one that now holds the time.
      if (res.data?.holdToken) update({ holdToken: res.data.holdToken, holdFor: `${draft.date} ${draft.time}`, holdExpiresAt: res.data.holdExpiresAt || draft.holdExpiresAt });
      clarityBookingEvent("booking_request_submitted", "handyman", firstVisitDraftId);
      await applyServiceTextsOptIn();
      window.location.assign(res.data.url);
    } catch (error) {
      const f = failure(error, "Something went wrong. Please try again.");
      if (f.code === "SLOT_UNAVAILABLE") {
        update({ time: "", timeConfirmed: false, clientRequestId: "", holdToken: "", holdFor: "", holdExpiresAt: "" });
        setErrors({ when: "That time was just taken, so we picked the next opening - everything else is saved." });
        setStep(2);
      } else if (WELCOME_OFFER_ERROR_CODES.includes(f.code)) {
        // Nothing was opened. The page re-prices to the regular price and they decide again.
        offer.refresh();
        update({ clientRequestId: "" });
        setBanner({ tone: "warn", text: f.message });
      } else if (f.code === "ADDRESS_ALREADY_SUBSCRIBED") {
        await refreshUser();
        setChoice("member");
        setBanner({ tone: "info", text: "This home already has a membership, so this visit is included. Press Book my visit." });
      } else if (f.code === "MEMBERSHIP_PAYMENT_RECOVERY_REQUIRED") {
        setBanner({ tone: "warn", text: "This home's membership payment needs attention. Update your payment in your account - no need to buy a new one." });
      } else {
        update({ clientRequestId: "" });
        setBanner({ tone: "warn", text: f.message });
      }
    } finally {
      pressing.current = false;
      setBusy(false);
    }
  };

  if (!ready) return <div className={embedded ? "bk bk--embedded" : "bk"} style={{ minHeight: embedded ? 320 : 420 }} aria-busy="true" />;

  /*
   * "See my visits" opens Book, where a member's visits are listed and managed
   * (BookingsSection under #your-visits) - not the Account overview.
   *
   * After a paid membership the visit is booked by the server (the Stripe
   * webhook, or the draft sweep). If it has not finished yet the button waits,
   * saying so, while this screen keeps asking - read-only: nothing is booked
   * or paid from here, so pressing it can never make a second booking or open
   * a second checkout.
   */

  if (done) {
    return (
      <div className={embedded ? "bk bk--embedded" : "bk"} data-handyman-done>
        <div className="bk-card bk-done">
          <div className="bk-done-icon" aria-hidden="true">✓</div>
          {embedded ? <h2 className="bk-title">Visit requested</h2> : <h1 className="bk-title">Visit requested</h1>}
          {done.pending ? (
            <p className="bk-lede" data-done-pending>
              Payment received. We&apos;re booking your visit for <b>{done.when}</b> and will email you the details - you don&apos;t need to stay on this page.
            </p>
          ) : (
            <p className="bk-lede">
              We have your request for <b>{done.when}</b>. We&apos;ll review it and confirm your appointment shortly.
            </p>
          )}
          {/* What it is, where it stands, what happens next (2026-11-17). */}
          <dl className="bk-done-facts" data-done-facts>
            <div>
              <dt>Visit</dt>
              <dd>{done.kind === "membership_first" ? "First membership visit" : "Membership visit"}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{done.when}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd data-done-status>{done.pending ? "Payment received - booking your visit" : "Waiting for approval"}</dd>
            </div>
          </dl>
          <p className="bk-note" data-done-next>
            Next: we review the request and text or email you once it&apos;s confirmed. To change or cancel, open My Visits or call or text 631-599-1363.
          </p>
          <div className="bk-actions">
            {done.pending && checkingVisit ? (
              <button type="button" className="bk-btn bk-btn--primary bk-btn--block" disabled aria-busy="true" data-see-visits="waiting">
                Finishing your booking…
              </button>
            ) : (
              <Link className="bk-btn bk-btn--primary bk-btn--block" href="/book#your-visits" data-see-visits="ready">
                See my visits
              </Link>
            )}
          </div>
          {/* Bought with one code: offer to confirm the receipt email (2026-11-20). */}
          {done.kind === "membership_first" ? <ConfirmEmailOffer /> : null}
        </div>
      </div>
    );
  }

  const heldSlot = draft.holdToken && draft.holdFor ? { date: draft.holdFor.slice(0, 10), time: draft.holdFor.slice(11) } : null;
  const err = (k: string) => (errors[k] ? <p className="bk-error">{errors[k]}</p> : null);
  const typedMode = !user || useNewAddress || !homes.length;
  const addressLine = selectedHome
    ? [selectedHome.line1, selectedHome.city, selectedHome.zip].filter(Boolean).join(", ")
    : draft.address
      ? [draft.address.line1, draft.address.city, draft.address.zip].filter(Boolean).join(", ")
      : "";

  return (
    <div className={embedded ? "bk bk--embedded" : "bk"} data-handyman-booker data-step={step} ref={rootRef} onFocusCapture={markStarted} onPointerDownCapture={markStarted}>
      {/* On the homepage the panel's tab names the flow, and step 1's own label says what to do. */}
      {!embedded ? (
        <header className="bk-head">
          <span className="bk-eyebrow">Book a Handyman</span>
          <h1 className="bk-title">
            {step === 1 ? "What needs doing?" : step === 2 ? "When works for you?" : step === 3 ? "Your details" : "How would you like to book?"}
          </h1>
        </header>
      ) : step > 1 ? (
        <h2 className="bk-step-title">{step === 2 ? "When works for you?" : step === 3 ? "Your details" : "How would you like to book?"}</h2>
      ) : null}
      <div className="bk-steps" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <span key={n} data-on={step >= n ? "1" : "0"} />)}
      </div>
      {banner && <div className={`bk-banner bk-banner--${banner.tone}`} role="status">{banner.text}</div>}
      {/*
        Came from a plan button ("Choose Plus"): say, on every step before the
        choice, that this is the membership they picked and when they pay.
        Without it the page read as an unrelated "Book a Handyman" form.
      */}
      {choice === "membership" && step < 4 && !done ? (() => {
        const chosen = PLAN_DETAILS.find((p) => p.id === plan) || PLAN_DETAILS[0];
        return (
          <div className="bk-banner bk-banner--info" data-chosen-plan={chosen.id}>
            {chosen.name} membership · {formatCents(cycleCents(chosen.id, chosen.price))}
            {cycle === "annual" ? "/yr" : "/mo"}. First, your first visit; you pay on the last step.{" "}
            <Link href="/membership/plans" data-link="change-plan">Change plan</Link>
          </div>
        );
      })() : null}

      {step === 1 && (
        <section className="bk-card">
          <div className="bk-field" data-error={errors.task ? "1" : undefined}>
            <label className="bk-label" htmlFor="bk-task">Describe the job</label>
            <div className="bk-chips" role="group" aria-label="Common jobs - tap to add">
              {JOB_SHORTCUTS.map((job) => {
                const added = hasTask(draft.task, job.text);
                return (
                  <button key={job.label} type="button" className="bk-chip" aria-pressed={added} data-shortcut={job.label} onClick={() => update({ task: addTask(draft.task, job.text).slice(0, 1200) })}>
                    <span aria-hidden="true">{added ? "✓" : "+"}</span>
                    {job.label}
                  </button>
                );
              })}
            </div>
            <textarea data-clarity-mask="true" id="bk-task" className="bk-textarea" name="task" aria-invalid={errors.task ? "true" : undefined} value={draft.task} onChange={(e) => update({ task: e.target.value })} placeholder="Tap a job above, or describe it in a few words" maxLength={1200} />
            {err("task")}
          </div>
          <div className="bk-field" data-error={errors.address ? "1" : undefined} data-address-field>
            <span className="bk-label">Service address</span>
            {typedMode ? <span className="bk-hint" data-address-hint>Type your street address. If suggestions appear, tap yours.</span> : null}
            {!typedMode ? (
              <>
                <select className="bk-input" value={draft.addressId} onChange={(e) => update({ addressId: e.target.value, address: null })} data-input="home">
                  {homes.map((h) => (
                    <option key={h._id} value={h._id}>
                      {[h.line1, h.city, h.zip].filter(Boolean).join(", ")}
                      {h.hasActiveSubscription ? " · Member" : ""}
                    </option>
                  ))}
                </select>
                <button type="button" className="bk-link" style={{ marginTop: 8 }} onClick={() => setUseNewAddress(true)}>Use a different address</button>
              </>
            ) : (
              <>
                <AddressField
                  value={typedAddress}
                  onChange={(v) => {
                    setTypedAddress(v);
                    if (v && errors.address) setErrors((e) => ({ ...e, address: "" }));
                  }}
                  onServiceArea={setArea}
                  onPendingText={(text, mode) => {
                    setAddressText(text);
                    setAddressMode(mode);
                  }}
                />
                {user && homes.length > 0 && (
                  <button type="button" className="bk-link" style={{ marginTop: 8 }} onClick={() => setUseNewAddress(false)}>Choose a saved home</button>
                )}
              </>
            )}
            {err("address")}
          </div>
          <span className="bk-label">Photos <small>(optional, helps us prepare)</small></span>
          <PhotoPicker photos={photos} onChange={setPhotos} />
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={goStep2} data-action="to-step-2">Continue</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="bk-card" data-error={errors.when ? "1" : undefined}>
          {memberCalendar && <p className="bk-note" style={{ marginBottom: 10 }}>Member visits start 7 days out.</p>}
          <SlotPicker date={draft.date} time={draft.time} onChange={onWhen} visit={memberCalendar ? "membership" : undefined} held={heldSlot} />
          {err("when")}
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={goStep3} disabled={busy} data-action="to-step-3">{busy ? "Holding your time…" : "Continue"}</button>
            <button type="button" className="bk-link" onClick={() => setStep(1)}>Back</button>
          </div>
        </section>
      )}

      {/*
        Buying a membership (a plan button chose it): it is kept on an account,
        so step 3 is the account, not the guest details - asking for name, phone
        and email here and then sending them to sign up anyway made them type
        it all twice and contradicted "No account needed". Everyone else (a
        One-Time Visit) books as a guest below.
      */}
      {step === 3 && choice === "membership" && (
        <section className="bk-card" data-auth-step>
          <div className="bk-summary" style={{ marginBottom: 16 }}>
            <span><b>{formatWhen(draft.date, draft.time)}</b></span>
            <span>{addressLine}</span>
          </div>
          {draft.holdToken && draft.holdExpiresAt ? <HoldCountdown expiresAt={draft.holdExpiresAt} style={{ marginTop: 0, marginBottom: 10 }} /> : null}
          <p className="bk-lede" style={{ marginTop: 0 }}>A membership is kept on your account. Create it, or sign in - your job, address and time are saved.</p>
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={() => signIn("signup")} data-action="create-account">Create account</button>
            <button type="button" className="bk-btn bk-btn--block" onClick={() => signIn("signin")} data-action="sign-in">I have an account</button>
            <button type="button" className="bk-link" onClick={() => { setChoice("one_time"); }} data-action="book-once-instead">Just one visit? Book it without an account</button>
            <button type="button" className="bk-link" onClick={() => setStep(2)}>Back</button>
          </div>
        </section>
      )}

      {step === 3 && choice !== "membership" && (
        <section className="bk-card" data-guest-details>
          <div className="bk-summary" style={{ marginBottom: 16 }}>
            <span><b>{formatWhen(draft.date, draft.time)}</b></span>
            <span>{addressLine}</span>
          </div>
          {draft.holdToken && draft.holdExpiresAt ? <HoldCountdown expiresAt={draft.holdExpiresAt} style={{ marginTop: 0, marginBottom: 10 }} /> : null}
          <p className="bk-lede" style={{ marginTop: 0 }}>Who should we confirm with? No account needed.</p>
          {(["name", "phone", "email"] as const).map((k) => (
            <label key={k} className="bk-field bk-float" data-error={errors[k] ? "1" : undefined} data-clarity-mask="true">
              <input
                name={k}
                className="bk-input bk-input--float"
                placeholder=" "
                enterKeyHint={k === "email" ? "done" : "next"}
                aria-invalid={errors[k] ? "true" : undefined}
                {...(k === "name"
                  ? { autoComplete: "name", autoCapitalize: "words" }
                  : k === "phone"
                    ? { type: "tel", inputMode: "tel" as const, autoComplete: "tel-national" }
                    : { type: "email", inputMode: "email" as const, autoComplete: "email", autoCapitalize: "none", spellCheck: false })}
                value={draft[k]}
                onChange={(e) => update({ [k]: e.target.value })}
              />
              <span className="bk-float-label">{k === "name" ? "Full name" : k === "phone" ? "Mobile phone" : "Email"}</span>
              {err(k)}
            </label>
          ))}
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={goGuestStep4} data-action="guest-continue">Continue</button>
            <button type="button" className="bk-link" onClick={() => signIn("signin")} data-action="sign-in">I have an account - sign in</button>
            <button type="button" className="bk-link" onClick={() => setStep(2)}>Back</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <>
          <section className="bk-card">
            <div className="bk-summary" data-summary>
              <span><b>{formatWhen(draft.date, draft.time)}</b> · <button type="button" className="bk-link" onClick={() => setStep(2)}>Change</button></span>
              <span>{addressLine}</span>
              <span>{draft.task.length > 90 ? `${draft.task.slice(0, 90)}…` : draft.task}</span>
              {!user ? (
                <span data-clarity-mask="true">
                  {draft.name} · <button type="button" className="bk-link" onClick={() => setStep(3)}>Change</button>
                </span>
              ) : null}
              {draft.holdToken && draft.holdExpiresAt ? <HoldCountdown expiresAt={draft.holdExpiresAt} /> : null}
            </div>
          </section>
          <section className="bk-card" aria-label="How to book">
            {isMemberHome && (
              <button type="button" className="bk-option" aria-pressed={choice === "member"} onClick={() => setChoice("member")} data-option="member">
                <div className="bk-option-top">
                  <span className="bk-option-name">Use my membership<span className="bk-badge">Included</span></span>
                  <span className="bk-option-price">$0</span>
                </div>
                <p>This visit is part of your {selectedHome?.plan ? `${selectedHome.plan.charAt(0).toUpperCase()}${selectedHome.plan.slice(1)} ` : ""}membership. Member visits are booked 7+ days ahead.</p>
              </button>
            )}
            {!isMemberHome && (
              <>
                <button type="button" className="bk-option" aria-pressed={choice === "one_time"} onClick={() => setChoice("one_time")} data-option="one_time">
                  <div className="bk-option-top">
                    <span className="bk-option-name">One-Time Visit</span>
                    <span className="bk-option-price">{price != null ? `$${price}` : ""}<small> once</small></span>
                  </div>
                  <p>One visit, up to 90 minutes of work. Pay once, no commitment. Materials not included.</p>
                </button>
                {/* "First Month" or "First Payment", as the server prices it: monthly only, or annual too (utils/welcomeOffer.js). */}
                <WelcomeOfferBanner offer={offer} className="bk-offer" monthlyOnly={!Object.values(offer.plans).some((p) => p.firstYearCents != null)} />
                <button type="button" className="bk-option" aria-pressed={choice === "membership"} onClick={() => setChoice("membership")} data-option="membership">
                  <div className="bk-option-top">
                    <span className="bk-option-name">
                      Membership{teaserOffer ? <span className="bk-badge">{offer.percentOff}% off 1st {cycle === "annual" ? "year" : "month"}</span> : null}
                    </span>
                    {/*
                      * The lowest plan's price, as the server prices it right now. While the
                      * offer is on, the regular price is struck through beside the exact
                      * first-payment price; the moment the countdown ends (or the server says
                      * no) this is the regular price again - same render, no reload.
                      */}
                    {teaserOffer ? (
                      <span className="bk-option-price bk-option-price--offer" data-membership-teaser="offer">
                        <small>from </small>
                        <s className="wo-was">{formatCents(teaserOffer.regularCents)}</s> <span className="wo-now">{formatCents(teaserOffer.firstCents)}</span>
                        <small> first {cycle === "annual" ? "year" : "month"}</small>
                      </span>
                    ) : (
                      <span className="bk-option-price" data-membership-teaser="regular">from {formatCents(cycleCents("basic", PLAN_DETAILS[0].price))}<small>{cycle === "annual" ? "/yr" : "/mo"}</small></span>
                    )}
                  </div>
                  <p>
                    Your personal handyman membership. Labor included for covered tasks. Monthly, or annual with 2 months free.
                    {teaserOffer ? (
                      <span className="bk-option-note" data-membership-teaser-note>
                        {" "}{offer.percentOff}% off your first {cycle === "annual" ? "yearly" : "monthly"} payment only; then {formatCents(teaserOffer.regularCents)}/{cycle === "annual" ? "yr" : "mo"}.
                      </span>
                    ) : null}
                  </p>
                </button>
                {choice === "membership" && (
                  <div className="bk-cycle" role="radiogroup" aria-label="Billing">
                    {(["monthly", "annual"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={cycle === c}
                        className="bk-cycle-btn"
                        data-cycle={c}
                        onClick={() => {
                          setCycle(c);
                          update({ cycle: c });
                        }}
                      >
                        {c === "monthly" ? "Monthly" : "Annual"}
                        {c === "annual" ? <small>2 months free</small> : null}
                      </button>
                    ))}
                  </div>
                )}
                {choice === "membership" && (
                  <div className="bk-plans" role="radiogroup" aria-label="Plan">
                    {PLAN_DETAILS.map((p) => {
                      const monthly = cycleCents(p.id, p.price);
                      const first = cycle === "annual" ? offer.plans[p.id]?.firstYearCents : offer.plans[p.id]?.firstMonthCents;
                      return (
                        <button key={p.id} type="button" role="radio" className="bk-plan" aria-checked={plan === p.id} data-plan={p.id} onClick={() => setPlan(p.id)}>
                          <b>{p.name}</b>
                          <span className="bk-plan-labor">Labor included</span>
                          {first != null ? (
                            <span className="bk-plan-price" data-plan-offer>
                              <s className="wo-was">{formatCents(monthly)}</s> <span className="wo-now">{formatCents(first)}</span> first {cycle === "annual" ? "year" : "month"}
                            </span>
                          ) : (
                            <span className="bk-plan-price">{formatCents(monthly)}{cycle === "annual" ? "/yr" : "/mo"}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {choice === "membership" && (
                  <p className="bk-note bk-plan-terms" data-plan-terms>
                    {cycle === "annual"
                      ? chosenOffer
                        ? `${formatCents(chosenOffer.firstCents)} for your first year, then ${formatCents(chosenOffer.regularCents)}/year, plus applicable taxes. Pay for 10 months, get 12. Billed once a year.`
                        : "Pay for 10 months, get 12. Billed once a year, plus applicable taxes."
                      : chosenOffer
                        ? `${formatCents(chosenOffer.firstCents)} for your first month, then ${formatCents(chosenOffer.regularCents)}/month afterward, plus applicable taxes. Month to month, cancel anytime.`
                        : "Billed monthly, plus applicable taxes. Month to month, cancel anytime."}{" "}
                    <Link href="/membership/plans" data-link="all-plans">See all plans</Link>
                  </p>
                )}
              </>
            )}
            {!user && choice === "membership" ? (
              <p className="bk-note" style={{ marginTop: 12 }} data-membership-needs-account>
                A membership is kept on your account, so the next step creates it. Your job, address and time are saved.
              </p>
            ) : null}
            <p className="bk-note" style={{ marginTop: 14 }}>
              Need a whole day? <Link href="/book?visit=full-day">Book a Full Day</Link>
            </p>
          </section>
          {/*
            An account made with a phone code has no name or email yet, and a
            booking needs both: the press below asks for them (the email with a
            code) before Stripe. Said here, so it is not a surprise after a
            button showing a price. Above the texts box, which must stay
            directly above the button (A2P evidence, BackEnd
            test_a2p_public_evidence).
          */}
          {user && choice && choice !== "member" && (missingContact(user).name || missingContact(user).email) ? (
            <p className="bk-note" style={{ marginTop: 12 }} data-contact-next>
              Next: {missingContact(user).name && missingContact(user).email ? "your name and an email for receipts" : missingContact(user).name ? "your name" : "an email for receipts"}
              {missingContact(user).email ? " (we'll email you a code)" : ""}, then secure payment.
            </p>
          ) : null}
          {serviceTextsOptIn ? <div className="bk-texts">{serviceTextsOptIn}</div> : null}
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={submit} disabled={!choice || busy} data-action="book-handyman">
              {busy ? <span className="bk-spinner" aria-hidden="true" /> : null}
              {choice === "member"
                ? "Book my visit"
                : choice === "one_time"
                  ? `Continue to payment${price != null ? ` · $${price}` : ""}`
                  : choice === "membership" && !user
                    ? "Create account and continue"
                    : choice === "membership"
                    ? chosenOffer
                      ? `Continue to checkout · ${formatCents(chosenOffer.firstCents)} first ${cycle === "annual" ? "year" : "month"}`
                      : "Continue to membership checkout"
                    : "Choose an option"}
            </button>
            <p className="bk-note" style={{ textAlign: "center" }}>
              {choice === "member"
                ? "We'll confirm your appointment after we review it."
                : "Secure payment by Stripe. We'll confirm your appointment after we review it."}
            </p>
            {!user && choice === "one_time" ? (
              <p className="bk-fine" data-contact-consent>
                {GUEST_CHECKOUT_CONSENT_TEXT}{" "}
                <a href="/communication-consent#service-texts" target="_blank" rel="noopener noreferrer">SMS Terms</a>
                {" · "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
              </p>
            ) : null}
          </div>
        </>
      )}
      {contactSheet}
    </div>
  );
}
