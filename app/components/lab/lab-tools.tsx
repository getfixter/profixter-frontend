"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { M } from "./lab-materials";

/**
 * Hand tools.
 *
 * All three are modelled along local +Y, because that is the right hand bone's
 * own axis (wrist to fingertips). Matching the model's axis to the bone's is
 * what keeps the per-motion tuning down to one small rotation instead of a
 * quaternion nobody can reason about, and it means a new tool drops in without
 * re-deriving anything.
 *
 * Origin sits at the butt of the grip, so the attachment offset positions the
 * hand's grip rather than the middle of the object.
 *
 * Deliberately chunky. The Fixter is stylised and small on screen; a
 * scale-accurate tool is a few pixels of grey and reads as nothing.
 */

export type ToolKind = "screwdriver" | "wrench" | "drill";

function Screwdriver() {
  return (
    <group>
      <mesh material={M.toolGrip} position={[0, 0.038, 0]}>
        <capsuleGeometry args={[0.016, 0.055, 4, 10]} />
      </mesh>
      <mesh material={M.hardware} position={[0, 0.076, 0]}>
        <cylinderGeometry args={[0.009, 0.011, 0.014, 10]} />
      </mesh>
      <mesh material={M.metal} position={[0, 0.118, 0]}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.07, 10]} />
      </mesh>
      <mesh material={M.metal} position={[0, 0.157, 0]}>
        <boxGeometry args={[0.009, 0.012, 0.0022]} />
      </mesh>
    </group>
  );
}

function Wrench() {
  return (
    <group>
      {/* grip */}
      <mesh material={M.toolGrip} position={[0, 0.04, 0]}>
        <capsuleGeometry args={[0.014, 0.06, 4, 10]} />
      </mesh>
      {/* shaft */}
      <mesh material={M.metal} position={[0, 0.098, 0]}>
        <boxGeometry args={[0.016, 0.06, 0.009]} />
      </mesh>
      {/* fixed jaw + sliding jaw, offset so it reads as adjustable */}
      <mesh material={M.metal} position={[0, 0.138, 0]}>
        <boxGeometry args={[0.052, 0.022, 0.011]} />
      </mesh>
      <mesh material={M.metal} position={[0.018, 0.162, 0]}>
        <boxGeometry args={[0.016, 0.03, 0.011]} />
      </mesh>
      <mesh material={M.metal} position={[-0.018, 0.155, 0]}>
        <boxGeometry args={[0.016, 0.016, 0.011]} />
      </mesh>
    </group>
  );
}

function Drill() {
  /*
   * Rotated so the BIT runs along +Y like every other tool's working end.
   * A drill is the one tool whose business end is perpendicular to its grip,
   * and rather than teach the attachment code about per-tool axes, the model
   * is turned to match the convention: bit forward along +Y, grip trailing back
   * toward the wrist, which is also how it is actually held against a wall.
   */
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* the body sits forward of the grip, like a real pistol-grip drill */}
      <mesh material={M.accent} position={[0, 0.035, 0]}>
        <boxGeometry args={[0.036, 0.075, 0.042]} />
      </mesh>
      <mesh material={M.dark} position={[0, 0.062, 0.028]}>
        <boxGeometry args={[0.02, 0.022, 0.012]} />
      </mesh>
      <mesh material={M.accent} position={[0, 0.095, 0.012]}>
        <boxGeometry args={[0.044, 0.055, 0.075]} />
      </mesh>
      {/* chuck and bit */}
      <mesh material={M.hardware} position={[0, 0.095, 0.062]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.021, 0.028, 12]} />
      </mesh>
      <mesh material={M.metal} position={[0, 0.095, 0.105]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.06, 8]} />
      </mesh>
      {/* battery */}
      <mesh material={M.dark} position={[0, -0.004, -0.004]}>
        <boxGeometry args={[0.042, 0.024, 0.05]} />
      </mesh>
    </group>
  );
}

