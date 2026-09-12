import type { MembershipMapPoint } from "@/lib/public-membership-map";
import { MARKER_RADIUS } from "./markers";

/**
 * Nudge overlapping markers apart, in screen space only.
 *
 * WHAT THIS IS, AND WHAT IT CAREFULLY IS NOT.
 *
 * It is a rendering treatment. It runs in the browser on coordinates that are
 * already public, moves nothing by more than a few pixels, and never touches the
 * payload, the server, or the geography. Nothing here makes a marker more
 * accurate - the displacement is away from the published position, not towards
 * anybody's house, so it can only ever reduce what a pin implies.
 *
 * WHY IT IS NEEDED AT ALL.
 *
 * Placement is deliberately town-honest: members in one ZIP sit within about
 * 800m of their town's anchor. At Long Island scale on a 390px phone, one pixel
 * is roughly 420 metres - so four genuinely distinct memberships 800m apart
 * occupy about two pixels and merge into a single blob. Widening the geographic
 * spread would fix the picture by making the map lie, which is exactly the V1
 * mistake. So the geography stays and the pixels move.
 *
 * THE CAP IS THE WHOLE DESIGN. A few pixels is enough to show a seam between
 * two markers and far too little to relocate anything: at mobile scale the
 * entire budget is under a kilometre and a half of apparent movement, well
 * inside the ZIP the pin already belongs to, and at desktop scale it is a couple
 * of hundred metres. It declutters; it cannot mislead.
 */

/** Hard ceiling on how far a marker may be nudged, in rendered pixels. */
export const MAX_DISPLACEMENT_PX = 3.5;

/**
 * How close two markers must be before they count as colliding, as a multiple
 * of their combined drawn radius. Slightly under 1 so that markers which merely
 * touch are left alone - a little overlap reads fine, total eclipse does not.
 */
const COLLISION_FACTOR = 0.92;

/** Golden angle, so a fanned-out group never looks like a clock face. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface PlacedPoint extends MembershipMapPoint {
  /** Where to actually draw, in viewBox units. */
  dx: number;
  dy: number;
}

/**
 * Group points that visually collide, then fan each group apart.
 *
 * Deterministic from end to end: groups are formed by scanning points in the
 * order the server sent them (which is itself sorted), and each member's nudge
 * direction comes from its index in the group. The same data therefore produces
 * the same picture on every render, so a refresh does not make the map twitch.
 */
export function declutter(
  points: MembershipMapPoint[],
  scale: number,
  pxPerUnit: number
): PlacedPoint[] {
  const out: PlacedPoint[] = points.map((p) => ({ ...p, dx: p.x, dy: p.y }));
  if (!points.length || !Number.isFinite(pxPerUnit) || pxPerUnit <= 0) return out;

  /* The budget, converted from pixels into the units the SVG is drawn in. */
  const budget = MAX_DISPLACEMENT_PX / pxPerUnit;

  const radiusOf = (p: MembershipMapPoint) => MARKER_RADIUS[p.plan] * scale;

  /*
   * Single linkage: anything overlapping anything already in the group joins
   * it. A chain of three near-touching pins is one problem, not two.
   */
  const groupOf = new Int32Array(points.length).fill(-1);
  let groups = 0;

  for (let i = 0; i < points.length; i += 1) {
    if (groupOf[i] !== -1) continue;
    groupOf[i] = groups;
    const queue = [i];
    while (queue.length) {
      const a = queue.pop() as number;
      for (let b = 0; b < points.length; b += 1) {
        if (groupOf[b] !== -1) continue;
        const reach = (radiusOf(points[a]) + radiusOf(points[b])) * COLLISION_FACTOR;
        const dx = points[a].x - points[b].x;
        const dy = points[a].y - points[b].y;
        if (dx * dx + dy * dy <= reach * reach) {
          groupOf[b] = groups;
          queue.push(b);
        }
      }
    }
    groups += 1;
  }

  /* Fan each crowded group; leave solitary markers exactly where they are. */
  const members: number[][] = Array.from({ length: groups }, () => []);
  for (let i = 0; i < points.length; i += 1) members[groupOf[i]].push(i);

  for (const group of members) {
    if (group.length < 2) continue;
    group.forEach((index, slot) => {
      const angle = slot * GOLDEN_ANGLE;
      /*
       * Every member of a group is pushed the full budget, in a different
       * direction each. Pushing proportionally to group size would let a large
       * group creep further than the cap allows, and the cap is the point.
       */
      out[index].dx = points[index].x + Math.cos(angle) * budget;
      out[index].dy = points[index].y + Math.sin(angle) * budget;
    });
  }

  return out;
}
