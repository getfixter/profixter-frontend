import type { ObjectKind } from "./lab-objects";
import type { ToolKind } from "./lab-tools";
import type { ToolAction } from "./lab-action";
import type { LayoutId, StagePoint } from "./lab-stage";
import type { JobCategory } from "./lab-schedule";
import type { JobPace } from "./lab-pace";
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

/**
 * The two beats that survived.
 *
 * Twenty-four Text-to-Motion takes over two rounds produced exactly these: a
 * wave and a wipe of the forehead. Everything else came back as a man
 * gesturing vaguely near his own face, which is what the model does when it is
 * asked for something it has never been shown — "caulking", "ratcheting". What
 * it does know is what a person looks like waving, and being tired.
 *
 * That is not a bad trade. The work itself is better served by driving the tool
 * in code, where a hammer can actually stop dead on the strike; these are the
 * human moments in between, which is the half a motion model is good at.
 */
export const CLIP_BEAT_WAVE = "/3d/motion/fx-beat-wave.bvh";
export const CLIP_BEAT_BROW = "/3d/motion/fx-beat-brow.bvh";
export const CLIP_IDLE = "/3d/motion/fx-idle.bvh";

/**
 * The stance batch — bodies rather than jobs.
 *
 * Every earlier round asked the model for repairs, led with "a handyman", and
 * got back a man gesturing near his own face. This one asked for nothing it has
 * not been shown: a person hinging forward at the hips, planting their feet and
 * pushing, getting down on one knee. Six takes, and measurement rather than eye
 * picked the survivors.
 *
 * What we owned before, measured in leg lengths: standing, hips at 1.59 and the
 * torso within fifteen degrees of vertical — and that ONE pose is the idle, both
 * beats, and three of the four work clips — plus a single deep squat at 0.49.
 * Two silhouettes carrying ten jobs.
 */
export const CLIP_WORK_HINGE = "/3d/motion/fx-work-hinge.bvh";
export const CLIP_WORK_BRACE = "/3d/motion/fx-work-brace.bvh";
export const CLIP_WORK_SQUAT = "/3d/motion/fx-work-squat.bvh";

/**
 * The kneel, which generation would not give us.
 *
 * Asked twice in plain language — "lowers themselves down onto one knee", "kneels
 * down on one knee to tie a shoelace" — Text-to-Motion returned a squat and a
 * man sitting back on his heels. It does not appear to know the asymmetry.
 *
 * Meshy's preset library does: it is a catalogue of authored takes rather than
 * generated ones, and it applies to a character Meshy has rigged. So our own
 * GLB went back through rigging and "Kneeling Reload" came back on our own
 * skeleton — one knee down, one foot planted, torso upright. Delivered as a
 * rigged and textured character; everything but the keyframes is stripped out
 * here, which is nine and a half megabytes down to a hundred kilobytes.
 */
export const CLIP_KNEEL_GLB = "/3d/motion/fx-kneel.glb";

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
  CLIP_BEAT_WAVE,
  CLIP_BEAT_BROW,
  CLIP_WORK_HINGE,
  CLIP_WORK_BRACE,
  CLIP_WORK_SQUAT,
];

export type LoopStyle = "once" | "repeat" | "pingpong";

