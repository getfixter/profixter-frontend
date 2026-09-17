import * as THREE from "three";
import type { ObjectKind } from "./lab-objects";
import { WORK_MOTIONS } from "./lab-jobs";
import type { ToolKind } from "./lab-tools";

/**
 * THE LITTLE WORLD — one screen, a handful of broken things, one performance.
 *
 * This replaces the page-anchored touring system with something much smaller,
 * and the difference is not an optimisation, it is the concept. The old model
 * asked "where on this document can a repair go?" and answered it continuously,
 * which is why furniture appeared and vanished as you scrolled and why the man
 * spent his time being relocated rather than working.
 *
 * Here the world is a fixed composition in the VIEWPORT. Every broken thing is
 * placed once, at a spot chosen by hand, and every one of them is on screen
 * from the first frame. Nothing is scheduled, nothing ages, nothing respawns.
 * He walks to each in turn, fixes it, and it stays fixed. When the last one is
 * done he stands there, and that is the end of the performance.
 *
 * The value of having them all visible is anticipation: you can see the crooked
 * picture and the dripping tap before he gets to them, so there is a question
 * running the whole time — which one next? — that a spawning system can never
 * produce, because you cannot look forward to something that does not exist yet.
 */

export type WorldSpot = {
  id: string;
  label: string;
  kind: ObjectKind;
  /** The stance he works in. Decides his silhouette and his hand height. */
  motion: keyof typeof WORK_MOTIONS;
  tool: ToolKind | null;
  /**
   * Where it sits, as a fraction of the viewport: 0,0 is the top left corner.
   *
   * Fractions rather than world units because the composition is the point —
   * it has to hold its shape on a phone and on a desktop, and those are very
   * different rectangles.
   */
  at: { x: number; y: number };
  /** A phone is much taller than it is wide; a few things move rather than squash. */
  narrow?: { x: number; y: number };
  /** Which side he works from: 1 stands to its right, -1 to its left. */
  side: 1 | -1;
  /** How long the repair takes, in seconds. */
  seconds: number;
  /**
   * How big this thing is, relative to the others.
   *
   * Not decoration: drawn at one uniform size the set stops being a set. A
   * cabinet really is four times a socket, and the first arrangement here
   * ignored that — every object came out the same size, which made the lamp a
   * white blob and the cabinet a wardrobe. These are the ratios the props were
   * tuned to against a 1.72 character.
   */
  scale?: number;
  rotationDeg?: [number, number, number];
};

/**
 * The level.
 *
 * Six, in a loop around the screen — upper left, top, upper right, down the
 * right, across the bottom, back up the left. The order is the route, so it is
 * written in the order he does them and reads as a circuit rather than as a
 * list. Each leg changes both x and y, because a character who only ever walks
 * sideways reads as a slider.
 *
 * The heights say what they are: a picture and a lamp are up, a cabinet and a
 * tap are at hand height, an outlet is at the skirting board. Nothing is at the
 * very edge of the screen — a repair half off the side is a repair nobody can
 * enjoy, and he needs somewhere to stand beside each one.
 *
 * The band is 0.2 to 0.78 of the height, and the top of it is not arbitrary: he
 * stands BELOW whatever he reaches up to, so an overhead repair any higher than
 * this puts his cap off the top of the screen. The first arrangement had the
 * lamp at a tenth and the man was decapitated by the site header.
 */
