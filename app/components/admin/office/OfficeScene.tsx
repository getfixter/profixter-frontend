"use client";
/* eslint-disable react-hooks/immutability -- three.js objects (camera, textures, materials) are mutated in place by design */

/**
 * Profixter HQ: a little knight-order guild hall, in three.js (React Three
 * Fiber). Warm limestone, arched windows with New York's real sky, royal
 * banners, a crackling hearth, a round command table with a holographic map
 * of Long Island, and a station for each knight. Everything is built from
 * simple shapes and canvas-drawn textures: no models, images or fonts to
 * download, so it opens fast on a phone.
 *
 * The scene is display-only: it draws what GrowthOffice hands it and reports
 * taps (a knight, a station, the results tapestry, the decree board).
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { PerformanceMonitor, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeState, RobotKey } from "@/lib/office";
import Robot from "./Robot";
import { PALETTE, ROBOT_LOOKS, ROBOT_ORDER, DESK_YAW, type Vec3 } from "./office-layout";
import { drawResultsDisplay, cloudTexture } from "./textures";
import { archSkyTexture, ashlarTexture, bannerTexture, beamTexture, flagstoneTexture, mapTexture, rugTexture } from "./hallTextures";
import CameraRig, { SceneChip, type CameraApi } from "./CameraRig";

export type { CameraApi };

export type SceneTarget =
  | { type: "robot"; key: RobotKey }
  | { type: "desk"; key: RobotKey }
  | { type: "results" }
  | { type: "approvals"; robot?: RobotKey }
  | { type: "empty" };

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

/* Where the big pieces stand. */
const TAPESTRY_X = -1.85;
const WINDOWS_X = [1.45, 3.65];
const HEARTH_Z = -2.75;
const BOARD_Z = -0.75;
const TABLE: Vec3 = [-0.9, 0, -1.2];

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
  const total = office.approvals?.total || 0;
  // Phones that cannot keep up get a lower resolution automatically (and it comes back when they can).
  const [dpr, setDpr] = useState(1.6);

  return (
    <Canvas
      orthographic
      dpr={dpr}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [12, 10.5, 12], zoom: 40, near: 0.1, far: 100 }}
      onPointerMissed={() => {
        document.body.style.cursor = "";
        if (dragged.current < 10) onTap({ type: "empty" });
      }}
      style={{ touchAction: "none" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.6)} flipflops={3} onFallback={() => setDpr(1)} />
      <CameraRig positions={positions} follow={selected} panel={panel} reduced={reduced} api={cameraApi} dragged={dragged} onMoved={onMoved} />
      {/* warm, period light: sunlight through the windows by day, candles and the hearth by night */}
      <hemisphereLight args={[night ? "#6B5A7A" : "#FFE6C2", night ? "#2A1A12" : "#8A5E3A", night ? 0.45 : 0.95]} />
      <directionalLight position={[7, 11, 4]} intensity={night ? 0.22 : 1.1} color={evening ? "#FFB774" : "#FFE2B0"} />
      <ambientLight intensity={night ? 0.2 : 0.28} color="#FFE3C0" />
      <Candelabra position={[TABLE[0] + 1.25, 0, TABLE[2] - 0.95]} night={night} reduced={reduced} />
      {evening
        ? ROBOT_ORDER.map((k) => {
            const d = ROBOT_LOOKS[k].desk;
            return <pointLight key={k} position={[d[0], 1.5, d[2]]} intensity={night ? 2.6 : 1.3} distance={4.2} color="#FFC27A" />;
          })
        : null}

      <Hall hour={hour} night={night} reduced={reduced} />
      <Hearth reduced={reduced} night={night} />
      <ResultsTapestry office={office} celebrate={celebrate} onTap={() => onTap({ type: "results" })} />
      <DecreeBoard total={total} onTap={() => onTap({ type: "approvals" })} />
      <SceneChip position={[TAPESTRY_X, 3.2, -4.85]} label="📊 Results" onClick={() => onTap({ type: "results" })} />
      <SceneChip
        position={[-4.85, 2.5, BOARD_Z]}
        label={`📜 Requests${total ? ` · ${total}` : ""}`}
        tone={total ? "ask" : "plain"}
        wideOnly
        onClick={() => onTap({ type: "approvals" })}
      />
      <WallClock />
      <CommandTable reduced={reduced} />
      <RestingCushions />
      <Bookcase />
      <Sideboard />
      <ArmorStand />
      <Topiary position={[4.4, 0, 4.25]} />
      <Topiary position={[4.45, 0, 0.6]} scale={0.8} />

      {ROBOT_ORDER.map((key) => {
        const look = ROBOT_LOOKS[key];
        const state = office.robots.find((r) => r.key === key);
        return (
          <group key={key}>
            <Station look={look.key} position={look.desk} lit={evening} replies={key === "conversation" ? office.conversationsEnabled : undefined} reduced={reduced} onTap={() => onTap({ type: "desk", key })} />
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

function useTexture<T extends THREE.Texture>(make: () => T, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useMemo(make, deps);
  useEffect(() => () => t.dispose(), [t]);
  return t;
}

/* ------------------------------------------------------------------ */
/* The hall                                                            */
/* ------------------------------------------------------------------ */

/** A pointed (gothic) arch outline, width w, height h, base at y = 0. */
function archPath<T extends THREE.Path>(w: number, h: number, path: T): T {
  path.moveTo(-w / 2, 0);
  path.lineTo(-w / 2, 0.61 * h);
  path.quadraticCurveTo(-w / 2, 0.92 * h, 0, h);
  path.quadraticCurveTo(w / 2, 0.92 * h, w / 2, 0.61 * h);
  path.lineTo(w / 2, 0);
  path.closePath();
  return path;
}

function ArchFrame({ w, h, depth = 0.14, color = PALETTE.stone, border = 0.14 }: { w: number; h: number; depth?: number; color?: string; border?: number }) {
  const geom = useMemo(() => {
    const outer = archPath(w + border * 2, h + border * 1.4, new THREE.Shape());
    outer.holes.push(archPath(w, h, new THREE.Path()));
    const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 18 });
    g.translate(0, -border * 0.2, 0);
    return g;
  }, [w, h, depth, border]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Hall({ hour, night, reduced }: { hour: number; night: boolean; reduced: boolean }) {
  const floor = useTexture(flagstoneTexture);
  const wallBack = useTexture(() => ashlarTexture("#EDE2CE"));
  const wallLeft = useTexture(() => ashlarTexture("#E6D9C2"));
  const sky = useTexture(() => archSkyTexture(hour), [hour]);
  const clouds = useTexture(() => cloudTexture(night), [night]);
  const banner = useTexture(() => bannerTexture());
  const beam = useTexture(beamTexture);
  const rug = useTexture(rugTexture);
  const bannerRefs = useRef<Array<THREE.Mesh | null>>([]);
  const motes = useRef<THREE.Points>(null);
  const moteGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 36;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = 1.0 + ((i * 37) % 100) / 30;
      p[i * 3 + 1] = 0.4 + ((i * 53) % 100) / 45;
      p[i * 3 + 2] = -4.4 + ((i * 71) % 100) / 45;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useEffect(() => () => moteGeo.dispose(), [moteGeo]);
  const day = !night;

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    clouds.offset.x = (clouds.offset.x + dt * 0.006) % 1;
    if (reduced) return;
    bannerRefs.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(t * 0.8 + i * 1.7) * 0.03;
    });
    if (motes.current) {
      motes.current.rotation.y = Math.sin(t * 0.05) * 0.06;
      motes.current.position.y = Math.sin(t * 0.3) * 0.08;
    }
  });

  return (
    <group>
      {/* the island the hall stands on */}
      <RoundedBox args={[10.9, 0.9, 10.9]} radius={0.25} smoothness={3} position={[0, -0.52, 0]}>
        <meshStandardMaterial color="#3A2C22" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, -0.09, 0]}>
        <boxGeometry args={[10.4, 0.12, 10.4]} />
        <meshStandardMaterial color="#6E5A45" roughness={0.9} />
      </mesh>
      {/* flagstone floor */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial map={floor} roughness={0.85} />
      </mesh>

      {/* stone walls */}
      <mesh position={[0, 1.8, -5.15]}>
        <boxGeometry args={[10.3, 3.6, 0.3]} />
        <meshStandardMaterial map={wallBack} roughness={0.92} />
      </mesh>
      <mesh position={[-5.15, 1.8, 0]}>
        <boxGeometry args={[0.3, 3.6, 10.3]} />
        <meshStandardMaterial map={wallLeft} roughness={0.92} />
      </mesh>
      {/* oak beams along the top, plinths along the bottom */}
      {[
        [0, 3.55, -5.0, 10.2, 0.22, 0.36],
        [-5.0, 3.55, 0, 0.36, 0.22, 10.2],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={PALETTE.oakDark} roughness={0.8} />
        </mesh>
      ))}
      {[
        [0, 0.1, -4.97, 10, 0.2, 0.08],
        [-4.97, 0.1, 0, 0.08, 0.2, 10],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={PALETTE.stoneDark} roughness={0.9} />
        </mesh>
      ))}
      {/* stone pilasters */}
      {[
        [0.55, -4.92],
        [4.85, -4.92],
        [-4.92, 0.4],
        [-4.92, 4.85],
        [-4.92, -4.85],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.7, 0]}>
            <boxGeometry args={[0.32, 3.4, 0.32]} />
            <meshStandardMaterial color={PALETTE.stone} roughness={0.85} />
          </mesh>
          <mesh position={[0, 3.36, 0]}>
            <boxGeometry args={[0.44, 0.14, 0.44]} />
            <meshStandardMaterial color={PALETTE.stoneDark} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* arched windows with the real New York sky */}
      {WINDOWS_X.map((x) => (
        <group key={x} position={[x, 0.95, -4.99]}>
          <mesh position={[0, 1.0, 0.012]}>
            <planeGeometry args={[1.15, 2.0]} />
            <meshBasicMaterial map={sky} transparent alphaTest={0.5} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.05, 0.018]}>
            <planeGeometry args={[1.15, 0.9]} />
            <meshBasicMaterial map={clouds} transparent depthWrite={false} toneMapped={false} opacity={0.9} />
          </mesh>
          <group position={[0, 0, 0]}>
            <ArchFrame w={1.15} h={2.0} />
          </group>
          {/* lead mullions */}
          <mesh position={[0, 1.0, 0.03]}>
            <boxGeometry args={[0.04, 2.0, 0.03]} />
            <meshStandardMaterial color="#5B5F6E" />
          </mesh>
          <mesh position={[0, 0.9, 0.03]}>
            <boxGeometry args={[1.15, 0.04, 0.03]} />
            <meshStandardMaterial color="#5B5F6E" />
          </mesh>
          {/* stone sill */}
          <mesh position={[0, -0.06, 0.16]}>
            <boxGeometry args={[1.5, 0.1, 0.36]} />
            <meshStandardMaterial color={PALETTE.stoneDark} roughness={0.85} />
          </mesh>
          {/* the sunbeam falling into the hall */}
          {day ? (
            <mesh position={[0.25, -0.15, 1.15]} rotation={[-0.95, 0, -0.08]} renderOrder={3}>
              <planeGeometry args={[1.0, 2.6]} />
              <meshBasicMaterial map={beam} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
          ) : null}
        </group>
      ))}
      {day ? (
        <points ref={motes} geometry={moteGeo}>
          <pointsMaterial size={0.05} color="#FFF3D0" transparent opacity={0.75} depthWrite={false} />
        </points>
      ) : null}

      {/* royal banners */}
      {[
        [-3.85, -4.96, 0],
        [0.55, -4.75, 0],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 3.35, z]}>
          <mesh position={[0, 0.02, 0.02]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.03, 0.03, 0.95, 8]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.25} roughness={0.35} />
          </mesh>
          <mesh ref={(m) => (bannerRefs.current[i] = m)} position={[0, -0.8, 0.04]}>
            <planeGeometry args={[0.8, 1.6]} />
            <meshStandardMaterial map={banner} transparent alphaTest={0.4} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* candle sconces between the windows */}
      {[
        [2.55, 2.1, -4.92],
        [-0.25, 2.1, -4.92],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[0.12, 0.22, 0.08]} />
            <meshStandardMaterial color={PALETTE.goldDark} metalness={0.25} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.17, 0.12]}>
            <cylinderGeometry args={[0.035, 0.035, 0.14, 10]} />
            <meshStandardMaterial color="#FFF8E7" />
          </mesh>
          <Flame position={[0, 0.28, 0.12]} scale={0.6} reduced={reduced} phase={i} />
        </group>
      ))}

      {/* the round rug under the command table */}
      <mesh position={[TABLE[0], 0.006, TABLE[2]]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.75, 48]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      {/* the emblem shield on the left wall */}
      <group position={[-4.98, 2.55, 3.55]} rotation-y={Math.PI / 2}>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[1.0, 2.0]} />
          <meshStandardMaterial map={banner} transparent alphaTest={0.4} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/** A flickering candle or fire flame (emissive, no light of its own). */
