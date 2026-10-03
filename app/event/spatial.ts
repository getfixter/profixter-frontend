/**
 * The kiosk's spatial choreography: where every photo card sits in 3D for a
 * scene, and how it gets there from the previous scene.
 *
 * A card is one photo, shown whole (its box has the photo's own shape, so
 * nothing is cropped), placed with a single transform: translate3d, a small
 * rotation and a scale. Cards keep their identity from scene to scene, so a
 * photo that was the hero recedes into the field as a satellite, a wall tile
 * flies forward to become the next hero, and a swiped photo slides off the
 * side. Everything here is pure: scene + previous cards + stage -> cards.
 *
 * Only transform, opacity and (on small, distant cards) a little blur ever
 * change, so the tablet's compositor does all of the animating.
 */

import type { Measured, Scene } from "./display-engine";

export type Pose = { x: number; y: number; z: number; s: number; rx: number; ry: number; o: number; blur: number };
export type Role = "hero" | "pair" | "trio" | "wall" | "sat" | "field" | "exit";

export type Card = {
  id: string;
  photo: Measured;
  base: { w: number; h: number };
  role: Role;
  pose: Pose;
  /** Where a newly arrived card starts, before moving to `pose`. */
  enter: Pose | null;
  zIndex: number;
  /** Parallax factor while a finger drags the field: 1 for the hero, small and negative far away. */
  k: number;
  /** Idle drift slot (CSS), -1 for none. */
  float: number;
  /** Transition length for this move, ms. */
  t: number;
  /** When an exiting card can be removed; 0 for cards in the scene. */
  exitAt: number;
};

export type Geometry = {
  W: number;
  H: number;
  portrait: boolean;
  /** Vertical centre of the photo area, relative to the stage centre. */
  cy: number;
  avail: number;
};

export const MOVE_MS = 1900;
export const SWIPE_MS = 760;
export const MAX_CARDS = 24;

const MAX_SATELLITES = 4;

/** Breathing room between the photo and the fixed chrome, for its idle drift and glow. */
const CHROME_GAP = 14;

/**
 * The photo area is everything between the fixed chrome: below the mark and
 * above the rotating line. `safe` is measured from the real elements (see
 * EventKiosk), so the photos use all the space they can without ever sliding
 * under the branding or the call to action. Without a measurement it falls
 * back to fractions of the screen.
 */
export function geometry(W: number, H: number, safe?: { top: number; bottom: number }): Geometry {
  const portrait = W < H;
  const top = (safe ? safe.top : H * (portrait ? 0.09 : 0.11)) + CHROME_GAP;
  const bottom = (safe ? safe.bottom : H * (portrait ? 0.25 : 0.29)) + CHROME_GAP;
  const avail = Math.max(1, H - top - bottom);
  return { W, H, portrait, avail, cy: top + avail / 2 - H / 2 };
}

function fit(aspect: number, boxW: number, boxH: number) {
  const w = Math.min(boxW, boxH * aspect);
  return { w, h: w / aspect };
}

/** Every card's natural size is its hero size; other roles scale it down. */
function baseSize(photo: Measured, g: Geometry) {
  return g.portrait ? fit(photo.aspect, g.W * 0.94, g.avail) : fit(photo.aspect, g.W * 0.7, g.avail);
}

function scaleInto(base: { w: number; h: number }, boxW: number, boxH: number) {
  return Math.min(boxW / base.w, boxH / base.h);
}

const pose = (p: Partial<Pose>): Pose => ({ x: 0, y: 0, z: 0, s: 1, rx: 0, ry: 0, o: 1, blur: 0, ...p });

