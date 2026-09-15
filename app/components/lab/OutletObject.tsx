"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A floating electrical outlet.
 *
 * No wall, no backing plate, no room — the eventual site is white negative
 * space with objects suspended in it, so the outlet is modelled as the thing
 * itself and nothing else.
 *
 * `alignment` runs 0 (crooked and proud of its screw) to 1 (straight and
 * seated). That is the whole completion effect: the plate rotates a few degrees
 * back to level and the screw settles flush. No particles, no flash.
 */
export type OutletObjectProps = {
  position: [number, number, number];
  /** Yaw so the face points at whoever is working on it. */
  faceYaw: number;
  /** 0 = loose and crooked, 1 = repaired. */
  alignment: number;
};

const CROOKED_RADIANS = THREE.MathUtils.degToRad(9);
const PLATE_W = 0.075;
const PLATE_H = 0.122;
const PLATE_D = 0.008;

export default function OutletObject({
  position,
  faceYaw,
  alignment,
}: OutletObjectProps) {
  const plateRef = useRef<THREE.Group>(null);
  const screwRef = useRef<THREE.Mesh>(null);

  const materials = useMemo(
    () => ({
      plate: new THREE.MeshStandardMaterial({
        color: "#f4f2ee",
        roughness: 0.55,
        metalness: 0.02,
      }),
      socket: new THREE.MeshStandardMaterial({
        color: "#2b3242",
        roughness: 0.8,
        metalness: 0,
      }),
      screw: new THREE.MeshStandardMaterial({
        color: "#9aa3b2",
        roughness: 0.35,
        metalness: 0.65,
      }),
    }),
    []
  );

  /*
   * Eased toward the target rather than snapped, so a change in work progress
   * reads as the plate settling rather than as a value being assigned.
   *
   * `alignment` is read straight from props: R3F re-registers this callback on
   * every render, so the closure always holds the current value and no ref is
   * needed to smuggle it in.
   */
  useFrame((_, delta) => {
    const plate = plateRef.current;
    if (!plate) return;
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1));
    const wanted = CROOKED_RADIANS * (1 - alignment);
    plate.rotation.z += (wanted - plate.rotation.z) * k;
    if (screwRef.current) {
      const proud = 0.004 * (1 - alignment);
      screwRef.current.position.z +=
        (PLATE_D / 2 + proud - screwRef.current.position.z) * k;
    }
  });

  return (
    <group position={position} rotation={[0, faceYaw, 0]}>
      <group ref={plateRef} rotation={[0, 0, CROOKED_RADIANS]}>
        {/* faceplate */}
        <mesh material={materials.plate}>
          <boxGeometry args={[PLATE_W, PLATE_H, PLATE_D]} />
        </mesh>

        {/* two sockets */}
        {[0.028, -0.028].map((y) => (
          <group key={y} position={[0, y, PLATE_D / 2 + 0.0005]}>
            <mesh material={materials.socket} position={[-0.011, 0.004, 0]}>
              <boxGeometry args={[0.005, 0.016, 0.002]} />
            </mesh>
            <mesh material={materials.socket} position={[0.011, 0.004, 0]}>
              <boxGeometry args={[0.005, 0.016, 0.002]} />
            </mesh>
            <mesh material={materials.socket} position={[0, -0.013, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.002, 12]} />
            </mesh>
          </group>
        ))}

        {/* centre screw — the thing being driven */}
        <mesh
          ref={screwRef}
          material={materials.screw}
          position={[0, 0, PLATE_D / 2 + 0.004]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.006, 0.006, 0.004, 16]} />
        </mesh>
      </group>
    </group>
  );
}
