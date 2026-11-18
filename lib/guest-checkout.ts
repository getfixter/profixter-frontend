"use client";

/**
 * Paying for a visit with no account (BackEnd routes/guestBookings.js).
 *
 * One-Time Visit and Full Day only. A membership belongs to an account, so it
 * still asks for one - after the visit is described and the time chosen, never
 * before. The server holds the slot, opens Stripe, and keeps the owner's review:
 * a paid visit waits for approval exactly like a signed-in customer's.
 *
 * Plain fetch, not the API client: these calls are public, and the client's
 * "signed out -> sign in" handling must never send a guest to /signin.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/* Word for word what the server stores (GUEST_CHECKOUT_CONSENT_TEXT); it refuses any other text. */
export const GUEST_CHECKOUT_CONSENT_TEXT =
  "By booking, you agree that ProFixter may call or text you about this visit. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help.";

export type GuestContact = { name: string; phone: string; email: string };
export type GuestAddress = { line1: string; unit?: string; city: string; state: string; zip: string; lat?: number | null; lng?: number | null };

export type GuestCheckoutResult =
  | { url: string; bookingId: string; holdExpiresAt?: string; reused?: boolean }
  | { alreadyPaid: true; bookingId: string; sessionId: string | null };

export class GuestCheckoutError extends Error {
  code: string;
  field?: string;
  status: number;
  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function formFor(fields: Record<string, string | number | null | undefined>, photos: File[]) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== "") form.append(k, String(v));
  for (const file of photos) form.append("images", file, file.name || "photo.jpg");
  return form;
}

async function post(path: string, form: FormData): Promise<GuestCheckoutResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: "POST", body: form });
  } catch {
    throw new GuestCheckoutError(0, "NETWORK", "We couldn't reach Profixter. Check your connection and try again - everything you entered is saved.");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new GuestCheckoutError(res.status, String(body.code || "ERROR"), String(body.message || "Something went wrong. Please try again."), body.field ? String(body.field) : undefined);
  }
  return body as unknown as GuestCheckoutResult;
}

type Common = {
  contact: GuestContact;
  address: GuestAddress;
  note: string;
  photos: File[];
  clientRequestId: string;
  tracking: { fbp: string; fbc: string; sourceUrl: string };
};

export function guestOneTimeCheckout(input: Common & { selectedTask: string; requestedDate: string; requestedTime: string; holdToken?: string }) {
  return post(
    "/api/bookings/guest/one-time/checkout",
    formFor(
      {
        ...input.contact,
        ...input.address,
        note: input.note,
        selectedTask: input.selectedTask,
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime,
        holdToken: input.holdToken,
        clientRequestId: input.clientRequestId,
        consentText: GUEST_CHECKOUT_CONSENT_TEXT,
        ...input.tracking,
      },
      input.photos
    )
  );
}

export function guestFullDayCheckout(input: Common & { date: string; libraryReference?: string }) {
  return post(
    "/api/bookings/guest/full-day/checkout",
    formFor(
      {
        ...input.contact,
        ...input.address,
        note: input.note,
        date: input.date,
        libraryReference: input.libraryReference,
        clientRequestId: input.clientRequestId,
        consentText: GUEST_CHECKOUT_CONSENT_TEXT,
        ...input.tracking,
      },
      input.photos
    )
  );
}

/* Back from Stripe without paying: let the held time go now (proved by the press's own id). */
export function abandonGuestCheckout(bookingId: string, clientRequestId: string) {
  if (!bookingId || !clientRequestId) return Promise.resolve();
  return fetch(`${API_BASE}/api/bookings/guest/abandon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, clientRequestId }),
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
}

export type CheckoutStatus = {
  kind: "one_time" | "full_day" | "other";
  status: "awaiting_payment" | "payment_processing" | "pending_approval" | "confirmed" | "not_completed" | "canceled";
  bookingNumber: string;
  date: string;
  time: string | null;
  guest: boolean;
};

/* Where a paid visit stands, by the Stripe session it came back with. Null when the server cannot say. */
export async function getCheckoutStatus(sessionId: string): Promise<CheckoutStatus | null> {
  if (!/^cs_(live|test)_[A-Za-z0-9_]{6,200}$/.test(sessionId)) return null;
  try {
    const res = await fetch(`${API_BASE}/api/bookings/guest/status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return readStatus(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

const KINDS = new Set(["one_time", "full_day", "other"]);
const STATUSES = new Set(["awaiting_payment", "payment_processing", "pending_approval", "confirmed", "not_completed", "canceled"]);

/* Only a well-formed answer is shown; anything else (a proxy page, an old server) reads as "cannot say". */
function readStatus(raw: unknown): CheckoutStatus | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!KINDS.has(String(r.kind)) || !STATUSES.has(String(r.status))) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || ""))) return null;
  const time = r.time == null ? null : /^\d{2}:\d{2}$/.test(String(r.time)) ? String(r.time) : null;
  return {
    kind: r.kind as CheckoutStatus["kind"],
    status: r.status as CheckoutStatus["status"],
    bookingNumber: String(r.bookingNumber || ""),
    date: String(r.date),
    time,
    guest: Boolean(r.guest),
  };
}
