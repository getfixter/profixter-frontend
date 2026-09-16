import * as THREE from "three";

/**
 * What the rest of him does while his arms work.
 *
 * The arms understand the job now. The body did not: it had one tilt and one
 * bob applied to the whole character, which is why eleven repairs still read as
 * one man with four ways of standing. A hammer and a drill are not the same
 * activity from the waist down — one is a wind-up and a stop, the other is a
 * steady lean with your weight behind it — and the difference lives in the
 * pelvis, the spine and the knees.
 *
 * This is an additive layer, applied after the mixer has written the clip and
 * before the arms are solved, because where the shoulder ENDS UP decides what
 * the arm has to do to reach the work. The clip supplies the stance, this
 * supplies the effort, the IK supplies the reach.
 *
 * Knees carry most of the weight in this: a lean without a bend underneath it
 * is a man tipping over, and a bend without a lean is a man about to sit down.
 * They are worth more than any other single number here.
 *
 * The test it has to pass: with the prop and the tool hidden, hammering,
 * drilling, wrenching and careful screwdriver work should still be four
 * recognisably different physical activities.
 */

export type BodyRig = {
  hips: THREE.Object3D;
  spine: THREE.Object3D[];      // lowest to highest
  neck: THREE.Object3D | null;
  shoulderWork: THREE.Object3D | null;
  shoulderOff: THREE.Object3D | null;
  thighs: THREE.Object3D[];
  shins: THREE.Object3D[];
  hipsRest: THREE.Vector3;
};

export function readBodyRig(root: THREE.Object3D): BodyRig | null {
  const find = (name: string) => {
    let hit: THREE.Object3D | null = null;
    root.traverse((n) => {
      if (!hit && n.name === name) hit = n;
    });
    return hit as THREE.Object3D | null;
  };
  const hips = find("Hips");
  if (!hips) return null;
  const spine = ["Spine02", "Spine01", "Spine"]
    .map(find)
    .filter((b): b is THREE.Object3D => !!b);
  if (!spine.length) return null;
  const thighs = ["RightUpLeg", "LeftUpLeg"]
    .map(find)
    .filter((b): b is THREE.Object3D => !!b);
  const shins = ["RightLeg", "LeftLeg"]
    .map(find)
    .filter((b): b is THREE.Object3D => !!b);
  return {
    hips,
    spine,
    neck: find("neck"),
    shoulderWork: find("RightShoulder"),
    shoulderOff: find("LeftShoulder"),
    thighs,
    shins,
    hipsRest: hips.position.clone(),
  };
}

export type BodyPose = {
  /** Forward is positive: leaning into the work. Spread across the spine. */
  leanDeg: number;
  /** Positive turns his chest toward the tool side. */
  twistDeg: number;
  /** Positive tips him toward the tool side. */
  sideDeg: number;
  /** Down is positive: knees taking weight, absorbing a strike. */
  hipsDrop: number;
  /** Positive shifts his weight onto the tool side. */
  hipsShift: number;
  /** Pelvis follows the shoulders, but less. */
  hipsTurnDeg: number;
  /** The working shoulder rising into a reach or a swing. */
  shoulderLiftDeg: number;
  /** Extra bend on top of whatever the clip is doing. */
  kneeDeg: number;
  /** Chin down over close work, up under an overhead one. */
  headPitchDeg: number;
};

const STILL: BodyPose = {
  leanDeg: 0, twistDeg: 0, sideDeg: 0, hipsDrop: 0, hipsShift: 0,
  hipsTurnDeg: 0, shoulderLiftDeg: 0, kneeDeg: 0, headPitchDeg: 0,
};

/** Cycles per second, matching the tool. Kept here so the two cannot drift. */
const HZ: Record<string, number> = {
  tap: 1.75, turn: 0.85, spin: 2.4, ratchet: 0.75, sweep: 0.42, press: 0.7,
};

const ease = (u: number) => u * u * (3 - 2 * u);

export type BodyContext = {
  /** Working above himself: he stretches up rather than leaning in. */
  overhead: boolean;
  /** Down at floor level: the torso has to turn down to the work. */
  crouched: boolean;
  /** How hard this job is, 0 easy to 1 heavy. Scales the whole performance. */
  effort: number;
};

/**
 * The body, for one kind of work, at one moment.
 *
 * Every number is degrees or world units at character scale 1, and all of them
 * are small: this sits on top of a clip that already has its own weight shift,
 * and anything large fights it rather than adding to it.
 */
