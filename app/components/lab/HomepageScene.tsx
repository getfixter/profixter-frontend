"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import FixterModel, { type FixterModelProps } from "./FixterModel";
import FixableObject from "./lab-objects";
import { buildTour } from "./lab-choreography";
import type { JobDefinition } from "./lab-jobs";
import {
  PAGE_CAMERA_TILT,
  PAGE_JOBS,
  PAGE_OBJECT_SCALE,
  PAGE_UNIT_PX,
  type PageJob,
} from "./lab-page-jobs";
import {
  getAnchorBox,
  getAnchorVersion,
  measureAnchors,
} from "./lab-page-anchors";
import { planeProjection, type PlaneProjection } from "./lab-projection";
import type { LayoutId } from "./lab-stage";

/**
 * The 3D layer of the homepage experiment.
 *
 * A transparent canvas pinned over the viewport, holding a character and a
 * handful of props that belong to the webpage underneath it. The page is
 * ordinary DOM and stays ordinary DOM — nothing here renders text, and the
 * whole overlay is pointer-transparent, so every button on the page is still a
 * button.
 *
 * Three facts make the alignment work:
 *
 *   1. The camera is orthographic, so a world unit is a fixed number of CSS
 *      pixels — PAGE_UNIT_PX — at every position on the page.
 *   2. Anchors are measured in page space, which does not change when the
 *      document scrolls.
 *   3. Scrolling is therefore a single translation of the whole 3D layer, not
 *      a re-measurement of anything.
 *
 * That third point is the experiment. He is attached to the page rather than
 * to the window because his coordinates are page coordinates, and the only
 * thing scroll does is slide the layer the page slid.
 */

type HomepageSceneProps = Omit<
  FixterModelProps,
  "aspect" | "jobs" | "anchorFor" | "anchorVersion" | "scale"
> & {
  layout: LayoutId;
  scale: number;
};

/**
 * Build a camera with exactly the parameters the renderer will use.
 *
 * Shared by the real camera and by the projection maths so the two cannot
 * disagree. Deriving the mapping from the live camera instead would make it
 * depend on when React happened to run the effect that positions it.
 */
