"use client";

/*
 * The owner's Sales desk (/api/admin/sales-desk/*, owner only): Team, Leads,
 * Reviews, Commissions, Payouts and GHL. Each tab and each opened record is
 * in the URL (?tab=…&employee=…), so Back and reloads land where you were.
 * Every figure is the server's; the bonus numbers here come from the same
 * bonusProgress() the telemarketer sees, so both sides always match.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { errorMessage, useAdminMutation, useAdminQuery } from "@/lib/admin/query";
import {
  KPI_COLUMNS,
  STATEMENT_STATUS,
  TEAM_TABLE_KEYS,
  dateText,
  dayText,
  deskKeys,
  fetchEmployee,
  fetchOverview,
  money,
  pct,
  prize,
  saveGoals,
  saveHomeAddress,
  stageLabel,
  weekText,
  type Bonus,
  type Metrics,
  type TeamRow,
} from "@/lib/admin/sales";
import { Button, EmptyState, ErrorState, Field, ListRow, PageHeader, Sheet, SkeletonRows, StatusBadge, Tabs, TextInput, Textarea, cx, useToast } from "@/app/components/admin/ui";
import { BonusSummary, EarningsSnapshot, InfoTip, Panel, Problem, Stat, SuppressionBadges } from "../parts";
import { DeskLeads } from "./DeskLeads";
import { DeskCommissions, DeskGhl, DeskPayouts, DeskReviews } from "./DeskMoney";

export const TABS = [
  { id: "team", label: "Team" },
  { id: "leads", label: "Leads" },
  { id: "reviews", label: "Reviews" },
  { id: "commissions", label: "Commissions" },
  { id: "payouts", label: "Payouts" },
  { id: "ghl", label: "GHL" },
] as const;

/** Read and change the desk's URL state (tab and the record open over it). */
export function useDeskParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "/admin/sales-desk";
  const get = useCallback((k: string) => params.get(k) || "", [params]);
  const set = useCallback(
    (patch: Record<string, string | null>, { push = false } = {}) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const url = `${pathname}${next.toString() ? `?${next}` : ""}`;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router]
  );
  return { get, set };
}

