/**
 * The Jobs API (track BE-BOOK, reports/BE-BOOK.md) for the new Jobs, job
 * sheet, My day and Schedule screens: the DTO types exactly as the server
 * sends them, cancellable fetchers for useAdminQuery, the mutations, and the
 * one function that writes a saved job into every cached list that shows it
 * (so a change never reloads a screen).
 *
 * Rules the server enforces and this file only follows:
 * - search text goes in a POST body, never a URL;
 * - every transition sends expectedStatus (+ expectedUpdatedAt) and an
 *   idempotencyKey made once per user intent, so a double tap or a retry is
 *   answered with the first result and never repeats a customer message;
 * - edits and reschedules send expectedUpdatedAt; a 409 STALE means "reload".
 */
import API from "@/lib/api";
import { getQueryData, invalidateQueries, setQueryData, type QueryKey } from "@/lib/admin/query";

/* ------------------------------------------------------------------ */
/* DTOs (BE-BOOK "DTOs")                                               */
/* ------------------------------------------------------------------ */

export type JobStatus = "Pending" | "Pending Confirmation" | "Confirmed" | "Completed" | "Canceled";
export type JobTypeKey = "member" | "one_time" | "free_visit" | "full_day" | "admin_free";
export type FlagKey = "request_review" | "unassigned" | "not_closed" | "payment_pending" | "payment_problem" | "reservation_issue" | "repeat_check";
export type JobFlag = { key: FlagKey | string; label: string; severity: "attention" | "problem" };
export type JobTiming = { key: "upcoming" | "scheduled_now" | "not_closed"; label: string } | null;

export type JobRow = {
  id: string;
  bookingNumber: string;
  date: string | null;
  endEstimate: string | null;
  status: JobStatus | string;
  type: JobTypeKey | string;
  typeLabel: string;
  customer: { id: string | null; name: string; phone?: string };
  addressShort: string;
  town: string;
  technician: { id: string; name: string } | null;
  flags: JobFlag[];
  timing: JobTiming;
  updatedAt: string | null;
};

export type JobAction = "addInternalNote" | "addPhotos" | "complete" | "confirm" | "reviewFreeVisit" | "cancel" | "reschedule" | "reassign" | "edit" | "reinstate";

export type JobMoney = {
  kind: "membership_included" | "paid" | "payment_pending" | "payment_failed" | "refunded" | "free" | "admin_free" | "full_day_included" | "full_day_loyalty" | string;
  label: string;
  amountCents?: number;
  paidAt?: string;
  stripeUrl?: string;
  tipCents?: number;
};

export type StaffNote = { id: string; text: string; authorId: string | null; authorName: string; authorRole: string; at: string };

export type JobDetail = Omit<JobRow, "customer"> & {
  customer: {
    id: string | null;
    name: string;
    phone: string;
    phoneE164: string | null;
    email: string;
    guest: boolean;
    visitsCompleted?: number | null;
    plan?: { plan: string; billingCycle: string; status: string; cancelAtPeriodEnd: boolean } | null;
  };
  address: { line1: string; city: string; state: string; zip: string; full: string };
  service: string;
  selectedTask: string;
  description: string;
  adminNote: string;
  photos: string[];
  libraryReference: string;
  money: JobMoney;
  staffNotes: StaffNote[];
  freeVisit: { channel: string; purpose: string; reviewRequired: boolean } | null;
  reservationIssue: { status: string; message: string } | null;
  cancellationReason: string;
  completedAt: string | null;
  createdAt: string | null;
  allowedActions: JobAction[];
  history: { href: string };
};

export type Notification = { channel: "email" | "sms" | string; status: "sent" | "skipped" | "failed" | string; reason: string; purpose?: "reschedule" | "assignment" | string };

export type PaymentInfo = {
  paymentState: string;
  paid: boolean;
  paidCents: number | null;
  currency: string;
  paidAt: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeDashboardUrl: string | null;
  refunded: boolean;
  refundNote: string;
};

export type JobsCounts = { today: number; tomorrow: number; week: number; needsAction: number };
export type JobsList = { view: string; from: string | null; to: string | null; total: number; rows: JobRow[]; nextCursor: string | null; counts: JobsCounts | null };
export type JobsSearch = { q: string; total: number; limited: boolean; groups: { date: string; rows: JobRow[] }[] };

