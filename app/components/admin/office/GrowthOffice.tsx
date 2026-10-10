"use client";

/**
 * Profixter HQ - the Growth office.
 *
 * One screen: a little 3D office with three AI workers (Lumi, Rover, Echo).
 * The office IS the interface - tap a robot, its desk, the results display or
 * the approvals board. Small panels open over the scene; the scene keeps
 * running behind them.
 *
 * Truth rules: robots act out their REAL status (from /api/admin/growth/office).
 * The office celebrates only when a real first free visit was booked since you
 * last looked. Missing data says so. Nothing here can do more than the server
 * already allows the signed-in person to do.
 */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";
import { getOffice, type OfficeState, type RobotKey } from "@/lib/office";
import type { SceneTarget } from "./OfficeScene";
import { ApprovalsPanel, ResultsPanel, RobotPanel, ago, type RobotTab } from "./OfficePanels";
import { ROBOT_LOOKS, ROBOT_ORDER, STATUS_LIGHT } from "./office-layout";
import styles from "./office.module.css";

const OfficeScene = dynamic(() => import("./OfficeScene"), { ssr: false, loading: () => null });

const POLL_MS = 60 * 1000;
const SEEN_KEY = "profixter:office:lastBookingSeen";
const HINT_KEY = "profixter:office:hinted";

type Panel = { type: "robot"; key: RobotKey; tab: RobotTab } | { type: "results" } | { type: "approvals"; robot?: RobotKey } | null;

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
  const { user } = useAuth();
  const owner = isAdminUser(user);
  const [office, setOffice] = useState<OfficeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [full, setFull] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const [hour, setHour] = useState(() => new Date().getHours());
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after mount
    setGl(webglAvailable());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onMq);
    if (!storage(HINT_KEY)) setHint(true);
    const ny = () => Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" })) % 24;
    setHour(ny());
    const id = window.setInterval(() => setHour(ny()), 5 * 60 * 1000);
    return () => {
      mq.removeEventListener?.("change", onMq);
      window.clearInterval(id);
    };
  }, []);

  const load = useCallback(async (fresh = false) => {
    try {
      const data = await getOffice(fresh);
      setOffice(data);
      setError(null);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 401 || status === 403 ? "You don't have access to the Growth office." : "The office couldn't load. Retrying in a minute.");
    }
  }, []);

  // Poll gently, only while the page is visible.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after mount
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after mount
    setCelebrate(true);
    setToast(`A homeowner booked their first free visit · ${ago(at)}`);
    const a = window.setTimeout(() => setCelebrate(false), 6000);
    const b = window.setTimeout(() => setToast(null), 7000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [office?.lastFirstFreeVisitAt]);

  // Fullscreen (real API where available, a fixed overlay otherwise).
  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = async () => {
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

  const onTap = useCallback((t: SceneTarget) => {
    if (hint) {
      setHint(false);
      storage(HINT_KEY, "1");
    }
    if (t.type === "robot") setPanel({ type: "robot", key: t.key, tab: "now" });
    else if (t.type === "desk") setPanel({ type: "robot", key: t.key, tab: "work" });
    else if (t.type === "results") setPanel({ type: "results" });
    else setPanel({ type: "approvals", robot: t.robot });
  }, [hint]);

  const refresh = useCallback(() => load(true), [load]);
  const selected = panel?.type === "robot" ? panel.key : null;
  const night = hour < 6 || hour >= 20;
  const f = office?.kpis?.firstFreeVisits;
  const diff = f && f.last7 != null && f.prev7 != null ? f.last7 - f.prev7 : null;

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
        <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>The 3D office can&rsquo;t start on this device.</div>
        <div className={styles.muted} style={{ marginTop: 6 }}>Everything still works - tap a robot:</div>
        <div className={styles.btnRow} style={{ justifyContent: "center" }}>
          {ROBOT_ORDER.map((k) => {
            const r = office?.robots.find((x) => x.key === k);
            return (
              <button key={k} type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => setPanel({ type: "robot", key: k, tab: "now" })}>
                <span className={styles.dot} style={{ background: STATUS_LIGHT[r?.status || "waiting"], display: "inline-block", marginRight: 6 }} />
                {ROBOT_LOOKS[k].name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={stage}
      className={`${styles.stage} ${night ? styles.stageNight : ""} ${full ? styles.fullscreen : ""}`}
      style={full && !document.fullscreenElement ? { position: "fixed", inset: 0, zIndex: 1000 } : undefined}
    >
      {office && gl ? (
        <div className={styles.canvasWrap}>
          <SceneBoundary fallback={fallback}>
            <OfficeScene office={office} selected={selected} celebrate={celebrate} reduced={reduced} active={visible} onTap={onTap} />
          </SceneBoundary>
        </div>
      ) : office && gl === false ? (
        fallback
      ) : !error ? (
        <div className={styles.fallback}>
          <div>
            <div style={{ fontSize: 34 }}>🔧</div>
            <div style={{ fontWeight: 900, marginTop: 6 }}>Opening the office…</div>
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

      {/* ---------------- HUD ---------------- */}
      <div className={styles.hud}>
        <div className={styles.topLeft}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>P</span>
            Profixter HQ <span className={styles.brandSub}>growth office</span>
          </div>
          {office ? (
            <span className={`${styles.chip} ${styles.agentsChip}`} title={office.agentsEnabled ? "The AI agents run on their schedules" : "AI agents are switched off"}>
              <span className={styles.dot} style={{ background: office.agentsEnabled ? "#35E07F" : "#8C94A8" }} />
              {office.agentsEnabled ? "Agents on" : "Agents off"}
            </span>
          ) : null}
          {office && error ? <span className={styles.chip}>⚠️ Showing data from {ago(office.generatedAt)}</span> : null}
        </div>

        {office ? (
          <button type="button" className={styles.kpiButton} onClick={() => setPanel({ type: "results" })} aria-label="Open results">
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
                first free visits · 7 days
              </span>
            </span>
          </button>
        ) : null}

        <div className={styles.bottomLeft}>
          {onClassic ? (
            <button type="button" className={styles.roundBtn} onClick={onClassic} title="The classic Command Center">
              ☰ <span>Classic</span>
            </button>
          ) : null}
        </div>
        <div className={styles.bottomRight}>
          {office ? (
            <button type="button" className={`${styles.roundBtn} ${office.approvals.total ? styles.bell : ""}`} onClick={() => setPanel({ type: "approvals" })} aria-label="Approvals">
              🔔 {office.approvals.total ? <span className={styles.badge}>{office.approvals.total}</span> : <span>Approvals</span>}
            </button>
          ) : null}
          <button type="button" className={styles.roundBtn} onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"}>
            {full ? "⤡" : "⤢"}
          </button>
        </div>
        {hint && office && !panel ? <div className={styles.hint}>Tap a robot to see what it&rsquo;s doing<span className={styles.swipeHint}> · swipe to look around</span></div> : null}
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
          onTab={(tab) => setPanel({ ...panel, tab })}
          owner={owner}
          onClose={() => setPanel(null)}
          onChanged={refresh}
          onOpenApprovals={(robot) => setPanel({ type: "approvals", robot })}
        />
      ) : panel?.type === "results" && office ? (
        <ResultsPanel office={office} onClose={() => setPanel(null)} onOpenApprovals={() => setPanel({ type: "approvals" })} />
      ) : panel?.type === "approvals" ? (
        <ApprovalsPanel robot={panel.robot} owner={owner} onClose={() => setPanel(null)} onChanged={refresh} />
      ) : null}
    </div>
  );
}
