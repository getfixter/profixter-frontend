"use client";

import "./booking4.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import API from "@/lib/api";
import AddressField, { type AddressValue, type ServiceAreaState } from "@/app/components/address/AddressField";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { useAuth } from "@/lib/useAuth";
import { addHome } from "@/lib/auth2";
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

/*
 * Book a Handyman (Customer Experience 4.0).
 *
 *   1. What needs doing - the job, the address, optional photos
 *   2. When - a real open time
 *   3. Account - sign in or create one (Registration 2.0); the draft waits
 *   4. How to book - the member's included visit, a One-Time Visit, or a membership
 *   5. Pay (Stripe) - then the request waits for the owner's approval
 *
 * The draft (lib/handyman-draft) survives sign-in, Stripe and back, a refresh
 * and a failed payment. Every money rule is the server's: one checkout per
 * press (clientRequestId), the slot held while paying, no second membership for
 * a home, the member seven-day lead time.
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
function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
function sameAddress(a: { line1?: string; zip?: string }, b: { line1?: string; zip?: string }) {
  const norm = (v?: string) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a.line1) === norm(b.line1) && norm(a.zip) === norm(b.zip);
}

export default function HandymanBooker() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, refreshUser } = useAuth();
  const { ensureContact, contactSheet } = useContactCompletion();

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<HandymanDraft>(EMPTY_HANDYMAN_DRAFT);
  const [photos, setPhotos] = useState<File[]>([]);
  const [typedAddress, setTypedAddress] = useState<AddressValue | null>(null);
  const [area, setArea] = useState<ServiceAreaState>("unknown");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [choice, setChoice] = useState<Choice>("");
  const [plan, setPlan] = useState("basic");
  const [price, setPrice] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ tone: "info" | "warn" | "ok"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { when: string }>(null);
  const [memberLead, setMemberLead] = useState(false);
  const pressing = useRef(false);
  const resumed = useRef(false);

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
        if (saved.address) {
          setTypedAddress({ ...saved.address, unit: saved.address.unit || "", placeId: saved.address.placeId || "", lat: saved.address.lat ?? null, lng: saved.address.lng ?? null, formatted: [saved.address.line1, saved.address.city, saved.address.state, saved.address.zip].filter(Boolean).join(", "), verified: Boolean(saved.address.placeId) });
          setUseNewAddress(true);
        }
      }
      setPhotos(savedPhotos);
      setReady(true);
      trackEvent("handyman_booking_viewed", { resumed: Boolean(saved) });
    })();
    getOneTimeVisitConfig()
      .then((c) => alive && setPrice(c.enabled ? Math.round(c.priceCents / 100) : null))
      .catch(() => alive && setPrice(99));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ready) void saveHandymanPhotos(photos);
    if (ready) saveHandymanDraft({ photoCount: photos.length });
  }, [photos, ready]);

  const homes = useMemo(() => user?.addresses || [], [user]);
  const selectedHome = homes.find((h) => h._id === draft.addressId) || null;
  const isMemberHome = Boolean(selectedHome?.hasActiveSubscription);
  const earliestMember = addDays(todayNY(), MEMBER_LEAD_DAYS);

  /* Where to start once we know who they are. */
  useEffect(() => {
    if (!ready || isLoading || resumed.current) return;
    resumed.current = true;
    const canceled = params.get("canceled");
    const resume = params.get("resume");
    if (params.get("from") === "free-visit") setBanner({ tone: "info", text: "Your details came with you. Tell us what needs doing." });
    if (canceled === "1") {
      const id = params.get("booking_id") || draft.pendingBookingId;
      if (id && user) API.post(`/api/bookings/one-time/${id}/abandon`).catch(() => undefined);
      update({ pendingBookingId: "", clientRequestId: "" });
      setBanner({ tone: "warn", text: "Checkout canceled. Nothing was charged, and your details are saved." });
    }
    if (canceled === "membership") setBanner({ tone: "warn", text: "Membership checkout canceled. Nothing was charged." });
    const hasJob = words(draft.task) >= 3 && (draft.addressId || draft.address);
    const hasTime = Boolean(draft.date && draft.time);
    if (user && hasJob && hasTime) setStep(4);
    else if (hasJob) setStep(hasTime ? 3 : 2);
    if (resume === "membership" && user) {
      void finishAfterMembership();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isLoading]);

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
      if (!typedAddress?.line1 || !typedAddress.city || !typedAddress.zip) found.address = "Please enter the service address.";
      else if (area === "outside") found.address = "We serve Nassau and Suffolk counties. That address is outside our area for now.";
    } else if (!draft.addressId) found.address = "Choose the home for this visit.";
    setErrors(found);
    if (Object.keys(found).length) return;
    if (typed && typedAddress) {
      update({ address: { line1: typedAddress.line1, unit: typedAddress.unit, city: typedAddress.city, state: typedAddress.state || "NY", zip: typedAddress.zip, placeId: typedAddress.placeId, lat: typedAddress.lat, lng: typedAddress.lng }, addressId: "" });
    }
    trackEvent("handyman_job_described", { photos: photos.length });
    setStep(2);
  };

  const goStep3 = () => {
    if (!draft.date || !draft.time) {
      setErrors({ when: "Pick a day and a time." });
      return;
    }
    if (memberLead && draft.date < earliestMember) {
      setErrors({ when: "Member visits are booked at least 7 days ahead. Pick a later day." });
      return;
    }
    setErrors({});
    trackEvent("handyman_time_selected", {});
    setStep(user ? 4 : 3);
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
    });
    trackEvent("member_visit_booked", { source: "book_a_handyman" });
    await clearHandymanDraft();
    setDone({ when: formatWhen(draft.date, draft.time) });
    return res;
  };

  /* Back from a membership checkout: book the visit they described. */
  const finishAfterMembership = async () => {
    setBusy(true);
    try {
      const fresh = await refreshUser();
      const saved = loadHandymanDraft();
      if (!saved || !fresh) return;
      const home = (fresh.addresses || []).find((h) => h._id === saved.addressId);
      if (!home?.hasActiveSubscription) {
        setBanner({ tone: "info", text: "Your membership is being set up. Give it a moment, then press Book my visit." });
        setChoice("member");
        setStep(4);
        return;
      }
      if (!saved.date || saved.date < earliestMember) {
        setMemberLead(true);
        update({ time: "" });
        setBanner({ tone: "ok", text: "Welcome to Profixter! Member visits are booked at least 7 days ahead - pick a time below." });
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

  const submit = async () => {
    if (pressing.current || !choice) return;
    pressing.current = true;
    setBusy(true);
    setBanner(null);
    try {
      if (!(await ensureContact())) return;
      const addressId = await resolveAddressId();
      if (!addressId) {
        setStep(1);
        setErrors({ address: "Please enter the service address." });
        return;
      }
      const clientRequestId = draft.clientRequestId || newClientRequestId();
      update({ clientRequestId, choice, plan });
      trackEvent("handyman_option_selected", { choice, plan: choice === "membership" ? plan : undefined });

      if (choice === "member") {
        if (draft.date < earliestMember) {
          setMemberLead(true);
          update({ time: "" });
          setBanner({ tone: "info", text: "Member visits are booked at least 7 days ahead. Pick a later time." });
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
        });
        update({ pendingBookingId: res.bookingId });
        window.location.assign(res.url);
        return;
      }

      // Membership: the visit is booked when they come back, as a member.
      trackInitiateCheckout({ content_name: `membership_${plan}`, currency: "USD" });
      const res = await API.post("/api/stripe/checkout/create-checkout-session", { plan, addressId, billingCycle: "monthly", returnTo: "handyman" });
      window.location.assign(res.data.url);
    } catch (error) {
      const f = failure(error, "Something went wrong. Please try again.");
      if (f.code === "SLOT_UNAVAILABLE") {
        update({ time: "", clientRequestId: "" });
        setErrors({ when: "That time was just taken. Pick another - everything else is saved." });
        setStep(2);
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

  if (!ready) return <div className="bk" style={{ minHeight: 420 }} aria-busy="true" />;

  if (done) {
    return (
      <div className="bk" data-handyman-done>
        <div className="bk-card bk-done">
          <div className="bk-done-icon" aria-hidden="true">✓</div>
          <h1 className="bk-title">Visit requested</h1>
          <p className="bk-lede">
            We have your request for <b>{done.when}</b>. We&apos;ll review it and confirm your appointment shortly.
          </p>
          <div className="bk-actions">
            <Link className="bk-btn bk-btn--primary bk-btn--block" href="/account">See my visits</Link>
          </div>
        </div>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <p className="bk-error">{errors[k]}</p> : null);
  const typedMode = !user || useNewAddress || !homes.length;
  const addressLine = selectedHome
    ? [selectedHome.line1, selectedHome.city, selectedHome.zip].filter(Boolean).join(", ")
    : draft.address
      ? [draft.address.line1, draft.address.city, draft.address.zip].filter(Boolean).join(", ")
      : "";

  return (
    <div className="bk" data-handyman-booker data-step={step}>
      <header className="bk-head">
        <span className="bk-eyebrow">Book a Handyman</span>
        <h1 className="bk-title">
          {step === 1 ? "What needs doing?" : step === 2 ? "When works for you?" : step === 3 ? "Almost there" : "How would you like to book?"}
        </h1>
      </header>
      <div className="bk-steps" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => <span key={n} data-on={step >= n ? "1" : "0"} />)}
      </div>
      {banner && <div className={`bk-banner bk-banner--${banner.tone}`} role="status">{banner.text}</div>}

      {step === 1 && (
        <section className="bk-card">
          <label className="bk-field" data-error={errors.task ? "1" : undefined}>
            <span className="bk-label">Describe the job</span>
            <textarea className="bk-textarea" name="task" value={draft.task} onChange={(e) => update({ task: e.target.value })} placeholder="e.g. Mount a 55&quot; TV on drywall and hide the cables" maxLength={1200} />
            {err("task")}
          </label>
          <div className="bk-field" data-error={errors.address ? "1" : undefined}>
            <span className="bk-label">Service address</span>
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
                <AddressField value={typedAddress} onChange={setTypedAddress} onServiceArea={setArea} />
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
          {memberLead && <p className="bk-note" style={{ marginBottom: 10 }}>Member visits start 7 days out.</p>}
          <SlotPicker date={draft.date} time={draft.time} onChange={(w) => update({ date: w.date, time: w.time })} visit={memberLead ? "membership" : undefined} />
          {err("when")}
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={goStep3} data-action="to-step-3">Continue</button>
            <button type="button" className="bk-link" onClick={() => setStep(1)}>Back</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="bk-card" data-auth-step>
          <div className="bk-summary" style={{ marginBottom: 16 }}>
            <span><b>{formatWhen(draft.date, draft.time)}</b></span>
            <span>{addressLine}</span>
          </div>
          <p className="bk-lede" style={{ marginTop: 0 }}>Sign in or create your account to choose how to book. Your details are saved.</p>
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={() => signIn("signup")} data-action="create-account">Create account</button>
            <button type="button" className="bk-btn bk-btn--block" onClick={() => signIn("signin")} data-action="sign-in">I have an account</button>
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
                <button type="button" className="bk-option" aria-pressed={choice === "membership"} onClick={() => setChoice("membership")} data-option="membership">
                  <div className="bk-option-top">
                    <span className="bk-option-name">Membership</span>
                    <span className="bk-option-price">from $149<small>/mo</small></span>
                  </div>
                  <p>Handyman visits as often as you need, all year. Best if you have more than one job. Member visits are booked 7+ days ahead.</p>
                </button>
                {choice === "membership" && (
                  <div className="bk-plans" role="radiogroup" aria-label="Plan">
                    {PLAN_DETAILS.map((p) => (
                      <button key={p.id} type="button" role="radio" className="bk-plan" aria-checked={plan === p.id} data-plan={p.id} onClick={() => setPlan(p.id)}>
                        <b>{p.name}</b>
                        <span>${p.price}/mo · {p.id === "basic" ? "1 visit at a time" : "2 visits at a time"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {choice === "membership" && (
                  <p className="bk-note" style={{ marginTop: 10 }}>
                    Monthly billing, cancel anytime. Prefer yearly? <Link href="/membership/plans">See all plans</Link>.
                  </p>
                )}
              </>
            )}
            <p className="bk-note" style={{ marginTop: 14 }}>
              Need a whole day? <Link href="/book?visit=full-day">Book a Full Day</Link>
            </p>
          </section>
          <div className="bk-actions">
            <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={submit} disabled={!choice || busy} data-action="book-handyman">
              {busy ? <span className="bk-spinner" aria-hidden="true" /> : null}
              {choice === "member" ? "Book my visit" : choice === "one_time" ? `Continue to payment${price != null ? ` · $${price}` : ""}` : choice === "membership" ? "Continue to membership checkout" : "Choose an option"}
            </button>
            <p className="bk-note" style={{ textAlign: "center" }}>
              {choice === "member"
                ? "We'll confirm your appointment after we review it."
                : "Secure payment by Stripe. We'll confirm your appointment after we review it."}
            </p>
          </div>
        </>
      )}
      {contactSheet}
    </div>
  );
}
