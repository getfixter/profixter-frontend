"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useLoader, useThree } from "@react-three/fiber";
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
  TOOL_SCALE,
  DEFAULT_ACTION,
  allClipSpecs,
  type LoopStyle,
} from "./lab-jobs";
import { PAGE_CAMERA_TILT } from "./lab-page-jobs";
import { retargetClipRestCompensated } from "./lab-retarget";
import {
  FIXTER_HIPS_BONE,
  MESHY_BVH_TO_FIXTER,
  MESHY_RIG_TO_FIXTER,
} from "./meshy-bone-map";
import { reverseClip, subclipByTime } from "./lab-clip-utils";
import { AimedHandTool } from "./lab-tools";
import { createContactShadow } from "./lab-materials";
import FixableObject from "./lab-objects";
import { setObjectFix, resetObjectFix } from "./lab-object-state";
import { setDiag } from "./lab-diagnostics";
import {
  WORLD_SPOTS,
  clipForBeat,
  createWorldRuntime,
  layoutWorld,
  stepWorld,
  type WorldMark,
  type WorldRuntime,
} from "./lab-world";

useGLTF.preload(FIXTER_GLB);

/**
 * THE LITTLE WORLD, drawn.
 *
 * One viewport, six broken things, one man. The scene is deliberately thin: it
 * lays the composition out, loads the character, and hands every frame to a
 * state machine small enough to read in one sitting. No safe areas, no DOM
 * scanning, no placement search, no document anchoring — the world is fixed to
 * the screen, and the website simply scrolls behind it.
 */

/** World units per CSS pixel, and how big he is in those units. */
const NARROW_AT = 560;

function sizing(width: number) {
  const narrow = width < NARROW_AT;
  return {
    narrow,
    unitPx: narrow ? 104 : 132,
    /*
     * Small. A phone is 390 wide and has to hold six repairs, the man, and the
     * website underneath all of it — so he is about a tenth of the screen, and
     * the props are sized against him rather than against the page.
     */
    characterScale: narrow ? 0.58 : 0.72,
    /*
     * Objects, relative to him.
     *
     * Lower than the page scene used, and that is the "iconic, not miniature
     * rooms" correction: at the old ratio the wall and tile patches behind the
     * bigger props ran to half the width of a phone, and a repair that covers
     * half the screen is furniture, not a detail.
     */
    objectRatio: 2.9,
  };
}

const LOOP_MODE: Record<LoopStyle, THREE.AnimationActionLoopStyles> = {
  once: THREE.LoopOnce,
  repeat: THREE.LoopRepeat,
  pingpong: THREE.LoopPingPong,
};

/* Scratch, so the frame loop allocates nothing. */
const _shadowAt = new THREE.Vector3();

/**
 * A module function rather than an inline effect, because the React Compiler
 * (correctly) refuses to see a value that arrived through a hook mutated in
 * place — and a camera is by nature a mutable the renderer already owns.
 */
