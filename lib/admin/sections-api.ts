/**
 * Endpoints the redesigned More sections call that lib/admin-service.ts does
 * not have yet (FE-SECTIONS). Shapes follow the backend reports:
 * - campaigns: reports/BE-DOCS.md section C (queued, durable send)
 * - Fixter future jobs and reassignment: reports/BE-BOOK.md (J-21)
 * - SMS log, failures, opt-outs: BackEnd routes/adminSms.js (owner only, read-only here)
 *
 * Every reader tolerates missing or malformed fields: a section never crashes
 * because one field arrived as null.
 */
import API from "@/lib/api";
import type { CampaignRequest } from "@/lib/admin-service";

/* ------------------------------------------------------------------ */
/* small coercion helpers                                              */
/* ------------------------------------------------------------------ */

export const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
export const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
export const arr = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
export const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** A client idempotency key (BE-DOCS: up to 200 chars; BE-BOOK: 8-120 of [A-Za-z0-9_.:-]). */
export function newIdempotencyKey(prefix = "adm"): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}

/* ------------------------------------------------------------------ */
/* email campaigns                                                     */
/* ------------------------------------------------------------------ */

export type CampaignStatus = "queued" | "sending" | "completed" | "completed_with_errors" | "failed" | string;

export type CampaignProgress = {
  id: string;
  campaignNumber: string;
  status: CampaignStatus;
  subject: string;
  segment: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  excluded: number;
  pending: number;
  adminCopySent: boolean;
  finished: boolean;
  duplicate: boolean;
  code: string;
  message: string;
  actorName: string;
  createdAt: string;
  completedAt: string;
  lastProgressAt: string;
  failures: Array<{ email: string; error: string }>;
  canResume: boolean;
};

const FINISHED = new Set(["completed", "completed_with_errors", "failed", "canceled", "cancelled", "sent", "partial"]);

/** Reads both the send/resume response and GET /campaigns/:id ({campaign, recentFailures, allowedActions}). */
export function readCampaign(raw: unknown): CampaignProgress {
  const top = obj(raw);
  const c = top.campaign && typeof top.campaign === "object" ? obj(top.campaign) : top;
  const status = str(c.status) || "queued";
  const failuresRaw = arr(top.recentFailures).length ? arr(top.recentFailures) : arr(c.errors ?? top.errors);
  const pending = num(c.pending);
  const finished = typeof c.finished === "boolean" ? c.finished : FINISHED.has(status);
  const allowed = obj(top.allowedActions);
  return {
    id: str(c._id || c.id),
    campaignNumber: str(c.campaignNumber || c.campaignId),
    status,
    subject: str(c.subject),
    segment: str(c.segment),
    total: num(c.total),
    sent: num(c.sent),
    failed: num(c.failed),
    skipped: num(c.skipped),
    excluded: num(c.excluded),
    pending,
    adminCopySent: Boolean(c.adminCopySent),
    finished,
    duplicate: Boolean(top.duplicate),
    code: str(top.code),
    message: str(top.message),
    actorName: str(c.actorName),
    createdAt: str(c.createdAt),
    completedAt: str(c.completedAt),
    lastProgressAt: str(c.lastProgressAt),
    failures: failuresRaw.map((f) => ({ email: str(obj(f).email), error: str(obj(f).error) })),
    canResume: typeof allowed.resume === "boolean" ? allowed.resume : finished && pending > 0,
  };
}

/** POST /api/admin/campaigns/send with an idempotency key (body and header). */
export async function sendQueuedCampaign(payload: CampaignRequest, idempotencyKey: string): Promise<CampaignProgress> {
  const response = await API.post(
    "/api/admin/campaigns/send",
    { ...payload, idempotencyKey },
    { headers: { "Idempotency-Key": idempotencyKey }, timeout: 120000 }
  );
  return readCampaign(response.data);
}

export async function getCampaignProgress(idOrNumber: string, signal?: AbortSignal): Promise<CampaignProgress> {
  const response = await API.get(`/api/admin/campaigns/${encodeURIComponent(idOrNumber)}`, { signal });
  return readCampaign(response.data);
}

export async function resumeCampaign(idOrNumber: string): Promise<CampaignProgress> {
  const response = await API.post(`/api/admin/campaigns/${encodeURIComponent(idOrNumber)}/resume`, {}, { timeout: 120000 });
  return readCampaign(response.data);
}

/* ------------------------------------------------------------------ */
/* Fixter future jobs and reassignment (owner only)                    */
/* ------------------------------------------------------------------ */

export type FutureJob = { id: string; bookingNumber: string; date: string; status: string; customerName: string };

export async function getFixterFutureJobs(fixterId: string): Promise<{ count: number; jobs: FutureJob[] }> {
  const response = await API.get(`/api/admin/fixters/${encodeURIComponent(fixterId)}/future-jobs`);
  const data = obj(response.data);
  const jobs = arr(data.jobs).map((j) => {
    const o = obj(j);
    return { id: str(o.id), bookingNumber: str(o.bookingNumber), date: str(o.date), status: str(o.status), customerName: str(o.customerName) };
  });
  return { count: typeof data.count === "number" ? data.count : jobs.length, jobs };
}

