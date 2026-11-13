/**
 * Things one admin screen hands to the next without putting them in a URL:
 * a search query (a customer's email or phone must never sit in browser
 * history or a referrer, audit X-11) and a one-off toast (a Stripe return).
 *
 * sessionStorage: this tab only, gone when it closes, cleared on sign-out.
 * Each value is read once.
 */
import type { SectionId } from "./sections";

const QUERY_KEY = (section: SectionId) => `pfa:handoff:q:${section}`;
const TOAST_KEY = "pfa:handoff:toast";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Leave a search query for a section's search field. */
export function handOffQuery(section: SectionId, query: string): void {
  const q = String(query || "").trim();
  if (!q) return;
  try {
    store()?.setItem(QUERY_KEY(section), q.slice(0, 200));
  } catch {
    /* storage full or blocked: the search simply starts empty */
  }
}

/** Take (and forget) the query handed to a section. */
export function takeQuery(section: SectionId): string {
  try {
    const s = store();
    const q = s?.getItem(QUERY_KEY(section)) || "";
    s?.removeItem(QUERY_KEY(section));
    return q;
  } catch {
    return "";
  }
}

export function handOffToast(message: string): void {
  try {
    store()?.setItem(TOAST_KEY, message);
  } catch {
    /* ignore */
  }
}

export function takeToast(): string {
  try {
    const s = store();
    const message = s?.getItem(TOAST_KEY) || "";
    s?.removeItem(TOAST_KEY);
    return message;
  } catch {
    return "";
  }
}