export const WORLD_SPOTS: WorldSpot[] = [
  {
    id: "frame",
    label: "Crooked picture",
    kind: "frame",
    motion: "mid",
    tool: null,
    at: { x: 0.17, y: 0.3 },
    narrow: { x: 0.2, y: 0.24 },
    side: 1,
    seconds: 3.0,
    scale: 0.6,
  },
  {
    id: "lamp",
    label: "Light out",
    kind: "lamp",
    motion: "reach",
    tool: "screwdriver",
    at: { x: 0.37, y: 0.19 },
    narrow: { x: 0.56, y: 0.21 },
    side: -1,
    seconds: 4.2,
    scale: 0.82,
  },
  {
    id: "shelf",
    label: "Sagging shelf",
    kind: "shelf",
    motion: "mid",
    tool: "drill",
    at: { x: 0.57, y: 0.28 },
    narrow: { x: 0.82, y: 0.4 },
    side: -1,
    seconds: 4.4,
    scale: 0.66,
  },
  {
    id: "faucet",
    label: "Dripping tap",
    kind: "faucet",
    motion: "squat",
    tool: "wrench",
    at: { x: 0.8, y: 0.55 },
    narrow: { x: 0.76, y: 0.6 },
    side: -1,
    seconds: 4.0,
    scale: 0.66,
  },
  {
    id: "outlet",
    label: "Loose socket",
    kind: "outlet",
    motion: "kneel",
    tool: "screwdriver",
    at: { x: 0.55, y: 0.79 },
    narrow: { x: 0.42, y: 0.8 },
    side: 1,
    seconds: 3.8,
    scale: 0.62,
  },
  {
    id: "cabinet",
    label: "Cabinet door",
    kind: "cabinet",
    motion: "mid",
    tool: "screwdriver",
    at: { x: 0.22, y: 0.62 },
    narrow: { x: 0.18, y: 0.62 },
    side: 1,
    seconds: 3.6,
    scale: 0.41,
  },
];

/**
 * How far to the side of a repair he stands.
 *
 * In his own units, so it scales with him. Standing work needs more room than
 * crouched work because a standing man is wider at the shoulder than a kneeling
 * one is at the knee, and because the thing he is working on is at chest height
 * where his body would otherwise be.
 */
/*
 * Widened after watching him: at the first setting he stood INSIDE the picture
 * frame and inside the cabinet door. A man working on a thing has to be beside
 * it, with daylight between them, or the two read as one object.
 */
const SIDE_STEP = { standing: 1.3, crouched: 1.08 };

/** Never a full profile: at ninety degrees we lose his face, which is the point of him. */
const FACE_MAX = THREE.MathUtils.degToRad(70);

/** Yaw that turns him toward a horizontal offset without losing his face. */
export function faceYaw(dx: number): number {
  return FACE_MAX * THREE.MathUtils.clamp(dx / 0.62, -1, 1);
}

export type WorldMark = {
  spot: WorldSpot;
  /** Where the repair is drawn. */
  object: THREE.Vector3;
  /** Where his feet go to work on it. */
  feet: THREE.Vector3;
  /** Which way he faces while working. */
  yaw: number;
};

/**
 * Turn the composition into world points, once, for this viewport.
 *
 * His feet land a stance's hand-height below the repair, so the hand the clip
 * already lifts arrives at roughly the right place without anybody solving
 * anything. That is the whole of the "reaching" system now: put him where the
 * animation works, instead of bending the animation to where he is.
 */
export function layoutWorld(
  viewport: { w: number; h: number },
  unitPx: number,
  characterScale: number,
  narrow: boolean
): WorldMark[] {
  const halfW = viewport.w / unitPx / 2;
  const halfH = viewport.h / unitPx / 2;
  const marks: WorldMark[] = [];
  for (const spot of WORLD_SPOTS) {
    const at = (narrow && spot.narrow) || spot.at;
    const object = new THREE.Vector3(
      (at.x - 0.5) * halfW * 2,
      (0.5 - at.y) * halfH * 2,
      0
    );
    const motion = WORK_MOTIONS[spot.motion];
    const step =
      (motion.crouched ? SIDE_STEP.crouched : SIDE_STEP.standing) *
      characterScale;
    /*
     * He stands on the side he arrives from.
     *
     * Authoring the side by hand looked right in a drawing and wrong in motion:
     * it had him walk PAST a cabinet and turn back to it, which is the single
     * most obviously robotic thing a game character can do. Taking the near
     * side of whichever way he is coming costs one line and removes it.
     */
    const previous = marks[marks.length - 1];
    const side = previous
      ? previous.feet.x <= object.x
        ? -1
        : 1
      : spot.side;
    const feet = new THREE.Vector3(
      object.x + side * step,
      object.y - motion.handOffset[1] * characterScale,
      0
    );
    /* He faces back toward the thing he is standing beside. */
    marks.push({ spot, object, feet, yaw: faceYaw(-side * 0.62) });
  }
  return marks;
}

