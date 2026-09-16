"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import FixterModel, { type FixterModelProps } from "./FixterModel";
import type { Bounds, Placer } from "./lab-choreography";
import { WORK_MOTIONS, type JobDefinition } from "./lab-jobs";
import {
  PAGE_CAMERA_TILT,
  PAGE_JOBS,
  PAGE_OBJECT_SCALE,
  PAGE_UNIT_PX,
} from "./lab-page-jobs";
import {
  findSpot,
  busyWeightAt,
  forgetSpots,
  rememberSpot,
  whatIsUnder,
  measureSafeAreas,
  safeAreaCount,
  setSafeAreaRoot,
} from "./lab-safe-areas";
import { planeProjection, type PlaneProjection } from "./lab-projection";
import type { LayoutId } from "./lab-stage";
import { addDiagError, setDiag } from "./lab-diagnostics";
import { getFixterPose } from "./lab-pose";

/**
 * The Fixter layer.
 *
 * A transparent canvas pinned over the viewport, with a character who lives in
 * it rather than in the document. He is not anchored to anything on the page:
 * every job is placed in whatever space the screen has free when he sets off
 * for it, and when the page scrolls he stays where he is and carries on.
 *
 * The document still has a say, but only a negative one — "not here" — which is
 * what makes this a site-level system instead of something wired into one
 * particular homepage. It would work on the membership page tomorrow.
 *
 * Nothing renders text, nothing takes a pointer event, and the page underneath
 * stays an ordinary webpage.
 */

type HomepageSceneProps = Omit<
  FixterModelProps,
  | "aspect"
  | "jobs"
  | "place"
  | "bounds"
  | "objectScale"
  | "displaced"
  | "scale"
> & {
  layout: LayoutId;
  scale: number;
};

/** Keep clear of the browser's own edges and of any fixed site chrome. */
const EDGE_INSET: Record<LayoutId, { top: number; right: number; bottom: number; left: number }> = {
  desktop: { top: 24, right: 28, bottom: 28, left: 28 },
  tablet: { top: 20, right: 22, bottom: 24, left: 22 },
  mobile: { top: 14, right: 12, bottom: 18, left: 12 },
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
    <div
      data-fx-layer="1"
      data-fx-chrome=""
      className="pointer-events-none fixed inset-0 z-40"
    >
      <LoadReporter />
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        shadows={false}
        orthographic
        style={{ pointerEvents: "none" }}
        onCreated={(state) => {
          setDiag({
            canvas:
              `mounted ${state.size.width}x${state.size.height} ` +
              `buf ${state.gl.domElement.width}x${state.gl.domElement.height}`,
          });
        }}
      >
        <ambientLight intensity={0.78} />
        <hemisphereLight args={["#ffffff", "#dfe4ec", 0.6]} />
        <directionalLight position={[-4, 6, 8]} intensity={1.35} />
        <directionalLight position={[5, 2, 4]} intensity={0.45} />
        <SceneGuard>
          <SceneContents layout={layout} scale={scale} modelProps={modelProps} />
        </SceneGuard>
      </Canvas>
    </div>
  );
}

