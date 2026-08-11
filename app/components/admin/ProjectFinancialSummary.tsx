"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getProjectFinancials,
  type ProjectFinancials,
} from "@/lib/admin-service";

/**
 * One project, one financial story.
 *
 * Every figure comes from /api/admin/projects/:id/financials. Nothing here is
 * calculated in the browser - not even the obvious subtractions - because the
 * backend owns which invoices count as billed and which change orders count as
 * approved, and a second opinion in the UI is how those quietly diverge.
 *
 * Three ideas the layout has to keep apart:
 *   approved   what the customer has agreed to pay
 *   invoiced   what we have asked them for
 *   paid       what has arrived
 * Pending change orders are none of those, so they are visually separated
 * rather than merely labelled.
 */

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100);
}

function signedMoney(cents: number) {
  const value = Number(cents || 0);
  const body = money(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function Row({
  label,
  value,
  tone = "normal",
  hint,
}: {
  label: string;
  value: string;
  tone?: "normal" | "strong" | "muted" | "positive" | "negative";
  hint?: string;
}) {
  const valueTone =
    tone === "strong"
      ? "text-slate-950 text-lg font-black"
      : tone === "muted"
        ? "text-slate-500 font-semibold"
        : tone === "positive"
          ? "text-emerald-700 font-bold"
          : tone === "negative"
            ? "text-rose-700 font-bold"
            : "text-slate-900 font-bold";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <span className={`text-sm ${tone === "muted" ? "text-slate-500" : "text-slate-600"}`}>
          {label}
        </span>
        {hint ? <p className="text-[11px] leading-4 text-slate-400">{hint}</p> : null}
      </div>
      <span className={`shrink-0 tabular-nums ${valueTone}`}>{value}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <div className="mt-2 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

export function ProjectFinancialSummaryView({
  financials,
  compact = false,
}: {
  financials: ProjectFinancials;
  compact?: boolean;
}) {
  const { totals, agreement, changeOrders } = financials;
  const hasPending = totals.pendingChangeOrderCents !== 0;
  const overInvoiced = totals.overInvoicedCents > 0;

  if (compact) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
          <Row label="Current Agreement Value" value={money(totals.approvedAgreementCents)} tone="strong" />
          <Row label="Previously invoiced" value={money(totals.invoicedCents)} />
          <Row label="Paid" value={money(totals.paidCents)} tone="positive" />
          <Row label="Outstanding" value={money(totals.outstandingInvoicedCents)} />
          <Row
            label="Approved, not yet invoiced"
            value={money(totals.uninvoicedApprovedCents)}
            tone={totals.uninvoicedApprovedCents > 0 ? "normal" : "muted"}
          />
          {hasPending ? (
            <Row
              label="Pending change orders"
              value={`${signedMoney(totals.pendingChangeOrderCents)} projected`}
              tone="muted"
              hint="Not approved. Not billable."
            />
          ) : null}
        </div>
        {overInvoiced ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            Already invoiced {money(totals.overInvoicedCents)} above the approved Agreement value.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agreement && !agreement.isBinding ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Agreement #{agreement.contractNumber} is still a {agreement.status.toLowerCase()}. Its price is
          not approved value until the Agreement is issued.
        </p>
      ) : null}

      {overInvoiced ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          Over-invoiced by {money(totals.overInvoicedCents)}. This project has been billed more than the
          approved Agreement value. Execute a Change Order if the extra work was agreed.
        </p>
      ) : null}

      {financials.otherAgreementNumbers.length > 0 && agreement ? (
        <p className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This summary covers Agreement #{agreement.contractNumber}. This project also has{" "}
          {financials.otherAgreementNumbers.map((number) => `#${number}`).join(", ")}, whose change orders
          are not included above.
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Agreement">
          <Row label="Original Agreement" value={money(totals.originalAgreementCents)} />
          <Row
            label={`Executed change orders${totals.executedChangeOrderCount ? ` (${totals.executedChangeOrderCount})` : ""}`}
            value={signedMoney(totals.executedChangeOrderCents)}
            tone={totals.executedChangeOrderCents < 0 ? "negative" : "normal"}
          />
          <Row label="Current Agreement Value" value={money(totals.approvedAgreementCents)} tone="strong" />
        </Panel>

        <Panel title="Billing">
          <Row label="Invoiced" value={money(totals.invoicedCents)} />
          <Row label="Paid" value={money(totals.paidCents)} tone="positive" />
          <Row
            label="Outstanding"
            value={money(totals.outstandingInvoicedCents)}
            tone={totals.outstandingInvoicedCents > 0 ? "strong" : "muted"}
          />
        </Panel>

        <Panel title="Still to bill">
          <Row
            label="Approved, not yet invoiced"
            value={money(totals.uninvoicedApprovedCents)}
            tone={totals.uninvoicedApprovedCents > 0 ? "strong" : "muted"}
          />
          {hasPending ? (
            <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Projected only</p>
              <Row
                label={`Pending change orders (${totals.pendingChangeOrderCount})`}
                value={signedMoney(totals.pendingChangeOrderCents)}
                tone="muted"
              />
              <Row
                label="Projected Agreement Value"
                value={money(totals.projectedAgreementCents)}
                tone="muted"
                hint="Not agreed. Not billable until executed."
              />
            </div>
          ) : (
            <p className="py-1.5 text-xs text-slate-400">No change orders awaiting signature.</p>
          )}
        </Panel>
      </div>

      {(agreement || changeOrders.executed.length > 0) && (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Where these numbers come from
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            {agreement?.estimate ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-600">
                  Estimate {agreement.estimate.estimateNumber}
                  {agreement.estimate.title ? ` - ${agreement.estimate.title}` : ""}
                </span>
                <span className="tabular-nums font-semibold text-slate-500">
                  {money(agreement.estimate.totalCents)} estimated
                </span>
              </div>
            ) : null}
            {agreement ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-600">
                  Agreement #{agreement.contractNumber} (v{agreement.version}, {agreement.status})
                </span>
                <span className="tabular-nums font-bold text-slate-900">
                  {money(totals.originalAgreementCents)}
                </span>
              </div>
            ) : (
              <p className="text-slate-500">No Agreement on this project yet.</p>
            )}
            {changeOrders.executed.map((changeOrder) => (
              <div
                key={changeOrder.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2"
              >
                <span className="text-slate-600">
                  {changeOrder.changeOrderNumber}
                  {changeOrder.title ? ` - ${changeOrder.title}` : ""}
                </span>
                <span
                  className={`tabular-nums font-bold ${
                    changeOrder.netAdjustmentCents < 0 ? "text-rose-700" : "text-slate-900"
                  }`}
                >
                  {signedMoney(changeOrder.netAdjustmentCents)}
                </span>
              </div>
            ))}
            {changeOrders.pending.map((changeOrder) => (
              <div
                key={changeOrder.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-2"
              >
                <span className="text-slate-500">
                  {changeOrder.changeOrderNumber}
                  {changeOrder.title ? ` - ${changeOrder.title}` : ""} ({changeOrder.status})
                </span>
                <span className="tabular-nums font-semibold text-slate-500">
                  {signedMoney(changeOrder.netAdjustmentCents)} projected
                </span>
              </div>
            ))}
            {financials.invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={invoice.countsTowardInvoiced ? "text-slate-600" : "text-slate-400"}>
                  Invoice #{invoice.invoiceNumber} ({invoice.status})
                  {invoice.countsTowardInvoiced ? "" : " - not counted"}
                </span>
                <span
                  className={`tabular-nums font-semibold ${
                    invoice.countsTowardInvoiced ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {money(invoice.invoiceTotalCents)}
                  {invoice.paidCents > 0 ? ` - ${money(invoice.paidCents)} paid` : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Loads the summary itself. Use where the parent has no financials to hand. */
export default function ProjectFinancialSummary({
  projectId,
  compact = false,
  refreshToken,
}: {
  projectId: string;
  compact?: boolean;
  refreshToken?: number;
}) {
  const [financials, setFinancials] = useState<ProjectFinancials | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFinancials(await getProjectFinancials(projectId));
      setError("");
    } catch {
      setError("Could not load the project financial summary.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  if (loading && !financials) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Loading project financials...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        {error}
      </div>
    );
  }
  if (!financials) return null;

  return <ProjectFinancialSummaryView financials={financials} compact={compact} />;
}
