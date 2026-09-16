"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { handPlan, type ToolAction } from "./lab-action";
import { readArmChain, solveArm, orientHand, aimHead } from "./lab-ik";
import { readBodyRig, bodyPose, applyBodyPose, applyFinishPose } from "./lab-body";
import { finishPose, FINISH_CLIP } from "./lab-finish";
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
  busyAt?: (x: number, y: number) => number;
  perch?: () => THREE.Vector3 | null;
  standable?: (feet: THREE.Vector3) => boolean;
  /** Scale for the props he carries with him. */
  objectScale: number;
  toolOffset: ToolOffset;
  onReady: (clipNames: string[]) => void;
  onTourState: (state: TourState) => void;
};

/* Scratch, so aiming the tool allocates nothing per frame. */
const _toolTarget = new THREE.Vector3();
/* Scratch for the arm solve; allocated once. */
const _handAim = new THREE.Vector3();
const _workW = new THREE.Vector3();
const _handW = new THREE.Vector3();
const _offW = new THREE.Vector3();
const _poleR = new THREE.Vector3();
const _poleL = new THREE.Vector3();
const _probe = new THREE.Vector3();
/* Scratch for the head look-at and the arm solve; allocated once. */
const _lookAt = new THREE.Vector3();

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
  perch,
  standable,
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

  /* Lab only: lets the watcher measure the rig without guessing at it. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as Record<string, unknown>).__fxRig = model;
  }, [model]);

  /**
   * The two arms, as solvable chains.
   *
   * Null if the rig is not what we expect, in which case everything below is
   * skipped and the clips drive the arms exactly as they did before. A missing
   * bone should cost a feature, not the page.
   */
  const bodyRig = useMemo(() => readBodyRig(model), [model]);
  const armRight = useMemo(() => readArmChain(model, "Right"), [model]);
  const armLeft = useMemo(() => readArmChain(model, "Left"), [model]);
  const ikWeight = useRef(0);

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
  const { clips: motionClips, loopStyles, clipSpeeds } = useMemo(() => {
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
    const speeds = new Map<string, number>();
    for (const spec of allClipSpecs()) {
      const full = retargeted.get(spec.file);
      if (!full) continue;
      const cut = subclipByTime(full, spec.name, spec.start, spec.end);
      out.push(spec.reverse ? reverseClip(cut, spec.name) : cut);
      loops.set(spec.name, spec.loop);
      if (spec.speed) speeds.set(spec.name, spec.speed);
    }
    return { clips: out, loopStyles: loops, clipSpeeds: speeds };
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
  const [finishClip, setFinishClip] = useState<string | null>(null);
  const lookRef = useRef(0);
  const presenceRef = useRef(1);
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
    /* A pause is a pause; the moment belongs to the end of the repair. */
    if (role === "idle") {
      return phase === "ADMIRE" && finishClip ? finishClip : "Idle";
    }
    const spec: ClipSpec | undefined =
      role === "work" ? stop.motion.clip
      : role === "workIn" ? stop.motion.enter
      : stop.motion.exit;
    return spec?.name ?? "Idle";
  }, [tour, stops, stopIndex, phase, roles, manualClip, finishClip]);

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
          .setEffectiveTimeScale(timeScaleRef.current * (clipSpeeds.get(clipName!) ?? 1))
          .setEffectiveWeight(1)
          .fadeIn(fade)
          .play();
      }
      currentActionRef.current = next;
    },
    [actions, loopStyles, clipSpeeds]
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
  const perchRef = useRef(perch);
  useEffect(() => {
    perchRef.current = perch;
  }, [perch]);
  const standableRef = useRef(standable);
  useEffect(() => {
    standableRef.current = standable;
  }, [standable]);
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
          perch: perchRef.current,
          standable: standableRef.current,
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
      const wantFinishClip =
        runtime.phase === "ADMIRE" ? FINISH_CLIP[runtime.finish] ?? null : null;
      if (wantFinishClip !== finishClip) setFinishClip(wantFinishClip);
      if (process.env.NODE_ENV !== "production") {
        /* Ground truth for the Lab's watcher: phase and prop from one frame. */
        const w = window as unknown as Record<string, unknown>;
        const t = (w.__fxTour ?? {}) as Record<string, unknown>;
        w.__fxTour = {
          ...t,
          livePhase: runtime.phase,
          liveJob: stops[runtime.stopIndex % stops.length]?.job.id ?? null,
          prop: runtime.propJobId,
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
       * The character as a whole only turns and leans into travel now.
       *
       * The effort used to be a tilt on the entire figure, which is a puppet
       * being rocked rather than a person working. It lives in the spine, the
       * pelvis and the knees now — see applyBodyPose — so applying it here as
       * well would count it twice.
       */
      group.rotation.set(0, runtime.yaw, runtime.lean);
      /*
       * Presence rides on the scale, the same treatment the props already get.
       * Cheap, needs no material work on a skinned mesh, and reads as stepping
       * out of shot rather than as a bug.
       */
      const present = runtime.presence;
      presenceRef.current = present;
      /* Smaller while he waits out a page with no room to work on. */
      const small = 1 - 0.34 * runtime.smallness;
      group.scale.setScalar(
        scale * small * (0.72 + 0.28 * present) * (present > 0.02 ? 1 : 0)
      );
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
      /*
       * The arms, solved to the work.
       *
       * Runs after the mixer has written the clip, so the take supplies the
       * stance — crouched, standing, reaching — and the arms are driven to
       * where the repair actually is. This is the part the four clips could
       * never do: it is why the hammer winds up through the shoulder and why
       * the drill is held in two hands instead of being hidden behind them.
       */
      const finishing = runtime.phase === "ADMIRE";
      const beatPose = finishing
        ? finishPose(runtime.finish, runtime.finishAt)
        : null;
      const working =
        runtime.phase === "WORK" ||
        runtime.phase === "WORK_IN" ||
        runtime.phase === "WORK_OUT" ||
        (finishing && (beatPose?.weight ?? 0) > 0.02);
      /*
       * In fast, out slower.
       *
       * At a symmetrical rate the first second of every job was spent half way
       * between the clip's arms and the solved ones, which is the one blend
       * that looks like neither. Arriving takes a third of a second; handing the
       * arms back as he stands up can afford to be gentle.
       */
      ikWeight.current = approachValue(
        ikWeight.current,
        working && runtime.placed ? 1 : 0,
        dt,
        working ? 11 : 5
      );
      if (ikWeight.current > 0.004 && runtime.placed && armRight) {
        const motion = stops[runtime.stopIndex % stops.length]?.motion;
        /* Overhead is a different shape of help; the plan needs to know. */
        const overhead = motion?.overhead === true;

        /*
         * The body first, then the arms.
         *
         * Where the shoulder ends up decides what the arm has to do to reach
         * the work, so the spine, pelvis and knees are posed before the solve
         * rather than after it. Doing it the other way round means solving to a
         * shoulder that is about to move.
         */
        if (bodyRig && beatPose) {
          applyFinishPose(
            bodyRig,
            beatPose.liftDeg,
            beatPose.nodDeg,
            beatPose.backStep
          );
        }
        if (bodyRig && !beatPose) {
          applyBodyPose(
            bodyRig,
            bodyPose(toolActionRef.current, workTime(), {
              overhead,
              crouched: motion?.id === "low",
              effort: stops[runtime.stopIndex % stops.length]?.job.effort ?? 0.5,
            }),
            scale,
            ikWeight.current
          );
        }
        group.updateMatrixWorld(true);
        const plan = handPlan(toolActionRef.current, workTime(), overhead);

        const parent = group.parent;
        const placed = runtime.placed;

        _workW.copy(placed.workPoint);
        /*
         * Turn the plan into x and y using the direction the tool points.
         *
         * "Push" means toward the work along the approach, "lift" means across
         * it — both in the screen plane, which is the only place motion is
         * visible under a camera this close to head on.
         */
        const approach = THREE.MathUtils.degToRad(
          stops[runtime.stopIndex % stops.length]?.job.toolApproachDeg ?? 0
        );
        const ca = Math.cos(approach);
        const sa = Math.sin(approach);
        _handW.copy(placed.handAt);
        _handW.x += (plan.push * ca - plan.lift * sa) * scale;
        _handW.y += (plan.push * sa + plan.lift * ca) * scale;
        _handW.z += plan.depth * scale;
        _offW.copy(placed.workPoint);
        _offW.x += plan.off[0] * scale;
        _offW.y += plan.off[1] * scale;
        _offW.z += plan.off[2] * scale;
        if (parent) {
          parent.localToWorld(_workW);
          parent.localToWorld(_handW);
          parent.localToWorld(_offW);
        }

        /*
         * Elbows out and down, away from the ribs. Derived from where the hand
         * is rather than fixed, so reaching overhead swings the elbow outward
         * instead of leaving it pinned behind him.
         */
        armRight.upper.getWorldPosition(_poleR);
        /* Elbows point away from the body: his right is -x, his left is +x.
           Signed the other way, each elbow was hauled across his own chest. */
        /*
         * Reaching up, the elbow has to go WIDE or the forearm crosses his own
         * face — which is the posture this whole exercise exists to kill.
         */
        const wide = overhead ? 1.5 : 0.55 + plan.elbow;
        _poleR.x -= wide * scale;
        _poleR.y -= (overhead ? 0.9 : 0.5 + plan.elbow * 0.4) * scale;
        _poleR.z -= 0.25 * scale;
        const beatOwnsArms = !!beatPose && beatPose.weight > 0.02;
        if (!beatOwnsArms) {
          solveArm(armRight, _handW, _poleR, ikWeight.current);
          _handAim.copy(_workW);
          orientHand(armRight, _handAim, ikWeight.current * 0.85);
        }

        if (process.env.NODE_ENV !== "production") {
          /* Lab only: how far the solver missed, for the watcher. */
          const w = window as unknown as Record<string, unknown>;
          const t = (w.__fxTour ?? {}) as Record<string, unknown>;
          armRight.hand.getWorldPosition(_probe);
          w.__fxTour = {
            ...t,
            ik: `w=${ikWeight.current.toFixed(2)} miss=${_probe.distanceTo(_handW).toFixed(3)}`,
            spineX: bodyRig ? +THREE.MathUtils.radToDeg(bodyRig.spine[0].rotation.x).toFixed(1) : null,
            neckX: bodyRig?.neck ? +THREE.MathUtils.radToDeg(bodyRig.neck.rotation.x).toFixed(1) : null,
            finish: runtime.finish,
            finishAt: +runtime.finishAt.toFixed(2),
            hy: +_probe.y.toFixed(4),
            hx: +_probe.x.toFixed(4),
          };
        }
        /*
         * During the ending, the hands stop being about the repair.
         *
         * Their targets are given in HIS frame rather than the work's — hands
         * to the belt, a hand reaching back out to test the thing he just
         * fixed — because what a man does once it is done is about him, not
         * about the object. Solved after the work targets so it wins.
         */
        if (beatOwnsArms && beatPose) {
          if (beatPose.work) {
            _handW.set(
              beatPose.work[0] * scale,
              beatPose.work[1] * scale,
              beatPose.work[2] * scale
            );
            group.localToWorld(_handW);
            solveArm(armRight, _handW, _poleR, ikWeight.current * beatPose.weight);
          }
          if (armLeft && beatPose.off) {
            _offW.set(
              beatPose.off[0] * scale,
              beatPose.off[1] * scale,
              beatPose.off[2] * scale
            );
            group.localToWorld(_offW);
            armLeft.upper.getWorldPosition(_poleL);
            _poleL.x += 1.1 * scale;
            _poleL.y -= 0.6 * scale;
            _poleL.z -= 0.25 * scale;
            solveArm(armLeft, _offW, _poleL, ikWeight.current * beatPose.weight);
          }
        } else if (armLeft && plan.offWeight > 0.01) {
          armLeft.upper.getWorldPosition(_poleL);
          _poleL.x += (0.55 + plan.elbow) * scale;
          _poleL.y -= (0.5 + plan.elbow * 0.4) * scale;
          _poleL.z -= 0.25 * scale;
          solveArm(armLeft, _offW, _poleL, ikWeight.current * plan.offWeight);
          orientHand(armLeft, _workW, ikWeight.current * plan.offWeight * 0.7);
        }
      }

      /*
       * He looks at what he is doing, and then at what he has done.
       *
       * Running while he works as well as afterwards, because the clips bend
       * him over far enough that his cap fills the frame and the face — the
       * whole appeal of the character — disappears. A head aimed at the work
       * sits level over a cabinet and tips back under a ceiling fixture, which
       * is both more legible and more like a person.
       */
      /*
       * While he waits, he has a look around.
       *
       * A character standing perfectly still in a gap for thirty seconds reads
       * as a sprite somebody forgot to remove. A head that drifts — left, back,
       * off toward wherever he is going next — costs one sine wave and is the
       * difference between waiting and being switched off. Slow on purpose: the
       * waiting must never be more interesting than the repairs.
       */
      if (headBone && runtime.perch && runtime.smallness > 0.4) {
        const drift = state.clock.elapsedTime * 0.28;
        _lookAt.set(
          Math.sin(drift) * 1.4,
          0.9 + Math.sin(drift * 0.7) * 0.25,
          2.2
        );
        _lookAt.multiplyScalar(scale).add(group.position);
        group.parent?.localToWorld(_lookAt);
        lookRef.current = approachValue(lookRef.current, 1, dt, 2.2);
        aimHead(headBone, _lookAt, lookRef.current * 0.55, 40);
      } else if (headBone && runtime.placed) {
        const looking =
          runtime.phase === "WORK" ||
          runtime.phase === "WORK_IN" ||
          runtime.phase === "WORK_OUT" ||
          runtime.phase === "ADMIRE";
        lookRef.current = approachValue(
          lookRef.current,
          looking ? 1 : 0,
          dt,
          4.2
        );
        if (lookRef.current > 0.004) {
          /*
           * Aimed a little above the work, and a little toward the viewer.
           *
           * Looking exactly at what his hands are doing is correct and looks
           * terrible: on every crouched job it points the top of his cap at the
           * camera and the face — which is the entire appeal of the character —
           * disappears. Animators cheat this for the same reason. The intent
           * still reads as "he is watching his own hands"; the audience just
           * gets to see him doing it.
           */
          _lookAt.copy(runtime.placed.workPoint);
          /* Crouched needs more of the cheat: he is folded over the work and
             the camera is above him, so there is further to lift. */
          const crouchedNow =
            stops[runtime.stopIndex % stops.length]?.motion.id === "low";
          _lookAt.y += (crouchedNow ? 0.62 : 0.34) * scale;
          _lookAt.z += (crouchedNow ? 0.85 : 0.6) * scale;
          group.parent?.localToWorld(_lookAt);
          aimHead(
            headBone,
            _lookAt,
            lookRef.current * (runtime.phase === "ADMIRE" ? 0.95 : 0.72)
          );
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
      <ContactShadow follow={groupRef} scale={scale} presence={presenceRef} />
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
  presence,
}: {
  follow: React.RefObject<THREE.Group | null>;
  scale: number;
  /** Reads the same presence the character does, so it leaves when he does. */
  presence: React.RefObject<number>;
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
    /*
     * A shadow with nobody casting it.
     *
     * On a page with no room for him he fades out and this stayed behind — a
     * grey smudge sitting under the pricing table, which is exactly the kind of
     * detail that makes the whole thing read as a widget rather than a person.
     */
    const here = presence.current ?? 1;
    mesh.visible = here > 0.02;
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * here;
    mesh.scale.set(0.62 * scale * (0.7 + 0.3 * here), 0.17 * scale * (0.7 + 0.3 * here), 1);
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
