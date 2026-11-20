"use client";

import "../booking4/booking4.css";
import "./welcome.css";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import Header from "@/app/components/sections/Header";
import AddressField, { type AddressValue, type ServiceAreaState } from "@/app/components/address/AddressField";
import SlotPicker, { formatWhen } from "@/app/components/booking4/SlotPicker";
import PhotoPicker from "@/app/components/booking4/PhotoPicker";
import HoldCountdown from "@/app/components/booking4/HoldCountdown";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { useServiceTextsOptIn } from "@/app/components/booking/ServiceTextsOptIn";
import { useAuth } from "@/lib/useAuth";
import { addHome, formatPhoneInput, missingContact, readApiError, updateProfileName } from "@/lib/auth2";
import { createOneTimeVisitCheckout, getOneTimeVisitConfig, getTimeSlots } from "@/lib/booking-service";
import { normalizeDayAvailability } from "@/lib/booking-calendar-availability";
import { PLAN_DETAILS } from "@/lib/stripe-links";
import { BENEFIT_ROWS, benefitIncluded, benefitLabel, ANNUAL_MONTHS_CHARGED } from "@/app/data/plan-benefits";
import type { Plan } from "@/app/data/content";
import { checkoutTracking, currentVisitorId, trackStep } from "@/lib/meta";
import { trackInitiateCheckout } from "@/lib/analytics";
import { GUEST_CHECKOUT_CONSENT_TEXT, GuestCheckoutError, abandonGuestCheckout, guestOneTimeCheckout } from "@/lib/guest-checkout";
import { WELCOME_OFFER_ERROR_CODES, formatCents, offerPrice, useWelcomeOffer } from "@/lib/welcome-offer";
import {
  EMPTY_HANDYMAN_DRAFT,
  loadHandymanDraft,
  loadHandymanPhotos,
  newClientRequestId,
  saveHandymanDraft,
  saveHandymanPhotos,
  type HandymanDraft,
} from "@/lib/handyman-draft";
import {
  WELCOME_PILOT_PATH,
  chooseHomepage,
  loadWelcomeFlow,
  saveWelcomeFlow,
  welcomeShowing,
  type WelcomePath,
  type WelcomeScreen,
} from "@/lib/welcome-entry";

/*
 * The welcome entry (2026-11-19; lib/welcome-entry says who sees it).
 *
 *   choice    I'm looking for…  [A handyman membership] [A one-time visit]
 *   nudge     one-time only: Members can book as many visits as they need.
 *             [Show me membership] (the membership path) [Continue with one visit]
 *   address   existing AddressField + service-area check
 *   time      existing SlotPicker; Continue re-checks the time is still open (nothing is
 *             held yet: a visitor who leaves here blocks nobody's slot)
 *   job       the job, optional photos, what a visit is
 *   contact   name, mobile, email in one form (native autofill); signed in: skipped
 *   plans     membership: the existing plans and prices, each plan's limit on
 *             visits booked at once - before verification and payment
 *   (hold)    the time is held (POST /api/bookings/hold, 30 minutes) only when they go on
 *             to the price: the one-time review, or from the plans to verification;
 *             the checkout re-holds it for the Stripe page. Taken by then: back to the
 *             calendar, every other answer kept.
 *   pay       membership, signed in: review, then the existing membership
 *             book-first checkout (first-visit draft + Stripe; the webhook books it)
 *   review    one-time: the visit, price and terms, then the existing guest checkout
 *
 * Verification is the existing passwordless sign-up (/signup, phone code) with
 * the number already filled in; it returns to /start?resume=pay.
 *
 * Everything is the same draft Book a Handyman keeps (lib/handyman-draft), so
 * the selected time, job, photos and details survive Back, a refresh, sign-in,
 * Stripe and the confirmation page, which finishes in Book a Handyman exactly
 * as today. Every money and calendar rule is the server's. Every visit still
 * waits for the owner's review; nothing here refuses a job for what it says.
 *
 * Privacy: the whole flow is masked for Clarity (data-clarity-mask on the
 * root); no answer is ever put in a URL; screen changes keep the same URL (a
 * history entry with state only), so no page view is multiplied.
 */

const noopSubscribe = () => () => {};

const ORDER: Record<WelcomePath, WelcomeScreen[]> = {
  membership: ["choice", "address", "time", "job", "contact", "plans", "pay"],
  one_time: ["choice", "nudge", "address", "time", "job", "contact", "review"],
};

const TITLES: Record<WelcomeScreen, string> = {
  choice: "I’m looking for…",
  nudge: "Members can book as many visits as they need.",
  address: "Where is the visit?",
  time: "When works for you?",
  job: "What needs doing?",
  contact: "Who should we confirm with?",
  plans: "Choose your plan",
  pay: "Review and pay",
  review: "Review your visit",
};

