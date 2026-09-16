import * as THREE from "three";

/**
 * One shared palette for every object in the scene.
 *
 * Shared instances, not per-object copies: each distinct material compiles its
 * own shader program, and a scene of six props that each mint their own greys
 * pays for a dozen programs to render what is visually four surfaces. Reusing
 * them also keeps the look coherent, which matters more here than it would in a
 * game — these props sit on a white page next to real UI, so they have to read
 * as one family of objects rather than six separate art experiments.
 *
 * Kept deliberately narrow: two metals, a wood, an off-white, the brand blue,
 * and a lamp that can light up.
 */

const std = (options: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial(options);

export const M = {
  /** Faceplates, cabinet fronts — the off-white that reads against the page. */
  shell: std({ color: "#f2f0ec", roughness: 0.58, metalness: 0.02 }),
  /** Brushed steel: faucets, brackets, shafts. */
  metal: std({ color: "#b9c0cb", roughness: 0.28, metalness: 0.82 }),
  /** Darker hardware: screws, hinges, sockets. */
  hardware: std({ color: "#6b7686", roughness: 0.42, metalness: 0.55 }),
  /** Near-black details — socket slots, cord, lamp interior. */
  dark: std({ color: "#2b3242", roughness: 0.75, metalness: 0.05 }),
  /** Warm wood for the shelf and the dresser. */
  wood: std({ color: "#c89a68", roughness: 0.72, metalness: 0.0 }),
  woodDark: std({ color: "#a87c4e", roughness: 0.74, metalness: 0.0 }),
  /** Profixter blue, used once per object as an accent so nothing shouts. */
  accent: std({ color: "#306EEC", roughness: 0.45, metalness: 0.1 }),
  /**
   * Brass, for door hardware.
   *
   * A hinge in the same grey as every bracket and screw is a grey block at a
   * hundred pixels, and a grey block is not a recognisable household object.
   * Brass is what door hardware actually is, and it is the one colour on the
   * page that says "door" on its own.
   */
  brass: std({ color: "#c9a227", roughness: 0.34, metalness: 0.78 }),
  /** Tool handle red. */
  toolGrip: std({ color: "#c8362f", roughness: 0.45, metalness: 0.05 }),
};

/**
 * The lamp shade is the one material that changes at runtime, so it is its own
 * instance rather than a shared one — turning the light on must not tint every
 * other off-white surface in the scene.
 */
export function createLampMaterial() {
  return new THREE.MeshStandardMaterial({
    color: "#f2f0ec",
    roughness: 0.5,
    metalness: 0.05,
    emissive: new THREE.Color("#ffb347"),
    emissiveIntensity: 0,
  });
}

/** Free the one material that is not shared. */
export function disposeMaterial(material: THREE.Material | null) {
  material?.dispose();
}

/**
 * A soft contact shadow, as a texture.
 *
 * The one thing that decides whether a 3D figure looks placed on a page or
 * pasted over it. Drawn rather than rendered: a real shadow needs a light, a
 * surface and a shadow map, and the surface here is a webpage.
 *
 * It lives in the page plane, not on a notional floor — under a camera this
 * close to head-on a horizontal ellipse would be edge-on and invisible. So it
 * is a squashed vertical ellipse under his boots, which is what a soft shadow
 * looks like from the front anyway.
 */
export function createContactShadow(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    g.addColorStop(0, "rgba(11,22,40,0.55)");
    g.addColorStop(0.45, "rgba(11,22,40,0.28)");
    g.addColorStop(1, "rgba(11,22,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The glow a light throws when it comes on.
 *
 * Additive, so it only ever brightens what is behind it — which on a dark hero
 * is most of the payoff and on a white section is almost nothing, exactly as a
 * real lamp behaves against a bright wall. Warm rather than white, because a
 * white bloom on a blue page reads as a rendering artefact and a warm one reads
 * as a bulb.
 */
export function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    g.addColorStop(0, "rgba(255,226,160,0.95)");
    g.addColorStop(0.22, "rgba(255,206,120,0.5)");
    g.addColorStop(0.55, "rgba(255,190,96,0.16)");
    g.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
