"use client";
/* eslint-disable react-hooks/immutability -- the camera and canvas textures are three.js objects, mutated in place by design */

/**
 * The little office, in three.js (React Three Fiber). Everything is built
 * from simple shapes and canvas-drawn textures: no models, images or fonts to
 * download, so it opens fast on a phone.
 *
 * The scene is display-only: it draws what GrowthOffice hands it and reports
 * taps (a robot, a desk, the results display, the approvals board).
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeState, RobotKey } from "@/lib/office";
import Robot from "./Robot";
import { PALETTE, ROBOT_LOOKS, ROBOT_ORDER, DESK_YAW, type Vec3 } from "./office-layout";
import { cloudTexture, drawResultsDisplay, plankTexture, skyTexture } from "./textures";
import CameraRig, { SceneChip, type CameraApi } from "./CameraRig";

export type SceneTarget =
  | { type: "robot"; key: RobotKey }
  | { type: "desk"; key: RobotKey }
  | { type: "results" }
  | { type: "approvals"; robot?: RobotKey }
  | { type: "empty" };


export type { CameraApi };

type Props = {
  office: OfficeState;
  selected: RobotKey | null;
  celebrate: boolean;
  reduced: boolean;
  active: boolean;
  /** A panel covers part of the screen: "bottom" on phones, "right" on wide screens. */
  panel: "bottom" | "right" | null;
  cameraApi: MutableRefObject<CameraApi | null>;
  onMoved: (moved: boolean) => void;
  onTap: (t: SceneTarget) => void;
};

function nyHour(d = new Date()) {
  return Number(d.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })) % 24;
}

function nyTime(d = new Date()) {
  const [h, m] = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: false, timeZone: "America/New_York" }).split(":").map(Number);
  return { h: h % 24, m };
}

