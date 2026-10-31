"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

/**
 * One before/after comparison.
 *
 * The AFTER is the base image; the BEFORE sits on top, clipped to the left of
 * the divider. `pos` is how much of the BEFORE shows: 100 is all before, 0 is
 * all after.
 *
 * MOTION. When the card first scrolls into view the divider sweeps once from
 * mostly-before to mostly-after and settles in the middle, so the change is
 * shown before anybody has to discover the handle. It runs once, never loops,
 * and stops for good the moment the visitor touches, focuses or presses
 * anything on the card. With reduced motion it does not run at all.
 *
 * DRAGGING. Only from the handle's hit zone (48px wide, touch-action: none).
 * Everywhere else the card keeps pan-x pan-y, so a swipe across the picture
 * scrolls the carousel rather than fighting it. Keyboard (the handle is a
 * role="slider") and the Before / After buttons cover everyone who cannot drag.
 */

export interface BeforeAfterProps {
  id: string;
  title: string;
  beforeThumb: string;
  beforeImage: string;
  afterThumb: string;
  afterImage: string;
  width?: number;
  height?: number;
  /** The first card on the page loads eagerly; every other one is lazy. */
  eager?: boolean;
  /** Called once, on the first manual interaction (drag, key or button). */
  onFirstInteraction?: (id: string) => void;
}

