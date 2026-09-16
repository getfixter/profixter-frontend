"use client";

import { useEffect, useMemo, useRef } from "react";
import { actionCycle, actionHit, actionPhase, type ToolAction } from "./lab-action";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createGlowTexture } from "./lab-materials";

/**
 * The small flourishes that make a repair readable.
 *
 * Deliberately three, deliberately tiny, and deliberately tied to the work
 * rather than sprinkled around: a puff of dust when he drills, a couple of
 * sparks on anything electrical, a shudder when the hammer lands. Anything more
 * and the page stops being a page.
 *
 * All three are the same twelve particles on one shared geometry, driven from a
 * single loop with no allocation per frame. The cost of the whole system is one
 * draw call, and it only exists while he is actually working.
 */

export type EffectKind = "dust" | "spark" | "impact";

const COUNT = 12;

/**
 * Everything below is authored in PROP units and scaled up at the group.
 *
 * The numbers used to be world units, in a world where the character is 1.72
 * tall — which made each mote about one and a half pixels and gave the dust
 * enough gravity to fall half his height in a second. It did not read as dust
 * coming off a drill; it read as his chest leaking. Authoring at prop scale
 * keeps a speck the size of a speck and a fall the length of a fall.
 */
const EFFECT_SCALE = 2.8;

type Particle = {
  age: number;
  life: number;
  vx: number;
  vy: number;
  size: number;
};

/**
 * A puff, a spark or a knock, at the point he is working on.
 *
 * `progress` is how far through the repair he is; the effect fires on a beat
 * rather than continuously, so it punctuates the work instead of fogging it.
 */
