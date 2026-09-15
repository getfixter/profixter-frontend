import type { JobDefinition } from "./lab-jobs";
import type { LayoutId } from "./lab-stage";

/**
 * The jobs, when the stage is a webpage.
 *
 * Every one belongs to something on the page rather than to a coordinate: the
 * booking card, the primary call to action, a row of the checklist, the
 * membership headline. The page says where those things are; this file says
 * which corner of which one a job sits in, and the rest of the choreography is
 * the same code the empty stage runs.
 *
 * Five, not six. Fewer and better placed reads as a character living somewhere;
 * six evenly spread reads as a demo with props scattered over a screenshot. The
 * sixth — the faucet — stays in the library and returns the moment there is a
 * page element that genuinely wants it.
 */

export type Align = { x: number; y: number };

export type PageJob = JobDefinition & {
  /**
   * The element this job belongs to, per layout.
   *
   * Per layout because the page is not the same page at every width: the
   * booking card does not exist on a phone, and a job that hung off it would
   * have nothing to hang from. `null` means this job simply is not part of the
   * composition at that size, which is a real answer rather than a failure.
   */
  anchor: Record<LayoutId, string | null>;
  /**
   * Where inside that element his hand lands, in units of half the element's
   * box: {x: 1, y: 0} is the middle of its right edge, {x: 0, y: -1} the middle
   * of its top edge. Values outside -1..1 sit outside the element, which is
   * usually what you want — a job belongs *beside* a headline, not on top of
   * the words.
   */
  align: Record<LayoutId, Align>;
  /** Final adjustment in CSS pixels, for when the box edge is not the point. */
  nudgePx?: Partial<Record<LayoutId, [number, number]>>;
};

/**
 * Pixels per world unit on the page.
 *
 * This replaces the stage's "fit N world units into the canvas height". On a
 * webpage the canvas is the whole viewport and the question is not how much
 * world to show but how big the character should be next to 17px body text.
 * These are chosen so he stands a little under half the height of the hero
 * headline block — present, clearly a person, not a mascot filling the screen.
 */
export const PAGE_UNIT_PX: Record<LayoutId, number> = {
  desktop: 132,
  tablet: 124,
  mobile: 104,
};

/** He is slightly smaller on a page than on the stage; the page is busier. */
export const PAGE_CHARACTER_SCALE: Record<LayoutId, number> = {
  desktop: 0.74,
  tablet: 0.72,
  mobile: 0.68,
};

/** Props are details on a page, not stage furniture. */
export const PAGE_OBJECT_SCALE = 1.28;

/**
 * The page camera.
 *
 * The same shallow tilt as the stage — enough to catch a second face on every
 * box — but pushed further out, because the page scene is many viewport heights
 * tall and a near camera would clip the far ends of it.
 */
export const PAGE_CAMERA_TILT = { x: 1.0, y: 1.2, z: 24 };

export const PAGE_JOBS: PageJob[] = [
  {
    id: "outlet",
    label: "Loose wall outlet",
    object: "outlet",
    anchor: {
      desktop: "hero-cta",
      tablet: "hero-cta",
      mobile: "hero-cta",
    },
    align: {
      desktop: { x: -0.81, y: 0 },
      tablet: { x: 0.72, y: 0 },
      mobile: { x: 0.6, y: 0 },
    },
    nudgePx: { desktop: [0, 186], tablet: [0, 52], mobile: [0, 106] },
    workMotion: "low",
    tool: "screwdriver",
    toolGap: 0.16,
    workSeconds: 5,
    workYawDeg: -8,
    objectRotationDeg: [-6, 24, 0],
    objectOffset: [0.13, 0.04],
  },
  {
    id: "lamp",
    label: "Crooked pendant light",
    object: "lamp",
    anchor: {
      desktop: "hero-card",
      tablet: "hero-eyebrow",
      /* No room beside a phone hero, so on mobile the pendant belongs to the
         checklist row that names it instead. */
      mobile: "row-lamp",
    },
    align: {
      desktop: { x: -1.85, y: 0 },
      tablet: { x: 0.69, y: 0 },
      mobile: { x: 0.73, y: 0 },
    },
    nudgePx: { desktop: [0, 73], tablet: [0, 63], mobile: [0, 0] },
    workMotion: "high",
    tool: "screwdriver",
    toolGap: 0.14,
    workSeconds: 5.5,
    workYawDeg: 10,
    objectRotationDeg: [0, 18, 0],
    objectOffset: [-0.3, 0.26],
  },
  {
    id: "shelf",
    label: "Drooping shelf",
    object: "shelf",
    anchor: {
      desktop: "row-shelf",
      tablet: "row-shelf",
      mobile: "row-shelf",
    },
    align: {
      desktop: { x: 0.62, y: 0 },
      tablet: { x: 0.41, y: 0 },
      mobile: { x: 0.62, y: 0 },
    },
    nudgePx: { desktop: [0, -15], tablet: [0, -15], mobile: [0, 0] },
    workMotion: "reach",
    tool: "drill",
    toolGap: 0.16,
    workSeconds: 5.5,
    workYawDeg: 8,
    objectRotationDeg: [6, 24, 0],
    objectOffset: [0.4, 0.0],
  },
  {
    id: "cabinet",
    label: "Loose cabinet handle",
    object: "cabinet",
    anchor: {
      desktop: "row-cabinet",
      tablet: "row-cabinet",
      mobile: "row-cabinet",
    },
    align: {
      desktop: { x: 0.81, y: 0 },
      tablet: { x: 0.57, y: 0 },
      mobile: { x: 0.74, y: 0 },
    },
    nudgePx: { desktop: [0, -15], tablet: [0, -15], mobile: [0, 0] },
    workMotion: "mid",
    tool: "screwdriver",
    toolGap: 0.15,
    workSeconds: 5,
    workYawDeg: 12,
    objectRotationDeg: [-5, 28, 0],
    objectOffset: [-0.3, -0.05],
  },
  {
    id: "frame",
    label: "Crooked picture frame",
    object: "frame",
    /*
     * Dropped on a phone. The membership band is a long way below the list
     * there, and a fifth stop would send him off-screen for a third of the
     * loop. Four jobs on a phone is the composition, not a degraded one.
     */
    anchor: {
      desktop: "membership-heading",
      tablet: "membership-heading",
      mobile: null,
    },
    align: {
      desktop: { x: 2.6, y: 0 },
      tablet: { x: 2.28, y: 0 },
      mobile: { x: 0, y: 0 },
    },
    nudgePx: { desktop: [0, -12], tablet: [0, -6], mobile: [0, 0] },
    workMotion: "high",
    tool: null,
    toolGap: 0.06,
    workSeconds: 4.5,
    workYawDeg: -6,
    objectRotationDeg: [-8, 22, 0],
    objectOffset: [-0.32, 0.26],
  },
];

/** Which checklist rows tick themselves when their job is finished. */
export const ROW_JOBS: Record<string, string> = {
  "row-shelf": "shelf",
  "row-cabinet": "cabinet",
  "row-lamp": "lamp",
};
