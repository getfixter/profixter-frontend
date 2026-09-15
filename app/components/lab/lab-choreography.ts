import * as THREE from "three";
import { TOOL_REACH } from "./lab-tools";
import {
  TOOL_SCALE,
  WORK_MOTIONS,
  type JobDefinition,
  type StageJob,
  type WorkMotion,
} from "./lab-jobs";
import { setObjectFix } from "./lab-object-state";
import { stageToWorld, type LayoutId } from "./lab-stage";

/**
 * The tour: one Fixter, a ring of jobs, forever — across a page, not around a
 * room.
 *
 * Travel happens entirely on the stage plane. Left, right, up, down and every
 * diagonal between them; z never changes. Depth is used for exactly two things,
 * both local: how far in front of him an object floats so his tool can reach
 * it, and the thickness of the objects themselves.
 *
 * The runner knows nothing about outlets or faucets. It walks a list of stops,
 * each carrying where to stand, which way to face, which posture to work in and
 * how long it takes. Adding a job is data.
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

export type TourStop = {
  job: JobDefinition;
  motion: WorkMotion;
  /** Where the prop is drawn, including its small forward offset. */
  object: THREE.Vector3;
  /** The point being repaired — what the tool aims at. */
  workPoint: THREE.Vector3;
  /** Where he stands so his working hand lands on the object. Always z = 0. */
  mark: THREE.Vector3;
  workYaw: number;
  enterSeconds: number;
  exitSeconds: number;
};

type Path = {
  from: THREE.Vector2;
  to: THREE.Vector2;
  control: THREE.Vector2;
  length: number;
};

export type TourRuntime = {
  stopIndex: number;
  tick: number;
  phase: TourPhase;
  phaseElapsed: number;
  /** Always on the stage plane: x across, y up, z pinned to 0. */
  position: THREE.Vector3;
  /** Facing, about the character's own up axis. */
  yaw: number;
  /** Lean, about the camera axis. This is what sells diagonal travel. */
  lean: number;
  workProgress: number;
  /** Stride rate as a fraction of full walking pace, so the feet match. */
  gait: number;
  toolEquipped: boolean;
  fixedTick: Record<string, number>;
  laps: number;
  path: Path | null;
  t: number;
};

export const WALK_SPEED = 1.05;
const APPROACH_FROM = 0.86;
const APPROACH_SPEED_FACTOR = 0.45;
const TURN_RATE = 3.0;
const TURN_EPSILON = 0.035;
const OPENING_IDLE = 1.2;
const COMPLETE_BEAT = 1.0;

/**
 * How far he turns toward the direction of travel.
 *
 * Not a full ninety degrees. At ninety he is in pure profile and we never see
 * his face; at seventy the walk still reads as going that way while the front
 * of him stays visible, which is most of his charm.
 */
const FACE_MAX = THREE.MathUtils.degToRad(70);

/**
 * Lean, in radians, at a full forty-five degree diagonal.
 *
 * This is the answer to travelling up and down a page without looking like a
 * man climbing an invisible wall. He tips into the direction he is going, the
 * way anyone leans into a slope — and because dirX * dirY is zero for level
 * walking and zero for straight up, the cue appears exactly on the diagonals
 * where it is needed and nowhere else.
 */
const LEAN_MAX = THREE.MathUtils.degToRad(17);

/** How far the travel path bows off the straight line, as a fraction. */
const PATH_BOW = 0.13;

/** How far the prop sits in front of his hand. Layering, not distance. */
const PROP_DEPTH = 0.1;

/** Stand-off for a job done bare-handed, where there is no tool to span it. */
const BARE_HAND_GAP = 0.09;

/* ------------------------------------------------------------------ stops */

/**
 * Where a job's hand-target sits in the world.
 *
 * On the empty stage that is a normalised stage coordinate. On the mock
 * homepage it is wherever a particular DOM element happens to be. Everything
 * after the anchor — the stand mark, the facing, the prop's small forward
 * offset — is identical, which is the whole reason this is a parameter rather
 * than a second copy of the solver.
 */
export type AnchorResolver = (job: JobDefinition) => THREE.Vector3 | null;

