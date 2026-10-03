/**
 * The booth display's two calls, made with fetch rather than lib/api.
 *
 * lib/api sends the browser to /signin on any 401. On a tablet running
 * unattended on a tripod that would replace the photos with a login form in
 * front of the public, so these calls report failure and the caller keeps
 * showing what it already has.
 */

export type DisplayPhoto = { id: string; url: string; group: string };
export type ReviewStatus = "approved" | "hidden" | "unreviewed";
export type ReviewPhoto = DisplayPhoto & { status: ReviewStatus };

type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
const BASE = `${API_URL}/api/admin/event-display`;

function token() {
  try {
    return window.localStorage.getItem("token");
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const auth = token();
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (init.body) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, message: body?.message || `Request failed (${res.status})` };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, message: "Network error" };
  }
}

export function fetchDisplayPhotos() {
  return request<{ photos: DisplayPhoto[]; total: number }>("/photos?scope=display");
}

export function fetchReviewPhotos() {
  return request<{
    photos: ReviewPhoto[];
    counts: Record<ReviewStatus, number>;
    total: number;
  }>("/photos?scope=review");
}

export function setPhotoStatus(ids: string[], status: ReviewStatus) {
  return request<{ updated: number; status: ReviewStatus }>("/photos", {
    method: "PUT",
    body: JSON.stringify({ ids, status }),
  });
}
