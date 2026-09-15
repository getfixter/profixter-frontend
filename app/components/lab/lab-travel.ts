import * as THREE from "three";

/**
 * The movement state machine.
 *
 * Prototype #1 only ever walks A -> B, but the shape here is the one the real
 * site needs: a *list* of anchors stepped through as
 *
 *   TRAVEL -> APPROACH -> WORK -> COMPLETE -> TRAVEL -> ...
 *
 * so replacing "B" with a queue of repair tasks is a matter of passing more
 * anchors, not rewriting the runner. WORK is deliberately present and
 * deliberately inert: the GLB has no repair clips yet, so an anchor with no
 * workClip falls straight through to COMPLETE. When those clips exist, the only
 * change here is that WORK holds for workSeconds instead of passing through.
 *
 * This module is pure: it mutates the runtime object it is handed and returns
 * nothing else. No React, no scene graph, so the logic can be reasoned about
 * (and later tested) without a renderer.
 */

export type TravelPhase = "IDLE" | "TRAVEL" | "APPROACH" | "WORK" | "COMPLETE";

export type TaskAnchor = {
  id: string;
  position: [number, number, number];
  /** Reserved for the repair system. No work clips exist in the GLB yet. */
  workClip?: string | null;
  /** Reserved: how long WORK holds before COMPLETE. */
  workSeconds?: number;
};

export type TravelRuntime = {
  phase: TravelPhase;
  anchorIndex: number;
  phaseElapsed: number;
  position: THREE.Vector3;
  yaw: number;
  /** Set once the last anchor is done, so the caller can settle into rest. */
  finished: boolean;
};

export type TravelOptions = {
  speed: number;
  /**
   * Whether the app owns the character's position.
   *
   * False only in the root-motion diagnostic, where the clip moves the body by
   * itself. With nothing translating the group, distance to the anchor never
   * falls, so that mode has no arrival and the runner holds in TRAVEL until the
   * user stops it. That is the honest behaviour, not a bug.
   */
  translateInCode: boolean;
  loop: boolean;
};

/** Distance at which TRAVEL hands over to APPROACH. */
export const APPROACH_RADIUS = 0.6;
/** APPROACH eases down to this fraction of travel speed before arriving. */
export const APPROACH_SPEED_FACTOR = 0.45;
/** Close enough to call it an arrival and snap. */
export const ARRIVE_EPSILON = 0.02;

export function createTravelRuntime(
  start: [number, number, number]
): TravelRuntime {
  return {
    phase: "IDLE",
    anchorIndex: 0,
    phaseElapsed: 0,
    position: new THREE.Vector3(...start),
    yaw: 0,
    finished: false,
  };
}

function setPhase(runtime: TravelRuntime, phase: TravelPhase) {
  runtime.phase = phase;
  runtime.phaseElapsed = 0;
}

/** True while the character should be playing a locomotion clip. */
export function isMoving(phase: TravelPhase) {
  return phase === "TRAVEL" || phase === "APPROACH";
}

const _direction = new THREE.Vector3();

/**
 * Advance one frame. `dt` is seconds.
 */
export function stepTravel(
  runtime: TravelRuntime,
  anchors: TaskAnchor[],
  options: TravelOptions,
  dt: number
) {
  if (runtime.phase === "IDLE") return;

  runtime.phaseElapsed += dt;
  const anchor = anchors[runtime.anchorIndex];

  if (!anchor) {
    runtime.finished = true;
    setPhase(runtime, "IDLE");
    return;
  }

  switch (runtime.phase) {
    case "TRAVEL":
    case "APPROACH": {
      _direction
        .set(anchor.position[0], anchor.position[1], anchor.position[2])
        .sub(runtime.position);
      const distance = _direction.length();

      // Face the way he is going. Forward is +Z for this rig, confirmed from
      // the baked root motion in walking_2, so atan2(x, z) is the yaw that
      // points the model's front down the travel vector.
      if (distance > 1e-4) {
        runtime.yaw = Math.atan2(_direction.x, _direction.z);
      }

      if (!options.translateInCode) {
        // Root-motion diagnostic: the clip is doing the moving. Nothing to
        // integrate, and no arrival to detect.
        return;
      }

      const speed =
        runtime.phase === "APPROACH"
          ? options.speed * APPROACH_SPEED_FACTOR
          : options.speed;
      const stepLength = speed * dt;

      if (distance <= Math.max(stepLength, ARRIVE_EPSILON)) {
        runtime.position.set(
          anchor.position[0],
          anchor.position[1],
          anchor.position[2]
        );
        setPhase(runtime, "WORK");
        return;
      }

      runtime.position.addScaledVector(_direction.divideScalar(distance), stepLength);

      if (runtime.phase === "TRAVEL" && distance - stepLength <= APPROACH_RADIUS) {
        setPhase(runtime, "APPROACH");
      }
      return;
    }

    case "WORK": {
      // No repair clips exist yet, so every anchor passes straight through.
      const holdFor = anchor.workClip ? (anchor.workSeconds ?? 2) : 0;
      if (runtime.phaseElapsed >= holdFor) setPhase(runtime, "COMPLETE");
      return;
    }

    case "COMPLETE": {
      const nextIndex = runtime.anchorIndex + 1;

      if (nextIndex < anchors.length) {
        runtime.anchorIndex = nextIndex;
        setPhase(runtime, "TRAVEL");
        return;
      }

      if (options.loop && anchors.length > 0) {
        runtime.anchorIndex = 0;
        setPhase(runtime, "TRAVEL");
        return;
      }

      runtime.finished = true;
      setPhase(runtime, "IDLE");
      return;
    }
  }
}
