"use client";

/**
 * Tips, for the admin and for a Fixter.
 *
 * One component serves both, because the difference is what the server returns,
 * not what the screen can render. An admin gets every Fixter, the transaction
 * list and the unassigned pile; a Fixter gets their own row and their own
 * transactions. The scope arrives with the data and is never chosen here - a
 * client that decided its own scope would be a client that could change it.
 *
 * Every amount is a net figure in integer cents from the server: the tip less
 * anything refunded. Nothing is summed in the browser, so what a payout
 * conversation is based on is the same number on every screen.
 *
 * Layout: rows on phones and tablets (each Fixter opens to show their pay
 * periods), the period table only on wide screens (J.5: tables are desktop only).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { assignTip, getTips, type PayPeriod, type TipFixterRow, type TipTransaction, type TipsResponse } from "@/lib/admin-service";
import { arr, num, obj } from "@/lib/admin/sections-api";
import { Button, EmptyState, ErrorState, Field, Select, SkeletonRows, StatusBadge, cx } from "@/app/components/admin/ui";

const PERIOD_OPTIONS = [4, 8, 12, 26].map((n) => ({ value: String(n), label: `Last ${n} pay periods` }));

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num(cents) / 100);

/** Dates are plain YYYY-MM-DD business days, read at midday UTC so the day never shifts. */
const dayLabel = (day: string) => (day ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const periodRange = (p: PayPeriod | null) => (p ? `${dayLabel(p.start)} - ${dayLabel(p.end)}` : "");
const todayNY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

function receivedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Stat({ label, value, hint, lead = false }: { label: string; value: string; hint?: string; lead?: boolean }) {
  return (
    <div className={cx("min-w-0 rounded-adm-md border bg-adm-surface px-4 py-3", lead ? "border-adm-accent" : "border-adm-line")}>
      <div className="text-[13px] font-medium text-adm-text-2">{label}</div>
      <div className="adm-num mt-0.5 text-[22px] font-semibold text-adm-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-[12px] text-adm-text-3">{hint}</div> : null}
    </div>
  );
}

function TipStatus({ tip }: { tip: TipTransaction }) {
  if (tip.status === "refunded") return <StatusBadge tone="problem">Refunded</StatusBadge>;
  if (tip.status === "partially_refunded") return <StatusBadge tone="attention">Partly refunded</StatusBadge>;
  if (tip.status === "pending") return <StatusBadge tone="neutral">Pending</StatusBadge>;
  return <StatusBadge tone="success">Received</StatusBadge>;
}

