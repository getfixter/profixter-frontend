/**
 * The header search: one box over customers, jobs and projects
 * (POST /api/admin/search, BE-CUST). The text travels in the POST body only,
 * never in a URL. What comes back is scoped by the server: a field Fixter gets
 * only the jobs assigned to them and no customers or projects; the client
 * shows only the groups the server says this person may see.
 */
import API from "@/lib/api";
import { readRow, type CustomerRow } from "@/lib/admin/customers";

export type GlobalJobHit = {
  id: string;
  bookingNumber: string;
  date: string | null;
  service: string;
  status: string;
  customerName: string;
  address: string;
  assignedFixterName: string;
  href: string;
  open: boolean;
};

export type GlobalProjectHit = {
  id: string;
  projectNumber: string;
  projectType: string;
  customerName: string;
  status: string;
  address: string;
  href: string;
};

export type GlobalSearchResult = {
  query: string;
  customers: (CustomerRow & { href: string })[];
  jobs: GlobalJobHit[];
  projects: GlobalProjectHit[];
  scopes: { customers: boolean; jobs: "all" | "assigned" | false; projects: boolean };
};

/** The server needs at least this many characters (shorter queries return nothing). */
export const GLOBAL_SEARCH_MIN = 2;

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Only same-app admin paths are followed; anything else falls back to the id route. */
function safeHref(href: unknown, fallback: string): string {
  const h = str(href);
  return /^\/admin\/[A-Za-z0-9/_-]+$/.test(h) ? h : fallback;
}

export function readGlobalSearch(data: unknown): GlobalSearchResult {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const scopes = (d.scopes && typeof d.scopes === "object" ? d.scopes : {}) as Record<string, unknown>;
  const jobsScope = scopes.jobs === "all" || scopes.jobs === "assigned" ? scopes.jobs : false;
  return {
    query: str(d.query),
    customers: scopes.customers
      ? arr<Record<string, unknown>>(d.customers).map((c) => {
          const row = readRow(c as Partial<CustomerRow>);
          return { ...row, href: safeHref(c.href, `/admin/customers/${encodeURIComponent(row.id)}`) };
        })
      : [],
    jobs: jobsScope
      ? arr<Record<string, unknown>>(d.jobs).map((j) => ({
          id: str(j.id),
          bookingNumber: str(j.bookingNumber),
          date: j.date ? str(j.date) : null,
          service: str(j.service),
          status: str(j.status),
          customerName: str(j.customerName),
          address: str(j.address),
          assignedFixterName: str(j.assignedFixterName),
          href: safeHref(j.href, `/admin/jobs/${encodeURIComponent(str(j.id))}`),
          open: j.open !== false,
        }))
      : [],
    projects: scopes.projects
      ? arr<Record<string, unknown>>(d.projects).map((p) => ({
          id: str(p.id),
          projectNumber: str(p.projectNumber),
          projectType: str(p.projectType),
          customerName: str(p.customerName),
          status: str(p.status),
          address: str(p.address),
          href: safeHref(p.href, `/admin/projects/${encodeURIComponent(str(p.id))}`),
        }))
      : [],
    scopes: { customers: Boolean(scopes.customers), jobs: jobsScope, projects: Boolean(scopes.projects) },
  };
}

export async function searchEverything(q: string, signal: AbortSignal): Promise<GlobalSearchResult> {
  const { data } = await API.post("/api/admin/search", { q }, { signal });
  return readGlobalSearch(data);
}
