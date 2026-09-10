"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { occasionCopy } from "./giftPresentation";

/**
 * Opening the gift.
 *
 * THE GESTURE
 *
 * A closed navy sleeve sits over the card with a satin ribbon tied across it.
 * The ribbon parts, the sleeve drops away, and the card rises into its place.
 * About 1.3 seconds, three overlapping movements, no confetti.
 *
 * The ribbon is the continuity. It used to live on the card itself, where at
 * 390px it cut straight through the message; now taking it off IS the
 * opening, and what it leaves behind is the card's gilt edge.
 *
 * WHAT THIS COMPONENT MAY NEVER DO
 *
 * Gate anything. The card is in the DOM from the first paint in every phase,
 * so assistive technology never meets a closed box; the reveal is skipped
 * outright under prefers-reduced-motion; and the session flag is decoration
 * — losing it, blocking it, or throwing on it costs a repeated animation and
 * nothing else. No access decision is made anywhere in this file.
 *
 * WHY THE DECISION IS NOT MADE HERE
 *
 * Whether to play at all is decided once by the hero and passed in as `mode`.
 * That keeps it out of an effect — deciding in an effect means rendering the
 * open card and then hiding it, which flashes the gift before closing it.
 */

type Phase = "closed" | "opening" | "open";

/** How long the closed sleeve is held before it opens itself. */
const HOLD_MS = 950;
/** The reveal itself, matching the longest keyframe in globals.css. */
const REVEAL_MS = 1300;
/** A shorter beat on replay: the viewer asked for it and knows what happens. */
const REPLAY_HOLD_MS = 420;

export const GIFT_OPENED_STORAGE_KEY = "pf.gift.opened";

/**
 * A per-gift fingerprint for "opened in this tab already".
 *
 * Built from what is already on screen — never from the claim token. The
 * token is a credential and does not belong in storage, hashed or otherwise.
 */
export function giftFingerprint(parts: Array<string | number | null | undefined>): string {
  const source = parts.map((part) => String(part ?? "")).join("|");
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Should this viewer get the reveal?
 *
 * No, if they asked for reduced motion. No, if this same gift has already
 * been opened in this tab. Otherwise yes. Anything unexpected — no window, no
 * storage, a throwing accessor — answers "play", because a repeated animation
 * is a far smaller failure than a gift that never appears.
 */
export function planGiftReveal(fingerprint: string): "play" | "skip" {
  if (typeof window === "undefined") return "skip";
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "skip";
  } catch {
    /* fall through: play */
  }
  try {
    if (window.sessionStorage.getItem(GIFT_OPENED_STORAGE_KEY) === fingerprint) return "skip";
  } catch {
    /* private mode or blocked storage: play */
  }
  return "play";
}

export type DigitalGiftRevealProps = {
  /** The finished card. Rendered underneath, revealed by the sleeve leaving. */
  children: React.ReactNode;
  occasion: string;
  /** Who it is from, for the sleeve. */
  from?: string | null;
  /** Decided once by the hero, never here. */
  mode: "play" | "skip";
  /** Stored when the reveal completes, so a revisit skips it. */
  fingerprint: string;
  /** Bumped by the hero to replay. */
  replayToken?: number;
  /** Called when the card is fully revealed. */
  onOpened?: () => void;
};

export default function DigitalGiftReveal({
  children,
  occasion,
  from,
  mode,
  fingerprint,
  replayToken = 0,
  onOpened,
}: DigitalGiftRevealProps) {
  const [phase, setPhase] = useState<Phase>(() => (mode === "play" ? "closed" : "open"));
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const open = useCallback(() => {
    clearTimers();
    setPhase("opening");
    timers.current.push(
      setTimeout(() => {
        setPhase("open");
        try {
          window.sessionStorage.setItem(GIFT_OPENED_STORAGE_KEY, fingerprint);
        } catch {
          /* Presentation only. A failure here just replays the reveal. */
        }
        onOpened?.();
      }, REVEAL_MS)
    );
  }, [clearTimers, fingerprint, onOpened]);

  /* The opening beat. No state is set synchronously here. */
  useEffect(() => {
    if (mode !== "play") return undefined;
    timers.current.push(setTimeout(open, HOLD_MS));
    return clearTimers;
  }, [mode, open, clearTimers]);

  /* An explicit replay, requested by the hero. */
  const lastReplay = useRef(replayToken);
  useEffect(() => {
    if (replayToken === lastReplay.current) return undefined;
    lastReplay.current = replayToken;
    clearTimers();
    timers.current.push(
      setTimeout(() => {
        setPhase("closed");
        timers.current.push(setTimeout(open, REPLAY_HOLD_MS));
      }, 0)
    );
    return clearTimers;
  }, [replayToken, open, clearTimers]);

  const copy = occasionCopy(occasion);
  const sender = String(from || "").trim();
  const sleeveVisible = phase !== "open";

  return (
    <div className="gift-reveal-root relative">
      {/*
       * The card is present in every phase — hidden by the sleeve, not absent
       * from the document. A reveal that adds the content afterwards is a
       * content change; this is a visual one.
       */}
      <div
        className={
          phase === "closed"
            ? "gift-card-waiting"
            : phase === "opening"
              ? "gift-card-rising"
              : ""
        }
      >
        {children}
      </div>

      {sleeveVisible ? (
        <button
          type="button"
          onClick={open}
          aria-label="Open your gift"
          className={`gift-sleeve gift-sleeve-enter absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-[18px] text-center ${
            phase === "opening" ? "gift-sleeve-opening" : ""
          }`}
        >
          {/* Warmth, so the sleeve is not a flat navy block. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 18% -10%, rgba(212,165,116,0.20) 0%, rgba(212,165,116,0) 58%)," +
                "radial-gradient(90% 70% at 104% 8%, rgba(48,110,236,0.20) 0%, rgba(48,110,236,0) 60%)",
            }}
          />

          {/* Two halves that part, rather than one band that fades. */}
          <span
            aria-hidden="true"
            className="gift-ribbon-half gift-ribbon-left pointer-events-none absolute left-0 top-1/2 h-[26px] w-1/2 -translate-y-1/2 sm:h-[30px]"
          />
          <span
            aria-hidden="true"
            className="gift-ribbon-half gift-ribbon-right pointer-events-none absolute right-0 top-1/2 h-[26px] w-1/2 -translate-y-1/2 sm:h-[30px]"
          />

          {/*
            Two groups with a gap the ribbon runs through, rather than two
            blocks pushed apart by hand-tuned padding. The gap is the only
            number that has to be right, and it stays right when the occasion
            title wraps to two lines.
          */}
          <span className="relative z-10 flex w-full flex-col items-center justify-center gap-[62px] px-7 sm:gap-[74px]">
            <span className="flex flex-col items-center gap-3 sm:gap-3.5">
              <Image
                src="/images/logo-footer.svg"
                alt=""
                width={113}
                height={24}
                className="gift-card-logo"
              />
              <span className="text-[12px] font-medium uppercase tracking-[0.24em] text-[#A8BEE2]">
                {sender ? `${sender} sent you` : "You have been sent"}
              </span>
            </span>

            <span className="flex flex-col items-center gap-3">
              <span
                className="gift-foil text-balance text-[27px] font-light leading-[1.12] sm:text-[33px]"
                style={{ fontFamily: "var(--font-gift-display), Georgia, serif" }}
              >
                {copy.title}
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#C9D7EE]">
                Open your gift
              </span>
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
