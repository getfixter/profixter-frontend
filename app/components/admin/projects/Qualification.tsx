"use client";

import type { Qualification } from "@/lib/admin/projects";
import { answerLabel, estimateRange, formatAnswer } from "@/lib/admin/leads";

const GROUP_LABELS: Record<string, string> = { roof: "Roof", bathroom: "Bathroom", kitchen: "Kitchen" };

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 border-b border-adm-line py-2 last:border-b-0">
      <dt className="text-[13px] text-adm-text-3">{label}</dt>
      <dd className="min-w-0 break-words text-[14px] text-adm-ink">{value}</dd>
    </div>
  );
}

/**
 * Everything the homeowner answered, as they answered it (the server copies
 * the answers verbatim; nothing is recalculated). The price range is the one
 * the estimate builder showed them.
 */
export function QualificationView({ q, title = "What the homeowner told us" }: { q: Qualification | null | undefined; title?: string }) {
  if (!q) return null;
  const range = estimateRange(q.estimateLow ?? null, q.estimateHigh ?? null);
  const groups = Object.entries(q.answers || {}).filter(([, answers]) => answers && Object.keys(answers).length);
  const any = q.serviceLabel || q.budgetRange || q.timeline || q.financing || range || groups.length || q.notes || q.contactPref || q.bestTime;
  if (!any) return null;
  return (
    <section className="rounded-adm-md border border-adm-line bg-adm-surface p-4" data-qualification="">
      <h3 className="text-[15px] font-semibold text-adm-ink">{title}</h3>
      <dl className="mt-2">
        <Row label="Service" value={q.serviceLabel || q.service || ""} />
        <Row label="Price range shown" value={range} />
        <Row label="Budget" value={q.budgetRange || ""} />
        <Row label="Timeline" value={q.timeline || ""} />
        <Row label="Financing" value={q.financing || ""} />
        <Row label="Contact by" value={q.contactPref || ""} />
        <Row label="Best time" value={q.bestTime || ""} />
        <Row label="Requested day" value={[q.requestedDate, q.requestedTime].filter(Boolean).join(" ")} />
        <Row label="Came from" value={[q.sourcePage, q.leadSource].filter(Boolean).join(" · ")} />
      </dl>
      {groups.map(([group, answers]) => (
        <div key={group} className="mt-3" data-answers={group}>
          <h4 className="text-[13px] font-semibold text-adm-ink">{GROUP_LABELS[group] || answerLabel(group)}</h4>
          <dl className="mt-1">
            {Object.entries(answers).map(([field, value]) => (
              <Row key={field} label={answerLabel(field.replace(new RegExp(`^${group}`, "i"), "") || field)} value={formatAnswer(value)} />
            ))}
          </dl>
        </div>
      ))}
      {q.notes && (
        <div className="mt-3">
          <h4 className="text-[13px] font-semibold text-adm-ink">Their words</h4>
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-adm-ink">{q.notes}</p>
        </div>
      )}
    </section>
  );
}
