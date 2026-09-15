import * as THREE from "three";

/**
 * Job choreography.
 *
 * A job is DATA — where the object floats, where the character stands to reach
 * it, which clips play, which tool is held, how long the work takes. This file
 * is the runner that walks that data through its phases. Adding the shelf,
 * picture-frame, dresser, faucet and light jobs should mean writing five more
 * JobDefinitions, not five more state machines.
 *
 * Nothing here schedules anything. There are no timers: every transition is a
 * function of accumulated time and measured distance, evaluated once per frame,
 * so the sequence can be paused, scrubbed or restarted without a pile of
 * pending callbacks to unwind.
 *
 * The phase spine is the one the Lab already used —
 *
 *     IDLE → TRAVEL → APPROACH → WORK → COMPLETE → TRAVEL → IDLE
 *
 * with WORK opened up into the three beats a body actually needs (get down,
 * work, get up) and the two turns named, because facing is choreography too.
 */

export type SequencePhase =
  | "IDLE"
  | "TRAVEL"
  | "APPROACH"
  | "TURN_TO"
  | "WORK_IN"
  | "WORK"
  | "WORK_OUT"
  | "COMPLETE"
  | "TURN_AWAY"
  | "TRAVEL_AWAY"
  | "DONE";

/** Which of the character's clips each phase asks for. */
export type PhaseClipRole = "idle" | "walk" | "workIn" | "work" | "workOut";

export type JobDefinition = {
  id: string;
  label: string;
  /** Where the object floats, in world space. */
  anchor: [number, number, number];
  /**
   * Where the working hand sits relative to the character's origin, in his own
   * frame, averaged over the work clip. Measured, not guessed — this is what
   * decides both where he stands and which way he faces.
   */
  handOffset: [number, number, number];
  /**
   * How far short of the anchor the hand stops, leaving the tool room to span
   * the gap. Zero would put his wrist inside the outlet.
   */
  toolGap: number;
  /** Where the character starts, and where he walks off to afterwards. */
  start: [number, number, number];
  exit: [number, number, number];
  /** Seconds spent in the WORK loop, excluding getting down and back up. */
  workSeconds: number;
  /** Beat held after the work finishes, before turning away. */
  completeSeconds: number;
  tool: string | null;
};

export type SequenceRuntime = {
  phase: SequencePhase;
  phaseElapsed: number;
  position: THREE.Vector3;
  yaw: number;
  /** 0..1 across the WORK phase. Drives the object's completion state. */
  workProgress: number;
  /** True once the object has been repaired, and stays true. */
  objectFixed: boolean;
  /** True while the tool should be in hand. */
  toolEquipped: boolean;
  done: boolean;
};

export const WALK_SPEED = 0.875;
const APPROACH_RADIUS = 0.75;
const APPROACH_SPEED_FACTOR = 0.4;
const ARRIVE_EPSILON = 0.015;
/** Radians per second. Fast enough not to dawdle, slow enough to read as a turn. */
const TURN_RATE = 3.2;
const TURN_EPSILON = 0.03;

/**
 * Where the character stands, and which way he faces, so the WORKING HAND —
 * not his sternum — arrives at the anchor.
 *
 * The obvious version of this is wrong, and was: back off along the approach
 * axis, step sideways by the hand's lateral offset, then turn to face the
 * anchor. Turning to face the anchor rotates the body about its own origin, so
 * it throws the sideways step straight back out again and the hand ends up off
 * to one side no matter what offset you choose.
 *
 * Solved properly instead. With the hand at (hx, ·, hz) in body space, its
 * horizontal reach is r = |(hx, hz)|, so standing anywhere at distance r from
 * the anchor admits a yaw that puts the hand exactly on it:
 *
 *     yaw = bearing(mark -> anchor) − atan2(hx, hz)
 *
 * Standing at r + toolGap instead leaves the hand that much short, which is the
 * room the screwdriver needs.
 */
export function workReach(job: JobDefinition): number {
  return Math.hypot(job.handOffset[0], job.handOffset[2]);
}

export function workPosition(job: JobDefinition): THREE.Vector3 {
  const [ax, , az] = job.anchor;
  const approach = new THREE.Vector3(ax, 0, az).sub(
    new THREE.Vector3(job.start[0], 0, job.start[2])
  );
  if (approach.lengthSq() < 1e-8) approach.set(0, 0, 1);
  approach.y = 0;
  approach.normalize();

  return new THREE.Vector3(ax, 0, az).addScaledVector(
    approach,
    -(workReach(job) + job.toolGap)
  );
}

/** The yaw that swings the working hand onto the anchor from `from`. */
export function workYaw(job: JobDefinition, from: THREE.Vector3): number {
  const anchor = new THREE.Vector3(job.anchor[0], 0, job.anchor[2]);
  const bearing = Math.atan2(anchor.x - from.x, anchor.z - from.z);
  return bearing - Math.atan2(job.handOffset[0], job.handOffset[2]);
}

/** Yaw that points the character's +Z forward at `target`. */
export function yawTowards(from: THREE.Vector3, target: THREE.Vector3): number {
  return Math.atan2(target.x - from.x, target.z - from.z);
}

