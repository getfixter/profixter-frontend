"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import FixterModel, { type FixterModelProps } from "./FixterModel";
import OutletObject from "./OutletObject";
import { workPosition, yawTowards } from "./lab-choreography";
import { SEQUENCE_CAMERA } from "./lab-jobs";

const CAMERA_HOME: [number, number, number] = [3.4, 2.0, 5.4];
const CAMERA_TARGET: [number, number, number] = [0, 0.85, 0];

type FixterSceneProps = FixterModelProps & {
  orbitEnabled: boolean;
  showMarkers: boolean;
  pointA: [number, number, number];
  pointB: [number, number, number];
  resetToken: number;
  /** Bumped to frame the choreography rather than the inspection view. */
  sequenceViewToken: number;
  outletAlignment: number;
};

/**
 * Moves the camera to a named framing.
 *
 * Lives inside the Canvas because that is the only place the camera and the
 * controls object exist; `makeDefault` on OrbitControls is what puts the
 * controls on R3F state for this to find and re-target.
 */
function CameraRig({
  resetToken,
  sequenceViewToken,
}: {
  resetToken: number;
  sequenceViewToken: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const first = useRef(true);
  const seqFirst = useRef(true);

  const moveTo = (
    position: [number, number, number],
    target: [number, number, number]
  ) => {
    camera.position.set(...position);
    if (controls) {
      controls.target.set(...target);
      controls.update();
    }
    camera.lookAt(new THREE.Vector3(...target));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    moveTo(CAMERA_HOME, CAMERA_TARGET);
    // moveTo closes over camera/controls, both stable for the canvas lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken, camera, controls]);

  useEffect(() => {
    if (seqFirst.current) {
      seqFirst.current = false;
      return;
    }
    moveTo(SEQUENCE_CAMERA.position, SEQUENCE_CAMERA.target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceViewToken, camera, controls]);

  return null;
}

/** Flat rings marking the manual A/B travel anchors, plus the route. */
function TravelMarkers({
  pointA,
  pointB,
}: {
  pointA: [number, number, number];
  pointB: [number, number, number];
}) {
  const geometry = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pointA[0], 0.002, pointA[2]),
        new THREE.Vector3(pointB[0], 0.002, pointB[2]),
      ]),
    [pointA, pointB]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      {[
        { at: pointA, color: "#306EEC" },
        { at: pointB, color: "#0EA96D" },
      ].map(({ at, color }, index) => (
        <mesh
          key={index}
          position={[at[0], 0.001, at[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.26, 0.32, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      ))}
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color="#C7D2E5" transparent opacity={0.9} />
      </line>
    </group>
  );
}

export default function FixterScene({
  orbitEnabled,
  showMarkers,
  pointA,
  pointB,
  resetToken,
  sequenceViewToken,
  outletAlignment,
  ...modelProps
}: FixterSceneProps) {
  const job = modelProps.sequence?.job;

  /* The outlet faces back down the approach axis, at whoever is working on it. */
  const outletYaw = useMemo(() => {
    if (!job) return 0;
    const anchor = new THREE.Vector3(...job.anchor);
    const mark = workPosition(job);
    return yawTowards(anchor, new THREE.Vector3(mark.x, anchor.y, mark.z));
  }, [job]);

  return (
    <Canvas
      /* `flat` disables ACES tone mapping — with it on, #ffffff renders grey. */
      flat
      dpr={[1, 2]}
      camera={{ position: CAMERA_HOME, fov: 40, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows={false}
    >
      <color attach="background" args={["#ffffff"]} />

      {/*
       * Lights only, no environment map: drei's <Environment> fetches an HDRI
       * from a CDN at runtime, a network dependency this page has no reason to
       * take on.
       */}
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#d8dee9", 0.6]} />
      <directionalLight position={[4, 8, 6]} intensity={1.5} />
      <directionalLight position={[-5, 3, -4]} intensity={0.55} />

      {showMarkers && !job && <TravelMarkers pointA={pointA} pointB={pointB} />}

      {job && (
        <OutletObject
          position={job.anchor}
          faceYaw={outletYaw}
          alignment={outletAlignment}
        />
      )}

      <Suspense fallback={null}>
        <FixterModel {...modelProps} />
      </Suspense>

      <CameraRig resetToken={resetToken} sequenceViewToken={sequenceViewToken} />
      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        target={CAMERA_TARGET}
        enablePan
        minDistance={0.6}
        maxDistance={20}
        maxPolarAngle={Math.PI / 1.9}
      />
    </Canvas>
  );
}
