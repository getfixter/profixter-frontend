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
  /**
   * Force the approach side rather than taking whichever is nearer.
   *
   * The near side is right nearly always — it is what stops him walking past a
   * thing and turning back — but a couple of these read better approached from
   * the far side, and an authored answer beats a clever one when the clever one
   * is wrong.
   */
  fromSide?: 1 | -1;
  /**
   * Where his feet go, relative to the repair, in HIS units.
   *
   * The default is derived: out to one side by a stance-dependent step, and
   * down by the height that stance holds its working hand at, so the hand the
   * clip already lifts arrives at about the right place. That is right for most
   * of them. This is the override for the ones it is not right for, and it is
   * the single most important number for whether an arrival looks intentional.
   */
  stand?: [number, number];
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
  /**
   * Where the tool tip should point while he works, offset from the repair in
   * HIS units. Absent means the tool holds its rest angle in his fist.
   *
   * Rest angle is right for most of them — a wrench on a tap and a drill into a
   * bracket both come out of the clip pointing about where they should. It is
   * wrong for the socket: the screwdriver comes to rest angled off past the
   * faceplate, so he was turning a screw that was four inches to the left of
   * the one that was loose. Aiming is authored per repair rather than switched
   * on globally, because the other five are approved as they stand.
   */
  aim?: [number, number];
  /**
   * How long he stands looking at it before moving on, in seconds.
   *
   * Overridden where the repair itself has an aftermath worth watching. The
   * socket's smoke takes a couple of seconds to clear after the sparks stop,
   * and walking away halfway through that throws away the only part of the
   * sequence that says "and now it is finished".
   */
  admire?: number;
  /**
   * The tool, larger than its usual larger-than-life, for this repair only.
   *
   * A screwdriver against a socket is the smallest hand-to-object relationship
   * in the set, and at phone size the shaft was a grey line on a white plate.
   * A quarter more is enough to see the tool meet the thing; more than that and
   * he is holding a prop.
   */
  toolScale?: number;
};

