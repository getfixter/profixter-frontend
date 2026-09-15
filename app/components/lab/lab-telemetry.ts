import type { RetargetReport } from "./lab-retarget";

/**
 * A one-way channel from inside the render loop to the DOM readout.
 *
 * The scene samples every frame; React must not. Pushing per-frame numbers
 * through component state would re-render the whole control panel sixty times a
 * second and the FPS counter would become the reason the FPS dropped. So the
 * scene writes here, the readout subscribes on its own, and nothing else in the
 * tree re-renders.
 */

export type Telemetry = {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  phase: string;
  clip: string;
  position: [number, number, number];
};

export const EMPTY_TELEMETRY: Telemetry = {
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  phase: "IDLE",
  clip: "—",
  position: [0, 0, 0],
};

type Listener = (telemetry: Telemetry) => void;

const listeners = new Set<Listener>();
let latest: Telemetry = EMPTY_TELEMETRY;

export function publishTelemetry(telemetry: Telemetry) {
  latest = telemetry;
  listeners.forEach((listener) => listener(telemetry));
}

export function subscribeTelemetry(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTelemetry() {
  return latest;
}

/** Cleared on unmount so a remounted Lab never shows the last run's numbers. */
export function resetTelemetry() {
  latest = EMPTY_TELEMETRY;
}

/*
 * The retargeting diagnostics, on their own channel.
 *
 * Published once at load rather than per frame, and kept separate from the
 * render telemetry so the panel showing it does not re-render four times a
 * second for a value that never changes.
 */
type ReportListener = (reports: RetargetReport[]) => void;

const reportListeners = new Set<ReportListener>();
let reports: RetargetReport[] = [];

export function publishRetargetReport(report: RetargetReport) {
  // Keyed by clip so a re-run replaces rather than accumulates.
  reports = [...reports.filter((r) => r.clipName !== report.clipName), report];
  reportListeners.forEach((listener) => listener(reports));
}

export function subscribeRetargetReport(listener: ReportListener) {
  reportListeners.add(listener);
  // Retargeting finishes at load, well before the panel mounts, so a late
  // subscriber has to be handed what is already there or it shows nothing.
  if (reports.length) listener(reports);
  return () => {
    reportListeners.delete(listener);
  };
}
