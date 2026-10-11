"use client";

/**
 * The panels that open over the hall: a knight (Now / Work / Settings),
 * the results board, and Requests (approvals and notes). Every item speaks
 * in plain words first (RobotSays), with "More details" for the technical
 * view and "Copy for ChatGPT" for a complete brief. Every button calls a real
 * endpoint; anything the system can't do is labelled, not faked.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  errorMessage,
  getApprovals,
  getRobot,
  restoreGuidance,
  runShiftNow,
  saveGuidance,
  setRobotPaused,
  type ApprovalItem,
  type OfficeState,
  type RobotDetail,
  type RobotKey,
} from "@/lib/office";
import { decideAction, decidePlaybook, getPlaybookPreview, setFindingStatus } from "@/lib/admin-growth";
import { ROBOT_LOOKS, STATUS_LIGHT } from "./office-layout";
import { CopyButton, RobotSays } from "./Talk";
import styles from "./office.module.css";

export function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

const money = (cents: number | null | undefined) => (cents == null ? "—" : `$${(cents / 100).toFixed(cents < 1000 ? 2 : 0)}`);

/* ================================================================== */
/* The sheet                                                           */
/* ================================================================== */

export function Sheet({
  children,
  onClose,
  label,
  head,
  tabs,
  tall = false,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  head: ReactNode;
  tabs?: ReactNode;
  /** Panels that do not need a robot visible above them can be taller on phones. */
  tall?: boolean;
}) {
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside
      className={`${styles.sheet} ${tall ? styles.sheetTall : ""}`}
      role="dialog"
      aria-label={label}
      style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* swipe the handle down to close (phones) */}
      <div
        className={styles.handleZone}
        onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
        onTouchMove={(e) => {
          if (startY.current == null) return;
          setDrag(Math.max(0, e.touches[0].clientY - startY.current));
        }}
        onTouchEnd={() => {
          if (drag > 90) onClose();
          setDrag(0);
          startY.current = null;
        }}
      >
        <span className={styles.handle} />
      </div>
      {head}
      {tabs}
      <div className={styles.sheetBody}>{children}</div>
      <div className={styles.sheetFoot}>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          ← Back to the hall
        </button>
      </div>
    </aside>
  );
}

