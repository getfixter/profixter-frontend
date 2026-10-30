"use client";

/**
 * The homepage free-visit request, reviewed after calling the customer.
 *
 * Opened from Admin > Jobs (the pending visit on the calendar) and from Admin >
 * Leads (its lead): it is the same visit either way. Shows what they sent, the
 * lifetime free-visit check, and the fields the call fills in - the service
 * address above all, which Confirm Visit requires. Confirming keeps the same
 * booking and reserved slot and sends the normal confirmation once; declining
 * frees the slot and does not use up their free visit. All of that is the
 * server's (routes/adminFreeVisits); this only collects and shows.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  confirmFreeVisit,
  declineFreeVisit,
  getFreeVisit,
  saveFreeVisit,
  type FreeVisitDetail,
  type FreeVisitEligibility,
} from "@/lib/admin-service";
import { getTimeSlots } from "@/lib/booking-service";

type Props = {
  bookingId: string;
  onClose: () => void;
  /** After a save, confirm or decline: the parent refreshes its lists. */
  onChanged?: (message: string) => void;
};

type Form = {
  name: string;
  phone: string;
  email: string;
  line1: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  note: string;
  adminNote: string;
  date: string;
  time: string;
};

const REASON_LABEL: Record<string, string> = {
  same_phone_different_email: "Same phone as an earlier free visit, different email (could be a reused number)",
  same_address_different_person: "Same address as an earlier free visit, different person (shared house or new owner?)",
  completed_free_visit: "This customer already had their free visit",
  free_visit_already_booked: "This customer already has a free visit booked or requested",
};

function errorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
}

function errorEligibility(err: unknown): FreeVisitEligibility | null {
  const e = err as { response?: { data?: { eligibility?: FreeVisitEligibility } } };
  return e?.response?.data?.eligibility || null;
}

