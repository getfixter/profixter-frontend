import type { BoneMap } from "./lab-retarget";

/**
 * Semantic bone mapping: Fixter (MeshyRig, 28 joints) <- Meshy BVH (78 joints).
 *
 * Keyed by TARGET bone name. Anything absent from this map is left at its rest
 * pose, which is the correct outcome for the BVH's fingers, jaw, eyes, the
 * second neck joint and the Root above the hips: our rig has no counterpart
 * for any of them, and inventing one would be worse than leaving it still.
 *
 * THE LEG NAMES ARE A TRAP. Both skeletons contain "LeftLeg" and "RightLeg",
 * and they denote different bones:
 *
 *     BVH    LeftLeg  = THIGH  (child of Hips)
 *     Fixter LeftLeg  = SHIN   (child of LeftUpLeg)
 *
 * A name-equality fallback therefore drives our shin with the thigh's rotation
 * and folds the character in half. The four leg entries are explicit for that
 * reason and must not be "simplified".
 *
 * The spine is the other place to read carefully. Ours runs
 * Hips -> Spine02 -> Spine01 -> Spine, so "Spine" is the TOP of the chain and
 * pairs with the BVH's "Chest", not with "Spine1".
 */
export const MESHY_BVH_TO_FIXTER: BoneMap = {
  Hips: "Hips",

  // Spine, lowest to highest.
  Spine02: "Spine1",
  Spine01: "Spine2",
  Spine: "Chest",

  // The BVH splits the neck in two; we have one, so Neck2 is dropped and its
  // contribution is absorbed by the head.
  neck: "Neck1",
  Head: "Head",

  LeftShoulder: "LeftShoulder",
  LeftArm: "LeftArm",
  LeftForeArm: "LeftForeArm",
  LeftHand: "LeftHand",

  RightShoulder: "RightShoulder",
  RightArm: "RightArm",
  RightForeArm: "RightForeArm",
  RightHand: "RightHand",

  // Explicit, for the reason above.
  LeftUpLeg: "LeftLeg",
  LeftLeg: "LeftShin",
  RightUpLeg: "RightLeg",
  RightLeg: "RightShin",

  LeftFoot: "LeftFoot",
  LeftToeBase: "LeftToeBase",
  RightFoot: "RightFoot",
  RightToeBase: "RightToeBase",
};

/** The target bone that carries root translation. */
export const FIXTER_HIPS_BONE = "Hips";
