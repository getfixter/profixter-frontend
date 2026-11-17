"use client";

/**
 * ChatGPT Ads conversions - one module, called only after the server has
 * confirmed the action.
 *
 * The pixel is loaded once in the root layout (OAIQ_LOADER_SCRIPT in
 * lib/chatgpt-ads-config.ts), which also sends the first page_viewed. Every
 * other event goes through here:
 *
 *   page_viewed            ChatGPTPageView, on each client-side route change
 *   lead_created           a free-visit request/booking or a contact/estimate
 *                          form the server saved
 *   registration_completed a NEW account (not a sign-in)
 *   subscription_created   a paid, ACTIVE membership, proven by the server
 *                          (GET /api/track/membership-by-session)
 *   order_created          a paid One-Time Visit or Full Day, proven by the
 *                          server (GET /api/track/paid-visit-by-session)
 *
 * Shapes follow https://learn.chatgpt.com/ads/supported-events: amounts are
 * integers in cents, always with currency.
 *
 * WHEN IT DOES NOTHING. On an excluded page (admin, token pages, kiosk), and
 * for a browser sending Global Privacy Control: the loader does not run, so
 * window.oaiq does not exist and every function here returns without effect.
 *
 * DUPLICATES. Every conversion carries a deterministic event_id (the Stripe
 * session, the booking, the account, the id the server used for its own Meta
 * event), which ChatGPT Ads deduplicates on - first one wins. Two guards sit
 * in front of that:
 *  - in this page: an id is handed to the pixel at most once (repeated clicks,
 *    re-renders, a callback that fires twice);
 *  - across reloads and tabs: an id is remembered in localStorage ONLY once
 *    the SDK has actually loaded and taken it. An event that could only be
 *    queued - SDK blocked, offline, page closed before it loaded - is not
 *    remembered, so the next time the same confirmed action is shown (say, a
 *    reload of the confirmation page) it is sent again under the same id and
 *    ChatGPT keeps one.
 *
 * NOTHING HERE MAY THROW.
 */
import { isOaiqExcluded } from "./chatgpt-ads-config";

type Content = { id: string; name?: string; content_type?: string; quantity?: number; amount?: number; currency?: string };

type OaiqFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    oaiq?: OaiqFn;
    /** Set by the ChatGPT pixel loader in app/layout.tsx when it actually ran. */
    __pfOaiq?: number;
    /** The SDK file loaded (it now owns the queue). */
    __pfOaiqReady?: number;
    /** The SDK file failed to load. */
    __pfOaiqFailed?: number;
    /** Callbacks the loader runs once the SDK has loaded. */
    __pfOaiqOnReady?: Array<() => void>;
  }
}

const SENT_KEY = "pf_oaiq_sent";
const SENT_LIMIT = 200;
const handedThisPage = new Set<string>();

function remembered(key: string): boolean {
  try {
    const list = JSON.parse(window.localStorage.getItem(SENT_KEY) || "[]");
    return Array.isArray(list) && list.includes(key);
  } catch {
    return false;
  }
}

function remember(key: string) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SENT_KEY) || "[]");
    const list: string[] = Array.isArray(raw) ? raw.filter((v) => typeof v === "string" && v !== key) : [];
    list.push(key);
    window.localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-SENT_LIMIT)));
  } catch {
    /* Blocked storage: the in-page guard and ChatGPT's event_id dedup remain. */
  }
}

/** Run once the SDK has loaded; never, if it failed. */
function whenDelivered(fn: () => void) {
  if (window.__pfOaiqReady) return fn();
  if (window.__pfOaiqFailed) return;
  (window.__pfOaiqOnReady = window.__pfOaiqOnReady || []).push(fn);
}

function pixel(): OaiqFn | null {
  if (typeof window === "undefined") return null;
  if (isOaiqExcluded(window.location.pathname)) return null;
  return typeof window.oaiq === "function" ? window.oaiq : null;
}

