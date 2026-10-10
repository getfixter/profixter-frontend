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
 *
 * "✨ Copy All for ChatGPT" and "Copy full status report" are built by the
 * server from records (no AI call) and prepared as soon as the panel opens,
 * so one tap copies them.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  cancelCouncilTask,
  errorMessage,
  getCouncil,
  getCouncilReport,
  resolveCouncilDecision,
  sendToArthur,
  verifyCouncilTask,
  type CouncilAction,
  type CouncilDecision,
  type CouncilState,
  type CouncilTask,
  type RobotKey,
} from "@/lib/office";
import { decideAction, decidePlaybook, setFindingStatus } from "@/lib/admin-growth";
import { ago, Head, Section, Sheet, when } from "./OfficePanels";
import { ARTHUR_LOOK, ROBOT_LOOKS } from "./office-layout";
import { CopyButton, copyText, useToast } from "./Talk";
import styles from "./office.module.css";

export type CouncilTab = "talk" | "decisions" | "tasks";

const ROBOT_OF: Record<string, RobotKey> = { visibility: "visibility", outreach: "outreach", conversion: "conversation", conversation: "conversation" };

const TASK_WORDS: Record<string, { label: string; tone: "wait" | "work" | "done" | "bad" | "off" }> = {
  received: { label: "Received", tone: "wait" },
  assigned: { label: "Waiting for the next shift", tone: "wait" },
  in_progress: { label: "Working on it", tone: "work" },
  completed: { label: "Done · waiting for a check", tone: "work" },
  blocked: { label: "Blocked", tone: "bad" },
  verified: { label: "Checked ✓", tone: "done" },
  not_verified: { label: "Not good enough", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "off" },
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
};

const SUGGESTIONS = [
  "What needs my decision today?",
  "What did the team do this week?",
  "Which hero is closest to getting us a new free-visit booking?",
  "Ask Leonidas to research one new way to reach homeowners.",
];

const INTRO =
  "Boss, I'm King Arthur, your council manager. I read everything Odysseus, Leonidas and Marcus Aurelius do, tell you what matters, recommend what to approve, and give them tasks. I can't approve, spend money, message customers, book visits or change ads, prices or rules - those stay yours. What would you like to know?";

function Crown({ size = 34 }: { size?: number }) {
  return (
    <div className={`${styles.talkAvatar} ${styles.crownAvatar}`} style={{ background: ARTHUR_LOOK.body, width: size, height: size }} aria-hidden>
      👑
    </div>
  );
}

function decisionBrief(d: CouncilDecision) {
  return [
    `# ${d.subject}`,
    `- Record ID: ${d.id} (King Arthur's council)`,
    `- Kind: ${d.category === "uncertain" ? "unclear - he needs facts or my view" : d.category === "info" ? "information" : "a decision only I can make"}`,
    d.hero ? `- Concerns: ${d.hero}` : null,
    `- Filed: ${when(d.createdAt)} (New York) · updated ${when(d.at)}`,
    `- In his words: ${d.simple || "(none)"}`,
    d.recommendation ? `- His recommendation: ${CHOICE_WORDS[d.recommendation.choice] || d.recommendation.choice}. Reason: ${d.recommendation.reason}` : null,
    d.detail ? `- Details and evidence: ${d.detail}` : null,
    d.guidance ? `- Exact change - BEFORE: ${d.guidance.previous || "(no guidance)"}\n- Exact change - AFTER: ${d.guidance.text}` : null,
    "",
    "King Arthur is my AI manager. He cannot approve anything; his recommendation is not my approval. Please explain this simply, point out problems, and tell me what you would do. Do not assume I approve anything.",
  ]
    .filter((x) => x !== null)
    .join("\n");
}

