/**
 * What the tool actually does, as opposed to where it points.
 *
 * The body clips are the weak link and there is no fixing that from a text
 * prompt: fourteen Text-to-Motion takes of "turns a wrench" and "drills into a
 * wall" came back as a man gesturing near his own face. What they do supply is
 * a believable working *posture*, and that turns out to be the easier half.
 *
 * The half that reads is the tool. It sits at the repair, it is the thing the
 * eye tracks, and unlike a retargeted skeleton it is ours to drive frame by
 * frame. A hammer that visibly winds up and strikes, a drill that spins and
 * pushes, a wrench that ratchets and slips back — those are different ACTIONS
 * even when the arm holding them is doing much the same thing, and they are
 * what makes electrical feel different from plumbing.
 *
 * Everything here is a pure function of elapsed working time, so the tool, the
 * particles and the prop can all agree on the beat without sharing state.
 */

export type ToolAction =
  | "tap"      // hammer: wind up, strike, stop dead
  | "turn"     // screwdriver: quarter turns with a pause between
  | "spin"     // drill: continuous, with a push into the work
  | "ratchet"  // wrench: haul round, slip back, haul again
  | "sweep"    // caulk/wipe: a long smooth pass
  | "press"    // bare hands: push, ease off, push
  | "none";

/** Cycles per second. This is most of what makes an action feel like itself. */
const HZ: Record<ToolAction, number> = {
  tap: 1.75,
  turn: 0.85,
  spin: 2.4,
  ratchet: 0.75,
  sweep: 0.42,
  press: 0.7,
  none: 0,
};

/** Which repetition we are in. Changes on the beat, so effects can fire on it. */
export function actionCycle(action: ToolAction, t: number): number {
  return HZ[action] ? Math.floor(t * HZ[action]) : 0;
}

/** How far through the current repetition, 0 to 1. */
export function actionPhase(action: ToolAction, t: number): number {
  return HZ[action] ? (t * HZ[action]) % 1 : 0;
}

/**
 * Is this the instant of contact?
 *
 * Used for the things that should happen ON the strike rather than near it —
 * a spark, a knock, the prop flinching — so they land together instead of each
 * drifting on its own timer.
 */
export function actionHit(action: ToolAction, phase: number): boolean {
  if (action === "tap") return phase > 0.52 && phase < 0.62;
  if (action === "ratchet") return phase > 0.74 && phase < 0.84;
  if (action === "press") return phase > 0.4 && phase < 0.5;
  if (action === "spin") return true;
  return false;
}

export type ToolPose = {
  /** Swing, about the axis across the tool — a hammer's arc. */
  swingDeg: number;
  /** Roll about the tool's own length — a screwdriver or a drill bit. */
  rollDeg: number;
  /** Along the tool: positive pushes the tip into the work. */
  push: number;
  /** Across the tool: a sideways pass. */
  slide: number;
};

const REST: ToolPose = { swingDeg: 0, rollDeg: 0, push: 0, slide: 0 };

/**
 * The tool's own movement, in its own frame, at this moment.
 *
 * Deliberately not sinusoidal where it matters. A hammer that eases in and out
 * of its swing looks like it is underwater; the whole read of a hammer is a
 * slow lift and a fast stop, so the curve is shaped rather than sampled.
 */
export function actionPose(action: ToolAction, t: number): ToolPose {
  if (action === "none" || !HZ[action]) return REST;
  const p = actionPhase(action, t);

  switch (action) {
    case "tap": {
      /* 0 - 0.55 lift and hold, 0.55 - 0.65 strike, then recover. */
      if (p < 0.5) {
        const u = p / 0.5;
        return { swingDeg: -34 * (u * u * (3 - 2 * u)), rollDeg: 0, push: 0, slide: 0 };
      }
      if (p < 0.62) {
        const u = (p - 0.5) / 0.12;
        return { swingDeg: -34 + 46 * u * u, rollDeg: 0, push: 0.012 * u, slide: 0 };
      }
      const u = (p - 0.62) / 0.38;
      return { swingDeg: 12 * (1 - u), rollDeg: 0, push: 0.012 * (1 - u), slide: 0 };
    }
    case "turn": {
      /* Quarter turn, pause, reposition, quarter turn. */
      if (p < 0.45) {
        const u = p / 0.45;
        return { swingDeg: 0, rollDeg: 95 * u * u * (3 - 2 * u), push: 0.006, slide: 0 };
      }
      if (p < 0.62) return { swingDeg: 0, rollDeg: 95, push: 0.006, slide: 0 };
      const u = (p - 0.62) / 0.38;
      return { swingDeg: 0, rollDeg: 95 * (1 - u), push: 0.002, slide: 0 };
    }
    case "spin": {
      /* Always turning; leans into the work twice a cycle. */
      const push = 0.014 * Math.max(0, Math.sin(p * Math.PI * 2));
      return { swingDeg: Math.sin(p * Math.PI * 4) * 1.5, rollDeg: (t * 900) % 360, push, slide: 0 };
    }
    case "ratchet": {
      if (p < 0.78) {
        const u = p / 0.78;
        return { swingDeg: 0, rollDeg: 42 * u * u, push: 0.004, slide: 0 };
      }
      const u = (p - 0.78) / 0.22;
      return { swingDeg: 0, rollDeg: 42 * (1 - u) * (1 - u), push: 0, slide: 0 };
    }
    case "sweep": {
      const u = Math.sin(p * Math.PI * 2);
      return { swingDeg: u * 4, rollDeg: 0, push: 0.005, slide: u * 0.075 };
    }
    case "press": {
      const u = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
      const e = u * u * (3 - 2 * u);
      return { swingDeg: 0, rollDeg: 0, push: 0.02 * e, slide: 0 };
    }
    default:
      return REST;
  }
}

