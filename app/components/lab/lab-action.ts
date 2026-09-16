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
