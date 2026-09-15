"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import FixterModel, { type FixterModelProps } from "./FixterModel";
import FixableObject from "./lab-objects";
import { buildTour } from "./lab-choreography";
import { getFixterPose } from "./lab-pose";
import {
  FOLLOW_CAMERA,
  JOBS,
  OBJECT_SCALE,
  PAGE_CAMERA,
  type CameraPreset,
} from "./lab-jobs";

type FixterSceneProps = FixterModelProps & {
  orbitEnabled: boolean;
  cameraPreset: CameraPreset;
  resetToken: number;
  showObjects: boolean;
};

/**
 * The camera.
 *
 * Two behaviours, because the same scene has two jobs to do. "Page" is a fixed
 * wide framing: it is the honest preview of the eventual homepage, where the
 * viewport is the frame and the Fixter is a small figure living in the margins.
 * "Follow" trails him at a readable distance, which is the only way to judge
 * hands, tools and footing on a phone.
 *
 * The follow is deliberately lazy — it eases toward where he is rather than
 * tracking him rigidly, so walking reads as the character moving through a
 * scene rather than the scene sliding under a pinned character.
 */
function CameraRig({
  preset,
  resetToken,
}: {
  preset: CameraPreset;
  resetToken: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void; enabled: boolean }
    | null;

  const wanted = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const seeded = useRef(false);

  useEffect(() => {
    camera.position.set(...PAGE_CAMERA.position);
    if (controls) {
      controls.target.set(...PAGE_CAMERA.target);
      controls.update();
    }
    seeded.current = false;
  }, [resetToken, preset, camera, controls]);

  useFrame((_, delta) => {
    if (preset !== "follow") return;
    const dt = Math.min(delta, 0.1);

    const pose = getFixterPose();
    wanted.current.set(
      pose.x + FOLLOW_CAMERA.offset[0],
      FOLLOW_CAMERA.offset[1],
      pose.z + FOLLOW_CAMERA.offset[2]
    );
    look.current.set(pose.x, FOLLOW_CAMERA.lookHeight, pose.z);

    if (!seeded.current) {
      // Jump into place on the first frame; easing in from the page framing
      // would read as a swoop nobody asked for.
      camera.position.copy(wanted.current);
      seeded.current = true;
    } else {
      const k = 1 - Math.exp(-FOLLOW_CAMERA.stiffness * dt);
      camera.position.lerp(wanted.current, k);
    }

    if (controls) {
      controls.target.lerp(look.current, 1 - Math.exp(-FOLLOW_CAMERA.stiffness * dt));
      controls.update();
    } else {
      camera.lookAt(look.current);
    }
  });

  return null;
}

export default function FixterScene({
  orbitEnabled,
  cameraPreset,
  resetToken,
  showObjects,
  ...modelProps
}: FixterSceneProps) {
  const spread = modelProps.spread;
  /*
   * Object placement uses the same solver the character does, so the thing he
   * walks up to and the thing on screen can never disagree. Clip durations are
   * irrelevant to anchors and marks, hence the zero.
   */
  const stops = useMemo(() => buildTour(JOBS, spread, () => 0), [spread]);

  return (
    <Canvas
      /* `flat` disables ACES tone mapping — with it on, #ffffff renders grey. */
      flat
      dpr={[1, 2]}
      camera={{ position: PAGE_CAMERA.position, fov: 38, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows={false}
    >
      <color attach="background" args={["#ffffff"]} />

      {/*
       * Lights only, no environment map: drei's <Environment> fetches an HDRI
       * from a CDN at runtime, a dependency a marketing page should not take.
       */}
      <ambientLight intensity={0.82} />
      <hemisphereLight args={["#ffffff", "#dfe4ec", 0.62]} />
      <directionalLight position={[4, 8, 6]} intensity={1.45} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} />

      {showObjects &&
        stops.map((stop) => (
          <FixableObject
            scale={OBJECT_SCALE}
            key={stop.job.id}
            kind={stop.job.object}
            id={stop.job.id}
            position={[
              stop.anchor.x + (stop.job.objectOffset?.[0] ?? 0),
              stop.anchor.y + (stop.job.objectOffset?.[1] ?? 0),
              stop.anchor.z + (stop.job.objectOffset?.[2] ?? 0),
            ]}
            /* Authored, so props face the viewer rather than the worker. */
            faceYaw={THREE.MathUtils.degToRad(stop.job.objectYawDeg ?? 0)}
          />
        ))}

      <Suspense fallback={null}>
        <FixterModel {...modelProps} />
      </Suspense>

      <CameraRig preset={cameraPreset} resetToken={resetToken} />
      <OrbitControls
        makeDefault
        enabled={orbitEnabled && cameraPreset !== "follow"}
        target={PAGE_CAMERA.target}
        enablePan
        minDistance={0.8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 1.85}
      />
    </Canvas>
  );
}