function SceneContents({
  layout,
  scale,
  modelProps,
}: {
  layout: LayoutId;
  scale: number;
  modelProps: Omit<
    FixterModelProps,
    | "aspect"
    | "layout"
    | "jobs"
    | "place"
    | "bounds"
    | "objectScale"
    | "displaced"
    | "scale"
  >;
}) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);

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

  const { version, displaced } = useSafeAreas(layout, size.width, size.height);

  /*
   * How much room he needs, in viewport pixels.
   *
   * His own silhouette plus the prop he will be holding, with enough margin
   * that "free" means genuinely free rather than technically unoccupied.
   */
  const unit = PAGE_UNIT_PX[layout];
  /** His silhouette in viewport pixels: how wide, and how tall he stands. */
  const bodyH = 1.72 * scale * unit;
  const bodyW = 0.8 * scale * unit;

  const inset = EDGE_INSET[layout];

  /**
   * Where the next repair happens.
   *
   * Asked once, at the moment he sets off. Everything about the answer — which
   * content is on screen, how much space is left, where he currently is — is
   * true only for that moment, which is exactly why it is not cached.
   */
  const place: Placer = useCallback(
    (job: JobDefinition) => {
      void version;
      const pose = getFixterPose();
      const here = projection.pixelAt(pose.x, pose.y);
      const extra = job.footprint ?? { w: 1, h: 1 };
      /*
       * Where he sits relative to the repair depends on the posture: crouching
       * at an outlet he is just below it, reaching for a ceiling fixture he is
       * a whole body below it. The hand offset already knows this.
       */
      const motion = WORK_MOTIONS[job.workMotion];
      const handY = motion.handOffset[1] * scale * unit;
      /* The silhouette this posture actually has, not the standing one. */
      const poseH = bodyH * (motion.boxH ?? 1);
      const poseW = bodyW * (motion.boxW ?? 1);
      const spot = findSpot({
        viewport: { w: size.width, h: size.height },
        need: {
          w: Math.round(poseW * extra.w),
          above: Math.round(Math.max(poseH - handY, 0) + poseH * 0.3 * extra.h),
          below: Math.round(handY + poseH * 0.12),
        },
        inset,
        awayFrom: { x: here.x, y: here.y },
        /*
         * Not always the furthest corner.
         *
         * Always maximising distance turns the loop into a metronome of long
         * diagonals. Varying it gives the pacing somewhere to breathe: a couple
         * of jobs close together, then a proper journey across the screen.
         */
        wander: 0.45 + Math.random() * 0.95,
      });
      /*
       * Some pages have no room, and that is an answer.
       *
       * A phone showing a single narrow measure of body copy has no free block
       * anywhere: the search will still return its least-bad guess, and taking
       * it means standing on somebody's paragraph for five seconds. Refusing
       * instead sends him away until the reader scrolls somewhere with space,
       * which is both better manners and a more interesting behaviour — he
       * turns up where there is room for him.
       */
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = { ...t, crowding: spot ? +spot.crowding.toFixed(2) : null };
      }
      if (!spot) {
        forgetSpots();
        return null;
      }
      /*
       * Keep the prop on screen too.
       *
       * The spot is chosen for HIM; the prop sits a tool's length away plus its
       * own offset, which is enough to hang a pendant light off the right edge
       * of the viewport. Clamping the anchor rather than the mark keeps the
       * repair — and therefore the thing worth looking at — inside the frame.
       */
      const padX = poseW * extra.w * 0.7 + 20;
      const padTop = Math.max(poseH - handY, 0) + poseH * 0.25;
      const padBottom = handY + poseH * 0.15;
      const x = THREE.MathUtils.clamp(
        spot.x,
        inset.left + padX,
        size.width - inset.right - padX
      );
      const y = THREE.MathUtils.clamp(
        spot.y,
        inset.top + padTop,
        size.height - inset.bottom - padBottom
      );
      /*
       * Check him where he will actually stand, after the clamp.
       *
       * The clamp exists to keep the prop on screen and it moves him to do it,
       * so validating the spot before it ran was validating somewhere he was
       * not going to be. That is how he ended up crouched over "There is
       * always something" on a phone while the check reported a clear stage.
       */
      const feetY = y + handY;
      const under = whatIsUnder({
        x: x - bodyW / 2,
        y: feetY - bodyH,
        w: bodyW,
        h: bodyH,
      });
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = { ...t, under: `heavy=${under.heavy.toFixed(3)} cov=${under.covered.toFixed(2)}` };
      }
      /*
       * A nick of a heading is allowed; standing on one is not.
       *
       * A tenth of his silhouette is a shoulder crossing the tail of a word.
       * Standing in front of a headline is thirty per cent and up, and stays
       * refused. The stricter number read as principled and behaved as
       * paralysis: on a phone every candidate clipped the one headline by five
       * to eight per cent, all of them were refused, and he stopped working
       * entirely — which is a worse answer to "do not cover the copy" than a
       * shoulder over one word.
       */
      if (under.heavy > 0.09 || under.covered > 0.2) {
        /* Nowhere this time. Drop the memory so the retry has the whole page. */
        forgetSpots();
        return null;
      }

      rememberSpot(x, y);
      const world = projection.worldAt(x, y);
      return new THREE.Vector3(world.x, world.y, 0);
    },
    [projection, size.width, size.height, bodyW, bodyH, scale, unit, inset, version]
  );

  /**
   * Somewhere small to stand and wait, when no repair fits.
   *
   * Asked with a much smaller body and no headroom for a prop, because he is
   * not going to work here — he is going to wait here. A gutter, a margin, the
   * gap between two sections: the sort of place a person steps into to be out
   * of the way, which is exactly the intent.
   */
  const perch: () => THREE.Vector3 | null = useCallback(() => {
    void version;
    const small = 0.62;
    const spot = findSpot({
      viewport: { w: size.width, h: size.height },
      need: {
        w: Math.round(bodyW * small),
        above: Math.round(bodyH * small * 0.92),
        below: Math.round(bodyH * small * 0.1),
      },
      inset,
      awayFrom: null,
      wander: 0,
    });
    if (!spot) return null;
    const feetY = spot.y + bodyH * small * 0.08;
    const under = whatIsUnder({
      x: spot.x - (bodyW * small) / 2,
      y: feetY - bodyH * small,
      w: bodyW * small,
      h: bodyH * small,
    });
    if (under.heavy > 0.06 || under.covered > 0.14) return null;
    const world = projection.worldAt(spot.x, spot.y);
    return new THREE.Vector3(world.x, world.y, 0);
  }, [projection, size.width, size.height, bodyW, bodyH, inset, version]);

  /**
   * Would he actually be standing on something, given where he ends up?
   *
   * The final word, asked with his real feet rather than with the anchor the
   * search returned. Everything between the two — the tool standing his hand
   * off from the work, the work yaw turning that offset — moves him, and it
   * moved him onto a pricing card while the estimate reported a clear stage.
   */
  const standable = useCallback(
    (feet: THREE.Vector3) => {
      const px = projection.pixelAt(feet.x, feet.y);
      const under = whatIsUnder({
        x: px.x - bodyW / 2,
        y: px.y - bodyH,
        w: bodyW,
        h: bodyH,
      });
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = {
          ...t,
          under: `heavy=${under.heavy.toFixed(3)} cov=${under.covered.toFixed(2)}`,
        };
      }
      return under.heavy <= 0.09 && under.covered <= 0.2;
    },
    [projection, bodyW, bodyH]
  );

  /** Is this world point under something the reader is using? */
  const busyAt = useCallback(
    (x: number, y: number) => {
      const px = projection.pixelAt(x, y);
      return busyWeightAt(px.x, px.y, 10);
    },
    [projection]
  );

  const bounds: Bounds = useMemo(() => {
    const a = projection.worldAt(inset.left, inset.top);
    const b = projection.worldAt(size.width - inset.right, size.height - inset.bottom);
    return {
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y),
    };
  }, [projection, size.width, size.height, inset]);

  return (
    <>
      <DiagReporter projection={projection} version={version} bodyW={bodyW} bodyH={bodyH} />
      <Suspense fallback={null}>
        <FixterModel
          {...modelProps}
          scale={scale}
          jobs={PAGE_JOBS}
          place={place}
          bounds={bounds}
          displaced={displaced}
          busyAt={busyAt}
          perch={perch}
          standable={standable}
          objectScale={PAGE_OBJECT_SCALE * scale}
        />
      </Suspense>
    </>
  );
}