export function buildTour(
  jobs: StageJob[],
  layout: LayoutId,
  aspect: number,
  characterScale: number,
  clipSeconds: (name: string) => number
): TourStop[];
export function buildTour(
  jobs: JobDefinition[],
  layout: LayoutId,
  aspect: number,
  characterScale: number,
  clipSeconds: (name: string) => number,
  anchorFor: AnchorResolver
): TourStop[];
export function buildTour(
  jobs: JobDefinition[],
  layout: LayoutId,
  aspect: number,
  characterScale: number,
  clipSeconds: (name: string) => number,
  anchorFor?: AnchorResolver
): TourStop[] {
  const up = new THREE.Vector3(0, 1, 0);

  const stops: TourStop[] = [];
  for (const job of jobs) {
    const motion = WORK_MOTIONS[job.workMotion];
    const yaw = THREE.MathUtils.degToRad(job.workYawDeg ?? 0);

    /*
     * The hand offset was measured on the character at full size, so it has to
     * be scaled with him. Skip this and shrinking the Fixter silently moves his
     * hand without moving the mark, and he reaches past everything he owns.
     */
    const hand = new THREE.Vector3(...motion.handOffset)
      .multiplyScalar(characterScale)
      .applyAxisAngle(up, yaw);

    /*
     * The anchor is where the REPAIR happens — the screw, the handle, the
     * bracket — not where his hand goes. That distinction is the whole of the
     * tool fix.
     *
     * A resolver that returns null means the element it belongs to is not on
     * the page right now — hidden at this breakpoint, or not yet measured — so
     * the job is skipped rather than placed at the origin, where he would walk
     * to the middle of the screen and work on nothing.
     */
    const anchor = anchorFor
      ? anchorFor(job)
      : stageToWorld((job as StageJob).placement[layout], layout, aspect);
    if (!anchor) continue;
    const offset = job.objectOffset ?? [0, 0];

    /*
     * His hand stands off from the work by the length of the tool, IN THE
     * SCREEN PLANE.
     *
     * The gap used to be in z — the prop floated toward the viewer and the tool
     * was supposed to span the difference. On a flat stage that is worth
     * nothing: a screwdriver pointing at the camera is a dot, and the tool
     * instead ended up aimed at the prop's drawn centre, which put it through
     * his own hip. Standing the hand off within the plane is what makes the
     * tool read as being used on something.
     */
    const toolLength = job.tool
      ? TOOL_REACH[job.tool] * TOOL_SCALE * characterScale
      : BARE_HAND_GAP * characterScale;
    const approach = THREE.MathUtils.degToRad(job.toolApproachDeg ?? 0);
    const handTarget = new THREE.Vector3(
      anchor.x + Math.cos(approach) * toolLength,
      anchor.y + Math.sin(approach) * toolLength,
      0
    );

    /*
     * The prop is DRAWN offset from the anchor, so the work lands on an edge of
     * it rather than in its middle — otherwise a picture frame hangs across his
     * face and a shelf runs through his chest. The offset moves only the
     * drawing; the anchor, and therefore where he stands, does not move.
     *
     * Depth is used here and nowhere else, and only a little: enough to keep
     * the prop in front of him and off his own surfaces.
     */
    const object = new THREE.Vector3(
      anchor.x + offset[0],
      anchor.y + offset[1],
      hand.z + PROP_DEPTH
    );

    /* What the tool points at: the work itself, at the prop's depth. */
    const workPoint = new THREE.Vector3(
      anchor.x,
      anchor.y,
      hand.z + PROP_DEPTH
    );

    /*
     * Where to stand is a subtraction now that the world is flat: put his hand
     * on the hand target and the mark falls out. He never leaves z = 0.
     */
    const mark = new THREE.Vector3(
      handTarget.x - hand.x,
      handTarget.y - hand.y,
      0
    );

    stops.push({
      job,
      motion,
      object,
      workPoint,
      mark,
      workYaw: yaw,
      enterSeconds: motion.enter ? clipSeconds(motion.enter.name) : 0,
      exitSeconds: motion.exit ? clipSeconds(motion.exit.name) : 0,
    });
  }

  return stops;
}

