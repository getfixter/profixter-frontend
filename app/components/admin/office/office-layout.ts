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
  body: string;
  bodyDark: string;
  accent: string;
  eye: string;
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
    body: "#5FD3B5",
    bodyDark: "#2FA78A",
    accent: "#FFD45C",
    eye: "#B8FFF0",
    desk: LUMI_DESK,
    seat: behindDesk(LUMI_DESK),
    bed: [-4.1, 0, -1.55],
    hobby: [-4.05, 0, 3.55], // the big plant by the window... of search results
    hobbyLabel: "watering the plant",
  },
  outreach: {
    key: "outreach",
    name: "Rover",
    body: "#FF8A6B",
    bodyDark: "#E0603F",
    accent: "#3E5CFF",
    eye: "#FFF1D6",
    desk: ROVER_DESK,
    seat: behindDesk(ROVER_DESK),
    bed: [-2.3, 0, -4.15],
    hobby: [3.1, 0, -4.05], // the window
    hobbyLabel: "looking out the window",
  },
  conversation: {
    key: "conversation",
    name: "Echo",
    body: "#A98BFF",
    bodyDark: "#7C5CF0",
    accent: "#FF7BB0",
    eye: "#EEE6FF",
    desk: ECHO_DESK,
    seat: behindDesk(ECHO_DESK),
    bed: [-3.95, 0, -3.85],
    hobby: [-3.85, 0, 2.2], // the coffee machine
    hobbyLabel: "making coffee",
  },
};

export const ROBOT_ORDER: RobotKey[] = ["visibility", "outreach", "conversation"];

/** Shared idle spots every robot may wander to. */
export const IDLE_SPOTS: Vec3[] = [
  [-1.0, 0, -3.6], // in front of the results display
  [3.1, 0, -4.05], // window
  [-3.85, 0, 2.2], // coffee
  [0.4, 0, 3.4], // middle of the room
];

export const PALETTE = {
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
  working: "#35E07F",
  needs_you: "#FFB21F",
  error: "#FF5A5F",
  waiting: "#7CC4FF",
  paused: "#8C94A8",
  off: "#8C94A8",
};
