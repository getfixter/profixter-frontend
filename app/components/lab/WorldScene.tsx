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
  WORK_MOTIONS,
  CLIP_KNEEL_GLB,
  TOOL_ATTACH_BONE,
  TOOL_ATTACH_BONE_LEFT,
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
import { createContactShadow, createContactTexture } from "./lab-materials";
import FixableObject from "./lab-objects";
import {
  setObjectBusy,
  setObjectFix,
  setObjectWork,
  resetObjectFix,
} from "./lab-object-state";
import { setDiag } from "./lab-diagnostics";
import {
  WORLD_SPOTS,
  clipForBeat,
  createWorldRuntime,
  layoutWorld,
  homeAt,
  stepWorld,
  walkClipRate,
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
const _propBox = new THREE.Box3();
const _propSize = new THREE.Vector3();

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

/**
 * The shadow a repair casts onto the page.
 *
 * The mounting patches are gone, which is right — they read as cards — but they
 * were also doing a second job nobody noticed until they left: a white basin or
 * a white faceplate on a white band has nothing to separate it from the paper.
 * This is the shadow without the card. A soft radial blob, offset down and
 * right to agree with the key light, fading to nothing at its edges so there is
 * no rectangle anywhere in it.
 *
 * Sized from the object itself on its first drawn frame rather than from a
 * number per prop: the set ranges from a socket to a cabinet, and one constant
 * would be wrong for both ends of it.
 */
function ObjectShadow({ of }: { of: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createContactTexture(), []);
  const sized = useRef(false);
  useFrame(() => {
    const target = of.current;
    const mesh = ref.current;
    if (!target || !mesh || sized.current) return;
    /*
     * Measure the OBJECT, not its effects.
     *
     * setFromObject takes everything under the node, and the socket's fault
     * hangs unit-sized quads off it for sparks and smoke — so the shadow was
     * sized to a one-by-one plane and turned into a grey haze the width of the
     * prop. Anything flagged as an effect is skipped.
     */
    _propBox.makeEmpty();
    target.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData.fx || mesh.parent?.userData?.fx) return;
      _propBox.expandByObject(mesh);
    });
    if (_propBox.isEmpty()) return;
    _propBox.getSize(_propSize);
    if (_propSize.x <= 0 || _propSize.y <= 0) return;
    sized.current = true;
    /*
     * Barely there, on purpose.
     *
     * I overshot this first: half again the object's size at two-thirds opacity
     * put a soft grey cloud behind every prop, and behind the picture frame it
     * read as exactly the card we had just spent the morning removing. A
     * shadow that anybody notices AS a shadow is already too strong here. This
     * is the smallest one that still stops a white basin dissolving into a
     * white band.
     */
    const w = Math.max(_propSize.x, _propSize.y) * 1.08;
    mesh.scale.set(w, w, 1);
    mesh.position.set(
      target.position.x + _propSize.x * 0.17,
      target.position.y - _propSize.y * 0.19,
      target.position.z - 0.06
    );
    mesh.visible = true;
  });
  return (
    <mesh ref={ref} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

function WorldFixter({
  marks,
  home,
  characterScale,
  onBeat,
}: {
  marks: WorldMark[];
  home: THREE.Vector3;
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

  /*
   * The neck and the head, for the one correction the rig gets.
   *
   * Everything else about the takes is left exactly as authored — see the note
   * in the frame loop. This is the exception, and it earns it: the kneel take
   * folds his chin onto his chest, and a character whose whole value is that he
   * has a face cannot spend his first repair without one.
   */
  const spine = useMemo(() => {
    let neck: THREE.Object3D | null = null;
    let head: THREE.Object3D | null = null;
    model.traverse((child) => {
      if (!neck && child.name === "neck") neck = child;
      if (!head && child.name === "Head") head = child;
    });
    return { neck: neck as THREE.Object3D | null, head: head as THREE.Object3D | null };
  }, [model]);

  const hands = useMemo(() => {
    let right: THREE.Object3D | null = null;
    let left: THREE.Object3D | null = null;
    let rightLen = 0.2;
    let leftLen = 0.2;
    model.traverse((child) => {
      if (!right && child.name === TOOL_ATTACH_BONE) right = child;
      if (!left && child.name === TOOL_ATTACH_BONE_LEFT) left = child;
      if (child.name === "RightHand_End") rightLen = child.position.length();
      if (child.name === "LeftHand_End") leftLen = child.position.length();
    });
    return {
      right: right as THREE.Object3D | null,
      left: left as THREE.Object3D | null,
      rightLen,
      leftLen,
    };
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

  /*
   * The performance. Created ONCE, and it runs to the end.
   *
   * This was memoised on the marks and the home point, which are themselves
   * memoised on the viewport size — so anything that nudged the canvas by a
   * pixel built a brand new runtime, reset every repair, and started the whole
   * show again from the socket. I caught it watching a ninety-second capture:
   * he walked home, and then quietly did all six a second time. Keyed on the
   * NUMBER of repairs instead, which never changes, so a resize re-aims him
   * rather than rewinding him.
   */
  const runtime = useMemo(
    () => createWorldRuntime(marks, home),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marks.length]
  );
  useEffect(() => {
    resetObjectFix();
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      w.__fxMounts = ((w.__fxMounts as number) ?? 0) + 1;
    }
  }, [runtime]);

  /* Shared between the tool and whatever it is being used on. */
  const workTime = useRef(0);
  /* Where the tool tip is asked to point, and whether it is being asked. */
  const toolAim = useRef(new THREE.Vector3());
  const aiming = useRef(false);
  /* How much of the head lift is applied right now: 0 walking, 1 working. */
  const look = useRef(0);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const currentName = useRef<string | null>(null);
  const [toolKind, setToolKind] = useState(WORLD_SPOTS[0]?.tool ?? null);
  const [toolSize, setToolSize] = useState(WORLD_SPOTS[0]?.toolScale ?? 1);
  const [toolHand, setToolHand] = useState<"left" | "right">(
    WORK_MOTIONS[WORLD_SPOTS[0]?.motion]?.toolHand ?? "right"
  );

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

    /*
     * Keep the targets current without disturbing the story.
     *
     * If the viewport changes shape the composition moves, so where he is
     * walking to moves with it. Re-pointing is all that is needed: the beat, the
     * index and what he has already mended are untouched.
     */
    runtime.home.copy(home);
    if (runtime.beat === "WALK") {
      const aim =
        runtime.index >= marks.length ? home : marks[runtime.index].feet;
      runtime.to.copy(aim);
      runtime.distance = runtime.from.distanceTo(runtime.to);
    }

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

    /*
     * The legs run at the speed he is actually travelling.
     *
     * Set once at the crossfade this was a constant, so the clip kept its own
     * pace while he accelerated out of an idle and braked into an arrival —
     * which is exactly when feet skate. Driven per frame, the stride stretches
     * and shortens with him and the contact stays put.
     */
    if (currentAction.current && want === roles.walkInPlace) {
      currentAction.current.setEffectiveTimeScale(
        walkClipRate(runtime.speed, characterScale)
      );
    }

    const mark = marks[Math.min(runtime.index, marks.length - 1)];
    /*
     * Hand the prop the SAME clock the tool animates on.
     *
     * Seconds since he started working, or zero when nobody is there. The
     * socket derives the screwdriver's turn from it and fires its sparks on
     * those turns — which is the difference between a man working and a man
     * moving next to some particles.
     */
    workTime.current = runtime.beat === "WORK" ? runtime.elapsed : 0;
    setObjectBusy(mark.spot.id, workTime.current);
    setObjectWork(
      mark.spot.id,
      runtime.beat === "WORK" ? Math.min(1, runtime.progress) : 0
    );

    /*
     * Point the tool at the thing, for the repairs that ask for it.
     *
     * The rig is still untouched — this rotates the tool inside his fist and
     * nothing else, which is the cheapest honest answer to "the screwdriver
     * has to meet the socket". Only spots carrying an authored `aim` get it.
     */
    /*
     * Put his face back, after the mixer has had its say.
     *
     * This useFrame is registered after the one useAnimations installs, so the
     * clip has already written the bones by the time we get here and adding to
     * them is a correction rather than an accumulation. Weighted onto the beats
     * where he is actually down at the work, and eased in and out so the lift
     * arrives with the crouch instead of snapping on with the beat.
     */
    const lift = WORK_MOTIONS[mark.spot.motion]?.headLiftDeg ?? 0;
    if (lift > 0 && (spine.neck || spine.head)) {
      /*
       * Only while he is down at it.
       *
       * Not through the look afterwards: by then he is standing, the take has
       * his head where it should be, and adding the same lift to an upright
       * pose points his chin at the ceiling. It unwinds over the crouch-out,
       * which is exactly the movement that should carry it away.
       */
      const wantLook =
        runtime.beat === "WORK" || runtime.beat === "WORK_IN" ? 1 : 0;
      look.current += (wantLook - look.current) * Math.min(1, dt * 5);
      const radians = THREE.MathUtils.degToRad(lift) * look.current;
      /* Most of it out of the neck, the rest out of the skull. */
      if (spine.neck) spine.neck.rotation.x -= radians * 0.62;
      if (spine.head) spine.head.rotation.x -= radians * 0.38;
    }

    const spotAim = mark.spot.aim;
    if (spotAim && (runtime.beat === "WORK" || runtime.beat === "WORK_IN")) {
      toolAim.current.set(
        mark.object.x + spotAim[0] * characterScale,
        mark.object.y + spotAim[1] * characterScale,
        0
      );
      aiming.current = true;
    } else {
      aiming.current = false;
    }
    const wantTool =
      runtime.beat === "WORK" || runtime.beat === "WORK_IN"
        ? mark.spot.tool
        : null;
    if (wantTool !== toolKind) setToolKind(wantTool);
    const wantHand = WORK_MOTIONS[mark.spot.motion]?.toolHand ?? "right";
    if (wantHand !== toolHand) setToolHand(wantHand);
    const wantSize = mark.spot.toolScale ?? 1;
    if (wantSize !== toolSize) setToolSize(wantSize);

    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      w.__fxWorld = {
        beat: runtime.beat,
        index: runtime.index,
        spot: mark.spot.id,
        fixed: runtime.fixed.filter(Boolean).length,
        total: marks.length,
        rested: +runtime.restedFor.toFixed(1),
        mounts: (window as unknown as Record<string, number>).__fxMounts ?? 0,
      };
    }
    onBeat(runtime);
  });

  const toolAction = toolKind ? DEFAULT_ACTION[toolKind] ?? "none" : "none";
  const holding = toolHand === "left" ? hands.left : hands.right;
  const holdingLength = toolHand === "left" ? hands.leftLen : hands.rightLen;
  /* The palm faces the other way on the other side, so the grip offset flips. */
  const grip = toolHand === "left" ? -0.012 : 0.012;

  return (
    <>
      <ContactShadow follow={groupRef} scale={characterScale} />
      <group ref={groupRef}>
        <primitive object={model} />
        {holding &&
          toolKind &&
          createPortal(
            <AimedHandTool
              kind={toolKind}
              scale={TOOL_SCALE * toolSize}
              position={[grip, 0.055 + holdingLength * TOOL_PALM, 0.005]}
              restRotationDeg={[0, 0, 0]}
              getTarget={() => (aiming.current ? toolAim.current : null)}
              action={toolAction}
              getWorkTime={() => workTime.current}
              tracking
            />,
            holding
          )}
      </group>
    </>
  );
}