export function bodyPose(
  action: string,
  t: number,
  ctx: BodyContext
): BodyPose {
  const hz = HZ[action];
  if (!hz) return STILL;
  const p = (t * hz) % 1;
  /*
   * Effort scales the whole performance, and the range is deliberately wide.
   *
   * At a narrow range every job moved him two or three degrees and the
   * difference between a hammer and a screwdriver was something you could
   * measure rather than something you could see. A heavy job now moves half
   * again as much as a light one.
   */
  const e = 0.8 + 0.62 * ctx.effort;

  let pose: BodyPose;

  switch (action) {
    case "tap": {
      /*
       * Anticipation, strike, absorb, recover.
       *
       * The wind-up is the whole tell. Without it a hammer blow is a hand
       * moving down; with it there is a body deciding to hit something, which
       * is the difference between a tap and a swing.
       */
      if (p < 0.5) {
        const u = ease(p / 0.5);
        pose = {
          leanDeg: -8 * u, twistDeg: -13 * u, sideDeg: -3 * u,
          hipsDrop: 0, hipsShift: -0.02 * u, hipsTurnDeg: -4 * u,
          shoulderLiftDeg: 13 * u, kneeDeg: 1 * u, headPitchDeg: 2 * u,
        };
      } else if (p < 0.62) {
        const u = (p - 0.5) / 0.12;
        const s = u * u;
        pose = {
          leanDeg: -8 + 20 * s, twistDeg: -13 + 22 * s, sideDeg: -3 + 7 * s,
          hipsDrop: 0.022 * s, hipsShift: -0.02 + 0.045 * s, hipsTurnDeg: -4 + 7 * s,
          shoulderLiftDeg: 13 - 19 * s, kneeDeg: 2 + 9 * s, headPitchDeg: 2 + 4 * s,
        };
      } else {
        const u = 1 - (p - 0.62) / 0.38;
        pose = {
          leanDeg: 12 * u, twistDeg: 9 * u, sideDeg: 4 * u,
          hipsDrop: 0.022 * u, hipsShift: 0.025 * u, hipsTurnDeg: 3 * u,
          shoulderLiftDeg: -6 * u, kneeDeg: 10 * u, headPitchDeg: 6 * u,
        };
      }
      break;
    }

    case "spin": {
      /* Steady weight behind it, braced, with the tool shaking him a little. */
      const lean = 0.5 + 0.5 * Math.sin(p * Math.PI * 2);
      const buzz = Math.sin(p * Math.PI * 24);
      pose = {
        leanDeg: 8 + 7 * lean + buzz * 0.8,
        twistDeg: 5 + 2 * lean,
        sideDeg: 1.5,
        hipsDrop: 0.012 + buzz * 0.0016,
        hipsShift: 0.03 * lean,
        hipsTurnDeg: 3,
        shoulderLiftDeg: 3 + 2 * lean,
        kneeDeg: 10 + 4 * lean,
        headPitchDeg: 5,
      };
      break;
    }

    case "ratchet": {
      /*
       * Slow haul, fast release. The torso goes with the pull and springs back
       * — which is the opposite rhythm to a screwdriver, and the reason the two
       * read as different jobs from across the room.
       */
      if (p < 0.78) {
        const u = (p / 0.78) ** 1.6;
        pose = {
          leanDeg: 5 + 10 * u, twistDeg: 17 * u, sideDeg: 5 * u,
          hipsDrop: 0.018 * u, hipsShift: 0.035 * u, hipsTurnDeg: 6 * u,
          shoulderLiftDeg: 5 * u, kneeDeg: 7 + 7 * u, headPitchDeg: 4 + 2 * u,
        };
      } else {
        const u = 1 - (p - 0.78) / 0.22;
        const s = u * u;
        pose = {
          leanDeg: 5 + 10 * s, twistDeg: 17 * s, sideDeg: 5 * s,
          hipsDrop: 0.018 * s, hipsShift: 0.035 * s, hipsTurnDeg: 6 * s,
          shoulderLiftDeg: 5 * s, kneeDeg: 7 + 7 * s, headPitchDeg: 4 + 2 * s,
        };
      }
      break;
    }

    case "turn": {
      /* Small, contained, and precise. A wrist job that the body only watches. */
      const press = p < 0.45 ? p / 0.45 : p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38;
      const u = ease(press);
      pose = {
        leanDeg: 3 + 2.5 * u, twistDeg: 4 + 1.5 * u, sideDeg: 1,
        hipsDrop: 0.004 * u, hipsShift: 0.01 * u, hipsTurnDeg: 1.5,
        shoulderLiftDeg: 1.5 + 2 * u, kneeDeg: 1.5, headPitchDeg: 6,
      };
      break;
    }

    case "press": {
      /*
       * All his weight, then it gives. The recovery matters as much as the
       * shove: a body that pushes and never relaxes is a body pushing a wall.
       */
      const u = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
      const s = ease(u);
      pose = {
        leanDeg: 5 + 15 * s, twistDeg: 3 * s, sideDeg: 0.5,
        hipsDrop: 0.02 * s, hipsShift: 0.012 * s, hipsTurnDeg: 1,
        shoulderLiftDeg: 4 * s, kneeDeg: 4 + 13 * s, headPitchDeg: 5 + 2 * s,
      };
      break;
    }

    case "sweep": {
      const u = Math.sin(p * Math.PI * 2);
      pose = {
        leanDeg: 5, twistDeg: u * 7, sideDeg: u * 2.5,
        hipsDrop: 0.006, hipsShift: u * 0.02, hipsTurnDeg: u * 3,
        shoulderLiftDeg: 2, kneeDeg: 2.5, headPitchDeg: 5,
      };
      break;
    }

    default:
      return STILL;
  }

  /*
   * Overhead inverts most of it: you do not lean into something above you, you
   * stretch up under it, and the head goes back rather than down.
   */
  if (ctx.overhead) {
    pose = {
      ...pose,
      leanDeg: -Math.abs(pose.leanDeg) * 0.55 - 3,
      hipsDrop: -Math.abs(pose.hipsDrop) * 0.5 - 0.012,
      kneeDeg: pose.kneeDeg * 0.3,
      shoulderLiftDeg: pose.shoulderLiftDeg + 11,
      headPitchDeg: -10 - Math.abs(pose.headPitchDeg) * 0.4,
    };
  } else if (ctx.crouched) {
    /* Down at the floor he is already folded; the torso only needs to turn to
       face the work, and the knees are the clip's business, not ours. */
    pose = {
      ...pose,
      leanDeg: pose.leanDeg * 0.55,
      kneeDeg: 0,
      hipsDrop: pose.hipsDrop * 0.6,
      twistDeg: pose.twistDeg * 1.25,
      headPitchDeg: pose.headPitchDeg + 5,
    };
  }

  return {
    leanDeg: pose.leanDeg * e,
    twistDeg: pose.twistDeg * e,
    sideDeg: pose.sideDeg * e,
    hipsDrop: pose.hipsDrop * e,
    hipsShift: pose.hipsShift * e,
    hipsTurnDeg: pose.hipsTurnDeg * e,
    shoulderLiftDeg: pose.shoulderLiftDeg * e,
    kneeDeg: pose.kneeDeg * e,
    headPitchDeg: pose.headPitchDeg * e,
  };
}

