"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useMemo } from "react";
import { apiUrl } from "@/lib/studio/api";
import { swatchDataUrl } from "@/lib/studio/engine/textures.js";

/**
 * A product's picture in the customer Studio. Hierarchy:
 *   1. an approved product photo (uploaded by Profixter, or a licensed copy);
 *   2. otherwise an original illustration drawn from the product's own data
 *      (size, colour, finish, drain side, pattern) - labelled "Illustration",
 *      never presented as a manufacturer photo.
 */
export type ArtKind = "finish" | "base" | "fixture" | "enclosure" | "accessory" | "none";

const css = (c: any, fallback = "#e8e6e1") => (typeof c === "number" ? `#${c.toString(16).padStart(6, "0")}` : typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function ProductArt({ item, kind, className = "", label = true }: { item?: any; kind: ArtKind; className?: string; label?: boolean }) {
  const photo = item?.photo ? apiUrl(item.photo) : null;
  const swatch = useMemo(() => {
    if (kind !== "finish" || !item || typeof window === "undefined") return "";
    try { return swatchDataUrl(item, 30, 240); } catch { return ""; }
  }, [kind, item]);
  if (photo) return <div className={`relative overflow-hidden bg-[#ECE7DF] ${className}`}><img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" /></div>;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-b from-[#F8F6F2] to-[#ECE7DF] ${className}`} aria-hidden>
      <svg viewBox="0 0 160 120" className="h-full w-full" preserveAspectRatio={kind === "finish" ? "xMidYMid slice" : "xMidYMid meet"}>{draw(kind, item, swatch)}</svg>
      {label && kind !== "none" ? <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white/80 px-1.5 py-[1px] text-[9px] font-medium tracking-wide text-[#8C867C] backdrop-blur">Illustration</span> : null}
    </div>
  );
}

function draw(kind: ArtKind, it: any, swatch: string): React.ReactNode {
  if (kind === "none" || !it) {
    return <g><rect x="40" y="18" width="80" height="84" rx="6" fill="none" stroke="#B8C2D3" strokeWidth="2" strokeDasharray="6 5" /><text x="80" y="66" textAnchor="middle" fontSize="12" fill="#64748B" fontFamily="sans-serif">Open</text></g>;
  }
  if (kind === "finish") {
    // a piece of the wall at true pattern scale, softly lit from above
    const id = `sw-${String(it.id).replace(/\W/g, "")}`;
    return (
      <g>
        <defs>
          <pattern id={id} patternUnits="userSpaceOnUse" width="80" height="80"><image href={swatch} width="80" height="80" preserveAspectRatio="none" /></pattern>
          <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.18" /><stop offset="1" stopColor="#000" stopOpacity="0.10" /></linearGradient>
        </defs>
        <rect x="0" y="0" width="160" height="120" fill={`url(#${id})`} />
        <rect x="0" y="0" width="160" height="120" fill={`url(#${id}-l)`} />
      </g>
    );
  }
  if (kind === "base") {
    const c = css(it.color, "#f2f1ee");
    const L = it.dims?.length || 60, Wd = it.dims?.width || 30;
    const d = Math.max(18, Math.min(46, (Wd / L) * 128 * 0.6));
    const x0 = 16 + (L < 50 ? 14 : 0), x1 = 144 - (L < 50 ? 14 : 0);
    if (it.kind === "tub") {
      const top = 46, h = 34;
      return (
        <g>
          <polygon points={`${x0 + 10},${top - d} ${x1 - 10},${top - d} ${x1},${top} ${x0},${top}`} fill={c} />
          <polygon points={`${x0 + 18},${top - d + 4} ${x1 - 18},${top - d + 4} ${x1 - 9},${top - 4} ${x0 + 9},${top - 4}`} fill={shade(c, 0.86)} />
          <rect x={x0} y={top} width={x1 - x0} height={h} fill={shade(c, 0.95)} />
          <rect x={x0} y={top} width={x1 - x0} height="3" fill="#fff" opacity="0.8" />
          <circle cx={drainX(it, x0 + 18, x1 - 18)} cy={top - d / 2} r="2.6" fill="#8b9097" />
        </g>
      );
    }
    const top = 72, h = 9;
    return (
      <g>
        <polygon points={`${x0 + 12},${top - d} ${x1 - 12},${top - d} ${x1},${top} ${x0},${top}`} fill={c} />
        <polygon points={`${x0 + 17},${top - d + 3} ${x1 - 17},${top - d + 3} ${x1 - 6},${top - 3} ${x0 + 6},${top - 3}`} fill={shade(c, 0.93)} />
        <rect x={x0} y={top} width={x1 - x0} height={h} fill={shade(c, 0.85)} />
        <ellipse cx={drainX(it, x0 + 18, x1 - 18)} cy={top - d / 2} rx="4.5" ry="2" fill="#8b9097" />
      </g>
    );
  }
  if (kind === "fixture") {
    const c = css(it.finishColor, "#c9ccce"), dark = shade(c, 0.7);
    const tub = it.kind === "tubShower";
    return (
      <g>
        <rect x="74" y="16" width="44" height="5" rx="2.5" fill={c} stroke={dark} strokeWidth="0.8" />
        <ellipse cx="120" cy="25" rx="13" ry="7" fill={c} stroke={dark} strokeWidth="1" />
        <circle cx="80" cy="64" r="17" fill={c} stroke={dark} strokeWidth="1.2" />
        <rect x="77" y="47" width="6" height="19" rx="3" fill={shade(c, 0.85)} stroke={dark} strokeWidth="0.8" />
        {tub ? <path d="M74 92 h14 a4 4 0 0 1 4 4 v6 h-6 v-4 h-12 z" fill={c} stroke={dark} strokeWidth="1" /> : null}
      </g>
    );
  }
  if (kind === "enclosure") {
    const fc = css(it.kind === "rod" ? it.finishColor : it.frameColor, "#c9ccce");
    if (it.kind === "rod") {
      return (
        <g>
          <path d="M20 26 Q80 6 140 26" fill="none" stroke={fc} strokeWidth="4" strokeLinecap="round" />
          <circle cx="20" cy="26" r="4" fill={fc} /><circle cx="140" cy="26" r="4" fill={fc} />
          <path d="M28 30 q6 40 0 80 M40 26 q6 44 0 84 M52 23 q6 46 0 87" stroke="#d7dde8" strokeWidth="3" fill="none" />
        </g>
      );
    }
    return (
      <g>
        <rect x="20" y="10" width="62" height="100" fill="#cfe6f2" fillOpacity="0.55" stroke={fc} strokeWidth="3" />
        <rect x="76" y="12" width="64" height="98" fill="#cfe6f2" fillOpacity="0.45" stroke={fc} strokeWidth="3" />
        <line x1="20" y1="10" x2="140" y2="10" stroke={fc} strokeWidth="4" />
        <line x1="60" y1="55" x2="60" y2="75" stroke={fc} strokeWidth="3" strokeLinecap="round" />
        <path d="M30 20 l18 -6 M88 22 l18 -6" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" />
      </g>
    );
  }
  // accessories
  const c = css(it.render?.finishColor ?? it.render?.color, "#c0c3c7");
  if (it.type === "grabBar") {
    const len = Math.min(130, 40 + (it.length || 24) * 2.4);
    const x0 = 80 - len / 2, x1 = 80 + len / 2;
    return <g><rect x={x0} y="54" width={len} height="10" rx="5" fill={c} stroke={shade(c, 0.7)} /><circle cx={x0 + 5} cy="59" r="9" fill={c} stroke={shade(c, 0.7)} /><circle cx={x1 - 5} cy="59" r="9" fill={c} stroke={shade(c, 0.7)} /></g>;
  }
  if (it.type === "shelf") return <g><polygon points="30,40 130,40 80,86" fill={c} stroke={shade(c, 0.75)} /><polygon points="30,40 130,40 130,46 80,92 30,46" fill={shade(c, 0.8)} /></g>;
  const sc = css(it.render?.color, "#a8784c");
  return <g><rect x="30" y="20" width="10" height="84" fill={css(it.render?.frameColor, "#c9ccce")} /><rect x="40" y="60" width="96" height="10" fill={sc} /><rect x="40" y="72" width="96" height="6" fill={shade(sc, 0.85)} /><line x1="40" y1="64" x2="136" y2="64" stroke={shade(sc, 0.7)} /></g>;
}

function drainX(it: any, lo: number, hi: number) {
  const along = it.drains?.[0]?.along;
  return Number.isFinite(along) ? lo + (hi - lo) * along : (lo + hi) / 2;
}
