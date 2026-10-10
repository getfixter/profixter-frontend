"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (materials, meshes) are mutated per frame by design */

/**
 * One little knight: a cheerful face under an open steel helm, chainmail, a
 * heraldic tabard and cape, boots that walk - and a jewel on the helm whose
 * colour is the knight's REAL status. A small brain turns that status into
 * behaviour:
 *
 *   working   -> at the desk, head down, writing with a quill
 *   needs_you -> at the desk, turned to you, hopping and waving, a "?" to tap
 *   error     -> at the desk, puzzled, scratching the helm (ruby jewel)
 *   paused/off-> asleep, sitting on a cushion by the hearth
 *   waiting   -> idles: sits at the desk, sometimes strolls (the hearth, the
 *                window, the bookcase, the war table) and comes back.
 *                Idle strolls are decoration and are never presented as work.
 *
 * Tapping a knight makes it bow, then wave. Everything per-frame lives in
 * refs (no React state), so a frame costs a few matrix updates.
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { RobotKey, RobotStatus } from "@/lib/office";
import { HUB, IDLE_SPOTS, STATUS_LIGHT, type RobotLook, type Vec3 } from "./office-layout";
import styles from "./office.module.css";

type Activity = "work" | "desk" | "ask" | "confused" | "sleep" | "visit";
type Plan = { activity: Activity; spot: Vec3; until: number; emoji?: string };

const CAMERA_YAW = Math.PI / 4;
const SPEED = 1.1;
const SCALE = 1.38;

// period materials
const MAIL = "#9DA3AB"; // chainmail
const STEEL = "#C3C9D1"; // brushed steel
const GOLD = "#C9A04A";
const LEATHER = "#6B4A33";
const HOSE = "#4A3A2E";
const INK = "#2A1E18";

function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function planFor(status: RobotStatus, look: RobotLook, now: number, previous: Plan | null, celebrate: boolean): Plan {
  if (celebrate) return { activity: "desk", spot: previous?.spot || look.seat, until: now + 5 };
  if (status === "working") return { activity: "work", spot: look.seat, until: Infinity };
  if (status === "needs_you") return { activity: "ask", spot: look.seat, until: Infinity };
  if (status === "error") return { activity: "confused", spot: look.seat, until: Infinity };
  if (status === "paused" || status === "off") return { activity: "sleep", spot: look.bed, until: Infinity };
  // waiting: alternate desk time and a short stroll
  if (!previous || previous.activity !== "desk" || previous.until === Infinity) {
    return { activity: "desk", spot: look.seat, until: now + 10 + Math.random() * 14 };
  }
  const choices: Array<{ spot: Vec3; emoji: string }> = [
    { spot: look.hobby, emoji: look.key === "conversation" ? "🗺️" : look.key === "outreach" ? "🔭" : "📖" },
    ...IDLE_SPOTS.filter((s) => dist(s, look.hobby) > 0.5).map((spot, i) => ({ spot, emoji: ["🔥", "🌤️", "🍵", "🎵", "🗺️"][i] || "✨" })),
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
  /** Where each knight is right now (the camera follows the selected one). */
  registry?: MutableRefObject<Partial<Record<RobotKey, Vec3>>>;
};

