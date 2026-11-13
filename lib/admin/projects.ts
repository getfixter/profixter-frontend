/**
 * The redesigned Projects screens' data layer: the BE-DOCS project workflow
 * endpoints (POST /api/admin/projects/search, GET /:id/overview, status,
 * visits, schedule, closeout, punch list, billing from the agreement).
 *
 * Shapes follow reports/BE-DOCS.md section B exactly. Money is always integer
 * cents from the server's financial service; nothing here derives a total.
 * Search text travels in a POST body, never in a URL.
 */
import API from "@/lib/api";
import type { Project } from "@/lib/admin-service";

export type StageKey =
  | "lead"
  | "proposal_issued"
  | "signed"
  | "deposit_paid"
  | "in_progress"
  | "substantially_complete"
  | "paid_in_full"
  | "warranty"
  | "closed"
  | "canceled";

export type DerivedStage = { key: StageKey | string; label: string };

/** The stage order the filter chips follow (work order, not alphabetical). */
export const STAGE_ORDER: StageKey[] = [
  "lead",
  "proposal_issued",
  "signed",
  "deposit_paid",
  "in_progress",
  "substantially_complete",
  "paid_in_full",
  "warranty",
  "closed",
  "canceled",
];

export const STAGE_LABELS: Record<StageKey, string> = {
  lead: "Lead",
  proposal_issued: "Proposal issued",
  signed: "Signed",
  deposit_paid: "Deposit paid",
  in_progress: "In progress",
  substantially_complete: "Substantially complete",
  paid_in_full: "Paid in full",
  warranty: "Under warranty",
  closed: "Closed",
  canceled: "Canceled",
};

export type ProjectRow = {
  id: string;
  projectNumber: string;
  customerName: string;
  address: string;
  phone: string;
  email: string;
  projectType: string;
  manualStatus: string;
  derivedStage: DerivedStage;
  scheduledStart: string | null;
  executedValueCents: number;
  proposedValueCents: number;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
  createdAt: string;
  href: string;
  /** Optional: a next-step summary if the server adds one to the list row. */
  nextStep?: { key: string; label: string; severity: Severity } | null;
};

export type ProjectSearchBody = { search?: string; status?: string; stage?: string; page?: number; limit?: number };
export type ProjectSearchResult = { projects: ProjectRow[]; total: number; page: number; limit: number; stages: Record<string, string> };

export type Severity = "problem" | "attention" | "info";

export type NextStepAction =
  | { type: "navigate"; href: string }
  | { type: "endpoint"; method: string; endpoint: string; body?: Record<string, unknown> };

export type NextStep = { key: string; label: string; detail: string; severity: Severity; action: NextStepAction };

export type SignatureState = {
  id: string;
  status: string;
  mode: string;
  sentAt: string | null;
  openedAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  live: boolean;
} | null;

export type DocAgreement = {
  id: string;
  contractNumber: string;
  version: number;
  status: string;
  current: boolean;
  priceCents: number;
  depositAmountCents: number;
  signature: SignatureState;
};
export type DocChangeOrder = { id: string; changeOrderNumber: string; title: string; status: string; netAdjustmentCents: number; signature: SignatureState };
export type DocInvoice = { id: string; invoiceNumber: string; status: string; totalCents: number; paidCents: number; balanceCents: number; dueDate: string | null; overdue: boolean };

export type PunchItem = { id: string; text: string; done: boolean; doneAt: string | null; createdAt?: string | null };
export type StatusHistoryEntry = { from: string; to: string; at: string; actorName?: string; reason?: string; source?: string };

export type LinkedBooking = { id: string; bookingNumber: string; date: string | null; status: string; service: string; isSiteVisit: boolean; href: string };

export type Qualification = {
  source?: string;
  service?: string;
  serviceLabel?: string;
  budgetRange?: string;
  timeline?: string;
  financing?: string;
  estimateLow?: number | null;
  estimateHigh?: number | null;
  answers?: Record<string, Record<string, string | string[] | number | boolean>>;
  contactPref?: string;
  bestTime?: string;
  notes?: string;
  sourcePage?: string;
  leadSource?: string;
  requestedDate?: string;
  requestedTime?: string;
  submittedAt?: string | null;
};

