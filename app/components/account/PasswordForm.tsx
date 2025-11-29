"use client";

import { useState } from "react";
import axios from "axios";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    setMessage("");

    if (!currentPassword || !newPassword || !confirm) {
      setMessage("Please fill all fields.");
      return;
    }

    if (newPassword !== confirm) {
      setMessage("New passwords do not match.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
`${process.env.NEXT_PUBLIC_API_URL}/api/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Password update failed.";
      setMessage(msg);
    }
  };

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">
        Password
      </h2>

      <form className="space-y-6 sm:space-y-10" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base"
          />
        </div>

        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base"
          />
        </div>

        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            Confirm new Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base"
          />
        </div>

        {message && (
          <p className="text-sm text-red-600 font-medium">{message}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6 sm:pt-8">
          <button
            type="button"
            className="w-full sm:w-[350px] py-3 sm:py-4 bg-transparent border border-[#306EEC] text-[#313234] rounded-[14px] text-base sm:text-xl font-semibold"
            onClick={() => {
              setCurrentPassword("");
              setNewPassword("");
              setConfirm("");
            }}
          >
            Discard changes
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:w-[350px] py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
