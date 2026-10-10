"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (mixers, bones, materials) are driven per frame by design */

/**
 * A realistic knight of the order (a sculpted, rigged model with real
 * animations), and the goblins he battles.
 *
 * Every knight shares one model and one skeleton; only the surcoat texture
 * differs (Rover red, Lumi green, Echo purple). What he does comes ONLY from
 * the real status of his agent:
 *
 *   working   -> a duel at his post: a goblin appears and they fight
 *                (a real shift is running - that is the only time goblins come)
 *   waiting   -> sword practice on a straw training dummy, or a stroll
 *                around the hall (idle: never presented as work)
 *   needs_you -> turns to you and waves, with the wax-seal "?" to tap
 *   error     -> scratches his helm, puzzled
 *   paused/off-> dozes on a bench by the hearth
 *   celebrate -> a victory cheer (only for a REAL new first free visit)
 *   tapped    -> waves hello
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { RobotKey, RobotStatus } from "@/lib/office";
import { HUB, IDLE_SPOTS, STATUS_LIGHT, type RobotLook, type Vec3 } from "./office-layout";
import styles from "./office.module.css";

export const KNIGHT_URL = "/3d/hall/knight-v1.glb";
export const GOBLIN_URL = "/3d/hall/goblin-v1.glb";
const SURCOAT: Partial<Record<RobotKey, string>> = {
  visibility: "/3d/hall/knight-lumi-v1.webp",
  conversation: "/3d/hall/knight-echo-v1.webp",
  // outreach (Rover) wears the model's own red-cross surcoat
};

useGLTF.preload(KNIGHT_URL, false, true);
useGLTF.preload(GOBLIN_URL, false, true);

const CAMERA_YAW = Math.PI / 4;
const RIGHT = new THREE.Vector3(1, 0, -1).normalize(); // screen-right, on the floor
const SPEED = 1.15;
/** Real proportions, shown a little larger than life so they read well on a phone. */
const SIZE = 1.3;

type Activity = "work" | "train" | "ask" | "confused" | "sleep" | "visit";
type Plan = { activity: Activity; spot: Vec3; until: number; emoji?: string };

/** Where a knight stands at his post, and where his opponent (dummy or goblin) stands. */
export function postSpots(post: Vec3) {
  const k: Vec3 = [post[0] - RIGHT.x * 0.78, 0, post[2] - RIGHT.z * 0.78];
  const e: Vec3 = [post[0] + RIGHT.x * 0.78, 0, post[2] + RIGHT.z * 0.78];
  return { knight: k, enemy: e };
}

/** The duel: what the knight and the goblin do, step by step (seconds). */
const DUEL: Array<{ k: string; g: string; d: number }> = [
  { k: "slash", g: "hit", d: 1.5 },
  { k: "parry", g: "attack", d: 2.4 },
  { k: "charged", g: "hit", d: 2.2 },
  { k: "idle", g: "stance", d: 1.4 },
];
const DUEL_TOTAL = DUEL.reduce((s, x) => s + x.d, 0);
function duelStep(t: number) {
  let x = ((t % DUEL_TOTAL) + DUEL_TOTAL) % DUEL_TOTAL;
  for (const s of DUEL) {
    if (x < s.d) return s;
    x -= s.d;
  }
  return DUEL[0];
}

