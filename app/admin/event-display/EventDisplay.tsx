"use client";

/**
 * The booth display.
 *
 * Plays on its own. A passer-by may swipe; it picks itself back up after
 * twelve quiet seconds. Admin controls exist but are hidden: long-press the
 * top-right corner, or use the keyboard (space, arrows, F, S, R, P).
 *
 * Built to run for a whole day: at most two scenes are mounted at once, only
 * a small buffer of photos is ever preloaded (display-engine.ts), every timer
 * and animation is torn down with the scene that started it, and after a few
 * hours the page reloads itself at a quiet moment, right after confirming the
 * API still answers.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";
import { fetchDisplayPhotos } from "@/lib/event-display-service";
import {
  MANUAL_FADE_MS,
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
import "./event-display.css";

const LOGO = "/images/logo-footer.svg";
const REFRESH_MS = 30 * 60 * 1000;
const REFRESH_WHEN_EMPTY_MS = 60 * 1000;
const RELOAD_AFTER_MS = 4 * 60 * 60 * 1000;
const LONG_PRESS_MS = 650;
const CORNER_PX = 96;
const SWIPE_PX = 48;
const PANEL_IDLE_MS = 10000;
const HISTORY_LIMIT = 60;

export default function EventDisplay() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="ed-gate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Profixter" width={220} className="ed-pulse" />
      </div>
    );
  }

  if (!user || !isAdminUser(user)) {
    return (
      <div className="ed-gate">
        <div className="ed-gate-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Profixter" width={200} style={{ margin: "0 auto", opacity: 0.85 }} />
          <p>
            The event display needs an admin session on this device.
            {user ? ` This browser is signed in as ${user.email || "a non-admin account"}.` : ""}
          </p>
          <Link href="/signin">{user ? "Sign in as admin" : "Sign in"}</Link>
        </div>
      </div>
    );
  }

  return <Player />;
}

/* ====================================================================== */

