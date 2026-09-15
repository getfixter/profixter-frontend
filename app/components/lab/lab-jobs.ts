import type { ObjectKind } from "./lab-objects";
import type { ToolKind } from "./lab-tools";
import type { LayoutId, StagePoint } from "./lab-stage";
import { REGIONS } from "./lab-stage";

/**
 * The job library — the data the whole experience is assembled from.
 *
 * A job says what the object is, where it floats, which body motion the Fixter
 * uses on it, which tool he brings and how long it takes. The runner in
 * lab-choreography knows nothing about outlets or faucets; adding a seventh job
 * is an entry in this file.
 */

/* ------------------------------------------------------------------ assets */

export const CLIP_ENTER_CROUCH = "/3d/motion/fx-crouch-enter.bvh";
export const CLIP_WORK_LOW = "/3d/motion/fx-work-low.bvh";
export const CLIP_WORK_MID = "/3d/motion/fx-work-mid.bvh";
export const CLIP_WORK_REACH = "/3d/motion/fx-work-reach.bvh";
export const CLIP_WORK_HIGH = "/3d/motion/fx-work-high.bvh";
export const CLIP_IDLE = "/3d/motion/fx-idle.bvh";

/**
 * Every BVH the Lab loads, already trimmed to the seconds actually used.
 *
 * Text-to-Motion returns ~40s takes whatever duration is requested, and the
 * choreography plays four to eight seconds of each. The full takes live in
 * assets/masters/motions/ where they are version-controlled but never served;
 * these five are the web build, 2.0 MB in total instead of 12.
 */
export const MOTION_FILES = [
  CLIP_IDLE,
  CLIP_ENTER_CROUCH,
  CLIP_WORK_LOW,
  CLIP_WORK_MID,
  CLIP_WORK_REACH,
  CLIP_WORK_HIGH,
];

export type LoopStyle = "once" | "repeat" | "pingpong";

export type ClipSpec = {
  name: string;
  file: string;
  start: number;
  end: number;
  reverse?: boolean;
  loop: LoopStyle;
};

/* ------------------------------------------------------------ work motions */

/**
 * A posture the Fixter can work in.
 *
 * `handOffset` is where his right hand actually sits, relative to his own
 * origin, averaged across the work window and measured on the real skeleton
 * after retargeting. It is the load-bearing number in the whole system: it
 * decides where he stands, which way he faces, and how high the object floats.
 * Nothing here is eyeballed.
 *
 * `enter`/`exit` are only for postures the body cannot simply blend into. The
 * standing motions have none — he walks up and starts working. The crouch has
 * both, because dropping to a squat is a movement in its own right and the
 * exit is that movement reversed.
 */
export type WorkMotion = {
  id: string;
  clip: ClipSpec;
  handOffset: [number, number, number];
  /**
   * Hand-local rotation that aims the tool's +Y at the object.
   *
   * Solved, not eyeballed: take the hand's orientation across the work window,
   * take the direction from the hand to where the object sits in body space,
   * and average the rotation that puts the tool on that line. The hand moves
   * while he works, so this is the best single answer rather than an exact one
   * — which is correct, because a tool that stayed perfectly aimed through a
   * wrist motion would look stranger than one that does not.
   */
  toolAimDeg: [number, number, number];
  enter?: ClipSpec;
  exit?: ClipSpec;
};

export const WORK_MOTIONS: Record<string, WorkMotion> = {
  /** Squatting at something near the floor. */
  low: {
    id: "low",
    clip: { name: "Work · Low", file: CLIP_WORK_LOW, start: 0.5, end: 4.0, loop: "pingpong" },
    handOffset: [-0.151, 0.572, 0.225],
    toolAimDeg: [-29, 6, -22],
    enter: { name: "Crouch · In", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, loop: "once" },
    exit: { name: "Crouch · Out", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, reverse: true, loop: "once" },
  },
  /**
   * Standing, working at chest height with the arms out in front.
   *
   * Also replaced. The take this used to come from kept the hands 0.17 from the
   * head for its whole length — fists under the chin, not hands on a cabinet.
   */
  mid: {
    id: "mid",
    clip: { name: "Work · Mid", file: CLIP_WORK_MID, start: 0.15, end: 1.6, loop: "pingpong" },
    handOffset: [-0.019, 1.022, 0.163],
    toolAimDeg: [0, 0, 0],
  },
  /**
   * Standing, arms up — a second window of the same overhead take.
   *
   * Different frames rather than a different clip, because the take's other
   * passes at the fixture are the only material that keeps the hands properly
   * clear of the head. Two poses that both read as working beats one that reads
   * as working and one that reads as peek-a-boo.
   */
  reach: {
    id: "reach",
    clip: { name: "Work · Reach", file: CLIP_WORK_REACH, start: 0.3, end: 2.0, loop: "pingpong" },
    handOffset: [-0.223, 1.536, 0.045],
    toolAimDeg: [0, 0, 0],
  },
  /**
   * Standing, both arms straight up overhead.
   *
   * Replaced wholesale. The previous take never got the working hand further
   * than 0.32 units from the head across its entire length, which is why it
   * read as shielding his eyes rather than reaching up to a fixture — and no
   * window in it escaped that. This one holds the hand at 1.53 and 0.38 clear
   * of the head, which is the difference between a man squinting and a man
   * working above his hat.
   *
   * The aim below is only the seed and the fallback; AimedHandTool solves the
   * real orientation every frame against the job itself.
   */
  high: {
    id: "high",
    clip: { name: "Work · High", file: CLIP_WORK_HIGH, start: 0.7, end: 2.6, loop: "pingpong" },
    handOffset: [-0.233, 1.533, 0.061],
    toolAimDeg: [0, 0, 0],
  },
};

