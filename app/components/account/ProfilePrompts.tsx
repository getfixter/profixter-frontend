"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import { readApiError, updateProfileName } from "@/lib/auth2";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { buttonClass } from "@/app/components/ui/Button";

/*
 * Progressive profile. Registration 2.0 asks for as little as possible, so the
 * account landing offers the missing pieces here, lightly. Neither card blocks
 * anything: the name card can be dismissed, the home card is optional.
 */

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
    <section className="acct-card" aria-labelledby="acct-name-prompt" data-acct-prompt="name">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="acct-name-prompt" className="acct-card__title">
            What should we call you?
          </h2>
          <p className="acct-card__text !mt-1">So your Fixter knows who to ask for.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--ui-text-3)] hover:bg-[color:var(--ui-bg-soft)] hover:text-[color:var(--ui-ink)]"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
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
          className="acct-select sm:flex-1"
        />
        <button type="submit" disabled={saving} className={buttonClass({ variant: "secondary", className: "shrink-0 disabled:opacity-60" })}>
          {saving ? "Saving" : "Save"}
        </button>
      </form>
      {error ? (
        <p className="acct-error" role="alert">
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
    <section className="acct-card" aria-labelledby="acct-add-home" data-acct-prompt="home">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h2 id="acct-add-home" className="acct-card__title">
            Add your home
          </h2>
          <p className="acct-card__text !mt-1">
            Optional for now. Add it when you&apos;re ready to book, and we&apos;ll check we serve your area.
          </p>
        </div>
        <button type="button" onClick={open} className={buttonClass({ variant: "secondary", size: "sm", className: "shrink-0" })}>
          Add your home
        </button>
      </div>
      {homeSheet}
    </section>
  );
}
