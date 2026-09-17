"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  M,
  createGlowTexture,
  createLampMaterial,
  createSmokeTexture,
} from "./lab-materials";
import { getObjectBusy, getObjectFix, getObjectNudge } from "./lab-object-state";

/**
 * The things the Fixter fixes.
 *
 * Every one floats unsupported: no wall, no worktop, no floor. The brief is a
 * white page with objects in its negative space, so each prop is modelled as
 * the object alone and nothing it would normally be attached to.
 *
 * Each reads a single number, 0 (broken) to 1 (fixed), and that number has to
 * carry the whole story — there is no text and no sound. So each object states
 * its problem geometrically and in one glance: a frame is *tilted*, a handle
 * *dangles*, a lamp is *dark*. Subtle enough not to look like a cartoon, large
 * enough to read at the size these will actually be on a page.
 *
 * The value is read imperatively from a shared mutable record rather than taken
 * as a prop. Passing it as a prop would re-render six components sixty times a
 * second to animate what is, in the end, a handful of quaternions.
 */

export type ObjectKind =
  | "outlet"
  | "frame"
  | "shelf"
  | "faucet"
  | "cabinet"
  | "lamp"
  | "switch"
  | "doorknob"
  | "towelbar"
  | "detector"
  | "hinge"
  | "showerhead";

export type FixableProps = { id: string };

const DEG = THREE.MathUtils.degToRad;

/*
 * NO MOUNTING PATCHES, NO CONTACT SHADOWS.
 *
 * Every repair used to be drawn on a square of plaster, tile or ceiling, with a
 * soft shadow where it met that square. The intent was right — a towel rail
 * with nothing behind it is a metal rod — but on a real page it read as
 * furniture pasted onto white cards, and the patches were most of what covered
 * the copy.
 *
 * With the world moved BEHIND the interface, the page is the wall. The site's
 * own background is what these things are mounted on, so they are drawn as
 * isolated objects and the composition supplies the context the quads used to.
 */

/**
 * Critically-damped-ish approach; frame-rate independent.
 *
 * Deliberately asymmetric. Mending is the payoff and wants to be seen, so it
 * happens in about a second. Coming undone again is housekeeping the loop needs
 * and nobody should notice, so it takes the better part of ten — slow enough
 * that a handle drooping or a lamp dimming reads as nothing at all unless you
 * are staring straight at it.
 */
/*
 * Fast enough to follow the snap.
 *
 * The shaping lives in repairCurve now; this only has to not blur it. At the
 * old rate the overshoot was smoothed away into the same slow drift the curve
 * exists to replace. Breaking again stays slow — that one should go unnoticed.
 */
const REPAIR_RATE = 15;
const DECAY_RATE = 0.3;

function ease(current: number, target: number, dt: number, rate?: number) {
  const r = rate ?? (target >= current ? REPAIR_RATE : DECAY_RATE);
  return current + (target - current) * (1 - Math.exp(-r * Math.min(dt, 0.1)));
}

/* ------------------------------------------------------------------ outlet */

/**
 * THE FAULTY SOCKET.
 *
 * A loose, crooked faceplate is a picture of a problem; a loose faceplate that
 * spits the occasional spark and breathes a thread of smoke is the problem
 * itself, and a visitor understands it without reading a word. That is the
 * whole brief for this one: make the broken state say "electrical fault", and
 * make the repair say "fixed" by taking all of it away at once.
 *
 * Deliberately NOT a fire. No flames, no plume, nothing constant. Real small
 * faults are intermittent, which is also what makes them read: a spark you were
 * not expecting is worth ten you were.
 *
 * Everything here hangs off this object's own repair value, so it stops when it
 * is mended and can never come back — there is no separate effect system with
 * its own opinion about when to run.
 */
const SPARKS = 6;
const PUFFS = 3;