export default function OfficeScene({ office, selected, celebrate, reduced, active, panel, cameraApi, onMoved, onTap }: Props) {
  const positions = useRef<Partial<Record<RobotKey, Vec3>>>({});
  const dragged = useRef(0);
  const [hour, setHour] = useState(nyHour);
  useEffect(() => {
    const id = window.setInterval(() => setHour(nyHour()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  const night = hour < 6 || hour >= 20;
  const evening = hour >= 17 || hour < 7;

  return (
    <Canvas
      orthographic
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [12, 10.5, 12], zoom: 40, near: 0.1, far: 100 }}
      onPointerMissed={() => {
        document.body.style.cursor = "";
        if (dragged.current < 10) onTap({ type: "empty" });
      }}
      style={{ touchAction: "none" }}
    >
      <CameraRig positions={positions} follow={selected} panel={panel} reduced={reduced} api={cameraApi} dragged={dragged} onMoved={onMoved} />
      <hemisphereLight args={[night ? "#9FB4FF" : "#FFF6E6", night ? "#3A3150" : "#C9B08A", night ? 0.55 : 1.05]} />
      <directionalLight position={[6, 11, 5]} intensity={night ? 0.35 : 1.25} color={evening ? "#FFD2A6" : "#FFFFFF"} />
      <ambientLight intensity={night ? 0.25 : 0.35} />
      {evening
        ? ROBOT_ORDER.map((k) => {
            const d = ROBOT_LOOKS[k].desk;
            return <pointLight key={k} position={[d[0], 1.6, d[2]]} intensity={night ? 3 : 1.6} distance={4.5} color="#FFC27A" />;
          })
        : null}

      <Room hour={hour} night={night} />
      <ResultsDisplay office={office} celebrate={celebrate} onTap={() => onTap({ type: "results" })} />
      <ApprovalsBoard total={office.approvals?.total || 0} onTap={() => onTap({ type: "approvals" })} />
      <SceneChip position={[-1.55, 3.05, -4.85]} label="📊 Results" onClick={() => onTap({ type: "results" })} />
      <SceneChip
        position={[-4.85, 2.75, 0.4]}
        label={`📌 Requests${office.approvals?.total ? ` · ${office.approvals.total}` : ""}`}
        tone={office.approvals?.total ? "ask" : "plain"}
        onClick={() => onTap({ type: "approvals" })}
      />
      <WallClock />
      <Lounge />
      <CoffeeCorner />
      <Plants />

      {ROBOT_ORDER.map((key) => {
        const look = ROBOT_LOOKS[key];
        const state = office.robots.find((r) => r.key === key);
        return (
          <group key={key}>
            <Desk look={look.key} position={look.desk} lit={evening} replies={key === "conversation" ? office.conversationsEnabled : undefined} onTap={() => onTap({ type: "desk", key })} />
            {state ? (
              <Robot
                look={look}
                status={state.status}
                statusText={state.statusText}
                waiting={state.waiting}
                celebrate={celebrate}
                reduced={reduced}
                selected={selected === key}
                registry={positions}
                onSelect={() => onTap({ type: "robot", key })}
                onAsk={() => onTap({ type: "approvals", robot: key })}
              />
            ) : null}
          </group>
        );
      })}
    </Canvas>
  );
}

function tap(fn: () => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta > 10) return; // that was a swipe, not a tap
      fn();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

/* ------------------------------------------------------------------ */

function Room({ hour, night }: { hour: number; night: boolean }) {
  const planks = useMemo(() => plankTexture(PALETTE.floor, PALETTE.floorDark), []);
  const sky = useMemo(() => skyTexture(hour), [hour]);
  const clouds = useMemo(() => cloudTexture(night), [night]);
  useEffect(() => () => planks.dispose(), [planks]);
  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(() => () => clouds.dispose(), [clouds]);
  useFrame((_, dt) => {
    clouds.offset.x = (clouds.offset.x + dt * 0.006) % 1;
  });

  return (
    <group>
      {/* the island the office sits on */}
      <RoundedBox args={[10.9, 0.9, 10.9]} radius={0.25} smoothness={3} position={[0, -0.52, 0]}>
        <meshStandardMaterial color={PALETTE.base} roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, -0.09, 0]}>
        <boxGeometry args={[10.4, 0.12, 10.4]} />
        <meshStandardMaterial color={PALETTE.baseTop} roughness={0.7} />
      </mesh>
      {/* floor */}
      <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial map={planks} roughness={0.75} />
      </mesh>

      {/* walls */}
      <mesh position={[0, 1.75, -5.15]}>
        <boxGeometry args={[10.3, 3.5, 0.3]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={0.9} />
      </mesh>
      <mesh position={[-5.15, 1.75, 0]}>
        <boxGeometry args={[0.3, 3.5, 10.3]} />
        <meshStandardMaterial color={PALETTE.wallShade} roughness={0.9} />
      </mesh>
      {/* skirting and top trim */}
      <mesh position={[0, 0.09, -4.98]}>
        <boxGeometry args={[10, 0.18, 0.05]} />
        <meshStandardMaterial color={PALETTE.trim} />
      </mesh>
      <mesh position={[-4.98, 0.09, 0]}>
        <boxGeometry args={[0.05, 0.18, 10]} />
        <meshStandardMaterial color={PALETTE.trim} />
      </mesh>
      <mesh position={[0, 3.52, -5.15]}>
        <boxGeometry args={[10.4, 0.08, 0.36]} />
        <meshStandardMaterial color={PALETTE.trim} />
      </mesh>
      <mesh position={[-5.15, 3.52, 0]}>
        <boxGeometry args={[0.36, 0.08, 10.4]} />
        <meshStandardMaterial color={PALETTE.trim} />
      </mesh>

      {/* window on the back wall, with the real New York sky */}
      <group position={[3.0, 1.95, -4.99]}>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[2.5, 1.55]} />
          <meshBasicMaterial map={sky} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.05, 0.0]}>
          <planeGeometry args={[2.5, 1.2]} />
          <meshBasicMaterial map={clouds} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        {/* frame */}
        {[
          [0, 0.82, 2.7, 0.1],
          [0, -0.82, 2.7, 0.14],
          [-1.3, 0, 0.1, 1.74],
          [1.3, 0, 0.1, 1.74],
          [0, 0, 0.06, 1.6],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.04]}>
            <boxGeometry args={[w, h, 0.08]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        ))}
        <mesh position={[0, -0.92, 0.12]}>
          <boxGeometry args={[2.8, 0.06, 0.28]} />
          <meshStandardMaterial color={PALETTE.trim} />
        </mesh>
      </group>

      {/* rug in the middle */}
      <mesh position={[0.4, 0.006, 0.9]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.7, 48]} />
        <meshStandardMaterial color={PALETTE.rug} roughness={1} />
      </mesh>
      <mesh position={[0.4, 0.008, 0.9]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.25, 1.4, 48]} />
        <meshStandardMaterial color={PALETTE.rug2} roughness={1} />
      </mesh>
      <WallSign />
    </group>
  );
}

