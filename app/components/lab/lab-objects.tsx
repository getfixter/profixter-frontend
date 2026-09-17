"use client";

import { useEffect, useMemo, useRef } from "react";
import { actionCycle, actionHit, actionPhase } from "./lab-action";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  M,
  createGlowTexture,
  createLampMaterial,
  createSmokeTexture,
  createSparkTexture,
  createDropTexture,
} from "./lab-materials";
import {
  getObjectBusy,
  getObjectFix,
  getObjectNudge,
  getObjectWork,
} from "./lab-object-state";

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
const SPARKS = 28;
const PUFFS = 9;
const FLASHES = 4;

/**
 * How far in front of the socket the effects live.
 *
 * His forearm reaches ACROSS this repair — he kneels beside it and the hand
 * holding the screwdriver ends up about a sixth of a unit nearer the camera
 * than the faceplate. Sparks drawn on the plate were therefore behind his own
 * arm exactly when they mattered most, during the repair. Sitting them in front
 * of the hand costs nothing at this camera angle (the tilt moves a thing this
 * near the plane by about a pixel) and guarantees the effect is never the part
 * that gets hidden.
 */
const FX_Z = 0.16;

type Spark = {
  life: number;
  ttl: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hot: number;
};

type Flare = { life: number; ttl: number; x: number; y: number; size: number };

type Fault = {
  sparkMats: THREE.MeshBasicMaterial[];
  puffMats: THREE.MeshBasicMaterial[];
  flareMats: THREE.MeshBasicMaterial[];
  flashMat: THREE.MeshBasicMaterial;
  sootMat: THREE.MeshBasicMaterial;
  sparks: Spark[];
  flares: Flare[];
  puffs: { t: number; seed: number; alive: boolean }[];
  /** How much of the stain is still there. Lags the sparks, on purpose. */
  soot: number;
  nextSpark: number;
  nextFlicker: number;
  flashFor: number;
  flashPeak: number;
  cycle: number;
  finale: boolean;
};

/**
 * Everything the fault owns, built once per socket.
 *
 * A spark is one textured quad: a hot head with a trail fraying out behind it,
 * stretched along the direction it is travelling. Bare rectangles read as
 * sticks and soft radial dots read as haze, so the shape has to live in the
 * texture — one 96x24 canvas is the whole cost of having it.
 *
 * Normal blending throughout, never additive: this socket lives on the WHITE
 * band, and adding light to white produces white.
 */
