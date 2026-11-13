"use client";

import { ArrowRightStartOnRectangleIcon, KeyIcon, MapPinIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useRef, useState } from "react";
import API from "@/lib/api";
import { clearBrowserSession, revokeOnServer } from "@/lib/admin/session";
import { Button, ConfirmSheet, Field, Menu, Sheet, TextInput, getMapsApp, setMapsApp, useMapsApp, useToast } from "@/app/components/admin/ui";
import { useAdmin } from "./AdminContext";

function initials(name: string | undefined, email: string | undefined) {
  const source = String(name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Leave for the sign-in page with a fresh document (nothing of the session stays in memory). */
function leave() {
  clearBrowserSession();
  window.location.replace("/signin");
}

/**
 * The avatar in the header: who is signed in, Change password (moved out of
 * the primary header, audit E.1), the maps app for Directions, Sign out, and
 * Sign out of all devices.
 */
export function AccountMenu() {
  const { user } = useAdmin();
  const toast = useToast();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "password" | "everywhere">(null);
  const maps = useMapsApp();

  const signOut = async () => {
    await revokeOnServer("current");
    leave();
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Account: ${user.name || user.email || "signed in"}`}
        aria-haspopup="menu"
        className="adm-icon-btn"
        data-account-button=""
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-adm-ink text-[13px] font-semibold text-white">{initials(user.name, user.email)}</span>
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        title={user.name || user.email || "Account"}
        items={[
          { label: user.name || "Signed in", hint: user.email, icon: <ShieldCheckIcon />, disabled: true },
          { label: "Change password", icon: <KeyIcon />, onSelect: () => setSheet("password") },
          {
            label: `Directions open in ${maps === "apple" ? "Apple Maps" : maps === "google" ? "Google Maps" : "… (ask each time)"}`,
            hint: "Tap to switch, on this device",
            icon: <MapPinIcon />,
            onSelect: () => {
              const next = getMapsApp() === "google" ? "apple" : getMapsApp() === "apple" ? null : "google";
              setMapsApp(next);
              toast.show(next ? `Directions will open in ${next === "apple" ? "Apple" : "Google"} Maps` : "Directions will ask which maps app to use");
            },
          },
          { label: "Sign out", icon: <ArrowRightStartOnRectangleIcon />, onSelect: () => void signOut() },
          { label: "Sign out of all devices", icon: <ArrowRightStartOnRectangleIcon />, tone: "destructive", onSelect: () => setSheet("everywhere") },
        ]}
      />
      <ChangePasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} />
      <ConfirmSheet
        open={sheet === "everywhere"}
        onClose={() => setSheet(null)}
        title="Sign out of all devices?"
        consequence="Every phone and computer signed in to this account is signed out, this one included. You will need your password (or a sign-in code) on each of them again."
        confirmLabel="Sign out everywhere"
        tone="danger"
        closeOnSuccess={false}
        onConfirm={async () => {
          const result = await revokeOnServer("all");
          if (!result.serverConfirmed) {
            throw new Error(
              result.unsupported
                ? "The server cannot sign out other devices yet. Use Sign out here, and change your password to end the other sessions."
                : "The server could not be reached, so other devices are still signed in. Check the connection and try again."
            );
          }
          leave();
        }}
      />
    </>
  );
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const dirty = Boolean(current || next);

  const reset = () => {
    setCurrent("");
    setNext("");
    setErrors({});
  };

  const submit = async () => {
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password.";
    if (next.length < 8) found.next = "Use at least 8 characters.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await API.post("/api/auth/change-password", { currentPassword: current, newPassword: next });
      reset();
      onClose();
      toast.show("Password changed");
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors({ form: message || "The password was not changed. Check your current password and try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Change password"
      variant="dialog"
      dirty={dirty}
      busy={busy}
      footer={
        <Button large busy={busy} onClick={submit}>
          Change password
        </Button>
      }
    >
      <form
        id="adm-password-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Current password" error={errors.current}>
          <TextInput type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} enterKeyHint="next" />
        </Field>
        <Field label="New password" help="At least 8 characters." error={errors.next}>
          <TextInput type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} enterKeyHint="done" minLength={8} />
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] font-medium text-adm-problem">
            {errors.form}
          </p>
        )}
      </form>
    </Sheet>
  );
}
