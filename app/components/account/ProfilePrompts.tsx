"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import { readApiError, updateProfileName } from "@/lib/auth2";
import { useAddHome } from "@/app/components/address/AddHomeSheet";

/*
 * Progressive profile. Registration 2.0 asks for as little as possible, so the
 * account landing offers the missing pieces here, lightly. Neither card blocks
 * anything: the name card can be dismissed, the home card is optional.
 */

const CARD = "rounded-[14px] border border-[#E3E9F4] bg-white";
const NAME_DISMISS_KEY = "profixter:name-prompt-dismissed";

function readDismissed() {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(NAME_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function NamePromptCard() {
  const { user, updateUser, refreshUser } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user?.needsName || dismissed) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(NAME_DISMISS_KEY, "1");
    } catch {
      /* Private mode: it simply comes back next visit. */
    }
    setDismissed(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Enter the name you'd like us to use.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await updateProfileName(name);
      if (res?.user) updateUser(res.user);
      else await refreshUser().catch(() => null);
    } catch (err) {
      const parsed = readApiError(err);
      setError(
        parsed.code === "NETWORK"
          ? "We couldn't reach Profixter. Check your connection and try again."
          : parsed.message || "We couldn't save your name. Please try again."
      );
      setSaving(false);
    }
  };

  return (
    <section className={`${CARD} px-5 py-4 sm:px-6`} aria-labelledby="acct-name-prompt">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="acct-name-prompt" className="text-[16px] font-semibold tracking-[-0.01em] text-[#0B1628]">
            What should we call you?
          </h2>
          <p className="mt-0.5 text-[13.5px] text-[#64748B]">So your Fixter knows who to ask for.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] leading-none text-[#7C8899] hover:bg-[#F4F7FB] hover:text-[#0B1628]"
        >
          ×
        </button>
      </div>
      <form onSubmit={save} noValidate className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="acct-name-input" className="sr-only">
          Your name
        </label>
        <input
          id="acct-name-input"
          type="text"
          autoComplete="name"
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          placeholder="Your name"
          className="min-h-[42px] w-full rounded-[9px] border border-[#D5DEEF] bg-white px-3 text-[14px] text-[#0F172A] focus:border-[#306EEC] focus:outline-none focus:ring-2 focus:ring-[#306EEC]/25 sm:flex-1"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-[42px] shrink-0 rounded-[9px] bg-[#306EEC] px-5 text-[14px] font-semibold text-white hover:bg-[#2A5FD0] disabled:opacity-60"
        >
          {saving ? "Saving" : "Save"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-[13px] text-[#B91C1C]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function AddHomeCard({ hasHome }: { hasHome: boolean }) {
  const { homeSheet, requestHome } = useAddHome();
  /*
   * The sheet refreshes the user before it shows its "we don't serve this area
   * yet" notice, so hasHome flips while it is still open. Stay mounted until the
   * customer closes it, or the notice would vanish with the card.
   */
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = () => {
    setSheetOpen(true);
    void requestHome().finally(() => setSheetOpen(false));
  };

  if (hasHome) return sheetOpen ? <>{homeSheet}</> : null;

  return (
    <section className={`${CARD} px-5 py-4 sm:px-6`} aria-labelledby="acct-add-home">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h2 id="acct-add-home" className="text-[16px] font-semibold tracking-[-0.01em] text-[#0B1628]">
            Add your home
          </h2>
          <p className="mt-0.5 text-[13.5px] text-[#64748B]">
            Add it when you&apos;re ready to book. We&apos;ll check we serve your area.
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="min-h-[42px] shrink-0 rounded-[9px] border border-[#306EEC] bg-white px-5 text-[14px] font-semibold text-[#306EEC] hover:bg-[#F4F7FB]"
        >
          Add your home
        </button>
      </div>
      {homeSheet}
    </section>
  );
}