export type ProjectOverview = {
  project: {
    id: string;
    projectNumber: string;
    customerName: string;
    email: string;
    phone: string;
    address: string;
    customerId: string | null;
    projectType: string;
    notes: string;
    isDeleted: boolean;
    qualification: Qualification | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    assignedFixterIds: string[];
    substantialCompletionAt: string | null;
    warrantyEndsAt: string | null;
    punchList: PunchItem[];
    statusHistory: StatusHistoryEntry[];
    createdAt: string;
    updatedAt: string;
  };
  manualStatus: string;
  derivedStage: DerivedStage;
  financials: {
    executedValueCents: number;
    proposedValueCents: number;
    invoicedCents: number;
    paidCents: number;
    outstandingCents: number;
    uninvoicedExecutedCents: number;
    agreementSigned: boolean;
    pendingChangeOrderCents: number;
  };
  nextSteps: NextStep[];
  documents: { agreements: DocAgreement[]; changeOrders: DocChangeOrder[]; invoices: DocInvoice[] };
  linkedBookings: LinkedBooking[];
  lead: { model: string; id: string; href: string } | null;
  allowedActions: { edit: boolean; markSubstantiallyComplete: boolean; createDepositInvoice: boolean; linkBooking: boolean; editPunchList: boolean };
};

export const projectKeys = {
  list: (body: ProjectSearchBody) => ["projects", "search", JSON.stringify(body)] as const,
  overview: (id: string) => ["projects", "overview", id] as const,
  record: (id: string) => ["projects", "record", id] as const,
};

/** A client UUID for one money-moving or customer-visible intent. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeRow(raw: Partial<ProjectRow> & Record<string, unknown>): ProjectRow {
  return {
    id: String(raw.id || ""),
    projectNumber: String(raw.projectNumber || ""),
    customerName: String(raw.customerName || ""),
    address: String(raw.address || ""),
    phone: String(raw.phone || ""),
    email: String(raw.email || ""),
    projectType: String(raw.projectType || ""),
    manualStatus: String(raw.manualStatus || ""),
    derivedStage: raw.derivedStage && typeof raw.derivedStage === "object" ? (raw.derivedStage as DerivedStage) : { key: "lead", label: "Lead" },
    scheduledStart: (raw.scheduledStart as string) || null,
    executedValueCents: cents(raw.executedValueCents),
    proposedValueCents: cents(raw.proposedValueCents),
    invoicedCents: cents(raw.invoicedCents),
    paidCents: cents(raw.paidCents),
    outstandingCents: cents(raw.outstandingCents),
    createdAt: String(raw.createdAt || ""),
    href: String(raw.href || `/admin/projects/${raw.id}`),
    nextStep: (raw.nextStep as ProjectRow["nextStep"]) || null,
  };
}

export async function searchProjects(body: ProjectSearchBody, signal?: AbortSignal): Promise<ProjectSearchResult> {
  const response = await API.post("/api/admin/projects/search", body, { signal });
  const data = response.data || {};
  const rows = Array.isArray(data.projects) ? data.projects.filter((p: { id?: string }) => p && p.id).map(normalizeRow) : [];
  return {
    projects: rows,
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : rows.length,
    page: Number(data.page) || 1,
    limit: Number(data.limit) || body.limit || 25,
    stages: data.stages && typeof data.stages === "object" ? data.stages : STAGE_LABELS,
  };
}

export async function fetchProjectOverview(id: string, signal?: AbortSignal): Promise<ProjectOverview> {
  const response = await API.get(`/api/admin/projects/${encodeURIComponent(id)}/overview`, { signal });
  const data = response.data as ProjectOverview;
  if (!data?.project?.id) throw Object.assign(new Error("This project could not be read."), { response: { status: 502, data: { message: "This project could not be read." } } });
  return {
    ...data,
    nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
    linkedBookings: Array.isArray(data.linkedBookings) ? data.linkedBookings : [],
    documents: {
      agreements: data.documents?.agreements || [],
      changeOrders: data.documents?.changeOrders || [],
      invoices: data.documents?.invoices || [],
    },
    project: { ...data.project, punchList: data.project.punchList || [], statusHistory: data.project.statusHistory || [], assignedFixterIds: data.project.assignedFixterIds || [] },
  };
}

/** The full project record the document components (agreement, invoices ...) work from. */
export async function fetchProjectRecord(id: string, signal?: AbortSignal): Promise<Project> {
  const response = await API.get(`/api/admin/projects/${encodeURIComponent(id)}`, { signal });
  const project = response.data?.project as Project | undefined;
  if (!project?._id) throw Object.assign(new Error("Project not found"), { response: { status: 404, data: { message: "Project not found" } } });
  return project;
}

export async function setProjectStatus(id: string, body: { status: string; expectedStatus: string; reason?: string }) {
  const response = await API.put(`/api/admin/projects/${encodeURIComponent(id)}/status`, body);
  return response.data as { project: { id: string; status: string; updatedAt?: string } };
}

export type LinkResult = { linkedBookingIds: string[]; siteVisitBookingId: string | null; updatedAt: string };

export async function linkProjectBooking(id: string, bookingId: string, siteVisit = false): Promise<LinkResult> {
  const response = await API.post(`/api/admin/projects/${encodeURIComponent(id)}/bookings`, { bookingId, siteVisit });
  return response.data;
}

