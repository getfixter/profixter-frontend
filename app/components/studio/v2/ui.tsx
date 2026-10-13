"use client";

/**
 * Shower Studio's own small design system: warm stone surfaces, ink text, a
 * brass accent, generous radii, system typography (SF Pro on Apple devices).
 * Independent from the rest of the site on purpose.
 */
import type { ReactNode } from "react";

export const T = {
  bg: "#F3F0EB",
  panel: "#FFFFFF",
  ink: "#1C1B19",
  ink2: "#5F5A52",
  ink3: "#8C867C",
  line: "#E7E1D8",
  brass: "#A47A3E",
  good: "#2F6B4F",
};

export const FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' };

const base = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background,box-shadow,color] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A47A3E] focus-visible:ring-offset-2";
export const btn = {
  primary: `${base} min-h-[52px] px-6 text-[16px] bg-[#1C1B19] text-white hover:bg-black shadow-[0_8px_24px_rgba(28,27,25,0.22)]`,
  secondary: `${base} min-h-[52px] px-6 text-[16px] bg-white text-[#1C1B19] ring-1 ring-[#DDD6CB] hover:ring-[#1C1B19]`,
  ghost: `${base} min-h-[44px] px-4 text-[15px] text-[#1C1B19] hover:bg-black/5`,
  small: `${base} min-h-[40px] px-4 text-[14px] bg-white text-[#1C1B19] ring-1 ring-[#DDD6CB] hover:ring-[#1C1B19]`,
};
export const iconBtn = "grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[#1C1B19] shadow-[0_2px_10px_rgba(28,27,25,0.12)] ring-1 ring-black/5 backdrop-blur transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A47A3E]";
export const input = "min-h-[52px] w-full rounded-2xl border border-[#DDD6CB] bg-white px-4 text-[16px] text-[#1C1B19] outline-none transition focus:border-[#1C1B19] focus:ring-4 focus:ring-[#1C1B19]/8";

export function DemoTag({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-[#FFF1D6] px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8A5A00] ${className}`}>Demo</span>;
}

/** Icons: 24px, 1.6 stroke, round joins. */
export function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const p: Record<string, ReactNode> = {
    walls: <><rect x="3.5" y="3.5" width="17" height="17" rx="1.5" /><path d="M3.5 9h17M3.5 14.5h17M9 3.5V9M15 9v5.5M9 14.5v6" /></>,
    base: <><path d="M3 15.5h18v3H3z" /><path d="M5 15.5l1.5-5h11l1.5 5" /><circle cx="15.5" cy="13" r="0.8" /></>,
    tub: <><path d="M3 11.5h18v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" /><path d="M6 11.5V6a2 2 0 0 1 3.6-1.2" /><path d="M7 19l-1 2M17 19l1 2" /></>,
    faucet: <><circle cx="12" cy="14" r="4.5" /><path d="M12 14V10.2M5 5h7.5a3 3 0 0 1 3 3v1" /><path d="M14 9.5h3" /></>,
    door: <><rect x="4" y="3" width="9" height="18" rx="1" /><rect x="11" y="3" width="9" height="18" rx="1" /><path d="M9.5 11v3M14.5 11v3" /></>,
    extras: <><path d="M4 9h16" /><circle cx="5" cy="9" r="1.6" /><circle cx="19" cy="9" r="1.6" /><path d="M6 16h7l-3.5 3.5z" /></>,
    layout: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M9 9.5V20" /></>,
    expand: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
    close: <><path d="M6 6l12 12M18 6L6 18" /></>,
    check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    undo: <><path d="M9 7L4.5 11.5 9 16" /><path d="M5 11.5h9a5 5 0 0 1 0 10h-2" /></>,
    camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></>,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-5 4 4 2.5-2.5L20 18" /></>,
    rotate: <><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    arrowLeft: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
    up: <><path d="M12 19V5M6 11l6-6 6 6" /></>,
    down: <><path d="M12 5v14M6 13l6 6 6-6" /></>,
    left: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
    right: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    move: <><path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.5v.5" /></>,
    trash: <><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></>,
    sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>,
    ruler: <><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M6 8v3M9.5 8v4.5M13 8v3M16.5 8v4.5" /></>,
    chevronDown: <><path d="M6 9l6 6 6-6" /></>,
    chevronUp: <><path d="M6 15l6-6 6 6" /></>,
    phone: <><path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" /></>,
    compare: <><path d="M12 3v18" /><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M8 10l-2 2 2 2M16 10l2 2-2 2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {p[name] || null}
    </svg>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" /><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>;
}

export const money0 = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