function makeFault(): Fault {
  const glowMap = createGlowTexture();
  const smokeMap = createSmokeTexture();
  const sparkMap = createSparkTexture();
  const sparkMat = () =>
    new THREE.MeshBasicMaterial({
      map: sparkMap,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
  const flareMat = () =>
    new THREE.MeshBasicMaterial({
      map: glowMap,
      color: new THREE.Color("#ff7d1a"),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
  return {
    sparkMats: Array.from({ length: SPARKS }, sparkMat),
    /*
     * Dark smoke — but only as dark as it can afford to be.
     *
     * The socket sits on the seam between the dark hero and the white band
     * below it, and the plume rises off the white and INTO the dark. True soot
     * reads beautifully against the page and vanishes completely against the
     * hero, which is half the audience seeing no smoke at all. This grey is the
     * darkest value that still lifts off the navy.
     */
    puffMats: Array.from(
      { length: PUFFS },
      () =>
        new THREE.MeshBasicMaterial({
          map: smokeMap,
          color: new THREE.Color("#4a505c"),
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
    ),
    flareMats: Array.from({ length: FLASHES }, flareMat),
    flashMat: flareMat(),
    /*
     * The soot mark above the socket.
     *
     * Static, and the only part of the fault that is not a particle. A burnt
     * contact leaves a stain, and a stain is the one piece of evidence that is
     * still there between sparks — so the socket reads as broken even in the
     * frames where nothing is happening. It goes when the repair goes.
     */
    sootMat: new THREE.MeshBasicMaterial({
      map: smokeMap,
      color: new THREE.Color("#454b56"),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
    sparks: Array.from({ length: SPARKS }, () => ({
      life: 0, ttl: 0, x: 0, y: 0, vx: 0, vy: 0, size: 1, hot: 0,
    })),
    flares: Array.from({ length: FLASHES }, () => ({
      life: 0, ttl: 0, x: 0, y: 0, size: 1,
    })),
    puffs: Array.from({ length: PUFFS }, (_, i) => ({
      t: i / PUFFS,
      seed: Math.random() * 6.28,
      alive: true,
    })),
    soot: 1,
    nextSpark: 0.2,
    nextFlicker: 0.4,
    flashFor: 0,
    flashPeak: 0,
    cycle: -1,
    finale: false,
  };
}

/**
 * Throw a handful of sparks out of the socket.
 *
 * Biased to the RIGHT, because he kneels on the left of this one and his
 * forearm was sitting on top of the best part of the effect. Sizes and
 * directions both spread, so no two bursts read as the same animation.
 */
function burst(fault: Fault, count: number, power: number, atTip = false): void {
  if (process.env.NODE_ENV !== "production" && (window as unknown as Record<string, unknown>).__fxNoSparks) return;
  for (let n = 0; n < count; n++) {
    const spark = fault.sparks.find((s) => s.life <= 0);
    if (!spark) return;
    /*
     * Where it comes out of: the two socket faces normally, the centre screw
     * while he is turning it.
     *
     * Moving the origin under the tip is what makes the tool the cause rather
     * than the accompaniment. Timing alone got most of the way there — the
     * sparks fire on his turns — but they were still coming out of the sockets
     * a centimetre below the thing he was touching, and the eye notices that
     * before it notices the rhythm.
     */
    const slot = Math.random() < 0.68 ? -0.028 : 0.028;
    spark.x = (Math.random() - 0.5) * 0.03;
    spark.y = atTip ? (Math.random() - 0.5) * 0.02 : slot;
    /*
     * Mostly out to the right and down, but a third go anywhere at all.
     *
     * The bias is his: he kneels on the left of this socket, so the right is
     * the half of the effect nothing is standing in front of. The wild third
     * is what stops a burst reading as a fan — real arcing has no preferred
     * direction, it only has a preferred SIDE once something is in the way.
     */
    const wild = Math.random() < 0.34;
    /*
     * Thrown on an angle, not on a pair of ranges.
     *
     * Written as independent vx and vy every spark came out heading down and
     * right at about the same forty-five degrees, and forty sparks on the same
     * heading is rain. An angle and a speed give a real fan: a wide arc out of
     * the socket, a third of them in any direction at all, and speeds spread
     * far enough apart that the near ones and the far ones are different
     * sparks rather than the same spark at two ages.
     */
    const ang = wild
      ? Math.random() * Math.PI * 2
      : -1.0 + Math.random() * 2.2;
    const speed = (0.1 + Math.random() * 0.42) * power;
    spark.vx = Math.cos(ang) * speed;
    spark.vy = Math.sin(ang) * speed;
    spark.ttl = 0.2 + Math.random() * 0.26;
    spark.life = spark.ttl;
    /*
     * Three to one between the smallest and the largest, so a burst has grain.
     *
     * Both the size and the reach came back far too big on the first pass at
     * this: with the socket itself now four times what it was, sparks written
     * in its local units grew with it and came out as orange planks flying
     * half a phone screen. A spark has to be SMALLER than the thing it comes
     * out of, and it has to stay near it.
     */
    const big = Math.random() < 0.1;
    spark.size = (big ? 0.017 + Math.random() * 0.008 : 0.007 + Math.random() * 0.01) *
      (0.85 + power * 0.3);
    spark.hot = Math.random();
  }
}

/** A small flash somewhere on or beside the plate. */
function flare(fault: Fault, power: number, atTip = false): void {
  const f = fault.flares.find((x) => x.life <= 0);
  if (!f) return;
  f.x = atTip ? (Math.random() - 0.5) * 0.03 : (Math.random() - 0.35) * 0.1;
  f.y = atTip ? (Math.random() - 0.5) * 0.03 : (Math.random() - 0.5) * 0.12;
  f.ttl = 0.09 + Math.random() * 0.12;
  f.life = f.ttl;
  f.size = (0.055 + Math.random() * 0.055) * power;
}

/**
 * One frame of the fault.
 *
 * A module function rather than inline, because the React Compiler (correctly)
 * refuses mutation of anything that reached the component through a hook — and
 * a particle is nothing but mutation.
 *
 * `stroke` is seconds since he started working, or 0 when nobody is there. It
 * is the SAME clock the screwdriver animates on, which is the whole point: the
 * sparks fire on his turns rather than beside them.
 */
function stepFault(
  fault: Fault,
  group: THREE.Group,
  sparkMeshes: (THREE.Mesh | null)[],
  puffMeshes: (THREE.Mesh | null)[],
  flareMeshes: (THREE.Mesh | null)[],
  flash: THREE.Mesh | null,
  broken: number,
  fixed: number,
  stroke: number,
  step: number
): void {
  const working = stroke > 0;
  /*
   * How hard the fault is running, which is NOT how bent the faceplate is.
   *
   * Tying the effects straight to `broken` faded them out across the whole
   * repair, so the sparks were at half strength exactly when he was working
   * hardest and the big finish arrived after the show had already quietened
   * down. The plate straightens on its own curve; the electricity holds full
   * strength until the fix actually lands and then stops within a breath — a
   * fault does not taper, it goes out.
   */
  const heat = Math.min(1, broken * 2.2);

  /*
   * The payoff: one big flash as the repair takes hold, then silence.
   *
   * Fired on the way up rather than at the end, so it belongs to the fix
   * landing rather than to him straightening up afterwards.
   */
  if (!fault.finale && fixed > 0.3) {
    fault.finale = true;
    fault.flashFor = 0.34;
    fault.flashPeak = 1;
    burst(fault, 14, 1.7, true);
    flare(fault, 1.6, true);
    flare(fault, 1.2);
  }
  if (fixed < 0.02) fault.finale = false;

  /* Mended, and the aftermath over: wipe it, hide it, stop paying for it. */
  const settled =
    fault.soot < 0.02 &&
    !fault.puffs.some((puff) => puff.alive) &&
    !fault.sparks.some((spark) => spark.life > 0);
  if (broken < 0.05 && fault.flashFor <= 0 && settled) {
    if (group.visible) {
      for (const mat of fault.sparkMats) mat.opacity = 0;
      for (const mat of fault.puffMats) mat.opacity = 0;
      for (const mat of fault.flareMats) mat.opacity = 0;
      fault.flashMat.opacity = 0;
      fault.sootMat.opacity = 0;
      for (const spark of fault.sparks) spark.life = 0;
      for (const f of fault.flares) f.life = 0;
      fault.soot = 0;
      group.visible = false;
    }
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__fxFault = { off: true };
    }
    return;
  }
  group.visible = true;

  /*
   * The stain fades on the smoke's clock, not the sparks'.
   *
   * A scorch mark that vanishes on the same frame as the last spark reads as a
   * light being switched off. This one is still there, faintly, while the last
   * of the smoke clears — and then it is not.
   */
  fault.soot += (Math.min(1, heat * 3) - fault.soot) * Math.min(1, step * 1.8);
  fault.sootMat.opacity = 0.34 * fault.soot;

  /*
   * HIS TURNS DRIVE THE SPARKS.
   *
   * actionCycle counts the screwdriver's repetitions on the clock the tool is
   * animating from, so this fires on the turn rather than on a timer of its
   * own. Without it you get a man moving and particles happening, which is two
   * things; with it you get one thing, and it reads as him causing it.
   */
  if (working && heat > 0.3) {
    const cycle = actionCycle("turn", stroke);
    if (cycle !== fault.cycle) {
      fault.cycle = cycle;
      /*
       * Every turn throws sparks; every third turn is a proper bang.
       *
       * The uneven one matters more than the frequent one. A reaction on every
       * single turn and nothing else is just a louder metronome — the third
       * beat landing harder is what gives the repair a shape you can hear
       * without sound, and it is why the work reads as going somewhere rather
       * than as a loop playing until a timer runs out.
       */
      const heavy = cycle % 3 === 2;
      burst(fault, heavy ? 10 : 5 + Math.floor(Math.random() * 3), heavy ? 1.7 : 1.25, true);
      flare(fault, heavy ? 1.5 : 1.05, true);
      fault.flashFor = Math.max(fault.flashFor, heavy ? 0.22 : 0.14);
      fault.flashPeak = Math.max(fault.flashPeak, heavy ? 1 : 0.78);
    }
    /* And a shower on the push, halfway through each turn. */
    if (actionHit("press", actionPhase("turn", stroke))) {
      burst(fault, 2 + Math.floor(Math.random() * 3), 1, true);
      flare(fault, 0.8, true);
      fault.flashFor = Math.max(fault.flashFor, 0.08);
      fault.flashPeak = Math.max(fault.flashPeak, 0.5);
    }
  }

  /*
   * Ambient faulting, on randomised gaps.
   *
   * Short gaps so there is nearly always something happening, but never the
   * same gap twice — a fault on a metronome is a lamp.
   */
  fault.nextSpark -= step;
  if (fault.nextSpark <= 0 && heat > 0.3) {
    const strong = Math.random() < 0.38;
    burst(
      fault,
      strong ? 7 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 4),
      strong ? 1.45 : 1
    );
    if (strong) {
      flare(fault, 1.2);
      fault.flashFor = Math.max(fault.flashFor, 0.15);
      fault.flashPeak = Math.max(fault.flashPeak, 0.8);
    }
    /*
     * Never a long silence.
     *
     * The gaps are what make it read as a fault rather than a loop, but the
     * long end of them was landing whole seconds with nothing on screen at all
     * — and somebody arriving on the page during one of those sees a crooked
     * faceplate and no fault. Varied, and never quiet for more than about a
     * third of a second.
     */
    fault.nextSpark = strong
      ? 0.22 + Math.random() * 0.42
      : 0.05 + Math.random() * 0.2;
  }

  /* Irregular flicker: a low pulse on its own ragged clock. */
  fault.nextFlicker -= step;
  if (fault.nextFlicker <= 0 && heat > 0.3) {
    fault.flashFor = Math.max(fault.flashFor, 0.08);
    fault.flashPeak = Math.max(fault.flashPeak, 0.35 + Math.random() * 0.3);
    if (Math.random() < 0.55) flare(fault, 0.85);
    fault.nextFlicker = 0.08 + Math.random() * 0.55;
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
    spark.vy -= 1.25 * step;
    spark.x += spark.vx * step;
    spark.y += spark.vy * step;
    const u = Math.max(0, spark.life / spark.ttl);
    /*
     * The HEAD goes where the particle is; the trail is drawn behind it.
     *
     * The texture's bright end sits about a third of the way in from the quad's
     * leading edge, so the quad is pushed back along its own heading to put
     * that end on the point that is actually moving. Without it the streak
     * straddles the particle and the hot end runs ahead of the spark.
     */
    const ang = Math.atan2(spark.vy, spark.vx);
    const len = spark.size * (1.9 + u * 1.7);
    mesh.rotation.z = ang;
    mesh.position.set(
      spark.x - Math.cos(ang) * len * 0.34,
      spark.y - Math.sin(ang) * len * 0.34,
      FX_Z + 0.02
    );
    /* Soft across its width now, so it can be thicker without reading as a bar. */
    mesh.scale.set(len, spark.size * 0.62, 1);
    /*
     * The texture carries the heat; this only varies how deep each one is.
     *
     * A white-hot head would be the honest thing and is invisible on a white
     * band, so the hottest this gets is amber and the cooler ones tint down
     * toward red rather than up toward white.
     */
    mat.color.setRGB(1, 0.74 + spark.hot * 0.26, 0.66 + spark.hot * 0.34);
    mat.opacity = Math.min(1, u * 4) * heat;
  }

  for (let i = 0; i < FLASHES; i++) {
    const f = fault.flares[i];
    const mesh = flareMeshes[i];
    const mat = fault.flareMats[i];
    if (!mesh || !mat) continue;
    if (f.life <= 0) {
      if (mat.opacity !== 0) mat.opacity = 0;
      continue;
    }
    f.life -= step;
    const u = Math.max(0, f.life / f.ttl);
    mesh.position.set(f.x, f.y, FX_Z + 0.01);
    mesh.scale.setScalar(f.size * (0.7 + (1 - u) * 0.7));
    mat.opacity = u * 0.9 * heat;
  }

  /*
   * Smoke: dark, and clearly coming OUT of the socket.
   *
   * Born small at the top edge of the plate and growing as it climbs, so the
   * eye reads a source rather than a floating cloud. Biased right, away from
   * the arm that is about to reach across it.
   */
  for (let i = 0; i < PUFFS; i++) {
    const puff = fault.puffs[i];
    const mesh = puffMeshes[i];
    const mat = fault.puffMats[i];
    if (!mesh || !mat) continue;
    if (!puff.alive) {
      if (mat.opacity !== 0) mat.opacity = 0;
      /* Ready to run again if this socket is ever reset. */
      if (heat > 0.6) {
        puff.alive = true;
        puff.t = 0;
      }
      continue;
    }
    puff.t += step / (2.2 + (i % 4) * 0.18);
    if (puff.t > 1) {
      /*
       * Once the fault is out, a puff that finishes its climb is NOT replaced.
       *
       * This is the whole of "the smoke stops, and then the smoke that is
       * already there goes away". Fading the plume out with the sparks made the
       * two read as one event and left nothing to watch afterwards; letting the
       * column empty from the bottom up over its own couple of seconds gives
       * the repair an aftermath, which is what a viewer needs in order to
       * notice that it is over.
       */
      if (heat <= 0.3) {
        puff.alive = false;
        mat.opacity = 0;
        continue;
      }
      puff.t -= 1;
      puff.seed = Math.random() * 6.28;
    }
    const u = puff.t;
    mesh.position.set(
      0.016 + Math.sin(u * 3.3 + puff.seed) * 0.032 + u * 0.03,
      0.035 + u * 0.26,
      FX_Z - 0.02 + (i % 3) * 0.004
    );
    mesh.scale.setScalar(0.048 + u * 0.14);
    mesh.rotation.z = puff.seed + u * 1.1;
    /*
     * Opaque almost at once, then thinning the whole way up.
     *
     * Fading IN would be honest and is wrong: a puff that arrives gradually
     * seems to condense out of the air a little above the socket, and the one
     * thing this has to say is where it is coming FROM. Full darkness within a
     * few pixels of the faceplate puts the source beyond doubt.
     */
    /*
     * No `heat` in here at all: the puff's own life is the only thing that
     * fades it, so the last of the smoke drifts off after the sparks have
     * stopped rather than being switched off with them.
     */
    mat.opacity = Math.min(1, u * 9) * Math.pow(1 - u, 1.15) * 0.62;
  }

  if (process.env.NODE_ENV !== "production") {
    (window as unknown as Record<string, unknown>).__fxFault = {
      sparks: fault.sparks.filter((x) => x.life > 0).length,
      flares: fault.flares.filter((x) => x.life > 0).length,
      smoke: +fault.puffMats.reduce((a, m) => a + m.opacity, 0).toFixed(2),
      flash: +fault.flashMat.opacity.toFixed(2),
      broken: +broken.toFixed(2),
      heat: +heat.toFixed(2),
    };
  }

  /* The flicker, the bursts and the closing flash all share this quad. */
  if (fault.flashFor > 0) {
    fault.flashFor -= step;
    const u = Math.max(0, fault.flashFor) / 0.3;
    if (flash) {
      flash.scale.setScalar(0.2 + (1 - u) * 0.14);
      fault.flashMat.opacity = Math.min(1, u * 1.6) * fault.flashPeak * 0.85 * heat;
    }
  } else {
    fault.flashPeak = 0;
    if (fault.flashMat.opacity !== 0) fault.flashMat.opacity = 0;
  }
}

/**
 * The faceplate's snap back to square.
 *
 * `t` is seconds since the repair landed, and this is a damped cosine: it
 * leaves the crooked angle immediately, crosses level in about a sixteenth of
 * a second, tips a couple of degrees past, and settles. Easing the tilt out
 * along with the fix value was the honest version and it had no moment in it —
 * the plate simply became less crooked until it wasn't. A thing that snaps is a
 * thing you saw happen.
 */
function snapCurve(t: number): number {
  if (t < 0) return 1;
  return Math.exp(-13 * t) * Math.cos(25 * t);
}

function Outlet({ id }: FixableProps) {
  const plate = useRef<THREE.Group>(null);
  const screw = useRef<THREE.Mesh>(null);
  /* Seconds since the snap, or below zero while it is still broken. */
  const snap = useRef(-1);
  const faultGroup = useRef<THREE.Group>(null);
  const sparkMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const puffMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const flareMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const flash = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const fault = useMemo(() => makeFault(), []);

  useFrame((_, dt) => {
    const step = Math.min(0.05, dt);
    const target = getObjectFix(id);
    f.current = ease(f.current, target, dt);
    const broken = 1 - f.current;
    /*
     * The snap fires a breath AFTER the closing flash, which goes off at 0.3.
     *
     * Order is the whole point of the beat: bang, then the plate goes straight.
     * The other way round it reads as the plate being knocked crooked-to-square
     * by something that happened afterwards.
     */
    if (snap.current < 0 && f.current > 0.42) snap.current = 0;
    if (snap.current >= 0) snap.current += dt;
    if (target < 0.02 && snap.current >= 0) snap.current = -1;
    const tilt = snapCurve(snap.current);
    /* Crooked enough to notice, and a screw standing visibly proud — the two
       things that say "this is wrong" without anybody reading a label. */
    if (plate.current) plate.current.rotation.z = DEG(15) * tilt;
    if (screw.current) {
      screw.current.position.z = 0.004 + 0.011 * Math.max(0, tilt);
    }

    const group = faultGroup.current;
    if (!group) return;
    stepFault(
      fault,
      group,
      sparkMeshes.current,
      puffMeshes.current,
      flareMeshes.current,
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
        while the faceplate hangs crooked. Flagged so the prop's drop shadow
        measures the socket and not these unit-sized quads.
      */}
      <group ref={faultGroup} userData={{ fx: true }}>
        {/* The stain sits just behind the plate's top edge, on the wall. */}
        <mesh material={fault.sootMat} position={[0.008, 0.075, -0.004]} scale={0.19}>
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
        <mesh ref={flash} material={fault.flashMat} position={[0.01, 0, FX_Z]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        {fault.flareMats.map((mat, i) => (
          <mesh
            key={`flare-${i}`}
            ref={(node) => {
              flareMeshes.current[i] = node;
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

/**
 * THE PICTURE THAT HAS COME OFF ITS HOOK AT ONE END.
 *
 * It used to rotate twenty degrees about its own middle, which is a picture
 * somebody knocked. This one hangs from a single point: the cord has come off
 * the hook on the right, so the frame is pivoting on the left corner and the
 * right one has dropped. That is a different silhouette — not a tilted
 * rectangle but a rectangle that is clearly HANGING — and it is the one that
 * says the word "crooked" without anybody having to compare it to anything.
 *
 * The only repair in the six he does with his bare hands, which is worth having
 * for its own sake: five tools and one that just needs lifting.
 */
function PictureFrame({ id }: FixableProps) {
  const tilt = useRef<THREE.Group>(null);
  const cordRight = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const settleAt = useRef(-1);

  const W = 0.3;
  const H = 0.23;
  const T = 0.016;
  const HANG_X = -W / 2 + 0.03;
  const HANG_Y = H / 2 + 0.055;

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime;
    const target = getObjectFix(id);
    f.current = ease(f.current, target, dt);
    const p = getObjectWork(id);
    const working = p > 0;

    /*
     * Two movements and a release.
     *
     * He takes the weight of the dropped corner and swings it most of the way
     * up, squares it off, then lets go — and it rocks once on its own cord
     * before it settles, because everything hanging on a wire does.
     */
    const lift = ramp(p, 0.12, 0.36);
    const square = ramp(p, 0.44, 0.7);
    if (settleAt.current < 0 && working && p > 0.74) settleAt.current = 0;
    if (settleAt.current >= 0) settleAt.current += dt;
    if (target < 0.02 && !working && settleAt.current >= 0) settleAt.current = -1;

    const off = 1 - lift * 0.74 - square * 0.21;
    const swing =
      settleAt.current >= 0
        ? Math.exp(-4.2 * settleAt.current) * Math.cos(9 * settleAt.current)
        : 1;
    /* Hanging on one corner, it never quite stops moving. */
    const idle = working || target > 0.2 ? 0 : Math.sin(now * 1.6) * 0.5 + Math.sin(now * 0.93) * 0.3;

    if (tilt.current) {
      tilt.current.rotation.z =
        settleAt.current >= 0
          ? DEG(30) * off * Math.max(0, swing) + DEG(1.1) * swing
          : DEG(30) * off + DEG(1.3) * idle;
    }
    /* The cord that came off: slack on the right until he hangs it back on. */
    if (cordRight.current) {
      const hung = settleAt.current >= 0 ? 1 : lift * 0.3 + square * 0.5;
      cordRight.current.scale.y = 0.2 + hung * 0.8;
      cordRight.current.visible = hung > 0.25;
    }
  });

  return (
    <group>
      {/* The hook, which is what makes a hanging rectangle read as a picture. */}
      <mesh material={M.hardware} position={[HANG_X, HANG_Y, -0.02]}>
        <boxGeometry args={[0.016, 0.02, 0.01]} />
      </mesh>
      {/* Pivoted on the corner it is still hanging by. */}
      <group ref={tilt} position={[HANG_X, HANG_Y - 0.022, 0]}>
        {/* The cord: one leg taut, the other slack until he re-hooks it. */}
        <mesh material={M.dark} position={[0.012, -0.03, -0.012]} rotation={[0, 0, DEG(-24)]}>
          <boxGeometry args={[0.004, 0.07, 0.004]} />
        </mesh>
        <mesh
          ref={cordRight}
          material={M.dark}
          position={[W * 0.52, -0.03, -0.012]}
          rotation={[0, 0, DEG(38)]}
        >
          <boxGeometry args={[0.004, 0.16, 0.004]} />
        </mesh>
        <group position={[W / 2 - 0.03, -H / 2 - 0.055, 0]}>
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
    </group>
  );
}

/* -------------------------------------------------------------------- shelf */

/** Declared out here: a component defined inside render is remounted each pass. */
function ShelfBracket() {
  return (
    <group>
      <mesh material={M.metal} position={[0, -0.045, 0.005]}>
        <boxGeometry args={[0.018, 0.09, 0.014]} />
      </mesh>
      <mesh material={M.metal} position={[0, -0.007, 0.05]}>
        <boxGeometry args={[0.018, 0.014, 0.09]} />
      </mesh>
      <mesh material={M.metal} position={[0, -0.032, 0.03]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.012, 0.055, 0.012]} />
      </mesh>
    </group>
  );
}

/**
 * THE SHELF WITH ONE BRACKET PULLING OUT OF THE WALL.
 *
 * The board dropping is the headline; the things standing on it are the point.
 * A shelf at twenty-two degrees is a shelf at an angle, and half the people
 * looking at a phone will read that as a shelf drawn badly. Three objects
 * sliding down it and leaning over are not ambiguous — they are the reason
 * anybody cares that a shelf is level, and they give the fixed state something
 * to do besides be straight.
 */
function Shelf({ id }: FixableProps) {
  const board = useRef<THREE.Group>(null);
  const loose = useRef<THREE.Group>(null);
  const screw = useRef<THREE.Mesh>(null);
  const things = useRef<(THREE.Group | null)[]>([]);
  const gritMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const f = useRef(0);
  const seat = useRef(-1);
  const shop = useMemo(() => makeShop(), []);

  const W = 0.56;
  /* Where each thing sits when the shelf is level, and where it slides to. */
  const SITTING = [-0.17, 0.02, 0.19];

  useFrame((state, dt) => {
    const step = Math.min(0.05, dt);
    const now = state.clock.elapsedTime;
    const target = getObjectFix(id);
    f.current = ease(f.current, target, dt);
    const p = getObjectWork(id);
    const stroke = getObjectBusy(id);
    const working = p > 0;

    const lift = ramp(p, 0.1, 0.34);
    const drive = ramp(p, 0.38, 0.72);
    if (seat.current < 0 && working && p > 0.74) seat.current = 0;
    if (seat.current >= 0) seat.current += dt;
    if (target < 0.02 && !working && seat.current >= 0) seat.current = -1;
    const settle = seat.current >= 0 ? Math.max(0, seatCurve(seat.current)) : 1;

    const shake = stepShop(
      shop,
      gritMeshes.current,
      working && p > 0.36 && p < 0.76,
      stroke,
      step,
      now,
      W * 0.32,
      -0.05
    );
    const off = (1 - lift * 0.55 - drive * 0.33) * settle;
    /* A board held by one and a half brackets is never quite still. */
    const creak = working || target > 0.2 ? 0 : Math.sin(now * 1.9) * 0.5 + Math.sin(now * 1.1) * 0.3;

    if (board.current) {
      board.current.rotation.z = -DEG(22) * off - DEG(0.9) * creak - DEG(0.7) * shake;
      board.current.position.y = -0.03 * off;
    }
    /* The bracket that has come away: dropped, swung out and hanging. */
    if (loose.current) {
      loose.current.position.y = -0.07 * off;
      loose.current.position.z = 0.04 * off;
      loose.current.rotation.x = DEG(24) * off;
      loose.current.rotation.z = DEG(11) * off;
    }
    if (screw.current) {
      screw.current.position.z = 0.012 + 0.055 * off;
      if (working && p > 0.36 && p < 0.76) screw.current.rotation.y = stroke * 9;
    }

    /*
     * And the things on it.
     *
     * They lean with the board and slide toward the low end, and the one on the
     * end leans furthest — which is the bit that reads as "this is about to go
     * on the floor" rather than "this is on a slope".
     */
    for (let i = 0; i < things.current.length; i++) {
      const node = things.current[i];
      if (!node) continue;
      const bias = (i + 1) / things.current.length;
      node.position.x = SITTING[i] + 0.05 * off * bias;
      node.rotation.z = -DEG(13) * off * (0.5 + bias * 0.8);
    }

  });

  return (
    <group>
      {/* The wall plate the far bracket is still screwed to. */}
      <group ref={board}>
        <mesh material={M.wood} position={[0, 0, 0.055]}>
          <boxGeometry args={[W, 0.032, 0.15]} />
        </mesh>
        <group position={[-W * 0.32, -0.016, 0]}>
          <ShelfBracket />
        </group>
        <group ref={loose} position={[W * 0.32, -0.016, 0]}>
          <ShelfBracket />
          <mesh
            ref={screw}
            material={M.brass}
            position={[0, -0.05, 0.012]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.009, 0.009, 0.014, 10]} />
          </mesh>
        </group>
        {/* Three things that would rather be on a level shelf. */}
        {SITTING.map((x, i) => (
          <group
            key={x}
            ref={(node) => {
              things.current[i] = node;
            }}
            position={[x, 0, 0.06]}
          >
            {i === 2 ? (
              <mesh material={M.paint} position={[0, 0.05, 0]}>
                <cylinderGeometry args={[0.038, 0.032, 0.07, 14]} />
              </mesh>
            ) : (
              <>
                <mesh material={i ? M.accent : M.brass} position={[-0.012, 0.055, 0]}>
                  <boxGeometry args={[0.022, 0.09, 0.07]} />
                </mesh>
                <mesh material={i ? M.brass : M.accent} position={[0.014, 0.05, 0]}>
                  <boxGeometry args={[0.026, 0.08, 0.066]} />
                </mesh>
              </>
            )}
          </group>
        ))}
      </group>
      {/* Dust out of the bracket while he drives the screw. */}
      <group userData={{ fx: true }}>
        {shop.gritMats.map((mat, i) => (
          <mesh
            key={`grit-${i}`}
            ref={(node) => {
              gritMeshes.current[i] = node;
            }}
            material={mat}
            scale={0.03}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- faucet */

/**
 * THE TAP THAT WILL NOT STOP.
 *
 * The old one had a single bead of blue sliding down a quarter of an inch every
 * second, which is honest plumbing and invisible marketing: at phone size it
 * was one pixel of accent colour, and nothing about the object said the word
 * "leak". This is the opposite bet. The joint under the spout sprays, the spout
 * itself runs, both of them land in the basin and throw rings, and the bowl
 * fills with standing water — four things all saying one thing, which is what
 * it takes for a glance to land.
 *
 * The payoff is the rarest one in the set: it is a thing STOPPING. Everything
 * else here ends with something appearing — a light, a straight door, a clean
 * socket. This ends with the screen going quiet, and it is worth the couple of
 * last drips that make the quiet deliberate rather than a switch being thrown.
 */
const DROPS = 34;
const RINGS = 5;

type Drop = { life: number; x: number; y: number; z: number; vx: number; vy: number; size: number };
type Ring = { life: number; x: number; z: number };

type Water = {
  dropMats: THREE.MeshBasicMaterial[];
  ringMats: THREE.MeshBasicMaterial[];
  poolMat: THREE.MeshBasicMaterial;
  drops: Drop[];
  rings: Ring[];
  nextSpray: number;
  nextRun: number;
  pool: number;
};

/** Where a drop stops falling, and where the standing water sits. */
const BASIN_Y = -0.045;
const WATER_Y = -0.052;

function makeWater(): Water {
  const dropMap = createDropTexture();
  return {
    dropMats: Array.from(
      { length: DROPS },
      () =>
        new THREE.MeshBasicMaterial({
          map: dropMap,
          color: new THREE.Color("#8ecbe8"),
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
    ),
    ringMats: Array.from(
      { length: RINGS },
      () =>
        new THREE.MeshBasicMaterial({
          map: dropMap,
          color: new THREE.Color("#a9d8ee"),
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
    ),
    poolMat: new THREE.MeshBasicMaterial({
      map: dropMap,
      color: new THREE.Color("#9ed0e8"),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
    drops: Array.from({ length: DROPS }, () => ({
      life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, size: 1,
    })),
    rings: Array.from({ length: RINGS }, () => ({ life: 0, x: 0, z: 0 })),
    nextSpray: 0,
    nextRun: 0,
    pool: 0,
  };
}

/** A drop, thrown from wherever it is thrown from. */
function spill(
  water: Water,
  x: number,
  y: number,
  vx: number,
  vy: number,
  size: number
): void {
  const drop = water.drops.find((d) => d.life <= 0);
  if (!drop) return;
  drop.x = x;
  drop.y = y;
  drop.z = 0.05 + Math.random() * 0.05;
  drop.vx = vx;
  drop.vy = vy;
  drop.size = size;
  drop.life = 1;
}

/** The ring a drop leaves on the water it lands in. */
function ripple(water: Water, x: number, z: number): void {
  const ring = water.rings.find((r) => r.life <= 0);
  if (!ring) return;
  ring.x = x;
  ring.z = z;
  ring.life = 1;
}

/**
 * One frame of the leak.
 *
 * `flow` is how badly it is leaking, 1 to 0, and it is the only input that
 * matters: the spray rate, the run rate, the size of everything and the depth
 * of the standing water all come off it, so one number turning down turns the
 * whole thing down together.
 */
function stepWater(
  water: Water,
  group: THREE.Group,
  dropMeshes: (THREE.Mesh | null)[],
  ringMeshes: (THREE.Mesh | null)[],
  pool: THREE.Mesh | null,
  flow: number,
  step: number
): void {
  const live =
    flow > 0.02 ||
    water.pool > 0.01 ||
    water.drops.some((d) => d.life > 0) ||
    water.rings.some((r) => r.life > 0);
  if (!live) {
    if (group.visible) {
      for (const mat of water.dropMats) mat.opacity = 0;
      for (const mat of water.ringMats) mat.opacity = 0;
      water.poolMat.opacity = 0;
      group.visible = false;
    }
    return;
  }
  group.visible = true;

  /*
   * TWO SOURCES, because one is a drip and two is a fault.
   *
   * The joint under the spout sprays sideways — that is the failure — and the
   * spout runs into the bowl because a tap nobody can shut off does. Different
   * rates, different directions, different sizes; together they read as water
   * going where it should not.
   */
  water.nextSpray -= step;
  if (water.nextSpray <= 0 && flow > 0.05) {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const ang = -0.5 + Math.random() * 1.2;
      const speed = (0.16 + Math.random() * 0.3) * (0.45 + flow * 0.55);
      spill(
        water,
        0.012 + (Math.random() - 0.5) * 0.02,
        0.055,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed * 0.7,
        0.02 + Math.random() * 0.022
      );
    }
    water.nextSpray = (0.028 + Math.random() * 0.038) / Math.max(0.2, flow);
  }

  water.nextRun -= step;
  if (water.nextRun <= 0 && flow > 0.02) {
    spill(
      water,
      (Math.random() - 0.5) * 0.012,
      0.03,
      (Math.random() - 0.5) * 0.03,
      -0.05,
      0.024 + Math.random() * 0.018
    );
    water.nextRun = (0.03 + Math.random() * 0.026) / Math.max(0.15, flow);
  }

  for (let i = 0; i < DROPS; i++) {
    const drop = water.drops[i];
    const mesh = dropMeshes[i];
    const mat = water.dropMats[i];
    if (!mesh || !mat) continue;
    if (drop.life <= 0) {
      if (mat.opacity !== 0) mat.opacity = 0;
      continue;
    }
    drop.vy -= 1.5 * step;
    drop.x += drop.vx * step;
    drop.y += drop.vy * step;
    if (drop.y <= BASIN_Y) {
      drop.life = 0;
      mat.opacity = 0;
      if (Math.abs(drop.x) < 0.2 && Math.random() < 0.5) ripple(water, drop.x, drop.z);
      continue;
    }
    mesh.position.set(drop.x, drop.y, drop.z);
    /*
     * Narrow and stretched, which is what turns a dot into moving water.
     *
     * Round drops at the size this needs to be seen at merged into one white
     * cloud and the tap looked like it was steaming. Thin ones overlap without
     * filling in, so twenty of them still read as twenty.
     */
    const stretch = 1 + Math.min(2.2, Math.abs(drop.vy) * 2.4);
    mesh.scale.set(drop.size * 0.62, drop.size * stretch, 1);
    mat.opacity = 0.85;
  }

  for (let i = 0; i < RINGS; i++) {
    const ring = water.rings[i];
    const mesh = ringMeshes[i];
    const mat = water.ringMats[i];
    if (!mesh || !mat) continue;
    if (ring.life <= 0) {
      if (mat.opacity !== 0) mat.opacity = 0;
      continue;
    }
    ring.life -= step * 3.2;
    const u = Math.max(0, ring.life);
    /*
     * Flat to the camera, not flat to the world.
     *
     * A ring lying on the surface of the water is the correct thing to model
     * and, under a camera this close to head-on, is a horizontal line four
     * pixels long. These are drawn facing the viewer and squashed by hand,
     * which is a cheat and is the only version anybody can see.
     */
    mesh.position.set(ring.x, WATER_Y, 0.12);
    const w = 0.04 + (1 - u) * 0.13;
    mesh.scale.set(w, w * 0.34, 1);
    mat.opacity = u * 0.6;
  }

  /* Standing water, which fills while it leaks and drains when it stops. */
  water.pool +=
    ((flow > 0.05 ? Math.min(1, 0.35 + flow) : 0) - water.pool) *
    Math.min(1, step * (flow > 0.05 ? 1.6 : 0.9));
  if (pool) {
    pool.scale.set(0.2 + water.pool * 0.22, 0.05 + water.pool * 0.055, 1);
    water.poolMat.opacity = water.pool * 0.8;
  }
}

function Faucet({ id }: FixableProps) {
  const handle = useRef<THREE.Group>(null);
  const spout = useRef<THREE.Group>(null);
  const wet = useRef<THREE.Group>(null);
  const dropMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const ringMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const pool = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const water = useMemo(() => makeWater(), []);

  useFrame((_, dt) => {
    const step = Math.min(0.05, dt);
    const target = getObjectFix(id);
    f.current = ease(f.current, target, dt);
    const broken = 1 - f.current;
    const p = getObjectWork(id);
    const working = p > 0;

    /*
     * THE LEAK COMES DOWN IN STEPS, on his turns.
     *
     * A wrench does not taper anything; it takes a bite, stops, and takes
     * another. So the flow holds, drops when the first turn lands, holds again,
     * drops on the second, and is shut off by the last one — which is the
     * difference between a man tightening a nut and a man standing beside a
     * fade-out.
     */
    const flow = working
      ? 1 - 0.42 * ramp(p, 0.16, 0.3) - 0.36 * ramp(p, 0.46, 0.6) - 0.22 * ramp(p, 0.72, 0.82)
      : broken;

    if (handle.current) handle.current.rotation.z = DEG(40) * broken;
    if (spout.current) spout.current.rotation.z = DEG(6) * broken;

    const group = wet.current;
    if (!group) return;
    stepWater(
      water,
      group,
      dropMeshes.current,
      ringMeshes.current,
      pool.current,
      Math.max(0, flow),
      step
    );
  });

  return (
    /*
      SET BACK, so he can stand in front of his own work.
      Everything in this world is drawn on the z=0 plane and the basin was
      modelled forward of it, so the bowl was painting over the man crouched at
      it — he was working from inside the cupboard under the sink. Pushing the
      whole fitting behind the character plane costs nothing at this camera and
      puts him where a person would be.
    */
    <group position={[0, 0, -0.14]}>
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
        {/* The nut he puts the wrench on, and the thing that is weeping. */}
        <mesh material={M.hardware} position={[0, 0.055, 0.012]}>
          <cylinderGeometry args={[0.028, 0.028, 0.026, 6]} />
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

      {/* Everything wet. Flagged so the drop shadow measures the basin. */}
      <group ref={wet} userData={{ fx: true }}>
        <mesh ref={pool} material={water.poolMat} position={[0, WATER_Y, 0.12]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        {water.ringMats.map((mat, i) => (
          <mesh
            key={`ring-${i}`}
            ref={(node) => {
              ringMeshes.current[i] = node;
            }}
            material={mat}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
        {water.dropMats.map((mat, i) => (
          <mesh
            key={`drop-${i}`}
            ref={(node) => {
              dropMeshes.current[i] = node;
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

/* ------------------------------------------------------------------ cabinet */

/**
 * THE CABINET DOOR, coming off its top hinge.
 *
 * The old one was a brown rectangle that opened twenty-six degrees, which at a
 * phone's scale is not a story — it is not even recognisably a cabinet. The
 * damage here is authored for the silhouette first: a door pivoting on its one
 * surviving hinge, dropped far enough that its free corner hangs below the
 * carcass and its top corner has swung clear, leaving a black wedge of open
 * cupboard where the door should be. That wedge is the thing you read at sixty
 * pixels. The loose hinge, the proud screw and the skew handle are detail for
 * anybody who looks closer; none of them is carrying the message.
 *
 * Hinged on the RIGHT, which is a composition decision rather than a carpentry
 * one: he walks in from the right, so the hinge he has to work on is the near
 * edge and the ruined corner falls away from him into open space. The other way
 * round he would be reaching across the whole carcass and standing in the
 * doorway of the thing he is mending.
 */

/** Half a dozen specks of dust off the hinge, and no more than that. */
const GRIT = 9;

type Grit = { life: number; x: number; y: number; vx: number; vy: number };

type Shop = {
  gritMats: THREE.MeshBasicMaterial[];
  grit: Grit[];
  cycle: number;
  /** How hard the drill is shaking the door right now. */
  buzz: number;
};

function makeShop(): Shop {
  return {
    gritMats: Array.from(
      { length: GRIT },
      () =>
        new THREE.MeshBasicMaterial({
          color: new THREE.Color("#cbb994"),
          transparent: true,
          depthWrite: false,
          opacity: 0,
        })
    ),
    grit: Array.from({ length: GRIT }, () => ({
      life: 0, x: 0, y: 0, vx: 0, vy: 0,
    })),
    cycle: -1,
    buzz: 0,
  };
}

/** Knock a couple of specks out of the hinge. */
function shed(shop: Shop, x: number, y: number): void {
  for (let n = 0; n < 2; n++) {
    const bit = shop.grit.find((g) => g.life <= 0);
    if (!bit) return;
    bit.x = x + (Math.random() - 0.5) * 0.02;
    bit.y = y + (Math.random() - 0.5) * 0.02;
    bit.vx = (Math.random() - 0.5) * 0.12;
    bit.vy = -0.05 - Math.random() * 0.1;
    bit.life = 0.45 + Math.random() * 0.3;
  }
}

/**
 * The drill's effect on the hinge, and the dust it throws.
 *
 * A module function rather than inline for the same reason the socket's fault
 * is one: the React Compiler will not allow a value that arrived through a hook
 * to be mutated in the component body, and every particle is mutation. Returns
 * how hard the door is being shaken this frame.
 */
function stepShop(
  shop: Shop,
  meshes: (THREE.Mesh | null)[],
  drilling: boolean,
  stroke: number,
  step: number,
  now: number,
  atX: number,
  atY: number
): number {
  shop.buzz = Math.max(0, shop.buzz - step * 6);
  if (drilling) {
    const cycle = actionCycle("spin", stroke);
    if (cycle !== shop.cycle) {
      shop.cycle = cycle;
      shop.buzz = 0.18;
      if (Math.random() < 0.6) shed(shop, atX, atY);
    }
  }
  stepGrit(shop, meshes, step);
  return shop.buzz * Math.sin(now * 61);
}

function stepGrit(
  shop: Shop,
  meshes: (THREE.Mesh | null)[],
  step: number
): void {
  for (let i = 0; i < GRIT; i++) {
    const bit = shop.grit[i];
    const mesh = meshes[i];
    const mat = shop.gritMats[i];
    if (!mesh || !mat) continue;
    if (bit.life <= 0) {
      if (mat.opacity !== 0) mat.opacity = 0;
      continue;
    }
    bit.life -= step;
    bit.vy -= 1.1 * step;
    bit.x += bit.vx * step;
    bit.y += bit.vy * step;
    mesh.position.set(bit.x, bit.y, 0.13);
    mat.opacity = Math.min(1, bit.life * 3) * 0.75;
  }
}

/** Damped overshoot, for a thing that seats hard and rings once. */
function seatCurve(t: number): number {
  if (t < 0) return 1;
  return Math.exp(-11 * t) * Math.cos(21 * t);
}

/** 0 below a, 1 above b, smooth in between. */
function ramp(value: number, a: number, b: number): number {
  const u = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}

/** The opening. The timber goes round the outside of this. */
const CAB_W = 0.34;
const CAB_H = 0.44;
const RAIL = 0.038;
/** An overlay door: it covers the opening and laps onto the frame. */
const DOOR_W = CAB_W + 0.034;
const DOOR_H = CAB_H + 0.034;
const HINGE_Y = DOOR_H / 2 - 0.058;

function Cabinet({ id }: FixableProps) {
  const sag = useRef<THREE.Group>(null);
  const swing = useRef<THREE.Group>(null);
  const leafTop = useRef<THREE.Group>(null);
  const screwTop = useRef<THREE.Mesh>(null);
  const handle = useRef<THREE.Group>(null);
  const gritMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const f = useRef(0);
  const seat = useRef(-1);
  const shop = useMemo(() => makeShop(), []);

  useFrame((state, dt) => {
    const step = Math.min(0.05, dt);
    const now = state.clock.elapsedTime;
    const target = getObjectFix(id);
    f.current = ease(f.current, target, dt);
    const mended = f.current;
    const p = getObjectWork(id);
    const stroke = getObjectBusy(id);
    const working = p > 0;

    /*
     * FOUR STAGES, all read off how far through he is.
     *
     * lift  — he takes the weight and shoves it back into the opening
     * drive — the drill goes into the hinge and the leaf pulls in tight
     * seat  — the last of the droop snaps out
     * test  — he swings it and lets it fall shut
     *
     * Driven from the work progress rather than from the repair value, because
     * the repair value is one number with one shape and this is a sequence. The
     * repair value still decides whether the thing counts as MENDED; it is just
     * not what the timber is doing.
     */
    /*
     * Two shoves, not one smooth rise.
     *
     * A door that floats back into its opening is the thing to avoid above all
     * else here — it is the "he waves a tool and the cupboard heals itself"
     * failure. Lifting it in two quick heaves with a pause between them is what
     * taking the weight of something actually looks like, and the pause is
     * doing most of that work.
     */
    const lift = 0.56 * ramp(p, 0.1, 0.17) + 0.44 * ramp(p, 0.25, 0.32);
    const drive = ramp(p, 0.36, 0.7);
    /*
     * And then he tries it.
     *
     * Out, a beat, back, and a small rebound off the catch. Written as four
     * overlapping ramps rather than one curve because a door being tested is
     * four distinct events, and the beat in the middle — the moment it is just
     * hanging open, doing nothing — is what makes the closing read as a close
     * rather than as a wobble.
     */
    const test = working
      ? ramp(p, 0.76, 0.83) -
        ramp(p, 0.865, 0.945) +
        ramp(p, 0.945, 0.972) * 0.08 -
        ramp(p, 0.972, 1) * 0.08
      : 0;

    /*
     * The seat fires off the WORK CLOCK, not off the repair value.
     *
     * Keyed to the repair value it landed at the same instant as the test,
     * because that value only starts moving at seven-tenths — so the door
     * snapped square and swung open on the same frame, and the two best moments
     * in the repair cancelled each other out. Snap, look at it, then try it.
     */
    if (seat.current < 0 && working && p > 0.72) seat.current = 0;
    if (seat.current >= 0) seat.current += dt;
    if (target < 0.02 && !working && seat.current >= 0) seat.current = -1;

    /*
     * How far off true it hangs.
     *
     * A drop no hinge would survive; most of the way back when he takes the
     * weight, but only most — he is holding it roughly in place, not fixing it;
     * closer as the screw bites; and square when it seats.
     */
    const droop = 1 - lift * 0.62 - drive * 0.26;
    const settle = seat.current >= 0 ? Math.max(0, seatCurve(seat.current)) : 1;
    const off = seat.current >= 0 ? droop * settle : droop;

    /* A door hanging on one screw never quite stops moving. */
    const hang =
      working || mended > 0.1
        ? 0
        : Math.sin(now * 2.3) * 0.6 + Math.sin(now * 1.37) * 0.4;
    const shake = stepShop(
      shop,
      gritMeshes.current,
      working && p > 0.34 && p < 0.74,
      stroke,
      step,
      now,
      CAB_W / 2 - 0.02,
      HINGE_Y
    );

    /* And a knock as it lands on the catch, which is in-plane and so is seen. */
    const thud = working ? ramp(p, 0.935, 0.955) - ramp(p, 0.955, 0.995) : 0;

    if (sag.current) {
      sag.current.rotation.z =
        DEG(31) * off + DEG(2.4) * hang + DEG(0.9) * shake + DEG(1.7) * thud;
      /*
       * And it has SUNK.
       *
       * Rotation alone leaves the door pinned at one corner, which reads as
       * tilted rather than as failing. Dropping the whole thing half an inch as
       * well is the difference: the screws are pulling out of the carcass, so
       * the door is both crooked AND lower than its own opening.
       */
      sag.current.position.y = -HINGE_Y - 0.042 * off;
    }
    if (swing.current) {
      /*
       * Open while it is wrecked, shut once he has lifted it, and then the test
       * pushes it out and lets it fall closed again.
       */
      /*
       * The test has to swing WIDE.
       *
       * This camera is very nearly head-on, so a door opening thirty degrees
       * foreshortens by about a seventh and reads as nothing at all — I shot
       * the whole test window and could not tell the open frames from the shut
       * ones. Sixty takes the door to half its width and lays the dark of the
       * cupboard bare, which is a door opening rather than a door being
       * described as opening.
       */
      /*
       * Positive, which is the door swinging OUT.
       *
       * It was negative, and negative takes the free edge backwards through the
       * carcass: the door was opening into the cupboard, so what the test
       * showed was its back face sliding behind the frame. Right shape, wrong
       * side of the wall, and invisible as a result.
       */
      swing.current.rotation.y = DEG(20) * off + DEG(60) * test;
    }

    /*
     * The hinge is what the drill is actually pointed at.
     *
     * Its leaf starts pulled off the carcass and twisted, closes as he drives
     * the screw home, and the screw turns and sinks flush on the same clock the
     * bit spins on — so the metal moves when the tool does.
     */
    const gap = 1 - Math.max(drive, seat.current >= 0 ? 1 : 0);
    if (leafTop.current) {
      leafTop.current.position.x = 0.055 * gap;
      leafTop.current.position.z = 0.04 * gap;
      leafTop.current.rotation.z = -DEG(19) * gap;
    }
    if (screwTop.current) {
      screwTop.current.position.z = 0.026 + 0.05 * gap;
      if (working && p > 0.34 && p < 0.74) screwTop.current.rotation.y = stroke * 9;
    }
    /* The handle hangs skew until the door is back on true. */
    if (handle.current) handle.current.rotation.z = DEG(14) * off;

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__fxCab = {
        p: +p.toFixed(2),
        lift: +lift.toFixed(2),
        drive: +drive.toFixed(2),
        test: +test.toFixed(2),
        off: +off.toFixed(2),
        mended: +mended.toFixed(2),
      };
    }
  });

  const inset = 0.062;

  return (
    <group>
      {/*
        A CARCASS WITH A HOLE IN IT, which the old one was not.
        It was a solid slab with the cupboard interior modelled behind its own
        front face, so there was nothing to see through and a door hanging off
        read as a panel lying on a brown square. Four rails around an open
        middle is the whole fix: now the door is covering something, and when it
        stops covering it you can see what.
      */}
      <mesh material={M.cavity} position={[0, 0, -0.085]}>
        <boxGeometry args={[CAB_W, CAB_H, 0.02]} />
      </mesh>
      <mesh material={M.wood} position={[0, CAB_H / 2 + RAIL / 2, -0.04]}>
        <boxGeometry args={[CAB_W + RAIL * 2, RAIL, 0.1]} />
      </mesh>
      <mesh material={M.wood} position={[0, -CAB_H / 2 - RAIL / 2, -0.04]}>
        <boxGeometry args={[CAB_W + RAIL * 2, RAIL, 0.1]} />
      </mesh>
      <mesh material={M.wood} position={[-CAB_W / 2 - RAIL / 2, 0, -0.04]}>
        <boxGeometry args={[RAIL, CAB_H, 0.1]} />
      </mesh>
      <mesh material={M.wood} position={[CAB_W / 2 + RAIL / 2, 0, -0.04]}>
        <boxGeometry args={[RAIL, CAB_H, 0.1]} />
      </mesh>
      {/* The carcass halves of the hinges, screwed to the right-hand rail. */}
      <mesh material={M.hardware} position={[CAB_W / 2 + 0.006, HINGE_Y, 0.014]}>
        <boxGeometry args={[0.04, 0.054, 0.014]} />
      </mesh>
      <mesh material={M.hardware} position={[CAB_W / 2 + 0.006, -HINGE_Y, 0.014]}>
        <boxGeometry args={[0.04, 0.054, 0.014]} />
      </mesh>

      {/* Everything that hangs, pivoting on the surviving bottom hinge. */}
      <group ref={sag} position={[CAB_W / 2 + 0.006, -HINGE_Y, 0]}>
        <group ref={swing}>
          <group position={[-DOOR_W / 2 + 0.03, HINGE_Y, 0.042]}>
            {/* A shaker door: frame, recessed panel, brass bar. */}
            <mesh material={M.paint}>
              <boxGeometry args={[DOOR_W, DOOR_H, 0.024]} />
            </mesh>
            <mesh material={M.paintShade} position={[0, 0, 0.009]}>
              <boxGeometry args={[DOOR_W - inset * 2, DOOR_H - inset * 2, 0.012]} />
            </mesh>
            {/* A bar long enough to be a handle at sixty pixels, not a stud. */}
            <group ref={handle} position={[-DOOR_W / 2 + 0.064, 0, 0.032]}>
              <mesh material={M.brass}>
                <boxGeometry args={[0.024, 0.19, 0.022]} />
              </mesh>
              <mesh material={M.brass} position={[0, 0.082, -0.014]}>
                <boxGeometry args={[0.018, 0.018, 0.026]} />
              </mesh>
              <mesh material={M.brass} position={[0, -0.082, -0.014]}>
                <boxGeometry args={[0.018, 0.018, 0.026]} />
              </mesh>
            </group>
            {/* The door half of the bottom hinge, still doing its job. */}
            <mesh
              material={M.hardware}
              position={[DOOR_W / 2 - 0.03, -HINGE_Y, -0.016]}
            >
              <boxGeometry args={[0.036, 0.05, 0.014]} />
            </mesh>
            {/* And of the top one, which is not. */}
            <group
              ref={leafTop}
              position={[DOOR_W / 2 - 0.03, HINGE_Y, -0.016]}
            >
              <mesh material={M.hardware}>
                <boxGeometry args={[0.036, 0.05, 0.014]} />
              </mesh>
              <mesh
                ref={screwTop}
                material={M.brass}
                position={[0, 0.012, 0.026]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.009, 0.009, 0.012, 10]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* Dust off the hinge while he drills. Flagged so the drop shadow
          measures the cabinet rather than these. */}
      <group userData={{ fx: true }}>
        {shop.gritMats.map((mat, i) => (
          <mesh
            key={`grit-${i}`}
            ref={(node) => {
              gritMeshes.current[i] = node;
            }}
            material={mat}
            scale={0.034}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* --------------------------------------------------------------------- lamp */

/**
 * THE PENDANT THAT HAS COME LOOSE IN ITS FITTING.
 *
 * The old one tilted seventeen degrees and went dark, which is a lamp that has
 * been nudged rather than a lamp that is broken — and he reached for a point a
 * clear forty pixels above the shade, so the repair was a man gesturing at the
 * ceiling. Two separate failures now, and they compound in silhouette: the
 * whole pendant hangs off true on a kinked flex, and the SHADE has slipped its
 * collar and sits skew and dropped on top of that. A lampshade at an angle to
 * its own cord is a thing nobody has to be told is wrong.
 *
 * The light is the payoff and it is the only one of the six that is pure
 * reward: nothing about the fixed state is a detail you have to find. It comes
 * on, it blooms, and it stays on.
 */
function Lamp({ id }: FixableProps) {
  const droop = useRef<THREE.Group>(null);
  const slip = useRef<THREE.Group>(null);
  const shade = useRef<THREE.Mesh>(null);
  const bulb = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const f = useRef(0);
  const seat = useRef(-1);
  const flicker = useRef({ next: 2, level: 0 });
  /*
   * A brass shade, not an off-white one.
   *
   * The pendant hangs in the middle of the hero headline — everything here
   * lives behind the type by design, and moving objects away from text is the
   * thing we stopped doing — so a pale shade put white words on a white shape.
   * Brass reads against the navy, reads against the page, and takes white type
   * across it; and it is the right colour to be glowing at the end anyway.
   */
  const material = useMemo(() => createLampMaterial("#94793f"), []);
  const bulbMaterial = useMemo(() => createLampMaterial("#f6efe2"), []);
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
  useEffect(() => () => bulbMaterial.dispose(), [bulbMaterial]);
  useEffect(
    () => () => {
      glowMaterial.map?.dispose();
      glowMaterial.dispose();
    },
    [glowMaterial]
  );

  useFrame((state, dt) => {
    const step = Math.min(0.05, dt);
    const now = state.clock.elapsedTime;
    const target = getObjectFix(id);
    f.current = ease(f.current, target, dt);
    const lit = f.current;
    const p = getObjectWork(id);
    const stroke = getObjectBusy(id);
    const working = p > 0;

    /*
     * He pushes the shade back up onto its collar before he tightens it.
     *
     * Same shape as the cabinet, for the same reason: a fitting that drifts
     * back into place while somebody waves a tool at it is the failure this
     * whole pass exists to avoid.
     */
    const seated = ramp(p, 0.14, 0.4);
    const driven = ramp(p, 0.44, 0.74);

    if (seat.current < 0 && working && p > 0.76) seat.current = 0;
    if (seat.current >= 0) seat.current += dt;
    if (target < 0.02 && !working && seat.current >= 0) seat.current = -1;
    const settle = seat.current >= 0 ? Math.max(0, seatCurve(seat.current)) : 1;

    const off = (1 - seated * 0.72 - driven * 0.22) * settle;
    /* A dead pendant still moves: it is hanging on a wire. */
    const sway = working ? 0 : Math.sin(now * 1.15) * 0.5 + Math.sin(now * 0.71) * 0.3;
    /* And it flinches when the screwdriver bites. */
    const jolt =
      working && p > 0.42 && p < 0.78
        ? Math.sin(now * 46) * 0.5 * (1 - Math.abs(actionPhase("turn", stroke) - 0.5) * 2)
        : 0;

    if (droop.current) {
      droop.current.rotation.z = DEG(15) * off + DEG(1.6) * sway * (1 - lit);
    }
    if (slip.current) {
      /* The shade itself: skew, dropped and pushed off centre on its collar. */
      slip.current.rotation.z = -DEG(30) * off + DEG(1.2) * jolt;
      slip.current.position.y = -0.045 * off;
      slip.current.position.x = 0.035 * off;
    }

    /*
     * Dead, with the occasional feeble attempt.
     *
     * Not the socket's stutter — that one is fast, bright and dangerous. This
     * is slow and dim and gives up, which is what a light with a bad connection
     * looks like and, more to the point, is the opposite of the moment it is
     * setting up.
     */
    const flick = flicker.current;
    if (lit < 0.05) {
      flick.next -= step;
      if (flick.next <= 0) {
        flick.level = 0.16 + Math.random() * 0.12;
        flick.next = 2.2 + Math.random() * 2.6;
      }
      flick.level = Math.max(0, flick.level - step * 1.6);
    } else {
      flick.level = 0;
    }

    const brightness = Math.max(lit, flick.level);
    if (glow.current) {
      const breathe = 1 + Math.sin(now * 1.4) * 0.05;
      const g = glow.current;
      g.scale.setScalar(brightness * 1.05 * breathe);
      (g.material as THREE.SpriteMaterial).opacity = brightness * 0.72;
      g.visible = brightness > 0.02;
    }
    const shadeMat = shade.current?.material as THREE.MeshStandardMaterial | undefined;
    if (shadeMat) shadeMat.emissiveIntensity = brightness * 1.4;
    const bulbMat = bulb.current?.material as THREE.MeshStandardMaterial | undefined;
    if (bulbMat) bulbMat.emissiveIntensity = brightness * 3.4;
  });

  return (
    <group>
      {/*
        No ceiling patch here, and that is a decision rather than an omission.
        A pendant already says "ceiling" with its cord — the flex runs up and
        out of frame, which is exactly how a hanging light reads.
      */}
      <mesh material={M.shell} position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.016, 16]} />
      </mesh>
      <group ref={droop} position={[0, 0.26, 0]}>
        <mesh material={M.dark} position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.26, 6]} />
        </mesh>
        {/* The collar the shade hangs from, and the thing he works on. */}
        <mesh material={M.hardware} position={[0, -0.27, 0]}>
          <cylinderGeometry args={[0.028, 0.034, 0.05, 14]} />
        </mesh>
        <group ref={slip} position={[0, 0, 0]}>
          <mesh ref={shade} material={material} position={[0, -0.37, 0]}>
            <cylinderGeometry args={[0.072, 0.15, 0.16, 22, 1, true]} />
          </mesh>
          <mesh ref={bulb} material={bulbMaterial} position={[0, -0.4, 0]}>
            <sphereGeometry args={[0.046, 14, 12]} />
          </mesh>
          <sprite
            ref={glow}
            material={glowMaterial}
            position={[0, -0.4, 0.03]}
            visible={false}
          />
        </group>
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
