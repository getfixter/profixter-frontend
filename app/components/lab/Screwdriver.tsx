"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * A prototype screwdriver, modelled along local +Y.
 *
 * +Y because that is the right hand bone's own axis (wrist to fingertips), so
 * attaching it to the bone with a small offset into the palm puts the shaft
 * roughly along the forearm — which is how a screwdriver is actually held when
 * driving something in front of you. Getting the model's axis to agree with the
 * bone's axis is what keeps the tuning offsets small and legible.
 *
 * Origin sits at the butt of the handle, so a position offset moves the grip,
 * not the middle of the tool.
 */
export default function Screwdriver({ scale = 1 }: { scale?: number }) {
  const materials = useMemo(
    () => ({
      handle: new THREE.MeshStandardMaterial({
        color: "#c8362f",
        roughness: 0.45,
        metalness: 0.05,
      }),
      collar: new THREE.MeshStandardMaterial({
        color: "#3a4150",
        roughness: 0.5,
        metalness: 0.3,
      }),
      shaft: new THREE.MeshStandardMaterial({
        color: "#b9c0cb",
        roughness: 0.25,
        metalness: 0.85,
      }),
    }),
    []
  );

  return (
    <group scale={scale}>
      <mesh material={materials.handle} position={[0, 0.038, 0]}>
        <capsuleGeometry args={[0.016, 0.055, 4, 12]} />
      </mesh>
      <mesh material={materials.collar} position={[0, 0.076, 0]}>
        <cylinderGeometry args={[0.009, 0.011, 0.014, 12]} />
      </mesh>
      <mesh material={materials.shaft} position={[0, 0.118, 0]}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.07, 12]} />
      </mesh>
      {/* flattened driver tip */}
      <mesh material={materials.shaft} position={[0, 0.157, 0]}>
        <boxGeometry args={[0.009, 0.012, 0.0022]} />
      </mesh>
    </group>
  );
}