/** "PROFIXTER" on the left wall, drawn once onto a small canvas. */
function WallSign() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = PALETTE.navy;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#3E7BFA";
    g.beginPath();
    g.arc(70, 64, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#FFFFFF";
    g.font = "900 34px system-ui, -apple-system, Segoe UI, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("P", 70, 66);
    g.textAlign = "left";
    g.font = "900 54px system-ui, -apple-system, Segoe UI, sans-serif";
    g.fillText("PROFIXTER", 120, 60);
    g.fillStyle = "#8FB3FF";
    g.font = "700 18px system-ui, sans-serif";
    g.fillText("LONG ISLAND · GROWTH TEAM", 122, 104);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[-4.99, 2.72, 3.0]} rotation-y={Math.PI / 2}>
      <RoundedBox args={[2.1, 0.58, 0.06]} radius={0.1} smoothness={3}>
        <meshStandardMaterial color={PALETTE.navy} />
      </RoundedBox>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[2.0, 0.5]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ResultsDisplay({ office, celebrate, onTap }: { office: OfficeState; celebrate: boolean; onTap: () => void }) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 300;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const f = office.kpis?.firstFreeVisits;
  useEffect(() => {
    drawResultsDisplay(canvas, { last7: f?.last7 ?? null, prev7: f?.prev7 ?? null, last30: f?.last30 ?? null, available: Boolean(f) }, celebrate);
    texture.needsUpdate = true;
  }, [canvas, texture, f, celebrate]);

  return (
    <group position={[-1.55, 1.95, -4.97]} {...tap(onTap)}>
      <RoundedBox args={[2.95, 1.55, 0.12]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color="#1B2238" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0, 0.065]}>
        <planeGeometry args={[2.75, 1.29]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.86, 0.02]}>
        <boxGeometry args={[0.5, 0.18, 0.06]} />
        <meshStandardMaterial color="#1B2238" />
      </mesh>
    </group>
  );
}

function ApprovalsBoard({ total, onTap }: { total: number; onTap: () => void }) {
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (bulb.current) bulb.current.emissiveIntensity = total > 0 ? 1.2 + Math.sin(clock.elapsedTime * 4) * 0.8 : 0.1;
  });
  const notes = Math.min(total, 6);
  const colors = ["#FFF3A6", "#FFD1E0", "#CFF2FF", "#D9FFD6", "#FFE2BF", "#E8DAFF"];
  return (
    <group position={[-4.97, 1.75, 0.4]} rotation-y={Math.PI / 2} {...tap(onTap)}>
      <RoundedBox args={[1.9, 1.3, 0.08]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color="#C99A68" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[1.72, 1.12]} />
        <meshStandardMaterial color="#DDB487" roughness={1} />
      </mesh>
      {Array.from({ length: notes }).map((_, i) => (
        <group key={i} position={[-0.58 + (i % 3) * 0.58, 0.24 - Math.floor(i / 3) * 0.5, 0.06]} rotation-z={((i * 37) % 9 - 4) * 0.03}>
          <mesh>
            <planeGeometry args={[0.42, 0.38]} />
            <meshStandardMaterial color={colors[i]} />
          </mesh>
          <mesh position={[0, 0.15, 0.01]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color="#E2463F" />
          </mesh>
        </group>
      ))}
      {total === 0 ? (
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[0.9, 0.08]} />
          <meshStandardMaterial color="#B98E5E" />
        </mesh>
      ) : null}
      {/* "needs you" lamp */}
      <mesh position={[0.82, 0.72, 0.1]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial ref={bulb} color={total > 0 ? "#FFB21F" : "#8C94A8"} emissive={total > 0 ? "#FFB21F" : "#000000"} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallClock() {
  const hourHand = useRef<THREE.Group>(null);
  const minHand = useRef<THREE.Group>(null);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 1 && last.current >= 0) return;
    last.current = clock.elapsedTime;
    const { h, m } = nyTime();
    if (hourHand.current) hourHand.current.rotation.z = -((h % 12) + m / 60) * (Math.PI / 6);
    if (minHand.current) minHand.current.rotation.z = -m * (Math.PI / 30);
  });
  return (
    <group position={[-4.98, 2.65, -2.6]} rotation-y={Math.PI / 2}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.42, 0.42, 0.08, 36]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <torusGeometry args={[0.42, 0.04, 8, 36]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 6) * 0.33, Math.cos((i * Math.PI) / 6) * 0.33, 0.045]}>
          <circleGeometry args={[i % 3 === 0 ? 0.025 : 0.014, 8]} />
          <meshBasicMaterial color="#1F2A44" />
        </mesh>
      ))}
      <group ref={hourHand} position={[0, 0, 0.05]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.04, 0.2, 0.01]} />
          <meshBasicMaterial color="#1F2A44" />
        </mesh>
      </group>
      <group ref={minHand} position={[0, 0, 0.055]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.025, 0.3, 0.01]} />
          <meshBasicMaterial color="#E5574B" />
        </mesh>
      </group>
    </group>
  );
}


