"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

/**
 * Signature capture.
 *
 * Built for a customer holding someone else's phone, so the details matter:
 *
 *  - Pointer Events, so finger, Apple Pencil and S Pen all work through one
 *    code path rather than three.
 *  - `touch-action: none` plus preventDefault on the canvas, because the
 *    default browser behaviour for a finger drag is to scroll the page - which
 *    makes signing impossible on a phone.
 *  - Backing store scaled to devicePixelRatio, otherwise strokes are soft and
 *    blocky on exactly the retina screens this is used on.
 *  - Quadratic smoothing between samples: raw lineTo on a fast finger gives
 *    visible polygon corners.
 *  - Strokes are kept as arrays, so Undo removes a stroke rather than clearing
 *    everything, and the "is it blank" test is a real check rather than a
 *    pixel scan.
 *
 * The exported image is a transparent PNG. The backend validates it again -
 * this component is convenience, not a security boundary.
 */

type Point = { x: number; y: number };
type Stroke = Point[];

export interface SignaturePadHandle {
  /** Transparent PNG data URL, or null when nothing has been drawn. */
  toDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  /** Notifies the parent so the submit button can enable/disable. */
  onChange?: (hasSignature: boolean) => void;
  height?: number;
  disabled?: boolean;
  label?: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { onChange, height = 220, disabled = false, label },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  /** Redraw everything from the stroke model. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2.4;

    for (const stroke of strokesRef.current) {
      if (stroke.length === 1) {
        // A single tap still deserves a mark.
        context.beginPath();
        context.arc(stroke[0].x, stroke[0].y, 1.3, 0, Math.PI * 2);
        context.fillStyle = "#0f172a";
        context.fill();
        continue;
      }
      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i += 1) {
        // Curve through the midpoint so fast strokes stay smooth.
        const midX = (stroke[i].x + stroke[i + 1].x) / 2;
        const midY = (stroke[i].y + stroke[i + 1].y) / 2;
        context.quadraticCurveTo(stroke[i].x, stroke[i].y, midX, midY);
      }
      const last = stroke[stroke.length - 1];
      context.lineTo(last.x, last.y);
      context.stroke();
    }
  }, []);

  /** Size the backing store to the CSS box at device resolution. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
    const observer = new ResizeObserver(resize);
    if (canvasRef.current) observer.observe(canvasRef.current);
    window.addEventListener("orientationchange", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
  }, [resize]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const notify = (value: boolean) => {
    setHasSignature(value);
    onChange?.(value);
  };

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    // Stops the page scrolling under a finger and keeps the stroke on this
    // element even if the pointer leaves it.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    currentRef.current = [pointFrom(event)];
    strokesRef.current.push(currentRef.current);
    redraw();
  };

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !currentRef.current) return;
    event.preventDefault();
    currentRef.current.push(pointFrom(event));
    redraw();
    if (!hasSignature) notify(true);
  };

  const handleUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentRef.current) return;
    event.preventDefault();
    currentRef.current = null;
    notify(strokesRef.current.length > 0);
  };

  const clear = useCallback(() => {
    strokesRef.current = [];
    currentRef.current = null;
    redraw();
    notify(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redraw]);

  const undo = () => {
    strokesRef.current.pop();
    redraw();
    notify(strokesRef.current.length > 0);
  };

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => strokesRef.current.length === 0,
      clear,
      toDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas || strokesRef.current.length === 0) return null;
        return canvas.toDataURL("image/png");
      },
    }),
    [clear]
  );

  return (
    <div className="w-full">
      {label && (
        <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      )}
      <div className="relative rounded-[8px] border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: "none" }}
          className="block w-full rounded-[8px]"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={handleUp}
          aria-label="Signature area"
          role="img"
        />

        {/* Signing rule, so it reads as a place to sign rather than a blank box. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-300" />
        {!hasSignature && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-slate-400">
            Sign above the line
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">
          {hasSignature ? "Looks good? Continue below." : "Use your finger or a stylus."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!hasSignature || disabled}
            className="rounded-[8px] border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!hasSignature || disabled}
            className="rounded-[8px] border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

export default SignaturePad;
