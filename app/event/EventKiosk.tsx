"use client";

/**
 * The public event kiosk: an iPad on a tripod at a Profixter booth.
 *
 * A visitor can do exactly three things here: watch, swipe left/right, and
 * tap "Get My First Visit Free". There are no other controls, no admin panel,
 * no keyboard shortcuts, no links, and the photos themselves are not
 * clickable, draggable or long-pressable. Photo management stays in
 * /admin/event-display/review, behind the admin API.
 *
 * Photos come from the public kiosk feed (opaque ids; images served by our
 * API, never S3 URLs, so no booking date or number reaches the browser).
 *
 * The call to action signs out whatever session this browser holds, using
 * the site's own logout, before opening registration. The iPad may have been
 * set up while signed in as an admin, and a visitor must never register, or
 * see anything, inside that session.
 *
 * Built to run all day: at most two scenes are mounted at once, only a small
 * buffer of photos is preloaded (display-engine.ts), every timer and animation
 * is torn down with its scene, and after a few hours the page reloads itself
 * at a quiet moment, right after confirming the API still answers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { fetchPublicPhotos } from "@/lib/event-display-service";
import { KIOSK_RETURN_KEY, clearKioskCarryOver } from "@/lib/event-kiosk";
import {
  RESUME_AFTER_MS,
  WALL_EXPAND_LEAD_MS,
  PhotoPool,
  brandScene,
  heroScene,
  newPlannerState,
  photosIn,
  planScene,
  type Measured,
  type Motion,
  type Scene,
} from "./display-engine";
import "./event-kiosk.css";

const LOGO = "/images/logo-footer.svg";
const SIGNUP_PATH = "/signup?source=event";
const REFRESH_MS = 30 * 60 * 1000;
const REFRESH_WHEN_EMPTY_MS = 60 * 1000;
const RELOAD_AFTER_MS = 4 * 60 * 60 * 1000;
const SWIPE_PX = 56;
const SLIDE_MS = 520;
const HISTORY_LIMIT = 60;
const CAPTION_MS = 7000;

/** The one persistent line under the mark: what Profixter is, in five words. */
const TAGLINE = "Your handyman. Every month.";

/** Short, readable from across a room; rotates in a fixed place. */
const CAPTIONS = [
  "Something broken at home?",
  "Real requests from Long Island homes.",
  "Small repairs. One simple membership.",
  "There’s always something to fix.",
  "Real homes. Real things to fix.",
];

