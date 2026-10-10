"use client";
/* eslint-disable react-hooks/immutability -- the camera is a three.js object, moved in place every frame */

/**
 * The camera: framed to fit any screen, then
 *  - drag with one finger (or the mouse) to look around,
 *  - pinch (or scroll the wheel) to zoom in and out,
 *  - it glides to a robot you select and follows it while its panel is open,
 *    keeping the robot clear of the panel,
 *  - home() glides back to the whole office.
 * Everything eases toward a target, so nothing jumps.
 */
import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { RobotKey } from "@/lib/office";
import type { Vec3 } from "./office-layout";
import styles from "./office.module.css";

export type CameraApi = { home: () => void };

const ISO = new THREE.Vector3(12, 10.5, 12);
const RIGHT = new THREE.Vector3(1, 0, -1).normalize(); // screen-right, on the floor
const UP = new THREE.Vector3(-1, 0, -1).normalize(); // screen-up, on the floor
const SQUASH = 10.5 / ISO.length(); // the floor is foreshortened vertically by this much
const MIN_F = 0.85;
const MAX_F = 2.6;
const LIMIT = 4.2;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function CameraRig({
  positions,
  follow,
  panel,
  reduced,
  api,
  dragged,
  onMoved,
}: {
  positions: MutableRefObject<Partial<Record<RobotKey | "arthur", Vec3>>>;
  follow: RobotKey | "arthur" | null;
  panel: "bottom" | "right" | null;
  reduced: boolean;
  api: MutableRefObject<CameraApi | null>;
  dragged: MutableRefObject<number>;
  onMoved: (moved: boolean) => void;
}) {
  const { camera, size, gl } = useThree();
  const portrait = size.height > size.width * 1.1;
  const baseZoom = portrait ? Math.min(size.width / 8.7, size.height / 12.2) : Math.min(size.width / 14.6, size.height / 11);
  const lookY = portrait ? 0.05 : 0.4;
  const target = useRef({ x: 0, z: 0, f: 1 });
  const current = useRef({ x: 0, z: 0, f: 1 });
  const moved = useRef(false);
  const following = useRef<RobotKey | "arthur" | null>(follow);
  const onMovedRef = useRef(onMoved);
  const baseRef = useRef(baseZoom);

  useEffect(() => {
    onMovedRef.current = onMoved;
    baseRef.current = baseZoom;
  });

  const setMoved = (m: boolean) => {
    if (moved.current === m) return;
    moved.current = m;
    onMovedRef.current(m);
  };
  const setMovedRef = useRef(setMoved);
  useEffect(() => {
    setMovedRef.current = setMoved;
  });

  const goHome = () => {
    following.current = null;
    target.current = { x: 0, z: 0, f: 1 };
    setMovedRef.current(false);
  };

  useEffect(() => {
    api.current = { home: goHome };
    return () => {
      api.current = null;
    };
  });

  // A new selection: follow it. No selection: glide home.
  useEffect(() => {
    following.current = follow;
    if (!follow) goHome();
  }, [follow]);

  // Gestures: one pointer looks around, two pointers pinch; the wheel zooms.
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let sx = 0;
    let sy = 0;
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        sx = e.clientX;
        sy = e.clientY;
        dragged.current = 0;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        dragged.current = 99;
      }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const zoom = baseRef.current * current.current.f;
      if (pts.size === 1) {
        dragged.current = Math.max(dragged.current, Math.hypot(e.clientX - sx, e.clientY - sy));
        if (dragged.current < 6) return; // still a tap
        following.current = null; // the owner is looking around now
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        const t = target.current;
        const nx = clamp(t.x - RIGHT.x * (dx / zoom) + UP.x * (dy / (zoom * SQUASH)), -LIMIT, LIMIT);
        const nz = clamp(t.z - RIGHT.z * (dx / zoom) + UP.z * (dy / (zoom * SQUASH)), -LIMIT, LIMIT);
        target.current = { ...t, x: nx, z: nz };
        current.current = { ...current.current, x: nx, z: nz };
        setMovedRef.current(true);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) {
          const f = clamp(target.current.f * (d / pinch), MIN_F, MAX_F);
          target.current = { ...target.current, f };
          current.current = { ...current.current, f };
          setMovedRef.current(true);
        }
        pinch = d;
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current = { ...target.current, f: clamp(target.current.f * Math.exp(-e.deltaY * 0.0015), MIN_F, MAX_F) };
      setMovedRef.current(true);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, dragged]);

  useFrame((_, delta) => {
    const key = following.current;
    const pos = key ? positions.current[key] : null;
    if (key && pos) {
      const f = portrait ? 1.75 : 1.5;
      const zoom = baseZoom * f;
      let x = pos[0];
      let z = pos[2];
      if (panel === "bottom") {
        const shift = (size.height * 0.19) / (zoom * SQUASH); // keep the knight in the top part of the screen, below the top bar
        x -= UP.x * shift;
        z -= UP.z * shift;
      } else if (panel === "right") {
        const shift = Math.min(230, size.width * 0.17) / zoom; // keep the robot left of the panel
        x += RIGHT.x * shift;
        z += RIGHT.z * shift;
      }
      target.current = { x, z, f };
      setMoved(true);
    }
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 6);
    const c = current.current;
    const t = target.current;
    const n = { x: c.x + (t.x - c.x) * k, z: c.z + (t.z - c.z) * k, f: c.f + (t.f - c.f) * k };
    current.current = n;
    const cam = camera as THREE.OrthographicCamera;
    cam.position.set(ISO.x + n.x, ISO.y, ISO.z + n.z);
    cam.lookAt(n.x, lookY, n.z);
    const zoom = baseZoom * n.f;
    if (Math.abs(cam.zoom - zoom) > 1e-4) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** A tappable label floating over something in the room. */
export function SceneChip({
  position,
  label,
  onClick,
  tone = "plain",
  wideOnly = false,
}: {
  position: Vec3;
  label: string;
  onClick: () => void;
  tone?: "plain" | "ask";
  /** Hidden on phones (where the dock already has the same button). */
  wideOnly?: boolean;
}) {
  return (
    <Html position={position} center zIndexRange={[15, 0]}>
      <button
        type="button"
        className={`${styles.sceneChip} ${tone === "ask" ? styles.sceneChipAsk : ""} ${wideOnly ? styles.wideOnly : ""}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {label}
      </button>
    </Html>
  );
}
