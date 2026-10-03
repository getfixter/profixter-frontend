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
 * THE PRESENTATION
 * Photos are cards in a quiet 3D field (spatial.ts): one dominant card shows a
 * photo whole, recently shown photos drift behind it at different depths, new
 * photos come forward out of the field, and a swipe throws the card aside.
 * Cards keep their identity between compositions, so the motion reads as one
 * continuous space rather than a sequence of slides.
 *
 * The call to action signs out whatever session this browser holds, using
 * the site's own logout, before opening registration. The iPad may have been
 * set up while signed in as an admin, and a visitor must never register, or
 * see anything, inside that session.
 *
 * Built to run all day: a hard cap on cards (spatial.MAX_CARDS), only a small
 * buffer of photos preloaded (display-engine.ts), every timer and animation
 * torn down with its card, and after a few hours the page reloads itself at a
 * quiet moment, right after confirming the API still answers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { fetchPublicPhotos } from "@/lib/event-display-service";
import { KIOSK_RETURN_KEY, clearKioskCarryOver } from "@/lib/event-kiosk";
import {
  RESUME_AFTER_MS,
  PhotoPool,
  brandScene,
  heroScene,
  newPlannerState,
  photosIn,
  planScene,
  type Measured,
  type Scene,
} from "./display-engine";
import { compose, geometry, type Card } from "./spatial";
import "./event-kiosk.css";

