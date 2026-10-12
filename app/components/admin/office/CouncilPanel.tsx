"use client";

/**
 * The council chamber: talk to King Arthur, answer what he brings you, and
 * follow the tasks he gives the heroes.
 *
 *   Talk       the owner <-> Arthur conversation (his answers and briefings,
 *              with what he actually did: tasks given, records filed)
 *   Decisions  what waits for the owner, each with Arthur's recommendation.
 *              Approving still goes through the owner's own buttons and the
 *              same endpoints as Requests; Arthur's guidance proposals are
 *              saved only when the owner confirms them here.
 *   Tasks      every instruction with its real state: received, waiting for
 *              the next shift, working, done (waiting for a check), checked.
 *   Mission    his standing mission (owner guidance): read it, edit it, or
 *              restore any earlier version. The fixed safety rules always win.
 *
 * "✨ Copy All for ChatGPT" and "Copy full status report" are built by the
 * server from records (no AI call) and prepared as soon as the panel opens,
 * so one tap copies them.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  bringBackDecision,
  cancelCouncilTask,
  deferDecision,
  errorMessage,
  getCouncil,
  getCouncilReport,
  resolveCouncilDecision,
  restoreArchived,
  restoreMission,
  saveMission,
  sendToArthur,
  verifyCouncilTask,
  type CouncilAction,
  type BoardItem,
  type CouncilState,
  type CouncilTask,
  type RobotKey,
} from "@/lib/office";
import { decideAction, decidePlaybook, setFindingStatus } from "@/lib/admin-growth";
import { ago, Head, Section, Sheet, when } from "./OfficePanels";
import { ARTHUR_LOOK, ROBOT_LOOKS } from "./office-layout";
import { CopyButton, copyText, useToast } from "./Talk";
import styles from "./office.module.css";

export type CouncilTab = "talk" | "decisions" | "tasks" | "mission";

const ROBOT_OF: Record<string, RobotKey> = { visibility: "visibility", outreach: "outreach", conversion: "conversation", conversation: "conversation" };

const TASK_WORDS: Record<string, { label: string; tone: "wait" | "work" | "done" | "bad" | "off" }> = {
  received: { label: "Received", tone: "wait" },
  assigned: { label: "Waiting for the next shift", tone: "wait" },
  in_progress: { label: "Working on it", tone: "work" },
  completed: { label: "Reported done · not checked yet", tone: "work" },
  blocked: { label: "Blocked", tone: "bad" },
  verified: { label: "Checked ✓", tone: "done" },
  not_verified: { label: "Not good enough · sent back", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "off" },
  archived: { label: "Archived", tone: "off" },
};

const ARCHIVE_WHY: Record<string, string> = {
  business_management: "outside the marketing mission",
  duplicate: "a duplicate",
  stale: "untouched for 30+ days",
  owner: "you said yes",
};

const CHOICE_WORDS: Record<string, string> = {
  approve: "Approve it",
  decline: "Decline it",
  ask_for_changes: "Ask for changes first",
  wait: "Wait for now",
  acknowledge: "Just note it",
  dismiss: "Dismiss it",
  confirm: "Save this guidance",
  see_reason: "See his reason",
};

const ACTION_WORDS: Record<string, string> = {
  "task.assigned": "📜 New task",
  "task.existing": "📜 Already on it",
  "task.refused": "⛔ Couldn't assign",
  "task.cancelled": "✕ Task withdrawn",
  "task.verified": "✓ Checked",
  "task.not_verified": "✗ Sent back",
  "decision.decision": "⚖️ For your decision",
  "decision.uncertain": "❔ Unclear - needs facts",
  "decision.info": "ℹ️ Noted for you",
  "decision.routine": "✓ Handled",
  "shift.started": "⚔️ Extra shift",
  "archive.done": "🗄 Archived",
  "archive.requested": "🗄 Asked you to archive",
  "archive.refused": "✋ Kept",
};

const SUGGESTIONS = [
  "What needs my decision today?",
  "What marketing is ready for me to publish?",
  "Where are we weakest on Google and Maps?",
  "Ask Leonidas for this week's Instagram and Facebook posts.",
];

const INTRO =
  "Boss, I'm King Arthur, your marketing director. I lead Odysseus (search and visibility), Leonidas (social and community) and Marcus (re-engagement): I set priorities, check their drafts, give them tasks and bring you what is ready. I can't approve, spend money, message customers, book visits or change ads, prices or rules - those stay yours. What would you like to know?";

function Crown({ size = 34 }: { size?: number }) {
  return (
    <div className={`${styles.talkAvatar} ${styles.crownAvatar}`} style={{ background: ARTHUR_LOOK.body, width: size, height: size }} aria-hidden>
      👑
    </div>
  );
}

/** A copy button for a server-built report, prepared before the tap so copying works on phones. */
export function ReportCopy({
  scope,
  label,
  primary,
  version,
  preset,
}: {
  scope: "pending" | "full";
  label: string;
  primary?: boolean;
  /** Changes whenever the board changes, so a fetched report is never older than the screen. */
  version: number | string;
  /** Text built from the very board on screen (same server response): used as is. */
  preset?: { text: string; count: number } | null;
}) {
  const toast = useToast();
  const [fetched, setFetched] = useState<{ text: string; count: number } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const text = preset?.text ?? fetched?.text ?? null;
  useEffect(() => {
    if (preset) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-prepare when the council changes
    setState("loading");
    getCouncilReport(scope)
      .then((r) => {
        if (!alive) return;
        setFetched({ text: r.text, count: r.count });
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [scope, version, preset]);
  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${primary ? styles.copyBtnPrimary : ""} ${primary ? styles.copyAll : ""}`}
      disabled={!text && state === "loading"}
      onClick={async (e) => {
        e.stopPropagation();
        let t = text;
        if (!t) {
          try {
            const r = await getCouncilReport(scope);
            t = r.text;
            setFetched({ text: r.text, count: r.count });
          } catch {
            toast("Couldn't prepare the report - try again");
            return;
          }
        }
        const ok = await copyText(t);
        toast(ok ? "Copied!" : "Couldn't copy - try again");
      }}
    >
      {primary ? "✨ " : "⧉ "}
      {!preset && state === "loading" && !text ? "Preparing…" : label}
    </button>
  );
}

export function CouncilPanel({
  owner,
  tab,
  onTab,
  onClose,
  onChanged,
  onOpenRequests,
}: {
  owner: boolean;
  tab: CouncilTab;
  onTab: (t: CouncilTab) => void;
  onClose: () => void;
  onChanged: () => void;
  onOpenRequests: () => void;
}) {
  const [data, setData] = useState<CouncilState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [waitingFor, setWaitingFor] = useState<number>(0); // messages count we wait to grow past
  const [version, setVersion] = useState(0);
  const listEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await getCouncil();
      setData(d);
      setErr(null);
      return d;
    } catch (e) {
      setErr(errorMessage(e, "I couldn't reach the council.").message);
      return null;
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Poll quickly while Arthur is answering, slowly otherwise.
  const replying = Boolean(data?.thinking) || (waitingFor > 0 && (data?.messages.length || 0) <= waitingFor);
  useEffect(() => {
    const id = window.setInterval(() => {
      load().then((d) => {
        if (d && waitingFor > 0 && d.messages.length > waitingFor && !d.thinking) {
          setWaitingFor(0);
          setVersion((v) => v + 1);
          onChanged();
        }
      });
    }, replying ? 3000 : 30000);
    return () => window.clearInterval(id);
  }, [load, replying, waitingFor, onChanged]);

  useEffect(() => {
    if (tab === "talk") listEnd.current?.scrollIntoView({ block: "end" });
  }, [tab, data?.messages.length, replying]);

  const act = async (id: string, label: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setErr(null);
    try {
      await fn();
      setDone(label);
      window.setTimeout(() => setDone(null), 2500);
      await load();
      setVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      setErr(errorMessage(e, "That didn't go through.").message);
    } finally {
      setBusy(null);
    }
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || replying) return;
    setErr(null);
    setBusy("send");
    try {
      await sendToArthur(t);
      setDraft("");
      const d = await load();
      setWaitingFor(d?.messages.length || 1);
    } catch (e) {
      setErr(errorMessage(e, "Your message didn't reach King Arthur.").message);
    } finally {
      setBusy(null);
    }
  };

  // The board comes from the server already grouped, ordered and numbered - shown exactly as given.
  const board = data?.board;
  const parkedCount = board?.counts.beingWorkedOn || 0;
  const activeTasks = (data?.tasks || []).filter((t) => !["verified", "not_verified", "cancelled"].includes(t.status));
  const closedTasks = (data?.tasks || []).filter((t) => ["verified", "not_verified", "cancelled"].includes(t.status));
  const archived = data?.archived || [];

  const counts = data?.counts;
  const tabs = (
    <div className={styles.tabs}>
      {(
        [
          ["talk", "Talk"],
          ["decisions", `Decisions${counts?.decisions ? ` · ${counts.decisions}` : ""}`],
          ["tasks", `Tasks${counts?.tasks ? ` · ${counts.tasks}` : ""}`],
          ["mission", "Mission"],
        ] as Array<[CouncilTab, string]>
      ).map(([k, label]) => (
        <button key={k} type="button" className={`${styles.tab} ${tab === k ? styles.tabOn : ""}`} onClick={() => onTab(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Sheet
      onClose={onClose}
      label="King Arthur's council"
      tall
      head={<Head color={ARTHUR_LOOK.body} initial="👑" title="King Arthur" sub={data?.thinking ? "Thinking…" : "Marketing Director · simple English"} onClose={onClose} />}
      tabs={tabs}
    >
      <div className={styles.copyAllBar}>
        <ReportCopy scope="pending" label="Copy All for ChatGPT" primary version={`${version}:${data?.board?.generatedAt || ""}`} preset={data?.copyAll || null} />
        <ReportCopy scope="full" label="Copy full status report" version={`${version}:${data?.board?.generatedAt || ""}`} />
      </div>
      {err ? <div className={styles.problem}>{err}</div> : null}
      {done ? <div className={styles.ok}>{done}</div> : null}
      {!data ? (
        <div className={styles.muted}>Opening the council chamber…</div>
      ) : tab === "talk" ? (
        <TalkTab data={data} owner={owner} replying={replying} draft={draft} setDraft={setDraft} send={send} sending={busy === "send"} listEnd={listEnd} />
      ) : tab === "decisions" && board ? (
        <>
          {board.sections.map((sec) =>
            sec.key === "needs_you" ? (
          <Section key={sec.key} title={sec.items.length ? `${sec.title} (${sec.items.length})` : sec.title}>
            {sec.items.length === 0 ? (
              <div className={`${styles.card} ${styles.allClear}`}>
                <div className={styles.allClearIcon} aria-hidden>
                  ✓
                </div>
                <div>
                  <b>Nothing needs you right now.</b>
                  <div className={styles.muted}>
                    {parkedCount ? `King Arthur and the knights are working on ${parkedCount} thing${parkedCount === 1 ? "" : "s"} - they come back here only when they are ready for you.` : "King Arthur and the knights keep working. You will see it here when they need you."}
                  </div>
                </div>
              </div>
            ) : (
              sec.items.map((d) => <DecisionCard key={d.id} d={d} owner={owner} busy={busy === d.id} act={act} onOpenRequests={onOpenRequests} onAnswer={(text) => (onTab("talk"), setDraft(text))} />)
            )}
            {!owner && sec.items.length ? <div className={styles.muted}>Only the owner can decide these.</div> : null}
          </Section>
            ) : sec.key === "being_worked_on" ? (
              sec.items.length ? (
                <Section key={sec.key} title={`${sec.title} (${sec.items.length}) - nothing for you to do`}>
                  {sec.items.map((d) => (
                    <WaitingCard key={d.id} d={d} owner={owner} busy={busy === d.id} act={act} />
                  ))}
                </Section>
              ) : null
            ) : sec.items.length ? (
              <Section key={sec.key} title={`${sec.title} (last 14 days)`}>
                <div className={styles.card}>
                  <ul className={styles.historyList}>
                    {sec.items.map((d) => (
                      <li key={d.id}>
                        <span className={styles.numChip}>#{d.number}</span>
                        <span style={{ minWidth: 0 }}>
                          <b>{d.subject}</b>
                          <span className={styles.muted}>
                            {" "}
                            · {d.status.replace(/^Closed - /, "")} · {ago(d.at)}
                          </span>
                        </span>
                        <CopyButton text={d.copy} label="Copy" />
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>
            ) : null
          )}
        </>
      ) : tab === "mission" ? (
        <MissionTab data={data} owner={owner} busy={busy === "mission"} act={act} />
      ) : (
        <>
          <Section title={activeTasks.length ? `In progress (${activeTasks.length})` : "In progress"}>
            {activeTasks.length === 0 ? (
              <div className={styles.card}>
                <span className={styles.muted}>No open tasks. Ask King Arthur in Talk to give one of the heroes some work.</span>
              </div>
            ) : (
              activeTasks.map((t) => <TaskCard key={t.id} t={t} owner={owner} busy={busy === t.id} act={act} />)
            )}
          </Section>
          {closedTasks.length ? (
            <Section title="Finished (last 14 days)">
              {closedTasks.map((t) => (
                <TaskCard key={t.id} t={t} owner={owner} busy={busy === t.id} act={act} />
              ))}
            </Section>
          ) : null}
          {archived.length ? (
            <Section title={`Archived by King Arthur (${archived.length}) - nothing is deleted`}>
              {archived.map((a) => (
                <div key={`${a.kind}:${a.id}`} className={styles.card}>
                  <div className={styles.talkMeta}>
                    {a.kind === "task" ? "Task" : a.kind === "note" ? "Hero note" : "Council record"} · {ARCHIVE_WHY[a.archive?.category || ""] || a.archive?.category} · {a.archive?.by} · {ago(a.archive?.at)}
                  </div>
                  <div className={styles.talkSay}>{a.title}</div>
                  {a.archive?.reason ? <div className={styles.muted} style={{ marginTop: 4 }}>Why: {a.archive.reason}</div> : null}
                  {owner ? (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSoft}`}
                      style={{ marginTop: 8 }}
                      disabled={busy === a.id}
                      onClick={() => act(a.id, "Restored.", () => restoreArchived(a.kind, a.id))}
                    >
                      Restore
                    </button>
                  ) : null}
                </div>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

function MissionTab({
  data,
  owner,
  busy,
  act,
}: {
  data: CouncilState;
  owner: boolean;
  busy: boolean;
  act: (id: string, label: string, fn: () => Promise<unknown>) => void;
}) {
  const m = data.mission;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.guidance);
  const [problems, setProblems] = useState<string[]>([]);
  const save = () =>
    act("mission", "Saved - a new version of the mission.", async () => {
      setProblems([]);
      try {
        await saveMission(text);
        setEditing(false);
      } catch (e) {
        const er = errorMessage(e, "That can't be saved.");
        setProblems(er.problems);
        throw e;
      }
    });
  const current = m.history.find((h) => h.version === m.version);
  return (
    <>
      <Section title={m.version ? `King Arthur's mission · version ${m.version}` : "King Arthur's mission"}>
        <div className={styles.card}>
          {editing ? (
            <>
              <textarea className={styles.composerInput} style={{ width: "100%", minHeight: 220 }} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} />
              {problems.length ? (
                <ul className={styles.problem}>
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.btnRow} style={{ marginTop: 8 }}>
                <button type="button" className={`${styles.btn} ${styles.btnGood}`} disabled={busy || !text.trim()} onClick={save}>
                  Save as a new version
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => (setEditing(false), setText(m.guidance), setProblems([]))}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.talkSay}>{m.guidance || "No mission set. King Arthur follows only his fixed rules."}</div>
              {current ? (
                <div className={styles.muted} style={{ marginTop: 8 }}>
                  Saved by {current.by} · {when(current.at)}
                  {current.note ? ` · ${current.note}` : ""}
                </div>
              ) : null}
              {owner ? (
                <div className={styles.btnRow} style={{ marginTop: 10 }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSoft}`} onClick={() => (setText(m.guidance), setEditing(true))}>
                    Edit the mission
                  </button>
                </div>
              ) : null}
            </>
          )}
          <div className={styles.muted} style={{ marginTop: 10, fontSize: 12.5 }}>
            The mission steers what King Arthur works on. It can never remove a safety rule: he still cannot approve, spend money, contact customers, change prices or touch ads.
          </div>
        </div>
      </Section>
      {m.history.length > 1 ? (
        <Section title="Earlier versions">
          {m.history
            .filter((h) => h.version !== m.version)
            .map((h) => (
              <div key={h.version} className={styles.card}>
                <div className={styles.talkMeta}>
                  Version {h.version} · {h.by} · {when(h.at)}
                </div>
                <div className={styles.preview}>{h.guidance || "(empty)"}</div>
                {owner ? (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSoft}`}
                    style={{ marginTop: 8 }}
                    disabled={busy}
                    onClick={() => act("mission", `Restored version ${h.version}.`, () => restoreMission(h.version))}
                  >
                    Restore this version
                  </button>
                ) : null}
              </div>
            ))}
        </Section>
      ) : null}
    </>
  );
}

