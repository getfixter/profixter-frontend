import * as THREE from "three";

/**
 * The exact map between a CSS pixel in the viewport and a world point on the
 * stage plane.
 *
 * Needed because the stage camera is tilted a few degrees. That tilt is what
 * stops every prop reading as a flat cut-out, but it means world X and Y are
 * not quite screen X and Y: a point's height nudges its horizontal position and
 * vice versa, by well under a percent. Over an empty stage that is invisible.
 * Over a webpage it is not — a job anchored to a list row two thousand pixels
 * down the document would sit visibly beside it.
 *
 * So rather than assume the tilt away, or fudge it with a cosine, the mapping is
 * measured from the camera itself. Orthographic projection restricted to a
 * single plane is affine, so three probes determine it completely and a 2x2
 * inverse undoes it. Exact for any tilt, and it stays correct if the tilt is
 * ever changed.
 */

export type PlaneProjection = {
  /** The world point on z = 0 that lands on this viewport pixel. */
  worldAt: (cssX: number, cssY: number) => THREE.Vector2;
  /** The viewport pixel a world point on z = 0 lands on. The inverse. */
  pixelAt: (worldX: number, worldY: number) => THREE.Vector2;
  /**
   * World travel per viewport pixel of downward scroll.
   *
   * Two-dimensional on purpose: under a tilted camera, moving down the screen
   * moves slightly sideways in the world as well.
   */
  perPixelDown: THREE.Vector2;
};

const probe = new THREE.Vector3();

export function planeProjection(
  camera: THREE.Camera,
  width: number,
  height: number
): PlaneProjection {
  const ndc = (x: number, y: number) => {
    probe.set(x, y, 0).project(camera);
    return { x: probe.x, y: probe.y };
  };

  /* Where the plane's origin and its two unit axes land in clip space. */
  const o = ndc(0, 0);
  const ex = ndc(1, 0);
  const ey = ndc(0, 1);

  const a = ex.x - o.x;
  const b = ey.x - o.x;
  const c = ex.y - o.y;
  const d = ey.y - o.y;
  const det = a * d - b * c;

  /*
   * A degenerate camera (zero zoom, or one looking along the plane) would make
   * this unsolvable. Fall back to the identity rather than emitting NaN
   * positions, which would silently teleport the character out of the world.
   */
  const safe = Math.abs(det) > 1e-12 ? det : 1;

  const worldAt = (cssX: number, cssY: number) => {
    const nx = (cssX / Math.max(width, 1)) * 2 - 1;
    const ny = 1 - (cssY / Math.max(height, 1)) * 2;
    const ux = nx - o.x;
    const uy = ny - o.y;
    return new THREE.Vector2(
      (d * ux - b * uy) / safe,
      (-c * ux + a * uy) / safe
    );
  };

  const pixelAt = (worldX: number, worldY: number) => {
    const nx = a * worldX + b * worldY + o.x;
    const ny = c * worldX + d * worldY + o.y;
    return new THREE.Vector2(
      ((nx + 1) / 2) * width,
      ((1 - ny) / 2) * height
    );
  };

  /* One pixel further down the viewport, expressed in world units. */
  const perPixelDown = worldAt(0, 1).sub(worldAt(0, 0));

  return { worldAt, pixelAt, perPixelDown };
}
