/**
 * Navigation badges from the shared Needs-action aggregator
 * (GET /api/admin/needs-action, built by track BE-BOOK; see the brief).
 *
 * Each collector reports { key, count, items }. The aggregator already skips
 * collectors the caller may not see, so a badge only ever counts what this
 * person is allowed to act on. The parser accepts the likely envelopes
 * ({ groups: [...] }, { collectors: [...] }, { sections: {key: {...}} } or a
 * bare map) so the shell does not break while the backend settles; a 404
 * from an older backend means "no badges", never an error on screen.
 */
import API from "@/lib/api";

export type NeedsActionCounts = {
  bookings: number;
  members: number;
  projects: number;
  total: number;
};

type Group = { key?: string; id?: string; count?: number; items?: unknown[] };

function countOf(group: Group | undefined): number {
  if (!group || typeof group !== "object") return 0;
  if (typeof group.count === "number" && Number.isFinite(group.count)) return Math.max(0, group.count);
  return Array.isArray(group.items) ? group.items.length : 0;
}

export function parseNeedsAction(body: unknown): NeedsActionCounts {
  const out: NeedsActionCounts = { bookings: 0, members: 0, projects: 0, total: 0 };
  if (!body || typeof body !== "object") return out;
  const b = body as Record<string, unknown>;
  // BE-BOOK ships { sections: [{ key, count, items }] } (an array), checked first.
  const list = (Array.isArray(b.sections) ? b.sections : Array.isArray(b.groups) ? b.groups : Array.isArray(b.collectors) ? b.collectors : null) as Group[] | null;
  const map = (list ? null : (b.sections && typeof b.sections === "object" ? b.sections : b.collectors && typeof b.collectors === "object" ? b.collectors : b)) as Record<string, Group> | null;
  const read = (key: keyof Omit<NeedsActionCounts, "total">) => {
    if (list) return countOf(list.find((g) => g?.key === key || g?.id === key));
    return countOf(map?.[key]);
  };
  out.bookings = read("bookings");
  out.members = read("members");
  out.projects = read("projects");
  out.total = typeof b.total === "number" ? b.total : out.bookings + out.members + out.projects;
  return out;
}

export async function fetchNeedsActionCounts(signal: AbortSignal): Promise<NeedsActionCounts | null> {
  try {
    const response = await API.get("/api/admin/needs-action", { params: { limit: 1 }, signal });
    return parseNeedsAction(response.data);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403) return null;
    throw error;
  }
}
