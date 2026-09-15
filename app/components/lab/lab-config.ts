/**
 * Fixter Lab — shared constants.
 *
 * Experimental Admin-only prototype. Nothing here is imported by the public
 * site or by the existing Admin page, and it must stay that way: the Lab is a
 * sealed room for testing the 3D character pipeline.
 */

/**
 * Web-optimized copy of the character.
 *
 * The original Meshy export lives at "/Fixter Background/Fixter Animated.glb"
 * and is left byte-for-byte untouched. This copy has the same rig, geometry and
 * clips, with textures resized (4096 -> 2048 colour/normal, 2048 -> 1024
 * metallic-roughness) which took it from 24.3 MB to 6.0 MB and, more
 * importantly, from ~200 MB of GPU memory to ~50 MB. The second number is the
 * one that decides whether a phone survives the page.
 */
export const FIXTER_GLB = "/3d/fixter-animated.glb";

/**
 * Meshy Text-to-Motion clips, retargeted onto the existing Fixter rig at load.
 *
 * Each file is raw generator output, kept exactly as downloaded so it stays a
 * reference point. Adding a motion to this list is the whole integration step:
 * it is loaded, retargeted and offered in the clip selector automatically, and
 * nothing about the character's own GLB is touched by any of it.
 */
export type MeshyMotion = {
  file: string;
  clipName: string;
  /** Meshy task the BVH came from, for traceability. */
  taskId: string;
  note: string;
};

export const MESHY_MOTIONS: MeshyMotion[] = [
  {
    file: "/3d/motion/repair-screwdriver-test.bvh",
    clipName: "Repair - Screwdriver Test",
    taskId: "01a0a36e-ab21-732e-90cf-fbe58423e08e",
    note: "Standing work at a wall outlet. Arms and upper body; feet planted.",
  },
  {
    file: "/3d/motion/crouch-kneel-test.bvh",
    clipName: "Crouch - Kneel Test",
    taskId: "01a0a380-358e-728b-abfe-f0c78705e1df",
    note: "Crouch, kneel, reach low, stand. Large vertical hip travel — the generalization test.",
  },
];

export const MESHY_CLIP_NAMES = new Set(MESHY_MOTIONS.map((m) => m.clipName));

/**
 * Metres per second, measured from the GLB rather than guessed.
 *
 * The "walking_2" clip carries baked root motion: its Hips travel 1.1089 units
 * in 1.267 s. That is the speed the animator's feet were built for, so driving
 * the in-place "Walking" clip at the same speed is what keeps the feet from
 * skating. Treat it as the calibration point, not a limit.
 */
export const MEASURED_WALK_SPEED = 0.875;

/** The character is 1.70 units tall with its feet at y = 0, so 1 unit = 1 m. */
export const CHARACTER_HEIGHT = 1.7;

export const POINT_A: [number, number, number] = [-2.2, 0, 0];
export const POINT_B: [number, number, number] = [2.2, 0, 0];

/**
 * How the walk cycle relates to movement through the world.
 *
 * "animated" is the architecture we intend to keep: the clip animates the body
 * in place and the application owns the character's position. It is the only
 * mode that can ever respect safe zones, because it is the only one where the
 * code decides where he ends up. The other two exist to make the distinction
 * visible.
 */
export type MovementMode = "animated" | "rootMotion" | "both";

export const MOVEMENT_MODES: {
  id: MovementMode;
  label: string;
  detail: string;
}[] = [
  {
    id: "animated",
    label: "In-place clip + code movement",
    detail:
      "Default. Walking animates the skeleton, the app translates the character. This is the long-term architecture.",
  },
  {
    id: "rootMotion",
    label: "Root motion only (diagnostic)",
    detail:
      "walking_2 moves itself ~1.11 units, then snaps back when it loops. The app translates nothing, so there is no arrival — press Stop.",
  },
  {
    id: "both",
    label: "Both at once (deliberately wrong)",
    detail:
      "walking_2 plus code movement. Travels at double speed and the feet skate. Kept to show the failure mode.",
  },
];

/**
 * Clip roles, resolved from whatever the GLB actually contains.
 *
 * Names are never hardcoded into the runtime: re-exporting from Meshy with new
 * or renamed clips should keep working, and the selector is built from the file
 * at load time. These preferences only decide which clip each *role* falls to.
 */
export type ClipRoles = {
  walkInPlace: string | null;
  rootMotion: string | null;
  rest: string | null;
};

export function resolveClipRoles(names: string[]): ClipRoles {
  const find = (
    exact: string,
    pattern: RegExp,
    reject?: (name: string) => boolean
  ): string | null => {
    const byExact = names.find((name) => name.toLowerCase() === exact);
    if (byExact) return byExact;
    const byPattern = names.find(
      (name) => pattern.test(name) && !(reject?.(name) ?? false)
    );
    return byPattern ?? null;
  };

  // The root-motion clip is found first so the in-place search can exclude it;
  // otherwise /walk/i matches "walking_2" and the default mode silently gets
  // the one clip that moves itself.
  const rootMotion = find("walking_2", /walk.*(_?2|b)$/i);

  return {
    walkInPlace: find("walking", /walk|run/i, (name) => name === rootMotion),
    rootMotion,
    rest: find("restpose", /rest|idle|t-?pose/i),
  };
}
