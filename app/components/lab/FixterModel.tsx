"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, useFrame, useLoader } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import {
  FIXTER_GLB,
  MESHY_MOTIONS,
  resolveClipRoles,
  type MovementMode,
} from "./lab-config";
import {
  IDLE_BVH,
  REPAIR_ARC_BVH,
  SQUAT_WORK_BVH,
  SEQUENCE_CLIPS,
  SOURCE_WINDOWS,
  TOOL_ATTACH_BONE,
  type LoopStyle,
} from "./lab-jobs";
import { retargetClipRestCompensated } from "./lab-retarget";
import { FIXTER_HIPS_BONE, MESHY_BVH_TO_FIXTER } from "./meshy-bone-map";
import { reverseClip, subclipByTime } from "./lab-clip-utils";
import { publishRetargetReport, publishTelemetry } from "./lab-telemetry";
import {
  clipRoleForPhase,
  createSequenceRuntime,
  stepSequence,
  type JobDefinition,
  type SequencePhase,
  type SequenceRuntime,
} from "./lab-choreography";
import Screwdriver from "./Screwdriver";
import {
  createTravelRuntime,
  isMoving,
  stepTravel,
  type TaskAnchor,
  type TravelPhase,
  type TravelRuntime,
} from "./lab-travel";

useGLTF.preload(FIXTER_GLB);

/** Every BVH the Lab loads: two diagnostics takes, two sequence sources. */
const BVH_FILES = [
  ...MESHY_MOTIONS.map((m) => m.file),
  REPAIR_ARC_BVH,
  SQUAT_WORK_BVH,
  IDLE_BVH,
];

export type TravelCommand = {
  token: number;
  anchors: TaskAnchor[];
  start: [number, number, number];
  loop: boolean;
};

export type SequenceCommand = {
  token: number;
  job: JobDefinition;
  paused: boolean;
};

export type ToolOffset = {
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scale: number;
};

export type SequenceState = {
  phase: SequencePhase;
  workProgress: number;
  objectFixed: boolean;
  toolEquipped: boolean;
  done: boolean;
};

export type FixterModelProps = {
  position: [number, number, number];
  rotationDeg: [number, number, number];
  scale: number;
  manualClip: string | null;
  isPlaying: boolean;
  timeScale: number;
  stopToken: number;
  travel: TravelCommand | null;
  movementMode: MovementMode;
  travelSpeed: number;
  sequence: SequenceCommand | null;
  toolOffset: ToolOffset;
  onReady: (clipNames: string[]) => void;
  onTravelEnd: (position: [number, number, number], yawDeg: number) => void;
  onSequenceState: (state: SequenceState) => void;
};

const TELEMETRY_INTERVAL = 0.25;
const CROSSFADE = 0.2;
/**
 * Longer fades for the choreography than for flicking between clips by hand.
 * The brief is that he reads as one persistent character, and the two places
 * that would betray that are walk→crouch and crouch→stand, so those get the
 * most time to blend.
 */