export function Head({ color, initial, title, sub, onClose }: { color: string; initial: string; title: string; sub: string; onClose: () => void }) {
  return (
    <div className={styles.sheetHead}>
      <div className={styles.avatar} style={{ background: color }}>
        {initial}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className={styles.sheetTitle}>{title}</div>
        <div className={styles.sheetSub}>{sub}</div>
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close and go back to the hall">
        ✕
      </button>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Pre({ children }: { children: ReactNode }) {
  return <div className={styles.pre}>{children}</div>;
}

/* ================================================================== */
/* Robot                                                               */
/* ================================================================== */

export type RobotTab = "now" | "work" | "settings";

const STATUS_WORDS: Record<string, string> = {
  working: "Working now",
  needs_you: "Needs your answer",
  error: "Something went wrong",
  waiting: "Waiting for next shift",
  paused: "Paused by you",
  off: "Switched off",
};

export function RobotPanel({
  robotKey,
  tab,
  onTab,
  owner,
  onClose,
  onChanged,
  onOpenRequests,
}: {
  robotKey: RobotKey;
  tab: RobotTab;
  onTab: (t: RobotTab) => void;
  owner: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenRequests: (robot: RobotKey) => void;
}) {
  const look = ROBOT_LOOKS[robotKey];
  const [d, setD] = useState<RobotDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reloads = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await getRobot(robotKey);
      setD(data);
      setErr(null);
      // Older notes are being put into simple words in the background: look again once.
      const pending = data.findings.some((f) => f.simple?.pendingSimple) || data.runs.some((r) => r.simple?.pendingSimple);
      if (pending && reloads.current < 1) {
        reloads.current += 1;
        window.setTimeout(() => setTick((t) => t + 1), 7000);
      }
    } catch (e) {
      setErr(errorMessage(e, "I couldn't load this robot. Try again in a moment.").message);
    }
  }, [robotKey]);
  useEffect(() => {
    reloads.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the old robot before loading another
    setD(null);
  }, [robotKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data after mount
    load();
  }, [load, tick]);

  const refresh = () => {
    load();
    onChanged();
  };
  const light = d ? STATUS_LIGHT[d.state.status] : "#ccc";

  return (
    <Sheet
      onClose={onClose}
      label={look.name}
      head={
        <Head
          color={look.body}
          initial={look.name[0]}
          title={look.name}
          sub={d ? `${STATUS_WORDS[d.state.status] || ""} · ${d.robot.role}` : "…"}
          onClose={onClose}
        />
      }
      tabs={
        <div className={styles.tabs} role="tablist">
          {(["now", "work", "settings"] as RobotTab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabOn : ""}`} onClick={() => onTab(t)}>
              {t === "now" ? "Now" : t === "work" ? "Work" : "Settings"}
            </button>
          ))}
        </div>
      }
    >
      {err ? <div className={styles.problem}>{err}</div> : null}
      {!d ? (
        <div className={styles.muted}>Loading…</div>
      ) : tab === "now" ? (
        <RobotNow d={d} light={light} onOpenRequests={() => onOpenRequests(robotKey)} onTab={onTab} />
      ) : tab === "work" ? (
        <RobotWork d={d} owner={owner} onChanged={refresh} />
      ) : (
        <RobotSettings d={d} owner={owner} onChanged={refresh} />
      )}
    </Sheet>
  );
}

function RobotNow({ d, light, onOpenRequests, onTab }: { d: RobotDetail; light: string; onOpenRequests: () => void; onTab: (t: RobotTab) => void }) {
  const s = d.state;
  const lastRun = d.runs.find((r) => r.status !== "skipped");
  return (
    <>
      <RobotSays
        robot={d.robot.key}
        simple={d.explained?.simple}
        chatgpt={d.explained?.chatgpt}
        actions={s.waiting > 0 ? [{ label: `See what's waiting (${s.waiting})`, tone: "yes", onClick: onOpenRequests }] : []}
        meta={`${STATUS_WORDS[s.status] || ""}`}
      />
      <div className={styles.statusStrip}>
        <span className={styles.dot} style={{ background: light }} /> {s.statusText}
        {d.schedule.length ? <span className={styles.muted}> · works {d.schedule.join(", ")}</span> : null}
      </div>

      <Section title="My last shift">
        {lastRun ? (
          <RobotSays
            robot={d.robot.key}
            compact
            meta={`${when(lastRun.at)} · ${money(lastRun.costCents)}`}
            simple={lastRun.simple}
            chatgpt={lastRun.chatgpt}
            fullReport={lastRun.summary || null}
            details={
              <>
                {lastRun.summary ? <Pre>{lastRun.summary}</Pre> : <div className={styles.muted}>No technical summary.</div>}
                {lastRun.error ? <div className={styles.problem}>{lastRun.error}</div> : null}
              </>
            }
          />
        ) : (
          <div className={styles.card}>
            <span className={styles.muted}>No shifts yet.</span>
          </div>
        )}
      </Section>

      {d.mistakes.length ? (
        <Section title="Problems">
          {d.mistakes.slice(0, 2).map((m, i) => (
            <RobotSays
              key={i}
              robot={d.robot.key}
              compact
              meta={when(m.at)}
              simple={m.simple}
              chatgpt={m.chatgpt}
              details={
                <div>
                  <b>{m.what}</b>
                  {m.detail ? <div className={styles.muted}>{m.detail}</div> : null}
                </div>
              }
            />
          ))}
        </Section>
      ) : null}

      <Section title="What I do">
        <div className={styles.card}>
          <ul className={styles.list}>
            {d.robot.does.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} style={{ marginTop: 10 }} onClick={() => onTab("settings")}>
            Settings & teaching →
          </button>
        </div>
      </Section>
    </>
  );
}

function RobotWork({ d, owner, onChanged }: { d: RobotDetail; owner: boolean; onChanged: () => void }) {
  const mark = async (id: string, status: "acknowledged" | "dismissed") => {
    await setFindingStatus(id, status).catch(() => {});
    onChanged();
  };
  return (
    <>
      <Section title="Notes for you">
        {d.findings.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>Nothing new right now.</span>
          </div>
        ) : (
          d.findings.map((f) => (
            <RobotSays
              key={f.id}
              robot={d.robot.key}
              meta={`${f.severity === "high" ? "Important · " : ""}${ago(f.at)}`}
              simple={f.simple}
              chatgpt={f.chatgpt}
              fullReport={`${f.title}\n\n${f.detail}`}
              actions={
                owner
                  ? [
                      { label: "Got it", tone: "yes", onClick: () => mark(f.id, "acknowledged") },
                      { label: "Not useful", tone: "no", onClick: () => mark(f.id, "dismissed") },
                    ]
                  : []
              }
              details={
                <>
                  <b>{f.title}</b>
                  <Pre>{f.detail}</Pre>
                </>
              }
            />
          ))
        )}
      </Section>
      <Section title="My shifts">
        {d.runs.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>No shifts yet.</span>
          </div>
        ) : (
          d.runs.map((r) => (
            <RobotSays
              key={r.id}
              robot={d.robot.key}
              compact
              meta={`${when(r.at)}${r.trigger === "event" ? " · a homeowner message" : r.trigger === "manual" ? " · started by you" : ""} · ${money(r.costCents)}`}
              simple={r.simple}
              chatgpt={r.chatgpt}
              fullReport={r.summary || null}
              details={
                <>
                  {r.summary ? <Pre>{r.summary}</Pre> : null}
                  {r.error ? <div className={styles.problem}>{r.error}</div> : null}
                  <div className={styles.muted}>
                    {r.findings} notes · {r.actions} proposals · status {r.status}
                    {r.skipReason ? ` (${r.skipReason.replace(/_/g, " ")})` : ""}
                  </div>
                </>
              }
            />
          ))
        )}
      </Section>
    </>
  );
}