function TransactionRow({ tip, showFixter }: { tip: TipTransaction; showFixter: boolean }) {
  return (
    <li className="flex min-w-0 items-start justify-between gap-3 border-b border-adm-line px-4 py-3 last:border-b-0" data-tip-row>
      <div className="min-w-0">
        <p className="adm-num text-[15px] font-semibold text-adm-ink">{money(tip.netCents)}</p>
        <p className="truncate text-[13px] text-adm-text-2">
          {tip.tipperName || tip.tipperEmail || "Not provided"}
          {tip.bookingNumber ? <span className="text-adm-text-3"> · #{tip.bookingNumber}</span> : null}
        </p>
        <p className="text-[12px] text-adm-text-3">
          {receivedLabel(tip.receivedAt)}
          {showFixter ? <> · {tip.fixterName || <span className="text-adm-attn">Unassigned</span>}</> : null}
        </p>
      </div>
      <TipStatus tip={tip} />
    </li>
  );
}

/** Phone and tablet: one row per Fixter that opens to their pay periods. */
function FixterRow({ row, periods }: { row: TipFixterRow; periods: PayPeriod[] }) {
  return (
    <li className="border-b border-adm-line last:border-b-0" data-fixter-tips>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-adm-ink">{row.name}</span>
            <span className="block text-[12px] text-adm-text-3">
              {row.position || "Fixter"}
              {row.isActive ? "" : " · inactive"} · next cheque {money(row.closingPeriodCents)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="adm-num text-[15px] font-semibold text-adm-ink">{money(row.allTimeCents)}</span>
            <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 text-adm-text-3 transition-transform group-open:rotate-90 motion-reduce:transition-none">
              <path d="M7 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>
        <ul className="border-t border-adm-line bg-adm-sunk px-4 py-1">
          {periods.map((p) => (
            <li key={p.start} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
              <span className="text-adm-text-2">
                {periodRange(p)} <span className="text-adm-text-3">· pays {dayLabel(p.payday)}</span>
              </span>
              <span className={cx("adm-num", num(row.byPeriod?.[p.start]) ? "font-semibold text-adm-ink" : "text-adm-text-3")}>{money(num(row.byPeriod?.[p.start]))}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export default function TipsModule() {
  const [data, setData] = useState<TipsResponse | null>(null);
  const [periods, setPeriods] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assigning, setAssigning] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getTips(periods));
    } catch {
      setError("Failed to load tips");
    } finally {
      setLoading(false);
    }
  }, [periods]);

  useEffect(() => {
     
    void load();
  }, [load]);

  const isAdmin = data?.scope === "admin";
  const payPeriods = arr<PayPeriod>(data?.payPeriods);
  const payingToday = !!data?.closingPeriod && data.closingPeriod.payday === todayNY();
  const ranked = useMemo(() => arr<TipFixterRow>(data?.fixters).filter((row) => row.count > 0 || row.isActive), [data]);
  const totals = obj(data?.totals);
  const unassignedTotals = obj(data?.unassignedTotals);
  const unassigned = arr<TipTransaction>(data?.unassigned);
  const transactions = arr<TipTransaction>(data?.transactions);

  const handleAssign = async (tipId: string) => {
    const fixterId = choice[tipId] || "";
    if (!fixterId) return;
    setAssigning(tipId);
    setAssignError("");
    try {
      await assignTip(tipId, fixterId);
      await load();
    } catch (caught) {
      setAssignError((caught as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to assign this tip");
    } finally {
      setAssigning("");
    }
  };

  if (loading && !data) return <SkeletonRows count={5} leading={false} label="Loading tips" />;
  if (!data) return <ErrorState message={error || "Failed to load tips"} onRetry={load} />;

  return (
    <div className="space-y-4" data-tips data-scope={data.scope}>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {data.truncated ? <p className="rounded-adm-sm bg-adm-attn-bg px-4 py-2 text-[14px] font-medium text-adm-attn">More tips exist than one view sums. These totals are not complete.</p> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-adm-ink">{isAdmin ? "All Fixters" : "Your tips"}</h2>
        <div className="flex items-end gap-2">
          <Field label="Range" className="min-w-[200px]">
            <Select value={String(periods)} options={PERIOD_OPTIONS} onChange={(e) => setPeriods(Number(e.target.value))} />
          </Field>
          <Button variant="secondary" onClick={load} busy={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {/* On Friday morning this is the cheque in your hand, so it leads. */}
        <Stat
          lead
          label={payingToday ? "Paying today" : "Next cheque"}
          value={money(num(totals.closingPeriodCents))}
          hint={data.closingPeriod ? `${periodRange(data.closingPeriod)} · pays ${dayLabel(data.closingPeriod.payday)}` : undefined}
        />
        <Stat
          label="Current pay period"
          value={money(num(totals.currentPeriodCents))}
          hint={data.currentPeriod ? `${periodRange(data.currentPeriod)} · pays ${dayLabel(data.currentPeriod.payday)}` : undefined}
        />
        <Stat label="All time" value={money(num(totals.allTimeCents))} hint={`${num(totals.count)} tip${num(totals.count) === 1 ? "" : "s"}`} />
        {isAdmin ? (
          <Stat
            label="Unassigned"
            value={money(num(unassignedTotals.allTimeCents))}
            hint={num(unassignedTotals.count) ? `${num(unassignedTotals.count)} waiting to be placed` : "Nothing waiting"}
          />
        ) : null}
      </div>

      <section className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-labelledby="tips-periods">
        <h3 id="tips-periods" className="border-b border-adm-line px-4 py-3 text-[15px] font-semibold text-adm-ink">
          {isAdmin ? "By Fixter" : "Your pay periods"}
          <span className="block text-[12px] font-normal text-adm-text-3">Friday to Thursday, paid the following Friday</span>
        </h3>
        {!ranked.length ? (
          <EmptyState message="No tips yet." />
        ) : (
          <>
            <ul role="list" className="lg:hidden" aria-label="Tips by Fixter">
              {ranked.map((row) => (
                <FixterRow key={row.fixterId} row={row} periods={payPeriods} />
              ))}
            </ul>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-[14px]" data-tips-table>
                <thead>
                  <tr className="text-left text-[12px] font-semibold text-adm-text-2">
                    <th className="px-4 py-2">Fixter</th>
                    {payPeriods.map((p) => (
                      <th key={p.start} className="px-3 py-2 text-right">
                        <div>{periodRange(p)}</div>
                        <div className="font-normal text-adm-text-3">pays {dayLabel(p.payday)}</div>
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right">All time</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((row) => (
                    <tr key={row.fixterId} className="border-t border-adm-line">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-adm-ink">{row.name}</div>
                        <div className="text-[12px] text-adm-text-3">
                          {row.position || "Fixter"}
                          {row.isActive ? "" : " · inactive"}
                        </div>
                      </td>
                      {payPeriods.map((p) => (
                        <td key={p.start} className={cx("adm-num px-3 py-2.5 text-right", num(row.byPeriod?.[p.start]) ? "text-adm-ink" : "text-adm-text-3")}>
                          {money(num(row.byPeriod?.[p.start]))}
                        </td>
                      ))}
                      <td className="adm-num px-4 py-2.5 text-right font-semibold text-adm-ink">{money(row.allTimeCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {isAdmin && unassigned.length ? (
        <section className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-labelledby="tips-unassigned" data-unassigned-tips>
          <div className="border-b border-adm-line bg-adm-attn-bg px-4 py-3">
            <h3 id="tips-unassigned" className="text-[15px] font-semibold text-adm-attn">
              Unassigned tips · {unassigned.length}
            </h3>
            <p className="mt-0.5 text-[13px] text-adm-attn">These arrived without Fixter context. They are never guessed at: place each one on the Fixter who earned it.</p>
          </div>
          {assignError ? (
            <p role="alert" className="bg-adm-problem-bg px-4 py-2 text-[14px] text-adm-problem">
              {assignError}
            </p>
          ) : null}
          <ul role="list">
            {unassigned.map((tip) => (
              <li key={tip.id} className="grid gap-2 border-b border-adm-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="adm-num text-[15px] font-semibold text-adm-ink">{money(tip.netCents)}</p>
                  <p className="truncate text-[13px] text-adm-text-2">
                    {tip.tipperName || tip.tipperEmail || "Not provided"}
                    {tip.bookingNumber ? <span className="text-adm-text-3"> · #{tip.bookingNumber}</span> : null}
                  </p>
                  <p className="text-[12px] text-adm-text-3">{receivedLabel(tip.receivedAt)}</p>
                  {tip.unassignedReason ? <p className="text-[12px] text-adm-attn">{tip.unassignedReason}</p> : null}
                </div>
                <Field label="Assign to">
                  <Select
                    value={choice[tip.id] || ""}
                    onChange={(e) => setChoice((current) => ({ ...current, [tip.id]: e.target.value }))}
                    options={[
                      { value: "", label: "Choose a Fixter" },
                      ...arr<{ id: string; name: string; isActive: boolean }>(data.assignableFixters).map((f) => ({ value: f.id, label: `${f.name}${f.isActive ? "" : " (inactive)"}` })),
                    ]}
                  />
                </Field>
                <Button disabled={!choice[tip.id]} busy={assigning === tip.id} onClick={() => handleAssign(tip.id)}>
                  Assign
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-labelledby="tips-tx">
        <h3 id="tips-tx" className="border-b border-adm-line px-4 py-3 text-[15px] font-semibold text-adm-ink">
          Transactions
        </h3>
        {transactions.length ? (
          <ul role="list">
            {transactions.map((tip) => (
              <TransactionRow key={tip.id} tip={tip} showFixter={isAdmin} />
            ))}
          </ul>
        ) : (
          <EmptyState message="No tips yet." />
        )}
      </section>
    </div>
  );
}
