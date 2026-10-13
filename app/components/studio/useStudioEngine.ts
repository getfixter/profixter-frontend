"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";

export type EngineSnapshot = {
  ready: boolean;
  design: any;
  check: any;
  suggestion: { confidence: number; notes: string[]; ms: number } | null;
  tool: string;
  tapQueue: string[] | null;
  snap: boolean;
  autoRemove: boolean;
  messages: { mark: Msg[]; measure: Msg[]; design: Msg[] };
  busy: string | null;
  last: { reason: string; ms: number; fill: string; at: number } | null;
  options: any;
  current: any;
  canUndoMask: boolean;
  hasMasks: boolean;
  canUndoMove?: boolean;
  canUndoMarks?: boolean;
  activeMark?: string | null;
  photoCheck?: { ok: boolean; reasons?: string[] } | null;
  blocked?: string | null;
  model?: boolean;
  dragging?: string | null;
};
export type Msg = { kind: "ok" | "warn" | "err" | "info"; text: string; field?: string };

export type StageRefs = {
  glRef: React.RefObject<HTMLCanvasElement | null>;
  beforeRef: React.RefObject<HTMLCanvasElement | null>;
  afterRef: React.RefObject<HTMLCanvasElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  loupeRef: React.RefObject<HTMLCanvasElement | null>;
};

/**
 * Creates the Shower Studio engine (three.js + WebGL; browser only) once the
 * canvases are mounted and a catalog is available, and mirrors its state into
 * React. The engine is loaded lazily so the page shell renders immediately.
 */
export function useStudioEngine(catalog: any) {
  const glRef = useRef<HTMLCanvasElement>(null);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!catalog || engineRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) throw new Error("This browser can't draw 3D previews (WebGL is off).");
        const { StudioEngine } = await import("@/lib/studio/engine/controller.js");
        // the canvases may mount later (e.g. after a start screen): wait for them
        const mounted = () => Boolean(glRef.current && beforeRef.current && afterRef.current && svgRef.current);
        while (!cancelled && !mounted()) await new Promise((r) => setTimeout(r, 60));
        if (cancelled) return;
        engineRef.current = new StudioEngine({
          els: { gl: glRef.current, before: beforeRef.current, after: afterRef.current, svg: svgRef.current, loupe: loupeRef.current },
          catalog: structuredClone(catalog),
          onChange: ((s: EngineSnapshot) => setSnap({ ...s })) as any,
        });
        // local development and the local demo only: lets browser tests drive the engine directly
        if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_STUDIO_DEMO === "1") (window as any).__studioEngine = engineRef.current;
        // development only: synthetic test photos for the photo workflow
        if (process.env.NODE_ENV !== "production") import("@/lib/studio/engine/lab.js").then((m) => { (window as any).__studioLab = m; }).catch(() => {});
        engineRef.current.emit(); // first snapshot, so the UI knows the engine is ready
        setLoaded(true);
      } catch (e: any) {
        setError(e?.message || "The design tool could not start on this device.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  useEffect(() => () => { engineRef.current?.destroy(); engineRef.current = null; }, []);

  const engine = useCallback(() => engineRef.current, []);
  return { stageRefs: { glRef, beforeRef, afterRef, svgRef, loupeRef }, engine, snap, error, loaded };
}