export type ClipSpec = {
  name: string;
  file: string;
  start: number;
  end: number;
  reverse?: boolean;
  /**
   * Played faster than it was captured.
   *
   * The squat take is four and a half seconds of lowering yourself, which is
   * how long it takes to sit down carefully in a chair and about four times how
   * long it takes a tradesman to drop to one knee. Two of those on every
   * crouched job was nine seconds of a twenty-second repair spent in transit.
   */
  speed?: number;
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
   * Is he working above himself?
   *
   * Stated rather than inferred from the hand height. It was inferred, against
   * a threshold that made sense for one set of numbers, and the moment those
   * numbers were re-authored the overhead jobs quietly stopped counting as
   * overhead — which put both hands back in front of his face, the exact
   * posture all of this exists to prevent.
   */
  overhead?: boolean;
  /**
   * Is he down at floor level?
   *
   * Drives the spare hand onto his knee, the extra range on the head lift, and
   * the crouched half of the body layer. Stated rather than derived from the
   * motion's name, for the same reason `overhead` is: there are three low
   * stances now, and a check against one id silently excludes the other two.
   */
  crouched?: boolean;
  /**
   * The silhouette's own size, relative to standing.
   *
   * The placer reserved a fixed standing rectangle for every posture, which was
   * true while every posture WAS standing. It is not any more: a kneel is a bit
   * over two-thirds of his standing height, and a stance that leans is wider
   * than one that does not. Both directions cost something real — reserving too
   * much turns down places he would have fitted, reserving too little puts him
   * on a line of text.
   *
   * Measured off the bones in the pose rather than guessed.
   */
  boxH?: number;
  boxW?: number;
  /**
   * How far the head is allowed to be turned back toward the camera.
   *
   * The default fifty-two degrees is right for a stance that is already upright
   * and nowhere near enough for one that is not: the crouch needed the full
   * range before his face came back, and the two leaning stances have the same
   * problem for the same reason. Stated per stance, because it is a property of
   * how far the take folds him over, and because the alternative — deriving it
   * from a flag that also moves his spare hand onto his knee — couples two
   * things that are not the same thing.
   */
  headMaxDeg?: number;
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

/**
 * WHERE THE HAND GOES — authored, not measured.
 *
 * These used to be read off the retargeted clips: whatever the take happened to
 * be doing with its hand became the definition of where that posture works. It
 * is why the overhead job put the repair at eye level and he appeared to shield
 * his face from it, and why the chest-height one worked at the point where its
 * arms happened to be clasped.
 *
 * The arms are solved now, so the clip no longer gets a vote. A hand reaching
 * overhead goes ABOVE the head — 1.88 on a character 1.72 tall — because that
 * is where a person puts it, and the solver will deliver it. The clip keeps the
 * job it was always good at, which is the stance underneath.
 *
 * Negative x is his right side, which is the hand the tool is in.
 *
 * Sized against the skeleton, and against what it can actually reach.
 *
 * This character is not shaped like a person. His hips sit at 0.82, his chest
 * at 1.15, his head fills everything from 1.32 to the top — and his whole arm,
 * shoulder joint to fingertips, is 0.39. From a shoulder at 1.16 that is a
 * maximum reach of about 1.53, which is BELOW the top of his own head at 1.72.
 *
 * He physically cannot work above his head, and no amount of animation was ever
 * going to hide it. Asking him to put a hand at 1.97 just left the solver
 * clamping and the man reaching at thin air a foot below the lamp.
 *
 * So overhead here means high and OUT: 1.50 and well over to his tool side,
 * which is inside his reach, keeps his face clear, and reads as a man working
 * on something above him. Everything else is pulled in to match — the standing
 * reach was 0.46 from the shoulder on an arm 0.39 long, which is why the drill
 * never quite arrived where the towel bar was.
 *
 * Pulled in a further few centimetres beyond that, because a hand parked at the
 * very limit of the arm has nowhere left to go: the whole point is that it moves
 * while he works, and an arm already straight cannot wind up, push, or haul.
 */
export const WORK_MOTIONS: Record<string, WorkMotion> = {
  /** Squatting at something near the floor. */
  low: {
    id: "low",
    crouched: true,
    boxH: 0.78,
    headMaxDeg: 74,
    clip: { name: "Work · Low", file: CLIP_WORK_LOW, start: 0.5, end: 4.0, loop: "pingpong" },
    handOffset: [-0.20, 0.57, 0.24],
    toolAimDeg: [-29, 6, -22],
    enter: { name: "Crouch · In", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, speed: 3.4, loop: "once" },
    exit: { name: "Crouch · Out", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, reverse: true, speed: 3.0, loop: "once" },
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
    handOffset: [-0.26, 1.00, 0.20],
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
    overhead: true,
    id: "reach",
    clip: { name: "Work · Reach", file: CLIP_WORK_REACH, start: 0.3, end: 2.0, loop: "pingpong" },
    handOffset: [-0.32, 1.24, 0.17],
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
  /**
   * Squatting with the back straight and the head up.
   *
   * The same height as `low` and a different man: our crouch take folds him
   * over his own knees, which buries the face behind the cap — the single thing
   * the character cannot afford to lose. This one sits at the same hip height
   * with the torso within a few degrees of vertical, so the face is simply
   * there, with no look-at cheat spent on recovering it.
   */
  squat: {
    id: "squat",
    crouched: true,
    boxH: 0.76,
    headMaxDeg: 70,
    clip: { name: "Work · Squat", file: CLIP_WORK_SQUAT, start: 0.5, end: 4.4, loop: "pingpong" },
    handOffset: [-0.21, 0.54, 0.26],
    toolAimDeg: [-24, 4, -18],
    enter: { name: "Crouch · In", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, speed: 3.4, loop: "once" },
    exit: { name: "Crouch · Out", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, reverse: true, speed: 3.0, loop: "once" },
  },
  /**
   * Down on one knee, the lowest thing he does.
   *
   * Hips at a fifth of a leg length off the floor with one knee actually on it,
   * which is a silhouette nothing else in the library comes near — the squat
   * bottoms out more than twice as high.
   */
  kneel: {
    id: "kneel",
    crouched: true,
    boxH: 0.72,
    headMaxDeg: 72,
    boxW: 1.08,
    clip: { name: "Work · Kneel", file: CLIP_KNEEL_GLB, start: 0.6, end: 2.4, loop: "pingpong" },
    handOffset: [-0.20, 0.40, 0.27],
    toolAimDeg: [-20, 4, -16],
    enter: { name: "Crouch · In", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, speed: 3.4, loop: "once" },
    exit: { name: "Crouch · Out", file: CLIP_ENTER_CROUCH, start: 0.0, end: 4.0, reverse: true, speed: 3.0, loop: "once" },
  },
  /**
   * Standing, legs straight, hinged forward from the hips.
   *
   * Nothing we owned exceeded sixteen degrees of torso pitch; this runs between
   * twenty-five and fifty, which is a different shape rather than a different
   * arm. Windowed on the way down rather than at the bottom: the take holds at
   * seventy-five, and seventy-five degrees on a character with a head this size
   * is a man inspecting his own boots.
   */
  hinge: {
    id: "hinge",
    boxW: 1.26,
    headMaxDeg: 70,
    clip: { name: "Work · Hinge", file: CLIP_WORK_HINGE, start: 0.40, end: 0.90, loop: "pingpong" },
    handOffset: [-0.24, 0.74, 0.30],
    toolAimDeg: [-14, 2, -10],
  },
  /**
   * Feet apart and staggered, weight settled, leaning into it.
   *
   * The stance for work that takes force rather than precision. Its value is
   * the footprint: a stagger of most of a leg length, where everything else we
   * own stands with its feet together.
   */
  brace: {
    id: "brace",
    boxW: 1.24,
    headMaxDeg: 68,
    clip: { name: "Work · Brace", file: CLIP_WORK_BRACE, start: 1.4, end: 2.4, loop: "pingpong" },
    handOffset: [-0.28, 0.88, 0.26],
    toolAimDeg: [-8, 0, -6],
  },
  high: {
    overhead: true,
    id: "high",
    clip: { name: "Work · High", file: CLIP_WORK_HIGH, start: 0.7, end: 2.6, loop: "pingpong" },
    handOffset: [-0.33, 1.38, 0.15],
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
/**
 * A moment of being a person rather than a process.
 *
 * Played instead of the idle during the pause between jobs, and rarely: the
 * whole value of a beat is that it is not the thing he always does.
 */
export const BEAT_CLIPS: ClipSpec[] = [
  { name: "Beat · Wave", file: CLIP_BEAT_WAVE, start: 0.2, end: 2.2, loop: "once" },
  { name: "Beat · Brow", file: CLIP_BEAT_BROW, start: 0.2, end: 2.2, loop: "once" },
];

/**
 * The new stances, loaded so they can be driven by hand in the Stage before any
 * job is allowed to depend on them. Assigning first and looking afterwards is
 * how the chest-height take came to hold its fists under its own chin for a
 * fortnight.
 */
export const STANCE_CLIPS: ClipSpec[] = [
  { name: "Stance · Hinge", file: CLIP_WORK_HINGE, start: 0.40, end: 0.90, loop: "pingpong" },
  { name: "Stance · Brace", file: CLIP_WORK_BRACE, start: 1.4, end: 2.4, loop: "pingpong" },
  { name: "Stance · Kneel", file: CLIP_KNEEL_GLB, start: 0.6, end: 2.4, loop: "pingpong" },
  { name: "Stance · Squat", file: CLIP_WORK_SQUAT, start: 0.5, end: 4.4, loop: "pingpong" },
];

export function allClipSpecs(): ClipSpec[] {
  const out: ClipSpec[] = [IDLE_CLIP, ...BEAT_CLIPS, ...STANCE_CLIPS];
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
  /**
   * Where the prop sits relative to his hand, in the PROP's own units.
   *
   * Prop units, not world units, so that it keeps meaning the same thing when
   * props are resized: "half a towel bar to the left" stays half a towel bar.
   */
  /**
   * What the tool does while he works.
   *
   * The single biggest lever on whether two jobs feel different, because it is
   * the part of the performance that is actually authored rather than
   * retargeted. Defaults to a sensible verb for the tool if left out.
   */
  action?: ToolAction;
  /**
   * How many hands this one actually takes.
   *
   * The verb is a bad guide to it. A shove is two-handed when it is a cabinet
   * door being aligned and one-handed when it is a picture being nudged level
   * or a test button being pressed, and getting it wrong is expensive: the
   * spare hand ends up held out in front of his chest, palm down, touching
   * nothing, for the whole length of the job. Defaults to two for the verbs
   * that take two.
   */
  hands?: 1 | 2;
  /**
   * What trade it belongs to.
   *
   * Never displayed and not meant to be noticed one repair at a time. The
   * scheduler uses it to avoid running three electrical jobs together, which is
   * the difference between a loop that leaves an impression of "they do all the
   * little stuff" and one that leaves an impression of an electrician.
   */
  category?: JobCategory;
  /**
   * The shape of the job, not just its length.
   *
   * Derived from effort when absent, and worth stating by hand when a repair
   * reads faster or slower than its effort suggests.
   */
  pace?: JobPace;
  /**
   * The household surface behind this repair.
   *
   * Added after watching a minute of the deployed build: three different jobs
   * ran back to back and the whole stretch read as ONE scene, because all three
   * happened to be backed by the same tiled wall. The context fragment turns
   * out to be a louder visual signal than the prop in front of it — a tap, a
   * rail and a shower head are three objects, but "tiles" is one place. The
   * scheduler has to treat the backdrop as a thing to vary, like the stance and
   * the trade.
   */
  surface?: "tile" | "plaster" | "ceiling" | "wood" | "none";
  /**
   * How hard this one is, 0 to 1.
   *
   * Drives how long he spends on it, how much of himself he puts into it, and
   * which ending it gets. A switch plate and a shelf bracket should not take
   * the same amount of time or the same amount of body, and a loop where every
   * stop costs the same has no rhythm to it.
   */
  effort?: number;
  objectOffset?: [number, number];
  /**
   * How much screen this job wants, relative to the character alone.
   *
   * A wall outlet is smaller than he is; a shelf board is twice his width. The
   * placement system has to know before it picks a spot, or the wide ones land
   * beautifully beside a paragraph and then overlap it.
   */
  footprint?: { w: number; h: number };
  /**
   * A small flourish while he works.
   *
   * Deliberately a short enum rather than a callback: the point of these is to
   * make a repair more readable, and a job that could do anything would quickly
   * be doing too much.
   */
  effect?: "dust" | "spark" | "impact";
  /**
   * Size relative to the shared prop scale.
   *
   * A wall switch and a shelf board are not the same size in real life and must
   * not be the same size here either, but they DO both have to be legible at a
   * hundred and thirty pixels of character. This is the reconciliation: real
   * proportions, nudged until each one reads.
   */
  propScale?: number;
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
 * How far up the hand the tool is held, as a fraction of its length.
 *
 * It used to be zero, which is the wrist: the handle sat inside his forearm and
 * the shaft ran the length of an open palm and out past the fingertips, so the
 * tool looked like it was passing THROUGH him rather than being held. Just
 * under half way up is the middle of the palm, which is where a hand closes.
 */
/**
 * How strongly the arms are pulled to his sides when nothing else has them.
 *
 * Not one: the clips carry the shoulders, the breathing and the small
 * asymmetries that make him look alive, and overriding them completely trades
 * one stiff pose for another. This takes most of the forward reach out and
 * leaves the rest.
 */
export const REST_ARM = 0.82;

export const TOOL_PALM = 0.42;

/**
 * How far the hand rolls about its own axis when holding something.
 *
 * Turns a splayed open palm edge-on to the camera. See the note in orientHand:
 * with no finger bones this is the difference between a tool being held and a
 * tool being near a hand.
 */
export const TOOL_ROLL_DEG = 64;
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

/** What a tool does if a job does not say. */
export const DEFAULT_ACTION: Record<string, ToolAction> = {
  screwdriver: "turn",
  wrench: "ratchet",
  drill: "spin",
  hammer: "tap",
};

/** Two hands on the job, or one and a spare? */
export function handsFor(job: JobDefinition): 1 | 2 {
  if (job.hands) return job.hands;
  const action = actionFor(job);
  return action === "spin" || action === "press" || action === "sweep" ? 2 : 1;
}

export function actionFor(job: JobDefinition): ToolAction {
  if (job.action) return job.action;
  if (job.tool) return DEFAULT_ACTION[job.tool] ?? "none";
  return "press";
}
