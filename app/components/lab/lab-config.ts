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
 * Bumped on every deploy of the Lab route.
 *
 * Here rather than in the page so the server-rendered marker and the
 * diagnostics panel cannot drift apart — they did, and a page reading
 * "BUILD lab-13" above a bar reading "diag-5" is exactly the kind of thing
 * that makes you doubt what you are looking at.
 */
export const LAB_BUILD = "lab-40";

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
