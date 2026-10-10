"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (textures, materials) are mutated per frame by design */

/**
 * One little robot: body, screen-face, expressive eyes, arms, an antenna that
 * shows its REAL status colour, and a small brain that turns that status into
 * behaviour:
 *
 *   working   -> at its desk, typing at its holo-screen
 *   needs_you -> at its desk, turned to you, bouncing, a "?" you can tap
 *   error     -> at its desk, puzzled, red antenna
 *   paused/off-> asleep on its beanbag
 *   waiting   -> idles: sits at its desk, sometimes wanders (coffee, window,
 *                plant) and comes back. Idle wandering is decoration and is
 *                never presented as work.
 *
 * Everything per-frame lives in refs (no React state), so a frame costs a few
 * matrix updates.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { RobotKey, RobotStatus } from "@/lib/office";
import { HUB, IDLE_SPOTS, STATUS_LIGHT, type RobotLook, type Vec3 } from "./office-layout";
import { drawHolo } from "./textures";
import styles from "./office.module.css";

type Activity = "work" | "desk" | "ask" | "confused" | "sleep" | "visit";
type Plan = { activity: Activity; spot: Vec3; until: number; emoji?: string };

const CAMERA_YAW = Math.PI / 4;
const HOLO_COLOR = { visibility: "#7DFFE0", outreach: "#FFC1A8", conversation: "#D8C8FF" } as const;
const SPEED = 1.3;
const ROBOT_SCALE = 1.38;

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function planFor(status: RobotStatus, look: RobotLook, now: number, previous: Plan | null, celebrate: boolean): Plan {
  if (celebrate) return { activity: "desk", spot: previous?.spot || look.seat, until: now + 5 };
  if (status === "working") return { activity: "work", spot: look.seat, until: Infinity };
  if (status === "needs_you") return { activity: "ask", spot: look.seat, until: Infinity };
  if (status === "error") return { activity: "confused", spot: look.seat, until: Infinity };
  if (status === "paused" || status === "off") return { activity: "sleep", spot: look.bed, until: Infinity };
  // waiting: alternate desk time and a short wander
  if (!previous || previous.activity !== "desk" || previous.until === Infinity) {
    return { activity: "desk", spot: look.seat, until: now + 10 + Math.random() * 14 };
  }
  const choices: Array<{ spot: Vec3; emoji: string }> = [
    { spot: look.hobby, emoji: look.key === "conversation" ? "☕" : look.key === "outreach" ? "🌤️" : "🌱" },
    ...IDLE_SPOTS.filter((s) => dist(s, look.hobby) > 0.5).map((spot, i) => ({ spot, emoji: ["📺", "🌤️", "☕", "🎵"][i] || "✨" })),
  ];
  const pick = choices[Math.floor(Math.random() * choices.length)];
  return { activity: "visit", spot: pick.spot, until: now + 6 + Math.random() * 5, emoji: pick.emoji };
}

export type RobotProps = {
  look: RobotLook;
  status: RobotStatus;
  statusText: string;
  waiting: number;
  celebrate: boolean;
  reduced: boolean;
  selected: boolean;
  onSelect: () => void;
  onAsk: () => void;
  /** Where each robot is right now (the camera follows the selected one). */
  registry?: MutableRefObject<Partial<Record<RobotKey, Vec3>>>;
};