/** Shortest signed angular distance from `a` to `b`. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createSequenceRuntime(job: JobDefinition): SequenceRuntime {
  const start = new THREE.Vector3(...job.start);
  return {
    phase: "IDLE",
    phaseElapsed: 0,
    position: start,
    yaw: yawTowards(start, new THREE.Vector3(...job.anchor)),
    workProgress: 0,
    objectFixed: false,
    toolEquipped: false,
    done: false,
  };
}

/** Which clip role a phase wants. Pure lookup, used by the renderer too. */
export function clipRoleForPhase(phase: SequencePhase): PhaseClipRole {
  switch (phase) {
    case "TRAVEL":
    case "TRAVEL_AWAY":
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

function setPhase(runtime: SequenceRuntime, phase: SequencePhase) {
  runtime.phase = phase;
  runtime.phaseElapsed = 0;
}

/** Rotate toward `targetYaw` at a fixed rate. Returns true once aligned. */
function turnToward(runtime: SequenceRuntime, targetYaw: number, dt: number) {
  const delta = angleDelta(runtime.yaw, targetYaw);
  if (Math.abs(delta) <= TURN_EPSILON) {
    runtime.yaw = targetYaw;
    return true;
  }
  runtime.yaw += Math.sign(delta) * Math.min(Math.abs(delta), TURN_RATE * dt);
  return false;
}

/**
 * Walk toward a target. Returns true on arrival.
 *
 * `slow` is the APPROACH easing — the same translation the Lab already proved,
 * just eased, so the character settles onto his mark instead of stopping dead.
 */
function walkToward(
  runtime: SequenceRuntime,
  target: THREE.Vector3,
  dt: number,
  speed: number,
  slow: boolean
) {
  const direction = target.clone().sub(runtime.position);
  direction.y = 0;
  const distance = direction.length();

  if (distance > 1e-4) {
    runtime.yaw = Math.atan2(direction.x, direction.z);
  }

  const step = speed * (slow ? APPROACH_SPEED_FACTOR : 1) * dt;
  if (distance <= Math.max(step, ARRIVE_EPSILON)) {
    runtime.position.set(target.x, runtime.position.y, target.z);
    return true;
  }
  runtime.position.addScaledVector(direction.divideScalar(distance), step);
  return false;
}

export type PhaseDurations = {
  /** Length of the crouch-down clip, so WORK_IN ends when the body has settled. */
  workIn: number;
  /** Length of the stand-up clip. */
  workOut: number;
};

/**
 * Advance the sequence by `dt` seconds.
 *
 * `durations` comes from the actual retargeted clips rather than being guessed,
 * so the character is never cut off mid-crouch by a hardcoded timeout.
 */
export function stepSequence(
  runtime: SequenceRuntime,
  job: JobDefinition,
  durations: PhaseDurations,
  dt: number
) {
  if (runtime.phase === "DONE") return;
  runtime.phaseElapsed += dt;

  const mark = workPosition(job);

  switch (runtime.phase) {
    case "IDLE": {
      // A beat of standing before setting off, so the start reads as a
      // character deciding to move rather than a clip beginning.
      if (runtime.phaseElapsed >= 1.2) setPhase(runtime, "TRAVEL");
      return;
    }

    case "TRAVEL": {
      const distance = runtime.position.distanceTo(mark);
      if (distance <= APPROACH_RADIUS) {
        setPhase(runtime, "APPROACH");
        return;
      }
      walkToward(runtime, mark, dt, WALK_SPEED, false);
      return;
    }

    case "APPROACH": {
      if (walkToward(runtime, mark, dt, WALK_SPEED, true)) {
        setPhase(runtime, "TURN_TO");
      }
      return;
    }

    case "TURN_TO": {
      // Face so the HAND lands on the object, not so the chest points at it.
      if (turnToward(runtime, workYaw(job, runtime.position), dt)) {
        setPhase(runtime, "WORK_IN");
      }
      return;
    }

    case "WORK_IN": {
      runtime.toolEquipped = true;
      if (runtime.phaseElapsed >= durations.workIn) setPhase(runtime, "WORK");
      return;
    }

    case "WORK": {
      runtime.workProgress = Math.min(1, runtime.phaseElapsed / job.workSeconds);
      if (runtime.workProgress >= 1) {
        runtime.objectFixed = true;
        setPhase(runtime, "WORK_OUT");
      }
      return;
    }

    case "WORK_OUT": {
      if (runtime.phaseElapsed >= durations.workOut) {
        runtime.toolEquipped = false;
        setPhase(runtime, "COMPLETE");
      }
      return;
    }

    case "COMPLETE": {
      if (runtime.phaseElapsed >= job.completeSeconds) setPhase(runtime, "TURN_AWAY");
      return;
    }

    case "TURN_AWAY": {
      const exit = new THREE.Vector3(...job.exit);
      if (turnToward(runtime, yawTowards(runtime.position, exit), dt)) {
        setPhase(runtime, "TRAVEL_AWAY");
      }
      return;
    }

    case "TRAVEL_AWAY": {
      const exit = new THREE.Vector3(...job.exit);
      if (walkToward(runtime, exit, dt, WALK_SPEED, false)) {
        setPhase(runtime, "DONE");
        runtime.done = true;
      }
      return;
    }
  }
}

/** Human-readable phase label for the Lab readout. */
export const PHASE_LABELS: Record<SequencePhase, string> = {
  IDLE: "Idle — waiting",
  TRAVEL: "Travel — walking to the outlet",
  APPROACH: "Approach — settling onto the mark",
  TURN_TO: "Turn — facing the outlet",
  WORK_IN: "Work in — crouching down",
  WORK: "Work — repairing the outlet",
  WORK_OUT: "Work out — standing up",
  COMPLETE: "Complete — job done",
  TURN_AWAY: "Turn — facing the exit",
  TRAVEL_AWAY: "Travel — walking away",
  DONE: "Done — idle",
};