function configureCamera(
  camera: THREE.OrthographicCamera,
  layout: LayoutId,
  width: number,
  height: number
) {
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.near = -400;
  camera.far = 900;
  camera.zoom = PAGE_UNIT_PX[layout];
  camera.position.set(PAGE_CAMERA_TILT.x, PAGE_CAMERA_TILT.y, PAGE_CAMERA_TILT.z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
}

export default function HomepageScene({
  layout,
  scale,
  ...modelProps
}: HomepageSceneProps) {
  return (
    /*
     * Above the page and completely pointer-transparent. Above, because every
     * section of the page has an opaque background and anything behind them
     * would simply be invisible. Pointer-transparent, because a full-viewport
     * overlay that ate clicks would break the website it is meant to decorate.
     */
    <div className="pointer-events-none fixed inset-0 z-40">
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        shadows={false}
        orthographic
        /*
         * Set on the Canvas as well as the wrapper, and not only for tidiness:
         * R3F gives its own container `pointer-events: auto`, which overrides
         * the wrapper and puts an invisible sheet of glass over every button on
         * the page. Caught by a hit test, not by looking at it.
         */
        style={{ pointerEvents: "none" }}
        /* No <color attach="background">: the page has to show through. */
      >
        <ambientLight intensity={0.78} />
        <hemisphereLight args={["#ffffff", "#dfe4ec", 0.6]} />
        <directionalLight position={[-4, 6, 8]} intensity={1.35} />
        <directionalLight position={[5, 2, 4]} intensity={0.45} />
        <PageContents layout={layout} scale={scale} modelProps={modelProps} />
      </Canvas>
    </div>
  );
}

function PageContents({
  layout,
  scale,
  modelProps,
}: {
  layout: LayoutId;
  scale: number;
  modelProps: Omit<
    FixterModelProps,
    "aspect" | "layout" | "jobs" | "anchorFor" | "anchorVersion" | "scale"
  >;
}) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);

  /* The renderer's camera, set from the same function the maths uses. */
  useEffect(() => {
    configureCamera(
      camera as THREE.OrthographicCamera,
      layout,
      size.width,
      size.height
    );
  }, [camera, layout, size.width, size.height]);

  const projection: PlaneProjection = useMemo(() => {
    const probe = new THREE.OrthographicCamera();
    configureCamera(probe, layout, size.width, size.height);
    return planeProjection(probe, size.width, size.height);
  }, [layout, size.width, size.height]);

  /*
   * Re-measure whenever the page could have reflowed.
   *
   * Not on scroll: a page-space rect is scroll-invariant, and re-reading it
   * sixty times a second during a scroll would let sub-pixel rounding shiver
   * the character against the text he is standing beside.
   */
  const anchorVersion = useAnchorVersion(layout, size.width, size.height);

  const anchorFor = useCallback(
    (job: JobDefinition): THREE.Vector3 | null => {
      const page = job as PageJob;
      const id = page.anchor[layout];
      if (!id) return null;
      const box = getAnchorBox(id);
      if (!box) return null;

      const align = page.align[layout];
      const nudge = page.nudgePx?.[layout] ?? [0, 0];
      const pageX = box.x + (align.x * box.width) / 2 + nudge[0];
      const pageY = box.y + (align.y * box.height) / 2 + nudge[1];

      /*
       * Page coordinates go straight into the viewport-to-world map. That is
       * correct rather than a shortcut: the map is affine, so feeding it a
       * page coordinate yields the world position the element occupies when
       * the document is scrolled to the top, and the scroll offset below
       * carries it from there.
       */
      const world = projection.worldAt(pageX, pageY);
      return new THREE.Vector3(world.x, world.y, 0);
    },
    [layout, projection]
  );

  const stops = useMemo(() => {
    void anchorVersion;
    return buildTour(PAGE_JOBS, layout, 1, scale, () => 0, anchorFor);
  }, [layout, scale, anchorFor, anchorVersion]);

  return (
    <ScrollLayer projection={projection}>
      {stops.map((stop) => (
        <FixableObject
          key={stop.job.id}
          kind={stop.job.object}
          id={stop.job.id}
          scale={PAGE_OBJECT_SCALE}
          position={[stop.object.x, stop.object.y, stop.object.z]}
          rotationDeg={stop.job.objectRotationDeg ?? [0, 0, 0]}
        />
      ))}

      <Suspense fallback={null}>
        <FixterModel
          {...modelProps}
          scale={scale}
          layout={layout}
          aspect={size.width / Math.max(size.height, 1)}
          jobs={PAGE_JOBS}
          anchorFor={anchorFor}
          anchorVersion={anchorVersion}
        />
      </Suspense>
    </ScrollLayer>
  );
}

/**
 * Everything the page owns, slid by exactly as much as the page has slid.
 *
 * Read from window.scrollY each frame rather than from a scroll event, so the
 * offset is applied in the same frame the browser paints the page at its new
 * position. A scroll listener runs at a different moment and lets the character
 * lag a few pixels behind the text he is standing on — which is precisely the
 * "floating in a fixed viewport" feeling this is built to avoid.
 */
function ScrollLayer({
  projection,
  children,
}: {
  projection: PlaneProjection;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const scrolled = window.scrollY;
    group.position.set(
      -scrolled * projection.perPixelDown.x,
      -scrolled * projection.perPixelDown.y,
      0
    );
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * The anchor measurement version.
 *
 * Measurement is driven from here rather than from the page component so that
 * it happens after the scene exists: placing a job needs both the element and
 * the camera, and the element is always the one that is ready first.
 *
 * Every pass is scheduled — a frame, a timer, an event — never run inline. Two
 * reasons: measuring during an effect body reads layout the browser has not
 * finished, and it would set state synchronously during the commit, which the
 * compiler's rules rightly forbid.
 */
function useAnchorVersion(layout: LayoutId, width: number, height: number) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const remeasure = () => {
      if (!alive) return;
      if (measureAnchors()) setVersion(getAnchorVersion());
    };

    /*
     * Several passes over the first couple of seconds. Web fonts land late and
     * change the height of every headline on the page; one measurement at
     * mount would peg every job to where its element used to be.
     */
    const frame = window.requestAnimationFrame(remeasure);
    const timers = [120, 400, 900, 1800].map((ms) =>
      window.setTimeout(remeasure, ms)
    );
    if (document.fonts) void document.fonts.ready.then(remeasure);

    window.addEventListener("resize", remeasure);
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
    };
  }, [layout, width, height]);

  return version;
}
