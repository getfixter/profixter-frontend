import type { JobDefinition } from "./lab-jobs";
import type { LayoutId } from "./lab-stage";

/**
 * The repair library.
 *
 * Eleven small household problems, chosen so that each one is legible at about
 * a hundred pixels and unmistakably different from the others. A job is pure
 * data: what the thing is, which posture he works in, which tool he brings, how
 * he approaches it and how long it takes. Nothing here says where — that is
 * decided on the screen, at the moment he sets off.
 *
 * The order is the running order. The lamp leads because the curtain goes up
 * mid-repair, and a light coming on against a dark hero is the most legible
 * before-and-after in the set: you understand it without reading anything.
 * After that it is arranged so no two neighbours share a tool or a posture.
 *
 * The postures are spread as evenly as the jobs honestly allow: six of eleven
 * used to be the standing chest-height one, which is most of why the loop read
 * as the same animation with different props attached. A base cabinet and a
 * basin tap are both things you get down to, and moving them to the crouch also
 * buys their transitions — he lowers himself and stands back up, which is a
 * second of real movement the standing jobs do not have. Watching him crouch, then stand, then reach overhead is
 * most of what stops the loop reading as "walk, screwdriver, walk, screwdriver".
 */

export const PAGE_JOBS: JobDefinition[] = [
  {
    id: "lamp",
    label: "Crooked pendant light",
    object: "lamp",
    workMotion: "high",
    tool: "screwdriver",
    toolApproachDeg: -78,
    workSeconds: 5,
    workYawDeg: 10,
    objectRotationDeg: [0, 18, 0],
    objectOffset: [0.0, 0.172],
    propScale: 0.63,
    footprint: { w: 1, h: 1.3 },
  },
  {
    id: "outlet",
    label: "Loose wall outlet",
    object: "outlet",
    workMotion: "low",
    tool: "screwdriver",
    toolApproachDeg: -25,
    workSeconds: 4.5,
    workYawDeg: -8,
    objectRotationDeg: [-6, 24, 0],
    objectOffset: [0.0, 0.0],
    propScale: 0.62,
    footprint: { w: 1, h: 1.05 },
    effect: "spark",
  },
  {
    id: "towelbar",
    label: "Sagging towel bar",
    object: "towelbar",
    workMotion: "mid",
    tool: "drill",
    toolApproachDeg: 8,
    workSeconds: 4.5,
    workYawDeg: 10,
    objectRotationDeg: [0, 16, 0],
    objectOffset: [-0.26, 0.0],
    propScale: 0.47,
    footprint: { w: 1.5, h: 1 },
    effect: "dust",
  },
  {
    id: "frame",
    label: "Crooked picture frame",
    object: "frame",
    workMotion: "high",
    tool: null,
    toolApproachDeg: -60,
    workSeconds: 3.8,
    workYawDeg: -6,
    objectRotationDeg: [-8, 22, 0],
    objectOffset: [-0.113, 0.086],
    propScale: 0.6,
    footprint: { w: 1.25, h: 1.15 },
  },
  {
    id: "cabinet",
    label: "Loose cabinet handle",
    object: "cabinet",
    workMotion: "low",
    tool: "screwdriver",
    toolApproachDeg: 15,
    workSeconds: 4.5,
    workYawDeg: 12,
    objectRotationDeg: [-5, 28, 0],
    objectOffset: [-0.098, -0.044],
    propScale: 0.41,
    footprint: { w: 1.15, h: 1.1 },
  },
  {
    id: "detector",
    label: "Smoke detector hanging loose",
    object: "detector",
    workMotion: "high",
    tool: null,
    toolApproachDeg: -72,
    workSeconds: 4.2,
    workYawDeg: 6,
    objectRotationDeg: [0, 14, 0],
    objectOffset: [0.0, 0.03],
    propScale: 0.52,
    footprint: { w: 1, h: 1.2 },
  },
  {
    id: "switch",
    label: "Crooked light switch",
    object: "switch",
    workMotion: "mid",
    tool: "screwdriver",
    toolApproachDeg: -20,
    workSeconds: 4,
    workYawDeg: -10,
    objectRotationDeg: [-4, 22, 0],
    objectOffset: [0.0, 0.0],
    propScale: 0.62,
    footprint: { w: 1, h: 1 },
    effect: "spark",
  },
  {
    id: "shelf",
    label: "Drooping shelf",
    object: "shelf",
    workMotion: "reach",
    tool: "drill",
    toolApproachDeg: -40,
    workSeconds: 5,
    workYawDeg: 8,
    objectRotationDeg: [6, 24, 0],
    objectOffset: [-0.185, 0.015],
    propScale: 0.66,
    footprint: { w: 1.6, h: 1.15 },
    effect: "dust",
  },
  {
    id: "doorknob",
    label: "Loose doorknob",
    object: "doorknob",
    workMotion: "mid",
    tool: "screwdriver",
    toolApproachDeg: 24,
    workSeconds: 4,
    workYawDeg: 14,
    objectRotationDeg: [0, 18, 0],
    objectOffset: [-0.038, 0.0],
    propScale: 0.6,
    footprint: { w: 1.05, h: 1 },
  },
  {
    id: "hinge",
    label: "Door hinge working loose",
    object: "hinge",
    workMotion: "mid",
    tool: "hammer",
    toolApproachDeg: -14,
    workSeconds: 4.2,
    workYawDeg: -12,
    objectRotationDeg: [0, 20, 0],
    objectOffset: [-0.06, 0.02],
    propScale: 0.63,
    footprint: { w: 1.05, h: 1.1 },
    effect: "impact",
  },
  {
    id: "faucet",
    label: "Dripping faucet",
    object: "faucet",
    workMotion: "low",
    tool: "wrench",
    toolApproachDeg: -35,
    workSeconds: 4.6,
    workYawDeg: -12,
    objectRotationDeg: [0, 26, 0],
    objectOffset: [0.0, -0.045],
    propScale: 0.66,
    footprint: { w: 1.05, h: 1.1 },
  },
];