function Player() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const aspectRef = useRef(0.75);

  const [layers, setLayers] = useState<Scene[]>([]);
  const currentRef = useRef<Scene | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [cursor, setCursor] = useState(false);

  const plannerRef = useRef(newPlannerState());
  const timerRef = useRef<number | undefined>(undefined);
  const waitingRef = useRef(false);
  const historyRef = useRef<Measured[]>([]);
  const backRef = useRef(0);
  const startedAtRef = useRef(0);
  const reloadReadyRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  const countRef = useRef<number | null>(null);

  const [pool] = useState(() => new PhotoPool());
  useEffect(() => {
    pool.listen(() => {
      if (waitingRef.current && !pausedRef.current) {
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
    if (pausedRef.current) return;
    const planner = plannerRef.current;
    const loaded = countRef.current !== null;
    backRef.current = 0;

    if (pool.size === 0) {
      // Nothing approved (or not loaded yet): stay on the brand, quietly, and
      // start the moment the first photo is ready.
      waitingRef.current = true;
      const note = loaded ? "empty" : undefined;
      if (currentRef.current?.kind !== "brand" || currentRef.current.note !== note) {
        show(brandScene(planner, note));
      }
      return;
    }

    const scene = planScene(planner, pool, aspectRef.current);
    if (!scene) {
      waitingRef.current = true;
      if (pool.looksOffline && currentRef.current?.kind !== "brand") {
        show(brandScene(planner, "offline"));
      }
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

  /** A finger moved the show: one photo, quickly, then autoplay waits. */
  const step = useCallback(
    (direction: 1 | -1) => {
      const planner = plannerRef.current;
      const history = historyRef.current;
      let photo: Measured | null = null;

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
      if (!photo) return;
      show(heroScene(planner, photo, aspectRef.current, { fade: MANUAL_FADE_MS }));
      if (!pausedRef.current) schedule(RESUME_AFTER_MS);
    },
    [pool, schedule, show]
  );

  const onBroken = useCallback(
    (id: string) => {
      pool.markBroken(id);
      const current = currentRef.current;
      if (current && photosIn(current).some((p) => p.id === id) && !pausedRef.current) {
        schedule(300);
      }
    },
    [pool, schedule]
  );

  // Drop the layer underneath once the one on top has fully faded in.
  useEffect(() => {
    if (layers.length < 2) return;
    const top = layers[layers.length - 1];
    const t = window.setTimeout(() => {
      setLayers((l) => (l.length > 1 && l[l.length - 1].key === top.key ? [top] : l));
    }, top.fade + 200);
    return () => window.clearTimeout(t);
  }, [layers]);

  /* ---------- photos ---------- */

  const toastTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const refresh = useCallback(async (announce = false) => {
    const result = await fetchDisplayPhotos();
    if (!result.ok) {
      if (announce) flash(`Refresh failed: ${result.message}`);
      return false;
    }
    pool.setPhotos(result.data.photos);
    countRef.current = result.data.photos.length;
    setCount(result.data.photos.length);
    if (announce) flash(`${result.data.photos.length} photos`);
    if (Date.now() - startedAtRef.current > RELOAD_AFTER_MS) reloadReadyRef.current = true;
    return true;
  }, [flash, pool]);

  useEffect(() => {
    let cancelled = false;
    let t: number | undefined;
    const loop = async () => {
      const ok = await refresh();
      if (cancelled) return;
      const empty = pool.size === 0;
      t = window.setTimeout(loop, ok && !empty ? REFRESH_MS : REFRESH_WHEN_EMPTY_MS);
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

  // When the library goes from "nothing" to "something" (or back), react now.
  useEffect(() => {
    if (count === null) return;
    if (count === 0) tickRef.current();
  }, [count]);

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

  // A page that is a screen: no scroll, no bounce, no pinch, no light flash, no sleep.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const saved = [html.style.cssText, body.style.cssText];
    html.style.background = "#030406";
    html.style.overflow = "hidden";
    body.style.background = "#030406";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const stopGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stopGesture, { passive: false });
    document.addEventListener("contextmenu", stopGesture);

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
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("contextmenu", stopGesture);
      document.removeEventListener("visibilitychange", requestLock);
      void lock?.release().catch(() => {});
    };
  }, []);

  /* ---------- admin controls ---------- */

  const setPausedBoth = useCallback(
    (value: boolean) => {
      pausedRef.current = value;
      setPaused(value);
      if (value) window.clearTimeout(timerRef.current);
      else schedule(600);
    },
    [schedule]
  );

  const actions = useMemo(
    () => ({
      togglePause: () => {
        const next = !pausedRef.current;
        setPausedBoth(next);
        flash(next ? "Paused" : "Playing");
      },
      next: () => step(1),
      prev: () => step(-1),
      shuffle: () => {
        pool.reshuffle();
        flash("Shuffled");
      },
      refresh: () => void refresh(true),
      fullscreen: () => {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => void;
        };
        const doc = document as Document & {
          webkitFullscreenElement?: Element | null;
          webkitExitFullscreen?: () => void;
        };
        const active = document.fullscreenElement || doc.webkitFullscreenElement;
        try {
          if (active) {
            if (document.exitFullscreen) void document.exitFullscreen();
            else doc.webkitExitFullscreen?.();
          } else if (el.requestFullscreen) {
            void el.requestFullscreen().catch(() => flash("Fullscreen not available"));
          } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
          } else {
            flash("Use Add to Home Screen for fullscreen");
          }
        } catch {
          flash("Fullscreen not available");
        }
      },
    }),
    [flash, pool, refresh, setPausedBoth, step]
  );

  // The panel tucks itself away again.
  const panelTimer = useRef<number | undefined>(undefined);
  const touchPanel = useCallback(() => {
    window.clearTimeout(panelTimer.current);
    panelTimer.current = window.setTimeout(() => setPanelOpen(false), PANEL_IDLE_MS);
  }, []);
  useEffect(() => {
    if (panelOpen) touchPanel();
    return () => window.clearTimeout(panelTimer.current);
  }, [panelOpen, touchPanel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const map: Record<string, () => void> = {
        " ": actions.togglePause,
        arrowright: actions.next,
        arrowleft: actions.prev,
        f: actions.fullscreen,
        s: actions.shuffle,
        r: actions.refresh,
        p: () => setPanelOpen((open) => !open),
        escape: () => setPanelOpen(false),
      };
      const action = map[key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  /* ---------- touch: swipe, and the secret corner ---------- */

  const gesture = useRef<{ x: number; y: number; id: number; corner: boolean } | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const cursorTimer = useRef<number | undefined>(undefined);

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = rootRef.current!.getBoundingClientRect();
    const corner = e.clientX > rect.right - CORNER_PX && e.clientY < rect.top + CORNER_PX;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, corner };
    window.clearTimeout(pressTimer.current);
    if (corner) {
      pressTimer.current = window.setTimeout(() => {
        setPanelOpen(true);
        gesture.current = null;
      }, LONG_PRESS_MS);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      setCursor(true);
      window.clearTimeout(cursorTimer.current);
      cursorTimer.current = window.setTimeout(() => setCursor(false), 2500);
    }
    const g = gesture.current;
    if (g && g.id === e.pointerId && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) {
      window.clearTimeout(pressTimer.current);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    window.clearTimeout(pressTimer.current);
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      step(dx < 0 ? 1 : -1);
    }
  };
  useEffect(
    () => () => {
      window.clearTimeout(pressTimer.current);
      window.clearTimeout(cursorTimer.current);
    },
    []
  );

  const top = layers[layers.length - 1];
  const portrait = stage.w > 0 ? stage.w < stage.h : true;

  return (
    <div
      ref={rootRef}
      className={`ed-root${cursor || panelOpen ? " ed-cursor" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        window.clearTimeout(pressTimer.current);
        gesture.current = null;
      }}
      aria-label="Profixter event display"
    >
      {layers.map((scene, index) => (
        <Layer
          key={scene.key}
          scene={scene}
          entering={index > 0 || layers.length === 1}
          stage={stage}
          portrait={portrait}
          onBroken={onBroken}
        />
      ))}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="" className={`ed-mark${!top || top.kind === "brand" ? " ed-mark-hidden" : ""}`} />

      {toast && <div className="ed-toast">{toast}</div>}

      {panelOpen && (
        <div
          className="ed-panel"
          onPointerDown={(e) => {
            e.stopPropagation();
            touchPanel();
          }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="ed-panel-status">
            {count === null ? "Loading photos…" : `${count} approved photos`} · {paused ? "paused" : "playing"}
          </div>
          <div className="ed-panel-row">
            <button type="button" onClick={actions.prev} aria-label="Previous">‹</button>
            <button type="button" onClick={actions.togglePause}>{paused ? "Play" : "Pause"}</button>
            <button type="button" onClick={actions.next} aria-label="Next">›</button>
          </div>
          <div className="ed-panel-row">
            <button type="button" onClick={actions.shuffle}>Shuffle</button>
            <button type="button" onClick={actions.refresh}>Refresh</button>
            <button type="button" onClick={actions.fullscreen}>Fullscreen</button>
          </div>
          <div className="ed-panel-row">
            <Link href="/admin/event-display/review">Review photos</Link>
            <button type="button" onClick={() => setPanelOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */

type LayerProps = {
  scene: Scene;
  entering: boolean;
  stage: { w: number; h: number };
  portrait: boolean;
  onBroken: (id: string) => void;
};

function Layer({ scene, entering, stage, portrait, onBroken }: LayerProps) {
  const style = { "--ed-fade": `${scene.fade}ms` } as React.CSSProperties;
  return (
    <div className={`ed-layer${entering ? " ed-layer-enter" : ""}`} style={style} data-scene={scene.kind}>
      {scene.kind === "hero" && <Hero scene={scene} stage={stage} onBroken={onBroken} />}
      {scene.kind === "pair" && <Pair scene={scene} portrait={portrait} onBroken={onBroken} />}
      {scene.kind === "trio" && <Trio scene={scene} portrait={portrait} onBroken={onBroken} />}
      {scene.kind === "wall" && <Wall scene={scene} onBroken={onBroken} />}
      {scene.kind === "brand" && <Brand scene={scene} />}
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
  onBroken,
}: {
  scene: Extract<Scene, { kind: "hero" }>;
  stage: { w: number; h: number };
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

  // The whole photo, lit by a blurred copy of itself.
  const portrait = stage.w < stage.h;
  const maxW = stage.w * (portrait ? 0.9 : 0.84);
  const maxH = stage.h * (portrait ? 0.74 : 0.86);
  const width = Math.min(maxW, maxH * photo.aspect);
  const height = width / photo.aspect;
  return (
    <>
      <Photo photo={photo} className="ed-ambient-bg" onBroken={onBroken} />
      <Drift motion={scene.motion} duration={life}>
        <Photo
          photo={photo}
          className="ed-ambient-photo"
          style={{ width, height, marginLeft: -width / 2, marginTop: -height / 2 }}
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

function Brand({ scene }: { scene: Extract<Scene, { kind: "brand" }> }) {
  return (
    <div className="ed-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="Profixter" className="ed-brand-logo" />
      <div className="ed-brand-rule" />
      <div className="ed-brand-line">{scene.line}</div>
      {scene.note === "empty" && (
        <div className="ed-brand-note">
          No photos are approved for the display yet.{" "}
          <Link href="/admin/event-display/review">Review photos</Link>
        </div>
      )}
      {scene.note === "offline" && <div className="ed-brand-note">Reconnecting…</div>}
    </div>
  );
}