function Lounge() {
  const bags: Array<[Vec3, string]> = [
    [ROBOT_LOOKS.visibility.bed, PALETTE.beanbagA],
    [ROBOT_LOOKS.outreach.bed, PALETTE.beanbagB],
    [ROBOT_LOOKS.conversation.bed, PALETTE.beanbagC],
  ];
  return (
    <group>
      <mesh position={[-3.35, 0.006, -3.0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.75, 40]} />
        <meshStandardMaterial color="#BFD8C9" roughness={1} />
      </mesh>
      {bags.map(([p, c], i) => (
        <mesh key={i} position={[p[0], 0.2, p[2]]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.52, 24, 16]} />
          <meshStandardMaterial color={c} roughness={0.9} />
        </mesh>
      ))}
      {/* a floor lamp */}
      <mesh position={[-4.5, 0.75, -4.5]}>
        <cylinderGeometry args={[0.03, 0.03, 1.5, 8]} />
        <meshStandardMaterial color="#5A4636" />
      </mesh>
      <mesh position={[-4.5, 1.55, -4.5]}>
        <coneGeometry args={[0.3, 0.32, 20, 1, true]} />
        <meshStandardMaterial color="#FFE8B8" emissive="#FFD58A" emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CoffeeCorner() {
  return (
    <group position={[-4.55, 0, 2.2]}>
      <RoundedBox args={[0.8, 0.9, 1.5]} radius={0.06} smoothness={3} position={[0, 0.45, 0]}>
        <meshStandardMaterial color={PALETTE.wood} roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.55, 0.45]} radius={0.08} smoothness={3} position={[0, 1.18, -0.25]}>
        <meshStandardMaterial color="#E5574B" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0.2, 1.04, -0.25]}>
        <cylinderGeometry args={[0.06, 0.05, 0.1, 14]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {[0.25, 0.45].map((z) => (
        <mesh key={z} position={[0.05, 0.96, z]}>
          <cylinderGeometry args={[0.07, 0.06, 0.13, 14]} />
          <meshStandardMaterial color={z > 0.3 ? "#7FB8FF" : "#FFC76B"} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.24, 0.18, 0.44, 18]} />
        <meshStandardMaterial color={PALETTE.pot} roughness={0.7} />
      </mesh>
      {[
        [0, 0.75, 0, 0.36],
        [0.16, 0.62, 0.08, 0.26],
        [-0.15, 0.6, -0.06, 0.27],
        [0.02, 1.0, 0.04, 0.24],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.plantDark : PALETTE.plant} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Plants() {
  return (
    <>
      <Plant position={[4.35, 0, -4.35]} scale={1.2} />
      <Plant position={[-4.3, 0, 4.3]} scale={1.05} />
      <Plant position={[4.4, 0, 4.2]} scale={0.8} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Desk({ look, position, lit, replies, onTap }: { look: RobotKey; position: Vec3; lit: boolean; replies?: boolean; onTap: () => void }) {
  const color = ROBOT_LOOKS[look].body;
  return (
    <group position={position} rotation-y={DESK_YAW} {...tap(onTap)}>
      {/* soft shadow */}
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.9, 1.1]} />
        <meshBasicMaterial color="#3B2A1A" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {/* top */}
      <RoundedBox args={[1.7, 0.1, 0.9]} radius={0.04} smoothness={3} position={[0, 0.72, 0]}>
        <meshStandardMaterial color={PALETTE.desk} roughness={0.6} />
      </RoundedBox>
      {/* front panel in the robot's colour */}
      <RoundedBox args={[1.6, 0.5, 0.06]} radius={0.03} smoothness={3} position={[0, 0.43, 0.4]}>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {[
        [-0.78, -0.38],
        [0.78, -0.38],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]}>
          <cylinderGeometry args={[0.035, 0.035, 0.7, 10]} />
          <meshStandardMaterial color={PALETTE.deskLeg} />
        </mesh>
      ))}
      {/* desk lamp (glows in the evening) */}
      <group position={[0.65, 0.77, -0.25]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.04, 16]} />
          <meshStandardMaterial color="#2C3550" />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.36, 8]} />
          <meshStandardMaterial color="#2C3550" />
        </mesh>
        <mesh position={[0.05, 0.38, 0]} rotation-z={-0.6}>
          <coneGeometry args={[0.1, 0.14, 16, 1, true]} />
          <meshStandardMaterial color="#FFE08A" emissive="#FFC94D" emissiveIntensity={lit ? 1.4 : 0.15} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <DeskProps look={look} replies={replies} />
    </group>
  );
}

