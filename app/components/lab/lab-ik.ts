import * as THREE from "three";

/**
 * Two-bone inverse kinematics for an arm, solved after the clip has played.
 *
 * The four retargeted work clips are the quality ceiling of this whole thing.
 * They supply a decent standing, crouching or reaching STANCE, and then the
 * arms do whatever the original take happened to be doing — which is why the
 * chest-height one clasps its hands in front and swallows a drill, and why
 * eleven different repairs read as one man miming.
 *
 * Text-to-motion is not going to fix that; two rounds established it. But the
 * arm is the one part of a body that can be solved rather than authored: given
 * where the hand must be, there is exactly one sensible elbow, and the shoulder
 * follows. So the clip keeps the stance and the arms get driven to where the
 * work actually is — which means the hammer arm can genuinely wind up and stop
 * dead, and the drill can genuinely be held in two hands.
 *
 * This rig is ideal for it: every bone runs along its own local +Y with its
 * child at (0, length, 0), so a bone's direction is its +Y axis in any pose and
 * there is no bind-pose bookkeeping to get wrong.
 */

const _rootW = new THREE.Vector3();
const _targetW = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _poleW = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _elbowDir = new THREE.Vector3();
const _elbowW = new THREE.Vector3();
const _handDir = new THREE.Vector3();
const _parentQ = new THREE.Quaternion();
const _worldQ = new THREE.Quaternion();
const _wanted = new THREE.Quaternion();
const _local = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

/** Never quite straight: a locked elbow reads as a mannequin. */
const MAX_EXTENSION = 0.985;

export type ArmChain = {
  upper: THREE.Object3D;   // RightArm  — rotates from the shoulder
  lower: THREE.Object3D;   // RightForeArm
  hand: THREE.Object3D;    // RightHand — the effector
  upperLength: number;
  lowerLength: number;
};

/**
 * Read a chain off the skeleton, or null if the rig is not what we expect.
 *
 * Lengths come from the bones themselves rather than from constants, so a
 * re-export with slightly different proportions keeps working.
 */
export function readArmChain(
  root: THREE.Object3D,
  side: "Left" | "Right"
): ArmChain | null {
  let upper: THREE.Object3D | null = null;
  let lower: THREE.Object3D | null = null;
  let hand: THREE.Object3D | null = null;
  root.traverse((node) => {
    if (node.name === `${side}Arm`) upper = node;
    else if (node.name === `${side}ForeArm`) lower = node;
    else if (node.name === `${side}Hand`) hand = node;
  });
  if (!upper || !lower || !hand) return null;
  const lowerBone = lower as THREE.Object3D;
  const handBone = hand as THREE.Object3D;
  return {
    upper,
    lower: lowerBone,
    hand: handBone,
    upperLength: lowerBone.position.length(),
    lowerLength: handBone.position.length(),
  };
}

/**
 * Put the hand at `target`, bending the elbow toward `pole`.
 *
 * `weight` blends the result against whatever the clip was doing, so an arm can
 * be taken over gradually as he settles into a job and handed back when he
 * walks away. Everything is in world space; the caller owns the target.
 */
export function solveArm(
  chain: ArmChain,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  weight: number
) {
  if (weight <= 0.001) return;

  chain.upper.getWorldPosition(_rootW);
  _targetW.copy(target);
  _toTarget.subVectors(_targetW, _rootW);

  /*
   * Measure the arm in the space we are solving in.
   *
   * The lengths on the chain come off the bones' own local offsets, which are
   * in the model's space — and the character is drawn at a fraction of that.
   * Solving a world-space triangle with local-space sides gives an arm that
   * believes it is longer than it is, so every hand lands short: a drill that
   * never quite arrives at the towel bar, and an overhead reach half a body
   * beneath the lamp. Two subtractions a frame, and it is right at any scale.
   */
  chain.upper.getWorldPosition(_a);
  chain.lower.getWorldPosition(_b);
  chain.hand.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b) || chain.upperLength;
  const l2 = _b.distanceTo(_c) || chain.lowerLength;
  const reach = (l1 + l2) * MAX_EXTENSION;
  let d = _toTarget.length();
  if (d < 1e-5) return;
  /* Out of reach: point straight at it rather than tearing the arm off. */
  if (d > reach) d = reach;
  /* Too close: the elbow would have to invert. */
  const shortest = Math.abs(l1 - l2) * 1.05 + 1e-4;
  if (d < shortest) d = shortest;

  _dir.copy(_toTarget).normalize();

  /*
   * The elbow sits off the root-to-target line by the angle the triangle
   * demands. Which side it falls on is the pole's job — without one the arm
   * is free to bend backwards, and occasionally will.
   */
  const cosA = THREE.MathUtils.clamp(
    (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d),
    -1,
    1
  );
  const a = Math.acos(cosA);

  _poleW.copy(pole).sub(_rootW);
  _axis.crossVectors(_dir, _poleW);
  if (_axis.lengthSq() < 1e-8) {
    /* Pole is colinear with the arm; pick any perpendicular. */
    _axis.crossVectors(_dir, _up);
    if (_axis.lengthSq() < 1e-8) _axis.set(1, 0, 0);
  }
  _axis.normalize();

  _elbowDir.copy(_dir).applyAxisAngle(_axis, -a);
  _elbowW.copy(_rootW).addScaledVector(_elbowDir, l1);

  /* Upper arm: aim its +Y at the elbow. */
  chain.upper.parent?.getWorldQuaternion(_parentQ);
  _wanted.setFromUnitVectors(_up, _elbowDir);
  _local.copy(_parentQ).invert().multiply(_wanted);
  chain.upper.quaternion.slerp(_local, weight);
  chain.upper.updateMatrixWorld(true);

  /* Forearm: aim its +Y from the elbow at the target. */
  _handDir.subVectors(_targetW, _elbowW);
  if (_handDir.lengthSq() < 1e-8) return;
  _handDir.normalize();
  chain.lower.parent?.getWorldQuaternion(_worldQ);
  _wanted.setFromUnitVectors(_up, _handDir);
  _local.copy(_worldQ).invert().multiply(_wanted);
  chain.lower.quaternion.slerp(_local, weight);
  chain.lower.updateMatrixWorld(true);
}

/**
 * Point the hand so the tool leaves it at a sensible angle.
 *
 * Solved separately from the arm because the wrist is not part of the reach:
 * where the hand IS comes from the triangle above, which way it FACES is a
 * choice about how the tool should sit in it.
 */
export function orientHand(
  chain: ArmChain,
  aimAt: THREE.Vector3,
  weight: number
) {
  if (weight <= 0.001) return;
  chain.hand.getWorldPosition(_rootW);
  _dir.subVectors(aimAt, _rootW);
  if (_dir.lengthSq() < 1e-8) return;
  _dir.normalize();
  chain.hand.parent?.getWorldQuaternion(_parentQ);
  _wanted.setFromUnitVectors(_up, _dir);
  _local.copy(_parentQ).invert().multiply(_wanted);
  chain.hand.quaternion.slerp(_local, weight);
  chain.hand.updateMatrixWorld(true);
}
