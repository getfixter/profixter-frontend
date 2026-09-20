"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The shell every auth screen sits in.
 *
 * It exists because sign up, sign in and password reset had each grown their
 * own: three backgrounds, three headers, three input styles and three ideas
 * about where a heading goes. A customer who forgot their password walked out
 * of one design and into another twice in three clicks.
 *
 * It holds a brand mark, one secondary link, and a column. Nothing else - the
 * screens themselves supply the question and the field, and the shell is
 * deliberately not clever enough to add anything to them.
 */
export default function AuthScreen({
  children,
  altPrompt,
  altLabel,
  altHref,
}: {
  children: ReactNode;
  /** The one secondary destination in the top-right, e.g. "Log In". */
  altPrompt?: string;
  altLabel?: string;
  altHref?: string;
}) {
  return (
    <div className="auth-screen">
      <div className="auth-screen__bar">
        <Link href="/" className="auth-brand" aria-label="Profixter home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-footer.svg" alt="Profixter" width={113} height={24} />
        </Link>

        {altHref ? (
          <Link href={altHref} className="auth-bar__link">
            {altPrompt ? <span>{altPrompt} </span> : null}
            <b>{altLabel}</b>
          </Link>
        ) : null}
      </div>

      <div className="auth-screen__body">
        <div className="auth-screen__column">{children}</div>
      </div>
    </div>
  );
}

/** The question, and the back way out of it. */
export function AuthHeading({
  children,
  onBack,
  sub,
}: {
  children: ReactNode;
  onBack?: () => void;
  sub?: string;
}) {
  return (
    <>
      {onBack ? (
        <button type="button" onClick={onBack} className="auth-back">
          <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden="true">
            <path
              d="M6 1L1 6l5 5"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Back
        </button>
      ) : null}
      <h1 className="auth-question">{children}</h1>
      {sub ? <p className="auth-sub">{sub}</p> : null}
    </>
  );
}

/**
 * A text input with no visible label.
 *
 * The question above it is the label, so repeating it in a small grey caption
 * would be saying the same thing twice at two sizes. The accessible name is
 * carried properly rather than dropped - a screen reader gets a real <label>,
 * it is simply not drawn.
 */
export function AuthInput({
  id,
  label,
  error,
  className = "",
  ...rest
}: {
  id: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className={`auth-input ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The same input, with a reveal toggle instead of a second confirmation field. */
export function AuthPassword({
  id,
  label,
  error,
  ...rest
}: {
  id: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          className="auth-input auth-input--trailing"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="auth-reveal"
          aria-label={shown ? "Hide password" : "Show password"}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            {shown ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The primary action. One per screen. */
export function AuthSubmit({
  children,
  loading,
  ...rest
}: { children: ReactNode; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" className="auth-submit" {...rest}>
      {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/**
 * Move focus to the first field whenever the step changes.
 *
 * Not on the very first render on a phone: focusing an input on load throws the
 * keyboard up over a screen the customer has not read yet. Once they have
 * pressed Continue they are committed, and landing in the next field is what
 * they expect.
 */
export function useStepFocus(step: number | string, selector: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = document.querySelector<HTMLElement>(selector);
    el?.focus();
  }, [step, selector]);
}
