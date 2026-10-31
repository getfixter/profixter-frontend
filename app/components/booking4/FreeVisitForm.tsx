"use client";

import "./booking4.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddressField, { type AddressValue, type ServiceAreaState } from "@/app/components/address/AddressField";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import { getAttribution, getFbCookies, newEventId, trackLead } from "@/lib/meta";
import { BUSINESS_PHONE_DISPLAY } from "@/lib/seo";
import { saveHandymanDraft, saveHandymanPhotos } from "@/lib/handyman-draft";
import SlotPicker, { formatWhen } from "./SlotPicker";
import PhotoPicker from "./PhotoPicker";

/*
 * The Free Visit (from 2026-10-30): a free visit to go over the customer's
 * to-do list and help them find the right service. No labor. No account.
 *
 * Name, phone, email, address, a day and a time - that is all it asks for;
 * a note and photos are optional. Pressing Request opens a short sheet that
 * says plainly what the visit is, with the two real choices: confirm it, or
 * book a handyman instead (everything typed carries over).
 *
 * The server (routes/freeVisitRequests.js, formVersion "cx4") reserves the slot
 * as a booking pending the owner's approval; nothing here calls it confirmed.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
/* Must match routes/freeVisitRequests.js exactly: it is the consent the confirmation text is sent on. */
const CONTACT_CONSENT_TEXT = "By booking, you agree to be contacted by call or text about your visit. Msg & data rates may apply.";
const PHONE_HREF = `tel:+1${BUSINESS_PHONE_DISPLAY.replace(/\D/g, "")}`;

type Errors = Partial<Record<"name" | "phone" | "email" | "address" | "when" | "form", string>>;

/* What was typed survives Back, a reload or a detour (photos do not: they stay in memory). */
const DRAFT_KEY = "pf_free_visit_draft";
type Draft = { name: string; phone: string; email: string; address: AddressValue | null; note: string; date: string; time: string };
function readDraft(): Partial<Draft> | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}
function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private mode: nothing to keep */
  }
}
/* Keyboard "Next": name -> phone -> email -> address. */
const FIELD_ORDER = ["name", "phone", "email", "address"] as const;
type FieldKey = (typeof FIELD_ORDER)[number];
function focusField(root: HTMLElement | null, key: FieldKey) {
  const el = root?.querySelector<HTMLInputElement>(key === "address" ? "[data-address-field] input:not([type=hidden])" : `input[name="${key}"]`);
  el?.focus();
}

function phoneDigits(value: string) {
  const d = value.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}
function urlParamsNow() {
  try {
    return Object.fromEntries(new URLSearchParams(window.location.search).entries());
  } catch {
    return {};
  }
}

