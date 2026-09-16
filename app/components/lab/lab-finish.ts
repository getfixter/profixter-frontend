/**
 * The small ending a repair gets before he walks away.
 *
 * Without one, the moment a thing is fixed he turns back into transport: the
 * prop snaps straight and he is already on his way somewhere else, which throws
 * away the only second in the loop where he is allowed to be a person rather
 * than a process.
 *
 * These are deliberately short — half a second to two — and deliberately
 * several, because an ending that happens after every single job is not an
 * ending, it is a punctuation mark. Which one he does depends on what the job
 * cost him: you nod at a light switch, you stand back from a shelf, and you
 * wipe your forehead after drilling into a wall.
 *
 * Most of them are procedural, built from the same pieces the work uses — hand
 * targets, a body pose, somewhere to look. Two are motion takes, the only two
 * that survived the Text-to-Motion experiments, and they are the two a model is
 * actually good at: a wave, and being tired.
 */

export type FinishBeat =
  | "nod"       // a look at it and a nod. The default, and the shortest.
  | "hips"      // hands on hips, chest up: pleased with a real piece of work.
  | "test"      // reaches back out and tests the thing he just fixed.
  | "stepBack"  // shifts his weight back to take the whole thing in.
  | "stow"      // drops the tool to his belt and pats it.
  | "brow"      // wipes his forehead. Earned, not decorative.
  | "wave";     // hello. Once a visit, near the start, and never again.

export const FINISH_SECONDS: Record<FinishBeat, number> = {
  nod: 1.0,
  hips: 1.5,
  test: 1.4,
  stepBack: 1.4,
  stow: 1.1,
  brow: 2.0,
  wave: 2.0,
};

/** The two that are motion takes rather than maths. */
export const FINISH_CLIP: Partial<Record<FinishBeat, string>> = {
  brow: "Beat · Brow",
  wave: "Beat · Wave",
};

/**
 * Which ending this job has earned.
 *
 * Weighted by effort rather than chosen at random, so the rhythm of the loop
 * says something: quick jobs get quick endings, and the beats that take time
 * are spent on the jobs that looked like they took effort.
 */
/**
 * What each kind of job is allowed to end with, best first.
 *
 * Random within a band was not enough: with four candidates and a fair coin,
 * the same ending turns up twice running about a quarter of the time, and two
 * identical nods in a row is exactly what makes a system visible.
 */
const BY_EFFORT: { at: number; beats: FinishBeat[] }[] = [
  { at: 0.62, beats: ["brow", "stepBack", "hips", "stow", "nod"] },
  { at: 0.38, beats: ["test", "hips", "stow", "nod", "stepBack"] },
  { at: 0, beats: ["nod", "test", "stow", "hips"] },
];

/**
 * Which ending this job has earned, given the last few.
 *
 * Matched to the job first — heavy work gets the beats that take time, precise
 * work gets the ones that look like checking, quick work gets a glance and a
 * nod — and then filtered against short-term memory so nothing repeats while a
 * valid alternative exists. Never the same beat twice running, and preferably
 * nothing seen in the last three.
 */
export function pickFinish(
  effort: number,
  tool: string | null,
  firstOfVisit: boolean,
  roll: number,
  recent: FinishBeat[] = []
): FinishBeat {
  if (firstOfVisit) return "wave";
  const band = BY_EFFORT.find((b) => effort >= b.at) ?? BY_EFFORT[2];
  const allowed = band.beats.filter((b) => b !== "stow" || tool);

  const unseen = allowed.filter((b) => !recent.includes(b));
  const notLast = allowed.filter((b) => b !== recent[recent.length - 1]);
  const pool = unseen.length ? unseen : notLast.length ? notLast : allowed;
  return pool[Math.floor(roll * pool.length) % pool.length];
}