type Spark = {
  life: number;
  ttl: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

type Fault = {
  sparkMats: THREE.MeshBasicMaterial[];
  puffMats: THREE.MeshBasicMaterial[];
  flashMat: THREE.MeshBasicMaterial;
  sparks: Spark[];
  puffs: { t: number }[];
  nextSpark: number;
  flashFor: number;
  finale: boolean;
};

/**
 * Everything the fault owns, built once per socket.
 *
 * One material per quad so each can fade on its own clock. Nine tiny materials
 * is nothing, and the two canvas textures behind them are shared by every
 * object in the scene.
 */
function makeFault(): Fault {
  const spark = createGlowTexture();
  const smoke = createSmokeTexture();
  /*
   * Normal blending, not additive.
   *
   * Additive was the obvious choice and it was wrong here: this socket lives on
   * the white band, and adding light to white produces white. The sparks were
   * rendering perfectly and were invisible. A saturated amber over the glow
   * texture reads on paper AND on the dark hero, which is what a prop that the
   * page scrolls behind actually needs.
   */
  /*
   * Sparks are bare coloured quads — no texture at all.
   *
   * A soft radial gradient stretched into a streak is mostly falloff, so at the
   * four or five pixels this gets on a phone there was no core left and the
   * whole thing read as a faint orange haze. A hard-edged quad has nothing BUT
   * core, which is what makes it legible at this size. The flash still uses the
   * glow texture, because a flash should be soft.
   *
   * Normal blending, not additive: this socket lives on the white band, and
   * adding light to white produces white.
   */
  const sparkMat = () =>
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ff6a12"),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
  const glow = () =>
    new THREE.MeshBasicMaterial({
      map: spark,
      color: new THREE.Color("#ff8a2a"),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
  return {
    sparkMats: Array.from({ length: SPARKS }, sparkMat),
    puffMats: Array.from(
      { length: PUFFS },
      () =>
        new THREE.MeshBasicMaterial({
          map: smoke,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
    ),
    flashMat: glow(),
    sparks: Array.from({ length: SPARKS }, () => ({
      life: 0, ttl: 0, x: 0, y: 0, vx: 0, vy: 0, size: 1,
    })),
    /* Staggered, so the three puffs never rise in step. */
    puffs: Array.from({ length: PUFFS }, (_, i) => ({ t: i / PUFFS })),
    nextSpark: 0.8,
    flashFor: 0,
    finale: false,
  };
}

/**
 * One frame of the fault.
 *
 * A module function rather than inline, because the React Compiler (correctly)
 * refuses mutation of anything that reached the component through a hook — and
 * a particle is nothing but mutation. Same pattern as the station box.
 */
function stepFault(
  fault: Fault,
  group: THREE.Group,
  sparkMeshes: (THREE.Mesh | null)[],
  puffMeshes: (THREE.Mesh | null)[],
  flash: THREE.Mesh | null,
  broken: number,
  fixed: number,
  busy: number,
  step: number
): void {
  /*
   * The payoff: one last flash as the repair takes hold, then silence.
   *
   * Fired on the way up rather than at the end, so the flash belongs to the fix
   * landing rather than to him straightening up afterwards.
   */
  if (!fault.finale && fixed > 0.22) {
    fault.finale = true;
    fault.flashFor = 0.18;
  }
  if (fixed < 0.02) fault.finale = false;

  /* Mended: wipe it clean, hide it, and stop paying for any of it. */
  if (broken < 0.05 && fault.flashFor <= 0) {
    if (group.visible) {
      for (const mat of fault.sparkMats) mat.opacity = 0;
      for (const mat of fault.puffMats) mat.opacity = 0;
      fault.flashMat.opacity = 0;
      for (const spark of fault.sparks) spark.life = 0;
      group.visible = false;
    }
    return;
  }
  group.visible = true;

  /*
   * When the next spark happens, and how big.
   *
   * Randomised gaps, because a fault on a metronome is a lamp. Weak ones are
   * the common case and a strong one is rare, which is what makes a strong one
   * land. He gets a livelier reaction while he is actually at it.
   */
  fault.nextSpark -= step;
  /* Lab only: hold the fault wide open so the effect can be judged on a still. */
  const soak =
    process.env.NODE_ENV !== "production" &&
    (window as unknown as Record<string, unknown>).__fxSparkSoak === true;
  if ((fault.nextSpark <= 0 || soak) && broken > 0.35) {
    const strong = Math.random() < (busy > 0.5 ? 0.55 : 0.26);
    const count = strong ? 3 : 1;
    for (let n = 0; n < count; n++) {
      const spark = fault.sparks.find((s) => s.life <= 0);
      if (!spark) break;
      /*
       * Out of the lower socket, and AWAY from the plate.
       *
       * The first version emitted into the middle of the faceplate and the
       * sparks spent their whole short life on top of white plastic, where an
       * orange dot reads as a smudge. Thrown down and out they cross the edge
       * within a frame or two and are seen against the page instead.
       */
      const slot = Math.random() < 0.72 ? -0.028 : 0.028;
      spark.x = (Math.random() - 0.5) * 0.03;
      spark.y = slot;
      spark.vx = (Math.random() - 0.5) * 0.5;
      /* Falling hard: sparks drop, they do not float. */
      spark.vy = -0.34 - Math.random() * 0.34;
      spark.ttl = 0.26 + Math.random() * 0.16;
      spark.life = spark.ttl;
      spark.size = (strong ? 0.032 : 0.022) + Math.random() * 0.008;
    }
    if (strong) fault.flashFor = Math.max(fault.flashFor, 0.11);
    fault.nextSpark = strong
      ? 1.2 + Math.random() * 1.4
      : 0.4 + Math.random() * 1.7;
    if (busy > 0.5) fault.nextSpark *= 0.55;
    if (soak) fault.nextSpark = 0.1;
  }

  for (let i = 0; i < SPARKS; i++) {
    const spark = fault.sparks[i];
    const mesh = sparkMeshes[i];
    const mat = fault.sparkMats[i];
    if (!mesh || !mat) continue;
    if (spark.life <= 0) {
      if (mat.opacity !== 0) mat.opacity = 0;
      continue;
    }
    spark.life -= step;
    spark.vy -= 1.1 * step;
    spark.x += spark.vx * step;
    spark.y += spark.vy * step;
    const u = Math.max(0, spark.life / spark.ttl);
    mesh.position.set(spark.x, spark.y, 0.016);
    /*
     * A streak, not a dot.
     *
     * Stretched along the direction it is travelling and thinned across it,
     * which is the whole difference between "spark" and "orange blob" at a
     * size where there are only a few pixels to say it with.
     */
    mesh.rotation.z = Math.atan2(spark.vy, spark.vx);
    const len = spark.size * (1.35 + u * 0.9);
    mesh.scale.set(len, spark.size * 0.5, 1);
    mat.opacity = u * broken;
  }

  /*
   * Smoke: continuous, and almost nothing.
   *
   * Three puffs on a slow loop, rising about a plate's height and spreading as
   * they go. At full strength it is a thread you notice only after a spark has
   * made you look.
   */
  for (let i = 0; i < PUFFS; i++) {
    const puff = fault.puffs[i];
    const mesh = puffMeshes[i];
    const mat = fault.puffMats[i];
    if (!mesh || !mat) continue;
    puff.t += step / 2.6;
    if (puff.t > 1) puff.t -= 1;
    const u = puff.t;
    mesh.position.set(
      0.004 + Math.sin(u * 4.2 + i) * 0.016,
      0.064 + u * 0.12,
      0.012
    );
    mesh.scale.setScalar(0.06 + u * 0.1);
    mat.opacity = Math.sin(Math.min(1, u) * Math.PI) * 0.42 * broken;
  }

  if (process.env.NODE_ENV !== "production") {
    const w = window as unknown as Record<string, unknown>;
    let live = 0;
    let top = 0;
    for (let i = 0; i < SPARKS; i++) {
      if (fault.sparks[i].life > 0) live++;
      top = Math.max(top, fault.sparkMats[i].opacity);
    }
    w.__fxFault = {
      visible: group.visible,
      children: group.children.length,
      live,
      sparkOpacity: +top.toFixed(2),
      puffOpacity: +fault.puffMats[0].opacity.toFixed(3),
      broken: +broken.toFixed(2),
      meshes: sparkMeshes.filter(Boolean).length,
      scale0: +(sparkMeshes[0]?.scale.x ?? -1).toFixed(4),
    };
  }

  /* The flicker, and the closing flash. Same quad, same clock. */
  if (fault.flashFor > 0) {
    fault.flashFor -= step;
    const u = Math.max(0, fault.flashFor) / 0.18;
    if (flash) {
      flash.scale.setScalar(0.13 + (1 - u) * 0.06);
      fault.flashMat.opacity = u * 0.7;
    }
  } else if (fault.flashMat.opacity !== 0) {
    fault.flashMat.opacity = 0;
  }
}

function Outlet({ id }: FixableProps) {
  const plate = useRef<THREE.Group>(null);
  const screw = useRef<THREE.Mesh>(null);
  const faultGroup = useRef<THREE.Group>(null);
  const sparkMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const puffMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const flash = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const fault = useMemo(() => makeFault(), []);

  useFrame((_, dt) => {
    const step = Math.min(0.05, dt);
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    /* Crooked enough to notice, and a screw standing visibly proud — the two
       things that say "this is wrong" without anybody reading a label. */
    if (plate.current) plate.current.rotation.z = DEG(15) * broken;
    if (screw.current) screw.current.position.z = 0.004 + 0.011 * broken;

    const group = faultGroup.current;
    if (!group) return;
    stepFault(
      fault,
      group,
      sparkMeshes.current,
      puffMeshes.current,
      flash.current,
      broken,
      f.current,
      getObjectBusy(id),
      step
    );
  });

  return (
    <group>
      <group ref={plate}>
        <mesh material={M.shell}>
          <boxGeometry args={[0.075, 0.122, 0.008]} />
        </mesh>
        {[0.028, -0.028].map((y) => (
          <group key={y} position={[0, y, 0.0045]}>
            <mesh material={M.dark} position={[-0.011, 0.004, 0]}>
              <boxGeometry args={[0.005, 0.016, 0.002]} />
            </mesh>
            <mesh material={M.dark} position={[0.011, 0.004, 0]}>
              <boxGeometry args={[0.005, 0.016, 0.002]} />
            </mesh>
            <mesh material={M.dark} position={[0, -0.013, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.002, 10]} />
            </mesh>
          </group>
        ))}
        <mesh ref={screw} material={M.hardware} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.005, 12]} />
        </mesh>
      </group>
      {/*
        The fault, outside the tilting plate so the smoke rises straight up
        while the faceplate hangs crooked.
      */}
      <group ref={faultGroup} userData={{ fx: true }}>
        <mesh ref={flash} material={fault.flashMat} position={[0, 0, 0.014]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        {fault.puffMats.map((mat, i) => (
          <mesh
            key={`puff-${i}`}
            ref={(node) => {
              puffMeshes.current[i] = node;
            }}
            material={mat}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
        {fault.sparkMats.map((mat, i) => (
          <mesh
            key={`spark-${i}`}
            ref={(node) => {
              sparkMeshes.current[i] = node;
            }}
            material={mat}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- picture frame */

function PictureFrame({ id }: FixableProps) {
  const tilt = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    /* A fingertip check: it rocks a degree and settles back level. */
    const give = getObjectNudge(id);
    if (tilt.current) {
      tilt.current.rotation.z = DEG(20) * (1 - f.current) + DEG(1.8) * give;
    }
  });

  const W = 0.3;
  const H = 0.23;
  const T = 0.016;

  return (
    <group>
      {/* The hook it hangs from, which is what makes a tilted rectangle read as
          a picture hanging crooked rather than a rectangle floating crooked. */}
      <mesh material={M.hardware} position={[0, H / 2 + 0.05, -0.02]}>
        <boxGeometry args={[0.012, 0.016, 0.008]} />
      </mesh>
      <group ref={tilt}>
        {/* four rails rather than a slab, so it reads as a frame edge-on */}
        {[
          { p: [0, H / 2, 0], s: [W + T, T, 0.018] },
          { p: [0, -H / 2, 0], s: [W + T, T, 0.018] },
          { p: [-W / 2, 0, 0], s: [T, H, 0.018] },
          { p: [W / 2, 0, 0], s: [T, H, 0.018] },
        ].map((r, i) => (
          <mesh
            key={i}
            material={M.woodDark}
            position={r.p as [number, number, number]}
          >
            <boxGeometry args={r.s as [number, number, number]} />
          </mesh>
        ))}
        {/* mount + a hint of a picture */}
        <mesh material={M.shell} position={[0, 0, -0.004]}>
          <boxGeometry args={[W - 0.004, H - 0.004, 0.006]} />
        </mesh>
        <mesh material={M.accent} position={[0, -0.03, 0.001]}>
          <boxGeometry args={[W - 0.07, H - 0.11, 0.004]} />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------- shelf */

/** Declared out here: a component defined inside render is remounted each pass. */
function ShelfBracket() {
  return (
    <group>
      <mesh material={M.metal} position={[0, -0.035, 0.005]}>
        <boxGeometry args={[0.014, 0.07, 0.012]} />
      </mesh>
      <mesh material={M.metal} position={[0, -0.006, 0.042]}>
        <boxGeometry args={[0.014, 0.012, 0.075]} />
      </mesh>
    </group>
  );
}

function Shelf({ id }: FixableProps) {
  const board = useRef<THREE.Group>(null);
  const loose = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    /* Pressed on, it flexes a degree and a half and springs back. That is the
       difference between "it looks level" and "it is actually holding". */
    const give = getObjectNudge(id);
    // the right end droops, and its bracket has slipped down and out
    if (board.current) {
      board.current.rotation.z = -DEG(13) * broken - DEG(1.6) * give;
      board.current.position.y = -0.004 * give;
    }
    if (loose.current) {
      loose.current.position.y = -0.055 * broken;
      loose.current.position.z = 0.03 * broken;
      loose.current.rotation.x = DEG(18) * broken;
    }
  });

  const W = 0.56;

  return (
    <group>
      <group ref={board}>
        <mesh material={M.wood} position={[0, 0, 0.055]}>
          <boxGeometry args={[W, 0.03, 0.14]} />
        </mesh>
        <mesh material={M.wood} position={[0, 0.036, 0.055]}>
          <boxGeometry args={[W * 0.35, 0.042, 0.05]} />
        </mesh>
        <group position={[-W * 0.32, -0.015, 0]}>
          <ShelfBracket />
        </group>
        <group ref={loose} position={[W * 0.32, -0.015, 0]}>
          <ShelfBracket />
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- faucet */

function Faucet({ id }: FixableProps) {
  const handle = useRef<THREE.Group>(null);
  const spout = useRef<THREE.Group>(null);
  const drip = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const t = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (handle.current) handle.current.rotation.z = DEG(38) * broken;
    if (spout.current) spout.current.rotation.z = DEG(5) * broken;

    // a drip that falls while it is still leaking, and stops when it is not
    if (drip.current) {
      t.current = (t.current + dt * 0.85) % 1;
      const visible = broken > 0.08;
      drip.current.visible = visible;
      if (visible) {
        drip.current.position.y = 0.035 - t.current * 0.16;
        const s = (1 - t.current * 0.55) * broken;
        drip.current.scale.setScalar(Math.max(0.001, s));
      }
    }
  });

  return (
    <group>
      {/*
        The basin, rebuilt.
        The first attempt was a thin slab tilted toward the camera, which from
        almost head-on read as an ironing board with a tap behind it — flat, no
        bowl, no depth. Under this camera a basin has to be built the way a
        basin looks from the front: a bowl that tapers inward as it goes down, a
        rim wider than the bowl so there is a visible lip, and a dark ellipse
        inside the rim, which is the single thing that says "this is a hole that
        water goes into" rather than "this is a white shape".
      */}
      <mesh material={M.shell} position={[0, -0.115, 0.055]}>
        <cylinderGeometry args={[0.2, 0.135, 0.13, 26, 1, false]} />
      </mesh>
      <mesh material={M.shell} position={[0, -0.05, 0.055]}>
        <cylinderGeometry args={[0.215, 0.215, 0.018, 26]} />
      </mesh>
      <mesh material={M.dark} position={[0, -0.046, 0.055]}>
        <cylinderGeometry args={[0.178, 0.178, 0.006, 26]} />
      </mesh>
      {/* the plughole, small and dead centre: it finishes the read */}
      <mesh material={M.hardware} position={[0, -0.042, 0.055]}>
        <cylinderGeometry args={[0.022, 0.022, 0.006, 12]} />
      </mesh>
      {/* base */}
      <mesh material={M.metal} position={[0, -0.09, 0]}>
        <cylinderGeometry args={[0.035, 0.042, 0.02, 16]} />
      </mesh>
      <group ref={spout}>
        {/* column, then a gooseneck forward */}
        <mesh material={M.metal} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.018, 0.02, 0.15, 16]} />
        </mesh>
        <mesh material={M.metal} position={[0, 0.06, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.045, 0.016, 10, 20, Math.PI]} />
        </mesh>
        <mesh material={M.metal} position={[0, 0.048, 0.078]}>
          <cylinderGeometry args={[0.013, 0.015, 0.03, 14]} />
        </mesh>
        <mesh ref={drip} material={M.accent} position={[0, 0.035, 0.078]}>
          <sphereGeometry args={[0.008, 10, 8]} />
        </mesh>
      </group>
      {/* the tell: the lever sits cocked until it is tightened */}
      <group ref={handle} position={[0, 0.02, -0.03]}>
        <mesh material={M.accent} position={[0, 0.035, 0]}>
          <boxGeometry args={[0.018, 0.075, 0.02]} />
        </mesh>
        <mesh material={M.hardware}>
          <cylinderGeometry args={[0.014, 0.014, 0.016, 12]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ cabinet */

function Cabinet({ id }: FixableProps) {
  const door = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    /*
     * The whole story is the door.
     *
     * It used to be a loose handle hanging off one screw, which at a hundred
     * pixels is a grey speck on a brown rectangle — and a brown rectangle could
     * be a picture, a panel or a door. A door standing open and then closing
     * flush into its carcass is legible from across the room, and it is a thing
     * everyone has in their kitchen.
     */
    const give = getObjectNudge(id);
    if (door.current) {
      /* Tested, it rocks a few degrees on its catch and comes back. */
      door.current.rotation.y = -DEG(26) * broken - DEG(7) * give;
      door.current.position.z = 0.02 * broken;
    }
  });

  const W = 0.3;
  const H = 0.4;

  return (
    <group>
      {/* the carcass, so the door is fitted INTO something */}
      <mesh material={M.dark} position={[0, 0, -0.045]}>
        <boxGeometry args={[W + 0.03, H + 0.03, 0.07]} />
      </mesh>
      <mesh material={M.woodDark} position={[0, 0, -0.012]}>
        <boxGeometry args={[W - 0.01, H - 0.01, 0.01]} />
      </mesh>

      {/* hinged at the left edge */}
      <group ref={door} position={[-W / 2, 0, 0]}>
        <group position={[W / 2, 0, 0]}>
          <mesh material={M.wood}>
            <boxGeometry args={[W, H, 0.022]} />
          </mesh>
          <mesh material={M.woodDark} position={[0, 0, 0.012]}>
            <boxGeometry args={[W - 0.07, H - 0.07, 0.004]} />
          </mesh>
          {/* a handle big enough to see: the thing that says "door" */}
          <mesh material={M.brass} position={[W / 2 - 0.035, 0, 0.026]}>
            <boxGeometry args={[0.016, 0.13, 0.016]} />
          </mesh>
          <mesh material={M.brass} position={[W / 2 - 0.035, 0.062, 0.014]}>
            <boxGeometry args={[0.014, 0.014, 0.026]} />
          </mesh>
          <mesh material={M.brass} position={[W / 2 - 0.035, -0.062, 0.014]}>
            <boxGeometry args={[0.014, 0.014, 0.026]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* --------------------------------------------------------------------- lamp */

function Lamp({ id }: FixableProps) {
  const swing = useRef<THREE.Group>(null);
  const shade = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const f = useRef(0);
  const material = useMemo(() => createLampMaterial(), []);
  const glowMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: createGlowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        transparent: true,
        opacity: 0,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      glowMaterial.map?.dispose();
      glowMaterial.dispose();
    },
    [glowMaterial]
  );

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (swing.current) swing.current.rotation.z = DEG(17) * broken;
    /*
     * The bulb blooms as it seats, and keeps a slow breath afterwards.
     *
     * This is the loudest moment in the whole loop and it is deliberately the
     * first thing a visitor sees, so it is worth more than an emissive nudge:
     * against a dark hero a warm additive bloom is visible from the corner of
     * the eye, which is the entire job of the opening.
     */
    if (glow.current) {
      const breathe = 1 + Math.sin(performance.now() / 700) * 0.05;
      const g = glow.current;
      g.scale.setScalar(f.current * 0.95 * breathe);
      (g.material as THREE.SpriteMaterial).opacity = f.current * 0.9;
      g.visible = f.current > 0.02;
    }
    /*
     * The payoff: it comes on. Reached through the mesh rather than the memo
     * so this is a mutation of the scene graph, which is what a frame loop is
     * for, rather than of a value React handed back.
     */
    const lit = shade.current?.material as THREE.MeshStandardMaterial | undefined;
    if (lit) lit.emissiveIntensity = f.current * 1.5;
  });

  return (
    <group>
      {/*
        No ceiling patch here, and that is a decision rather than an omission.
        A pendant already says "ceiling" with its cord — the flex runs up and
        out of frame, which is exactly how a hanging light reads. Adding a
        surface behind it put a pale grey band in the middle of the hero with a
        gap between it and the rose: a floating box, which is the one thing this
        whole feature exists to avoid. The contact shadow stays; it is the part
        that was doing useful work.
      */}
      <mesh material={M.shell} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.012, 14]} />
      </mesh>
      <group ref={swing} position={[0, 0.2, 0]}>
        <mesh material={M.dark} position={[0, -0.11, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.22, 6]} />
        </mesh>
        <mesh ref={shade} material={material} position={[0, -0.27, 0]}>
          <cylinderGeometry args={[0.055, 0.105, 0.11, 20, 1, true]} />
        </mesh>
        <mesh material={material} position={[0, -0.315, 0]}>
          <sphereGeometry args={[0.032, 12, 10]} />
        </mesh>
        <sprite ref={glow} material={glowMaterial} position={[0, -0.3, 0.02]} visible={false} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------- the newer repairs */

/**
 * A light switch.
 *
 * The clearest before-and-after in the whole library: the toggle is down and
 * the plate is askew, then the toggle flips and the plate squares up. Reads at
 * any size because the shape is universal.
 */
function LightSwitch({ id }: FixableProps) {
  const plate = useRef<THREE.Group>(null);
  const toggle = useRef<THREE.Mesh>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (plate.current) plate.current.rotation.z = DEG(16) * broken;
    /* Down when broken, up when done. The flip IS the payoff. */
    if (toggle.current) toggle.current.rotation.x = DEG(-22) + DEG(44) * f.current;
  });

  return (
    <group>
      <group ref={plate}>
      <mesh material={M.shell}>
        <boxGeometry args={[0.078, 0.122, 0.008]} />
      </mesh>
      <mesh material={M.dark} position={[0, 0, 0.004]}>
        <boxGeometry args={[0.026, 0.05, 0.004]} />
      </mesh>
      <mesh ref={toggle} material={M.shell} position={[0, 0, 0.012]}>
        <boxGeometry args={[0.018, 0.034, 0.014]} />
      </mesh>
      <mesh
        material={M.hardware}
        position={[0, 0.05, 0.006]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.004, 10]} />
      </mesh>
      <mesh
        material={M.hardware}
        position={[0, -0.05, 0.006]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.004, 10]} />
      </mesh>
      </group>
    </group>
  );
}

/**
 * A doorknob that has worked loose.
 *
 * Broken, it hangs off its axis and sits proud of the plate; tightened, it
 * squares up and pulls in. Small, round and instantly legible.
 */
function Doorknob({ id }: FixableProps) {
  const knob = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (knob.current) {
      knob.current.rotation.z = DEG(-17) * broken;
      knob.current.position.z = 0.03 + 0.016 * broken;
      knob.current.position.y = -0.012 * broken;
    }
  });

  return (
    <group>
      {/*
        Discs face the camera.

        A cylinder's axis is Y by default, which on a stage viewed head-on shows
        a round thing edge-on as a thin bar. Everything plate-shaped in this
        library has to be turned to face the viewer or it simply disappears.
      */}
      <mesh material={M.shell} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.058, 0.058, 0.01, 20]} />
      </mesh>
      <group ref={knob}>
        <mesh material={M.metal} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.05, 14]} />
        </mesh>
        <mesh material={M.metal} position={[0, 0, 0.034]}>
          <sphereGeometry args={[0.036, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A towel bar with one end out of the wall.
 *
 * The sag is the whole story: one bracket has let go and the rail hangs. Wide
 * and horizontal, so it fills a gap between paragraphs nicely.
 */
function TowelBar({ id }: FixableProps) {
  const rail = useRef<THREE.Group>(null);
  const loose = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    const give = getObjectNudge(id);
    /* Tugged, the whole rail gives a millimetre or two and holds. */
    if (rail.current) {
      rail.current.rotation.z = DEG(-18) * broken - DEG(1.4) * give;
      rail.current.position.y = -0.005 * give;
    }
    if (loose.current) {
      loose.current.position.y = -0.03 * broken;
      loose.current.rotation.z = DEG(24) * broken;
    }
  });

  const W = 0.44;

  return (
    <group>
      {/* Four tiles and a grout cross: the least that says "bathroom wall". */}
      <group ref={rail}>
        <mesh material={M.metal} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, W, 12]} />
        </mesh>
        <mesh
          material={M.shell}
          position={[-W / 2, 0, -0.012]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.026, 0.026, 0.026, 14]} />
        </mesh>
        <group ref={loose} position={[W / 2, 0, -0.012]}>
          <mesh material={M.shell} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.026, 0.026, 0.026, 14]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * A smoke detector hanging off its mount.
 *
 * Dangling by its wire when broken, flush and blinking when done. The blink is
 * the only light in the library besides the pendant, and it is small enough to
 * read as a detail rather than an effect.
 */