function Flame({ position, scale = 1, reduced, phase = 0 }: { position: Vec3; scale?: number; reduced: boolean; phase?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || reduced) return;
    const t = clock.elapsedTime * 9 + phase * 3;
    const f = 1 + Math.sin(t) * 0.12 + Math.sin(t * 1.7) * 0.08;
    ref.current.scale.set(scale * (2 - f) * 0.5 + scale * 0.5, scale * f, scale * (2 - f) * 0.5 + scale * 0.5);
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <coneGeometry args={[0.06, 0.16, 10]} />
      <meshBasicMaterial color="#FFC861" toneMapped={false} />
    </mesh>
  );
}

function Hearth({ reduced, night }: { reduced: boolean; night: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime;
    light.current.intensity = (night ? 3.2 : 1.6) + (reduced ? 0 : Math.sin(t * 7) * 0.35 + Math.sin(t * 13) * 0.2);
  });
  return (
    <group position={[-4.75, 0, HEARTH_Z]} rotation-y={Math.PI / 2}>
      {/* stone surround */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.8, 1.5, 0.5]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={0.9} />
      </mesh>
      {/* the opening */}
      <mesh position={[0, 0.5, 0.2]}>
        <boxGeometry args={[1.1, 0.9, 0.2]} />
        <meshStandardMaterial color="#2A1C16" roughness={1} />
      </mesh>
      {/* oak mantel */}
      <mesh position={[0, 1.55, 0.08]}>
        <boxGeometry args={[2.0, 0.14, 0.62]} />
        <meshStandardMaterial color={PALETTE.oak} roughness={0.7} />
      </mesh>
      {/* logs and flames */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.14, 0.26]} rotation-z={Math.PI / 2} rotation-y={x * 1.2}>
          <cylinderGeometry args={[0.07, 0.07, 0.6, 10]} />
          <meshStandardMaterial color={PALETTE.oakDark} />
        </mesh>
      ))}
      <Flame position={[-0.2, 0.32, 0.28]} scale={1.6} reduced={reduced} phase={0} />
      <Flame position={[0.05, 0.36, 0.3]} scale={2.1} reduced={reduced} phase={1} />
      <Flame position={[0.25, 0.3, 0.27]} scale={1.4} reduced={reduced} phase={2} />
      <pointLight ref={light} position={[0, 0.6, 0.9]} color={PALETTE.ember} intensity={2} distance={5} />
      {/* candlesticks on the mantel */}
      {[-0.75, 0.75].map((x, i) => (
        <group key={x} position={[x, 1.62, 0.12]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.2, 10]} />
            <meshStandardMaterial color="#FFF8E7" />
          </mesh>
          <Flame position={[0, 0.25, 0]} scale={0.55} reduced={reduced} phase={i + 3} />
        </group>
      ))}
    </group>
  );
}

