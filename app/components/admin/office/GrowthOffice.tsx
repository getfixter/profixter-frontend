"use client";

/**
 * Profixter HQ - the Growth office.
 *
 * One screen: a little knight-order guild hall with three AI knights (Lumi, Rover, Echo).
 * Getting around is meant to be obvious:
 *  - drag to look around, pinch (or scroll) to zoom, 🏠 to go back,
 *  - the dock at the bottom: Home, the three robots, Results, Requests, More,
 *  - tap a knight (or its name) to talk to it; ✕, "Back to the hall", a tap
 *    on the room, swiping the panel down, or the phone's Back button closes it.
 *
 * Robots speak in plain words first; every item can be copied as a complete
 * brief for ChatGPT. Truth rules: robots act out their REAL status, the office
 * celebrates only a real new first free visit, and missing data says so.
 * Nothing here can do more than the server allows the signed-in person to do.
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Cinzel } from "next/font/google";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";
import { getOffice, type OfficeState, type RobotKey } from "@/lib/office";
import type { CameraApi, SceneTarget } from "./OfficeScene";
import { RequestsPanel, ResultsPanel, RobotPanel, ago, type RobotTab } from "./OfficePanels";
import { CopyButton, ToastProvider } from "./Talk";
import { ROBOT_LOOKS, ROBOT_ORDER, STATUS_LIGHT } from "./office-layout";
import styles from "./office.module.css";

/** The order's lettering: a classic engraved serif for titles only. */
const knightFont = Cinzel({ subsets: ["latin"], weight: ["700"], variable: "--font-knight", display: "swap" });

const OfficeScene = dynamic(() => import("./OfficeScene"), { ssr: false, loading: () => null });

const POLL_MS = 60 * 1000;
const SEEN_KEY = "profixter:office:lastBookingSeen";
const HINT_KEY = "profixter:office:hinted:v2";

type Panel = { type: "robot"; key: RobotKey; tab: RobotTab } | { type: "results" } | { type: "requests"; robot?: RobotKey } | null;

function storage(key: string, value?: string) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: no memory, nothing breaks */
  }
  return null;
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Growth office scene failed:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function GrowthOffice({ onClassic }: { onClassic?: () => void }) {
  return (
    <ToastProvider>
      <Office onClassic={onClassic} />
    </ToastProvider>
  );
}

