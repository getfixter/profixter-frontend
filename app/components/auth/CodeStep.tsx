"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import OtpCodeInput from "./OtpCodeInput";
import { otpErrorMessage, readApiError } from "@/lib/auth2";

/**
 * "Enter the code" - shared by phone and email, sign-up and attach.
 *
 * The parent owns what a code MEANS (sign in, link, attach); this owns typing
 * it, sending it exactly once, resending with a countdown and saying what went
 * wrong in plain words.
 */
export type CodeOutcome = { error: string; expired?: boolean; locked?: boolean; keepCode?: boolean } | null;

/** Turns a failed verify/resend into what the step should show. */
export function outcomeFromError(err: unknown, channel: "phone" | "email"): NonNullable<CodeOutcome> {
  const parsed = readApiError(err);
  return {
    error: otpErrorMessage(parsed, channel),
    expired: parsed.code === "CODE_EXPIRED",
    locked: parsed.code === "INVALID_CODE" && parsed.attemptsLeft === 0,
    keepCode: parsed.code === "NETWORK" || parsed.code === "RATE_LIMITED" || (parsed.status ?? 0) >= 500,
  };
}

type Props = {
  idPrefix: string;
  channel: "phone" | "email";
  /** Masked destination from the server, e.g. "(•••) •••-1234". */
  destination: string;
  /** Epoch ms when Resend unlocks. */
  resendAt: number;
  onVerify: (code: string) => Promise<CodeOutcome>;
  onResend: () => Promise<CodeOutcome>;
  onChangeDestination: () => void;
  changeLabel: string;
  /** Render as a sheet section (smaller heading) rather than a page. */
  compact?: boolean;
};

function useSecondsUntil(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target <= Date.now()) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= target) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);
  return Math.max(0, Math.ceil((target - now) / 1000));
}

export default function CodeStep({
  idPrefix,
  channel,
  destination,
  resendAt,
  onVerify,
  onResend,
  onChangeDestination,
  changeLabel,
  compact = false,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [listenKey, setListenKey] = useState(0);
  const inFlight = useRef(false);
  const secondsLeft = useSecondsUntil(resendAt);

  const verify = useCallback(
    async (value: string) => {
      if (inFlight.current || value.length !== 6) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      setStatus("Checking your code…");
      try {
        const outcome = await onVerify(value);
        if (outcome) {
          setError(outcome.error);
          setStatus("");
          setNeedsNewCode(Boolean(outcome.expired || outcome.locked));
          if (!outcome.keepCode) setCode("");
        } else {
          setStatus(channel === "phone" ? "Number confirmed." : "Email confirmed.");
        }
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [onVerify, channel]
  );

  const resend = async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setError("");
    setStatus("");
    try {
      const outcome = await onResend();
      if (outcome) {
        setError(outcome.error);
      } else {
        setNeedsNewCode(false);
        setCode("");
        setListenKey((k) => k + 1);
        setStatus(channel === "phone" ? `New code sent to ${destination}.` : `New code sent to ${destination}.`);
      }
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };

  const errorId = `${idPrefix}-code-error`;
  const statusId = `${idPrefix}-code-status`;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <form onSubmit={handleSubmit} noValidate className={compact ? "mt-4" : "auth-fields"}>
      <p className={compact ? "text-[14.5px] text-[#5b6577]" : "auth-sub !mt-0"}>
        Enter the 6-digit code we sent to <b className="text-[#0B1628]">{destination}</b>.
      </p>

      <OtpCodeInput
        id={`${idPrefix}-code`}
        label={channel === "phone" ? "Code from the text message" : "Code from the email"}
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error && next.length > 0) setError("");
        }}
        onComplete={(value) => void verify(value)}
        disabled={busy}
        invalid={Boolean(error)}
        describedBy={`${error ? errorId : ""} ${statusId}`.trim()}
        listenKey={listenKey}
        webOtp={channel === "phone"}
      />

      <div aria-live="polite" aria-atomic="true">
        {error ? (
          <p id={errorId} className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <p id={statusId} className="auth-status">
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <span className="auth-spinner !border-[#c9d4ea] !border-t-[#306EEC]" aria-hidden="true" />
              {status}
            </span>
          ) : (
            status
          )}
        </p>
      </div>

      {/*
        No mandatory Verify tap: six digits submit themselves. The button only
        appears when six digits are sitting there unsent - after a dropped
        connection, say - so there is always a way forward.
      */}
      {code.length === 6 && !busy && error ? (
        <button type="submit" className="auth-submit !mt-2">
          Verify code
        </button>
      ) : null}

      <div className="auth-code-meta">
        <button type="button" className="auth-text-button !pl-0" onClick={onChangeDestination} disabled={busy}>
          {changeLabel}
        </button>
        <button
          type="button"
          className="auth-text-button"
          onClick={() => void resend()}
          disabled={secondsLeft > 0 || resending || busy}
          aria-live="off"
        >
          {resending
            ? "Sending…"
            : secondsLeft > 0
              ? `Resend code in ${mm}:${ss}`
              : needsNewCode
                ? "Send a new code"
                : "Resend code"}
        </button>
      </div>
    </form>
  );
}
