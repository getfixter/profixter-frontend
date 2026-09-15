"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_TELEMETRY,
  resetTelemetry,
  subscribeTelemetry,
  type Telemetry,
} from "./lab-telemetry";

/**
 * The only component that re-renders on the render loop's schedule, and even
 * then only four times a second. It subscribes directly so the control panel
 * around it stays still.
 */
export default function TelemetryReadout() {
  const [telemetry, setTelemetry] = useState<Telemetry>(EMPTY_TELEMETRY);

  useEffect(() => {
    const unsubscribe = subscribeTelemetry(setTelemetry);
    return () => {
      unsubscribe();
      resetTelemetry();
    };
  }, []);

  const rows: [string, string][] = [
    ["FPS", telemetry.fps ? telemetry.fps.toFixed(0) : "-"],
    ["Draw calls", String(telemetry.drawCalls)],
    ["Triangles", telemetry.triangles.toLocaleString()],
    ["Geometries", String(telemetry.geometries)],
    ["Textures", String(telemetry.textures)],
    ["Phase", telemetry.phase],
    ["Active clip", telemetry.clip],
    [
      "World position",
      telemetry.position.map((value) => value.toFixed(2)).join(", "),
    ],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-mono font-semibold text-slate-800 tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