const LOGO = "/images/logo-footer.svg";
const SIGNUP_PATH = "/signup?source=event";
const REFRESH_MS = 30 * 60 * 1000;
const REFRESH_WHEN_EMPTY_MS = 60 * 1000;
const RELOAD_AFTER_MS = 4 * 60 * 60 * 1000;
const SWIPE_PX = 56;
const HISTORY_LIMIT = 60;
const CAPTION_MS = 7000;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

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
  const worldRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  /** Where the fixed chrome actually ends: photos fill everything between. */
  const safeRef = useRef<{ top: number; bottom: number } | undefined>(undefined);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const stageRef = useRef({ w: 1, h: 1 });
  const aspectRef = useRef(0.75);

  const [cards, setCards] = useState<Card[]>([]);
  const [sceneKind, setSceneKind] = useState<Scene["kind"]>("brand");
  const [brandLine, setBrandLine] = useState("");
  const [ambient, setAmbient] = useState<Array<{ key: string; url: string }>>([]);
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

  const show = useCallback((scene: Scene, via?: 1 | -1) => {
    currentRef.current = scene;
    const { w, h } = stageRef.current;
    setCards((prev) => compose(scene, prev, geometry(w, h, safeRef.current), Date.now(), via));
    setSceneKind(scene.kind);
    if (scene.kind === "brand") setBrandLine(scene.line);
    if (scene.kind === "hero") {
      setAmbient((prev) => [...prev.filter((a) => a.key !== scene.photo.id).slice(-1), { key: scene.photo.id, url: scene.photo.url }]);
    }
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

  /** Drag offset for the field, read by every card's CSS. */
  const setDrag = useCallback((dx: number, dragging: boolean) => {
    const world = worldRef.current;
    if (!world) return;
    world.classList.toggle("ed-dragging", dragging);
    world.style.setProperty("--dx", `${dx}px`);
    world.style.setProperty("--dxn", String(dx / Math.max(1, stageRef.current.w)));
  }, []);

  /**
   * A finger moved the show: the photo is thrown off to one side, the next
   * one sweeps in from the other, and autoplay waits RESUME_AFTER_MS.
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

      setDrag(0, false);
      if (photo) show(heroScene(planner, photo, aspectRef.current, { from: direction }), direction);
      schedule(RESUME_AFTER_MS);
    },
    [pool, schedule, setDrag, show]
  );

  const onBroken = useCallback(
    (id: string) => {
      pool.markBroken(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
      const current = currentRef.current;
      if (current && photosIn(current).some((p) => p.id === id) && !dragRef.current?.active) {
        schedule(300);
      }
    },
    [pool, schedule]
  );

  // Cards that have finished leaving are removed.
  useEffect(() => {
    const leaving = cards.filter((c) => c.exitAt > 0);
    if (!leaving.length) return;
    const due = Math.min(...leaving.map((c) => c.exitAt));
    const t = window.setTimeout(() => {
      const now = Date.now();
      setCards((prev) => prev.filter((c) => c.exitAt === 0 || c.exitAt > now));
    }, Math.max(50, due - Date.now()));
    return () => window.clearTimeout(t);
  }, [cards]);

  // The ambient light: only the latest two backdrops, the older fading under.
  useEffect(() => {
    if (ambient.length < 2) return;
    const t = window.setTimeout(() => setAmbient((a) => a.slice(-1)), 2600);
    return () => window.clearTimeout(t);
  }, [ambient]);

  /* ---------- photos ---------- */

  const refresh = useCallback(async () => {
    const result = await fetchPublicPhotos();
    if (!result.ok) return false;
    pool.setPhotos(result.data.photos);
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
      if (!w || !h) return;
      const root = el.getBoundingClientRect();
      const bar = topbarRef.current?.getBoundingClientRect();
      const line = captionRef.current?.getBoundingClientRect();
      const safe = bar && line ? { top: Math.round(bar.bottom - root.top), bottom: Math.round(root.bottom - line.top) } : undefined;
      const prevSafe = safeRef.current;
      safeRef.current = safe;
      const changed =
        w !== stageRef.current.w ||
        h !== stageRef.current.h ||
        safe?.top !== prevSafe?.top ||
        safe?.bottom !== prevSafe?.bottom;
      stageRef.current = { w, h };
      aspectRef.current = w / h;
      setStage({ w, h });
      // A rotation re-lays the current composition rather than waiting for the next one.
      if (changed && currentRef.current) {
        const scene = currentRef.current;
        setCards((prev) => compose(scene, prev, geometry(w, h, safeRef.current), Date.now()));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // The chrome's height settles once the brand font has loaded.
    void document.fonts?.ready.then(measure);
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

  /* ---------- swipe: the field follows the finger ---------- */

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
    setDrag(dx, true);
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
      setDrag(0, false); // springs back
      waitingRef.current = false;
      schedule(RESUME_AFTER_MS);
    }
  };

  const onPointerCancel = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.active) {
      setDrag(0, false);
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

  const onBrand = sceneKind === "brand";

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
      {/* Ambient light: the current photo, blurred far out of focus, behind everything. */}
      <div className={`ed-ambient${onBrand ? " ed-ambient-dim" : ""}`} aria-hidden>
        {ambient.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={a.key} src={a.url} alt="" draggable={false} className="ed-ambient-img" />
        ))}
      </div>
      <div className="ed-light" aria-hidden />

      <div ref={worldRef} className="ed-world" data-scene={sceneKind}>
        <div className={`ed-camera${sceneKind === "wall" ? " ed-camera-dolly" : ""}`}>
          {stage.w > 0 &&
            cards.map((card) => <PhotoCard key={card.id} card={card} onBroken={onBroken} />)}
        </div>
      </div>

      <div className="ed-vignette" aria-hidden />

      <div className={`ed-brand${onBrand ? " ed-brand-on" : ""}`} aria-hidden={!onBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Profixter" className="ed-brand-logo" draggable={false} />
        <div className="ed-brand-rule" />
        <div key={brandLine} className="ed-brand-line">
          {brandLine}
        </div>
      </div>

      {/* Fixed chrome: never moves, whatever the photographs do behind it. */}
      <div ref={topbarRef} className={`ed-topbar${onBrand ? " ed-topbar-hidden" : ""}`} aria-hidden={onBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Profixter" className="ed-topbar-logo" draggable={false} />
        <div className="ed-topbar-tagline">{TAGLINE}</div>
      </div>

      <div className="ed-bottom">
        <div ref={captionRef} className={`ed-caption${onBrand ? " ed-caption-hidden" : ""}`} aria-live="off">
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

/* ====================================================================== */

/**
 * One photo in the field. It mounts at its entry pose and moves to its pose on
 * the next frame, so arrivals animate; after that, every change of pose is a
 * CSS transition on transform/opacity/filter. Drag parallax lives on an inner
 * wrapper, so a finger and the choreography never fight over one transform.
 */
function PhotoCard({ card, onBroken }: { card: Card; onBroken: (id: string) => void }) {
  const [arrived, setArrived] = useState(!card.enter);
  useEffect(() => {
    if (arrived) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setArrived(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [arrived]);

  const p = arrived || !card.enter ? card.pose : card.enter;
  const { w, h } = card.base;
  const style = {
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
    zIndex: card.zIndex,
    opacity: p.o,
    transform: `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) scale(${p.s})`,
    filter: p.blur > 0.2 ? `blur(${p.blur}px)` : "none",
    transition: arrived
      ? `transform ${card.t}ms ${EASE}, opacity ${Math.round(card.t * 0.8)}ms ease, filter ${card.t}ms ease`
      : "none",
    "--k": card.k,
  } as React.CSSProperties;

  return (
    <div className="ed-card" data-role={card.role} style={style}>
      <div className="ed-card-drag">
        <div className={`ed-card-float${card.float >= 0 ? ` ed-float-${card.float}` : ""}`}>
          <div className="ed-card-face">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.photo.url}
              alt=""
              draggable={false}
              decoding="async"
              className="ed-card-img"
              onError={() => onBroken(card.id)}
            />
            <div className="ed-card-glass" />
            {card.role === "hero" && <div className="ed-card-sheen" />}
          </div>
        </div>
      </div>
    </div>
  );
}
