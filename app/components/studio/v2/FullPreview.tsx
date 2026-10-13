"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

/**
 * Full-screen preview: the design large, controls hidden. Pinch or wheel to
 * zoom, drag to pan, double-tap to zoom in/out, Esc / X / tap outside the
 * picture (when not zoomed) to close. Photos get a before/after slider.
 * The page behind does not scroll while it is open.
 */
export default function FullPreview({ open, onClose, engine, stamp, hasPhoto, caption }: {
  open: boolean; onClose: () => void; engine: () => any; stamp: number; hasPhoto: boolean; caption: string;
}) {
  const after = useRef<HTMLCanvasElement>(null), before = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [cmp, setCmp] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 1080, h: 1350 });
  const closeBtn = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = area.current;
    if (!open || !el) return;
    const m = () => { const k = Math.min((el.clientWidth - 24) / size.w, (el.clientHeight - 24) / size.h); setFit({ w: Math.floor(size.w * k), h: Math.floor(size.h * k) }); };
    m();
    const ro = new ResizeObserver(m); ro.observe(el);
    return () => ro.disconnect();
  }, [open, size.w, size.h]);

  const clampV = useCallback((v: { k: number; x: number; y: number }) => {
    const el = wrap.current;
    if (!el || v.k <= 1) return { k: 1, x: 0, y: 0 };
    const mx = (el.clientWidth * (v.k - 1)) / 2, my = (el.clientHeight * (v.k - 1)) / 2;
    return { k: v.k, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
  }, []);

  // draw the current design (and the photo) at full resolution
  useEffect(() => {
    if (!open) return;
    const e = engine();
    if (!e) return;
    const a = e.els.after;
    if (!a?.width) return;
    e.drawCompare(before.current, after.current);
    const id = requestAnimationFrame(() => setSize((s0) => (s0.w === a.width && s0.h === a.height ? s0 : { w: a.width, h: a.height })));
    return () => cancelAnimationFrame(id);
  }, [open, stamp, engine]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
      if (ev.key === "+" || ev.key === "=") setView((v) => ({ ...v, k: Math.min(5, v.k * 1.25) }));
      if (ev.key === "-") setView((v) => clampV({ ...v, k: Math.max(1, v.k / 1.25) }));
    };
    window.addEventListener("keydown", key);
    closeBtn.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); setView({ k: 1, x: 0, y: 0 }); setCmp(null); };
  }, [open, onClose, clampV]);



  // ---------------------------------------------------------------- gestures
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ v: typeof view; d: number; c: { x: number; y: number }; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const centre = () => { const a = [...pts.current.values()]; return { x: a.reduce((s, p) => s + p.x, 0) / a.length, y: a.reduce((s, p) => s + p.y, 0) / a.length }; };
  const dist = () => { const a = [...pts.current.values()]; return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  const onDown = (ev: React.PointerEvent) => {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    pts.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    start.current = { v: view, d: dist(), c: centre(), moved: false };
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!pts.current.has(ev.pointerId) || !start.current) return;
    pts.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const s = start.current, c = centre();
    if (Math.hypot(c.x - s.c.x, c.y - s.c.y) > 4) s.moved = true;
    if (pts.current.size >= 2 && s.d > 0) {
      const k = Math.max(1, Math.min(5, (s.v.k * dist()) / s.d));
      setView(clampV({ k, x: s.v.x + (c.x - s.c.x), y: s.v.y + (c.y - s.c.y) }));
    } else if (s.v.k > 1) {
      setView(clampV({ k: s.v.k, x: s.v.x + (c.x - s.c.x), y: s.v.y + (c.y - s.c.y) }));
    }
  };
  const onUp = (ev: React.PointerEvent) => {
    pts.current.delete(ev.pointerId);
    const s = start.current;
    if (pts.current.size === 0 && s && !s.moved) {
      const now = Date.now();
      if (now - lastTap.current < 320) { setView((v) => (v.k > 1 ? { k: 1, x: 0, y: 0 } : { k: 2.5, x: 0, y: 0 })); lastTap.current = 0; }
      else lastTap.current = now;
    }
    start.current = pts.current.size ? { v: view, d: dist(), c: centre(), moved: true } : null;
  };
  const onWheel = (ev: React.WheelEvent) => {
    const k = Math.max(1, Math.min(5, view.k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
    setView(clampV({ ...view, k }));
  };

  if (!open) return null;
  return (
    <div className="studio-fade fixed inset-0 z-[100] flex flex-col bg-[#0F0E0D]" role="dialog" aria-modal="true" aria-label="Full-screen preview" data-testid="full-preview"
      onClick={(ev) => { if (ev.target === ev.currentTarget && view.k === 1) onClose(); }}>
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] text-white">
        <span className="truncate text-[13px] text-white/70">{caption}</span>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close preview" data-testid="close-preview"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>
      <div ref={area} className="relative flex min-h-0 flex-1 items-center justify-center p-3" onClick={(ev) => { if (ev.target === ev.currentTarget && view.k === 1) onClose(); }}>
        <div ref={wrap} className="relative max-h-full max-w-full touch-none select-none overflow-hidden rounded-[14px]" style={fit ? { width: fit.w, height: fit.h } : { width: 1, height: 1 }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} data-testid="preview-surface">
          <div className="absolute inset-0 origin-center transition-transform duration-75" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            <canvas ref={after} className="absolute inset-0 h-full w-full" />
            <canvas ref={before} className="absolute inset-0 h-full w-full" style={{ clipPath: cmp == null ? "inset(0 100% 0 0)" : `inset(0 ${100 - cmp * 100}% 0 0)` }} />
          </div>
          {cmp != null ? <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white" style={{ left: `${cmp * 100}%` }} /> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 text-white">
        <button type="button" onClick={() => setView((v) => clampV({ ...v, k: Math.max(1, v.k / 1.4) }))} aria-label="Zoom out" className="grid h-11 w-11 place-items-center rounded-full bg-white/12 ring-1 ring-white/20"><Icon name="minus" className="h-5 w-5" /></button>
        <span className="min-w-[56px] text-center text-[13px] tabular-nums text-white/80" data-testid="zoom-level">{Math.round(view.k * 100)}%</span>
        <button type="button" onClick={() => setView((v) => clampV({ ...v, k: Math.min(5, v.k * 1.4) }))} aria-label="Zoom in" className="grid h-11 w-11 place-items-center rounded-full bg-white/12 ring-1 ring-white/20"><Icon name="plus" className="h-5 w-5" /></button>
        {hasPhoto ? (
          cmp == null
            ? <button type="button" onClick={() => setCmp(0.5)} className="ml-2 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-[#1C1B19]"><Icon name="compare" className="h-5 w-5" />Before / after</button>
            : <label className="ml-2 flex min-h-[44px] items-center gap-2 rounded-full bg-white/12 px-4 text-[13px] ring-1 ring-white/20">Before
                <input type="range" min={0} max={100} value={Math.round(cmp * 100)} onChange={(e) => setCmp(Number(e.target.value) / 100)} className="w-36 accent-white" aria-label="Before and after" />After</label>
        ) : null}
      </div>
      <p className="pb-3 text-center text-[11.5px] text-white/45">Pinch or scroll to zoom · drag to look around · double-tap to zoom</p>
    </div>
  );
}
