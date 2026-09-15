import type { ObjectKind } from "./lab-objects";
import type { ToolKind } from "./lab-tools";

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
  /** Standing, working at chest height. */
  mid: {
    id: "mid",
    clip: { name: "Work · Mid", file: CLIP_WORK_MID, start: 0.6, end: 2.4, loop: "pingpong" },
    handOffset: [-0.083, 1.102, 0.133],
    toolAimDeg: [-6, -5, 82],
  },
  /** Standing, reaching out and slightly up. */
  reach: {
    id: "reach",
    clip: { name: "Work · Reach", file: CLIP_WORK_MID, start: 2.6, end: 5.0, loop: "pingpong" },
    handOffset: [-0.044, 1.208, 0.224],
    toolAimDeg: [59, 13, 24],
  },
  /** Standing, both hands up above head height. */
  high: {
    id: "high",
    clip: { name: "Work · High", file: CLIP_WORK_HIGH, start: 0.6, end: 7.6, loop: "pingpong" },
    handOffset: [-0.188, 1.313, 0.292],
    toolAimDeg: [-14, -8, 83],
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
  /** Where the object floats. Y is dictated by the work motion's hand height. */
  anchor: [number, number, number];
  workMotion: keyof typeof WORK_MOTIONS;
  tool: ToolKind | null;
  /** How far short of the object the hand stops, leaving the tool room. */
  toolGap: number;
  workSeconds: number;
  /**
   * Which side he works from, as a direction in XZ.
   *
   * Left unset, he arrives from wherever the previous job was, which is natural
   * but hands the camera whatever angle the ring happens to produce — and on a
   * fixed frame that means watching his back half the time while his own body
   * hides the thing he is fixing. Setting it points him broadly toward the
   * viewer, so the object sits between him and the camera and the work is
   * actually visible. Varied slightly per job so six stops do not all read as
   * the same pose.
   */
  approachFrom?: [number, number];
  /**
   * Which way the object itself faces, in degrees about Y. 0 faces the viewer.
   *
   * Deliberately NOT derived from where the character stands. Turning each
   * object to face whoever is working on it is the physically honest answer and
   * it looks wrong: the camera then sees the back of every faceplate, frame and
   * cabinet door. Objects face out, the character works from the side, and the
   * small per-job variation stops six props reading as a shop display.
   */
  objectYawDeg?: number;
  /**
   * Shifts the DRAWN object relative to the anchor his hand reaches for.
   *
   * Without it every prop is centred exactly on his hand, which puts a picture
   * frame across his face and a shelf through his chest. Offsetting lets the
   * hand land on an edge — the corner of the frame, one end of the shelf —
   * which is where someone would actually take hold of it, and keeps the
   * character's face visible. Pushed away from whichever side he works from.
   */
  objectOffset?: [number, number, number];
};

/**
 * Six jobs, ordered so the tour zig-zags rather than marching along one line,
 * and so the working height changes every time: low, high, mid, high, reach,
 * mid. Two jobs share a posture only where the objects and tools differ enough
 * that it does not read as a repeat.
 *
 * Anchor Y is not chosen by taste — it is the work motion's hand height, so the
 * object is placed exactly where the hand goes rather than the hand being asked
 * to find the object.
 */
