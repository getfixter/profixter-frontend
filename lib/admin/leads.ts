/**
 * Leads for the redesigned Admin: one list over Request and EstimateLead
 * (POST /api/admin/leads/search), the full detail with every qualification
 * answer (GET /api/admin/leads/:model/:id) and conversion into a project
 * (POST /api/admin/leads/:model/:id/convert-to-project, idempotent).
 *
 * Status changes and delete keep the existing routes
 * (PUT /api/admin/requests/:legacyId/status, DELETE /api/admin/requests/:legacyId),
 * which hold the server rules: a visit-linked lead's status follows its visit
 * (409 STATUS_FOLLOWS_VISIT), and delete needs the lead's name typed exactly.
 */
import API from "@/lib/api";
import type { Qualification } from "@/lib/admin/projects";

export type LeadModel = "request" | "estimate";

export type LeadRow = {
  key: string;
  legacyId: string;
  model: LeadModel;
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  service: string;
  serviceLabel: string;
  sourcePage: string;
  status: string;
  createdAt: string | null;
  projectId: string | null;
  bookingId: string | null;
  budgetRange: string;
  timeline: string;
  estimateLow: number | null;
  estimateHigh: number | null;
  href: string;
};

export type LeadDetail = LeadRow & {
  contactPref: string;
  bestTime: string;
  message: string;
  requestedDate: string;
  requestedTime: string;
  qualification: Qualification | null;
  allowedActions: { setStatus: boolean; statuses: string[]; convertToProject: boolean; openProject: boolean; delete: boolean };
};

export type LeadSearchBody = { search?: string; status?: string; model?: "" | LeadModel; page?: number; limit?: number };
export type LeadSearchResult = { leads: LeadRow[]; total: number; page: number; limit: number };

export const leadKeys = {
  list: (body: LeadSearchBody) => ["leads", "search", JSON.stringify(body)] as const,
  detail: (model: string, id: string) => ["leads", "detail", model, id] as const,
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Every form a lead id arrives in, to {model, id}:
 *   "estimate-<id>" / "request-<id>"   new hrefs (needs-action, email leadDetail links)
 *   "estimate:<id>"                     the old list's id for estimate leads
 *   "<id>"                              a bare Request id (old ?leadId= links)
 */
export function parseLeadRef(raw: string | null | undefined): { model: LeadModel; id: string; key: string; bare: boolean } | null {
  const value = decodeURIComponent(String(raw || "")).trim();
  const match = value.match(/^(request|estimate)[:-]([a-f0-9]{24})$/i);
  if (match) {
    const model = match[1].toLowerCase() as LeadModel;
    return { model, id: match[2], key: `${model}-${match[2]}`, bare: false };
  }
  if (OBJECT_ID.test(value)) return { model: "request", id: value, key: `request-${value}`, bare: true };
  return null;
}

function normalizeLead(raw: Partial<LeadRow>): LeadRow {
  const model: LeadModel = raw.model === "estimate" ? "estimate" : "request";
  const id = String(raw.id || "");
  const key = String(raw.key || `${model}-${id}`);
  return {
    key,
    legacyId: String(raw.legacyId || (model === "estimate" ? `estimate:${id}` : id)),
    model,
    id,
    name: String(raw.name || ""),
    email: String(raw.email || ""),
    phone: String(raw.phone || ""),
    address: String(raw.address || ""),
    service: String(raw.service || ""),
    serviceLabel: String(raw.serviceLabel || raw.service || ""),
    sourcePage: String(raw.sourcePage || ""),
    status: String(raw.status || "new"),
    createdAt: raw.createdAt || null,
    projectId: raw.projectId || null,
    bookingId: raw.bookingId || null,
    budgetRange: String(raw.budgetRange || ""),
    timeline: String(raw.timeline || ""),
    estimateLow: raw.estimateLow ?? null,
    estimateHigh: raw.estimateHigh ?? null,
    href: String(raw.href || `/admin/leads/${key}`),
  };
}

export async function searchLeads(body: LeadSearchBody, signal?: AbortSignal): Promise<LeadSearchResult> {
  const response = await API.post("/api/admin/leads/search", body, { signal });
  const data = response.data || {};
  const leads = Array.isArray(data.leads) ? data.leads.filter((l: Partial<LeadRow>) => l && l.id).map(normalizeLead) : [];
  return { leads, total: Number.isFinite(Number(data.total)) ? Number(data.total) : leads.length, page: Number(data.page) || 1, limit: Number(data.limit) || body.limit || 50 };
}

export async function fetchLead(model: LeadModel, id: string, signal?: AbortSignal): Promise<LeadDetail> {
  const response = await API.get(`/api/admin/leads/${model}/${encodeURIComponent(id)}`, { signal });
  const raw = response.data?.lead;
  if (!raw?.id) throw Object.assign(new Error("Lead not found"), { response: { status: 404, data: { message: "Lead not found" } } });
  return {
    ...normalizeLead(raw),
    contactPref: String(raw.contactPref || ""),
    bestTime: String(raw.bestTime || ""),
    message: String(raw.message || ""),
    requestedDate: String(raw.requestedDate || ""),
    requestedTime: String(raw.requestedTime || ""),
    qualification: raw.qualification || null,
    allowedActions: {
      setStatus: Boolean(raw.allowedActions?.setStatus),
      statuses: Array.isArray(raw.allowedActions?.statuses) ? raw.allowedActions.statuses : [],
      convertToProject: Boolean(raw.allowedActions?.convertToProject),
      openProject: Boolean(raw.allowedActions?.openProject),
      delete: Boolean(raw.allowedActions?.delete),
    },
  };
}

export type ConvertResult = { created: boolean; project: { id: string; projectNumber: string; customerName: string; status: string; projectType: string; href: string } };

export async function convertLeadToProject(model: LeadModel, id: string, body: { projectType?: string; address?: string } = {}): Promise<ConvertResult> {
  const response = await API.post(`/api/admin/leads/${model}/${encodeURIComponent(id)}/convert-to-project`, body);
  return response.data;
}

export async function setLeadStatus(legacyId: string, status: string) {
  const response = await API.put(`/api/admin/requests/${encodeURIComponent(legacyId)}/status`, { status });
  return response.data;
}

export async function deleteLead(legacyId: string, confirmation: string) {
  await API.delete(`/api/admin/requests/${encodeURIComponent(legacyId)}`, { data: { confirmation } });
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  pending_confirmation: "Pending confirmation",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
  confirmed: "Confirmed",
  completed: "Completed",
  declined: "Declined",
  canceled: "Canceled",
};

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status] || status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** "kitchenScope" → "Kitchen scope"; the estimate builder's own field names, readable. */
export function answerLabel(field: string): string {
  const words = field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "");
}

export function estimateRange(low: number | null | undefined, high: number | null | undefined): string {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const hasLow = typeof low === "number" && Number.isFinite(low);
  const hasHigh = typeof high === "number" && Number.isFinite(high);
  if (hasLow && hasHigh) return `${fmt(low as number)} – ${fmt(high as number)}`;
  if (hasLow) return `from ${fmt(low as number)}`;
  if (hasHigh) return `up to ${fmt(high as number)}`;
  return "";
}
