import * as THREE from "three";
import {
  WORK_MOTIONS,
  layoutAnchor,
  type JobDefinition,
  type WorkMotion,
} from "./lab-jobs";
import { setObjectFix } from "./lab-object-state";

/**
 * The tour: one Fixter, a ring of jobs, forever.
 *
 * The runner knows nothing about outlets or faucets. It walks a list of stops,
 * and each stop carries everything about itself — where to stand, which way to
 * face, which posture to work in, how long it takes. Adding a job is data.
 *
 * Nothing is scheduled. There are no timers and no callbacks: every transition
 * is a function of accumulated time and measured distance, evaluated once per
 * frame, so the whole thing can be paused, scrubbed or restarted without any
 * pending state to unwind.
 */

export type TourPhase =
  | "IDLE"
  | "TRAVEL"
  | "APPROACH"
  | "TURN_TO"
  | "WORK_IN"
  | "WORK"
  | "WORK_OUT"
  | "COMPLETE";

export type PhaseClipRole = "idle" | "walk" | "workIn" | "work" | "workOut";

/** A job resolved into everything the runner needs, computed once. */
export type TourStop = {
  job: JobDefinition;
  motion: WorkMotion;
  anchor: THREE.Vector3;
  /** Where he stands so his working hand reaches the anchor. */
  mark: THREE.Vector3;
  /** The yaw that swings that hand onto the anchor. */
  workYaw: number;
  enterSeconds: number;
  exitSeconds: number;
};

export type TourRuntime = {
  stopIndex: number;
  /** Monotonic count of completed jobs, used to age the repairs. */
  tick: number;
  phase: TourPhase;
  phaseElapsed: number;
  position: THREE.Vector3;
  yaw: number;
  workProgress: number;
  toolEquipped: boolean;
  /** jobId -> the tick at which it was last repaired. */
  fixedTick: Record<string, number>;
  laps: number;
};

export const WALK_SPEED = 0.875;
const APPROACH_RADIUS = 0.8;
const APPROACH_SPEED_FACTOR = 0.42;
const ARRIVE_EPSILON = 0.015;
const TURN_RATE = 2.8;
const TURN_EPSILON = 0.035;
const OPENING_IDLE = 1.4;
const COMPLETE_BEAT = 1.15;

/* ------------------------------------------------------------------ geometry */

export function workReach(motion: WorkMotion) {
  return Math.hypot(motion.handOffset[0], motion.handOffset[2]);
}

/**
 * Resolve the job list into stops.
 *
 * Standing distance and facing are solved together rather than chosen. With the
 * hand at (hx, ·, hz) in body space its horizontal reach is r = |(hx, hz)|, so
 * standing at r + toolGap from the object admits exactly one yaw that puts the
 * hand on it:
 *
 *     yaw = bearing(mark -> anchor) − atan2(hx, hz)
 *
 * The naive alternative — stand back, step sideways, then face the object —
 * cannot work, because facing the object rotates the body about its own origin
 * and undoes the sideways step.
 *
 * Which side he approaches from is taken from the previous job, so he arrives
 * facing the way he was already walking instead of looping around the object.
 */
export function buildTour(
  jobs: JobDefinition[],
  spread: number,
  clipSeconds: (name: string) => number
): TourStop[] {
  const anchors = jobs.map((job) => new THREE.Vector3(...layoutAnchor(job, spread)));

  return jobs.map((job, index) => {
    const motion = WORK_MOTIONS[job.workMotion];
    const anchor = anchors[index];
    const previous = anchors[(index - 1 + anchors.length) % anchors.length];

    /* An art-directed side if the job names one, otherwise from the last job. */
    const approach = job.approachFrom
      ? new THREE.Vector3(job.approachFrom[0], 0, job.approachFrom[1])
      : new THREE.Vector3(anchor.x - previous.x, 0, anchor.z - previous.z);
    if (approach.lengthSq() < 1e-8) approach.set(0, 0, 1);
    approach.normalize();

    const distance = workReach(motion) + job.toolGap;
    const mark = new THREE.Vector3(anchor.x, 0, anchor.z).addScaledVector(approach, -distance);
    const bearing = Math.atan2(anchor.x - mark.x, anchor.z - mark.z);
    const workYaw = bearing - Math.atan2(motion.handOffset[0], motion.handOffset[2]);

    return {
      job,
      motion,
      anchor,
      mark,
      workYaw,
      enterSeconds: motion.enter ? clipSeconds(motion.enter.name) : 0,
      exitSeconds: motion.exit ? clipSeconds(motion.exit.name) : 0,
    };
  });
}

/* ------------------------------------------------------------------- runner */

export function createTourRuntime(stops: TourStop[]): TourRuntime {
  const first = stops[0];
  /*
   * Begin where the loop ends, not at an invented starting point.
   *
   * The tour is a ring, so the honest opening is the leg from the last job to
   * the first — he is already somewhere he has been working. It also puts him
   * inside the composition on frame one, which an arbitrary offset behind the
   * first job did not.
   */
  const start = stops.length
    ? stops[stops.length - 1].mark.clone()
    : new THREE.Vector3();
  return {
    stopIndex: 0,
    tick: 0,
    phase: "IDLE",
    phaseElapsed: 0,
    position: start,
    yaw: first ? Math.atan2(first.mark.x - start.x, first.mark.z - start.z) : 0,
    workProgress: 0,
    toolEquipped: false,
    fixedTick: {},
    laps: 0,
  };
}