export const IDLE_CLIP: ClipSpec = {
  name: "Idle",
  file: CLIP_IDLE,
  start: 0.3,
  end: 7.7,
  loop: "pingpong",
};

/** Every clip the mixer needs, derived so nothing can drift out of sync. */
export function allClipSpecs(): ClipSpec[] {
  const out: ClipSpec[] = [IDLE_CLIP];
  for (const motion of Object.values(WORK_MOTIONS)) {
    out.push(motion.clip);
    if (motion.enter) out.push(motion.enter);
    if (motion.exit) out.push(motion.exit);
  }
  // de-duplicate by name: several motions may share an enter clip
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
}

export const SEQUENCE_CLIP_NAMES = new Set(allClipSpecs().map((c) => c.name));

/* -------------------------------------------------------------------- jobs */

export type JobDefinition = {
  id: string;
  label: string;
  object: ObjectKind;
  workMotion: keyof typeof WORK_MOTIONS;
  tool: ToolKind | null;
  /**
   * Which way his hand sits from the work, on screen, in degrees.
   *
   * 0 puts the hand to the right of the repair and the tool pointing left at
   * it; -90 puts the hand below and the tool pointing up, which is what
   * reaching into a ceiling fixture looks like. The distance is the tool's own
   * length, so this is the only thing a job has to say about it.
   */
  toolApproachDeg?: number;
  workSeconds: number;
  /**
   * A few degrees off dead-on while working, so six jobs are not six identical
   * front-facing poses. The stand-mark is solved from this, so the hand still
   * lands on the object.
   */
  workYawDeg?: number;
  /** Tilts the prop so it shows more than one face and reads as a solid. */
  objectRotationDeg?: [number, number, number];
  /**
   * Where the prop is drawn relative to the repair.
   *
   * Read off each prop's own geometry rather than eyeballed: it is minus the
   * position of the thing being fixed — the handle, the loose bracket, the
   * shade's rim — so drawing the prop here puts that feature exactly on the
   * anchor, and the tool points at something real.
   */
  objectOffset?: [number, number];
  /**
   * How much screen this job wants, relative to the character alone.
   *
   * A wall outlet is smaller than he is; a shelf board is twice his width. The
   * placement system has to know before it picks a spot, or the wide ones land
   * beautifully beside a paragraph and then overlap it.
   */
  footprint?: { w: number; h: number };
};

/**
 * A job on the empty stage, which names its own spot per layout in normalised
 * stage coordinates. Not world units, and never a depth: a phone is a tall
 * stage with its own arrangement rather than a narrow desktop.
 *
 * Split out from JobDefinition because the homepage experiment answers the same
 * question a different way — it asks a DOM element where it is — and everything
 * downstream of the anchor is identical.
 */
export type StageJob = JobDefinition & {
  placement: Record<LayoutId, StagePoint>;
};

/**
 * Six jobs, placed around the page rather than around a floor.
 *
 * The order is chosen for the travel between them: four of the six legs are
 * long diagonals across the stage, because a diagonal is the movement that
 * proves this is a page and not a room. Working height alternates too, so no
 * two neighbours look alike.
 *
 *   outlet   lower-left   ↗   lamp     upper-right
 *   lamp     upper-right  ↙   cabinet  mid-left
 *   cabinet  mid-left     ↘   faucet   lower-right
 *   faucet   lower-right  ↖   frame    upper-left
 *   frame    upper-left   ↘   shelf    mid-right
 *   shelf    mid-right    ↙   outlet   lower-left
 */