export default function Robot({ look, status, statusText, waiting, celebrate, reduced, selected, onSelect, onAsk, registry }: RobotProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const happyL = useRef<THREE.Mesh>(null);
  const happyR = useRef<THREE.Mesh>(null);
  const mouthSmile = useRef<THREE.Mesh>(null);
  const mouthFlat = useRef<THREE.Mesh>(null);
  const mouthO = useRef<THREE.Mesh>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  const holo = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);

  const pos = useRef<Vec3>([...look.seat] as Vec3);
  const yaw = useRef(CAMERA_YAW);
  const path = useRef<Vec3[]>([]);
  const plan = useRef<Plan | null>(null);
  const placed = useRef(false); // the first plan places the robot instead of walking it there
  const blinkAt = useRef(0); // set on the first frame
  const greetUntil = useRef(0);
  const greetPending = useRef(false);
  const ringRef = useRef<THREE.Mesh>(null);
  const [phase] = useState(() => Math.random() * Math.PI * 2);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(true);
  const [hovered, setHovered] = useState(false);

  // The robot's holo-screen: a tiny canvas redrawn a few times a second.
  const holoCanvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 176;
    return c;
  }, []);
  const holoTexture = useMemo(() => {
    if (!holoCanvas) return null;
    const t = new THREE.CanvasTexture(holoCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [holoCanvas]);
  useEffect(() => () => holoTexture?.dispose(), [holoTexture]);
  const holoTick = useRef(0);

  // Holo-screen position: in front-left of the seat, turned to the robot.
  const holoPos = useMemo<Vec3>(() => {
    const s = Math.sin(Math.PI / 4);
    const c = Math.cos(Math.PI / 4);
    const lx = -0.66;
    const lz = 0.55;
    return [look.seat[0] + lx * c + lz * s, 1.55, look.seat[2] - lx * s + lz * c];
  }, [look.seat]);
  const holoYaw = Math.atan2(look.seat[0] - holoPos[0], look.seat[2] - holoPos[2]);

  // Status bubbles: always for notable states, briefly now and then while waiting.
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

  // Turn and wave when you tap it (a greeting, not a status).
  useEffect(() => {
    if (selected) greetPending.current = true;
  }, [selected]);

  // Re-plan immediately when the real status changes.
  useEffect(() => {
    plan.current = null;
  }, [status, celebrate]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const r = root.current;
    if (!r) return;

    // --- brain -----------------------------------------------------------
    if (!plan.current || t > plan.current.until) {
      const next = planFor(status, look, t, plan.current, celebrate);
      plan.current = next;
      const here = pos.current;
      const first = !placed.current;
      placed.current = true;
      if (reduced || first) {
        pos.current = [...next.spot] as Vec3;
        path.current = [];
      } else if (dist(here, next.spot) > 0.05) {
        path.current = dist(here, next.spot) > 2.4 ? [HUB, next.spot] : [next.spot];
      }
      const e = next.activity === "visit" ? next.emoji || null : null;
      setEmoji(e);
    }
    const p = plan.current!;
    if (greetPending.current) {
      greetPending.current = false;
      greetUntil.current = t + 2.2;
    }
    const greeting = t < greetUntil.current && p.activity !== "sleep";

    // --- moving ----------------------------------------------------------
    let moving = false;
    if (path.current.length) {
      const target = path.current[0];
      const dx = target[0] - pos.current[0];
      const dz = target[2] - pos.current[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.04) {
        path.current.shift();
      } else {
        moving = true;
        const step = Math.min(d, SPEED * dt);
        pos.current = [pos.current[0] + (dx / d) * step, 0, pos.current[2] + (dz / d) * step];
        const want = Math.atan2(dx, dz);
        yaw.current = lerpAngle(yaw.current, want, Math.min(1, dt * 8));
      }
    }
    if (!moving) {
      let want = CAMERA_YAW;
      if (greeting) want = CAMERA_YAW;
      else if (p.activity === "work") want = Math.atan2(holoPos[0] - pos.current[0], holoPos[2] - pos.current[2]);
      if (p.activity === "visit") want = CAMERA_YAW + Math.sin(t * 0.4 + phase) * 0.35;
      if (p.activity === "desk") want = CAMERA_YAW + Math.sin(t * 0.25 + phase) * 0.5;
      yaw.current = lerpAngle(yaw.current, want, Math.min(1, dt * 4));
    }

    // --- body language ---------------------------------------------------
    const sleeping = p.activity === "sleep" && !moving;
    const asking = p.activity === "ask" && !moving;
    const confused = p.activity === "confused" && !moving;
    const working = p.activity === "work" && !moving;
    const happy = celebrate || greeting;
    const amp = reduced ? 0 : 1;

    let hover = 0.16 + Math.sin(t * 2 + phase) * 0.035 * amp;
    if (sleeping) hover = 0.24 + Math.sin(t * 0.9 + phase) * 0.012 * amp;
    if (moving) hover += Math.abs(Math.sin(t * 9)) * 0.05 * amp;
    if (asking) hover += Math.abs(Math.sin(t * 3.2)) * 0.12 * amp;
    if (happy) hover += Math.abs(Math.sin(t * 7 + phase)) * 0.4 * amp;
    r.position.set(pos.current[0], hover, pos.current[2]);
    if (registry) registry.current[look.key] = pos.current;
    r.rotation.y = yaw.current + (happy ? t * 4 * amp : 0);

    if (shadow.current) {
      shadow.current.position.set(pos.current[0], 0.012, pos.current[2]);
      const s = 1.05 - hover * 0.6;
      shadow.current.scale.set(s, s, s);
    }
    if (ringRef.current) ringRef.current.position.set(pos.current[0], 0.02, pos.current[2]);

    if (body.current) {
      body.current.rotation.x = moving ? 0.12 : sleeping ? 0.18 : 0;
      body.current.rotation.z = sleeping ? Math.sin(t * 0.9) * 0.04 * amp : 0;
    }
    if (head.current) {
      head.current.rotation.z = confused ? 0.28 + Math.sin(t * 1.4) * 0.05 * amp : asking ? Math.sin(t * 2.2) * 0.12 * amp : sleeping ? 0.22 : 0;
      head.current.rotation.x = sleeping ? 0.35 : working ? 0.06 + Math.sin(t * 6) * 0.015 * amp : p.activity === "desk" ? Math.sin(t * 0.7 + phase) * 0.06 * amp : 0;
      head.current.rotation.y = p.activity === "desk" && !moving ? Math.sin(t * 0.5 + phase) * 0.35 * amp : 0;
    }

    // arms
    const swing = moving ? Math.sin(t * 9) * 0.6 * amp : 0;
    let l = 0.15 + swing;
    let rr = 0.15 - swing;
    let lz = -0.1;
    let rz = 0.1;
    if (working) {
      l = -1.15 + Math.sin(t * 17) * 0.22 * amp;
      rr = -1.15 + Math.sin(t * 17 + 1.7) * 0.22 * amp;
    }
    if (asking) {
      rr = -2.6 + Math.sin(t * 6) * 0.25 * amp; // waving
      rz = 0.35;
    }
    if (confused) {
      rr = -2.2;
      rz = -0.9; // scratching its head
    }
    if (greeting && !celebrate) {
      rr = -2.7 + Math.sin(t * 9) * 0.3 * amp; // hi!
      rz = 0.4;
    } else if (happy) {
      l = rr = -2.8;
      lz = -0.5;
      rz = 0.5;
    }
    if (sleeping) {
      l = rr = 0.35;
    }
    if (p.activity === "desk" && !moving && Math.sin(t * 0.21 + phase) > 0.93) {
      l = rr = -2.9; // a big stretch now and then
      lz = -0.35;
      rz = 0.35;
    }
    if (armL.current) {
      armL.current.rotation.x = lerp(armL.current.rotation.x, l, Math.min(1, dt * 10));
      armL.current.rotation.z = lerp(armL.current.rotation.z, lz, Math.min(1, dt * 10));
    }
    if (armR.current) {
      armR.current.rotation.x = lerp(armR.current.rotation.x, rr, Math.min(1, dt * 10));
      armR.current.rotation.z = lerp(armR.current.rotation.z, rz, Math.min(1, dt * 10));
    }

    // eyes
    if (blinkAt.current === 0) blinkAt.current = t + 1 + Math.random() * 3;
    if (t > blinkAt.current) blinkAt.current = t + 2.5 + Math.random() * 3.5;
    const untilBlink = blinkAt.current - t;
    const blinking = untilBlink > 0 && untilBlink < 0.12;
    let ely = 1;
    let ery = 1;
    let els = 1;
    let ers = 1;
    if (sleeping) ely = ery = 0.12;
    else if (working) ely = ery = 0.62;
    else if (confused) {
      els = 0.72;
      ers = 1.22;
    }
    if (blinking && !sleeping) ely = ery = 0.1;
    setEye(eyeL.current, els, ely * els, !happy);
    setEye(eyeR.current, ers, ery * ers, !happy);
    if (happyL.current) happyL.current.visible = happy;
    if (happyR.current) happyR.current.visible = happy;
    if (mouthSmile.current) mouthSmile.current.visible = !sleeping && !confused;
    if (mouthFlat.current) mouthFlat.current.visible = sleeping;
    if (mouthO.current) mouthO.current.visible = confused;

    // status light + hover ring
    if (bulb.current) {
      const pulse = status === "needs_you" || status === "error" ? (Math.sin(t * 6) + 1) / 2 : status === "working" ? (Math.sin(t * 3) + 1) / 2 : 0.4;
      bulb.current.emissiveIntensity = (sleeping ? 0.25 : 1.1) + pulse * 1.4 * (amp || 0.3);
    }
    if (ring.current) ring.current.emissiveIntensity = sleeping ? 0.15 : 0.9 + Math.sin(t * 4 + phase) * 0.4 * amp;

    // holo-screen
    if (holo.current) {
      const show = working || (p.activity === "desk" && !moving) || asking || confused;
      holo.current.visible = show;
      if (show && holoCanvas && holoTexture && t - holoTick.current > (working ? 0.12 : 0.6)) {
        holoTick.current = t;
        drawHolo(holoCanvas, look.key, HOLO_COLOR[look.key], t, working);
        holoTexture.needsUpdate = true;
      }
      const m = holo.current.material as THREE.MeshBasicMaterial;
      m.opacity = working ? 0.95 : 0.55 + Math.sin(t * 2) * 0.05 * amp;
    }
  });

  const light = STATUS_LIGHT[status] || STATUS_LIGHT.waiting;
  const sleeping = status === "paused" || status === "off";
  const showBubble = ((showStatus && !sleeping) || hovered || selected) && !celebrate;

  return (
    <>
      {/* soft shadow on the floor */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
        <circleGeometry args={[0.48 * ROBOT_SCALE, 32]} />
        <meshBasicMaterial color="#3B2A1A" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* selection ring on the floor */}
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} visible={selected} renderOrder={2}>
        <ringGeometry args={[0.72, 0.84, 48]} />
        <meshBasicMaterial color={look.body} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* holo-screen */}
      {holoTexture ? (
        <mesh ref={holo} position={holoPos} rotation-y={holoYaw} renderOrder={5}>
          <planeGeometry args={[0.86, 0.6]} />
          <meshBasicMaterial map={holoTexture} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}

      <group
        ref={root}
        scale={ROBOT_SCALE}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 10) return; // a swipe, not a tap
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
        {/* generous invisible tap target */}
        <mesh position={[0, 0.75, 0]} visible={false}>
          <boxGeometry args={[1.1, 1.6, 1.1]} />
          <meshBasicMaterial />
        </mesh>



        <group ref={body}>
          {/* hover thruster */}
          <mesh position={[0, 0.04, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.17, 0.035, 10, 28]} />
            <meshStandardMaterial ref={ring} color={look.accent} emissive={look.accent} emissiveIntensity={1} />
          </mesh>
          {/* body */}
          <RoundedBox args={[0.62, 0.5, 0.5]} radius={0.17} smoothness={4} position={[0, 0.35, 0]}>
            <meshStandardMaterial color={look.body} roughness={0.45} />
          </RoundedBox>
          <RoundedBox args={[0.34, 0.2, 0.04]} radius={0.06} smoothness={3} position={[0, 0.34, 0.25]}>
            <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
          </RoundedBox>
          <mesh position={[0, 0.34, 0.275]}>
            <circleGeometry args={[0.045, 20]} />
            <meshStandardMaterial color={light} emissive={light} emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
          {/* arms (pivot at the shoulder) */}
          {[
            { ref: armL, x: -0.36 },
            { ref: armR, x: 0.36 },
          ].map(({ ref, x }) => (
            <group key={x} ref={ref} position={[x, 0.5, 0]}>
              <mesh position={[0, -0.13, 0]}>
                <capsuleGeometry args={[0.06, 0.16, 4, 10]} />
                <meshStandardMaterial color={look.bodyDark} roughness={0.5} />
              </mesh>
              <mesh position={[0, -0.3, 0]}>
                <sphereGeometry args={[0.075, 16, 12]} />
                <meshStandardMaterial color="#FBF7F0" roughness={0.4} />
              </mesh>
            </group>
          ))}
          {/* neck */}
          <mesh position={[0, 0.64, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.1, 14]} />
            <meshStandardMaterial color={look.bodyDark} />
          </mesh>

          {/* head */}
          <group ref={head} position={[0, 0.68, 0]}>
            <RoundedBox args={[0.84, 0.6, 0.62]} radius={0.22} smoothness={4} position={[0, 0.3, 0]}>
              <meshStandardMaterial color="#FBF7F0" roughness={0.35} />
            </RoundedBox>
            <RoundedBox args={[0.66, 0.42, 0.06]} radius={0.12} smoothness={3} position={[0, 0.3, 0.29]}>
              <meshStandardMaterial color="#141B33" roughness={0.15} metalness={0.1} />
            </RoundedBox>
            {/* eyes */}
            <mesh ref={eyeL} position={[-0.14, 0.33, 0.325]}>
              <boxGeometry args={[0.1, 0.15, 0.01]} />
              <meshBasicMaterial color={look.eye} toneMapped={false} />
            </mesh>
            <mesh ref={eyeR} position={[0.14, 0.33, 0.325]}>
              <boxGeometry args={[0.1, 0.15, 0.01]} />
              <meshBasicMaterial color={look.eye} toneMapped={false} />
            </mesh>
            {[-0.14, 0.14].map((x, i) => (
              <mesh key={x} ref={i === 0 ? happyL : happyR} position={[x, 0.31, 0.325]} visible={false}>
                <torusGeometry args={[0.06, 0.018, 6, 16, Math.PI]} />
                <meshBasicMaterial color={look.eye} toneMapped={false} />
              </mesh>
            ))}
            {/* mouth */}
            <mesh ref={mouthSmile} position={[0, 0.2, 0.325]} rotation-z={Math.PI}>
              <torusGeometry args={[0.05, 0.012, 6, 16, Math.PI]} />
              <meshBasicMaterial color={look.eye} toneMapped={false} />
            </mesh>
            <mesh ref={mouthFlat} position={[0, 0.19, 0.325]} visible={false}>
              <boxGeometry args={[0.08, 0.016, 0.01]} />
              <meshBasicMaterial color={look.eye} toneMapped={false} />
            </mesh>
            <mesh ref={mouthO} position={[0, 0.18, 0.325]} visible={false}>
              <torusGeometry args={[0.03, 0.012, 6, 16]} />
              <meshBasicMaterial color={look.eye} toneMapped={false} />
            </mesh>
            {/* ears */}
            {[-0.44, 0.44].map((x) => (
              <mesh key={x} position={[x, 0.3, 0]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.1, 0.1, 0.07, 18]} />
                <meshStandardMaterial color={look.body} roughness={0.4} />
              </mesh>
            ))}
            {/* antenna + status light */}
            <mesh position={[0, 0.68, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.18, 8]} />
              <meshStandardMaterial color="#9AA3B8" />
            </mesh>
            <mesh position={[0, 0.8, 0]}>
              <sphereGeometry args={[0.068, 18, 14]} />
              <meshStandardMaterial ref={bulb} color={light} emissive={light} emissiveIntensity={1.4} toneMapped={false} />
            </mesh>
            <Accessory look={look} />
          </group>
        </group>

        {/* label, bubble and the tap-to-decide orb */}
        <Html position={[0, sleeping ? 1.25 : 1.78, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
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

function Accessory({ look }: { look: RobotLook }) {
  if (look.key === "visibility") {
    // a little desk-lamp hat: Lumi lights things up
    return (
      <group position={[0.24, 0.62, -0.02]} rotation-z={-0.35}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
          <meshStandardMaterial color={look.bodyDark} />
        </mesh>
        <mesh position={[0, 0.17, 0]} rotation-z={0.4}>
          <coneGeometry args={[0.11, 0.12, 18, 1, true]} />
          <meshStandardMaterial color={look.accent} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.03, 0.14, 0]}>
          <sphereGeometry args={[0.04, 12, 10]} />
          <meshStandardMaterial color="#FFF6C8" emissive="#FFE07A" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>
    );
  }
  if (look.key === "outreach") {
    // an explorer's bucket hat and a backpack
    return (
      <>
        <group position={[0, 0.6, 0]} rotation-z={0.08}>
          <mesh>
            <cylinderGeometry args={[0.46, 0.46, 0.03, 28]} />
            <meshStandardMaterial color="#D9B77A" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.28, 0.32, 0.2, 24]} />
            <meshStandardMaterial color="#E5C78E" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.325, 0.325, 0.05, 24]} />
            <meshStandardMaterial color={look.accent} />
          </mesh>
        </group>
        <RoundedBox args={[0.42, 0.42, 0.18]} radius={0.08} smoothness={3} position={[0, -0.28, -0.36]}>
          <meshStandardMaterial color="#C88A4A" roughness={0.7} />
        </RoundedBox>
      </>
    );
  }
  // Echo: a headset with a little mic
  return (
    <group>
      <mesh position={[0, 0.3, 0]} rotation-z={0}>
        <torusGeometry args={[0.47, 0.03, 8, 32, Math.PI]} />
        <meshStandardMaterial color={look.accent} />
      </mesh>
      {[-0.47, 0.47].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.13, 0.13, 0.09, 18]} />
          <meshStandardMaterial color={look.accent} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[-0.38, 0.12, 0.22]} rotation-x={0.9} rotation-z={0.5}>
        <cylinderGeometry args={[0.015, 0.015, 0.34, 8]} />
        <meshStandardMaterial color="#5B4A8A" />
      </mesh>
      <mesh position={[-0.27, 0.05, 0.36]}>
        <sphereGeometry args={[0.04, 12, 10]} />
        <meshStandardMaterial color="#5B4A8A" />
      </mesh>
    </group>
  );
}

function setEye(m: THREE.Mesh | null, sx: number, sy: number, visible: boolean) {
  if (!m) return;
  m.visible = visible;
  m.scale.x = lerp(m.scale.x, sx, 0.4);
  m.scale.y = lerp(m.scale.y, sy, 0.45);
}

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
