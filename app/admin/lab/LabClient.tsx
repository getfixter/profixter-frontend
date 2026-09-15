"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath, isAdminUser } from "@/lib/auth-routing";
import {
  MEASURED_WALK_SPEED,
  MOVEMENT_MODES,
  POINT_A,
  POINT_B,
  MESHY_CLIP_NAMES,
  MESHY_MOTIONS,
  resolveClipRoles,
  type MovementMode,
} from "@/app/components/lab/lab-config";
import type {
  SequenceCommand,
  SequenceState,
  ToolOffset,
  TravelCommand,
} from "@/app/components/lab/FixterModel";
import {
  DEFAULT_TOOL_OFFSET,
  OUTLET_REPAIR_JOB,
  SEQUENCE_CLIP_NAMES,
} from "@/app/components/lab/lab-jobs";
import { PHASE_LABELS } from "@/app/components/lab/lab-choreography";
import TelemetryReadout from "@/app/components/lab/TelemetryReadout";
import RetargetDiagnostics from "@/app/components/lab/RetargetDiagnostics";
import LabErrorBoundary from "@/app/components/lab/LabErrorBoundary";

/*
 * The scene is the only thing that pulls three, R3F and drei, and it is loaded
 * lazily with ssr:false. That is not optional: WebGL has no server runtime, and
 * keeping the import behind dynamic() is what stops the 3D stack from landing
 * in any chunk the rest of Admin touches.
 */
const FixterScene = dynamic(
  () => import("@/app/components/lab/FixterScene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-white text-[13px] font-semibold text-slate-400">
        Preparing renderer...
      </div>
    ),
  }
);

type Vec3 = [number, number, number];

const DEFAULT_POSITION: Vec3 = [0, 0, 0];
const DEFAULT_ROTATION: Vec3 = [0, 0, 0];
const AXES = ["X", "Y", "Z"] as const;

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 px-4 py-4">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {hint && <p className="mt-1 text-[12px] leading-snug text-slate-500">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between text-[12px] font-semibold text-slate-600">
        {label}
        <span className="font-mono tabular-nums text-slate-900">
          {value.toFixed(2)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#306EEC] disabled:cursor-not-allowed"
      />
    </label>
  );
}

function Button({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    primary: "border-[#306EEC] bg-[#306EEC] text-white hover:bg-[#2559c4]",
    danger: "border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[38px] flex-1 rounded-lg border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-[13px] font-semibold text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#306EEC]"
      />
    </label>
  );
}