const JOB_SHORTCUTS: Array<{ label: string; text: string }> = [
  { label: "Replace faucet", text: "Replace an existing faucet." },
  { label: "Fix door", text: "Fix a door that sticks or won't latch." },
  { label: "Light fixture", text: "Install a light fixture." },
  { label: "Patch drywall", text: "Patch and repair drywall." },
  { label: "Replace outlet", text: "Replace an outlet or switch." },
  { label: "Install shelves", text: "Install wall shelves." },
];
const hasTask = (task: string, text: string) => task.toLowerCase().includes(text.toLowerCase().replace(/\.$/, ""));
const addTask = (task: string, text: string) => (hasTask(task, text) ? task : task.replace(/\s+$/, "") ? `${task.replace(/\s+$/, "")}\n${text}` : text);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const phoneDigits = (value: string) => {
  const d = String(value || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};
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
const TZ = "America/New_York";
function nyIso(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const shown = new Date(guess.toLocaleString("en-US", { timeZone: TZ }));
  return new Date(guess.getTime() + (guess.getTime() - shown.getTime())).toISOString();
}
const failure = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { message?: string; code?: string } }; message?: string })?.response?.data;
  return { message: data?.message || (error as Error)?.message || fallback, code: data?.code || (error as { code?: string })?.code || "" };
};

/* What a plan card lists besides its price: the limit on visits booked at once first, then what it adds. Never "the same handyman". */
function planLines(name: Plan["name"]) {
  const pace = BENEFIT_ROWS.find((r) => r.id === "pace");
  const extras = BENEFIT_ROWS.filter((r) => ["supplies", "priority", "fullDay", "projects"].includes(r.id) && benefitIncluded(r, name)).map((r) => benefitLabel(r, name));
  return { pace: pace ? benefitLabel(pace, name) : "", extras };
}

