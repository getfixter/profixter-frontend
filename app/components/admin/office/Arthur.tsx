"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (mixers, bones, materials) are driven per frame by design */

/**
 * King Arthur on his throne - the owner's AI council manager.
 *
 * His own sculpted, rigged model; the crown, the royal cloak and Excalibur
 * are added here. What he does comes ONLY from real records:
 *
 *   reviewing  -> an Arthur run is in progress (a chat answer or his council
 *                 review): he stands at the council table, thinking
 *   decisions  -> something waits for the owner's decision: he stands before
 *                 the throne and beckons, with the wax-seal "?" to tap
 *   otherwise  -> he sits on his throne, listening
 *   celebrate  -> a victory cheer (only for a REAL new first free visit)
 *   tapped     -> he raises a hand in greeting
 *
 * Heroes walking up to deliver reports are driven by their own records
 * (see Knight's `report`); nothing here calls the AI.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ARTHUR_LOOK, PALETTE, THRONE, THRONE_YAW, type Vec3 } from "./office-layout";
import styles from "./office.module.css";

export const ARTHUR_URL = "/3d/hall/arthur-v1.glb";
useGLTF.preload(ARTHUR_URL, false, true);

const SIZE = 1.3;
const SPEED = 1.0;
const CAMERA_YAW = Math.PI / 4;
/** Where he stands to receive the owner, and where he reviews at the council table. */
const BEFORE_THRONE: Vec3 = [THRONE[0] + Math.sin(THRONE_YAW) * 0.95, 0, THRONE[2] + Math.cos(THRONE_YAW) * 0.95];
const AT_TABLE: Vec3 = [-0.15, 0, -0.45];
const TABLE_CENTRE: Vec3 = [-0.9, 0, -1.2];

const stripped = new WeakSet<THREE.AnimationClip>();
function stripRootMotion(clips: THREE.AnimationClip[]) {
  for (const clip of clips) {
    if (stripped.has(clip)) continue;
    stripped.add(clip);
    for (const track of clip.tracks) {
      if (!/Hips\.position$/.test(track.name) || clip.name === "sit") continue;
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

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

const gold = () => new THREE.MeshStandardMaterial({ color: "#E2B64A", metalness: 0.9, roughness: 0.22 });

/** A gold crown with red and blue stones (head-bone units: centimetres). */
function makeCrown() {
  const g = new THREE.Group();
  const m = gold();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(11.6, 12.2, 4.2, 32, 1, true), m);
  m.side = THREE.DoubleSide;
  g.add(band);
  const ruby = new THREE.MeshStandardMaterial({ color: "#B3121F", metalness: 0.3, roughness: 0.15, emissive: "#3A0005" });
  const sapphire = new THREE.MeshStandardMaterial({ color: "#1C3FA8", metalness: 0.3, roughness: 0.15, emissive: "#000A30" });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const point = new THREE.Mesh(new THREE.ConeGeometry(1.9, 6.5, 4), m);
    point.position.set(Math.sin(a) * 11.9, 5.2, Math.cos(a) * 11.9);
    point.rotation.y = a;
    g.add(point);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), m);
    ball.position.set(Math.sin(a) * 11.9, 8.8, Math.cos(a) * 11.9);
    g.add(ball);
    const stone = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), i % 2 ? sapphire : ruby);
    stone.position.set(Math.sin(a) * 12.4, 0, Math.cos(a) * 12.4);
    stone.scale.set(1, 1, 0.55);
    stone.rotation.y = a;
    g.add(stone);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** Excalibur: a long, bright blade with a gold hilt and a sapphire pommel. */