export default function FreeVisitForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<AddressValue | null>(null);
  const [area, setArea] = useState<ServiceAreaState>("unknown");
  const [when, setWhen] = useState({ date: "", time: "" });
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState(false);
  const [phase, setPhase] = useState<"edit" | "submitting" | "done">("edit");
  const [callback, setCallback] = useState<"idle" | "asking" | "sending" | "sent">("idle");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [more, setMore] = useState(false);
  const [restored, setRestored] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const draftReady = useRef(false);
  const eventId = useRef("");
  const submitting = useRef(false);
  const started = useRef(false);

  // Signed in: what we already know is filled in, never asked again.
  useEffect(() => {
    if (!user) return;
    setName((v) => v || String(user.name || ""));
    setEmail((v) => v || String(user.email || ""));
    setPhone((v) => v || String(user.phone || "").replace(/^\+1/, ""));
  }, [user]);

  // Bring back what was typed before (Back, reload, a detour to sign in).
  useEffect(() => {
    const d = readDraft();
    if (d) {
      if (d.name) setName((v) => v || d.name || "");
      if (d.phone) setPhone((v) => v || d.phone || "");
      if (d.email) setEmail((v) => v || d.email || "");
      if (d.address?.line1) {
        setAddress(d.address);
        setRestored((n) => n + 1);
      }
      if (d.note) {
        setNote(d.note);
        setMore(true);
      }
      if (d.date) setWhen({ date: d.date, time: d.time || "" });
    }
    draftReady.current = true;
  }, []);

  useEffect(() => {
    if (!draftReady.current || phase === "done") return;
    const empty = !name && !phone && !email && !address && !note && !when.date;
    writeDraft(empty ? null : { name, phone, email, address, note, date: when.date, time: when.time });
  }, [name, phone, email, address, note, when, phase]);

  const nextOnEnter = (key: FieldKey) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const next = FIELD_ORDER[FIELD_ORDER.indexOf(key) + 1];
    if (next) focusField(rootRef.current, next);
  };

  const markStarted = () => {
    if (started.current) return;
    started.current = true;
    trackEvent("free_visit_flow_started", { placement: "free_visit_form" });
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (name.trim().length < 2 || !/\s/.test(name.trim())) next.name = "Enter your first and last name.";
    if (phoneDigits(phone).length !== 10) next.phone = "Enter a 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email.";
    if (!address?.line1 || !address.city || !address.zip) next.address = "Choose your address from the list.";
    else if (area === "outside") next.address = "We serve Nassau and Suffolk counties only, for now.";
    if (!when.date || !when.time) next.when = "Pick a day and a time.";
    return next;
  };

  const review = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      const first = FIELD_ORDER.find((k) => found[k]);
      if (first) focusField(rootRef.current, first);
      rootRef.current?.querySelector("[data-error='1']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    trackEvent("free_visit_review_opened", {});
    setSheet(true);
  };

  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setPhase("submitting");
    if (!eventId.current) eventId.current = newEventId();
    try {
      const form = new FormData();
      const { fbp, fbc } = getFbCookies();
      const fields: Record<string, string> = {
        formVersion: "cx4",
        name: name.trim(),
        phone: phoneDigits(phone),
        email: email.trim(),
        note: note.trim(),
        line1: address?.line1 || "",
        unit: address?.unit || "",
        city: address?.city || "",
        state: address?.state || "NY",
        zip: address?.zip || "",
        lat: address?.lat != null ? String(address.lat) : "",
        lng: address?.lng != null ? String(address.lng) : "",
        requestedDate: when.date,
        requestedTime: when.time,
        consentText: CONTACT_CONSENT_TEXT,
        eventId: eventId.current,
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
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; code?: string; field?: string; message?: string };
      if (res.ok && body.success) {
        // Once, after the server saved it, with the event id the server used for its own Lead.
        trackLead({ content_name: "free_first_visit", status: "free_visit_requested", lead_type: "free_visit_request" }, { eventId: eventId.current, relay: false });
        eventId.current = "";
        writeDraft(null);
        setSheet(false);
        setPhase("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSheet(false);
      setPhase("edit");
      if (body.code === "SLOT_UNAVAILABLE" || body.code === "DATE_UNAVAILABLE") {
        setWhen((w) => ({ ...w, time: "" }));
        setErrors({ when: body.message || "That time was just taken. Pick another - everything else is saved." });
      } else if (body.field === "address" || body.code === "OUT_OF_SERVICE_AREA" || body.code === "INVALID_ADDRESS") {
        setErrors({ address: body.message });
      } else if (body.field === "name" || body.field === "phone" || body.field === "email") {
        setErrors({ [body.field]: body.message } as Errors);
      } else {
        setErrors({ form: body.message || "Something went wrong. Please try again, or call us." });
      }
    } catch {
      setSheet(false);
      setPhase("edit");
      setErrors({ form: "We couldn't reach Profixter. Check your connection and try again." });
    } finally {
      submitting.current = false;
    }
  };

  /* "I Need a Handyman Instead": everything typed goes with them. */
  const switchToHandyman = async () => {
    trackEvent("free_visit_switched_to_handyman", {});
    saveHandymanDraft({
      task: note.trim(),
      address: address?.line1 ? { line1: address.line1, unit: address.unit, city: address.city, state: address.state || "NY", zip: address.zip, placeId: address.placeId, lat: address.lat, lng: address.lng } : null,
      date: when.date,
      time: when.time,
      // They reviewed this time on the confirmation sheet and chose to go on with it.
      timeConfirmed: Boolean(when.date && when.time),
      name: name.trim(),
      phone: phoneDigits(phone),
      email: email.trim(),
      photoCount: photos.length,
      clientRequestId: "",
      choice: "",
    });
    await saveHandymanPhotos(photos);
    router.push("/book/handyman?from=free-visit");
  };

  const requestCallback = async () => {
    const digits = phoneDigits(callbackPhone || phone);
    if (digits.length !== 10) {
      setCallback("asking");
      return;
    }
    setCallback("sending");
    try {
      const res = await fetch(`${API_BASE}/api/requests/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Website visitor",
          phone: digits,
          email: email.trim(),
          requestedDate: when.date,
          requestedTime: when.time,
          address: address?.line1 ? [address.line1, address.city, address.state, address.zip].filter(Boolean).join(", ") : "",
          note: note.trim(),
          sourcePage: window.location.pathname,
        }),
      });
      if (res.ok) {
        trackEvent("free_visit_callback_requested", {});
        setCallback("sent");
      } else setCallback("asking");
    } catch {
      setCallback("asking");
    }
  };

  if (phase === "done") {
    return (
      <div className="bk" data-free-visit-done>
        <div className="bk-card bk-done">
          <div className="bk-done-icon" aria-hidden="true">✓</div>
          <h1 className="bk-title">Request received</h1>
          <p className="bk-lede">
            We&apos;ve reserved <b>{formatWhen(when.date, when.time)}</b> for your Free Visit. A Profixter team member will confirm it with you shortly.
          </p>
          <p className="bk-note" style={{ marginTop: 12 }}>The details are on their way to your email and phone.</p>
          <div className="bk-actions">
            <Link className="bk-btn" href="/">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  const err = (k: keyof Errors) => (errors[k] ? <p className="bk-error" id={`fv-${k}-error`} role="alert">{errors[k]}</p> : null);
  const fieldProps = (key: "name" | "phone" | "email") => ({
    name: key,
    className: "bk-input bk-input--float",
    placeholder: " ",
    enterKeyHint: "next" as const,
    onKeyDown: nextOnEnter(key),
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `fv-${key}-error` : undefined,
  });

  return (
    <div className="bk bk--free" data-free-visit-form onFocusCapture={markStarted} ref={rootRef}>
      <header className="bk-head">
        <span className="bk-eyebrow">Free · No account needed</span>
        <h1 className="bk-title">Let&apos;s look at your to-do list</h1>
        <p className="bk-lede">We visit, go over what you need and recommend the right service.</p>
      </header>

      {errors.form && <div className="bk-banner bk-banner--warn">{errors.form}</div>}

      {/* Enter never submits by surprise: only the Request button opens the review. */}
      <form className="bk-card" aria-label="Free Visit request" noValidate onSubmit={(e) => e.preventDefault()}>
        <div className="bk-row bk-row--pair">
          <label className="bk-field bk-float" data-error={errors.name ? "1" : undefined}>
            <input {...fieldProps("name")} autoComplete="name" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} />
            <span className="bk-float-label">Full name</span>
            {err("name")}
          </label>
          <label className="bk-field bk-float" data-error={errors.phone ? "1" : undefined}>
            <input {...fieldProps("phone")} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <span className="bk-float-label">Mobile phone</span>
            {err("phone")}
          </label>
        </div>
        <label className="bk-field bk-float" data-error={errors.email ? "1" : undefined}>
          <input {...fieldProps("email")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="bk-float-label">Email</span>
          {err("email")}
        </label>
        <div className="bk-field" data-error={errors.address ? "1" : undefined} data-address-field>
          <AddressField key={restored} value={address} onChange={setAddress} onServiceArea={setArea} placeholder="Service address" />
          {err("address")}
        </div>

        <div className="bk-when" role="group" aria-label="Day and time" data-error={errors.when ? "1" : undefined}>
          <span className="bk-label">When works for you?</span>
          <SlotPicker date={when.date} time={when.time} onChange={setWhen} />
          {err("when")}
        </div>

        {more ? (
          <div className="bk-optional" data-optional-open>
            <label className="bk-field">
              <span className="bk-label">
                What&apos;s on your list? <small>(optional)</small>
              </span>
              <textarea className="bk-textarea" name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. a dripping faucet, a door that sticks, shelves to hang" maxLength={1200} />
            </label>
            <PhotoPicker photos={photos} onChange={setPhotos} />
          </div>
        ) : (
          <button type="button" className="bk-more" onClick={() => setMore(true)} aria-expanded={false} data-action="add-details">
            <span aria-hidden="true">+</span> Add a note or photos <small>(optional)</small>
          </button>
        )}
      </form>

      <div className="bk-actions">
        <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={review} data-action="review-free-visit">
          Request my Free Visit
        </button>
        <p className="bk-fine">{CONTACT_CONSENT_TEXT}</p>
      </div>

      {sheet && (
        <div className="bk-sheet-backdrop" onClick={() => phase !== "submitting" && setSheet(false)}>
          <div className="bk-sheet" role="dialog" aria-modal="true" aria-labelledby="fv-sheet-title" onClick={(e) => e.stopPropagation()} data-free-visit-sheet>
            <h2 id="fv-sheet-title">Let&apos;s make sure we&apos;re the right fit</h2>
            <p>
              We&apos;ll come by on <b>{formatWhen(when.date, when.time)}</b>, go over your to-do list, and help you choose the right service. Repairs and labor
              aren&apos;t included in the Free Visit.
            </p>
            <div className="bk-actions">
              <button type="button" className="bk-btn bk-btn--primary bk-btn--block" onClick={confirm} disabled={phase === "submitting"} data-action="confirm-free-visit">
                {phase === "submitting" ? <span className="bk-spinner" aria-hidden="true" /> : null}
                Confirm My Free Visit
              </button>
              <button type="button" className="bk-btn bk-btn--block" onClick={switchToHandyman} disabled={phase === "submitting"} data-action="need-handyman">
                I Need a Handyman Instead
              </button>
            </div>
            <div className="bk-sheet-q">
              Have questions?
              {callback === "sent" ? (
                <div role="status" data-callback-sent>We&apos;ll call you shortly.</div>
              ) : callback === "asking" ? (
                <div style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <input className="bk-input" type="tel" inputMode="tel" placeholder="Your phone number" value={callbackPhone} onChange={(e) => setCallbackPhone(e.target.value)} data-input="callback-phone" />
                  <button type="button" className="bk-btn" onClick={requestCallback}>Call me back</button>
                </div>
              ) : (
                <div>
                  <a className="bk-link" href={PHONE_HREF} data-action="call-us">Call Us</a>
                  <button type="button" className="bk-link" onClick={requestCallback} disabled={callback === "sending"} data-action="request-callback">
                    {callback === "sending" ? "Sending…" : "Request a Callback"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
