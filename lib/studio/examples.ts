/**
 * Example bathrooms for the public Studio: a customer can design without a
 * photo or a tape measure. Every screen that shows one says it is an example.
 *
 * The first is the default: an original illustration of a whole 60" × 30" tub
 * alcove seen from the front (BackEnd/scripts/build_studio_example_scene.js
 * draws it and computes its marks exactly). The photo scene stays so designs
 * saved on it still open.
 *
 * The id must also exist in BackEnd/utils/studio/examples.js.
 */
export type ExampleScene = {
  id: string;
  label: string;
  /** a modelled room (drawn by the engine for any alcove size) instead of an image */
  model?: boolean;
  /** the modelled room's default plumbing wall */
  plumbing?: "left" | "right";
  src: string;
  width: number;
  height: number;
  credit: string;
  marks: Record<string, unknown>;
  points: { valve: [number, number]; head: [number, number] };
  /** objects in the example photo that would not stay (towel, soap): circles [x, y, r] */
  removeCircles: [number, number, number][];
  measure: { facingWidth: number; sideLength: number; rimHeight: number; markHeight?: number; leftWall: boolean; rightWall: boolean };
};

export const EXAMPLE_SCENES: ExampleScene[] = [
  {
    id: "studio-room-1",
    label: "Example bathroom",
    model: true,
    plumbing: "left",
    src: "",
    width: 1080,
    height: 1350,
    credit: "Example bathroom: a Profixter 3D illustration, not a photo of a real home.",
    marks: {},
    points: { valve: [0, 0], head: [0, 0] },
    removeCircles: [],
    measure: { facingWidth: 60, sideLength: 30, rimHeight: 15, markHeight: 72, leftWall: true, rightWall: true },
  },
  {
    id: "example-alcove-1",
    label: "Example bathroom",
    src: "/studio/example-alcove.jpg",
    width: 1080,
    height: 1350,
    credit: "Example bathroom: a Profixter illustration, not a photo of a real home.",
    marks: {
      wallTL: [195, 307], wallTR: [885, 307], wallBL: [195, 963], wallBR: [885, 963],
      leftRim: [[177, 978], [100, 1042]], rightRim: [[903, 978], [980, 1042]],
      leftTop: [[177, 288], [100, 205]], rightTop: [[903, 288], [980, 205]],
    },
    points: { valve: [333, 744], head: [333, 261] },
    removeCircles: [],
    measure: { facingWidth: 60, sideLength: 30, rimHeight: 15, markHeight: 72, leftWall: true, rightWall: true },
  },
  {
    id: "example-bathroom-1",
    label: "Example bathroom",
    src: "/studio/example-bathroom.jpg",
    width: 681,
    height: 1023,
    credit: 'Example photo: "Yellow tile, white shower and tub" by Wonderlane (Flickr), CC BY 2.0, modified.',
    marks: {
      wallTL: [220, 160], wallTR: [444, 140],
      wallBL: [221, 703], wallBR: [412, 748],
      leftRim: [[150, 750], [70, 806]],
      leftTop: [[40, 77], [170, 140]],
    },
    points: { valve: [318, 628], head: [323, 163] },
    removeCircles: [[360, 960, 44], [330, 1005, 44], [385, 1005, 40], [400, 935, 30], [300, 990, 40], [380, 900, 26], [372, 925, 24], [292, 196, 26], [318, 175, 14]],
    measure: { facingWidth: 30, sideLength: 60, rimHeight: 15, leftWall: true, rightWall: false },
  },
];

/** The default example's size ("standard 60″ × 30″"), used when a customer goes back from their own measurements. */
export const STANDARD_SIZE = { facingWidth: 60, sideLength: 30, rimHeight: 15, leftWall: true, rightWall: true };
export const exampleById = (id?: string | null) => EXAMPLE_SCENES.find((s) => s.id === id) || null;
