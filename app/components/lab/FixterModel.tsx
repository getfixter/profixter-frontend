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
  CLIP_KNEEL_GLB,
  TOOL_ATTACH_BONE,
  TOOL_PALM,
  REST_ARM,
  TOOL_ROLL_DEG,
  TOOL_SCALE,
  WORK_MOTIONS,
  actionFor,
  handsFor,
  allClipSpecs,
  type ClipSpec,
  type JobDefinition,
  type LoopStyle,
} from "./lab-jobs";
import { retargetClipRestCompensated } from "./lab-retarget";
import {
  FIXTER_HIPS_BONE,
  MESHY_BVH_TO_FIXTER,
  MESHY_RIG_TO_FIXTER,
} from "./meshy-bone-map";
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
import WorkEffect, { PayoffBurst, type PayoffFlavour } from "./lab-effects";
import { setFixterPose } from "./lab-pose";
import { setObjectNudge } from "./lab-object-state";
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
  standable?: (
    feet: THREE.Vector3,
    propAt?: THREE.Vector3,
    propSpan?: number
  ) => boolean;
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
const _faceQ = new THREE.Quaternion();
const _propBox = new THREE.Box3();
const _propSize = new THREE.Vector3();
const _faceV = new THREE.Vector3();
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
  NOTICE: 0.34,
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
  /* The one take that came from the preset library rather than generation. */
  const kneelGltf = useGLTF(CLIP_KNEEL_GLB);

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
  /*
   * The bones that can end up touching the floor.
   *
   * Feet and toes for everything that stands or squats, and the shins because a
   * kneel rests on a knee — which is the shin's own origin on this rig.
   */
  const groundBones = useMemo(() => {
    const want = new Set([
      "LeftFoot", "RightFoot",
      "LeftToeBase", "RightToeBase",
      "LeftToe_end", "RightToe_end",
      "LeftLeg", "RightLeg",
    ]);
    const out: THREE.Object3D[] = [];
    model.traverse((node) => {
      if (want.has(node.name)) out.push(node);
    });
    return out;
  }, [model]);
  const armRight = useMemo(() => readArmChain(model, "Right"), [model]);
  const armLeft = useMemo(() => readArmChain(model, "Left"), [model]);
  const ikWeight = useRef(0);
  /** How much of the working arm is holding a tool on the way over. */
  const carryWeight = useRef(0);
  /** How far he has to drop for his lowest bone to reach the floor. */
  const groundFix = useRef(0);
  /** When the current repair snapped, on the frame clock. 0 = not yet. */
  const payoffAt = useRef(0);
  const payoffSeen = useRef<string | null>(null);

  /** Wrist to fingertip, so the tool can be held in the palm rather than the
      wrist. Read off the rig so a re-export with different proportions works. */
  const handLength = useMemo(() => {
    let len = 0.2;
    model.traverse((child) => {
      if (child.name === "RightHand_End") len = child.position.length();
    });
    return len;
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

    /*
     * The preset kneel, through the same door as everything else.
     *
     * It arrives on a Meshy re-rig of our own character, so the bone names
     * already match and a direct play would very nearly work. It still goes
     * through the rest-compensated retarget, because "very nearly" is how the
     * arms ended up behind his head the first time: the transfer is the
     * identity map when two rest poses agree, and the correct correction when
     * they do not.
     */
    const kneelClip = kneelGltf?.animations?.[0];
    const kneelRoot = kneelGltf?.scene?.getObjectByName("Hips");
    if (process.env.NODE_ENV !== "production") {
      const names: string[] = [];
      kneelGltf?.scene?.traverse((n) => names.push(n.name || "(unnamed)"));
      console.log(
        "[kneel] anims=", kneelGltf?.animations?.length,
        "clip=", kneelClip?.name,
        "root=", kneelRoot?.name,
        "nodes=", names.slice(0, 12).join(",")
      );
    }
    if (kneelClip && kneelRoot) {
      try {
        const probe = cloneSkeleton(scene);
        const { clip, report } = retargetClipRestCompensated(
          probe,
          kneelRoot,
          kneelClip,
          {
            names: MESHY_RIG_TO_FIXTER,
            hips: FIXTER_HIPS_BONE,
            rootTranslation: "hips",
            clipName: CLIP_KNEEL_GLB,
          }
        );
        if (clip) {
          retargeted.set(CLIP_KNEEL_GLB, clip);
          publishRetargetReport({ ...report, clipName: "fx-kneel.glb" });
        }
      } catch (error) {
        console.error("[Fixter Lab] retarget failed for the kneel:", error);
      }
    }

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
  }, [scene, bvhs, kneelGltf]);

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
  /** The repair already on the page that he has not walked to yet. */
  const [nextJobId, setNextJobId] = useState<string | null>(null);
  const [finishClip, setFinishClip] = useState<string | null>(null);
  const lookRef = useRef(0);
  const presenceRef = useRef(1);
  const propRef = useRef<THREE.Group>(null);
  const nextPropRef = useRef<THREE.Group>(null);
  const nextScaleRef = useRef(1);
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
  const jobHands = currentStop ? handsFor(currentStop.job) : 2;
  const handsRef = useRef<1 | 2>(2);
  useEffect(() => {
    handsRef.current = jobHands;
  }, [jobHands]);
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
  /* Which trade the payoff beat should look like. */
  const payoffFlavour: PayoffFlavour =
    propJob?.category === "electrical"
      ? "electrical"
      : propJob?.category === "plumbing"
        ? "plumbing"
        : "settle";
  const nextJob = nextJobId ? jobs.find((j) => j.id === nextJobId) : undefined;
  const nextKind = nextJob?.object ?? null;
  const nextRotation =
    nextJob?.objectRotationDeg ?? ([0, 0, 0] as [number, number, number]);

  const placeRef = useRef(place);
  const boundsRef = useRef(bounds);
  const displacedRef = useRef(displaced);
  const propScaleRef = useRef(1);
  useEffect(() => {
    propScaleRef.current = propScale;
  }, [propScale]);
  const nextPropScale = nextJob?.propScale ?? 1;
  useEffect(() => {
    nextScaleRef.current = nextPropScale;
  }, [nextPropScale]);
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

    /*
     * Nothing on screen until a clip is actually driving him.
     *
     * The clip is applied from an effect, and effects run after the first
     * paint: for a frame or two after the model loads, the rig is in its bind
     * pose and the bind pose of this character is a full T. On a cold load that
     * lands about a second in — a dark scarecrow in the middle of the hero,
     * inside the three seconds that matter most, on the one view where a
     * visitor has no idea yet what they are looking at.
     *
     * He is not a character until something is animating him, so he does not
     * appear until then. It costs a frame of nothing, which is invisible; the
     * alternative is not.
     */
    if (!currentActionRef.current) {
      group.visible = false;
      return;
    }
    group.visible = true;

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
        /*
         * Barely any scale.
         *
         * It used to come in from just over half size, which is a pop — the one
         * unmistakable tell that an object was spawned rather than noticed. A
         * few per cent reads as settling; anything more reads as arriving.
         */
        prop.scale.setScalar(
          objectScale * propScaleRef.current * (0.94 + 0.06 * f) * (f > 0.01 ? 1 : 0)
        );
        prop.visible = f > 0.01;
      }
      const staged = nextPropRef.current;
      if (staged) {
        const n = runtime.nextFade;
        if (runtime.nextPlaced) staged.position.copy(runtime.nextPlaced.object);
        staged.scale.setScalar(
          objectScale * nextScaleRef.current * (0.94 + 0.06 * n) * (n > 0.01 ? 1 : 0)
        );
        staged.visible = n > 0.01;
      }
      if (runtime.nextJobId !== nextJobId) setNextJobId(runtime.nextJobId);
      /*
       * The instant the repair lands.
       *
       * repairCurve holds the damage and then snaps at 0.72 of the way through
       * the work, so that crossing is the moment — not the end of the phase,
       * which is nearly a second later and by then nobody is looking for it.
       */
      if (
        runtime.propJobId &&
        runtime.workProgress >= 0.72 &&
        payoffSeen.current !== runtime.propJobId
      ) {
        payoffSeen.current = runtime.propJobId;
        payoffAt.current = state.clock.elapsedTime;
      }
      if (!runtime.propJobId) payoffSeen.current = null;

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
      /* The object's half of the test: it gives, and then it holds. */
      if (runtime.propJobId) {
        setObjectNudge(runtime.propJobId, beatPose?.nudge ?? 0);
      }
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
      /*
       * How much of each arm the work has taken, so the rest can be filled in.
       *
       * Whatever the repair does not claim falls back to the clip, and the
       * clips' own arms are the weakest thing in the whole character: every
       * retargeted take holds them forward with the palms down and the fingers
       * splayed, which at any size reads as a man sleepwalking. It is in the
       * frame for most of the loop — every pause, every approach, and the spare
       * arm of every one-handed job — so it is worth more than any new verb.
       */
      let claimRight = 0;
      let claimLeft = 0;
      if (ikWeight.current > 0.004 && runtime.placed && armRight) {
        const motion = stops[runtime.stopIndex % stops.length]?.motion;
        /* Overhead is a different shape of help; the plan needs to know. */
        const overhead = motion?.overhead === true;
        const crouching = motion?.crouched === true;

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
              crouched: crouching,
              effort: stops[runtime.stopIndex % stops.length]?.job.effort ?? 0.5,
            }),
            scale,
            ikWeight.current
          );
        }
        group.updateMatrixWorld(true);

        /*
         * Put whatever is lowest on the floor.
         *
         * The retarget transfers the source's hip translation, which is correct
         * for a character with the source's proportions and wrong for ours: the
         * standing takes land within a couple of hundredths of the ground, and
         * both new low stances hovered a third of a unit above it — a fifth of
         * his own height, with a shadow underneath and nothing touching it.
         *
         * This is not a foot IK system and does not need to be. Nothing here
         * walks while it works; the feet are planted for the whole of a job. So
         * the correction is one number: find the lowest bone, and drop him by
         * however far it is from his own origin. A squat lands on its toes, a
         * kneel lands on its knee, and standing is left alone because standing
         * was already right.
         *
         * Smoothed, because the measurement changes as he settles into a pose
         * and a hard correction would read as the floor moving.
         */
        let lowest = Infinity;
        for (const bone of groundBones) {
          bone.getWorldPosition(_probe);
          group.worldToLocal(_probe);
          if (_probe.y < lowest) lowest = _probe.y;
        }
        if (lowest < Infinity) {
          groundFix.current = approachValue(groundFix.current, lowest, dt, 6);
          group.position.y -= groundFix.current * scale;
          group.updateMatrixWorld(true);
        }

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
          orientHand(armRight, _handAim, ikWeight.current * 0.85, TOOL_ROLL_DEG);
          claimRight = ikWeight.current;
        }

        if (process.env.NODE_ENV !== "production") {
          /* Lab only: how far the solver missed, for the watcher. */
          const w = window as unknown as Record<string, unknown>;
          const t = (w.__fxTour ?? {}) as Record<string, unknown>;
          armRight.hand.getWorldPosition(_probe);
          const parentInv = group.parent;
          const local = _probe.clone();
          if (parentInv) parentInv.worldToLocal(local);
          (window as unknown as Record<string, unknown>).__fxHandWorld = {
            x: local.x,
            y: local.y,
          };
          w.__fxTour = {
            ...t,
            ik: `w=${ikWeight.current.toFixed(2)} miss=${_probe.distanceTo(_handW).toFixed(3)}`,
            spineX: bodyRig ? +THREE.MathUtils.radToDeg(bodyRig.spine[0].rotation.x).toFixed(1) : null,
            neckX: bodyRig?.neck ? +THREE.MathUtils.radToDeg(bodyRig.neck.rotation.x).toFixed(1) : null,
            finish: runtime.finish,
            finishAt: +runtime.finishAt.toFixed(2),
            progress: +runtime.workProgress.toFixed(3),
            /* Seconds since the repair snapped. The fire TIME stays set for the
               rest of the job, so a probe that waits for it non-zero catches a
               frame long after the beat has finished — which it did, twice. */
            payoffAge: payoffAt.current
              ? +(state.clock.elapsedTime - payoffAt.current).toFixed(2)
              : -1,
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
            /* In his own units: localToWorld already applies his scale, and
               pre-multiplying by it as well put every beat target short. */
            _handW.set(beatPose.work[0], beatPose.work[1], beatPose.work[2]);
            group.localToWorld(_handW);
            solveArm(armRight, _handW, _poleR, ikWeight.current * beatPose.weight);
            claimRight = ikWeight.current * beatPose.weight;
          }
          if (armLeft && beatPose.off) {
            _offW.set(beatPose.off[0], beatPose.off[1], beatPose.off[2]);
            group.localToWorld(_offW);
            armLeft.upper.getWorldPosition(_poleL);
            _poleL.x += 1.1 * scale;
            _poleL.y -= 0.6 * scale;
            _poleL.z -= 0.25 * scale;
            solveArm(armLeft, _offW, _poleL, ikWeight.current * beatPose.weight);
            claimLeft = ikWeight.current * beatPose.weight;
          }
        } else if (armLeft && plan.offWeight > 0.01) {
          /*
           * Crouched and working one-handed, the spare hand goes on his knee.
           *
           * Every off-hand target used to be expressed relative to the WORK,
           * which is right when both hands are on the job — two hands on a
           * drill, two hands shoving a cabinet door — and badly wrong when only
           * one of them is. On the crouched jobs it left the left arm hanging
           * out in front of him, palm down and fingers splayed, reaching for
           * something that was not there: at any size above a thumbnail it read
           * as a dead limb, and it was in almost every frame of the two longest
           * jobs.
           *
           * A man crouched over a socket braces on his own knee. It is what the
           * pose is FOR — it is where the weight goes — and it costs one bone
           * lookup, because the rig already knows where his knee is.
           */
          const oneHanded = handsRef.current === 1;
          const knee = crouching && oneHanded ? bodyRig?.shins[1] : null;
          /*
           * Standing and one-handed, it goes to his belt.
           *
           * The off-hand target is expressed relative to the WORK, which is
           * right for the jobs that genuinely take two — two hands on a drill,
           * two shoving a cabinet door — and produced a floating karate chop
           * for the ones that do not: an arm held out in front of his chest,
           * palm down, a foot below the thing he was actually working on,
           * touching nothing.
           *
           * Nobody holds a spare hand there. Crouched, it goes on the knee;
           * standing, it goes to the belt — which is where a tradesman's spare
           * hand lives, and which reads as a stance rather than an accident.
           */
          const belt = !crouching && oneHanded;
          if (knee) {
            knee.getWorldPosition(_offW);
            _offW.y += 0.13 * scale;
            _offW.z += 0.09 * scale;
          } else if (belt) {
            _offW.set(0.215, 0.93, 0.035);
            group.localToWorld(_offW);
          }
          const own = knee || belt;
          armLeft.upper.getWorldPosition(_poleL);
          _poleL.x += (own ? 0.72 : 0.55 + plan.elbow) * scale;
          _poleL.y -= (own ? 0.72 : 0.5 + plan.elbow * 0.4) * scale;
          _poleL.z -= (own ? 0.5 : 0.25) * scale;
          claimLeft = ikWeight.current * (own ? 0.9 : plan.offWeight);
          solveArm(armLeft, _offW, _poleL, claimLeft);
          if (own) {
            /* Fingers down onto the knee or the belt, not out at the work. */
            _handAim.copy(_offW);
            _handAim.y -= 0.34 * scale;
            orientHand(armLeft, _handAim, ikWeight.current * 0.8);
          } else {
            /* Rolled the other way from the tool hand, for the same reason:
               fingers that cannot close look thinner edge-on than palm-on. */
            orientHand(
              armLeft,
              _workW,
              ikWeight.current * plan.offWeight * 0.7,
              -TOOL_ROLL_DEG
            );
          }
        }
      }

      /*
       * A tool is carried, not swung.
       *
       * He picks the drill up before he sets off on the heavy jobs, which was
       * the right call and looked wrong: the walk clip swings both arms through
       * the same arc, so a cordless drill went round like an empty hand and
       * read as a man waving a lump of plastic. Anyone carrying something heavy
       * holds that arm still and lets the other one do the swinging.
       *
       * So the working arm is taken down to his hip and held there for the
       * journey — never quite rigid, a little of the walk still coming through
       * — and handed straight back the moment there is real work to solve.
       */
      const carrying =
        runtime.toolEquipped &&
        (runtime.phase === "NOTICE" ||
          runtime.phase === "TRAVEL" ||
          runtime.phase === "APPROACH");
      carryWeight.current = approachValue(
        carryWeight.current,
        carrying ? 1 : 0,
        dt,
        5
      );
      if (carryWeight.current > 0.01 && armRight && ikWeight.current < 0.06) {
        const bob = Math.sin(state.clock.elapsedTime * 6.4 * runtime.gait);
        _handW.set(-0.25, 0.79 + bob * 0.012, 0.11 + bob * 0.015);
        group.localToWorld(_handW);
        armRight.upper.getWorldPosition(_poleR);
        _poleR.x -= 0.85 * scale;
        _poleR.y -= 0.75 * scale;
        _poleR.z -= 0.3 * scale;
        const carryW = carryWeight.current * 0.7;
        solveArm(armRight, _handW, _poleR, carryW);
        claimRight = Math.max(claimRight, carryW);
      }

      /*
       * Everything the job has not claimed, put at his sides.
       *
       * Not a pose so much as a correction: the arms are solved to hang where
       * arms hang, with the fingers turned down instead of presented to camera.
       * It runs at whatever weight is left over, so it never fights the work —
       * a hand on a socket is claimed at full and gets none of this, the spare
       * hand of a one-handed job gets all of it, and the handover either way is
       * the same ramp the work already uses.
       *
       * Held off while he is walking, because the walk take is one of the four
       * that came with the rig and its arms actually swing.
       */
      const walkingNow =
        runtime.phase === "TRAVEL" || runtime.phase === "APPROACH";
      const restArms = walkingNow ? 0 : 1;
      if (restArms > 0 && armRight) {
        const breath = state.clock.elapsedTime;
        /* Never quite still, never symmetrical: both are what make a model. */
        const sway = Math.sin(breath * 0.85) * 0.009;
        const drift = Math.sin(breath * 0.61 + 1.3) * 0.013;
        /* Only fill an arm the work has left alone. Layering this on top of a
           half-claimed arm averages two poses into a third that is neither,
           which is how the spare hand ended up mid-air in the first place. */
        const spare = (claim: number) => Math.max(0, 1 - claim * 4) * REST_ARM;
        const fillR = spare(claimRight);
        if (fillR > 0.01) {
          _handW.set(-0.243, 0.795 + sway, 0.02 + drift);
          group.localToWorld(_handW);
          armRight.upper.getWorldPosition(_poleR);
          _poleR.x -= 0.62 * scale;
          _poleR.y -= 0.85 * scale;
          _poleR.z -= 0.34 * scale;
          solveArm(armRight, _handW, _poleR, fillR);
          _handAim.copy(_handW);
          _handAim.y -= 0.4 * scale;
          orientHand(armRight, _handAim, fillR * 0.9);
        }
        const fillL = spare(claimLeft);
        if (armLeft && fillL > 0.01) {
          _offW.set(0.238, 0.785 - sway, 0.014 - drift);
          group.localToWorld(_offW);
          armLeft.upper.getWorldPosition(_poleL);
          _poleL.x += 0.62 * scale;
          _poleL.y -= 0.85 * scale;
          _poleL.z -= 0.34 * scale;
          solveArm(armLeft, _offW, _poleL, fillL);
          _handAim.copy(_offW);
          _handAim.y -= 0.4 * scale;
          orientHand(armLeft, _handAim, fillL * 0.9);
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
      } else if (
        headBone &&
        runtime.placed &&
        (runtime.phase === "NOTICE" ||
          runtime.phase === "TRAVEL" ||
          runtime.phase === "APPROACH")
      ) {
        /*
         * The head leads the walk.
         *
         * He looks where he is going before his feet get there, which is what
         * makes travel read as purpose rather than as transport. Stronger while
         * he is noticing, easing off once he is actually on his way.
         */
        lookRef.current = approachValue(lookRef.current, 1, dt, 5);
        _lookAt.copy(runtime.placed.workPoint);
        _lookAt.y += 0.3 * scale;
        _lookAt.z += 0.7 * scale;
        group.parent?.localToWorld(_lookAt);
        aimHead(
          headBone,
          _lookAt,
          /*
           * Look, walk, look again.
           *
           * Full attention while he notices it, then the head releases into the
           * walk — nobody stares at a doorway for the whole distance to it —
           * and then it comes back as he closes the last stretch. That last
           * look is the one that makes an arrival an arrival rather than a
           * stop: he has seen where he is going before he gets there, and a
           * visitor has seen him see it.
           */
          lookRef.current *
            (runtime.phase === "NOTICE"
              ? 0.85
              : runtime.phase === "APPROACH"
                ? 0.8
                : 0.42),
          46
        );
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
          const motionNow = stops[runtime.stopIndex % stops.length]?.motion;
          const crouchedNow = motionNow?.crouched === true;
          /*
           * The cheat is about how far he is folded, not about his height.
           *
           * It was keyed to crouching, which covered the squat and missed the
           * two stances that stand up straight and then bend over — and those
           * bury the face exactly as thoroughly. A stance that needs most of
           * the head's range to recover the face needs the bigger target too;
           * they are two halves of the same correction.
           */
          const folded = crouchedNow || (motionNow?.headMaxDeg ?? 52) > 60;
          _lookAt.y += (folded ? 0.78 : 0.34) * scale;
          _lookAt.z += (folded ? 1.05 : 0.6) * scale;
          group.parent?.localToWorld(_lookAt);
          /*
           * Crouched, the cap still won.
           *
           * The cheat was there and the head was still pointing at the floor,
           * because the limit is the clamp rather than the target: the take
           * folds him over further than the default fifty-two degrees can undo,
           * so the correction ran out before his face came back. A crouch is
           * the one pose that needs the whole range, and it is also the pose
           * where a person really does crane their neck up.
           */
          aimHead(
            headBone,
            _lookAt,
            lookRef.current *
              (runtime.phase === "ADMIRE" ? 0.95 : folded ? 0.92 : 0.72),
            motionNow?.headMaxDeg ?? 52
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
          w.__fxTour = {
            ...t,
            phase: emitted.phase,
            job: emitted.jobId,
            /* Published here, at the end of the frame, because the arms are
               claimed in stages and reading them halfway through reports the
               left one as untouched no matter what it is doing. */
            claims: `R=${claimRight.toFixed(2)} L=${claimLeft.toFixed(2)}`,
          };
          /* Lab only: what the mixer is actually blending, and how much of it.
             Anything short of 1 is a fraction of the bind pose on screen. */
          let sum = 0;
          const live: string[] = [];
          for (const name of names) {
            const a = actions[name];
            /* isScheduled, not isRunning: a clamped one-shot is paused on its
               last frame and still contributes its full weight to the blend,
               and an action that was never played is still `enabled`. Only the
               mixer's active list says what is really being blended. */
            if (!a || !a.isScheduled()) continue;
            const wt = a.getEffectiveWeight();
            if (wt <= 0.001) continue;
            sum += wt;
            live.push(`${name}=${wt.toFixed(2)}`);
          }
          w.__fxBlend = { sum: +sum.toFixed(3), live };
          /* Lab only: how far the lowest bone sits from his own origin, which
             is where the floor is. Negative means he is through it. */
          if (bodyRig) {
            let lowest = Infinity;
            let which = "";
            let top = -Infinity, left = Infinity, right = -Infinity;
            model.traverse((n) => {
              if (!(n as THREE.Bone).isBone) return;
              n.getWorldPosition(_probe);
              group.worldToLocal(_probe);
              if (_probe.y < lowest) { lowest = _probe.y; which = n.name; }
              if (_probe.y > top) top = _probe.y;
              if (_probe.x < left) left = _probe.x;
              if (_probe.x > right) right = _probe.x;
            });
            /* How much of his face is pointed at the camera: the head's own
               forward against the view axis. 1 is straight at you, 0 is the
               top of the cap. */
            if (headBone) {
              headBone.getWorldQuaternion(_faceQ);
              _faceV.set(0, 0, 1).applyQuaternion(_faceQ);
              w.__fxFace = +_faceV.z.toFixed(2);
            }
            /* Lab only: what the renderer is actually doing, so "context" cannot
             quietly become eleven miniature rooms. */
          const info = state.gl.info;
          w.__fxCost = {
            calls: info.render.calls,
            tris: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs ? info.programs.length : 0,
          };
          /*
           * Lab only: the prop's own footprint on screen.
           *
           * Every check until now measured HIS box against the page's text,
           * which was reasonable while the props were a faceplate or a rod.
           * They are a sink and a door now — two to three times the size — and
           * nothing was watching whether the thing he is fixing covers the
           * website.
           */
          const propGroup = propRef.current;
          if (propGroup && propGroup.visible) {
            _propBox.setFromObject(propGroup);
            if (!_propBox.isEmpty()) {
              _propBox.getCenter(_probe);
              _propBox.getSize(_propSize);
              w.__fxProp = {
                x: +_probe.x.toFixed(3),
                y: +_probe.y.toFixed(3),
                w: +_propSize.x.toFixed(3),
                h: +_propSize.y.toFixed(3),
              };
            }
          }
          w.__fxBox = {
              h: +(top - lowest).toFixed(2),
              w: +(right - left).toFixed(2),
            };
            /* Local Y is invariant to moving the group, so the correction
               itself has to be reported next to it or the probe reads the
               same number before and after the fix. */
            w.__fxFloor = {
              lowest: +lowest.toFixed(3),
              bone: which,
              fix: +groundFix.current.toFixed(3),
            };
          }
          w.__fxClips = clips.map((c) => ({
            name: c.name,
            dur: +c.duration.toFixed(2),
            tracks: c.tracks.length,
            arm: c.tracks.filter((t) => /Arm|Hand|Shoulder/.test(t.name)).length,
            bones: [...new Set(c.tracks.map((t) => t.name.split(".")[0]))].length,
          }));
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
        The next repair, already on the page.
        It eases in while he is still finishing the last one, so by the time he
        turns to look there is something there to look at rather than something
        arriving because he looked.
      */}
      <group ref={nextPropRef} visible={false}>
        {nextJobId && nextKind && (
          <FixableObject
            kind={nextKind}
            id={nextJobId}
            scale={1}
            position={[0, 0, 0]}
            rotationDeg={nextRotation}
          />
        )}
      </group>
      {/*
        The flourish, parked on the work itself rather than on the prop, so a
        spark comes off the screw and not off the middle of the faceplate.
      */}
      <group ref={effectRef} visible={false}>
        <WorkEffect kind={propEffect} active={working} action={toolAction} getWorkTime={workTime} />
        <PayoffBurst flavour={payoffFlavour} getFiredAt={() => payoffAt.current} />
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
            position={[
              toolOffset.position[0],
              toolOffset.position[1] + handLength * TOOL_PALM,
              toolOffset.position[2],
            ]}
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