export default function LabClient() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [clipNames, setClipNames] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [stopToken, setStopToken] = useState(0);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Vec3>(DEFAULT_POSITION);
  const [rotationDeg, setRotationDeg] = useState<Vec3>(DEFAULT_ROTATION);

  const [movementMode, setMovementMode] = useState<MovementMode>("animated");
  const [travelSpeed, setTravelSpeed] = useState(MEASURED_WALK_SPEED);
  const [travel, setTravel] = useState<TravelCommand | null>(null);
  const travelTokenRef = useRef(0);

  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [sequenceViewToken, setSequenceViewToken] = useState(0);

  const [sequence, setSequence] = useState<SequenceCommand | null>(null);
  const [sequenceState, setSequenceState] = useState<SequenceState | null>(null);
  const [toolOffset, setToolOffset] = useState<ToolOffset>(DEFAULT_TOOL_OFFSET);
  const sequenceTokenRef = useRef(0);

  const roles = useMemo(() => resolveClipRoles(clipNames), [clipNames]);
  const isTraveling = travel !== null;
  const isSequencing = sequence !== null;
  // The choreography owns the character while it runs; hand controls stand down.
  const manualLocked = isTraveling || isSequencing;
  const isLoaded = clipNames.length > 0;
  const meshyClipCount = clipNames.filter((n) => MESHY_CLIP_NAMES.has(n)).length;
  const activeMotion = MESHY_MOTIONS.find((m) => m.clipName === activeClip);

  /* Admin only. Employees have a workspace; they have no business in here. */
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    if (!isAdminUser(user)) router.replace(getRoleLandingPath(user));
  }, [user, authLoading, router]);

  const handleReady = useCallback((names: string[]) => {
    setClipNames(names);
    // Open on the neutral pose rather than a walk cycle: the first thing to
    // look at is the character standing still.
    setActiveClip(
      (current) => current ?? resolveClipRoles(names).rest ?? names[0] ?? null
    );
  }, []);

  const handleTravelEnd = useCallback(
    (finalPosition: Vec3, yawDeg: number) => {
      setPosition(finalPosition);
      setRotationDeg((current) => [current[0], yawDeg, current[2]]);
      setTravel(null);
      // restpose is a frozen 2-frame pose, not a real idle. It is what the GLB
      // has, and it beats leaving him mid-stride.
      setActiveClip((current) => roles.rest ?? current);
      setIsPlaying(true);
    },
    [roles]
  );

  const startTravel = useCallback((from: Vec3, to: Vec3, loop: boolean) => {
    travelTokenRef.current += 1;
    setPosition(from);
    setTravel({
      token: travelTokenRef.current,
      anchors: loop
        ? [
            { id: "B", position: to },
            { id: "A", position: from },
          ]
        : [{ id: "B", position: to }],
      start: from,
      loop,
    });
  }, []);

  const handleSequenceState = useCallback((state: SequenceState) => {
    setSequenceState(state);
  }, []);

  const playSequence = useCallback(() => {
    sequenceTokenRef.current += 1;
    setTravel(null);
    setSequenceState(null);
    setSequence({
      token: sequenceTokenRef.current,
      job: OUTLET_REPAIR_JOB,
      paused: false,
    });
    // Frame the route rather than leaving the user on the inspection camera.
    setSequenceViewToken((t) => t + 1);
  }, []);

  const toggleSequencePause = useCallback(() => {
    setSequence((current) =>
      current ? { ...current, paused: !current.paused } : current
    );
  }, []);

  const resetSequence = useCallback(() => {
    setSequence(null);
    setSequenceState(null);
    setPosition(DEFAULT_POSITION);
    setRotationDeg(DEFAULT_ROTATION);
  }, []);

  const stopEverything = useCallback(() => {
    setTravel(null);
    setSequence(null);
    setIsPlaying(false);
    setStopToken((token) => token + 1);
  }, []);

  const setAxis = (
    setter: React.Dispatch<React.SetStateAction<Vec3>>,
    axis: number,
    value: number
  ) => {
    setter((current) => {
      const next: Vec3 = [...current];
      next[axis] = value;
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-bold text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdminUser(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-bold text-slate-500">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[15px] font-bold text-slate-900">Fixter Lab</h1>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Experimental
          </span>
        </div>
        <Link
          href="/admin"
          className="text-[13px] font-semibold text-slate-500 hover:text-slate-900"
        >
          Back to Admin
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[48dvh] flex-shrink-0 bg-white lg:h-auto lg:min-h-0 lg:flex-1">
          {/*
            No WebGL capability probe: if the context cannot be created, three
            throws on construction and the boundary below reports it. One code
            path, and it also catches loader failures the probe never would.
          */}
          <LabErrorBoundary>
            <FixterScene
              position={position}
              rotationDeg={rotationDeg}
              scale={scale}
              manualClip={activeClip}
              isPlaying={isPlaying}
              timeScale={timeScale}
              stopToken={stopToken}
              travel={travel}
              movementMode={movementMode}
              travelSpeed={travelSpeed}
              onReady={handleReady}
              onTravelEnd={handleTravelEnd}
              orbitEnabled={orbitEnabled}
              showMarkers={showMarkers}
              pointA={POINT_A}
              pointB={POINT_B}
              resetToken={resetToken}
              sequence={sequence}
              toolOffset={toolOffset}
              onSequenceState={handleSequenceState}
              sequenceViewToken={sequenceViewToken}
              outletAlignment={
                sequenceState?.objectFixed ? 1 : (sequenceState?.workProgress ?? 0)
              }
            />
          </LabErrorBoundary>

          {!isLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-[13px] font-semibold text-slate-400">
                Loading character (6 MB)...
              </p>
            </div>
          )}
        </div>

        <aside className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 bg-white lg:w-[360px] lg:flex-none lg:border-l lg:border-t-0">
          <Section
            title="Job sequence"
            hint="The whole choreography, start to finish. Three.js owns position, facing, timing and the tool; Meshy supplies the body motion."
          >
            <button
              type="button"
              onClick={playSequence}
              disabled={!isLoaded}
              className="min-h-[46px] w-full rounded-lg bg-[#0B1628] px-3 text-[14px] font-bold text-white transition hover:bg-[#16243c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶ Play Outlet Repair Sequence
            </button>

            <div className="flex gap-2">
              <Button onClick={toggleSequencePause} disabled={!sequence}>
                {sequence?.paused ? "Resume" : "Pause"}
              </Button>
              <Button onClick={resetSequence} disabled={!sequence} tone="danger">
                Reset
              </Button>
            </div>

            {sequence && sequenceState && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[13px] font-bold text-slate-800">
                  {PHASE_LABELS[sequenceState.phase]}
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <dt className="text-slate-500">State</dt>
                  <dd className="text-right font-mono font-semibold text-slate-800">
                    {sequenceState.phase}
                  </dd>
                  <dt className="text-slate-500">Tool</dt>
                  <dd className="text-right font-mono font-semibold text-slate-800">
                    {sequenceState.toolEquipped ? "screwdriver" : "stowed"}
                  </dd>
                  <dt className="text-slate-500">Outlet</dt>
                  <dd className="text-right font-mono font-semibold text-slate-800">
                    {sequenceState.objectFixed ? "repaired" : "loose"}
                  </dd>
                </dl>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#0EA96D] transition-[width] duration-300"
                    style={{ width: `${Math.round(sequenceState.workProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <details className="rounded-lg border border-slate-200 p-2.5">
              <summary className="cursor-pointer text-[12px] font-semibold text-slate-600">
                Tool attachment offsets
              </summary>
              <div className="mt-2.5 space-y-2">
                {AXES.map((axis, index) => (
                  <Slider
                    key={`tool-pos-${axis}`}
                    label={`Tool position ${axis}`}
                    value={toolOffset.position[index]}
                    min={-0.15}
                    max={0.15}
                    step={0.002}
                    onChange={(value) =>
                      setToolOffset((current) => {
                        const next: Vec3 = [...current.position];
                        next[index] = value;
                        return { ...current, position: next };
                      })
                    }
                  />
                ))}
                {AXES.map((axis, index) => (
                  <Slider
                    key={`tool-rot-${axis}`}
                    label={`Tool rotation ${axis}`}
                    value={toolOffset.rotationDeg[index]}
                    min={-180}
                    max={180}
                    step={1}
                    suffix="°"
                    onChange={(value) =>
                      setToolOffset((current) => {
                        const next: Vec3 = [...current.rotationDeg];
                        next[index] = value;
                        return { ...current, rotationDeg: next };
                      })
                    }
                  />
                ))}
                <Slider
                  label="Tool scale"
                  value={toolOffset.scale}
                  min={0.3}
                  max={2.5}
                  step={0.05}
                  suffix="x"
                  onChange={(value) =>
                    setToolOffset((current) => ({ ...current, scale: value }))
                  }
                />
                <Button onClick={() => setToolOffset(DEFAULT_TOOL_OFFSET)}>
                  Reset tool offsets
                </Button>
              </div>
            </details>
          </Section>

          <Section
            title="Animation"
            hint={
              isSequencing
                ? "The job sequence owns the clip while it runs."
                : isTraveling
                ? "The travel controller owns the clip while he is moving."
                : meshyClipCount
                  ? `${clipNames.length - meshyClipCount} clips from the GLB, plus ${meshyClipCount} retargeted from Meshy BVH.`
                  : `${clipNames.length} clips found in the GLB.`
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {clipNames.map((name) => {
                /*
                 * The retargeted Meshy clip is marked and given the full row.
                 * It did not come out of the GLB, and while it is an experiment
                 * it should be impossible to confuse with the clips that did.
                 */
                const isExperimental = MESHY_CLIP_NAMES.has(name);
                const isSequenceClip = SEQUENCE_CLIP_NAMES.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={manualLocked}
                    onClick={() => {
                      setActiveClip(name);
                      setIsPlaying(true);
                    }}
                    className={`min-h-[38px] rounded-lg border px-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      isExperimental || isSequenceClip ? "col-span-2" : ""
                    } ${
                      activeClip === name
                        ? isExperimental
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-[#306EEC] bg-[#306EEC] text-white"
                        : isExperimental
                          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : isSequenceClip
                            ? "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {isExperimental ? `⚗ ${name}` : name}
                  </button>
                );
              })}
              {!isLoaded && (
                <p className="col-span-2 text-[12px] text-slate-400">
                  Waiting for the GLB...
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setIsPlaying((playing) => !playing)}
                disabled={manualLocked || !activeClip}
                tone={isPlaying ? "default" : "primary"}
              >
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button onClick={stopEverything} disabled={!isLoaded} tone="danger">
                Stop
              </Button>
            </div>

            <Slider
              label="Animation speed"
              value={timeScale}
              min={0}
              max={2.5}
              step={0.05}
              onChange={setTimeScale}
              suffix="x"
            />

            {activeMotion && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900">
                <p>{activeMotion.note}</p>
                <p className="mt-1.5">
                  Retargeted at load from a Meshy Text-to-Motion BVH with
                  rest-pose compensation, so the two rigs&apos; different bone
                  axes and rest poses are accounted for rather than ignored. Hip
                  translation is transferred and ground-corrected; the character
                  still stands wherever the position sliders put him.
                  Deliberately not wired into the travel sequence yet.
                </p>
                <p className="mt-1.5 font-mono text-[10px] text-amber-700">
                  task {activeMotion.taskId}
                </p>
              </div>
            )}
          </Section>

          <Section
            title="A to B movement test"
            hint="Walking animates the body; the app moves him through the world. Those are two different things, and this is where you can see it."
          >
            <div className="space-y-2">
              {MOVEMENT_MODES.map((mode) => (
                <label
                  key={mode.id}
                  className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition ${
                    movementMode === mode.id
                      ? "border-[#306EEC] bg-blue-50/60"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="movement-mode"
                    checked={movementMode === mode.id}
                    onChange={() => setMovementMode(mode.id)}
                    className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-[#306EEC]"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-slate-800">
                      {mode.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                      {mode.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <Slider
              label="Travel speed"
              value={travelSpeed}
              min={0.1}
              max={3}
              step={0.025}
              onChange={setTravelSpeed}
              suffix=" u/s"
              disabled={movementMode === "rootMotion"}
            />
            <p className="-mt-1 text-[11px] text-slate-400">
              {MEASURED_WALK_SPEED} u/s is measured from the baked root motion
              in walking_2 — the speed the feet were built for.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => startTravel(POINT_A, POINT_B, false)}
                disabled={!isLoaded || isSequencing}
                tone="primary"
              >
                A to B
              </Button>
              <Button
                onClick={() => startTravel(POINT_B, POINT_A, false)}
                disabled={!isLoaded || isSequencing}
              >
                B to A
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => startTravel(POINT_A, POINT_B, true)}
                disabled={!isLoaded || isSequencing}
              >
                Loop A to B
              </Button>
              <Button
                onClick={() => setTravel(null)}
                disabled={!isTraveling}
                tone="danger"
              >
                Stop travel
              </Button>
            </div>
          </Section>

          <Section title="Character">
            <Slider
              label="Scale"
              value={scale}
              min={0.1}
              max={3}
              step={0.05}
              onChange={setScale}
              suffix="x"
            />
            {AXES.map((axis, index) => (
              <Slider
                key={`pos-${axis}`}
                label={`Position ${axis}`}
                value={position[index]}
                min={-5}
                max={5}
                step={0.05}
                onChange={(value) => setAxis(setPosition, index, value)}
                disabled={manualLocked}
              />
            ))}
            {AXES.map((axis, index) => (
              <Slider
                key={`rot-${axis}`}
                label={`Rotation ${axis}`}
                value={rotationDeg[index]}
                min={-180}
                max={180}
                step={1}
                onChange={(value) => setAxis(setRotationDeg, index, value)}
                disabled={manualLocked && axis === "Y"}
                suffix="°"
              />
            ))}
            <Button
              onClick={() => {
                setPosition(DEFAULT_POSITION);
                setRotationDeg(DEFAULT_ROTATION);
                setScale(1);
              }}
              disabled={manualLocked}
            >
              Reset transform
            </Button>
          </Section>

          <Section title="View">
            <Toggle
              label="Orbit controls"
              checked={orbitEnabled}
              onChange={setOrbitEnabled}
            />
            <Toggle
              label="Show A / B markers"
              checked={showMarkers}
              onChange={setShowMarkers}
            />
            <Button onClick={() => setResetToken((token) => token + 1)}>
              Reset camera
            </Button>
          </Section>

          <Section
            title="Retarget diagnostics"
            hint="Numeric proof of the BVH → Fixter bone mapping."
          >
            <RetargetDiagnostics />
          </Section>

          <Section title="Render">
            <TelemetryReadout />
          </Section>
        </aside>
      </div>
    </div>
  );
}
