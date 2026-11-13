"use client";

import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "@/app/components/admin/ui";
import type { DerivedStage } from "@/lib/admin/projects";

/*
 * The two project states, kept visibly different:
 *   stage   derived by the server from the documents (filled badge with icon)
 *   status  the owner's hand-set label (outlined, prefixed "Status")
 */
const STAGE_TONE: Record<string, StatusTone> = {
  lead: "neutral",
  proposal_issued: "attention",
  signed: "info",
  deposit_paid: "info",
  in_progress: "info",
  substantially_complete: "attention",
  paid_in_full: "success",
  warranty: "success",
  closed: "success",
  canceled: "neutral",
};

export function StageBadge({ stage }: { stage: DerivedStage | null | undefined }) {
  const key = stage?.key || "lead";
  return (
    <span data-stage={key} title="Stage, from the documents">
      <StatusBadge tone={STAGE_TONE[key] || "neutral"}>{stage?.label || "Lead"}</StatusBadge>
    </span>
  );
}

export function ManualStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return (
    <span
      data-manual-status={status}
      title="Status set by hand"
      className="inline-flex min-h-[24px] items-center rounded-full border border-adm-line-2 px-2 text-[12px] font-medium text-adm-text-2"
    >
      Status: {status}
    </span>
  );
}

export function AttentionBadge({ severity, children }: { severity: "attention" | "problem" | "info"; children: ReactNode }) {
  return (
    <span data-attention={severity}>
      <StatusBadge tone={severity === "problem" ? "problem" : severity === "attention" ? "attention" : "info"}>{children}</StatusBadge>
    </span>
  );
}