export const JOBS: StageJob[] = [
  {
    id: "outlet",
    label: "Loose wall outlet",
    object: "outlet",
    placement: {
      desktop: { x: -0.72, y: -0.6 },
      tablet: { x: -0.66, y: -0.64 },
      mobile: { x: -0.5, y: -0.74 },
    },
    workMotion: "low",
    tool: "screwdriver",
    toolApproachDeg: -25,
    workSeconds: 5.5,
    workYawDeg: -8,
    objectRotationDeg: [-6, 24, 0],
    objectOffset: [0, 0],
  },
  {
    id: "lamp",
    label: "Crooked pendant light",
    object: "lamp",
    placement: {
      desktop: { x: 0.7, y: 0.64 },
      tablet: { x: 0.64, y: 0.66 },
      mobile: { x: 0.5, y: 0.72 },
    },
    workMotion: "high",
    tool: "screwdriver",
    toolApproachDeg: -78,
    workSeconds: 6,
    workYawDeg: 10,
    objectRotationDeg: [0, 18, 0],
    objectOffset: [0, 0.275],
  },
  {
    id: "cabinet",
    label: "Loose cabinet handle",
    object: "cabinet",
    placement: {
      desktop: { x: -0.8, y: 0.12 },
      tablet: { x: -0.74, y: 0.16 },
      mobile: { x: -0.58, y: 0.2 },
    },
    workMotion: "mid",
    tool: "screwdriver",
    toolApproachDeg: 15,
    workSeconds: 5,
    workYawDeg: 12,
    objectRotationDeg: [-5, 28, 0],
    objectOffset: [-0.141, -0.064],
  },
  {
    id: "faucet",
    label: "Dripping faucet",
    object: "faucet",
    placement: {
      desktop: { x: 0.66, y: -0.58 },
      tablet: { x: 0.62, y: -0.6 },
      mobile: { x: 0.54, y: -0.42 },
    },
    workMotion: "mid",
    tool: "wrench",
    toolApproachDeg: -35,
    workSeconds: 5.5,
    workYawDeg: -12,
    objectRotationDeg: [0, 26, 0],
    objectOffset: [0, -0.09],
  },
  {
    id: "frame",
    label: "Crooked picture frame",
    object: "frame",
    placement: {
      desktop: { x: -0.7, y: 0.68 },
      tablet: { x: -0.64, y: 0.68 },
      mobile: { x: -0.46, y: 0.74 },
    },
    workMotion: "high",
    tool: null,
    toolApproachDeg: -60,
    workSeconds: 4.5,
    workYawDeg: -6,
    objectRotationDeg: [-8, 22, 0],
    objectOffset: [-0.192, 0.147],
  },
  {
    id: "shelf",
    label: "Drooping shelf",
    object: "shelf",
    /* Lower than it was: the anchor now means the repair rather than his hand,
       which moved every stage mark up by a tool's length and left him standing
       on this shelf while he worked the lamp above it. */
    placement: {
      desktop: { x: 0.76, y: -0.14 },
      tablet: { x: 0.7, y: -0.16 },
      mobile: { x: 0.58, y: -0.2 },
    },
    workMotion: "reach",
    tool: "drill",
    toolApproachDeg: -40,
    workSeconds: 6,
    workYawDeg: 8,
    objectRotationDeg: [6, 24, 0],
    objectOffset: [-0.229, 0.019],
  },
];

/** Props are drawn larger than life so they read at page scale. */
export const OBJECT_SCALE = 1.7;

export const TOOL_ATTACH_BONE = "RightHand";
/**
 * Tools, drawn larger than life.
 *
 * At true scale a screwdriver is about an eighth of a person's height, which on
 * a page is twenty pixels of grey behind a hand. Oversizing it is the only way
 * the detail reads at all — and the stand-off distance is derived from this, so
 * the geometry follows rather than fighting it.
 */
export const TOOL_SCALE = 1.75;

/**
 * The camera looks very slightly down and across rather than dead-on.
 *
 * Orthographic, so a job's screen position is its stage position and nothing
 * else — no perspective, no depth cue from placement. The small tilt is what
 * keeps the Fixter and the props reading as solid objects instead of a flat
 * elevation drawing: enough to catch a second face on every box, far too
 * little to make world Y anything other than screen up.
 */
export const CAMERA_TILT = { x: 1.15, y: 1.35, z: 12 };

/** Region shortcuts, re-exported so jobs can be talked about by place. */
export { REGIONS };
