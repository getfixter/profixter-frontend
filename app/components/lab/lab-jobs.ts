import type { JobDefinition } from "./lab-choreography";

/**
 * Job library. One entry per thing the Fixter knows how to go and do.
 *
 * Only the outlet exists so far, deliberately — the point of this stage is to
 * prove one complete job end to end. The shelf, picture frame, dresser, faucet
 * and light are meant to arrive as further entries in this array, not as
 * further code.
 */

/** Source motions the sequence is cut from. */
export const REPAIR_ARC_BVH = "/3d/motion/outlet-repair-arc.bvh";
export const SQUAT_WORK_BVH = "/3d/motion/outlet-squat-upright.bvh";
export const IDLE_BVH = "/3d/motion/idle-natural.bvh";

export type LoopStyle = "once" | "repeat" | "pingpong";

/**
 * How much of each source take is worth retargeting.
 *
 * The repair arc came back 50 seconds long and the choreography uses the first
 * 12.5, so retargeting the rest would be several thousand wasted frames of
 * load-time work. Windowing here rather than per-segment also keeps every cut
 * from one take sharing a single ground correction, which is what stops the
 * crouch and the stand-up from disagreeing about floor height.
 */
export const SOURCE_WINDOWS: Record<string, [number, number]> = {
  [REPAIR_ARC_BVH]: [0, 12.5],
  [SQUAT_WORK_BVH]: [0, 13.5],
  [IDLE_BVH]: [0, 16],
};

export type SequenceClipSpec = {
  name: string;
  file: string;
  start: number;
  end: number;
  reverse?: boolean;
  loop: LoopStyle;
};

/**
 * The clips the choreography plays, cut from the two generated takes.
 *
 * Boundaries come from profiling the retargeted motion on the real skeleton,
 * not from watching it:
 *
 * The descent comes from one take and the work from another, because no single
 * generation produced both. Four were made and profiled on the real skeleton:
 *
 *   outlet-repair-arc      stands then squats, but works folded right over
 *                          (head only 0.25 above the hips) - good descent,
 *                          unusable working posture
 *   outlet-kneel           kneels well, but the hand stays at the lap
 *   outlet-kneel-arc       full stand-kneel-stand, hand still at the lap;
 *                          a hand that never leaves the body cannot be put
 *                          against a wall at all
 *   outlet-squat-upright   at t=9.5..13.0 the head sits 0.35 above the hips AND
 *                          the hand reaches forward to z 0.26 - the only take
 *                          that is upright and reaching at the same time
 *
 * So: descent and rise from the arc (0.0 .. 4.0, which ends at hips 0.404),
 * work from the upright squat (which sits at hips 0.406 - near enough that the
 * blend has almost no height to cover). The take never stands back up, so the
 * exit is the entry reversed.
 *
 * WORK and IDLE ping-pong rather than repeat. A generated take does not return
 * to its own first pose, so LoopRepeat would pop on every cycle; ping-pong is
 * seamless by construction and, for a repetitive wrist motion or a breathing
 * idle, reads identically.
 */
export const SEQUENCE_CLIPS: Record<string, SequenceClipSpec> = {
  idle: {
    name: "Seq · Idle",
    file: IDLE_BVH,
    start: 0.5,
    end: 15.5,
    loop: "pingpong",
  },
  workIn: {
    name: "Seq · Crouch In",
    file: REPAIR_ARC_BVH,
    start: 0.0,
    end: 4.0,
    loop: "once",
  },
  work: {
    name: "Seq · Outlet Work",
    file: SQUAT_WORK_BVH,
    start: 9.5,
    end: 13.0,
    loop: "pingpong",
  },
  workOut: {
    name: "Seq · Stand Up",
    file: REPAIR_ARC_BVH,
    start: 0.0,
    end: 4.0,
    reverse: true,
    loop: "once",
  },
};

export const SEQUENCE_CLIP_NAMES = new Set(
  Object.values(SEQUENCE_CLIPS).map((c) => c.name)
);

/**
 * Where a held tool sits relative to the hand bone.
 *
 * The right hand bone's local +Y runs wrist-to-fingertips, and a screwdriver
 * driven into a wall sits roughly along the forearm, so the shaft is modelled
 * along +Y and only needs a small offset into the palm. Exposed as sliders in
 * the Lab because this is exactly the kind of number that wants an eye on it.
 */
export const DEFAULT_TOOL_OFFSET = {
  position: [0.012, 0.055, 0.005] as [number, number, number],
  /*
   * Not eyeballed. Solved: take the hand's world orientation through the work
   * window, take the direction from the hand to the outlet, and find the
   * hand-local rotation that puts the tool's +Y on that direction. Averaged
   * over the window, it comes out here.
   */
  rotationDeg: [-31, 5, -17] as [number, number, number],
  /*
   * 1.6 rather than life-size. The Fixter is stylised — large head, short
   * limbs — and a physically-scaled 16 cm screwdriver disappears in his fist at
   * any sane camera distance. Scaled to read at the same visual weight the rest
   * of him has.
   */
  scale: 1.3,
};

export const TOOL_ATTACH_BONE = "RightHand";

/**
 * The outlet repair.
 *
 * `anchor.y` and `handOffset` are not taste — they are measured.
 * Averaged over the work window, the right hand sits at local
 * (x -0.143, y 0.573, z +0.256) relative to the character's origin, so the
 * outlet goes at y 0.57, and the standing distance and facing are both derived
 * from that offset (see workPosition) so the hand lands on the plate. toolGap
 * holds him 0.16 short of it, which is the room the screwdriver spans.
 */
export const OUTLET_REPAIR_JOB: JobDefinition = {
  id: "outlet-repair",
  label: "Outlet repair",
  anchor: [1.5, 0.57, 0],
  handOffset: [-0.143, 0.573, 0.256],
  toolGap: 0.16,
  start: [-2.0, 0, 0],
  exit: [-2.2, 0, -1.3],
  workSeconds: 7,
  completeSeconds: 1.1,
  tool: "screwdriver",
};

export const JOBS: JobDefinition[] = [OUTLET_REPAIR_JOB];

/** Camera framing that shows the whole route, the crouch and the hand. */
export const SEQUENCE_CAMERA = {
  position: [3.3, 1.45, 3.7] as [number, number, number],
  target: [0.55, 0.5, 0] as [number, number, number],
};