function ActionChips({ actions }: { actions: CouncilAction[] }) {
  if (!actions.length) return null;
  return (
    <div className={styles.actionChips}>
      {actions.map((a, i) => (
        <span key={i} className={`${styles.actionChip} ${a.ok ? "" : styles.actionChipBad}`}>
          <b>{ACTION_WORDS[a.type] || a.type}</b>
          {a.label ? ` · ${a.label}` : ""}
        </span>
      ))}
    </div>
  );
}

function TalkTab({
  data,
  owner,
  replying,
  draft,
  setDraft,
  send,
  sending,
  listEnd,
}: {
  data: CouncilState;
  owner: boolean;
  replying: boolean;
  draft: string;
  setDraft: (s: string) => void;
  send: (s: string) => void;
  sending: boolean;
  listEnd: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className={styles.chat}>
      {data.messages.length === 0 ? (
        <div className={styles.msgRow}>
          <Crown />
          <div className={styles.talkBubble}>
            <div className={styles.talkSay}>{INTRO}</div>
          </div>
        </div>
      ) : null}
      {data.messages.map((m) =>
        m.role === "owner" ? (
          <div key={m.id} className={`${styles.msgRow} ${styles.msgRowOwner}`}>
            <div className={styles.msgOwner}>
              <div className={styles.talkSay}>{m.text}</div>
              <div className={styles.msgTime}>{ago(m.at)}</div>
            </div>
          </div>
        ) : (
          <div key={m.id} className={styles.msgRow}>
            <Crown />
            <div className={styles.talkBubble}>
              <div className={styles.talkMeta}>
                King Arthur{m.kind === "briefing" ? " · briefing" : ""} · {ago(m.at)}
              </div>
              <div className={styles.talkSay}>{m.text}</div>
              <ActionChips actions={m.actions} />
              <div className={styles.copyRow} style={{ marginTop: 6 }}>
                <CopyButton text={m.text} label="Copy" />
              </div>
            </div>
          </div>
        )
      )}
      {replying ? (
        <div className={styles.msgRow}>
          <Crown />
          <div className={styles.talkBubble}>
            <span className={styles.typing}>
              King Arthur is thinking<span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        </div>
      ) : null}

      {owner ? (
        <div className={styles.composerWrap}>
          {!replying && !draft ? (
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className={styles.suggestion} onClick={() => send(s)} disabled={!data.enabled || sending}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <textarea
              className={styles.composerInput}
              value={draft}
              maxLength={2000}
              rows={2}
              placeholder={data.enabled ? "Tell King Arthur what you need…" : "The AI team is switched off"}
              disabled={!data.enabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 721px)").matches) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <button type="submit" className={`${styles.btn} ${styles.sendBtn}`} disabled={!draft.trim() || replying || sending || !data.enabled}>
              Send
            </button>
          </form>
          <div className={styles.muted} style={{ fontSize: 12, marginTop: 6 }}>
            King Arthur can give the heroes tasks and recommend. Only you approve, spend money or switch things on.
          </div>
        </div>
      ) : (
        <div className={styles.muted}>Only the owner can talk to King Arthur.</div>
      )}
      {/* the very bottom, below the composer, so the newest message is never hidden behind it */}
      <div ref={listEnd} />
    </div>
  );
}

function DecisionCard({
  d,
  owner,
  busy,
  act,
  onOpenRequests,
  onAnswer,
}: {
  d: BoardItem;
  owner: boolean;
  busy: boolean;
  act: (id: string, label: string, fn: () => Promise<unknown>) => void;
  onOpenRequests: () => void;
  onAnswer: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = d.refs[0];
  const buttons: Array<{ label: string; tone: "yes" | "no" | "plain"; onClick: () => void }> = [];
  if (owner) {
    if (d.archiveRequest) {
      buttons.push({ label: "Yes, archive it", tone: "yes", onClick: () => act(d.id, "Archived - you can restore it any time.", () => resolveCouncilDecision(d.id, "confirm")) });
      buttons.push({ label: "Keep it", tone: "no", onClick: () => act(d.id, "OK - kept.", () => resolveCouncilDecision(d.id, "reject")) });
    } else if (d.guidance) {
      buttons.push({ label: "Save this guidance", tone: "yes", onClick: () => act(d.id, "Saved - a new guidance version.", () => resolveCouncilDecision(d.id, "confirm")) });
      buttons.push({ label: "No thanks", tone: "no", onClick: () => act(d.id, "OK - nothing changed.", () => resolveCouncilDecision(d.id, "reject")) });
    } else if (ref?.kind === "action") {
      buttons.push({ label: "Yes, do it", tone: "yes", onClick: () => act(d.id, "Done - approved.", () => decideAction(ref.id, "approve")) });
      buttons.push({ label: "Not now", tone: "no", onClick: () => act(d.id, "OK - not now.", () => decideAction(ref.id, "reject", "Not now")) });
    } else if (ref?.kind === "playbook") {
      buttons.push({ label: "Yes, use it", tone: "yes", onClick: () => act(d.id, "Done - the email is approved.", () => decidePlaybook(ref.id, "approve")) });
      buttons.push({ label: "Not now", tone: "no", onClick: () => act(d.id, "OK - retired.", () => decidePlaybook(ref.id, "retire", "Not now")) });
    } else if (ref?.kind === "note") {
      // a hero's note: "Got it" files it as seen; "Not useful" dismisses that note - no task is touched
      buttons.push({ label: "Got it", tone: "yes", onClick: () => act(d.id, "Got it.", () => setFindingStatus(ref.id, "acknowledged")) });
      buttons.push({ label: "Not useful", tone: "no", onClick: () => act(d.id, "Dismissed.", () => setFindingStatus(ref.id, "dismissed")) });
    } else if (ref?.kind === "draft") {
      // a draft is content work: "Not useful" dismisses Arthur's recommendation only - the draft stays in Requests
      buttons.push({ label: "Got it", tone: "yes", onClick: () => act(d.id, "Got it.", () => setFindingStatus(ref.id, "acknowledged")) });
      buttons.push({ label: "Not useful", tone: "no", onClick: () => act(d.id, "Dismissed - the draft stays in Requests.", () => resolveCouncilDecision(d.id, "reject")) });
    } else if (d.category === "info") {
      buttons.push({ label: "Got it", tone: "yes", onClick: () => act(d.id, "Got it.", () => resolveCouncilDecision(d.id, "done")) });
      buttons.push({ label: "Not useful", tone: "no", onClick: () => act(d.id, "Dismissed.", () => resolveCouncilDecision(d.id, "reject")) });
    } else {
      buttons.push({ label: "Answer Arthur", tone: "plain", onClick: () => onAnswer(`About "${d.subject}": `) });
      buttons.push({ label: "Mark handled", tone: "no", onClick: () => act(d.id, "Noted.", () => resolveCouncilDecision(d.id, "done")) });
    }
    if (d.category !== "info") {
      buttons.push({ label: "Wait · remind me when ready", tone: "plain", onClick: () => act(d.id, "Set aside - it comes back when it is ready.", () => deferDecision(d.id)) });
    }
  }
  const details: ReactNode = (
    <>
      <b>{d.subject}</b>
      {d.recommendation?.reason ? (
        <div style={{ marginTop: 6 }}>
          <b>Why he recommends it:</b> {d.recommendation.reason}
        </div>
      ) : null}
      {d.detail && d.detail !== d.recommendation?.reason ? <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{d.detail}</div> : null}
      {d.guidance ? (
        <div style={{ marginTop: 8 }}>
          <div className={styles.muted}>Now (version {d.guidance.baseVersion}):</div>
          <div className={styles.preview}>{d.guidance.previous || "(no guidance yet)"}</div>
          <div className={styles.muted} style={{ marginTop: 6 }}>
            After saving (version {d.guidance.baseVersion + 1} - you can restore the old one any time in the hero&rsquo;s Settings):
          </div>
          <div className={styles.preview}>{d.guidance.text}</div>
        </div>
      ) : null}
      {ref ? (
        <button type="button" className={`${styles.btn} ${styles.btnSoft}`} style={{ marginTop: 8 }} onClick={onOpenRequests}>
          See the full request in 📜 Requests
        </button>
      ) : null}
      <div className={styles.muted} style={{ marginTop: 6 }}>
        Record {d.id} · {when(d.createdAt)}
      </div>
    </>
  );
  const label = d.category === "uncertain" ? "Unclear - he needs facts or your view" : d.category === "info" ? "Good to know" : "Needs your decision";
  return (
    <div className={styles.talk}>
      <div className={styles.talkRow}>
        <Crown />
        <div className={styles.talkBubble}>
          <div className={styles.talkMeta}>
            <span className={styles.numChip}>#{d.number}</span> {label}
            {d.hero ? ` · ${d.hero}` : ""} · {ago(d.at)}
          </div>
          <div className={styles.talkSay}>{d.simple || d.subject}</div>
          {d.recommendation && d.recommendation.choice !== "see_reason" ? (
            <div className={styles.recommend}>
              👑 Arthur recommends: <b>{CHOICE_WORDS[d.recommendation.choice] || d.recommendation.choice}</b>
              <span className={styles.recommendNote}> · you decide</span>
            </div>
          ) : d.recommendation?.reason ? (
            <div className={styles.recommend}>👑 {d.recommendation.reason}</div>
          ) : null}
        </div>
      </div>
      <div className={styles.talkButtons}>
        {buttons.map((b) => (
          <button key={b.label} type="button" disabled={busy} className={`${styles.btn} ${b.tone === "yes" ? styles.btnGood : styles.btnSoft}`} onClick={b.onClick}>
            {b.label}
          </button>
        ))}
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide details" : "More details"}
        </button>
      </div>
      {open ? <div className={styles.talkDetails}>{details}</div> : null}
      <div className={styles.copyRow}>
        <CopyButton text={d.copy} label={`Copy #${d.number} for ChatGPT`} primary />
        <CopyButton text={d.simple || d.subject} label="Copy simple" />
      </div>
    </div>
  );
}

/** Something King Arthur or a knight is working on - shown, never badged; it returns to the inbox when ready. */
function WaitingCard({ d, owner, busy, act }: { d: BoardItem; owner: boolean; busy: boolean; act: (id: string, label: string, fn: () => Promise<unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const w = d.waiting;
  const status =
    d.inbox === "review"
      ? "Ready - King Arthur is reviewing the new version"
      : w?.kind === "owner"
      ? "You asked to be reminded when it is ready"
      : `Waiting for ${d.hero || "a knight"} - ${w?.reason || "the work is being improved"}`;
  const back = w?.until ? new Date(w.until).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : null;
  return (
    <div className={`${styles.talk} ${styles.waitingCard}`}>
      <div className={styles.waitingRow}>
        <span className={`${styles.waitingDot} ${d.inbox === "review" ? styles.waitingDotReview : ""}`} aria-hidden />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className={styles.waitingTitle}>
            <span className={styles.numChip}>#{d.number}</span> {d.subject}
          </div>
          <div className={styles.muted} style={{ fontSize: 13 }}>
            {status}
            {back && d.inbox !== "review" ? ` · back by ${back} at the latest` : ""}
          </div>
        </div>
      </div>
      <div className={styles.talkButtons}>
        {owner ? (
          <button type="button" disabled={busy} className={`${styles.btn} ${styles.btnSoft}`} onClick={() => act(d.id, "Back in your inbox.", () => bringBackDecision(d.id))}>
            Bring it back now
          </button>
        ) : null}
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide details" : "More details"}
        </button>
      </div>
      <div className={styles.copyRow}>
        <CopyButton text={d.copy} label={`Copy #${d.number}`} />
      </div>
      {open ? (
        <div className={styles.talkDetails}>
          <div className={styles.muted} style={{ marginBottom: 6 }}>Record {d.id}</div>
          {d.simple ? <div style={{ marginBottom: 6 }}>{d.simple}</div> : null}
          {d.recommendation?.reason ? (
            <div style={{ marginBottom: 6 }}>
              <b>King Arthur:</b> {d.recommendation.reason}
            </div>
          ) : null}
          <ol className={styles.timeline}>
            {(d.inboxHistory || []).map((h, i) => (
              <li key={i}>
                <b>{h.to === "needs_you" ? "In your inbox" : h.to === "review" ? "Arthur reviewing" : "Being worked on"}</b> · {when(h.at)}
                {h.note ? <div className={styles.muted}>{h.note}</div> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function TaskCard({ t, owner, busy, act }: { t: CouncilTask; owner: boolean; busy: boolean; act: (id: string, label: string, fn: () => Promise<unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const look = ROBOT_LOOKS[ROBOT_OF[t.agent]];
  const s = TASK_WORDS[t.status] || { label: t.status, tone: "wait" as const };
  const isOpen = ["received", "assigned", "in_progress", "blocked"].includes(t.status);
  return (
    <div className={styles.talk}>
      <div className={styles.talkRow}>
        <div className={styles.talkAvatar} style={{ background: look?.body || "#666" }} aria-hidden>
          {(look?.name || t.hero)[0]}
        </div>
        <div className={styles.talkBubble}>
          <div className={styles.talkMeta}>
            {t.hero} · {t.origin === "owner" ? "you asked" : "King Arthur asked"} · {ago(t.createdAt)}
          </div>
          <div className={`${styles.taskStatus} ${styles[`task_${s.tone}`]}`}>{s.label}</div>
          <div className={styles.talkSay}>{t.instruction}</div>
          {t.result ? (
            <div className={styles.taskResult}>
              <b>{t.status === "blocked" ? "Why it's blocked:" : `${t.hero}'s report:`}</b> {t.result.summary}
            </div>
          ) : null}
          {t.verification ? (
            <div className={styles.muted} style={{ marginTop: 4 }}>
              {t.verification.verdict === "verified" ? "✓ Checked" : "✗ Not good enough"} by {t.verification.by}
              {t.verification.note ? `: ${t.verification.note}` : ""}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.talkButtons}>
        {owner && t.status === "completed" ? (
          <>
            <button type="button" disabled={busy} className={`${styles.btn} ${styles.btnGood}`} onClick={() => act(t.id, "Marked as checked.", () => verifyCouncilTask(t.id, "verified", "Checked by the owner"))}>
              Looks good ✓
            </button>
            <button type="button" disabled={busy} className={`${styles.btn} ${styles.btnSoft}`} onClick={() => act(t.id, "Sent back.", () => verifyCouncilTask(t.id, "not_verified", "Not good enough (owner)"))}>
              Not good enough
            </button>
          </>
        ) : null}
        {owner && isOpen ? (
          <button type="button" disabled={busy} className={`${styles.btn} ${styles.btnSoft}`} onClick={() => act(t.id, "Task cancelled.", () => cancelCouncilTask(t.id))}>
            Cancel task
          </button>
        ) : null}
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide history" : "History"}
        </button>
      </div>
      {open ? (
        <div className={styles.talkDetails}>
          {t.why ? (
            <div style={{ marginBottom: 6 }}>
              <b>Why:</b> {t.why}
            </div>
          ) : null}
          <ol className={styles.timeline}>
            {t.history.map((h, i) => (
              <li key={i}>
                <b>{TASK_WORDS[h.status]?.label || h.status}</b> · {h.by} · {when(h.at)}
                {h.note ? <div className={styles.muted}>{h.note}</div> : null}
              </li>
            ))}
          </ol>
          <div className={styles.muted}>Task {t.id}</div>
        </div>
      ) : null}
      <div className={styles.copyRow}>
        <CopyButton
          text={[
            `Task ${t.id} for ${t.hero} (${t.origin === "owner" ? "I asked" : "King Arthur asked"})`,
            `Instruction: ${t.instruction}`,
            t.why ? `Why: ${t.why}` : null,
            `State: ${s.label}`,
            t.result ? `Report: ${t.result.summary}` : null,
            t.verification ? `Check: ${t.verification.verdict} by ${t.verification.by} - ${t.verification.note}` : null,
            `History: ${t.history.map((h) => `${h.status} by ${h.by} (${when(h.at)})`).join("; ")}`,
          ]
            .filter(Boolean)
            .join("\n")}
          label="Copy"
        />
      </div>
    </div>
  );
}
