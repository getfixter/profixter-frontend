import * as THREE from "three";
import { FINISH_SECONDS, pickFinish, type FinishBeat } from "./lab-finish";
import {
  TOOL_SCALE,
  WORK_MOTIONS,
  type JobDefinition,
  type WorkMotion,
} from "./lab-jobs";
import {
  emptyMemory,
  pickNext,
  remember,
  type ScheduleMemory,
} from "./lab-schedule";
import { shapeOf } from "./lab-pace";
import {
  OPENING_PLAN,
  PIVOT_RANGE,
  planTransition,
  type TransitionPlan,
} from "./lab-transition";
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
  /** A beat of looking it over on arrival, before the tool comes out. */
  | "INSPECT"
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
/** One place in the house where something needs doing, or recently did. */
export type Station = {
  key: number;
  jobId: string;
  index: number;
  placed: Placement;
  /** 0 to 1, so arriving and leaving are always eased. */
  fade: number;
  /** True once he has finished it; it stays on screen, mended. */
  done: boolean;
  /** Seconds since it was finished, for choosing what to recycle. */
  age: number;
  /** How many times he has mended this one. */
  visits: number;
  /**
   * The object's real size in world units, measured once it has been drawn.
   *
   * Estimating this from the job's footprint was wrong in the direction that
   * matters: the estimate was smaller than the object, so the content check
   * passed while the thing on screen sat across a paragraph. A measured box
   * cannot disagree with what the viewer sees.
   */
  boxW: number;
  boxH: number;
  /** Counts up while it is being retired. */
  retiring: boolean;
};

export type Placement = {
  /**
   * How large he may be at this spot, as a fraction of his usual size.
   *
   * A dense page often has room for a smaller handyman and none at all for a
   * full-sized one. Carrying the fit on the placement — rather than only using
   * it to pick the square — is what makes the geometry agree with the picture:
   * his reach, his prop and his body all shrink together.
   */
  fit: number;
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
export type Placer = (
  job: JobDefinition
) => { point: THREE.Vector3; fit: number } | null;

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
  /** What he has done lately, so the next choice can contrast with it. */
  schedule: ScheduleMemory;
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
  /**
   * The NEXT repair, chosen and placed before he has finished this one.
   *
   * The old loop picked the next job at the instant he set off, which meant the
   * broken thing appeared on screen at exactly the moment he turned to look at
   * it — a spawn, and unmistakably one. Deciding a few seconds early lets the
   * thing arrive while a viewer is still watching him finish, which is the one
   * moment nobody is looking at that piece of empty page.
   */
  nextIndex: number | null;
  nextPlaced: Placement | null;
  nextJobId: string | null;
  nextFade: number;
  /**
   * How much the last job took out of him, 1 fresh to about 0.8 spent.
   *
   * Decays back to 1 as he walks, so the effect is on the first strides after a
   * heavy repair and gone by the time he arrives.
   */
  weariness: number;
  /** The shape of the journey into the job he is currently doing. */
  plan: TransitionPlan;
  /** Recent journey shapes, so the same one does not come up twice running. */
  planRecent: string[];
  /** True once his attention has landed on the target during a walk. */
  discovered: boolean;
  /**
   * The repair he has just finished, still on screen and fading.
   *
   * Removing the rest beat removed the gap that used to cover this: the old
   * prop was hidden while he stood about, and the new one appeared afterwards.
   * With the transitions flowing straight through — and especially on a pivot,
   * where he never walks away from it — the finished thing was being swapped
   * for the next one in plain sight, a foot from his hands. It needs its own
   * slot to fade out in, which is the mirror of the one the next job eases in
   * through.
   */
  goneJobId: string | null;
  gonePlaced: Placement | null;
  goneFade: number;
  /**
   * The household, as a persistent set of places rather than one prop at a time.
   *
   * The world used to be rebuilt around whichever job the scheduler had picked:
   * a sink existed while he was at the sink and then stopped existing. Three
   * slots — leaving, current, arriving — and everything else simply was not
   * there, which is why the furniture appeared to be spawned for each repair.
   *
   * These are STATIONS. Each holds a repair, keeps its place, and stays on
   * screen whether or not he is anywhere near it, so the page has a lamp over
   * there and a cabinet over there the way a room does. A station is only ever
   * recycled when its repair is long finished, he is nowhere near it, and a new
   * job genuinely needs somewhere to go.
   */
  stations: Station[];
  stationKey: number;
  stationCheck: number;
  blocked: boolean;
  blockedFor: number;
  blockCheck: number;
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
  /**
   * Where the page was, in world units, when everything was last positioned.
   *
   * The whole household is glued to the DOCUMENT, not to the screen: when the
   * reader scrolls, every mark, prop and anchor moves with the copy it was
   * placed beside. This is the last offset that was applied, and the difference
   * against the current one is how far everything has to travel this frame.
   */
  pageAt: THREE.Vector2 | null;
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
/*
 * Nudged later after the placement gate got stricter about controls.
 *
 * The first spot now occasionally fails and retries, which costs a fraction of
 * a second before he is even on screen, and that fraction was coming out of the
 * only budget that matters. Starting slightly deeper into the repair gives it
 * back without touching the part that has to be true: the thing is still
 * visibly broken when the curtain goes up.
 */
const OPENING_AT = 0.63;


/** How long he stands about between jobs. Contrast is what gets noticed. */
/** How fast he arrives and leaves when the page runs out of room. */
const PRESENCE_RATE = 3.2;

/** The one place a neutral wait still exists: nowhere to put the next job. */
const REST_MIN = 0.6;

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
/**
 * How fast a repair that nobody has walked to yet eases in.
 *
 * Deliberately slower than the working prop's fade. A thing that arrives in
 * under a second has announced itself whatever else is on screen; at this rate
 * it takes about two, spent while a viewer is watching him finish something
 * else, and by the time anyone looks over it has simply always been there.
 */
const STAGE_FADE_RATE = 1.15;

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

/**
 * Record how big a station's object really is, once it has been drawn.
 *
 * A function rather than a direct assignment because the React Compiler
 * (correctly) refuses mutation of anything that reached the component through a
 * hook, and the runtime does. Same pattern as the finish pose.
 */
export function rememberStationBox(
  station: Station,
  w: number,
  h: number
): void {
  station.boxW = w;
  station.boxH = h;
  /*
   * Remembered at FULL size, not at the size it happened to be drawn.
   *
   * A station that could only be placed by shrinking is measured shrunk, and a
   * remembered size that carries someone else's fit is a size that is wrong
   * everywhere else. Divide it back out and the memory is a property of the
   * repair rather than of one spot on one screen.
   */
  const fit = station.placed.fit || 1;
  MEASURED.set(station.jobId, { w: w / fit, h: h / fit });
}

/**
 * How big each repair actually draws, learned the first time it appears.
 *
 * Placement was validating the character's standing box and an ESTIMATE of the
 * prop — a single number per job, scaled by his body — while what lands on the
 * page is the object plus the piece of wall, tile or door it is mounted on, two
 * to three times larger. So a spot could pass with his body clear and a cabinet
 * sitting across a paragraph, and nothing caught it afterwards because the one
 * station the content re-check leaves alone is the one he is walking to.
 *
 * A repair is the same size every time it is drawn, so measuring it once is
 * enough: the first appearance uses the estimate, every appearance after that
 * is checked against the real thing.
 */
const MEASURED = new Map<string, { w: number; h: number }>();

/** The measured size of this repair, if it has been on screen this visit. */
export function measuredSpan(jobId: string): { w: number; h: number } | null {
  return MEASURED.get(jobId) ?? null;
}

/**
 * The size this repair will actually be drawn at, here.
 *
 * Coverage is a SHARE of the box, so checking a full-sized box against a spot
 * that only has room for a two-thirds-sized one divides the answer down by the
 * square of the difference — a repair genuinely sitting on nearly half a
 * paragraph can report a sixth of one and pass. Every check has to ask about
 * the object as it will be seen, which means at its fit.
 */
function spanAt(
  jobId: string,
  fit: number,
  fallback: number
): { w: number; h: number } | number {
  const seen = MEASURED.get(jobId);
  if (!seen) return fallback;
  return { w: seen.w * fit, h: seen.h * fit };
}

/**
 * Record a repair's size before it is ever placed.
 *
 * Measuring on first appearance is too late by exactly one appearance, and the
 * first appearance of each repair is the part of the visit everybody sees. The
 * renderer draws one invisible copy of every job at startup and calls this, so
 * the very first placement is checked against the real object rather than
 * against a number somebody typed into the job list.
 */
export function rememberJobBox(jobId: string, w: number, h: number): void {
  if (w > 0 && h > 0) MEASURED.set(jobId, { w, h });
}

export function placeStop(
  stop: Stop,
  anchor: THREE.Vector3,
  characterScale: number,
  objectScale: number,
  fit = 1
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
    fit,
  };
}

