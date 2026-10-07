"use client";

/**
 * Two small SVG charts for the Overview: a line (with a soft wash) and stacked
 * columns. Hand-built rather than a library because they are all this page
 * needs, and they follow the house rules exactly:
 * - one y-axis, clean ticks, hairline grid, recessive axes
 * - 2px line, >=8px end dot with a surface ring, 10% area wash
 * - columns <= 24px wide, 4px rounded tops, 2px surface gap between segments
 * - text in ink colours, never the series colour
 * - a crosshair/tooltip that snaps to the nearest x, and a table view
 * Rendered at the measured pixel width, so text never scales with the box.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export const INK = { primary: "#0b1628", secondary: "#52607a", muted: "#8b95a7", grid: "#e8ecf3", axis: "#cfd6e2", surface: "#ffffff" };
/* Validated categorical slots 1 and 2 (adjacent pair clears the CVD gate). */
export const SERIES = { blue: "#2a78d6", orange: "#eb6834" };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Clean y ticks: 0 .. max in 1/2/5 x 10^n steps. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

type Tip = { x: number; y: number; title: string; rows: Array<{ label: string; value: string; color?: string; line?: boolean }> } | null;

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x - 80, 0), Math.max(width - 168, 0));
  return (
    <div
      className="pointer-events-none absolute z-10 w-[168px] rounded-[12px] border border-slate-200/80 bg-white/95 px-3 py-2 shadow-[0_12px_32px_-12px_rgba(11,22,40,0.35)] backdrop-blur"
      style={{ left, top: Math.max(tip.y - 74, 0) }}
      role="status"
    >
      <div className="text-[11px] font-semibold text-slate-500">{tip.title}</div>
      {tip.rows.map((r) => (
        <div key={r.label} className="mt-1 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
            {r.color ? <span className="inline-block h-[3px] w-3 rounded-full" style={{ background: r.color }} /> : null}
            {r.label}
          </span>
          <span className="text-[14px] font-semibold text-slate-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const PAD = { left: 44, right: 14, top: 14, bottom: 26 };

/* Every Nth label, and never one so close to the last that the two collide. */
function xLabelEvery(n: number, width: number) {
  const fit = Math.max(2, Math.floor((width - PAD.left - PAD.right) / 54));
  return Math.max(1, Math.ceil(n / fit));
}

/* ------------------------------------------------------------------ */

export function LineChart({
  points,
  height = 230,
  format,
  label,
  color = SERIES.blue,
}: {
  points: Array<{ label: string; value: number; detail?: string }>;
  height?: number;
  format: (v: number) => string;
  label: string;
  color?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  const area = points.length ? `${path} L${xAt(points.length - 1).toFixed(1)},${yAt(0)} L${xAt(0).toFixed(1)},${yAt(0)} Z` : "";
  const every = xLabelEvery(points.length, width);
  const last = points.length - 1;

  const onMove = (clientX: number, rect: DOMRect) => {
    if (!points.length) return;
    const x = clientX - rect.left;
    const i = Math.round(((x - PAD.left) / innerW) * (points.length - 1));
    const idx = Math.min(points.length - 1, Math.max(0, i));
    const p = points[idx];
    setTip({ x: xAt(idx), y: yAt(p.value), title: p.label, rows: [{ label: p.detail || label, value: format(p.value), color, line: true }] });
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}
          onPointerMove={(e) => onMove(e.clientX, (e.currentTarget as SVGSVGElement).getBoundingClientRect())}
          onPointerLeave={() => setTip(null)}
          className="touch-pan-y"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
              <text x={PAD.left - 8} y={yAt(t) + 4} textAnchor="end" fontSize={11} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            (i % every === 0 && last - i >= every) || i === last ? (
              <text key={p.label + i} x={xAt(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize={11} fill={INK.muted}>
                {p.label}
              </text>
            ) : null
          )}
          <path d={area} fill={color} opacity={0.1} />
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="ov-draw" />
          {tip ? <line x1={tip.x} x2={tip.x} y1={PAD.top} y2={PAD.top + innerH} stroke={INK.axis} strokeWidth={1} /> : null}
          {points.length ? (
            <circle cx={xAt(last)} cy={yAt(points[last].value)} r={4.5} fill={color} stroke={INK.surface} strokeWidth={2} />
          ) : null}
          {tip ? <circle cx={tip.x} cy={tip.y} r={4.5} fill={color} stroke={INK.surface} strokeWidth={2} /> : null}
        </svg>
      ) : null}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ColumnChart({
  points,
  series,
  height = 230,
  format,
}: {
  points: Array<{ label: string; values: number[] }>;
  series: Array<{ label: string; color: string }>;
  height?: number;
  format: (v: number) => string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = points.map((p) => p.values.reduce((s, v) => s + v, 0));
  const max = Math.max(1, ...totals);
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(24, band * 0.62));
  const yAt = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const every = xLabelEvery(points.length, width);
  const last = points.length - 1;

  const tip: Tip =
    hover === null
      ? null
      : {
          x: PAD.left + band * hover + band / 2,
          y: yAt(totals[hover]),
          title: points[hover].label,
          rows: [
            ...series.map((s, si) => ({ label: s.label, value: format(points[hover].values[si] || 0), color: s.color })),
            { label: "Total", value: format(totals[hover]) },
          ],
        };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={points.map((p, i) => `${p.label} ${format(totals[i])}`).join(", ")} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
              <text x={PAD.left - 8} y={yAt(t) + 4} textAnchor="end" fontSize={11} fill={INK.muted} style={{ fontVariantNumeric: "tabular-nums" }}>
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = PAD.left + band * i + band / 2;
            let base = 0;
            const segs = p.values.map((v, si) => {
              const y0 = yAt(base);
              base += v;
              const y1 = yAt(base);
              return { si, v, y0, y1 };
            });
            const visible = segs.filter((s) => s.v > 0);
            return (
              <g key={p.label + i} opacity={hover === null || hover === i ? 1 : 0.55}>
                {visible.map((s, vi) => {
                  const isTop = vi === visible.length - 1;
                  const gapTop = isTop ? 0 : 1;
                  const gapBottom = vi === 0 ? 0 : 1;
                  const h = Math.max(0, s.y0 - s.y1 - gapTop - gapBottom);
                  const y = s.y1 + gapTop;
                  const r = isTop ? Math.min(4, h, barW / 2) : 0;
                  const x = cx - barW / 2;
                  const d = r
                    ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`
                    : `M${x},${y + h} V${y} H${x + barW} V${y + h} Z`;
                  return <path key={s.si} d={d} fill={series[s.si].color} />;
                })}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  tabIndex={0}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${p.label}: ${format(totals[i])}`}
                />
                {(i % every === 0 && last - i >= every) || i === last ? (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={INK.muted}>
                    {p.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; line?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[12px] text-slate-500">
          <span className={it.line ? "inline-block h-[3px] w-3.5 rounded-full" : "inline-block h-2.5 w-2.5 rounded-[3px]"} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** The table view every chart owes its reader. */
export function DataTable({ head, rows }: { head: string[]; rows: Array<Array<string>> }) {
  return (
    <details className="ov-data mt-2">
      <summary className="cursor-pointer select-none text-[12px] font-semibold text-slate-400 hover:text-slate-600">Show data</summary>
      <div className="mt-2 max-h-[220px] overflow-auto rounded-[10px] border border-slate-100">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>{head.map((h) => <th key={h} className="px-3 py-1.5 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {r.map((c, j) => <td key={j} className="px-3 py-1.5 tabular-nums text-slate-700">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
