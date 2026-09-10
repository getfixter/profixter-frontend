"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { issueGiftClaimLink } from "@/lib/gift-service";

/**
 * "Send it yourself" — the purchaser's copy of the claim link.
 *
 * THE LINK IS A CREDENTIAL, AND THIS TREATS IT AS ONE.
 *
 * It is fetched only when somebody presses the button, never on page load;
 * it is held in component state and never written to storage, a URL or a
 * log; and the copy button copies the whole thing while the screen shows a
 * shortened version, so a link on a shared screen is not a link in the room.
 *
 * WHY PRESSING IT REPLACES THE EMAILED LINK
 *
 * The server cannot read the emailed token back — only its hash is stored —
 * so a link to show has to be a new one, and issuing a new one supersedes
 * the old. That is a real consequence, so it is stated ABOVE the button
 * rather than in a toast afterwards: whoever presses it becomes the
 * delivery channel.
 *
 * Handing this to the purchaser does not weaken the claim. The recipient
 * still has to sign in with the address the gift was sent to; holding the
 * link has never been what proves who somebody is.
 */

type Props = {
  giftNumber: string;
  recipientFirstName?: string;
  /** Claimed gifts have nothing to invite anybody to. */
  claimed: boolean;
  /** The emailed invitation has passed its 90 day life. */
  invitationExpired?: boolean;
  className?: string;
};

function shorten(url: string) {
  /*
   * Enough to recognise it as the real gift link, not enough to retype from
   * a glance. The full string always goes to the clipboard.
   */
  try {
    const parsed = new URL(url);
    const token = parsed.pathname.split("/").filter(Boolean).pop() || "";
    return `${parsed.host}/gift/claim/${token.slice(0, 8)}…`;
  } catch {
    return `${url.slice(0, 34)}…`;
  }
}

export default function GiftClaimLink({
  giftNumber,
  recipientFirstName,
  claimed,
  invitationExpired = false,
  className = "",
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      /*
       * Clipboard blocked. Not an error worth showing: the full link is on
       * screen in a selectable field, so they can still take it.
       */
    }
  }, []);

  const getLink = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await issueGiftClaimLink(giftNumber);
      setUrl(result.claimUrl);
      await copy(result.claimUrl);
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: string }).message)
          : "";
      setError(message || "We could not prepare a link just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, copy, giftNumber]);

  /* Claimed. Say so, and offer nothing that looks like a working link. */
  if (claimed) {
    return (
      <div
        className={`rounded-[10px] border border-[#D8EAD9] bg-[#F2FAF3] px-4 py-3 ${className}`}
      >
        <p className="text-[14px] font-semibold text-[#1F5D2C]">
          {recipientFirstName ? `${recipientFirstName} claimed this gift` : "This gift was claimed"}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#3F6B48]">
          Nothing further to send. The membership is theirs now.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-[10px] border border-[#E0E6F5] bg-[#F8FAFF] px-4 py-4 ${className}`}>
      <p className="text-[14px] font-semibold text-[#313234]">Send it yourself</p>

      {invitationExpired ? (
        <p className="mt-1 text-[13px] leading-relaxed text-[#8A5A1E]">
          The link we emailed has expired. The gift itself is still valid — get a fresh link
          below and send it to {recipientFirstName || "them"}.
        </p>
      ) : (
        <p className="mt-1 text-[13px] leading-relaxed text-[#6A6D71]">
          We have emailed the invitation. If you would rather hand it over yourself, get a link
          below.
        </p>
      )}

      {url ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/*
              Readonly rather than plain text: it can be focused, selected and
              copied by hand when the clipboard API is unavailable.
            */}
            <input
              readOnly
              value={url}
              aria-label="Private gift claim link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-[8px] border border-[#D5DEEF] bg-white px-3 py-2 font-mono text-[12.5px] text-[#4A5568]"
            />
            <button
              type="button"
              onClick={() => copy(url)}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-[8px] bg-[#306EEC] px-4 text-[14px] font-semibold text-white transition hover:bg-[#2558C4]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p aria-hidden="true" className="mt-1.5 truncate text-[12px] text-[#8A8F98] sm:hidden">
            {shorten(url)}
          </p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#6A6D71]">
            Only share this private link with {recipientFirstName || "the person it is for"}. Any
            link we emailed earlier has now stopped working.
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={getLink}
            disabled={busy}
            className="mt-3 inline-flex min-h-[42px] items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-[14px] font-semibold text-white transition hover:bg-[#2558C4] disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Get gift link"}
          </button>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#6A6D71]">
            This creates a fresh private link and stops the emailed one from working, so you
            become the one delivering it.
          </p>
        </>
      )}

      {/* Announced politely; the visible states above carry the same words. */}
      <span className="sr-only" role="status">
        {copied ? "Gift link copied" : ""}
      </span>

      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[#B42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