export type ReassignResult = {
  total: number;
  moved: Array<{ id: string; bookingNumber: string; date: string; toFixterName: string }>;
  failed: Array<{ id: string; bookingNumber: string; date: string; code: string; message: string }>;
};

export async function reassignFixterFutureJobs(fixterId: string, toFixterId: string): Promise<ReassignResult> {
  const response = await API.post(`/api/admin/fixters/${encodeURIComponent(fixterId)}/reassign-future-jobs`, { toFixterId });
  const data = obj(response.data);
  return {
    total: num(data.total),
    moved: arr(data.moved).map((m) => {
      const o = obj(m);
      return { id: str(o.id), bookingNumber: str(o.bookingNumber), date: str(o.date), toFixterName: str(o.toFixterName) };
    }),
    failed: arr(data.failed).map((m) => {
      const o = obj(m);
      return { id: str(o.id), bookingNumber: str(o.bookingNumber), date: str(o.date), code: str(o.code), message: str(o.message) };
    }),
  };
}

/** PATCH /fixters/:id/status, keeping the new futureAssignedJobs count (null when the server does not send it). */
export async function setFixterActiveWithJobs(fixterId: string, isActive: boolean): Promise<{ futureAssignedJobs: number | null }> {
  const response = await API.patch(`/api/admin/fixters/${encodeURIComponent(fixterId)}/status`, { isActive });
  const data = obj(response.data);
  return { futureAssignedJobs: typeof data.futureAssignedJobs === "number" ? data.futureAssignedJobs : null };
}

/* ------------------------------------------------------------------ */
/* SMS (owner only, read-only)                                          */
/* ------------------------------------------------------------------ */

export type SmsMessageRow = {
  id: string;
  createdAt: string;
  notificationType: string;
  channelClass: string;
  status: string;
  recipientName: string;
  toPhone: string;
  bookingNumber: string;
  body: string;
  error: string;
  segments: number;
};

const readSms = (row: unknown): SmsMessageRow => {
  const o = obj(row);
  return {
    id: str(o._id || o.id),
    createdAt: str(o.createdAt),
    notificationType: str(o.notificationType),
    channelClass: str(o.channelClass),
    status: str(o.status),
    recipientName: str(o.recipientName),
    toPhone: str(o.toPhone),
    bookingNumber: str(o.bookingNumber),
    body: str(o.body),
    error: str(o.providerErrorMessage || o.suppressionReason || o.providerErrorCode),
    segments: num(o.segments),
  };
};

export type SmsConfigView = {
  smsEnabled: boolean;
  smsMarketingEnabled: boolean;
  twilioConfigured: boolean;
  pendingRetries: number;
  optOuts: number;
  undeliverable: number;
};

export async function getSmsConfig(signal?: AbortSignal): Promise<SmsConfigView> {
  const response = await API.get("/api/admin/sms/config", { signal });
  const data = obj(response.data);
  const config = obj(data.config);
  return {
    smsEnabled: Boolean(config.smsEnabled),
    smsMarketingEnabled: Boolean(config.smsMarketingEnabled),
    twilioConfigured: Boolean(config.twilioConfigured),
    pendingRetries: num(data.pendingRetries),
    optOuts: num(data.optOuts),
    undeliverable: num(obj(data.phones).undeliverable),
  };
}

/** The log, newest first. Only a status filter and the page go in the URL; never names or numbers. */
export async function getSmsMessages(params: { page: number; status?: string }, signal?: AbortSignal) {
  const response = await API.get("/api/admin/sms/messages", {
    params: { page: params.page, limit: 25, ...(params.status ? { status: params.status } : {}) },
    signal,
  });
  const data = obj(response.data);
  return { items: arr(data.items).map(readSms), total: num(data.total), page: num(data.page) || 1, totalPages: Math.max(1, num(data.totalPages)) };
}

export async function getSmsFailures(hours: number, signal?: AbortSignal) {
  const response = await API.get("/api/admin/sms/failures", { params: { hours }, signal });
  const data = obj(response.data);
  return {
    items: arr(data.items).map(readSms),
    byReason: arr(data.byReason).map((r) => {
      const o = obj(r);
      const id = obj(o._id);
      return { reason: str(id.reason) || str(id.code) || "Unknown", count: num(o.count) };
    }),
  };
}

export type SmsOptOutRow = { id: string; phone: string; scope: string; source: string; keyword: string; optedOutAt: string; optedInAt: string };

export async function getSmsOptOuts(page: number, signal?: AbortSignal) {
  const response = await API.get("/api/admin/sms/opt-outs", { params: { page, limit: 25 }, signal });
  const data = obj(response.data);
  return {
    items: arr(data.items).map((r): SmsOptOutRow => {
      const o = obj(r);
      return { id: str(o._id || o.id || o.phone), phone: str(o.phone), scope: str(o.scope), source: str(o.source), keyword: str(o.keyword), optedOutAt: str(o.optedOutAt), optedInAt: str(o.optedInAt) };
    }),
    total: num(data.total),
    page: num(data.page) || 1,
  };
}
