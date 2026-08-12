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
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignTip,
  getTips,
  type PayPeriod,
  type TipTransaction,
  type TipsResponse,
} from "@/lib/admin-service";

const PERIOD_OPTIONS = [4, 8, 12, 26];

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);
}

/** Dates are plain YYYY-MM-DD business days, so they are read at midday UTC to
 *  keep the calendar day intact rather than shifting a period by one. */
function dayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function periodRange(period: PayPeriod | null) {
  if (!period) return "";
  return `${dayLabel(period.start)} - ${dayLabel(period.end)}`;
}

function todayNY() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function receivedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        emphasis ? "border-[#0B1628] bg-[#0B1628] text-white" : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
          emphasis ? "text-white/60" : "text-slate-400"
        }`}
      >
        {label}
      </div>
      <div className={`mt-1 text-2xl font-black ${emphasis ? "text-white" : "text-[#0B1628]"}`}>
        {value}
      </div>
      {hint ? (
        <div className={`mt-1 text-xs ${emphasis ? "text-white/70" : "text-slate-500"}`}>{hint}</div>
      ) : null}
    </div>
  );
}

function StatusPill({ tip }: { tip: TipTransaction }) {
  if (tip.status === "refunded") {
    return (
      <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">
        Refunded
      </span>
    );
  }
  if (tip.status === "partially_refunded") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
        Partly refunded
      </span>
    );
  }
  if (tip.status === "pending") {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
        Pending
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
      Received
    </span>
  );
}

function TransactionRow({ tip, showFixter }: { tip: TipTransaction; showFixter: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-sm">
      <div className="w-32 shrink-0 text-slate-500">{receivedLabel(tip.receivedAt)}</div>
      <div className="w-24 shrink-0 font-bold text-[#0B1628]">{money(tip.netCents)}</div>
      {showFixter ? (
        <div className="w-40 shrink-0 text-slate-700">
          {tip.fixterName || <span className="text-amber-700">Unassigned</span>}
        </div>
      ) : null}
      <div className="min-w-[10rem] flex-1 text-slate-600">
        {tip.tipperName || tip.tipperEmail || "Not provided"}
        {tip.bookingNumber ? (
          <span className="ml-2 text-slate-400">#{tip.bookingNumber}</span>
        ) : null}
      </div>
      <StatusPill tip={tip} />
    </div>
  );
}

export default function TipsModule() {
  const [data, setData] = useState<TipsResponse | null>(null);
  const [periods, setPeriods] = useState(8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  // True on the Friday the closing period is actually paid.
  const payingToday = !!data?.closingPeriod && data.closingPeriod.payday === todayNY();

  const handleAssign = async (tipId: string) => {
    const fixterId = choice[tipId] || "";
    if (!fixterId) return;
    setAssigning(tipId);
    setError("");
    try {
      await assignTip(tipId, fixterId);
      await load();
    } catch (caught) {
      const response = caught as { response?: { data?: { message?: string } } };
      setError(response.response?.data?.message || "Failed to assign this tip");
    } finally {
      setAssigning("");
    }
  };

  const ranked = useMemo(
    () => (data?.fixters || []).filter((row) => row.count > 0 || row.isActive),
    [data]
  );

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="mt-4 font-medium text-gray-600">Loading tips...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
        {error || "Failed to load tips"}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {data.truncated ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          More tips exist than one view sums. These totals are not complete.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#0B1628]">
          {isAdmin ? "Tips" : "Your tips"}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={periods}
            onChange={(event) => setPeriods(Number(event.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Last {option} pay periods
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* On Friday morning this is the cheque in your hand, so it leads. */}
        <StatCard
          label={payingToday ? "Paying today" : "Next cheque"}
          value={money(data.totals.closingPeriodCents)}
          hint={
            data.closingPeriod
              ? `${periodRange(data.closingPeriod)} · pays ${dayLabel(data.closingPeriod.payday)}`
              : undefined
          }
          emphasis
        />
        <StatCard
          label="Current pay period"
          value={money(data.totals.currentPeriodCents)}
          hint={
            data.currentPeriod
              ? `${periodRange(data.currentPeriod)} · pays ${dayLabel(data.currentPeriod.payday)}`
              : undefined
          }
        />
        <StatCard
          label="All time"
          value={money(data.totals.allTimeCents)}
          hint={`${data.totals.count} tip${data.totals.count === 1 ? "" : "s"}`}
        />
        {isAdmin ? (
          <StatCard
            label="Unassigned"
            value={money(data.unassignedTotals.allTimeCents)}
            hint={
              data.unassignedTotals.count
                ? `${data.unassignedTotals.count} waiting to be placed`
                : "Nothing waiting"
            }
          />
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-[#0B1628]">
          {isAdmin ? "By Fixter" : "Your pay periods"}
          <span className="ml-2 font-semibold text-slate-400">
            Friday to Thursday, paid the following Friday
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <th className="px-4 py-2">Fixter</th>
                {data.payPeriods.map((period) => (
                  <th key={period.start} className="px-4 py-2 text-right">
                    <div>{periodRange(period)}</div>
                    <div className="font-semibold normal-case tracking-normal text-slate-300">
                      pays {dayLabel(period.payday)}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2 text-right">All time</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr key={row.fixterId} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#0B1628]">{row.name}</div>
                    <div className="text-xs text-slate-400">
                      {row.position || "Fixter"}
                      {row.isActive ? "" : " · inactive"}
                    </div>
                  </td>
                  {data.payPeriods.map((period) => (
                    <td
                      key={period.start}
                      className={`px-4 py-3 text-right ${
                        row.byPeriod[period.start] ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      {money(row.byPeriod[period.start] || 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-black text-[#0B1628]">
                    {money(row.allTimeCents)}
                  </td>
                </tr>
              ))}
              {!ranked.length ? (
                <tr>
                  <td
                    colSpan={data.payPeriods.length + 2}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No tips yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && data.unassigned.length ? (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
            <div className="text-sm font-black text-amber-900">Unassigned tips</div>
            <p className="mt-1 text-xs text-amber-800">
              These arrived without Fixter context. They are never guessed at:
              place each one on the Fixter who earned it.
            </p>
          </div>
          {data.unassigned.map((tip) => (
            <div
              key={tip.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-amber-100 px-4 py-3 text-sm"
            >
              <div className="w-32 shrink-0 text-slate-500">
                {receivedLabel(tip.receivedAt)}
              </div>
              <div className="w-24 shrink-0 font-bold text-[#0B1628]">
                {money(tip.netCents)}
              </div>
              <div className="min-w-[10rem] flex-1">
                <div className="text-slate-700">
                  {tip.tipperName || tip.tipperEmail || "Not provided"}
                  {tip.bookingNumber ? (
                    <span className="ml-2 text-slate-400">#{tip.bookingNumber}</span>
                  ) : null}
                </div>
                {tip.unassignedReason ? (
                  <div className="text-xs text-amber-700">{tip.unassignedReason}</div>
                ) : null}
              </div>
              <select
                value={choice[tip.id] || ""}
                onChange={(event) =>
                  setChoice((current) => ({ ...current, [tip.id]: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Assign to...</option>
                {data.assignableFixters.map((fixter) => (
                  <option key={fixter.id} value={fixter.id}>
                    {fixter.name}
                    {fixter.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!choice[tip.id] || assigning === tip.id}
                onClick={() => void handleAssign(tip.id)}
                className="rounded-xl bg-[#0B1628] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {assigning === tip.id ? "Saving..." : "Assign"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-[#0B1628]">
          Transactions
        </div>
        {data.transactions.length ? (
          data.transactions.map((tip) => (
            <TransactionRow key={tip.id} tip={tip} showFixter={isAdmin} />
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            No tips yet.
          </div>
        )}
      </div>
    </div>
  );
}
