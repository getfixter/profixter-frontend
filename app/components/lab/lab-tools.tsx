"use client";

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
