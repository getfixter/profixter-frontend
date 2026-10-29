"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import { buttonClass } from "@/app/components/ui/Button";

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

/* The server's own floor (routes/auth.js /change-password); checked here first so the message is instant. */
const MIN_PASSWORD = 8;

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium text-[color:var(--ui-text-2)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="auth-input auth-input--trailing"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="auth-reveal"
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {show ? (
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
    </div>
  );
}

function DeleteAccountModal({
  userEmail,
  onClose,
}: {
  userEmail: string;
  onClose: () => void;
}) {
  const [confirmInput, setConfirmInput] = useState("");
  const [phase, setPhase] = useState<"confirm" | "deleting" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const { logout } = useAuth();

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  /*
   * What has to be typed to confirm. The email when there is one; an account
   * opened with a phone may have none, and comparing an empty box with an
   * empty email used to enable Delete without typing anything at all.
   */
  const phrase = userEmail.trim() || "DELETE";
  const matches = confirmInput.trim().toLowerCase() === phrase.toLowerCase();

  const handleDelete = async () => {
    if (!matches) return;

    setPhase("deleting");
    setErrorMsg("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await axios.delete(`${apiBase}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      logout();
      router.replace("/?deleted=1");
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const msg =
        apiError?.response?.data?.message ||
        "Could not delete account. Please try again or contact support.";
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-[rgba(11,22,40,0.5)] sm:items-center sm:p-4"
      onClick={phase === "deleting" ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="max-h-[calc(100svh-24px)] w-full overflow-y-auto rounded-t-[20px] bg-white shadow-[var(--ui-shadow-3)] sm:max-w-[460px] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-6 pt-6 sm:px-6 sm:pt-7">
          <h3 id="delete-account-title" className="text-[20px] font-semibold tracking-[-0.02em] text-[color:var(--ui-ink)]">
            Delete your account?
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--ui-text-2)]">
            This is permanent and cannot be undone. Your profile, booking history, and all account
            data will be removed immediately.
          </p>

          {/* What gets deleted */}
          <div className="mt-4 rounded-[var(--ui-r-sm)] bg-[#fdeeec] p-4">
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#8f2a22]">What will be deleted</div>
            <ul className="mt-2 space-y-1 text-[14px] text-[#7a241d]">
              {[
                "Your name, email, and contact info",
                "Your saved addresses",
                "Your full booking history",
                "Your Profixter login",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Error from server */}
          {phase === "error" && <p className="auth-error auth-error--form">{errorMsg}</p>}

          {/* Confirmation input */}
          <div className="mt-4">
            <label htmlFor="delete-confirm" className="mb-1.5 block text-[14px] font-medium text-[color:var(--ui-text-2)]">
              {userEmail.trim() ? "Type your email to confirm" : "Type DELETE to confirm"}
            </label>
            <input
              id="delete-confirm"
              type={userEmail.trim() ? "email" : "text"}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={phrase}
              autoComplete="off"
              disabled={phase === "deleting"}
              className="auth-input disabled:opacity-60"
            />
            {confirmInput.length > 0 && !matches ? (
              <p className="auth-error">{userEmail.trim() ? "That email does not match." : "Type DELETE exactly."}</p>
            ) : null}
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "deleting"}
              className={buttonClass({ variant: "secondary", className: "flex-1 disabled:opacity-60" })}
            >
              Keep account
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!matches || phase === "deleting"}
              className="ui-btn flex-1 bg-[#b4342b] text-white hover:bg-[#9a2c24] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === "deleting" ? "Deleting…" : "Delete account"}
            </button>
          </div>

          <p className="mt-3 text-center text-[13px] text-[color:var(--ui-text-3)]">
            Need help instead?{" "}
            <a href="tel:631-599-1363" className="font-semibold text-[color:var(--ui-accent-ink)]">
              Call 631-599-1363
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export function PasswordForm() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /*
   * Registration 2.0 accounts (phone or email code, Google, Apple) have no
   * password, so there is no current password to type and the change form
   * could only ever fail. They are told how they sign in instead. Only an
   * explicit false counts: an older session without the flag keeps the form.
   */
  const passwordless = user?.hasPassword === false;

  const strength =
    newPassword.length === 0 ? 0
    : newPassword.length < MIN_PASSWORD ? 1
    : newPassword.length < 10 ? 2
    : /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 4
    : 3;

  const strengthLabel = ["", "Too short", "Weak", "Good", "Strong"][strength];
  const strengthColor = ["", "#B4342B", "#B7791F", "#1F8A4C", "#306EEC"][strength];

  const handleSave = async () => {
    setMessage("");
    setStatus("loading");

    if (!currentPassword || !newPassword || !confirm) {
      setStatus("error");
      setMessage("Please fill in all fields.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD) {
      setStatus("error");
      setMessage(`New password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    if (newPassword !== confirm) {
      setStatus("error");
      setMessage("New passwords do not match.");
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStatus("success");
      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: unknown) {
      setStatus("error");
      const apiError = err as ApiError;
      const msg = apiError?.response?.data?.message || "Password update failed. Please try again.";
      setMessage(msg);
    }
  };

  const handleDiscard = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setMessage("");
    setStatus("idle");
  };

  return (
    <>
      <div className="acct-stack">
        {passwordless ? (
          <section className="acct-card" aria-labelledby="acct-password" data-acct-password="none">
            <h2 id="acct-password" className="acct-card__title">
              No password needed
            </h2>
            <p className="acct-card__text">
              Your account signs in without a password (a one-time code, Google or Apple), so there is nothing to
              change here.
              {user?.email ? " If you would like a password as well, you can create one from Forgot password." : ""}
            </p>
            {user?.email ? (
              <div className="acct-card__actions">
                <Link href="/forgot-password" className={buttonClass({ variant: "secondary", size: "sm" })}>
                  Create a password
                </Link>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="acct-card" aria-labelledby="acct-password">
            <h2 id="acct-password" className="acct-card__title">
              Change password
            </h2>
            <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <PasswordField
                id="current-password"
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />

              <PasswordField
                id="new-password"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div>
                  <div className="mb-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ backgroundColor: i <= strength ? strengthColor : "#E6E8EC" }}
                      />
                    ))}
                  </div>
                  <div className="text-[13px] font-medium" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </div>
                </div>
              )}

              <PasswordField
                id="confirm-password"
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />

              {/* Match indicator */}
              {confirm.length > 0 && newPassword.length > 0 && (
                <div className={`text-[13px] font-medium ${confirm === newPassword ? "text-[color:var(--ui-success)]" : "text-[#b4342b]"}`}>
                  {confirm === newPassword ? "Passwords match" : "Passwords do not match"}
                </div>
              )}

              {/* Status message */}
              {message && (
                <div
                  role={status === "error" ? "alert" : "status"}
                  className={`rounded-[var(--ui-r-sm)] px-3.5 py-2.5 text-[14px] font-medium ${
                    status === "success" ? "bg-[#eaf6ef] text-[#17643a]" : "bg-[#fdeeec] text-[#9a2c24]"
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={status === "loading"}
                  className={buttonClass({ variant: "secondary", className: "flex-1 disabled:opacity-60" })}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={status === "loading"}
                  className={buttonClass({ variant: "primary", className: "flex-1 disabled:opacity-60" })}
                >
                  {status === "loading" ? "Saving…" : "Save password"}
                </button>
              </div>
            </form>

            {/* Security tips */}
            <div className="mt-5 border-t border-[color:var(--ui-line)] pt-4">
              <p className="acct-label">Tips for a strong password</p>
              <ul className="ui-checks mt-2">
                <li>Use at least 10 characters with uppercase, numbers, and symbols</li>
                <li>Avoid using the same password on multiple sites</li>
                <li>Never share your password with anyone, including Profixter staff</li>
              </ul>
            </div>
          </section>
        )}

        {/* Delete account: kept apart from everything else on the page. */}
        <section className="acct-card" aria-labelledby="acct-delete">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="acct-delete" className="acct-card__title">
                Delete account
              </h2>
              <p className="acct-card__text !mt-1">
                Permanently remove your account and all data. Only available when you have no active Membership.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className={buttonClass({ variant: "secondary", size: "sm", className: "!border-[#e8b4ae] !text-[#b4342b]" })}
            >
              Delete
            </button>
          </div>
        </section>
      </div>

      {/* Delete account modal */}
      {showDeleteModal && (
        <DeleteAccountModal userEmail={user?.email || ""} onClose={() => setShowDeleteModal(false)} />
      )}
    </>
  );
}
