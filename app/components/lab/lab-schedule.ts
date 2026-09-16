import type { Stop } from "./lab-choreography";
import { paceOf, type JobPace } from "./lab-pace";

/**
 * Which repair he does next.
 *
 * Ten jobs in a fixed order is the thing that eventually gives the whole system
 * away: the bodies stopped repeating, so the ORDER became the repetition, and a
 * visitor who watches two laps has learned the sequence whether they meant to
 * or not.
 *
 * Shuffling is not the answer either, and it is worth being precise about why.
 * With ten jobs, a fair pick repeats a category inside two picks about half the
 * time, and four of these ten are electrical — so "random" reliably produces
 * socket, switch, socket, and two crouches in a row, which is exactly the thing
 * the last three passes were spent eliminating. Randomness removes the pattern
 * a viewer can learn and adds one they can feel.
 *
 * So: score every candidate on how much it CONTRASTS with what just happened,
 * keep the ones near the top, and let chance choose between those. The result
 * has no learnable order and no bad adjacencies, which is what "feels natural"
 * actually means here.
 */

/**
 * What kind of work it is.
 *
 * Not shown anywhere and not meant to be noticed one job at a time. It exists
 * so that half a minute of watching leaves an impression of breadth rather than
 * of an electrician — which is the business message underneath the toy.
 */
export type JobCategory =
  | "electrical"
  | "plumbing"
  | "mounting"
  | "cabinet"
  | "general";

/** How far apart two efforts have to be to read as different work. */
const EFFORT_CONTRAST = 0.25;

export type ScheduleMemory = {
  /** Job ids, most recent last. */
  jobs: string[];
  stances: string[];
  tools: (string | null)[];
  categories: (JobCategory | undefined)[];
  efforts: number[];
  paces: JobPace[];
};

export function emptyMemory(): ScheduleMemory {
  return {
    jobs: [], stances: [], tools: [], categories: [], efforts: [], paces: [],
  };
}

const KEEP = 6;
function push<T>(list: T[], value: T) {
  list.push(value);
  if (list.length > KEEP) list.shift();
}

export function remember(memory: ScheduleMemory, stop: Stop) {
  push(memory.jobs, stop.job.id);
  push(memory.stances, stop.motion.id);
  push(memory.tools, stop.job.tool ?? null);
  push(memory.categories, stop.job.category);
  push(memory.efforts, stop.job.effort ?? 0.5);
  push(memory.paces, paceOf(stop.job));
}

const last = <T>(list: T[]): T | undefined => list[list.length - 1];
const inLastN = <T>(list: T[], value: T, n: number) =>
  list.slice(-n).includes(value);

/**
 * Score one candidate against the recent past. Higher is a better next job.
 *
 * Every term is a contrast: the same stance twice running costs the most,
 * because that is the one a viewer notices first and the one this whole project
 * has spent the longest fixing.
 */
function score(stop: Stop, memory: ScheduleMemory): number {
  const stance = stop.motion.id;
  const tool = stop.job.tool ?? null;
  const category = stop.job.category;
  const effort = stop.job.effort ?? 0.5;

  let value = 0;
  if (last(memory.stances) !== stance) value += 3;
  if (!inLastN(memory.stances, stance, 3)) value += 1.5;
  if (last(memory.categories) !== category) value += 2;
  if (!inLastN(memory.categories, category, 3)) value += 1.2;
  if (last(memory.tools) !== tool) value += 1.5;
  if (!inLastN(memory.tools, tool, 2)) value += 0.6;

  /* A heavy job after a light one, and the other way round. */
  const previousEffort = last(memory.efforts);
  if (previousEffort !== undefined) {
    value += Math.min(1.2, Math.abs(effort - previousEffort) / EFFORT_CONTRAST);
  }

  /*
   * Rhythm is a dimension of contrast like any other.
   *
   * Three quick jobs in a row is a different kind of monotony from three
   * crouches, and a harder one to name while watching — the eye sees variety
   * and the clock does not. Alternating the SHAPE is what makes a heavy repair
   * feel heavy: it has something to be heavy against.
   */
  const pace = paceOf(stop.job);
  if (last(memory.paces) !== pace) value += 1.6;
  if (!inLastN(memory.paces, pace, 3)) value += 0.7;

  /* Crouching twice running reads as the same repair even when it is not. */
  const wasCrouched = memory.stances.length
    ? CROUCHED.has(memory.stances[memory.stances.length - 1])
    : false;
  if (CROUCHED.has(stance) !== wasCrouched) value += 1.7;

  /*
   * Spread the library.
   *
   * This term has to be strong, and the reason is not obvious: a job in a
   * thinly-populated category scores highly on contrast every single time,
   * because whatever just happened it was probably not plumbing. Left alone,
   * the loop's only tap turned up twice in every ten jobs — the scheduler doing
   * exactly what it was told and producing the repetition it exists to prevent.
   */
  const seen = memory.jobs.filter((id) => id === stop.job.id).length;
  value -= seen * 2.4;

  return value;
}

/** Stances that put him on the floor. Kept here so scoring needs no rig. */
const CROUCHED = new Set(["low", "squat", "kneel"]);

/**
 * Pick the next stop.
 *
 * `roll` is the caller's random number, passed in rather than taken so the
 * choice can be replayed in a test.
 */
export function pickNext(
  stops: Stop[],
  memory: ScheduleMemory,
  roll: number
): number {
  if (stops.length <= 1) return 0;

  /*
   * Never repeat inside a short window — but only while there is enough of the
   * library left to honour it. With a small job list this has to yield, or the
   * scheduler runs out of candidates and stalls where it used to just advance.
   */
  const block = Math.min(3, Math.max(0, stops.length - 3));
  const recent = memory.jobs.slice(-block);

  const allowed = stops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => !recent.includes(stop.job.id));
  const pool = allowed.length ? allowed : stops.map((stop, index) => ({ stop, index }));

  /*
   * A little noise on every score, before ranking.
   *
   * Without it the top of the list is almost deterministic for a given
   * predecessor: two cold visits both went lamp, then cabinet — the ten seconds
   * that matter most, identical. The obvious fix is to widen the band of
   * candidates that count as contenders, and that was measurably wrong: at a
   * band wide enough to vary the second job, same-trade adjacencies went from
   * six in nine hundred to twenty-one, and crouch-after-crouch from two to
   * nine. It was admitting genuinely worse choices to buy variety.
   *
   * Jitter does the opposite. It reshuffles candidates that are already within
   * noise of each other and cannot promote one that is properly worse, so the
   * order varies at the top while every adjacency rule holds.
   */
  const scored = pool
    .map((entry) => ({
      ...entry,
      value: score(entry.stop, memory) + (Math.random() - 0.5) * 1.0,
    }))
    .sort((a, b) => b.value - a.value);

  /*
   * Choose among the good ones rather than taking the best.
   *
   * Always taking the top score is a deterministic rotation with extra steps —
   * watch it twice and it is the same run. Anything within a short distance of
   * the leader is, by construction, a perfectly good next job, so the choice
   * between them can be free.
   */
  const best = scored[0].value;
  const contenders = scored.filter((entry) => entry.value >= best - 1.6);
  const pick = contenders[Math.floor(roll * contenders.length) % contenders.length];
  return pick.index;
}
