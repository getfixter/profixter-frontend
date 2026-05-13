"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";

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
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#6A6D71] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full px-4 py-3.5 bg-white border border-[#D7E0F5] rounded-[14px] text-[15px] text-[#313234] focus:outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/10 transition pr-12"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6A6D71] transition"
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
  const [emailInput, setEmailInput] = useState("");
  const [phase, setPhase] = useState<"confirm" | "deleting" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const { logout } = useAuth();

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const emailMatches = emailInput.trim().toLowerCase() === userEmail.trim().toLowerCase();

  const handleDelete = async () => {
    if (!emailMatches) return;

    setPhase("deleting");
    setErrorMsg("");

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await axios.delete(`${apiBase}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      logout();
      router.replace("/?deleted=1");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Could not delete account. Please try again or contact support.";
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
      onClick={phase === "deleting" ? undefined : onClose}
    >
      <div
        className="w-full sm:max-w-[460px] bg-white rounded-t-[28px] sm:rounded-[22px] shadow-[0_-8px_60px_rgba(0,0,0,0.2)] sm:shadow-[0_32px_100px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#E2E8F0]" />
        </div>

        <div className="px-6 pt-5 pb-6 sm:px-7 sm:pt-7">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </div>

          <h3 className="text-[20px] font-black text-[#313234] mb-1">Delete your account?</h3>
          <p className="text-[13px] text-[#6A6D71] leading-relaxed mb-5">
            This is permanent and cannot be undone. Your profile, booking history, and all account
            data will be removed immediately.
          </p>

          {/* What gets deleted */}
          <div className="rounded-[14px] bg-red-50 border border-red-100 p-4 mb-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-red-700 mb-2.5">
              What will be deleted
            </div>
            <ul className="space-y-1.5 text-[12px] text-red-800">
              {[
                "Your name, email, and contact info",
                "Your saved addresses",
                "Your full booking history",
                "Your Fixter account login",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-px flex-shrink-0 text-red-500">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Error from server */}
          {phase === "error" && (
            <div className="rounded-[12px] bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700 font-semibold mb-4">
              {errorMsg}
            </div>
          )}

          {/* Email confirmation input */}
          <div className="mb-5">
            <label className="block text-[12px] font-bold text-[#6A6D71] mb-1.5">
              Type your email to confirm
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={userEmail}
              disabled={phase === "deleting"}
              className="w-full px-4 py-3 rounded-[12px] border border-[#D7E0F5] text-[14px] text-[#313234] focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {emailInput.length > 0 && (
              <div className={`mt-1.5 text-[11px] font-semibold ${emailMatches ? "text-[#10B981]" : "text-red-500"}`}>
                {emailMatches ? "✓ Email confirmed" : "✗ Email does not match"}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "deleting"}
              className="flex-1 py-3 rounded-[14px] border border-[#E0E6F5] bg-white text-[#313234] text-[14px] font-semibold hover:bg-[#F8FAFF] transition disabled:opacity-60"
            >
              Keep account
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!emailMatches || phase === "deleting"}
              className="flex-1 py-3 rounded-[14px] bg-red-600 text-white text-[14px] font-semibold hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {phase === "deleting" ? "Deleting…" : "Delete account"}
            </button>
          </div>

          <p className="mt-3 text-[11px] text-[#9CA3AF] text-center">
            Need help instead?{" "}
            <a href="tel:631-599-1363" className="text-[#306EEC] font-semibold">
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

  const strength =
    newPassword.length === 0 ? 0
    : newPassword.length < 6 ? 1
    : newPassword.length < 10 ? 2
    : /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 4
    : 3;

  const strengthLabel = ["", "Too short", "Weak", "Good", "Strong"][strength];
  const strengthColor = ["", "#EF4444", "#F59E0B", "#10B981", "#306EEC"][strength];

  const handleSave = async () => {
    setMessage("");
    setStatus("loading");

    if (!currentPassword || !newPassword || !confirm) {
      setStatus("error");
      setMessage("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 6) {
      setStatus("error");
      setMessage("New password must be at least 6 characters.");
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
    } catch (err: any) {
      setStatus("error");
      const msg = err?.response?.data?.message || "Password update failed. Please try again.";
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
      <div>
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-[22px] font-bold text-[#313234]">Security</h2>
          <p className="text-[13px] text-[#6A6D71] mt-0.5">Update your account password</p>
        </div>

        <div className="bg-white border border-[#E0E6F5] rounded-[18px] p-5 sm:p-6 max-w-[480px]">
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <PasswordField
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />

            <PasswordField
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />

            {/* Strength meter */}
            {newPassword.length > 0 && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= strength ? strengthColor : "#E5E7EB" }}
                    />
                  ))}
                </div>
                <div className="text-[11px] font-semibold" style={{ color: strengthColor }}>
                  {strengthLabel}
                </div>
              </div>
            )}

            <PasswordField
              id="confirm-password"
              label="Confirm New Password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />

            {/* Match indicator */}
            {confirm.length > 0 && newPassword.length > 0 && (
              <div className={`text-[12px] font-semibold ${confirm === newPassword ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                {confirm === newPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
              </div>
            )}

            {/* Status message */}
            {message && (
              <div
                className={`rounded-[12px] px-4 py-3 text-[13px] font-semibold ${
                  status === "success"
                    ? "bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534]"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={status === "loading"}
                className="flex-1 py-3 rounded-[14px] border border-[#D7E0F5] bg-white text-[#313234] text-[14px] font-semibold hover:bg-[#F8FAFF] transition disabled:opacity-60"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={status === "loading"}
                className="flex-1 py-3 rounded-[14px] bg-[#306EEC] text-white text-[14px] font-semibold hover:bg-[#2557C7] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === "loading" ? "Saving…" : "Save Password"}
              </button>
            </div>
          </form>

          {/* Security tips */}
          <div className="mt-5 pt-5 border-t border-[#F0F4FF]">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] mb-2.5">
              Tips for a strong password
            </div>
            <ul className="space-y-1.5 text-[12px] text-[#6A6D71]">
              <li className="flex items-start gap-1.5">
                <span className="text-[#306EEC] mt-px">•</span>
                Use at least 10 characters with uppercase, numbers, and symbols
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#306EEC] mt-px">•</span>
                Avoid using the same password on multiple sites
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#306EEC] mt-px">•</span>
                Never share your password with anyone, including Fixter staff
              </li>
            </ul>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="mt-6 max-w-[480px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-red-400 mb-3">
            Danger Zone
          </div>
          <div className="bg-white border border-red-200 rounded-[18px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[14px] font-bold text-[#313234]">Delete Account</div>
                <div className="text-[12px] text-[#6A6D71] mt-0.5 leading-relaxed">
                  Permanently remove your account and all data.
                  Only available when you have no active subscription.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="flex-shrink-0 px-4 py-2 rounded-[12px] border border-red-300 bg-white text-red-600 text-[13px] font-semibold hover:bg-red-50 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete account modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          userEmail={user?.email || ""}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
}