export default function WorkEffect({
  kind,
  active,
  action = "none",
  getWorkTime,
}: {
  kind: EffectKind | null;
  active: boolean;
  /** The tool's verb, so a spark lands on the strike and not near it. */
  action?: ToolAction;
  getWorkTime?: () => number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clock = useRef(0);
  const nextBurst = useRef(0.4);
  const lastCycle = useRef(-1);

  /*
   * Held in a ref, not a memo.
   *
   * These are mutated every frame by design, and the compiler's immutability
   * rule is right to refuse that on a memoised value: a ref is the honest shape
   * for something genuinely mutable that must survive a render.
   */
  const particles = useRef<Particle[] | null>(null);
  const dummy = useRef<THREE.Object3D | null>(null);

  /** Built on first use, so nothing mutable is ever handed to a hook. */
  const swarm = () => {
    if (!particles.current) {
      particles.current = Array.from({ length: COUNT }, () => ({
        age: Infinity,
        life: 1,
        vx: 0,
        vy: 0,
        size: 1,
      }));
    }
    return particles.current;
  };

  const material = useMemo(() => {
    const colour =
      kind === "spark" ? "#ffd166" : kind === "impact" ? "#cfd6e2" : "#d8d2c6";
    return new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: kind === "spark" ? 0.95 : 0.5,
      depthWrite: false,
    });
  }, [kind]);

  useEffect(() => () => material.dispose(), [material]);

  /* Reset the moment the job changes, so nothing carries over between repairs. */
  useEffect(() => {
    if (particles.current) {
      for (const p of particles.current) p.age = Infinity;
    }
    clock.current = 0;
    nextBurst.current = 0.4;
    lastCycle.current = -1;
  }, [kind, active]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced || !kind) return;
    const dt = Math.min(delta, 0.1);
    clock.current += dt;
    const list = swarm();
    if (!dummy.current) dummy.current = new THREE.Object3D();
    const d = dummy.current;

    /*
     * Fire on the tool's beat, not on a timer of its own.
     *
     * A spark that appears half a second after the screwdriver turns is not a
     * spark, it is confetti. The tool already knows when it makes contact, so
     * the particles ask it rather than guessing — and the two stay in step even
     * when a job runs at a different speed.
     */
    const t = getWorkTime ? getWorkTime() : clock.current;
    const cycle = action === "none" ? -1 : actionCycle(action, t);
    const onBeat =
      cycle >= 0 ? cycle !== lastCycle.current && actionHit(action, actionPhase(action, t))
                 : clock.current >= nextBurst.current;
    const interval = kind === "dust" ? 0.55 : kind === "spark" ? 1.15 : 0.78;
    if (active && onBeat) {
      lastCycle.current = cycle;
      nextBurst.current = clock.current + interval;
      const n = kind === "spark" ? 3 : kind === "impact" ? 4 : 5;
      let spawned = 0;
      for (const p of list) {
        if (spawned >= n) break;
        if (p.age < p.life) continue;
        spawned++;
        p.age = 0;
        if (kind === "dust") {
          /* Falls, because drill dust does. */
          p.life = 0.75 + Math.random() * 0.3;
          p.vx = (Math.random() - 0.5) * 0.06;
          p.vy = -0.02 - Math.random() * 0.03;
          p.size = 0.014 + Math.random() * 0.008;
        } else if (kind === "spark") {
          p.life = 0.3 + Math.random() * 0.15;
          const a = Math.random() * Math.PI * 2;
          const speed = 0.16 + Math.random() * 0.16;
          p.vx = Math.cos(a) * speed;
          p.vy = Math.abs(Math.sin(a)) * speed * 0.7;
          p.size = 0.008 + Math.random() * 0.005;
        } else {
          /* Impact: a quick outward scatter of wall dust. */
          p.life = 0.45 + Math.random() * 0.2;
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          const speed = 0.11 + Math.random() * 0.1;
          p.vx = Math.cos(a) * speed;
          p.vy = Math.sin(a) * speed;
          p.size = 0.012 + Math.random() * 0.008;
        }
      }
    }

    let visible = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        d.position.set(0, 0, -999);
        d.scale.setScalar(0.0001);
      } else {
        const t = p.age / p.life;
        /* Gravity on the heavy ones, drag on the bright ones. */
        const drag = kind === "spark" ? 1 - t * 0.85 : 1;
        d.position.set(
          p.vx * p.age * drag,
          p.vy * p.age * drag - (kind === "spark" ? 0.05 : 0.09) * p.age * p.age,
          0.02
        );
        d.scale.setScalar(p.size * (1 - t * 0.55));
        visible++;
      }
      d.updateMatrix();
      instanced.setMatrixAt(i, d.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.visible = visible > 0;
  });

  if (!kind) return null;

  return (
    <instancedMesh
      ref={mesh}
      scale={EFFECT_SCALE}
      args={[undefined, undefined, COUNT]}
      material={material}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------ the payoff */

/**
 * One beat, at the exact moment the thing is fixed.
 *
 * Everything else in this file happens WHILE he works — dust off a drill, a
 * knock off a hammer — which punctuates the effort. Nothing punctuated the
 * result: the prop snapped straight and that was it. On a repair that lasts
 * four seconds and pays off in a quarter of one, that quarter-second is the
 * whole point of watching, and it was the only moment on screen with nothing
 * drawing the eye to it.
 *
 * Deliberately one thing: a ring that expands and fades, with a handful of
 * motes for the trades where debris makes sense. A ring reads as "that seated"
 * in any context and at any size, which is more than can be said for particles.
 * The tint is the only part that varies, and it carries the trade — a spark
 * blue-white for electrical, water-blue for plumbing, dust for the rest.
 */
export type PayoffFlavour = "electrical" | "plumbing" | "settle";

/**
 * The moment the repair lands — and only where it can actually be seen.
 *
 * Two versions went in the bin before this one. An expanding ring is a game
 * HUD, whatever it is tinted; a burst of sparks off a socket says "fault",
 * which is the opposite of the message and a poor advertisement for an
 * electrician. Both were then beaten by a much duller problem: at the size this
 * character actually is on a page — sixty to a hundred pixels — particles are
 * one or two pixels and simply are not there. I shot both at real scale and
 * could not find them.
 *
 * What does read at that size is LIGHT. The pendant is the strongest payoff in
 * the whole library for exactly that reason: it is the only one that changes
 * the brightness of a region rather than the position of an edge. So the
 * electrical beat is a soft bloom at the work point, quick in and slower out —
 * the socket coming back to life — which is both visible at sixty pixels and
 * the correct thing to say about finishing electrical work.
 *
 * Everything else gets nothing, deliberately. A shelf snapping level and a drip
 * stopping are already the payoff; a puff of dust nobody can see is decoration
 * that costs draw calls.
 */
const BLOOM_SECONDS = 0.85;

export function PayoffBurst({
  flavour,
  getFiredAt,
}: {
  flavour: PayoffFlavour;
  /** When the repair last snapped, on the same clock as the frame loop. */
  getFiredAt: () => number;
}) {
  const sprite = useRef<THREE.Sprite>(null);
  const texture = useMemo(() => createGlowTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    const node = sprite.current;
    if (!node) return;
    if (flavour !== "electrical") {
      node.visible = false;
      return;
    }
    const firedAt = getFiredAt();
    const t = firedAt > 0 ? state.clock.elapsedTime - firedAt : 99;
    const u = t / BLOOM_SECONDS;
    const live = u >= 0 && u <= 1;
    node.visible = live;
    if (!live) return;
    /* Up in a fifth of the beat, down over the rest. */
    const rise = Math.min(1, u / 0.2);
    const fall = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8;
    const strength = rise * fall * fall;
    node.scale.setScalar(0.38 + 0.26 * rise);
    (node.material as THREE.SpriteMaterial).opacity = strength;
  });

  return (
    <sprite ref={sprite} visible={false} position={[0, 0, 0.05]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}