const START = 92;
const LOW = 10;
const REST = 50;
const SWEEP_MS = 1450;
const SETTLE_MS = 850;
const DELAY_MS = 350;
const STEP = 5;

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function BeforeAfter({
  id,
  title,
  beforeThumb,
  beforeImage,
  afterThumb,
  afterImage,
  width,
  height,
  eager = false,
  onFirstInteraction,
}: BeforeAfterProps) {
  const w = width && width > 0 ? width : 1280;
  const h = height && height > 0 ? height : 960;
  /* Same box for both images; a wildly tall or wide file is cropped, not obeyed. */
  const ratio = Math.min(16 / 9, Math.max(3 / 4, w / h));

  /*
   * Server render and first paint at the resting middle: if scripts never run,
   * or the visitor prefers reduced motion, that is the right picture. The
   * effect below moves it to the start of the sweep before the card is seen.
   */
  const [pos, setPos] = useState(REST);
  const [gliding, setGliding] = useState(false);
  const [dragging, setDragging] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const playedRef = useRef(false);
  const touchedRef = useRef(false);
  const dragPointerRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    cancelledRef.current = true;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    frameRef.current = null;
    timerRef.current = null;
  }, []);

  /** Any manual input: the sweep is over for this card, and it counts once. */
  const takeOver = useCallback(() => {
    stopAnimation();
    if (!touchedRef.current) {
      touchedRef.current = true;
      onFirstInteraction?.(id);
    }
  }, [id, onFirstInteraction, stopAnimation]);

  /* ---------------------------- automatic reveal --------------------------- */
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;

    let primed = false;

    const run = () => {
      if (cancelledRef.current || playedRef.current) return;
      playedRef.current = true;
      const began = performance.now();
      const tick = (now: number) => {
        if (cancelledRef.current) return;
        const elapsed = now - began;
        if (elapsed < SWEEP_MS) {
          setPos(START + (LOW - START) * easeInOut(elapsed / SWEEP_MS));
        } else if (elapsed < SWEEP_MS + SETTLE_MS) {
          setPos(LOW + (REST - LOW) * easeInOut((elapsed - SWEEP_MS) / SETTLE_MS));
        } else {
          setPos(REST);
          frameRef.current = null;
          return;
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        /*
         * The observer's first report arrives straight after mounting: that is
         * where the divider moves to the start of the sweep, before the card
         * has been looked at (unless the visitor already took over).
         */
        if (!primed) {
          primed = true;
          if (!cancelledRef.current) setPos(START);
        }
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          if (!playedRef.current && !cancelledRef.current && timerRef.current === null) {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              run();
            }, DELAY_MS);
          }
        } else if (timerRef.current !== null && !playedRef.current) {
          /* Scrolled away before it started: wait for the next proper look. */
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (playedRef.current) observer.disconnect();
      },
      { threshold: [0, 0.55, 1] }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      frameRef.current = null;
      timerRef.current = null;
    };
  }, []);

  /* ------------------------------- dragging -------------------------------- */
  const posFromClientX = (clientX: number) => {
    const stage = stageRef.current;
    if (!stage) return pos;
    /*
     * Ratio of two numbers measured in the same viewport space, so the site's
     * CSS zoom (site-scale.css) cancels out.
     */
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return pos;
    return clamp(((clientX - rect.left) / rect.width) * 100);
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    takeOver();
    event.preventDefault();
    event.stopPropagation();
    setGliding(false);
    setDragging(true);
    dragPointerRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* A synthetic pointer cannot always be captured; moves still arrive. */
    }
    event.currentTarget.focus({ preventScroll: true });
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    setPos(posFromClientX(event.clientX));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerRef.current !== event.pointerId) return;
    dragPointerRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released. */
    }
  };

  /* ------------------------- keyboard and buttons -------------------------- */
  const jumpTo = (value: number) => {
    takeOver();
    setGliding(!prefersReducedMotion());
    setPos(clamp(value));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: pos - STEP,
      ArrowDown: pos - STEP,
      ArrowRight: pos + STEP,
      ArrowUp: pos + STEP,
      PageDown: pos - STEP * 2,
      PageUp: pos + STEP * 2,
      Home: 0,
      End: 100,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    takeOver();
    setGliding(false);
    setPos(clamp(moves[event.key]));
  };

  const rounded = Math.round(pos);
  const clip = `inset(0 ${100 - pos}% 0 0)`;
  const sizes = "(min-width: 1024px) 420px, (min-width: 640px) 60vw, 88vw";

  return (
    <div
      ref={rootRef}
      className={`wwd-ba${gliding ? " is-gliding" : ""}${dragging ? " is-dragging" : ""}`}
      data-testid="wwd-ba"
      /* Any touch on the picture ends the sweep, without starting a drag. */
      onPointerDownCapture={stopAnimation}
      onTransitionEnd={(event) => {
        /* The glide is over when the divider lands; a chip fading is not it. */
        if (event.propertyName === "left") setGliding(false);
      }}
    >
      <div ref={stageRef} className="wwd-ba__stage" style={{ aspectRatio: String(ratio) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="wwd-ba__img"
          src={afterImage || afterThumb}
          srcSet={afterThumb && afterImage ? `${afterThumb} 480w, ${afterImage} 1280w` : undefined}
          sizes={sizes}
          alt={`After: ${title}`}
          width={w}
          height={h}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="wwd-ba__img wwd-ba__before"
          src={beforeImage || beforeThumb}
          srcSet={beforeThumb && beforeImage ? `${beforeThumb} 480w, ${beforeImage} 1280w` : undefined}
          sizes={sizes}
          alt={`Before: ${title}`}
          width={w}
          height={h}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          style={{ clipPath: clip, WebkitClipPath: clip }}
        />

        <span className="wwd-ba__chip wwd-ba__chip--before" aria-hidden="true" style={{ opacity: pos < 14 ? 0 : 1 }}>
          Before
        </span>
        <span className="wwd-ba__chip wwd-ba__chip--after" aria-hidden="true" style={{ opacity: pos > 86 ? 0 : 1 }}>
          After
        </span>

        <div className="wwd-ba__divider" style={{ left: `${pos}%` }} aria-hidden="true">
          <span className="wwd-ba__line" />
        </div>

        <div
          className="wwd-ba__handle"
          style={{ left: `${pos}%` }}
          role="slider"
          tabIndex={0}
          aria-label={`Before and after comparison: ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
          aria-valuetext={`${rounded}% before, ${100 - rounded}% after`}
          aria-orientation="horizontal"
          data-testid="wwd-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={onKeyDown}
          onFocus={stopAnimation}
        >
          <span className="wwd-ba__knob">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>

      <div className="wwd-ba__jumps">
        <button type="button" className="wwd-ba__jump" aria-pressed={rounded === 100} onClick={() => jumpTo(100)}>
          Before
        </button>
        <span className="wwd-ba__jumps-sep" aria-hidden="true" />
        <button type="button" className="wwd-ba__jump" aria-pressed={rounded === 0} onClick={() => jumpTo(0)}>
          After
        </button>
      </div>
    </div>
  );
}
