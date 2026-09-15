"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useLoader } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { FIXTER_GLB, resolveClipRoles } from "./lab-config";
import {
  JOBS,
  MOTION_FILES,
  TOOL_ATTACH_BONE,
  TOOL_SCALE,
  WORK_MOTIONS,
  allClipSpecs,
  type ClipSpec,
  type JobDefinition,
  type LoopStyle,
} from "./lab-jobs";
import type { LayoutId } from "./lab-stage";
import { retargetClipRestCompensated } from "./lab-retarget";
import { FIXTER_HIPS_BONE, MESHY_BVH_TO_FIXTER } from "./meshy-bone-map";
import { reverseClip, subclipByTime } from "./lab-clip-utils";
import { publishRetargetReport, publishTelemetry } from "./lab-telemetry";
import {
  buildTour,
  clipRoleForPhase,
  type AnchorResolver,
  createTourRuntime,
  stepTour,
  type TourPhase,
  type TourRuntime,
  type TourStop,
} from "./lab-choreography";
import HandTool from "./lab-tools";
import { resetObjectFix } from "./lab-object-state";
import { setFixterPose } from "./lab-pose";

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
  /** Which stage arrangement to walk, and the live viewport shape. */
  layout: LayoutId;
  aspect: number;
  /**
   * Where the jobs are, when they are not on the empty stage.
   *
   * Both are supplied together by the homepage experiment: the job list it
   * wants, and the function that asks the DOM where each one lives. Left out,
   * he walks the stage exactly as before. `anchorVersion` exists so a reflow
   * can invalidate the tour without changing the identity of the resolver.
   */
  jobs?: JobDefinition[];
  anchorFor?: AnchorResolver;
  anchorVersion?: number;
  toolOffset: ToolOffset;
  onReady: (clipNames: string[]) => void;
  onTourState: (state: TourState) => void;
};

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
  COMPLETE: 0.42,
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
  layout,
  aspect,
  jobs,
  anchorFor,
  anchorVersion = 0,
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
   */
  const stops: TourStop[] = useMemo(() => {
    const seconds = (name: string) =>
      clips.find((clip) => clip.name === name)?.duration ?? 0;
    /* anchorVersion is a dependency, not an argument: a reflow moves the marks
       without changing the resolver that reads them. */
    void anchorVersion;
    return anchorFor
      ? buildTour(jobs ?? [], layout, aspect, scale, seconds, anchorFor)
      : buildTour(JOBS, layout, aspect, scale, seconds);
  }, [clips, layout, aspect, scale, jobs, anchorFor, anchorVersion]);

  const tourRef = useRef<TourRuntime | null>(null);
  const tokenRef = useRef(-1);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const telemetryClock = useRef(0);
  const frames = useRef(0);
  const lastEmitted = useRef<TourState | null>(null);

  const [phase, setPhase] = useState<TourPhase>("IDLE");
  const [stopIndex, setStopIndex] = useState(0);
  const [toolVisible, setToolVisible] = useState(false);

  useEffect(() => {
    onReady(names);
  }, [names, onReady]);

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
    if (role === "idle") return "Idle";
    const spec: ClipSpec | undefined =
      role === "work" ? stop.motion.clip
      : role === "workIn" ? stop.motion.enter
      : stop.motion.exit;
    return spec?.name ?? "Idle";
  }, [tour, stops, stopIndex, phase, roles, manualClip]);

  const applyClip = useCallback(
    (clipName: string | null, fade: number) => {
      const next = clipName ? (actions[clipName] ?? null) : null;
      const current = currentActionRef.current;
      if (next === current) return;
      if (current) current.fadeOut(fade);
      if (next) {
        next
          .reset()
          .setLoop(LOOP_MODE[loopStyles.get(clipName!) ?? "repeat"], Infinity)
          .setEffectiveTimeScale(timeScaleRef.current)
          .setEffectiveWeight(1)
          .fadeIn(fade)
          .play();
      }
      currentActionRef.current = next;
    },
    [actions, loopStyles]
  );

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
  const aim = currentStop?.motion.toolAimDeg ?? [0, 0, 0];

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.1);

    if (tour && stops.length) {
      if (tokenRef.current !== tour.token) {
        tokenRef.current = tour.token;
        tourRef.current = createTourRuntime(stops);
        lastEmitted.current = null;
        resetObjectFix();
      }
      const runtime = tourRef.current!;
      if (!tour.paused) stepTour(runtime, stops, dt);

      group.position.copy(runtime.position);
      /*
       * Yaw turns him toward where he is going; lean tips him into it, about
       * the camera axis so the tilt is actually visible on a flat stage. YXZ
       * order matters: the lean has to be applied in screen space, after the
       * turn, or turning would swing the lean out of the plane with it.
       */
      group.rotation.order = "YXZ";
      group.rotation.set(0, runtime.yaw, runtime.lean);
      group.scale.setScalar(scale);

      if (runtime.phase !== phase) setPhase(runtime.phase);
      if (runtime.stopIndex !== stopIndex) setStopIndex(runtime.stopIndex);
      if (runtime.toolEquipped !== toolVisible) setToolVisible(runtime.toolEquipped);
      setFixterPose(runtime.position, runtime.yaw);

      /*
       * Reported on change, not every frame: this lands in React state in the
       * control panel, and sixty updates a second would make the readout the
       * reason the frame rate dropped.
       */
      const stop = stops[runtime.stopIndex % stops.length];
      const bucket = Math.round(runtime.workProgress * 20) / 20;
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
    <group ref={groupRef}>
      <primitive object={model} />
      {handBone &&
        toolVisible &&
        toolKind &&
        createPortal(
          <group
            position={toolOffset.position}
            rotation={[
              THREE.MathUtils.degToRad(aim[0] + toolOffset.rotationDeg[0]),
              THREE.MathUtils.degToRad(aim[1] + toolOffset.rotationDeg[1]),
              THREE.MathUtils.degToRad(aim[2] + toolOffset.rotationDeg[2]),
            ]}
          >
            <HandTool kind={toolKind} scale={TOOL_SCALE * toolOffset.scale} />
          </group>,
          handBone
        )}
    </group>
  );
}

export { WORK_MOTIONS };
