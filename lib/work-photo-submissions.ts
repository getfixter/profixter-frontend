import API from "./api";
import type { PublicWorkPhoto, WorkPhotoStatus } from "./recent-work-service";

/**
 * Submitting work photos, from a contributor's side.
 *
 * CONTRIBUTORS, NOT MANAGERS.
 *
 * A Customer and a Fixter can do exactly two things here: see which of their
 * own jobs a photo may be attached to, and send photos. There is no publish,
 * no unpublish, no reject, no reorder and no way to read anybody else's
 * submission - not because those calls are hidden from this file, but because
 * the server refuses them for these accounts. This module is deliberately
 * separate from recent-work-service.ts, which is the admin's surface, so that
 * the two capabilities never sit one import away from each other.
 *
 * Nothing sent from here can become public. The server assigns the status from
 * the account that made the request, and for both of these roles that status is
 * "pending_review" - see utils/recentWork/workPhotoStates.js. A published flag
 * in this payload would be ignored.
 */

/** One of the caller's own jobs, as much as a picker needs and no more. */
export interface SubmittableJob {
  bookingNumber: string;
  date: string | null;
  service: string;
  status: string;
  city: string;
}

export interface OwnSubmission extends PublicWorkPhoto {
  status: WorkPhotoStatus;
  bookingNumber: string;
  createdAt: string | null;
}

export interface SubmissionResult {
  created: Array<PublicWorkPhoto & { status: WorkPhotoStatus }>;
  failed: Array<{ message: string }>;
  batchId: string;
}

/** Server limits, mirrored so the UI can refuse early rather than waste an upload. */
export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * What the file picker will offer.
 *
 * Matches the formats the server actually accepts, which is checked from the
 * decoded image rather than the extension - so this list is a convenience for
 * the picker, never the validation. HEIC is included because iPhones produce it
 * and sharp decodes it; see the report for what that does and does not promise.
 */
export const ACCEPTED_FILE_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/tiff,image/gif";

export async function fetchSubmittableJobs(signal?: AbortSignal): Promise<SubmittableJob[]> {
  const { data } = await API.get<{ jobs: SubmittableJob[] }>("/api/recent-work/my-jobs", {
    signal,
  });
  return Array.isArray(data?.jobs) ? data.jobs : [];
}

export async function fetchOwnSubmissions(signal?: AbortSignal): Promise<OwnSubmission[]> {
  const { data } = await API.get<{ submissions: OwnSubmission[] }>(
    "/api/recent-work/my-submissions",
    { signal }
  );
  return Array.isArray(data?.submissions) ? data.submissions : [];
}

/**
 * Send one batch of photos.
 *
 * One request per batch rather than one per file, because the server groups a
 * batch under a single batchId that the admin screen reads to keep a job's
 * photos together. It answers with created and failed separately, so a partial
 * success is a partial success rather than an error - which is what lets the
 * caller retry only the ones that did not make it.
 */
export async function submitWorkPhotos(input: {
  files: File[];
  bookingNumber?: string;
  caption?: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<SubmissionResult> {
  const form = new FormData();
  for (const file of input.files) form.append("photos", file);
  if (input.bookingNumber) form.append("bookingNumber", input.bookingNumber);
  if (input.caption) form.append("caption", input.caption);

  const { data } = await API.post<SubmissionResult>("/api/recent-work/submissions", form, {
    signal: input.signal,
    onUploadProgress: (event) => {
      if (!input.onProgress || !event.total) return;
      input.onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    },
  });

  return {
    created: Array.isArray(data?.created) ? data.created : [],
    failed: Array.isArray(data?.failed) ? data.failed : [],
    batchId: data?.batchId || "",
  };
}

/** A short, human way to name a job in a picker. */
export function describeJob(job: SubmittableJob): string {
  const when = job.date
    ? new Date(job.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  return [when, job.service, job.city].filter(Boolean).join(" · ");
}
