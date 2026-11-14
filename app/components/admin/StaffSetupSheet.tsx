"use client";

import { useState } from "react";
import { Button, Sheet, StatusBadge } from "@/app/components/admin/ui";
import { newStaffSetupLink, sendStaffSetupInvite, type FixterAccount, type StaffSetupLink } from "@/lib/admin-service";

/*
 * Setting up a Telemarketer's account (BackEnd utils/auth/staffSetup.js).
 *
 * The account has no password. The owner copies a setup link or emails it,
 * and the employee opens it to choose their own password. A link works once
 * and expires. Every new link (copied or sent) replaces the previous one, so
 * the sheet says so before either action.
 *
 * The link is shown only right after it is created: the server keeps a hash,
 * not the link, so reopening the sheet later means making a new one.
 */

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
const errorMessage = (caught: unknown, fallback: string) => (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export function setupBadge(row: FixterAccount) {
  const s = row.setup;
  if (!s || s.state === "complete") return null;
  if (s.state === "link_active") return <StatusBadge tone="info">{s.lastSentAt ? "Invitation sent" : "Setup link ready"}</StatusBadge>;
  if (s.state === "expired") return <StatusBadge tone="attention">Setup link expired</StatusBadge>;
  return <StatusBadge tone="attention">Needs setup link</StatusBadge>;
}

export const needsSetup = (row: FixterAccount) => Boolean(row.setup && row.setup.state !== "complete");

export default function StaffSetupSheet({
  row,
  initialLink = null,
  justCreated = false,
  onClose,
  onChanged,
}: {
  row: FixterAccount;
  initialLink?: StaffSetupLink | null;
  justCreated?: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [link, setLink] = useState<StaffSetupLink | null>(initialLink);
  const [busy, setBusy] = useState<"" | "link" | "send">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [current, setCurrent] = useState<FixterAccount>(row);
  const first = row.firstName || row.name?.split(" ")[0] || "This employee";
  const s = current.setup && current.setup.state !== "complete" ? current.setup : null;
  const sent = Boolean(s?.lastSentAt);
  // Is there a link out there that a new one would kill?
  const liveElsewhere = Boolean(link) || s?.state === "link_active";

  const run = async (kind: "link" | "send") => {
    if (busy) return;
    setBusy(kind);
    setError("");
    setNotice("");
    setCopied(false);
    try {
      if (kind === "link") {
        const r = await newStaffSetupLink(row.id);
        setLink(r.setupLink);
        setCurrent(r.fixter);
        setNotice(liveElsewhere ? "New link ready. The previous link no longer works." : "Link ready. Copy it and send it to them yourself.");
      } else {
        const r = await sendStaffSetupInvite(row.id);
        setLink(r.setupLink);
        setCurrent(r.fixter);
        if (r.sent) setNotice(`Invitation emailed to ${r.sentTo}.${liveElsewhere ? " The previous link no longer works." : ""}`);
        else setError(r.message || "The email didn't go out. The link below works: copy it and send it yourself.");
      }
      await onChanged();
    } catch (caught) {
      setError(errorMessage(caught, "That didn't work. Try again."));
    } finally {
      setBusy("");
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.link);
      setCopied(true);
    } catch {
      // Clipboard blocked: select the text so Ctrl/Cmd+C works.
      const el = document.getElementById("staff-setup-link") as HTMLInputElement | null;
      el?.select();
      setError("Couldn't copy automatically. The link is selected: press Ctrl+C (or ⌘C).");
    }
  };

  return (
    <Sheet
      open
      onClose={() => (busy ? undefined : onClose())}
      busy={Boolean(busy)}
      title={`Set up ${first}'s account`}
      data-sheet="staff-setup"
      footer={
        <>
          <Button variant="secondary" large onClick={() => run("link")} busy={busy === "link"} disabled={Boolean(busy) || !s} data-setup-new-link>
            {link || s?.state === "link_active" ? "Copy a new link" : "Create link to copy"}
          </Button>
          <Button large onClick={() => run("send")} busy={busy === "send"} disabled={Boolean(busy) || !s} data-setup-send>
            {sent ? "Resend invitation" : "Send invitation email"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[14px] text-adm-text-2" data-staff-setup={row.id}>
        {justCreated ? <p className="rounded-adm-sm bg-adm-ok-bg px-3 py-2 text-adm-ok">{first}&apos;s account is created. Nothing has been sent yet.</p> : null}
        {!s ? (
          <p className="text-adm-ink" data-setup-complete>
            {first} has set up their password. Setup links are no longer needed.
          </p>
        ) : (
          <>
            <p className="text-adm-ink">
              {first} has no password yet. They open a setup link, choose their own password, and only then can use their workspace. A link works once and
              expires after 72 hours.
            </p>
            <p data-setup-state>
              {s.state === "link_active" && s.expiresAt ? `Current link expires ${when(s.expiresAt)}.` : s.state === "expired" ? "The last link has expired." : "No link has been created yet."}
              {s.lastSentAt ? ` Last emailed to ${s.lastSentTo} on ${when(s.lastSentAt)}.` : ""}
            </p>
            {liveElsewhere ? (
              <p className="rounded-adm-sm bg-adm-attn-bg px-3 py-2 text-adm-attn" data-setup-replaces>
                Copying a new link or sending an invitation replaces the current link. The old one stops working right away.
              </p>
            ) : null}
          </>
        )}

        {link && s ? (
          <div className="space-y-2" data-setup-link-box>
            <label htmlFor="staff-setup-link" className="block text-[13px] font-semibold text-adm-ink">
              Setup link for {current.email}
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                id="staff-setup-link"
                readOnly
                value={link.link}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 min-w-0 flex-1 rounded-adm-sm border border-adm-line-2 bg-adm-sunk px-3 font-mono text-[13px] text-adm-ink"
                data-setup-link
              />
              <Button variant="secondary" onClick={copy} data-setup-copy>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[13px]">
              Works once, until {when(link.expiresAt)}. Send it only to {first}: anyone with the link could set up the account. It can&apos;t be shown again after you
              close this.
            </p>
          </div>
        ) : null}

        {notice ? (
          <p role="status" className="rounded-adm-sm bg-adm-ok-bg px-3 py-2 text-adm-ok" data-setup-notice>
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-adm-problem" data-setup-error>
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