export default function EventKiosk() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const aspectRef = useRef(0.75);

  const [layers, setLayers] = useState<Scene[]>([]);
  const currentRef = useRef<Scene | null>(null);
  const [caption, setCaption] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const plannerRef = useRef(newPlannerState());
  const timerRef = useRef<number | undefined>(undefined);
  const waitingRef = useRef(false);
  const historyRef = useRef<Measured[]>([]);
  const backRef = useRef(0);
  const startedAtRef = useRef(0);
  const reloadReadyRef = useRef(false);
  const countRef = useRef<number | null>(null);
  const tickRef = useRef<() => void>(() => {});
  const dragRef = useRef<{ x: number; y: number; id: number; t: number; active: boolean } | null>(null);

  const [pool] = useState(() => new PhotoPool());
  useEffect(() => {
    pool.listen(() => {
      if (waitingRef.current && !dragRef.current?.active) {
        waitingRef.current = false;
        tickRef.current();
      }
    });
    return () => pool.listen(() => {});
  }, [pool]);

  /* ---------- showing scenes ---------- */

  const show = useCallback((scene: Scene) => {
    currentRef.current = scene;
    setLayers((prev) => [...prev.slice(-1), scene]);
  }, []);

  const schedule = useCallback((ms: number) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => tickRef.current(), ms);
  }, []);

  const remember = useCallback((scene: Scene) => {
    const history = historyRef.current;
    history.push(...photosIn(scene));
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
  }, []);

  const tick = useCallback(() => {
    window.clearTimeout(timerRef.current);
    const planner = plannerRef.current;
    backRef.current = 0;

    if (pool.size === 0) {
      // Nothing to show (or not loaded yet): stay on the brand, and start the
      // moment the first photo is ready.
      waitingRef.current = true;
      if (currentRef.current?.kind !== "brand") show(brandScene(planner));
      return;
    }

    const scene = planScene(planner, pool, aspectRef.current);
    if (!scene) {
      waitingRef.current = true;
      schedule(4000);
      return;
    }

    if (scene.kind === "brand" && reloadReadyRef.current) {
      // A dark, quiet moment and a confirmed connection: start fresh.
      window.location.reload();
      return;
    }

    remember(scene);
    show(scene);
    schedule(scene.duration);
  }, [pool, remember, schedule, show]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  /** The element of the scene currently on top, for drag and slide. */
  const topLayerEl = useCallback(() => {
    const all = rootRef.current?.querySelectorAll<HTMLElement>(".ed-layer");
    return all && all.length ? all[all.length - 1] : null;
  }, []);

  /**
   * A finger moved the show: one photo slides in from the side it was pulled
   * toward, the old one slides out, and autoplay waits RESUME_AFTER_MS.
   */
  const step = useCallback(
    (direction: 1 | -1) => {
      const planner = plannerRef.current;
      const history = historyRef.current;
      let photo: Measured | null = null;
      // A person is driving now: autoplay comes back on the resume timer only,
      // not because a photo it was waiting for finished loading.
      waitingRef.current = false;

      if (direction < 0) {
        const next = Math.min(backRef.current + 1, history.length - 1);
        if (next >= 1) {
          backRef.current = next;
          photo = history[history.length - 1 - next];
        }
      } else if (backRef.current > 0) {
        backRef.current -= 1;
        photo = history[history.length - 1 - backRef.current];
      } else {
        planner.forcedHero = null;
        photo = pool.take();
        if (photo) history.push(photo);
      }

      const outgoing = topLayerEl();
      if (!photo) {
        if (outgoing) snapBack(outgoing);
        schedule(RESUME_AFTER_MS);
        return;
      }
      if (outgoing) {
        outgoing.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.22, 0.8, 0.2, 1)`;
        outgoing.style.transform = `translate3d(${direction > 0 ? -100 : 100}%, 0, 0)`;
      }
      show(heroScene(planner, photo, aspectRef.current, { fade: SLIDE_MS, from: direction }));
      schedule(RESUME_AFTER_MS);
    },
    [pool, schedule, show, topLayerEl]
  );

  const onBroken = useCallback(
    (id: string) => {
      pool.markBroken(id);
      const current = currentRef.current;
      if (current && photosIn(current).some((p) => p.id === id) && !dragRef.current?.active) {
        schedule(300);
      }
    },
    [pool, schedule]
  );

  // Drop the layer underneath once the one on top has fully arrived.
  useEffect(() => {
    if (layers.length < 2) return;
    const top = layers[layers.length - 1];
    const t = window.setTimeout(() => {
      setLayers((l) => (l.length > 1 && l[l.length - 1].key === top.key ? [top] : l));
    }, top.fade + 200);
    return () => window.clearTimeout(t);
  }, [layers]);

  /* ---------- photos ---------- */

  const refresh = useCallback(async () => {
    const result = await fetchPublicPhotos();
    if (!result.ok) return false;
    pool.setPhotos(result.data.photos);
    countRef.current = result.data.photos.length;
    if (Date.now() - startedAtRef.current > RELOAD_AFTER_MS) reloadReadyRef.current = true;
    return true;
  }, [pool]);

  useEffect(() => {
    let cancelled = false;
    let t: number | undefined;
    const loop = async () => {
      const ok = await refresh();
      if (cancelled) return;
      t = window.setTimeout(loop, ok && pool.size > 0 ? REFRESH_MS : REFRESH_WHEN_EMPTY_MS);
    };
    void loop();
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pool, refresh]);

  // The opening frame is the brand, which also covers the first photos loading.
  useEffect(() => {
    const planner = plannerRef.current;
    startedAtRef.current = Date.now();
    planner.sinceBrand = 0;
    show(brandScene(planner));
    schedule(4200);
    return () => window.clearTimeout(timerRef.current);
  }, [schedule, show]);

  // The short line under the photos, on its own steady clock.
  useEffect(() => {
    const t = window.setInterval(() => setCaption((c) => (c + 1) % CAPTIONS.length), CAPTION_MS);
    return () => window.clearInterval(t);
  }, []);

  // Back on the kiosk: the "Back to event" escape hatch is no longer needed.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(KIOSK_RETURN_KEY);
    } catch {}
  }, []);

  /* ---------- the stage ---------- */

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) {
        aspectRef.current = w / h;
        setStage({ w, h });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A page that is a screen: no scroll, no bounce, no pinch, no callouts, no sleep.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const saved = [html.style.cssText, body.style.cssText];
    html.style.background = "#030406";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.background = "#030406";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const stop = (e: Event) => e.preventDefault();
    // Nothing on this page scrolls; a moving finger is a swipe, never a scroll.
    const stopMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    // Safari's edge-swipe back/forward: a touch that starts at the very edge
    // is claimed here. Not every iOS version honours this; a Home Screen app
    // with Guided Access is the dependable way to rule it out.
    const stopEdge = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      const target = e.target as HTMLElement | null;
      if (target?.closest("button")) return;
      if ((x < 24 || x > window.innerWidth - 24) && e.cancelable) e.preventDefault();
    };
    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("contextmenu", stop);
    document.addEventListener("dragstart", stop);
    document.addEventListener("selectstart", stop);
    document.addEventListener("touchmove", stopMove, { passive: false });
    document.addEventListener("touchstart", stopEdge, { passive: false });

    let lock: { release: () => Promise<void> } | null = null;
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    }).wakeLock;
    const requestLock = () => {
      if (!wakeLock || document.visibilityState !== "visible") return;
      wakeLock.request("screen").then(
        (l) => {
          lock = l;
        },
        () => {}
      );
    };
    requestLock();
    document.addEventListener("visibilitychange", requestLock);

    return () => {
      html.style.cssText = saved[0];
      body.style.cssText = saved[1];
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("dragstart", stop);
      document.removeEventListener("selectstart", stop);
      document.removeEventListener("touchmove", stopMove);
      document.removeEventListener("touchstart", stopEdge);
      document.removeEventListener("visibilitychange", requestLock);
      void lock?.release().catch(() => {});
    };
  }, []);

  /* ---------- swipe ---------- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), active: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      d.active = true;
      window.clearTimeout(timerRef.current); // hold autoplay while a finger is down
      waitingRef.current = false;
    }
    const el = topLayerEl();
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translate3d(${dx}px, 0, 0)`;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== e.pointerId || !d.active) return;
    const dx = e.clientX - d.x;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - d.t);
    if (Math.abs(dx) > SWIPE_PX || (speed > 0.5 && Math.abs(dx) > 24)) {
      step(dx < 0 ? 1 : -1);
    } else {
      const el = topLayerEl();
      if (el) snapBack(el);
      waitingRef.current = false;
      schedule(RESUME_AFTER_MS);
    }
  };

  const onPointerCancel = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.active) {
      const el = topLayerEl();
      if (el) snapBack(el);
      schedule(RESUME_AFTER_MS);
    }
  };

  /* ---------- the one action ---------- */

  const { logout, isLoading: authLoading } = useAuth();
  const [ctaPending, setCtaPending] = useState(false);

  const startSignup = useCallback(() => {
    setCtaPending(true);
    setLeaving(true);
  }, []);

  useEffect(() => {
    // Wait for the session check to settle, so a sign-in still resolving cannot
    // write its token back after the sign-out below.
    if (!ctaPending || authLoading) return;
    logout();
    clearKioskCarryOver();
    try {
      window.sessionStorage.setItem(KIOSK_RETURN_KEY, "1");
    } catch {}
    // A full navigation, so registration starts from a fresh, signed-out app.
    window.location.assign(SIGNUP_PATH);
  }, [ctaPending, authLoading, logout]);

  const top = layers[layers.length - 1];
  const onBrand = !top || top.kind === "brand";
  const portrait = stage.w > 0 ? stage.w < stage.h : true;
  const insets = {
    top: stage.h * (portrait ? 0.11 : 0.13),
    bottom: stage.h * (portrait ? 0.3 : 0.32),
  };

  return (
    <div
      ref={rootRef}
      className="ed-root ed-kiosk"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label="Profixter: real homes, real things to fix"
    >
      {layers.map((scene, index) => (
        <Layer
          key={scene.key}
          scene={scene}
          entering={index > 0 || layers.length === 1}
          stage={stage}
          insets={insets}
          portrait={portrait}
          onBroken={onBroken}
        />
      ))}

      {/* Fixed chrome: never moves, whatever the photographs do behind it. */}
      <div className={`ed-topbar${onBrand ? " ed-topbar-hidden" : ""}`} aria-hidden={onBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Profixter" className="ed-topbar-logo" draggable={false} />
        <div className="ed-topbar-tagline">{TAGLINE}</div>
      </div>

      <div className="ed-bottom">
        <div className={`ed-caption${onBrand ? " ed-caption-hidden" : ""}`} aria-live="off">
          <span key={caption} className="ed-caption-text">
            {CAPTIONS[caption]}
          </span>
        </div>
        <button
          type="button"
          className="ed-cta"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={startSignup}
          disabled={leaving}
        >
          <span>{leaving ? "One moment…" : "Get My First Visit Free"}</span>
          {!leaving && (
            <svg width="26" height="20" viewBox="0 0 19 14" aria-hidden="true">
              <path
                d="M1 7h16m0 0l-5.6-5.6M17 7l-5.6 5.6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div className="ed-cta-sub">90-minute handyman visit &middot; No card required</div>
      </div>
    </div>
  );
}

function snapBack(el: HTMLElement) {
  el.style.transition = "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)";
  el.style.transform = "translate3d(0, 0, 0)";
}

/* ====================================================================== */

type Insets = { top: number; bottom: number };

type LayerProps = {
  scene: Scene;
  entering: boolean;
  stage: { w: number; h: number };
  insets: Insets;
  portrait: boolean;
  onBroken: (id: string) => void;
};

function Layer({ scene, entering, stage, insets, portrait, onBroken }: LayerProps) {
  const style = { "--ed-fade": `${scene.fade}ms` } as React.CSSProperties;
  const enter = !entering
    ? ""
    : scene.from === 1
      ? " ed-layer-slide-next"
      : scene.from === -1
        ? " ed-layer-slide-prev"
        : " ed-layer-enter";
  return (
    <div className={`ed-layer${enter}`} style={style} data-scene={scene.kind}>
      {scene.kind === "hero" && <Hero scene={scene} stage={stage} insets={insets} onBroken={onBroken} />}
      {scene.kind === "pair" && <Pair scene={scene} portrait={portrait} onBroken={onBroken} />}
      {scene.kind === "trio" && <Trio scene={scene} portrait={portrait} onBroken={onBroken} />}
      {scene.kind === "wall" && <Wall scene={scene} onBroken={onBroken} />}
      {scene.kind === "brand" && <Brand scene={scene} insets={insets} />}
      {scene.kind !== "brand" && <div className="ed-vignette" />}
    </div>
  );
}

function Photo({
  photo,
  className,
  style,
  onBroken,
}: {
  photo: Measured;
  className: string;
  style?: React.CSSProperties;
  onBroken: (id: string) => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt=""
      draggable={false}
      decoding="async"
      className={className}
      style={style}
      onError={() => onBroken(photo.id)}
    />
  );
}

/** Slow push/pull via the Web Animations API, cancelled with the scene. */
function Drift({ motion, duration, children }: { motion: Motion; duration: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    const animation = el.animate(
      [
        { transform: `translate3d(${motion.x0}%, ${motion.y0}%, 0) scale(${motion.s0})` },
        { transform: `translate3d(${motion.x1}%, ${motion.y1}%, 0) scale(${motion.s1})` },
      ],
      { duration, easing: "cubic-bezier(0.33, 0, 0.67, 1)", fill: "forwards" }
    );
    return () => animation.cancel();
  }, [motion, duration]);
  return (
    <div
      ref={ref}
      className="ed-motion"
      style={{ transform: `translate3d(${motion.x0}%, ${motion.y0}%, 0) scale(${motion.s0})` }}
    >
      {children}
    </div>
  );
}

function Hero({
  scene,
  stage,
  insets,
  onBroken,
}: {
  scene: Extract<Scene, { kind: "hero" }>;
  stage: { w: number; h: number };
  insets: Insets;
  onBroken: (id: string) => void;
}) {
  const life = scene.duration + scene.fade * 2;
  const { photo } = scene;

  if (scene.fit === "cover") {
    return (
      <Drift motion={scene.motion} duration={life}>
        <Photo photo={photo} className="ed-fill" onBroken={onBroken} />
      </Drift>
    );
  }

  // The whole photo, lit by a blurred copy of itself, centred in the space
  // between the mark at the top and the call to action at the bottom.
  const portrait = stage.w < stage.h;
  const availH = Math.max(0, stage.h - insets.top - insets.bottom);
  const maxW = stage.w * (portrait ? 0.92 : 0.84);
  const maxH = availH * 0.96;
  const width = Math.min(maxW, maxH * photo.aspect);
  const height = width / photo.aspect;
  return (
    <>
      <Photo photo={photo} className="ed-ambient-bg" onBroken={onBroken} />
      <Drift motion={scene.motion} duration={life}>
        <Photo
          photo={photo}
          className="ed-ambient-photo"
          style={{ width, height, marginLeft: -width / 2, top: insets.top + (availH - height) / 2 }}
          onBroken={onBroken}
        />
      </Drift>
    </>
  );
}

const GAP = 3; // px either side of a seam

function slotStyle(
  box: { top?: string; left?: string; width: string; height: string },
  delay: number,
  from: [string, string],
  life: number
): React.CSSProperties {
  return {
    ...box,
    animationDelay: `${delay}ms`,
    "--ed-dx": from[0],
    "--ed-dy": from[1],
    "--ed-life": `${life}ms`,
  } as React.CSSProperties;
}

function Pair({
  scene,
  portrait,
  onBroken,
}: {
  scene: Extract<Scene, { kind: "pair" }>;
  portrait: boolean;
  onBroken: (id: string) => void;
}) {
  const life = scene.duration + scene.fade * 2;
  const half = `calc(50% - ${GAP}px)`;
  const boxes = portrait
    ? [
        { top: "0", left: "0", width: "100%", height: half },
        { top: `calc(50% + ${GAP}px)`, left: "0", width: "100%", height: half },
      ]
    : [
        { top: "0", left: "0", width: half, height: "100%" },
        { top: "0", left: `calc(50% + ${GAP}px)`, width: half, height: "100%" },
      ];
  const from: [string, string][] = portrait
    ? [["-2%", "0"], ["2%", "0"]]
    : [["0", "-2%"], ["0", "2%"]];
  return (
    <>
      {scene.photos.map((photo, i) => (
        <div
          key={photo.id}
          className={`ed-slot${i === 1 ? " ed-slot-rev" : ""}`}
          style={slotStyle(boxes[i], i * 650, from[i], life)}
        >
          <Photo photo={photo} className="ed-fill" onBroken={onBroken} />
        </div>
      ))}
    </>
  );
}

function Trio({
  scene,
  portrait,
  onBroken,
}: {
  scene: Extract<Scene, { kind: "trio" }>;
  portrait: boolean;
  onBroken: (id: string) => void;
}) {
  const life = scene.duration + scene.fade * 2;
  const big = 62;
  const g = GAP;
  const near = scene.mirror ? `calc(${100 - big}% + ${g}px)` : "0";
  const far = scene.mirror ? "0" : `calc(${big}% + ${g}px)`;
  const bigLen = `calc(${big}% - ${g}px)`;
  const smallLen = `calc(${100 - big}% - ${g}px)`;
  const half = `calc(50% - ${g}px)`;
  const halfOffset = `calc(50% + ${g}px)`;

  const boxes = portrait
    ? [
        { top: near, left: "0", width: "100%", height: bigLen },
        { top: far, left: "0", width: half, height: smallLen },
        { top: far, left: halfOffset, width: half, height: smallLen },
      ]
    : [
        { top: "0", left: near, width: bigLen, height: "100%" },
        { top: "0", left: far, width: smallLen, height: half },
        { top: halfOffset, left: far, width: smallLen, height: half },
      ];
  const from: [string, string][] = portrait
    ? [["0", scene.mirror ? "2%" : "-2%"], ["-3%", "0"], ["3%", "0"]]
    : [[scene.mirror ? "2%" : "-2%", "0"], ["0", "-3%"], ["0", "3%"]];

  return (
    <>
      {scene.photos.map((photo, i) => (
        <div
          key={photo.id}
          className={`ed-slot${i === 2 ? " ed-slot-rev" : ""}`}
          style={slotStyle(boxes[i], [0, 550, 950][i], from[i], life)}
        >
          <Photo photo={photo} className="ed-fill" onBroken={onBroken} />
        </div>
      ))}
    </>
  );
}

function Wall({ scene, onBroken }: { scene: Extract<Scene, { kind: "wall" }>; onBroken: (id: string) => void }) {
  const [expanding, setExpanding] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setExpanding(true), scene.duration - WALL_EXPAND_LEAD_MS);
    return () => window.clearTimeout(t);
  }, [scene]);

  const { cols, rows } = scene;
  return (
    <div
      className={`ed-wall${expanding ? " ed-wall-expanding" : ""}`}
      style={{ "--ed-life": `${scene.duration}ms` } as React.CSSProperties}
    >
      {scene.photos.map((photo, i) => {
        const focus = i === scene.focus;
        const box =
          focus && expanding
            ? { left: "0%", top: "0%", width: "100%", height: "100%" }
            : {
                left: `${((i % cols) * 100) / cols}%`,
                top: `${(Math.floor(i / cols) * 100) / rows}%`,
                width: `${100 / cols}%`,
                height: `${100 / rows}%`,
              };
        return (
          <div key={photo.id} className={`ed-cell${focus ? " ed-cell-focus" : ""}`} style={box}>
            <div className="ed-cell-inner" style={{ animationDelay: `${scene.delays[i]}ms` }}>
              <Photo photo={photo} className="ed-fill" onBroken={onBroken} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Brand({ scene, insets }: { scene: Extract<Scene, { kind: "brand" }>; insets: Insets }) {
  return (
    <div className="ed-brand" style={{ paddingBottom: insets.bottom * 0.75 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="Profixter" className="ed-brand-logo" draggable={false} />
      <div className="ed-brand-rule" />
      <div className="ed-brand-line">{scene.line}</div>
    </div>
  );
}
