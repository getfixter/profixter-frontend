"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Studio's pictures: the photo with its dots, the new design, and a
 * before/after slider. All canvases stay mounted (the engine draws into them);
 * `view` only decides which one is shown.
 */
export default function StudioStage({
  glRef, beforeRef, afterRef, svgRef, loupeRef,
  view,
  busy,
  renderStamp,
  drawCompare,
  illustrativeNote = "Illustrative preview. Colors, patterns and fit are approximate until measured on site.",
  className = "",
  compact = false,
}: {
  glRef: React.Ref<HTMLCanvasElement>;
  beforeRef: React.Ref<HTMLCanvasElement>;
  afterRef: React.Ref<HTMLCanvasElement>;
  svgRef: React.Ref<SVGSVGElement>;
  loupeRef: React.Ref<HTMLCanvasElement>;
  view: "photo" | "result" | "compare";
  busy?: string | null;
  renderStamp?: number;
  drawCompare?: (b: HTMLCanvasElement, a: HTMLCanvasElement) => void;
  illustrativeNote?: string;
  className?: string;
  /** smaller picture (phones, while choosing options) */
  compact?: boolean;
}) {
  const maxH = compact ? "max-h-[34vh] sm:max-h-[40vh] lg:max-h-[58vh]" : "max-h-[58vh]";
  const cmpBefore = useRef<HTMLCanvasElement>(null);
  const cmpAfter = useRef<HTMLCanvasElement>(null);
  const [split, setSplit] = useState(50);

  useEffect(() => {
    if (view === "compare" && drawCompare && cmpBefore.current && cmpAfter.current) drawCompare(cmpBefore.current, cmpAfter.current);
  }, [view, renderStamp, drawCompare]);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={glRef} hidden />
      <div className={view === "photo" ? "block" : "hidden"}>
        <div className="relative mx-auto w-fit max-w-full touch-none select-none leading-[0]" data-studio-photo>
          <canvas ref={beforeRef} className={`block h-auto ${maxH} w-auto max-w-full rounded-2xl`} />
          <svg ref={svgRef} className="absolute inset-0 h-full w-full" aria-label="Wall corner dots" />
        </div>
      </div>
      <div className={view === "result" ? "block" : "hidden"}>
        <div className="relative mx-auto w-fit max-w-full leading-[0]">
          <canvas ref={afterRef} className={`block h-auto ${maxH} w-auto max-w-full rounded-2xl`} data-studio-after />
          <span className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] leading-tight text-white">{illustrativeNote}</span>
        </div>
      </div>
      <div className={view === "compare" ? "block" : "hidden"}>
        <div className="relative mx-auto w-fit max-w-full leading-[0]">
          <canvas ref={cmpBefore} className={`block h-auto ${maxH} w-auto max-w-full rounded-2xl`} />
          <div className="absolute inset-0 overflow-hidden rounded-2xl" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
            <canvas ref={cmpAfter} className="block h-full w-full" />
          </div>
          <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
            <div className="h-full w-[3px] -translate-x-1/2 bg-white shadow" />
          </div>
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">Before</span>
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-[#306EEC] px-2 py-0.5 text-[11px] font-semibold text-white">After</span>
        </div>
        <input
          type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))}
          aria-label="Slide to compare before and after" className="mx-auto mt-3 block h-8 w-full max-w-md accent-[#306EEC]"
        />
      </div>
      {busy ? (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/80 p-6 text-center text-[15px] font-semibold text-[#0B1628]" role="status">{busy}</div>
      ) : null}
      <div className="pointer-events-none fixed z-50 hidden h-[132px] w-[132px] overflow-hidden rounded-full border-[3px] border-white shadow-xl" aria-hidden>
        <canvas ref={loupeRef} width={132} height={132} className="h-full w-full" />
      </div>
    </div>
  );
}
