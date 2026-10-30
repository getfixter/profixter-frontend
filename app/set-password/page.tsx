"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import type { User } from "@/lib/auth-service";
import AuthScreen, { AuthHeading, AuthPassword, AuthSubmit } from "@/app/components/auth/AuthScreen";
import { getAutomaticEntryPath } from "@/lib/auth-routing";

/*
 * First sign-in with the temporary password Admin sent (their phone number).
 *
 * The server lets that session do nothing but this (middleware/auth.js), so
 * this screen is the only way forward. Once a password is set the temporary
 * one stops working for good.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const { user, isLoading, updateUser } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/signin");
    else if (!(user.mustChangePassword && user.temporaryPassword)) router.replace(getAutomaticEntryPath(user));
  }, [isLoading, router, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await API.post("/api/auth/change-password", { newPassword: password });
      const fresh = res.data?.user as User | undefined;
      if (fresh) updateUser(fresh);
      router.replace(fresh ? getAutomaticEntryPath(fresh) : "/account");
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(data?.message || "Could not save your password. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AuthScreen>
      <AuthHeading sub="Your account is ready. Choose a password to replace the temporary one we sent you.">
        Create your password
      </AuthHeading>
      <form onSubmit={submit} className="auth-fields" data-set-password>
        <AuthPassword
          id="new-password"
          label="New password"
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          autoFocus
        />
        <AuthSubmit loading={saving} disabled={saving}>
          Save and continue
        </AuthSubmit>
      </form>
    </AuthScreen>
  );
}
