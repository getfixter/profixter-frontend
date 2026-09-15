import * as THREE from "three";

/**
 * The stage: a 2D page, not a 3D room.
 *
 * The whole experience is a 3D character and 3D-looking props living ON a flat
 * webpage. So placement has exactly two meaningful axes — across the screen and
 * up the screen — and depth is reserved for the things depth is actually for:
 * the thickness of an object, a hand reaching out toward the viewer, keeping
 * two coplanar faces from z-fighting.
 *
 *     stage x  = -1 left edge   .. +1 right edge
 *     stage y  = -1 bottom edge .. +1 top edge
 *     world z  = layering and reach only. Never travel.
 *
 * Positions are normalised rather than given in world units, because the point
 * is to be able to say "upper left", "right edge", "under the headline" and
 * have that survive a change of viewport. A phone is not a narrow desktop: it
 * is a tall stage with its own arrangement, and the same job can sit in a
 * different place on each without being redefined.
 */

export type LayoutId = "desktop" | "tablet" | "mobile";

/** Normalised stage coordinates, -1..1 on both axes. */
export type StagePoint = { x: number; y: number };

/**
 * How much world the stage shows, and how far in from the edge anything sits.
 *
 * Height is in world units (the Fixter is 1.7 tall). Portrait gets a much
 * taller stage and a narrower one, which is the entire reason mobile can have a
 * real vertical tour instead of a horizontal shuffle with dead space above it.
 */
export const STAGE: Record<LayoutId, { height: number; inset: number }> = {
  desktop: { height: 5.6, inset: 0.14 },
  tablet: { height: 6.6, inset: 0.13 },
  mobile: { height: 7.0, inset: 0.09 },
};

/**
 * Named regions.
 *
 * These exist so a job's placement can be discussed the way a page is, and so
 * that when this meets real homepage content the anchors can be re-pointed at
 * "left of the headline" rather than at a number somebody has to re-derive.
 */
export const REGIONS = {
  upperLeft: { x: -0.74, y: 0.66 },
  upperMid: { x: -0.02, y: 0.78 },
  upperRight: { x: 0.74, y: 0.62 },
  midLeft: { x: -0.82, y: 0.06 },
  centre: { x: 0, y: 0 },
  midRight: { x: 0.8, y: 0.02 },
  lowerLeft: { x: -0.7, y: -0.62 },
  lowerMid: { x: 0.04, y: -0.78 },
  lowerRight: { x: 0.72, y: -0.6 },
} as const satisfies Record<string, StagePoint>;

export type RegionName = keyof typeof REGIONS;

/** Half-extents of the usable stage in world units, for a given viewport. */
export function stageExtent(layout: LayoutId, aspect: number) {
  const { height, inset } = STAGE[layout];
  const halfHeight = (height / 2) * (1 - inset);
  const halfWidth = ((height * Math.max(aspect, 0.25)) / 2) * (1 - inset);
  return { halfWidth, halfHeight, height };
}

/** Normalised stage point to a world position on the z = 0 plane. */
export function stageToWorld(
  point: StagePoint,
  layout: LayoutId,
  aspect: number,
  z = 0
): THREE.Vector3 {
  const { halfWidth, halfHeight } = stageExtent(layout, aspect);
  return new THREE.Vector3(point.x * halfWidth, point.y * halfHeight, z);
}

/** Pick the layout from the viewport's shape, not just its width. */
export function layoutForViewport(width: number, height: number): LayoutId {
  if (width < 760) return "mobile";
  if (width < 1180 || width / Math.max(height, 1) < 1.2) return "tablet";
  return "desktop";
}
