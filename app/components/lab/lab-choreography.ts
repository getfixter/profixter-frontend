import * as THREE from "three";
import { FINISH_SECONDS, pickFinish, type FinishBeat } from "./lab-finish";
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
  /**
   * He has spotted the next one and is turning toward it.
   *
   * Travel used to begin the instant the previous job ended: he simply started
   * walking, which is the behaviour of something being moved rather than
   * somebody going somewhere. Half a second of noticing first is what makes the
   * walk look like a decision, and it is the cheapest anticipation in the whole
   * loop.
   */
  | "NOTICE"
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
  /** Where the working hand belongs: the work, minus a tool length. */
  handAt: THREE.Vector3;
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
  /** How much content this route crosses. Decides how fast he takes it. */
  cost?: number;
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
  /**
   * How tucked-away he is, 0 to 1.
   *
   * Vanishing whenever a page has no room for a repair was the right instinct
   * and too blunt an answer: on a pricing page, which is almost entirely cards
   * with a button in each, he was gone about two thirds of the time — and the
   * whole point of him is that somebody notices him. So instead of leaving he
   * gets small, steps into whatever narrow gap the page does have, and waits
   * there until there is room to work again. A man waiting with a toolbelt is
   * still a man waiting with a toolbelt.
   */
  smallness: number;
  /** Where he is waiting, while there is nowhere to work. */
  perch: THREE.Vector3 | null;
  /** How long that choice has stood. The page moves; the perch must too. */
  perchAge: number;
  /** The ending this repair is getting. Chosen as the work finishes. */
  finish: FinishBeat;
  /** 0 to 1 across that ending, for whoever is drawing it. */
  finishAt: number;
  /** The last few endings, so they do not repeat. */
  finishRecent: FinishBeat[];
  /**
   * How present he is, 0 to 1.
   *
   * Not a fade for its own sake. When the page has nowhere for him to stand he
   * has to be somewhere, and "frozen in the last place that worked" is the one
   * answer that looks broken. Stepping away and coming back when the reader
   * scrolls somewhere roomier is the behaviour that reads as tact.
   */
  presence: number;
};

export const WALK_SPEED = 1.05;
const APPROACH_FROM = 0.86;
const APPROACH_SPEED_FACTOR = 0.45;
const TURN_RATE = 3.0;
const TURN_EPSILON = 0.035;
/**
 * How far into the first repair the curtain goes up.
 *
 * Far enough that he is unmistakably working, close enough that the snap lands
 * inside the first couple of seconds. Not 1.0: the visitor has to see the thing
 * broken, however briefly, or the fix means nothing.
 */
const OPENING_AT = 0.55;


/** How long he stands about between jobs. Contrast is what gets noticed. */
/** How fast he arrives and leaves when the page runs out of room. */
const PRESENCE_RATE = 3.2;

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
      /* Divided by the speed it is played at, or he stands up before the
         phase that is meant to contain the standing up has finished. */
      enterSeconds: motion.enter
        ? clipSeconds(motion.enter.name) / (motion.enter.speed ?? 1)
        : 0,
      exitSeconds: motion.exit
        ? clipSeconds(motion.exit.name) / (motion.exit.speed ?? 1)
        : 0,
    };
  });
}

const _up = new THREE.Vector3(0, 1, 0);

/**
 * Turn "the repair is here" into everything else: where the prop is drawn,
 * where the tool points, and where he has to stand for his hand to arrive.
 */
/**
 * How mended the thing looks, given how far through the repair he is.
 *
 * The repair used to be a four-second cross-fade from broken to fixed, which
 * meant there was never a moment when it got fixed — the crooked lamp drifted
 * level so gradually that the eye read it as drift, not as success. Nothing to
 * notice, nothing to feel.
 *
 * So the damage now holds while he works, and then goes all at once with a
 * small overshoot, the way something does when it finally seats. That snap is
 * the payoff, and it is the only thing in the loop that has to land.
 */
export function repairCurve(t: number): number {
  const HOLD = 0.72;
  if (t < HOLD) return t * 0.06;
  const u = Math.min(1, (t - HOLD) / (1 - HOLD));
  /* Ease-out-back: reaches 1, tips just past it, settles. */
  const c = 2.1;
  const b = u - 1;
  const eased = b * b * ((c + 1) * b + c) + 1;
  return HOLD * 0.06 + (1 - HOLD * 0.06) * eased;
}