export type Technician = {
  id: string;
  name: string;
  position?: string;
  isDefaultFixter?: boolean;
  accountActive?: boolean;
  availabilityStatus?: string;
  dayBookingCount?: number;
  weekBookingCount?: number;
  available: boolean;
  reason?: string;
};
export type AssignmentOptions = {
  bookingId: string;
  slotStart: string | null;
  slotEnd: string | null;
  availableTechnicians: Technician[];
  unavailableTechnicians: Technician[];
  recommendedTechnician: Technician | null;
  currentTechnician: { id: string; name: string; inactiveOrRemoved: boolean } | null;
};

export type TransitionResult = {
  booking: JobDetail;
  transition: { action: string; from: string; to: string };
  notifications: Notification[];
  payment?: PaymentInfo;
  fullDayRestore?: { restored: boolean; kind: "included" | "loyalty" | null; reason: string } | null;
  routedTo?: string;
  replayed: boolean;
};

export type CapacitySlot = { time: string; endTime: string; totalCapacity: number; usedCapacity: number; remainingCapacity: number; open: boolean };
export type CapacityDay = { date: string; closed: boolean; note: string; totalCapacity: number; usedCapacity: number; openSlotCount: number; slots: CapacitySlot[] };
export type ScheduleData = {
  from: string;
  to: string;
  total: number;
  lanes: { technician: { id: string; name: string } | null; rows: JobRow[] }[];
  capacity: { scope: string; days: CapacityDay[] } | null;
  capacityError: { code: string; message: string } | null;
};
export type MyDay = { today: { date: string; rows: JobRow[] }; tomorrow: { date: string; rows: JobRow[] } };

export type NeedsItem = { id: string; kind: string; title: string; subtitle?: string; reason?: string; severity: "attention" | "problem"; href: string; at?: string | null; section?: string };
export type NeedsSection = { key: string; count: number | null; items: NeedsItem[]; error?: { code: string; message: string } };
export type NeedsAction = { generatedAt: string; total: number; sections: NeedsSection[]; items: NeedsItem[] };

/* ------------------------------------------------------------------ */
/* Keys and fetchers                                                   */
/* ------------------------------------------------------------------ */

export type ListParams = { view: "today" | "tomorrow" | "week" | "range" | "needs_action"; from?: string; to?: string; tech?: string; status?: string; cursor?: string; limit?: number };

export const jobKeys = {
  list: (p: ListParams) => ["jobs", "list", p.view, p.from || "", p.to || "", p.tech || "", p.status || "", p.cursor || ""] as const,
  search: (q: string) => ["jobs", "search", q] as const,
  detail: (id: string) => ["jobs", "detail", id] as const,
  options: (id: string) => ["jobs", "options", id] as const,
  schedule: (from: string, to: string, tech: string) => ["jobs", "schedule", from, to, tech] as const,
  myDay: ["jobs", "my-day"] as const,
  needs: ["needs-action", "full"] as const,
};

/* An answer that is not the shape we asked for (an older backend) reads as empty, never a crash. */
function asList(data: unknown, fallbackView: string): JobsList {
  const d = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Partial<JobsList>;
  return {
    view: d.view || fallbackView,
    from: d.from ?? null,
    to: d.to ?? null,
    total: typeof d.total === "number" ? d.total : Array.isArray(d.rows) ? d.rows.length : 0,
    rows: Array.isArray(d.rows) ? d.rows : [],
    nextCursor: d.nextCursor || null,
    counts: d.counts && typeof d.counts === "object" ? d.counts : null,
  };
}

export async function fetchJobs(p: ListParams, signal: AbortSignal): Promise<JobsList> {
  const params: Record<string, string | number> = { view: p.view };
  if (p.from) params.from = p.from;
  if (p.to) params.to = p.to;
  if (p.tech) params.tech = p.tech;
  if (p.status) params.status = p.status;
  if (p.cursor) params.cursor = p.cursor;
  if (p.limit) params.limit = p.limit;
  const response = await API.get("/api/admin/jobs", { params, signal });
  return asList(response.data, p.view);
}