const stripped = new WeakSet<THREE.AnimationClip>();
/** Keep animations in place: the game moves the knight, not the clip. */
function stripRootMotion(clips: THREE.AnimationClip[]) {
  for (const clip of clips) {
    if (stripped.has(clip)) continue;
    stripped.add(clip);
    for (const track of clip.tracks) {
      if (!/Hips\.position$/.test(track.name)) continue;
      const v = track.values;
      const x0 = v[0];
      const z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0;
        v[i + 2] = z0;
      }
    }
  }
}

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** A plain arming sword, built in the hand bone's units (the rig is in centimetres). */
function makeSword() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#d9dee6", metalness: 0.85, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: "#3a2a1e", roughness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: "#c9a04a", metalness: 0.7, roughness: 0.35 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(4.2, 78, 0.8), steel);
  blade.position.y = 48;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(2.95, 7, 4), steel);
  tip.position.y = 90.5;
  tip.rotation.y = Math.PI / 4;
  tip.scale.z = 0.27;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(20, 2.2, 2.6), brass);
  guard.position.y = 8.5;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 14, 10), dark);
  grip.position.y = 0;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 10), brass);
  pommel.position.y = -8;
  for (const m of [blade, tip, guard, grip, pommel]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

export type KnightProps = {
  look: RobotLook;
  status: RobotStatus;
  statusText: string;
  waiting: number;
  celebrate: boolean;
  reduced: boolean;
  selected: boolean;
  onSelect: () => void;
  onAsk: () => void;
  registry?: MutableRefObject<Partial<Record<RobotKey, Vec3>>>;
};

function planFor(status: RobotStatus, look: RobotLook, now: number, previous: Plan | null, knightSpot: Vec3): Plan {
  if (status === "working") return { activity: "work", spot: knightSpot, until: Infinity };
  if (status === "needs_you") return { activity: "ask", spot: knightSpot, until: Infinity };
  if (status === "error") return { activity: "confused", spot: knightSpot, until: Infinity };
  if (status === "paused" || status === "off") return { activity: "sleep", spot: look.bed, until: Infinity };
  // waiting: practice at the post, now and then a stroll around the hall
  if (!previous || previous.activity !== "train" || previous.until === Infinity) {
    return { activity: "train", spot: knightSpot, until: now + 14 + Math.random() * 16 };
  }
  const choices: Array<{ spot: Vec3; emoji: string }> = [
    { spot: look.hobby, emoji: look.key === "conversation" ? "🗺️" : look.key === "outreach" ? "🔭" : "📖" },
    ...IDLE_SPOTS.filter((s) => dist(s, look.hobby) > 0.5).map((spot, i) => ({ spot, emoji: ["🔥", "🌤️", "🍵", "🎵", "🗺️"][i] || "✨" })),
  ];
  const pick = choices[Math.floor(Math.random() * choices.length)];
  return { activity: "visit", spot: pick.spot, until: now + 6 + Math.random() * 5, emoji: pick.emoji };
}

export default function Knight({ look, status, statusText, waiting, celebrate, reduced, selected, onSelect, onAsk, registry }: KnightProps) {
  const gltf = useGLTF(KNIGHT_URL, false, true);
  const { knight: knightSpot, enemy: enemySpot } = useMemo(() => postSpots(look.desk), [look.desk]);

  // One clone per knight (own skeleton), with its own surcoat.
  const model = useMemo(() => {
    stripRootMotion(gltf.animations);
    const m = cloneSkinned(gltf.scene) as THREE.Group;
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false; // skinned bounds are unreliable while animating
        mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
      }
    });
    return m;
  }, [gltf]);
  useEffect(() => {
    const url = SURCOAT[look.key];
    if (!url) return;
    let alive = true;
    new THREE.TextureLoader().load(url, (tex) => {
      if (!alive) return;
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          (mesh.material as THREE.MeshStandardMaterial).map = tex;
          (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
      });
    });
    return () => {
      alive = false;
    };
  }, [model, look.key]);

  // The sword, in the right hand.
  useEffect(() => {
    const hand = model.getObjectByName("RightHand");
    if (!hand) return;
    const sword = makeSword();
    sword.position.set(2, 9, 2);
    sword.rotation.set(Math.PI / 2, 0, 0);
    hand.add(sword);
    return () => {
      hand.remove(sword);
    };
  }, [model]);

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const out: Record<string, THREE.AnimationAction> = {};
    for (const clip of gltf.animations) out[clip.name] = mixer.clipAction(clip);
    return out;
  }, [gltf, mixer]);
  const current = useRef<string>("");
  const play = (name: string, fade = 0.3) => {
    if (current.current === name || !actions[name]) return;
    const next = actions[name];
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (current.current && actions[current.current]) actions[current.current].fadeOut(fade);
    current.current = name;
  };

  const root = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = useRef<Vec3>([...knightSpot] as Vec3);
  const yaw = useRef(CAMERA_YAW);
  const path = useRef<Vec3[]>([]);
  const plan = useRef<Plan | null>(null);
  const placed = useRef(false);
  const greetUntil = useRef(0);
  const greetPending = useRef(false);
  const trainAt = useRef(0);
  const duelStart = useRef(0);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [fighting, setFighting] = useState(false);
  const [showStatus, setShowStatus] = useState(true);
  const [hovered, setHovered] = useState(false);
  const dummyHit = useRef(0);

  useEffect(() => {
    if (status !== "waiting") {
      setShowStatus(true);
      return;
    }
    setShowStatus(true);
    let on = true;
    const id = window.setInterval(() => {
      on = !on;
      setShowStatus(on);
    }, on ? 7000 : 22000);
    const first = window.setTimeout(() => setShowStatus(false), 7000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [status]);
  useEffect(() => {
    if (selected) greetPending.current = true;
  }, [selected]);
  useEffect(() => {
    plan.current = null;
  }, [status]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const r = root.current;
    if (!r) return;

    // --- brain -----------------------------------------------------------
    if (!plan.current || t > plan.current.until) {
      const next = planFor(status, look, t, plan.current, knightSpot);
      plan.current = next;
      const first = !placed.current;
      placed.current = true;
      if (reduced || first) {
        pos.current = [...next.spot] as Vec3;
        path.current = [];
      } else if (dist(pos.current, next.spot) > 0.05) {
        path.current = dist(pos.current, next.spot) > 2.4 ? [HUB, next.spot] : [next.spot];
      }
      setEmoji(next.activity === "visit" ? next.emoji || null : null);
      if (next.activity === "work") duelStart.current = t;
    }
    const p = plan.current!;
    if (greetPending.current) {
      greetPending.current = false;
      greetUntil.current = t + 3.2;
    }

    // --- walking ---------------------------------------------------------
    let moving = false;
    if (path.current.length) {
      const target = path.current[0];
      const dx = target[0] - pos.current[0];
      const dz = target[2] - pos.current[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.04) path.current.shift();
      else {
        moving = true;
        const step = Math.min(d, SPEED * dt);
        pos.current = [pos.current[0] + (dx / d) * step, 0, pos.current[2] + (dz / d) * step];
        yaw.current = lerpAngle(yaw.current, Math.atan2(dx, dz), Math.min(1, dt * 7));
      }
    }
    const arrived = !moving;
    const greeting = t < greetUntil.current && p.activity !== "sleep" && p.activity !== "work";
    const atPost = arrived && (p.activity === "work" || p.activity === "train");
    if (atPost !== fighting && p.activity === "work") setFighting(atPost);
    if (p.activity !== "work" && fighting) setFighting(false);

    // --- facing ----------------------------------------------------------
    if (arrived) {
      let want = CAMERA_YAW;
      if (atPost && !greeting) want = Math.atan2(enemySpot[0] - pos.current[0], enemySpot[2] - pos.current[2]);
      else if (p.activity === "visit") want = CAMERA_YAW + Math.sin(t * 0.4) * 0.3;
      yaw.current = lerpAngle(yaw.current, want, Math.min(1, dt * 5));
    }
    r.position.set(pos.current[0], p.activity === "sleep" && arrived ? 0.02 : 0, pos.current[2]);
    r.rotation.y = yaw.current;
    if (registry) registry.current[look.key] = pos.current;
    if (ringRef.current) ringRef.current.position.set(pos.current[0], 0.02, pos.current[2]);

    // --- the animation for this moment -------------------------------------
    let clip = "idle";
    if (moving) clip = "walk";
    else if (celebrate) clip = "cheer";
    else if (greeting) clip = "wave";
    else if (p.activity === "work") clip = duelStep(t - duelStart.current).k;
    else if (p.activity === "train") {
      // practice: a cut at the dummy every few seconds
      if (t > trainAt.current) trainAt.current = t + 5 + Math.random() * 5;
      const sinceCut = trainAt.current - t;
      clip = sinceCut > 0 && sinceCut < 1.5 ? "slash" : "idle";
      if (clip === "slash" && current.current !== "slash") dummyHit.current = t + 0.55;
    } else if (p.activity === "ask") clip = "wave";
    else if (p.activity === "confused") clip = "confused";
    else if (p.activity === "sleep") clip = "doze";
    play(clip, clip === "walk" || current.current === "walk" ? 0.25 : 0.35);
    mixer.timeScale = reduced ? 0 : 1;
    mixer.update(dt);
  });

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  const light = STATUS_LIGHT[status] || STATUS_LIGHT.waiting;
  const sleeping = status === "paused" || status === "off";
  const showBubble = ((showStatus && !sleeping) || hovered || selected) && !celebrate;

  return (
    <>
      {/* selection ring */}
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} visible={selected} renderOrder={2}>
        <ringGeometry args={[0.6, 0.72, 48]} />
        <meshBasicMaterial color="#C9A04A" transparent opacity={0.95} depthWrite={false} />
      </mesh>

      {/* what he practises on, or fights */}
      {fighting ? <Goblin spot={enemySpot} faceTo={knightSpot} startRef={duelStart} reduced={reduced} /> : <TrainingDummy spot={enemySpot} hitRef={dummyHit} reduced={reduced} />}

      <group
        ref={root}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 10) return;
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <mesh position={[0, 1.2, 0]} visible={false}>
          <boxGeometry args={[1.05, 2.5, 1.05]} />
          <meshBasicMaterial />
        </mesh>
        <primitive object={model} scale={SIZE} />

        <Html position={[0, sleeping ? 2.2 : 2.75, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div className={styles.tagWrap}>
            {status === "needs_you" ? (
              <button
                type="button"
                className={styles.askOrb}
                style={{ pointerEvents: "auto" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAsk();
                }}
                aria-label={`${look.name}: ${waiting} waiting for you`}
              >
                ?
              </button>
            ) : null}
            {sleeping ? <div className={reduced ? styles.zzzStill : styles.zzz}>z z z</div> : null}
            {emoji && !showBubble ? <div className={styles.thought}>{emoji}</div> : null}
            {showBubble ? (
              <div className={`${styles.bubble} ${status === "error" ? styles.bubbleError : status === "needs_you" ? styles.bubbleAsk : ""}`}>{statusText}</div>
            ) : null}
            <button
              type="button"
              className={styles.nameTag}
              style={{ ["--accent" as string]: look.body, pointerEvents: "auto" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              aria-label={`Talk to ${look.name}`}
            >
              <span className={styles.dot} style={{ background: light }} />
              {look.name}
            </button>
          </div>
        </Html>
      </group>
    </>
  );
}

/** A goblin who appears only while a real shift is running, and duels the knight. */
function Goblin({ spot, faceTo, startRef, reduced }: { spot: Vec3; faceTo: Vec3; startRef: MutableRefObject<number>; reduced: boolean }) {
  const gltf = useGLTF(GOBLIN_URL, false, true);
  const model = useMemo(() => {
    stripRootMotion(gltf.animations);
    const m = cloneSkinned(gltf.scene) as THREE.Group;
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    return m;
  }, [gltf]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => Object.fromEntries(gltf.animations.map((c) => [c.name, mixer.clipAction(c)])), [gltf, mixer]);
  const current = useRef("");
  const group = useRef<THREE.Group>(null);
  const born = useRef(-1);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const name = duelStep(t - startRef.current).g;
    if (name !== current.current && actions[name]) {
      actions[name].reset().fadeIn(0.2).play();
      if (current.current) actions[current.current]?.fadeOut(0.2);
      current.current = name;
    }
    mixer.timeScale = reduced ? 0 : 1;
    mixer.update(Math.min(delta, 0.05));
    if (group.current) {
      const s = Math.min(1, (t - born.current) / 0.4); // pops in
      group.current.scale.setScalar(s);
    }
  });
  const yaw = Math.atan2(faceTo[0] - spot[0], faceTo[2] - spot[2]);
  return (
    <group ref={group} position={spot} rotation-y={yaw}>
      <primitive object={model} scale={SIZE} />
    </group>
  );
}

