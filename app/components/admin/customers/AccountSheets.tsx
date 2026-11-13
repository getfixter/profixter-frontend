"use client";

import { useRef, useState } from "react";
import { errorMessage } from "@/lib/admin/query";
import { blockCustomer, dateTime, unblockCustomer, type Block } from "@/lib/admin/customers";
import { Button, Field, Sheet, StatusBadge, Textarea } from "@/app/components/admin/ui";
import { Notice } from "./MembershipSheets";

/** The block history: every block and every lift, newest first, with who and why. */
export function BlockHistory({ history }: { history: Block[] }) {
  if (!history.length) return <p className="text-[14px] text-adm-text-3">Never blocked.</p>;
  return (
    <ol className="flex flex-col divide-y divide-adm-line" data-block-history="">
      {history.map((b) => (
        <li key={b.id} className="flex flex-col gap-1 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {b.active ? <StatusBadge tone="problem">Blocked</StatusBadge> : <StatusBadge tone="neutral">Lifted</StatusBadge>}
            <span className="text-[13px] text-adm-text-2">
              {dateTime(b.blockedAt)}
              {b.blockedByName ? ` · ${b.blockedByName}` : ""}
            </span>
          </div>
          {b.reason && <p className="text-[14px] text-adm-ink">Reason: {b.reason}</p>}
          {b.liftedAt && (
            <p className="text-[13px] text-adm-text-2">
              Unblocked {dateTime(b.liftedAt)}
              {b.liftedByName ? ` by ${b.liftedByName}` : ""}
              {b.liftReason ? `: ${b.liftReason}` : ""}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Block or unblock (audit C-03, F3). A block applies to the account, its
 * email and its phone, and the server enforces it at every booking, checkout
 * and gift entry point. Both directions need a reason; the history is kept.
 */
export function BlockSheet({
  open,
  onClose,
  mode,
  customerId,
  name,
  history,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  mode: "block" | "unblock";
  customerId: string;
  name: string;
  history: Block[];
  onDone: (message: string, history: Block[]) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const short = reason.trim().length < 3;

  const submit = async () => {
    if (short || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = mode === "block" ? await blockCustomer(customerId, reason.trim()) : await unblockCustomer(customerId, reason.trim());
      onDone(mode === "block" ? `${name || "Customer"} blocked` : `${name || "Customer"} unblocked`, Array.isArray(result?.history) ? result.history : history);
      onClose();
    } catch (err) {
      setError(errorMessage(err, mode === "block" ? "The block was not saved." : "The block was not lifted."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "block" ? `Block ${name || "this customer"}?` : `Unblock ${name || "this customer"}?`}
      busy={busy}
      dirty={reason.trim().length > 0}
      data-sheet={mode === "block" ? "block" : "unblock"}
      footer={
        <>
          <Button variant="secondary" large disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button large variant={mode === "block" ? "danger" : "primary"} busy={busy} disabled={short} onClick={submit} data-action={mode === "block" ? "confirm-block" : "confirm-unblock"}>
            {mode === "block" ? "Block customer" : "Unblock customer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-adm-ink">
          {mode === "block"
            ? "They will not be able to book, buy a membership, pay a link or claim a gift online, by this account, its email or its phone. They are told to call us. Nothing they already have is cancelled."
            : "They can book, buy and claim gifts online again. The block stays in their history."}
        </p>
        <Field label="Reason" required help={mode === "block" ? "Staff with block access see it. The customer does not." : "Recorded with the history."}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoCapitalize="sentences" data-input="block-reason" />
        </Field>
        {error && (
          <Notice tone="problem" role="alert">
            {error}
          </Notice>
        )}
        <div>
          <h3 className="mb-1 text-[13px] font-semibold text-adm-ink">History</h3>
          <BlockHistory history={history} />
        </div>
      </div>
    </Sheet>
  );
}