/**
 * The level.
 *
 * Six, in a circuit that starts and finishes next to his home mark: the socket
 * at his feet, up the left wall past the cabinet to the picture, across the top
 * to the lamp, down the right to the shelf and the tap, and home. The order IS
 * the route, so it is written in the order he walks it.
 *
 * Starting beside home matters more than it sounds. Written the other way round
 * the opening was a seven-second walk across the whole screen before anything
 * happened, which is a long time to ask of somebody who has just arrived. Now
 * he kneels to the first job almost immediately, and the longest leg in the
 * piece is the walk home at the end — which is the one leg that should be long,
 * because it is the one that means the work is finished.
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
    id: "outlet",
    label: "Loose socket",
    kind: "outlet",
    motion: "kneel",
    tool: "screwdriver",
    at: { x: 0.55, y: 0.79 },
    narrow: { x: 0.42, y: 0.8 },
    side: 1,
    seconds: 3.8,
    /*
     * Iconic, not accurate.
     *
     * A real socket beside a real man is six per cent of his height, which on a
     * phone came out ten pixels wide — and ten pixels cannot look like anything,
     * least of all like something going wrong. No amount of effect tuning fixes
     * a subject that small; the sparks were correct and unreadable. At this size
     * it is about a quarter of his height, which is a game's socket rather than
     * a builder's, and every effect hanging off it grows with it.
     */
    scale: 1.32,
    /*
     * Close enough to reach it, far enough not to stand on it.
     *
     * Pulled in tight the screwdriver met the plate beautifully and his own
     * shoulder covered half of it; the aim on the tool buys back most of what
     * the extra distance costs, and a repair you cannot see is worse than a
     * tool that stops an inch short.
     */
    stand: [0.5, -0.36],
    aim: [-0.02, 0.0],
    admire: 2.1,
    toolScale: 1.28,
  },
  {
    id: "cabinet",
    label: "Cabinet door",
    kind: "cabinet",
    motion: "mid",
    /*
     * A drill, not a screwdriver.
     *
     * Partly so the second repair does not look like the first, and partly
     * because a drill spins at nearly three times a screwdriver's rate: the
     * hinge can jolt on the bit, which is the whole of "the cabinet reacts to
     * his tool" for a mechanical job with no sparks to spend.
     */
    tool: "drill",
    /* Low enough on a wide screen that the small print above it stays clear. */
    at: { x: 0.24, y: 0.64 },
    narrow: { x: 0.2, y: 0.6 },
    side: 1,
    /*
     * Long, because this repair is a sequence rather than a single action: he
     * lifts the door, drills the hinge, seats it, and then tries it. Four
     * things at four seconds is four things nobody sees.
     */
    seconds: 5.6,
    admire: 1.9,
    /*
     * Big enough to be a cabinet.
     *
     * The old ratio drew it at twenty pixels across on a phone, which is not a
     * cupboard, a door or a problem — it is a brown mark. Nothing about the
     * damage could have read at that size.
     */
    scale: 0.9,
    /*
     * High enough that his hand meets the HINGE.
     *
     * The stance holds its working hand one unit above his feet, and the hinge
     * that has failed is near the top of the door — so where he stands decides
     * whether he is drilling the hinge or the middle of the panel. This is that
     * subtraction rather than a number that looked right in a drawing.
     */
    stand: [0.93, -0.75],
    aim: [0.34, 0.42],
    toolScale: 1.15,
  },
  {
    id: "frame",
    label: "Crooked picture",
    kind: "frame",
    motion: "mid",
    tool: null,
    at: { x: 0.17, y: 0.3 },
    /*
     * Down off the headline on a phone.
     *
     * Objects live behind the type and that is the design — but there is a
     * difference between sixty-pixel display type and body copy. Against the
     * headline the frame was a crooked rectangle behind a solid white wall of
     * letters; twenty per cent further down it sits over the paragraph, which
     * lets a shape through.
     */
    narrow: { x: 0.19, y: 0.31 },
    side: 1,
    /* Lift, square, let go, watch it rock. */
    seconds: 4.0,
    admire: 1.7,
    scale: 1.05,
    stand: [0.72, -0.86],
  },
  {
    id: "lamp",
    label: "Light out",
    kind: "lamp",
    motion: "reach",
    tool: "screwdriver",
    at: { x: 0.37, y: 0.17 },
    narrow: { x: 0.56, y: 0.18 },
    side: -1,
    seconds: 4.6,
    admire: 1.8,
    scale: 1.12,
    /*
     * Deep enough below it that his hand reaches the COLLAR.
     *
     * The old number put his palm a clear finger above the shade, so the whole
     * repair was a man gesturing at a ceiling. This is the arithmetic instead:
     * the reach stance holds its hand about seven tenths of a unit above his
     * feet, the fitting hangs six tenths below the rose, and the difference is
     * where he has to stand.
     */
    stand: [0.58, -1.92],
    aim: [0.18, -0.46],
    toolScale: 1.12,
  },
  {
    id: "shelf",
    label: "Sagging shelf",
    kind: "shelf",
    motion: "mid",
    tool: "drill",
    at: { x: 0.57, y: 0.28 },
    /*
     * Off the button.
     *
     * Everything here lives behind the interface and that is the design — but
     * "behind a paragraph" and "behind a solid blue call to action" are not the
     * same thing. Text lets a shape through; a filled button is a wall, and the
     * shelf was spending its whole repair invisible behind one.
     */
    narrow: { x: 0.78, y: 0.29 },
    side: -1,
    seconds: 5.2,
    admire: 1.8,
    scale: 0.8,
    stand: [0.78, -0.86],
    aim: [-0.42, -0.14],
    toolScale: 1.12,
  },
  {
    id: "faucet",
    label: "Dripping tap",
    kind: "faucet",
    /*
     * Standing, not squatting.
     *
     * The squat holds its hand about half a unit off the floor, which for a
     * basin at waist height put the wrench on the rim of the bowl and his face
     * behind it. A tap is chest-high work and the mid stance is chest-high; the
     * stance was fighting the fixture rather than the other way round.
     */
    motion: "mid",
    tool: "wrench",
    /* Clear of the booking card, which on a wide screen is a solid white wall. */
    at: { x: 0.58, y: 0.63 },
    narrow: { x: 0.76, y: 0.6 },
    side: -1,
    /* Three bites of the wrench and a beat to watch it stop. */
    seconds: 5.0,
    admire: 2.0,
    /*
     * Big, because the water has to be bigger than the sink.
     *
     * The socket's plume works because it is taller than the socket; a leak
     * drawn inside the outline of a sixty-pixel basin is a blue smudge whatever
     * is happening inside it. At this size the wet area is about the same
     * screen presence as the smoke, which is the benchmark that was set.
     */
    scale: 1.15,
    stand: [0.36, -0.82],
    aim: [0.02, 0.14],
    toolScale: 1.15,
  },
];

