import { FULL_DAY_FALLBACK, ONE_TIME_FALLBACK } from "@/lib/business";

/**
 * The live One-Time and Full Day offers, read on the server.
 *
 * Both prices are administered in the backend (Admin > Settings) and the booking
 * pages read them from the same public endpoints at runtime, so a page that
 * printed "$99" from a constant would be the one place that kept saying $99
 * after the price changed. These read the same source with a revalidation
 * window, and fall back to the published defaults only if the API is down.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";
const REVALIDATE_SECONDS = 3600;

export type OneTimeOffer = {
  priceDollars: number;
  minutes: number;
  allowedServices: string[];
  excludedServices: string[];
  live: boolean;
};

export type FullDayOffer = {
  priceDollars: number;
  hours: number;
  live: boolean;
};

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v || "").trim()).filter(Boolean) : [];
}

export async function getOneTimeOffer(): Promise<OneTimeOffer> {
  const json = await getJson("/api/bookings/one-time/config");
  const cents = Number(json?.priceCents);
  const minutes = Number(json?.durationMinutes);
  const live = Boolean(json && Number.isFinite(cents) && cents > 0);
  return {
    priceDollars: live ? Math.round(cents) / 100 : ONE_TIME_FALLBACK.priceDollars,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : ONE_TIME_FALLBACK.minutes,
    allowedServices: list(json?.allowedServices),
    excludedServices: list(json?.excludedServices),
    live,
  };
}

export async function getFullDayOffer(): Promise<FullDayOffer> {
  const json = await getJson("/api/bookings/full-day/config");
  const cents = Number(json?.priceCents);
  const hours = Number(json?.approximateHours);
  const live = Boolean(json && Number.isFinite(cents) && cents > 0);
  return {
    priceDollars: live ? Math.round(cents) / 100 : FULL_DAY_FALLBACK.priceDollars,
    hours: Number.isFinite(hours) && hours > 0 ? hours : FULL_DAY_FALLBACK.hours,
    live,
  };
}

export type GoogleRating = { rating: number; total: number; url: string };

/**
 * The Google rating, read from the same endpoint the homepage badge uses.
 *
 * FAILS CLOSED, like the badge: no answer, no rating. There is no default
 * anywhere, because a rating with nothing behind it would be a fabricated claim.
 * Shown as text only - self-published review markup for a LocalBusiness is not
 * eligible for review rich results, and this is not repeated in structured data.
 */
export async function getGoogleRating(): Promise<GoogleRating | null> {
  const json = await getJson("/api/google/reviews");
  const rating = Number(json?.rating);
  const total = Number(json?.total);
  if (!json?.ok || !(rating > 0) || !(total > 0)) return null;
  return { rating, total, url: String(json.googleUrl || "") };
}

export type RecentWorkPhoto = {
  id: string;
  title: string;
  caption: string;
  category: string;
  thumbUrl: string;
  imageUrl: string;
  width: number;
  height: number;
};

/**
 * Published Recent Work photos, read on the server from the same public feed
 * the gallery uses. Only captioned photos are returned: an uncaptioned photo
 * says nothing a search engine or an assistant can use, and the gallery
 * already shows it. Fails quietly to an empty list.
 */
export async function getRecentWorkPhotos(category?: string, limit = 24): Promise<RecentWorkPhoto[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (category) query.set("category", category);
  const json = await getJson(`/api/recent-work?${query.toString()}`);
  const photos = Array.isArray(json?.photos) ? (json.photos as RecentWorkPhoto[]) : [];
  return photos.filter((photo) => photo && photo.caption && photo.imageUrl);
}