export async function unlinkProjectBooking(id: string, bookingId: string): Promise<LinkResult> {
  const response = await API.delete(`/api/admin/projects/${encodeURIComponent(id)}/bookings/${encodeURIComponent(bookingId)}`);
  return response.data;
}

export async function saveProjectSchedule(
  id: string,
  body: { scheduledStart?: string | null; scheduledEnd?: string | null; assignedFixterIds?: string[]; expectedUpdatedAt?: string }
) {
  const response = await API.put(`/api/admin/projects/${encodeURIComponent(id)}/schedule`, body);
  return response.data as { scheduledStart: string | null; scheduledEnd: string | null; assignedFixterIds: string[]; updatedAt: string };
}

export async function markSubstantiallyComplete(id: string, completedAt?: string) {
  const response = await API.post(`/api/admin/projects/${encodeURIComponent(id)}/substantial-completion`, { confirm: true, ...(completedAt ? { completedAt } : {}) });
  return response.data as {
    substantialCompletionAt: string;
    warrantyEndsAt: string | null;
    warrantyTermsVersion: string;
    warranty: { months: number; startsAt: string } | null;
    updatedAt: string;
  };
}

export type PunchResult = { punchList: PunchItem[]; updatedAt: string };

export async function addPunchItem(id: string, text: string): Promise<PunchResult> {
  return (await API.post(`/api/admin/projects/${encodeURIComponent(id)}/punch-list`, { text })).data;
}
export async function updatePunchItem(id: string, itemId: string, patch: { text?: string; done?: boolean }): Promise<PunchResult> {
  return (await API.patch(`/api/admin/projects/${encodeURIComponent(id)}/punch-list/${encodeURIComponent(itemId)}`, patch)).data;
}
export async function removePunchItem(id: string, itemId: string): Promise<PunchResult> {
  return (await API.delete(`/api/admin/projects/${encodeURIComponent(id)}/punch-list/${encodeURIComponent(itemId)}`)).data;
}

export type BillResult = { replayed?: boolean; invoiceId?: string; invoiceNumber?: string; invoice?: { _id?: string; id?: string; invoiceNumber?: string }; kind: string; scheduleIndex: number | null };

export async function billFromSchedule(id: string, body: { kind: "deposit" | "milestone"; scheduleIndex?: number; idempotencyKey: string }): Promise<BillResult> {
  // The key goes in the body only: the API's CORS allow-list has no Idempotency-Key header.
  const response = await API.post(`/api/admin/projects/${encodeURIComponent(id)}/invoices/from-schedule`, body);
  return response.data;
}

/** Where an invoice lives (old email links): GET /api/admin/invoices/:id → {projectId}. */
export async function locateInvoice(invoiceId: string, signal?: AbortSignal): Promise<string | null> {
  const response = await API.get(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`, { signal, timeout: 8000 });
  const data = response.data || {};
  const projectId = data.projectId || data.invoice?.projectId || data.project?._id;
  return projectId ? String(projectId) : null;
}

/*
 * Next-step endpoint actions. The server names the endpoint; the browser only
 * runs the ones it knows, so a step can never make the admin POST to an
 * arbitrary path.
 */
export type StepEndpoint =
  | { kind: "send"; documentType: "CONTRACT" | "CHANGE_ORDER"; documentId: string }
  | { kind: "resend"; signatureId: string }
  | { kind: "bill"; billKind: "deposit" | "milestone"; scheduleIndex?: number };

export function classifyStepEndpoint(step: NextStep, projectId: string): StepEndpoint | null {
  if (step.action.type !== "endpoint") return null;
  const { endpoint, method, body } = step.action;
  if (String(method).toUpperCase() !== "POST") return null;
  if (endpoint === "/api/admin/signatures/native/send") {
    const documentType = String(body?.documentType || "");
    const documentId = String(body?.documentId || "");
    if ((documentType === "CONTRACT" || documentType === "CHANGE_ORDER") && /^[a-f0-9]{24}$/i.test(documentId) && String(body?.mode || "REMOTE") === "REMOTE") {
      return { kind: "send", documentType, documentId };
    }
    return null;
  }
  const resend = endpoint.match(/^\/api\/admin\/signatures\/native\/([a-f0-9]{24})\/resend$/i);
  if (resend) return { kind: "resend", signatureId: resend[1] };
  if (endpoint === `/api/admin/projects/${projectId}/invoices/from-schedule`) {
    const kind = String(body?.kind || "");
    if (kind === "deposit") return { kind: "bill", billKind: "deposit" };
    if (kind === "milestone" && Number.isInteger(Number(body?.scheduleIndex))) return { kind: "bill", billKind: "milestone", scheduleIndex: Number(body?.scheduleIndex) };
  }
  return null;
}

/** Map a server href (/admin/projects/:id?tab=x&invoice=y) to this screen's tab ids. */
export const PROJECT_TABS = ["overview", "estimate", "agreement", "change-orders", "invoices", "visits", "closeout"] as const;
export type ProjectTab = (typeof PROJECT_TABS)[number];

const TAB_ALIASES: Record<string, ProjectTab> = {
  overview: "overview",
  estimate: "estimate",
  estimates: "estimate",
  agreement: "agreement",
  contract: "agreement",
  contracts: "agreement",
  "change-orders": "change-orders",
  changeorders: "change-orders",
  "change_orders": "change-orders",
  invoices: "invoices",
  invoice: "invoices",
  visits: "visits",
  schedule: "visits",
  closeout: "closeout",
  "punch-list": "closeout",
};

export function normalizeTab(value: string | null | undefined): ProjectTab {
  return TAB_ALIASES[String(value || "").toLowerCase()] || "overview";
}

/** Dates in New York, the business's time zone. */
export function formatDay(value: string | null | undefined, withYear = true): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(d);
}

/** YYYY-MM-DD in New York, for <input type="date">. */
export function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

/** A date input's day as noon New York time (so no time zone moves it to the next or previous day). */
export function dayToIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T12:00:00-05:00`).toISOString();
}

