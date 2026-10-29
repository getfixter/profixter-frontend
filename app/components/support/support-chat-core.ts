import { surfaceFor } from "@/lib/surface";

/**
 * The parts of the support chat that are not React: where it may appear, the
 * visitor id, the SSE parser and link detection. Kept apart so a test can
 * check them without a browser.
 */

/*
 * Routes where the chat stays out of the way, on top of the staff surface
 * (/admin, /event) that lib/surface.ts already names:
 *
 * - signing (/sign/*), sign-in and sign-up: focused flows with one job; the
 *   site tab bar is hidden on them for the same reason.
 * - /book and its steps: the booking flow and checkout. A bubble over the
 *   calendar or the pay button is a distraction at exactly the wrong moment.
 *   The confirmation page after a booking is allowed back (see below).
 * - /gift/claim: claiming a gift is a short flow of its own.
 * - one-shot pages reached from an email or SMS (/review, /tip,
 *   /confirmationpage) and the /m short links.
 * - /july4: a campaign page the tab bar also leaves alone.
 */
export const SUPPORT_CHAT_HIDDEN_PREFIXES = [
  "/sign",
  "/signin",
  "/signup",
  "/register",
  "/forgot-password",
  "/book",
  "/gift/claim",
  "/confirmationpage",
  "/review",
  "/tip",
  "/m",
  "/july4",
];

/** Allowed back inside a hidden prefix: after checkout, a question is welcome. */
const SUPPORT_CHAT_ALLOWED = ["/book/confirmation"];

function underPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function supportChatVisibleOn(pathname: string | null | undefined): boolean {
  const path = pathname || "/";
  if (surfaceFor(path) === "staff") return false;
  if (SUPPORT_CHAT_ALLOWED.some((p) => underPrefix(path, p))) return true;
  return !SUPPORT_CHAT_HIDDEN_PREFIXES.some((p) => underPrefix(path, p));
}

/*
 * The same key the old floating widget used, so a returning visitor keeps the
 * conversation the server already has for them.
 */
const VISITOR_KEY = "chatVisitorId";

function newVisitorId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `visitor-${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** The visitor id from localStorage, or a fresh one. Storage can throw (private mode); then the id lives for this page only. */
export function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length <= 100) return existing;
    const id = newVisitorId();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return newVisitorId();
  }
}

export type ChatStreamEvent = {
  token?: string;
  done?: boolean;
  status?: string;
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
};

/**
 * Server-sent events arrive in arbitrary chunks: one network read can hold
 * half an event or three of them. Buffer until a blank line ends an event,
 * then hand over every `data:` payload that parses as JSON.
 */
export function createSseParser(onEvent: (event: ChatStreamEvent) => void) {
  let buffer = "";
  const flushBlock = (block: string) => {
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as ChatStreamEvent);
      } catch {
        /* not JSON: ignore */
      }
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let end = buffer.search(/\r?\n\r?\n/);
      while (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, "");
        flushBlock(block);
        end = buffer.search(/\r?\n\r?\n/);
      }
    },
    end() {
      if (buffer.trim()) flushBlock(buffer);
      buffer = "";
    },
  };
}

/*
 * Errors the server words for the visitor (rate limit, message too long) are
 * shown as sent. Anything else is an internal failure and gets our wording.
 */
const VISITOR_FACING_CODES = new Set(["rate_limited", "input_too_long"]);

export const PHONE_DISPLAY = "631-599-1363";
export const PHONE_TEL = "tel:+16315991363";

export function friendlyError(event: ChatStreamEvent | null): string {
  if (event?.code && VISITOR_FACING_CODES.has(event.code) && event.error) return event.error;
  return `Sorry, the chat could not answer just now. Please try again, or call ${PHONE_DISPLAY}.`;
}

export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

/**
 * Split a reply into text and links. Profixter links become site-relative, so
 * they open on whatever host the visitor is on (www, preview, localhost) and
 * stay in the same tab. Trailing punctuation is not part of a link.
 */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /https?:\/\/[^\s<>()]+/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    let url = match[0];
    const trailing = url.match(/[.,;:!?'"]+$/);
    if (trailing) url = url.slice(0, -trailing[0].length);
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    let href = url;
    try {
      const parsed = new URL(url);
      if (/(^|\.)profixter\.com$/i.test(parsed.hostname)) href = `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    } catch {
      /* keep as is */
    }
    parts.push({ type: "link", value: url, href });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
