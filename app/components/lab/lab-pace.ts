import type { JobDefinition } from "./lab-jobs";

/**
 * How long a repair takes, and what shape it has while it takes it.
 *
 * Measured over fourteen consecutive jobs, the loop produced fourteen identical
 * structures: rest, notice, travel, approach, turn, work, admire — every one of
 * them, every twelve seconds, give or take a second of work. The jobs differed,
 * the bodies differed, the props differed, and underneath all of it was a
 * metronome. That is the earliest remaining tell, and no amount of new content
 * fixes it, because the thing repeating is not the content.
 *
 * So a job now has a SHAPE as well as a subject:
 *
 *   QUICK   he barely stops. Short glance, brisk walk, one action, a nod, gone.
 *           The point of these is that they are over before you settle in.
 *   STEADY  the shape the whole loop used to have.
 *   HEAVY   a real piece of work. He sizes it up, gets into position, takes his
 *           time, and leaves slowly.
 *
 * The contrast between them is the product. A quick job is not valuable because
 * it is efficient; it is valuable because it makes the next heavy one feel
 * heavy.
 */
export type JobPace = "quick" | "steady" | "heavy";

export function paceOf(job: JobDefinition): JobPace {
  if (job.pace) return job.pace;
  const effort = job.effort ?? 0.5;
  if (effort <= 0.3) return "quick";
  if (effort >= 0.62) return "heavy";
  return "steady";
}

export type PaceShape = {
  /** How long he stands about after finishing, before looking for the next. */
  restAfter: [number, number];
  /** Multiplier on the beat where he notices and sizes up the next job. */
  noticeScale: number;
  /** Multiplier on how long he spends working. */
  workScale: number;
  /** Multiplier on the ending beat. */
  finishScale: number;
  /** Multiplier on walking speed toward this job. */
  travelScale: number;
};

export const PACE: Record<JobPace, PaceShape> = {
  /*
   * Brisk all the way through. The rest before it is almost nothing, which is
   * what makes it feel like he spotted something on his way past rather than
   * scheduled a visit.
   */
  quick: {
    restAfter: [0.15, 0.5],
    noticeScale: 0.42,
    workScale: 0.62,
    finishScale: 0.55,
    travelScale: 1.18,
  },
  steady: {
    restAfter: [0.9, 2.0],
    noticeScale: 1,
    workScale: 1,
    finishScale: 1,
    travelScale: 1,
  },
  /*
   * Slower at both ends rather than just longer in the middle. The pause before
   * he sets off and the pause after he finishes are where "that took something
   * out of him" actually lives.
   */
  heavy: {
    restAfter: [1.6, 3.0],
    noticeScale: 1.45,
    workScale: 1.22,
    finishScale: 1.3,
    travelScale: 0.88,
  },
};

export function shapeOf(job: JobDefinition): PaceShape {
  return PACE[paceOf(job)];
}
