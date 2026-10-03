/**
 * The Profixter Library: generic example pictures of common small jobs that a
 * customer can choose when they have no photo of their own job to hand.
 *
 * These are Profixter-owned reference images (public/images/booking-library),
 * named after the site's Popular Tasks. They are NOT customer photos and must
 * never be shown as one: a booking stores only the key, in
 * `booking.libraryReference`, separately from `booking.images` (real photos).
 *
 * The keys must match the backend list in utils/bookingLibrary.js.
 */

export type LibraryItem = { key: string; label: string };

export const BOOKING_LIBRARY: readonly LibraryItem[] = [
  { key: "faucet", label: "Faucet & Leak" },
  { key: "light_fixture", label: "Light Fixture" },
  { key: "tv_mounting", label: "TV Mounting" },
  { key: "door", label: "Door & Lock" },
  { key: "drywall", label: "Drywall Patch" },
  { key: "caulking", label: "Caulking" },
  { key: "furniture_assembly", label: "Furniture Assembly" },
  { key: "shelves", label: "Shelves & Hanging" },
  { key: "paint", label: "Paint Touch-Up" },
  { key: "small_fixes", label: "Several Small Fixes" },
] as const;

const BY_KEY = new Map(BOOKING_LIBRARY.map((item) => [item.key, item]));

export function libraryItem(key?: string | null): LibraryItem | null {
  return key ? BY_KEY.get(key) || null : null;
}

export function libraryLabel(key?: string | null): string {
  return libraryItem(key)?.label || "";
}

/** 480px for cards, 960px for high-density screens. */
export function libraryImage(key: string, size: 1 | 2 = 1): string {
  return `/images/booking-library/${key}${size === 2 ? "@2x" : ""}.webp`;
}