function ResultsTapestry({ office, celebrate, onTap }: { office: OfficeState; celebrate: boolean; onTap: () => void }) {
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
    <group position={[TAPESTRY_X, 1.95, -4.96]} {...tap(onTap)}>
      {/* oak frame with a gold edge */}
      <RoundedBox args={[3.05, 1.6, 0.1]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color={PALETTE.oakDark} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.055]}>
        <planeGeometry args={[2.85, 1.34]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* gold finials */}
      {[-1.55, 1.55].map((x) => (
        <mesh key={x} position={[x, 0.85, 0.05]}>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function DecreeBoard({ total, onTap }: { total: number; onTap: () => void }) {
  const gem = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (gem.current) gem.current.emissiveIntensity = total > 0 ? 1.2 + Math.sin(clock.elapsedTime * 4) * 0.8 : 0.1;
  });
  const notes = Math.min(total, 6);
  return (
    <group position={[-4.97, 1.6, BOARD_Z]} rotation-y={Math.PI / 2} {...tap(onTap)}>
      <RoundedBox args={[1.8, 1.25, 0.08]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color={PALETTE.oakDark} roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[1.62, 1.07]} />
        <meshStandardMaterial color={PALETTE.oak} roughness={0.9} />
      </mesh>
      {Array.from({ length: notes }).map((_, i) => (
        <group key={i} position={[-0.53 + (i % 3) * 0.53, 0.22 - Math.floor(i / 3) * 0.48, 0.06]} rotation-z={(((i * 37) % 9) - 4) * 0.03}>
          <mesh>
            <planeGeometry args={[0.4, 0.38]} />
            <meshStandardMaterial color={PALETTE.parchment} roughness={0.95} />
          </mesh>
          {/* the red wax seal */}
          <mesh position={[0, -0.12, 0.01]}>
            <circleGeometry args={[0.055, 16]} />
            <meshStandardMaterial color="#B3262E" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {total === 0 ? (
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[0.8, 0.06]} />
          <meshStandardMaterial color={PALETTE.oakDark} />
        </mesh>
      ) : null}
      {/* the "needs you" gem */}
      <mesh position={[0, 0.72, 0.08]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial ref={gem} color={total > 0 ? "#FFB21F" : "#8C94A8"} emissive={total > 0 ? "#FFB21F" : "#000000"} toneMapped={false} />
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
    <group position={[-4.98, 2.55, HEARTH_Z]} rotation-y={Math.PI / 2}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.4, 0.4, 0.08, 36]} />
        <meshStandardMaterial color={PALETTE.parchment} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <torusGeometry args={[0.4, 0.045, 8, 36]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.3} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 6) * 0.31, Math.cos((i * Math.PI) / 6) * 0.31, 0.045]}>
          <circleGeometry args={[i % 3 === 0 ? 0.025 : 0.014, 8]} />
          <meshBasicMaterial color="#3A2A1A" />
        </mesh>
      ))}
      <group ref={hourHand} position={[0, 0, 0.05]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.04, 0.2, 0.01]} />
          <meshBasicMaterial color="#3A2A1A" />
        </mesh>
      </group>
      <group ref={minHand} position={[0, 0, 0.055]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.025, 0.28, 0.01]} />
          <meshBasicMaterial color={PALETTE.royal} />
        </mesh>
      </group>
    </group>
  );
}