const DEG = THREE.MathUtils.degToRad;

/**
 * Add the pose to whatever the clip is already doing.
 *
 * Rotations are applied with rotateX/Y/Z, which compose onto the quaternion the
 * mixer just wrote rather than replacing it — so the take keeps its breathing
 * and its weight shift and this rides on top. The lean is spread across three
 * spine joints because one joint bending fifteen degrees is a hinge, and three
 * bending five each is a back.
 */
export function applyBodyPose(
  rig: BodyRig,
  pose: BodyPose,
  scale: number,
  weight: number
) {
  if (weight <= 0.002) return;
  const w = weight;

  /* Pelvis: drop, shift and turn. Translation is in the hips' own units. */
  rig.hips.position.set(
    rig.hipsRest.x + pose.hipsShift * w * -1,
    rig.hipsRest.y - pose.hipsDrop * w,
    rig.hipsRest.z
  );
  rig.hips.rotateY(DEG(-pose.hipsTurnDeg) * w);

  const n = rig.spine.length || 1;
  for (const bone of rig.spine) {
    bone.rotateX(DEG(pose.leanDeg / n) * w);
    bone.rotateY(DEG(-pose.twistDeg / n) * w);
    bone.rotateZ(DEG(pose.sideDeg / n) * w);
  }

  if (rig.shoulderWork) rig.shoulderWork.rotateZ(DEG(-pose.shoulderLiftDeg) * w);
  if (rig.shoulderOff) rig.shoulderOff.rotateZ(DEG(pose.shoulderLiftDeg * 0.25) * w);

  if (pose.kneeDeg !== 0) {
    for (const thigh of rig.thighs) thigh.rotateX(DEG(pose.kneeDeg * 0.45) * w);
    for (const shin of rig.shins) shin.rotateX(DEG(-pose.kneeDeg) * w);
  }

  if (rig.neck) rig.neck.rotateX(DEG(pose.headPitchDeg) * w);
  void scale;
}

/**
 * The parts of a finish beat that are not arms.
 *
 * Straightening up, the nod, and shifting his weight back to take a look. The
 * step back lives on the pelvis rather than on his position so his feet stay
 * planted and only his weight moves, which is what looking at your own work
 * actually looks like.
 */
export function applyFinishPose(
  rig: BodyRig,
  liftDeg: number,
  nodDeg: number,
  backStep: number
) {
  rig.hips.position.z = rig.hipsRest.z - backStep * 0.5;
  const n = rig.spine.length || 1;
  for (const bone of rig.spine) bone.rotateX(DEG(-liftDeg / n));
  if (rig.neck) rig.neck.rotateX(DEG(nodDeg));
}
