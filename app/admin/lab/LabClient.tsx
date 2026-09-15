"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getRoleLandingPath, isAdminUser } from "@/lib/auth-routing";
import { resolveClipRoles } from "@/app/components/lab/lab-config";
import { JOBS, SEQUENCE_CLIP_NAMES } from "@/app/components/lab/lab-jobs";
import type { LayoutId } from "@/app/components/lab/lab-stage";
import { PHASE_LABELS } from "@/app/components/lab/lab-choreography";
import {
  PAGE_CHARACTER_SCALE,
  PAGE_JOBS,
} from "@/app/components/lab/lab-page-jobs";
import type {
  TourCommand,
  TourState,
  ToolOffset,
} from "@/app/components/lab/FixterModel";
import TelemetryReadout from "@/app/components/lab/TelemetryReadout";
import RetargetDiagnostics from "@/app/components/lab/RetargetDiagnostics";
import LabErrorBoundary from "@/app/components/lab/LabErrorBoundary";

/*
 * The scene is the only thing that pulls three, R3F and drei, and it loads
 * lazily with ssr:false. Not optional: WebGL has no server runtime, and the
 * dynamic boundary is what keeps the 3D stack out of every other chunk.
 */
const FixterScene = dynamic(() => import("@/app/components/lab/FixterScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-white text-[13px] font-semibold text-slate-400">
      Preparing renderer...
    </div>
  ),
});

/* The homepage experiment loads the same way, and only when it is asked for. */
const HomepageScene = dynamic(
  () => import("@/app/components/lab/HomepageScene"),
  { ssr: false, loading: () => null }
);
const LabHomepage = dynamic(() => import("@/app/components/lab/LabHomepage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-[13px] font-semibold text-slate-400">
      Building the page...
    </div>
  ),
});

/** Which experiment the Lab is showing. */
type LabMode = "homepage" | "stage";

type Vec3 = [number, number, number];

const DEFAULT_POSITION: Vec3 = [0, 0, 0];
const DEFAULT_ROTATION: Vec3 = [0, 0, 0];
const DEFAULT_TOOL_OFFSET: ToolOffset = {
  position: [0.012, 0.055, 0.005],
  rotationDeg: [0, 0, 0],
  scale: 1,
};
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
  label, value, min, max, step, onChange, disabled, suffix,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; disabled?: boolean; suffix?: string;
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between text-[12px] font-semibold text-slate-600">
        {label}
        <span className="font-mono tabular-nums text-slate-900">
          {value.toFixed(2)}{suffix}
        </span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#306EEC] disabled:cursor-not-allowed"
      />
    </label>
  );
}

