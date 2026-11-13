"use client";

import { useState } from "react";
import { Sheet } from "@/app/components/admin/ui";
import { ChargeExtraStep } from "@/app/components/admin/jobs/ChargeExtra";
import { customerScope } from "@/lib/admin/extraCharges";

/**
 * Charge customer from the profile, with no booking (an emergency call-out,
 * anything not tied to a visit). The same one-screen flow as on a job: the
 * server decides who pays from this profile's stored account, shows its saved
 * card, and "Charge $X" charges. Nothing here creates or needs a booking.
 */
export function ChargeCustomerSheet({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Charge customer"
      busy={busy}
      dirty={dirty}
      discardMessage="Leave without charging?"
      data-sheet="charge-customer"
      footer={<div ref={setFooterEl} className="contents" data-step-footer="" />}
    >
      <ChargeExtraStep scope={customerScope(customerId)} footer={footerEl} onBack={onClose} setBusy={setBusy} setDirty={setDirty} />
    </Sheet>
  );
}