export type FinishPose = {
  /**
   * Where the working hand goes, in HIS OWN frame rather than the work's.
   *
   * The repair is finished; what his hands do now is about him, not about the
   * thing. Null leaves the arm to the clip.
   */
  work: [number, number, number] | null;
  off: [number, number, number] | null;
  /** How much of the arms to take over. */
  weight: number;
  /** Chest lifting as he straightens up. */
  liftDeg: number;
  /** Nodding, in degrees. Added to wherever he is looking. */
  nodDeg: number;
  /** Stepping back from the work, in his own units. */
  backStep: number;
  /** Is he still looking at the repair, or has he moved on? */
  lookAtWork: number;
  /**
   * How hard he is pressing on the thing, 0 to 1.
   *
   * Only the test beat produces this, and the prop turns it into whatever give
   * means for it. Peaks when his hand is furthest out, which is when it would
   * actually be touching.
   */
  nudge: number;
};

const NOTHING: FinishPose = {
  work: null, off: null, weight: 0, liftDeg: 0,
  nodDeg: 0, backStep: 0, lookAtWork: 1, nudge: 0,
};

const ease = (u: number) => u * u * (3 - 2 * u);
/** In and out over the beat, so nothing starts or ends with a jump. */
const arc = (u: number) => Math.sin(Math.min(1, Math.max(0, u)) * Math.PI);

/**
 * The beat at time `u`, where u runs 0 to 1 across its whole length.
 *
 * Hand positions are in his own frame: negative x is his tool side, y is up
 * from his feet, positive z is in front of him.
 */
export function finishPose(beat: FinishBeat, u: number): FinishPose {
  switch (beat) {
    case "nod": {
      /* Two small dips of the head. Everything else stays where it was. */
      const n = Math.sin(u * Math.PI * 3.6);
      return { ...NOTHING, nodDeg: n * 7 * arc(u * 1.1), liftDeg: 2 * arc(u) };
    }

    case "hips": {
      /* Both hands to the belt, chest open. The pose of a man who is pleased. */
      const a = arc(u);
      return {
        work: [-0.26, 0.93, 0.02],
        off: [0.26, 0.93, 0.02],
        weight: a,
        liftDeg: 5 * a,
        nodDeg: Math.sin(u * Math.PI * 2) * 3 * a,
        backStep: 0,
        lookAtWork: 1,
        nudge: 0,
      };
    }

    case "test": {
      /*
       * Reaches back out and gives it a push, to check it holds.
       *
       * The most legible of them: it says the thing is fixed AND that he does
       * not take his own word for it, which is most of what a tradesman is.
       */
      const reach = u < 0.55 ? ease(u / 0.55) : 1 - ease((u - 0.55) / 0.45);
      return {
        work: [-0.24 - 0.1 * reach, 1.0, 0.18 + 0.2 * reach],
        off: [0.24, 0.88, 0.04],
        weight: 0.35 + 0.65 * arc(u * 1.2),
        liftDeg: 2,
        nodDeg: u > 0.6 ? Math.sin((u - 0.6) * Math.PI * 3) * 5 : 0,
        backStep: 0,
        lookAtWork: 1,
        /* Contact, and the give that follows it. */
        nudge: reach,
      };
    }

    case "stepBack": {
      /* Weight back, arms loose, taking the whole thing in. */
      const a = ease(Math.min(1, u * 1.6));
      /* Asymmetric on purpose: two arms held identically is a mannequin, and
         nobody stands back from their own work in a symmetrical pose. */
      return {
        work: [-0.27, 0.84, 0.05],
        off: [0.2, 0.95, -0.03],
        weight: 0.46 * a,
        liftDeg: 6 * a,
        nodDeg: u > 0.65 ? Math.sin((u - 0.65) * Math.PI * 2.6) * 6 : 0,
        backStep: 0.16 * a,
        lookAtWork: 1,
        nudge: 0,
      };
    }

    case "stow": {
      /* Tool to the belt, a pat, arm drops. */
      const down = ease(Math.min(1, u * 1.4));
      return {
        work: [-0.2, 0.92 - 0.02 * Math.sin(u * Math.PI * 6), 0.1],
        off: null,
        weight: down,
        liftDeg: 3 * down,
        nodDeg: 0,
        backStep: 0,
        lookAtWork: 1 - 0.5 * down,
        nudge: 0,
      };
    }

    /* The two takes drive the whole body themselves; nothing to add. */
    case "brow":
    case "wave":
      return { ...NOTHING, weight: 0, lookAtWork: 0.25 };

    default:
      return NOTHING;
  }
}