/** A copy button for a server-built report, prepared before the tap so copying works on phones. */
export function ReportCopy({ scope, label, primary, version }: { scope: "pending" | "full"; label: string; primary?: boolean; version: number }) {
  const toast = useToast();
  const [text, setText] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-prepare when the council changes
    setState("loading");
    getCouncilReport(scope)
      .then((r) => {
        if (!alive) return;
        setText(r.text);
        setCount(r.count);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [scope, version]);
  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${primary ? styles.copyBtnPrimary : ""} ${primary ? styles.copyAll : ""}`}
      disabled={state === "loading" && !text}
      onClick={async (e) => {
        e.stopPropagation();
        let t = text;
        if (!t) {
          try {
            t = (await getCouncilReport(scope)).text;
            setText(t);
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
      {state === "loading" && !text ? "Preparing…" : label}
      {primary && count != null ? ` (${count})` : ""}
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

  const decisions = (data?.decisions || []).filter((d) => d.category === "decision" || d.category === "uncertain");
  const info = (data?.decisions || []).filter((d) => d.category === "info");
  const activeTasks = (data?.tasks || []).filter((t) => !["verified", "not_verified", "cancelled"].includes(t.status));
  const closedTasks = (data?.tasks || []).filter((t) => ["verified", "not_verified", "cancelled"].includes(t.status));

  const counts = data?.counts;
  const tabs = (
    <div className={styles.tabs}>
      {(
        [
          ["talk", "Talk"],
          ["decisions", `Decisions${counts?.decisions ? ` · ${counts.decisions}` : ""}`],
          ["tasks", `Tasks${counts?.tasks ? ` · ${counts.tasks}` : ""}`],
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
      head={<Head color={ARTHUR_LOOK.body} initial="👑" title="King Arthur" sub={data?.thinking ? "Thinking…" : "Your council manager · simple English"} onClose={onClose} />}
      tabs={tabs}
    >
      <div className={styles.copyAllBar}>
        <ReportCopy scope="pending" label="Copy All for ChatGPT" primary version={version} />
        <ReportCopy scope="full" label="Copy full status report" version={version} />
      </div>
      {err ? <div className={styles.problem}>{err}</div> : null}
      {done ? <div className={styles.ok}>{done}</div> : null}
      {!data ? (
        <div className={styles.muted}>Opening the council chamber…</div>
      ) : tab === "talk" ? (
        <TalkTab data={data} owner={owner} replying={replying} draft={draft} setDraft={setDraft} send={send} sending={busy === "send"} listEnd={listEnd} />
      ) : tab === "decisions" ? (
        <>
          <Section title={decisions.length ? `Needs your decision (${decisions.length})` : "Needs your decision"}>
            {decisions.length === 0 ? (
              <div className={styles.card}>
                <span className={styles.muted}>Nothing waits for your decision from King Arthur right now. Items without his view are still in 📜 Requests.</span>
              </div>
            ) : (
              decisions.map((d) => <DecisionCard key={d.id} d={d} owner={owner} busy={busy === d.id} act={act} onOpenRequests={onOpenRequests} onAnswer={(text) => (onTab("talk"), setDraft(text))} />)
            )}
            {!owner && decisions.length ? <div className={styles.muted}>Only the owner can decide these.</div> : null}
          </Section>
          <Section title={info.length ? `Good to know (${info.length})` : "Good to know"}>
            {info.length === 0 ? (
              <div className={styles.card}>
                <span className={styles.muted}>No news from King Arthur right now.</span>
              </div>
            ) : (
              info.map((d) => <DecisionCard key={d.id} d={d} owner={owner} busy={busy === d.id} act={act} onOpenRequests={onOpenRequests} onAnswer={(text) => (onTab("talk"), setDraft(text))} />)
            )}
          </Section>
          {data.history.length ? (
            <Section title="Decided and handled (last 14 days)">
              <div className={styles.card}>
                <ul className={styles.list}>
                  {data.history.map((d) => (
                    <li key={d.id}>
                      <b>{d.subject}</b>{" "}
                      <span className={styles.muted}>
                        · {d.resolution?.choice === "confirmed" ? "you saved it" : d.resolution?.choice === "rejected" ? "you said no" : d.resolution?.choice === "handled" ? (d.resolution.by === "King Arthur" ? "Arthur handled it" : "you marked it handled") : d.resolution?.choice === "merged" ? "duplicate merged" : d.status === "superseded" ? "decided elsewhere" : d.resolution?.choice || d.status}{" "}
                        · {ago(d.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          ) : null}
        </>
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
        </>
      )}
    </Sheet>
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
  d: CouncilDecision;
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
    if (d.guidance) {
      buttons.push({ label: "Save this guidance", tone: "yes", onClick: () => act(d.id, "Saved - a new guidance version.", () => resolveCouncilDecision(d.id, "confirm")) });
      buttons.push({ label: "No thanks", tone: "no", onClick: () => act(d.id, "OK - nothing changed.", () => resolveCouncilDecision(d.id, "reject")) });
    } else if (ref?.kind === "action") {
      buttons.push({ label: "Yes, do it", tone: "yes", onClick: () => act(d.id, "Done - approved.", () => decideAction(ref.id, "approve")) });
      buttons.push({ label: "Not now", tone: "no", onClick: () => act(d.id, "OK - not now.", () => decideAction(ref.id, "reject", "Not now")) });
    } else if (ref?.kind === "playbook") {
      buttons.push({ label: "Yes, use it", tone: "yes", onClick: () => act(d.id, "Done - the email is approved.", () => decidePlaybook(ref.id, "approve")) });
      buttons.push({ label: "Not now", tone: "no", onClick: () => act(d.id, "OK - retired.", () => decidePlaybook(ref.id, "retire", "Not now")) });
    } else if (ref?.kind === "note" || ref?.kind === "draft") {
      buttons.push({ label: "Got it", tone: "yes", onClick: () => act(d.id, "Got it.", () => setFindingStatus(ref.id, "acknowledged")) });
      buttons.push({ label: "Not useful", tone: "no", onClick: () => act(d.id, "Removed.", () => setFindingStatus(ref.id, "dismissed")) });
    } else {
      if (d.category !== "info") buttons.push({ label: "Answer Arthur", tone: "plain", onClick: () => onAnswer(`About "${d.subject}": `) });
      buttons.push({ label: d.category === "info" ? "Got it" : "Mark handled", tone: d.category === "info" ? "yes" : "no", onClick: () => act(d.id, "Noted.", () => resolveCouncilDecision(d.id, "done")) });
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
            {label}
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
        <CopyButton text={decisionBrief(d)} label="Copy for ChatGPT" primary />
        <CopyButton text={d.simple || d.subject} label="Copy simple" />
      </div>
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
