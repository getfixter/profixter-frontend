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