/** Four places in the depth field, around and behind the photo of the moment. */
function satellitePose(slot: number, g: Geometry, base: { w: number; h: number }): Pose {
  const { W, H } = g;
  const slots = g.portrait
    ? [
        { x: -0.36 * W, y: -0.31 * H, z: -760 },
        { x: 0.38 * W, y: -0.2 * H, z: -920 },
        { x: -0.4 * W, y: 0.14 * H, z: -860 },
        { x: 0.37 * W, y: 0.27 * H, z: -700 },
      ]
    : [
        { x: -0.4 * W, y: -0.26 * H, z: -760 },
        { x: 0.41 * W, y: -0.22 * H, z: -900 },
        { x: -0.42 * W, y: 0.2 * H, z: -880 },
        { x: 0.4 * W, y: 0.24 * H, z: -720 },
      ];
  const p = slots[slot % slots.length];
  const s = scaleInto(base, W * 0.5, H * 0.34);
  return pose({ ...p, s, ry: p.x < 0 ? 14 : -14, rx: p.y < 0 ? -6 : 6, o: 0.5, blur: 2.4 });
}

/** Where a new card appears from: deep in the field, or off the side it was swiped in from. */
function entryPose(target: Pose, g: Geometry, via?: 1 | -1): Pose {
  if (via) {
    return { ...target, x: target.x + via * g.W * 1.0, z: target.z - 260, ry: target.ry - via * 26, o: 1, blur: 0 };
  }
  return { ...target, z: target.z - 1500, s: target.s * 0.86, rx: target.rx + 4, o: 0, blur: 10 };
}

/** Where a card goes when it leaves the scene altogether. */
function exitPose(from: Pose, g: Geometry, via?: 1 | -1): Pose {
  if (via) {
    return { ...from, x: from.x - via * g.W * 1.05, z: from.z - 380, ry: from.ry + via * 26, o: 0, blur: 0 };
  }
  return { ...from, z: from.z - 900, s: from.s * 0.8, o: 0, blur: 8 };
}

/**
 * Lay out a scene.
 *
 * `prev` is what is on screen now; cards for photos that stay keep their
 * identity and simply move. `via` is set when a finger swiped: the new photo
 * slides in from that side and the old hero flies off the other.
 */
