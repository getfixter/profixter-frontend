"use client";

/**
 * The 30-second view: is Profixter gaining paying customers, at what cost,
 * with room in the calendar, and what is the AI operation costing.
 *
 * Numbers come from the same endpoints as the Overview (last 30 days) and the
 * Growth summary, so there is one definition of each. Anything not connected
 * says so instead of showing a zero.
 */

import { useEffect, useState } from "react";
import { getOverview, money, num, type Overview } from "@/lib/admin-overview";
import { getAgents, pct, type AgentsStatus, type CapacityOutlook } from "@/lib/admin-growth";

function Tile({ label, value, sub, tone = "slate" }: { label: string; value: string; sub: string; tone?: "slate" | "green" | "amber" }) {
  const ring = tone === "green" ? "ring-emerald-200" : tone === "amber" ? "ring-amber-200" : "ring-slate-200/70";
  return (
    <div className={`rounded-[18px] bg-white p-4 ring-1 ${ring}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-[26px] font-bold leading-none tracking-[-0.02em] text-slate-900">{value}</div>
      <div className="mt-1.5 text-[12px] leading-snug text-slate-500">{sub}</div>
    </div>
  );
}

function deltaText(d: { abs: number } | null | undefined) {
  if (!d || d.abs === 0) return "no change vs prior 30 days";
  return `${d.abs > 0 ? "+" : "−"}${num(Math.abs(d.abs))} vs prior 30 days`;
}

export default function HealthStrip({ capacity }: { capacity: CapacityOutlook | null }) {
  const [o, setO] = useState<Overview | null>(null);
  const [agents, setAgents] = useState<AgentsStatus | null>(null);

  useEffect(() => {
    getOverview({ range: "30d" }).then(setO).catch(() => setO(null));
    getAgents().then(setAgents).catch(() => setAgents(null));
  }, []);

  const k = o?.kpis;
  const spend = o?.spend;
  const newPaying = spend?.newPayingCustomers ?? null;
  const cac = spend?.connected && spend.totalCents != null && newPaying ? Math.round(spend.totalCents / newPaying) : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <Tile
        label="New paying customers"
        value={newPaying != null ? num(newPaying) : k ? num(k.newMembers.value) : "—"}
        sub={k ? `${num(k.newMembers.value)} new member${k.newMembers.value === 1 ? "" : "s"} · 30 days` : "loading"}
        tone="green"
      />
      <Tile label="Active members" value={k ? num(k.activeMembers.value) : "—"} sub={k ? deltaText(k.newMembers.delta) : "loading"} />
      <Tile label="MRR" value={k?.mrr.cents != null ? money(k.mrr.cents) : "—"} sub={k?.mrr.source === "stripe" ? "net of discounts, from Stripe" : "list price"} />
      <Tile
        label="Free visit → member"
        value={k?.conversion.rate != null ? `${Math.round(k.conversion.rate)}%` : "—"}
        sub={k ? `${k.conversion.converted} of ${k.conversion.completed} completed visits` : "loading"}
      />
      <Tile
        label="Cost per new customer"
        value={cac != null ? money(cac) : "—"}
        sub={spend?.connected ? "Meta spend ÷ new paying customers" : "Ad spend not connected yet"}
        tone={spend?.connected ? "slate" : "amber"}
      />
      <Tile
        label="Calendar, next 21 days"
        value={capacity?.utilization != null ? pct(capacity.utilization) : "—"}
        sub={capacity?.capacity ? `${capacity.booked} of ${capacity.capacity} visit slots booked` : "calendar unavailable"}
        tone={capacity?.signal === "near_full" ? "amber" : "slate"}
      />
      <Tile
        label="AI operations, this month"
        value={agents ? money(Math.round(agents.spentThisMonthCents)) : "—"}
        sub={
          agents
            ? agents.enabled
              ? `of ${money(agents.monthlyBudgetCents)} cap · metered`
              : agents.keyConfigured
              ? "agents switched off"
              : "waiting for the Claude API key"
            : "loading"
        }
        tone={agents?.enabled ? "green" : "amber"}
      />
    </div>
  );
}
