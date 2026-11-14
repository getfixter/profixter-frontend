"use client";

/*
 * The Telemarketer workspace: Today, Leads, Earnings, Credit requests and
 * Submitted leads. Everything comes from /api/sales/* (BackEnd routes/sales.js),
 * which only ever returns the caller's own assigned leads and own records.
 * Figures are the server's; nothing here works out money or bonus progress.
 */
import { ArrowDownTrayIcon, ClipboardDocumentIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { errorMessage, invalidateQueries, useAdminMutation, useAdminQuery } from "@/lib/admin/query";
import {
  ATTRIBUTION,
  REQUEST_STATUS,
  STAGES,
  STATEMENT_STATUS,
  dateText,
  dateTimeText,
  dayText,
  downloadAuthed,
  deskPaths,
  fetchIntake,
  fetchMyBonus,
  fetchMyLeads,
  fetchMyRequests,
  fetchMySales,
  fetchMyStatement,
  fetchMyStatements,
  fetchSalesMe,
  money,
  PRODUCT_LABEL,
  replyRequest,
  requestKindLabel,
  salesKeys,
  submitIntake,
  taskKindLabel,
  timeText,
  weekText,
  withdrawRequest,
  type CreditRequest,
  type LeadCard,
} from "@/lib/admin/sales";
import { writeToClipboard } from "@/lib/utils/clipboard";
import {
  Button,
  ButtonLink,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  ListRow,
  PageHeader,
  SearchField,
  Section,
  Sheet,
  SkeletonRows,
  StatusBadge,
  Tabs,
  TextInput,
  Textarea,
  useToast,
} from "@/app/components/admin/ui";
import { BonusSummary, CalcBreakdown, EarningsSnapshot, EntryRow, Notice, Panel, Problem, StageBadge, SuppressionBadges, UnknownBadge } from "./parts";
import { EvidenceUpload } from "./LeadDetail";

function Loading({ label }: { label: string }) {
  return <SkeletonRows count={4} label={label} />;
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

export function SalesToday() {
  const q = useAdminQuery(salesKeys.me, fetchSalesMe, { staleTime: 20_000, pollMs: 120_000 });
  const toast = useToast();
  const d = q.data;
  if (q.isLoading) return <Loading label="Loading your day" />;
  if (q.error && !d) return <ErrorState title="Your day could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />;
  if (!d) return null;
  const day = d.day;
  const goals = d.goals;
  const hasGoals = Boolean(goals && (goals.weeklyMemberships || goals.weeklyFreeVisits || goals.note));
  const copy = async () => {
    const ok = await writeToClipboard(d.referral.url);
    toast.show(ok ? "Referral link copied." : "Couldn't copy. Select the link and copy it.");
  };
  return (
    <div data-section="sales-today" className="space-y-4">
      <PageHeader title="Today" description={`Hi ${d.me.firstName || d.me.name}. ${day.leadsCount} lead${day.leadsCount === 1 ? "" : "s"} assigned to you.`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="min-w-0 space-y-4">
          <Section title="Follow-ups due" count={day.tasks.length} id="sales-followups">
            {day.tasks.length ? (
              <ul role="list" data-followups="">
                {day.tasks.map((t) => (
                  <ListRow
                    key={t.id}
                    href={`/admin/sales-leads/${encodeURIComponent(t.leadId)}`}
                    title={t.name || "Lead"}
                    subtitle={[t.town, `${taskKindLabel(t.kind)}${t.note ? `: ${t.note}` : ""}`].filter(Boolean).join(" · ")}
                    meta={t.overdue ? dateTimeText(t.dueAt) : timeText(t.dueAt)}
                    trailing={t.overdue ? <StatusBadge tone="problem">Overdue</StatusBadge> : <StatusBadge tone="attention">Today</StatusBadge>}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="No follow-ups due today." detail="Follow-ups you set on a lead show up here on their day." />
            )}
          </Section>
          <Section title="New assignments" count={day.newAssignments.length} id="sales-new">
            {day.newAssignments.length ? (
              <ul role="list" data-new-assignments="">
                {day.newAssignments.map((a) => (
                  <ListRow key={a.leadId} href={`/admin/sales-leads/${encodeURIComponent(a.leadId)}`} title={a.name} subtitle={a.town || "Town not given"} meta={`Assigned ${dateText(a.assignedAt)}`} />
                ))}
              </ul>
            ) : (
              <EmptyState message="No new leads waiting for a first call." />
            )}
          </Section>
          <Section title="Upcoming free visits" count={day.upcomingVisits.length} id="sales-visits">
            {day.upcomingVisits.length ? (
              <ul role="list" data-upcoming-visits="">
                {day.upcomingVisits.map((v, i) => (
                  <ListRow
                    key={`${v.leadId}-${i}`}
                    href={v.leadId ? `/admin/sales-leads/${encodeURIComponent(v.leadId)}` : undefined}
                    chevron={Boolean(v.leadId)}
                    title={v.name || "Customer"}
                    subtitle={v.label}
                    meta={dateTimeText(v.date)}
                    trailing={v.verified ? <StatusBadge tone="info">System</StatusBadge> : <UnknownBadge />}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState message="No free visits in the next 7 days." />
            )}
          </Section>
        </div>
        <div className="min-w-0 space-y-4">
          <Panel title="Your bonus" action={<Link className="text-[14px] font-semibold text-adm-accent-ink" href="/admin/sales-earnings?tab=bonus">Details</Link>} data-today-bonus="">
            <BonusSummary bonus={day.bonus} compact />
          </Panel>
          <Panel title="Earnings" action={<Link className="text-[14px] font-semibold text-adm-accent-ink" href="/admin/sales-earnings?tab=statements">Statements</Link>} data-today-earnings="">
            <EarningsSnapshot e={day.earnings} />
          </Panel>
          {hasGoals && (
            <Panel title="Your goals" data-goals="">
              <ul className="space-y-1 text-[14px] text-adm-ink">
                {goals.weeklyMemberships > 0 && <li>{goals.weeklyMemberships} memberships a week</li>}
                {goals.weeklyFreeVisits > 0 && <li>{goals.weeklyFreeVisits} free visits a week</li>}
              </ul>
              {goals.note && <p className="mt-2 break-words rounded-adm-sm bg-adm-sunk px-3 py-2 text-[14px] text-adm-text-2">{goals.note}</p>}
            </Panel>
          )}
          <Panel title="Your referral link" data-referral="">
            <p className="text-[13px] text-adm-text-2">A customer who signs up through this link is recorded as your referral.</p>
            <p className="mt-2 break-all rounded-adm-sm bg-adm-sunk px-3 py-2 font-mono text-[13px] text-adm-ink" data-referral-url="">
              {d.referral.url}
            </p>
            <div className="mt-2">
              <Button variant="secondary" icon={<ClipboardDocumentIcon className="h-5 w-5" />} onClick={copy} data-copy-referral="">
                Copy link
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

function matches(l: LeadCard, term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  return l.name.toLowerCase().includes(t) || (digits.length > 0 && (l.phoneLast4.endsWith(digits) || digits.endsWith(l.phoneLast4))) || l.town.toLowerCase().includes(t);
}

export function SalesLeads() {
  const params = useSearchParams();
  const pathname = usePathname() || "/admin/sales-leads";
  const stage = params.get("stage") || "";
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  // Search stays in the browser: the list is the caller's own leads (at most 500), so nothing typed goes into a URL.
  const q = useAdminQuery(salesKeys.leads("", ""), (signal) => fetchMyLeads("", "", signal), { staleTime: 20_000 });
  const all = useMemo(() => q.data || [], [q.data]);
  const list = useMemo(() => all.filter((l) => (!stage || l.stage === stage) && matches(l, term)), [all, stage, term]);
  const countOf = (s: string) => all.filter((l) => l.stage === s).length;
  const base = pathname.replace(/\/admin\/sales-leads\/.*$/, "/admin/sales-leads");
  return (
    <div data-section="sales-leads" className="space-y-3">
      <PageHeader
        title="Leads"
        description="Your assigned leads. Tap one to call, log what happened and set the next step."
        actions={
          <Button icon={<PlusIcon className="h-5 w-5" />} onClick={() => setAdding(true)} data-add-lead="">
            Add lead
          </Button>
        }
      />
      <SearchField label="Search your leads" placeholder="Name, town or last 4 digits" value={term} onChange={setTerm} />
      <FilterBar label="Stage">
        <Chip href={base} selected={!stage} count={all.length}>
          All
        </Chip>
        {STAGES.map((s) => (
          <Chip key={s.id} href={`${base}?stage=${s.id}`} selected={stage === s.id} count={countOf(s.id)}>
            {s.label}
          </Chip>
        ))}
      </FilterBar>
      {q.isLoading ? (
        <Loading label="Loading your leads" />
      ) : q.error && !q.data ? (
        <ErrorState title="Your leads could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : list.length ? (
        <Section flush>
          <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-lead-list="">
            {list.map((l) => (
              <ListRow
                key={l.id}
                href={`/admin/sales-leads/${encodeURIComponent(l.id)}${stage ? `?stage=${stage}` : ""}`}
                title={l.name}
                subtitle={`${l.town || "Town not given"} · ••••${l.phoneLast4}${l.nextTask ? ` · Next: ${taskKindLabel(l.nextTask.kind)} ${dateTimeText(l.nextTask.dueAt)}` : ""}`}
                footer={
                  <>
                    <StageBadge stage={l.stage} />
                    <SuppressionBadges call={l.doNotCall} sms={l.doNotText} />
                  </>
                }
                label={`${l.name}, ${l.town}`}
              />
            ))}
          </ul>
        </Section>
      ) : (
        <EmptyState message={all.length ? "No leads match." : "No leads assigned to you yet."} detail={all.length ? "Try another stage or search." : "The owner assigns leads. You can also add a lead for the owner to approve."} />
      )}
      <IntakeSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

const EMPTY_INTAKE = { name: "", phone: "", email: "", town: "", zip: "", note: "" };

function IntakeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_INTAKE);
  const [done, setDone] = useState<string | null>(null);
  const save = useAdminMutation(() => submitIntake({ ...form }), {
    onSuccess: (lead) => {
      setDone(lead?.name || form.name);
      setForm(EMPTY_INTAKE);
      toast.show("Lead sent for the owner's approval.");
    },
    invalidates: [salesKeys.intake],
  });
  const close = () => {
    setDone(null);
    save.reset();
    onClose();
  };
  const dirty = !done && Object.values(form).some(Boolean);
  const can = form.name.trim().length > 0 && form.phone.replace(/\D/g, "").length >= 10;
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add a lead"
      dirty={dirty}
      busy={save.busy}
      data-sheet="sales-intake"
      footer={
        done ? (
          <>
            <ButtonLink variant="secondary" href="/admin/sales-intake" onClick={close}>
              See submitted leads
            </ButtonLink>
            <Button large onClick={() => setDone(null)}>
              Add another
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" large onClick={close} disabled={save.busy}>
              Cancel
            </Button>
            <Button large busy={save.busy} disabled={!can} onClick={() => save.mutate(undefined)} data-intake-submit="">
              Send for approval
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3" data-intake-done="">
          <Notice tone="ok">
            <strong>{done}</strong> is waiting for the owner&apos;s approval. You&apos;ll find it on your Leads list once the owner approves it and assigns it to you.
          </Notice>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (can) void save.mutate(undefined);
          }}
        >
          <Notice>Every lead you add waits for the owner&apos;s approval. Nobody calls it until it is approved and assigned.</Notice>
          <Field label="Name" required>
            <TextInput name="intake-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Phone" required help="US number">
            <TextInput name="intake-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Town">
              <TextInput name="intake-town" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} autoComplete="off" />
            </Field>
            <Field label="ZIP">
              <TextInput name="intake-zip" inputMode="numeric" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} autoComplete="off" />
            </Field>
          </div>
          <Field label="Email (optional)">
            <TextInput name="intake-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Where this lead came from" help="For the owner: how you know them, what they need.">
            <Textarea name="intake-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          {save.error ? <Problem>{errorMessage(save.error)}</Problem> : null}
        </form>
      )}
    </Sheet>
  );
}

export function SalesIntakeList() {
  const q = useAdminQuery(salesKeys.intake, fetchIntake, { staleTime: 20_000 });
  const [adding, setAdding] = useState(false);
  const label = (s: string) => (s === "intake" ? <StatusBadge tone="attention">Waiting for approval</StatusBadge> : s === "active" ? <StatusBadge tone="success">Approved</StatusBadge> : s === "rejected" ? <StatusBadge tone="neutral">Not approved</StatusBadge> : <StatusBadge tone="neutral">Archived</StatusBadge>);
  return (
    <div data-section="sales-intake" className="space-y-3">
      <PageHeader
        title="Submitted leads"
        description="Leads you added. The owner approves each one before anyone calls it."
        actions={
          <Button icon={<PlusIcon className="h-5 w-5" />} onClick={() => setAdding(true)}>
            Add lead
          </Button>
        }
      />
      {q.isLoading ? (
        <Loading label="Loading your submitted leads" />
      ) : q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : q.data?.length ? (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-intake-list="">
          {q.data.map((l) => (
            <ListRow key={l.id} chevron={false} title={l.name} subtitle={`${l.town || "Town not given"} · ••••${l.phoneLast4} · Sent ${dateText(l.submittedAt)}${l.decision?.reason ? ` · Owner: ${l.decision.reason}` : ""}`} footer={label(l.status)} />
          ))}
        </ul>
      ) : (
        <EmptyState message="You haven't added any leads." />
      )}
      <IntakeSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Earnings                                                            */
/* ------------------------------------------------------------------ */

export function SalesEarnings() {
  const params = useSearchParams();
  const tab = ["sales", "bonus", "statements"].includes(params.get("tab") || "") ? (params.get("tab") as string) : "sales";
  const week = params.get("week") || "";
  return (
    <div data-section="sales-earnings" className="space-y-3">
      <PageHeader title="Earnings" description="Only verified payments earn commission. Claims count once the owner approves them." />
      <Tabs
        label="Earnings"
        value={tab}
        items={[
          { id: "sales", label: "Sales", href: "/admin/sales-earnings?tab=sales" },
          { id: "bonus", label: "Bonus", href: "/admin/sales-earnings?tab=bonus" },
          { id: "statements", label: "Statements", href: "/admin/sales-earnings?tab=statements" },
        ]}
      />
      {tab === "sales" ? <SalesTab /> : tab === "bonus" ? <BonusTab /> : <StatementsTab week={week} />}
    </div>
  );
}

function SalesTab() {
  const q = useAdminQuery(salesKeys.sales, fetchMySales, { staleTime: 30_000 });
  if (q.isLoading) return <Loading label="Loading your sales" />;
  if (q.error && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />;
  if (!q.data?.length) return <EmptyState message="No sales yet." detail="A sale appears here when a customer on one of your leads makes a verified payment, or when you ask for credit." />;
  return (
    <ul role="list" className="space-y-3" data-sales-list="">
      {q.data.map((s) => {
        const a = ATTRIBUTION[s.attribution] || { label: s.attribution, tone: "neutral" as const };
        return (
          <li key={s.saleId} className="min-w-0 rounded-adm-md border border-adm-line bg-adm-surface p-4" data-sale={s.saleId} data-attribution={s.attribution}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-semibold text-adm-ink">{s.label}</span>
              <span className="text-[13px] text-adm-text-2">{s.customer}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="info" title="The payment was confirmed by Stripe">
                Verified payment {dateText(s.paidAt)}
              </StatusBadge>
              <StatusBadge tone={a.tone}>{a.label}</StatusBadge>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CalcBreakdown calc={{ regularCents: s.amounts.regularCents, discountCents: s.amounts.discountCents, discountSource: s.amounts.discountSource, paidPreTaxCents: s.amounts.paidPreTaxCents, taxCents: s.amounts.taxCents, explain: "", rule: null }} />
              <div className="rounded-adm-sm bg-adm-sunk px-3 py-2 text-[13px]" data-commission="">
                {s.commission ? (
                  <>
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-adm-ink">Your commission</span>
                      <span className="adm-num text-[16px] font-semibold text-adm-ink">{money(s.commission.amountCents)}</span>
                    </p>
                    <p className="mt-0.5 break-words text-adm-text-2">{s.commission.calc.explain}</p>
                    <p className="mt-0.5 text-adm-text-3">
                      On the statement for the week of {dayText(s.commission.statementWeek)}
                      {s.commission.late ? " (late)" : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-adm-text-2">No commission on this sale{s.attribution.startsWith("request_") || s.attribution === "pending_review" ? " until the owner decides" : ""}.</p>
                )}
              </div>
            </div>
            {s.refunds.length > 0 && (
              <ul className="mt-3 space-y-1" data-refunds="">
                {s.refunds.map((r, i) => (
                  <li key={i} className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[13px] text-adm-problem">
                    {r.kind === "refund" ? `Refund ${money(r.amountCents)}` : r.kind === "dispute_opened" ? `Chargeback opened ${money(r.amountCents)}` : `Chargeback closed (${r.status || "unknown"})`} on {dateText(r.at)}. Nothing is deducted automatically; the owner reviews it.
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BonusTab() {
  const q = useAdminQuery(salesKeys.bonus, fetchMyBonus, { staleTime: 30_000 });
  if (q.isLoading) return <Loading label="Loading your bonus" />;
  if (q.error && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />;
  const b = q.data;
  if (!b) return null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]" data-bonus-view="">
      <div className="min-w-0 space-y-4">
        <Panel title="This bonus month">
          <BonusSummary bonus={b} />
        </Panel>
        <Panel title="Memberships counted this month" data-counted="">
          {b.countedSales?.length ? (
            <ol className="space-y-1 text-[14px]">
              {b.countedSales.map((c, i) => (
                <li key={String(c.entry)} className="flex items-center justify-between gap-2 border-b border-adm-line py-1.5 last:border-b-0">
                  <span className="text-adm-ink">
                    <span className="adm-num text-adm-text-3">{i + 1}.</span> {PRODUCT_LABEL[c.product] || c.product}
                  </span>
                  <span className="adm-num text-adm-text-2">{dateText(c.paidAt)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[14px] text-adm-text-2">None yet this bonus month.</p>
          )}
          {b.pendingItems && b.pendingItems.length > 0 && (
            <p className="mt-3 rounded-adm-sm bg-adm-attn-bg px-3 py-2 text-[13px] text-adm-attn">
              {b.pendingItems.length} more waiting for the owner&apos;s review. They count only if approved.
            </p>
          )}
        </Panel>
      </div>
      <div className="min-w-0 space-y-4">
        <Panel title="How the bonus works">
          <ul className="list-disc space-y-1 pl-5 text-[14px] text-adm-text-2">
            <li>
              Every {b.threshold} verified first memberships in one bonus month earn {money(b.amountCents)}.
            </li>
            <li>A bonus month starts on the day of your first verified membership sale and repeats monthly from then.</li>
            <li>A sale counts once, in the month of its payment date. Plan changes count only if the owner says so.</li>
            <li>Bonuses go on your weekly statement and are paid on the Friday payday.</li>
          </ul>
        </Panel>
        <Panel title="All time">
          <dl className="grid grid-cols-2 gap-2 text-[13px]" data-bonus-alltime="">
            <div>
              <dt className="text-adm-text-2">Bonuses earned</dt>
              <dd className="adm-num text-[15px] font-semibold text-adm-ink">
                {b.allTime.count} · {money(b.allTime.earnedCents)}
              </dd>
            </div>
            <div>
              <dt className="text-adm-text-2">Paid</dt>
              <dd className="adm-num text-[15px] font-semibold text-adm-ink">{money(b.allTime.paidCents)}</dd>
            </div>
            <div>
              <dt className="text-adm-text-2">Awaiting payment</dt>
              <dd className="adm-num text-[15px] font-semibold text-adm-ink">{money(b.allTime.awaitingPaymentCents)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

function StatementsTab({ week }: { week: string }) {
  const router = useRouter();
  const q = useAdminQuery(salesKeys.statements, fetchMyStatements, { staleTime: 30_000 });
  if (q.isLoading) return <Loading label="Loading your statements" />;
  if (q.error && !q.data) return <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />;
  return (
    <div className="space-y-3">
      <Notice>Statements run Friday to Thursday. The owner approves a finished week and pays it on the Friday payday.</Notice>
      {q.data?.length ? (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-statements="">
          {q.data.map((s) => {
            const st = STATEMENT_STATUS[s.status] || { label: s.status, tone: "neutral" as const };
            return (
              <ListRow
                key={s.week}
                href={`/admin/sales-earnings?tab=statements&week=${s.week}`}
                title={weekText(s.week, s.lastDay)}
                subtitle={`Payday ${dayText(s.payday)} · ${s.entries} line${s.entries === 1 ? "" : "s"}${s.paidOn ? ` · Paid ${dayText(s.paidOn)}${s.method ? ` by ${s.method}` : ""}` : ""}`}
                meta={money(s.totalCents)}
                footer={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
              />
            );
          })}
        </ul>
      ) : (
        <EmptyState message="No statements yet." />
      )}
      {week && <StatementSheet week={week} onClose={() => router.replace("/admin/sales-earnings?tab=statements", { scroll: false })} />}
    </div>
  );
}

function StatementSheet({ week, onClose }: { week: string; onClose: () => void }) {
  const toast = useToast();
  const q = useAdminQuery(salesKeys.statement(week), (signal) => fetchMyStatement(week, signal), { staleTime: 30_000 });
  const [downloading, setDownloading] = useState(false);
  const s = q.data;
  const csv = async () => {
    setDownloading(true);
    try {
      await downloadAuthed(deskPaths.statementCsv(week), `statement-${week}.csv`);
    } catch (e) {
      toast.show(errorMessage(e, "The CSV could not be downloaded."));
    } finally {
      setDownloading(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={s ? `Statement · ${weekText(s.week, s.lastDay)}` : "Statement"} width="wide" data-sheet="sales-statement" footer={s ? <Button variant="secondary" large icon={<ArrowDownTrayIcon className="h-5 w-5" />} busy={downloading} onClick={csv} data-statement-csv="">Download CSV</Button> : undefined}>
      {q.isLoading ? (
        <Loading label="Loading the statement" />
      ) : q.error && !s ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : s ? (
        <div className="space-y-4" data-statement={s.week}>
          <div className="flex flex-wrap items-center gap-2">
            {s.payment?.status === "paid" ? <StatusBadge tone="success">Paid {dayText(s.payment.paidOn)}</StatusBadge> : s.frozen ? <StatusBadge tone="info">Approved {dateText(s.approvedAt)}</StatusBadge> : <StatusBadge tone="attention">Not approved yet: lines can still be added</StatusBadge>}
            <span className="text-[13px] text-adm-text-2">Payday {dayText(s.payday)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4" data-statement-totals="">
            {[
              ["Commission", s.totals.commissionCents],
              ["Bonus", s.totals.bonusCents],
              ["Adjustments", s.totals.adjustmentCents],
              ["Total", s.totals.totalCents],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-adm-sm border border-adm-line px-2.5 py-2">
                <dt className="text-adm-text-2">{k}</dt>
                <dd className="adm-num text-[15px] font-semibold text-adm-ink">{money(Number(v))}</dd>
              </div>
            ))}
          </dl>
          {s.payment?.status === "paid" && (
            <p className="text-[13px] text-adm-text-2">
              Paid on {dayText(s.payment.paidOn)} by {s.payment.method}
              {s.payment.reference ? ` (ref. ${s.payment.reference})` : ""}.
            </p>
          )}
          {s.items.length ? (
            <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line" data-statement-lines="">
              {s.items.map((e) => (
                <EntryRow key={e.id} e={e} />
              ))}
            </ul>
          ) : (
            <EmptyState message="Nothing on this statement yet." />
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Credit requests                                                     */
/* ------------------------------------------------------------------ */

export function SalesRequests() {
  const q = useAdminQuery(salesKeys.requests, fetchMyRequests, { staleTime: 20_000 });
  return (
    <div data-section="sales-requests" className="space-y-3">
      <PageHeader title="Credit requests" description="Sales credit you asked for. Open a lead and choose a sale to ask for credit." />
      {q.isLoading ? (
        <Loading label="Loading your requests" />
      ) : q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : q.data?.length ? (
        <ul role="list" className="space-y-3" data-request-list="">
          {q.data.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <EmptyState message="No credit requests." detail="When a sale on one of your leads was not credited to you, open the lead and press Request sales credit." />
      )}
    </div>
  );
}

function RequestCard({ r }: { r: CreditRequest }) {
  const toast = useToast();
  const [reply, setReply] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const st = REQUEST_STATUS[r.status] || { label: r.status, tone: "neutral" as const };
  const send = useAdminMutation(() => replyRequest(r.id, reply.trim()), {
    onSuccess: () => {
      setReply("");
      toast.show("Answer sent to the owner.");
    },
    invalidates: [salesKeys.requests],
  });
  const question = [...r.decisions].reverse().find((d) => d.action === "needs_info");
  const open = r.status === "pending" || r.status === "needs_info";
  return (
    <li className="min-w-0 rounded-adm-md border border-adm-line bg-adm-surface p-4" data-request={r.id} data-request-status={r.status}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[15px] font-semibold text-adm-ink">{requestKindLabel(r.kind)}</span>
        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
        <span className="adm-num ml-auto text-[12px] text-adm-text-3">Sent {dateText(r.createdAt)}</span>
      </div>
      <p className="mt-1 break-words text-[14px] text-adm-text-2">{r.explanation}</p>
      <p className="mt-2 text-[13px] text-adm-ink" data-request-proposed="">
        Proposed: <span className="adm-num font-semibold">{money(r.proposed.amountCents)}</span> · {r.proposed.countsForBonusDefault ? "Would count toward your bonus" : "Does not count toward the bonus"}
      </p>
      <p className="text-[12px] text-adm-text-3">A claim, not earnings: it pays only if the owner approves it.</p>
      {r.evidence.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[13px] text-adm-text-2">
          {r.evidence.map((e) => (
            <li key={e.id} className="break-words">
              {e.kind === "file" ? `File: ${e.fileName || "attachment"}` : e.kind === "ghl_reference" ? `GHL: ${e.text}` : `Note: ${e.text}`}
            </li>
          ))}
        </ul>
      )}
      {r.decisions
        .filter((d) => d.action !== "submitted")
        .map((d, i) => (
          <p key={i} className="mt-2 break-words rounded-adm-sm bg-adm-sunk px-3 py-2 text-[13px] text-adm-ink">
            <strong>{d.action === "needs_info" ? "Owner asked" : d.action === "employee_reply" ? "You answered" : d.action === "approved" ? `Approved${typeof d.amountCents === "number" ? ` at ${money(d.amountCents)}` : ""}` : d.action === "rejected" ? "Not approved" : "Withdrawn"}</strong>
            {d.reason ? `: ${d.reason}` : ""} <span className="text-adm-text-3">({dateText(d.at)})</span>
          </p>
        ))}
      {r.status === "needs_info" && question && (
        <div className="mt-3 space-y-2" data-request-reply="">
          <Field label="Your answer">
            <Textarea name="request-reply" value={reply} onChange={(e) => setReply(e.target.value)} />
          </Field>
          {send.error ? <Problem>{errorMessage(send.error)}</Problem> : null}
          <Button busy={send.busy} disabled={!reply.trim()} onClick={() => send.mutate(undefined)} data-request-send="">
            Send answer
          </Button>
        </div>
      )}
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          <EvidenceUpload requestId={r.id} />
          <Button variant="destructive" onClick={() => setWithdrawing(true)} data-request-withdraw="">
            Withdraw
          </Button>
        </div>
      )}
      <ConfirmSheet
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title="Withdraw this request?"
        consequence="The owner will no longer review it. You can't reopen a withdrawn request."
        confirmLabel="Withdraw request"
        tone="danger"
        onConfirm={async () => {
          await withdrawRequest(r.id);
          invalidateQueries(salesKeys.requests);
          toast.show("Request withdrawn.");
        }}
        errorText={(e) => errorMessage(e)}
      />
    </li>
  );
}
