"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from "react";
import { PHOTO_ACCEPT } from "../photoPrep";
import { useEscape } from "./useEscape";
import { Icon, Spinner, btn } from "./ui";

export type PhotoStep = "choose" | "working" | "confirm" | "adjust" | "plumbing";

/**
 * Choosing where the photo comes from. Two clear actions: the camera (only
 * this one asks for capture) and the photo library / files (never forced into
 * the camera). The example bathroom is always one tap away.
 */
export function PhotoSource({ open, onClose, onFile, onExample, error, privacyNote, hasPhoto }: {
  open: boolean; onClose: () => void; onFile: (f: File, via: "camera" | "library") => void; onExample: () => void; error?: string | null; privacyNote?: string; hasPhoto: boolean;
}) {
  const cam = useRef<HTMLInputElement>(null), lib = useRef<HTMLInputElement>(null);
  useEscape(open, onClose);
  if (!open) return null;
  const pick = (via: "camera" | "library") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f, via);
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Add a photo" onClick={onClose}>
      <div className="studio-rise w-full max-w-md rounded-t-[28px] bg-[#FBFAF8] p-5 sm:rounded-[28px]" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#DDD6CB] sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#1C1B19]">{hasPhoto ? "Change your photo" : "See it in your bathroom"}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-[#5F5A52]">Stand back so the whole tub or shower is in the picture, walls and floor included.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/5"><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <PhotoTip />
        <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick("camera")} data-testid="photo-camera-input" />
        <input ref={lib} type="file" accept={PHOTO_ACCEPT} className="hidden" onChange={pick("library")} data-testid="photo-input" />
        <div className="mt-4 grid gap-2.5">
          <button type="button" className={btn.primary} onClick={() => cam.current?.click()} data-testid="photo-take"><Icon name="camera" className="h-5 w-5" />Take a photo</button>
          <button type="button" className={btn.secondary} onClick={() => lib.current?.click()} data-testid="photo-choose"><Icon name="image" className="h-5 w-5" />Choose from your photos</button>
          <button type="button" className={btn.ghost} onClick={onExample} data-testid="photo-use-example">Use the example bathroom instead</button>
        </div>
        {error ? <p className="mt-3 rounded-2xl bg-[#FBEDE7] px-4 py-3 text-[14px] leading-snug text-[#9A3412]" role="alert">{error}</p> : null}
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#8C867C]">{privacyNote || "Your photo is private: only you and the Profixter team see it, and the camera's location data is removed."} JPEG, PNG, WebP or iPhone photos.</p>
      </div>
    </div>
  );
}

function PhotoTip() {
  return (
    <svg viewBox="0 0 320 120" className="mt-4 h-auto w-full rounded-2xl bg-[#F1EDE6]" aria-hidden>
      <rect x="92" y="18" width="136" height="88" fill="#fff" stroke="#D9D2C6" />
      <path d="M92 18l-26-12M228 18l26-12M92 106l-26 10M228 106l26 10" stroke="#D9D2C6" />
      <rect x="98" y="76" width="124" height="26" rx="6" fill="#ECE7DF" />
      <circle cx="112" cy="56" r="4" fill="#A47A3E" />
      <rect x="60" y="8" width="200" height="106" rx="10" fill="none" stroke="#1C1B19" strokeWidth="2.5" strokeDasharray="8 6" />
    </svg>
  );
}

const CORNERS: { key: string; title: string; tip: string }[] = [
  { key: "wallBL", title: "Bottom left corner", tip: "Drag it to where the back wall meets the tub, on the left." },
  { key: "wallBR", title: "Bottom right corner", tip: "Drag it to where the back wall meets the tub, on the right." },
  { key: "wallTR", title: "Top right corner", tip: "Drag it to the top of the tile (or wall) on the right." },
  { key: "wallTL", title: "Top left corner", tip: "Drag it to the top of the tile on the left, level with the right one." },
];

