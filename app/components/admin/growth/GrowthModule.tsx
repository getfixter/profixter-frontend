"use client";

/**
 * Growth Command Center - what the growth system is doing, and whether the
 * business can take more customers.
 *
 * Read top to bottom in thirty seconds: alerts, how full the calendar is,
 * what needs the owner, how far each automation is trusted, and what came of
 * it. Money and the funnel stay on the Overview tab so there is one definition
 * of revenue and conversion. Everything here comes from
 * /api/admin/growth/summary; deciding (approve, decline, trust level) is
 * owner-only on the server as well as here.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  decideAction,
  getCommandCenter,
  MODE_LABEL,
  pct,
  setPolicyMode,
  SKIP_REASON_LABEL,
  STATUS_LABEL,
  type CommandCenter,
  type GrowthActionView,
  type GrowthMode,
  type GrowthPolicyView,
  type VisibilityPart,
} from "@/lib/admin-growth";
import { useAuth } from "@/lib/useAuth";
import { isAdminUser } from "@/lib/auth-routing";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-slate-200/70 bg-white p-5 md:p-6 ${className}`}>{children}</section>;
}

function Title({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">{children}</h2>
      {aside}
    </div>
  );
}

function Pill({ tone, children }: { tone: "slate" | "blue" | "green" | "amber" | "rose"; children: ReactNode }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${tones[tone]}`}>{children}</span>;
}

const MODE_TONE: Record<GrowthMode, "slate" | "blue" | "green" | "amber"> = {
  off: "slate",
  shadow: "slate",
  supervised: "amber",
  autonomous: "green",
};

function when(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function actionOutcome(a: GrowthActionView) {
  if (a.status === "skipped" && a.result?.reason) return `Not sent: ${SKIP_REASON_LABEL[a.result.reason] || a.result.reason}`;
  if (a.status === "failed" && a.lastError) return a.lastError;
  if (a.status === "succeeded" && a.result?.to) return `Sent to ${a.result.to}`;
  return "";
}

/* ------------------------------------------------------------------ */