function makeExcalibur() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#EEF2F8", metalness: 0.95, roughness: 0.12 });
  const fuller = new THREE.MeshStandardMaterial({ color: "#B9C3D2", metalness: 0.9, roughness: 0.25 });
  const m = gold();
  const grip = new THREE.MeshStandardMaterial({ color: "#2B1A3E", roughness: 0.6 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(4.6, 92, 0.8), steel);
  blade.position.y = 55;
  const groove = new THREE.Mesh(new THREE.BoxGeometry(1.1, 70, 0.9), fuller);
  groove.position.y = 48;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(3.25, 8, 4), steel);
  tip.position.y = 105;
  tip.rotation.y = Math.PI / 4;
  tip.scale.z = 0.25;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(24, 2.4, 3), m);
  guard.position.y = 8.5;
  const ends = [-12, 12].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(1.9, 10, 8), m);
    e.position.set(x, 8.5, 0);
    return e;
  });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 15, 10), grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(2.8, 14, 10), m);
  pommel.position.y = -9;
  const stone = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshStandardMaterial({ color: "#2346C8", emissive: "#0A1A66", roughness: 0.1 }));
  stone.position.set(0, -9, 2.3);
  for (const x of [blade, groove, tip, guard, ...ends, handle, pommel, stone]) {
    x.castShadow = true;
    g.add(x);
  }
  return g;
}

/** A crimson velvet cloak with an ermine collar, hung from the upper back. */
function makeCloak() {
  const g = new THREE.Group();
  const velvet = new THREE.MeshStandardMaterial({ color: "#9E1B24", roughness: 0.75, side: THREE.DoubleSide });
  const lining = new THREE.MeshStandardMaterial({ color: "#C9A04A", roughness: 0.6, side: THREE.BackSide });
  // a slice of a cone: wider at the hem, open at the front
  const geo = new THREE.CylinderGeometry(22, 40, 118, 24, 6, true, Math.PI * 0.62, Math.PI * 0.76);
  geo.translate(0, -57, 0);
  const cloak = new THREE.Mesh(geo, velvet);
  const inner = new THREE.Mesh(geo, lining);
  inner.scale.setScalar(0.985);
  const ermine = new THREE.Mesh(new THREE.TorusGeometry(15, 4.6, 10, 28, Math.PI * 1.35), new THREE.MeshStandardMaterial({ color: "#F4EFE6", roughness: 1 }));
  ermine.rotation.set(Math.PI / 2, 0, Math.PI * 0.82);
  ermine.position.y = 2;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.82 + (i / 8) * Math.PI * 1.35;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 5), new THREE.MeshStandardMaterial({ color: "#1A1A1A" }));
    spot.position.set(Math.cos(a) * 15, 3.5, -Math.sin(a) * 15);
    g.add(spot);
  }
  for (const x of [cloak, inner, ermine]) {
    x.castShadow = true;
    g.add(x);
  }
  return g;
}

export type ArthurProps = {
  thinking: boolean;
  decisions: number;
  celebrate: boolean;
  reduced: boolean;
  selected: boolean;
  onSelect: () => void;
  onAsk: () => void;
  registry?: MutableRefObject<Partial<Record<string, Vec3>>>;
};

type Mode = "sit" | "receive" | "review";