const SEQUENCE_FADE: Partial<Record<SequencePhase, number>> = {
  TRAVEL: 0.3,
  APPROACH: 0.25,
  TURN_TO: 0.35,
  WORK_IN: 0.4,
  WORK: 0.6,
  WORK_OUT: 0.35,
  COMPLETE: 0.45,
  TURN_AWAY: 0.3,
  TRAVEL_AWAY: 0.3,
  DONE: 0.5,
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
  travel,
  movementMode,
  travelSpeed,
  sequence,
  toolOffset,
  onReady,
  onTravelEnd,
  onSequenceState,
}: FixterModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(FIXTER_GLB);
  const bvhs = useLoader(BVHLoader, BVH_FILES);

  /*
   * One clone for display. SkeletonUtils.clone is the skinned-mesh-aware copy:
   * a plain .clone() leaves the meshes bound to the source bones and the
   * character collapses. Exactly one of these ever exists.
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
   * Retarget every source take once, then cut the choreography out of the
   * results. Cutting AFTER retargeting matters: all segments taken from one
   * take then share a single ground correction, so crouching and standing
   * cannot disagree about where the floor is.
   *
   * Only the windows the sequence needs are retargeted — the repair take came
   * back 50 seconds long and the choreography uses the first 12.5.
   */
  const { clips: meshyClips, loopStyles } = useMemo(() => {
    const out: THREE.AnimationClip[] = [];
    const loops = new Map<string, LoopStyle>();
    const fullByFile = new Map<string, THREE.AnimationClip>();

    BVH_FILES.forEach((file, index) => {
      const bvh = bvhs[index];
      if (!bvh) return;
      try {
        const window = SOURCE_WINDOWS[file];
        const source = window
          ? subclipByTime(bvh.clip, "window", window[0], window[1])
          : bvh.clip;

        const probe = cloneSkeleton(scene);
        const { clip, report } = retargetClipRestCompensated(
          probe,
          bvh.skeleton.bones[0],
          source,
          {
            names: MESHY_BVH_TO_FIXTER,
            hips: FIXTER_HIPS_BONE,
            rootTranslation: "hips",
            clipName: file,
          }
        );
        if (!clip) return;
        fullByFile.set(file, clip);

        const motion = MESHY_MOTIONS.find((m) => m.file === file);
        if (motion) {
          clip.name = motion.clipName;
          out.push(clip);
          loops.set(motion.clipName, "repeat");
          publishRetargetReport({ ...report, clipName: motion.clipName });
        } else {
          publishRetargetReport(report);
        }
      } catch (error) {
        console.error(`[Fixter Lab] retarget failed for ${file}:`, error);
      }
    });

    for (const spec of Object.values(SEQUENCE_CLIPS)) {
      const full = fullByFile.get(spec.file);
      if (!full) continue;
      const cut = subclipByTime(full, spec.name, spec.start, spec.end);
      out.push(spec.reverse ? reverseClip(cut, spec.name) : cut);
      loops.set(spec.name, spec.loop);
    }

    return { clips: out, loopStyles: loops };
  }, [scene, bvhs]);

  const clips = useMemo(
    () => [...animations, ...meshyClips],
    [animations, meshyClips]
  );

  const { actions, mixer, names } = useAnimations(clips, groupRef);
  const roles = useMemo(() => resolveClipRoles(names), [names]);

  /**
   * How long the one-shot beats last, read from the real clips.
   *
   * Each hands over one fade-length EARLY. A LoopOnce action that actually
   * reaches its end disables itself and drops out of the mix instantly, so
   * starting the blend before the clip runs out is both correct animation
   * practice and what keeps the crouch from popping as it hands off to the
   * work loop.
   */
  const phaseDurations = useMemo(() => {
    /*
     * Read from `clips`, not from `actions`.
     *
     * drei hands back one `actions` object and fills it in as clips register,
     * so a memo keyed on it computes once against an empty map and never runs
     * again — which silently ran the crouch on the 1.8s fallback instead of its
     * real 4.0s clip. The clips array is replaced when it changes, so it is the
     * honest dependency.
     */
    const durationOf = (name: string) =>
      clips.find((clip) => clip.name === name)?.duration;
    const inDuration = durationOf(SEQUENCE_CLIPS.workIn.name) ?? 1.8;
    const outDuration = durationOf(SEQUENCE_CLIPS.workOut.name) ?? 1.8;
    return {
      workIn: Math.max(0.25, inDuration - (SEQUENCE_FADE.WORK ?? 0.45)),
      workOut: Math.max(0.25, outDuration - (SEQUENCE_FADE.COMPLETE ?? 0.45)),
    };
  }, [clips]);

  const travelRef = useRef<TravelRuntime | null>(null);
  const travelTokenRef = useRef(-1);
  const seqRef = useRef<SequenceRuntime | null>(null);
  const seqTokenRef = useRef(-1);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const telemetryClockRef = useRef(0);
  const frameCountRef = useRef(0);
  const endReportedRef = useRef(false);
  const lastEmittedRef = useRef<SequenceState | null>(null);

  const [travelPhase, setTravelPhase] = useState<TravelPhase>("IDLE");
  const [seqPhase, setSeqPhase] = useState<SequencePhase>("IDLE");
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

  /** Which clip the current situation asks for. Sequence outranks everything. */
  const desiredClip = useMemo(() => {
    if (sequence) {
      const role = clipRoleForPhase(seqPhase);
      if (role === "walk") return roles.walkInPlace;
      return SEQUENCE_CLIPS[role]?.name ?? roles.rest;
    }
    if (travel && isMoving(travelPhase)) {
      return movementMode === "animated" ? roles.walkInPlace : roles.rootMotion;
    }
    if (travel) return roles.rest ?? manualClip;
    return manualClip;
  }, [sequence, seqPhase, travel, travelPhase, movementMode, roles, manualClip]);

  const applyClip = useCallback(
    (clipName: string | null, fade: number) => {
      const next = clipName ? (actions[clipName] ?? null) : null;
      const current = currentActionRef.current;
      if (next === current) return;

      if (current) current.fadeOut(fade);
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
   * The blend length is chosen per phase, not globally: the two moments that
   * would betray this as clip-swapping rather than one character are
   * walk -> crouch and crouch -> stand, so those get the longest fades.
   */
  useEffect(() => {
    const fade = sequence ? (SEQUENCE_FADE[seqPhase] ?? 0.3) : CROSSFADE;
    applyClip(desiredClip, fade);
  }, [desiredClip, applyClip, sequence, seqPhase]);

  useEffect(() => {
    const action = currentActionRef.current;
    if (!action) return;
    action.paused = sequence ? sequence.paused : travel ? false : !isPlaying;
  }, [isPlaying, travel, sequence, desiredClip]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.1);

    /* ---------------- sequence ---------------- */
    if (sequence) {
      if (seqTokenRef.current !== sequence.token) {
        seqTokenRef.current = sequence.token;
        seqRef.current = createSequenceRuntime(sequence.job);
        lastEmittedRef.current = null;
      }
      const runtime = seqRef.current!;
      if (!sequence.paused) {
        stepSequence(runtime, sequence.job, phaseDurations, dt);
      }

      group.position.copy(runtime.position);
      group.rotation.set(0, runtime.yaw, 0);
      group.scale.setScalar(scale);

      if (runtime.phase !== seqPhase) setSeqPhase(runtime.phase);
      if (runtime.toolEquipped !== toolVisible) setToolVisible(runtime.toolEquipped);

      /*
       * Reported on change, not every frame.
       *
       * This callback lands in React state in the control panel; at sixty
       * calls a second it would re-render the whole panel continuously and the
       * readout would become the reason the frame rate dropped. Work progress
       * is quantised to 5% because the only thing downstream of it is the
       * outlet, which eases toward its target on its own.
       */
      const last = lastEmittedRef.current;
      const bucket = Math.round(runtime.workProgress * 20) / 20;
      if (
        !last ||
        last.phase !== runtime.phase ||
        last.toolEquipped !== runtime.toolEquipped ||
        last.objectFixed !== runtime.objectFixed ||
        last.done !== runtime.done ||
        last.workProgress !== bucket
      ) {
        const emitted: SequenceState = {
          phase: runtime.phase,
          workProgress: bucket,
          objectFixed: runtime.objectFixed,
          toolEquipped: runtime.toolEquipped,
          done: runtime.done,
        };
        lastEmittedRef.current = emitted;
        onSequenceState(emitted);
      }
    } else {
      if (seqTokenRef.current !== -1) {
        seqTokenRef.current = -1;
        seqRef.current = null;
        setSeqPhase("IDLE");
        setToolVisible(false);
      }

      /* ---------------- manual travel ---------------- */
      if (travel && travelTokenRef.current !== travel.token) {
        travelTokenRef.current = travel.token;
        endReportedRef.current = false;
        const started = createTravelRuntime(travel.start);
        started.phase = "TRAVEL";
        travelRef.current = started;
      } else if (!travel && travelTokenRef.current !== -1) {
        travelTokenRef.current = -1;
        travelRef.current = null;
      }

      const runtime = travelRef.current;
      const translateInCode = movementMode !== "rootMotion";

      if (runtime && runtime.phase !== "IDLE" && travel) {
        stepTravel(
          runtime,
          travel.anchors,
          { speed: travelSpeed, translateInCode, loop: travel.loop },
          dt
        );
        if (translateInCode) group.position.copy(runtime.position);
        else group.position.set(travel.start[0], travel.start[1], travel.start[2]);
        group.rotation.set(
          THREE.MathUtils.degToRad(rotationDeg[0]),
          runtime.yaw,
          THREE.MathUtils.degToRad(rotationDeg[2])
        );
        if (runtime.finished && !endReportedRef.current) {
          endReportedRef.current = true;
          onTravelEnd(
            [group.position.x, group.position.y, group.position.z],
            THREE.MathUtils.radToDeg(runtime.yaw)
          );
        }
      } else {
        group.position.set(position[0], position[1], position[2]);
        group.rotation.set(
          THREE.MathUtils.degToRad(rotationDeg[0]),
          THREE.MathUtils.degToRad(rotationDeg[1]),
          THREE.MathUtils.degToRad(rotationDeg[2])
        );
      }
      group.scale.setScalar(scale);

      const nextPhase = travel && runtime ? runtime.phase : "IDLE";
      if (nextPhase !== travelPhase) setTravelPhase(nextPhase);
    }

    /* ---------------- telemetry ---------------- */
    frameCountRef.current += 1;
    telemetryClockRef.current += delta;
    if (telemetryClockRef.current >= TELEMETRY_INTERVAL) {
      const info = state.gl.info;
      publishTelemetry({
        fps: frameCountRef.current / telemetryClockRef.current,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        phase: sequence ? "TRAVEL" : (travelRef.current?.phase ?? "IDLE"),
        clip: currentActionRef.current?.getClip().name ?? "-",
        position: [group.position.x, group.position.y, group.position.z],
      });
      frameCountRef.current = 0;
      telemetryClockRef.current = 0;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
      {handBone &&
        toolVisible &&
        createPortal(
          <group
            position={toolOffset.position}
            rotation={[
              THREE.MathUtils.degToRad(toolOffset.rotationDeg[0]),
              THREE.MathUtils.degToRad(toolOffset.rotationDeg[1]),
              THREE.MathUtils.degToRad(toolOffset.rotationDeg[2]),
            ]}
          >
            <Screwdriver scale={toolOffset.scale} />
          </group>,
          handBone
        )}
    </group>
  );
}
