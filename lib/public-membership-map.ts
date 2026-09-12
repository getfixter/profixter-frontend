/**
 * The public membership map feed.
 *
 * Unauthenticated, cached hard at the edge, and carrying nothing that belongs
 * to anybody: a drawing position per active membership and nothing else. There
 * is no id to request, no filter to widen and no customer to look up - the
 * endpoint answers one question and has one shape.
 *
 * SINCE V3 IT DOES NOT CARRY THE MEMBERSHIP TIER EITHER. The map says that
 * somebody in this area is a member; which plan they pay for is not the public's
 * business, and a payload that included it would let anyone reading the network
 * tab rank ProFixter's customers by spend.
 *
 * A failure here is not an error the visitor should ever see. The map is a
 * decoration on a marketing page; if the feed is unavailable the section simply
 * does not render.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface MembershipMapPoint {
  /** Position inside the map viewBox. Not a coordinate; see the server module. */
  x: number;
  y: number;
}

export interface MembershipMapData {
  viewBox: { width: number; height: number } | null;
  points: MembershipMapPoint[];
}

/**
 * Keep only rows that are structurally sound.
 *
 * A malformed row is dropped, never rendered half-drawn and never allowed to
 * throw. One bad record must not cost the whole section.
 *
 * Note what this deliberately does NOT do: it does not read, keep or forward any
 * other field the server might one day send. The shape is rebuilt from two
 * numbers, so a field added upstream by accident cannot reach the DOM through
 * here.
 */
function sanitize(raw: unknown): MembershipMapPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: MembershipMapPoint[] = [];
  for (const row of raw) {
    const point = row as Partial<MembershipMapPoint>;
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
    out.push({ x: Number(point.x), y: Number(point.y) });
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
