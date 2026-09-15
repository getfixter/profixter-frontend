"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FIXTER_GLB } from "./lab-config";
import {
  DIAG_BUILD,
  getDiag,
  getDiagVersion,
  runDiagProbes,
  subscribeDiag,
} from "./lab-diagnostics";

/**
 * A readout you can hold a phone up to.
 *
 * Fixed to the top, above everything, and deliberately ugly. It exists because
 * the homepage experiment has four separate ways to show a webpage with no
 * character on it, and none of them can be told apart by looking.
 *
 * Temporary. It comes out once we know what the device is doing.
 */
export default function LabDiagnostics() {
  /* Collapsed. It is for me, not for whoever is holding the phone. */
  const [open, setOpen] = useState(false);

  useSyncExternalStore(subscribeDiag, getDiagVersion, () => 0);

  useEffect(() => {
    runDiagProbes(FIXTER_GLB);
  }, []);

  const d = getDiag();

  const rows: [string, string, boolean][] = [
    ["CHUNK", d.chunk, !/fail|error/i.test(d.chunk)],
    ["WEBGL", d.webgl, !/NO CONTEXT|THREW/i.test(d.webgl)],
    ["GPU", d.renderer, true],
    ["GLB HEAD", d.glbHead, /^200/.test(d.glbHead)],
    ["LAYER", d.layer, /PINNED$|PINNED ·/.test(d.layer) || /· PINNED/.test(d.layer)],
    ["CANVAS", d.canvas, d.canvas !== "not mounted"],
    ["ASSETS", d.assets, /100%/.test(d.assets) && !/ERRORS/.test(d.assets)],
    ["MODEL", d.model, /loaded/i.test(d.model)],
    ["MOTIONS", d.motions, /loaded/i.test(d.motions)],
    ["ANCHORS", d.anchors, !/^0\b|…/.test(d.anchors)],
    ["STOPS", d.stops, !/^0\b|…/.test(d.stops)],
    ["TOUR", d.tour, !/…|none/i.test(d.tour)],
    ["FIXTER", d.fixter, /on screen/i.test(d.fixter)],
    ["REDUCED MOTION", String(d.reducedMotion), !d.reducedMotion],
    ["VIEWPORT", d.viewport, true],
  ];

  return (
    <div data-fx-chrome="" className="relative z-[90] border-b border-slate-700 bg-[#0B1628] font-mono text-[10px] leading-[1.45] text-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-1 text-left"
      >
        <span className="font-bold text-amber-300">
          FIXTER LAB DIAGNOSTICS · {DIAG_BUILD}
        </span>
        <span className="text-white/60">{open ? "hide ▲" : "show ▼"}</span>
      </button>

      {open && (
        <div className="px-2 pb-2">
          {rows.map(([label, value, ok]) => (
            <div key={label} className="flex gap-2">
              <span className="w-[102px] shrink-0 text-white/45">{label}</span>
              <span className={ok ? "text-emerald-300" : "text-rose-300"}>
                {value || "—"}
              </span>
            </div>
          ))}
          {d.errors.length > 0 && (
            <div className="mt-1 border-t border-white/15 pt-1">
              {d.errors.map((e) => (
                <p key={e} className="text-rose-300">
                  {e}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