export function clipRoleForPhase(phase: TourPhase): PhaseClipRole {
  switch (phase) {
    case "TRAVEL":
    case "APPROACH":
      return "walk";
    case "WORK_IN":
      return "workIn";
    case "WORK":
      return "work";
    case "WORK_OUT":
      return "workOut";
    default:
      return "idle";
  }
}

function setPhase(runtime: TourRuntime, phase: TourPhase) {
  runtime.phase = phase;
  runtime.phaseElapsed = 0;
}

function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(runtime: TourRuntime, target: number, dt: number) {
  const delta = angleDelta(runtime.yaw, target);
  if (Math.abs(delta) <= TURN_EPSILON) {
    runtime.yaw = target;
    return true;
  }
  runtime.yaw += Math.sign(delta) * Math.min(Math.abs(delta), TURN_RATE * dt);
  return false;
}

const _dir = new THREE.Vector3();

function walkToward(
  runtime: TourRuntime,
  target: THREE.Vector3,
  dt: number,
  slow: boolean
) {
  _dir.set(target.x - runtime.position.x, 0, target.z - runtime.position.z);
  const distance = _dir.length();
  if (distance > 1e-4) runtime.yaw = Math.atan2(_dir.x, _dir.z);

  const step = WALK_SPEED * (slow ? APPROACH_SPEED_FACTOR : 1) * dt;
  if (distance <= Math.max(step, ARRIVE_EPSILON)) {
    runtime.position.set(target.x, runtime.position.y, target.z);
    return true;
  }
  runtime.position.addScaledVector(_dir.divideScalar(distance), step);
  return false;
}

/**
 * Advance the tour, and write each object's repaired-ness into `objectState`.
 *
 * The loop has no reset. A repair ages out only once the Fixter is most of a
 * lap away from it — by the time he walks back round, the object has quietly
 * returned to needing him, and the moment it does is always happening somewhere
 * he is not. Nothing ever snaps back on camera, and the world never blinks.
 */
export function stepTour(runtime: TourRuntime, stops: TourStop[], dt: number) {
  if (!stops.length) return;
  runtime.phaseElapsed += dt;
  const stop = stops[runtime.stopIndex % stops.length];

  switch (runtime.phase) {
    case "IDLE":
      if (runtime.phaseElapsed >= OPENING_IDLE) setPhase(runtime, "TRAVEL");
      break;

    case "TRAVEL":
      if (runtime.position.distanceTo(stop.mark) <= APPROACH_RADIUS) {
        setPhase(runtime, "APPROACH");
      } else {
        walkToward(runtime, stop.mark, dt, false);
      }
      break;

    case "APPROACH":
      if (walkToward(runtime, stop.mark, dt, true)) setPhase(runtime, "TURN_TO");
      break;

    case "TURN_TO":
      if (turnToward(runtime, stop.workYaw, dt)) {
        runtime.toolEquipped = stop.job.tool !== null;
        setPhase(runtime, stop.enterSeconds > 0 ? "WORK_IN" : "WORK");
      }
      break;

    case "WORK_IN":
      if (runtime.phaseElapsed >= stop.enterSeconds) setPhase(runtime, "WORK");
      break;

    case "WORK": {
      runtime.workProgress = Math.min(1, runtime.phaseElapsed / stop.job.workSeconds);
      if (runtime.workProgress >= 1) {
        runtime.fixedTick[stop.job.id] = runtime.tick;
        setPhase(runtime, stop.exitSeconds > 0 ? "WORK_OUT" : "COMPLETE");
      }
      break;
    }

    case "WORK_OUT":
      if (runtime.phaseElapsed >= stop.exitSeconds) {
        runtime.toolEquipped = false;
        setPhase(runtime, "COMPLETE");
      }
      break;

    case "COMPLETE":
      runtime.toolEquipped = false;
      if (runtime.phaseElapsed >= COMPLETE_BEAT) {
        runtime.tick += 1;
        const next = runtime.stopIndex + 1;
        if (next >= stops.length) runtime.laps += 1;
        runtime.stopIndex = next % stops.length;
        runtime.workProgress = 0;
        setPhase(runtime, "TRAVEL");
      }
      break;
  }

  /* ---- object states ---- */
  const staysFixedFor = Math.max(1, stops.length - 2);
  for (const s of stops) {
    const fixedAt = runtime.fixedTick[s.job.id];
    const settled =
      fixedAt === undefined || runtime.tick - fixedAt >= staysFixedFor ? 0 : 1;
    // the one he is on right now follows his progress rather than snapping
    setObjectFix(
      s.job.id,
      s === stop && runtime.phase === "WORK"
        ? Math.max(settled, runtime.workProgress)
        : settled
    );
  }
}

export const PHASE_LABELS: Record<TourPhase, string> = {
  IDLE: "Idle",
  TRAVEL: "Walking over",
  APPROACH: "Arriving",
  TURN_TO: "Turning to the job",
  WORK_IN: "Getting into position",
  WORK: "Working",
  WORK_OUT: "Standing back up",
  COMPLETE: "Job done",
};