export type BodyAccent = {
  /** Down the screen: a dip into a strike. */
  bob: number;
  /** Roll about the camera axis: a twist into a haul. */
  rollDeg: number;
  /** Toward the work: leaning weight onto a drill. */
  leanDeg: number;
};

const STILL: BodyAccent = { bob: 0, rollDeg: 0, leanDeg: 0 };

/**
 * What the rest of him does while the tool works.
 *
 * A thirty-five pixel hammer swinging thirty degrees is real motion and still
 * almost invisible on a page; the same swing with a shoulder behind it reads
 * from across the room. This is the difference between a tool moving near a
 * character and a character using a tool, and it is worth far more than the
 * amplitude of the tool itself.
 *
 * Small on purpose. These are added on top of a retargeted clip that already
 * has its own weight shift, and anything bigger fights it.
 */
export function bodyAccent(action: ToolAction, t: number, scale: number): BodyAccent {
  if (action === "none" || !HZ[action]) return STILL;
  const p = actionPhase(action, t);
  switch (action) {
    case "tap": {
      /* Rises with the windup, drops sharply on the strike. */
      if (p < 0.5) { const u = p / 0.5; return { bob: 0.012 * scale * u, rollDeg: -1.6 * u, leanDeg: -1.2 * u }; }
      if (p < 0.62) { const u = (p - 0.5) / 0.12; return { bob: 0.012 * scale * (1 - u) - 0.016 * scale * u, rollDeg: -1.6 + 3.4 * u, leanDeg: -1.2 + 3.6 * u }; }
      const u = (p - 0.62) / 0.38;
      return { bob: -0.016 * scale * (1 - u), rollDeg: 1.8 * (1 - u), leanDeg: 2.4 * (1 - u) };
    }
    case "ratchet": {
      if (p < 0.78) { const u = p / 0.78; return { bob: 0, rollDeg: -3.4 * u * u, leanDeg: 2.2 * u }; }
      const u = (p - 0.78) / 0.22;
      return { bob: 0, rollDeg: -3.4 * (1 - u) * (1 - u), leanDeg: 2.2 * (1 - u) };
    }
    case "spin": {
      const lean = 0.5 + 0.5 * Math.sin(p * Math.PI * 2);
      return { bob: -0.004 * scale * lean, rollDeg: 0, leanDeg: 2.6 * lean };
    }
    case "turn": {
      const u = p < 0.45 ? p / 0.45 : 0;
      return { bob: 0, rollDeg: -1.8 * u, leanDeg: 1.1 * u };
    }
    case "press": {
      const u = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
      const e = u * u * (3 - 2 * u);
      return { bob: 0, rollDeg: 0, leanDeg: 4.2 * e };
    }
    case "sweep": {
      const u = Math.sin(p * Math.PI * 2);
      return { bob: 0, rollDeg: u * 2.2, leanDeg: 1.4 };
    }
    default:
      return STILL;
  }
}

/* ------------------------------------------------------------ hand plans */

export type HandPlan = {
  /**
   * Toward the work, in the screen plane. Positive presses in.
   *
   * Not a z offset. The camera is very nearly head on, so depth projects to
   * almost nothing: a drill pushed a tenth of a unit INTO the wall moves about
   * one pixel and reads as a man holding a drill perfectly still. Everything
   * that is supposed to be seen has to happen across the screen, so the plan is
   * expressed along the tool's own approach and turned into x and y by the
   * caller, who knows which way the tool is pointing.
   */
  push: number;
  /** Across the approach, in the screen plane: a hammer's lift, a wrench's arc. */
  lift: number;
  /** Actual depth. Small, and only ever for keeping hands off the body. */
  depth: number;
  /**
   * Off hand, as an offset from the WORK POINT. Every action names one.
   *
   * Positive x is his LEFT, which is the side the off hand lives on. Signing
   * these the other way had the left arm reaching across his own chest to the
   * tool, which looks like a man hugging himself.
   */
  off: [number, number, number];
  /** How far the working elbow swings away from the body, 0 to 1. */
  elbow: number;
  /** How much of the off arm to take over: two-handed work wants all of it. */
  offWeight: number;
};

const REST_PLAN: HandPlan = {
  push: 0,
  lift: 0,
  depth: 0,
  off: [0.3, -0.45, 0.04],
  elbow: 0.5,
  offWeight: 0,
};