/** The round war table: a parchment map of Long Island, painted figurines and candles. */
function CommandTable({ reduced }: { reduced: boolean }) {
  const map = useTexture(mapTexture);
  const figures = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (figures.current && !reduced) figures.current.children.forEach((c, i) => (c.position.y = 0.82 + Math.max(0, Math.sin(clock.elapsedTime * 0.8 + i * 2.1)) * 0.015));
  });
  const fig: Array<[number, number, string]> = [
    [-0.32, 0.05, ROBOT_LOOKS.visibility.body],
    [0.05, -0.1, ROBOT_LOOKS.outreach.body],
    [0.38, 0.08, ROBOT_LOOKS.conversation.body],
  ];
  return (
    <group position={TABLE}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.35, 0.45, 0.12, 20]} />
        <meshStandardMaterial color={PALETTE.oakDark} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.6, 14]} />
        <meshStandardMaterial color={PALETTE.oakDark} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.09, 36]} />
        <meshStandardMaterial color={PALETTE.oak} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.77, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.95, 0.025, 8, 48]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.4} />
      </mesh>
      {/* the map */}
      <mesh position={[0, 0.772, 0]} rotation-x={-Math.PI / 2} rotation-z={0.1}>
        <planeGeometry args={[1.3, 0.81]} />
        <meshStandardMaterial map={map} roughness={0.95} />
      </mesh>
      {/* painted figurines, one for each knight */}
      <group ref={figures}>
        {fig.map(([x, z, c], i) => (
          <group key={i} position={[x, 0.82, z]}>
            <mesh>
              <cylinderGeometry args={[0.035, 0.05, 0.08, 10]} />
              <meshStandardMaterial color={c} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color={PALETTE.gold} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
      {/* two candles */}
      {[
        [-0.62, 0.42],
        [0.6, -0.45],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.77, z]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.04, 14]} />
            <meshStandardMaterial color={PALETTE.goldDark} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.18, 10]} />
            <meshStandardMaterial color="#FFF6E3" />
          </mesh>
          <Flame position={[0, 0.26, 0]} scale={0.6} reduced={reduced} phase={i + 7} />
        </group>
      ))}
    </group>
  );
}

