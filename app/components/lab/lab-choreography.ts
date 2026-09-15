import * as THREE from "three";
import {
  TOOL_SCALE,
  WORK_MOTIONS,
  type JobDefinition,
  type WorkMotion,
} from "./lab-jobs";
import { TOOL_REACH } from "./lab-tools";
import { resetObjectFix, setObjectFix } from "./lab-object-state";

/**
 * The tour: one Fixter, a list of small repairs, forever — on the visible
 * screen, not in the document.
 *
 * The change that matters: he is no longer anchored to the page. Where a job
 * happens is decided when he sets off for it, from whatever space the screen
 * has free at that moment. The document is still consulted, but only to say
 * where NOT to go. That is what makes this work on any page rather than on one
 * particular homepage, and what lets him carry on while somebody scrolls.
 *
 * Travel is still entirely in the plane. Left, right, up, down and every
 * diagonal between them; z never changes. Depth is used for exactly two things,
 * both local: how far in front of him a prop sits, and the thickness of the
 * props themselves.
 */

export type TourPhase =
  | "IDLE"
  | "TRAVEL"
  | "APPROACH"
  | "TURN_TO"
  | "WORK_IN"
  | "WORK"
  | "WORK_OUT"
  | "ADMIRE"
  | "REST";

export type PhaseClipRole = "idle" | "walk" | "workIn" | "work" | "workOut";

/** A job, with its motion and clip lengths resolved. Carries no position. */
export type Stop = {
  job: JobDefinition;
  motion: WorkMotion;
  enterSeconds: number;
  exitSeconds: number;
};

/** Where a job ended up, once he decided to go and do it. */
export type Placement = {
  /** The repair itself — the screw, the handle, the bracket. */
  anchor: THREE.Vector3;
  /** Where the prop is drawn, offset so the work lands on an edge of it. */
  object: THREE.Vector3;
  /** What the tool points at. */
  workPoint: THREE.Vector3;
  /** Where he stands so his working hand arrives on the anchor. */
  mark: THREE.Vector3;
  workYaw: number;
};

/**
 * Asked for a place to do this job, in world units on the stage plane.
 *
 * Returning null means "nowhere sensible right now" — the runner waits rather
 * than standing on a headline.
 */
export type Placer = (job: JobDefinition) => THREE.Vector3 | null;

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
  position: THREE.Vector3;
  yaw: number;
  lean: number;
  workProgress: number;
  gait: number;
  toolEquipped: boolean;
  laps: number;
  path: Path | null;
  t: number;
  /** The current job's geometry, or null before he has chosen one. */
  placed: Placement | null;
  /** Which prop to draw, and how faded in it is. One at a time. */
  propJobId: string | null;
  propFade: number;
  /** How long this rest should last. Varied, so the pacing is not metronomic. */
  restFor: number;
  /** Set when the screen changed under him and his spot is no longer free. */
  displaced: boolean;
};

export const WALK_SPEED = 1.05;
const APPROACH_FROM = 0.86;
const APPROACH_SPEED_FACTOR = 0.45;
const TURN_RATE = 3.0;
const TURN_EPSILON = 0.035;
const OPENING_IDLE = 0.9;
const ADMIRE_SECONDS = 1.5;

/** How long he stands about between jobs. Contrast is what gets noticed. */
const REST_MIN = 0.6;
const REST_MAX = 2.6;

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
 * The answer to travelling up and down a screen without looking like a man
 * climbing an invisible wall. He tips into the direction he is going, the way
 * anyone leans into a slope — and because dirX * dirY is zero for level walking
 * and zero for straight up, the cue appears exactly on the diagonals where it
 * is needed and nowhere else.
 */
const LEAN_MAX = THREE.MathUtils.degToRad(17);

/** How far the travel path bows off the straight line, as a fraction. */
const PATH_BOW = 0.13;

/**
 * Extra bow for a steep leg.
 *
 * A straight climb is the one direction where none of the travel cues fire: the
 * yaw follows sideways motion and the lean is a product of both axes, so a
 * purely vertical leg leaves him facing the camera, upright, rising. That reads
 * as being winched rather than walking. Bowing a steep leg gives it a lateral
 * component, which turns him, tips him, and makes the climb look like a
 * decision.
 */
const STEEP_BOW = 1.35;