const CAP_WORDS: Record<string, string> = { on: "On", approval: "Asks you first", off: "Off", never: "Never" };

function RobotSettings({ d, owner, onChanged }: { d: RobotDetail; owner: boolean; onChanged: () => void }) {
  const s = d.state;
  const name = d.robot.name;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState(d.teach.guidance);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const dirty = text.trim() !== (d.teach.guidance || "").trim();
  const agentToRun = d.teach.agent;

  const pause = async () => {
    setBusy(true);
    try {
      await setRobotPaused(d.robot.key, !s.paused);
      setMsg(s.paused ? `${name} is awake again.` : `${name} is paused. No shifts until you wake it up.`);
      onChanged();
    } catch (e) {
      setMsg(errorMessage(e, "That didn't go through.").message);
    } finally {
      setBusy(false);
    }
  };
  const runNow = async () => {
    if (!agentToRun) return;
    if (!window.confirm(`Start ${name}'s shift now? It uses a little of the AI budget (each shift has a limit).`)) return;
    setBusy(true);
    try {
      await runShiftNow(agentToRun);
      setMsg(`${name} started a shift. It usually takes a minute or two.`);
      window.setTimeout(onChanged, 4000);
    } catch (e) {
      setMsg(errorMessage(e, "Couldn't start the shift.").message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setProblems([]);
    setOk(null);
    try {
      const r = await saveGuidance(d.robot.key, text, note);
      setOk(r.unchanged ? "Nothing changed." : `Saved. ${name} will read it before the next shift.`);
      setNote("");
      onChanged();
    } catch (e) {
      const m = errorMessage(e, "Couldn't save.");
      setProblems(m.problems.length ? m.problems : [m.message]);
    } finally {
      setBusy(false);
    }
  };
  const restore = async (v: number) => {
    if (!window.confirm(`Go back to version ${v}? You can undo this later.`)) return;
    try {
      const r = await restoreGuidance(d.robot.key, v);
      setText(r.guidance);
      setOk(`Restored. ${name} will use it next shift.`);
      onChanged();
    } catch (e) {
      setProblems([errorMessage(e, "Couldn't restore.").message]);
    }
  };

  return (
    <>
      <Section title="On / off">
        <div className={styles.card}>
          <div style={{ fontWeight: 800 }}>{s.paused ? `${name} is paused.` : `${name} is on.`}</div>
          <div className={styles.muted}>
            This month {name} used {money(s.monthCostCents)} of AI time.
            {d.robot.key === "conversation" ? " Pausing Marcus also stops him drafting replies." : ""}
          </div>
          {owner ? (
            <div className={styles.btnRow}>
              <button type="button" className={`${styles.btn} ${s.paused ? styles.btnGood : styles.btnSoft}`} disabled={busy} onClick={pause}>
                {s.paused ? "Wake up" : "Pause"}
              </button>
              {agentToRun ? (
                <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy || s.status === "working"} onClick={runNow}>
                  Start a shift now
                </button>
              ) : null}
            </div>
          ) : (
            <div className={styles.muted} style={{ marginTop: 6 }}>
              Only the owner can change this.
            </div>
          )}
          {msg ? <div className={styles.ok}>{msg}</div> : null}
        </div>
      </Section>

      <Section title="What I'm allowed to do">
        <div className={styles.card}>
          {d.capabilities.map((c) => (
            <div key={c.label} className={styles.capRow}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.label}</div>
                <div className={styles.muted}>{c.note}</div>
              </div>
              <span
                className={`${styles.cap} ${
                  c.state === "on" ? styles.capOn : c.state === "approval" ? styles.capApproval : c.state === "never" ? styles.capNever : styles.capOff
                }`}
              >
                {CAP_WORDS[c.state] || c.state}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Teach ${name}`}>
        <RobotSays robot={d.robot.key} compact simple={d.teach.explained?.simple} />
        {d.teach.teachable ? (
          <div className={styles.card} style={{ marginTop: 8 }}>
            <label className={styles.fieldLabel} htmlFor="guidance">
              What should {name} focus on?
            </label>
            <textarea
              id="guidance"
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`For example: "Focus on Massapequa and Seaford this month." or "Keep it short and friendly."`}
              maxLength={1600}
              readOnly={!owner}
            />
            <div className={styles.muted} style={{ display: "flex", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
              <span>Towns, priorities, tone. Not prices, offers, bookings, ads or mail.</span>
              <span>{text.trim().length}/1500</span>
            </div>
            {owner ? (
              <>
                <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why? (optional - kept in the history)" maxLength={200} />
                <div className={styles.btnRow}>
                  <button type="button" className={styles.btn} disabled={busy || !dirty} onClick={save}>
                    Save
                  </button>
                  {dirty ? (
                    <button type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => setText(d.teach.guidance)}>
                      Undo my edits
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
            {problems.map((p) => (
              <div key={p} className={styles.problem}>
                {p}
              </div>
            ))}
            {ok ? <div className={styles.ok}>{ok}</div> : null}
            <div className={styles.copyRow}>
              <CopyButton text={d.teach.explained?.chatgpt} label="Ask ChatGPT to help me write this" primary />
            </div>
            <div className={styles.muted} style={{ marginTop: 8 }}>
              This doesn&rsquo;t retrain the AI. {name} reads it before each shift, and its safety rules always come first.
            </div>
          </div>
        ) : null}
      </Section>

      <Section title={`${name} will never`}>
        <div className={styles.card}>
          <ul className={styles.neverList}>
            {d.robot.cannot.map((x) => (
              <li key={x}>{x}</li>
            ))}
            <li>Make up numbers, reviews or results</li>
          </ul>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} style={{ marginTop: 10 }} onClick={() => setShowRules(!showRules)}>
            {showRules ? "Hide" : "Show"} the full technical rules
          </button>
          {showRules ? <Pre>{d.teach.fixedRules}</Pre> : null}
        </div>
      </Section>

      {d.teach.history.length ? (
        <Section title="Earlier versions of my guidance">
          {d.teach.history.map((h) => (
            <div key={h.version} className={styles.card}>
              <div style={{ fontWeight: 800 }}>
                Version {h.version}
                <span className={styles.muted} style={{ fontWeight: 600 }}>
                  {" "}
                  · {when(h.at)}
                </span>
              </div>
              {h.note ? <div className={styles.muted}>{h.note}</div> : null}
              <Pre>{h.guidance || "(empty - no guidance)"}</Pre>
              {owner && h.version !== d.teach.version ? (
                <button type="button" className={`${styles.btn} ${styles.btnSoft}`} style={{ marginTop: 8 }} onClick={() => restore(h.version)}>
                  Use this version again
                </button>
              ) : null}
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="What I've learned (my notebook)">
        {d.learned.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>Nothing written yet.</span>
          </div>
        ) : (
          <details className={styles.card}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              {d.learned.length} notes (technical) - tap to read
            </summary>
            {d.learned.map((m) => (
              <div key={m.key} style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 12.5 }}>{m.key}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))}
          </details>
        )}
      </Section>
    </>
  );
}

/* ================================================================== */
/* Results                                                             */
/* ================================================================== */

const FUNNEL: Array<{ key: "booking_page_view" | "booker_started" | "slot_selected" | "signup_view" | "firstFreeVisits"; label: string }> = [
  { key: "booking_page_view", label: "Saw the booking form" },
  { key: "booker_started", label: "Started filling it" },
  { key: "slot_selected", label: "Picked a time" },
  { key: "signup_view", label: "Went to sign up" },
  { key: "firstFreeVisits", label: "Booked" },
];

export function ResultsPanel({ office, onClose, onOpenRequests }: { office: OfficeState; onClose: () => void; onOpenRequests: () => void }) {
  const k = office.kpis;
  const f = k.firstFreeVisits;
  const diff7 = f && f.last7 != null && f.prev7 != null ? f.last7 - f.prev7 : null;
  const funnel = k.funnel30;
  const top = Math.max(1, ...FUNNEL.map((s) => Number(funnel?.[s.key]) || 0));
  return (
    <Sheet
      onClose={onClose}
      label="Results"
      tall
      head={<Head color="#13B26B" initial="★" title="How we're doing" sub="Real numbers, updated every minute" onClose={onClose} />}
    >
      <RobotSays robot={null} simple={office.explained?.simple} chatgpt={office.explained?.chatgpt} />

      <div className={styles.card} style={{ background: "linear-gradient(180deg,#eafff4,#fff)", marginTop: 10 }}>
        <div className={styles.sectionTitle} style={{ color: "#13844f" }}>
          New first free-visit bookings
        </div>
        {f ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div className={styles.bigNum}>{f.last7 ?? "—"}</div>
              <div className={styles.muted}>this week</div>
            </div>
            <div style={{ paddingBottom: 4 }}>
              <div style={{ fontWeight: 800, color: diff7 == null ? "#7b8199" : diff7 > 0 ? "#13844f" : diff7 < 0 ? "#b4232a" : "#7b8199" }}>
                {diff7 == null ? "" : diff7 === 0 ? "same as last week" : `${diff7 > 0 ? "▲" : "▼"} ${Math.abs(diff7)} vs last week`}
              </div>
              <div className={styles.muted}>
                Last 30 days: {f.last30 ?? "—"} (before that: {f.prev30 ?? "—"})
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.muted}>I can&rsquo;t see this right now.</div>
        )}
      </div>

      <Section title={funnel?.days && !funnel.fullWindow ? `From looking to booking (last ${funnel.days} day${funnel.days === 1 ? "" : "s"})` : "From looking to booking (30 days)"}>
        <div className={styles.card}>
          {funnel ? (
            <>
              {FUNNEL.map((s) => {
                const v = funnel[s.key];
                const n = typeof v === "number" ? v : null;
                return (
                  <div key={s.key} className={styles.funnelRow}>
                    <span>{s.label}</span>
                    <span className={styles.bar}>
                      <span className={styles.barFill} style={{ width: `${n ? Math.max(3, Math.round((n / top) * 100)) : 0}%` }} />
                    </span>
                    <b style={{ textAlign: "right" }}>{n ?? "—"}</b>
                  </div>
                );
              })}
              <div className={styles.muted} style={{ marginTop: 8 }}>
                {funnel.since && funnel.through ? `Every step counts the same days: ${funnel.since} to ${funnel.through}.` : null}
                {funnel.fullWindow === false ? ` Page tracking began ${funnel.trackingSince}, so this is too early to judge rates.` : null}
              </div>
            </>
          ) : (
            <span className={styles.muted}>I can&rsquo;t see this right now.</span>
          )}
        </div>
      </Section>

      <Section title="Website & Google (30 days)">
        <div className={styles.grid2}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Visitors</div>
            <div className={styles.statValue}>{k.visitors30 ?? "—"}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Sign-ups</div>
            <div className={styles.statValue}>{k.registrations30 ?? "—"}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Clicks from Google</div>
            <div className={styles.statValue}>{k.search?.clicks ?? "—"}</div>
            <div className={styles.muted}>{k.search ? `shown ${k.search.impressions ?? "—"} times` : "not connected yet"}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>People who wrote to us</div>
            <div className={styles.statValue}>{k.conversations30.total}</div>
            <div className={styles.muted}>AI replies {office.conversationsEnabled ? "on" : "off"}</div>
          </div>
        </div>
      </Section>

      <Section title="AI team cost">
        <div className={styles.card}>
          <div className={styles.funnelRow} style={{ gridTemplateColumns: "90px 1fr 70px" }}>
            <span>Today</span>
            <span className={styles.bar}>
              <span className={styles.barFill} style={{ width: `${Math.min(100, (office.costs.todayCents / Math.max(1, office.costs.dailyCapCents)) * 100)}%` }} />
            </span>
            <b style={{ textAlign: "right" }}>{money(office.costs.todayCents)}</b>
          </div>
          <div className={styles.funnelRow} style={{ gridTemplateColumns: "90px 1fr 70px" }}>
            <span>This month</span>
            <span className={styles.bar}>
              <span className={styles.barFill} style={{ width: `${Math.min(100, (office.costs.monthCents / Math.max(1, office.costs.monthlyCapCents)) * 100)}%` }} />
            </span>
            <b style={{ textAlign: "right" }}>{money(office.costs.monthCents)}</b>
          </div>
          <div className={styles.muted} style={{ marginTop: 8 }}>
            Limits: {money(office.costs.dailyCapCents)} a day, {money(office.costs.monthlyCapCents)} a month. The robots stop at the limit.
          </div>
        </div>
      </Section>

      {office.approvals.total + office.approvals.notes > 0 ? (
        <Section title="Waiting for you">
          <div className={styles.card}>
            <div>
              {office.approvals.total} {office.approvals.total === 1 ? "question" : "questions"} · {office.approvals.notes} {office.approvals.notes === 1 ? "note" : "notes"}
            </div>
            <div className={styles.btnRow}>
              <button type="button" className={styles.btn} onClick={onOpenRequests}>
                Open requests
              </button>
            </div>
          </div>
        </Section>
      ) : null}

    </Sheet>
  );
}

/* ================================================================== */
/* Requests (approvals and notes)                                      */
/* ================================================================== */

export function RequestsPanel({ robot, owner, onClose, onChanged }: { robot?: RobotKey; owner: boolean; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ items: ApprovalItem[]; notes: ApprovalItem[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [only, setOnly] = useState<RobotKey | undefined>(robot);
  const [preview, setPreview] = useState<{ key: string; html: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getApprovals());
      setErr(null);
    } catch (e) {
      setErr(errorMessage(e, "I couldn't load the requests.").message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, label: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setErr(null);
    try {
      await fn();
      setDone(label);
      window.setTimeout(() => setDone(null), 2500);
      await load();
      onChanged();
    } catch (e) {
      setErr(errorMessage(e, "That didn't go through.").message);
    } finally {
      setBusy(null);
    }
  };

  const filter = (x: ApprovalItem) => !only || x.robot === only;
  const items = (data?.items || []).filter(filter);
  const notes = (data?.notes || []).filter(filter);

  const technical = (x: ApprovalItem) => (
    <>
      <b>{x.title}</b>
      {x.detail ? <div className={styles.muted} style={{ marginTop: 4 }}>{x.detail}</div> : null}
      {x.preview ? <div className={styles.preview}>{x.preview}</div> : null}
      {x.simple?.details?.length ? (
        <ul className={styles.list} style={{ marginTop: 6 }}>
          {x.simple.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      {x.kind === "playbook" ? (
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSoft}`}
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (preview?.key === x.id) return setPreview(null);
              try {
                const p = await getPlaybookPreview(x.id);
                setPreview({ key: x.id, html: p.html });
              } catch {
                setErr("The email preview couldn't load.");
              }
            }}
          >
            {preview?.key === x.id ? "Hide the email" : "Show the email as people will see it"}
          </button>
          {preview?.key === x.id ? (
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{ width: "100%", height: 360, border: 0, borderRadius: 12, marginTop: 8, background: "#fff" }} />
          ) : null}
        </>
      ) : null}
      <div className={styles.muted} style={{ marginTop: 6 }}>
        {when(x.at)}
        {x.risk ? ` · risk: ${x.risk}` : ""}
      </div>
    </>
  );

  const buttonsFor = (x: ApprovalItem) => {
    if (!owner) return [];
    const off = busy === x.id;
    if (x.kind === "action")
      return [
        { label: "Yes, do it", tone: "yes" as const, disabled: off, onClick: () => act(x.id, "Done - approved.", () => decideAction(x.id, "approve")) },
        { label: "Not now", tone: "no" as const, disabled: off, onClick: () => act(x.id, "OK - not now.", () => decideAction(x.id, "reject", "Not now")) },
      ];
    if (x.kind === "playbook")
      return [
        { label: "Yes, use it", tone: "yes" as const, disabled: off, onClick: () => act(x.id, "Done - the email is approved.", () => decidePlaybook(x.id, "approve")) },
        { label: "Not now", tone: "no" as const, disabled: off, onClick: () => act(x.id, "OK - retired.", () => decidePlaybook(x.id, "retire", "Not now")) },
      ];
    if (x.kind === "draft")
      return [
        { label: "I've seen it", tone: "yes" as const, disabled: off, onClick: () => act(x.id, "Marked as seen.", () => setFindingStatus(x.id, "acknowledged")) },
        { label: "Not useful", tone: "no" as const, disabled: off, onClick: () => act(x.id, "Removed.", () => setFindingStatus(x.id, "dismissed")) },
      ];
    return [
      { label: "Got it", tone: "yes" as const, disabled: off, onClick: () => act(x.id, "Got it.", () => setFindingStatus(x.id, "acknowledged")) },
      { label: "Not useful", tone: "no" as const, disabled: off, onClick: () => act(x.id, "Removed.", () => setFindingStatus(x.id, "dismissed")) },
    ];
  };

  return (
    <Sheet
      onClose={onClose}
      label="Requests"
      tall
      head={<Head color="#FFB21F" initial="!" title="Requests" sub="Nothing happens until you say yes" onClose={onClose} />}
      tabs={
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${!only ? styles.tabOn : ""}`} onClick={() => setOnly(undefined)}>
            Everyone
          </button>
          {(["visibility", "outreach", "conversation"] as RobotKey[]).map((k) => (
            <button key={k} type="button" className={`${styles.tab} ${only === k ? styles.tabOn : ""}`} onClick={() => setOnly(k)}>
              {ROBOT_LOOKS[k].name}
            </button>
          ))}
        </div>
      }
    >
      {err ? <div className={styles.problem}>{err}</div> : null}
      {done ? <div className={styles.ok}>{done}</div> : null}
      {!data ? (
        <div className={styles.muted}>Loading…</div>
      ) : (
        <>
          <Section title={items.length ? `Questions for you (${items.length})` : "Questions for you"}>
            {items.length === 0 ? (
              <div className={styles.card}>
                <span className={styles.muted}>No questions right now. 🎈</span>
              </div>
            ) : (
              items.map((x) => (
                <RobotSays
                  key={`${x.kind}:${x.id}`}
                  robot={x.robot}
                  meta={ago(x.at)}
                  simple={x.simple || { say: x.title }}
                  chatgpt={x.chatgpt}
                  actions={buttonsFor(x)}
                  details={technical(x)}
                />
              ))
            )}
            {!owner && items.length ? <div className={styles.muted}>Only the owner can answer these.</div> : null}
          </Section>
          <Section title={notes.length ? `Notes from the robots (${notes.length})` : "Notes from the robots"}>
            {notes.length === 0 ? (
              <div className={styles.card}>
                <span className={styles.muted}>No notes right now.</span>
              </div>
            ) : (
              notes.map((x) => (
                <RobotSays
                  key={x.id}
                  robot={x.robot}
                  meta={`${x.severity === "high" ? "Important · " : ""}${ago(x.at)}`}
                  simple={x.simple || { say: x.title }}
                  chatgpt={x.chatgpt}
                  fullReport={`${x.title}\n\n${x.detail}`}
                  actions={buttonsFor(x)}
                  details={technical(x)}
                />
              ))
            )}
          </Section>
        </>
      )}
    </Sheet>
  );
}
