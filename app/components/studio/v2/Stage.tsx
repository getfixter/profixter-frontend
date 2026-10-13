"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StageRefs } from "../useStudioEngine";
import { Spinner } from "./ui";

/**
 * The bathroom picture. The engine draws into these canvases; this component
 * fits them into whatever space the layout gives it (never cropped, never
 * stretched), and lets people move accessories by dragging them on the picture.
 *
 * view: "result" (the design), "photo" (the photo with its outline handles, for
 * adjusting), "compare" (before/after slider; photos only).
 */
export default function Stage({ refs: { glRef, beforeRef, afterRef, svgRef, loupeRef }, view, ready, busy, engine, snap, stamp, focusAcc, onFocusAcc, onTapEmpty, children, interactive = true, label = "Your bathroom design" }: {
  refs: StageRefs; view: "result" | "photo" | "compare"; ready: boolean; busy?: string | null; engine: () => any; snap: any; stamp: number;
  focusAcc?: string | null; onFocusAcc?: (k: string | null) => void; onTapEmpty?: () => void; children?: React.ReactNode; interactive?: boolean; label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);
  const [img, setImg] = useState<{ w: number; h: number }>({ w: 1080, h: 1350 });
  const [drag, setDrag] = useState<{ key: string; blocked: string | null } | null>(null);
  const [handles, setHandles] = useState<any[]>([]);
  const [panels, setPanels] = useState<any[]>([]);
  const [cmp, setCmp] = useState(0.5);
  const cmpBefore = useRef<HTMLCanvasElement>(null), cmpAfter = useRef<HTMLCanvasElement>(null);

  // image size follows the engine's canvases
  useEffect(() => {
    const c = afterRef.current;
    if (c && c.width > 0 && (c.width !== img.w || c.height !== img.h)) setImg({ w: c.width, h: c.height });
    const e = engine();
    if (e?.pipeline?.cam) { setHandles(e.accessoryHandles()); }
  }, [stamp, afterRef, engine, img.w, img.h, snap?.design?.accessories]);

  // contain-fit into the box
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (!cw || !ch) return;
      const k = Math.min(cw / img.w, ch / img.h);
      setFit({ w: Math.floor(img.w * k), h: Math.floor(img.h * k) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [img.w, img.h]);

  useEffect(() => {
    if (view === "compare") engine()?.drawCompare(cmpBefore.current, cmpAfter.current);
  }, [view, stamp, engine]);

  // ---------------------------------------------------------------- dragging accessories on the picture
  const live = useRef<{ key: string; id: number; grab: [number, number]; raf: number; last: [number, number] | null } | null>(null);
  const toImage = (ev: React.PointerEvent) => {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * img.w, ((ev.clientY - r.top) / r.height) * img.h] as [number, number];
  };
  const onDown = (ev: React.PointerEvent) => {
    const e = engine();
    if (!interactive || view !== "result" || !e?.pipeline?.cam) return;
    const p = toImage(ev);
    const key = e.accessoryAt(p[0], p[1]);
    if (!key) { onTapEmpty?.(); return; }
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    const h = e.accessoryHandles().find((x: any) => x.key === key);
    e.beginDrag(key);
    live.current = { key, id: ev.pointerId, grab: h ? [p[0] - h.x, p[1] - h.y] : [0, 0], raf: 0, last: null };
    setDrag({ key, blocked: null });
    setPanels(e.panelPolygons());
    onFocusAcc?.(key);
  };
  const onMove = (ev: React.PointerEvent) => {
    const L = live.current;
    if (!L || ev.pointerId !== L.id) return;
    ev.preventDefault();
    L.last = toImage(ev);
    if (L.raf) return;
    L.raf = requestAnimationFrame(() => {
      L.raf = 0;
      const e = engine();
      if (!e || !L.last) return;
      const r = e.dragAccessory(L.key, L.last[0], L.last[1], { grab: L.grab });
      setDrag({ key: L.key, blocked: r?.blocked || null });
      setHandles(e.accessoryHandles());
    });
  };
  const onUp = (ev: React.PointerEvent) => {
    const L = live.current;
    if (!L || ev.pointerId !== L.id) return;
    cancelAnimationFrame(L.raf);
    live.current = null;
    setDrag(null);
    setPanels([]);
    engine()?.endDrag();
  };

  const focus = handles.find((h) => h.key === (drag?.key || focusAcc));
  const showHandles = interactive && view === "result" && handles.length > 0;

  return (
    <div ref={box} className="relative flex h-full w-full items-center justify-center">
      <canvas ref={glRef} hidden />
      <div className="relative" style={fit ? { width: fit.w, height: fit.h } : { width: "100%", aspectRatio: `${img.w} / ${img.h}`, maxHeight: "100%" }}>
        {/* the design */}
        <div className={view === "result" ? "absolute inset-0" : "hidden"}>
          <canvas ref={afterRef} className="block h-full w-full rounded-[18px] shadow-[0_18px_50px_rgba(28,27,25,0.18)]" data-studio-after role="img" aria-label={label} />
          <div className={`absolute inset-0 ${showHandles ? "touch-none" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ cursor: drag ? "grabbing" : "default" }} data-testid="stage-surface">
            {showHandles ? (
              <svg viewBox={`0 0 ${img.w} ${img.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                {panels.map((pl) => <polygon key={pl.wall} points={pl.pts.map((q: number[]) => q.join(",")).join(" ")} fill="#ffffff" fillOpacity="0.14" stroke="#ffffff" strokeOpacity="0.85" strokeDasharray="10 8" strokeWidth={img.w / 400} />)}
                {handles.map((h) => (
                  <g key={h.key}>
                    <circle cx={h.x} cy={h.y} r={h.r} fill={drag?.key === h.key ? (drag?.blocked ? "#C2410C" : "#1C1B19") : "#ffffff"} fillOpacity={drag?.key === h.key ? 0.12 : 0} stroke={drag?.key === h.key && drag?.blocked ? "#C2410C" : focus?.key === h.key ? "#1C1B19" : "#ffffff"} strokeOpacity={focus?.key === h.key || drag?.key === h.key ? 0.95 : 0.7} strokeWidth={img.w / (focus?.key === h.key ? 260 : 380)} strokeDasharray={focus?.key === h.key ? undefined : `${img.w / 90} ${img.w / 140}`} />
                  </g>
                ))}
              </svg>
            ) : null}
          </div>
          {drag?.blocked ? <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[#C2410C] px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg" role="status">Too close to {drag.blocked}</div> : null}
        </div>
        {/* the photo with its outline, for adjusting */}
        <div className={view === "photo" ? "absolute inset-0" : "hidden"}>
          <div className="relative h-full w-full touch-none select-none" data-studio-photo>
            <canvas ref={beforeRef} className="block h-full w-full rounded-[18px]" />
            <svg ref={svgRef} className="absolute inset-0 h-full w-full" aria-label="Area outline" />
          </div>
        </div>
        {/* before / after */}
        {view === "compare" ? (
          <div className="absolute inset-0 overflow-hidden rounded-[18px] select-none" data-testid="compare">
            <canvas ref={cmpAfter} className="absolute inset-0 h-full w-full" />
            <canvas ref={cmpBefore} className="absolute inset-0 h-full w-full" style={{ clipPath: `inset(0 ${100 - cmp * 100}% 0 0)` }} />
            <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow" style={{ left: `${cmp * 100}%` }} />
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold text-white">Before</span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold text-white">After</span>
            <input type="range" min={0} max={100} value={Math.round(cmp * 100)} onChange={(e) => setCmp(Number(e.target.value) / 100)} aria-label="Before and after"
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
          </div>
        ) : null}
        {!ready || busy ? (
          <div className={`absolute inset-0 grid place-items-center rounded-[18px] ${ready ? "bg-white/55 backdrop-blur-[2px]" : "bg-[#ECE7DF]"}`} role="status">
            <div className="flex max-w-[80%] items-center gap-2.5 rounded-full bg-white px-4 py-2.5 text-[14px] font-medium text-[#1C1B19] shadow-lg">
              {!busy || /^Preparing|^Drawing/.test(busy) ? <Spinner className="h-4 w-4 shrink-0" /> : null}<span>{busy || "Setting up your bathroom…"}</span>
            </div>
          </div>
        ) : null}
        {children}
      </div>
      {/* magnifier while dragging an outline corner (the engine positions it) */}
      <div className="pointer-events-none fixed z-[95] hidden h-32 w-32 overflow-hidden rounded-full shadow-2xl ring-4 ring-white" style={{ left: 0, top: 0 }}>
        <canvas ref={loupeRef} width={128} height={128} className="h-full w-full" />
      </div>
    </div>
  );
}