/** One repair, and the shadow it drops on the page behind it. */
function WorldObject({
  mark,
  objectScale,
}: {
  mark: WorldMark;
  objectScale: number;
}) {
  const ref = useRef<THREE.Group>(null);
  return (
    <>
      <ObjectShadow of={ref} />
      <group ref={ref} position={[mark.object.x, mark.object.y, mark.object.z]}>
        <FixableObject
          kind={mark.spot.kind}
          id={mark.spot.id}
          position={[0, 0, 0]}
          scale={objectScale * (mark.spot.scale ?? 1)}
          rotationDeg={mark.spot.rotationDeg ?? [0, 0, 0]}
        />
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
  const home = useMemo(
    () => homeAt({ w: size.width, h: size.height }, unitPx, narrow),
    [size.width, size.height, unitPx, narrow]
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
        <WorldObject
          key={mark.spot.id}
          mark={mark}
          objectScale={objectScale}
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
          home={home}
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
      /*
        BEHIND the interface, not over it.
        The page paints its band colours at z-0 and its text, cards and buttons
        at z-20; the world lives in between. That single number is what turns a
        3D overlay into a character who lives in the site: the booking button
        passes in front of him, a paragraph stays perfectly readable while a
        cabinet drifts under it, and nothing has to be kept away from anything.
      */
      className="pointer-events-none fixed inset-0 z-10"
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
        {/*
          Less ambient, more key.
          With the mounting patches gone, a white basin or a white faceplate has
          nothing behind it but the page — and on the white bands that was a
          pale shape on pale paper. Flat ambient light was most of the reason:
          at 0.78 nothing had a dark side. Dropping it and driving a single key
          from the upper left gives every prop real shading, which is what
          separates it from the paper it is standing on.
        */}
        <ambientLight intensity={0.44} />
        <hemisphereLight args={["#ffffff", "#c8cfdc", 0.42]} />
        <directionalLight position={[-4, 6, 8]} intensity={1.65} />
        <directionalLight position={[5, 2, 4]} intensity={0.4} />
        <WorldContents />
      </Canvas>
    </div>
  );
}