export default function Robot({ look, status, statusText, waiting, celebrate, reduced, selected, onSelect, onAsk, registry }: RobotProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Group>(null);
  const quill = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const happyL = useRef<THREE.Mesh>(null);
  const happyR = useRef<THREE.Mesh>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const mouthSmile = useRef<THREE.Mesh>(null);
  const mouthFlat = useRef<THREE.Mesh>(null);
  const mouthO = useRef<THREE.Mesh>(null);
  const jewel = useRef<THREE.MeshStandardMaterial>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const pos = useRef<Vec3>([...look.seat] as Vec3);
  const yaw = useRef(CAMERA_YAW);
  const path = useRef<Vec3[]>([]);
  const plan = useRef<Plan | null>(null);
  const placed = useRef(false); // the first plan places the knight instead of walking it there
  const blinkAt = useRef(0); // set on the first frame
  const greetUntil = useRef(0);
  const greetPending = useRef(false);
  const [phase] = useState(() => Math.random() * Math.PI * 2);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(true);
  const [hovered, setHovered] = useState(false);

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

  // Bow and wave when you tap it (a greeting, not a status).
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
      setEmoji(next.activity === "visit" ? next.emoji || null : null);
    }
    const p = plan.current!;
    if (greetPending.current) {
      greetPending.current = false;
      greetUntil.current = t + 2.2;
    }
    const greeting = t < greetUntil.current && p.activity !== "sleep";

    // --- walking ---------------------------------------------------------
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
        yaw.current = lerpAngle(yaw.current, Math.atan2(dx, dz), Math.min(1, dt * 8));
      }
    }
    if (!moving) {
      let want = CAMERA_YAW; // the desk is in front: facing it also faces you
      if (!greeting && p.activity === "visit") want = CAMERA_YAW + Math.sin(t * 0.4 + phase) * 0.35;
      if (!greeting && p.activity === "desk") want = CAMERA_YAW + Math.sin(t * 0.25 + phase) * 0.5;
      yaw.current = lerpAngle(yaw.current, want, Math.min(1, dt * 4));
    }

    // --- body language ---------------------------------------------------
    const sleeping = p.activity === "sleep" && !moving;
    const asking = p.activity === "ask" && !moving;
    const confused = p.activity === "confused" && !moving;
    const working = p.activity === "work" && !moving;
    const happy = celebrate || greeting;
    const amp = reduced ? 0 : 1;
    const greetAge = 2.2 - (greetUntil.current - t);
    const bowing = greeting && !celebrate && greetAge < 0.9;

    let lift = 0.02 + Math.sin(t * 1.6 + phase) * 0.006 * amp;
    if (sleeping) lift = 0.2; // sitting on the cushion
    if (moving) lift += Math.abs(Math.sin(t * 9)) * 0.04 * amp;
    if (asking) lift += Math.abs(Math.sin(t * 3.2)) * 0.1 * amp;
    if (happy && !bowing) lift += Math.abs(Math.sin(t * 7 + phase)) * (celebrate ? 0.35 : 0.08) * amp;
    r.position.set(pos.current[0], lift, pos.current[2]);
    if (registry) registry.current[look.key] = pos.current;
    r.rotation.y = yaw.current + (celebrate ? t * 4 * amp : 0);

    if (shadow.current) {
      shadow.current.position.set(pos.current[0], 0.012, pos.current[2]);
      const s = 1.05 - lift * 0.6;
      shadow.current.scale.set(s, s, s);
    }
    if (ringRef.current) ringRef.current.position.set(pos.current[0], 0.02, pos.current[2]);

    if (body.current) {
      body.current.rotation.x = bowing ? Math.sin((greetAge / 0.9) * Math.PI) * 0.42 * (amp || 0.5) : moving ? 0.1 : working ? 0.12 : 0;
      body.current.rotation.z = sleeping ? Math.sin(t * 0.9) * 0.04 * amp : 0;
    }
    const stride = moving ? Math.sin(t * 9) * 0.55 * amp : 0;
    if (legL.current) legL.current.rotation.x = lerp(legL.current.rotation.x, sleeping ? -1.35 : stride, Math.min(1, dt * 12));
    if (legR.current) legR.current.rotation.x = lerp(legR.current.rotation.x, sleeping ? -1.35 : -stride, Math.min(1, dt * 12));
    if (cape.current) cape.current.rotation.x = (moving ? 0.3 : 0.06) + Math.sin(t * (moving ? 6 : 1.2) + phase) * 0.05 * amp;
    if (head.current) {
      head.current.rotation.z = confused ? 0.24 + Math.sin(t * 1.4) * 0.05 * amp : asking ? Math.sin(t * 2.2) * 0.1 * amp : sleeping ? 0.25 : 0;
      head.current.rotation.x = sleeping ? 0.3 : working ? 0.1 + Math.sin(t * 2.4) * 0.03 * amp : -0.16 + (p.activity === "desk" ? Math.sin(t * 0.7 + phase) * 0.05 * amp : 0);
      head.current.rotation.y = p.activity === "desk" && !moving && !greeting ? Math.sin(t * 0.5 + phase) * 0.35 * amp : 0;
    }

    // arms
    const swing = moving ? Math.sin(t * 9) * 0.6 * amp : 0;
    let l = 0.15 + swing;
    let rr = 0.15 - swing;
    let lz = -0.1;
    let rz = 0.1;
    if (working) {
      // writing: the left hand holds the page, the right moves the quill
      l = -0.95;
      lz = 0.25;
      rr = -1.05 + Math.sin(t * 7) * 0.12 * amp;
      rz = -0.2 + Math.sin(t * 3.5) * 0.12 * amp;
    }
    if (asking) {
      rr = -2.6 + Math.sin(t * 6) * 0.25 * amp; // waving
      rz = 0.35;
    }
    if (confused) {
      rr = -2.3;
      rz = -0.8; // scratching the helm
    }
    if (bowing) {
      l = rr = 0.25; // a polite bow, hands at the sides
      lz = -0.1;
      rz = 0.1;
    } else if (greeting && !celebrate) {
      rr = -2.7 + Math.sin(t * 9) * 0.3 * amp; // then a wave
      rz = 0.4;
    } else if (celebrate) {
      l = rr = -2.8;
      lz = -0.5;
      rz = 0.5;
    }
    if (sleeping) l = rr = 0.35;
    if (p.activity === "desk" && !moving && !greeting && Math.sin(t * 0.21 + phase) > 0.93) {
      l = rr = -2.9; // a big stretch now and then
      lz = -0.35;
      rz = 0.35;
    }
    const k = Math.min(1, dt * 10);
    if (armL.current) {
      armL.current.rotation.x = lerp(armL.current.rotation.x, l, k);
      armL.current.rotation.z = lerp(armL.current.rotation.z, lz, k);
    }
    if (armR.current) {
      armR.current.rotation.x = lerp(armR.current.rotation.x, rr, k);
      armR.current.rotation.z = lerp(armR.current.rotation.z, rz, k);
    }
    if (quill.current) quill.current.visible = working;

    // the face
    if (blinkAt.current === 0) blinkAt.current = t + 1 + Math.random() * 3;
    if (t > blinkAt.current) blinkAt.current = t + 2.5 + Math.random() * 3.5;
    const untilBlink = blinkAt.current - t;
    const blinking = untilBlink > 0 && untilBlink < 0.12;
    let ely = 1;
    let ery = 1;
    let els = 1;
    let ers = 1;
    if (sleeping) ely = ery = 0.12;
    else if (working) ely = ery = 0.7;
    else if (confused) {
      els = 0.8;
      ers = 1.18;
    }
    if (blinking && !sleeping) ely = ery = 0.1;
    setEye(eyeL.current, els, ely * els, !happy);
    setEye(eyeR.current, ers, ery * ers, !happy);
    if (happyL.current) happyL.current.visible = happy;
    if (happyR.current) happyR.current.visible = happy;
    // eyebrows: raised when asking, one up when puzzled, low when focused
    const browY = asking || greeting ? 0.04 : working ? -0.015 : 0;
    if (browL.current) {
      browL.current.position.y = 0.4 + browY + (confused ? 0.04 : 0);
      browL.current.rotation.z = confused ? 0.35 : working ? -0.15 : 0.08;
    }
    if (browR.current) {
      browR.current.position.y = 0.4 + browY;
      browR.current.rotation.z = confused ? 0.1 : working ? 0.15 : -0.08;
    }
    if (mouthSmile.current) mouthSmile.current.visible = !sleeping && !confused;
    if (mouthFlat.current) mouthFlat.current.visible = sleeping;
    if (mouthO.current) mouthO.current.visible = confused;

    // the status jewel
    if (jewel.current) {
      const pulse = status === "needs_you" || status === "error" ? (Math.sin(t * 6) + 1) / 2 : status === "working" ? (Math.sin(t * 3) + 1) / 2 : 0.4;
      jewel.current.emissiveIntensity = (sleeping ? 0.2 : 0.6) + pulse * 0.9 * (amp || 0.3);
    }
  });

  const light = STATUS_LIGHT[status] || STATUS_LIGHT.waiting;
  const sleeping = status === "paused" || status === "off";
  const showBubble = ((showStatus && !sleeping) || hovered || selected) && !celebrate;
  const skin = look.eye;
  const brow = look.hair === "#C9893F" ? "#8A5A26" : look.hair;

  return (
    <>
      {/* soft shadow on the floor */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
        <circleGeometry args={[0.42 * SCALE, 32]} />
        <meshBasicMaterial color="#2B1D12" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* selection ring on the floor */}
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} visible={selected} renderOrder={2}>
        <ringGeometry args={[0.66, 0.78, 48]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.95} depthWrite={false} />
      </mesh>

      <group
        ref={root}
        scale={SCALE}
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
        <mesh position={[0, 0.7, 0]} visible={false}>
          <boxGeometry args={[1.0, 1.5, 1.0]} />
          <meshBasicMaterial />
        </mesh>

        {/* legs in hose, leather boots */}
        {[
          { ref: legL, x: -0.12 },
          { ref: legR, x: 0.12 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 0.22, 0]}>
            <mesh position={[0, -0.07, 0]}>
              <capsuleGeometry args={[0.065, 0.08, 4, 10]} />
              <meshStandardMaterial color={HOSE} roughness={0.9} />
            </mesh>
            <RoundedBox args={[0.15, 0.1, 0.21]} radius={0.045} smoothness={3} position={[0, -0.17, 0.025]}>
              <meshStandardMaterial color={LEATHER} roughness={0.75} />
            </RoundedBox>
          </group>
        ))}

        <group ref={body}>
          {/* cape */}
          <group ref={cape} position={[0, 0.62, -0.18]}>
            <RoundedBox args={[0.5, 0.56, 0.03]} radius={0.012} smoothness={2} position={[0, -0.28, 0]}>
              <meshStandardMaterial color={look.bodyDark} roughness={0.9} />
            </RoundedBox>
          </group>
          {/* chainmail */}
          <RoundedBox args={[0.5, 0.42, 0.38]} radius={0.15} smoothness={4} position={[0, 0.43, 0]}>
            <meshStandardMaterial color={MAIL} roughness={0.85} metalness={0.15} />
          </RoundedBox>
          {/* heraldic tabard with a gold charge */}
          <RoundedBox args={[0.44, 0.46, 0.05]} radius={0.04} smoothness={3} position={[0, 0.4, 0.18]}>
            <meshStandardMaterial color={look.body} roughness={0.85} />
          </RoundedBox>
          <mesh position={[0, 0.45, 0.208]}>
            <circleGeometry args={[0.07, 20]} />
            <meshStandardMaterial color={GOLD} roughness={0.45} metalness={0.2} />
          </mesh>
          {/* belt and buckle */}
          <RoundedBox args={[0.52, 0.06, 0.4]} radius={0.025} smoothness={2} position={[0, 0.25, 0]}>
            <meshStandardMaterial color={LEATHER} roughness={0.7} />
          </RoundedBox>
          <mesh position={[0, 0.25, 0.205]}>
            <boxGeometry args={[0.07, 0.07, 0.02]} />
            <meshStandardMaterial color={GOLD} metalness={0.2} roughness={0.4} />
          </mesh>
          {/* small steel pauldrons */}
          {[-0.28, 0.28].map((x) => (
            <mesh key={x} position={[x, 0.59, 0]} scale={[1, 0.7, 1]}>
              <sphereGeometry args={[0.13, 16, 12]} />
              <meshStandardMaterial color={STEEL} metalness={0.2} roughness={0.45} />
            </mesh>
          ))}
          {/* arms in mail, leather gloves (the right one holds a quill while writing) */}
          <group ref={armL} position={[-0.31, 0.55, 0]}>
            <mesh position={[0, -0.12, 0]}>
              <capsuleGeometry args={[0.058, 0.14, 4, 10]} />
              <meshStandardMaterial color={MAIL} roughness={0.85} metalness={0.15} />
            </mesh>
            <mesh position={[0, -0.27, 0]}>
              <sphereGeometry args={[0.068, 14, 10]} />
              <meshStandardMaterial color={LEATHER} roughness={0.7} />
            </mesh>
          </group>
          <group ref={armR} position={[0.31, 0.55, 0]}>
            <mesh position={[0, -0.12, 0]}>
              <capsuleGeometry args={[0.058, 0.14, 4, 10]} />
              <meshStandardMaterial color={MAIL} roughness={0.85} metalness={0.15} />
            </mesh>
            <mesh position={[0, -0.27, 0]}>
              <sphereGeometry args={[0.068, 14, 10]} />
              <meshStandardMaterial color={LEATHER} roughness={0.7} />
            </mesh>
            <group ref={quill} position={[0, -0.32, 0.05]} rotation-x={0.6} visible={false}>
              <mesh position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.008, 0.004, 0.2, 6]} />
                <meshStandardMaterial color="#F4EEE2" />
              </mesh>
              <mesh position={[0, 0.16, 0]} scale={[0.4, 1, 0.12]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color="#F4EEE2" roughness={0.8} />
              </mesh>
            </group>
          </group>
          {/* neck */}
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.08, 14]} />
            <meshStandardMaterial color={skin} roughness={0.75} />
          </mesh>

          {/* the head */}
          <group ref={head} position={[0, 0.68, 0]}>
            {/* face */}
            <mesh position={[0, 0.28, 0.01]} scale={[1, 0.95, 0.9]}>
              <sphereGeometry args={[0.3, 28, 22]} />
              <meshStandardMaterial color={skin} roughness={0.7} />
            </mesh>
            {/* ears */}
            {[-0.29, 0.29].map((x) => (
              <mesh key={x} position={[x, 0.27, 0]} scale={[0.5, 1, 0.8]}>
                <sphereGeometry args={[0.06, 10, 8]} />
                <meshStandardMaterial color={skin} roughness={0.7} />
              </mesh>
            ))}
            {/* hair peeking out under the helm */}
            <mesh position={[0, 0.44, 0.1]} scale={[1, 0.3, 0.75]}>
              <sphereGeometry args={[0.24, 16, 10]} />
              <meshStandardMaterial color={look.hair} roughness={0.85} />
            </mesh>
            {/* eyes, with a sparkle */}
            <mesh ref={eyeL} position={[-0.1, 0.3, 0.262]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.04, 12, 10]} />
              <meshBasicMaterial color={INK} />
            </mesh>
            <mesh ref={eyeR} position={[0.1, 0.3, 0.262]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.04, 12, 10]} />
              <meshBasicMaterial color={INK} />
            </mesh>
            {[-0.1, 0.1].map((x) => (
              <mesh key={x} position={[x + 0.013, 0.315, 0.283]}>
                <sphereGeometry args={[0.011, 8, 6]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
            ))}
            {[-0.1, 0.1].map((x, i) => (
              <mesh key={x} ref={i === 0 ? happyL : happyR} position={[x, 0.29, 0.268]} visible={false}>
                <torusGeometry args={[0.035, 0.011, 6, 14, Math.PI]} />
                <meshBasicMaterial color={INK} />
              </mesh>
            ))}
            {/* eyebrows */}
            <mesh ref={browL} position={[-0.1, 0.4, 0.262]}>
              <boxGeometry args={[0.07, 0.018, 0.02]} />
              <meshBasicMaterial color={brow} />
            </mesh>
            <mesh ref={browR} position={[0.1, 0.4, 0.262]}>
              <boxGeometry args={[0.07, 0.018, 0.02]} />
              <meshBasicMaterial color={brow} />
            </mesh>
            {/* rosy cheeks */}
            {[-0.17, 0.17].map((x) => (
              <mesh key={x} position={[x, 0.22, 0.235]} rotation-y={x * 1.6}>
                <circleGeometry args={[0.04, 14]} />
                <meshBasicMaterial color="#E8837A" transparent opacity={0.45} depthWrite={false} />
              </mesh>
            ))}
            {/* nose */}
            <mesh position={[0, 0.25, 0.275]}>
              <sphereGeometry args={[0.025, 10, 8]} />
              <meshStandardMaterial color={skin} roughness={0.7} />
            </mesh>
            {/* mouth */}
            <mesh ref={mouthSmile} position={[0, 0.17, 0.262]} rotation-z={Math.PI}>
              <torusGeometry args={[0.035, 0.009, 6, 14, Math.PI]} />
              <meshBasicMaterial color="#7A2E2A" />
            </mesh>
            <mesh ref={mouthFlat} position={[0, 0.16, 0.265]} visible={false}>
              <boxGeometry args={[0.06, 0.012, 0.01]} />
              <meshBasicMaterial color="#7A2E2A" />
            </mesh>
            <mesh ref={mouthO} position={[0, 0.155, 0.265]} visible={false}>
              <torusGeometry args={[0.022, 0.009, 6, 14]} />
              <meshBasicMaterial color="#7A2E2A" />
            </mesh>
            {look.key === "outreach" ? (
              // Rover's beard
              <mesh position={[0, 0.12, 0.17]} scale={[1, 0.75, 0.6]}>
                <sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, Math.PI / 2.2, Math.PI / 2]} />
                <meshStandardMaterial color={look.hair} roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
            ) : null}

            {/* the open-faced steel helm: a shallow cap that sits high, so the face shows */}
            <mesh position={[0, 0.45, -0.03]} scale={[1.04, 0.8, 1.0]}>
              <sphereGeometry args={[0.32, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={STEEL} metalness={0.25} roughness={0.4} side={THREE.DoubleSide} />
            </mesh>
            {/* gold brow band */}
            <mesh position={[0, 0.45, -0.03]} rotation-x={Math.PI / 2} scale={[1.04, 1.0, 1]}>
              <torusGeometry args={[0.32, 0.022, 8, 40]} />
              <meshStandardMaterial color={GOLD} metalness={0.2} roughness={0.4} />
            </mesh>
            {/* small cheek guards, set back so they frame the face */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.31, 0.32, -0.04]} rotation-y={s * 0.3} scale={[0.22, 0.9, 0.8]}>
                <sphereGeometry args={[0.13, 14, 10]} />
                <meshStandardMaterial color={STEEL} metalness={0.25} roughness={0.4} />
              </mesh>
            ))}
            {/* the status jewel on the brow band: its colour is the knight's real status */}
            <mesh position={[0, 0.46, 0.3]}>
              <octahedronGeometry args={[0.045, 0]} />
              <meshStandardMaterial ref={jewel} color={light} emissive={light} emissiveIntensity={0.8} roughness={0.2} />
            </mesh>
            <group position={[0, 0.07, -0.03]}>
              <Crest look={look} />
            </group>
          </group>
        </group>

        {/* label, bubble and the tap-to-decide sign */}
        <Html position={[0, sleeping ? 1.25 : 1.72, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
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

/** Each knight's own crest and kit. Local to the head group. */
function Crest({ look }: { look: RobotLook }) {
  if (look.key === "visibility") {
    // Lumi: a green plume on a gold socket
    return (
      <group>
        {[
          [0, 0.68, -0.05, 0.075],
          [0, 0.76, -0.16, 0.07],
          [0, 0.79, -0.28, 0.06],
          [0, 0.77, -0.39, 0.045],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={[0.75, 1, 1.25]}>
            <sphereGeometry args={[r, 12, 10]} />
            <meshStandardMaterial color={i % 2 ? look.bodyDark : look.body} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.06, 10]} />
          <meshStandardMaterial color={GOLD} metalness={0.2} roughness={0.4} />
        </mesh>
      </group>
    );
  }
  if (look.key === "outreach") {
    // Rover: a crimson plume swept back, a rolled map and a small pennant
    return (
      <group>
        {[
          [0.03, 0.68, -0.06, 0.075],
          [0.08, 0.76, -0.17, 0.07],
          [0.14, 0.8, -0.29, 0.058],
          [0.2, 0.79, -0.4, 0.045],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={[0.75, 1, 1.25]}>
            <sphereGeometry args={[r, 12, 10]} />
            <meshStandardMaterial color={i % 2 ? look.bodyDark : look.body} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, -0.2, -0.36]} rotation-z={Math.PI / 2 - 0.35}>
          <cylinderGeometry args={[0.05, 0.05, 0.56, 12]} />
          <meshStandardMaterial color="#EADBB8" roughness={0.9} />
        </mesh>
        <mesh position={[-0.28, 0.45, -0.34]}>
          <cylinderGeometry args={[0.013, 0.013, 0.75, 6]} />
          <meshStandardMaterial color="#5A3A22" />
        </mesh>
        <mesh position={[-0.17, 0.72, -0.34]}>
          <planeGeometry args={[0.22, 0.15]} />
          <meshStandardMaterial color={GOLD} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  // Echo: a messenger's winged helm and a feather in the band
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.34, 0.42, -0.04]} rotation-z={s * -0.35} rotation-y={s * 0.35}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[s * 0.02, 0.05 + i * 0.065, -0.02 - i * 0.045]} scale={[0.3, 1, 1.6 - i * 0.35]}>
              <sphereGeometry args={[0.07, 12, 8]} />
              <meshStandardMaterial color={i === 1 ? "#E9DFC8" : "#FFFFFF"} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0.12, 0.6, -0.12]} rotation-z={-0.5} rotation-x={-0.4} scale={[0.35, 1, 0.12]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color={look.body} roughness={0.8} />
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