/**
 * Keeps the map of where the page is busy, and notices when he is standing on
 * something he should not be.
 *
 * Measured on reflow, never on scroll: a page rect only moves when the page
 * changes, and scrolling is then a subtraction. Displacement is checked after
 * the scrolling stops, because reacting to every scroll frame would have him
 * skittering around the screen while somebody is trying to read.
 */
function useSafeAreas(layout: LayoutId, width: number, height: number) {
  const [version, setVersion] = useState(0);
  const [displaced, setDisplaced] = useState(false);

  useEffect(() => {
    let alive = true;
    const remeasure = () => {
      if (!alive) return;
      measureSafeAreas();
      setVersion((v) => v + 1);
    };

    const frame = window.requestAnimationFrame(remeasure);
    const timers = [200, 600, 1400, 2600].map((ms) =>
      window.setTimeout(remeasure, ms)
    );
    if (document.fonts) void document.fonts.ready.then(remeasure);

    window.addEventListener("resize", remeasure);
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);

    /* After the scroll settles, is he now under something? */
    let settle = 0;
    const onScroll = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (!alive) return;
        const pose = getFixterPose();
        const now = busyAt(pose);
        if (process.env.NODE_ENV !== "production") {
          const w = window as unknown as Record<string, unknown>;
          const t = (w.__fxTour ?? {}) as Record<string, unknown>;
          w.__fxTour = {
            ...t,
            displaced: now,
            displacedAt: now ? Math.round(window.scrollY) : null,
          };
        }
        setDisplaced(now);
      }, 360);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      window.clearTimeout(settle);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [layout, width, height]);

  /* Clear the flag once he has acted on it. */
  useEffect(() => {
    if (!displaced) return;
    const id = window.setTimeout(() => setDisplaced(false), 1200);
    return () => window.clearTimeout(id);
  }, [displaced]);

  return { version, displaced };
}