export default function Arthur({ thinking, decisions, celebrate, reduced, selected, onSelect, onAsk, registry }: ArthurProps) {
  const gltf = useGLTF(ARTHUR_URL, false, true);
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

  // Regalia: crown on the head, cloak on the back, Excalibur in the right hand.
  const sword = useMemo(() => makeExcalibur(), []);
  const cloak = useMemo(() => makeCloak(), []);
  useEffect(() => {
    const head = model.getObjectByName("Head");
    const back = model.getObjectByName("Spine02");
    const hand = model.getObjectByName("RightHand");
    const crown = makeCrown();
    crown.position.set(0, 17.5, -0.5);
    crown.rotation.x = -0.08;
    cloak.position.set(0, 14, -7);
    sword.position.set(2, 9, 2);
    sword.rotation.set(Math.PI / 2, 0, 0);
    head?.add(crown);
    back?.add(cloak);
    hand?.add(sword);
    return () => {
      head?.remove(crown);
      back?.remove(cloak);
      hand?.remove(sword);
    };
  }, [model, sword, cloak]);

  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => Object.fromEntries(gltf.animations.map((c) => [c.name, mixer.clipAction(c)])), [gltf, mixer]);
  const current = useRef("");
  const play = (name: string, fade = 0.35) => {
    if (current.current === name || !actions[name]) return;
    actions[name].reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (current.current && actions[current.current]) actions[current.current].fadeOut(fade);
    current.current = name;
  };

  const mode: Mode = thinking ? "review" : decisions > 0 ? "receive" : "sit";
  const spot: Vec3 = mode === "review" ? AT_TABLE : mode === "receive" ? BEFORE_THRONE : THRONE;
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pos = useRef<Vec3>([...THRONE] as Vec3);
  const yaw = useRef(THRONE_YAW);
  const path = useRef<Vec3[]>([]);
  const greetUntil = useRef(0);
  const greetPending = useRef(false);
  const beckonAt = useRef(0);
  const lastSpot = useRef<Vec3 | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (selected) greetPending.current = true;
  }, [selected]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const r = root.current;
    if (!r) return;
    if (lastSpot.current !== spot) {
      const first = lastSpot.current === null;
      lastSpot.current = spot;
      if (first || reduced) {
        pos.current = [...spot] as Vec3;
        path.current = [];
      } else {
        // step down from the dais first, then cross the hall
        path.current = spot === THRONE ? [BEFORE_THRONE, THRONE] : pos.current === THRONE || Math.hypot(pos.current[0] - THRONE[0], pos.current[2] - THRONE[2]) < 0.2 ? [BEFORE_THRONE, spot] : [spot];
      }
    }
    if (greetPending.current) {
      greetPending.current = false;
      greetUntil.current = t + 3.2;
    }
    let moving = false;
    if (path.current.length) {
      const target = path.current[0];
      const dx = target[0] - pos.current[0];
      const dz = target[2] - pos.current[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.04) {
        pos.current = [...target] as Vec3;
        path.current.shift();
      } else {
        moving = true;
        const step = Math.min(d, SPEED * dt);
        pos.current = [pos.current[0] + (dx / d) * step, 0, pos.current[2] + (dz / d) * step];
        yaw.current = lerpAngle(yaw.current, Math.atan2(dx, dz), Math.min(1, dt * 7));
      }
    }
    const seated = !moving && mode === "sit";
    if (!moving) {
      const want = seated ? THRONE_YAW : mode === "review" ? Math.atan2(TABLE_CENTRE[0] - pos.current[0], TABLE_CENTRE[2] - pos.current[2]) : CAMERA_YAW * 0.7;
      yaw.current = lerpAngle(yaw.current, want, Math.min(1, dt * 5));
    }
    // the dais lifts him while he sits
    r.position.set(pos.current[0], seated ? DAIS_H : 0, pos.current[2]);
    r.rotation.y = yaw.current;
    if (registry) registry.current.arthur = pos.current;
    if (ring.current) ring.current.position.set(pos.current[0], seated ? DAIS_H + 0.02 : 0.02, pos.current[2]);
    sword.visible = !seated;
    cloak.visible = !seated; // the throne's back stands in for it while he sits

    const greeting = t < greetUntil.current && !seated;
    let clip = "idle";
    if (moving) clip = "walk";
    else if (celebrate) clip = seated ? "sit" : "cheer";
    else if (seated) clip = "sit";
    else if (greeting) clip = "wave";
    else if (mode === "review") clip = Math.floor(t / 9) % 2 ? "confused" : "idle";
    else if (mode === "receive") {
      if (t > beckonAt.current) beckonAt.current = t + 7 + Math.random() * 4;
      clip = beckonAt.current - t > 4.6 ? "wave" : "idle";
    }
    play(clip);
    mixer.timeScale = reduced ? 0 : 1;
    mixer.update(dt);
  });
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  const bubble = thinking ? "Reviewing the council's work…" : decisions > 0 ? `${decisions} decision${decisions === 1 ? "" : "s"} for you` : null;
  const seatedNow = mode === "sit";
  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={selected} renderOrder={2}>
        <ringGeometry args={[0.62, 0.74, 48]} />
        <meshBasicMaterial color="#E8C15A" transparent opacity={0.95} depthWrite={false} />
      </mesh>
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
          <boxGeometry args={[1.1, 2.6, 1.1]} />
          <meshBasicMaterial />
        </mesh>
        <primitive object={model} scale={SIZE} />
        <Html position={[0, seatedNow ? 2.45 : 2.95, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div className={styles.tagWrap}>
            {decisions > 0 ? (
              <button
                type="button"
                className={styles.askOrb}
                style={{ pointerEvents: "auto" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAsk();
                }}
                aria-label={`King Arthur: ${decisions} decisions for you`}
              >
                ?
              </button>
            ) : null}
            {(bubble && !celebrate) || hovered || selected ? (
              <div className={`${styles.bubble} ${decisions > 0 && !thinking ? styles.bubbleAsk : ""}`}>{bubble || "Ready to talk, Boss"}</div>
            ) : null}
            <button
              type="button"
              className={`${styles.nameTag} ${styles.nameTagRoyal}`}
              style={{ ["--accent" as string]: ARTHUR_LOOK.body, pointerEvents: "auto" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              aria-label="Talk to King Arthur"
            >
              <span aria-hidden>👑</span> King Arthur
            </button>
          </div>
        </Html>
      </group>
    </>
  );
}

const DAIS_H = 0.18;

/** The throne on its dais. While the king sits, Excalibur leans against it (he holds it when he stands). */
export function Throne({ seated, onTap }: { seated: boolean; onTap: () => void }) {
  return (
    <group
      position={THRONE}
      rotation-y={THRONE_YAW}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta > 10) return;
        onTap();
      }}
    >
      {/* the dais: two stone steps with a royal-blue runner */}
      <mesh position={[0, DAIS_H / 2 - 0.06, -0.05]} receiveShadow castShadow>
        <boxGeometry args={[1.7, DAIS_H, 1.35]} />
        <meshStandardMaterial color={PALETTE.stoneDark} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.03, 0.72]} receiveShadow>
        <boxGeometry args={[1.9, 0.07, 0.3]} />
        <meshStandardMaterial color={PALETTE.stoneDark} roughness={0.9} />
      </mesh>
      <mesh position={[0, DAIS_H - 0.055, 0.25]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[0.7, 0.85]} />
        <meshStandardMaterial color="#24418F" roughness={0.95} />
      </mesh>
      <group position={[0, DAIS_H - 0.06, -0.18]}>
        {/* seat */}
        <mesh position={[0, 0.52, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.92, 0.12, 0.72]} />
          <meshStandardMaterial color={PALETTE.oakDark} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.6, 0.04]} castShadow>
          <boxGeometry args={[0.78, 0.06, 0.62]} />
          <meshStandardMaterial color="#8E1A22" roughness={0.85} />
        </mesh>
        {/* base */}
        <mesh position={[0, 0.24, 0.02]} castShadow>
          <boxGeometry args={[0.86, 0.46, 0.66]} />
          <meshStandardMaterial color={PALETTE.oakDark} roughness={0.7} />
        </mesh>
        {/* tall back with a pointed arch and a gold crest */}
        <mesh position={[0, 1.28, -0.34]} castShadow>
          <boxGeometry args={[0.98, 1.5, 0.14]} />
          <meshStandardMaterial color={PALETTE.oakDark} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.2, -0.26]}>
          <boxGeometry args={[0.66, 1.12, 0.03]} />
          <meshStandardMaterial color="#8E1A22" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.12, -0.34]} rotation-z={Math.PI / 4} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.14]} />
          <meshStandardMaterial color={PALETTE.oakDark} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.95, -0.25]}>
          <circleGeometry args={[0.13, 24]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.25} />
        </mesh>
        {/* gilded finials and arms */}
        {[-0.47, 0.47].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.08, -0.34]} castShadow>
              <sphereGeometry args={[0.08, 14, 12]} />
              <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[x, 0.82, 0.02]} castShadow>
              <boxGeometry args={[0.1, 0.12, 0.72]} />
              <meshStandardMaterial color={PALETTE.oakDark} roughness={0.6} />
            </mesh>
            <mesh position={[x, 0.68, 0.32]} castShadow>
              <boxGeometry args={[0.1, 0.3, 0.1]} />
              <meshStandardMaterial color={PALETTE.oakDark} roughness={0.6} />
            </mesh>
            <mesh position={[x, 0.9, 0.38]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}
        {/* Excalibur rests against the throne while the king sits */}
        {seated ? (
          <group position={[0.68, 1.5, 0.42]} rotation={[0, 0, Math.PI - 0.12]} scale={0.013}>
            <primitive object={restingSword()} />
          </group>
        ) : null}
      </group>
    </group>
  );
}

let resting: THREE.Group | null = null;
/** One shared sword for the throne (point down, hilt up - the group above turns it). */
function restingSword() {
  if (!resting) resting = makeExcalibur();
  return resting;
}
