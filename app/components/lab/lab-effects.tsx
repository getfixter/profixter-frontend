"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

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
}: {
  kind: EffectKind | null;
  active: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const clock = useRef(0);
  const nextBurst = useRef(0.4);

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
  }, [kind, active]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced || !kind) return;
    const dt = Math.min(delta, 0.1);
    clock.current += dt;
    const list = swarm();
    if (!dummy.current) dummy.current = new THREE.Object3D();
    const d = dummy.current;

    /* Fire a burst on a beat: drilling puffs often, a hammer lands slower. */
    const interval = kind === "dust" ? 0.55 : kind === "spark" ? 1.15 : 0.78;
    if (active && clock.current >= nextBurst.current) {
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