/** A tall iron candelabra beside the war table: the warm evening light of the hall. */
function Candelabra({ position, night, reduced }: { position: Vec3; night: boolean; reduced: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime;
    light.current.intensity = (night ? 2.4 : 0.7) + (reduced ? 0 : Math.sin(t * 9) * 0.12 + Math.sin(t * 5.3) * 0.1);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.08, 14]} />
        <meshStandardMaterial color="#2E2A28" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
        <meshStandardMaterial color="#2E2A28" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.45, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#2E2A28" roughness={0.6} />
      </mesh>
      {[-0.28, 0, 0.28].map((x, i) => (
        <group key={x} position={[x, 1.48, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.16, 10]} />
            <meshStandardMaterial color="#FFF6E3" />
          </mesh>
          <Flame position={[0, 0.21, 0]} scale={0.55} reduced={reduced} phase={i + 11} />
        </group>
      ))}
      <pointLight ref={light} position={[0, 1.8, 0]} color="#FFB45C" distance={6} intensity={1} />
    </group>
  );
}

function RestingCushions() {
  const colors = ["#3E7D4F", "#A8322D", "#5E3C8C"]; // each knight rests on its own colours
  const beds = ROBOT_ORDER.map((k) => ROBOT_LOOKS[k].bed);
  return (
    <group>
      {/* a soft fur rug in front of the hearth */}
      <mesh position={[-3.45, 0.008, -2.85]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.55, 40]} />
        <meshStandardMaterial color="#EFE6D8" roughness={1} />
      </mesh>
      {beds.map((p, i) => (
        <group key={i} position={[p[0], 0, p[2]]}>
          <RoundedBox args={[0.95, 0.2, 0.95]} radius={0.09} smoothness={3} position={[0, 0.1, 0]}>
            <meshStandardMaterial color={colors[i]} roughness={0.9} />
          </RoundedBox>
          {/* gold tassels */}
          {[
            [-0.45, -0.45],
            [0.45, -0.45],
            [-0.45, 0.45],
            [0.45, 0.45],
          ].map(([x, z], j) => (
            <mesh key={j} position={[x, 0.12, z]}>
              <sphereGeometry args={[0.04, 8, 6]} />
              <meshStandardMaterial color={PALETTE.gold} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Bookcase() {
  const bookColors = ["#2F5BEA", "#B3262E", "#3F8F5A", "#E8C15A", "#6B4AA8", "#C27A3A", "#2C7A8A"];
  return (
    <group position={[-4.7, 0, 1.95]} rotation-y={Math.PI / 2}>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[1.3, 2.3, 0.42]} />
        <meshStandardMaterial color={PALETTE.oakDark} roughness={0.75} />
      </mesh>
      {[0.35, 0.95, 1.55].map((y, row) => (
        <group key={y}>
          <mesh position={[0, y - 0.06, 0.08]}>
            <boxGeometry args={[1.18, 0.04, 0.3]} />
            <meshStandardMaterial color={PALETTE.oak} />
          </mesh>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i} position={[-0.48 + i * 0.16, y + 0.15, 0.1]} rotation-z={i === 5 ? 0.18 : 0}>
              <boxGeometry args={[0.12, 0.38 - ((i + row) % 3) * 0.05, 0.24]} />
              <meshStandardMaterial color={bookColors[(i + row * 2) % bookColors.length]} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      {/* a brass hourglass on top */}
      <group position={[0.35, 2.3, 0.05]}>
        {[0, 0.26].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.03, 12]} />
            <meshStandardMaterial color={PALETTE.goldDark} metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.07, 0.015, 0.12, 12]} />
          <meshStandardMaterial color="#F2E6C8" transparent opacity={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Sideboard() {
  return (
    <group position={[-4.55, 0, 3.55]}>
      <RoundedBox args={[0.8, 0.85, 1.5]} radius={0.05} smoothness={3} position={[0, 0.43, 0]}>
        <meshStandardMaterial color={PALETTE.oak} roughness={0.7} />
      </RoundedBox>
      {/* a teapot and goblets */}
      <mesh position={[0.05, 1.0, -0.3]}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshStandardMaterial color="#F4EFE6" roughness={0.3} />
      </mesh>
      <mesh position={[0.05, 1.15, -0.3]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.25} />
      </mesh>
      {[0.15, 0.4].map((z) => (
        <group key={z} position={[0.05, 0.86, z]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.025, 0.05, 0.12, 10]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.06, 0.03, 0.1, 12]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A ceremonial suit of armour on a stand - decoration, no weapons. */
function ArmorStand() {
  return (
    <group position={[4.3, 0, -4.3]} rotation-y={-Math.PI / 4}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.12, 16]} />
        <meshStandardMaterial color={PALETTE.oakDark} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
        <meshStandardMaterial color={PALETTE.oakDark} />
      </mesh>
      <RoundedBox args={[0.6, 0.6, 0.38]} radius={0.15} smoothness={3} position={[0, 1.2, 0]}>
        <meshStandardMaterial color={PALETTE.steel} metalness={0.3} roughness={0.28} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.48, 0.48]} radius={0.2} smoothness={3} position={[0, 1.72, 0]}>
        <meshStandardMaterial color={PALETTE.steel} metalness={0.3} roughness={0.28} />
      </RoundedBox>
      <mesh position={[0, 1.72, 0.245]}>
        <boxGeometry args={[0.32, 0.05, 0.02]} />
        <meshStandardMaterial color="#2A2F4A" />
      </mesh>
      <mesh position={[0, 2.02, -0.05]} rotation-x={-0.5}>
        <coneGeometry args={[0.07, 0.3, 10]} />
        <meshStandardMaterial color={PALETTE.royal} />
      </mesh>
      {/* a small heraldic shield leaning on the stand */}
      <group position={[0.42, 0.42, 0.18]} rotation-y={0.4}>
        <mesh>
          <boxGeometry args={[0.36, 0.5, 0.04]} />
          <meshStandardMaterial color={PALETTE.royal} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <boxGeometry args={[0.06, 0.4, 0.01]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function Topiary({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.26, 0.2, 0.44, 8]} />
        <meshStandardMaterial color={PALETTE.stone} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
        <meshStandardMaterial color={PALETTE.oakDark} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial color={PALETTE.plant} roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* The knights' stations                                               */
/* ------------------------------------------------------------------ */

function Station({
  look,
  position,
  lit,
  replies,
  reduced,
  onTap,
}: {
  look: RobotKey;
  position: Vec3;
  lit: boolean;
  replies?: boolean;
  reduced: boolean;
  onTap: () => void;
}) {
  const color = ROBOT_LOOKS[look].body;
  return (
    <group position={position} rotation-y={DESK_YAW} {...tap(onTap)}>
      <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.9, 1.1]} />
        <meshBasicMaterial color="#3B2A1A" transparent opacity={0.13} depthWrite={false} />
      </mesh>
      {/* oak desk */}
      <RoundedBox args={[1.7, 0.1, 0.9]} radius={0.04} smoothness={3} position={[0, 0.72, 0]}>
        <meshStandardMaterial color={PALETTE.oak} roughness={0.6} />
      </RoundedBox>
      {[
        [-0.75, -0.36],
        [0.75, -0.36],
        [-0.75, 0.36],
        [0.75, 0.36],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.34, z]}>
          <boxGeometry args={[0.08, 0.68, 0.08]} />
          <meshStandardMaterial color={PALETTE.oakDark} />
        </mesh>
      ))}
      {/* the knight's colours hang from the front */}
      <mesh position={[0, 0.5, 0.46]}>
        <boxGeometry args={[1.5, 0.42, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.69, 0.475]}>
        <boxGeometry args={[1.52, 0.05, 0.02]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.4} roughness={0.4} />
      </mesh>
      {[-0.45, 0, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.27, 0.465]} rotation-z={Math.PI / 4}>
          <boxGeometry args={[0.12, 0.12, 0.02]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      {/* a lantern (glows in the evening) */}
      <group position={[0.68, 0.77, -0.28]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.14, 0.2, 0.14]} />
          <meshStandardMaterial color="#FFE6A8" emissive="#FFB648" emissiveIntensity={lit ? 1.7 : 0.9} transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <coneGeometry args={[0.1, 0.08, 4]} />
          <meshStandardMaterial color={PALETTE.goldDark} metalness={0.25} />
        </mesh>
      </group>
      <StationProps look={look} replies={replies} reduced={reduced} />
    </group>
  );
}

function StationProps({ look, replies, reduced }: { look: RobotKey; replies?: boolean; reduced: boolean }) {
  const crystal = useRef<THREE.MeshStandardMaterial>(null);
  const flag = useRef<THREE.Mesh>(null);
  const map = useMemo(() => (look === "outreach" ? mapTexture() : null), [look]);
  useEffect(() => () => map?.dispose(), [map]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystal.current) crystal.current.emissiveIntensity = 1.1 + (reduced ? 0 : Math.sin(t * 2) * 0.5);
    if (flag.current && !reduced) flag.current.rotation.y = Math.sin(t * 1.6) * 0.18;
  });

  if (look === "visibility") {
    // Lumi's library desk: books, an open tome, an inkwell and a candle
    return (
      <>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.5, 0.8 + i * 0.07, -0.05]} rotation-y={i * 0.15}>
            <boxGeometry args={[0.36, 0.06, 0.26]} />
            <meshStandardMaterial color={["#2F5BEA", "#B3262E", "#3F8F5A"][i]} roughness={0.7} />
          </mesh>
        ))}
        <group position={[0.05, 0.79, 0.12]} rotation-y={0.1}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.13, 0.01, 0]} rotation-z={s * -0.12}>
              <boxGeometry args={[0.26, 0.02, 0.32]} />
              <meshStandardMaterial color={PALETTE.parchment} roughness={0.95} />
            </mesh>
          ))}
        </group>
        {/* an inkwell with a quill, and a candle */}
        <group position={[0.36, 0.77, 0.12]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.08, 12]} />
            <meshStandardMaterial color="#1E1A18" roughness={0.3} />
          </mesh>
          <mesh position={[0.02, 0.16, 0]} rotation-z={-0.35}>
            <cylinderGeometry args={[0.006, 0.006, 0.22, 6]} />
            <meshStandardMaterial color="#F4EEE2" />
          </mesh>
          <mesh position={[0.06, 0.25, 0]} rotation-z={-0.35} scale={[0.35, 1, 0.12]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color="#F4EEE2" />
          </mesh>
        </group>
        <group position={[0.4, 0.77, -0.22]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.04, 12]} />
            <meshStandardMaterial color={PALETTE.goldDark} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.18, 10]} />
            <meshStandardMaterial color="#FFF6E3" />
          </mesh>
          <Flame position={[0, 0.25, 0]} scale={0.5} reduced={reduced} phase={4} />
        </group>
      </>
    );
  }
  if (look === "outreach") {
    // Rover's map table: the parchment map, scrolls, a compass and a pennant
    return (
      <>
        <mesh position={[-0.1, 0.775, 0.02]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.0, 0.62]} />
          <meshStandardMaterial map={map} roughness={0.95} />
        </mesh>
        {[
          [0.55, 0.06],
          [0.6, 0.2],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.82, z]} rotation-x={Math.PI / 2} rotation-z={0.3 + i * 0.5}>
            <cylinderGeometry args={[0.04, 0.04, 0.34, 10]} />
            <meshStandardMaterial color={PALETTE.parchment} />
          </mesh>
        ))}
        <mesh position={[0.32, 0.79, -0.25]}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 18]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.3} />
        </mesh>
        {/* banner standard beside the table */}
        <group position={[1.05, 0, -0.35]}>
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.7, 8]} />
            <meshStandardMaterial color={PALETTE.oakDark} />
          </mesh>
          <mesh position={[0, 1.74, 0]}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.3} />
          </mesh>
          <mesh ref={flag} position={[0.22, 1.5, 0]}>
            <planeGeometry args={[0.42, 0.3]} />
            <meshStandardMaterial color={ROBOT_LOOKS.outreach.body} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      </>
    );
  }
  // Echo's messenger desk: letter rack, sealed letters, a brass horn and the
  // messenger's candle - lit only while live replies are switched on.
  return (
    <>
      <group position={[-0.45, 0.77, -0.22]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.55, 0.4, 0.2]} />
          <meshStandardMaterial color={PALETTE.oakDark} />
        </mesh>
        {[0, 1].map((r) =>
          [0, 1, 2].map((c) => (
            <mesh key={`${r}${c}`} position={[-0.17 + c * 0.17, 0.12 + r * 0.17, 0.08]}>
              <boxGeometry args={[0.13, 0.12, 0.06]} />
              <meshStandardMaterial color={(r + c) % 2 ? PALETTE.parchment : "#2A1C16"} />
            </mesh>
          ))
        )}
      </group>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0.05, 0.785 + i * 0.015, 0.18]} rotation-y={0.3 * i}>
          <boxGeometry args={[0.26, 0.012, 0.18]} />
          <meshStandardMaterial color={PALETTE.parchment} />
        </mesh>
      ))}
      <mesh position={[0.05, 0.8, 0.18]}>
        <circleGeometry args={[0.03, 12]} />
        <meshStandardMaterial color="#B3262E" />
      </mesh>
      <mesh position={[0.28, 0.82, 0.05]} rotation-z={Math.PI / 2} rotation-y={0.4}>
        <coneGeometry args={[0.07, 0.3, 14, 1, true]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.3} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0.45, 0.77, -0.2]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.04, 12]} />
          <meshStandardMaterial color={PALETTE.goldDark} metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.16, 10]} />
          <meshStandardMaterial color="#FFF6E3" />
        </mesh>
        {replies ? <Flame position={[0, 0.23, 0]} scale={0.55} reduced={reduced} phase={5} /> : null}
      </group>
    </>
  );
}