function DeskProps({ look, replies }: { look: RobotKey; replies?: boolean }) {
  if (look === "visibility") {
    return (
      <>
        {/* magnifying glass */}
        <group position={[-0.45, 0.79, 0.12]} rotation-x={-Math.PI / 2} rotation-z={0.6}>
          <mesh>
            <torusGeometry args={[0.11, 0.022, 8, 24]} />
            <meshStandardMaterial color="#2C3550" />
          </mesh>
          <mesh>
            <circleGeometry args={[0.1, 24]} />
            <meshStandardMaterial color="#BFE8FF" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.2, 0, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
            <meshStandardMaterial color="#A8703F" />
          </mesh>
        </group>
        {/* a stack of 'pages' */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.1, 0.785 + i * 0.022, 0.15]} rotation-y={i * 0.12}>
            <boxGeometry args={[0.34, 0.018, 0.25]} />
            <meshStandardMaterial color={["#FFFFFF", "#E6F7F1", "#FFF7DA"][i]} />
          </mesh>
        ))}
      </>
    );
  }
  if (look === "outreach") {
    return (
      <>
        {/* globe */}
        <group position={[-0.5, 0.78, 0.05]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.05, 14]} />
            <meshStandardMaterial color="#5A4636" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.16, 22, 16]} />
            <meshStandardMaterial color="#66B7FF" roughness={0.5} />
          </mesh>
          <mesh position={[0.05, 0.27, 0.1]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color="#6FCF8E" roughness={0.6} />
          </mesh>
        </group>
        {/* binoculars */}
        <group position={[0.1, 0.81, 0.18]} rotation-y={0.4}>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.05, 0.05, 0.18, 12]} />
              <meshStandardMaterial color="#2C3550" />
            </mesh>
          ))}
        </group>
        {/* map easel beside the desk */}
        <group position={[1.15, 0, -0.35]} rotation-y={-0.35}>
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, 0.65, 0]} rotation-z={x > 0 ? -0.08 : 0.08}>
              <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
              <meshStandardMaterial color={PALETTE.woodDark} />
            </mesh>
          ))}
          <RoundedBox args={[0.9, 0.7, 0.04]} radius={0.03} smoothness={2} position={[0, 1.15, 0.03]}>
            <meshStandardMaterial color="#FFF7E6" />
          </RoundedBox>
          {/* a stylised Long Island */}
          <mesh position={[0.02, 1.13, 0.06]} rotation-z={0.12} scale={[1, 0.28, 1]}>
            <circleGeometry args={[0.36, 24]} />
            <meshStandardMaterial color="#9BD6A4" />
          </mesh>
          {[
            [-0.22, 1.13],
            [0.02, 1.16],
            [0.2, 1.1],
          ].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.08]}>
              <sphereGeometry args={[0.03, 10, 8]} />
              <meshStandardMaterial color="#E2463F" />
            </mesh>
          ))}
        </group>
      </>
    );
  }
  // conversation: a desk phone whose lamp shows whether live replies are on
  return (
    <>
      <group position={[-0.45, 0.8, 0.1]} rotation-y={0.3}>
        <RoundedBox args={[0.36, 0.1, 0.26]} radius={0.04} smoothness={3}>
          <meshStandardMaterial color="#F7F2FF" />
        </RoundedBox>
        <RoundedBox args={[0.36, 0.07, 0.09]} radius={0.035} smoothness={3} position={[0, 0.08, -0.04]}>
          <meshStandardMaterial color={ROBOT_LOOKS.conversation.bodyDark} />
        </RoundedBox>
        <mesh position={[0.13, 0.06, 0.08]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshStandardMaterial
            color={replies ? "#35E07F" : "#8C94A8"}
            emissive={replies ? "#35E07F" : "#000000"}
            emissiveIntensity={replies ? 1.6 : 0}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* a mug */}
      <mesh position={[0.15, 0.83, 0.2]}>
        <cylinderGeometry args={[0.06, 0.055, 0.12, 14]} />
        <meshStandardMaterial color={ROBOT_LOOKS.conversation.accent} />
      </mesh>
    </>
  );
}
