/**
 * Shower Studio API clients.
 *
 * publicStudio: no account, no shared axios instance (so a visitor is never
 * bounced to /signin). The design is unlocked by an edit token kept in this
 * browser only.
 * adminStudio: the shared authenticated API instance.
 */
import API from "@/lib/api";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001").replace(/\/+$/, "");
/** Server-relative links (photos, catalog images) -> absolute API URLs. */
export const apiUrl = (u?: string | null) => (!u ? "" : /^https?:/.test(u) ? u : `${API_BASE}${u}`);

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EngineCatalog = any;
export type StudioState = any;

export type PublicCatalog = {
  catalog: EngineCatalog;
  projectTypes: { key: string; label: string; includes: string }[];
  disclaimer: string;
  packages: { key: string; name: string; description: string; skus: string[] }[];
  version: string;
};

/** Always an estimate. `basis` says whether it rests on the standard example size or the customer's measurements. */
export type PublicQuote = { complete: boolean; totalCents: number | null; display: string | null; label: string | null; basis: string | null; message: string; includes: string[] };
export type MeasureSource = "standard" | "customer";

class StudioError extends Error {
  status: number;
  errors?: { field: string; message: string }[];
  constructor(message: string, status: number, errors?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function req<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("X-Studio-Token", init.token);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit" });
  } catch {
    throw new StudioError("We couldn't reach Profixter. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new StudioError(body.message || "Something went wrong.", res.status, body.errors);
  return body as T;
}

export const publicStudio = {
  catalog: () => req<PublicCatalog>("/api/studio/catalog"),
  create: (projectType: string, extra: { exampleScene?: string | null; measureSource?: MeasureSource } = {}) => req<{ id: string; token: string }>("/api/studio/designs", { method: "POST", body: JSON.stringify({ projectType, ...extra }) }),
  get: (id: string, token: string) => req<{ id: string; status: string; projectType: string; state: StudioState; exampleScene: string | null; measureSource: MeasureSource; photo: { url: string; width: number; height: number } | null; submittedAt: string | null }>(`/api/studio/designs/${id}`, { token }),
  save: (id: string, token: string, body: { state?: StudioState; projectType?: string; exampleScene?: string | null; measureSource?: MeasureSource }) => req<{ ok: true }>(`/api/studio/designs/${id}`, { method: "PUT", token, body: JSON.stringify(body) }),
  uploadPhoto: (id: string, token: string, file: Blob) => {
    const f = new FormData();
    f.append("photo", file, "photo.jpg");
    return req<{ photo: { url: string; width: number; height: number } }>(`/api/studio/designs/${id}/photo`, { method: "POST", token, body: f });
  },
  uploadPreview: (id: string, token: string, blob: Blob) => {
    const f = new FormData();
    f.append("preview", blob, "preview.jpg");
    return req<{ ok: true }>(`/api/studio/designs/${id}/preview`, { method: "POST", token, body: f });
  },
  quote: (design: unknown, projectType: string, measureSource: MeasureSource = "standard") => req<PublicQuote>("/api/studio/quote", { method: "POST", body: JSON.stringify({ design, projectType, measureSource }) }),
  submit: (id: string, token: string, body: Record<string, unknown>) => req<{ ok: true; reference?: string; alreadySubmitted?: boolean }>(`/api/studio/designs/${id}/submit`, { method: "POST", token, body: JSON.stringify(body) }),
  remove: (id: string, token: string) => req<{ ok: true }>(`/api/studio/designs/${id}`, { method: "DELETE", token }),
};

/** This browser's design (id + edit token). Kept locally; never sent anywhere but our API. */
const KEY = "profixter:shower-studio:design";
export const localDesign = {
  get(): { id: string; token: string; startedAt: number } | null {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
  },
  set(v: { id: string; token: string; startedAt: number }) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

// ------------------------------------------------------------------ admin
const unwrap = async <T,>(p: Promise<{ data: T }>) => {
  try { return (await p).data; }
  catch (e: any) { throw new StudioError(e?.response?.data?.message || e?.message || "Request failed", e?.response?.status || 0, e?.response?.data?.errors); }
};

export const adminStudio = {
  fields: () => unwrap<{ categories: Record<string, { id: string; label: string; fields: any[] }[]> }>(API.get("/api/admin/studio/catalog/fields")),
  products: (q: Record<string, string> = {}) => unwrap<{ products: any[] }>(API.get("/api/admin/studio/products", { params: q })),
  product: (id: string) => unwrap<{ product: any }>(API.get(`/api/admin/studio/products/${id}`)),
  createProduct: (body: any) => unwrap<{ product: any }>(API.post("/api/admin/studio/products", body)),
  updateProduct: (id: string, body: any) => unwrap<{ product: any }>(API.put(`/api/admin/studio/products/${id}`, body)),
  setStatus: (id: string, status: string) => unwrap<{ product: any }>(API.post(`/api/admin/studio/products/${id}/status`, { status })),
  reorder: (ids: string[]) => unwrap<{ ok: true }>(API.post("/api/admin/studio/products/reorder", { ids })),
  uploadAsset: (id: string, file: File, extra: Record<string, string | number> = {}) => {
    const f = new FormData();
    f.append("file", file);
    for (const [k, v] of Object.entries(extra)) f.append(k, String(v));
    return unwrap<{ product: any }>(API.post(`/api/admin/studio/products/${id}/assets`, f, { timeout: 60000 }));
  },
  removeAsset: (id: string, assetId: string) => unwrap<{ product: any }>(API.delete(`/api/admin/studio/products/${id}/assets/${assetId}`)),
  completeness: () => unwrap<any>(API.get("/api/admin/studio/catalog/completeness")),
  importStarter: () => unwrap<{ added: number; skipped: number }>(API.post("/api/admin/studio/catalog/import-starter")),
  pricing: () => unwrap<{ pricing: any }>(API.get("/api/admin/studio/pricing")),
  savePricing: (body: any) => unwrap<{ pricing: any }>(API.put("/api/admin/studio/pricing", body)),
  designs: (q: Record<string, string> = {}) => unwrap<{ designs: any[] }>(API.get("/api/admin/studio/designs", { params: q })),
  design: (id: string) => unwrap<any>(API.get(`/api/admin/studio/designs/${id}`)),
  designByLead: (leadId: string) => unwrap<{ id: string }>(API.get(`/api/admin/studio/designs/by-lead/${leadId}`)),
  createDesign: (body: any) => unwrap<any>(API.post("/api/admin/studio/designs", body)),
  saveDesign: (id: string, body: any) => unwrap<any>(API.put(`/api/admin/studio/designs/${id}`, body)),
  quote: (id: string, body: any) => unwrap<any>(API.post(`/api/admin/studio/designs/${id}/quote`, body)),
  uploadPhoto: (id: string, file: Blob) => {
    const f = new FormData();
    f.append("photo", file, "photo.jpg");
    return unwrap<any>(API.post(`/api/admin/studio/designs/${id}/photo`, f, { timeout: 60000 }));
  },
  uploadPreview: (id: string, blob: Blob) => {
    const f = new FormData();
    f.append("preview", blob, "preview.jpg");
    return unwrap<any>(API.post(`/api/admin/studio/designs/${id}/preview`, f, { timeout: 60000 }));
  },
  addAdjustment: (id: string, body: any) => unwrap<any>(API.post(`/api/admin/studio/designs/${id}/adjustments`, body)),
  removeAdjustment: (id: string, adjId: string) => unwrap<any>(API.delete(`/api/admin/studio/designs/${id}/adjustments/${adjId}`)),
  proposal: (id: string) => unwrap<{ projectId: string; projectNumber: string; estimateId: string; estimateNumber: string; total: number; next: string }>(API.post(`/api/admin/studio/designs/${id}/proposal`, {})),
  deleteDesign: (id: string) => unwrap<{ ok: true }>(API.delete(`/api/admin/studio/designs/${id}`)),
};

export const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 });
export { StudioError };