export function SalesDesk() {
  const { get } = useDeskParams();
  const tab = (TABS.find((t) => t.id === get("tab"))?.id || "team") as (typeof TABS)[number]["id"];
  return (
    <div data-section="sales-desk" className="space-y-3">
      <PageHeader title="Sales desk" description="Telemarketers, leads, sales credit and Friday payouts. Only verified payments earn commission." />
      <Tabs label="Sales desk" value={tab} items={TABS.map((t) => ({ id: t.id, label: t.label, href: `/admin/sales-desk?tab=${t.id}` }))} />
      {tab === "team" ? <TeamTab /> : tab === "leads" ? <DeskLeads /> : tab === "reviews" ? <DeskReviews /> : tab === "commissions" ? <DeskCommissions /> : tab === "payouts" ? <DeskPayouts /> : <DeskGhl />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

function bonusLine(b: Bonus) {
  if (!b.started) return `Not started · ${b.pendingCount} pending`;
  return `${b.inBlock} of ${b.threshold} · ${b.remaining} to ${prize(b.amountCents)}`;
}

function cell(m: Metrics, key: keyof Metrics, isMoney?: boolean) {
  const v = m[key];
  if (isMoney) return money(v as number);
  if (key === "refunds") return `${m.refunds.count}`;
  return String(v);
}

export function TeamTab() {
  const { get, set } = useDeskParams();
  const [from, setFrom] = useState(get("from"));
  const [to, setTo] = useState(get("to"));
  const qFrom = get("from");
  const qTo = get("to");
  const q = useAdminQuery(deskKeys.overview(qFrom, qTo), (signal) => fetchOverview(qFrom, qTo, signal), { staleTime: 30_000 });
  const d = q.data;
  const employee = get("employee");
  const defs = d?.definitions || {};
  const tableCols = KPI_COLUMNS.filter((c) => TEAM_TABLE_KEYS.includes(c.key));
  const apply = () => set({ from: from && to ? from : null, to: from && to ? to : null });
  return (
    <div className="space-y-4" data-desk-tab="team">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <Field label="From">
          <TextInput name="range-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <TextInput name="range-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={Boolean(from) !== Boolean(to)}>
          Show
        </Button>
        {(qFrom || qTo) && (
          <Button
            variant="tertiary"
            onClick={() => {
              setFrom("");
              setTo("");
              set({ from: null, to: null });
            }}
          >
            This pay week
          </Button>
        )}
      </form>
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading the team" />
      ) : q.error && !d ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : d ? (
        <>
          <p className="text-[13px] text-adm-text-2" data-team-range="">
            {dateText(d.from)} – {dateText(new Date(new Date(d.to).getTime() - 1))} (New York days). Bonus columns are each person&apos;s current bonus month.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-queues="">
            <QueueTile label="Unassigned leads" value={d.queues.unassigned} onClick={() => set({ tab: "leads", view: "unassigned" }, { push: true })} k="unassigned" />
            <QueueTile label="Intake to review" value={d.queues.intake} onClick={() => set({ tab: "leads", view: "intake" }, { push: true })} k="intake" />
            <QueueTile label="Reviews open" value={d.queues.reviews} onClick={() => set({ tab: "reviews" }, { push: true })} k="reviews" />
            <QueueTile label="Credit requests" value={d.queues.requests} onClick={() => set({ tab: "reviews" }, { push: true })} k="requests" />
            <QueueTile label="Leads with an inactive employee" value={d.queues.leadsWithInactiveEmployee} onClick={() => set({ tab: "leads", view: "inactive" }, { push: true })} k="inactive" />
          </div>
          {!d.rows.length ? (
            <EmptyState message="No telemarketers yet." detail="Add one in Team: choose the Telemarketer role." />
          ) : (
            <>
              {/* desktop: one table */}
              <div className="hidden overflow-x-auto rounded-adm-md border border-adm-line bg-adm-surface lg:block" data-team-table="">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-adm-line text-left align-bottom text-[12px] text-adm-text-2">
                      <th className="min-w-[120px] px-3 py-2 font-semibold">Telemarketer</th>
                      <th className="min-w-[150px] px-2 py-2 font-semibold">
                        Bonus <InfoTip label="Bonus" text="Verified first memberships in the current bonus month, toward the next bonus. Pending claims are not counted." />
                      </th>
                      {tableCols.map((c) => (
                        <th key={c.key} className="px-1.5 py-2 text-right font-semibold">
                          <span className="inline-flex items-center justify-end">
                            {c.label}
                            {defs[c.def] && <InfoTip label={c.label} text={defs[c.def]} />}
                          </span>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-semibold">Open leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.employee.id} className={cx("cursor-pointer border-b border-adm-line last:border-b-0 hover:bg-adm-bg", employee === r.employee.id && "bg-adm-accent-soft")} onClick={() => set({ employee: r.employee.id })} data-team-row={r.employee.id}>
                        <td className="px-3 py-2">
                          <button type="button" className="min-h-[36px] text-left font-semibold text-adm-ink underline-offset-2 hover:underline" onClick={(e) => (e.stopPropagation(), set({ employee: r.employee.id }))}>
                            {r.employee.name}
                          </button>
                          {!r.employee.active && <StatusBadge tone="neutral" className="ml-1">Disabled</StatusBadge>}
                        </td>
                        <td className="px-2 py-2" data-team-bonus={r.employee.id}>
                          <span className="adm-num font-semibold text-adm-ink">{bonusLine(r.bonus)}</span>
                          {r.bonus.started && (
                            <span className="block text-[12px] text-adm-text-2">
                              {r.bonus.verifiedCount} verified · {r.bonus.pendingCount} pending
                            </span>
                          )}
                        </td>
                        {tableCols.map((c) => (
                          <td key={c.key} className="adm-num px-1.5 py-2 text-right text-adm-ink" data-kpi={c.key}>
                            {cell(r.metrics, c.key, c.money)}
                          </td>
                        ))}
                        <td className="adm-num px-2 py-2 text-right text-adm-ink">{r.openLeads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* phones and tablets: a card per person */}
              <ul role="list" className="space-y-3 lg:hidden" data-team-cards="">
                {d.rows.map((r) => (
                  <TeamCard key={r.employee.id} r={r} onOpen={() => set({ employee: r.employee.id })} />
                ))}
              </ul>
              <details className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-2" data-definitions="">
                <summary className="min-h-[36px] cursor-pointer py-1.5 text-[14px] font-semibold text-adm-ink">What each number means</summary>
                <dl className="mt-1 space-y-1.5 pb-2 text-[13px]">
                  {Object.entries(defs).map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-semibold text-adm-ink">{KPI_COLUMNS.find((c) => c.def === k)?.label || k}</dt>
                      <dd className="text-adm-text-2">{v}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          )}
        </>
      ) : null}
      {employee && <EmployeeSheet id={employee} from={qFrom} to={qTo} onClose={() => set({ employee: null })} />}
    </div>
  );
}

function QueueTile({ label, value, onClick, k }: { label: string; value: number; onClick: () => void; k: string }) {
  return (
    <button type="button" onClick={onClick} className={cx("min-h-[64px] min-w-0 rounded-adm-md border px-3 py-2 text-left", value > 0 ? "border-adm-attn bg-adm-attn-bg" : "border-adm-line bg-adm-surface")} data-queue={k}>
      <span className="adm-num block text-[18px] font-semibold text-adm-ink">{value}</span>
      <span className="block text-[12px] leading-4 text-adm-text-2">{label}</span>
    </button>
  );
}

function TeamCard({ r, onOpen }: { r: TeamRow; onOpen: () => void }) {
  const m = r.metrics;
  return (
    <li className="min-w-0 rounded-adm-md border border-adm-line bg-adm-surface" data-team-row={r.employee.id}>
      <button type="button" onClick={onOpen} className="block w-full px-4 py-3 text-left">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-semibold text-adm-ink">{r.employee.name}</span>
          {!r.employee.active && <StatusBadge tone="neutral">Disabled</StatusBadge>}
          <span className="adm-num ml-auto text-[13px] text-adm-text-2">{r.openLeads} open leads</span>
        </span>
        <span className="mt-1 block" data-team-bonus={r.employee.id}>
          <span className="block text-[14px] font-semibold text-adm-ok">Bonus: {bonusLine(r.bonus)}</span>
          {r.bonus.started && (
            <span className="block text-[12px] text-adm-text-2">
              {r.bonus.verifiedCount} verified · {r.bonus.pendingCount} pending
            </span>
          )}
        </span>
        <span className="mt-2 grid grid-cols-3 gap-1.5 text-[12px]">
          {[
            ["Contacted", m.leadsContacted],
            ["Reached", m.leadsReached],
            ["Free visits", m.freeVisitsBooked],
            ["Memberships", m.firstPaidMemberships],
            ["Earned", money(m.commissionEarnedCents)],
            ["Overdue", m.followUpsOverdue],
          ].map(([k, v]) => (
            <span key={String(k)} className="min-w-0 rounded-adm-sm bg-adm-sunk px-2 py-1.5">
              <span className="adm-num block text-[14px] font-semibold text-adm-ink">{v}</span>
              <span className="block truncate text-adm-text-2">{k}</span>
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Employee detail                                                     */
/* ------------------------------------------------------------------ */

function EmployeeSheet({ id, from, to, onClose }: { id: string; from: string; to: string; onClose: () => void }) {
  const q = useAdminQuery(deskKeys.employee(id, from, to), (signal) => fetchEmployee(id, from, to, signal), { staleTime: 20_000 });
  const d = q.data;
  return (
    <Sheet open onClose={onClose} title={d?.employee.name || "Telemarketer"} size="full" width="wide" data-sheet="desk-employee">
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading" />
      ) : q.error && !d ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : d ? (
        <div className="space-y-4" data-desk-employee={d.employee.id}>
          <p className="text-[13px] text-adm-text-2">
            {d.employee.email} · {d.employee.active ? "Active" : "Disabled"} · figures for {dateText(d.from)} – {dateText(new Date(new Date(d.to).getTime() - 1))}
          </p>
          <Panel title="Bonus (same figures the telemarketer sees)" data-employee-bonus="">
            <BonusSummary bonus={d.bonus} owner />
          </Panel>
          <Panel title="Activity and sales">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {KPI_COLUMNS.map((c) => (
                <Stat key={c.key} data-metric={c.key} label={<span className="inline-flex items-center">{c.label}{d.definitions[c.def] && <InfoTip label={c.label} text={d.definitions[c.def]} />}</span>} value={cell(d.metrics, c.key, c.money)} />
              ))}
              <Stat label="Refunds" value={`${d.metrics.refunds.count} · ${money(d.metrics.refunds.amountCents)}`} note="Nothing deducted automatically" />
              <Stat label="Contact rate" value={pct(d.metrics.rates.contactRate)} />
              <Stat label="Reach rate" value={pct(d.metrics.rates.reachRate)} />
              <Stat label="Show rate" value={pct(d.metrics.rates.showRate)} />
              <Stat label="Close rate" value={pct(d.metrics.rates.closeRate)} />
            </div>
          </Panel>
          <Panel title="Earnings">
            <EarningsSnapshot e={d.earnings} />
          </Panel>
          <GoalsForm id={d.employee.id} goals={d.goals} coaching={d.coaching} />
          <HomeAddressForm id={d.employee.id} initial={d.employee.homeAddress} />
          <Panel title="Statements">
            {d.statements.length ? (
              <ul role="list" className="-mx-4 -my-4">
                {d.statements.slice(0, 8).map((s) => {
                  const st = STATEMENT_STATUS[s.status] || { label: s.status, tone: "neutral" as const };
                  return <ListRow key={s.week} chevron={false} title={weekText(s.week, s.lastDay)} subtitle={`Payday ${dayText(s.payday)} · ${s.entries} lines`} meta={money(s.totalCents)} footer={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>} />;
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-text-2">No statements.</p>
            )}
          </Panel>
          <Panel title="Sales">
            {d.sales.length ? (
              <ul className="space-y-1.5 text-[14px]">
                {d.sales.map((s) => (
                  <li key={s.saleId} className="flex flex-wrap items-center gap-1.5 border-b border-adm-line pb-1.5 last:border-b-0">
                    <span className="font-semibold text-adm-ink">{s.label}</span>
                    <span className="text-adm-text-2">{s.customer} · {dateText(s.paidAt)}</span>
                    <span className="adm-num ml-auto text-adm-ink">{s.commission ? money(s.commission.amountCents) : s.attribution.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-text-2">No sales.</p>
            )}
          </Panel>
          <Panel title={`Open leads (${d.leads.length})`}>
            {d.leads.length ? (
              <ul className="space-y-1.5 text-[14px]">
                {d.leads.slice(0, 50).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-adm-ink">{l.name}</span>
                    <span className="text-adm-text-2">{l.town} · {stageLabel(l.stage)}</span>
                    <SuppressionBadges call={l.doNotCall} sms={l.doNotText} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-text-2">No open leads.</p>
            )}
          </Panel>
        </div>
      ) : null}
    </Sheet>
  );
}

/** Optional; only for the self-referral check. Owner-only: never shown to the telemarketer or other staff. */
function HomeAddressForm({ id, initial }: { id: string; initial?: { line1: string; unit: string; city: string; zip: string } }) {
  const toast = useToast();
  const [line1, setLine1] = useState(initial?.line1 || "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [city, setCity] = useState(initial?.city || "");
  const [zip, setZip] = useState(initial?.zip || "");
  const save = useAdminMutation(() => saveHomeAddress(id, { line1: line1.trim(), unit: unit.trim(), city: city.trim(), zip: zip.trim() }), {
    onSuccess: () => toast.show("Home address saved."),
    invalidates: [deskKeys.all],
  });
  return (
    <Panel title="Home address (self-referral check)" data-home-address-form="">
      <p className="mb-2 text-[13px] text-adm-text-2">Optional. A customer at this address is flagged for your review (never refused): it may be a household member. Only you can see it.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Street address">
          <TextInput name="home-line1" autoComplete="off" value={line1} onChange={(e) => setLine1(e.target.value)} />
        </Field>
        <Field label="Apt / unit">
          <TextInput name="home-unit" autoComplete="off" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Town">
          <TextInput name="home-city" autoComplete="off" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="ZIP">
          <TextInput name="home-zip" inputMode="numeric" autoComplete="off" value={zip} onChange={(e) => setZip(e.target.value)} />
        </Field>
      </div>
      {save.error ? <div className="mt-2"><Problem>{errorMessage(save.error)}</Problem></div> : null}
      <Button className="mt-3" busy={save.busy} onClick={() => save.mutate(undefined)} data-home-address-save="">
        Save address
      </Button>
    </Panel>
  );
}

function GoalsForm({ id, goals, coaching }: { id: string; goals: { weeklyMemberships: number; weeklyFreeVisits: number; note: string }; coaching: string }) {
  const toast = useToast();
  const [m, setM] = useState(String(goals.weeklyMemberships || ""));
  const [f, setF] = useState(String(goals.weeklyFreeVisits || ""));
  const [note, setNote] = useState(coaching || goals.note || "");
  const save = useAdminMutation(() => saveGoals(id, { weeklyMemberships: Number(m) || 0, weeklyFreeVisits: Number(f) || 0, note: note.trim() }), {
    onSuccess: () => toast.show("Goals saved."),
    invalidates: [deskKeys.all],
  });
  return (
    <Panel title="Goals and coaching" data-goals-form="">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Memberships a week">
          <TextInput name="goal-memberships" type="number" min={0} max={500} inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} />
        </Field>
        <Field label="Free visits a week">
          <TextInput name="goal-free-visits" type="number" min={0} max={500} inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} />
        </Field>
      </div>
      <Field label="Coaching note" help="The telemarketer sees this with their goals." className="mt-3">
        <Textarea name="goal-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {save.error ? <div className="mt-2"><Problem>{errorMessage(save.error)}</Problem></div> : null}
      <Button className="mt-3" busy={save.busy} onClick={() => save.mutate(undefined)} data-goals-save="">
        Save goals
      </Button>
    </Panel>
  );
}
