"use client";

import { loadPhotos, savePhotos } from "./booking-draft";

/**
 * The Book a Handyman draft: what the customer described, where, and when.
 *
 * It has to outlive everything between describing the job and paying for it:
 * signing in or registering (a full page), a Stripe checkout and the trip back,
 * a refresh, a recoverable payment error. So the text lives in localStorage
 * (survives a new tab from an email sign-in code, too) and the photos in
 * IndexedDB (lib/booking-draft, slot "handyman"). It expires after a day.
 *
 * The chosen time is held for 20 minutes once they reach sign-in or Step 4
 * (POST /api/bookings/hold); holdToken proves the hold is theirs and is sent
 * with the booking, which takes the time over. The server re-checks the time
 * then either way, so an expired hold costs nothing but the guarantee.
 */

const KEY = "pf_handyman_draft";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const HANDYMAN_PHOTO_SLOT = "handyman";

export type DraftAddress = {
  line1: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  placeId?: string;
  lat?: number | null;
  lng?: number | null;
};

export type HandymanDraft = {
  task: string;
  /** An address already on the account, when signed in. */
  addressId: string;
  /** A typed address, before it is saved to the account. */
  address: DraftAddress | null;
  date: string;
  time: string;
  /** Contact from the Free Visit form, when they switched over from it. */
  name: string;
  phone: string;
  email: string;
  photoCount: number;
  /** One id per press of Pay; kept until checkout opens so a retry reuses it. */
  clientRequestId: string;
  /** The choice they made at Step 4, so a return from Stripe lands back there. */
  choice: "" | "member" | "one_time" | "membership";
  plan: string;
  /** The held booking a One-Time checkout created, to release if they come back without paying. */
  pendingBookingId: string;
  /** Their sign-in hold ("<id>.<secret>"), the time it holds ("YYYY-MM-DD HH:mm") and when it lapses (ISO). */
  holdToken: string;
  holdFor: string;
  holdExpiresAt: string;
  updatedAt: number;
};

export const EMPTY_HANDYMAN_DRAFT: HandymanDraft = {
  task: "",
  addressId: "",
  address: null,
  date: "",
  time: "",
  name: "",
  phone: "",
  email: "",
  photoCount: 0,
  clientRequestId: "",
  choice: "",
  plan: "",
  pendingBookingId: "",
  holdToken: "",
  holdFor: "",
  holdExpiresAt: "",
  updatedAt: 0,
};

export function loadHandymanDraft(): HandymanDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HandymanDraft;
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { ...EMPTY_HANDYMAN_DRAFT, ...parsed };
  } catch {
    return null;
  }
}

export function saveHandymanDraft(draft: Partial<HandymanDraft>) {
  try {
    const current = loadHandymanDraft() || EMPTY_HANDYMAN_DRAFT;
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...draft, updatedAt: Date.now() }));
  } catch {
    /* private mode or full storage: the draft is lost, the page still works */
  }
}

export async function saveHandymanPhotos(files: File[]) {
  await savePhotos(files, HANDYMAN_PHOTO_SLOT);
}

export async function loadHandymanPhotos(): Promise<File[]> {
  return loadPhotos(HANDYMAN_PHOTO_SLOT);
}

export async function clearHandymanDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  await savePhotos([], HANDYMAN_PHOTO_SLOT);
}

export function newClientRequestId() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2);
  return `hb${Date.now().toString(36)}${random}`.slice(0, 48);
}
