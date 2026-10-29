"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { AuthInput, AuthPassword, AuthSubmit } from "./AuthScreen";
import GoogleAuth, { googleConfigured } from "./GoogleAuth";
import AppleAuth, { appleConfigured, type AppleCredential } from "./AppleAuth";

/*
 * The screens of the sign-up/sign-in flow other than the phone step.
 *
 * The phone step stays inline in app/(auth)/signup/page.tsx on purpose: the
 * A2P 10DLC evidence tests read that file and pin the phone field, the absence
 * of any SMS checkbox and the exact "By continuing" line in one form.
 * Everything else lives here so that file holds exactly one <form>.
 */

function PhoneGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.6" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.5 18.2h3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MethodChooser({
  mode,
  busy,
  oneTap,
  onPhone,
  onEmail,
  onPassword,
  onGoogle,
  onApple,
  onAppleStart,
  onProviderError,
}: {
  mode: "signup" | "signin";
  busy: boolean;
  oneTap: boolean;
  onPhone: () => void;
  onEmail: () => void;
  onPassword: () => void;
  onGoogle: (idToken: string) => void;
  onApple: (credential: AppleCredential) => void;
  onAppleStart: () => void;
  onProviderError: (message: string) => void;
}) {
  const hasProviders = googleConfigured() || appleConfigured();
  return (
    <div className="auth-methods">
      <button type="button" className="auth-method auth-method--primary" onClick={onPhone} disabled={busy}>
        <span className="auth-method__icon" aria-hidden="true">
          <PhoneGlyph />
        </span>
        Continue with phone
      </button>

      {hasProviders ? <div className="auth-divider">or</div> : null}

      <GoogleAuth onCredential={onGoogle} onError={onProviderError} oneTap={oneTap} disabled={busy} />
      <AppleAuth onCredential={onApple} onError={onProviderError} onStart={onAppleStart} disabled={busy} />

      <button type="button" className="auth-method" onClick={onEmail} disabled={busy}>
        <span className="auth-method__icon text-[color:var(--ui-accent)]" aria-hidden="true">
          <MailGlyph />
        </span>
        Continue with email
      </button>

      {mode === "signin" ? (
        <button type="button" className="auth-text-button mx-auto mt-1" onClick={onPassword} disabled={busy}>
          Sign in with password
        </button>
      ) : null}

      <p className="auth-fineprint">
        By continuing, you agree to the{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
        {mode === "signup" ? (
          <>
            {" "}
            Have a password?{" "}
            <button type="button" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-[3px]" onClick={onPassword}>
              Sign in with it
            </button>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

export function EmailStep({
  email,
  onEmail,
  onSubmit,
  loading,
  error,
  maskedHint,
}: {
  email: string;
  onEmail: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
  maskedHint: string | null;
}) {
  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form onSubmit={handle} className="auth-fields" noValidate>
      {maskedHint ? (
        <p className="auth-sub !mt-0">
          Type the email on that account (<b className="font-semibold text-[color:var(--ui-ink)]">{maskedHint}</b>) and we&apos;ll send it a code.
        </p>
      ) : null}
      <AuthInput
        id="auth-email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="send"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        error={error}
      />
      <AuthSubmit disabled={loading} loading={loading}>
        {loading ? "Sending code" : "Email me a code"}
      </AuthSubmit>
    </form>
  );
}

export function LinkRequiredStep({
  maskedEmail,
  hasPassword,
  loading,
  onEmailCode,
  onPassword,
  onNewAccount,
}: {
  maskedEmail: string | null;
  hasPassword: boolean;
  loading: boolean;
  onEmailCode: () => void;
  onPassword: () => void;
  onNewAccount: () => void;
}) {
  return (
    <div className="auth-options">
      <button type="button" className="auth-option" onClick={onEmailCode} disabled={loading}>
        <b>Confirm with email code</b>
        <span>{maskedEmail ? `We'll email a code to ${maskedEmail}.` : "We'll email a code to the address on the account."}</span>
      </button>
      {hasPassword ? (
        <button type="button" className="auth-option" onClick={onPassword} disabled={loading}>
          <b>Sign in with password</b>
          <span>Use the email and password you already have.</span>
        </button>
      ) : null}
      <button type="button" className="auth-option auth-option--quiet" onClick={onNewAccount} disabled={loading}>
        <b>This isn&apos;t me — create a new account</b>
        <span>{loading ? "Creating your account…" : "Start fresh with this number."}</span>
      </button>
    </div>
  );
}

export type AccountChoice = { accountRole: "customer" | "employee"; label: string };

export function PasswordStep({
  email,
  onEmail,
  onSubmit,
  loading,
  error,
  choices,
  onChoose,
  footer,
}: {
  email: string;
  onEmail: (value: string) => void;
  onSubmit: (password: string) => void;
  loading: boolean;
  error: string;
  choices: AccountChoice[];
  onChoose: (role: "customer" | "employee", password: string) => void;
  footer?: ReactNode;
}) {
  const [password, setPassword] = useState("");
  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(password);
  };
  return (
    <form onSubmit={handle} className="auth-fields" noValidate>
      <AuthInput
        id="auth-email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Email"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
      />
      <AuthPassword
        id="password"
        label="Password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {choices.length > 0 ? (
        <div className="ui-card !p-4">
          <p className="text-[15px] font-semibold text-[color:var(--ui-ink)]">This email has more than one account</p>
          <p className="mt-1 text-[14px] text-[color:var(--ui-text-2)]">Choose which one to open.</p>
          <div className="mt-3 space-y-2">
            {choices.map((choice) => (
              <button
                key={choice.accountRole}
                type="button"
                disabled={loading}
                onClick={() => onChoose(choice.accountRole, password)}
                className="ui-btn ui-btn--primary ui-btn--block disabled:opacity-50"
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div aria-live="polite">{error ? <p className="auth-error auth-error--form" role="alert">{error}</p> : null}</div>

      <AuthSubmit disabled={loading} loading={loading}>
        {loading ? "Logging in" : "Log In"}
      </AuthSubmit>
      <p className="auth-alt !mt-3">
        <Link href="/forgot-password" className="auth-inline-link">
          Forgot password?
        </Link>
      </p>
      {footer}
    </form>
  );
}

/**
 * "Which account?" - a household can share one mobile, so several accounts may
 * have verified the same number. The person who just proved they hold the
 * phone picks which of them to open.
 */
export function ChooseAccountStep({
  accounts,
  loadingId,
  onChoose,
}: {
  accounts: { id: string; label: string; detail: string }[];
  loadingId: string;
  onChoose: (accountId: string) => void;
}) {
  return (
    <div className="auth-options">
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          className="auth-option"
          onClick={() => onChoose(account.id)}
          disabled={Boolean(loadingId)}
          aria-busy={loadingId === account.id ? true : undefined}
        >
          <b>{account.label || "Profixter account"}</b>
          <span>{loadingId === account.id ? "Opening…" : account.detail}</span>
        </button>
      ))}
    </div>
  );
}