/** Set by the scene each frame so the scroll handler can ask where he is. */
let poseToPixel: ((x: number, y: number) => { x: number; y: number }) | null = null;

function busyAt(pose: { x: number; y: number }) {
  if (!poseToPixel) return false;
  const p = poseToPixel(pose.x, pose.y);
  return busyWeightAt(p.x, p.y, 18) > 0;
}

/**
 * Reports what the scene is doing to the diagnostics panel outside it, and
 * publishes the projection the scroll handler needs.
 */
function DiagReporter({
  projection,
  version,
  bodyW,
  bodyH,
}: {
  projection: PlaneProjection;
  version: number;
  bodyW: number;
  bodyH: number;
}) {
  const clock = useRef(0);

  useEffect(() => {
    poseToPixel = (x, y) => {
      const v = projection.pixelAt(x, y);
      return { x: v.x, y: v.y };
    };
    return () => {
      poseToPixel = null;
    };
  }, [projection]);

  useFrame((_, delta) => {
    clock.current += delta;
    if (clock.current < 0.5) return;
    clock.current = 0;
    const pose = getFixterPose();
    const px = projection.pixelAt(pose.x, pose.y);
    setDiag({
      anchors: `${safeAreaCount()} content rects · v${version}`,
      stops: `${PAGE_JOBS.length} jobs`,
      fixter:
        `screen ${Math.round(px.x)},${Math.round(px.y)} · ` +
        (px.y > -60 && px.y < window.innerHeight + 60 ? "ON SCREEN" : "off screen"),
    });
    /* Where he is, for the Lab's automated watching. Dev only. */
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      const t = (w.__fxTour ?? {}) as Record<string, unknown>;
      w.__fxTour = { ...t, x: Math.round(px.x), y: Math.round(px.y) };
      w.__fxBodyW = bodyW;
      w.__fxBodyH = bodyH;
      /* Lab only: the working hand in screen pixels, for zooming in on it. */
      const hand = (w.__fxHandWorld ?? null) as { x: number; y: number } | null;
      if (hand) {
        const hp = projection.pixelAt(hand.x, hand.y);
        w.__fxHandPx = { x: Math.round(hp.x), y: Math.round(hp.y) };
      }
    }
  });

  return null;
}

/** How much of the payload has arrived. Outside the Canvas so it still answers. */
function LoadReporter() {
  const { active, progress, loaded, total, errors } = useProgress();
  useEffect(() => {
    setDiag({
      assets:
        `${Math.round(progress)}% · ${loaded}/${total} files · ` +
        (active ? "downloading" : "idle") +
        (errors.length ? ` · ERRORS ${errors.length}` : ""),
    });
    for (const e of errors) addDiagError("asset: " + e);
  }, [active, progress, loaded, total, errors]);
  return null;
}

/**
 * Catches anything the R3F tree throws.
 *
 * The DOM error boundary around the Canvas does not reliably see these, and a
 * silent 3D layer looks exactly like a page with nothing on it.
 */
class SceneGuard extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    addDiagError("scene: " + error.message);
    setDiag({ canvas: "mounted, scene threw" });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export { setSafeAreaRoot };
