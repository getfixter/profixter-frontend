"use client";

/**
 * Admin Overview - the business at a glance.
 *
 * Level 1 is this page: big numbers, a few charts, nothing tiny. Level 2 is the
 * drawer that opens from any number. Level 3 is the customer's own record.
 * Every figure comes from /api/admin/overview for one date range; changing the
 * range keeps the current frame (dimmed) instead of flashing skeletons.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  getOverview,
  getOverviewList,
  customerHref,
  money,
  num,
  planLabel,
  shortDate,
  ymdLabel,
  type ActivityItem,
  type CampaignNode,
  type SourceGroup,
  type SourceRow,
  type Delta,
  type Overview,
  type RangeKey,
  type RangeQuery,
} from "@/lib/admin-overview";
import { ColumnChart, DataTable, Legend, LineChart, SERIES } from "./charts";
import { useAuth } from "@/lib/useAuth";
import { can, PERM } from "@/lib/admin-access";
import MaybeLink from "./MaybeLink";
import OverviewDrawer, { type DrawerState } from "./OverviewDrawer";
import CustomerMap from "./CustomerMap";

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "month", label: "This Month" },
  { key: "lastmonth", label: "Last Month" },
  { key: "custom", label: "Custom" },
];
const PLAN_RAMP: Record<string, string> = { basic: "#86b6ef", plus: "#3987e5", premium: "#1c5cab", elite: "#0d366b" };
const RANGE_STORE = "pf_overview_range";

/* ------------------------------------------------------------------ */
/* Little pieces                                                       */
/* ------------------------------------------------------------------ */

function Card({ children, className = "", onClick, label }: { children: ReactNode; className?: string; onClick?: () => void; label?: string }) {
  const base = "ov-card rounded-[22px] border border-slate-200/70 bg-white p-5 md:p-6";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className={`${base} ov-card--click w-full text-left ${className}`}>
        {children}
      </button>
    );
  }
  return <section className={`${base} ${className}`}>{children}</section>;
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[18px] font-bold tracking-[-0.02em] text-slate-900 md:text-[20px]">{children}</h2>
      {aside}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, size = "sm" }: { value: T; options: Array<{ key: T; label: string }>; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-[12px] bg-slate-100 p-1 [scrollbar-width:none]" role="group">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={`flex-none rounded-[9px] font-semibold transition ${size === "md" ? "h-9 px-3.5 text-[13px]" : "h-8 px-3 text-[12px]"} ${
            value === o.key ? "bg-white text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.10)]" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Direction x whether up is good -> colour. Never colour alone: the arrow and words carry it too. */
function DeltaChip({ d, invert = false, suffix = "vs previous period", absolute = false, format }: { d: Delta; invert?: boolean; suffix?: string; absolute?: boolean; format?: (n: number) => string }) {
  if (!d) return <span className="text-[12px] text-slate-400">No comparison yet</span>;
  if (d.abs === 0) return <span className="text-[12px] text-slate-400">No change {suffix}</span>;
  const up = d.abs > 0;
  const good = invert ? !up : up;
  const value = absolute || d.pct === null ? `${up ? "+" : "−"}${format ? format(Math.abs(d.abs)) : num(Math.abs(d.abs))}` : `${Math.abs(d.pct)}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${good ? "text-emerald-700" : "text-rose-600"}`}>
      <span aria-hidden="true">{up ? "↑" : "↓"}</span>
      {value}
      <span className="font-normal text-slate-400">
        <span className="sm:hidden">{suffix === "vs previous period" ? "vs prev." : suffix}</span>
        <span className="hidden sm:inline">{suffix}</span>
      </span>
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
  onClick,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: ReactNode;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <Card onClick={onClick} label={`${label}: ${value}`} className={accent ? "ring-1 ring-blue-500/25 bg-gradient-to-br from-blue-50/70 to-white" : ""}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="ov-num mt-2 text-[34px] font-bold leading-none tracking-[-0.03em] text-slate-900 md:text-[38px]">{value}</div>
      {sub ? <div className="mt-2 text-[13px] text-slate-500">{sub}</div> : null}
      {delta ? <div className="mt-2">{delta}</div> : null}
    </Card>
  );
}

function bucketLabel(key: string, granularity: string) {
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  }
  return ymdLabel(key);
}

function prevLabel(o: Overview) {
  const prevToInclusive = new Date(new Date(o.period.prevTo).getTime() - 1).toISOString();
  return `${shortDate(o.period.prevFrom)} – ${shortDate(prevToInclusive)}`;
}

