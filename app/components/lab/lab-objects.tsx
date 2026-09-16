"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { M, createLampMaterial } from "./lab-materials";
import { getObjectFix } from "./lab-object-state";

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
  | "hinge";

export type FixableProps = { id: string };

const DEG = THREE.MathUtils.degToRad;

/**
 * Critically-damped-ish approach; frame-rate independent.
 *
 * Deliberately asymmetric. Mending is the payoff and wants to be seen, so it
 * happens in about a second. Coming undone again is housekeeping the loop needs
 * and nobody should notice, so it takes the better part of ten — slow enough
 * that a handle drooping or a lamp dimming reads as nothing at all unless you
 * are staring straight at it.
 */
const REPAIR_RATE = 4.5;
const DECAY_RATE = 0.3;

function ease(current: number, target: number, dt: number, rate?: number) {
  const r = rate ?? (target >= current ? REPAIR_RATE : DECAY_RATE);
  return current + (target - current) * (1 - Math.exp(-r * Math.min(dt, 0.1)));
}

/* ------------------------------------------------------------------ outlet */

function Outlet({ id }: FixableProps) {
  const plate = useRef<THREE.Group>(null);
  const screw = useRef<THREE.Mesh>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    if (plate.current) plate.current.rotation.z = DEG(9) * (1 - f.current);
    if (screw.current) screw.current.position.z = 0.004 + 0.005 * (1 - f.current);
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
    </group>
  );
}

/* ------------------------------------------------------------- picture frame */

function PictureFrame({ id }: FixableProps) {
  const tilt = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    if (tilt.current) tilt.current.rotation.z = DEG(13) * (1 - f.current);
  });

  const W = 0.3;
  const H = 0.23;
  const T = 0.016;

  return (
    <group>
      <group ref={tilt}>
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
  );
}

/* -------------------------------------------------------------------- shelf */

/** Declared out here: a component defined inside render is remounted each pass. */
function ShelfBracket() {
  return (
    <group>
      <mesh material={M.metal} position={[0, -0.035, 0.005]}>
        <boxGeometry args={[0.014, 0.07, 0.012]} />
      </mesh>
      <mesh material={M.metal} position={[0, -0.006, 0.042]}>
        <boxGeometry args={[0.014, 0.012, 0.075]} />
      </mesh>
    </group>
  );
}

function Shelf({ id }: FixableProps) {
  const board = useRef<THREE.Group>(null);
  const loose = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    // the right end droops, and its bracket has slipped down and out
    if (board.current) board.current.rotation.z = -DEG(7) * broken;
    if (loose.current) {
      loose.current.position.y = -0.055 * broken;
      loose.current.position.z = 0.03 * broken;
      loose.current.rotation.x = DEG(18) * broken;
    }
  });

  const W = 0.56;

  return (
    <group>
      <group ref={board}>
        <mesh material={M.wood} position={[0, 0, 0.055]}>
          <boxGeometry args={[W, 0.03, 0.14]} />
        </mesh>
        <mesh material={M.wood} position={[0, 0.036, 0.055]}>
          <boxGeometry args={[W * 0.35, 0.042, 0.05]} />
        </mesh>
        <group position={[-W * 0.32, -0.015, 0]}>
          <ShelfBracket />
        </group>
        <group ref={loose} position={[W * 0.32, -0.015, 0]}>
          <ShelfBracket />
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- faucet */

function Faucet({ id }: FixableProps) {
  const handle = useRef<THREE.Group>(null);
  const spout = useRef<THREE.Group>(null);
  const drip = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const t = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (handle.current) handle.current.rotation.z = DEG(38) * broken;
    if (spout.current) spout.current.rotation.z = DEG(5) * broken;

    // a drip that falls while it is still leaking, and stops when it is not
    if (drip.current) {
      t.current = (t.current + dt * 0.85) % 1;
      const visible = broken > 0.08;
      drip.current.visible = visible;
      if (visible) {
        drip.current.position.y = 0.035 - t.current * 0.16;
        const s = (1 - t.current * 0.55) * broken;
        drip.current.scale.setScalar(Math.max(0.001, s));
      }
    }
  });

  return (
    <group>
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
        <mesh ref={drip} material={M.accent} position={[0, 0.035, 0.078]}>
          <sphereGeometry args={[0.008, 10, 8]} />
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
    </group>
  );
}

/* ------------------------------------------------------------------ cabinet */

