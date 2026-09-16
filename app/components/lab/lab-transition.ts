/**
 * HOW he gets from the repair he has just finished into the next one.
 *
 * The scheduler decides WHAT comes next; this decides the shape of the journey,
 * and until now there was only one shape. Every job in the loop ran the same
 * seven beats — rest, notice, travel, approach, turn, work, admire — and while
 * the last pass made the beats different LENGTHS, the bar underneath was
 * identical thirteen times out of thirteen. Varying the tempo of a fixed
 * sequence does not hide the sequence.
 *
 * The fix is not eight canned routines, which would just be a longer pattern to
 * learn. It is that each beat is optional, and the combination is chosen for
 * the situation: how far away the next repair is, how hard it is, how hard the
 * last one was, and what shapes he has used recently.
 *
 * REST is gone from all of this. It survives in the phase machine only as the
 * answer to "there is nowhere to put the next repair yet", which is a real
 * condition and not a beat. A visitor should never see him waiting for a cycle.
 */

/** How he enters the next job. */
export type Entry =
  /** Stop, look at it, then set off. The old universal behaviour. */
  | "notice"
  /** Straight into the walk. He already knows where he is going. */
  | "straight"
  /** It is right here — no walk at all, just turn into it. */
  | "pivot";

export type TransitionPlan = {
  /** For memory and diagnostics. Not used to drive anything. */
  shape: string;
  /**
   * Multiplier on the ending beat. 0 skips it entirely and he leaves straight
   * off the back of the repair, which is what a man with another job waiting
   * actually does.
   */
  admire: number;
  entry: Entry;
  /**
   * Where along the walk his attention arrives, as a fraction of the path, or
   * null if he set off already knowing.
   *
   * This is the discovery-in-motion case: he is already walking when his head
   * comes round, and the path bends to the real target a moment later. It is
   * the strongest of these shapes because nothing else in the loop starts a
   * job while another movement is already underway.
   */
  discoverAt: number | null;
  /** Seconds of looking it over on arrival before he starts. 0 to skip. */
  inspect: number;
};

/**
 * Closer than this and walking there is silly; he just turns into it.
 *
 * Tightened after measuring. At two thirds of his height, two transitions in
 * five became pivots — which is not wrong in itself, but the free area on a
 * real page is narrow enough that it kept him clustered in one band of the
 * screen and he stopped covering any ground. A pivot should be for the repair
 * that is genuinely at his elbow, not merely nearby.
 */
export const PIVOT_RANGE = 0.72;

export type TransitionContext = {
  /** World distance from where he is standing to where the next job wants him. */
  distance: number;
  /** Effort of the job just finished, 0..1. */
  cameFrom: number;
  /** Effort of the job he is going to, 0..1. */
  goingTo: number;
  /** Shapes used recently, most recent last. */
  recent: string[];
  /** Caller's randomness, so a run can be replayed. */
  roll: () => number;
};

type Candidate = TransitionPlan & { weight: number };

/**
 * Build the plausible shapes for this situation, then pick between them.
 *
 * Every candidate here is a shape that would look right; the weights say how
 * OFTEN each should come up, not whether it is allowed. The memory filter then
 * pushes against whatever he has just done, which is the same trick the
 * scheduler and the finish beats use and for the same reason.
 */
export function planTransition(ctx: TransitionContext): TransitionPlan {
  const { distance, cameFrom, goingTo, roll } = ctx;
  const candidates: Candidate[] = [];

  if (distance <= PIVOT_RANGE) {
    /*
     * It is within arm's reach of where he already stands. Walking two steps
     * with a full notice beat in front of it is the single most artificial
     * thing the old machine did — it ran all seven phases with the travel
     * lasting a fifth of a second.
     */
    candidates.push({
      shape: "pivot",
      admire: cameFrom > 0.6 ? 0.55 : 0,
      entry: "pivot",
      discoverAt: null,
      inspect: 0,
      weight: 6,
    });
    candidates.push({
      shape: "pivot-look",
      admire: 0.5,
      entry: "pivot",
      discoverAt: null,
      inspect: 0.45,
      weight: 2,
    });
  } else {
    /* The classic: finish, look up, see it, go. Still the most readable, so it
       keeps the largest share — it is the baseline, not the enemy. */
    candidates.push({
      shape: "notice-walk",
      admire: 1,
      entry: "notice",
      discoverAt: null,
      inspect: 0,
      weight: 5,
    });
    /* Straight off the back of the repair with no ending beat at all. Reads as
       a man who already knew what he was doing next. */
    candidates.push({
      shape: "straight-off",
      admire: 0,
      entry: "straight",
      discoverAt: null,
      inspect: 0,
      weight: 4,
    });
    /* Already walking when his attention lands on it. */
    candidates.push({
      shape: "discover-moving",
      admire: cameFrom > 0.55 ? 0.6 : 0,
      entry: "straight",
      discoverAt: 0.26 + roll() * 0.24,
      inspect: 0,
      /* Weighted up on purpose: this is the only shape where a job begins
         while another movement is already under way, and it is the one that
         does most to stop the loop reading as a sequence of set pieces. */
      weight: 8,
    });
    /* A look at the finished work, then away without a separate notice. */
    candidates.push({
      shape: "glance-go",
      admire: 0.6,
      entry: "straight",
      discoverAt: null,
      inspect: 0,
      weight: 4,
    });
    /* Worth a proper look before starting, which suits the fiddly ones. */
    if (goingTo >= 0.45) {
      candidates.push({
        shape: "notice-inspect",
        admire: 0.7,
        entry: "notice",
        discoverAt: null,
        inspect: 0.5 + roll() * 0.35,
        weight: 3,
      });
    }
    /* After something heavy he takes the moment, then goes without ceremony. */
    if (cameFrom >= 0.6) {
      candidates.push({
        shape: "recover-go",
        admire: 1.15,
        entry: "straight",
        discoverAt: null,
        inspect: 0,
        weight: 3,
      });
    }
  }

  /* Push against what he has just done, without ever emptying the pool. */
  const last = ctx.recent[ctx.recent.length - 1];
  const weighted = candidates.map((candidate) => {
    let weight = candidate.weight;
    if (candidate.shape === last) weight *= 0.12;
    else if (ctx.recent.slice(-3).includes(candidate.shape)) weight *= 0.5;
    return { ...candidate, weight };
  });

  const total = weighted.reduce((sum, c) => sum + c.weight, 0);
  let pick = roll() * total;
  for (const candidate of weighted) {
    pick -= candidate.weight;
    if (pick <= 0) return candidate;
  }
  return weighted[weighted.length - 1];
}

/** The shape the opening always uses: unambiguous, and never chosen at random. */
export const OPENING_PLAN: TransitionPlan = {
  shape: "opening",
  admire: 1,
  entry: "notice",
  discoverAt: null,
  inspect: 0,
};
