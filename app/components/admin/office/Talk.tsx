"use client";

/**
 * How robots talk to the owner: one speech card per thing, in plain words
 * first, the decision buttons, "More details" for the technical view, and
 * copy buttons that put a complete, self-contained brief on the clipboard
 * for ChatGPT. The briefs are built on the server from real records (and
 * already have personal details and secrets removed).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { RobotKey, Simple } from "@/lib/office";
import { ROBOT_LOOKS } from "./office-layout";
import styles from "./office.module.css";

/* ---------------- copying ---------------- */

const ToastContext = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  // Each toast has its own id, so copying twice in a row keeps the second "Copied!" for its full time.
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const seq = useRef(0);
  const show = useCallback((m: string) => {
    const id = ++seq.current;
    setMsg({ text: m, id });
    window.setTimeout(() => setMsg((cur) => (cur?.id === id ? null : cur)), 1800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg ? (
        <div key={msg.id} className={styles.copied} role="status" aria-live="polite">
          ✓ {msg.text}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label, primary = false }: { text: string | null | undefined; label: string; primary?: boolean }) {
  const toast = useToast();
  if (!text) return null;
  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${primary ? styles.copyBtnPrimary : ""}`}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        toast(ok ? "Copied!" : "Couldn't copy - try again");
      }}
    >
      {primary ? "✨ " : "⧉ "}
      {label}
    </button>
  );
}

/* ---------------- a robot speaking ---------------- */

export type TalkAction = { label: string; onClick: () => void; tone?: "yes" | "no" | "plain"; disabled?: boolean };

export function RobotSays({
  robot,
  simple,
  chatgpt,
  fullReport,
  actions = [],
  details,
  meta,
  compact = false,
}: {
  robot: RobotKey | null;
  simple: Simple | undefined;
  chatgpt?: string | null;
  fullReport?: string | null;
  actions?: TalkAction[];
  details?: ReactNode;
  meta?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const look = robot ? ROBOT_LOOKS[robot] : null;
  const say = simple?.say || "";
  const ask = simple?.ask || null;
  const simpleText = [say, ask].filter(Boolean).join("\n\n");
  return (
    <div className={`${styles.talk} ${compact ? styles.talkCompact : ""}`}>
      <div className={styles.talkRow}>
        {look ? (
          <div className={styles.talkAvatar} style={{ background: look.body }} aria-hidden>
            {look.name[0]}
          </div>
        ) : (
          <div className={styles.talkAvatar} style={{ background: "#13B26B" }} aria-hidden>
            ★
          </div>
        )}
        <div className={styles.talkBubble}>
          {meta ? <div className={styles.talkMeta}>{meta}</div> : null}
          <div className={styles.talkSay}>{say}</div>
          {simple?.pendingSimple ? <div className={styles.talkPending}>{look ? look.name : "The robot"} is putting this into simple words…</div> : null}
          {ask ? <div className={styles.talkAsk}>{ask}</div> : null}
        </div>
      </div>
      {actions.length || details || chatgpt ? (
        <div className={styles.talkButtons}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              className={`${styles.btn} ${a.tone === "yes" ? styles.btnGood : a.tone === "no" ? styles.btnSoft : styles.btnSoft}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
          {details ? (
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? "Hide details" : "More details"}
            </button>
          ) : null}
        </div>
      ) : null}
      {open && details ? <div className={styles.talkDetails}>{details}</div> : null}
      {chatgpt || fullReport ? (
        <div className={styles.copyRow}>
          <CopyButton text={chatgpt} label="Copy for ChatGPT" primary />
          <CopyButton text={simpleText} label="Copy simple" />
          <CopyButton text={fullReport} label="Copy full report" />
        </div>
      ) : null}
    </div>
  );
}
