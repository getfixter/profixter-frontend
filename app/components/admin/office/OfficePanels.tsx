"use client";

/**
 * The small panels that open over the office: a robot (Now / Work / Teach),
 * the results board, and the approvals. Every button here calls a real
 * endpoint; anything the system can't do is labelled, not faked.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import styles from "./office.module.css";

const STATUS_WORDS: Record<string, string> = {
  working: "Working",
  needs_you: "Needs you",
  error: "Stuck",
  waiting: "Waiting for its next shift",
  paused: "Paused",
  off: "Switched off",
};

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

export function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside className={styles.sheet} role="dialog" aria-label={label} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </aside>
  );
}

function Head({ color, initial, title, sub, onClose }: { color: string; initial: string; title: string; sub: string; onClose: () => void }) {
  return (
    <div className={styles.sheetHead}>
      <div className={styles.avatar} style={{ background: color }}>
        {initial}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className={styles.sheetTitle}>{title}</div>
        <div className={styles.sheetSub}>{sub}</div>
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

/* ================================================================== */
/* Robot                                                               */
/* ================================================================== */

export type RobotTab = "now" | "work" | "teach";

export function RobotPanel({
  robotKey,
  tab,
  onTab,
  owner,
  onClose,
  onChanged,
  onOpenApprovals,
}: {
  robotKey: RobotKey;
  tab: RobotTab;
  onTab: (t: RobotTab) => void;
  owner: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenApprovals: (robot: RobotKey) => void;
}) {
  const look = ROBOT_LOOKS[robotKey];
  const [d, setD] = useState<RobotDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await getRobot(robotKey));
      setErr(null);
    } catch (e) {
      setErr(errorMessage(e, "Couldn't load this robot.").message);
    }
  }, [robotKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after mount
    setD(null);
    load();
  }, [load]);

  const refresh = () => {
    load();
    onChanged();
  };

  return (
    <Sheet onClose={onClose} label={`${look.name}`}>
      <Head color={look.body} initial={look.name[0]} title={look.name} sub={d ? `${d.robot.role} · ${d.robot.personality}` : "…"} onClose={onClose} />
      <div className={styles.tabs} role="tablist">
        {(["now", "work", "teach"] as RobotTab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabOn : ""}`} onClick={() => onTab(t)}>
            {t === "now" ? "Now" : t === "work" ? "Work" : "Teach"}
          </button>
        ))}
      </div>
      <div className={styles.sheetBody}>
        {err ? <div className={styles.problem}>{err}</div> : null}
        {!d ? (
          <div className={styles.muted}>Loading…</div>
        ) : tab === "now" ? (
          <RobotNow d={d} owner={owner} onChanged={refresh} onOpenApprovals={() => onOpenApprovals(robotKey)} />
        ) : tab === "work" ? (
          <RobotWork d={d} owner={owner} onChanged={refresh} />
        ) : (
          <RobotTeach d={d} owner={owner} onChanged={refresh} />
        )}
      </div>
    </Sheet>
  );
}

function RobotNow({ d, owner, onChanged, onOpenApprovals }: { d: RobotDetail; owner: boolean; onChanged: () => void; onOpenApprovals: () => void }) {
  const s = d.state;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const lastRun = d.runs.find((r) => r.status !== "skipped");
  const light = STATUS_LIGHT[s.status];
  const runnable = d.runs.length ? d.runs[0].agent : null;
  const agentToRun = d.teach.agent || runnable;

  const pause = async () => {
    setBusy(true);
    try {
      await setRobotPaused(d.robot.key, !s.paused);
      onChanged();
    } catch (e) {
      setMsg(errorMessage(e, "That didn't go through.").message);
    } finally {
      setBusy(false);
    }
  };
  const runNow = async () => {
    if (!agentToRun) return;
    if (!window.confirm(`Start ${d.robot.name}'s shift now? It uses the AI budget (this shift is capped, and the monthly cap still applies).`)) return;
    setBusy(true);
    try {
      await runShiftNow(agentToRun);
      setMsg("Shift started. It usually takes a minute or two.");
      setTimeout(onChanged, 4000);
    } catch (e) {
      setMsg(errorMessage(e, "Couldn't start the shift.").message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <span className={styles.statusPill} style={{ background: `${light}22`, color: "#1d2340" }}>
          <span className={styles.dot} style={{ background: light }} />
          {STATUS_WORDS[s.status]}
        </span>
        <div style={{ marginTop: 8, fontWeight: 700 }}>{s.statusText}</div>
        <div className={styles.muted} style={{ marginTop: 4 }}>
          {s.nextRunLabel ? `Shifts: ${d.schedule.join(" · ")}` : "No scheduled shifts"}
          {s.nextRunAt ? ` · next ${when(s.nextRunAt)}` : ""}
        </div>
        {s.waiting > 0 ? (
          <div className={styles.btnRow}>
            <button type="button" className={styles.btn} onClick={onOpenApprovals}>
              Review {s.waiting} waiting
            </button>
          </div>
        ) : null}
      </div>

      <Section title="Its job">
        <div className={styles.card}>
          <div style={{ fontWeight: 700 }}>{d.robot.mission}</div>
          <ul className={styles.list} style={{ marginTop: 8 }}>
            {d.robot.does.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Last shift">
        <div className={styles.card}>
          {lastRun ? (
            <>
              <div className={styles.muted}>
                {when(lastRun.at)} · {lastRun.status === "succeeded" ? "finished" : lastRun.status.replace("_", " ")} · {money(lastRun.costCents)}
              </div>
              {lastRun.summary ? <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{lastRun.summary}</div> : null}
              {lastRun.error ? <div className={styles.problem}>{lastRun.error}</div> : null}
            </>
          ) : (
            <div className={styles.muted}>No shifts yet.</div>
          )}
        </div>
      </Section>

      {d.results.length ? (
        <Section title="Latest results">
          {d.results.map((r) => (
            <div key={r.id} className={styles.card}>
              {r.title}
              <div className={styles.muted}>
                {when(r.at)}
                {r.verification ? ` · check: ${r.verification}` : ""}
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      {d.mistakes.length ? (
        <Section title="Problems">
          {d.mistakes.slice(0, 3).map((m, i) => (
            <div key={i} className={styles.card}>
              <div style={{ fontWeight: 700 }}>{m.what}</div>
              <div className={styles.muted}>
                {when(m.at)}
                {m.detail ? ` · ${m.detail}` : ""}
              </div>
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="What's switched on">
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
                {c.state === "approval" ? "you approve" : c.state}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Controls">
        <div className={styles.card}>
          <div className={styles.muted}>
            This month: {money(s.monthCostCents)} of AI time.{" "}
            {s.paused ? "Paused: no scheduled shifts" + (d.robot.key === "conversation" ? " and no reply drafting" : "") + " until you resume." : ""}
          </div>
          {owner ? (
            <div className={styles.btnRow}>
              <button type="button" className={`${styles.btn} ${s.paused ? styles.btnGood : styles.btnSoft}`} disabled={busy} onClick={pause}>
                {s.paused ? "Wake up (resume)" : "Pause"}
              </button>
              {agentToRun ? (
                <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy || s.status === "working"} onClick={runNow}>
                  Start a shift now
                </button>
              ) : null}
            </div>
          ) : (
            <div className={styles.muted} style={{ marginTop: 6 }}>
              Only the owner can pause or start shifts.
            </div>
          )}
          {msg ? <div className={styles.ok}>{msg}</div> : null}
        </div>
      </Section>
    </>
  );
}

function RobotWork({ d, owner, onChanged }: { d: RobotDetail; owner: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const mark = async (id: string, status: "acknowledged" | "dismissed") => {
    await setFindingStatus(id, status).catch(() => {});
    onChanged();
  };
  return (
    <>
      <Section title="Open notes for you">
        {d.findings.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>Nothing open.</span>
          </div>
        ) : (
          d.findings.map((f) => (
            <div key={f.id} className={styles.card}>
              <button type="button" onClick={() => setOpen(open === f.id ? null : f.id)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <div style={{ fontWeight: 800 }}>{f.title}</div>
                <div className={styles.muted}>
                  {f.kind.replace("_", " ")} · {f.severity} · {when(f.at)}
                </div>
              </button>
              {open === f.id ? <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{f.detail}</div> : null}
              {owner ? (
                <div className={styles.btnRow}>
                  <button type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => mark(f.id, "acknowledged")}>
                    Got it
                  </button>
                  <button type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => mark(f.id, "dismissed")}>
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Section>
      <Section title="Shift history">
        {d.runs.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>No shifts yet.</span>
          </div>
        ) : (
          d.runs.map((r) => (
            <div key={r.id} className={styles.card}>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <div style={{ fontWeight: 800 }}>
                  {r.status === "succeeded" ? "✓" : r.status === "failed" ? "✗" : r.status === "running" ? "…" : "–"} {when(r.at)}
                  <span className={styles.muted} style={{ fontWeight: 600 }}>
                    {" "}
                    · {r.trigger === "event" ? "reply decision" : r.trigger} · {money(r.costCents)}
                  </span>
                </div>
                {r.skipReason ? <div className={styles.muted}>Skipped: {r.skipReason.replace(/_/g, " ")}</div> : null}
                {!open || open !== r.id ? (
                  <div className={styles.muted} style={{ marginTop: 3 }}>
                    {r.summary ? `${r.summary.slice(0, 120)}${r.summary.length > 120 ? "…" : ""}` : r.error || ""}
                  </div>
                ) : null}
              </button>
              {open === r.id ? (
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {r.summary || "No summary."}
                  {r.error ? <div className={styles.problem}>{r.error}</div> : null}
                  <div className={styles.muted} style={{ marginTop: 6 }}>
                    {r.findings} notes · {r.actions} proposals
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Section>
    </>
  );
}

function RobotTeach({ d, owner, onChanged }: { d: RobotDetail; owner: boolean; onChanged: () => void }) {
  const [text, setText] = useState(d.teach.guidance);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const dirty = text.trim() !== (d.teach.guidance || "").trim();

  const save = async () => {
    setBusy(true);
    setProblems([]);
    setOk(null);
    try {
      const r = await saveGuidance(d.robot.key, text, note);
      setOk(r.unchanged ? "No change." : `Saved as version ${r.version}. ${d.robot.name} reads it on the next shift.`);
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
    if (!window.confirm(`Go back to version ${v}? It's saved as a new version, so you can undo it.`)) return;
    try {
      const r = await restoreGuidance(d.robot.key, v);
      setText(r.guidance);
      setOk(`Restored. Now version ${r.version}.`);
      onChanged();
    } catch (e) {
      setProblems([errorMessage(e, "Couldn't restore.").message]);
    }
  };

  return (
    <>
      <div className={styles.card} style={{ background: "#f4f6ff" }}>
        <div style={{ fontWeight: 800 }}>How teaching works</div>
        <div className={styles.muted} style={{ marginTop: 4 }}>
          This doesn&rsquo;t retrain the AI. Your guidance is added to {d.robot.name}&rsquo;s instructions on its next shift, below the fixed rules - and the fixed rules always win. {d.teach.note}
        </div>
      </div>

      <Section title="It will never (fixed - can't be changed here)">
        <div className={styles.card}>
          <ul className={styles.neverList}>
            {d.robot.cannot.map((x) => (
              <li key={x}>{x}</li>
            ))}
            <li>Invent numbers, reviews or results - everything is measured</li>
          </ul>
          <button type="button" className={`${styles.btn} ${styles.btnSoft}`} style={{ marginTop: 10 }} onClick={() => setShowRules(!showRules)}>
            {showRules ? "Hide" : "Show"} its full instructions
          </button>
          {showRules ? <div className={styles.pre} style={{ marginTop: 8 }}>{d.teach.fixedRules}</div> : null}
        </div>
      </Section>

      <Section title={`Your guidance${d.teach.version ? ` · version ${d.teach.version}` : ""}`}>
        {d.teach.teachable ? (
          <div className={styles.card}>
            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`e.g. "Focus on Massapequa and Seaford this month." or "Keep it short and friendly."`}
              maxLength={1600}
              readOnly={!owner}
              aria-label={`Guidance for ${d.robot.name}`}
            />
            <div className={styles.muted} style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span>Focus, priorities, tone. Not prices, offers, bookings, ads or mail.</span>
              <span>{text.trim().length}/1500</span>
            </div>
            {owner ? (
              <>
                <input
                  className={styles.textarea}
                  style={{ minHeight: 0, height: 40, marginTop: 8 }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why (optional, kept in the history)"
                  maxLength={200}
                />
                <div className={styles.btnRow}>
                  <button type="button" className={styles.btn} disabled={busy || !dirty} onClick={save}>
                    Save guidance
                  </button>
                  {dirty ? (
                    <button type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => setText(d.teach.guidance)}>
                      Undo edits
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.muted}>Only the owner can change guidance.</div>
            )}
            {problems.map((p) => (
              <div key={p} className={styles.problem}>
                {p}
              </div>
            ))}
            {ok ? <div className={styles.ok}>{ok}</div> : null}
          </div>
        ) : (
          <div className={styles.card}>
            <span className={styles.muted}>Not teachable yet.</span>
          </div>
        )}
      </Section>

      {d.teach.history.length ? (
        <Section title="Version history">
          {d.teach.history.map((h) => (
            <div key={h.version} className={styles.card}>
              <div style={{ fontWeight: 800 }}>
                Version {h.version}
                <span className={styles.muted} style={{ fontWeight: 600 }}>
                  {" "}
                  · {when(h.at)} · {h.by}
                </span>
              </div>
              {h.note ? <div className={styles.muted}>{h.note}</div> : null}
              <div className={styles.pre} style={{ marginTop: 6, maxHeight: 120 }}>
                {h.guidance || "(empty - no guidance)"}
              </div>
              {owner && h.version !== d.teach.version ? (
                <button type="button" className={`${styles.btn} ${styles.btnSoft}`} style={{ marginTop: 8 }} onClick={() => restore(h.version)}>
                  Restore this version
                </button>
              ) : null}
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="What it has learned (its notebook)">
        {d.learned.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>Nothing written yet.</span>
          </div>
        ) : (
          d.learned.map((m) => (
            <div key={m.key} className={styles.card}>
              <div style={{ fontWeight: 800, fontSize: 12.5 }}>{m.key}</div>
              <div style={{ marginTop: 3, whiteSpace: "pre-wrap" }}>{m.content}</div>
              <div className={styles.muted}>{when(m.at)}</div>
            </div>
          ))
        )}
      </Section>

      <Section title="Mistakes & outcomes">
        {d.mistakes.length === 0 ? (
          <div className={styles.card}>
            <span className={styles.muted}>No failed shifts, refused tools, declined or rolled-back work.</span>
          </div>
        ) : (
          d.mistakes.map((m, i) => (
            <div key={i} className={styles.card}>
              <div style={{ fontWeight: 700 }}>{m.what}</div>
              <div className={styles.muted}>
                {when(m.at)}
                {m.detail ? ` · ${m.detail}` : ""}
              </div>
            </div>
          ))
        )}
      </Section>
    </>
  );
}

/* ================================================================== */
/* Results (the wall display)                                          */
/* ================================================================== */

const FUNNEL: Array<{ key: "booking_page_view" | "booker_started" | "slot_selected" | "signup_view" | "firstFreeVisits"; label: string }> = [
  { key: "booking_page_view", label: "Saw the booker" },
  { key: "booker_started", label: "Started" },
  { key: "slot_selected", label: "Picked a time" },
  { key: "signup_view", label: "Went to sign up" },
  { key: "firstFreeVisits", label: "Booked" },
];

export function ResultsPanel({ office, onClose, onOpenApprovals }: { office: OfficeState; onClose: () => void; onOpenApprovals: () => void }) {
  const k = office.kpis;
  const f = k.firstFreeVisits;
  const diff7 = f && f.last7 != null && f.prev7 != null ? f.last7 - f.prev7 : null;
  const funnel = k.funnel30;
  const top = Math.max(1, ...FUNNEL.map((s) => Number(funnel?.[s.key]) || 0));
  const sources = [...(k.bySource30 || [])].filter((s) => s.freeVisits).sort((a, b) => b.freeVisits - a.freeVisits).slice(0, 5);
  return (
    <Sheet onClose={onClose} label="Results">
      <Head color="#13B26B" initial="★" title="Results" sub="Real numbers, refreshed every minute" onClose={onClose} />
      <div className={styles.sheetBody}>
        <div className={styles.card} style={{ background: "linear-gradient(180deg,#eafff4,#fff)" }}>
          <div className={styles.sectionTitle} style={{ color: "#13844f" }}>
            New first free-visit bookings
          </div>
          {f ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div className={styles.bigNum}>{f.last7 ?? "—"}</div>
                <div className={styles.muted}>last 7 days</div>
              </div>
              <div style={{ paddingBottom: 4 }}>
                <div style={{ fontWeight: 800, color: diff7 == null ? "#7b8199" : diff7 > 0 ? "#13844f" : diff7 < 0 ? "#b4232a" : "#7b8199" }}>
                  {diff7 == null ? "" : diff7 === 0 ? "same as the week before" : `${diff7 > 0 ? "▲" : "▼"} ${Math.abs(diff7)} vs the week before`}
                </div>
                <div className={styles.muted}>
                  30 days: {f.last30 ?? "—"} (before: {f.prev30 ?? "—"})
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.muted}>Unavailable right now.</div>
          )}
          {sources.length ? <div className={styles.muted} style={{ marginTop: 8 }}>From: {sources.map((s) => `${s.label} ${s.freeVisits}`).join(" · ")}</div> : null}
        </div>

        <Section title="Booking funnel, 30 days">
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
                  Steps counted since {funnel.trackingSince}, once per browser per day.
                </div>
              </>
            ) : (
              <span className={styles.muted}>Unavailable right now.</span>
            )}
          </div>
        </Section>

        <Section title="Website & search">
          <div className={styles.grid2}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Visitors · 30d</div>
              <div className={styles.statValue}>{k.visitors30 ?? "—"}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Sign-ups · 30d</div>
              <div className={styles.statValue}>{k.registrations30 ?? "—"}</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Google clicks{k.search ? ` · ${k.search.windowDays}d` : ""}</div>
              <div className={styles.statValue}>{k.search?.clicks ?? "—"}</div>
              <div className={styles.muted}>
                {k.search
                  ? `${k.search.impressions ?? "—"} impressions${k.search.clicksChangePct != null ? ` · ${k.search.clicksChangePct > 0 ? "+" : ""}${k.search.clicksChangePct}%` : ""}`
                  : `Search Console: ${k.searchReason || "not connected"}`}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Conversations · 30d</div>
              <div className={styles.statValue}>{k.conversations30.qualified}</div>
              <div className={styles.muted}>
                qualified of {k.conversations30.total} · replies {office.conversationsEnabled ? "on" : "off"}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Running costs (AI)">
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
              Caps: {money(office.costs.dailyCapCents)} a day, {money(office.costs.monthlyCapCents)} a month. Shifts stop at the cap.
            </div>
          </div>
        </Section>

        <Section title="Work">
          <div className={styles.card}>
            <div>
              {office.approvals.total} waiting for your approval · {office.approvals.notes} open notes
            </div>
            {office.approvals.total + office.approvals.notes > 0 ? (
              <div className={styles.btnRow}>
                <button type="button" className={styles.btn} onClick={onOpenApprovals}>
                  Open approvals
                </button>
              </div>
            ) : null}
          </div>
        </Section>

        {office.report ? (
          <Section title="Monday report">
            <div className={styles.card}>
              <div style={{ fontWeight: 800 }}>{office.report.headline}</div>
              <div className={styles.muted}>{when(office.report.at)}</div>
            </div>
          </Section>
        ) : null}
      </div>
    </Sheet>
  );
}

/* ================================================================== */
/* Approvals                                                           */
/* ================================================================== */

export function ApprovalsPanel({ robot, owner, onClose, onChanged }: { robot?: RobotKey; owner: boolean; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ items: ApprovalItem[]; notes: ApprovalItem[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [only, setOnly] = useState<RobotKey | undefined>(robot);
  const [preview, setPreview] = useState<{ key: string; html: string; subject: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getApprovals());
      setErr(null);
    } catch (e) {
      setErr(errorMessage(e, "Couldn't load approvals.").message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setErr(null);
    try {
      await fn();
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

  const robotChip = (k: RobotKey | null) => {
    if (!k) return null;
    const l = ROBOT_LOOKS[k];
    return (
      <span className={styles.statusPill} style={{ background: `${l.body}33`, padding: "2px 8px", fontSize: 11 }}>
        {l.name}
      </span>
    );
  };

  return (
    <Sheet onClose={onClose} label="Approvals">
      <Head color="#FFB21F" initial="!" title="Needs you" sub="Nothing here happens until you decide" onClose={onClose} />
      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${!only ? styles.tabOn : ""}`} onClick={() => setOnly(undefined)}>
          All
        </button>
        {(["visibility", "outreach", "conversation"] as RobotKey[]).map((k) => (
          <button key={k} type="button" className={`${styles.tab} ${only === k ? styles.tabOn : ""}`} onClick={() => setOnly(k)}>
            {ROBOT_LOOKS[k].name}
          </button>
        ))}
      </div>
      <div className={styles.sheetBody}>
        {err ? <div className={styles.problem}>{err}</div> : null}
        {!data ? (
          <div className={styles.muted}>Loading…</div>
        ) : (
          <>
            <Section title={`To approve (${items.length})`}>
              {items.length === 0 ? (
                <div className={styles.card}>
                  <span className={styles.muted}>Nothing waiting. 🎈</span>
                </div>
              ) : (
                items.map((x) => (
                  <div key={`${x.kind}:${x.id}`} className={styles.card}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {robotChip(x.robot)}
                      <span className={styles.muted}>
                        {x.kind === "action" ? "proposal" : x.kind === "playbook" ? "email wording" : "draft"} · {ago(x.at)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, marginTop: 6 }}>{x.title}</div>
                    {x.detail ? <div className={styles.muted} style={{ marginTop: 3 }}>{x.detail}</div> : null}
                    {x.preview ? <div className={styles.preview}>{x.preview}</div> : null}
                    {x.kind === "playbook" && preview?.key === x.id ? (
                      <iframe
                        title="Email preview"
                        sandbox=""
                        srcDoc={preview.html}
                        style={{ width: "100%", height: 360, border: 0, borderRadius: 12, marginTop: 8, background: "#fff" }}
                      />
                    ) : null}
                    {x.kind === "draft" ? <div className={styles.muted} style={{ marginTop: 6 }}>Publishing isn&rsquo;t automated - use it, then mark it reviewed.</div> : null}
                    {owner ? (
                      <div className={styles.btnRow}>
                        {x.kind === "action" ? (
                          <>
                            <button type="button" className={`${styles.btn} ${styles.btnGood}`} disabled={busy === x.id} onClick={() => act(x.id, () => decideAction(x.id, "approve"))}>
                              Approve
                            </button>
                            <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy === x.id} onClick={() => act(x.id, () => decideAction(x.id, "reject"))}>
                              Decline
                            </button>
                          </>
                        ) : x.kind === "playbook" ? (
                          <>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSoft}`}
                              onClick={async () => {
                                if (preview?.key === x.id) return setPreview(null);
                                try {
                                  setPreview({ key: x.id, ...(await getPlaybookPreview(x.id)) });
                                } catch {
                                  setErr("The preview couldn't load.");
                                }
                              }}
                            >
                              {preview?.key === x.id ? "Hide email" : "Read the email"}
                            </button>
                            <button type="button" className={`${styles.btn} ${styles.btnGood}`} disabled={busy === x.id} onClick={() => act(x.id, () => decidePlaybook(x.id, "approve"))}>
                              Approve wording
                            </button>
                            <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy === x.id} onClick={() => act(x.id, () => decidePlaybook(x.id, "retire"))}>
                              Retire
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={`${styles.btn} ${styles.btnGood}`} disabled={busy === x.id} onClick={() => act(x.id, () => setFindingStatus(x.id, "acknowledged"))}>
                              Mark reviewed
                            </button>
                            <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy === x.id} onClick={() => act(x.id, () => setFindingStatus(x.id, "dismissed"))}>
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </Section>
            <Section title={`Notes from the robots (${notes.length})`}>
              {notes.length === 0 ? (
                <div className={styles.card}>
                  <span className={styles.muted}>No open notes.</span>
                </div>
              ) : (
                notes.map((x) => (
                  <div key={x.id} className={styles.card}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {robotChip(x.robot)}
                      <span className={styles.muted}>
                        {x.severity} · {ago(x.at)}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, marginTop: 6 }}>{x.title}</div>
                    <details style={{ marginTop: 4 }}>
                      <summary className={styles.muted} style={{ cursor: "pointer" }}>
                        Read
                      </summary>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{x.detail}</div>
                    </details>
                    {owner ? (
                      <div className={styles.btnRow}>
                        <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy === x.id} onClick={() => act(x.id, () => setFindingStatus(x.id, "acknowledged"))}>
                          Got it
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.btnSoft}`} disabled={busy === x.id} onClick={() => act(x.id, () => setFindingStatus(x.id, "dismissed"))}>
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </Section>
          </>
        )}
      </div>
    </Sheet>
  );
}
