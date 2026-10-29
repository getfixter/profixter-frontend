"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import styles from "./SupportChat.module.css";
import {
  createSseParser,
  friendlyError,
  getVisitorId,
  PHONE_DISPLAY,
  PHONE_TEL,
  splitLinks,
  supportChatVisibleOn,
  type ChatStreamEvent,
} from "./support-chat-core";

/**
 * The floating customer-support chat.
 *
 * A small button in the bottom corner that opens a conversation with the
 * Profixter assistant (POST /api/chatbot/message, streamed back as SSE). On a
 * phone it opens as a bottom sheet that sits above the on-screen keyboard; on
 * a desktop, as a small panel in the corner.
 *
 * Mounted once in the root layout, inside <Providers> (it reads the signed-in
 * customer). It decides for itself where to appear: customer pages only, never
 * Admin, the event kiosk, signing, sign-in/up or the booking flow - see
 * supportChatVisibleOn.
 *
 * Position: the button sits above the phone tab bar by default. A page shell
 * that needs it elsewhere sets --pf-support-chat-bottom (desktop) and
 * --pf-support-chat-bottom-mobile on any ancestor, or passes `bottomOffset`.
 */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  /** The user message to resend when this error is retried. */
  retryOf?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
const MAX_INPUT = 1000;
const HISTORY_KEY = "pfSupportChat";
const MOBILE_QUERY = "(max-width: 1023.98px)";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm the Profixter assistant. Ask me about membership, booking a visit, or anything about how we work.",
};

const SUGGESTIONS = ["How does membership work?", "Is the first visit free?", "What can a handyman visit cover?"];

let messageSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(messageSeq += 1)}`;

function loadHistory(): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(parsed) ? parsed.filter((m) => m && !m.streaming).slice(-40) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.filter((m) => m.id !== "welcome" && !m.streaming).slice(-40)));
  } catch {
    /* storage unavailable: the conversation simply does not survive a reload */
  }
}

function MessageText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.type === "link" ? (
          <a key={i} href={part.href} className={styles.link}>
            {part.value.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type SupportChatProps = {
  /** Overrides the button's distance from the bottom on every screen size (any CSS length). */
  bottomOffset?: string;
};

export default function SupportChat({ bottomOffset }: SupportChatProps) {
  const pathname = usePathname();
  const visible = supportChatVisibleOn(pathname);
  if (!visible) return null;
  return <SupportChatInner bottomOffset={bottomOffset} />;
}

function SupportChatInner({ bottomOffset }: SupportChatProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const titleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const visitorIdRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const restoredRef = useRef(false);

  /* Restore this tab's conversation once, after mount (storage is browser-only). */
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const history = loadHistory();
    if (history.length) setMessages(history);
  }, []);

  useEffect(() => {
    if (restoredRef.current) saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /*
   * The on-screen keyboard. iOS Safari does not resize the layout viewport for
   * it, so a sheet pinned to bottom: 0 would sit under the keyboard. The visual
   * viewport says how much of the screen is really left.
   */
  useEffect(() => {
    if (!open || !isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
      setViewportHeight(vv.height);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKeyboardInset(0);
      setViewportHeight(null);
    };
  }, [open, isMobile]);

  /* The sheet is modal on a phone: the page behind it does not scroll. */
  useEffect(() => {
    if (!open || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const openChat = useCallback(() => {
    setOpen(true);
    trackEvent("support_chat_opened");
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  /* Esc closes the panel even when focus has wandered back to the page (the desktop panel is not modal). */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeChat]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_INPUT);
      if (!text || busy) return;
      if (!visitorIdRef.current) visitorIdRef.current = getVisitorId();

      const botId = nextId("a");
      setMessages((prev) => [
        ...prev.filter((m) => !(m.error && m.retryOf === text)),
        { id: nextId("u"), role: "user", content: text },
        { id: botId, role: "assistant", content: "", streaming: true },
      ]);
      setInput("");
      /*
       * A suggestion chip or a "Try again" button disappears once used, which
       * would drop keyboard focus on the page. Keep it in the field - except on
       * a phone, where focusing would throw up the keyboard over the reply.
       */
      if (!window.matchMedia(MOBILE_QUERY).matches) inputRef.current?.focus();
      setBusy(true);
      setAnnouncement("");
      trackEvent("support_chat_message_sent");

      const controller = new AbortController();
      abortRef.current = controller;
      let reply = "";
      let failure: ChatStreamEvent | null = null;
      let finished = false;

      try {
        const response = await fetch(`${API_BASE}/api/chatbot/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            visitorId: visitorIdRef.current,
            channel: "web",
            input: text,
            lead: user
              ? {
                  email: user.email || undefined,
                  name: user.name || undefined,
                  phone: user.phone || undefined,
                  city: user.city || undefined,
                  county: user.county || undefined,
                }
              : undefined,
          }),
        });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const parser = createSseParser((event) => {
          if (event.error) {
            failure = event;
          } else if (event.token) {
            reply += event.token;
            setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, content: reply } : m)));
          } else if (event.done) {
            finished = true;
          }
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.end();
        if (!failure && !reply) failure = { error: "empty" };
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        failure = failure || { error: "network" };
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
      }

      if (failure && !(finished && reply)) {
        const message = friendlyError(failure);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== botId),
          { id: nextId("e"), role: "assistant", content: message, error: true, retryOf: text },
        ]);
        setAnnouncement(message);
        return;
      }
      setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, streaming: false } : m)));
      setAnnouncement(reply);
    },
    [busy, user]
  );

  const retry = useCallback(
    (message: ChatMessage) => {
      if (!message.retryOf) return;
      // Drop the failed exchange; send() adds the user message again.
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === message.id);
        const before = prev.slice(0, index);
        const lastUser = before.length - 1;
        return before[lastUser]?.role === "user" && before[lastUser].content === message.retryOf
          ? [...before.slice(0, lastUser), ...prev.slice(index + 1)]
          : [...before, ...prev.slice(index + 1)];
      });
      void send(message.retryOf);
    },
    [send]
  );

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeChat();
      return;
    }
    // A modal sheet keeps focus inside itself.
    if (event.key === "Tab" && isMobile && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  };

  const rootStyle = {
    ...(bottomOffset ? { "--pf-support-chat-bottom": bottomOffset, "--pf-support-chat-bottom-mobile": bottomOffset } : {}),
  } as CSSProperties;

  const sheetStyle: CSSProperties | undefined =
    isMobile && open
      ? {
          bottom: keyboardInset ? `${keyboardInset}px` : undefined,
          maxHeight: viewportHeight ? `${Math.round(viewportHeight - 12)}px` : undefined,
        }
      : undefined;

  const shown = messages.length ? messages : [WELCOME];
  const showSuggestions = !messages.some((m) => m.role === "user");

  return (
    <div className={styles.root} style={rootStyle} data-support-chat="">
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          className={styles.launcher}
          onClick={openChat}
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-label="Questions? Chat with Profixter"
        >
          <ChatIcon />
          <span className={styles.launcherLabel}>Questions?</span>
        </button>
      )}

      {open && isMobile && <div className={styles.backdrop} onClick={closeChat} aria-hidden="true" />}

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal={isMobile ? true : undefined}
          aria-labelledby={titleId}
          className={styles.panel}
          style={sheetStyle}
          onKeyDown={onDialogKeyDown}
        >
          <div className={styles.header}>
            {isMobile && <span className={styles.grabber} aria-hidden="true" />}
            <div>
              <h2 id={titleId} className={styles.title}>
                Profixter support
              </h2>
              <p className={styles.subtitle}>Automated assistant · Call {PHONE_DISPLAY} for anything urgent</p>
            </div>
            <button type="button" className={styles.close} onClick={closeChat} aria-label="Close chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={logRef} className={styles.log} role="log" aria-live="off" aria-label="Conversation" tabIndex={0}>
            {shown.map((m) => (
              <div key={m.id} className={m.role === "user" ? styles.rowUser : styles.rowAssistant}>
                <div
                  className={`${styles.bubble} ${
                    m.role === "user" ? styles.bubbleUser : m.error ? styles.bubbleError : styles.bubbleAssistant
                  }`}
                >
                  {m.role === "user" ? null : <span className={styles.srOnly}>Profixter: </span>}
                  {m.streaming && !m.content ? (
                    <span className={styles.typing} aria-label="Typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <MessageText text={m.content} />
                  )}
                  {m.error && m.retryOf ? (
                    <button type="button" className={styles.retry} onClick={() => retry(m)} disabled={busy}>
                      Try again
                    </button>
                  ) : null}
                </div>
              </div>
            ))}

            {showSuggestions && (
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className={styles.chip} onClick={() => void send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
                <a className={styles.chip} href={PHONE_TEL}>
                  Call {PHONE_DISPLAY}
                </a>
              </div>
            )}
          </div>

          {/* Whole replies only: announcing every streamed token would be unusable with a screen reader. */}
          <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
            {announcement}
          </div>

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor={`${titleId}-input`} className={styles.srOnly}>
              Your message
            </label>
            <textarea
              id={`${titleId}-input`}
              ref={inputRef}
              className={styles.input}
              rows={1}
              value={input}
              maxLength={MAX_INPUT}
              placeholder="Type your question"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              enterKeyHint="send"
            />
            <button type="submit" className={styles.send} disabled={busy || !input.trim()} aria-label="Send message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