export function compose(scene: Scene, prev: Card[], g: Geometry, now: number, via?: 1 | -1): Card[] {
  const t = via ? SWIPE_MS : MOVE_MS;
  const live = prev.filter((c) => c.exitAt === 0);
  const pool = new Map(live.map((c) => [c.id, c]));
  const next: Card[] = [];

  const place = (photo: Measured, role: Role, target: (base: { w: number; h: number }) => Pose, zIndex: number, k: number, float: number) => {
    if (next.some((c) => c.id === photo.id)) return;
    const existing = pool.get(photo.id);
    pool.delete(photo.id);
    const base = baseSize(photo, g);
    const p = target(base);
    next.push({
      id: photo.id,
      photo,
      base,
      role,
      pose: p,
      enter: existing ? null : entryPose(p, g, role === "hero" ? via : undefined),
      zIndex,
      k,
      float,
      t,
      exitAt: 0,
    });
  };

  const { W, avail, cy, portrait } = g;

  switch (scene.kind) {
    case "hero": {
      place(scene.photo, "hero", () => pose({ y: cy }), 50, 1, scene.photo.aspect < 1 ? 5 : 4);
      break;
    }
    case "pair": {
      const [a, b] = scene.photos;
      if (portrait) {
        place(a, "pair", (base) => pose({ x: -0.02 * W, y: cy - avail * 0.255, s: scaleInto(base, W * 0.93, avail * 0.49), ry: 5 }), 50, 0.8, 4);
        place(b, "pair", (base) => pose({ x: 0.02 * W, y: cy + avail * 0.255, z: -120, s: scaleInto(base, W * 0.93, avail * 0.49), ry: -5 }), 45, 0.6, 5);
      } else {
        place(a, "pair", (base) => pose({ x: -0.24 * W, y: cy, s: scaleInto(base, W * 0.47, avail), ry: 7 }), 50, 0.8, 4);
        place(b, "pair", (base) => pose({ x: 0.245 * W, y: cy, z: -120, s: scaleInto(base, W * 0.47, avail), ry: -7 }), 45, 0.6, 5);
      }
      break;
    }
    case "trio": {
      const [big, left, right] = scene.photos;
      const flip = scene.mirror ? -1 : 1;
      if (portrait) {
        place(big, "trio", (base) => pose({ y: cy - avail * 0.1, s: scaleInto(base, W * 0.88, avail * 0.72) }), 50, 1, 4);
        place(left, "trio", (base) => pose({ x: -0.33 * W * flip, y: cy + avail * 0.3, z: -240, s: scaleInto(base, W * 0.5, avail * 0.38), ry: 16 * flip }), 40, 0.4, 0);
        place(right, "trio", (base) => pose({ x: 0.33 * W * flip, y: cy + avail * 0.3, z: -280, s: scaleInto(base, W * 0.5, avail * 0.38), ry: -16 * flip }), 39, 0.4, 1);
      } else {
        place(big, "trio", (base) => pose({ y: cy, s: scaleInto(base, W * 0.56, avail) }), 50, 1, 4);
        place(left, "trio", (base) => pose({ x: -0.37 * W * flip, y: cy, z: -260, s: scaleInto(base, W * 0.34, avail * 0.72), ry: 20 * flip }), 40, 0.4, 0);
        place(right, "trio", (base) => pose({ x: 0.37 * W * flip, y: cy, z: -280, s: scaleInto(base, W * 0.34, avail * 0.72), ry: -20 * flip }), 39, 0.4, 1);
      }
      break;
    }
    case "wall": {
      const { cols, rows } = scene;
      const cellW = (W * 0.99) / cols;
      const cellH = avail / rows;
      const mid = (cols - 1) / 2;
      scene.photos.forEach((photo, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const off = mid ? (col - mid) / mid : 0; // -1 .. 1 across the wall
        place(
          photo,
          "wall",
          (base) =>
            pose({
              x: (col - mid) * cellW,
              y: cy + (row - (rows - 1) / 2) * cellH,
              z: -160 - Math.abs(off) * 110, // a gently concave wall
              ry: -off * 9,
              s: scaleInto(base, cellW * 0.94, cellH * 0.93),
            }),
          30 - Math.round(Math.abs(off) * 3),
          0.35,
          -1
        );
      });
      break;
    }
    case "brand": {
      // The whole field steps back and dims; the brand comes forward over it.
      live.slice(0, 8).forEach((c) => {
        pool.delete(c.id);
        next.push({
          ...c,
          role: "field",
          enter: null,
          pose: { ...c.pose, x: c.pose.x * 1.15, y: c.pose.y * 1.15, z: -1300, o: 0.16, blur: 5 },
          zIndex: 5,
          k: -0.05,
          float: c.float >= 0 ? c.float % 4 : 0,
          t,
        });
      });
      break;
    }
  }

  // What was just on screen recedes into the depth field around the new
  // composition. A swiped-away hero does not: it leaves by the side.
  if (scene.kind !== "brand" && scene.kind !== "wall") {
    const room = scene.kind === "hero" ? MAX_SATELLITES : 2;
    const candidates = [...pool.values()]
      .filter((c) => !(via && c.role === "hero"))
      .sort((a, b) => b.zIndex - a.zIndex);
    candidates.slice(0, room).forEach((c, slot) => {
      pool.delete(c.id);
      const base = baseSize(c.photo, g);
      next.push({
        ...c,
        base,
        role: "sat",
        enter: null,
        pose: satellitePose(slot, g, base),
        zIndex: 10 + (room - slot),
        k: -0.12,
        float: slot,
        t,
      });
    });
  }

  // Everything else leaves, and is removed once it has.
  for (const c of pool.values()) {
    next.push({ ...c, role: "exit", enter: null, pose: exitPose(c.pose, g, c.role === "hero" ? via : undefined), t, exitAt: now + t + 100 });
  }
  // Cards already on their way out keep going.
  for (const c of prev) if (c.exitAt > now && !next.some((n) => n.id === c.id)) next.push(c);

  // A hard ceiling, whatever happens: drop the oldest departures first.
  while (next.length > MAX_CARDS) {
    const i = next.findIndex((c) => c.exitAt > 0);
    if (i < 0) break;
    next.splice(i, 1);
  }
  return next;
}
