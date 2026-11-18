"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import AuthScreen, { AuthHeading, AuthPassword, AuthSubmit } from "@/app/components/auth/AuthScreen";
import { getAutomaticEntryPath } from "@/lib/auth-routing";
import { isTelemarketer } from "@/lib/admin/sections";

/*
 * A new Telemarketer's invitation link: /team-setup#<token>
 * (BackEnd utils/auth/staffSetup.js, routes/staffSetup.js).
 *
 * The token is read from the URL fragment, which the browser never sends to a
 * server, and is wiped from the address bar at once so it does not sit in
 * history or a screenshot. The employee chooses their own password; the link
 * then stops working and they are signed straight into their workspace.
 */
type Phase =
  | { kind: "checking" }
  | { kind: "ready"; firstName: string; email: string; expiresAt: string }
  | { kind: "invalid"; message: string };

const fallbackInvalid = "This setup link isn't valid. Ask the owner to send you a new one.";
const messageOf = (caught: unknown, fallback: string) => (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function TeamSetupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const token = useRef("");
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    token.current = window.location.hash.replace(/^#/, "").trim();
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    if (!token.current) {
      // Deferred: no synchronous state update inside the effect body.
      void Promise.resolve().then(() =>
        setPhase({ kind: "invalid", message: "This page needs the full setup link from your invitation. Open the link again, or ask the owner for a new one." })
      );
      return;
    }
    API.post("/api/staff-setup/verify", { token: token.current })
      .then((r) => setPhase({ kind: "ready", firstName: r.data.firstName, email: r.data.email, expiresAt: r.data.expiresAt }))
      .catch((caught) => setPhase({ kind: "invalid", message: messageOf(caught, fallbackInvalid) }));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    setError("");
    try {
      const r = await API.post("/api/staff-setup/complete", { token: token.current, password });
      token.current = "";
      const user = await login(r.data.token);
      router.replace(user && isTelemarketer(user) ? "/admin/sales-today" : getAutomaticEntryPath(user));
    } catch (caught) {
      const code = (caught as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "SETUP_LINK_INVALID" || code === "SETUP_LINK_EXPIRED") setPhase({ kind: "invalid", message: messageOf(caught, fallbackInvalid) });
      else setError(messageOf(caught, "Couldn't save your password. Please try again."));
      setSaving(false);
    }
  };

  if (phase.kind === "checking") {
    return (
      <AuthScreen>
        <AuthHeading>Checking your link…</AuthHeading>
      </AuthScreen>
    );
  }

  if (phase.kind === "invalid") {
    return (
      <AuthScreen>
        <div data-team-setup-invalid>
          <AuthHeading sub={phase.message}>This link can&apos;t be used</AuthHeading>
          <p className="auth-fineprint">Already set up? Sign in with your email and password.</p>
          <Link href="/signin" className="auth-submit" style={{ display: "inline-flex", justifyContent: "center", marginTop: 12 }}>
            Go to sign in
          </Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <AuthHeading sub={`Choose a password for ${phase.email}. You'll use it with this email to sign in.`}>
        {phase.firstName ? `Welcome, ${phase.firstName}` : "Welcome"}
      </AuthHeading>
      <form onSubmit={submit} className="auth-fields" data-clarity-mask="true" data-team-setup>
        <input type="email" name="username" autoComplete="username" value={phase.email} readOnly hidden />
        <AuthPassword
          id="team-setup-password"
          label="New password"
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <AuthPassword
          id="team-setup-confirm"
          label="Confirm password"
          placeholder="Type it again"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error}
        />
        <AuthSubmit loading={saving} disabled={saving}>
          Create password and continue
        </AuthSubmit>
      </form>
    </AuthScreen>
  );
}