/**
 * Where the hands go, through the cycle, for each kind of work.
 *
 * This is the half the clips could not supply. A retargeted take gives a decent
 * stance and then does whatever it was doing with its arms — which for the
 * chest-height one is clasping them in front of the drill. Driving the hands
 * instead means the arm carries the verb: the hammer winds up through the
 * shoulder, the drill is genuinely held in two hands, the wrench hauls round
 * and resets on a rhythm nothing like the screwdriver's.
 *
 * Amplitudes are in world units at character scale 1. They have to be big
 * enough to SEE — the character is drawn about two hundred pixels tall, so a
 * hand that travels three hundredths of a unit travels three pixels — and
 * small enough that the arm, which is only 0.39 long, can still get there.
 */
export function handPlan(
  action: ToolAction,
  t: number,
  overhead = false
): HandPlan {
  if (action === "none" || !HZ[action]) return REST_PLAN;
  const p = actionPhase(action, t);
  const plan = planFor(action, p);
  if (!overhead) return plan;
  /*
   * Overhead is the one case where helping with the other hand is wrong.
   *
   * Both hands at a ceiling fixture puts them in front of his own face, which
   * is the exact posture this whole exercise started out trying to kill. A
   * person reaching up steadies themselves with the other arm out and down, so
   * that is where it goes — and it reads as effort rather than as hiding.
   */
  return {
    ...plan,
    off: [0.42, -0.9, -0.04],
    /*
     * Committed, not blended. At half weight the arm sits between where the
     * clip put it (up, by his face) and where it belongs (down), which is the
     * worst of both and still reads as hiding.
     */
    offWeight: 0.88,
    elbow: plan.elbow * 0.6,
  };
}

function planFor(action: ToolAction, p: number): HandPlan {
  switch (action) {
    case "tap": {
      /*
       * A hammer is a lift and a stop. The hand travels most of the distance,
       * because an arm that stays still while a hammer rotates in the wrist is
       * a man tapping a nail with a spoon.
       */
      const off: [number, number, number] = [0.27, -0.1, 0.06];
      if (p < 0.5) {
        const u = p / 0.5;
        const e = u * u * (3 - 2 * u);
        return { push: -0.15 * e, lift: 0.13 * e, depth: 0.02 * e, off, elbow: 0.75 - 0.3 * e, offWeight: 0.5 };
      }
      if (p < 0.62) {
        const u = (p - 0.5) / 0.12;
        const e = u * u;
        return { push: -0.15 + 0.2 * e, lift: 0.13 - 0.17 * e, depth: 0.02 - 0.02 * e, off, elbow: 0.45 + 0.3 * e, offWeight: 0.5 };
      }
      const u = 1 - (p - 0.62) / 0.38;
      return { push: 0.05 * u, lift: -0.04 * u, depth: 0, off, elbow: 0.75 - 0.1 * u, offWeight: 0.5 };
    }

    case "spin": {
      /* Two hands, leaning the drill in and easing off, with a real buzz. */
      const lean = 0.5 + 0.5 * Math.sin(p * Math.PI * 2);
      const buzz = Math.sin(p * Math.PI * 24) * 0.011;
      return {
        push: 0.13 * lean,
        lift: buzz,
        depth: 0.01,
        off: [0.24, -0.08, 0.1],
        elbow: 0.55,
        offWeight: 0.95,
      };
    }

    case "ratchet": {
      /*
       * A wrench swings the hand round the work and snaps back fast. That arc,
       * and the suddenness of the reset, is the whole difference from a
       * screwdriver — which turns on the spot and never travels.
       */
      const swing = p < 0.78 ? (p / 0.78) ** 2 : (1 - (p - 0.78) / 0.22) ** 2;
      return {
        push: 0.02 + 0.04 * swing,
        lift: -0.11 + 0.26 * swing,
        depth: 0.01,
        off: [0.26, -0.12, 0.08],
        elbow: 0.85 - swing * 0.25,
        offWeight: 0.7,
      };
    }

    case "turn": {
      /*
       * Small and close in: a screwdriver is wrist work. The tool supplies the
       * roll, the hand supplies a press and a slight rock, which together read
       * as effort without the arm wandering.
       */
      const press = p < 0.45 ? p / 0.45 : p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38;
      const e = press * press * (3 - 2 * press);
      return {
        push: 0.075 * e,
        lift: Math.sin(p * Math.PI * 2) * 0.045,
        depth: 0.01,
        off: [0.28, -0.13, 0.07],
        elbow: 0.6,
        offWeight: 0.6,
      };
    }

    case "press": {
      /* Both palms on the thing, seating it: one long shove, then a check. */
      const u = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
      const e = u * u * (3 - 2 * u);
      return {
        push: 0.17 * e,
        lift: 0.02,
        depth: 0.01,
        off: [0.25, 0.0, 0.02],
        elbow: 0.7,
        offWeight: 0.95,
      };
    }

    case "sweep": {
      const u = Math.sin(p * Math.PI * 2);
      return {
        push: 0.04,
        lift: u * 0.19,
        depth: 0.01,
        off: [0.29, -0.14, 0.06],
        elbow: 0.6,
        offWeight: 0.5,
      };
    }

    default:
      return REST_PLAN;
  }
}