/* ------------------------------------------------------------------ runner */

/**
 * The whole state machine.
 *
 * Five beats, in a fixed order, with no branching except "is there another one
 * after this". There is no scheduler, no transition planner, no shape library
 * and no rest: the variety in the performance comes from the objects being
 * different from each other, which is where variety should come from.
 */
export type WorldBeat =
  | "WORK_IN"
  | "WORK"
  | "WORK_OUT"
  | "TURN"
  | "WALK"
  | "DONE";

export type WorldRuntime = {
  beat: WorldBeat;
  /** Which spot he is at, or walking to. */
  index: number;
  /** Seconds inside the current beat. */
  elapsed: number;
  position: THREE.Vector3;
  yaw: number;
  /** How far through the current repair, 0 to 1. */
  progress: number;
  /** Which repairs are finished. Once true, always true. */
  fixed: boolean[];
  /** The walk in progress. */
  from: THREE.Vector3;
  to: THREE.Vector3;
  distance: number;
  travelled: number;
  /** Seconds since everything was finished, for the closing idle. */
  restedFor: number;
};

/** A repair is visibly mended a little before he stops fussing over it. */
const FIX_AT = 0.72;

/** How long he takes to square up to the next thing before setting off. */
const TURN_SECONDS = 0.34;

/**
 * Metres per second, in his own scale.
 *
 * Derived from the walk take rather than chosen: the clip's feet were built for
 * 0.875 units a second on a full-sized character, so a man at half that size
 * covers half the ground per stride. GAIT is the only liberty — a shade above
 * one, which reads as somebody with a job to get on with rather than a stroll,
 * and is small enough that the feet still land where the clip puts them.
 */
const MEASURED_WALK = 0.875;
const GAIT = 1.5;

export function walkSpeed(characterScale: number): number {
  return MEASURED_WALK * characterScale * GAIT;
}

export function createWorldRuntime(marks: WorldMark[]): WorldRuntime {
  const first = marks[0];
  return {
    /*
     * He starts mid-repair, on purpose.
     *
     * The first three seconds have to say what this is, and a man already
     * kneeling at a socket with a screwdriver says it immediately — where a man
     * walking across a screen says nothing until he arrives. So the curtain
     * goes up on the first job already under way and its payoff lands inside a
     * couple of seconds.
     */
    beat: "WORK",
    index: 0,
    elapsed: 0,
    position: first ? first.feet.clone() : new THREE.Vector3(),
    yaw: first ? first.yaw : 0,
    progress: 0,
    fixed: marks.map(() => false),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    distance: 0,
    travelled: 0,
    restedFor: 0,
  };
}

const ease = (u: number) => u * u * (3 - 2 * u);

/**
 * One frame of the performance.
 *
 * `setFix` is how a repair changes: the runner owns WHEN, the prop owns what
 * that looks like. Everything else in here is position, facing and which beat
 * is running.
 */