/** The photo steps, shown in the panel while the picture shows the photo. */
export function PhotoSteps({ step, snap, engine, onYes, onAdjust, onDoneAdjust, onRotate, onReplace, onExample, onPlumbing, onFinish, rotating }: {
  step: PhotoStep; snap: any; engine: () => any; onYes: () => void; onAdjust: () => void; onDoneAdjust: () => void; onRotate: () => void; onReplace: () => void;
  onExample: () => void; onPlumbing: (w: "left" | "facing" | "right") => void; onFinish: () => void; rotating?: boolean;
}) {
  const e = engine();
  if (step === "working") {
    return (
      <div className="grid min-h-[180px] place-items-center text-center" role="status">
        <div><Spinner className="mx-auto h-7 w-7 text-[#1C1B19]" /><p className="mt-3 text-[15px] font-medium text-[#1C1B19]">{rotating ? "Turning your photo…" : "Preparing your photo…"}</p><p className="mt-1 text-[13px] text-[#8C867C]">Finding the tub or shower area.</p></div>
      </div>
    );
  }
  if (step === "confirm") {
    const conf = snap?.suggestion?.confidence ?? 0;
    const found = Boolean(snap?.suggestion);
    const bad = snap?.photoCheck && !snap.photoCheck.ok;
    return (
      <div className="studio-fade" data-testid="photo-confirm">
        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-[#1C1B19]">Is this the area you&rsquo;d like to replace?</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#5F5A52]">
          {!found || conf < 0.5 || bad
            ? "We couldn't find the tub area clearly. Adjust the highlighted corners, or use the example bathroom."
            : "The highlighted wall is where the new panels go; the gold outline is the new tub or base."}
        </p>
        <div className="mt-4 grid gap-2.5">
          <button type="button" className={btn.primary} onClick={onYes} disabled={bad} data-testid="photo-yes"><Icon name="check" className="h-5 w-5" />Yes, that&rsquo;s right</button>
          <button type="button" className={btn.secondary} onClick={onAdjust} data-testid="photo-adjust">Adjust the corners</button>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          <button type="button" className={btn.ghost} onClick={onRotate} data-testid="photo-rotate"><Icon name="rotate" className="h-5 w-5" />Rotate</button>
          <button type="button" className={btn.ghost} onClick={onReplace}><Icon name="image" className="h-5 w-5" />Another photo</button>
          <button type="button" className={btn.ghost} onClick={onExample} data-testid="photo-back-example">Use the example</button>
        </div>
      </div>
    );
  }
  if (step === "adjust") {
    const i = Math.max(0, CORNERS.findIndex((c) => c.key === snap?.activeMark));
    const c = CORNERS[i];
    const bad = snap?.photoCheck && !snap.photoCheck.ok;
    return (
      <div className="studio-fade" data-testid="photo-adjust-panel">
        <div className="flex items-center gap-3">
          <CornerDiagram active={c.key} />
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#8C867C]">Corner {i + 1} of 4</div>
            <h3 className="text-[19px] font-semibold text-[#1C1B19]">{c.title}</h3>
            <p className="mt-0.5 text-[14px] leading-snug text-[#5F5A52]">{c.tip}</p>
          </div>
        </div>
        {bad ? <p className="mt-3 rounded-2xl bg-[#FBEDE7] px-4 py-2.5 text-[13.5px] text-[#9A3412]" role="status">This outline doesn&rsquo;t line up yet. Check that each corner sits on its spot.</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className={`${btn.secondary} flex-1`} onClick={() => e?.setActiveMark(CORNERS[(i + 3) % 4].key)} aria-label="Previous corner"><Icon name="arrowLeft" className="h-5 w-5" /></button>
          {i < 3
            ? <button type="button" className={`${btn.primary} flex-[3]`} onClick={() => e?.setActiveMark(CORNERS[i + 1].key)} data-testid="corner-next">Next corner</button>
            : <button type="button" className={`${btn.primary} flex-[3]`} onClick={onDoneAdjust} disabled={bad} data-testid="corner-done">Looks right</button>}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <button type="button" className={btn.ghost} onClick={() => e?.undoMarks()} disabled={!snap?.canUndoMarks}><Icon name="undo" className="h-5 w-5" />Undo</button>
          <button type="button" className={btn.ghost} onClick={() => e?.resetMarks()}>Start over</button>
          <button type="button" className={btn.ghost} onClick={onExample}>Use the example</button>
        </div>
      </div>
    );
  }
  if (step === "plumbing") {
    const m = snap?.design?.measure || {};
    const opts: ["left" | "facing" | "right", string][] = [];
    if (m.leftWall) opts.push(["left", "Left wall"]);
    opts.push(["facing", "Back wall"]);
    if (m.rightWall) opts.push(["right", "Right wall"]);
    const cur = snap?.design?.plumbing?.wall;
    return (
      <div className="studio-fade" data-testid="photo-plumbing">
        <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-[#1C1B19]">Where is the faucet?</h3>
        <p className="mt-1.5 text-[14px] text-[#5F5A52]">Tap the wall with the faucet in your photo.</p>
        <div className={`mt-4 grid gap-2.5 ${opts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {opts.map(([w, l]) => (
            <button key={w} type="button" aria-pressed={cur === w} onClick={() => onPlumbing(w)} data-testid={`photo-plumbing-${w}`}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] p-2 text-[14px] font-semibold ring-1 transition ${cur === w ? "bg-[#1C1B19] text-white ring-[#1C1B19]" : "bg-white text-[#1C1B19] ring-[#E7E1D8]"}`}>
              <WallDiagram wall={w} />{l}
            </button>
          ))}
        </div>
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={onFinish} disabled={!cur} data-testid="photo-finish">See my new bathroom</button>
      </div>
    );
  }
  return null;
}

function CornerDiagram({ active }: { active: string }) {
  const P: Record<string, [number, number]> = { wallTL: [16, 12], wallTR: [56, 12], wallBR: [56, 44], wallBL: [16, 44] };
  return (
    <svg viewBox="0 0 72 60" className="h-[60px] w-[72px] shrink-0 rounded-2xl bg-[#F1EDE6]" aria-hidden>
      <path d="M16 12L4 4M56 12l12-8M16 44L4 54M56 44l12 10" stroke="#D2CABD" strokeWidth="1.5" />
      <rect x="16" y="12" width="40" height="32" fill="#fff" stroke="#C9C1B4" />
      <rect x="10" y="44" width="52" height="9" rx="2" fill="#E5DFD5" />
      {Object.entries(P).map(([k, [x, y]]) => <circle key={k} cx={x} cy={y} r={k === active ? 5.5 : 3.2} fill={k === active ? "#A47A3E" : "#1C1B19"} stroke="#fff" strokeWidth="1.5" />)}
    </svg>
  );
}
function WallDiagram({ wall }: { wall: "left" | "facing" | "right" }) {
  const hl = (w: string) => (w === wall ? "#A47A3E" : "#CFC7BA");
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-hidden>
      <path d="M8 4v24" stroke={hl("left")} strokeWidth="4" strokeLinecap="round" />
      <path d="M8 4h32" stroke={hl("facing")} strokeWidth="4" strokeLinecap="round" />
      <path d="M40 4v24" stroke={hl("right")} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