function time12(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function longDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/* "12 Main St, Unit 2" -> line1 + unit, the shape the form edits. */
function splitUnit(address: string) {
  const match = /^(.*?),\s*(?:unit|apt|apartment|suite|ste|#)\s*(.+)$/i.exec(address || "");
  return match ? { line1: match[1], unit: match[2] } : { line1: address || "", unit: "" };
}

function formFrom(detail: FreeVisitDetail): Form {
  const b = detail.booking;
  const { line1, unit } = splitUnit(b.address);
  return {
    name: b.name || "",
    phone: b.phone || "",
    email: b.email || "",
    line1,
    unit,
    city: b.city || "",
    state: b.state || "NY",
    zip: b.zip || "",
    note: b.note || "",
    adminNote: b.adminNote || "",
    date: b.requestedDate,
    time: b.requestedTime,
  };
}

function imageUrl(img: string | { key: string; url: string }) {
  return typeof img === "string" ? img : img.url;
}

export default function FreeVisitReviewPanel({ bookingId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<FreeVisitDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [busy, setBusy] = useState<"" | "load" | "save" | "confirm" | "decline">("load");
  const [error, setError] = useState("");
  const [blockedBy, setBlockedBy] = useState<FreeVisitEligibility | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const apply = useCallback((next: FreeVisitDetail) => {
    setDetail(next);
    const f = formFrom(next);
    setForm(f);
    setSaved(f);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy("load");
    getFreeVisit(bookingId)
      .then((d) => !cancelled && apply(d))
      .catch((e) => !cancelled && setError(errorMessage(e, "Could not load this request.")))
      .finally(() => !cancelled && setBusy(""));
    return () => {
      cancelled = true;
    };
  }, [bookingId, apply]);

  /* Times for the chosen day, from the same public calendar customers use. */
  useEffect(() => {
    if (!form?.date) return;
    let cancelled = false;
    getTimeSlots(form.date)
      .then((day) => {
        if (cancelled) return;
        const list = ((day as { candidateSlots?: Array<{ time: string; available: boolean }> }).candidateSlots || []).map((s) => ({
          time: s.time,
          available: s.available,
        }));
        setSlots(list);
      })
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [form?.date]);

  const pending = /^pending confirmation$/i.test(detail?.booking.status || "");
  /* Booked from the customer's own account: contact and address come from it, not from this screen. */
  const online = detail?.booking.channel === "online";
  const missing = detail?.booking.missing || [];
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const eligibility = blockedBy || detail?.eligibility || null;
  const blocked = eligibility?.decision === "blocked";
  const needsAck = eligibility?.decision === "review";
  const addressComplete = !!(form && form.line1.trim() && form.city.trim() && /^\d{5}$/.test(form.zip.trim()));

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const changes = (): Parameters<typeof saveFreeVisit>[1] => {
    if (!form || !saved) return {};
    const out: Parameters<typeof saveFreeVisit>[1] = {};
    if (form.name !== saved.name) out.name = form.name;
    if (form.phone !== saved.phone) out.phone = form.phone;
    if (form.email !== saved.email) out.email = form.email;
    if (form.note !== saved.note) out.note = form.note;
    if (form.adminNote !== saved.adminNote) out.adminNote = form.adminNote;
    if (form.date !== saved.date || form.time !== saved.time) {
      out.date = form.date;
      out.time = form.time;
    }
    if (["line1", "unit", "city", "state", "zip"].some((k) => form[k as keyof Form] !== saved[k as keyof Form])) {
      out.address = { line1: form.line1, unit: form.unit, city: form.city, state: form.state, zip: form.zip };
    }
    return out;
  };

  const save = async (): Promise<boolean> => {
    if (!dirty) return true;
    setBusy("save");
    setError("");
    try {
      apply(await saveFreeVisit(bookingId, changes()));
      setBlockedBy(null);
      onChanged?.("Saved");
      return true;
    } catch (e) {
      setError(errorMessage(e, "Could not save."));
      return false;
    } finally {
      setBusy("");
    }
  };

  const confirm = async () => {
    if (!addressComplete) {
      setError("Add the full service address (street, city, ZIP) before confirming.");
      return;
    }
    if (!(await save())) return;
    setBusy("confirm");
    setError("");
    try {
      const result = await confirmFreeVisit(bookingId, acknowledged);
      apply(result);
      onChanged?.(result.alreadyConfirmed ? "Already confirmed" : online ? "Approved - the customer has been notified" : "Visit confirmed - the customer has been notified");
    } catch (e) {
      const elig = errorEligibility(e);
      if (elig) setBlockedBy(elig);
      setError(errorMessage(e, "Could not confirm."));
    } finally {
      setBusy("");
    }
  };

  const decline = async () => {
    const reason = window.prompt(
      online
        ? "Decline this online booking? Its time goes back on the calendar, their free visit is not used, and they get a cancellation email.\n\nReason (optional):"
        : "Decline this request? Its time goes back on the calendar and their free visit is not used.\n\nReason (optional):",
      ""
    );
    if (reason === null) return;
    setBusy("decline");
    setError("");
    try {
      apply(await declineFreeVisit(bookingId, reason));
      onChanged?.("Request declined - the time is free again");
    } catch (e) {
      setError(errorMessage(e, "Could not decline."));
    } finally {
      setBusy("");
    }
  };

  const input =
    "w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-[16px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 md:text-sm";
  const label = "mb-1 block text-xs font-semibold text-slate-600";
  const disabled = !pending || !!busy;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4" onClick={onClose} data-free-visit-panel>
      <div
        className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Free visit request"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div
              className={`text-[11px] font-bold uppercase tracking-[0.16em] ${online ? "text-blue-700" : "text-amber-700"}`}
              data-free-visit-channel={detail?.booking.channel || ""}
            >
              {!pending ? "Free visit" : online ? "Online booking · awaiting approval" : "Callback needed · awaiting contact"}
            </div>
            <h3 className="truncate text-lg font-bold text-slate-900">
              {detail?.booking.name || "Loading..."}{" "}
              {detail ? <span className="text-sm font-medium text-slate-400">#{detail.booking.bookingNumber}</span> : null}
            </h3>
            {detail ? (
              <span
                className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
                  pending ? "border-dashed border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
                data-free-visit-status
              >
                {detail.booking.status}
                {pending && detail.booking.reserved ? " · slot held" : ""}
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {busy === "load" && !detail ? <p className="text-sm text-slate-500">Loading...</p> : null}

          {detail && form ? (
            <>
              {pending && !online && missing.length ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" data-free-visit-missing>
                  Still needed on the call: {missing.map((m) => (m === "address" ? "service address" : m)).join(", ")}
                </p>
              ) : null}
              {pending && online ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" data-free-visit-online>
                  Booked online from their account, with their own address. Approve it to confirm the visit and notify them.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${detail.booking.phone}`} className="flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                  Call {detail.booking.phone}
                </a>
                <a href={`sms:${detail.booking.phone}`} className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700">
                  Text
                </a>
              </div>

              {/* The lifetime free-visit check */}
              {eligibility ? (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    blocked ? "border-rose-200 bg-rose-50 text-rose-900" : needsAck ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                  data-free-visit-eligibility={eligibility.decision}
                >
                  <div className="font-bold">
                    {blocked ? "Not eligible for a free visit" : needsAck ? "Verify: possible repeat customer" : "Eligible: no earlier free visit found"}
                  </div>
                  {eligibility.reasons.map((r) => (
                    <div key={r} className="mt-1">{REASON_LABEL[r] || r}</div>
                  ))}
                  {eligibility.matches.filter((m) => m.state !== "released").length ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {eligibility.matches
                        .filter((m) => m.state !== "released")
                        .map((m, i) => (
                          <li key={i}>
                            {m.bookingNumber ? `Booking #${m.bookingNumber}` : m.source === "request" ? "Earlier request" : "Account record"} · {m.status}
                            {m.date ? ` · ${new Date(m.date).toLocaleDateString("en-US")}` : ""} · same {m.matchedOn.join(" + ")}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  {needsAck && pending ? (
                    <label className="mt-2 flex items-start gap-2 font-semibold">
                      <input type="checkbox" className="mt-0.5 h-5 w-5" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} data-free-visit-ack />
                      {online ? "I verified this is a different customer" : "I verified on the call this is a different customer"}
                    </label>
                  ) : null}
                </div>
              ) : null}

              <section className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Contact {online ? <span className="normal-case tracking-normal text-slate-500">· from their account (edit in Users)</span> : null}
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div><label className={label}>Full name</label><input className={input} value={form.name} onChange={set("name")} disabled={disabled || online} /></div>
                  <div><label className={label}>Phone</label><input className={input} type="tel" value={form.phone} onChange={set("phone")} disabled={disabled || online} /></div>
                  <div><label className={label}>Email</label><input className={input} type="email" value={form.email} onChange={set("email")} disabled={disabled || online} /></div>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Service address {pending && !detail.booking.hasAddress ? <span className="normal-case tracking-normal text-rose-600">· required to confirm</span> : null}
                </h4>
                <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                  <div><label className={label}>Street address</label><input className={input} value={form.line1} onChange={set("line1")} disabled={disabled || online} placeholder="12 Main St" data-free-visit-field="line1" /></div>
                  <div><label className={label}>Apt / Unit</label><input className={input} value={form.unit} onChange={set("unit")} disabled={disabled || online} data-free-visit-field="unit" /></div>
                </div>
                <div className="grid grid-cols-[1fr_64px_96px] gap-2">
                  <div><label className={label}>City</label><input className={input} value={form.city} onChange={set("city")} disabled={disabled || online} data-free-visit-field="city" /></div>
                  <div><label className={label}>State</label><input className={input} value={form.state} onChange={set("state")} disabled={disabled || online} maxLength={2} /></div>
                  <div><label className={label}>ZIP</label><input className={input} value={form.zip} onChange={set("zip")} disabled={disabled || online} inputMode="numeric" maxLength={5} data-free-visit-field="zip" /></div>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">The job · {detail.booking.service}</h4>
                <textarea className={`${input} min-h-[88px] py-2`} value={form.note} onChange={set("note")} disabled={disabled} />
                {detail.booking.images.length ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.booking.images.map((img, i) => (
                      <a key={i} href={imageUrl(img)} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(img)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No photos{detail.booking.libraryReference ? ` · example chosen: ${detail.booking.libraryReference}` : ""}.</p>
                )}
                <div><label className={label}>Admin note (internal)</label><textarea className={`${input} min-h-[60px] py-2`} value={form.adminNote} onChange={set("adminNote")} disabled={disabled} /></div>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">When</h4>
                <div className="grid grid-cols-[1fr_140px] gap-2">
                  <div><label className={label}>Day</label><input className={input} type="date" value={form.date} onChange={set("date")} disabled={disabled} /></div>
                  <div>
                    <label className={label}>Time</label>
                    <select className={input} value={form.time} onChange={set("time")} disabled={disabled} data-free-visit-field="time">
                      {!slots.some((s) => s.time === form.time) ? <option value={form.time}>{time12(form.time)}</option> : null}
                      {slots.map((s) => (
                        <option key={s.time} value={s.time} disabled={!s.available && !(form.date === saved?.date && s.time === saved?.time)}>
                          {time12(s.time)}
                          {form.date === saved?.date && s.time === saved?.time ? " (held for them)" : !s.available ? " (taken)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {longDate(form.date)} at {time12(form.time)}
                  {detail.booking.assignedFixterName ? ` · ${detail.booking.assignedFixterName}` : ""}
                </p>
              </section>

              {detail.lead ? (
                <section className="space-y-1 text-xs text-slate-600">
                  <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Where they came from</h4>
                  {detail.lead.attribution?.url && Object.keys(detail.lead.attribution.url).length ? (
                    <div className="break-all">{Object.entries(detail.lead.attribution.url).map(([k, v]) => `${k}=${v}`).join(" · ")}</div>
                  ) : (
                    <div>No ad parameters on the page</div>
                  )}
                  {detail.lead.createdAt ? <div>Requested {new Date(detail.lead.createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })}</div> : null}
                </section>
              ) : null}
            </>
          ) : null}

          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" role="alert" data-free-visit-error>{error}</p> : null}
        </div>

        {detail && pending ? (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-200 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
            <button type="button" onClick={() => void decline()} disabled={!!busy} className="min-h-[48px] rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700 disabled:opacity-60" data-free-visit-decline>
              {busy === "decline" ? "..." : "Decline"}
            </button>
            <button type="button" onClick={() => void save()} disabled={!!busy || !dirty} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 disabled:opacity-50" data-free-visit-save>
              {busy === "save" ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!!busy || blocked || (needsAck && !acknowledged)}
              className="min-h-[48px] rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-50"
              data-free-visit-confirm
            >
              {busy === "confirm" ? (online ? "Approving..." : "Confirming...") : online ? "Approve" : "Confirm Visit"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