export const JOBS: JobDefinition[] = [
  {
    id: "outlet",
    label: "Loose wall outlet",
    object: "outlet",
    anchor: [-2.0, 0.57, 0.7],
    workMotion: "low",
    tool: "screwdriver",
    toolGap: 0.16,
    workSeconds: 5.5,
    approachFrom: [0.85, 0.5],
    objectYawDeg: 0,
    objectOffset: [0.06, 0.03, 0],
  },
  {
    id: "lamp",
    label: "Crooked pendant light",
    object: "lamp",
    anchor: [-0.7, 1.31, -1.3],
    workMotion: "high",
    tool: "screwdriver",
    toolGap: 0.14,
    workSeconds: 6,
    approachFrom: [-0.85, 0.5],
    objectYawDeg: 8,
    objectOffset: [-0.14, 0.1, 0],
  },
  {
    id: "faucet",
    label: "Dripping faucet",
    object: "faucet",
    anchor: [0.7, 1.1, 0.9],
    workMotion: "mid",
    tool: "wrench",
    toolGap: 0.15,
    workSeconds: 5.5,
    approachFrom: [0.8, 0.6],
    objectYawDeg: -6,
    objectOffset: [0.1, -0.06, 0],
  },
  {
    id: "frame",
    label: "Crooked picture frame",
    object: "frame",
    anchor: [1.9, 1.31, -0.5],
    workMotion: "high",
    tool: null,
    toolGap: 0.06,
    workSeconds: 4.5,
    approachFrom: [-0.8, 0.6],
    objectYawDeg: 5,
    objectOffset: [-0.16, 0.18, 0],
  },
  {
    id: "shelf",
    label: "Drooping shelf",
    object: "shelf",
    anchor: [2.2, 1.21, 0.8],
    workMotion: "reach",
    tool: "drill",
    toolGap: 0.16,
    workSeconds: 6,
    approachFrom: [0.85, 0.5],
    objectYawDeg: -9,
    objectOffset: [0.3, -0.03, 0],
  },
  {
    id: "cabinet",
    label: "Loose cabinet handle",
    object: "cabinet",
    anchor: [0.8, 1.1, -1.9],
    workMotion: "mid",
    tool: "screwdriver",
    toolGap: 0.15,
    workSeconds: 5,
    approachFrom: [-0.8, 0.6],
    objectYawDeg: 7,
    objectOffset: [-0.15, -0.06, 0],
  },
];

/* ------------------------------------------------------------------ layout */

/**
 * Composition presets.
 *
 * Mobile is not the desktop scene shrunk — a narrow viewport cannot carry a
 * 6.4-unit spread and still show a 1.7-unit character, so the anchors are
 * drawn in toward the middle and the camera follows him instead of framing
 * everything at once. Same jobs, same order, tighter staging.
 */
export type LayoutId = "desktop" | "mobile";

export const LAYOUTS: Record<LayoutId, { spread: number; camera: CameraPreset }> = {
  desktop: { spread: 1, camera: "page" },
  mobile: { spread: 0.74, camera: "follow" },
};

export type CameraPreset = "page" | "follow";

/** Anchor for a job under a layout: XZ is drawn in, height is untouched. */
export function layoutAnchor(
  job: JobDefinition,
  spread: number
): [number, number, number] {
  return [job.anchor[0] * spread, job.anchor[1], job.anchor[2] * spread];
}

/**
 * Framing that shows the whole composition.
 *
 * Chosen from the geometry, not by nudging: the props span about 4.6 units
 * across, and the Fixter has to read at roughly a third of frame height or
 * there is nothing to judge — which puts the visible height near 4.8 units and
 * the camera about 7 back at this field of view. Sitting further out turns the
 * whole thing into specks on a white field, which is what the first attempt
 * did.
 */
export const PAGE_CAMERA = {
  position: [1.3, 2.65, 7.3] as [number, number, number],
  target: [0.15, 0.88, -0.3] as [number, number, number],
};

/**
 * Props are drawn at 1.5x true scale.
 *
 * A real 12 cm outlet next to a 1.7 m man is four pixels on a phone. The page
 * is stylised anyway, and scaling every prop by the same factor keeps them
 * honest relative to each other while letting each one actually read. The
 * anchor — where his hand goes — is unaffected; only the object drawn around
 * it grows.
 */
export const OBJECT_SCALE = 1.45;

/** How the following camera sits relative to the Fixter. */
/**
 * How the following camera sits relative to the Fixter.
 *
 * Far enough back that the object he is working on fits in frame beside him —
 * the first attempt sat close enough that a shelf crossed his face and the tool
 * was behind it. Offset to one side rather than straight behind, so the work
 * reads in three-quarter rather than as the back of a head.
 */
export const FOLLOW_CAMERA = {
  offset: [2.0, 1.55, 4.5] as [number, number, number],
  lookHeight: 0.85,
  /** Seconds-ish lag. Low is floaty, high is jerky. */
  stiffness: 1.4,
};

export const TOOL_ATTACH_BONE = "RightHand";

/** Base tool scale. The Fixter is stylised; a life-size tool disappears. */
export const TOOL_SCALE = 1.3;
