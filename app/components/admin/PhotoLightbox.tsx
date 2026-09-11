"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A viewer for photographs, where the photograph is the point.
 *
 * Not BookingImageGallery. That one carries HEIC conversion, download buttons
 * and a gradient on every surface because it serves a different job - proving
 * what an operational photo shows. Here the image is the product, so the chrome
 * is a dark ground, a counter, and controls that get out of the way.
 *
 * Gestures are the ones a phone already taught people: swipe across to move,
 * swipe down to dismiss. Both are horizontal-or-vertical decisions made once at
 * the start of a drag, so a diagonal thumb does not fight the page.
 */

export interface LightboxItem {
  id: string;
  url: string;
  title?: string;
  subtitle?: string;
}

interface PhotoLightboxProps {
  items: LightboxItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  /** Rendered under the image - moderation controls, usually. */
  actions?: React.ReactNode;
}

const SWIPE_DISMISS_PX = 110;
const SWIPE_NEXT_PX = 60;

export default function PhotoLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  actions,
}: PhotoLightboxProps) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  /*
   * Which photo has finished loading, rather than a boolean reset on change.
   * The boolean needed an effect to clear it every time the index moved, which
   * is a render caused by a render; asking "is the one on screen the one that
   * loaded" needs no effect at all.
   */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number; axis: "" | "x" | "y" } | null>(null);

  const item = items[index];

  const go = useCallback(
    (step: number) => {
      if (items.length < 2) return;
      onIndexChange((index + step + items.length) % items.length);
    },
    [index, items.length, onIndexChange]
  );

  /* Escape closes, arrows move. Nothing surprising, which is the idea. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  /* The page behind must not scroll while this is over it. */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!item) return null;

  const loaded = loadedId === item.id;

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") return;
    start.current = { x: event.clientX, y: event.clientY, axis: "" };
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;

    /* Commit to one axis early so the gesture feels decided, not wobbly. */
    if (!start.current.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      start.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (start.current.axis === "x") setDrag({ x: dx, y: 0, active: true });
    else if (start.current.axis === "y") setDrag({ x: 0, y: Math.max(0, dy), active: true });
  };

  const onPointerUp = () => {
    if (!start.current) return;
    const { x, y } = drag;
    const axis = start.current.axis;
    start.current = null;

    if (axis === "y" && y > SWIPE_DISMISS_PX) {
      onClose();
      return;
    }
    if (axis === "x" && Math.abs(x) > SWIPE_NEXT_PX) go(x < 0 ? 1 : -1);
    setDrag({ x: 0, y: 0, active: false });
  };

  const dismissProgress = Math.min(drag.y / 320, 0.75);

  return (
    <div
      className="fixed inset-0 z-[1200] flex flex-col"
      /*
       * Opaque at rest. A viewer that lets the admin page ghost through behind
       * the photograph reads as unfinished, and the thing being looked at here
       * is the photograph. The ground only thins while a dismiss drag is in
       * progress, where seeing what you are returning to is the point.
       */
      style={{ background: `rgba(9, 12, 18, ${1 - dismissProgress})` }}
      role="dialog"
      aria-modal="true"
      aria-label={item.title || "Photo"}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-white sm:px-4">
        <div className="min-w-0">
          {item.title && <div className="truncate text-sm font-semibold">{item.title}</div>}
          {item.subtitle && (
            <div className="truncate text-xs text-white/60">{item.subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 1 && (
            <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold tabular-nums">
              {index + 1} / {items.length}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center px-2 sm:px-6"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!loaded && (
          <div className="absolute h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.title || "Work photo"}
          onLoad={() => setLoadedId(item.id)}
          draggable={false}
          className="max-h-full max-w-full rounded-lg object-contain"
          style={{
            transform: `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${1 - dismissProgress * 0.12})`,
            transition: drag.active ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            opacity: loaded ? 1 : 0,
          }}
        />

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:flex"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:flex"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {actions && (
        <div
          className="border-t border-white/10 bg-black/40 px-3 py-3 sm:px-4"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
