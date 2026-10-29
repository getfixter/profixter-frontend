"use client";

import { useEffect, useState } from "react";

/**
 * Sign in with Apple, popup flow.
 *
 * The script is only fetched when both NEXT_PUBLIC_APPLE_CLIENT_ID (the
 * Services ID) and NEXT_PUBLIC_APPLE_REDIRECT_URI are set; otherwise the button
 * does not exist.
 *
 * Replay protection: a random rawNonce is generated per attempt, Apple is given
 * SHA-256(rawNonce) as hex, and the backend receives the rawNonce to hash and
 * compare against the nonce claim inside the id_token.
 *
 * Apple sends the person's name ONLY the first time they authorise the app, so
 * it is forwarded whenever it arrives.
 */
const APPLE_SCRIPT =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

type AppleSignInResponse = {
  authorization?: { id_token?: string; code?: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};

type AppleIdGlobal = {
  auth: {
    init: (config: {
      clientId: string;
      scope: string;
      redirectURI: string;
      state?: string;
      nonce?: string;
      usePopup: boolean;
    }) => void;
    signIn: () => Promise<AppleSignInResponse>;
  };
};

declare global {
  interface Window {
    AppleID?: AppleIdGlobal;
  }
}

export type AppleCredential = {
  idToken: string;
  rawNonce: string;
  name?: { firstName: string; lastName: string };
};

export function appleConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID && process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI);
}

let scriptPromise: Promise<boolean> | null = null;

function loadAppleScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.AppleID) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = APPLE_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.AppleID));
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function randomNonce(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Props = {
  onCredential: (credential: AppleCredential) => void;
  onError: (message: string) => void;
  onStart?: () => void;
  disabled?: boolean;
};

export default function AppleAuth(props: Props) {
  if (!appleConfigured()) return null;
  return <AppleAuthInner {...props} />;
}

function AppleAuthInner({ onCredential, onError, onStart, disabled }: Props) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppleScript().then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = async () => {
    if (busy || !window.AppleID) return;
    onStart?.();
    setBusy(true);
    try {
      const rawNonce = randomNonce();
      window.AppleID.auth.init({
        clientId: String(process.env.NEXT_PUBLIC_APPLE_CLIENT_ID),
        scope: "name email",
        redirectURI: String(process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI),
        state: randomNonce(16),
        nonce: await sha256Hex(rawNonce),
        usePopup: true,
      });
      const response = await window.AppleID.auth.signIn();
      const idToken = response?.authorization?.id_token;
      if (!idToken) {
        onError("Apple didn't send a sign-in. Please try again.");
        return;
      }
      const first = response.user?.name?.firstName?.trim() || "";
      const last = response.user?.name?.lastName?.trim() || "";
      onCredential({
        idToken,
        rawNonce,
        ...(first || last ? { name: { firstName: first, lastName: last } } : {}),
      });
    } catch (err) {
      const code = (err as { error?: string })?.error;
      // Closing the popup is a choice, not an error worth shouting about.
      if (code !== "popup_closed_by_user" && code !== "user_cancelled_authorize") {
        onError("Apple sign-in didn't finish. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="auth-method auth-method--apple"
      onClick={() => void start()}
      disabled={!ready || busy || disabled}
    >
      <span className="auth-method__icon" aria-hidden="true">
        <svg width="18" height="20" viewBox="0 0 17 20" fill="currentColor">
          <path d="M14.06 10.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.57 1.1 8.72.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.28-.88-2.3-3.47zM11.9 4.15c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
        </svg>
      </span>
      {busy ? "Opening Apple…" : "Continue with Apple"}
    </button>
  );
}