/** How much a long leg hurries, so a trek does not drag. */
const HURRY_FROM = 2.4;
const HURRY_MAX = 1.5;

/** How far in front of him a prop sits. Layering, not distance. */
const PROP_DEPTH = 0.1;

/** Stand-off for a job done bare-handed, where there is no tool to span it. */
const BARE_HAND_GAP = 0.09;

/** How quickly a prop fades in when he sets off, and out when he leaves. */
const PROP_FADE_RATE = 2.6;

/* ------------------------------------------------------------------ stops */

export function buildStops(
  jobs: JobDefinition[],
  clipSeconds: (name: string) => number
): Stop[] {
  return jobs.map((job) => {
    const motion = WORK_MOTIONS[job.workMotion];
    return {
      job,
      motion,
      enterSeconds: motion.enter ? clipSeconds(motion.enter.name) : 0,
      exitSeconds: motion.exit ? clipSeconds(motion.exit.name) : 0,
    };
  });
}

const _up = new THREE.Vector3(0, 1, 0);

/**
 * Turn "the repair is here" into everything else: where the prop is drawn,
 * where the tool points, and where he has to stand for his hand to arrive.
 */
export function placeStop(
  stop: Stop,
  anchor: THREE.Vector3,
  characterScale: number
): Placement {
  const { job, motion } = stop;
  const workYaw = THREE.MathUtils.degToRad(job.workYawDeg ?? 0);

  /*
   * The hand offset was measured on the character at full size, so it has to be
   * scaled with him. Skip this and shrinking the Fixter silently moves his hand
   * without moving the mark, and he reaches past everything he owns.
   */
  const hand = new THREE.Vector3(...motion.handOffset)
    .multiplyScalar(characterScale)
    .applyAxisAngle(_up, workYaw);

  /*
   * His hand stands off from the work by the length of the tool, IN THE SCREEN
   * PLANE. A gap in z would be worth nothing here: a screwdriver pointing at
   * the camera is a dot.
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

  const offset = job.objectOffset ?? [0, 0];

  return {
    anchor: anchor.clone(),
    object: new THREE.Vector3(
      anchor.x + offset[0],
      anchor.y + offset[1],
      hand.z + PROP_DEPTH
    ),
    workPoint: new THREE.Vector3(anchor.x, anchor.y, hand.z + PROP_DEPTH),
    mark: new THREE.Vector3(handTarget.x - hand.x, handTarget.y - hand.y, 0),
    workYaw,
  };
}

/* ----------------------------------------------------------------- runner */

export function createTourRuntime(): TourRuntime {
  resetObjectFix();
  return {
    stopIndex: 0,
    tick: 0,
    phase: "IDLE",
    phaseElapsed: 0,
    gait: 1,
    position: new THREE.Vector3(),
    yaw: 0,
    lean: 0,
    workProgress: 0,
    toolEquipped: false,
    laps: 0,
    path: null,
    t: 0,
    placed: null,
    propJobId: null,
    propFade: 0,
    restFor: REST_MIN,
    displaced: false,
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
  const step = Math.sign(delta) * Math.min(Math.abs(delta), TURN_RATE * dt);
  runtime.yaw += step;
  return Math.abs(angleDelta(runtime.yaw, target)) < TURN_EPSILON;
}

function approachValue(
  current: number,
  target: number,
  dt: number,
  rate: number
) {
  return current + (target - current) * (1 - Math.exp(-rate * Math.min(dt, 0.1)));
}

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function curve(a: THREE.Vector2, b: THREE.Vector2, side: number, bounds: Bounds) {
  const span = b.clone().sub(a);
  const length = Math.max(span.length(), 1e-4);
  const steep = Math.abs(span.y) / length;
  const bow = PATH_BOW * (1 + STEEP_BOW * steep * steep) * side;
  const control = a
    .clone()
    .add(b)
    .multiplyScalar(0.5)
    .add(
      new THREE.Vector2(-span.y, span.x).normalize().multiplyScalar(length * bow)
    );
  /*
   * A quadratic Bezier lies inside the hull of its three points, so clamping
   * the control point keeps the whole curve on screen. Without it a bowed climb
   * swings him off the side of the viewport on the way up.
   */
  control.x = THREE.MathUtils.clamp(control.x, bounds.minX, bounds.maxX);
  control.y = THREE.MathUtils.clamp(control.y, bounds.minY, bounds.maxY);
  return { from: a, to: b, control, length };
}

const _sample = new THREE.Vector2();

/**
 * How much of this route runs over something worth reading.
 *
 * Safe areas decide where he stops; without this they say nothing at all about
 * how he gets there, and he walked straight across a booking form on the way to
 * a perfectly chosen spot. Sampling the curve and counting the crossings costs
 * a dozen point tests once per leg.
 */
function routeCost(path: Path, busy: (x: number, y: number) => boolean) {
  let cost = 0;
  const STEPS = 12;
  for (let i = 1; i < STEPS; i++) {
    const t = i / STEPS;
    const u = 1 - t;
    _sample.set(
      u * u * path.from.x + 2 * u * t * path.control.x + t * t * path.to.x,
      u * u * path.from.y + 2 * u * t * path.control.y + t * t * path.to.y
    );
    if (busy(_sample.x, _sample.y)) cost++;
  }
  return cost;
}

/**
 * Pick the way round.
 *
 * Three candidates — bow left, bow right, straight — scored on how much content
 * each crosses, with a mild preference for the bow, because a curved leg reads
 * as a walk and a straight one reads as a slide.
 */
function makePath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  preferredSide: number,
  bounds: Bounds,
  busy?: (x: number, y: number) => boolean
): Path {
  const a = new THREE.Vector2(from.x, from.y);
  const b = new THREE.Vector2(to.x, to.y);

  const candidates = [
    { path: curve(a, b, preferredSide, bounds), penalty: 0 },
    { path: curve(a, b, -preferredSide, bounds), penalty: 0.4 },
    { path: curve(a, b, preferredSide * 2.2, bounds), penalty: 0.8 },
    { path: curve(a, b, -preferredSide * 2.2, bounds), penalty: 1.0 },
    { path: curve(a, b, 0, bounds), penalty: 1.4 },
  ];

  if (!busy) return candidates[0].path;

  let best = candidates[0].path;
  let bestCost = Infinity;
  for (const candidate of candidates) {
    const cost = routeCost(candidate.path, busy) + candidate.penalty;
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate.path;
    }
    if (bestCost <= candidate.penalty) break;
  }
  return best;
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

/** Facing and lean for a given travel direction on the screen. */
function travelPose(direction: THREE.Vector2) {
  const yaw = FACE_MAX * THREE.MathUtils.clamp(direction.x / 0.62, -1, 1);
  /* Zero when level, zero when straight up, strongest on the diagonals. */
  const lean = -LEAN_MAX * direction.x * direction.y * 2;
  return { yaw, lean };
}

export type StepOptions = {
  /** Where to do the next job. Called once, when he sets off for it. */
  place: Placer;
  characterScale: number;
  /** The world rectangle he is allowed to walk in. */
  bounds: Bounds;
  /** Scroll or resize made his current spot unusable. */
  displaced?: boolean;
  /** Is this world point on the plane currently under page content? */
  busyAt?: (x: number, y: number) => boolean;
};

export function stepTour(
  runtime: TourRuntime,
  stops: Stop[],
  dt: number,
  options: StepOptions
) {
  if (!stops.length) return;
  runtime.phaseElapsed += dt;

  const stop = stops[runtime.stopIndex % stops.length];

  /* Prop fade follows the phase: present from setting off until he walks away. */
  const wantProp =
    runtime.placed !== null &&
    runtime.phase !== "REST" &&
    runtime.phase !== "IDLE";
  runtime.propFade = approachValue(
    runtime.propFade,
    wantProp ? 1 : 0,
    dt,
    PROP_FADE_RATE
  );
  if (!wantProp && runtime.propFade < 0.02) runtime.propJobId = null;

  /** Choose somewhere for a job and start walking there. */
  const departFor = (index: number): boolean => {
    const next = stops[index % stops.length];
    const anchor = options.place(next.job);
    if (!anchor) return false;
    runtime.stopIndex = index % stops.length;
    runtime.placed = placeStop(next, anchor, options.characterScale);
    runtime.propJobId = next.job.id;
    setObjectFix(next.job.id, 0);
    runtime.path = null;
    runtime.t = 0;
    runtime.displaced = false;
    setPhase(runtime, "TRAVEL");
    return true;
  };

  const travel = (slow: boolean) => {
    const placed = runtime.placed;
    if (!placed) return true;
    if (!runtime.path) {
      runtime.path = makePath(
        runtime.position,
        placed.mark,
        runtime.stopIndex % 2 === 0 ? 1 : -1,
        options.bounds,
        options.busyAt
      );
      runtime.t = 0;
    }
    const hurry = slow
      ? 1
      : THREE.MathUtils.clamp(runtime.path.length / HURRY_FROM, 1, HURRY_MAX);
    const factor = (slow ? APPROACH_SPEED_FACTOR : 1) * hurry;
    /*
     * The walk is an in-place clip and the code does the moving, so the two
     * have to be told the same speed or the feet skate.
     */
    runtime.gait = factor;
    runtime.t = Math.min(
      1,
      runtime.t + (WALK_SPEED * factor * dt) / runtime.path.length
    );
    const { point, direction } = pathAt(runtime.path, runtime.t);
    runtime.position.set(point.x, point.y, 0);

    const pose = travelPose(direction);
    runtime.yaw = approachValue(runtime.yaw, pose.yaw, dt, 6);
    runtime.lean = approachValue(runtime.lean, pose.lean, dt, 5);
    return runtime.t >= 1;
  };

  switch (runtime.phase) {
    case "IDLE":
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      if (runtime.phaseElapsed >= OPENING_IDLE) {
        if (!departFor(runtime.stopIndex)) {
          runtime.restFor = 0.7;
          setPhase(runtime, "REST");
        }
      }
      break;

    case "REST":
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      runtime.yaw = approachValue(runtime.yaw, 0, dt, 3);
      if (runtime.phaseElapsed >= runtime.restFor) {
        if (!departFor(runtime.stopIndex + 1)) {
          /* Nowhere free right now — wait and ask again rather than barge on. */
          runtime.restFor = 0.8;
          setPhase(runtime, "REST");
        }
      }
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
      runtime.lean = approachValue(runtime.lean, 0, dt, 6);
      if (
        turnToward(runtime, runtime.placed?.workYaw ?? 0, dt) &&
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
      setObjectFix(stop.job.id, runtime.workProgress);
      if (runtime.workProgress >= 1) {
        setPhase(runtime, stop.exitSeconds > 0 ? "WORK_OUT" : "ADMIRE");
      }
      break;

    case "WORK_OUT":
      if (runtime.phaseElapsed >= stop.exitSeconds) {
        runtime.toolEquipped = false;
        setPhase(runtime, "ADMIRE");
      }
      break;

    /*
     * A beat to look at the finished thing.
     *
     * Without it the payoff is invisible: the repair completes on the last
     * frame of the work loop and he is already walking away. Standing still for
     * a second and a half, facing what he just did, is the difference between a
     * character performing tasks and a character pleased with himself.
     */
    case "ADMIRE":
      runtime.toolEquipped = false;
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      if (runtime.phaseElapsed >= ADMIRE_SECONDS) {
        runtime.tick += 1;
        if ((runtime.stopIndex + 1) % stops.length === 0) runtime.laps += 1;
        runtime.workProgress = 0;
        runtime.placed = null;
        runtime.restFor = REST_MIN + Math.random() * (REST_MAX - REST_MIN);
        setPhase(runtime, "REST");
      }
      break;
  }

  /*
   * Displacement: the screen moved and where he is standing is now under
   * something worth reading.
   *
   * He finishes what he is doing first — being dragged off a job mid-repair
   * reads as a glitch, and the repair is the point. Between jobs he simply
   * leaves early, which looks like him noticing and moving on.
   */
  if (options.displaced && !runtime.displaced) {
    runtime.displaced = true;
    if (runtime.phase === "REST" || runtime.phase === "IDLE") {
      runtime.restFor = 0;
    }
  }
}

export const PHASE_LABELS: Record<TourPhase, string> = {
  IDLE: "Getting started",
  TRAVEL: "Travelling",
  APPROACH: "Arriving",
  TURN_TO: "Turning to the job",
  WORK_IN: "Getting into position",
  WORK: "Working",
  WORK_OUT: "Standing back up",
  ADMIRE: "Admiring the work",
  REST: "Between jobs",
};
