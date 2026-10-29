"use client";

import { useEffect, useRef, type ClipboardEvent, type ChangeEvent } from "react";

/**
 * One box for a six-digit code. Not six boxes.
 *
 * A single input is what lets every platform help: iOS offers the code from
 * Messages above the keyboard (autocomplete="one-time-code"), Android's
 * keyboard offers it too, a password manager can fill it, and a pasted
 * "123 456" or "Your Profixter code is 123456" just works. Six boxes break
 * most of that.
 *
 * As soon as six digits are present the parent is told (onComplete), once per
 * distinct code, so nobody has to find a Verify button.
 *
 * WebOTP: on Chrome for Android, when the text message ends with
 * "@profixter.com #123456" (the origin-bound format), the browser offers the
 * code with one tap and we fill and submit it. Listening is aborted on unmount
 * and as soon as the customer starts typing themselves.
 */
type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Change it (e.g. after a resend) to start listening for a new SMS. */
  listenKey?: string | number;
  /** Only the SMS channel can use WebOTP. */
  webOtp?: boolean;
  autoFocus?: boolean;
};

type OtpCredentialLike = Credential & { code?: string };

export function extractCode(raw: string): string {
  const grouped = raw.match(/(?:^|\D)(\d{3})[\s-]?(\d{3})(?:\D|$)/);
  if (grouped && raw.replace(/\D/g, "").length > 6) return `${grouped[1]}${grouped[2]}`;
  return raw.replace(/\D/g, "").slice(0, 6);
}

export default function OtpCodeInput({
  id,
  label,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  describedBy,
  listenKey,
  webOtp = false,
  autoFocus = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastCompleted = useRef("");
  const onChangeRef = useRef(onChange);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onChangeRef.current = onChange;
    onCompleteRef.current = onComplete;
  }, [onChange, onComplete]);

  /* Auto-submit: once per distinct six-digit value. */
  useEffect(() => {
    if (value.length !== 6) {
      lastCompleted.current = "";
      return;
    }
    if (disabled || lastCompleted.current === value) return;
    lastCompleted.current = value;
    onCompleteRef.current(value);
  }, [value, disabled]);

  /* WebOTP, where the browser has it. */
  useEffect(() => {
    if (!webOtp || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const controller = new AbortController();
    abortRef.current = controller;
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: controller.signal } as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as OtpCredentialLike | null)?.code;
        if (!code || controller.signal.aborted) return;
        onChangeRef.current(extractCode(code));
      })
      .catch(() => {
        /* aborted, dismissed or unsupported: typing still works */
      });
    return () => {
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [webOtp, listenKey]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, listenKey]);

  const stopListening = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = extractCode(e.target.value);
    if (next.length > 0) stopListening();
    onChange(next);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    stopListening();
    onChange(extractCode(text));
  };

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name="one-time-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        enterKeyHint="done"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        /* readOnly, not disabled: disabling would drop focus and the keyboard. */
        readOnly={disabled}
        aria-busy={disabled ? true : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        placeholder="••••••"
        className="auth-input auth-otp"
      />
    </div>
  );
}