/**
 * Pixels per world unit on the page.
 *
 * This is the thing that decides how big he is next to 17px body text. Chosen
 * so he stands about a hundred and twenty pixels tall: present, clearly a
 * person, not a mascot filling the screen.
 */
export const PAGE_UNIT_PX: Record<LayoutId, number> = {
  desktop: 132,
  tablet: 124,
  mobile: 104,
};

/**
 * How big he is, per layout.
 *
 * About two hundred pixels on a desktop, which is a person you notice on the
 * way past. He was at a hundred and thirty, chosen so he would read as living
 * on the page rather than standing in front of it — and he did, but he also
 * read as a detail, and a detail cannot be the reason anybody remembers the
 * site. Two hundred is still nowhere near mascot: it is about a third of the
 * height of the hero headline block he stands beside.
 *
 * A phone gets LESS, which is the opposite of what it needed when he was small.
 * A phone hero is a single dense column: the free gaps are wide and short, and
 * a character who needs two hundred pixels of clear height can only ever be
 * placed straddling the seam between two sections, cut in half by it. At this
 * size he fits inside a band, which matters more on a small screen than being
 * large does.
 */
export const PAGE_CHARACTER_SCALE: Record<LayoutId, number> = {
  desktop: 0.86,
  tablet: 0.84,
  mobile: 0.58,
};

/**
 * Props are details on a page, not stage furniture — but they still have to be
 * recognisable. Each job scales from here; see propScale for the outliers.
 *
 * Multiplied by the character scale at the point of use, because a smoke
 * detector is only the right size in relation to the man reaching up to it.
 *
 * Every propScale below is derived from that relation rather than guessed: a
 * target height as a fraction of his 1.72, divided by the mesh's own extent.
 * Small things are exaggerated more than big ones — a real doorknob beside him
 * would be six pixels — but the ordering is honest, which is what stops the
 * set reading as clip art. Before this the smoke detector was a third of his
 * height and hid his face.
 * The number is what it is so that the whole set looks the same as it did when
 * this was a fixed 2.0 against a 0.58 character.
 */
export const PAGE_OBJECT_SCALE = 3.45;

/**
 * The page camera.
 *
 * The same shallow tilt as the stage — enough to catch a second face on every
 * box — but pushed further out, because the scene is a whole viewport tall and
 * a near camera would clip the far ends of it.
 */
export const PAGE_CAMERA_TILT = { x: 1.0, y: 1.2, z: 24 };

/**
 * Which checklist rows tick themselves when their job is finished.
 *
 * The page's one piece of special knowledge, and entirely optional: a site that
 * has no such list loses nothing but this flourish. It is the homepage offering
 * a contextual opportunity, not the system depending on one.
 */
export const ROW_JOBS: Record<string, string> = {
  "row-shelf": "shelf",
  "row-cabinet": "cabinet",
  "row-lamp": "lamp",
  "row-door": "hinge",
};

/** The same thing the other way round, for asking "is this repair on screen". */
export const JOB_ROWS: Record<string, string> = Object.fromEntries(
  Object.entries(ROW_JOBS).map(([row, job]) => [job, row])
);
