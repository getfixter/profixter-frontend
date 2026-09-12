/**
 * The public membership map feed.
 *
 * Unauthenticated, cached hard at the edge, and carrying nothing that belongs
 * to anybody: a drawing position and a plan word per active membership. There
 * is no id to request, no filter to widen and no customer to look up - the
 * endpoint answers one question and has one shape.
 *
 * A failure here is not an error the visitor should ever see. The map is a
 * decoration on a marketing page; if the feed is unavailable the section simply
 * does not render.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

/** The four tiers, lowercase, exactly as the server emits them. */
export type MembershipPlan = "basic" | "plus" | "premium" | "elite";

export interface MembershipMapPoint {
  /** Position inside the map viewBox. Not a coordinate; see the server module. */
  x: number;
  y: number;
  plan: MembershipPlan;
}

export interface MembershipMapData {
  viewBox: { width: number; height: number } | null;
  points: MembershipMapPoint[];
}

const PLANS: readonly MembershipPlan[] = ["basic", "plus", "premium", "elite"];

function isPlan(value: unknown): value is MembershipPlan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

/**
 * Keep only rows that are structurally sound.
 *
 * A malformed row is dropped, never rendered half-drawn and never allowed to
 * throw. One bad record must not cost the whole section, and a plan the client
 * does not recognise has no marker design to use - guessing one would invent a
 * tier that does not exist.
 */
function sanitize(raw: unknown): MembershipMapPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: MembershipMapPoint[] = [];
  for (const row of raw) {
    const point = row as Partial<MembershipMapPoint>;
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    if (!isPlan(point?.plan)) continue;
    out.push({ x: Number(point.x), y: Number(point.y), plan: point.plan });
  }
  return out;
}

export async function fetchMembershipMap(signal?: AbortSignal): Promise<MembershipMapData> {
  const res = await fetch(`${BASE}/api/membership-map`, { signal });
  if (!res.ok) throw new Error(`membership map: ${res.status}`);
  const data = await res.json();

  const width = Number(data?.viewBox?.width);
  const height = Number(data?.viewBox?.height);

  return {
    viewBox:
      Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
        ? { width, height }
        : null,
    points: sanitize(data?.points),
  };
}