/** The straw training dummy the knights practise on between shifts. */
function TrainingDummy({ spot, hitRef, reduced }: { spot: Vec3; hitRef: MutableRefObject<number>; reduced: boolean }) {
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!body.current || reduced) return;
    const since = clock.elapsedTime - hitRef.current;
    body.current.rotation.z = since > 0 && since < 1.2 ? Math.sin(since * 14) * 0.18 * (1 - since / 1.2) : 0;
  });
  return (
    <group position={spot} scale={1.2}>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.08, 14]} />
        <meshStandardMaterial color="#5B3A22" roughness={0.8} />
      </mesh>
      <group ref={body}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.3, 8]} />
          <meshStandardMaterial color="#6E4527" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.6, 12]} />
          <meshStandardMaterial color="#C9A86A" roughness={1} />
        </mesh>
        {[0.82, 1.18].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <torusGeometry args={[0.21, 0.015, 6, 20]} />
            <meshStandardMaterial color="#6E4527" />
          </mesh>
        ))}
        <mesh position={[0, 1.42, 0]} castShadow>
          <sphereGeometry args={[0.15, 14, 12]} />
          <meshStandardMaterial color="#B89458" roughness={1} />
        </mesh>
        <mesh position={[0, 1.12, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.85, 8]} />
          <meshStandardMaterial color="#6E4527" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}