export function stepWorld(
  runtime: WorldRuntime,
  marks: WorldMark[],
  dt: number,
  setFix: (id: string, value: number) => void,
  characterScale: number
): void {
  if (!marks.length) return;
  runtime.elapsed += dt;
  const mark = marks[Math.min(runtime.index, marks.length - 1)];
  const motion = WORK_MOTIONS[mark.spot.motion];

  switch (runtime.beat) {
    case "WORK_IN": {
      /* Lowering himself. The clip does it; we only wait for it. */
      runtime.yaw = approach(runtime.yaw, mark.yaw, dt, 8);
      if (runtime.elapsed >= (motion.crouched ? 0.62 : 0.3)) {
        runtime.beat = "WORK";
        runtime.elapsed = 0;
      }
      break;
    }

    case "WORK": {
      runtime.yaw = approach(runtime.yaw, mark.yaw, dt, 8);
      runtime.progress = Math.min(1, runtime.elapsed / mark.spot.seconds);
      /*
       * The thing mends part-way through, not at the end.
       *
       * If it changes on the last frame of the repair the change happens while
       * he is already straightening up, and the eye ties it to him standing
       * rather than to the work. Landing it at seven-tenths puts the moment
       * squarely inside the fixing, with a beat of him still at it afterwards.
       */
      setFix(
        mark.spot.id,
        runtime.progress < FIX_AT
          ? 0
          : ease(Math.min(1, (runtime.progress - FIX_AT) / (1 - FIX_AT)))
      );
      if (runtime.progress >= 1) {
        runtime.fixed[runtime.index] = true;
        runtime.beat = motion.crouched ? "WORK_OUT" : "TURN";
        runtime.elapsed = 0;
      }
      break;
    }

    case "WORK_OUT": {
      if (runtime.elapsed >= 0.55) {
        runtime.beat = "TURN";
        runtime.elapsed = 0;
      }
      break;
    }

    case "TURN": {
      const next = runtime.index + 1;
      if (next >= marks.length) {
        runtime.beat = "DONE";
        runtime.elapsed = 0;
        runtime.restedFor = 0;
        break;
      }
      const target = marks[next];
      const dx = target.feet.x - runtime.position.x;
      const want = faceYaw(dx);
      runtime.yaw = approach(runtime.yaw, want, dt, 7);
      /*
       * A turn lasts as long as the turn takes, and no longer.
       *
       * A fixed third of a second in front of every leg is a stutter when the
       * next thing is a step away and he is already square to it — which on a
       * phone, where the whole world is four units wide, is most of them.
       */
      if (
        Math.abs(runtime.yaw - want) < 0.07 ||
        runtime.elapsed >= TURN_SECONDS
      ) {
        runtime.beat = "WALK";
        runtime.elapsed = 0;
        runtime.index = next;
        runtime.from.copy(runtime.position);
        runtime.to.copy(target.feet);
        runtime.distance = runtime.from.distanceTo(runtime.to);
        runtime.travelled = 0;
      }
      break;
    }

    case "WALK": {
      const speed = walkSpeed(characterScale);
      runtime.travelled = Math.min(
        runtime.distance,
        runtime.travelled + speed * dt
      );
      const u = runtime.distance > 0 ? runtime.travelled / runtime.distance : 1;
      /*
       * A straight line, and no curve on it.
       *
       * The old routes bowed, bent around content and re-planned mid-walk, and
       * the result read as a man being steered rather than a man walking. Two
       * points and a constant speed is what a simple game does, and a simple
       * game is what this is.
       */
      runtime.position.lerpVectors(runtime.from, runtime.to, u);
      const dx = runtime.to.x - runtime.from.x;
      runtime.yaw = approach(runtime.yaw, faceYaw(dx), dt, 6);
      if (u >= 1) {
        const arrived = marks[runtime.index];
        runtime.beat = WORK_MOTIONS[arrived.spot.motion].crouched
          ? "WORK_IN"
          : "WORK";
        runtime.elapsed = 0;
        runtime.progress = 0;
      }
      break;
    }

    case "DONE": {
      runtime.restedFor += dt;
      /* Square up to the room he has just put right. */
      runtime.yaw = approach(runtime.yaw, 0, dt, 2.4);
      break;
    }
  }
}

/** Exponential approach: frame-rate independent, and never overshoots. */
export function approach(
  value: number,
  target: number,
  dt: number,
  rate: number
): number {
  return value + (target - value) * (1 - Math.exp(-rate * dt));
}

/** Which clip the current beat wants. */
export function clipForBeat(
  runtime: WorldRuntime,
  marks: WorldMark[],
  walkClip: string | null
): string {
  const mark = marks[Math.min(runtime.index, marks.length - 1)];
  const motion = mark ? WORK_MOTIONS[mark.spot.motion] : null;
  switch (runtime.beat) {
    case "WALK":
      return walkClip ?? "Idle";
    case "WORK_IN":
      return motion?.enter?.name ?? motion?.clip.name ?? "Idle";
    case "WORK":
      return motion?.clip.name ?? "Idle";
    case "WORK_OUT":
      return motion?.exit?.name ?? "Idle";
    default:
      return "Idle";
  }
}