function Cabinet({ id }: FixableProps) {
  const door = useRef<THREE.Group>(null);
  const handle = useRef<THREE.Group>(null);
  const f = useRef(0);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (door.current) door.current.rotation.y = -DEG(15) * broken;
    // the handle hangs off one screw until it is put back
    if (handle.current) {
      handle.current.rotation.z = DEG(74) * broken;
      handle.current.position.y = -0.012 * broken;
    }
  });

  const W = 0.32;
  const H = 0.42;

  return (
    <group>
      <group ref={door} position={[-W / 2, 0, 0]}>
        <group position={[W / 2, 0, 0]}>
          <mesh material={M.shell}>
            <boxGeometry args={[W, H, 0.022]} />
          </mesh>
          {/* inset panel, so it reads as a cabinet door and not a box */}
          <mesh material={M.woodDark} position={[0, 0, 0.012]}>
            <boxGeometry args={[W - 0.06, H - 0.06, 0.004]} />
          </mesh>
          <group ref={handle} position={[W / 2 - 0.05, 0.05, 0.018]}>
            <mesh material={M.hardware} position={[0, -0.045, 0]}>
              <boxGeometry args={[0.012, 0.09, 0.012]} />
            </mesh>
            <mesh material={M.hardware}>
              <cylinderGeometry args={[0.008, 0.008, 0.014, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* --------------------------------------------------------------------- lamp */

function Lamp({ id }: FixableProps) {
  const swing = useRef<THREE.Group>(null);
  const shade = useRef<THREE.Mesh>(null);
  const f = useRef(0);
  const material = useMemo(() => createLampMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    f.current = ease(f.current, getObjectFix(id), dt);
    const broken = 1 - f.current;
    if (swing.current) swing.current.rotation.z = DEG(12) * broken;
    /*
     * The payoff: it comes on. Reached through the mesh rather than the memo
     * so this is a mutation of the scene graph, which is what a frame loop is
     * for, rather than of a value React handed back.
     */
    const lit = shade.current?.material as THREE.MeshStandardMaterial | undefined;
    if (lit) lit.emissiveIntensity = f.current * 1.5;
  });

  return (
    <group>
      {/* ceiling rose, floating like everything else */}
      <mesh material={M.shell} position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.012, 14]} />
      </mesh>
      <group ref={swing} position={[0, 0.2, 0]}>
        <mesh material={M.dark} position={[0, -0.11, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.22, 6]} />
        </mesh>
        <mesh ref={shade} material={material} position={[0, -0.27, 0]}>
          <cylinderGeometry args={[0.055, 0.105, 0.11, 20, 1, true]} />
        </mesh>
        <mesh material={material} position={[0, -0.315, 0]}>
          <sphereGeometry args={[0.032, 12, 10]} />
        </mesh>
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
    if (plate.current) plate.current.rotation.z = DEG(11) * broken;
    /* Down when broken, up when done. The flip IS the payoff. */
    if (toggle.current) toggle.current.rotation.x = DEG(-22) + DEG(44) * f.current;
  });

  return (
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
    if (rail.current) rail.current.rotation.z = DEG(-13) * broken;
    if (loose.current) {
      loose.current.position.y = -0.03 * broken;
      loose.current.rotation.z = DEG(24) * broken;
    }
  });

  const W = 0.44;

  return (
    <group>
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
      leaf.current.rotation.z = DEG(-9) * broken;
      leaf.current.position.y = -0.012 * broken;
    }
    /* And the pin is standing proud until he knocks it back in. */
    if (pin.current) pin.current.position.y = 0.075 + 0.055 * broken;
  });

  const H = 0.17;

  return (
    <group>
      {/* the leaf screwed to the frame, which stays put */}
      <mesh material={M.metal} position={[-0.035, 0, 0]}>
        <boxGeometry args={[0.062, H, 0.009]} />
      </mesh>
      <mesh material={M.hardware} position={[-0.05, 0.045, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.005, 10]} />
      </mesh>
      <mesh material={M.hardware} position={[-0.05, -0.045, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.005, 10]} />
      </mesh>

      {/* the barrel the pin drops through */}
      <mesh material={M.metal}>
        <cylinderGeometry args={[0.019, 0.019, H, 14]} />
      </mesh>

      {/* the leaf on the door, which is the half that has let go */}
      <group ref={leaf}>
        <mesh material={M.metal} position={[0.035, 0, 0]}>
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

const REGISTRY: Record<string, (props: FixableProps) => React.JSX.Element> = {
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