function Button({
  children, onClick, disabled, tone = "default",
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    primary: "border-[#306EEC] bg-[#306EEC] text-white hover:bg-[#2559c4]",
    danger: "border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
  };
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`min-h-[38px] flex-1 rounded-lg border px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Pills<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string }[]; value: T; onChange: (id: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.id} type="button" onClick={() => onChange(option.id)}
          className={`min-h-[34px] flex-1 rounded-md px-2 text-[13px] font-semibold transition ${
            value === option.id ? "bg-white text-[#306EEC] shadow-sm" : "text-slate-500"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A media query as derived state.
 *
 * useSyncExternalStore rather than an effect that mirrors the query into
 * useState: the browser already holds this value, so copying it into React
 * state means a render with the wrong answer followed by a corrective one, and
 * it needs a server snapshot to hydrate cleanly. This is what the hook is for.
 */
function useMediaQuery(query: string, serverValue = false) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
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

  const [scale, setScale] = useState(0.78);
  const [position, setPosition] = useState<Vec3>(DEFAULT_POSITION);
  const [rotationDeg, setRotationDeg] = useState<Vec3>(DEFAULT_ROTATION);
  const [toolOffset, setToolOffset] = useState<ToolOffset>(DEFAULT_TOOL_OFFSET);

  const [tour, setTour] = useState<TourCommand | null>(null);
  const [tourState, setTourState] = useState<TourState | null>(null);
  const tourToken = useRef(0);

  /*
   * Homepage first. The question this phase exists to answer is whether he
   * belongs inside the website, so that is what the Lab opens on; the empty
   * stage stays one click away for comparison.
   */
  const [mode, setMode] = useState<LabMode>("homepage");
  const [layoutOverride, setLayoutOverride] = useState<LayoutId | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [showObjects, setShowObjects] = useState(true);

  /* Staging follows the viewport's shape unless the reviewer picks a preset. */
  const phone = useMediaQuery("(max-width: 759px)");
  const narrow = useMediaQuery("(max-width: 1179px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const layout: LayoutId =
    layoutOverride ?? (phone ? "mobile" : narrow ? "tablet" : "desktop");

  const roles = useMemo(() => resolveClipRoles(clipNames), [clipNames]);
  const isLoaded = clipNames.length > 0;
  const touring = tour !== null;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    if (!isAdminUser(user)) router.replace(getRoleLandingPath(user));
  }, [user, authLoading, router]);

  const startTour = useCallback(() => {
    tourToken.current += 1;
    setTourState(null);
    setTour({ token: tourToken.current, paused: false });
  }, []);

  const autoStarted = useRef(false);
  const handleReady = useCallback(
    (names: string[]) => {
      setClipNames(names);
      setActiveClip(
        (current) => current ?? resolveClipRoles(names).rest ?? names[0] ?? null
      );
      /*
       * Start on its own the moment the clips exist. The point of this page is
       * to watch the thing, not to press a button first. The reduced-motion
       * preference is read here rather than mirrored into state, because this
       * is the only moment it is consulted.
       */
      if (!autoStarted.current) {
        autoStarted.current = true;
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          startTour();
        }
      }
    },
    [startTour]
  );

  const setAxis = (
    setter: React.Dispatch<React.SetStateAction<Vec3>>, axis: number, value: number
  ) => setter((current) => {
    const next: Vec3 = [...current];
    next[axis] = value;
    return next;
  });

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

  /*
   * The homepage experiment.
   *
   * A normal, document-scrolling page — not a pane inside the Lab shell — so
   * that `position: fixed` on the canvas means what it means on a real website
   * and the scroll being tested is the browser's own.
   */
  if (mode === "homepage") {
    return (
      <div className="relative min-h-screen bg-white">
        <LabHomepage />

        <LabErrorBoundary>
          <HomepageScene
            position={position}
            rotationDeg={rotationDeg}
            scale={PAGE_CHARACTER_SCALE[layout]}
            manualClip={activeClip}
            isPlaying={isPlaying}
            timeScale={timeScale}
            stopToken={stopToken}
            tour={tour}
            toolOffset={toolOffset}
            onReady={handleReady}
            onTourState={setTourState}
            layout={layout}
          />
        </LabErrorBoundary>

        {/*
          The only chrome. Above the canvas and the only thing on top of the
          page that accepts a click, so everything the mock page renders stays
          as clickable as it would be in production.
        */}
        <div className="fixed bottom-2 right-2 z-[60] w-[150px] space-y-1.5 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-lg backdrop-blur sm:bottom-3 sm:right-3 sm:w-[228px] sm:space-y-2 sm:p-2.5">
          <div className="hidden items-center justify-between sm:flex">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Fixter Lab
            </span>
            <Link
              href="/admin"
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-900"
            >
              Admin
            </Link>
          </div>

          <Pills
            options={[
              { id: "homepage" as LabMode, label: "Homepage" },
              { id: "stage" as LabMode, label: "Stage" },
            ]}
            value={mode}
            onChange={setMode}
          />
          {/* Hidden on a phone: the viewport has already chosen, and three
              more pills at 150px wide simply overflow. */}
          <div className="hidden sm:block">
            <Pills
              options={[
                { id: "desktop" as LayoutId, label: "Desktop" },
                { id: "tablet" as LayoutId, label: "Tablet" },
                { id: "mobile" as LayoutId, label: "Mobile" },
              ]}
              value={layout}
              onChange={setLayoutOverride}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={startTour} disabled={!isLoaded} tone="primary">
              Restart
            </Button>
            <Button
              onClick={() => setTour((c) => (c ? { ...c, paused: !c.paused } : c))}
              disabled={!touring}
            >
              {tour?.paused ? "Play" : "Pause"}
            </Button>
          </div>

          <p className="text-[11px] leading-snug text-slate-500">
            {tourState ? (
              <>
                <span className="font-semibold text-slate-900">
                  {tourState.jobLabel}
                </span>
                {" · "}
                {PHASE_LABELS[tourState.phase]}
              </>
            ) : (
              `${PAGE_JOBS.length} jobs anchored to page elements`
            )}
          </p>
        </div>
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
        <div className="flex items-center gap-3">
          <div className="w-[190px]">
            <Pills
              options={[
                { id: "homepage" as LabMode, label: "Homepage" },
                { id: "stage" as LabMode, label: "Stage" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
          <Link href="/admin" className="text-[13px] font-semibold text-slate-500 hover:text-slate-900">
            Back to Admin
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[62dvh] flex-shrink-0 bg-white lg:h-auto lg:min-h-0 lg:flex-1">
          <LabErrorBoundary>
            <FixterScene
              position={position}
              rotationDeg={rotationDeg}
              scale={scale}
              manualClip={activeClip}
              isPlaying={isPlaying}
              timeScale={timeScale}
              stopToken={stopToken}
              tour={tour}
              toolOffset={toolOffset}
              onReady={handleReady}
              onTourState={setTourState}
              orbitEnabled={orbitEnabled}
              layout={layout}
              resetToken={resetToken}
              showObjects={showObjects}
            />
          </LabErrorBoundary>

          {!isLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-[13px] font-semibold text-slate-400">
                Loading the Fixter...
              </p>
            </div>
          )}

          {/* A quiet caption over the canvas, so the job reads without the panel */}
          {touring && tourState && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/85 px-3 py-2 backdrop-blur-sm">
              <p className="text-[13px] font-bold text-slate-900">{tourState.jobLabel}</p>
              <p className="text-[11px] font-semibold text-slate-500">
                {PHASE_LABELS[tourState.phase]}
                {tourState.tool !== "stowed" && ` · ${tourState.tool}`}
              </p>
            </div>
          )}
        </div>

        <aside className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 bg-white lg:w-[360px] lg:flex-none lg:border-l lg:border-t-0">
          <Section
            title="The tour"
            hint={`${JOBS.length} jobs on a continuous loop. Three.js owns position, facing, timing, tools and object state; Meshy supplies the body motion.`}
          >
            {reducedMotion && !touring && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[12px] leading-snug text-slate-600">
                Your system asks for reduced motion, so the tour has not started
                on its own. Press play if you want to watch it anyway.
              </p>
            )}

            <button
              type="button"
              onClick={startTour}
              disabled={!isLoaded}
              className="min-h-[46px] w-full rounded-lg bg-[#0B1628] px-3 text-[14px] font-bold text-white transition hover:bg-[#16243c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶ {touring ? "Restart" : "Play"} Fixter Tour
            </button>

            <div className="flex gap-2">
              <Button
                onClick={() => setTour((c) => (c ? { ...c, paused: !c.paused } : c))}
                disabled={!touring}
              >
                {tour?.paused ? "Resume" : "Pause"}
              </Button>
              <Button onClick={() => setTour(null)} disabled={!touring} tone="danger">
                Stop
              </Button>
            </div>

            {touring && tourState && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[13px] font-bold text-slate-800">
                  {tourState.jobLabel}
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <dt className="text-slate-500">Phase</dt>
                  <dd className="text-right font-mono font-semibold text-slate-800">{tourState.phase}</dd>
                  <dt className="text-slate-500">Clip</dt>
                  <dd className="truncate text-right font-mono font-semibold text-slate-800">{tourState.clip}</dd>
                  <dt className="text-slate-500">Tool</dt>
                  <dd className="text-right font-mono font-semibold text-slate-800">{tourState.tool}</dd>
                  <dt className="text-slate-500">Jobs done</dt>
                  <dd className="text-right font-mono font-semibold text-slate-800">
                    {tourState.jobsDone} · lap {tourState.laps + 1}
                  </dd>
                </dl>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#0EA96D] transition-[width] duration-300"
                    style={{ width: `${Math.round(tourState.workProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <ol className="space-y-1 text-[12px]">
              {JOBS.map((entry, index) => {
                const current = tourState?.jobId === entry.id;
                return (
                  <li
                    key={entry.id}
                    className={`flex items-center justify-between rounded-md px-2 py-1 ${
                      current ? "bg-[#306EEC]/10 font-semibold text-[#1d4ed8]" : "text-slate-500"
                    }`}
                  >
                    <span>{index + 1}. {entry.label}</span>
                    <span className="font-mono text-[10px] uppercase">
                      {entry.tool ?? "hands"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title="Staging" hint="How the scene is composed and framed.">
            <div className="space-y-1.5">
              <p className="text-[12px] font-semibold text-slate-600">
                Stage layout
              </p>
              <Pills
                options={[
                  { id: "desktop" as LayoutId, label: "Desktop" },
                  { id: "tablet" as LayoutId, label: "Tablet" },
                  { id: "mobile" as LayoutId, label: "Mobile" },
                ]}
                value={layout}
                onChange={setLayoutOverride}
              />
              <p className="text-[11px] leading-snug text-slate-400">
                Each job holds its own spot per layout, in stage coordinates
                (-1 to +1 across and up). The camera is orthographic, so a stage
                coordinate is a screen coordinate.
              </p>
            </div>
            <Slider
              label="Fixter scale" value={scale} min={0.4} max={1.6} step={0.05}
              onChange={setScale} suffix="x"
            />
            <div className="flex gap-2">
              <Button onClick={() => setResetToken((t) => t + 1)}>Reset view</Button>
              <Button onClick={() => setShowObjects((v) => !v)}>
                {showObjects ? "Hide objects" : "Show objects"}
              </Button>
            </div>
            <label className="flex cursor-pointer items-center justify-between text-[13px] font-semibold text-slate-700">
              Orbit to inspect (breaks the flat stage)
              <input
                type="checkbox"
                checked={orbitEnabled}
                onChange={(e) => setOrbitEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#306EEC]"
              />
            </label>
          </Section>

          <details className="border-b border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Diagnostics
            </summary>

            <Section title="Clips" hint={`${clipNames.length} clips loaded. Stop the tour to drive them by hand.`}>
              <div className="grid grid-cols-2 gap-2">
                {clipNames.map((name) => {
                  const derived = SEQUENCE_CLIP_NAMES.has(name);
                  return (
                    <button
                      key={name} type="button" disabled={touring}
                      onClick={() => { setActiveClip(name); setIsPlaying(true); }}
                      className={`min-h-[36px] rounded-lg border px-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        activeClip === name
                          ? "border-[#306EEC] bg-[#306EEC] text-white"
                          : derived
                            ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                            : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsPlaying((p) => !p)} disabled={touring || !activeClip}>
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <Button onClick={() => { setIsPlaying(false); setStopToken((t) => t + 1); }} disabled={touring} tone="danger">
                  Stop
                </Button>
              </div>
              <Slider label="Animation speed" value={timeScale} min={0} max={2.5} step={0.05} onChange={setTimeScale} suffix="x" />
              <p className="text-[11px] text-slate-400">
                Roles resolved — walk: {roles.walkInPlace ?? "none"} · rest: {roles.rest ?? "none"}
              </p>
            </Section>

            <Section title="Manual transform" hint="Only applies while the tour is stopped.">
              {AXES.map((axis, index) => (
                <Slider
                  key={`p${axis}`} label={`Position ${axis}`} value={position[index]}
                  min={-5} max={5} step={0.05} disabled={touring}
                  onChange={(v) => setAxis(setPosition, index, v)}
                />
              ))}
              {AXES.map((axis, index) => (
                <Slider
                  key={`r${axis}`} label={`Rotation ${axis}`} value={rotationDeg[index]}
                  min={-180} max={180} step={1} suffix="°" disabled={touring}
                  onChange={(v) => setAxis(setRotationDeg, index, v)}
                />
              ))}
              <Button onClick={() => { setPosition(DEFAULT_POSITION); setRotationDeg(DEFAULT_ROTATION); }} disabled={touring}>
                Reset transform
              </Button>
            </Section>

            <Section title="Tool offsets" hint="Added on top of each motion's measured aim.">
              {AXES.map((axis, index) => (
                <Slider
                  key={`tp${axis}`} label={`Tool position ${axis}`} value={toolOffset.position[index]}
                  min={-0.15} max={0.15} step={0.002}
                  onChange={(v) => setToolOffset((c) => {
                    const next: Vec3 = [...c.position]; next[index] = v;
                    return { ...c, position: next };
                  })}
                />
              ))}
              {AXES.map((axis, index) => (
                <Slider
                  key={`tr${axis}`} label={`Tool rotation ${axis}`} value={toolOffset.rotationDeg[index]}
                  min={-180} max={180} step={1} suffix="°"
                  onChange={(v) => setToolOffset((c) => {
                    const next: Vec3 = [...c.rotationDeg]; next[index] = v;
                    return { ...c, rotationDeg: next };
                  })}
                />
              ))}
              <Slider
                label="Tool scale" value={toolOffset.scale} min={0.4} max={2.5} step={0.05} suffix="x"
                onChange={(v) => setToolOffset((c) => ({ ...c, scale: v }))}
              />
              <Button onClick={() => setToolOffset(DEFAULT_TOOL_OFFSET)}>Reset tool offsets</Button>
            </Section>

            <Section title="Retarget" hint="Numeric proof of the BVH → Fixter mapping.">
              <RetargetDiagnostics />
            </Section>

            <Section title="Render">
              <TelemetryReadout />
            </Section>
          </details>
        </aside>
      </div>
    </div>
  );
}