const TOOLS: Record<ToolKind, () => React.JSX.Element> = {
  screwdriver: Screwdriver,
  wrench: Wrench,
  drill: Drill,
};

export default function HandTool({
  kind,
  scale = 1,
}: {
  kind: ToolKind;
  scale?: number;
}) {
  const Tool = TOOLS[kind];
  if (!Tool) return null;
  return (
    <group scale={scale}>
      <Tool />
    </group>
  );
}

/** Rough length from the grip origin to the working tip, before scaling. */
export const TOOL_REACH: Record<ToolKind, number> = {
  screwdriver: 0.163,
  wrench: 0.17,
  drill: 0.135,
};

/** Every tool's working end runs along +Y; see the note in Drill. */
export const TOOL_AXIS = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------- aiming the tool */

const _handQ = new THREE.Quaternion();
const _gripW = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _aim = new THREE.Quaternion();
const _swing = new THREE.Quaternion();

/**
 * How far the tool may swing away from the posture's own aim.
 *
 * A wrist has limits, and without one of these a target that drifts behind the
 * hand would spin the screwdriver right round. Eighty degrees is generous
 * enough never to bind during normal work and tight enough that a bad frame
 * cannot produce a pose no arm could hold.
 */
const MAX_SWING = THREE.MathUtils.degToRad(80);

/** Slerp rate. Slow enough to never read as snapping, fast enough to keep up. */
const TRACK_RATE = 7;

/**
 * A tool held in the hand that keeps pointing at what he is working on.
 *
 * The fixed per-posture aim it replaces was an average, and an average is
 * exactly wrong for an overhead motion: the hand travels a long way through the
 * work window, so a rotation that looked right in the middle had the
 * screwdriver beside his ear at both ends. This asks the only question that
 * actually matters each frame — where is the tip relative to the thing — and
 * answers it in the hand's own space, so the tool stays gripped while the point
 * follows the job.
 *
 * Damped, clamped, and seeded from the posture's aim on the first frame, so it
 * eases in rather than snapping to attention the moment he arrives.
 */
export function AimedHandTool({
  kind,
  scale = 1,
  position,
  restRotationDeg,
  getTarget,
  tracking,
}: {
  kind: ToolKind;
  scale?: number;
  position: [number, number, number];
  restRotationDeg: [number, number, number];
  /** Where the tip should point, in world space. Null to hold the rest aim. */
  getTarget: () => THREE.Vector3 | null;
  tracking: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const seeded = useRef(false);

  const rest = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(restRotationDeg[0]),
          THREE.MathUtils.degToRad(restRotationDeg[1]),
          THREE.MathUtils.degToRad(restRotationDeg[2])
        )
      ),
    [restRotationDeg]
  );

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;

    let wanted = rest;
    const target = tracking ? getTarget() : null;

    if (target && group.parent) {
      group.parent.getWorldQuaternion(_handQ);
      group.getWorldPosition(_gripW);
      _dir.copy(target).sub(_gripW);

      if (_dir.lengthSq() > 1e-8) {
        /* The direction the tip must take, expressed in the hand's own frame. */
        _dir.normalize().applyQuaternion(_handQ.invert());
        _aim.setFromUnitVectors(TOOL_AXIS, _dir);

        const swing = _aim.angleTo(rest);
        if (swing > MAX_SWING) {
          _swing.copy(rest).slerp(_aim, MAX_SWING / swing);
          wanted = _swing;
        } else {
          wanted = _aim;
        }
      }
    }

    if (!seeded.current) {
      group.quaternion.copy(rest);
      seeded.current = true;
    }
    group.quaternion.slerp(
      wanted,
      1 - Math.exp(-TRACK_RATE * Math.min(delta, 0.1))
    );
  });

  const Tool = TOOLS[kind];
  if (!Tool) return null;
  return (
    <group ref={ref} position={position}>
      <group scale={scale}>
        <Tool />
      </group>
    </group>
  );
}