/*
 * Attention badges for list rows. The search rows carry no next step, so the
 * list reads the server's Needs-action items (BE-DOCS collectors: deposit not
 * invoiced, signature declined or expired, invoice overdue) and keys them by
 * the project id in their href. A 404/403 means no badges.
 */
export type ProjectAttention = { title: string; severity: "attention" | "problem"; kind: string };

export async function fetchProjectAttention(signal: AbortSignal): Promise<Record<string, ProjectAttention>> {
  try {
    const response = await API.get("/api/admin/needs-action", { params: { limit: 100 }, signal });
    const data = response.data || {};
    const items: Array<Record<string, unknown>> = [
      ...(Array.isArray(data.items) ? data.items : []),
      ...(Array.isArray(data.sections) ? data.sections.flatMap((s: { items?: unknown[] }) => (Array.isArray(s?.items) ? s.items : [])) : []),
      ...(Array.isArray(data.groups) ? data.groups.flatMap((s: { items?: unknown[] }) => (Array.isArray(s?.items) ? s.items : [])) : []),
    ];
    const out: Record<string, ProjectAttention> = {};
    for (const item of items) {
      const match = String(item?.href || "").match(/^\/admin\/projects\/([a-f0-9]{24})(?:[/?#]|$)/i);
      if (!match) continue;
      const severity = item.severity === "problem" ? "problem" : "attention";
      const current = out[match[1]];
      if (current && (current.severity === "problem" || severity !== "problem")) continue;
      out[match[1]] = { title: String(item.title || "Needs attention"), severity, kind: String(item.kind || "") };
    }
    return out;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403) return {};
    throw error;
  }
}

/*
 * Customer-visible sends from a next step. The key rides in the body (never a
 * custom header, which the API's CORS allow-list would refuse) so a retry is
 * recognisable server-side once these routes support it.
 */
export async function sendSignatureRequest(documentType: "CONTRACT" | "CHANGE_ORDER", documentId: string, idempotencyKey: string) {
  const response = await API.post(
    "/api/admin/signatures/native/send",
    { documentType, documentId, mode: "REMOTE", idempotencyKey },
    { timeout: 300000 }
  );
  return response.data as { emailed?: boolean; signature?: { id?: string } };
}

export async function resendSignatureRequest(signatureId: string, idempotencyKey: string) {
  const response = await API.post(
    `/api/admin/signatures/native/${encodeURIComponent(signatureId)}/resend`,
    { idempotencyKey },
    { timeout: 120000 }
  );
  return response.data as { emailed?: boolean };
}

export type JobSearchRow = {
  id: string;
  bookingNumber: string;
  date: string | null;
  status: string;
  typeLabel?: string;
  customer?: { id: string | null; name: string; phone?: string };
  addressShort?: string;
  town?: string;
};

/** POST /api/admin/jobs/search (BE-BOOK): visits to link, by customer name, phone or address. */
export async function searchJobs(q: string, signal?: AbortSignal): Promise<JobSearchRow[]> {
  const response = await API.post("/api/admin/jobs/search", { q, limit: 30 }, { signal });
  const groups = Array.isArray(response.data?.groups) ? response.data.groups : [];
  return groups.flatMap((g: { rows?: JobSearchRow[] }) => (Array.isArray(g?.rows) ? g.rows : [])).filter((r: JobSearchRow) => r && r.id);
}
