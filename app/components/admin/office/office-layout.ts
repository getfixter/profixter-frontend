/**
 * Where everything in the little office lives.
 *
 * World units: the floor is a 10 x 10 square centred on the origin, the camera
 * looks in from the front-right corner (+x, +z), so the back wall is at z = -5
 * and the left wall at x = -5. Desks are turned 45 degrees to face the camera;
 * each robot works BEHIND its desk so its face (and its mood) stays visible.
 */
import type { RobotKey } from "@/lib/office";

export type Vec3 = [number, number, number];

export const DESK_YAW = Math.PI / 4;
export const HUB: Vec3 = [0.3, 0, 0.6];

/** A point behind a desk (local -z), rotated with the desk into the world. */
export function behindDesk(desk: Vec3, distance = 0.92): Vec3 {
  const s = Math.sin(DESK_YAW);
  const c = Math.cos(DESK_YAW);
  return [desk[0] - s * distance, 0, desk[2] - c * distance];
}

export type RobotLook = {
  key: RobotKey;
  name: string;
  title: string; // the knight title shown to the owner
  body: string;
  bodyDark: string;
  accent: string;
  eye: string; // skin tone
  hair: string;
  desk: Vec3;
  seat: Vec3;
  bed: Vec3; // where it naps
  hobby: Vec3; // its favourite idle spot
  hobbyLabel: string;
};

const LUMI_DESK: Vec3 = [-2.2, 0, 0.9];
const ROVER_DESK: Vec3 = [1.3, 0, -2.2];
const ECHO_DESK: Vec3 = [2.55, 0, 1.95];

export const ROBOT_LOOKS: Record<RobotKey, RobotLook> = {
  visibility: {
    key: "visibility",
    name: "Lumi",
    title: "Knight of Visibility",
    body: "#3E7D4F", // vert: forest green
    bodyDark: "#2C5A38",
    accent: "#D9B45A",
    eye: "#E8C9A8", // skin
    hair: "#C9893F", // copper

    desk: LUMI_DESK,
    seat: behindDesk(LUMI_DESK),
    bed: [-4.0, 0, -1.45],
    hobby: [-3.85, 0, 1.75], // the great bookcase
    hobbyLabel: "reading at the bookcase",
  },
  outreach: {
    key: "outreach",
    name: "Rover",
    title: "Knight of Outreach",
    body: "#A8322D", // gules: crimson
    bodyDark: "#7A2420",
    accent: "#D9B45A",
    eye: "#D9A07A", // skin
    hair: "#5A3A22", // chestnut, with a beard

    desk: ROVER_DESK,
    seat: behindDesk(ROVER_DESK),
    bed: [-2.15, 0, -4.1],
    hobby: [3.45, 0, -4.05], // the arched window
    hobbyLabel: "scouting from the window",
  },
  conversation: {
    key: "conversation",
    name: "Echo",
    title: "Knight of Communication",
    body: "#5E3C8C", // purpure: royal purple
    bodyDark: "#43296A",
    accent: "#D9B45A",
    eye: "#8D5A3B", // skin
    hair: "#1F1712", // black

    desk: ECHO_DESK,
    seat: behindDesk(ECHO_DESK),
    bed: [-3.65, 0, -3.95],
    hobby: [0.2, 0, -0.55], // the command table
    hobbyLabel: "checking the command table",
  },
};

export const ROBOT_ORDER: RobotKey[] = ["visibility", "outreach", "conversation"];

/** Shared idle spots every robot may wander to. */
export const IDLE_SPOTS: Vec3[] = [
  [-3.55, 0, -2.75], // warming up by the hearth
  [3.45, 0, -4.05], // the arched window
  [-3.75, 0, 3.35], // tea at the sideboard
  [0.6, 0, 3.1], // the middle of the hall
  [-1.95, 0, -0.55], // the far side of the command table
];

export const PALETTE = {
  stone: "#E7DAC2",
  stoneDark: "#B8A27F",
  gold: "#E8C15A",
  goldDark: "#B8902E",
  royal: "#2F5BEA",
  royalDark: "#1E3A9E",
  steel: "#DCE3EC",
  steelDark: "#9DA8BA",
  leather: "#7A5233",
  oak: "#9A6A3E",
  oakDark: "#6E4527",
  parchment: "#F2E4C2",
  ember: "#FF9A3C",
  floor: "#E9C99B",
  floorDark: "#D2AE7C",
  base: "#2A3350",
  baseTop: "#3A4570",
  wall: "#F7EFE3",
  wallShade: "#EFE3D2",
  trim: "#D9C4A6",
  wood: "#C98F5B",
  woodDark: "#A8703F",
  desk: "#F2E6D3",
  deskLeg: "#8C6A4A",
  rug: "#F3B6A0",
  rug2: "#FBD7C7",
  plant: "#4CB07A",
  plantDark: "#2E8A5A",
  pot: "#E4774F",
  screen: "#16213E",
  navy: "#0B1628",
  beanbagA: "#7FB8FF",
  beanbagB: "#FFC76B",
  beanbagC: "#C6A8FF",
};

export const STATUS_LIGHT: Record<string, string> = {
  // the jewel on each helm: emerald, amber, ruby, sapphire, pewter
  working: "#3FBF6A",
  needs_you: "#F2A71B",
  error: "#D6383E",
  waiting: "#4F86D9",
  paused: "#8C94A8",
  off: "#8C94A8",
};