export default function WelcomeFlow({ entry }: { entry: "home" | "start" }) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { ensureContact, editContact, contactSheet } = useContactCompletion();
  const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn();

  /* The server renders the first screen; on the homepage CSS shows it only when the pre-paint script chose it. */
  const [active, setActive] = useState(true);
  const [screen, setScreen] = useState<WelcomeScreen>("choice");
  const [path, setPath] = useState<WelcomePath | "">("");
  const [draft, setDraft] = useState<HandymanDraft>(EMPTY_HANDYMAN_DRAFT);
  const [photos, setPhotos] = useState<File[]>([]);
  const [typedAddress, setTypedAddress] = useState<AddressValue | null>(null);
  const [addressText, setAddressText] = useState("");
  const [addressMode, setAddressMode] = useState<"lookup" | "manual">("lookup");
  const [area, setArea] = useState<ServiceAreaState>("unknown");
  const [plan, setPlan] = useState("plus");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [price, setPrice] = useState<number | null>(99);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The receipt email being edited on the final screen (null: not editing).
  const [emailEdit, setEmailEdit] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /* In a browser (after hydration): see the first question's heading below. */
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const pressing = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const depth = useRef(0);
  const shownSent = useRef(false);
  const plansSent = useRef(false);

  const update = useCallback((patch: Partial<HandymanDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveHandymanDraft(next);
      return next;
    });
  }, []);

  /* Homepage: is the flow really showing (the pre-paint script decided)? Before paint, so nothing flashes. */
  useLayoutEffect(() => {
    if (entry === "home" && !welcomeShowing()) setActive(false);
  }, [entry]);

  /* Restore the draft, the photos and the screen; read what came back from sign-up or Stripe. */
  useEffect(() => {
    // The homepage visitor who is not shown the flow: nothing of it runs (no API call, no history entry).
    if (!active || (entry === "home" && !welcomeShowing())) return;
    let alive = true;
    (async () => {
      const saved = loadHandymanDraft();
      const flow = loadWelcomeFlow();
      const savedPhotos = saved?.photoCount ? await loadHandymanPhotos() : [];
      if (!alive) return;
      if (saved) {
        setDraft(saved);
        if (saved.plan) setPlan(saved.plan);
        if (saved.cycle === "annual") setCycle("annual");
        if (saved.address) {
          setTypedAddress({ ...saved.address, unit: saved.address.unit || "", placeId: saved.address.placeId || "", lat: saved.address.lat ?? null, lng: saved.address.lng ?? null, formatted: [saved.address.line1, saved.address.city, saved.address.state, saved.address.zip].filter(Boolean).join(", "), verified: Boolean(saved.address.placeId) });
        }
      }
      setPhotos(savedPhotos);
      const params = new URLSearchParams(window.location.search);
      const resume = params.get("resume");
      const canceled = params.get("canceled");
      let start: WelcomeScreen = "choice";
      let startPath: WelcomePath | "" = "";
      if (flow && saved) {
        start = flow.screen;
        startPath = flow.path;
      }
      if (resume === "pay" && saved) {
        start = "pay";
        startPath = "membership";
      }
      if (canceled === "1" && saved) {
        const id = params.get("booking_id") || saved.pendingBookingId;
        const token = (() => {
          try {
            return window.localStorage.getItem("token");
          } catch {
            return null;
          }
        })();
        if (id && token) API.post(`/api/bookings/one-time/${id}/abandon`).catch(() => undefined);
        else if (id && saved.clientRequestId) void abandonGuestCheckout(id, saved.clientRequestId);
        saveHandymanDraft({ pendingBookingId: "", clientRequestId: "" });
        setDraft((d) => ({ ...d, pendingBookingId: "", clientRequestId: "" }));
        setBanner({ tone: "warn", text: "Checkout canceled. Nothing was charged, and your details are saved." });
        start = "review";
        startPath = "one_time";
      }
      if (canceled === "membership" && saved) {
        setBanner({ tone: "warn", text: "Membership checkout canceled. Nothing was charged, and your details are saved." });
        start = "pay";
        startPath = "membership";
      }
      if (resume || canceled) window.history.replaceState(window.history.state, "", window.location.pathname);
      // A screen of a path never chosen is not a place to land: start over at the question.
      if (start !== "choice" && !startPath) start = "choice";
      setPath(startPath);
      setScreen(start);
      window.history.replaceState({ ...(window.history.state || {}), wf: start, wfPath: startPath }, "", window.location.href);
      setReady(true);
    })();
    getOneTimeVisitConfig()
      .then((c) => alive && setPrice(c.enabled ? Math.round(c.priceCents / 100) : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active, entry]);

  useEffect(() => {
    if (ready) {
      void saveHandymanPhotos(photos);
      saveHandymanDraft({ photoCount: photos.length });
    }
  }, [photos, ready]);

  /* Shown: once per browser and day on the server (trackStep), the start of "does it get people moving". */
  useEffect(() => {
    if (!active || !ready || shownSent.current) return;
    shownSent.current = true;
    trackStep("welcome_shown");
  }, [active, ready]);

  /* Remember the screen, so a reload or the way back from sign-up lands on it. */
  useEffect(() => {
    if (ready && active) saveWelcomeFlow({ screen, path });
  }, [ready, active, screen, path]);

  /* Browser Back walks the screens (same URL, state only). */
  useEffect(() => {
    if (!active) return undefined;
    const onPop = (e: PopStateEvent) => {
      const s = (e.state?.wf as WelcomeScreen | undefined) || "choice";
      depth.current = Math.max(0, depth.current - 1);
      setErrors({});
      setScreen(s);
      if (e.state?.wfPath !== undefined) setPath(e.state.wfPath);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active]);

  /* A new screen: its question gets focus (and screen readers hear it), and the page starts at the top. */
  const firstScreen = useRef(true);
  useEffect(() => {
    if (!ready) return;
    window.scrollTo({ top: 0 });
    // Not on arrival: the page simply opens; from then on each new question takes focus.
    if (firstScreen.current) firstScreen.current = false;
    else headingRef.current?.focus({ preventScroll: true });
    if (screen === "plans" && !plansSent.current) {
      plansSent.current = true;
      trackStep("welcome_plans_view");
    }
  }, [screen, ready]);

  /* The Continue bar is on screen: the floating call and chat buttons sit above it (ui-shell.css). */
  const showBar = active && screen !== "choice" && screen !== "nudge";
  useEffect(() => {
    const root = document.documentElement;
    if (active && (entry === "start" || welcomeShowing())) root.setAttribute("data-wf-active", "1");
    root.toggleAttribute("data-wf-bar", showBar);
    return () => {
      root.removeAttribute("data-wf-active");
      root.removeAttribute("data-wf-bar");
    };
  }, [active, showBar, entry]);

  const go = (next: WelcomeScreen, nextPath: WelcomePath | "" = path) => {
    setErrors({});
    setBanner(null);
    setPath(nextPath);
    setScreen(next);
    depth.current += 1;
    window.history.pushState({ ...(window.history.state || {}), wf: next, wfPath: nextPath }, "", window.location.href);
  };
  const back = () => {
    if (depth.current > 0) {
      window.history.back();
      return;
    }
    const order = path ? ORDER[path] : ORDER.membership;
    const i = order.indexOf(screen);
    const prev = i > 0 ? order[i - 1] : "choice";
    setErrors({});
    setScreen(prev === "contact" && user ? "job" : prev);
    if (prev === "choice") setPath("");
  };
  const nextAfter = (s: WelcomeScreen, p: WelcomePath = path || "membership"): WelcomeScreen => {
    const order = ORDER[p];
    let n = order[order.indexOf(s) + 1] || order[order.length - 1];
    if (n === "contact" && user) n = order[order.indexOf("contact") + 1];
    return n;
  };

  /* The logo or a menu link: the current homepage (or that page), remembered. */
  const leave = (event?: { brand: boolean; preventDefault: () => void }) => {
    trackStep("welcome_exit_home");
    // Leaving the flow: a time they were holding goes back on the calendar now, not in 30 minutes.
    if (draft.holdToken) {
      API.post("/api/bookings/hold/release", { token: draft.holdToken }).catch(() => undefined);
      update({ holdToken: "", holdFor: "", holdExpiresAt: "" });
    }
    chooseHomepage();
    if (entry === "home") {
      // Already on the homepage: the logo just shows it (no navigation, the ad's URL kept).
      if (event?.brand) event.preventDefault();
      setActive(false);
      window.scrollTo({ top: 0 });
    }
  };

  /* ---------------------------------------------------------- steps */

  const pick = (p: WelcomePath) => {
    trackStep(p === "membership" ? "welcome_tap_membership" : "welcome_tap_one_time");
    update({ choice: p });
    go(p === "membership" ? "address" : "nudge", p);
  };
  const nudge = (p: WelcomePath) => {
    trackStep(p === "membership" ? "welcome_nudge_membership" : "welcome_nudge_one_time");
    update({ choice: p });
    go("address", p);
  };

  const continueAddress = () => {
    const found: Record<string, string> = {};
    if (!typedAddress?.line1 || !typedAddress.city || !typedAddress.zip) {
      found.address = addressText
        ? addressMode === "manual"
          ? "Finish the address: street, city and a 5-digit ZIP."
          : "Choose your address from the list under the box, or tap “Can’t find your address?” to type it in."
        : "Enter the service address: start typing, then choose it from the list.";
    } else if (area === "outside") found.address = "We serve Nassau and Suffolk counties. That address is outside our area for now.";
    setErrors(found);
    if (Object.keys(found).length || !typedAddress) return;
    update({ address: { line1: typedAddress.line1, unit: typedAddress.unit, city: typedAddress.city, state: typedAddress.state || "NY", zip: typedAddress.zip, placeId: typedAddress.placeId, lat: typedAddress.lat, lng: typedAddress.lng }, addressId: "" });
    trackStep("welcome_address_done");
    go("time");
  };

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

  /* Hold the time while they finish. Taken: pick another, everything else kept. Anything else: go on (the checkout re-checks). */
  const holdTime = async (date: string, time: string, token: string): Promise<boolean> => {
    try {
      const res = await API.post("/api/bookings/hold", { requestedDate: date, requestedTime: time, token: token || null });
      update({ holdToken: res.data?.token || "", holdFor: res.data?.token ? `${date} ${time}` : "", holdExpiresAt: res.data?.holdExpiresAt || "" });
      return true;
    } catch (error) {
      if (failure(error, "").code === "SLOT_UNAVAILABLE") {
        update({ time: "", timeConfirmed: false, holdToken: "", holdFor: "", holdExpiresAt: "" });
        setErrors({ when: "That time was just taken. Pick another - everything else is saved." });
        return false;
      }
      return true;
    }
  };
  /* Is the chosen time still open? (Read only. The visitor's own hold counts as theirs; an unanswered check goes on - the hold re-checks.) */
  const stillOpen = async (date: string, time: string): Promise<boolean> => {
    if (draft.holdToken && draft.holdFor === `${date} ${time}`) return true;
    try {
      const day = normalizeDayAvailability(await getTimeSlots(date));
      const slot = day?.slots?.find((x) => x.time === time);
      return !slot || slot.available === true;
    } catch {
      return true;
    }
  };
  const continueTime = async () => {
    if (busy) return;
    if (!draft.date || !draft.time) {
      setErrors({ when: "Pick a day and a time." });
      return;
    }
    setErrors({});
    setBusy(true);
    const open = await stillOpen(draft.date, draft.time);
    setBusy(false);
    if (!open) {
      update({ time: "", timeConfirmed: false });
      setErrors({ when: "That time was just taken. Pick another - everything else is saved." });
      return;
    }
    update({ timeConfirmed: true });
    trackStep("welcome_slot_done");
    go("job");
  };
  /*
   * Hold the time now that they are going on to the price (2026-11-20): taken
   * meanwhile sends them back to the calendar with everything else kept.
   */
  const holdBeforePrice = async (): Promise<boolean> => {
    setBusy(true);
    const held = await holdTime(draft.date, draft.time, draft.holdToken);
    setBusy(false);
    if (!held) {
      setScreen("time");
      depth.current += 1;
      window.history.pushState({ ...(window.history.state || {}), wf: "time", wfPath: path }, "", window.location.href);
    }
    return held;
  };
  /* The time was lost after it was held (taken at checkout): back to the calendar, nothing else re-entered. */
  const timeTaken = () => {
    update({ time: "", timeConfirmed: false, clientRequestId: "", holdToken: "", holdFor: "", holdExpiresAt: "" });
    setScreen("time");
    window.history.pushState({ ...(window.history.state || {}), wf: "time", wfPath: path }, "", window.location.href);
    depth.current += 1;
    setErrors({ when: "That time was just taken. Pick another - everything else is saved." });
  };

  const continueJob = async () => {
    if (words(draft.task) < 3) {
      setErrors({ task: "Tell us in a few words what needs doing." });
      return;
    }
    trackStep("welcome_job_done");
    const next = nextAfter("job");
    if (next === "review" && !(await holdBeforePrice())) return;
    go(next);
  };

  const continueContact = async (e?: FormEvent) => {
    e?.preventDefault();
    const found = contactErrors(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    update({ name: draft.name.trim(), email: draft.email.trim(), phone: phoneDigits(draft.phone) });
    trackStep("welcome_contact_done");
    const next = nextAfter("contact");
    if (next === "review" && !(await holdBeforePrice())) return;
    go(next);
  };

  const continuePlans = async () => {
    if (busy) return;
    update({ choice: "membership", plan, cycle });
    if (!(await holdBeforePrice())) return;
    trackStep("plan_selected");
    if (user) {
      go("pay");
      return;
    }
    // Verification: the existing passwordless sign-up, the number already filled in. It comes back to the payment screen.
    saveWelcomeFlow({ screen: "pay", path: "membership" });
    router.push(`/signup?next=${encodeURIComponent(`${WELCOME_PILOT_PATH}?resume=pay`)}&intent=handyman`);
  };

  /* ---------------------------------------------------------- payment */

  const homes = useMemo(() => user?.addresses || [], [user]);
  const resolveAddressId = async (): Promise<string | null> => {
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
  const offerHome = draft.address ? { line1: draft.address.line1, zip: draft.address.zip } : null;
  const offer = useWelcomeOffer(Boolean(user) && screen === "pay", offerHome);
  const chosenOffer = offerPrice(offer, plan, cycle);
  const chosenPlan = PLAN_DETAILS.find((p) => p.id === plan) || PLAN_DETAILS[0];
  const regularCents = (id: string, monthly: number) => (cycle === "annual" ? (offer.plans[id]?.annualCents ?? monthly * ANNUAL_MONTHS_CHARGED * 100) : (offer.plans[id]?.monthlyCents ?? monthly * 100));
  const prefill = { name: draft.name, phone: draft.phone ? formatPhoneInput(draft.phone) : "", email: draft.email };
  /*
   * One code to buy (2026-11-20). They proved their phone at sign-up and typed
   * their name and email in this flow: those are saved to the account without a
   * second code (BackEnd POST /api/auth/contact/email - a receipt address that
   * cannot open the account until verified). Anything this cannot do (an email
   * another account uses, no verified phone) falls back to the usual contact
   * step, prefilled.
   */
  const completeContactFromFlow = async (): Promise<typeof user> => {
    if (!user) return user;
    const missing = missingContact(user);
    try {
      if (missing.name && draft.name.trim().split(/\s+/).length >= 2) await updateProfileName(draft.name.trim());
      if (missing.email && draft.email.trim() && user.phoneVerified !== false) {
        await API.post("/api/auth/contact/email", { email: draft.email.trim() });
      }
    } catch (error) {
      void readApiError(error);
    }
    return missing.name || missing.email ? (await refreshUser()) || user : user;
  };
  /* The contact step only for what is still missing after that (read from the fresh account, not the last render). */
  const contactComplete = async (): Promise<boolean> => {
    const fresh = await completeContactFromFlow();
    const still = missingContact(fresh);
    if (!still.name && !still.phone && !still.email) return true;
    return ensureContact({ prefill });
  };

  /*
   * The email on the final screen, with Edit (2026-11-20). Bought with one code,
   * this is where the receipt and billing notices go, so they see it before
   * paying. Still unconfirmed, it is simply replaced (it cannot open the
   * account either way); a confirmed one changes with a code, in the usual sheet.
   */
  const receiptEmail = (user?.email || draft.email || "").trim();
  const startEmailEdit = () => {
    if (user?.email && user.emailVerified) {
      void editContact("email");
      return;
    }
    setErrors((e) => ({ ...e, receiptEmail: "" }));
    setEmailEdit(receiptEmail);
  };
  const saveEmailEdit = async (e?: FormEvent) => {
    e?.preventDefault();
    const next = (emailEdit || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next)) {
      setErrors((x) => ({ ...x, receiptEmail: "Enter a valid email." }));
      return;
    }
    if (user?.email && user.email.trim().toLowerCase() !== next.toLowerCase()) {
      setBusy(true);
      try {
        await API.post("/api/auth/contact/email", { email: next });
        await refreshUser();
      } catch (error) {
        const f = readApiError(error);
        if (f.code === "IDENTIFIER_IN_USE" || f.code === "INVALID_EMAIL") {
          setErrors((x) => ({ ...x, receiptEmail: f.code === "INVALID_EMAIL" ? "Enter a valid email." : "That email is used by another Profixter account." }));
          return;
        }
        // An older email on the account changes with a code, in the usual sheet.
        setEmailEdit(null);
        void editContact("email");
        return;
      } finally {
        setBusy(false);
      }
    }
    update({ email: next });
    setEmailEdit(null);
  };

  const payMembership = async () => {
    if (pressing.current) return;
    if (!user) {
      continuePlans();
      return;
    }
    pressing.current = true;
    setBusy(true);
    setBanner(null);
    try {
      if (!(await contactComplete())) return;
      const addressId = await resolveAddressId();
      if (!addressId) {
        go("address");
        setErrors({ address: "Please enter the service address." });
        return;
      }
      update({ choice: "membership", plan, cycle });
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
      const res = await API.post("/api/stripe/checkout/create-checkout-session", {
        plan,
        addressId,
        billingCycle: cycle,
        returnTo: "welcome",
        welcomeOffer: Boolean(chosenOffer),
        firstVisit: { draftId: firstVisitDraftId, holdToken: draft.holdToken || "", requestedDate: draft.date, requestedTime: draft.time },
        ...checkoutTracking(),
      });
      if (res.data?.holdToken) update({ holdToken: res.data.holdToken, holdFor: `${draft.date} ${draft.time}`, holdExpiresAt: res.data.holdExpiresAt || draft.holdExpiresAt });
      trackStep("welcome_checkout_started");
      await applyServiceTextsOptIn();
      window.location.assign(res.data.url);
    } catch (error) {
      const f = failure(error, "Something went wrong. Please try again.");
      if (f.code === "SLOT_UNAVAILABLE") timeTaken();
      else if (f.code === "OUT_OF_SERVICE_AREA") {
        go("address");
        setErrors({ address: f.message });
      } else if (WELCOME_OFFER_ERROR_CODES.includes(f.code)) {
        offer.refresh();
        setBanner({ tone: "warn", text: f.message });
      } else if (f.code === "ADDRESS_ALREADY_SUBSCRIBED") {
        await refreshUser();
        setBanner({ tone: "info", text: "This home already has a membership, so your visits are included. Book this one in Book a Handyman - your details are saved." });
      } else if (f.code === "MEMBERSHIP_PAYMENT_RECOVERY_REQUIRED") {
        setBanner({ tone: "warn", text: "This home's membership payment needs attention. Update your payment in your account - no need to buy a new one." });
      } else setBanner({ tone: "warn", text: f.message });
    } finally {
      pressing.current = false;
      setBusy(false);
    }
  };

  const payOneTime = async () => {
    if (pressing.current) return;
    pressing.current = true;
    setBusy(true);
    setBanner(null);
    const clientRequestId = draft.clientRequestId || newClientRequestId();
    update({ clientRequestId, choice: "one_time" });
    trackInitiateCheckout({ content_name: "one_time_visit", value: price ?? undefined, currency: "USD" });
    try {
      if (user) {
        if (!(await contactComplete())) return;
        const addressId = await resolveAddressId();
        if (!addressId) {
          go("address");
          return;
        }
        const res = await createOneTimeVisitCheckout({
          addressId,
          selectedTask: draft.task.trim().slice(0, 120),
          date: nyIso(draft.date, draft.time),
          note: draft.task.trim(),
          images: photos,
          requestedDate: draft.date,
          requestedTime: draft.time,
          clientRequestId,
          returnTo: "welcome",
          holdToken: draft.holdToken || undefined,
        });
        update({ pendingBookingId: res.bookingId, holdToken: "", holdFor: "", holdExpiresAt: "" });
        trackStep("welcome_checkout_started");
        await applyServiceTextsOptIn();
        window.location.assign(res.url);
        return;
      }
      const address = draft.address;
      if (!address) {
        go("address");
        return;
      }
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
        returnTo: "welcome",
        visitorId: currentVisitorId() || undefined,
        tracking: checkoutTracking(),
      });
      if ("alreadyPaid" in res) {
        window.location.assign(res.sessionId ? `/book/confirmation?booking_id=${res.bookingId}&session_id=${res.sessionId}` : "/book/confirmation");
        return;
      }
      update({ pendingBookingId: res.bookingId, holdToken: "", holdFor: "", holdExpiresAt: "" });
      trackStep("welcome_checkout_started");
      window.location.assign(res.url);
    } catch (error) {
      const e = error instanceof GuestCheckoutError ? error : null;
      const f = e ? { code: e.code, message: e.message } : failure(error, "Something went wrong. Please try again.");
      if (f.code === "SLOT_UNAVAILABLE") timeTaken();
      else if (e?.field === "address") {
        update({ clientRequestId: "" });
        go("address");
        setErrors({ address: e.message });
      } else if (e?.field === "task") {
        update({ clientRequestId: "" });
        go("job");
        setErrors({ task: e.message });
      } else if (e?.field === "name" || e?.field === "phone" || e?.field === "email") {
        update({ clientRequestId: "" });
        go("contact");
        setErrors({ [e.field]: e.message });
      } else {
        // A network failure keeps the press id: trying again reopens the same checkout, never a second one.
        if (f.code !== "NETWORK") update({ clientRequestId: "" });
        setBanner({ tone: "warn", text: f.message });
      }
    } finally {
      pressing.current = false;
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------- render */

  if (!active) return null;

  const err = (k: string) => (errors[k] ? <p className="bk-error" role="alert">{errors[k]}</p> : null);
  const heldSlot = draft.holdToken && draft.holdFor ? { date: draft.holdFor.slice(0, 10), time: draft.holdFor.slice(11) } : null;
  const addressLine = draft.address ? [draft.address.line1, draft.address.city, draft.address.zip].filter(Boolean).join(", ") : "";
  const when = formatWhen(draft.date, draft.time);
  const summary = (
    <dl className="wf-summary">
      <div><dt>When</dt><dd>{when} <button type="button" className="bk-link" onClick={() => go("time")}>Change</button></dd></div>
      <div><dt>Where</dt><dd>{addressLine}</dd></div>
      <div><dt>Job</dt><dd>{draft.task.length > 90 ? `${draft.task.slice(0, 90)}…` : draft.task}</dd></div>
      {!user && draft.name ? <div><dt>Contact</dt><dd>{draft.name} <button type="button" className="bk-link" onClick={() => go("contact")}>Change</button></dd></div> : null}
      {receiptEmail ? (
        <div data-receipt-email>
          <dt>Receipts</dt>
          <dd>
            {emailEdit !== null ? (
              <form className="wf-email-edit" onSubmit={saveEmailEdit} noValidate>
                <label className="sr-only" htmlFor="wf-receipt-email">Email for receipts</label>
                <input
                  id="wf-receipt-email"
                  className="bk-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="done"
                  value={emailEdit}
                  onChange={(ev) => setEmailEdit(ev.target.value)}
                  autoFocus
                />
                <button type="submit" className="bk-btn bk-btn--secondary" disabled={busy} data-receipt-save>Save</button>
                {err("receiptEmail")}
              </form>
            ) : (
              <>
                <span data-receipt-value>{receiptEmail}</span>{" "}
                <button type="button" className="bk-link" onClick={() => (user ? startEmailEdit() : go("contact"))} data-receipt-edit>Edit</button>
              </>
            )}
          </dd>
        </div>
      ) : null}
    </dl>
  );

  const bar = (() => {
    switch (screen) {
      case "address":
        return { label: "Continue", onClick: continueAddress, action: "address" };
      case "time":
        return { label: busy ? "Holding your time…" : "Continue", onClick: continueTime, action: "time" };
      case "job":
        return { label: "Continue", onClick: continueJob, action: "job" };
      case "contact":
        return { label: "Continue", onClick: () => continueContact(), action: "contact" };
      case "plans":
        return { label: user ? "Continue" : "Continue to verify your phone", onClick: continuePlans, action: "plans" };
      case "pay":
        return {
          label: !user ? "Continue to verify your phone" : chosenOffer ? `Continue to secure checkout · ${formatCents(chosenOffer.firstCents)}` : "Continue to secure checkout",
          onClick: payMembership,
          action: "pay-membership",
        };
      case "review":
        return { label: `Continue to payment${price != null ? ` · $${price}` : ""}`, onClick: payOneTime, action: "pay-one-time" };
      default:
        return null;
    }
  })();

  return (
    <div className="wf" data-welcome="" data-entry={entry} data-screen={screen} data-path={path || undefined} data-clarity-mask="true">
      <div className="wf-head">
        <Header entry onLeave={leave} />
      </div>
      <main className="wf-main">
        <div className={`bk wf-body wf-body--${screen}`}>
          {banner ? <div className={`bk-banner bk-banner--${banner.tone}`} role="status">{banner.text}</div> : null}

          {screen === "choice" ? (
            <section className="wf-ask" aria-labelledby="wf-q">
              {/*
                The homepage's server HTML (what crawlers index) keeps its own single
                h1: here the question is plain text until the page is live in a
                browser, then the screen's heading.
              */}
              {mounted ? (
                <h1 id="wf-q" ref={headingRef} tabIndex={-1} className="wf-q">{TITLES.choice}</h1>
              ) : (
                <p id="wf-q" className="wf-q">{TITLES.choice}</p>
              )}
              <div className="wf-picks">
                <button type="button" className="wf-pick wf-pick--primary" data-pick="membership" onClick={() => pick("membership")}>A handyman membership</button>
                <button type="button" className="wf-pick" data-pick="one_time" onClick={() => pick("one_time")}>A one-time visit</button>
              </div>
            </section>
          ) : null}

          {screen === "nudge" ? (
            <section className="wf-ask" aria-labelledby="wf-q">
              <h1 id="wf-q" ref={headingRef} tabIndex={-1} className="wf-q wf-q--nudge">{TITLES.nudge}</h1>
              <div className="wf-picks">
                <button type="button" className="wf-pick" data-pick="nudge-membership" onClick={() => nudge("membership")}>Show me membership</button>
                <button type="button" className="wf-pick wf-pick--primary" data-pick="nudge-one-time" onClick={() => nudge("one_time")}>Continue with one visit</button>
              </div>
            </section>
          ) : null}

          {screen !== "choice" && screen !== "nudge" ? (
            <h1 ref={headingRef} tabIndex={-1} className="wf-title">{TITLES[screen]}</h1>
          ) : null}

          {screen === "address" ? (
            <section className="bk-field" data-error={errors.address ? "1" : undefined} data-address-field>
              <span className="bk-hint">Type your street address, then tap it in the list.</span>
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
              {err("address")}
            </section>
          ) : null}

          {screen === "time" ? (
            <section data-error={errors.when ? "1" : undefined}>
              <SlotPicker date={draft.date} time={draft.time} onChange={onWhen} held={heldSlot} />
              {err("when")}
            </section>
          ) : null}

          {screen === "job" ? (
            <section>
              <p className="wf-note" data-visit-scope>
                Each visit is up to 90 minutes of work, for home maintenance and small repairs.
              </p>
              <div className="bk-field" data-error={errors.task ? "1" : undefined}>
                <label className="bk-label" htmlFor="wf-task">Describe the job</label>
                <div className="bk-chips" role="group" aria-label="Common jobs - tap to add">
                  {JOB_SHORTCUTS.map((job) => {
                    const added = hasTask(draft.task, job.text);
                    return (
                      <button key={job.label} type="button" className="bk-chip" aria-pressed={added} onClick={() => update({ task: addTask(draft.task, job.text).slice(0, 1200) })}>
                        <span aria-hidden="true">{added ? "✓" : "+"}</span>
                        {job.label}
                      </button>
                    );
                  })}
                </div>
                <textarea id="wf-task" className="bk-textarea" name="task" enterKeyHint="done" aria-invalid={errors.task ? "true" : undefined} value={draft.task} onChange={(e) => update({ task: e.target.value })} placeholder="Tap a job above, or describe it in a few words" maxLength={1200} />
                {err("task")}
              </div>
              <span className="bk-label">Photos <small>(optional)</small></span>
              <p className="wf-note wf-note--tight">Photos help us come prepared.</p>
              <PhotoPicker photos={photos} onChange={setPhotos} />
            </section>
          ) : null}

          {screen === "contact" ? (
            <form className="wf-form" onSubmit={continueContact} noValidate>
              {(["name", "phone", "email"] as const).map((k) => (
                <label key={k} className="bk-field bk-float" data-error={errors[k] ? "1" : undefined}>
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
              <p className="wf-note">
                {path === "membership" ? "We’ll text a code to this number to set up your account, then show you the plans." : "We’ll confirm your visit with you. No account needed."}
              </p>
              {/* Enter on the keyboard submits, like the button below. */}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          ) : null}

          {screen === "plans" ? (
            <section aria-label="Plans">
              <div className="bk-cycle" role="radiogroup" aria-label="Billing">
                {(["monthly", "annual"] as const).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={cycle === c} className="bk-cycle-btn" data-cycle={c} onClick={() => setCycle(c)}>
                    {c === "monthly" ? "Monthly" : "Annual"}
                    {c === "annual" ? <small>2 months free</small> : null}
                  </button>
                ))}
              </div>
              <div className="wf-plans" role="radiogroup" aria-label="Plan">
                {PLAN_DETAILS.map((p) => {
                  const lines = planLines(p.name as Plan["name"]);
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className="wf-plan" data-plan={p.id} onClick={() => setPlan(p.id)}>
                      <span className="wf-plan-top">
                        <b>{p.name}</b>
                        <span className="wf-plan-price">{formatCents(regularCents(p.id, p.price))}<small>{cycle === "annual" ? "/yr" : "/mo"}</small></span>
                      </span>
                      <span className="wf-plan-pace" data-plan-pace>{lines.pace}</span>
                      {lines.extras.length ? <span className="wf-plan-extras">{lines.extras.join(" · ")}</span> : null}
                    </button>
                  );
                })}
              </div>
              <p className="wf-note" data-plan-terms>
                Labor is included. Each visit is up to 90 minutes; when one is done, book the next, as often as you need.{" "}
                {cycle === "annual" ? "Pay for 10 months, get 12, billed once a year" : "Month to month, cancel anytime"}, plus applicable taxes.{" "}
                <Link href="/membership/plans" target="_blank" rel="noopener">Compare plans in detail</Link>
              </p>
              {!user ? (
                <p className="wf-note" data-next-verify>
                  Next: we text a code to {formatPhoneInput(draft.phone) || "your phone"} to set up your account, then secure payment.
                </p>
              ) : null}
            </section>
          ) : null}

          {screen === "pay" ? (
            <section>
              <div className="wf-paycard" data-pay-plan={chosenPlan.id}>
                <div className="wf-plan-top">
                  <b>{chosenPlan.name} membership</b>
                  <button type="button" className="bk-link" onClick={() => go("plans")}>Change</button>
                </div>
                <p className="wf-plan-pace">{planLines(chosenPlan.name as Plan["name"]).pace}</p>
                <p className="wf-price-line" data-pay-price>
                  {chosenOffer
                    ? `${formatCents(chosenOffer.firstCents)} for your first ${cycle === "annual" ? "year" : "month"}, then ${formatCents(chosenOffer.regularCents)}/${cycle === "annual" ? "year" : "month"}`
                    : `${formatCents(regularCents(chosenPlan.id, chosenPlan.price))}/${cycle === "annual" ? "year" : "month"}`}
                  , plus applicable taxes. {cycle === "annual" ? "Billed once a year." : "Month to month, cancel anytime."}
                </p>
              </div>
              <p className="wf-subhead">Your first visit</p>
              {summary}
              {draft.holdToken && draft.holdExpiresAt ? <HoldCountdown expiresAt={draft.holdExpiresAt} /> : null}
              <p className="wf-note">We review every visit request and confirm the appointment with you.</p>
              {user && serviceTextsOptIn ? <div className="bk-texts">{serviceTextsOptIn}</div> : null}
            </section>
          ) : null}

          {screen === "review" ? (
            <section>
              <div className="wf-paycard" data-review-one-time>
                <div className="wf-plan-top">
                  <b>One-Time Visit</b>
                  <span className="wf-plan-price">{price != null ? `$${price}` : ""}</span>
                </div>
                <p className="wf-price-line">Up to 90 minutes of work. Pay once, no commitment. Materials not included.</p>
              </div>
              {summary}
              {draft.holdToken && draft.holdExpiresAt ? <HoldCountdown expiresAt={draft.holdExpiresAt} /> : null}
              <p className="wf-note">We review every visit request and confirm the appointment with you.</p>
              {user && serviceTextsOptIn ? <div className="bk-texts">{serviceTextsOptIn}</div> : null}
              {!user ? (
                <p className="bk-fine" data-contact-consent>
                  {GUEST_CHECKOUT_CONSENT_TEXT}{" "}
                  <a href="/communication-consent#service-texts" target="_blank" rel="noopener noreferrer">SMS Terms</a>
                  {" · "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>

      {showBar && bar ? (
        <div className="wf-bar" data-wf-bar-el>
          <button type="button" className="wf-back" onClick={back} aria-label="Back">
            <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><path d="M8 2 2 8l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="bk-btn bk-btn--primary wf-continue" onClick={bar.onClick} disabled={busy} aria-busy={busy || undefined} data-action={`wf-${bar.action}`}>
            {busy && screen !== "time" ? <span className="bk-spinner" aria-hidden="true" /> : null}
            {bar.label}
          </button>
        </div>
      ) : null}
      {contactSheet}
    </div>
  );
}