function relTime(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const day = d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  if (day === today) return time;
  const y = new Date(Date.now() - 86400000).toLocaleDateString("en-US", { timeZone: "America/New_York" });
  if (day === y) return `Yesterday ${time}`;
  return shortDate(iso);
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export default function OverviewModule() {
  /*
   * Overview access is not customer access. The map needs Customer Map, and a
   * name only links to the customer's record for someone who has All Users.
   * The server enforces both; this only avoids offering what would be refused.
   */
  const { user } = useAuth();
  const canMap = can(user, PERM.ANALYTICS_MAP);
  const linkCustomers = can(user, PERM.CUSTOMERS_MANAGE);
  const [query, setQuery] = useState<RangeQuery>({ range: "30d" });
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [growthMetric, setGrowthMetric] = useState<"active" | "new" | "canceled">("active");
  const [growthSpan, setGrowthSpan] = useState<"year" | "period">("year");
  const [revenueSpan, setRevenueSpan] = useState<"period" | "year">("period");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RANGE_STORE) || "null") as RangeQuery | null;
      if (saved?.range && saved.range !== "custom") setQuery({ range: saved.range });
    } catch {
      /* first visit */
    }
  }, []);

  /*
   * Only the latest request may update the page: a slow answer for a range the
   * admin has already moved away from is dropped. Every request ends (the API
   * client has a timeout), so the skeleton always gives way to numbers or to
   * a message with Try again.
   */
  const seq = useRef(0);
  const load = useCallback(async (q: RangeQuery) => {
    const id = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const next = await getOverview(q);
      if (id === seq.current) setData(next);
    } catch (e) {
      if (id !== seq.current) return;
      const err = e as { response?: { status?: number }; code?: string };
      const status = err?.response?.status;
      setError(
        status === 403
          ? "Your account does not have access to Overview."
          : err?.code === "ECONNABORTED"
            ? "Overview took too long to answer. Try again."
            : "Overview couldn't load. Try again in a moment."
      );
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  /* Right after a deploy, revenue is still arriving from Stripe: check again on its own, a few times. */
  const syncChecks = useRef(0);
  const revenueSyncing = !!data?.kpis.revenue.syncing;
  useEffect(() => {
    if (!revenueSyncing || syncChecks.current >= 8) return;
    const t = setTimeout(() => {
      syncChecks.current += 1;
      void load(query);
    }, 15000);
    return () => clearTimeout(t);
  }, [revenueSyncing, data, query, load]);

  useEffect(() => {
    void load(query);
    try {
      localStorage.setItem(RANGE_STORE, JSON.stringify({ range: query.range }));
    } catch {
      /* fine */
    }
  }, [query, load]);

  const pickRange = (key: RangeKey) => {
    if (key === "custom") {
      const to = data?.period.toYmd || new Date().toISOString().slice(0, 10);
      const from = data?.period.fromYmd || to;
      setCustomFrom(from);
      setCustomTo(to);
      setQuery({ range: "custom", from, to });
      return;
    }
    setQuery({ range: key });
  };

  const openList = useCallback(
    async (metric: string, title: string, opts: { param?: string; showConverted?: boolean } = {}) => {
      const subtitle = data ? `${data.period.label} · ${ymdLabel(data.period.fromYmd)} – ${ymdLabel(data.period.toYmd)}` : undefined;
      setDrawer({ kind: "list", title, subtitle, loading: true, rows: [], showConverted: opts.showConverted });
      try {
        const list = await getOverviewList({ ...query, metric, param: opts.param });
        setDrawer({ kind: "list", title: list.title || title, subtitle, loading: false, rows: list.rows, showConverted: opts.showConverted });
      } catch {
        setDrawer({ kind: "list", title, subtitle, loading: false, rows: [], error: "This list couldn't load." });
      }
    },
    [query, data]
  );

  if (!data && loading) return <Skeleton />;
  if (!data) {
    return (
      <Card>
        <p className="text-[15px] text-slate-600">{error || "Overview couldn't load."}</p>
        <button type="button" onClick={() => void load(query)} className="mt-4 h-10 rounded-full bg-slate-900 px-5 text-[14px] font-semibold text-white">
          Try again
        </button>
      </Card>
    );
  }

  const k = data.kpis;
  const rev = k.revenue;

  return (
    <div className="ov-root pb-10">
      {/* ============================ Header ============================ */}
      <header className="mb-5 md:mb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-bold leading-none tracking-[-0.035em] text-slate-900 md:text-[38px]">Overview</h2>
            <p className="mt-2 text-[13px] text-slate-500">
              {data.period.label} · {ymdLabel(data.period.fromYmd)}
              {data.period.fromYmd !== data.period.toYmd ? ` – ${ymdLabel(data.period.toYmd)}` : ""}
              <span className="text-slate-400"> · Compared with {prevLabel(data)}</span>
            </p>
          </div>
          {loading ? <span className="text-[12px] font-semibold text-slate-400">Updating…</span> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Seg value={query.range} options={RANGES} onChange={pickRange} size="md" />
          {query.range === "custom" ? (
            <div className="flex items-center gap-2 text-[13px]">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-[10px] border border-slate-200 bg-white px-2 text-slate-800"
                aria-label="From"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-[10px] border border-slate-200 bg-white px-2 text-slate-800"
                aria-label="To"
              />
              <button
                type="button"
                disabled={!customFrom || !customTo || customFrom > customTo}
                onClick={() => setQuery({ range: "custom", from: customFrom, to: customTo })}
                className="h-9 rounded-[10px] bg-slate-900 px-3 font-semibold text-white disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-3 text-[13px] text-rose-600">
            {error} Showing the last numbers that loaded.{" "}
            <button type="button" onClick={() => void load(query)} className="font-semibold underline underline-offset-2">
              Try again
            </button>
          </p>
        ) : null}
      </header>

      <div className={`space-y-4 transition-opacity duration-300 md:space-y-5 ${loading ? "opacity-60" : "opacity-100"}`}>
        {/* ========================== Snapshot =========================== */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <Kpi
            label="Active members"
            value={num(k.activeMembers.value)}
            sub={[
              `${num(k.activeMembers.paying)} paying`,
              k.activeMembers.comped ? `${num(k.activeMembers.comped)} comped` : "",
              k.activeMembers.gifts ? `${num(k.activeMembers.gifts)} gift` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
            delta={<DeltaChip d={k.activeMembers.delta} absolute suffix={`since ${shortDate(data.period.from)}`} />}
            onClick={() => openList("activeMembers", "Active members")}
          />
          <Kpi
            label="New members"
            value={num(k.newMembers.value)}
            sub={k.cancellations.value ? `${num(k.cancellations.value)} canceled` : "No cancellations"}
            delta={<DeltaChip d={k.newMembers.delta} absolute />}
            onClick={() => openList("newMembers", "New members")}
          />
          <Kpi
            label="New customers"
            value={num(k.newCustomers.value)}
            sub={`${num(k.totalCustomers.value)} customers in total`}
            delta={<DeltaChip d={k.newCustomers.delta} absolute />}
            onClick={() => openList("newCustomers", "New customers")}
          />
          <Kpi
            label="Revenue"
            value={rev.available ? money(rev.totalCents) : "—"}
            sub={
              rev.available && rev.stale
                ? `Stripe sync delayed · may miss payments after ${rev.syncedAt ? new Date(rev.syncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "the last sync"}`
                : rev.available
                ? rev.taxCents
                  ? `Net of refunds · plus ${money(rev.taxCents)} sales tax`
                  : "Memberships + visits, net of refunds"
                : rev.syncing
                  ? "Loading from Stripe…"
                  : rev.error || "Unavailable"
            }
            delta={rev.available ? <DeltaChip d={rev.delta} /> : undefined}
            onClick={() => setDrawer({ kind: "custom", title: "Revenue", subtitle: data.period.label, body: <RevenueBreakdown o={data} /> })}
          />
          <Kpi
            label="Free Visits"
            value={num(k.freeVisits.booked)}
            sub={`${num(k.freeVisits.completed)} completed · ${num(k.freeVisits.upcoming)} upcoming`}
            delta={<DeltaChip d={k.freeVisits.delta} absolute />}
            onClick={() => openList("freeVisits", "Free Visits booked", { showConverted: true })}
          />
          <Kpi
            accent
            label="Free Visit → Member"
            value={k.conversion.rate === null ? "—" : `${Math.round(k.conversion.rate)}%`}
            sub={k.conversion.completed ? `${num(k.conversion.converted)} of ${num(k.conversion.completed)} completed visits became members` : "No completed Free Visits yet"}
            delta={
              k.conversion.rate !== null && k.conversion.prevRate !== null ? (
                <DeltaChip d={{ abs: Math.round((k.conversion.rate - k.conversion.prevRate) * 10) / 10, pct: null }} absolute format={(n) => `${n} pts`} />
              ) : undefined
            }
            onClick={() => openList("conversions", "Completed Free Visits", { showConverted: true })}
          />
        </div>

        {/* ===================== Growth + Revenue ======================== */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <GrowthCard o={data} metric={growthMetric} setMetric={setGrowthMetric} span={growthSpan} setSpan={setGrowthSpan} />
          <RevenueCard o={data} span={revenueSpan} setSpan={setRevenueSpan} onRetry={() => void load(query)} />
        </div>

        {/* ====================== Funnel + Plans ========================= */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <FunnelCard o={data} onOpen={openList} />
          <PlansCard o={data} onOpen={openList} />
        </div>

        {/* ===================== Free Visits + One-Time ================== */}
        <VisitsCard o={data} onOpen={openList} />

        {/* ====================== Acquisition ============================= */}
        <AcquisitionCard o={data} onOpen={openList} setDrawer={setDrawer} />

        {/* ======================== Map ================================== */}
        <Card>
          <SectionTitle>{canMap ? "Customer map" : "Customer areas"}</SectionTitle>
          <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${canMap ? "xl:grid-cols-[minmax(0,1fr)_260px]" : ""}`}>
            {canMap ? (
              <CustomerMap periodFrom={data.period.from} periodTo={data.period.to} cityFilter={cityFilter} onClearCity={() => setCityFilter(null)} linkCustomers={linkCustomers} />
            ) : null}
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Top customer areas</div>
              {data.topAreas.length ? (
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.topAreas.map((a) => (
                    <li key={a.city}>
                      <button
                        type="button"
                        onClick={() => setCityFilter(cityFilter === a.city ? null : a.city)}
                        className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-2 py-2.5 text-left transition hover:bg-slate-50 ${cityFilter === a.city ? "bg-blue-50" : ""}`}
                      >
                        <span className="text-[14px] font-semibold text-slate-800">{a.city}</span>
                        <span className="text-right text-[12px] text-slate-500">
                          <b className="text-[14px] text-slate-900">{a.customers}</b> customers
                          {a.members ? ` · ${a.members} members` : ""}
                          {a.newInPeriod ? <span className="text-emerald-700"> · +{a.newInPeriod}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-slate-500">No addresses yet.</p>
              )}
            </div>
          </div>
        </Card>

        {/* ================== Activity + Needs attention ================= */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ActivityCard items={data.activity} linkCustomers={linkCustomers} />
          {data.attention.length ? (
            <Card>
              <SectionTitle>Needs attention</SectionTitle>
              <ul className="space-y-2">
                {data.attention.map((a) => (
                  <li key={a.key}>
                    <button
                      type="button"
                      onClick={() => openList("attention", a.text, { param: a.key })}
                      className={`flex w-full items-start gap-3 rounded-[14px] border px-4 py-3 text-left transition hover:shadow-sm ${
                        a.tone === "critical" ? "border-rose-200 bg-rose-50/60" : a.tone === "warning" ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      <span aria-hidden="true" className={`mt-0.5 text-[15px] ${a.tone === "critical" ? "text-rose-600" : a.tone === "warning" ? "text-amber-600" : "text-blue-600"}`}>
                        {a.tone === "critical" ? "!" : "•"}
                      </span>
                      <span className="text-[14px] leading-5 text-slate-800">{a.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <p className="px-1 text-[12px] leading-5 text-slate-400">
          Members count one membership per home (paid or gift). Revenue is successful Stripe payments after coupons, net of refunds, without sales tax, excluding projects and tips. MRR is what active memberships bill per month after the discounts still running, before tax (annual ÷ 12); full price is shown beside it. Sources are each customer&rsquo;s first marketing touch. Times are New York.
        </p>
      </div>

      <OverviewDrawer state={drawer} onClose={() => setDrawer(null)} linkCustomers={linkCustomers} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

type OpenList = (metric: string, title: string, opts?: { param?: string; showConverted?: boolean }) => void;

function GrowthCard({
  o,
  metric,
  setMetric,
  span,
  setSpan,
}: {
  o: Overview;
  metric: "active" | "new" | "canceled";
  setMetric: (m: "active" | "new" | "canceled") => void;
  span: "year" | "period";
  setSpan: (s: "year" | "period") => void;
}) {
  const series = o.growth[span];
  const points = series.points.map((p) => ({ label: bucketLabel(p.key, series.granularity), value: p[metric] }));
  const name = metric === "active" ? "Active members" : metric === "new" ? "New members" : "Cancellations";
  return (
    <Card>
      <SectionTitle aside={<Seg value={span} options={[{ key: "year", label: "12 months" }, { key: "period", label: "This period" }]} onChange={setSpan} />}>
        Membership growth
      </SectionTitle>
      <div className="mb-3">
        <Seg
          value={metric}
          options={[
            { key: "active", label: "Members" },
            { key: "new", label: "New members" },
            { key: "canceled", label: "Cancellations" },
          ]}
          onChange={setMetric}
        />
      </div>
      <LineChart points={points} format={(v) => num(Math.round(v))} label={name} color={metric === "canceled" ? "#e34948" : SERIES.blue} />
      <DataTable head={["Period", name]} rows={points.map((p) => [p.label, num(p.value)])} />
    </Card>
  );
}

function RevenueCard({ o, span, setSpan, onRetry }: { o: Overview; span: "period" | "year"; setSpan: (s: "period" | "year") => void; onRetry: () => void }) {
  const rev = o.kpis.revenue;
  const series = o.revenueSeries?.[span];
  const points = series ? series.points.map((p) => ({ label: bucketLabel(p.key, series.granularity), values: [p.membershipCents, p.visitCents] })) : [];
  return (
    <Card>
      <SectionTitle aside={<Seg value={span} options={[{ key: "period", label: "This period" }, { key: "year", label: "12 months" }]} onChange={setSpan} />}>Revenue</SectionTitle>
      {!rev.available ? (
        <div className="rounded-[14px] bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">
          <p>{rev.error || "Revenue is unavailable right now."}</p>
          {rev.syncing ? (
            <p className="mt-1 text-[12px] text-slate-400">This page checks again by itself.</p>
          ) : (
            <button type="button" onClick={onRetry} className="mt-2 font-semibold text-slate-900 underline underline-offset-2">
              Try again
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <Figure label="Membership" value={money(rev.membershipCents + rev.giftCents, { compact: true })} />
            <Figure label="Visits" value={money(rev.oneTimeCents + rev.fullDayCents, { compact: true })} />
            <Figure label="Total" value={money(rev.totalCents, { compact: true })} strong />
          </div>
          <ColumnChart
            points={points}
            series={[
              { label: "Membership", color: SERIES.blue },
              { label: "Visits", color: SERIES.orange },
            ]}
            format={(v) => money(v, { compact: true })}
          />
          <div className="mt-2">
            <Legend items={[{ label: "Membership", color: SERIES.blue }, { label: "One-Time & Full Day visits", color: SERIES.orange }]} />
          </div>
          <DataTable head={["Period", "Membership", "Visits"]} rows={points.map((p) => [p.label, money(p.values[0]), money(p.values[1])])} />
        </>
      )}
      <MrrPanel o={o} onRetry={onRetry} />
    </Card>
  );
}

/*
 * Three numbers that are never mixed: net MRR (what active memberships bill
 * per month after the discounts still running), the same memberships at full
 * price, and the discount between them. From Stripe; if Stripe did not answer,
 * only the list-price figure is shown, labelled as such.
 */
function MrrPanel({ o, onRetry }: { o: Overview; onRetry: () => void }) {
  const mrr = o.kpis.mrr;
  if (mrr.source !== "stripe" || mrr.cents === null) {
    return (
      <div className="mt-4 rounded-[16px] bg-slate-50 px-4 py-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Monthly recurring revenue</div>
        <p className="mt-1 text-[14px] text-slate-600">{mrr.error || "Recurring revenue is unavailable right now."}</p>
        <p className="mt-1 text-[12px] text-slate-500">
          At full price: {money(mrr.fullPriceCents)}/mo (before any discounts).{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-slate-900 underline underline-offset-2">
            Try again
          </button>
        </p>
      </div>
    );
  }
  const extras = [
    mrr.compedMembers ? `${num(mrr.compedMembers)} comped (100% off)` : "",
    mrr.discountedMembers ? `${num(mrr.discountedMembers)} on a discount` : "",
    mrr.endingMembers ? `${num(mrr.endingMembers)} ending (${money(mrr.endingCents)})` : "",
    mrr.pastDueMembers ? `${num(mrr.pastDueMembers)} past due` : "",
  ].filter(Boolean);
  return (
    <div className="mt-4 rounded-[16px] bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Monthly recurring revenue</div>
          <div className="mt-1 text-[26px] font-bold tracking-[-0.03em] text-slate-900">{money(mrr.cents)}</div>
        </div>
        <div className="text-right text-[12px] leading-5 text-slate-500">
          <div>
            Full price {money(mrr.fullPriceCents)}
            {mrr.discountCents ? <span className="text-slate-400"> · discounts −{money(mrr.discountCents)}</span> : null}
          </div>
          <div>{num(mrr.payingMembers)} paying · after discounts, before tax</div>
        </div>
      </div>
      {extras.length ? <p className="mt-2 text-[12px] text-slate-500">{extras.join(" · ")}</p> : null}
    </div>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-[14px] px-3 py-2.5 ${strong ? "bg-slate-900 text-white" : "bg-slate-50"}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${strong ? "text-white/60" : "text-slate-400"}`}>{label}</div>
      <div className={`mt-1 text-[20px] font-bold tracking-[-0.02em] ${strong ? "text-white" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

function RevenueBreakdown({ o }: { o: Overview }) {
  const r = o.kpis.revenue;
  const rows: Array<[string, number]> = [
    ["Memberships", r.membershipCents],
    ["Gift memberships", r.giftCents],
    ["One-Time Visits", r.oneTimeCents],
    ["Full Day Visits", r.fullDayCents],
  ];
  return (
    <div>
      <dl className="divide-y divide-slate-100">
        {rows.map(([label, cents]) => (
          <div key={label} className="flex justify-between py-3 text-[15px]">
            <dt className="text-slate-600">{label}</dt>
            <dd className="font-semibold text-slate-900">{money(cents)}</dd>
          </div>
        ))}
        <div className="flex justify-between py-3 text-[16px]">
          <dt className="font-semibold text-slate-900">Revenue</dt>
          <dd className="font-bold text-slate-900">{money(r.totalCents)}</dd>
        </div>
        <div className="flex justify-between py-3 text-[15px]">
          <dt className="text-slate-600">Sales tax collected</dt>
          <dd className="font-semibold text-slate-900">{money(r.taxCents)}</dd>
        </div>
        <div className="flex justify-between py-3 text-[15px]">
          <dt className="text-slate-600">Collected, tax included</dt>
          <dd className="font-semibold text-slate-900">{money(r.collectedCents)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px] leading-5 text-slate-500">
        Successful Stripe payments after coupons, net of {money(r.refundedCents)} refunded. Sales tax is owed to the state, so it is not revenue. Failed payments,
        projects and tips are not included.
        {r.otherCents ? ` ${money(r.otherCents)} could not be classified and is shown nowhere else.` : ""}
        {r.syncedAt ? ` Stripe data as of ${new Date(r.syncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}${r.stale ? " - the sync is delayed, so recent payments may be missing" : ""}.` : ""}
      </p>
    </div>
  );
}

function FunnelCard({ o, onOpen }: { o: Overview; onOpen: OpenList }) {
  const f = o.funnel;
  const trackedSince = f.visitorsTrackingSince ? new Date(f.visitorsTrackingSince) : null;
  const visitorsPartial = !trackedSince || trackedSince > new Date(o.period.from);
  const steps = [
    { label: "Visitors", value: f.visitors, note: visitorsPartial ? (trackedSince ? `counting since ${shortDate(f.visitorsTrackingSince)}` : "counting starts with this release") : "", metric: "" },
    { label: "Registered", value: f.registered, metric: "newCustomers" },
    { label: "Free Visit booked", value: f.freeVisitBooked, metric: "freeVisits" },
    { label: "Free Visit completed", value: f.freeVisitCompleted, metric: "conversions" },
    { label: "Became members", value: f.members, metric: "newMembers" },
  ];
  const top = Math.max(1, ...steps.map((s) => s.value));
  return (
    <Card>
      <SectionTitle>Customer funnel</SectionTitle>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : null;
          const rate = prev ? Math.round((s.value / prev) * 1000) / 10 : null;
          return (
            <li key={s.label}>
              {i > 0 ? (
                <div className="py-0.5 pl-3 text-[11px] font-semibold text-slate-400">
                  ↓ {rate === null || (i === 1 && visitorsPartial) ? "—" : `${rate}%`}
                </div>
              ) : null}
              <button
                type="button"
                disabled={!s.metric}
                onClick={() => s.metric && onOpen(s.metric, s.label, { showConverted: s.metric === "conversions" || s.metric === "freeVisits" })}
                className="group flex w-full items-center gap-3 rounded-[12px] px-1 py-1 text-left enabled:hover:bg-slate-50"
              >
                <span className="w-[132px] flex-none text-[13px] font-semibold text-slate-700 md:w-[160px]">{s.label}</span>
                <span className="relative h-8 flex-1 overflow-hidden rounded-[8px] bg-slate-50">
                  <span
                    className="ov-bar absolute inset-y-0 left-0 rounded-[8px]"
                    style={{ width: `${Math.max(2, (s.value / top) * 100)}%`, background: ["#b7d3f6", "#86b6ef", "#3987e5", "#256abf", "#104281"][i] }}
                  />
                </span>
                <span className="w-[64px] flex-none text-right text-[16px] font-bold tabular-nums text-slate-900">{num(s.value)}</span>
              </button>
              {s.note ? <div className="pl-1 text-[11px] text-slate-400">{s.note}</div> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function PlansCard({ o, onOpen }: { o: Overview; onOpen: OpenList }) {
  const total = o.plans.reduce((s, p) => s + p.active, 0);
  const max = Math.max(1, ...o.plans.map((p) => p.active));
  return (
    <Card>
      <SectionTitle aside={<span className="text-[13px] text-slate-500">{num(total)} active</span>}>Memberships</SectionTitle>
      {total ? (
        <div className="mb-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
          {o.plans.filter((p) => p.active).map((p, i, arr) => (
            <span key={p.plan} style={{ width: `${(p.active / total) * 100}%`, background: PLAN_RAMP[p.plan], marginRight: i < arr.length - 1 ? 2 : 0 }} />
          ))}
        </div>
      ) : null}
      <ul className="space-y-1">
        {o.plans.map((p) => (
          <li key={p.plan}>
            <button type="button" onClick={() => onOpen("plan", `${planLabel(p.plan)} members`, { param: p.plan })} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left hover:bg-slate-50">
              <span className="h-3 w-3 flex-none rounded-[4px]" style={{ background: PLAN_RAMP[p.plan] }} />
              <span className="w-[72px] flex-none text-[15px] font-semibold text-slate-900">{planLabel(p.plan)}</span>
              <span className="hidden h-2 flex-1 overflow-hidden rounded-full bg-slate-100 sm:block">
                <span className="ov-bar block h-full rounded-full" style={{ width: `${(p.active / max) * 100}%`, background: PLAN_RAMP[p.plan] }} />
              </span>
              <span className="flex-1 text-right sm:flex-none sm:w-[64px]">
                <b className="text-[18px] tabular-nums text-slate-900">{num(p.active)}</b>
                <span className="ml-1 text-[11px] text-slate-400">{p.share !== null ? `${Math.round(p.share)}%` : ""}</span>
              </span>
              <span className="w-[86px] flex-none text-right text-[12px] leading-4 text-slate-500">
                <span className="block font-semibold text-slate-700">+{money(p.mrrCents)}/mo</span>
                <span className="block">
                  {p.newInPeriod ? <span className="text-emerald-700">+{p.newInPeriod}</span> : "+0"}
                  {" · "}
                  {p.canceledInPeriod ? <span className="text-rose-600">−{p.canceledInPeriod}</span> : "−0"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-slate-400">+new · −canceled this period. Gift memberships count as members and add no MRR.</p>
    </Card>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="rounded-[14px] bg-slate-50 px-3 py-3 text-left enabled:hover:bg-slate-100">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-1 text-[22px] font-bold tabular-nums tracking-[-0.02em] text-slate-900">{value}</div>
    </button>
  );
}

function VisitsCard({ o, onOpen }: { o: Overview; onOpen: OpenList }) {
  const fv = o.kpis.freeVisits;
  const c = o.kpis.conversion;
  const ot = o.kpis.oneTime;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <SectionTitle aside={<span className="text-[13px] font-semibold text-blue-700">{c.rate === null ? "—" : `${Math.round(c.rate * 10) / 10}%`} convert</span>}>Free Visits</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Booked" value={num(fv.booked)} onClick={() => onOpen("freeVisits", "Free Visits booked", { showConverted: true })} />
          <Stat label="Upcoming" value={num(fv.upcoming)} />
          <Stat label="Completed" value={num(fv.completed)} onClick={() => onOpen("conversions", "Completed Free Visits", { showConverted: true })} />
          <Stat label="Canceled" value={num(fv.canceled)} />
          <Stat label="No-show" value={fv.noShowTracked ? num(fv.noShow) : "—"} />
          <Stat label="Became members" value={num(c.converted)} onClick={() => onOpen("conversions", "Completed Free Visits", { showConverted: true })} />
        </div>
        {!fv.noShowTracked ? <p className="mt-3 text-[12px] text-slate-400">No-shows aren&rsquo;t recorded in Profixter yet, so they can&rsquo;t be counted.</p> : null}
      </Card>
      <Card>
        <SectionTitle>One-Time Visits</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Booked" value={num(ot.booked)} onClick={() => onOpen("oneTime", "One-Time Visits", { showConverted: true })} />
          <Stat label="Revenue" value={o.kpis.revenue.available ? money(ot.revenueCents) : "—"} />
          <Stat label="Completed" value={num(ot.completed)} />
          <Stat label="Became members" value={num(ot.converted)} onClick={() => onOpen("oneTime", "One-Time Visits", { showConverted: true })} />
        </div>
        <p className="mt-3 text-[12px] text-slate-400">
          {num(ot.canceled)} canceled · Full Day: {num(ot.fullDayBooked)} booked{o.kpis.revenue.available ? `, ${money(ot.fullDayRevenueCents)}` : ""}
        </p>
      </Card>
    </div>
  );
}

function SourceCells({ r, revenue }: { r: { visitors: number; registrations: number; freeVisits: number; members: number; conversion: number | null; revenueCents: number }; revenue: boolean }) {
  return (
    <>
      <td className="px-2 py-2.5 text-right text-[14px] tabular-nums text-slate-600">{num(r.visitors)}</td>
      <td className="px-2 py-2.5 text-right text-[14px] font-semibold tabular-nums text-slate-900">{num(r.registrations)}</td>
      <td className="px-2 py-2.5 text-right text-[14px] tabular-nums text-slate-600">{num(r.freeVisits)}</td>
      <td className="px-2 py-2.5 text-right text-[14px] font-semibold tabular-nums text-slate-900">{num(r.members)}</td>
      <td className="px-2 py-2.5 text-right text-[13px] tabular-nums text-slate-500">{r.conversion === null ? "—" : `${r.conversion}%`}</td>
      <td className="px-2 py-2.5 text-right text-[14px] tabular-nums text-slate-900">{revenue ? money(r.revenueCents) : "—"}</td>
    </>
  );
}

/*
 * One line per acquisition source, by first touch. Meta Ads is a total line
 * with Facebook, Instagram and Other Meta under it: the split comes from the
 * placement Meta writes into utm_source, never from fbclid alone.
 */
function AcquisitionCard({ o, onOpen, setDrawer }: { o: Overview; onOpen: OpenList; setDrawer: (d: DrawerState) => void }) {
  const groups = o.sourceGroups || [];
  const rows = [...o.sources];
  const maxRegs = Math.max(1, ...rows.map((r) => r.registrations), ...groups.map((g) => g.registrations));
  const revenue = o.kpis.revenue.available;
  const openCampaigns = () =>
    setDrawer({ kind: "custom", title: "Meta Ads campaigns", subtitle: `${o.period.label} · by first touch`, body: <CampaignTree campaigns={o.campaigns} spend={o.spend.connected} onOpen={onOpen} /> });
  /* Ungrouped sources and group totals, ordered by registrations; a group's members follow it. */
  type Line = { kind: "group"; g: SourceGroup } | { kind: "source"; r: SourceRow; child: boolean };
  const tops: Array<{ regs: number; rev: number; lines: Line[] }> = [];
  for (const g of groups) {
    const members = rows.filter((r) => r.group === g.key);
    tops.push({ regs: g.registrations, rev: g.revenueCents, lines: [{ kind: "group", g }, ...members.map((r) => ({ kind: "source" as const, r, child: true }))] });
  }
  for (const r of rows.filter((x) => !x.group)) tops.push({ regs: r.registrations, rev: r.revenueCents, lines: [{ kind: "source", r, child: false }] });
  tops.sort((a, b) => b.regs - a.regs || b.rev - a.rev);
  const other = (o.otherDetail || []).filter((d) => d.visitors || d.registrations);
  const bar = (n: number) => (
    <span className="block h-1.5 w-12 flex-none overflow-hidden rounded-full bg-slate-100">
      <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${(n / maxRegs) * 100}%` }} />
    </span>
  );
  return (
    <Card>
      <SectionTitle aside={<span className="text-[12px] text-slate-400">First touch · {o.period.label}</span>}>Customer acquisition</SectionTitle>
      {!o.spend.connected ? (
        <p className="mb-4 rounded-[14px] bg-blue-50/70 px-4 py-3 text-[13px] text-blue-900">
          {SPEND_STATUS_TEXT[o.spend.status || "not_configured"] || SPEND_STATUS_TEXT.not_configured}
        </p>
      ) : o.spend.partial || o.spend.stale ? (
        <p className="mb-4 rounded-[14px] bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          {o.spend.partial ? "Spend history starts partway through this period, so cost figures here are understated. " : ""}
          {o.spend.stale ? "Spend has not refreshed recently; the last few days may be missing." : ""}
        </p>
      ) : null}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <th className="px-2 pb-2">Source</th>
              <th className="px-2 pb-2 text-right">Visitors</th>
              <th className="px-2 pb-2 text-right">Registered</th>
              <th className="px-2 pb-2 text-right">Free Visits</th>
              <th className="px-2 pb-2 text-right">Members</th>
              <th className="px-2 pb-2 text-right">Conv.</th>
              <th className="px-2 pb-2 text-right">Revenue</th>
              <th className="px-2 pb-2 text-right">Spend</th>
              {o.spend.connected ? (
                <>
                  <th className="px-2 pb-2 text-right" title="Spend divided by first-time paying customers (members or paid visits)">CAC</th>
                  <th className="px-2 pb-2 text-right" title="Attributed revenue divided by spend">ROAS</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {tops.flatMap((t) => t.lines).map((line) =>
              line.kind === "group" ? (
                <tr key={`g-${line.g.key}`} className="border-t border-slate-100" data-source-group={line.g.key}>
                  <td className="px-2 py-2.5">
                    <button type="button" onClick={openCampaigns} className="flex items-center gap-2 text-left">
                      {bar(line.g.registrations)}
                      <span className="text-[14px] font-bold text-slate-900 underline-offset-4 hover:underline">{line.g.label}</span>
                      {line.g.share !== null ? <span className="text-[11px] text-slate-400">{Math.round(line.g.share)}%</span> : null}
                    </button>
                  </td>
                  <SourceCells r={line.g} revenue={revenue} />
                  <SpendCells r={line.g} connected={o.spend.connected} strong />
                </tr>
              ) : (
                <tr key={line.r.key} className={line.child ? "" : "border-t border-slate-100"} data-source={line.r.key}>
                  <td className={`px-2 ${line.child ? "py-1.5" : "py-2.5"}`}>
                    <button
                      type="button"
                      onClick={() => onOpen("source", line.r.label, { param: line.r.key })}
                      className={`flex items-center gap-2 text-left ${line.child ? "pl-5" : ""}`}
                    >
                      {line.child ? <span className="w-12 flex-none text-right text-[12px] text-slate-300">└</span> : bar(line.r.registrations)}
                      <span className={`${line.child ? "text-[13px] font-medium text-slate-700" : "text-[14px] font-semibold text-slate-900"} underline-offset-4 hover:underline`}>{line.r.label}</span>
                      {!line.child && line.r.share !== null ? <span className="text-[11px] text-slate-400">{Math.round(line.r.share)}%</span> : null}
                    </button>
                  </td>
                  <SourceCells r={line.r} revenue={revenue} />
                  <SpendCells r={line.r} connected={o.spend.connected} />
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {other.length ? (
        <p className="mt-3 text-[12px] leading-5 text-slate-500" data-other-detail>
          <span className="font-semibold text-slate-600">Other: </span>
          {other.map((d) => `${d.origin} ${num(d.visitors)} visitor${d.visitors === 1 ? "" : "s"}${d.registrations ? ` · ${num(d.registrations)} registered` : ""}`).join("; ")}
        </p>
      ) : null}
      <p className="mt-2 text-[12px] leading-5 text-slate-400">
        First touch: how each browser first found the site, kept through sign-up. Click Meta Ads for campaigns, ad sets and ads. Direct / Unknown is shown, never hidden.
        {o.unmatchedRevenueCents ? ` ${money(o.unmatchedRevenueCents)} of revenue couldn't be matched to a customer.` : ""}
      </p>
    </Card>
  );
}

const SPEND_STATUS_TEXT: Record<string, string> = {
  not_configured: "Customer attribution is active. Connect Meta Ads to add spend, cost per customer and ROAS.",
  token_missing: "Meta Ads spend is switched on but no access token is configured.",
  token_invalid: "Meta Ads spend could not be read: the access token is no longer valid. Generate a new one in Business Settings.",
  token_missing_ads_read: "Meta Ads spend could not be read: the token lacks the ads_read permission on the ad account.",
  rate_limited: "Meta is rate-limiting spend reads; the next sync will retry.",
  meta_unavailable: "Meta's API was unavailable at the last sync; it will retry.",
};

type SpendFields = { spendCents?: number | null; cacCents?: number | null; roas?: number | null };

/* Spend, then CAC and ROAS once Meta Ads is connected. A dash means unknown, never zero. */
function SpendCells({ r, connected, strong = false }: { r: SpendFields; connected: boolean; strong?: boolean }) {
  const tone = strong ? "font-semibold text-slate-900" : "text-slate-600";
  const cell = (known: boolean) => `px-2 py-2.5 text-right text-[13px] ${known ? tone : "text-slate-400"}`;
  return (
    <>
      <td className={cell(r.spendCents != null)}>{r.spendCents == null ? "—" : money(r.spendCents)}</td>
      {connected ? (
        <>
          <td className={cell(r.cacCents != null)}>{r.cacCents == null ? "—" : money(r.cacCents)}</td>
          <td className={cell(r.roas != null)}>{r.roas == null ? "—" : `${r.roas.toFixed(1)}×`}</td>
        </>
      ) : null}
    </>
  );
}

const TREE_COLS = { base: "grid-cols-[minmax(0,1fr)_repeat(5,48px)]", spend: "grid-cols-[minmax(0,1fr)_repeat(7,48px)]" };

function Row({ n, depth, onClick, expanded, spend = false }: { n: CampaignNode; depth: number; onClick?: () => void; expanded?: boolean; spend?: boolean }) {
  const cells = (
    <>
      <span className={`truncate ${n.name ? "text-slate-900" : "text-slate-600"}`} title={n.id ? `ID ${n.id}` : undefined}>
        {onClick ? <span className="mr-1 text-slate-400">{expanded ? "▾" : "▸"}</span> : null}
        {n.label}
      </span>
      <span className="text-right tabular-nums text-slate-500">{n.visitors}</span>
      <span className="text-right tabular-nums text-slate-600">{n.registrations}</span>
      <span className="text-right tabular-nums text-slate-600">{n.freeVisits}</span>
      <span className="text-right tabular-nums text-slate-900">{n.members}</span>
      <span className="text-right tabular-nums text-slate-900">{money(n.revenueCents, { compact: true })}</span>
      {spend ? (
        <>
          <span className="text-right tabular-nums text-slate-600">{n.spendCents == null ? "—" : money(n.spendCents, { compact: true })}</span>
          <span className="text-right tabular-nums text-slate-600">{n.cacCents == null ? "—" : money(n.cacCents, { compact: true })}</span>
        </>
      ) : null}
    </>
  );
  const cls = `grid w-full ${spend ? TREE_COLS.spend : TREE_COLS.base} items-center gap-1 rounded-[10px] py-2 pr-2 text-left text-[13px] ${depth === 0 ? "font-semibold" : ""}`;
  return onClick ? (
    <button type="button" aria-expanded={expanded} className={`${cls} hover:bg-slate-50`} style={{ paddingLeft: 8 + depth * 16 }} onClick={onClick}>
      {cells}
    </button>
  ) : (
    <div className={cls} style={{ paddingLeft: 8 + depth * 16 }}>
      {cells}
    </div>
  );
}

function CampaignTree({ campaigns, spend, onOpen }: { campaigns: CampaignNode[]; spend: boolean; onOpen: OpenList }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!campaigns.length) return <p className="pt-4 text-center text-[14px] text-slate-500">No Meta ad traffic in this period.</p>;
  const anyIdOnly = campaigns.some((c) => !c.name && c.id);
  return (
    <div>
      <div className={`grid ${spend ? TREE_COLS.spend : TREE_COLS.base} gap-1 px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400`}>
        <span>Campaign</span>
        <span className="text-right">Visit.</span>
        <span className="text-right">Reg.</span>
        <span className="text-right">Free</span>
        <span className="text-right">Memb.</span>
        <span className="text-right">Rev.</span>
        {spend ? (
          <>
            <span className="text-right">Spend</span>
            <span className="text-right">CAC</span>
          </>
        ) : null}
      </div>
      {campaigns.map((c) => (
        <div key={c.key} className="border-t border-slate-100">
          <Row n={c} depth={0} spend={spend} expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)} />
          {open === c.key ? (
            <div className="pb-2">
              {(c.adsets || []).map((s) => (
                <div key={s.key}>
                  <Row n={s} depth={1} spend={spend} />
                  {(s.ads || []).map((a) => (
                    <Row key={a.key} n={a} depth={2} spend={spend} />
                  ))}
                </div>
              ))}
              {c.plans && Object.keys(c.plans).length ? (
                <p className="px-2 pt-1 text-[12px] text-slate-500">Plans: {Object.entries(c.plans).map(([p, n]) => `${planLabel(p)} ${n}`).join(" · ")}</p>
              ) : null}
              {c.registrations ? (
                <button type="button" onClick={() => onOpen("campaign", `Campaign: ${c.label}`, { param: c.key })} className="mt-1 px-2 text-[12px] font-semibold text-blue-700">
                  See these customers →
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
      <p className="mt-4 text-[12px] leading-5 text-slate-500">
        {spend ? "" : "Spend, cost per member and ROAS appear once Meta Ads is connected. "}
        Names and ids come from each ad&rsquo;s URL parameters.
        {anyIdOnly ? " Where an ad's URL carries only ids, the id is shown; add the name parameters in Ads Manager to see names." : ""}
      </p>
    </div>
  );
}

function ActivityCard({ items, linkCustomers }: { items: ActivityItem[]; linkCustomers: boolean }) {
  const dot: Record<string, string> = {
    registered: "#86b6ef",
    membership: "#2a78d6",
    cancellation: "#e34948",
    free_visit: "#1baf7a",
    free_visit_completed: "#008300",
    one_time: "#eb6834",
  };
  return (
    <Card>
      <SectionTitle aside={<span className="text-[12px] text-slate-400">Last 14 days</span>}>Recent activity</SectionTitle>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((a, i) => (
            <li key={`${a.at}-${i}`}>
              <MaybeLink href={linkCustomers ? customerHref(a.ref || a.who) : null} className={`flex items-center gap-3 rounded-[12px] px-2 py-2 ${linkCustomers ? "hover:bg-slate-50" : ""}`}>
                <span className="w-[86px] flex-none text-[12px] tabular-nums text-slate-400">{relTime(a.at)}</span>
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: dot[a.type] || "#94a3b8" }} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-slate-800">
                  {a.text} <span className="text-slate-400">· {a.who}</span>
                </span>
              </MaybeLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-slate-500">Nothing new in the last two weeks.</p>
      )}
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5 pb-10" aria-busy="true" aria-label="Loading overview">
      <div className="ov-skel h-10 w-48 rounded-[12px]" />
      <div className="ov-skel h-10 w-full max-w-[560px] rounded-[12px]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ov-skel h-[140px] rounded-[22px]" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="ov-skel h-[340px] rounded-[22px]" />
        <div className="ov-skel h-[340px] rounded-[22px]" />
      </div>
    </div>
  );
}