function Office({ onClassic }: { onClassic?: () => void }) {
  const { user } = useAuth();
  const owner = isAdminUser(user);
  const [office, setOffice] = useState<OfficeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanelState] = useState<Panel>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [full, setFull] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [moved, setMoved] = useState(false);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [hour, setHour] = useState(12);
  const stage = useRef<HTMLDivElement>(null);
  const camera = useRef<CameraApi | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after mount
    setGl(webglAvailable());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nq = window.matchMedia("(max-width: 720px)");
    setReduced(mq.matches);
    setNarrow(nq.matches);
    const onMq = () => setReduced(mq.matches);
    const onNq = () => setNarrow(nq.matches);
    mq.addEventListener?.("change", onMq);
    nq.addEventListener?.("change", onNq);
    if (!storage(HINT_KEY)) setHint(true);
    const ny = () => Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })) % 24;
    setHour(ny());
    const id = window.setInterval(() => setHour(ny()), 5 * 60 * 1000);
    return () => {
      mq.removeEventListener?.("change", onMq);
      nq.removeEventListener?.("change", onNq);
      window.clearInterval(id);
    };
  }, []);

  /* ---------- panels + the phone's Back button ---------- */
  const openPanel = useCallback((p: Panel) => {
    setMenu(false);
    setHelp(false);
    if (p && !pushed.current) {
      try {
        window.history.pushState({ ...(window.history.state || {}), officePanel: true }, "");
        pushed.current = true;
      } catch {
        /* history unavailable: the ✕ still works */
      }
    }
    setPanelState(p);
  }, []);
  const closePanel = useCallback(() => {
    setPanelState(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  }, []);
  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      setPanelState(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const dismissHint = useCallback(() => {
    setHint((h) => {
      if (h) storage(HINT_KEY, "1");
      return false;
    });
  }, []);

  /* ---------- data ---------- */
  const load = useCallback(async (fresh = false) => {
    try {
      const data = await getOffice(fresh);
      setOffice(data);
      setError(null);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 401 || status === 403 ? "You don't have access to the Growth hall." : "The hall couldn't load. I'll try again in a minute.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load after mount
    load();
    const onVis = () => {
      const v = document.visibilityState === "visible";
      setVisible(v);
      if (v) load();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [load]);

  // Celebrate a REAL new first free visit, once.
  useEffect(() => {
    const at = office?.lastFirstFreeVisitAt;
    if (!at) return;
    const seen = storage(SEEN_KEY);
    const isNew = seen ? new Date(at) > new Date(seen) : Date.now() - new Date(at).getTime() < 24 * 3600 * 1000;
    storage(SEEN_KEY, at);
    if (!isNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to new server data
    setCelebrate(true);
    setToast(`A homeowner booked their first free visit · ${ago(at)}`);
    const a = window.setTimeout(() => setCelebrate(false), 6000);
    const b = window.setTimeout(() => setToast(null), 7000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [office?.lastFirstFreeVisitAt]);

  /* ---------- full screen ---------- */
  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = async () => {
    setMenu(false);
    const el = stage.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall through to the overlay */
      }
    }
    setFull((f) => !f);
  };

  /* ---------- taps in the room ---------- */
  const onTap = useCallback(
    (t: SceneTarget) => {
      dismissHint();
      setMenu(false);
      if (t.type === "empty") {
        if (panel) closePanel();
        return;
      }
      if (t.type === "robot") openPanel({ type: "robot", key: t.key, tab: "now" });
      else if (t.type === "desk") openPanel({ type: "robot", key: t.key, tab: "work" });
      else if (t.type === "results") openPanel({ type: "results" });
      else openPanel({ type: "requests", robot: t.robot });
    },
    [dismissHint, openPanel, closePanel, panel]
  );

  const goHome = () => {
    setMenu(false);
    setHelp(false);
    if (panel) closePanel();
    camera.current?.home();
  };

  const refresh = useCallback(() => load(true), [load]);
  const selected = panel?.type === "robot" ? panel.key : null;
  const night = hour < 6 || hour >= 20;
  const f = office?.kpis?.firstFreeVisits;
  const diff = f && f.last7 != null && f.prev7 != null ? f.last7 - f.prev7 : null;
  const requests = office ? office.approvals.total : 0;

  const confetti = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 14) * 60}ms`,
        dx: `${((i * 53) % 160) - 80}px`,
        rot: `${(i * 97) % 720}deg`,
        color: ["#5FD3B5", "#FF8A6B", "#A98BFF", "#FFD45C", "#3E7BFA", "#FF7BB0"][i % 6],
      })),
    []
  );

  const fallback = (
    <div className={styles.fallback}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 40 }}>🤖🤖🤖</div>
        <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>The 3D hall can&rsquo;t start on this device.</div>
        <div className={styles.muted} style={{ marginTop: 6 }}>
          Everything still works - use the buttons at the bottom.
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={stage}
      className={`${styles.stage} ${knightFont.variable} ${night ? styles.stageNight : ""} ${full ? styles.fullscreen : ""}`}
      style={full && typeof document !== "undefined" && !document.fullscreenElement ? { position: "fixed", inset: 0, zIndex: 1000 } : undefined}
    >
      {office && gl ? (
        <div className={styles.canvasWrap} onPointerDown={dismissHint}>
          <SceneBoundary fallback={fallback}>
            <OfficeScene
              office={office}
              selected={selected}
              celebrate={celebrate}
              reduced={reduced}
              active={visible}
              panel={panel ? (narrow ? "bottom" : "right") : null}
              cameraApi={camera}
              onMoved={setMoved}
              onTap={onTap}
            />
          </SceneBoundary>
        </div>
      ) : office && gl === false ? (
        fallback
      ) : !error ? (
        <div className={styles.fallback}>
          <div>
            <div style={{ fontSize: 34 }}>🔧</div>
            <div style={{ fontWeight: 900, marginTop: 6 }}>Opening the hall…</div>
          </div>
        </div>
      ) : null}

      {error && !office ? (
        <div className={styles.fallback}>
          <div>
            <div style={{ fontSize: 34 }}>🔌</div>
            <div style={{ fontWeight: 900, marginTop: 6 }}>{error}</div>
            <button type="button" className={styles.btn} style={{ marginTop: 12 }} onClick={() => load(true)}>
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------- top ---------------- */}
      <div className={styles.hud}>
        <div className={styles.topLeft}>
          <div className={styles.brand}>
            <span className={styles.brandMark} style={office && !office.agentsEnabled ? { filter: "grayscale(1)" } : undefined}>
              P
            </span>
            Profixter HQ <span className={styles.brandSub}>{office ? (office.agentsEnabled ? "· the order is at work" : "· the order is resting") : ""}</span>
          </div>
          {office && error ? <span className={styles.chip}>⚠️ Showing data from {ago(office.generatedAt)}</span> : null}
        </div>

        {office ? (
          <button type="button" className={styles.kpiButton} onClick={() => openPanel({ type: "results" })} aria-label="How we're doing">
            <span className={styles.kpiIcon}>🏠</span>
            <span>
              <span className={styles.kpiNum}>{f?.last7 ?? "—"}</span>
              {diff != null && diff !== 0 ? (
                <span style={{ fontSize: 12, fontWeight: 900, marginLeft: 6, color: diff > 0 ? "#13844f" : "#b4232a" }}>
                  {diff > 0 ? "▲" : "▼"}
                  {Math.abs(diff)}
                </span>
              ) : null}
              <span className={styles.kpiLabel} style={{ display: "block" }}>
                new bookings this week
              </span>
            </span>
          </button>
        ) : null}

        {/* ---------------- hint ---------------- */}
        {hint && office && !panel ? (
          <button type="button" className={styles.hint} onClick={dismissHint}>
            👆 Drag to look around · 🤏 pinch to zoom · tap a knight to talk
          </button>
        ) : null}

        {/* ---------------- the dock ---------------- */}
        {office && !(panel && narrow) ? (
          <nav className={styles.dock} aria-label="Office">
            <button type="button" className={`${styles.dockBtn} ${moved ? styles.dockBtnGlow : ""}`} onClick={goHome} aria-label="Home - see the whole hall">
              <span className={styles.dockIcon}>🏠</span>
              <span className={styles.dockLabel}>Home</span>
            </button>
            <span className={styles.dockSep} />
            {ROBOT_ORDER.map((k) => {
              const r = office.robots.find((x) => x.key === k);
              const look = ROBOT_LOOKS[k];
              const on = selected === k;
              return (
                <button
                  key={k}
                  type="button"
                  className={`${styles.dockBtn} ${on ? styles.dockBtnOn : ""}`}
                  onClick={() => (on ? closePanel() : openPanel({ type: "robot", key: k, tab: "now" }))}
                  aria-label={`${look.name}: ${r?.statusText || ""}`}
                >
                  <span className={styles.dockAvatarWrap}>
                    <span className={styles.dockAvatar} style={{ background: look.body }}>
                      {look.name[0]}
                    </span>
                    <span className={styles.dockDot} style={{ background: STATUS_LIGHT[r?.status || "waiting"] }} />
                    {r?.status === "needs_you" ? <span className={styles.dockAsk}>?</span> : null}
                  </span>
                  <span className={styles.dockLabel}>{look.name}</span>
                </button>
              );
            })}
            <span className={styles.dockSep} />
            <button type="button" className={styles.dockBtn} onClick={() => openPanel({ type: "results" })}>
              <span className={styles.dockIcon}>📊</span>
              <span className={styles.dockLabel}>Results</span>
            </button>
            <button type="button" className={`${styles.dockBtn} ${requests ? styles.dockBtnAsk : ""}`} onClick={() => openPanel({ type: "requests" })}>
              <span className={styles.dockIcon}>
                📜{requests ? <span className={styles.dockBadge}>{requests}</span> : null}
              </span>
              <span className={styles.dockLabel}>Requests</span>
            </button>
            <button type="button" className={styles.dockBtn} onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
              <span className={styles.dockIcon}>⋯</span>
              <span className={styles.dockLabel}>More</span>
            </button>
          </nav>
        ) : null}

        {menu ? (
          <div className={styles.menu} role="menu">
            <button type="button" className={styles.menuItem} onClick={() => (setMenu(false), setHelp(true))}>
              ❓ How to use the hall
            </button>
            <div className={styles.menuItem} style={{ cursor: "default" }}>
              <CopyButton text={office?.explained?.chatgpt} label="Copy business report for ChatGPT" primary />
            </div>
            <button type="button" className={styles.menuItem} onClick={toggleFull}>
              {full ? "⤡ Exit full screen" : "⤢ Full screen"}
            </button>
            {onClassic ? (
              <button type="button" className={styles.menuItem} onClick={onClassic}>
                ☰ Classic view (tables)
              </button>
            ) : null}
          </div>
        ) : null}

        {help ? (
          <div className={styles.helpCard} role="dialog" aria-label="How to use the hall">
            <div className={styles.helpTitle}>How to use the hall</div>
            <ul className={styles.helpList}>
              <li>
                <b>👆 Drag</b> to look around. <b>🤏 Pinch</b> (or scroll) to zoom.
              </li>
              <li>
                <b>🏠 Home</b> shows the whole hall again.
              </li>
              <li>
                <b>Tap a knight</b> (or its name) to see what it&rsquo;s doing. Its <b>Settings</b> tab is where you pause it or teach it.
              </li>
              <li>
                <b>⚔️ Fighting a goblin</b> = a real work shift is running. <b>Practising on a straw dummy</b> = waiting for the next shift. <b>Waving</b> = something needs your answer. <b>Dozing by the fire</b> = paused.
              </li>
              <li>
                <b>📜 Requests</b>: questions waiting for your yes or no.
              </li>
              <li>
                <b>📊 Results</b>: how many homeowners booked, and what the team costs.
              </li>
              <li>
                <b>✨ Copy for ChatGPT</b> on any card copies the full story - paste it into ChatGPT and ask for advice.
              </li>
              <li>
                Close a panel with <b>✕</b>, <b>Back to the hall</b>, your phone&rsquo;s <b>Back</b> button, or a tap on the floor.
              </li>
            </ul>
            <button type="button" className={styles.btn} onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        ) : null}
      </div>

      {toast ? <div className={styles.toast}>🎉 {toast}</div> : null}
      {celebrate && !reduced ? (
        <div className={styles.confetti} aria-hidden>
          {confetti.map((c, i) => (
            <i key={i} style={{ left: c.left, background: c.color, animationDelay: c.delay, ["--dx" as string]: c.dx, ["--rot" as string]: c.rot }} />
          ))}
        </div>
      ) : null}

      {/* ---------------- panels ---------------- */}
      {panel?.type === "robot" ? (
        <RobotPanel
          robotKey={panel.key}
          tab={panel.tab}
          onTab={(tab) => setPanelState({ ...panel, tab })}
          owner={owner}
          onClose={closePanel}
          onChanged={refresh}
          onOpenRequests={(robot) => openPanel({ type: "requests", robot })}
        />
      ) : panel?.type === "results" && office ? (
        <ResultsPanel office={office} onClose={closePanel} onOpenRequests={() => openPanel({ type: "requests" })} />
      ) : panel?.type === "requests" ? (
        <RequestsPanel robot={panel.robot} owner={owner} onClose={closePanel} onChanged={refresh} />
      ) : null}
    </div>
  );
}
