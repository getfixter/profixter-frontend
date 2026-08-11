"use client";

import type { SignatureMeta } from "@/lib/admin-service";

/**
 * Standing indicator of whether e-signature is ready to use.
 *
 * Part of the product, not a diagnostic: an administrator about to send a
 * contract needs to know at a glance whether signing will work and whether
 * status updates will come back on their own. It reads stored state only and
 * never triggers a provider call.
 */
export default function ESignStatusBadge({ meta }: { meta: SignatureMeta | null }) {
  if (!meta) return null;

  const webhookActive = meta.webhook?.state === "ACTIVE";

  const { tone, label, detail } = !meta.configured
    ? {
        tone: "border-slate-200 bg-slate-50 text-slate-600",
        label: "E-Signature unavailable",
        detail: "Adobe Acrobat Sign is not configured on the server.",
      }
    : !webhookActive
      ? {
          tone: "border-amber-200 bg-amber-50 text-amber-900",
          label: "E-Signature degraded",
          detail:
            meta.webhook?.lastError ||
            "Documents can be sent, but the status webhook is not active, so signature updates will not arrive on their own.",
        }
      : {
          tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
          label: "E-Signature ready",
          detail: `Adobe Acrobat Sign connected. Status updates active across ${meta.webhook?.eventCount ?? 0} events.`,
        };

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${tone}`}>
      <span className="font-black">{label}</span>
      <span className="ml-2 font-medium opacity-90">{detail}</span>
    </div>
  );
}
