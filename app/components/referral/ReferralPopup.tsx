"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import "./referral.css";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { shareMessage, type MyReferrals } from "@/lib/referral";

/**
 * The referral popup (owner's copy, 2026-11-20):
 *
 *   Get up to $149 per referral
 *   Refer a friend to Profixter. The Basic plan qualifies, too.
 *   [Share my link]            one blue button: the phone's share sheet, else Copy link
 *   How it works               the payout, qualifying payments and discount rules
 *
 * A bottom sheet on a phone, a centred card from 640px. The rules here must
 * match BackEnd utils/referrals (engine.js, amounts.js, signals.js).
 */

type ShareState = "idle" | "shared" | "copied" | "copy_failed";

type Props = {
  open: boolean;
  onClose: () => void;
  data: MyReferrals | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

/* Mounted only while open, so every opening starts fresh (rules folded, no "copied"). */
export default function ReferralPopup(props: Props) {
  return props.open ? <PopupBody {...props} /> : null;
}

function PopupBody({ onClose, data, loading = false, error = "", onRetry }: Props) {
  const [how, setHow] = useState(false);
  const [state, setState] = useState<ShareState>("idle");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const rulesId = useId();
  const url = data?.url || "";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const share = useCallback(async () => {
    if (!url) return;
    const payload = { title: "Profixter", text: shareMessage(url).replace(` ${url}`, ""), url };
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === "function" && (!nav.canShare || nav.canShare(payload))) {
      try {
        await nav.share(payload);
        setState("shared");
        return;
      } catch (e) {
        // Closing the share sheet is not a failure.
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    setState((await writeToClipboard(url)) ? "copied" : "copy_failed");
  }, [url]);

  return (
    <div
      className="rf-scrim"
      data-referral-popup=""
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="rf-sheet">
        <div className="rf-handle" aria-hidden="true" />
        <button type="button" className="rf-close" aria-label="Close" onClick={onClose} data-referral-close="">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>

        <h2 id={titleId} className="rf-title" data-referral-title="">
          <span className="rf-title__lead">Get up to</span> <span className="rf-title__amount">$149</span>{" "}
          <span className="rf-title__tail">per referral</span>
        </h2>
        <p className="rf-lead">Refer a friend to Profixter. The Basic plan qualifies, too.</p>

        <div className="rf-actions">
          <button
            type="button"
            className="ui-btn ui-btn--accent rf-share"
            onClick={share}
            disabled={!url}
            aria-busy={loading && !url ? "true" : undefined}
            data-referral-share=""
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share my link
          </button>

          {error && !url ? (
            <p className="rf-status rf-status--err" role="alert">
              {error}{" "}
              {onRetry ? (
                <button type="button" className="ui-link" onClick={onRetry}>
                  Try again
                </button>
              ) : null}
            </p>
          ) : null}
          {state === "copied" ? (
            <p className="rf-status rf-status--ok" role="status" data-referral-status="copied">
              Link copied. Paste it in a text or email to a friend.
            </p>
          ) : null}
          {state === "shared" ? (
            <p className="rf-status rf-status--ok" role="status" data-referral-status="shared">
              Thanks for sharing.
            </p>
          ) : null}
          {state === "copy_failed" || state === "copied" ? (
            <>
              {state === "copy_failed" ? (
                <p className="rf-status" role="status" data-referral-status="copy_failed">
                  Copy this link and send it to a friend:
                </p>
              ) : null}
              <input className="rf-link" readOnly value={url} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} data-referral-url="" />
            </>
          ) : null}

          <button type="button" className="rf-how" aria-expanded={how} aria-controls={rulesId} onClick={() => setHow((v) => !v)} data-referral-how="">
            How it works
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div id={rulesId} className="rf-rules" hidden={!how} data-referral-rules="">
          <h3>How it works</h3>
          <ol>
            <li>Share your link with a friend.</li>
            <li>They join any Profixter membership through it: Basic, Plus, Premium or Elite. A one-time visit doesn&rsquo;t qualify.</li>
            <li>After their first membership payment, your reward shows as Pending in your account.</li>
            <li>It&rsquo;s ready when their second monthly payment clears, or after 60 days of active membership on an annual plan. You confirm the name and mailing address, and we mail you a check.</li>
          </ol>

          <h3>Your reward</h3>
          <p>
            The lesser of $149 or what your friend actually paid for their first membership payment, after discounts, promo codes and refunds.
            Tax and other charges don&rsquo;t count.
          </p>
          <div className="rf-example">
            <div>
              <span>Basic at full price ($149)</span>
              <b>$149.00</b>
            </div>
            <div>
              <span>Basic with 10% off ($134.10)</span>
              <b>$134.10</b>
            </div>
          </div>

          <h3>Good to know</h3>
          <ul>
            <li>One reward per new household. Your friend must be new to Profixter memberships and live at a different address.</li>
            <li>Your own account or home doesn&rsquo;t qualify.</li>
            <li>If a payment is refunded, the reward is reduced or canceled.</li>
            <li>On an annual plan, the annual payment has to stand: a refund or chargeback reduces or cancels the reward.</li>
            <li>We check every payment again before the check is mailed.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
