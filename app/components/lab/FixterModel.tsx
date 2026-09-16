"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bodyAccent, type ToolAction } from "./lab-action";
import { createPortal, useFrame, useLoader } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { FIXTER_GLB, resolveClipRoles } from "./lab-config";
import {
  MOTION_FILES,
  TOOL_ATTACH_BONE,
  TOOL_SCALE,
  WORK_MOTIONS,
  actionFor,
  allClipSpecs,
  type ClipSpec,
  type JobDefinition,
  type LoopStyle,
} from "./lab-jobs";
import { retargetClipRestCompensated } from "./lab-retarget";
import { FIXTER_HIPS_BONE, MESHY_BVH_TO_FIXTER } from "./meshy-bone-map";
import { reverseClip, subclipByTime } from "./lab-clip-utils";
import { publishRetargetReport, publishTelemetry } from "./lab-telemetry";
import {
  approachValue,
  buildStops,
  clipRoleForPhase,
  createTourRuntime,
  stepTour,
  type Bounds,
  type Placer,
  type Stop,
  type TourPhase,
  type TourRuntime,
} from "./lab-choreography";
import { AimedHandTool } from "./lab-tools";
import { createContactShadow } from "./lab-materials";
import FixableObject from "./lab-objects";
import WorkEffect from "./lab-effects";
import { setFixterPose } from "./lab-pose";
import { addDiagError, setDiag } from "./lab-diagnostics";

useGLTF.preload(FIXTER_GLB);

export type TourCommand = {
  token: number;
  paused: boolean;
};

export type ToolOffset = {
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scale: number;
};

export type TourState = {
  phase: TourPhase;
  jobId: string;
  jobLabel: string;
  clip: string;
  tool: string;
  workProgress: number;
  jobsDone: number;
  laps: number;
};

export type FixterModelProps = {
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scale: number;
  manualClip: string | null;
  isPlaying: boolean;
  timeScale: number;
  stopToken: number;
  tour: TourCommand | null;
  /** The repairs he works through, in order. */
  jobs: JobDefinition[];
  /**
   * Where to do the next one.
   *
   * Asked once, when he sets off — not stored per job, because on a screen that
   * scrolls the answer is only true for the moment it was given.
   */
  place: Placer;
  /** The world rectangle he may walk in. */
  bounds: Bounds;
  /** True when the screen moved and his current spot is no longer free. */
  displaced?: boolean;
  /** Is this world point under page content? Used to route around it. */
  busyAt?: (x: number, y: number) => boolean;
  /** Scale for the props he carries with him. */
  objectScale: number;
  toolOffset: ToolOffset;
  onReady: (clipNames: string[]) => void;
  onTourState: (state: TourState) => void;
};

/* Scratch, so aiming the tool allocates nothing per frame. */
const _toolTarget = new THREE.Vector3();
const ZERO_ACCENT = { bob: 0, rollDeg: 0, leanDeg: 0 };
/* Scratch for the head look-at; allocated once, never per frame. */
const _headAt = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _lookQ = new THREE.Quaternion();
const _lookEuler = new THREE.Euler();

const TELEMETRY_INTERVAL = 0.25;
const MANUAL_FADE = 0.2;

/**
 * Blend lengths per phase.
 *
 * The moments that would give away clip-swapping are the ones where the whole
 * body changes what it is doing — walk into crouch, crouch back to standing —
 * so those get the longest. Arriving at a standing job blends walk straight
 * into the work pose, which is a smaller change and wants less time or he
 * appears to hesitate.
 */
const PHASE_FADE: Record<TourPhase, number> = {
  IDLE: 0.45,
  TRAVEL: 0.3,
  APPROACH: 0.28,
  TURN_TO: 0.32,
  WORK_IN: 0.4,
  WORK: 0.5,
  WORK_OUT: 0.38,
  ADMIRE: 0.42,
  REST: 0.45,
};