/** All dates. The text travels in the body (never a URL, never a log line). */
export async function searchJobs(q: string, signal: AbortSignal): Promise<JobsSearch> {
  const response = await API.post("/api/admin/jobs/search", { q, limit: 50 }, { signal });
  const d = (response.data || {}) as Partial<JobsSearch>;
  return { q: d.q || q, total: d.total || 0, limited: Boolean(d.limited), groups: Array.isArray(d.groups) ? d.groups : [] };
}

export async function fetchJob(id: string, signal: AbortSignal): Promise<JobDetail> {
  const response = await API.get(`/api/admin/jobs/${encodeURIComponent(id)}`, { signal });
  const job = response.data?.job;
  if (!job || typeof job !== "object") throw Object.assign(new Error("This job could not be loaded."), { response: { status: 404, data: { message: "This job could not be loaded." } } });
  return job as JobDetail;
}

export async function fetchAssignmentOptions(id: string, signal: AbortSignal): Promise<AssignmentOptions> {
  const response = await API.get(`/api/admin/jobs/${encodeURIComponent(id)}/assignment-options`, { signal });
  const d = response.data || {};
  return {
    bookingId: d.bookingId || id,
    slotStart: d.slotStart || null,
    slotEnd: d.slotEnd || null,
    availableTechnicians: Array.isArray(d.availableTechnicians) ? d.availableTechnicians : [],
    unavailableTechnicians: Array.isArray(d.unavailableTechnicians) ? d.unavailableTechnicians : [],
    recommendedTechnician: d.recommendedTechnician || null,
    currentTechnician: d.currentTechnician || null,
  };
}

export async function fetchSchedule(from: string, to: string, tech: string, signal: AbortSignal): Promise<ScheduleData> {
  const response = await API.get("/api/admin/schedule", { params: { from, to, ...(tech ? { tech } : {}) }, signal });
  const d = response.data || {};
  return {
    from: d.from || from,
    to: d.to || to,
    total: d.total || 0,
    lanes: Array.isArray(d.lanes) ? d.lanes : [],
    capacity: d.capacity && Array.isArray(d.capacity.days) ? d.capacity : null,
    capacityError: d.capacityError || null,
  };
}

export async function fetchMyDay(signal: AbortSignal): Promise<MyDay> {
  const response = await API.get("/api/admin/my-day", { signal });
  const d = response.data || {};
  const part = (x: { date?: string; rows?: JobRow[] } | undefined) => ({ date: x?.date || "", rows: Array.isArray(x?.rows) ? x!.rows! : [] });
  return { today: part(d.today), tomorrow: part(d.tomorrow) };
}

