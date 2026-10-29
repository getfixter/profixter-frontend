"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleLogin, useGoogleOneTapLogin } from "@react-oauth/google";

/**
 * Google, in its two official forms: the "Continue with Google" button (an ID
 * token credential, never an implicit access token) and One Tap.
 *
 * GoogleOAuthProvider is only mounted by app/providers.tsx when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, and these hooks throw without it - so the
 * check happens here, before anything Google is rendered, and an unconfigured
 * build simply has no Google option.
 */
export function googleConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

type Props = {
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
  /** One Tap only on the sign-up/sign-in pages, and only when signed out. */
  oneTap: boolean;
  disabled?: boolean;
};

export default function GoogleAuth(props: Props) {
  if (!googleConfigured()) return null;
  return <GoogleAuthInner {...props} />;
}

function GoogleAuthInner({ onCredential, onError, oneTap, disabled }: Props) {
  const slot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const measure = () => setWidth(Math.min(400, Math.max(200, Math.floor(el.getBoundingClientRect().width))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useGoogleOneTapLogin({
    onSuccess: (response) => {
      if (response.credential) onCredential(response.credential);
    },
    onError: () => {
      /* One Tap declined or unavailable: the button is still there. */
    },
    use_fedcm_for_prompt: true,
    cancel_on_tap_outside: true,
    disabled: !oneTap || disabled,
  });

  return (
    /* Both surfaces call google.accounts.id.initialize, so both pass the FedCM flag. */
    <div ref={slot} className="auth-google-slot" aria-disabled={disabled ? true : undefined}>
      {width > 0 ? (
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) onCredential(response.credential);
            else onError("Google didn't send a sign-in. Please try again.");
          }}
          onError={() => onError("Google sign-in didn't finish. Please try again.")}
          text="continue_with"
          shape="pill"
          size="large"
          theme="outline"
          logo_alignment="center"
          width={width}
          use_fedcm_for_prompt
        />
      ) : null}
    </div>
  );
}