/** A positive whole number of cents, or undefined (then no amount is sent). */
export function toCents(dollars: unknown): number | undefined {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

function validCents(cents: unknown): number | undefined {
  const n = Number(cents);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function money(cents: number | undefined, currency?: string) {
  return cents ? { amount: cents, currency: String(currency || "USD").toUpperCase() } : {};
}

/** One conversion per event_id (see DUPLICATES above). */
function measureOnce(eventName: string, eventId: string, data: Record<string, unknown>): boolean {
  try {
    const id = String(eventId || "").trim().slice(0, 128);
    if (!id) return false;
    const oaiq = pixel();
    if (!oaiq) return false;
    const key = `${eventName}:${id}`;
    if (handedThisPage.has(key) || remembered(key)) return false;
    handedThisPage.add(key);
    oaiq("measure", eventName, data, { event_id: id });
    whenDelivered(() => remember(key));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Server proof for the paid conversions                               */
/* ------------------------------------------------------------------ */

export type MembershipProof = { ok: true; planId: string; amountCents: number; currency: string };
export type VisitProof = { ok: true; product: "one_time_visit" | "full_day"; amountCents: number; currency: string };

/** A session token that has not expired. Expired counts as signed out. */
function usableToken(): string {
  try {
    const token = window.localStorage.getItem("token") || "";
    if (!token) return "";
    const part = token.split(".")[1];
    if (part) {
      const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now()) return "";
    }
    return token;
  } catch {
    return "";
  }
}

/**
 * What the server said about one Stripe session.
 *  ok           proven: send the conversion
 *  refused      a definite no for this sign-in (not theirs, unpaid, refunded,
 *               $0, staff sale) - or the webhook has not recorded it yet
 *  signed_out   no valid sign-in to prove ownership to
 *  unavailable  network, rate limit or server/Stripe failure: ask again later
 *  cancelled    the page went away mid-check
 */
type ProofResult<T> =
  | { state: "ok"; data: T }
  | { state: "refused" | "signed_out" | "unavailable" | "cancelled" };

/**
 * Ask the server whether this Stripe session is a paid purchase of the
 * signed-in customer, polling (the webhook that records it can land a few
 * seconds after Stripe redirects here). Only a 400 (malformed id) or a 401
 * stops early; a 404 is polled on, since it is also what a purchase the
 * webhook has not recorded yet looks like.
 */
async function fetchPaymentProof<T extends { ok: true }>(
  path: "membership-by-session" | "paid-visit-by-session",
  sessionId: string,
  isCancelled: () => boolean,
  attempts: number
): Promise<ProofResult<T>> {
  const token = usableToken();
  if (!token) return { state: "signed_out" };
  const api = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";
  let last: "refused" | "unavailable" = "unavailable";
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 500));
    if (isCancelled()) return { state: "cancelled" };
    const r = await fetch(`${api}/api/track/${path}?session_id=${encodeURIComponent(sessionId)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (r?.status === 400) return { state: "refused" };
    if (r?.status === 401) return { state: "signed_out" };
    if (r?.status === 404) {
      last = "refused";
      continue;
    }
    const data = r?.ok ? ((await r.json().catch(() => null)) as T | null) : null;
    if (data?.ok) return { state: "ok", data };
    last = "unavailable"; // offline, 429, 5xx, or a body we could not read
  }
  return { state: last };
}

/* ------------------------------------------------------------------ */
/* Paid conversions: parked until the server gives a definite answer   */
/* ------------------------------------------------------------------ */

type PaidKind = "order" | "subscription";
/** misses: how many full checks the server answered with a refusal. */
type Pending = { kind: PaidKind; sessionId: string; at: number; misses?: number };

const PENDING_KEY = "pf_oaiq_pending";
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_LIMIT = 10;
/** Refusals tolerated before giving up (covers a webhook that lands minutes late). */
const PENDING_MAX_MISSES = 3;
const RECOVERY_GAP_MS = 60 * 1000;

function readPending(): Pending[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter(
      (p): p is Pending =>
        p && (p.kind === "order" || p.kind === "subscription") && typeof p.sessionId === "string" &&
        typeof p.at === "number" && now - p.at < PENDING_TTL_MS
    );
  } catch {
    return [];
  }
}

function writePending(list: Pending[]) {
  try {
    if (list.length) window.localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-PENDING_LIMIT)));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* blocked storage: the confirmation page itself is then the only chance */
  }
}

const same = (p: Pending, kind: PaidKind, sessionId: string) => p.kind === kind && p.sessionId === sessionId;

/** Park a session (left as it is if already parked). */
function park(kind: PaidKind, sessionId: string) {
  const list = readPending();
  if (!list.some((p) => same(p, kind, sessionId))) {
    list.push({ kind, sessionId, at: Date.now() });
    writePending(list);
  }
}

function unpark(kind: PaidKind, sessionId: string) {
  writePending(readPending().filter((p) => !same(p, kind, sessionId)));
}

/** One more refusal; drop the session once it has had enough of them. */
function miss(kind: PaidKind, sessionId: string) {
  const list = readPending()
    .map((p) => (same(p, kind, sessionId) ? { ...p, misses: (p.misses || 0) + 1 } : p))
    .filter((p) => !same(p, kind, sessionId) || (p.misses || 0) < PENDING_MAX_MISSES);
  writePending(list);
}

function sendPaid(kind: PaidKind, sessionId: string, proof: MembershipProof | VisitProof): boolean {
  if (kind === "subscription") {
    const p = proof as MembershipProof;
    return oaiqSubscription({ eventId: `sub_${sessionId}`, planId: p.planId, amountCents: p.amountCents, currency: p.currency });
  }
  const p = proof as VisitProof;
  return oaiqOrder({
    eventId: `sess_${sessionId}`,
    amountCents: p.amountCents,
    currency: p.currency,
    item:
      p.product === "full_day"
        ? { id: "full_day_visit", name: "Full Day Fixter" }
        : { id: "one_time_handyman_visit", name: "One-Time Handyman Visit" },
  });
}

const inFlight = new Set<string>();

/**
 * order_created / subscription_created for a Stripe return.
 *
 * The Stripe session is parked in localStorage (up to 7 days) BEFORE the
 * server is asked, and leaves only on a definite answer:
 *  - proven: sent once, unparked;
 *  - refused: counted, and dropped after PENDING_MAX_MISSES full checks. That
 *    covers a webhook that lands late, and a different account signed in
 *    here, which the server refuses: ownership is the server's call, never ours.
 *  - signed out, offline, rate-limited, server or Stripe down, page closed:
 *    stays parked, and recoverPendingPaidConversions asks again later.
 */
export async function confirmPaidConversion(
  kind: PaidKind,
  sessionId: string,
  isCancelled: () => boolean = () => false,
  attempts = kind === "subscription" ? 14 : 10
): Promise<boolean> {
  const key = `${kind}:${sessionId}`;
  if (inFlight.has(key)) return false;
  try {
    if (!sessionId || !pixel()) return false; // excluded page or GPC: nothing is parked either
    park(kind, sessionId);
    inFlight.add(key);
    const path = kind === "subscription" ? "membership-by-session" : "paid-visit-by-session";
    const result = await fetchPaymentProof<MembershipProof | VisitProof>(path, sessionId, isCancelled, attempts);
    if (result.state === "ok") {
      unpark(kind, sessionId);
      return sendPaid(kind, sessionId, result.data);
    }
    if (result.state === "refused") miss(kind, sessionId);
    return false;
  } catch {
    return false;
  } finally {
    inFlight.delete(key);
  }
}

let recovering = false;
let lastRecovery = 0;

/**
 * Retry parked Stripe returns: on route changes and sign-ins, at most once a
 * minute, only while someone is signed in. A cheap no-op when nothing is parked.
 */
export function recoverPendingPaidConversions(): void {
  try {
    if (recovering || typeof window === "undefined" || !pixel() || !usableToken()) return;
    const list = readPending();
    if (!list.length) return writePending(list); // clears expired entries
    if (Date.now() - lastRecovery < RECOVERY_GAP_MS) return;
    lastRecovery = Date.now();
    recovering = true;
    void (async () => {
      try {
        for (const p of list) await confirmPaidConversion(p.kind, p.sessionId, () => false, 3);
      } finally {
        recovering = false;
      }
    })();
  } catch {
    recovering = false;
  }
}

/* ------------------------------------------------------------------ */

/** A client-side navigation to a public page. The first load is sent by the loader. */
export function oaiqPageView(pathname: string): void {
  try {
    const oaiq = pixel();
    if (!oaiq || isOaiqExcluded(pathname)) return;
    const content: Content = { id: pathname, name: document.title || pathname, content_type: "page" };
    oaiq("measure", "page_viewed", { type: "contents", contents: [content] });
  } catch {
    /* never throws */
  }
}

/**
 * A lead the server saved: a free-visit request or booking, a callback
 * request, an estimate or partnership enquiry. `eventId` must identify that
 * one submission (the server's event id, a booking number).
 */
export function oaiqLead(eventId: string): boolean {
  return measureOnce("lead_created", eventId, { type: "customer_action" });
}

/** A new account was created (never a returning sign-in). */
export function oaiqRegistration(eventId: string): boolean {
  return measureOnce("registration_completed", eventId, { type: "customer_action" });
}

/** A paid, active membership. Only with a server proof - see confirmPaidConversion. */
export function oaiqSubscription(input: { eventId: string; planId?: string; amountCents?: number; currency?: string }): boolean {
  const cents = validCents(input.amountCents);
  if (!cents) return false; // a $0 start is not a paid membership
  return measureOnce("subscription_created", input.eventId, {
    type: "plan_enrollment",
    ...(input.planId ? { plan_id: input.planId } : {}),
    ...money(cents, input.currency),
  });
}

/** A paid one-time visit. Only with a server proof - see confirmPaidConversion. */
export function oaiqOrder(input: {
  eventId: string;
  amountCents?: number;
  currency?: string;
  item: { id: string; name: string };
}): boolean {
  const cents = validCents(input.amountCents);
  if (!cents) return false;
  return measureOnce("order_created", input.eventId, {
    type: "contents",
    ...money(cents, input.currency),
    contents: [
      {
        id: input.item.id,
        name: input.item.name,
        content_type: "product",
        quantity: 1,
        ...money(cents, input.currency),
      },
    ],
  });
}