function configureCamera(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  unitPx: number
) {
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.near = -400;
  camera.far = 900;
  /* Zoom IS pixels per world unit under an orthographic camera, which is what
     lets the composition be written in fractions of the viewport. */
  camera.zoom = unitPx;
  camera.position.set(PAGE_CAMERA_TILT.x, PAGE_CAMERA_TILT.y, PAGE_CAMERA_TILT.z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function WorldCamera() {
  const { camera, size } = useThree();
  const { unitPx } = sizing(size.width);
  useEffect(() => {
    configureCamera(
      camera as THREE.OrthographicCamera,
      size.width,
      size.height,
      unitPx
    );
  }, [camera, size.width, size.height, unitPx]);
  return null;
}

/**
 * The shadow he stands on.
 *
 * A sibling rather than a child so his turn does not swing it, and the one
 * piece of grounding the scene has: without it a character on a white page
 * reads as a sticker rather than as somebody standing there.
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
  useFrame(() => {
    const target = follow.current;
    const mesh = ref.current;
    if (!target || !mesh) return;
    _shadowAt.copy(target.position);
    mesh.position.set(_shadowAt.x, _shadowAt.y + 0.012, _shadowAt.z - 0.05);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2.06, 0, 0]}>
      <planeGeometry args={[1.5 * scale, 1.0 * scale]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function WorldFixter({
  marks,
  characterScale,
  onBeat,
}: {
  marks: WorldMark[];
  characterScale: number;
  onBeat: (runtime: WorldRuntime) => void;
}) {
  const { scene, animations } = useGLTF(FIXTER_GLB);
  const bvhs = useLoader(BVHLoader, MOTION_FILES);
  const kneelGltf = useGLTF(CLIP_KNEEL_GLB);
  const groupRef = useRef<THREE.Group>(null);

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

  const handLength = useMemo(() => {
    let len = 0.2;
    model.traverse((child) => {
      if (child.name === "RightHand_End") len = child.position.length();
    });
    return len;
  }, [model]);

  /*
   * The motion library, retargeted once.
   *
   * This is the part of the old system worth every line it cost: the takes are
   * transferred onto our rig with the rest poses reconciled, then cut into the
   * named clips the performance asks for. Unchanged from the touring version —
   * the animation was never the thing that was wrong.
   */
  const { clips: motionClips, loopStyles, clipSpeeds } = useMemo(() => {
    const retargeted = new Map<string, THREE.AnimationClip>();
    MOTION_FILES.forEach((file, index) => {
      const bvh = bvhs[index];
      if (!bvh) return;
      try {
        const probe = cloneSkeleton(scene);
        const { clip } = retargetClipRestCompensated(
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
        if (clip) retargeted.set(file, clip);
      } catch {
        /* A missing take costs one stance, not the scene. */
      }
    });

    const kneelClip = kneelGltf?.animations?.[0];
    const kneelRoot = kneelGltf?.scene?.getObjectByName("Hips");
    if (kneelClip && kneelRoot) {
      try {
        const probe = cloneSkeleton(scene);
        const { clip } = retargetClipRestCompensated(probe, kneelRoot, kneelClip, {
          names: MESHY_RIG_TO_FIXTER,
          hips: FIXTER_HIPS_BONE,
          rootTranslation: "hips",
          clipName: CLIP_KNEEL_GLB,
        });
        if (clip) retargeted.set(CLIP_KNEEL_GLB, clip);
      } catch {
        /* As above. */
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
  const { actions, names } = useAnimations(clips, groupRef);
  const roles = useMemo(() => resolveClipRoles(names), [names]);

  useEffect(() => {
    for (const [name, action] of Object.entries(actions)) {
      if (action) action.clampWhenFinished = loopStyles.get(name) === "once";
    }
  }, [actions, loopStyles]);

  useEffect(() => {
    setDiag({ model: `world · ${names.length} clips` });
  }, [names.length]);

  /* The performance. Created once per composition, and it runs to the end. */
  const runtime = useMemo(() => createWorldRuntime(marks), [marks]);
  useEffect(() => {
    resetObjectFix();
  }, [runtime]);

  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const currentName = useRef<string | null>(null);
  const [toolKind, setToolKind] = useState(WORLD_SPOTS[0]?.tool ?? null);

  useFrame((_, rawDelta) => {
    /*
     * A ceiling on the step, not a throttle on the performance.
     *
     * At a twentieth of a second this quietly halved the whole show on any
     * renderer below twenty frames — every slow frame advanced the story by
     * less time than had actually passed, so a forty-second sequence took
     * eighty. A tenth is still short enough to stop a backgrounded tab
     * teleporting him across the screen on its first frame back.
     */
    const dt = Math.min(0.1, rawDelta);
    const group = groupRef.current;
    if (!group || !marks.length) return;

    stepWorld(runtime, marks, dt, setObjectFix, characterScale);

    group.position.copy(runtime.position);
    group.rotation.set(0, runtime.yaw, 0);
    group.scale.setScalar(characterScale);

    /*
     * The clip follows the beat, and nothing else touches the rig.
     *
     * No arm solving, no additive spine, no head tracking, no tool aiming. The
     * takes were authored as working animations and they are allowed to be
     * exactly that — which is what makes him read as a character rather than as
     * a puppet being posed.
     */
    const want = clipForBeat(runtime, marks, roles.walkInPlace);
    if (want !== currentName.current) {
      const next = actions[want] ?? null;
      if (next) {
        const previous = currentAction.current;
        if (previous) {
          previous.setEffectiveWeight(1);
          previous.fadeOut(0.22);
        }
        const style = loopStyles.get(want) ?? "repeat";
        next
          .reset()
          .setLoop(LOOP_MODE[style], Infinity)
          .setEffectiveTimeScale(clipSpeeds.get(want) ?? 1)
          .setEffectiveWeight(1)
          .fadeIn(0.22)
          .play();
        currentAction.current = next;
        currentName.current = want;
      }
    }

    const mark = marks[Math.min(runtime.index, marks.length - 1)];
    const wantTool =
      runtime.beat === "WORK" || runtime.beat === "WORK_IN"
        ? mark.spot.tool
        : null;
    if (wantTool !== toolKind) setToolKind(wantTool);

    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      w.__fxWorld = {
        beat: runtime.beat,
        index: runtime.index,
        spot: mark.spot.id,
        fixed: runtime.fixed.filter(Boolean).length,
        total: marks.length,
        rested: +runtime.restedFor.toFixed(1),
      };
    }
    onBeat(runtime);
  });

  const toolAction = toolKind ? DEFAULT_ACTION[toolKind] ?? "none" : "none";

  return (
    <>
      <ContactShadow follow={groupRef} scale={characterScale} />
      <group ref={groupRef}>
        <primitive object={model} />
        {handBone &&
          toolKind &&
          createPortal(
            <AimedHandTool
              kind={toolKind}
              scale={TOOL_SCALE}
              position={[0.012, 0.055 + handLength * TOOL_PALM, 0.005]}
              restRotationDeg={[0, 0, 0]}
              getTarget={() => null}
              action={toolAction}
              tracking={false}
            />,
            handBone
          )}
      </group>
    </>
  );
}

function WorldContents() {
  const size = useThree((state) => state.size);
  const { narrow, unitPx, characterScale, objectRatio } = sizing(size.width);
  const marks = useMemo(
    () =>
      layoutWorld(
        { w: size.width, h: size.height },
        unitPx,
        characterScale,
        narrow
      ),
    [size.width, size.height, unitPx, characterScale, narrow]
  );
  const objectScale = characterScale * objectRatio;

  const report = useRef(0);
  const onBeat = (runtime: WorldRuntime) => {
    report.current += 1;
    if (report.current % 20) return;
    const done = runtime.fixed.filter(Boolean).length;
    setDiag({
      tour: `${runtime.beat} · ${done}/${marks.length} fixed`,
    });
  };

  return (
    <>
      <WorldCamera />
      {marks.map((mark) => (
        <FixableObject
          key={mark.spot.id}
          kind={mark.spot.kind}
          id={mark.spot.id}
          position={[mark.object.x, mark.object.y, mark.object.z]}
          scale={objectScale * (mark.spot.scale ?? 1)}
          rotationDeg={mark.spot.rotationDeg ?? [0, 0, 0]}
        />
      ))}
      {/*
        The character loads a model, four motion takes and a preset rig, and
        every one of those suspends. Without a boundary inside the Canvas the
        suspension takes the whole scene down with it — which is a blank canvas
        and a lost WebGL context, not an error anybody would recognise.
      */}
      <Suspense fallback={null}>
        <WorldFixter
          marks={marks}
          characterScale={characterScale}
          onBeat={onBeat}
        />
      </Suspense>
    </>
  );
}

export default function WorldScene() {
  return (
    <div
      data-fx-layer="1"
      data-fx-chrome=""
      className="pointer-events-none fixed inset-0 z-40"
    >
      <Canvas
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        shadows={false}
        orthographic
        style={{ pointerEvents: "none" }}
        onCreated={(state) => {
          setDiag({
            canvas: `world ${state.size.width}x${state.size.height}`,
          });
        }}
      >
        <ambientLight intensity={0.78} />
        <hemisphereLight args={["#ffffff", "#dfe4ec", 0.6]} />
        <directionalLight position={[-4, 6, 8]} intensity={1.35} />
        <directionalLight position={[5, 2, 4]} intensity={0.45} />
        <WorldContents />
      </Canvas>
    </div>
  );
}
