"use client";

/**
 * The free-visit booking a visitor builds BEFORE they have an account.
 *
 * WHY IT EXISTS. A new visitor describes the job, picks a real date and time,
 * and only then creates an account. Signup is a separate page - deliberately:
 * it is the one page carriers inspect for SMS consent, and a second signup form
 * would be a second opt-in surface to defend - so the draft has to survive a
 * full navigation there and back.
 *
 * WHERE IT LIVES.
 * - The text fields in sessionStorage: this tab only, gone when it closes, and
 *   never sent anywhere until the visitor books.
 * - Photos in IndexedDB, because sessionStorage holds strings of a few MB and a
 *   phone photo does not fit. Same origin-private, same-browser-only storage.
 *
 * NOTHING HERE RESERVES A SLOT. The date and time are a preference. The server
 * re-checks availability when the booking is finally created, and answers
 * SLOT_UNAVAILABLE if somebody else got there first.
 *
 * Every function swallows storage errors: private mode, blocked site data or a
 * full quota mean the draft is lost, never that the page breaks.
 */

const KEY = "pf_free_visit_draft";
const DB_NAME = "pf-booking-draft";
const STORE = "photos";
/** A draft older than this is a different visit, not this one. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type BookingDraft = {
  note: string;
  libraryReference: string;
  /** YYYY-MM-DD in America/New_York, as the calendar shows it. */
  requestedDate: string;
  /** HH:mm in America/New_York. */
  requestedTime: string;
  photoCount: number;
  /** Set when the visitor pressed the final CTA, so the booking can be created on return. */
  submitRequested: boolean;
  updatedAt: number;
};

export const EMPTY_DRAFT: BookingDraft = {
  note: "",
  libraryReference: "",
  requestedDate: "",
  requestedTime: "",
  photoCount: 0,
  submitRequested: false,
  updatedAt: 0,
};

export function loadDraft(): BookingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<BookingDraft>) };
    if (!draft.updatedAt || Date.now() - draft.updatedAt > MAX_AGE_MS) {
      void clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(patch: Partial<BookingDraft>): BookingDraft {
  const next = { ...EMPTY_DRAFT, ...(loadDraft() || {}), ...patch, updatedAt: Date.now() };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the visitor keeps going, the draft just won't survive a reload */
  }
  return next;
}

/** True when there is a draft worth showing on the signup page. */
export function hasBookableDraft(draft: BookingDraft | null): draft is BookingDraft {
  return !!draft && !!draft.requestedDate && !!draft.requestedTime;
}

export async function clearDraft(): Promise<void> {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  await savePhotos([]);
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

type StoredPhoto = { name: string; type: string; data: Blob };

export async function savePhotos(files: File[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const records: StoredPhoto[] = files.map((f) => ({ name: f.name, type: f.type, data: f }));
      store.put({ savedAt: Date.now(), records }, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function loadPhotos(): Promise<File[]> {
  const db = await openDb();
  if (!db) return [];
  const value = await new Promise<{ savedAt?: number; records?: StoredPhoto[] } | undefined>((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get("current");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
  db.close();
  if (!value?.records || !value.savedAt || Date.now() - value.savedAt > MAX_AGE_MS) return [];
  return value.records.map((r) => new File([r.data], r.name, { type: r.type }));
}