const LOOP_MODE: Record<LoopStyle, THREE.AnimationActionLoopStyles> = {
  once: THREE.LoopOnce,
  repeat: THREE.LoopRepeat,
  pingpong: THREE.LoopPingPong,
};

export default function FixterModel({
  position,
  rotationDeg,
  scale,
  manualClip,
  isPlaying,
  timeScale,
  stopToken,
  tour,
  jobs,
  place,
  bounds,
  displaced,
  busyAt,
  objectScale,
  toolOffset,
  onReady,
  onTourState,
}: FixterModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(FIXTER_GLB);
  const bvhs = useLoader(BVHLoader, MOTION_FILES);

  /*
   * One clone, for the one character that ever exists. SkeletonUtils.clone is
   * the skinned-mesh-aware copy; a plain .clone() leaves the meshes bound to
   * the source bones and the character collapses.
   */
  const model = useMemo(() => {
    const copy = cloneSkeleton(scene);
    copy.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) child.frustumCulled = false;
    });
    return copy;
  }, [scene]);

  /**
   * The head, for looking at things.
   *
   * Optional by design: if a future rig names it something else the character
   * simply keeps his head still, which is what he did before and is not a
   * failure worth breaking a page over.
   */
  const headBone = useMemo(() => {
    let found: THREE.Object3D | null = null;
    model.traverse((child) => {
      if (!found && child.name === "Head") found = child;
    });
    return found as THREE.Object3D | null;
  }, [model]);

  const handBone = useMemo(() => {
    let found: THREE.Object3D | null = null;
    model.traverse((child) => {
      if (!found && child.name === TOOL_ATTACH_BONE) found = child;
    });
    return found as THREE.Object3D | null;
  }, [model]);

  /*
   * Retarget each take once, then cut every clip out of the results.
   *
   * Cutting after retargeting matters: all clips from one take share a single
   * ground correction, so a crouch and the stand-up taken from it cannot
   * disagree about where the floor is. The takes arrive pre-trimmed to the
   * seconds actually used, so there is no wasted work here either.
   */
  const { clips: motionClips, loopStyles } = useMemo(() => {
    const retargeted = new Map<string, THREE.AnimationClip>();

    MOTION_FILES.forEach((file, index) => {
      const bvh = bvhs[index];
      if (!bvh) return;
      try {
        const probe = cloneSkeleton(scene);
        const { clip, report } = retargetClipRestCompensated(
          probe,
          bvh.skeleton.bones[0],
          bvh.clip,
          {
            names: MESHY_BVH_TO_FIXTER,
            hips: FIXTER_HIPS_BONE,
            rootTranslation: "hips",
            clipName: file,
          }
        );
        if (clip) {
          retargeted.set(file, clip);
          publishRetargetReport({ ...report, clipName: file.split("/").pop() ?? file });
        }
      } catch (error) {
        console.error(`[Fixter Lab] retarget failed for ${file}:`, error);
      }
    });

    const out: THREE.AnimationClip[] = [];
    const loops = new Map<string, LoopStyle>();
    for (const spec of allClipSpecs()) {
      const full = retargeted.get(spec.file);
      if (!full) continue;
      const cut = subclipByTime(full, spec.name, spec.start, spec.end);
      out.push(spec.reverse ? reverseClip(cut, spec.name) : cut);
      loops.set(spec.name, spec.loop);
    }
    return { clips: out, loopStyles: loops };
  }, [scene, bvhs]);

  const clips = useMemo(
    () => [...animations, ...motionClips],
    [animations, motionClips]
  );

  const { actions, mixer, names } = useAnimations(clips, groupRef);
  const roles = useMemo(() => resolveClipRoles(names), [names]);

  /**
   * Stops are resolved from the clips, not from `actions`.
   *
   * drei fills one `actions` object in place as clips register, so a memo keyed
   * on it computes once against an empty map and never re-runs — which silently
   * ran the crouch on a fallback duration once already.
   *
   * They carry no position now. Where a job happens is decided when he sets off
   * for it, because on a screen somebody is scrolling, any earlier answer has
   * already expired.
   */
  const stops: Stop[] = useMemo(() => {
    const seconds = (name: string) =>
      clips.find((clip) => clip.name === name)?.duration ?? 0;
    return buildStops(jobs, seconds);
  }, [clips, jobs]);

  const tourRef = useRef<TourRuntime | null>(null);
  const tokenRef = useRef(-1);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const telemetryClock = useRef(0);
  const diagClock = useRef(0);
  const frames = useRef(0);
  const lastEmitted = useRef<TourState | null>(null);

  const [phase, setPhase] = useState<TourPhase>("IDLE");
  const [stopIndex, setStopIndex] = useState(0);
  const [propJobId, setPropJobId] = useState<string | null>(null);
  const [beat, setBeat] = useState<string | null>(null);
  const lookRef = useRef(0);
  const propRef = useRef<THREE.Group>(null);
  const effectRef = useRef<THREE.Group>(null);
  /* Mirrored so the tool's aim callback can read it without being rebuilt. */
  const stopIndexRef = useRef(0);
  const [toolVisible, setToolVisible] = useState(false);

  useEffect(() => {
    onReady(names);
    setDiag({
      model: `loaded · ${names.length} clips`,
      motions: `loaded · ${bvhs.length} files`,
    });
  }, [names, onReady, bvhs.length]);

  const timeScaleRef = useRef(timeScale);
  useEffect(() => {
    timeScaleRef.current = timeScale;
    currentActionRef.current?.setEffectiveTimeScale(timeScale);
  }, [timeScale]);

  useEffect(() => {
    if (stopToken === 0) return;
    const action = currentActionRef.current;
    if (action) {
      action.time = 0;
      action.paused = true;
    }
    mixer.update(0);
  }, [stopToken, mixer]);

  /** The clip the current situation asks for. The tour outranks the selector. */
  const desiredClip = useMemo(() => {
    if (!tour) return manualClip;
    const stop = stops[stopIndex % Math.max(1, stops.length)];
    if (!stop) return roles.rest;
    const role = clipRoleForPhase(phase);
    if (role === "walk") return roles.walkInPlace;
    /* A pause is usually just a pause; occasionally it is a moment. */
    if (role === "idle") return phase === "REST" && beat ? beat : "Idle";
    const spec: ClipSpec | undefined =
      role === "work" ? stop.motion.clip
      : role === "workIn" ? stop.motion.enter
      : stop.motion.exit;
    return spec?.name ?? "Idle";
  }, [tour, stops, stopIndex, phase, roles, manualClip, beat]);

  const applyClip = useCallback(
    (clipName: string | null, fade: number) => {
      const next = clipName ? (actions[clipName] ?? null) : null;
      const current = currentActionRef.current;
      if (next === current) return;
      /*
       * Never fade out into nothing.
       *
       * A clip name that is not in the mixer used to fade the current action to
       * zero and put nothing in its place, which drops the rig to its bind pose
       * — the character stands in the middle of the hero with his arms straight
       * out like a scarecrow. Holding the previous clip is wrong too, but it is
       * wrong in a way nobody notices, and it cannot happen silently.
       */
      if (clipName && !next) {
        addDiagError(`clip missing: ${clipName}`);
        return;
      }
      if (current) {
        /*
         * Snap to full before fading out.
         *
         * three blends whatever weight is missing against the rig's bind pose,
         * so two actions that do not add up to one put a fraction of a T-pose
         * on screen. They stop adding up the moment a fade is interrupted by
         * another fade — and phases here are routinely shorter than the
         * quarter-second they cross-fade over, because TURN_TO can finish on
         * the first frame if he is already facing the right way.
         *
         * Forcing the outgoing action to full weight first costs a small pop in
         * that case, on a clip that was already being replaced. The alternative
         * is a man standing in the hero with his arms straight out.
         */
        current.setEffectiveWeight(1);
        current.fadeOut(fade);
      }
      if (next) {
        const style = loopStyles.get(clipName!) ?? "repeat";
        next
          .reset()
          .setLoop(LOOP_MODE[style], Infinity)
          .setEffectiveTimeScale(timeScaleRef.current)
          .setEffectiveWeight(1)
          .fadeIn(fade)
          .play();
      }
      currentActionRef.current = next;
    },
    [actions, loopStyles]
  );

  /*
   * A one-shot has to hold its last frame.
   *
   * Without this, three deactivates a LoopOnce action the instant it finishes
   * and the rig falls back to its bind pose — so "Crouch · In" would run, reach
   * the crouch, and drop the character into a T-pose in the middle of the hero
   * until the work clip picked him up. It is the enter and exit poses that need
   * it, and they are exactly the clips whose whole purpose is to arrive
   * somewhere and stay there.
   *
   * Set once per action rather than on every transition: it is a property of
   * the clip, not of the crossfade.
   */
  useEffect(() => {
    for (const [name, action] of Object.entries(actions)) {
      if (action) action.clampWhenFinished = loopStyles.get(name) === "once";
    }
  }, [actions, loopStyles]);

  useEffect(() => {
    applyClip(desiredClip, tour ? PHASE_FADE[phase] : MANUAL_FADE);
  }, [desiredClip, applyClip, tour, phase]);

  useEffect(() => {
    const action = currentActionRef.current;
    if (!action) return;
    action.paused = tour ? tour.paused : !isPlaying;
  }, [isPlaying, tour, desiredClip]);

  const currentStop = stops[stopIndex % Math.max(1, stops.length)];
  const toolKind = currentStop?.job.tool ?? null;
  const toolAction = currentStop ? actionFor(currentStop.job) : "none";
  const toolActionRef = useRef<ToolAction>("none");
  useEffect(() => {
    toolActionRef.current = toolAction;
  }, [toolAction]);
  const aim = currentStop?.motion.toolAimDeg ?? [0, 0, 0];

  /*
   * Live values the frame loop needs but must not re-subscribe to.
   *
   * The placer closes over the current safe-area reading and changes whenever
   * the page reflows; putting it in the dependency list of the render loop
   * would rebuild the loop mid-walk.
   */
  const propJob = propJobId ? jobs.find((j) => j.id === propJobId) : undefined;
  const propKind = propJob?.object ?? null;
  const propEffect = propJob?.effect ?? null;
  const propScale = propJob?.propScale ?? 1;
  const working = phase === "WORK";
  const propRotation = propJob?.objectRotationDeg ?? ([0, 0, 0] as [number, number, number]);

  const placeRef = useRef(place);
  const boundsRef = useRef(bounds);
  const displacedRef = useRef(displaced);
  const propScaleRef = useRef(1);
  useEffect(() => {
    propScaleRef.current = propScale;
  }, [propScale]);
  const busyRef = useRef(busyAt);
  useEffect(() => {
    busyRef.current = busyAt;
  }, [busyAt]);
  useEffect(() => {
    placeRef.current = place;
  }, [place]);
  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);
  useEffect(() => {
    displacedRef.current = displaced;
  }, [displaced]);

  /*
   * Where the tool should point, in world space.
   *
   * The WORK point, not the prop's drawn centre: the prop is deliberately
   * offset so its body misses his face, and aiming at the middle of it put the
   * screwdriver through his own hip.
   *
   * The prop and the character share a parent — the stage, or the page's scroll
   * layer — so the job's position becomes a world point through that parent's
   * matrix. Read live rather than captured, because on the page that parent
   * moves every time the document scrolls.
   */
  /** Seconds he has been working this job, for the tool's own rhythm. */
  const workTime = useCallback(() => {
    const runtime = tourRef.current;
    if (!runtime) return 0;
    const t = runtime.phase === "WORK" ? runtime.phaseElapsed : 0;
    if (process.env.NODE_ENV !== "production") {
      /* Lab only: lets the watcher photograph a hammer swing frame by frame. */
      const slow = (window as unknown as Record<string, number>).__fxSlow;
      if (slow) return t * slow;
    }
    return t;
  }, []);

  const toolTarget = useCallback((): THREE.Vector3 | null => {
    const parent = groupRef.current?.parent;
    const placed = tourRef.current?.placed;
    if (!parent || !placed) return null;
    return parent.localToWorld(_toolTarget.copy(placed.workPoint));
  }, []);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.1);

    if (tour && stops.length) {
      if (tokenRef.current !== tour.token) {
        tokenRef.current = tour.token;
        tourRef.current = createTourRuntime();
        lastEmitted.current = null;
      }
      const runtime = tourRef.current!;
      if (!tour.paused) {
        stepTour(runtime, stops, dt, {
          place: placeRef.current,
          characterScale: scale,
          objectScale,
          bounds: boundsRef.current,
          displaced: displacedRef.current,
          busyAt: busyRef.current,
        });
      }

      /*
       * The prop he is currently dealing with, carried with him rather than
       * scattered across the page.
       *
       * One at a time is a composition decision as much as a performance one:
       * six floating objects at once reads as a diagram, one reads as the thing
       * he noticed. It scales in as he sets off and out as he leaves, so the
       * screen is never cluttered with finished work.
       */
      const prop = propRef.current;
      if (prop) {
        if (runtime.placed) prop.position.copy(runtime.placed.object);
        const f = runtime.propFade;
        prop.scale.setScalar(
          objectScale * propScaleRef.current * (0.55 + 0.45 * f) * (f > 0.01 ? 1 : 0)
        );
        prop.visible = f > 0.01;
      }
      const fx = effectRef.current;
      if (fx) {
        if (runtime.placed) fx.position.copy(runtime.placed.workPoint);
        fx.visible = runtime.propFade > 0.4;
      }
      if (runtime.propJobId !== propJobId) setPropJobId(runtime.propJobId);
      if (runtime.beat !== beat) setBeat(runtime.beat);
      if (process.env.NODE_ENV !== "production") {
        /* Ground truth for the Lab's watcher: phase and prop from one frame. */
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = {
          ...t,
          livePhase: runtime.phase,
          liveJob: stops[runtime.stopIndex % stops.length]?.job.id ?? null,
          prop: runtime.propJobId,
          beat: runtime.beat,
          presence: Math.round(runtime.presence * 100) / 100,
          clip: currentActionRef.current?.getClip().name ?? null,
          fade: Math.round(runtime.propFade * 100) / 100,
        };
      }

      group.position.copy(runtime.position);
      /*
       * Yaw turns him toward where he is going; lean tips him into it, about
       * the camera axis so the tilt is actually visible on a flat stage. YXZ
       * order matters: the lean has to be applied in screen space, after the
       * turn, or turning would swing the lean out of the plane with it.
       */
      group.rotation.order = "YXZ";
      /*
       * The action reaches the shoulders.
       *
       * Added on top of the clip rather than replacing it: the retargeted take
       * supplies a working posture and this supplies the verb, which is the
       * only division of labour that survived two rounds of Text-to-Motion.
       */
      const accent =
        runtime.phase === "WORK"
          ? bodyAccent(toolActionRef.current, workTime(), scale)
          : ZERO_ACCENT;
      group.rotation.set(
        THREE.MathUtils.degToRad(accent.leanDeg),
        runtime.yaw,
        runtime.lean + THREE.MathUtils.degToRad(accent.rollDeg)
      );
      group.position.y += accent.bob;
      /*
       * Presence rides on the scale, the same treatment the props already get.
       * Cheap, needs no material work on a skinned mesh, and reads as stepping
       * out of shot rather than as a bug.
       */
      const present = runtime.presence;
      group.scale.setScalar(scale * (0.72 + 0.28 * present) * (present > 0.02 ? 1 : 0));
      group.visible = present > 0.02;

      /*
       * He looks at his own work.
       *
       * The pause after a repair was the weakest second in the loop: the thing
       * he had just straightened was hanging there fixed and he was staring
       * past the reader, which read less as satisfaction than as a man waiting
       * for a bus. A head that turns costs one quaternion and does most of the
       * work that a bespoke animation would have done.
       *
       * Applied after the mixer has written the clip's own rotation, and
       * blended in and out rather than switched, so the clip still owns the
       * pose and this is only a bias on top of it.
       */
      if (headBone) {
        const wantLook =
          runtime.phase === "ADMIRE" || runtime.phase === "WORK_OUT";
        lookRef.current = approachValue(
          lookRef.current,
          wantLook ? 1 : 0,
          dt,
          3.4
        );
        if (lookRef.current > 0.002 && runtime.placed) {
          headBone.getWorldPosition(_headAt);
          /* workPoint is in the parent's space, the same space he stands in. */
          _lookAt.copy(runtime.placed.workPoint);
          group.parent?.localToWorld(_lookAt);
          _lookDir.subVectors(_lookAt, _headAt).normalize();
          /*
           * Clamped hard. A head that can reach the target exactly will snap
           * round to something behind him on a bad frame, and an owl is worse
           * than an inattentive handyman.
           */
          const yawTo = THREE.MathUtils.clamp(
            Math.atan2(_lookDir.x, _lookDir.z) - runtime.yaw,
            -0.7,
            0.7
          );
          const pitchTo = THREE.MathUtils.clamp(Math.asin(_lookDir.y), -0.5, 0.75);
          _lookQ.setFromEuler(
            _lookEuler.set(-pitchTo * lookRef.current, yawTo * lookRef.current, 0, "YXZ")
          );
          headBone.quaternion.multiply(_lookQ);
        }
      }

      if (runtime.phase !== phase) setPhase(runtime.phase);
      stopIndexRef.current = runtime.stopIndex;
      if (runtime.stopIndex !== stopIndex) setStopIndex(runtime.stopIndex);

      /*
       * Stride rate follows travel speed. The walk is in place and the code
       * does the moving, so if the two disagree the feet skate — which they did
       * through every slow approach into a job.
       */
      const action = currentActionRef.current;
      if (action) {
        const walking = clipRoleForPhase(runtime.phase) === "walk";
        action.setEffectiveTimeScale(
          timeScaleRef.current * (walking ? runtime.gait : 1)
        );
      }
      if (runtime.toolEquipped !== toolVisible) setToolVisible(runtime.toolEquipped);
      setFixterPose(runtime.position, runtime.yaw);

      /*
       * Reported on change, not every frame: this lands in React state in the
       * control panel, and sixty updates a second would make the readout the
       * reason the frame rate dropped.
       */
      const stop = stops[runtime.stopIndex % stops.length];
      const bucket = Math.round(runtime.workProgress * 20) / 20;
      diagClock.current += dt;
      if (diagClock.current > 0.5) {
        diagClock.current = 0;
        setDiag({ tour: `${runtime.phase} · ${stop.job.label} · lap ${runtime.laps + 1}` });
      }
      const last = lastEmitted.current;
      if (
        !last ||
        last.phase !== runtime.phase ||
        last.jobId !== stop.job.id ||
        last.workProgress !== bucket ||
        last.jobsDone !== runtime.tick
      ) {
        const emitted: TourState = {
          phase: runtime.phase,
          jobId: stop.job.id,
          jobLabel: stop.job.label,
          clip: currentActionRef.current?.getClip().name ?? "-",
          tool: runtime.toolEquipped ? (stop.job.tool ?? "-") : "stowed",
          workProgress: bucket,
          jobsDone: runtime.tick,
          laps: runtime.laps,
        };
        lastEmitted.current = emitted;
        onTourState(emitted);
        /*
         * A window onto the tour, for the Lab's automated watching only.
         *
         * Judging a composition means screenshotting it and knowing what he was
         * doing at the shutter; without this the frames are unlabelled and I am
         * back to guessing. Costs one property write per phase change and goes
         * when the Lab does.
         */
        if (process.env.NODE_ENV !== "production") {
          const w = window as unknown as Record<string, unknown>;
          const t = (w.__fxTour ?? {}) as Record<string, unknown>;
          w.__fxTour = { ...t, phase: emitted.phase, job: emitted.jobId };
        }
      }
    } else {
      if (tokenRef.current !== -1) {
        tokenRef.current = -1;
        tourRef.current = null;
        setPhase("IDLE");
        setToolVisible(false);
      }
      group.position.set(position[0], position[1], position[2]);
      group.rotation.set(
        THREE.MathUtils.degToRad(rotationDeg[0]),
        THREE.MathUtils.degToRad(rotationDeg[1]),
        THREE.MathUtils.degToRad(rotationDeg[2])
      );
      group.scale.setScalar(scale);
    }

    frames.current += 1;
    telemetryClock.current += delta;
    if (telemetryClock.current >= TELEMETRY_INTERVAL) {
      const info = state.gl.info;
      publishTelemetry({
        fps: frames.current / telemetryClock.current,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        phase: tourRef.current?.phase ?? "IDLE",
        clip: currentActionRef.current?.getClip().name ?? "-",
        position: [group.position.x, group.position.y, group.position.z],
      });
      frames.current = 0;
      telemetryClock.current = 0;
    }
  });

  return (
    <>
      <ContactShadow follow={groupRef} scale={scale} />
      <group ref={propRef} visible={false}>
        {propJobId && propKind && (
          <FixableObject
            kind={propKind}
            id={propJobId}
            scale={1}
            position={[0, 0, 0]}
            rotationDeg={propRotation}
          />
        )}
      </group>
      {/*
        The flourish, parked on the work itself rather than on the prop, so a
        spark comes off the screw and not off the middle of the faceplate.
      */}
      <group ref={effectRef} visible={false}>
        <WorkEffect kind={propEffect} active={working} action={toolAction} getWorkTime={workTime} />
      </group>
      <group ref={groupRef}>
        <primitive object={model} />
      {handBone &&
        toolVisible &&
        toolKind &&
        createPortal(
          <AimedHandTool
            kind={toolKind}
            scale={TOOL_SCALE * toolOffset.scale}
            position={toolOffset.position}
            restRotationDeg={[
              aim[0] + toolOffset.rotationDeg[0],
              aim[1] + toolOffset.rotationDeg[1],
              aim[2] + toolOffset.rotationDeg[2],
            ]}
            getTarget={toolTarget}
            action={toolAction}
            getWorkTime={workTime}
            tracking
          />,
          handBone
        )}
      </group>
    </>
  );
}

/**
 * The shadow he stands on.
 *
 * A sibling rather than a child, so his lean and his turn do not tip it: a
 * shadow on a page stays flat on the page whatever the thing above it is doing.
 * It reads his position each frame from the same ref the character uses, which
 * is a frame behind nothing and costs one matrix.
 */
function ContactShadow({
  follow,
  scale,
}: {
  follow: React.RefObject<THREE.Group | null>;
  scale: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createContactShadow(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const mesh = ref.current;
    const target = follow.current;
    if (!mesh || !target) return;
    mesh.position.set(
      target.position.x,
      target.position.y + 0.02 * scale,
      target.position.z - 0.06
    );
  });

  return (
    <mesh ref={ref} scale={[0.62 * scale, 0.17 * scale, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        opacity={0.5}
      />
    </mesh>
  );
}

export { WORK_MOTIONS };