function SmokeDetector({ id }: FixableProps) {
  const body = useRef<THREE.Group>(null);
  const led = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const clock = useRef(0);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2fbf6a",
        emissive: new THREE.Color("#2fbf6a"),
        emissiveIntensity: 0,
        roughness: 0.4,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    clock.current += dt;
    if (body.current) {
      body.current.rotation.z = DEG(-28) * broken;
      body.current.position.y = -0.055 * broken;
      body.current.position.x = 0.02 * broken;
    }
    /* A slow heartbeat once it is back on the ceiling. */
    const lit = led.current?.material as THREE.MeshStandardMaterial | undefined;
    if (lit) {
      const beat = Math.max(0, Math.sin(clock.current * 2.2)) ** 8;
      lit.emissiveIntensity = f.current * beat * 3;
    }
  });

  return (
    <group>
      {/* Ceiling. A disc alone could be anything; a disc against a flat pale
          plane that stops above it is mounted on something. */}
      {/* Small and tight to the disc: a detector is flush against its ceiling,
          so the surface has to start where the object does. */}
      <mesh
        material={M.shell}
        position={[0, 0.03, -0.01]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, 0.008, 14]} />
      </mesh>
      <mesh
        material={M.dark}
        position={[0, -0.005, -0.008]}
        rotation={[0, 0, DEG(20)]}
      >
        <boxGeometry args={[0.004, 0.07, 0.004]} />
      </mesh>
      <group ref={body}>
        <mesh material={M.shell} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.084, 0.078, 0.026, 22]} />
        </mesh>
        <mesh
          material={M.dark}
          position={[0, 0, 0.016]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.03, 0.03, 0.004, 14]} />
        </mesh>
        <mesh ref={led} material={material} position={[0.042, -0.03, 0.014]}>
          <sphereGeometry args={[0.009, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A door hinge that has worked loose.
 *
 * Replaces the baseboard, which was the right repair on the wrong shelf: a
 * baseboard lives on the floor and every work posture here puts his hand at
 * chest height, so it hung in mid-air at his collarbone looking like a ruler.
 * A hinge is genuinely a chest-height job, it is genuinely a hammer job — you
 * tap the pin back down — and the page's own checklist already opens with "A
 * door that doesn't close right", which is exactly this.
 *
 * Broken, the pin has crept up out of the barrel and the door leaf sags off it.
 * Fixed, the pin seats flush and the leaf squares up.
 */
function DoorHinge({ id }: FixableProps) {
  const leaf = useRef<THREE.Group>(null);
  const pin = useRef<THREE.Mesh>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    /* The door side droops away from the frame side. */
    if (leaf.current) {
      leaf.current.rotation.z = DEG(-16) * broken;
      leaf.current.position.y = -0.012 * broken;
    }
    /* And the pin is standing proud until he knocks it back in. */
    if (pin.current) pin.current.position.y = 0.075 + 0.085 * broken;
  });

  const H = 0.17;

  return (
    <group>
      {/*
        A hinge on its own is a brass bracket. The two things that make it a
        DOOR hinge are the slab on one side and the jamb on the other, and the
        gap of shadow between them — which is the only part of a door anybody
        actually looks at when it is catching on its frame.
      */}
      <mesh material={M.woodDark} position={[0.17, 0, -0.012]}>
        <boxGeometry args={[0.30, 0.62, 0.028]} />
      </mesh>
      <mesh material={M.wood} position={[-0.155, 0, -0.012]}>
        <boxGeometry args={[0.16, 0.66, 0.036]} />
      </mesh>
      <mesh material={M.dark} position={[0.012, 0, -0.016]}>
        <boxGeometry args={[0.02, 0.62, 0.02]} />
      </mesh>
      {/* the leaf screwed to the frame, which stays put */}
      <mesh material={M.brass} position={[-0.035, 0, 0]}>
        <boxGeometry args={[0.062, H, 0.009]} />
      </mesh>
      <mesh material={M.hardware} position={[-0.05, 0.045, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.005, 10]} />
      </mesh>
      <mesh material={M.hardware} position={[-0.05, -0.045, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.005, 10]} />
      </mesh>

      {/* the barrel, in knuckles — the detail that says "hinge" and not
          "grey rectangle" at a hundred pixels */}
      {[-0.058, 0, 0.058].map((y) => (
        <mesh key={y} material={M.brass} position={[0, y, 0]}>
          <cylinderGeometry args={[0.023, 0.023, 0.046, 14]} />
        </mesh>
      ))}

      {/* the leaf on the door, which is the half that has let go */}
      <group ref={leaf}>
        <mesh material={M.brass} position={[0.035, 0, 0]}>
          <boxGeometry args={[0.062, H, 0.009]} />
        </mesh>
        <mesh material={M.hardware} position={[0.05, 0.045, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.005, 10]} />
        </mesh>
        <mesh material={M.hardware} position={[0.05, -0.045, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.005, 10]} />
        </mesh>
      </group>

      {/* the pin he is tapping home */}
      <mesh ref={pin} material={M.hardware}>
        <cylinderGeometry args={[0.012, 0.012, 0.03, 12]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- dispatcher */

/* ------------------------------------------------------------- showerhead */

/**
 * A shower head drooping on its arm, dripping.
 *
 * Added for a measured reason rather than for the count. Plumbing had exactly
 * one job in a library of ten, and a scheduler that rewards contrast picks the
 * only job in a thin category far too often — the tap was turning up twice in
 * every ten repairs while everything else turned up once. A second plumbing
 * repair is the fix, and this is the one that shares the most with what already
 * exists: the same tiles, the same wrench, the same drip, at a different height
 * and in a different stance.
 */
function ShowerHead({ id }: FixableProps) {
  const arm = useRef<THREE.Group>(null);
  const drip = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const t = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    /* Drooping, then squared up: the whole payoff in one angle. */
    if (arm.current) arm.current.rotation.z = -DEG(26) * broken;
    if (drip.current) {
      t.current += dt * 0.85;
      if (t.current > 1) t.current = 0;
      drip.current.position.y = -0.1 - t.current * 0.2;
      const size = (1 - t.current * 0.6) * broken;
      drip.current.scale.setScalar(Math.max(0.001, size));
    }
  });

  return (
    <group>
      {/* the wall fitting the arm screws into */}
      <mesh material={M.metal} position={[-0.16, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.026, 0.02, 12]} />
      </mesh>
      <group ref={arm} position={[-0.16, 0.02, 0]}>
        <mesh material={M.metal} position={[0.085, -0.01, 0.01]} rotation={[0, 0, -0.32]}>
          <cylinderGeometry args={[0.011, 0.011, 0.18, 10]} />
        </mesh>
        <group position={[0.165, -0.04, 0.02]} rotation={[0, 0, -0.9]}>
          <mesh material={M.metal}>
            <cylinderGeometry args={[0.055, 0.028, 0.045, 16]} />
          </mesh>
          <mesh material={M.hardware} position={[0, -0.024, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.006, 16]} />
          </mesh>
        </group>
        <mesh ref={drip} material={M.accent} position={[0.165, -0.1, 0.02]}>
          <sphereGeometry args={[0.009, 8, 8]} />
        </mesh>
      </group>
    </group>
  );
}

const REGISTRY: Record<string, (props: FixableProps) => React.JSX.Element> = {
  showerhead: ShowerHead,
  outlet: Outlet,
  frame: PictureFrame,
  shelf: Shelf,
  faucet: Faucet,
  cabinet: Cabinet,
  lamp: Lamp,
  switch: LightSwitch,
  doorknob: Doorknob,
  towelbar: TowelBar,
  detector: SmokeDetector,
  hinge: DoorHinge,
};

export default function FixableObject({
  kind,
  scale = 1,
  rotationDeg = [0, 0, 0],
  id,
  position,
}: {
  kind: ObjectKind;
  id: string;
  position: [number, number, number];
  scale?: number;
  /**
   * A few degrees of tilt on each prop.
   *
   * The camera is almost head-on, and head-on a box shows one face and reads
   * as a rectangle. Turning each prop a little catches a second, shaded face
   * and it becomes a solid again — which is the whole point: the stage is
   * flat, the things standing on it are not.
   */
  rotationDeg?: [number, number, number];
}) {
  const Component = REGISTRY[kind];
  if (!Component) return null;
  /*
   * Lab only: draw the character without anything he is working on.
   *
   * The test that matters for stance variety is whether six repairs look like
   * six physical situations with the props COVERED — with them visible a
   * lamp and a cabinet look different no matter what the body is doing, which
   * is exactly how a library of one standing pose survived this long.
   */
  if (
    process.env.NODE_ENV !== "production" &&
    (window as unknown as Record<string, unknown>).__fxHideProps
  ) {
    return null;
  }
  /*
   * Position, rotation and scale all go on the wrapper and the prop is drawn
   * at the origin. Scaling a group that also carries the position would scale
   * the position, drifting the object off the anchor his hand reaches for.
   */
  return (
    <group
      position={position}
      rotation={[
        THREE.MathUtils.degToRad(rotationDeg[0]),
        THREE.MathUtils.degToRad(rotationDeg[1]),
        THREE.MathUtils.degToRad(rotationDeg[2]),
      ]}
      scale={scale}
    >
      <Component id={id} />
    </group>
  );
}
