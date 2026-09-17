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
import { measuredSpan, type Bounds, type Placer } from "./lab-choreography";
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
/* Scratch for the scroll offset, asked for once a frame. */
const _pageAt = new THREE.Vector2();

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
      /*
       * Ask for room for the REPAIR as well as for the man.
       *
       * The block the search validates is centred on the anchor and was sized
       * from his body alone, so a wide prop — and every prop here comes mounted
       * on a piece of wall, tile or door — hung outside it. That had two costs,
       * and I shipped both before understanding they were the same bug: the
       * clamp afterwards dragged him inland to keep the prop on screen and then
       * the check refused him for being where the clamp had put him (stalls),
       * and when I shrank the clamp to stop that, the opening's pendant lamp
       * came up with its shade cut off by the edge of the phone.
       *
       * Neither is a clamp problem. The search was being asked the wrong
       * question. It is measured from the renderer the first time each repair
       * appears, so from the second appearance on the answer is exact.
       */
      const seen = measuredSpan(job.id);
      const origin = projection.pixelAt(0, 0);
      const pxAcross = (world: number) =>
        Math.abs(projection.pixelAt(world, 0).x - origin.x);
      const pxDown = (world: number) =>
        Math.abs(projection.pixelAt(0, world).y - origin.y);
      const propScale = PAGE_OBJECT_SCALE * scale * (job.propScale ?? 1);
      const rawOffset = job.objectOffset ?? [0, 0];
      const offX = pxAcross(rawOffset[0] * propScale);
      const offY = rawOffset[1] * propScale;
      const propW = seen ? pxAcross(seen.w) : 0;
      const propH = seen ? pxDown(seen.h) : 0;
      /* Half the prop, plus however far it sits from the point he works at. */
      const propHalf = offX + propW / 2;
      const propUp = (offY > 0 ? pxDown(offY) : 0) + propH / 2;
      const propDown = (offY < 0 ? pxDown(-offY) : 0) + propH / 2;
      const needW = Math.round(Math.max(poseW * extra.w, propHalf * 2));
      const needAbove = Math.round(
        Math.max(Math.max(poseH - handY, 0) + poseH * 0.3 * extra.h, propUp)
      );
      const needBelow = Math.round(
        Math.max(handY + poseH * 0.12, propDown)
      );
      const spot = findSpot({
        viewport: { w: size.width, h: size.height },
        need: { w: needW, above: needAbove, below: needBelow },
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
      /*
       * From here on, measure the size he will ACTUALLY be.
       *
       * The finder may only have had room for a smaller handyman, and every
       * check below — the clamp, his silhouette, the prop's fragment — was
       * written against his full size. Checking a full-sized body for a spot
       * that was awarded to a two-thirds-sized one is how a search that refused
       * to overlap anything still ended up refusing everything.
       */
      const fit = spot.fit;
      const fitHandY = handY * fit;
      /*
       * Only as much padding as the search already guaranteed.
       *
       * These used to ask for more room than the block the finder had just
       * verified — seven tenths of his width plus twenty pixels, against a
       * search that only promises half his width from the edge. So a spot that
       * was genuinely empty got dragged inland by thirty pixels, landed on a
       * paragraph, and was then rejected by the check below. The search said
       * yes, the clamp moved him, and the check said no: nine refusals in a row
       * on a phone, which is a character standing still for seven seconds.
       *
       * Sized close to the half-extents of the validated block instead, so the
       * clamp barely moves him at all. Not exactly half, because the repair
       * hangs to one side of him and the half-width is his, not its: at exactly
       * half the opening's pendant lamp came up with its shade cut off by the
       * right edge of a phone. A little over half keeps the thing he is fixing
       * inside the frame without the clamp becoming a second, stricter opinion
       * than the search it is supposed to be trimming.
       */
      /*
       * Exactly what the search guaranteed, and nothing more.
       *
       * The block it validated is centred on the anchor and lies inside the
       * inset, so clamping to its own half-extents cannot move him at all. This
       * is a guard against a degenerate viewport now, not a second opinion —
       * which is what it used to be, and what made it fight the search.
       */
      const padX = (needW * fit) / 2;
      const padTop = needAbove * fit;
      const padBottom = needBelow * fit;
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
      const feetY = y + fitHandY;
      const under = whatIsUnder({
        x: x - (bodyW * fit) / 2,
        y: feetY - bodyH * fit,
        w: bodyW * fit,
        h: bodyH * fit,
      });
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = { ...t, under: `heavy=${under.heavy.toFixed(3)} cov=${under.covered.toFixed(2)}` };
      }
      /*
       * Strict, because the finder is now honest.
       *
       * These numbers used to be a compromise with a search that would hand
       * back a spot on a paragraph rather than admit defeat — tolerating a
       * tenth of a heading was the price of him working at all. The search
       * shrinks him instead of overlapping now, so the acceptance can say what
       * it actually means: almost nothing over anything that matters, and no
       * more than a nick of body copy.
       */
      if (
        under.controls > 0.02 ||
        under.heavy > 0.03 ||
        under.covered > 0.08 ||
        /* And not somewhere the header would simply hide him. */
        under.chrome > 0.3
      ) {
        /* Nowhere this time. Drop the memory so the retry has the whole page. */
        forgetSpots();
        return null;
      }

      rememberSpot(x, y);
      const world = projection.worldAt(x, y);
      return {
        point: new THREE.Vector3(world.x, world.y, 0),
        /* How big he may be here. The finder shrinks him rather than letting
           him stand on something when the page is tight. */
        fit: spot.fit,
      };
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
  /*
   * Is he, right now, on top of something that matters?
   *
   * The same question `standable` answers about a candidate, asked about where
   * he actually is. Cheap enough to run several times a second, and it is what
   * catches the page moving underneath him.
   */
  const blocked = useCallback(() => {
    const pose = getFixterPose();
    const px = projection.pixelAt(pose.x, pose.y);
    /*
     * Scrolled off the screen counts as blocked.
     *
     * He travels with the page now, which is what stops him sliding over the
     * copy — and it means a reader who scrolls a screenful leaves him behind.
     * Treating that as "nowhere to be" reuses the machinery that already
     * exists: he gives up the spot while nobody can see him, and the next one
     * is chosen in the part of the page they are actually reading.
     */
    if (
      px.y < bodyH * 0.5 ||
      px.y - bodyH * 0.5 > size.height ||
      px.x < -bodyW ||
      px.x > size.width + bodyW
    ) {
      return true;
    }
    const under = whatIsUnder({
      x: px.x - bodyW / 2,
      y: px.y - bodyH,
      w: bodyW,
      h: bodyH,
    });
    return under.controls > 0.03 || under.heavy > 0.05 || under.covered > 0.14;
  }, [projection, bodyW, bodyH, size.width, size.height]);

  /**
   * Where the document has been scrolled to, in world units.
   *
   * One pixel of downward scroll moves page content one pixel UP the screen, so
   * the world offset is the negative of the projection's per-pixel step. Taken
   * from the projection rather than assumed, because the stage camera is tilted
   * a few degrees and a scroll therefore carries a little sideways travel too.
   */
  const pageOffset = useCallback(() => {
    const y = typeof window === "undefined" ? 0 : window.scrollY;
    return _pageAt.set(
      projection.perPixelDown.x * -y,
      projection.perPixelDown.y * -y
    );
  }, [projection]);

  /**
   * Is this repair standing on a control?
   *
   * The narrow version of `standable`, asked about the one station the content
   * check leaves alone. Same box, same projection, one threshold.
   */
  const onControl = useCallback(
    (
      propAt: THREE.Vector3,
      span: number | { w: number; h: number },
      fit = 1
    ) => {
      let box;
      if (typeof span === "object") {
        const a = projection.pixelAt(propAt.x - span.w / 2, propAt.y + span.h / 2);
        const b = projection.pixelAt(propAt.x + span.w / 2, propAt.y - span.h / 2);
        box = {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.abs(b.x - a.x),
          h: Math.abs(b.y - a.y),
        };
      } else {
        const pp = projection.pixelAt(propAt.x, propAt.y);
        const w = (span ?? 1) * bodyW * fit;
        box = { x: pp.x - w / 2, y: pp.y - w * 0.55, w, h: w * 1.1 };
      }
      return whatIsUnder(box).controls > 0.02;
    },
    [projection, bodyW]
  );

  /** Is this world point still somewhere the reader can see? */
  const inView = useCallback(
    (point: THREE.Vector3) => {
      const px = projection.pixelAt(point.x, point.y);
      return (
        px.y > -80 &&
        px.y < size.height + 80 &&
        px.x > -140 &&
        px.x < size.width + 140
      );
    },
    [projection, size.width, size.height]
  );

  const standable = useCallback(
    (
      feet: THREE.Vector3,
      propAt?: THREE.Vector3,
      propSpan?: number | { w: number; h: number },
      fit = 1
    ) => {
      /*
       * The prop's finished position, checked where it actually lands.
       *
       * Estimating this from his feet does not work: the thing he is fixing
       * sits a tool's length away, offset by the job, and turned by the work
       * yaw — so a box centred on him misses it entirely on exactly the jobs
       * whose props are biggest. The lesson from the last time this went wrong
       * is the same one: validate the FINISHED placement, not the candidate.
       *
       * Controls get their own budget, far tighter than text. A shoulder over a
       * word is a compromise; a cabinet door over a plan card and its Book
       * button is a lost booking.
       */
      if (propAt) {
        const pp = projection.pixelAt(propAt.x, propAt.y);
        /* A measured box beats an estimate: project its real corners. */
        if (typeof propSpan === "object") {
          const a = projection.pixelAt(
            propAt.x - propSpan.w / 2,
            propAt.y + propSpan.h / 2
          );
          const b = projection.pixelAt(
            propAt.x + propSpan.w / 2,
            propAt.y - propSpan.h / 2
          );
          const real = whatIsUnder({
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.abs(b.x - a.x),
            h: Math.abs(b.y - a.y),
          });
          if (
            real.controls > 0.02 ||
            real.heavy > 0.03 ||
            real.covered > 0.1
          ) {
            return false;
          }
          return true;
        }
        /*
         * Measure the whole fragment, not the object.
         *
         * Most repairs carry a piece of wall, tile or door two to three times
         * the size of the thing mounted on it, and it was the fragment that
         * kept landing on the copy.
         */
        /*
         * Sized to what these things actually measure, not generously.
         *
         * Coverage is a SHARE of the box, so an estimate that is too big is not
         * the safe direction — it dilutes the answer. At 1.25 the estimated box
         * came out about a fifth wider than the object really draws, which
         * divides the share by around 1.45: a repair genuinely sitting on 14%
         * of a paragraph reported 10% and passed. Every job is measured from
         * the renderer the first time it appears, so this only decides the
         * first placement of each — which is precisely what a first-time
         * visitor sees.
         */
        const span = (propSpan ?? 1) * bodyW * fit;
        const propUnder = whatIsUnder({
          x: pp.x - span / 2,
          y: pp.y - span * 0.55,
          w: span,
          h: span * 1.1,
        });
        /*
         * Props get almost no tolerance at all.
         *
         * The character is allowed to clip the tail of a word because the
         * alternative is a handyman with nowhere to stand — he has to be
         * SOMEWHERE. A cabinet door has no such claim: if it cannot sit in
         * clear space it should not be there. Reusing his tolerance for props
         * is what left a cabinet parked across "THE LIST" on a phone for the
         * whole visit.
         */
        /*
         * Strict about what matters, tolerant about what does not.
         *
         * My first attempt at this refused anything that touched anything, and
         * on a page made mostly of content that means almost every spot is
         * refused — eighty per cent of a ninety-second run was him standing
         * still with nowhere the system would let him go, which is a far worse
         * experience than the overlap it was trying to prevent.
         *
         * Buttons and headings are what a visitor is actually using or reading
         * and get almost no tolerance. Body copy behind a half-transparent wall
         * fragment is a compromise worth making, because the alternative is no
         * handyman at all.
         */
        /*
         * A prop may not cover the copy either.
         *
         * Body text had no protection from props at all — the rule only looked
         * at buttons and headings — which is exactly what the recording shows: a
         * shelf across "mounting, repairs, installations", a towel rail across
         * "Book online whenever something comes up", a sink across "Book the
         * next when you're ready". Every one of those is body copy, and every
         * one of them passed.
         */
        if (
          propUnder.controls > 0.02 ||
          propUnder.heavy > 0.03 ||
          propUnder.covered > 0.1
        ) {
          return false;
        }
      }
      const px = projection.pixelAt(feet.x, feet.y);
      const under = whatIsUnder({
        x: px.x - (bodyW * fit) / 2,
        y: px.y - bodyH * fit,
        w: bodyW * fit,
        h: bodyH * fit,
      });
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = {
          ...t,
          under: `heavy=${under.heavy.toFixed(3)} cov=${under.covered.toFixed(2)}`,
        };
      }
      /*
       * Text and controls get different budgets.
       *
       * The ninth-of-a-silhouette rule was written for headings, where a
       * shoulder over the tail of a word is a fair trade against him never
       * working at all. A button is not a heading: a ninth of a "Choose Home"
       * card is still a man standing in front of the thing the page exists to
       * get clicked. So controls are held to a twentieth, and the looser rule
       * goes on carrying everything else.
       */
      return (
        under.controls <= 0.02 && under.heavy <= 0.03 && under.covered <= 0.08
      );
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
          blocked={blocked}
          pageOffset={pageOffset}
          inView={inView}
          onControl={onControl}
          /* How much of the house can stand in view at once. A phone has far
             less room to put anything without covering something. */
          maxStations={size.width < 560 ? 2 : 3}
          stationGap={size.width < 560 ? 0.95 : 1.5}
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
    /*
     * The diagnostics panel is happy at two updates a second; the automated
     * watching is not. Every crop that follows him has been half a second
     * behind, which is fine while he stands still and useless during the fast
     * beats — notice, the snap, the moment he sets off — which are exactly the
     * ones worth looking at. Dev publishes at eight a second so a crop lands on
     * him; production keeps the cheap rate.
     */
    const period = process.env.NODE_ENV !== "production" ? 0.12 : 0.5;
    if (clock.current < period) return;
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
      /* Every station's box in viewport pixels, for the overlap audit. */
      const st = (w.__fxStations ?? null) as
        | { id: string; x: number; y: number; w: number; h: number }[]
        | null;
      if (st) {
        w.__fxStationPx = st.map((b) => {
          const a = projection.pixelAt(b.x - b.w / 2, b.y + b.h / 2);
          const c2 = projection.pixelAt(b.x + b.w / 2, b.y - b.h / 2);
          return {
            id: b.id,
            x: Math.round(Math.min(a.x, c2.x)),
            y: Math.round(Math.min(a.y, c2.y)),
            w: Math.round(Math.abs(c2.x - a.x)),
            h: Math.round(Math.abs(c2.y - a.y)),
          };
        });
      }
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
