"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import FixterModel, { type FixterModelProps } from "./FixterModel";
import FixableObject from "./lab-objects";
import { buildTour } from "./lab-choreography";
import { CAMERA_TILT, JOBS, OBJECT_SCALE } from "./lab-jobs";
import { STAGE, type LayoutId } from "./lab-stage";

type FixterSceneProps = Omit<FixterModelProps, "aspect"> & {
  layout: LayoutId;
  orbitEnabled: boolean;
  resetToken: number;
  showObjects: boolean;
};

/**
 * The stage camera.
 *
 * Orthographic on purpose. With perspective, a job's screen position depends on
 * how far away it is, and "upper left" stops meaning anything the moment
 * something moves in depth — which is precisely the coupling this whole scene
 * exists to remove. Under an orthographic camera a stage coordinate IS a screen
 * coordinate, so placement can be reasoned about the way page layout is.
 *
 * The small tilt is the one concession. Dead-on, every box shows a single face
 * and the props read as flat cut-outs; a few degrees down and across catches a
 * second face on everything and the Fixter keeps his volume, while world Y
 * stays screen-up to within a percent.
 *
 * Zoom is world-units-per-pixel, so the stage occupies the full viewport height
 * whatever shape the viewport is. A tall phone therefore gets a tall stage
 * rather than a letterboxed strip of a wide one.
 */
function StageCamera({ layout, resetToken }: { layout: LayoutId; resetToken: number }) {
  const ref = useRef<THREE.OrthographicCamera>(null);
  const size = useThree((state) => state.size);
  const zoom = size.height / STAGE[layout].height;

  useEffect(() => {
    const camera = ref.current;
    if (!camera) return;
    camera.position.set(CAMERA_TILT.x, CAMERA_TILT.y, CAMERA_TILT.z);
    camera.zoom = zoom;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [zoom, resetToken]);

  return (
    <OrthographicCamera
      ref={ref}
      makeDefault
      position={[CAMERA_TILT.x, CAMERA_TILT.y, CAMERA_TILT.z]}
      zoom={zoom}
      near={-40}
      far={80}
    />
  );
}

export default function FixterScene({
  layout,
  orbitEnabled,
  resetToken,
  showObjects,
  ...modelProps
}: FixterSceneProps) {
  return (
    <Canvas
      /* `flat` disables ACES tone mapping — with it on, #ffffff renders grey. */
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows={false}
    >
      <color attach="background" args={["#ffffff"]} />
      <StageCamera layout={layout} resetToken={resetToken} />

      {/*
       * Lights only, no environment map: drei's <Environment> fetches an HDRI
       * from a CDN at runtime, a dependency a marketing page should not take.
       * The key light comes from upper-left-front, which is what gives the
       * props their second, shaded face under an almost head-on camera.
       */}
      <ambientLight intensity={0.78} />
      <hemisphereLight args={["#ffffff", "#dfe4ec", 0.6]} />
      <directionalLight position={[-4, 6, 8]} intensity={1.35} />
      <directionalLight position={[5, 2, 4]} intensity={0.45} />

      <StageContents
        layout={layout}
        showObjects={showObjects}
        modelProps={modelProps}
      />

      {orbitEnabled && <OrbitControls makeDefault target={[0, 0, 0]} enablePan />}
    </Canvas>
  );
}

/**
 * Split out so it can read the live viewport: the stage is laid out from the
 * canvas shape, and the character has to be given the same numbers or he would
 * walk to marks that are not where the props are.
 */
function StageContents({
  layout,
  showObjects,
  modelProps,
}: {
  layout: LayoutId;
  showObjects: boolean;
  modelProps: Omit<FixterModelProps, "aspect" | "layout">;
}) {
  const size = useThree((state) => state.size);
  const aspect = size.width / Math.max(size.height, 1);

  /* The same solver the character uses, so props and marks cannot disagree. */
  const stops = useMemo(
    () => buildTour(JOBS, layout, aspect, modelProps.scale, () => 0),
    [layout, aspect, modelProps.scale]
  );

  return (
    <>
      {showObjects &&
        stops.map((stop) => (
          <FixableObject
            key={stop.job.id}
            kind={stop.job.object}
            id={stop.job.id}
            scale={OBJECT_SCALE}
            position={[stop.object.x, stop.object.y, stop.object.z]}
            rotationDeg={stop.job.objectRotationDeg ?? [0, 0, 0]}
          />
        ))}

      <Suspense fallback={null}>
        <FixterModel {...modelProps} layout={layout} aspect={aspect} />
      </Suspense>
    </>
  );
}