/**
 * Where he starts, and where he goes back to.
 *
 * A performance needs a first position and a last one, and they should be the
 * same position: leaving him parked beside whatever he happened to fix last is
 * the difference between a sequence that ended and one that merely stopped.
 * Low and a little left of centre, clear of all six repairs, with room to stand
 * square to the reader at the end.
 */
export const HOME = { at: { x: 0.34, y: 0.86 }, narrow: { x: 0.26, y: 0.88 } };

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
/** The start and finish mark, in world units. */
export function homeAt(
  viewport: { w: number; h: number },
  unitPx: number,
  narrow: boolean
): THREE.Vector3 {
  const at = narrow ? HOME.narrow : HOME.at;
  const halfW = viewport.w / unitPx / 2;
  const halfH = viewport.h / unitPx / 2;
  return new THREE.Vector3(
    (at.x - 0.5) * halfW * 2,
    (0.5 - at.y) * halfH * 2,
    0
  );
}

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
    const comingFrom = previous ? previous.feet.x : homeAt(viewport, unitPx, narrow).x;
    const side = spot.fromSide ?? (comingFrom <= object.x ? -1 : 1);
    const feet = spot.stand
      ? new THREE.Vector3(
          object.x + side * spot.stand[0] * characterScale,
          object.y + spot.stand[1] * characterScale,
          0
        )
      : new THREE.Vector3(
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
 * The whole performance.
 *
 * He starts at home, visits each repair in order, and walks back. There is no
 * loop, no reset and no second pass: when the last one is mended he returns to
 * the mark he set off from and stands there, and that is the end of it.
 */
export type WorldBeat =
  | "START"
  | "WALK"
  | "ARRIVE"
  | "WORK_IN"
  | "WORK"
  | "WORK_OUT"
  | "ADMIRE"
  | "HOME";

export type WorldRuntime = {
  beat: WorldBeat;
  /** Which repair he is at or heading to. -1 means he has no job. */
  index: number;
  /**
   * What is waiting for him, in the order it was asked for.
   *
   * The performance used to be a counter walking from zero to five, which said
   * both what he was doing and what was left in one number — fine for a fixed
   * list, useless the moment a visitor can break something. This is the list
   * itself: it starts as all six, the head of it is the job he is on, and a tap
   * puts an index on the end. Strictly first in, first out, and an index is
   * never in it twice.
   */
  queue: number[];
  elapsed: number;
  position: THREE.Vector3;
  yaw: number;
  /** How fast he is actually moving. Ramped, never stepped. */
  speed: number;
  progress: number;
  fixed: boolean[];
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Where he is facing when he gets there. */
  arriveYaw: number;
  distance: number;
  travelled: number;
  restedFor: number;
  home: THREE.Vector3;
};

/** A repair is visibly mended a little before he stops fussing over it. */
const FIX_AT = 0.72;

/** A beat of standing and looking at it before he moves on. */
const ADMIRE_SECONDS = 0.85;

/** A moment to settle between the last step and the first turn of the screwdriver. */
const ARRIVE_SECONDS = 0.26;

/** How long he waits at the start before setting off. */
const START_SECONDS = 0.7;

/**
 * Metres per second, in his own scale.
 *
 * Derived from the walk take rather than chosen: the clip's feet were built for
 * 0.875 units a second on a full-sized character, so a man at half that size
 * covers half the ground per stride. GAIT is the only liberty — enough above
 * one to read as somebody with a job to get on with, small enough that the clip
 * still looks like walking when it is played at that rate.
 */
const MEASURED_WALK = 0.875;
const GAIT = 1.8;

export function walkSpeed(characterScale: number): number {
  return MEASURED_WALK * characterScale * GAIT;
}

/** Up to speed in about a third of a second, down again a little quicker. */
const ACCEL = 3.4;
const BRAKE = 4.6;

/**
 * How far out he starts slowing down, in his own units.
 *
 * This is most of what makes an arrival look intentional rather than abrupt.
 * Stopping dead on the last frame of a constant-speed slide is the single most
 * robotic thing in a walk cycle: real approaches are announced.
 */
const SLOW_FROM = 1.5;

/**
 * When to stop steering toward the destination and start facing the work.
 *
 * Turning on arrival is a visible correction — he plants, then swivels. Turning
 * over the last fifth of the approach means he walks in already squaring up,
 * and lands facing the thing he came for.
 */
const TURN_IN_AT = 0.76;

export function createWorldRuntime(
  marks: WorldMark[],
  home: THREE.Vector3
): WorldRuntime {
  return {
    beat: "START",
    index: -1,
    queue: marks.map((_, i) => i),
    elapsed: 0,
    position: home.clone(),
    yaw: 0,
    speed: 0,
    progress: 0,
    fixed: marks.map(() => false),
    from: home.clone(),
    to: home.clone(),
    arriveYaw: 0,
    distance: 0,
    travelled: 0,
    restedFor: 0,
    home: home.clone(),
  };
}

const ease = (u: number) => u * u * (3 - 2 * u);

/** Exponential approach: frame-rate independent, and never overshoots. */
export function approach(
  value: number,
  target: number,
  dt: number,
  rate: number
): number {
  return value + (target - value) * (1 - Math.exp(-rate * dt));
}

/** Send him somewhere, and remember how he should be facing when he lands. */
function setOff(
  runtime: WorldRuntime,
  to: THREE.Vector3,
  arriveYaw: number
): void {
  runtime.beat = "WALK";
  runtime.elapsed = 0;
  runtime.from.copy(runtime.position);
  runtime.to.copy(to);
  runtime.distance = runtime.from.distanceTo(runtime.to);
  runtime.travelled = 0;
  runtime.arriveYaw = arriveYaw;
}

/**
 * Off to whatever is at the head of the queue, or home if there is nothing.
 *
 * The one place the runner decides where he goes next, so "finish what you are
 * on, then take the next in order" is a property of the code rather than a rule
 * repeated in four branches.
 */
function departNext(runtime: WorldRuntime, marks: WorldMark[]): void {
  const next = runtime.queue[0];
  if (next === undefined) {
    runtime.index = -1;
    setOff(runtime, runtime.home, 0);
    return;
  }
  runtime.index = next;
  setOff(runtime, marks[next].feet, marks[next].yaw);
}

/**
 * Break something, and put it in the line.
 *
 * Refuses anything already queued — which includes whatever he is working on,
 * since a job stays at the head of the queue until he has finished admiring it.
 * One object, at most one pending repair; tap it again and nothing happens
 * until it has been mended.
 */
export function requestRepair(
  runtime: WorldRuntime,
  index: number
): boolean {
  if (index < 0 || index >= runtime.fixed.length) return false;
  if (runtime.queue.includes(index)) return false;
  runtime.queue.push(index);
  runtime.fixed[index] = false;
  return true;
}

/**
 * One frame of the performance.
 *
 * `setFix` is how a repair changes: the runner owns WHEN, the prop owns what
 * that looks like. Everything else in here is position, facing, and which beat
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
  const goingHome = runtime.index < 0;
  const mark = goingHome ? null : marks[runtime.index];
  const motion = mark ? WORK_MOTIONS[mark.spot.motion] : null;

  switch (runtime.beat) {
    case "START": {
      /* A breath before he sets off, so the curtain is not also the first step. */
      runtime.yaw = approach(runtime.yaw, 0, dt, 4);
      if (runtime.elapsed >= START_SECONDS) departNext(runtime, marks);
      break;
    }

    case "WALK": {
      const top = walkSpeed(characterScale);
      const remaining = Math.max(0, runtime.distance - runtime.travelled);
      const slow = SLOW_FROM * characterScale;
      /*
       * Ease out of the idle and into the stop.
       *
       * Speed is a value that is chased, not assigned: he leans into the walk
       * over a third of a second and sheds it again over the last stride, which
       * is what stops the legs from starting and ending mid-air.
       */
      const want = remaining < slow ? top * Math.max(0.12, remaining / slow) : top;
      runtime.speed =
        want > runtime.speed
          ? Math.min(want, runtime.speed + top * ACCEL * dt)
          : Math.max(want, runtime.speed - top * BRAKE * dt);
      runtime.travelled = Math.min(
        runtime.distance,
        runtime.travelled + runtime.speed * dt
      );
      /*
       * On the way home is not "busy".
       *
       * Finishing the current REPAIR before taking the next one is the rule; a
       * walk back to his mark is not a repair, and making him complete it
       * before turning round would have him cross the screen twice for no
       * reason anybody watching could explain.
       */
      if (goingHome && runtime.queue.length) {
        departNext(runtime, marks);
        break;
      }
      const u = runtime.distance > 0 ? runtime.travelled / runtime.distance : 1;
      runtime.position.lerpVectors(runtime.from, runtime.to, u);
      /* Face the way he is going, then face the work — all while still moving. */
      const dx = runtime.to.x - runtime.from.x;
      const aim = u > TURN_IN_AT ? runtime.arriveYaw : faceYaw(dx);
      runtime.yaw = approach(runtime.yaw, aim, dt, 5.5);
      if (u >= 1) {
        runtime.beat = "ARRIVE";
        runtime.elapsed = 0;
        runtime.speed = 0;
      }
      break;
    }

    case "ARRIVE": {
      /* Planted, squaring up. Short — it is a settle, not a pause. */
      runtime.speed = approach(runtime.speed, 0, dt, 9);
      runtime.yaw = approach(runtime.yaw, runtime.arriveYaw, dt, 8);
      if (runtime.elapsed < ARRIVE_SECONDS) break;
      if (goingHome) {
        runtime.beat = "HOME";
        runtime.elapsed = 0;
        runtime.restedFor = 0;
        break;
      }
      runtime.beat = motion?.crouched ? "WORK_IN" : "WORK";
      runtime.elapsed = 0;
      runtime.progress = 0;
      break;
    }

    case "WORK_IN": {
      /* Lowering himself. The clip does it; we only wait for it. */
      if (!mark) break;
      runtime.yaw = approach(runtime.yaw, mark.yaw, dt, 8);
      if (runtime.elapsed >= 0.62) {
        runtime.beat = "WORK";
        runtime.elapsed = 0;
      }
      break;
    }

    case "WORK": {
      if (!mark) break;
      runtime.yaw = approach(runtime.yaw, mark.yaw, dt, 8);
      runtime.progress = Math.min(1, runtime.elapsed / mark.spot.seconds);
      /*
       * The thing mends part-way through, not at the end.
       *
       * If it changed on the last frame the change would happen while he is
       * already straightening up, and the eye would tie it to him standing
       * rather than to the work. Seven-tenths puts the moment squarely inside
       * the fixing, with a beat of him still at it afterwards.
       */
      setFix(
        mark.spot.id,
        runtime.progress < FIX_AT
          ? 0
          : ease(Math.min(1, (runtime.progress - FIX_AT) / (1 - FIX_AT)))
      );
      if (runtime.progress >= 1) {
        runtime.fixed[runtime.index] = true;
        runtime.beat = motion?.crouched ? "WORK_OUT" : "ADMIRE";
        runtime.elapsed = 0;
      }
      break;
    }

    case "WORK_OUT": {
      /* Standing back up out of the crouch. */
      if (runtime.elapsed >= 0.55) {
        runtime.beat = "ADMIRE";
        runtime.elapsed = 0;
      }
      break;
    }

    case "ADMIRE": {
      /*
       * A look at the finished thing before he moves on.
       *
       * Without it the last frame of the repair is also the first frame of the
       * walk, and a man who turns away the instant a job is done reads as a
       * machine advancing a queue.
       */
      if (runtime.elapsed < (mark?.spot.admire ?? ADMIRE_SECONDS)) break;
      /* Done with it: off the queue, and on to whatever is next. */
      if (runtime.queue[0] === runtime.index) runtime.queue.shift();
      departNext(runtime, marks);
      break;
    }

    case "HOME": {
      /* Square to the reader, and finished. */
      runtime.restedFor += dt;
      runtime.speed = 0;
      runtime.yaw = approach(runtime.yaw, 0, dt, 2.6);
      /* Somebody broke something while he was standing here. */
      if (runtime.queue.length) departNext(runtime, marks);
      break;
    }
  }
}

/** Which clip the current beat wants. */
export function clipForBeat(
  runtime: WorldRuntime,
  marks: WorldMark[],
  walkClip: string | null
): string {
  const mark = runtime.index >= 0 ? marks[runtime.index] : null;
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

/**
 * How fast to run the walk clip, so his feet match the ground he covers.
 *
 * The take was built for one speed, he is playing it at another, and he is
 * accelerating and braking on top of that. Driving the clip from the speed he
 * is actually travelling is the whole of the anti-skating system, and it costs
 * one division.
 */
export function walkClipRate(speed: number, characterScale: number): number {
  const natural = MEASURED_WALK * characterScale;
  return THREE.MathUtils.clamp(speed / Math.max(natural, 0.001), 0.35, 2.2);
}