function CapacityCard({ data }: { data: CommandCenter["capacity"] }) {
  const u = data.utilization ?? null;
  const signal =
    data.signal === "near_full"
      ? { tone: "rose" as const, text: "Nearly full - hold paid acquisition or add a Fixter" }
      : data.signal === "room_to_grow"
      ? { tone: "green" as const, text: "Room for more customers" }
      : data.signal === "healthy"
      ? { tone: "blue" as const, text: "Healthy" }
      : { tone: "slate" as const, text: "Calendar not readable right now" };
  return (
    <Card>
      <Title aside={<Pill tone={signal.tone}>{signal.text}</Pill>}>Capacity, next {data.days || 21} days</Title>
      <div className="flex items-end gap-3">
        <div className="text-[40px] font-bold leading-none tracking-[-0.03em] text-slate-900">{pct(u)}</div>
        <div className="pb-1 text-[13px] text-slate-500">
          {data.booked ?? 0} of {data.capacity ?? 0} visit slots booked
        </div>
      </div>
      {data.weeks?.length ? (
        <div className="mt-5 space-y-2">
          {data.weeks.map((w) => (
            <div key={w.from} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 flex-none text-slate-500">Week of {w.from.slice(5).replace("-", "/")}</span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, Math.round((w.utilization || 0) * 100))}%` }}
                />
              </span>
              <span className="w-10 flex-none text-right font-semibold text-slate-700">{pct(w.utilization)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function PendingCard({ items, owner, onDecide, busy }: { items: GrowthActionView[]; owner: boolean; onDecide: (id: string, d: "approve" | "reject") => void; busy: string | null }) {
  return (
    <Card>
      <Title aside={items.length ? <Pill tone="amber">{items.length} waiting</Pill> : <Pill tone="green">Nothing waiting</Pill>}>Needs you</Title>
      {items.length === 0 ? (
        <p className="text-[14px] text-slate-500">Nothing needs a decision. Automations that are trusted run on their own.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-900">{a.summary}</div>
                <div className="mt-0.5 text-[13px] text-slate-500">
                  {a.rationale}
                  {a.heldReason === "daily_limit" ? " Held: today's limit for this automation was reached." : ""}
                  {a.heldReason === "interrupted" ? " The last run was interrupted - it may already have gone out." : ""}
                  {" · "}
                  {when(a.createdAt)}
                </div>
              </div>
              {owner ? (
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => onDecide(a.id, "approve")}
                    className="h-9 rounded-[10px] bg-slate-900 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => onDecide(a.id, "reject")}
                    className="h-9 rounded-[10px] bg-slate-100 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const MODE_ORDER: GrowthMode[] = ["off", "shadow", "supervised", "autonomous"];

function PoliciesCard({ policies, owner, onMode, busy }: { policies: GrowthPolicyView[]; owner: boolean; onMode: (type: string, mode: GrowthMode) => void; busy: string | null }) {
  return (
    <Card>
      <Title>Automations</Title>
      <ul className="space-y-4">
        {policies.map((p) => {
          const allowed = MODE_ORDER.slice(0, MODE_ORDER.indexOf(p.maxMode) + 1);
          const toGo = p.promoteAfter && p.mode === "supervised" ? Math.max(0, p.promoteAfter - p.streak) : null;
          return (
            <li key={p.type} className="rounded-[16px] bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[15px] font-semibold text-slate-900">{p.label}</div>
                <Pill tone={MODE_TONE[p.mode]}>{MODE_LABEL[p.mode]}</Pill>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">{p.description}</p>
              <div className="mt-2 text-[12px] text-slate-500">
                {toGo !== null
                  ? toGo === 0
                    ? "Will run on its own after the next verified run."
                    : `${toGo} more approved, verified run${toGo === 1 ? "" : "s"} until it runs on its own.`
                  : p.mode === "autonomous"
                  ? `Runs on its own${p.perDay ? `, up to ${p.perDay} a day` : ""}. Any failure sends it back to needing approval.`
                  : p.maxMode === "supervised"
                  ? "Always needs approval."
                  : ""}
                {p.setBy === "auto_promotion" ? ` Trusted automatically ${when(p.promotedAt)}.` : ""}
                {p.setBy === "auto_demotion" ? ` Sent back to approval ${when(p.demotedAt)}: ${p.setNote}` : ""}
              </div>
              {owner ? (
                <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`${p.label} mode`}>
                  {allowed.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={p.mode === m}
                      disabled={busy === p.type}
                      onClick={() => p.mode !== m && onMode(p.type, m)}
                      className={`h-8 rounded-[9px] px-3 text-[12px] font-semibold ${
                        p.mode === m ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                      }`}
                    >
                      {MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ActivityCard({ recent, shadow }: { recent: GrowthActionView[]; shadow: GrowthActionView[] }) {
  const rows = [...recent, ...shadow].sort((a, b) => +new Date(b.executedAt || b.createdAt) - +new Date(a.executedAt || a.createdAt)).slice(0, 15);
  return (
    <Card>
      <Title>What the system did</Title>
      {rows.length === 0 ? (
        <p className="text-[14px] text-slate-500">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-slate-800">{a.summary}</div>
                <div className="text-[12px] text-slate-500">
                  {when(a.executedAt || a.createdAt)}
                  {actionOutcome(a) ? ` · ${actionOutcome(a)}` : ""}
                  {a.decidedBy ? ` · approved by ${a.decidedBy}` : ""}
                </div>
              </div>
              <Pill tone={a.status === "failed" ? "rose" : a.status === "succeeded" ? "green" : "slate"}>{STATUS_LABEL[a.status] || a.status}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OutcomesCard({ data }: { data: CommandCenter }) {
  const r = data.outcomes.checkoutRecovery;
  return (
    <Card>
      <Title>Results</Title>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] bg-slate-50 p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Checkout reminders</div>
          <div className="mt-2 text-[28px] font-bold leading-none text-slate-900">
            {r.recovered}
            <span className="text-[16px] font-semibold text-slate-400"> / {r.sent}</span>
          </div>
          <div className="mt-1 text-[12px] text-slate-500">
            joined within {r.windowDays} days of the email (90 days){r.stillInWindow ? `; ${r.stillInWindow} still within the window` : ""}
          </div>
        </div>
        <div className="rounded-[14px] bg-slate-50 p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Out-of-area waitlist</div>
          <div className="mt-2 text-[28px] font-bold leading-none text-slate-900">{data.waitlist.waiting}</div>
          <div className="mt-1 text-[12px] text-slate-500">
            {data.waitlist.last30Days} in the last 30 days
            {data.waitlist.topZips.length
              ? ` · top: ${data.waitlist.topZips
                  .slice(0, 3)
                  .map((z) => `${z.zip} (${z.count})`)
                  .join(", ")}`
              : ""}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-slate-400">Joined after a reminder is not proof the reminder caused it; some would have come back anyway.</p>
    </Card>
  );
}

function part(p: VisibilityPart | undefined) {
  return p && p.available ? p : null;
}

function VisibilityCard({ data }: { data: CommandCenter["visibility"] }) {
  if (!data) return null;
  const reviews = part(data.reviews) as (VisibilityPart & { total?: number; rating?: number; per30Days?: number }) | null;
  const rank = part(data.localRank) as (VisibilityPart & { top3Share?: number; averageRank?: number }) | null;
  const ai = part(data.aiVisibility) as (VisibilityPart & { namedShare?: number; citedShare?: number }) | null;
  const search = part(data.search) as (VisibilityPart & { clicks?: number; impressions?: number }) | null;
  const tiles: Array<{ label: string; value: string; sub: string }> = [
    {
      label: "Google reviews",
      value: reviews?.total !== undefined ? String(reviews.total) : "—",
      sub: reviews ? `${reviews.rating ?? "—"}★${reviews.per30Days !== undefined ? ` · +${reviews.per30Days} per 30 days` : ""}` : data.reviews?.reason || "not connected",
    },
    {
      label: "Map pack (top 3)",
      value: rank ? pct(rank.top3Share ?? null) : "—",
      sub: rank ? `average position ${rank.averageRank ?? "—"}` : data.localRank?.reason || "not connected",
    },
    {
      label: "AI answers naming us",
      value: ai ? pct(ai.namedShare ?? null) : "—",
      sub: ai ? `cited ${pct(ai.citedShare ?? null)}` : data.aiVisibility?.reason || "not connected",
    },
    {
      label: "Search clicks (28d)",
      value: search?.clicks !== undefined ? String(search.clicks) : "—",
      sub: search ? `${search.impressions ?? "—"} impressions` : data.search?.reason || "not connected",
    },
  ];
  return (
    <Card>
      <Title>Visibility</Title>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[14px] bg-slate-50 p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t.label}</div>
            <div className="mt-2 text-[26px] font-bold leading-none text-slate-900">{t.value}</div>
            <div className="mt-1 text-[12px] text-slate-500">{t.sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export default function GrowthModule() {
  const { user } = useAuth();
  const owner = isAdminUser(user);
  const [data, setData] = useState<CommandCenter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getCommandCenter());
      setError(null);
    } catch {
      setError("The Command Center could not load. Try again in a moment.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    try {
      await decideAction(id, decision);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "That decision did not go through.");
    } finally {
      setBusy(null);
      load();
    }
  };

  const changeMode = async (type: string, mode: GrowthMode) => {
    setBusy(type);
    try {
      await setPolicyMode(type, mode);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "That change did not go through.");
    } finally {
      setBusy(null);
      load();
    }
  };

  if (!data && !error) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-48 animate-pulse rounded-[12px] bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[220px] animate-pulse rounded-[22px] bg-slate-100" />
          <div className="h-[220px] animate-pulse rounded-[22px] bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-slate-900">Growth</h1>
        {data ? (
          data.engineEnabled ? (
            <Pill tone="green">Automations live</Pill>
          ) : (
            <Pill tone="slate">Watching only - nothing is sent until automations are switched on</Pill>
          )
        ) : null}
      </div>

      {error ? <div className="rounded-[14px] bg-rose-50 px-4 py-3 text-[14px] text-rose-700">{error}</div> : null}

      {data?.alerts.length ? (
        <div className="space-y-2">
          {data.alerts.map((a) => (
            <div
              key={a.key}
              className={`rounded-[14px] px-4 py-3 text-[14px] ${a.level === "warning" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}
            >
              {a.text}
            </div>
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <CapacityCard data={data.capacity} />
            <PendingCard items={data.queue.pending} owner={owner} onDecide={decide} busy={busy} />
          </div>
          <VisibilityCard data={data.visibility} />
          <div className="grid gap-4 lg:grid-cols-2">
            <OutcomesCard data={data} />
            <PoliciesCard policies={data.policies} owner={owner} onMode={changeMode} busy={busy} />
          </div>
          <ActivityCard recent={data.queue.recent} shadow={data.queue.shadow} />
        </>
      ) : null}
    </div>
  );
}