export function placeStop(
  stop: Stop,
  anchor: THREE.Vector3,
  characterScale: number,
  objectScale: number
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

  /*
   * The prop's offset is measured in the prop's own units.
   *
   * It exists to line the repaired part of a thing up with his hand — the loose
   * end of a towel bar, the corner of a picture frame — so it is a statement
   * about the object's geometry, not about the world. Holding it in world units
   * meant it stopped agreeing with the mesh the moment props changed size, and
   * a bar whose loose bracket should have sat under his hand ran clean through
   * his chest and out the other side instead.
   */
  const raw = job.objectOffset ?? [0, 0];
  const propScale = objectScale * (job.propScale ?? 1);
  const offset = [raw[0] * propScale, raw[1] * propScale];

  return {
    handAt: new THREE.Vector3(handTarget.x, handTarget.y, hand.z + PROP_DEPTH * 0.4),
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
    presence: 1,
    smallness: 0,
    perch: null,
    perchAge: 0,
    finish: "nod",
    finishAt: 0,
    finishRecent: [],
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

export function approachValue(
  current: number,
  target: number,
  dt: number,
  rate: number
) {
  return current + (target - current) * (1 - Math.exp(-rate * Math.min(dt, 0.1)));
}

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function curve(
  a: THREE.Vector2,
  b: THREE.Vector2,
  side: number,
  bounds: Bounds
): Path {
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
function routeCost(path: Path, busy: (x: number, y: number) => number) {
  let cost = 0;
  const STEPS = 12;
  for (let i = 1; i < STEPS; i++) {
    const t = i / STEPS;
    const u = 1 - t;
    _sample.set(
      u * u * path.from.x + 2 * u * t * path.control.x + t * t * path.to.x,
      u * u * path.from.y + 2 * u * t * path.control.y + t * t * path.to.y
    );
    /* A headline underfoot costs three times what a paragraph does. */
    cost += busy(_sample.x, _sample.y);
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
  busy?: (x: number, y: number) => number
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
  best.cost = bestCost;
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
  /** Layout prop scale, so a prop's offset scales with the prop. */
  objectScale: number;
  /** The world rectangle he is allowed to walk in. */
  bounds: Bounds;
  /** Scroll or resize made his current spot unusable. */
  displaced?: boolean;
  /** How unwelcome this world point is, 0 to 3. */
  busyAt?: (x: number, y: number) => number;
  /**
   * Somewhere small and harmless to wait, when there is nowhere to work.
   *
   * A much easier question than "where can he do a repair": no prop, no tool
   * clearance, and asked at a fraction of his own size.
   */
  perch?: () => THREE.Vector3 | null;
  /**
   * Is this a decent place to actually stand?
   *
   * Asked with the finished placement rather than the candidate anchor, because
   * between the two he moves: the tool stands his hand off from the work, the
   * work yaw turns the offset, and the result is a body a good few centimetres
   * from where the anchor implied. Checking the estimate said the stage was
   * clear while he stood on a pricing card.
   */
  standable?: (feet: THREE.Vector3) => boolean;
};

/**
 * Pick the ending, once, as the work finishes.
 *
 * Here rather than at the start of ADMIRE so it is chosen exactly once: the
 * phase handler runs every frame, and a beat that re-rolled sixty times a
 * second would be a flicker rather than a reaction.
 */
function chooseFinish(runtime: TourRuntime, stop: Stop) {
  runtime.finishAt = 0;
  runtime.finish = pickFinish(
    stop.job.effort ?? 0.5,
    stop.job.tool,
    runtime.tick === 0 && runtime.laps === 0,
    Math.random(),
    runtime.finishRecent
  );
  runtime.finishRecent.push(runtime.finish);
  if (runtime.finishRecent.length > 3) runtime.finishRecent.shift();
}

/**
 * How long he spends noticing, by what he is about to take on.
 *
 * Kept short. This is anticipation, not a performance — the moment it reads as
 * a pause rather than a glance it costs more than it buys.
 */
function noticeSeconds(stop: Stop): number {
  return 0.34 + 0.5 * (stop.job.effort ?? 0.5);
}

export function stepTour(
  runtime: TourRuntime,
  stops: Stop[],
  dt: number,
  options: StepOptions
) {
  if (!stops.length) return;
  /*
   * When he is in the way, everything he is doing happens faster.
   *
   * He used to simply note the displacement and carry on at full length, which
   * could leave him standing over a headline for the six seconds of a repair
   * and its admiring pause. Abandoning the job mid-repair is worse — that reads
   * as a glitch — so instead he wraps up: the same beats, at nearly three times
   * the pace, and then he is gone. The animation itself keeps its own speed, so
   * what you see is a man finishing quickly rather than a video scrubbing.
   *
   * Latched on the runtime rather than read from the flag, because the flag is
   * a scroll-settle observation that clears itself after a second or so. He
   * needs to stay in a hurry until he has actually got out of the way, which is
   * when the next job clears it.
   */
  const inTheWay = options.displaced || runtime.displaced;
  const urgency = inTheWay ? 2.8 : 1;
  runtime.phaseElapsed += dt * urgency;

  const stop = stops[runtime.stopIndex % stops.length];

  /*
   * Present when he has somewhere to be, away when he does not.
   *
   * Resting with no placement is the "nowhere free" state: the search refused
   * every spot on the page and he is waiting for the view to change.
   */
  /*
   * Waiting small beats not being there.
   *
   * He only actually leaves if even a perch is impossible, which on a real page
   * is rare — there is nearly always a gutter, a margin or a gap between
   * sections that a smaller man fits into.
   */
  const stranded = runtime.phase === "REST" && !runtime.placed;
  runtime.perchAge += dt;
  /*
   * Ask again every couple of seconds.
   *
   * A perch chosen once is a perch chosen for the page as it was: scroll, or
   * switch what is underneath him, and he is left standing in the middle of a
   * paragraph that arrived after he sat down. Re-asking is cheap — it is the
   * same search the placer does, at a fraction of the size — and it is what
   * makes waiting look like a decision rather than a stall.
   */
  if (stranded && options.perch && (!runtime.perch || runtime.perchAge > 2.4)) {
    const next = options.perch();
    if (next) {
      runtime.perch = next;
      runtime.perchAge = 0;
    } else if (runtime.perchAge > 2.4) {
      runtime.perch = null;
      runtime.perchAge = 0;
    }
  }
  if (!stranded && runtime.perch) runtime.perch = null;
  runtime.smallness = approachValue(
    runtime.smallness,
    stranded && runtime.perch ? 1 : 0,
    dt,
    2.4
  );
  if (stranded && runtime.perch) {
    /* Amble over rather than teleport; it is a pause, not a cut. */
    runtime.position.lerp(runtime.perch, 1 - Math.exp(-2.2 * dt));
    runtime.yaw = approachValue(runtime.yaw, 0, dt, 3);
  }
  const wantPresence: number = stranded && !runtime.perch ? 0 : 1;
  runtime.presence = approachValue(
    runtime.presence,
    wantPresence,
    dt,
    PRESENCE_RATE
  );

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
    const placed = placeStop(
      next,
      anchor,
      options.characterScale,
      options.objectScale
    );
    if (options.standable && !options.standable(placed.mark)) return false;
    runtime.stopIndex = index % stops.length;
    runtime.placed = placed;
    runtime.propJobId = next.job.id;
    setObjectFix(next.job.id, 0);
    runtime.path = null;
    runtime.t = 0;
    runtime.displaced = false;
    /* Look at it before walking to it. */
    setPhase(runtime, "NOTICE");
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
    /*
     * Cross quickly what cannot be walked around.
     *
     * On a three-hundred-and-ninety pixel page a full-width headline between
     * two places he is allowed to stand has no way round it — the bow is
     * perpendicular to the journey, and for a mostly vertical move that swings
     * him sideways, which does not help. So the route cost, which already knows
     * a headline costs three times a paragraph, also decides how fast he goes
     * over it. Strolling through a headline reads as oblivious; getting across
     * it reads as a man passing through.
     */
    const crossing = 1 + Math.min(1.3, (runtime.path.cost ?? 0) * 0.16);
    /*
     * He walks differently depending on what he is walking toward.
     *
     * An unhurried amble after a light switch, a purposeful one on the way to a
     * shelf bracket. Small — a third either side — because the difference has
     * to read as attitude and not as a speed change.
     */
    const purpose = 0.84 + 0.42 * (stop.job.effort ?? 0.5);
    const hurry = slow
      ? purpose
      : THREE.MathUtils.clamp(runtime.path.length / HURRY_FROM, 1, HURRY_MAX) *
        crossing *
        purpose;
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
      /*
       * There is no opening idle any more.
       *
       * He used to stand in the middle of the screen for a beat, then walk for
       * four seconds, then crouch, and the first thing a visitor could actually
       * understand arrived somewhere past fifteen seconds. Nobody waits that
       * long for a decoration on a page they came to for something else.
       *
       * So the curtain goes up on a repair already in progress: he is at the
       * job, tool out, working, and the thing he is working on is visibly
       * broken. The payoff lands a second and a half later. Whatever else the
       * loop does after that, it has already said what he is.
       */
      if (departFor(runtime.stopIndex)) {
        const stop = stops[runtime.stopIndex % stops.length];
        runtime.position.copy(runtime.placed!.mark);
        runtime.yaw = runtime.placed!.workYaw;
        runtime.toolEquipped = stop.job.tool !== null;
        runtime.propFade = 1;
        runtime.path = null;
        setPhase(runtime, "WORK");
        /* Drop him in with the repair most of the way through. */
        runtime.phaseElapsed = stop.job.workSeconds * OPENING_AT;
      } else {
        runtime.restFor = 0.4;
        setPhase(runtime, "REST");
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

    case "NOTICE": {
      /*
       * A beat of orientation: the head goes first, the shoulders follow, and
       * only then does he set off. Longer when the next job is a heavy one,
       * because sizing up a shelf bracket takes a moment more than glancing at
       * a light switch.
       */
      const target = runtime.placed;
      if (!target) {
        setPhase(runtime, "TRAVEL");
        break;
      }
      const dx = target.mark.x - runtime.position.x;
      const dy = target.mark.y - runtime.position.y;
      runtime.yaw = approachValue(
        runtime.yaw,
        Math.atan2(dx, Math.abs(dy) + 0.4) * 0.45,
        dt,
        5
      );
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      /*
       * Heavier jobs get the tool out before he sets off.
       *
       * A man who picks up a drill and then walks somewhere is going to drill
       * something; a man who walks empty-handed and produces one on arrival is
       * a magic trick. Only for the jobs worth the gesture — most of the time
       * his hands stay free, which is also what makes it mean anything.
       */
      if ((stop.job.effort ?? 0.5) >= 0.6 && stop.job.tool) {
        runtime.toolEquipped = true;
      }
      if (runtime.phaseElapsed >= noticeSeconds(stop)) {
        setPhase(runtime, "TRAVEL");
      }
      break;
    }

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
      setObjectFix(stop.job.id, repairCurve(runtime.workProgress));
      if (runtime.workProgress >= 1) {
        if (stop.exitSeconds <= 0) chooseFinish(runtime, stop);
        setPhase(runtime, stop.exitSeconds > 0 ? "WORK_OUT" : "ADMIRE");
      }
      break;

    case "WORK_OUT":
      if (runtime.phaseElapsed >= stop.exitSeconds) {
        runtime.toolEquipped = false;
        chooseFinish(runtime, stop);
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
      runtime.finishAt = Math.min(
        1,
        runtime.phaseElapsed / Math.max(0.2, FINISH_SECONDS[runtime.finish])
      );
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      if (runtime.phaseElapsed >= FINISH_SECONDS[runtime.finish]) {
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
  NOTICE: "Noticing the next one",
  TRAVEL: "Travelling",
  APPROACH: "Arriving",
  TURN_TO: "Turning to the job",
  WORK_IN: "Getting into position",
  WORK: "Working",
  WORK_OUT: "Standing back up",
  ADMIRE: "Admiring the work",
  REST: "Between jobs",
};
