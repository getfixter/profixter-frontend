import API from "./api";

/**
 * The Recent Work gallery, from the admin's side.
 *
 * Kept out of admin-service.ts deliberately: that file is eleven hundred lines
 * covering nine features, and a tenth would make it harder to read without
 * making anything easier to find.
 */

export type WorkPhotoStatus =
  | "pending_review"
  | "scheduled"
  | "published"
  | "library"
  | "rejected"
  | "archived";

export type UploaderType = "admin" | "fixter" | "member";

/** Exactly what the public API is allowed to hand out. */
export interface PublicWorkPhoto {
  id: string;
  title: string;
  caption: string;
  category: string;
  location: string;
  featured: boolean;
  publishedAt: string | null;
  thumbUrl: string;
  imageUrl: string;
  fullUrl: string;
  width: number;
  height: number;
}

export interface AdminWorkPhoto extends PublicWorkPhoto {
  status: WorkPhotoStatus;
  uploaderType: UploaderType;
  uploadedByName: string;
  uploadedByRole: string;
  bookingNumber: string;
  internalNote: string;
  publishAt: string | null;
  firstPublishedAt: string | null;
  unpublishedAt: string | null;
  reviewedByName: string;
  reviewedAt: string | null;
  rejectionReason: string;
  batchId: string;
  createdAt: string | null;
  sourceWidth: number;
  sourceHeight: number;
  bytes: number;
}

export interface WorkPhotoCategory {
  slug: string;
  label: string;
}

export interface GalleryCounts {
  pending: number;
  scheduled: number;
  published: number;
  rejected: number;
  library: number;
}

export interface GalleryResponse {
  view: string;
  page: number;
  limit: number;
  total: number;
  photos: AdminWorkPhoto[];
  counts: GalleryCounts;
  categories: WorkPhotoCategory[];
}

export type GalleryView = "pending" | "published" | "library";

export interface UploadFields {
  title?: string;
  caption?: string;
  category?: string;
  publicLocation?: string;
  internalNote?: string;
  bookingNumber?: string;
  publishNow?: boolean;
}

export interface UploadResult {
  created: AdminWorkPhoto[];
  failed: { name: string; message: string }[];
  batchId: string;
  message: string;
}

const BASE = "/api/admin/recent-work";

export async function fetchGallery(params: {
  view: GalleryView;
  q?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<GalleryResponse> {
  const { data } = await API.get(BASE, { params });
  return data;
}

/**
 * Upload, with real progress.
 *
 * One request for the whole batch so the phone negotiates TLS once rather than
 * ten times, and so partial failure comes back as one answer naming the files
 * that did not make it.
 */
export async function uploadPhotos(
  files: File[],
  fields: UploadFields,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const form = new FormData();
  files.forEach((file) => form.append("photos", file));
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== "") form.append(key, String(value));
  });

  const { data } = await API.post(BASE, form, {
    /* Camera files are large and the phone may be on one bar. */
    timeout: 180000,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    },
  });
  return data;
}

export async function publishPhoto(id: string): Promise<AdminWorkPhoto> {
  const { data } = await API.post(`${BASE}/${id}/publish`);
  return data.photo;
}

export async function unpublishPhoto(id: string): Promise<AdminWorkPhoto> {
  const { data } = await API.post(`${BASE}/${id}/unpublish`);
  return data.photo;
}

export async function rejectPhoto(id: string, reason?: string): Promise<AdminWorkPhoto> {
  const { data } = await API.post(`${BASE}/${id}/reject`, { reason });
  return data.photo;
}

export async function updatePhoto(
  id: string,
  patch: Partial<{
    title: string;
    caption: string;
    category: string;
    publicLocation: string;
    internalNote: string;
    featured: boolean;
  }>
): Promise<AdminWorkPhoto> {
  const { data } = await API.patch(`${BASE}/${id}`, patch);
  return data.photo;
}

export async function deletePhoto(
  id: string
): Promise<{ deleted: boolean; storagePurged: boolean; message: string }> {
  const { data } = await API.delete(`${BASE}/${id}`);
  return data;
}

/* ------------------------------------------------------------------ */

export const STATUS_LABELS: Record<WorkPhotoStatus, string> = {
  pending_review: "Needs review",
  scheduled: "Publishing soon",
  published: "Live",
  library: "Library",
  rejected: "Rejected",
  archived: "Deleted",
};

/**
 * Colour carries meaning here, so it is rationed: green is live, amber is
 * waiting on a person, blue is a clock running by itself, grey is at rest.
 */
export const STATUS_TONES: Record<WorkPhotoStatus, string> = {
  pending_review: "bg-amber-100 text-amber-900 border-amber-200",
  scheduled: "bg-sky-100 text-sky-900 border-sky-200",
  published: "bg-emerald-100 text-emerald-900 border-emerald-200",
  library: "bg-slate-100 text-slate-700 border-slate-200",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

export const UPLOADER_LABELS: Record<UploaderType, string> = {
  admin: "Admin",
  fixter: "Fixter",
  member: "Member",
};

/** "4:32" until a scheduled photo goes live, or null once it is due. */
export function countdownTo(publishAt: string | null, now: number): string | null {
  if (!publishAt) return null;
  const remaining = new Date(publishAt).getTime() - now;
  if (remaining <= 0) return null;
  const total = Math.ceil(remaining / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