/* ----------------------------------------------------------------- runner */

export function createTourRuntime(): TourRuntime {
  resetObjectFix();
  return {
    stopIndex: 0,
    schedule: emptyMemory(),
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
    nextIndex: null,
    nextPlaced: null,
    nextJobId: null,
    nextFade: 0,
    weariness: 1,
    plan: OPENING_PLAN,
    planRecent: [],
    discovered: true,
    goneJobId: null,
    gonePlaced: null,
    goneFade: 0,
    stations: [],
    stationKey: 1,
    stationCheck: 0,
    blocked: false,
    blockedFor: 0,
    blockCheck: 0,
    restFor: REST_MIN,
    displaced: false,
    presence: 1,
    smallness: 0,
    perch: null,
    perchAge: 0,
    finish: "nod",
    finishAt: 0,
    finishRecent: [],
    pageAt: null,
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

/**
 * Which way he is heading right now, for anything that needs to look along the
 * path rather than at the destination.
 */
export function pathHeading(path: Path, t: number): { x: number; y: number } {
  const { direction } = pathAt(path, t);
  return { x: direction.x, y: direction.y };
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
  /**
   * Is he covering something right now?
   *
   * Asked continuously rather than only when a scroll settles. Everything else
   * in this file validates a spot at the moment it is CHOSEN, which is correct
   * and insufficient: the page moves underneath him afterwards. A reader
   * scrolling a paragraph under a working handyman was the single biggest
   * source of covered text in the recording, and nothing was watching for it —
   * the old response to being in the way was to work faster, which means
   * several more seconds sitting on the copy.
   */
  blocked?: () => boolean;
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
  standable?: (
    feet: THREE.Vector3,
    propAt?: THREE.Vector3,
    propSpan?: number | { w: number; h: number },
    fit?: number
  ) => boolean;
  /**
   * How many repairs may stand in the world at once.
   *
   * Fewer on a phone, where there is far less room to put them without
   * covering something.
   */
  maxStations?: number;
  /** How far apart two stations must stand, in world units. */
  stationGap?: number;
  /**
   * Where the page has been scrolled to, as a world-space offset.
   *
   * THE fix for content overlap, and the reason most of the re-checking below
   * is now a safety net rather than the mechanism. Everything used to be
   * anchored to the VIEWPORT: a spot was chosen in a genuinely empty piece of
   * screen and was correct until the reader scrolled a paragraph underneath it,
   * which takes about a second. No amount of re-validation fixes that — it only
   * decides whether the answer is "an object on the text" or "objects vanishing
   * constantly", and both are wrong.
   *
   * Anchored to the page instead, a placement that was clear when it was made
   * STAYS clear, because it travels with the very content it was placed beside.
   * Scrolling stops being a hazard and becomes what it is on any other page:
   * the furniture moves with the room.
   */
  pageOffset?: () => THREE.Vector2;
  /**
   * Is this repair sitting on top of something a reader is trying to use?
   *
   * Asked about the ONE station the content check is not allowed to touch: the
   * repair he is committed to. Taking that away over a paragraph reads as a
   * glitch and costs more than the overlap — I measured it, and it put a third
   * of the run back to standing about. A button is different. The page is there
   * to be used, and a cabinet door across "Book your free visit" is the one
   * overlap with a price on it.
   */
  onControl?: (
    propAt: THREE.Vector3,
    span: number | { w: number; h: number },
    fit: number
  ) => boolean;
  /**
   * Is this world point still on screen?
   *
   * Page-anchored things scroll away. A station that has left the screen is
   * retired — which costs nothing visually, because nobody can see it — and its
   * repair becomes available to place again somewhere the reader is actually
   * looking.
   */
  inView?: (point: THREE.Vector3) => boolean;
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
/**
 * How long he spends noticing, before he sets off.
 *
 * Longer for heavy work, because sizing up a shelf bracket takes a moment more
 * than glancing at a light switch — and much shorter when the next job is a
 * couple of steps away, because nobody stops to consider something they could
 * reach by leaning. A short hop that gets the full noticing beat reads as a man
 * being careful about nothing.
 */
function noticeSeconds(stop: Stop, distance: number): number {
  const base = 0.34 + 0.5 * (stop.job.effort ?? 0.5);
  const near = THREE.MathUtils.clamp(distance / SHORT_HOP, 0.35, 1);
  return base * near * shapeOf(stop.job).noticeScale;
}

/** Below this, a journey is a reposition rather than a walk. */
const SHORT_HOP = 2.4;

/**
 * How far apart two things in the house have to stand.
 *
 * Generous, because a repair is not just its prop: most of them carry a piece
 * of wall or tile that is two or three times the size of the object on it, and
 * two of those touching reads as one incoherent object rather than two things.
 */
const STATION_GAP = 2.1;

/**
 * Move the whole world with the page.
 *
 * Positions are kept in world units rather than in page coordinates because
 * everything else — walking, reaching, the IK, the camera — is in world units
 * and converting at every use would be a much larger change for the same
 * result. So the world is translated instead, once a frame, by however far the
 * document has moved since the last one.
 *
 * Every vector that describes WHERE SOMETHING IS has to be in here. A single
 * one left out is a repair whose prop scrolls away from the hand fixing it.
 */
function driftWithPage(runtime: TourRuntime, dx: number, dy: number) {
  const moved = new Set<Placement>();
  const move = (placement: Placement | null) => {
    if (!placement || moved.has(placement)) return;
    moved.add(placement);
    placement.handAt.x += dx;
    placement.handAt.y += dy;
    placement.anchor.x += dx;
    placement.anchor.y += dy;
    placement.object.x += dx;
    placement.object.y += dy;
    placement.workPoint.x += dx;
    placement.workPoint.y += dy;
    placement.mark.x += dx;
    placement.mark.y += dy;
  };
  move(runtime.placed);
  move(runtime.nextPlaced);
  move(runtime.gonePlaced);
  for (const station of runtime.stations) move(station.placed);
  runtime.position.x += dx;
  runtime.position.y += dy;
  if (runtime.perch) {
    runtime.perch.x += dx;
    runtime.perch.y += dy;
  }
  const path = runtime.path;
  if (path) {
    path.from.x += dx;
    path.from.y += dy;
    path.to.x += dx;
    path.to.y += dy;
    path.control.x += dx;
    path.control.y += dy;
  }
}

export function stepTour(
  runtime: TourRuntime,
  stops: Stop[],
  dt: number,
  options: StepOptions
) {
  if (!stops.length) return;

  /*
   * First, before anything reads a position: go where the page went.
   */
  if (options.pageOffset) {
    const at = options.pageOffset();
    if (!runtime.pageAt) runtime.pageAt = at.clone();
    const dx = at.x - runtime.pageAt.x;
    const dy = at.y - runtime.pageAt.y;
    if (dx !== 0 || dy !== 0) {
      runtime.pageAt.copy(at);
      driftWithPage(runtime, dx, dy);
    }
  }

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
  /*
   * Get out of the way first, and ask questions afterwards.
   *
   * Checked six times a second. When the page has moved under him he fades out
   * where he stands, gives up the spot, and comes back somewhere that has room
   * — which is both instant and guaranteed, where hurrying was neither.
   */
  runtime.blockCheck += dt;
  if (runtime.blockCheck > 0.1) {
    runtime.blockCheck = 0;
    const blocked = options.blocked ? options.blocked() : false;
    if (blocked) runtime.blockedFor += 0.1;
    else runtime.blockedFor = 0;
    runtime.blocked = blocked;
  }
  /* Long enough to be sure it is not a momentary overlap during a step. */
  if (runtime.blockedFor > 0.2 && runtime.placed) {
    runtime.placed = null;
    runtime.path = null;
    runtime.restFor = 0.3;
    setPhase(runtime, "REST");
  }

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
    /*
     * Invisible? Then simply be there.
     *
     * Ambling is right when a viewer can see him. When the reader has scrolled
     * a screenful away he is page-anchored, out of shot and fully faded, and
     * gliding back at walking pace means several seconds of nothing while the
     * character crosses a stretch of document nobody is looking at.
     */
    if (runtime.presence < 0.05) runtime.position.copy(runtime.perch);
    /* Amble over rather than teleport; it is a pause, not a cut. */
    else runtime.position.lerp(runtime.perch, 1 - Math.exp(-2.2 * dt));
    runtime.yaw = approachValue(runtime.yaw, 0, dt, 3);
  }
  const wantPresence: number =
    runtime.blocked || (stranded && !runtime.perch) ? 0 : 1;
  runtime.presence = approachValue(
    runtime.presence,
    wantPresence,
    dt,
    /* Out of the way fast, back at a civilised pace. */
    runtime.blocked ? 9 : PRESENCE_RATE
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

  /*
   * The staged repair eases in on its own clock, slower than the one he is
   * working on. Slow is the whole point: anything that arrives quickly enough
   * to notice has announced itself.
   */
  runtime.nextFade = approachValue(
    runtime.nextFade,
    runtime.nextPlaced ? 1 : 0,
    dt,
    STAGE_FADE_RATE
  );
  if (!runtime.nextPlaced && runtime.nextFade < 0.02) runtime.nextJobId = null;

  /* The finished repair eases out on its own clock, unhurried. */
  runtime.goneFade = approachValue(runtime.goneFade, 0, dt, 1.5);
  if (runtime.goneFade < 0.02) {
    runtime.goneJobId = null;
    runtime.gonePlaced = null;
  }

  /*
   * The stations simply exist.
   *
   * Everything fades toward present unless it is being retired, and retiring
   * only ever happens to a station he has finished with and walked away from.
   * Nothing disappears because a job ended.
   */
  for (const station of runtime.stations) {
    station.fade = approachValue(
      station.fade,
      station.retiring ? 0 : 1,
      dt,
      station.retiring ? 3.6 : 1.3
    );
    if (station.done) station.age += dt;
  }
  runtime.stations = runtime.stations.filter(
    (station) => !station.retiring || station.fade > 0.02
  );

  /**
   * Put a repair into the registry.
   *
   * The registry is the only thing that draws anything, so a repair that is not
   * in it does not exist on screen however carefully it has been placed. That
   * sounds obvious and it was not: `departFor` could place a job for itself,
   * set it as his current work, and send him off to fix a thing nobody had
   * drawn — which is exactly what the cold opening did, because the opening
   * never goes through the staging path. He arrived, raised the screwdriver and
   * worked on an empty piece of page, and every number said the run was fine.
   */
  const addStation = (
    jobId: string,
    index: number,
    placed: Placement
  ): Station => {
    const station: Station = {
      key: runtime.stationKey++,
      jobId,
      index: index % stops.length,
      placed,
      fade: 0,
      done: false,
      age: 0,
      visits: 0,
      boxW: 0,
      boxH: 0,
      retiring: false,
    };
    runtime.stations.push(station);
    setObjectFix(jobId, 0);
    return station;
  };

  /**
   * Find a home for a job without committing to it.
   *
   * Split out of departFor so the next repair can be put on screen well before
   * he goes anywhere near it.
   */
  const placeFor = (index: number): Placement | null => {
    const next = stops[index % stops.length];
    /*
     * Keep the house tidy.
     *
     * The spot finder knows about the page's content and about where HE is; it
     * knows nothing about the rest of the household, because until now there
     * was no rest of the household. Left alone it piled a sink, a towel rail
     * and a cabinet into the same corner. Asking a few times and taking the
     * first answer that clears the other stations costs nothing — the finder
     * remembers what it has already offered, so each ask is a different spot.
     */
    let placed: Placement | null = null;
    let noAnchor = 0;
    let crowdedOut = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const spot = options.place(next.job);
      if (!spot) {
        noAnchor += 1;
        continue;
      }
      /*
       * Everything shrinks together.
       *
       * The spot finder may only have room for a smaller handyman, and his
       * reach, his mark and his prop are all derived from his size — so the fit
       * has to go into the geometry, not just into the drawing. Scaling only
       * the picture would leave him reaching for a prop that had not moved.
       */
      const candidate = placeStop(
        next,
        spot.point,
        options.characterScale * spot.fit,
        options.objectScale * spot.fit,
        spot.fit
      );
      /*
       * The gap has to be a share of the room, not a constant.
       *
       * Two world units is generous on a desktop hero and most of the width of
       * a phone — at 390 pixels it rejected everywhere, `placeFor` returned
       * nothing every time, and he stood in the hero for eighteen seconds with
       * nowhere the system would let him go. That is the rest beat coming back
       * through the side door.
       */
      /*
       * Ask generously first, then settle.
       *
       * A flat requirement means that on a busy page every candidate is refused
       * and nothing gets placed — and "nothing gets placed" is the rest beat
       * coming back, because he ends up with nowhere to be sent. Relaxing the
       * spacing across attempts keeps a tidy house when there is room for one
       * and still always finds him somewhere to work.
       */
      const relax = [1, 1, 0.78, 0.78, 0.5, 0.3][attempt] ?? 0.3;
      const gap = (options.stationGap ?? STATION_GAP) * relax;
      const crowded = runtime.stations.some(
        (station) =>
          !station.retiring &&
          (station.placed.object.distanceTo(candidate.object) < gap ||
            station.placed.mark.distanceTo(candidate.mark) < gap * 0.8)
      );
      if (!crowded) {
        placed = candidate;
        break;
      }
      crowdedOut += 1;
      /*
       * No fallback to a crowded spot.
       *
       * Taking the least-bad answer piled a picture, a socket, a door and a
       * towel rail into the same two hundred pixels. If the house is genuinely
       * full, the right answer is to not add anything this time — he has plenty
       * to be getting on with, and a station will free up shortly.
       */
    }
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      const tally = (w.__fxPlace ?? { ok: 0, noAnchor: 0, crowded: 0, unstandable: 0 }) as Record<string, number>;
      if (!placed) {
        if (noAnchor >= crowdedOut) tally.noAnchor += 1;
        else tally.crowded += 1;
      }
      w.__fxPlace = tally;
    }
    if (!placed) return null;
    if (
      options.standable &&
      !options.standable(
        placed.mark,
        placed.object,
        spanAt(next.job.id, placed.fit, next.job.footprint?.w ?? 1),
        placed.fit
      )
    ) {
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as Record<string, unknown>;
        const tally = (w.__fxPlace ?? { ok: 0, noAnchor: 0, crowded: 0, unstandable: 0 }) as Record<string, number>;
        tally.unstandable += 1;
        w.__fxPlace = tally;
      }
      return null;
    }
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      const tally = (w.__fxPlace ?? { ok: 0, noAnchor: 0, crowded: 0, unstandable: 0 }) as Record<string, number>;
      tally.ok += 1;
      w.__fxPlace = tally;
    }
    return placed;
  };

  /*
   * Stations are anchored to the VIEWPORT, and the page scrolls underneath.
   *
   * That is the right model for a character who lives on the screen, and it
   * means a station that was standing in clear space is standing on a paragraph
   * a moment later through no fault of its own. Nothing was re-checking them:
   * only the repair he was walking to was ever validated, so the rest of the
   * household quietly drifted over the copy.
   *
   * Re-asked a few times a second. A station that has ended up over content is
   * retired — it fades, and its repair is free to reappear somewhere sensible —
   * unless he is working at it, because pulling the floor from under him mid-job
   * would be worse than the overlap.
   */
  runtime.stationCheck += dt;
  if (runtime.stationCheck > 0.2 && options.standable) {
    runtime.stationCheck = 0;
    /*
     * The repair he is committed to is exempt.
     *
     * I tried narrowing this to "only while his hands are on it", so that a
     * station he was merely walking towards could still be taken away. It read
     * far worse: pulling the destination out from under an approach sent him
     * back to standing about, and the run went from fifteen per cent of samples
     * with nothing happening to fifty-two, with a twenty-two second stretch of
     * nothing. Reverted. A staged spot is re-checked once, at the moment he
     * commits to it, which is the right place for that question.
     */
    for (const station of runtime.stations) {
      if (station.retiring) continue;
      const job = stops[station.index % stops.length]?.job;
      /* Its measured size where we have one, the estimate until then. */
      const span =
        station.boxW > 0
          ? { w: station.boxW, h: station.boxH }
          : spanAt(station.jobId, station.placed.fit, job?.footprint?.w ?? 1);
      if (station.jobId === runtime.propJobId) {
        /*
         * Exempt from the content check. Never exempt from the button check.
         *
         * If the page has carried his work over something the reader is trying
         * to press, the repair goes and he goes with it — he cannot stand there
         * fixing a lamp on top of the booking button because he got there
         * first.
         */
        if (
          options.onControl &&
          options.onControl(station.placed.object, span, station.placed.fit)
        ) {
          station.retiring = true;
          station.fade = Math.min(station.fade, 0.35);
          if (runtime.placed === station.placed) {
            runtime.placed = null;
            runtime.path = null;
            runtime.restFor = 0.3;
            setPhase(runtime, "REST");
          }
        }
        continue;
      }
      /*
       * Gone off the screen with the page? Then it can go.
       *
       * Retiring something nobody can see is free, and it is what keeps the
       * household in front of the reader: the slot it gives up is immediately
       * available to a repair placed where they are actually looking. This is
       * the only kind of disappearance the page-anchored world needs, and it
       * happens out of sight by construction.
       */
      if (options.inView && !options.inView(station.placed.object)) {
        station.retiring = true;
        continue;
      }
      const ok = options.standable(
        station.placed.mark,
        station.placed.object,
        span,
        station.placed.fit
      );
      if (!ok) {
        station.retiring = true;
        /*
         * Out quickly, because it is on the copy for every frame it lingers.
         *
         * A gentle fade is right for a station whose work is finished and which
         * is making way; it is the wrong answer for one that a scroll has just
         * put across a button. Dropping it most of the way at once makes it
         * gone within about a fifth of a second.
         */
        station.fade = Math.min(station.fade, 0.35);
      }
    }
  }

  /**
   * Line the next repair up while he is still finishing this one.
   *
   * Called during the ending beat. By the time he straightens up and looks
   * round, the next broken thing has been sitting there for a couple of seconds
   * — so what a viewer sees is a man noticing something, rather than something
   * appearing because a man is about to notice it.
   */
  const stageNext = () => {
    if (runtime.nextIndex !== null) return;

    /* Send him to a station by index, whatever its current state. */
    const goTo = (station: Station): void => {
      station.done = false;
      station.retiring = false;
      station.age = 0;
      station.visits += 1;
      runtime.nextIndex = station.index;
      runtime.nextPlaced = station.placed;
      runtime.nextJobId = station.jobId;
      runtime.nextFade = station.fade;
      setObjectFix(station.jobId, 0);
    };

    const index = pickNext(stops, runtime.schedule, Math.random());
    const job = stops[index % stops.length].job;

    /*
     * If this repair is already standing somewhere, go to it.
     *
     * A station that is still on screen and not yet mended IS the job; walking
     * to it beats inventing a second copy elsewhere.
     */
    const standing = runtime.stations.find(
      (s) => s.jobId === job.id && !s.done && !s.retiring
    );
    if (standing) {
      runtime.nextIndex = index;
      runtime.nextPlaced = standing.placed;
      runtime.nextJobId = job.id;
      runtime.nextFade = standing.fade;
      return;
    }

    const limit = options.maxStations ?? 4;
    /*
     * Retire anything he has already been back to.
     *
     * A world that never turns over is its own kind of loop: with three fixed
     * places he cycled picture, door, socket, picture, door, socket forever —
     * more repetitive than having no persistence at all. A station earns its
     * place for a couple of repairs and then makes way, so the house is stable
     * moment to moment and slowly changes over a visit.
     */
    const stale = runtime.stations.find(
      (s) =>
        !s.retiring &&
        s.done &&
        s.visits >= 1 &&
        runtime.position.distanceTo(s.placed.mark) > 1.8
    );
    if (stale) stale.retiring = true;
    const live = runtime.stations.filter((s) => !s.retiring);

    /* Room for another? Try to put this one somewhere sensible. */
    if (live.length < limit) {
      const placed = placeFor(index);
      if (placed) {
        addStation(job.id, index, placed);
        runtime.nextIndex = index;
        runtime.nextPlaced = placed;
        runtime.nextJobId = job.id;
        runtime.nextFade = 0;
        setObjectFix(job.id, 0);
        return;
      }
    }

    /*
     * The house is full, or there is nowhere new worth putting anything.
     *
     * This is the normal case on a busy page, and it is the whole point of a
     * persistent world: he does not need a new place to exist, he needs
     * somewhere to go. Requiring a fresh placement every time is what put him
     * back to standing still for forty per cent of a run — the rest beat
     * returning through the placement system rather than the state machine.
     *
     * So: anything still broken, else the thing he mended longest ago, which
     * has had time to work loose again. There is always something.
     */
    const broken = runtime.stations.filter((s) => !s.done && !s.retiring);
    if (broken.length) {
      goTo(broken[Math.floor(Math.random() * broken.length)]);
      return;
    }
    const mended = runtime.stations
      .filter((s) => !s.retiring)
      .sort((a, b) => b.age - a.age);
    if (mended.length) {
      goTo(mended[0]);
      return;
    }

    /* Nothing exists yet at all — try once more for anywhere. */
    const placed = placeFor(index);
    if (!placed) return;
    addStation(job.id, index, placed);
    runtime.nextIndex = index;
    runtime.nextPlaced = placed;
    runtime.nextJobId = job.id;
    runtime.nextFade = 0;
    setObjectFix(job.id, 0);
  };

  /** Choose somewhere for a job and start walking there. */
  const departFor = (index: number): boolean => {
    const next = stops[index % stops.length];
    /*
     * Use the spot already staged for this job if there is one. Re-placing here
     * would move the thing a viewer has been looking at for two seconds, which
     * is a worse spawn than the one this exists to prevent.
     */
    const stagedRaw =
      runtime.nextIndex === index % stops.length ? runtime.nextPlaced : null;
    /*
     * Re-check the staged spot before committing to it.
     *
     * It was chosen several seconds ago, and the page it was chosen against may
     * not have been the page that is there now: measurement is rebuilt when the
     * layout changes, and a placement validated while only part of the page had
     * been measured is validated against a page with holes in it. That is how a
     * cabinet door came to be sitting on a pricing card that the check had
     * reported as empty space.
     *
     * Cheap, and it turns a stale decision into a fresh one at exactly the
     * moment it starts to matter.
     */
    /*
     * Ask about the object that is actually standing there.
     *
     * This check used to compare an estimate of the footprint — a number per
     * job, scaled by his body — which is smaller than most of the props and
     * much smaller than the wall and door fragments they are mounted on. The
     * station has been on screen for a few seconds by now and has been measured
     * from the renderer, so use that and the answer is about the thing a reader
     * can see rather than about a guess at it.
     */
    const stagedStation = stagedRaw
      ? runtime.stations.find((station) => station.placed === stagedRaw)
      : undefined;
    const stagedSpan =
      stagedStation && stagedStation.boxW > 0
        ? { w: stagedStation.boxW, h: stagedStation.boxH }
        : stagedRaw
          ? spanAt(next.job.id, stagedRaw.fit, next.job.footprint?.w ?? 1)
          : (next.job.footprint?.w ?? 1);
    const stillClear =
      stagedRaw !== null &&
      (!options.standable ||
        options.standable(
          stagedRaw.mark,
          stagedRaw.object,
          stagedSpan,
          stagedRaw.fit
        ));
    const staged = stillClear ? stagedRaw : null;
    const placed = staged ?? placeFor(index);
    if (!placed) return false;
    /* Anything he walks to has to be in the registry, or it is not drawn. */
    if (!runtime.stations.some((station) => station.placed === placed)) {
      addStation(next.job.id, index, placed);
    }
    runtime.stopIndex = index % stops.length;
    remember(runtime.schedule, next);
    runtime.placed = placed;
    runtime.propJobId = next.job.id;
    /* Whatever the staged prop had already faded up to, keep. */
    runtime.propFade = staged ? Math.max(runtime.propFade, runtime.nextFade) : runtime.propFade;
    /*
     * Release the staged slot but leave the object drawn.
     *
     * React mounts the working prop a frame or two after the runtime switches
     * to it, so clearing this outright leaves a gap where the thing a viewer
     * has been looking at vanishes and reappears. The two are identical and in
     * exactly the same place, so letting the staged one fade out underneath the
     * working one costs nothing and is seamless.
     */
    runtime.nextIndex = null;
    runtime.nextPlaced = null;
    setObjectFix(next.job.id, 0);
    runtime.path = null;
    runtime.t = 0;
    runtime.displaced = false;
    /*
     * Enter the job the way the plan says, instead of always the same way.
     *
     * This single line was most of the seven-beat skeleton: every job in the
     * loop began with a notice beat because departing hard-coded one.
     */
    if (runtime.plan.entry === "pivot") {
      /* It is already within reach — no walk, just turn into it. */
      setPhase(runtime, "TURN_TO");
    } else if (runtime.plan.entry === "straight") {
      runtime.discovered = runtime.plan.discoverAt === null;
      setPhase(runtime, "TRAVEL");
    } else {
      runtime.discovered = true;
      setPhase(runtime, "NOTICE");
    }
    return true;
  };

  /**
   * Choose the journey into the next job, once we know where it is.
   *
   * Called the moment the repair completes rather than at the end of the ending
   * beat, because whether there IS an ending beat is one of the things it
   * decides.
   */
  const planNext = (): void => {
    if (runtime.tick === 0) {
      runtime.plan = OPENING_PLAN;
      return;
    }
    const target = runtime.nextPlaced;
    const distance = target
      ? runtime.position.distanceTo(target.mark)
      : PIVOT_RANGE * 4;
    const next =
      runtime.nextIndex !== null
        ? stops[runtime.nextIndex % stops.length]
        : null;
    runtime.plan = planTransition({
      distance,
      cameFrom: stop.job.effort ?? 0.5,
      goingTo: next?.job.effort ?? 0.5,
      recent: runtime.planRecent,
      roll: Math.random,
    });
    runtime.planRecent.push(runtime.plan.shape);
    if (runtime.planRecent.length > 4) runtime.planRecent.shift();
  };

  /**
   * Leave the job he has just finished.
   *
   * The only route out, whether or not there was an ending beat. REST is not on
   * this path any more: it is reached only when there is nowhere to put the
   * next repair, which is a real condition rather than a beat, and the viewer
   * should never experience it as a man waiting for a cycle.
   */
  const leaveForNext = (): void => {
    runtime.workProgress = 0;
    /* The station stays; it is simply mended now. */
    const here = runtime.stations.find((s) => s.jobId === runtime.propJobId);
    if (here) {
      here.done = true;
      here.age = 0;
      here.visits += 1;
    }
    /* Hand the finished repair to the fading slot before letting go of it. */
    if (runtime.propJobId && runtime.placed) {
      runtime.goneJobId = runtime.propJobId;
      runtime.gonePlaced = runtime.placed;
      runtime.goneFade = Math.max(runtime.goneFade, runtime.propFade);
    }
    runtime.placed = null;
    stageNext();
    const target =
      runtime.nextIndex ?? pickNext(stops, runtime.schedule, Math.random());
    if (!departFor(target)) {
      /* Nowhere free this instant. Ask again shortly rather than barge on. */
      runtime.restFor = 0.5;
      setPhase(runtime, "REST");
    }
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
    const purpose =
      (0.84 + 0.42 * (stop.job.effort ?? 0.5)) * shapeOf(stop.job).travelScale;
    const hurry = slow
      ? purpose
      : THREE.MathUtils.clamp(runtime.path.length / HURRY_FROM, 1, HURRY_MAX) *
        crossing *
        purpose;
    /*
     * He accelerates.
     *
     * The walk used to reach full speed on its first frame, which is the kind
     * of thing nobody names and everybody feels: a man does not go from
     * standing still to walking pace instantly, and a character who does reads
     * as being moved rather than as moving. Half a second of ramp is enough.
     *
     * And he leaves a heavy job slowly. After a shelf bracket the first stride
     * is reluctant and the walk gathers; after a light switch he is away at
     * once. It costs one number and it is the only place in the loop where the
     * job he has just finished affects what he does next.
     */
    runtime.weariness = approachValue(runtime.weariness, 1, dt, 0.75);
    const setOff = THREE.MathUtils.clamp(runtime.phaseElapsed / 0.55, 0, 1);
    const ramp = 0.42 + 0.58 * (setOff * setOff * (3 - 2 * setOff));
    const factor =
      (slow ? APPROACH_SPEED_FACTOR : ramp * runtime.weariness) * hurry;
    /*
     * The walk is an in-place clip and the code does the moving, so the two
     * have to be told the same speed or the feet skate.
     */
    runtime.gait = factor;
    runtime.t = Math.min(
      1,
      runtime.t + (WALK_SPEED * factor * dt) / runtime.path.length
    );
    /*
     * Discovery in motion.
     *
     * He sets off across the room without having settled on the next repair,
     * and part way over his attention lands on it: the head comes round first
     * (that is handled where the head is aimed), and then the path bends toward
     * it from wherever he has got to. Rebuilding the route from his CURRENT
     * position rather than the original start is what makes it a change of mind
     * instead of a jump.
     */
    if (
      !runtime.discovered &&
      runtime.plan.discoverAt !== null &&
      runtime.t >= runtime.plan.discoverAt
    ) {
      runtime.discovered = true;
      runtime.path = makePath(
        runtime.position,
        placed.mark,
        runtime.stopIndex % 2 === 0 ? -1 : 1,
        options.bounds,
        options.busyAt
      );
      runtime.t = 0;
    }

    const { point, direction } = pathAt(runtime.path, runtime.t);
    runtime.position.set(point.x, point.y, 0);

    const pose = travelPose(direction);
    runtime.yaw = approachValue(runtime.yaw, pose.yaw, dt, 6);
    /* Lean with the speed: leaning into a hurry and upright at a stroll is most
       of what separates one walk from another at this size. */
    runtime.lean = approachValue(
      runtime.lean,
      pose.lean * (0.72 + 0.5 * Math.min(1.4, factor)),
      dt,
      5
    );
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
        runtime.phaseElapsed =
          stop.job.workSeconds * shapeOf(stop.job).workScale * OPENING_AT;
      } else {
        runtime.restFor = 0.4;
        setPhase(runtime, "REST");
      }
      break;

    case "REST":
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      runtime.yaw = approachValue(runtime.yaw, 0, dt, 3);
      if (runtime.phaseElapsed >= runtime.restFor) {
        /*
         * Chosen, not advanced.
         *
         * The opening is still authored — the first repair is index zero and
         * always will be, because the first three seconds are a marketing beat
         * rather than a simulation. From the second job on, the scheduler picks
         * whatever contrasts most with what he has just done.
         */
        /*
         * Until the first repair has actually happened, the opening is still
         * the opening.
         *
         * If the very first placement fails — and it can, because the page is
         * still settling and the booking card is a large control that the spot
         * finder is now strict about — the retry used to fall through to the
         * scheduler and pick something else. That quietly threw away the one
         * authored moment in the whole loop: no lamp, no glow, and the first
         * payoff arriving somewhere past six seconds. Marketing beats
         * simulation here; keep asking for job zero until it lands.
         */
        if (runtime.tick === 0) {
          if (!departFor(0)) {
            runtime.restFor = 0.25;
            setPhase(runtime, "REST");
          }
          break;
        }
        stageNext();
        const target =
          runtime.nextIndex ?? pickNext(stops, runtime.schedule, Math.random());
        if (!departFor(target)) {
          /*
           * Nowhere free right now — wait and ask again rather than barge on.
           *
           * Asked twice a second rather than once. A refusal is no longer a
           * verdict on the page, it is a verdict on this instant of it: the
           * reader is scrolling, and the screen a moment from now is a
           * different screen. Waiting the best part of a second between tries
           * turned a couple of unlucky rolls into a man standing still for
           * seven seconds.
           */
          runtime.restFor = 0.45;
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
      /*
       * The head goes first, and the body catches up.
       *
       * This beat is the one that has to say "he has seen something", and at
       * sixty pixels a body slowly rotating says nothing at all. What reads is
       * the SPLIT: the head snapping round while the shoulders are still facing
       * the old job, held for a moment, and then the body coming after it. That
       * lag is the entire difference between noticing something and turning
       * around.
       *
       * Done here rather than with a motion take, and that is a deliberate
       * rejection: a generated notice turns one fixed direction, and the whole
       * value of this beat is that it points at wherever the next repair
       * actually is.
       */
      runtime.yaw = approachValue(
        runtime.yaw,
        /*
         * Most of the way round, not half.
         *
         * This was damped to under half the angle to the next job, which on a
         * beat lasting well under a second meant the body barely moved and the
         * whole "he has seen something" read as him standing still facing the
         * camera. Turning most of the way is what makes it a decision.
         */
        Math.atan2(dx, Math.abs(dy) + 0.4) * 0.82,
        dt,
        /* Slower than the head, and slower still for the first third. */
        runtime.phaseElapsed < 0.22 ? 1.1 : 4.2
      );
      /* A small lean after it, as if the feet are about to follow. */
      runtime.lean = approachValue(
        runtime.lean,
        THREE.MathUtils.clamp(dx, -1, 1) * 0.055,
        dt,
        4
      );
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
      const noticeSpan = runtime.placed
        ? runtime.position.distanceTo(runtime.placed.mark)
        : SHORT_HOP;
      if (runtime.phaseElapsed >= noticeSeconds(stop, noticeSpan)) {
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
      /*
       * A pivot still has to put him in the right place.
       *
       * Skipping the walk skipped the only thing that moved him, so on a pivot
       * he turned on the spot and then worked from wherever he happened to be
       * standing — up to two thirds of his own height short of the repair, with
       * the solver quietly clamping his arm. Measured: every pivot travelled
       * exactly zero pixels.
       *
       * A pivot is not "no movement", it is "no journey": he shifts his weight
       * across and squares up. Easing the last stride in here keeps it a single
       * beat while putting his hand where it belongs.
       */
      if (runtime.plan.entry === "pivot" && runtime.placed) {
        runtime.position.lerp(runtime.placed.mark, 1 - Math.exp(-6 * dt));
      }
      runtime.lean = approachValue(runtime.lean, 0, dt, 6);
      const pivotArrived =
        runtime.plan.entry !== "pivot" ||
        !runtime.placed ||
        runtime.position.distanceTo(runtime.placed.mark) < 0.06;
      if (
        turnToward(runtime, runtime.placed?.workYaw ?? 0, dt) &&
        Math.abs(runtime.lean) < 0.02 &&
        pivotArrived
      ) {
        runtime.lean = 0;
        if (runtime.plan.inspect > 0) {
          setPhase(runtime, "INSPECT");
        } else {
          runtime.toolEquipped = stop.job.tool !== null;
          setPhase(runtime, stop.enterSeconds > 0 ? "WORK_IN" : "WORK");
        }
      }
      break;

    case "INSPECT":
      /*
       * A moment looking at it before the tool comes out.
       *
       * Deliberately empty of gesture: he is stopped, facing the work, hands
       * still down, and the head look-at is already pointing him at it. The
       * value is the PAUSE — a beat of considering something is what a person
       * does before starting, and it is the only place in the loop where
       * stillness means something rather than being dead air.
       */
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      if (runtime.phaseElapsed >= runtime.plan.inspect) {
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
        runtime.phaseElapsed /
          (stop.job.workSeconds * shapeOf(stop.job).workScale)
      );
      setObjectFix(stop.job.id, repairCurve(runtime.workProgress));
      if (runtime.workProgress >= 1) {
        /*
         * Line the next one up, and choose the journey, BEFORE deciding whether
         * there is an ending beat — because whether there is one is part of
         * what the journey plan decides.
         */
        stageNext();
        planNext();
        if (stop.exitSeconds <= 0) chooseFinish(runtime, stop);
        if (stop.exitSeconds > 0) {
          setPhase(runtime, "WORK_OUT");
        } else if (runtime.plan.admire > 0) {
          setPhase(runtime, "ADMIRE");
        } else {
          runtime.tick += 1;
          runtime.weariness = 1 - 0.22 * (stop.job.effort ?? 0.5);
          leaveForNext();
        }
      }
      break;

    case "WORK_OUT":
      if (runtime.phaseElapsed >= stop.exitSeconds) {
        runtime.toolEquipped = false;
        chooseFinish(runtime, stop);
        if (runtime.plan.admire > 0) {
          setPhase(runtime, "ADMIRE");
        } else {
          runtime.tick += 1;
          runtime.weariness = 1 - 0.22 * (stop.job.effort ?? 0.5);
          leaveForNext();
        }
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
      const finishSpan = Math.max(
        0.2,
        FINISH_SECONDS[runtime.finish] *
          shapeOf(stop.job).finishScale *
          runtime.plan.admire
      );
      runtime.finishAt = Math.min(1, runtime.phaseElapsed / finishSpan);
      runtime.lean = approachValue(runtime.lean, 0, dt, 5);
      /* Put the next problem on the page while he is still pleased with this
         one. Half a beat in, so it is not simultaneous with the repair snap. */
      if (runtime.phaseElapsed >= finishSpan) {
        /* A shelf bracket costs him something a light switch does not. */
        runtime.weariness = 1 - 0.22 * (stop.job.effort ?? 0.5);
        runtime.tick += 1;
        if ((runtime.stopIndex + 1) % stops.length === 0) runtime.laps += 1;
        /* Straight out of the ending beat and on to the next one. */
        leaveForNext();
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
  INSPECT: "Looking it over",
  TRAVEL: "Travelling",
  APPROACH: "Arriving",
  TURN_TO: "Turning to the job",
  WORK_IN: "Getting into position",
  WORK: "Working",
  WORK_OUT: "Standing back up",
  ADMIRE: "Admiring the work",
  REST: "Between jobs",
};