export async function fetchNeedsAction(signal: AbortSignal): Promise<NeedsAction | null> {
  try {
    const response = await API.get("/api/admin/needs-action", { params: { limit: 100 }, signal });
    const d = response.data || {};
    return {
      generatedAt: d.generatedAt || "",
      total: typeof d.total === "number" ? d.total : 0,
      sections: Array.isArray(d.sections) ? d.sections : [],
      items: Array.isArray(d.items) ? d.items : [],
    };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403) return null;
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

/** One key per user intent (a step opened); reused on a retry of the same intent. */
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* insecure context: fall through */
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

export type TransitionInput = {
  action: "confirm" | "complete" | "cancel" | "reinstate";
  expectedStatus: string;
  expectedUpdatedAt?: string | null;
  assignedFixterId?: string;
  targetStatus?: "Confirmed" | "Pending";
  notifyCustomer?: boolean;
  reason?: string;
  idempotencyKey: string;
};

export async function transitionJob(id: string, input: TransitionInput): Promise<TransitionResult> {
  const body: Record<string, unknown> = { action: input.action, expectedStatus: input.expectedStatus, idempotencyKey: input.idempotencyKey };
  if (input.expectedUpdatedAt) body.expectedUpdatedAt = input.expectedUpdatedAt;
  if (input.assignedFixterId) body.assignedFixterId = input.assignedFixterId;
  if (input.action === "reinstate") {
    body.targetStatus = input.targetStatus || "Confirmed";
    body.notifyCustomer = input.notifyCustomer === true;
  }
  if (input.reason) body.reason = input.reason;
  const response = await API.post(`/api/admin/jobs/${encodeURIComponent(id)}/transition`, body);
  return response.data as TransitionResult;
}

export async function patchJob(id: string, patch: { expectedUpdatedAt: string; note?: string; adminNote?: string; assignedFixterId?: string }) {
  const response = await API.patch(`/api/admin/jobs/${encodeURIComponent(id)}`, patch);
  return response.data as { booking: JobDetail; changed: string[]; notifications: Notification[] };
}

export async function addJobNote(id: string, text: string) {
  const response = await API.post(`/api/admin/jobs/${encodeURIComponent(id)}/notes`, { text });
  return response.data as { note: StaffNote; booking: JobDetail };
}

export async function addJobPhotos(id: string, files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  const response = await API.post(`/api/admin/jobs/${encodeURIComponent(id)}/photos`, form, { timeout: 120000 });
  return response.data as { added: number; booking: JobDetail };
}

export async function rescheduleJob(
  id: string,
  input: { date: string; time?: string; expectedUpdatedAt: string; idempotencyKey: string; notifyCustomer: boolean }
) {
  const body: Record<string, unknown> = { date: input.date, expectedUpdatedAt: input.expectedUpdatedAt, idempotencyKey: input.idempotencyKey, notifyCustomer: input.notifyCustomer };
  if (input.time) body.time = input.time;
  const response = await API.post(`/api/admin/jobs/${encodeURIComponent(id)}/reschedule`, body);
  return response.data as { booking: JobDetail; notifications: Notification[]; replayed: boolean };
}

/* ------------------------------------------------------------------ */
/* Cache: a saved job goes into every list that shows it               */
/* ------------------------------------------------------------------ */

const knownKeys = new Map<string, QueryKey>();
/** Lists register their key so a saved job can be merged into them in place. */
export function rememberKey(key: QueryKey) {
  knownKeys.set(JSON.stringify(key), key);
}

export function rowOf(job: JobDetail | JobRow): JobRow {
  return {
    id: job.id,
    bookingNumber: job.bookingNumber,
    date: job.date,
    endEstimate: job.endEstimate,
    status: job.status,
    type: job.type,
    typeLabel: job.typeLabel,
    customer: { id: job.customer.id, name: job.customer.name, ...(job.customer.phone ? { phone: job.customer.phone } : {}) },
    addressShort: job.addressShort,
    town: job.town,
    technician: job.technician,
    flags: job.flags,
    timing: job.timing,
    updatedAt: job.updatedAt,
  };
}

const swap = (rows: JobRow[], row: JobRow) => rows.map((r) => (r.id === row.id ? row : r));

/**
 * Write a saved job into its detail and every cached list (in place, no
 * reload), then let the lists and badges refresh quietly in the background:
 * a job that left a view stays where it is until "Show changes" is tapped.
 */
export function applyJob(job: JobDetail) {
  setQueryData(jobKeys.detail(job.id), job);
  const row = rowOf(job);
  for (const key of knownKeys.values()) {
    const data = getQueryData<unknown>(key);
    if (!data || typeof data !== "object") continue;
    const head = Array.isArray(key) ? key[1] : "";
    if (head === "list" && Array.isArray((data as JobsList).rows) && (data as JobsList).rows.some((r) => r.id === row.id)) {
      setQueryData<JobsList>(key, (d) => ({ ...(d as JobsList), rows: swap((d as JobsList).rows, row) }));
    } else if (head === "search" && Array.isArray((data as JobsSearch).groups)) {
      setQueryData<JobsSearch>(key, (d) => ({ ...(d as JobsSearch), groups: (d as JobsSearch).groups.map((g) => ({ ...g, rows: swap(g.rows, row) })) }));
    } else if (head === "schedule" && Array.isArray((data as ScheduleData).lanes)) {
      setQueryData<ScheduleData>(key, (d) => ({ ...(d as ScheduleData), lanes: (d as ScheduleData).lanes.map((l) => ({ ...l, rows: swap(l.rows, row) })) }));
    } else if (head === "my-day" && (data as MyDay).today) {
      setQueryData<MyDay>(key, (d) => ({
        today: { ...(d as MyDay).today, rows: swap((d as MyDay).today.rows, row) },
        tomorrow: { ...(d as MyDay).tomorrow, rows: swap((d as MyDay).tomorrow.rows, row) },
      }));
    }
  }
  refreshJobLists();
}

/** Lists, schedule, My day and the badges re-read in the background (never a spinner). */
export function refreshJobLists() {
  invalidateQueries(["jobs", "list"]);
  invalidateQueries(["jobs", "schedule"]);
  invalidateQueries(["jobs", "my-day"]);
  invalidateQueries(["jobs", "search"]);
  invalidateQueries("needs-action");
}

/* ------------------------------------------------------------------ */
/* Words                                                               */
/* ------------------------------------------------------------------ */

const TZ = "America/New_York";

export function nyYMD(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function todayYMD(): string {
  return nyYMD(new Date());
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function isYMD(value: string | null | undefined): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

/** "8:00 AM" in New York. */
export function timeNY(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
}

/** "Thu, Nov 12" for a YYYY-MM-DD. */
export function dayLabel(ymd: string, { year = false }: { year?: boolean } = {}): string {
  if (!isYMD(ymd)) return ymd || "No date";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
}

/** "Today", "Tomorrow", "Yesterday" or "Thu, Nov 12". */
export function relativeDay(ymd: string): string {
  const today = todayYMD();
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  if (ymd === addDays(today, -1)) return "Yesterday";
  return dayLabel(ymd, { year: ymd.slice(0, 4) !== today.slice(0, 4) });
}

/** "Thu, Nov 12 · 8:00–9:30 AM" (a Full Day says so instead of a window). */
export function whenText(job: Pick<JobRow, "date" | "endEstimate" | "type">): string {
  if (!job.date) return "No date set";
  const day = dayLabel(nyYMD(job.date), { year: nyYMD(job.date).slice(0, 4) !== todayYMD().slice(0, 4) });
  if (job.type === "full_day") return `${day} · Full Day`;
  const start = timeNY(job.date);
  const end = timeNY(job.endEstimate);
  if (!end) return `${day} · ${start}`;
  const [sTime, sPeriod] = start.split(" ");
  const [eTime, ePeriod] = end.split(" ");
  return sPeriod === ePeriod ? `${day} · ${sTime}–${eTime} ${ePeriod}` : `${day} · ${start}–${end}`;
}

const FLAG_ORDER = ["reservation_issue", "payment_problem", "not_closed", "request_review", "payment_pending", "unassigned", "repeat_check"];

/** The single most important flag of a row (problems first). */
export function topFlag(row: Pick<JobRow, "flags">): JobFlag | null {
  const flags = [...(row.flags || [])];
  if (!flags.length) return null;
  flags.sort((a, b) => {
    const s = (a.severity === "problem" ? 0 : 1) - (b.severity === "problem" ? 0 : 1);
    if (s) return s;
    const ia = FLAG_ORDER.indexOf(String(a.key));
    const ib = FLAG_ORDER.indexOf(String(b.key));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return flags[0];
}

/** The kit's TypeBadge colour for a server type key. */
export function badgeTypeOf(type: string): "member" | "free" | "fullday" | "onetime" {
  if (type === "full_day") return "fullday";
  if (type === "free_visit" || type === "admin_free") return "free";
  if (type === "one_time") return "onetime";
  return "member";
}

/** Short type label for a row badge. */
export function shortTypeLabel(row: Pick<JobRow, "type" | "typeLabel">): string {
  switch (row.type) {
    case "member":
      return "Member";
    case "one_time":
      return "One-time";
    case "full_day":
      return "Full Day";
    case "admin_free":
      return "Admin free";
    case "free_visit":
      return /to-do/i.test(row.typeLabel) ? "Free · review" : "Free visit";
    default:
      return row.typeLabel || "Visit";
  }
}

/** "T. One" from "Test One"; the whole name when it is one word. */
export function shortName(name: string | null | undefined): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

const REASONS: Record<string, string> = {
  not_requested: "not asked to send",
  no_email_on_file: "no email on file",
  no_phone_on_file: "no phone on file",
  not_confirmed: "the job is not confirmed",
  already_sent: "already sent before",
  sms_disabled_on_server: "texts are switched off on the server",
  transactional_not_opted_in: "the customer has not agreed to service texts",
  provider_error_retrying: "the provider failed; it will retry",
  service_email_off: "service emails are off for this customer",
  no_template_for_pending: "no message is sent while the job is pending",
  quiet_hours: "quiet hours; it goes out in the morning",
  opted_out: "the customer replied STOP",
  blocked: "the customer is blocked",
};

function reasonText(reason: string): string {
  return REASONS[reason] || String(reason || "no reason given").replace(/_/g, " ");
}

/**
 * What the customer was actually told, one line per channel:
 * "Email sent", "Text not sent: the customer has not agreed to service texts".
 * When nothing went out it says so plainly (no usable channel).
 */
export function describeNotifications(list: Notification[] | null | undefined): { lines: { text: string; tone: "ok" | "muted" | "problem" }[]; nothingSent: boolean } {
  const items = Array.isArray(list) ? list : [];
  const lines = items.map((n) => {
    const channel = n.channel === "sms" ? "Text" : n.channel === "email" ? "Email" : String(n.channel || "Message");
    const purpose = n.purpose === "assignment" ? " (new Fixter)" : "";
    if (n.status === "sent") return { text: `${channel}${purpose} sent`, tone: "ok" as const };
    if (n.status === "failed") return { text: `${channel}${purpose} failed: ${reasonText(n.reason)}`, tone: "problem" as const };
    return { text: `${channel}${purpose} not sent: ${reasonText(n.reason)}`, tone: "muted" as const };
  });
  const nothingSent = items.length > 0 && !items.some((n) => n.status === "sent");
  return { lines, nothingSent };
}

/** Google or Apple directions through stops, without an origin (J-25): the phone starts from where it is. */
export function routeUrl(stops: string[], app: "google" | "apple"): string {
  const clean = stops.map((s) => s.trim()).filter(Boolean);
  if (!clean.length) return "";
  if (app === "apple") {
    return `https://maps.apple.com/?daddr=${clean.map(encodeURIComponent).join("+to:")}&dirflg=d`;
  }
  const destination = clean[clean.length - 1];
  const waypoints = clean.slice(0, -1);
  const params = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Google allows 9 waypoints plus the destination in a link: longer days are split into legs. */
export function routeLegs(stops: string[], size = 10): string[][] {
  if (stops.length <= size) return [stops];
  const legs: string[][] = [];
  for (let i = 0; i < stops.length; i += size - 1) {
    const leg = stops.slice(i, i + size);
    if (leg.length > 1 || !legs.length) legs.push(leg);
    if (i + size >= stops.length) break;
  }
  return legs;
}

export function stopAddress(row: Pick<JobRow, "addressShort" | "town">): string {
  return [row.addressShort, row.town, "NY"].filter(Boolean).join(", ");
}

/** The error a mutation should show, with the server's code. */
export function conflictOf(error: unknown): { code: string; message: string; currentStatus?: string } | null {
  const e = error as { response?: { status?: number; data?: { code?: string; message?: string; currentStatus?: string } } };
  const code = e?.response?.data?.code;
  if (!code) return null;
  return { code, message: e.response?.data?.message || "", currentStatus: e.response?.data?.currentStatus };
}

/** CSV for the rows on screen (J-26: the date column has the date, not only the time). */
export function rowsToCsv(rows: JobRow[]): string {
  const head = ["Date (NY)", "Time (NY)", "Booking #", "Customer", "Phone", "Street", "Town", "Type", "Status", "Fixter", "Flags"];
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) =>
    [nyYMD(r.date), timeNY(r.date), r.bookingNumber, r.customer?.name || "", r.customer?.phone || "", r.addressShort, r.town, r.typeLabel, r.status, r.technician?.name || "Unassigned", (r.flags || []).map((f) => f.label).join("; ")]
      .map((v) => cell(String(v ?? "")))
      .join(",")
  );
  return [head.join(","), ...lines].join("\n");
}