/* ----------------------------------------------------------------- runner */

export function createTourRuntime(stops: TourStop[]): TourRuntime {
  /* Begin where the loop ends: the honest opening is the ring's last leg. */
  const start = stops.length
    ? stops[stops.length - 1].mark.clone()
    : new THREE.Vector3();
  return {
    stopIndex: 0,
    tick: 0,
    phase: "IDLE",
    phaseElapsed: 0,
    gait: 1,
    position: start,
    yaw: 0,
    lean: 0,
    workProgress: 0,
    toolEquipped: false,
    fixedTick: {},
    laps: 0,
    path: null,
    t: 0,
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

const approach = (current: number, target: number, dt: number, rate: number) =>
  current + (target - current) * (1 - Math.exp(-rate * Math.min(dt, 0.1)));

/**
 * A gently bowed path between two points on the stage.
 *
 * Straight lines between six anchors read as a machine indexing between
 * stations. A slight bow, alternating side as the tour goes round, makes the
 * same route feel like someone wandering a page.
 */
function makePath(from: THREE.Vector3, to: THREE.Vector3, side: number): Path {
  const a = new THREE.Vector2(from.x, from.y);
  const b = new THREE.Vector2(to.x, to.y);
  const span = b.clone().sub(a);
  const length = Math.max(span.length(), 1e-4);
  const control = a
    .clone()
    .add(b)
    .multiplyScalar(0.5)
    .add(
      new THREE.Vector2(-span.y, span.x)
        .normalize()
        .multiplyScalar(length * PATH_BOW * side)
    );
  return { from: a, to: b, control, length };
}

const _p = new THREE.Vector2();
const _d = new THREE.Vector2();

function pathAt(path: Path, t: number) {
  const u = 1 - t;
  _p.set(
    u * u * path.from.x + 2 * u * t * path.control.x + t * t * path.to.x,
    u * u * path.from.y + 2 * u * t * path.control.y + t * t * path.to.y
  );
  _d.set(
    2 * u * (path.control.x - path.from.x) + 2 * t * (path.to.x - path.control.x),
    2 * u * (path.control.y - path.from.y) + 2 * t * (path.to.y - path.control.y)
  );
  if (_d.lengthSq() > 1e-8) _d.normalize();
  return { point: _p, direction: _d };
}

/** Facing and lean for a given travel direction on the stage. */
function travelPose(direction: THREE.Vector2) {
  const yaw = FACE_MAX * THREE.MathUtils.clamp(direction.x / 0.62, -1, 1);
  // Zero when level, zero when straight up, strongest on the diagonals.
  const lean = -LEAN_MAX * direction.x * direction.y * 2;
  return { yaw, lean };
}

/**
 * When a repair is allowed to come undone again.
 *
 * The loop has no reset — nothing is ever put back while anyone is looking —
 * and the way to keep that promise is not to count stops. Counting worked on a
 * six-job ring and broke the moment a phone dropped to four, where "two stops
 * later" is a row an inch below his boots.
 *
 * So the question is asked directly: can the viewer see this happen? An object
 * ages when it has been mended long enough to have registered AND either it is
 * off the screen entirely or he is a long way from it. The last clause is the
 * guarantee rather than the aesthetic: whatever else is true, a job has to be
 * broken again before he walks back to it, or he would arrive to repair
 * something that is already fine.
 */
export type AgePolicy = {
  /** Stops a repair holds before it may age at all, however far away he is. */
  minStops: number;
  /** World distance beyond which a change is unlikely to be noticed. */
  safeDistance: number;
  /**
   * Whether this repair is currently on screen anywhere.
   *
   * The job as well as the point, because a repair can show in two places at
   * once: the prop itself, and a checklist row somewhere else on the page that
   * ticks when it is done. Un-ticking that row is just as visible as the prop
   * springing apart, and the first version of this only watched the prop.
   */
  isVisible?: (job: JobDefinition, point: THREE.Vector3) => boolean;
};

export const DEFAULT_AGE_POLICY: AgePolicy = {
  minStops: 2,
  safeDistance: 2.6,
};

export function stepTour(
  runtime: TourRuntime,
  stops: TourStop[],
  dt: number,
  policy: AgePolicy = DEFAULT_AGE_POLICY
) {
  if (!stops.length) return;
  runtime.phaseElapsed += dt;
  const stop = stops[runtime.stopIndex % stops.length];

  const travel = (slow: boolean) => {
    if (!runtime.path) {
      runtime.path = makePath(
        runtime.position,
        stop.mark,
        runtime.stopIndex % 2 === 0 ? 1 : -1
      );
      runtime.t = 0;
    }
    const factor = slow ? APPROACH_SPEED_FACTOR : 1;
    const speed = WALK_SPEED * factor;
    /*
     * The walk is an in-place clip and the code does the moving, so the two
     * have to be told the same speed or the feet skate. They did: he slowed to
     * 45% for the last stretch into every job while his legs kept sprinting.
     */
    runtime.gait = factor;
    runtime.t = Math.min(1, runtime.t + (speed * dt) / runtime.path.length);
    const { point, direction } = pathAt(runtime.path, runtime.t);
    runtime.position.set(point.x, point.y, 0);

    const pose = travelPose(direction);
    runtime.yaw = approach(runtime.yaw, pose.yaw, dt, 6);
    runtime.lean = approach(runtime.lean, pose.lean, dt, 5);
    return runtime.t >= 1;
  };

  switch (runtime.phase) {
    case "IDLE":
      runtime.lean = approach(runtime.lean, 0, dt, 5);
      if (runtime.phaseElapsed >= OPENING_IDLE) setPhase(runtime, "TRAVEL");
      break;

    case "TRAVEL":
      travel(false);
      if (runtime.t >= APPROACH_FROM) setPhase(runtime, "APPROACH");
      break;

    case "APPROACH":
      if (travel(true)) {
        runtime.path = null;
        setPhase(runtime, "TURN_TO");
      }
      break;

    case "TURN_TO":
      runtime.lean = approach(runtime.lean, 0, dt, 6);
      if (
        turnToward(runtime, stop.workYaw, dt) &&
        Math.abs(runtime.lean) < 0.02
      ) {
        runtime.lean = 0;
        runtime.toolEquipped = stop.job.tool !== null;
        setPhase(runtime, stop.enterSeconds > 0 ? "WORK_IN" : "WORK");
      }
      break;

    case "WORK_IN":
      if (runtime.phaseElapsed >= stop.enterSeconds) setPhase(runtime, "WORK");
      break;

    case "WORK":
      runtime.workProgress = Math.min(
        1,
        runtime.phaseElapsed / stop.job.workSeconds
      );
      if (runtime.workProgress >= 1) {
        runtime.fixedTick[stop.job.id] = runtime.tick;
        setPhase(runtime, stop.exitSeconds > 0 ? "WORK_OUT" : "COMPLETE");
      }
      break;

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
        runtime.path = null;
        setPhase(runtime, "TRAVEL");
      }
      break;
  }

  /* Object states, under the policy above. */
  const count = stops.length;
  for (let i = 0; i < count; i++) {
    const s = stops[i];
    const fixedAt = runtime.fixedTick[s.job.id];

    if (fixedAt !== undefined && s !== stop) {
      const held = runtime.tick - fixedAt;
      /* How many stops until he is back here. Zero would mean he is here. */
      const untilDue = (i - runtime.stopIndex + count) % count;
      const offScreen = policy.isVisible
        ? !policy.isVisible(s.job, s.object)
        : false;
      const farAway =
        runtime.position.distanceTo(s.mark) >= policy.safeDistance;

      if ((held >= policy.minStops && (offScreen || farAway)) || untilDue <= 1) {
        delete runtime.fixedTick[s.job.id];
      }
    }

    const settled = runtime.fixedTick[s.job.id] !== undefined ? 1 : 0;
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
  TRAVEL: "Travelling",
  APPROACH: "Arriving",
  TURN_TO: "Turning to the job",
  WORK_IN: "Getting into position",
  WORK: "Working",
  WORK_OUT: "Standing back up",
  COMPLETE: "Job done",
};
