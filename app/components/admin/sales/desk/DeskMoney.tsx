"use client";

/*
 * Sales desk money tabs (owner): Reviews (credit requests, held credit,
 * refunds and disputes), Commissions (ledger and adjustments), Payouts
 * (Friday weeks: approve, record payments made OUTSIDE Profixter, CSV) and
 * GHL sync status. Every decision needs a reason; the ledger is append-only
 * on the server, so a correction is always a new adjustment line.
 */
import { ArrowDownTrayIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { errorCode, errorMessage, invalidateQueries, useAdminMutation, useAdminQuery } from "@/lib/admin/query";
import {
  PAYOUT_STATUS,
  REQUEST_STATUS,
  addAdjustment,
  approvePayout,
  dateText,
  dateTimeText,
  dayText,
  decideRequest,
  deskKeys,
  deskPaths,
  dollarsToCents,
  downloadAuthed,
  fetchCommissions,
  fetchGhl,
  fetchPayout,
  fetchPayouts,
  fetchPayoutsWithCheck,
  fetchRequestDetail,
  fetchReviews,
  money,
  newKey,
  nyToday,
  recordPayout,
  requestKindLabel,
  resolveReview,
  retryGhl,
  weekText,
  type PayoutLine,
  type PayoutWeek,
  type Review,
  type SelfReferralSignal,
} from "@/lib/admin/sales";
import { Button, Chip, EmptyState, ErrorState, Field, FilterBar, ListRow, Select, Sheet, SkeletonRows, StatusBadge, TextInput, Textarea, cx, useToast } from "@/app/components/admin/ui";
import { CalcBreakdown, EntryRow, Facts, Notice, Panel, Problem } from "../parts";
import { useTelemarketers } from "./DeskLeads";
import { useDeskParams } from "./SalesDesk";

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.02em] text-adm-text-2">{children}</h3>;
}

const KIND_LABEL: Record<string, string> = { credit_hold: "Held credit", refund: "Refund", dispute: "Chargeback" };

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export function DeskReviews() {
  const { get, set } = useDeskParams();
  const status = get("status") === "resolved" ? "resolved" : "open";
  const q = useAdminQuery(deskKeys.reviews(status), (signal) => fetchReviews(status, signal), { staleTime: 15_000 });
  const request = get("request");
  const review = get("review");
  const d = q.data;
  return (
    <div className="space-y-4" data-desk-tab="reviews">
      <FilterBar label="Status" sticky={false}>
        <Chip onClick={() => set({ status: null })} selected={status === "open"}>
          Waiting for you
        </Chip>
        <Chip onClick={() => set({ status: "resolved" })} selected={status === "resolved"}>
          Decided
        </Chip>
      </FilterBar>
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading reviews" />
      ) : q.error && !d ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : d ? (
        <>
          <section>
            <H>Credit requests ({d.requests.length})</H>
            {d.requests.length ? (
              <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-review-requests="">
                {d.requests.map((r) => {
                  const st = REQUEST_STATUS[r.status] || { label: r.status, tone: "neutral" as const };
                  return (
                    <ListRow
                      key={r.id}
                      onClick={() => set({ request: r.id })}
                      title={`${r.employee.name}: ${requestKindLabel(r.kind)}`}
                      subtitle={`${r.explanation.slice(0, 120)}${r.explanation.length > 120 ? "…" : ""}`}
                      meta={money(r.proposed.amountCents)}
                      footer={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
                      label={`Credit request from ${r.employee.name}`}
                    />
                  );
                })}
              </ul>
            ) : (
              <EmptyState message="No credit requests." />
            )}
          </section>
          <section>
            <H>Held credit, refunds and chargebacks ({d.reviews.length})</H>
            {d.reviews.length ? (
              <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-review-list="">
                {d.reviews.map((r) => (
                  <ListRow key={r.id} onClick={() => set({ review: r.id })} title={KIND_LABEL[r.kind] || r.kind} subtitle={r.summary} meta={dateText(r.createdAt)} footer={<StatusBadge tone={r.kind === "credit_hold" ? "attention" : "problem"}>{r.status === "open" ? "Decide" : "Resolved"}</StatusBadge>} />
                ))}
              </ul>
            ) : (
              <EmptyState message="Nothing to review." />
            )}
          </section>
        </>
      ) : null}
      {request && <RequestSheet id={request} onClose={() => set({ request: null })} />}
      {review && d && <ReviewSheet review={d.reviews.find((r) => r.id === review) || null} onClose={() => set({ review: null })} />}
    </div>
  );
}

function RequestSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const q = useAdminQuery(deskKeys.request(id), (signal) => fetchRequestDetail(id, signal), { staleTime: 10_000 });
  const d = q.data;
  const [action, setAction] = useState<"approved" | "rejected" | "needs_info" | "">("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState<string | null>(null);
  const [bonus, setBonus] = useState<"yes" | "no" | "">("");
  const [checked, setChecked] = useState(false);
  const isChange = d?.sale?.kind === "membership_change_paid";
  const flags = d?.request.selfReferral || [];
  const proposed = d?.request.proposed.amountCents ?? 0;
  const amountText = amount ?? (proposed / 100).toFixed(2);
  const cents = dollarsToCents(amountText);
  const decide = useAdminMutation(
    () =>
      decideRequest(id, {
        action: action as "approved" | "rejected" | "needs_info",
        reason: reason.trim(),
        ...(action === "approved" ? { amountCents: cents ?? undefined, ...(isChange ? { countsForBonus: bonus === "yes" } : {}), ...(flags.length ? { selfReferralCleared: checked } : {}) } : {}),
      }),
    {
      onSuccess: () => {
        toast.show(action === "approved" ? "Approved: the commission is on this week's statement." : action === "rejected" ? "Rejected." : "Question sent to the telemarketer.");
        invalidateQueries(deskKeys.all);
        onClose();
      },
    }
  );
  const open = d && (d.request.status === "pending" || d.request.status === "needs_info");
  const can = Boolean(action) && reason.trim().length > 0 && (action !== "approved" || (cents !== null && cents > 0 && (!isChange || Boolean(bonus)) && (!flags.length || checked)));
  const file = async (fileId: string, name: string) => {
    try {
      await downloadAuthed(deskPaths.requestFile(id, fileId), name || "evidence");
    } catch (e) {
      toast.show(errorMessage(e, "The file could not be downloaded."));
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={d ? `Credit request · ${d.request.employee.name}` : "Credit request"}
      size="full"
      width="wide"
      dirty={Boolean(reason)}
      busy={decide.busy}
      data-sheet="desk-request"
      footer={
        open ? (
          <Button large busy={decide.busy} disabled={!can} onClick={() => decide.mutate(undefined)} data-decide-submit="">
            {action === "approved" ? `Approve ${cents !== null ? money(cents) : ""}` : action === "rejected" ? "Reject" : action === "needs_info" ? "Ask for more info" : "Choose a decision"}
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading the request" />
      ) : q.error && !d ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : d ? (
        <div className="space-y-4" data-request-detail={d.request.id}>
          {flags.length ? <SelfReferralPanel signals={flags} employeeName={d.request.employee.name} /> : null}
          <Panel title={`${requestKindLabel(d.request.kind)} · claim by ${d.request.employee.name}`}>
            <p className="break-words text-[14px] text-adm-ink">{d.request.explanation}</p>
            {d.request.evidence.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-[13px]" data-evidence="">
                {d.request.evidence.map((e) => (
                  <li key={e.id} className="break-words">
                    {e.kind === "file" ? (
                      <Button variant="tertiary" icon={<ArrowDownTrayIcon className="h-5 w-5" />} onClick={() => file(e.id, e.fileName || "evidence")} data-evidence-file={e.id}>
                        {e.fileName || "File"} {e.size ? `(${Math.ceil(e.size / 1024)} KB)` : ""}
                      </Button>
                    ) : (
                      <span className="text-adm-text-2">
                        <strong className="text-adm-ink">{e.kind === "ghl_reference" ? "GHL reference" : "Note"}:</strong> {e.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {d.request.decisions.length > 1 && (
              <ol className="mt-3 space-y-1 text-[13px] text-adm-text-2">
                {d.request.decisions.map((x, i) => (
                  <li key={i}>
                    {dateTimeText(x.at)} · {x.by}: {x.action.replace(/_/g, " ")}
                    {x.reason ? ` · ${x.reason}` : ""}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          {d.sale && (
            <Panel title="The sale (verified by Stripe)" data-request-sale="">
              <Facts
                rows={[
                  ["Sale", d.sale.label],
                  ["Customer", d.customer ? `${d.customer.name} (#${d.customer.userId}), customer since ${dateText(d.customer.since)}` : "—"],
                  ["Paid", dateTimeText(d.sale.paidAt)],
                  ["Payment identity", d.sale.identity === "stripe_customer" ? "Verified: the customer's own Stripe customer" : d.sale.identity === "checkout_account" ? "Verified: paid at checkout while signed in" : "Not verified"],
                  ["Discount source", d.sale.discount?.source || "None"],
                  ["Returning customer", d.sale.returningCustomer ? "Yes" : "No"],
                  ["Credit now", d.currentCredit ? `${d.currentCredit.status}${d.currentCredit.reason ? ` (${d.currentCredit.reason.replace(/_/g, " ")})` : ""}` : "None"],
                  ["Stripe", `${d.sale.stripe.invoiceId || "—"}${d.sale.stripe.billingReason ? ` · ${d.sale.stripe.billingReason}` : ""}`],
                ]}
              />
              <div className="mt-3">
                <CalcBreakdown calc={{ regularCents: d.sale.amounts.regularCents, discountCents: d.sale.amounts.discountCents, discountSource: d.sale.discount?.source || "", paidPreTaxCents: d.sale.amounts.paidPreTaxCents, taxCents: d.sale.amounts.taxCents, explain: "", rule: null }} />
              </div>
            </Panel>
          )}
          <Panel title="Proposed commission">
            <p className="adm-num text-[20px] font-semibold text-adm-ink" data-proposed-amount="">
              {money(d.request.proposed.amountCents)}
            </p>
            {d.request.proposed.detail && <p className="mt-0.5 break-words text-[13px] text-adm-text-2">{d.request.proposed.detail}</p>}
            <p className="mt-2 text-[13px] text-adm-ink" data-bonus-effect="">
              {d.bonusEffect}
            </p>
          </Panel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Membership history">
              {d.membershipHistory.length ? (
                <ul className="space-y-1 text-[13px]">
                  {d.membershipHistory.map((m, i) => (
                    <li key={i}>
                      {m.plan} {m.cycle} · {m.status}
                      {m.complimentary ? " (complimentary)" : ""} · {dateText(m.startDate)}
                      {m.endedOn ? ` – ${dateText(m.endedOn)}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-adm-text-2">None.</p>
              )}
            </Panel>
            <Panel title="Previous commissions">
              {d.previousCommissions.length ? (
                <ul className="space-y-1 text-[13px]">
                  {d.previousCommissions.map((p) => (
                    <li key={p.id}>
                      {p.employee}: {money(p.amountCents)} · {p.kind} · {p.status} · {dateText(p.paidAt)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-adm-text-2">None on this customer.</p>
              )}
            </Panel>
            <Panel title="Previous sales">
              {d.previousSales.length ? (
                <ul className="space-y-1 text-[13px]">
                  {d.previousSales.map((s) => (
                    <li key={s.id}>
                      {s.label} · {money(s.amountCents)} · {dateText(s.paidAt)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-adm-text-2">None.</p>
              )}
            </Panel>
          </div>
          {open ? (
            <Panel title="Decision" data-decision="">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Decision">
                {(
                  [
                    ["approved", "Approve"],
                    ["rejected", "Reject"],
                    ["needs_info", "Ask for more info"],
                  ] as const
                ).map(([v, l]) => (
                  <Chip key={v} onClick={() => setAction(v)} selected={action === v}>
                    {l}
                  </Chip>
                ))}
              </div>
              {action === "approved" && (
                <div className="mt-3 space-y-3">
                  <Field label="Commission (dollars)" help="Prefilled with the proposal; change it if needed." error={cents === null ? "Enter an amount like 45.00" : undefined}>
                    <TextInput name="decide-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                  {flags.length ? (
                    <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-adm-md border border-adm-attn bg-adm-attn-bg p-3" data-self-referral-confirm="">
                      <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[var(--adm-accent)]" />
                      <span className="text-[14px] text-adm-ink">I checked the self-referral signals above and this is a genuine sale.</span>
                    </label>
                  ) : null}
                  {isChange && (
                    <fieldset className="rounded-adm-md border border-adm-attn bg-adm-attn-bg p-3" data-bonus-choice="">
                      <legend className="px-1 text-[14px] font-semibold text-adm-ink">Does this plan change count toward the 20-membership bonus?</legend>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(
                          [
                            ["yes", "Yes, count it"],
                            ["no", "No, commission only"],
                          ] as const
                        ).map(([v, l]) => (
                          <label key={v} className={cx("flex min-h-[44px] cursor-pointer items-center gap-2 rounded-adm-sm border bg-adm-surface px-3", bonus === v ? "border-adm-accent" : "border-adm-line")}>
                            <input type="radio" name="counts-for-bonus" value={v} checked={bonus === v} onChange={() => setBonus(v)} className="h-5 w-5 accent-[var(--adm-accent)]" data-counts-for-bonus={v} />
                            <span className="text-[14px]">{l}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              )}
              {action && (
                <Field label={action === "needs_info" ? "Your question" : "Reason"} required className="mt-3">
                  <Textarea name="decide-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
              )}
              {decide.error ? <div className="mt-2"><Problem code={errorCode(decide.error)}>{errorMessage(decide.error)}</Problem></div> : null}
            </Panel>
          ) : (
            <Notice>This request is {REQUEST_STATUS[d.request.status]?.label.toLowerCase() || d.request.status}.</Notice>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}

const STRENGTH: Record<string, string> = { same_person: "May be the employee", payment: "Shared card", household: "Possible household member" };

/** The self-referral signals for the owner: flags to check, never a verdict. */
function SelfReferralPanel({ signals, employeeName }: { signals: SelfReferralSignal[]; employeeName: string }) {
  return (
    <Panel title="Self-referral check" data-self-referral="">
      <ul className="space-y-2 text-[14px]">
        {signals.map((s) => (
          <li key={s.code} className="flex flex-wrap items-start gap-2" data-self-referral-signal={s.code}>
            <StatusBadge tone="attention">{STRENGTH[s.strength] || "Check"}</StatusBadge>
            <span className="min-w-0 flex-1 break-words text-adm-ink">{s.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-adm-text-2">
        Compared with {employeeName}'s own details. A relative, a housemate or a neighbour can be a genuine customer: check, then credit it or not with a reason. Nothing was refused automatically.
      </p>
    </Panel>
  );
}

function ReviewSheet({ review, onClose }: { review: Review | null; onClose: () => void }) {
  const toast = useToast();
  const people = useTelemarketers();
  const names = useMemo(() => new Map((people.data || []).map((p) => [p.id, p.name])), [people.data]);
  const [decision, setDecision] = useState("");
  const [employee, setEmployee] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const hold = review?.kind === "credit_hold";
  const cents = dollarsToCents(amount, { allowNegative: true });
  const go = useAdminMutation(
    () =>
      resolveReview(review!.id, hold ? { decision: decision === "no_credit" ? "no_credit" : "credit", employeeId: decision === "no_credit" ? undefined : decision, reason: reason.trim() } : { action: decision, ...(decision === "adjust" ? { amountCents: cents, employeeId: employee } : {}), reason: reason.trim() }),
    {
      onSuccess: () => {
        toast.show("Review resolved.");
        invalidateQueries(deskKeys.all);
        onClose();
      },
    }
  );
  if (!review)
    return (
      <Sheet open onClose={onClose} title="Review" data-sheet="desk-review">
        <EmptyState message="This review is not in the current list." />
      </Sheet>
    );
  const can = Boolean(decision) && reason.trim().length > 0 && (hold || decision !== "adjust" || (cents !== null && cents !== 0 && Boolean(employee)));
  const e = review.effects;
  return (
    <Sheet
      open
      onClose={onClose}
      title={KIND_LABEL[review.kind] || "Review"}
      width="wide"
      size="full"
      dirty={Boolean(reason)}
      busy={go.busy}
      data-sheet="desk-review"
      footer={
        review.status === "open" ? (
          <Button large busy={go.busy} disabled={!can} onClick={() => go.mutate(undefined)} data-review-submit="">
            Resolve
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4" data-review-detail={review.id}>
        <p className="break-words text-[14px] text-adm-ink">{review.summary}</p>
        {hold && e.selfReferral?.length
          ? e.selfReferral.map((x) => <SelfReferralPanel key={x.employee} signals={x.signals} employeeName={x.employeeName || names.get(x.employee) || "the employee"} />)
          : null}
        {hold ? (
          <Panel title="Who gets credit?">
            <div className="space-y-2" role="radiogroup" aria-label="Credit decision">
              {(e.claimants || []).map((c) => (
                <label key={c.employee} className={cx("flex min-h-[44px] cursor-pointer items-center gap-2 rounded-adm-sm border px-3", decision === c.employee ? "border-adm-accent" : "border-adm-line")}>
                  <input type="radio" name="hold-decision" checked={decision === c.employee} onChange={() => setDecision(c.employee)} className="h-5 w-5 accent-[var(--adm-accent)]" data-hold-claimant={c.employee} />
                  <span className="text-[14px]">
                    {c.name || names.get(c.employee) || "Employee"} <span className="text-adm-text-2">({c.basis.replace(/_/g, " ")})</span>
                  </span>
                </label>
              ))}
              <label className={cx("flex min-h-[44px] cursor-pointer items-center gap-2 rounded-adm-sm border px-3", decision === "no_credit" ? "border-adm-accent" : "border-adm-line")}>
                <input type="radio" name="hold-decision" checked={decision === "no_credit"} onChange={() => setDecision("no_credit")} className="h-5 w-5 accent-[var(--adm-accent)]" data-hold-claimant="none" />
                <span className="text-[14px]">No credit</span>
              </label>
            </div>
          </Panel>
        ) : (
          <>
            <Panel title="What this touched" data-review-effects="">
              <Notice tone="attention">{e.note || "Nothing is deducted automatically. Earned commission and bonuses stay unless you record an adjustment."}</Notice>
              <H>Commissions</H>
              {e.commissions?.length ? (
                <ul className="mb-3 space-y-1 text-[13px]">
                  {e.commissions.map((c) => (
                    <li key={c.id}>
                      {names.get(c.employee) || "Employee"}: {money(c.amountCents)} · {c.status} · week of {dayText(c.statementWeek)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-[13px] text-adm-text-2">No commission on this sale.</p>
              )}
              <H>Bonuses that counted it</H>
              {e.bonuses?.length ? (
                <ul className="space-y-1 text-[13px]">
                  {e.bonuses.map((b) => (
                    <li key={b.id}>
                      {names.get(b.employee) || "Employee"}: {money(b.amountCents)} · {b.status} · {(b.periodIndex ?? 0) >= 0 ? `bonus month ${(b.periodIndex ?? 0) + 1}` : "a bonus month before their first counted sale"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-adm-text-2">None.</p>
              )}
            </Panel>
            <Panel title="Your decision">
              <div className="flex flex-wrap gap-2">
                <Chip onClick={() => setDecision("no_change")} selected={decision === "no_change"}>
                  No change
                </Chip>
                <Chip onClick={() => setDecision("adjust")} selected={decision === "adjust"}>
                  Adjustment
                </Chip>
              </div>
              {decision === "adjust" && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Employee">
                    <Select name="review-employee" value={employee} onChange={(ev) => setEmployee(ev.target.value)} options={[{ value: "", label: "Choose…" }, ...(people.data || []).map((p) => ({ value: p.id, label: p.name }))]} />
                  </Field>
                  <Field label="Amount (dollars, negative to reduce)" error={amount && (cents === null || cents === 0) ? "Like -45.00" : undefined}>
                    <TextInput name="review-amount" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder="-45.00" />
                  </Field>
                </div>
              )}
            </Panel>
          </>
        )}
        {review.status === "open" && (
          <Field label="Reason" required>
            <Textarea name="review-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
        )}
        {go.error ? <Problem code={errorCode(go.error)}>{errorMessage(go.error)}</Problem> : null}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Commissions                                                         */
/* ------------------------------------------------------------------ */

export function DeskCommissions() {
  const { get, set } = useDeskParams();
  const employee = get("emp");
  const week = get("week");
  const people = useTelemarketers();
  const weeks = useAdminQuery(deskKeys.payouts, fetchPayouts, { staleTime: 30_000 });
  const q = useAdminQuery(deskKeys.commissions(employee, week), (signal) => fetchCommissions(employee, week, signal), { staleTime: 15_000 });
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3" data-desk-tab="commissions">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Telemarketer" className="min-w-[180px] flex-1">
          <Select name="comm-employee" value={employee} onChange={(e) => set({ emp: e.target.value || null })} options={[{ value: "", label: "Everyone" }, ...(people.data || []).map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
        <Field label="Statement week" className="min-w-[180px] flex-1">
          <Select name="comm-week" value={week} onChange={(e) => set({ week: e.target.value || null })} options={[{ value: "", label: "All weeks" }, ...(weeks.data || []).map((w) => ({ value: w.week, label: weekText(w.week, w.lastDay) }))]} />
        </Field>
        <Button icon={<PlusIcon className="h-5 w-5" />} onClick={() => setAdding(true)} data-adjust-open="">
          Add adjustment
        </Button>
      </div>
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading commissions" />
      ) : q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : q.data?.length ? (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-commission-list="">
          {q.data.map((e) => (
            <EntryRow key={e.id} e={e} showEmployee />
          ))}
        </ul>
      ) : (
        <EmptyState message="No ledger lines here." />
      )}
      {adding && <AdjustmentSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

function AdjustmentSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const people = useTelemarketers();
  // One key per sheet: a retry after a network failure can never add the line twice.
  const [key] = useState(newKey);
  const [employee, setEmployee] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const cents = dollarsToCents(amount, { allowNegative: true });
  const go = useAdminMutation(() => addAdjustment({ employeeId: employee, amountCents: cents as number, reason: reason.trim(), idempotencyKey: key }), {
    onSuccess: () => {
      toast.show("Adjustment added to the open statement.");
      invalidateQueries(deskKeys.all);
      onClose();
    },
  });
  const can = Boolean(employee) && cents !== null && cents !== 0 && reason.trim().length >= 3;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Add adjustment"
      dirty={Boolean(amount || reason)}
      busy={go.busy}
      data-sheet="desk-adjust"
      footer={
        <Button large busy={go.busy} disabled={!can} onClick={() => go.mutate(undefined)} data-adjust-submit="">
          {cents ? `Add ${money(cents)}` : "Add adjustment"}
        </Button>
      }
    >
      <div className="space-y-3">
        <Notice>An adjustment is a new line on the employee&apos;s next open statement. Earlier lines never change.</Notice>
        <Field label="Employee" required>
          <Select name="adjust-employee" value={employee} onChange={(e) => setEmployee(e.target.value)} options={[{ value: "", label: "Choose…" }, ...(people.data || []).map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
        <Field label="Amount (dollars; negative reduces)" required error={amount && (cents === null || cents === 0) ? "Like 25.00 or -25.00" : undefined}>
          <TextInput name="adjust-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Reason" required>
          <Textarea name="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {go.error ? <Problem code={errorCode(go.error)}>{errorMessage(go.error)}</Problem> : null}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

export function DeskPayouts() {
  const { get, set } = useDeskParams();
  const week = get("week");
  const q = useAdminQuery(deskKeys.payouts, fetchPayouts, { staleTime: 15_000 });
  const check = useAdminQuery(deskKeys.payoutsCheck, fetchPayoutsWithCheck, { staleTime: 15_000 });
  const integrity = check.data?.integrity;
  return (
    <div className="space-y-3" data-desk-tab="payouts">
      <Notice>Weeks run Friday to Thursday. Approve a finished week to freeze its statements, pay people the way you normally do, then record each payment here. Weeks are approved oldest first, so no earnings are skipped. Profixter does not move money.</Notice>
      {integrity && !integrity.ok ? (
        <Problem code="ledger_check">
          The ledger check found {integrity.problems.length} problem{integrity.problems.length === 1 ? "" : "s"}. Do not record payments until it is fixed: {integrity.problems.slice(0, 3).join("; ")}
        </Problem>
      ) : integrity?.ok && integrity.approvedWeeks > 0 ? (
        <p className="text-[13px] text-adm-text-2" data-ledger-check="ok">
          Ledger check passed: every approved week holds each of its earnings exactly once, and no earnings are stranded on an older week.
        </p>
      ) : null}
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading payouts" />
      ) : q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : q.data?.length ? (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-payout-weeks="">
          {q.data.map((w) => {
            const st = PAYOUT_STATUS[w.status] || { label: w.status, tone: "neutral" as const };
            return (
              <ListRow
                key={w.week}
                onClick={() => set({ week: w.week })}
                title={weekText(w.week, w.lastDay)}
                subtitle={`Payday ${dayText(w.payday)} · ${w.employees} employee${w.employees === 1 ? "" : "s"}${w.unpaid !== null ? ` · ${w.unpaid} unpaid` : ""}`}
                meta={money(w.totalCents)}
                footer={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
              />
            );
          })}
        </ul>
      ) : (
        <EmptyState message="No payout weeks yet." />
      )}
      {week && <PayoutSheet week={week} onClose={() => set({ week: null })} />}
    </div>
  );
}

function PayoutSheet({ week, onClose }: { week: string; onClose: () => void }) {
  const toast = useToast();
  const q = useAdminQuery(deskKeys.payout(week), (signal) => fetchPayout(week, signal), { staleTime: 10_000 });
  const [step, setStep] = useState<{ kind: "view" } | { kind: "approve" } | { kind: "pay"; line: PayoutLine }>({ kind: "view" });
  const p = q.data;
  const back = () => setStep({ kind: "view" });
  const after = () => {
    invalidateQueries(deskKeys.all);
    setStep({ kind: "view" });
  };
  const csv = async () => {
    try {
      await downloadAuthed(deskPaths.payoutCsv(week), `payout-${week}.csv`);
    } catch (e) {
      toast.show(errorMessage(e, "The CSV could not be downloaded."));
    }
  };
  return (
    <Sheet open onClose={onClose} title={p ? `Payout · ${weekText(p.week, p.lastDay)}` : "Payout week"} size="full" width="wide" data-sheet="desk-payout">
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading the week" />
      ) : q.error && !p ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : p ? (
        step.kind === "approve" ? (
          <ApproveStep p={p} onBack={back} onDone={after} />
        ) : step.kind === "pay" ? (
          <PayStep week={p.week} line={step.line} onBack={back} onDone={after} />
        ) : (
          <div className="space-y-4" data-payout={p.week} data-payout-status={p.status}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={PAYOUT_STATUS[p.status]?.tone || "neutral"}>{PAYOUT_STATUS[p.status]?.label || p.status}</StatusBadge>
              <span className="text-[13px] text-adm-text-2">
                Payday {dayText(p.payday)}
                {p.approvedAt ? ` · approved ${dateTimeText(p.approvedAt)}${p.approvedByName ? ` by ${p.approvedByName}` : ""}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.status === "ready" && (
                <Button onClick={() => setStep({ kind: "approve" })} data-approve-open="">
                  Approve week
                </Button>
              )}
              {p.status === "approved" && (
                <Button variant="secondary" icon={<ArrowDownTrayIcon className="h-5 w-5" />} onClick={csv} data-payout-csv="">
                  Export CSV for payroll
                </Button>
              )}
              {p.status === "accruing" && <p className="text-[13px] text-adm-text-2">This week is still running; it can be approved from payday, {dayText(p.payday)}.</p>}
            </div>
            <section>
              <H>Lines</H>
              {p.lines.length ? (
                <ul className="space-y-2" data-payout-lines="">
                  {p.lines.map((l) => (
                    <li key={l.employee} className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-3" data-payout-line={l.employee} data-paid={l.payment?.status === "paid" ? "true" : "false"}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-adm-ink">{l.employeeName}</span>
                        <span className="adm-num ml-auto text-[16px] font-semibold text-adm-ink">{money(l.totalCents)}</span>
                      </div>
                      <p className="adm-num text-[13px] text-adm-text-2">
                        Commission {money(l.commissionCents)} · Bonus {money(l.bonusCents)} · Adjustments {money(l.adjustmentCents)} · {l.entries.length} line{l.entries.length === 1 ? "" : "s"}
                      </p>
                      {p.status === "approved" &&
                        (l.payment?.status === "paid" ? (
                          <p className="mt-1 text-[13px] text-adm-ok" data-payment-recorded="">
                            Paid {dayText(l.payment.paidOn)} by {l.payment.method}
                            {l.payment.reference ? ` (ref. ${l.payment.reference})` : ""}
                            {l.payment.recordedByName ? ` · recorded by ${l.payment.recordedByName}` : ""}
                          </p>
                        ) : (
                          <Button className="mt-2" variant="secondary" onClick={() => setStep({ kind: "pay", line: l })} data-record-payment={l.employee}>
                            Record payment
                          </Button>
                        ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState message="Nobody has anything on this week." />
              )}
            </section>
            {p.entries.length > 0 && (
              <section>
                <H>Entries</H>
                <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line">
                  {p.entries.map((e) => (
                    <EntryRow key={e.id} e={{ ...e, employee: p.lines.find((l) => l.employee === e.employee)?.employeeName || "" }} showEmployee />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )
      ) : null}
    </Sheet>
  );
}

function ApproveStep({ p, onBack, onDone }: { p: PayoutWeek; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const total = p.lines.reduce((s, l) => s + l.totalCents, 0);
  const go = useAdminMutation(() => approvePayout(p.week), {
    onSuccess: () => {
      toast.show("Week approved. Statements are frozen.");
      onDone();
    },
  });
  return (
    <div className="space-y-4" data-approve-step="">
      <p className="text-[15px] leading-relaxed text-adm-ink">
        Approve {weekText(p.week, p.lastDay)}: {money(total)} for {p.lines.length} employee{p.lines.length === 1 ? "" : "s"}.
      </p>
      <Notice tone="attention">Approving freezes these statements: their lines and totals never change afterwards. Anything earned for this week later goes on the next open week, marked late. Approving does not pay anyone.</Notice>
      {go.error ? <Problem code={errorCode(go.error)}>{errorMessage(go.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        <Button large busy={go.busy} onClick={() => go.mutate(undefined)} data-approve-confirm="">
          Approve and freeze
        </Button>
        <Button large variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function PayStep({ week, line, onBack, onDone }: { week: string; line: PayoutLine; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const [paidOn, setPaidOn] = useState(nyToday);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const go = useAdminMutation(() => recordPayout(week, line.employee, { paidOn, method: method.trim(), reference: reference.trim() }), {
    onSuccess: () => {
      toast.show(`Payment to ${line.employeeName} recorded.`);
      onDone();
    },
  });
  return (
    <div className="space-y-4" data-pay-step={line.employee}>
      <p className="text-[15px] text-adm-ink">
        {line.employeeName}: <span className="adm-num font-semibold">{money(line.totalCents)}</span>
      </p>
      <Notice tone="attention">Profixter does not send money. Record a payment you have already made (payroll, check or transfer). It can be recorded once.</Notice>
      <Field label="Date paid" required>
        <TextInput name="paid-on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      </Field>
      <Field label="How it was paid" required>
        <TextInput name="paid-method" list="pay-methods" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Payroll, check, transfer…" />
      </Field>
      <datalist id="pay-methods">
        <option value="Payroll" />
        <option value="Check" />
        <option value="Bank transfer" />
        <option value="Zelle" />
      </datalist>
      <Field label="Reference (optional)">
        <TextInput name="paid-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      {go.error ? <Problem code={errorCode(go.error)}>{errorMessage(go.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        <Button large busy={go.busy} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || !method.trim()} onClick={() => go.mutate(undefined)} data-pay-submit="">
          Record payment
        </Button>
        <Button large variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GHL                                                                 */
/* ------------------------------------------------------------------ */

export function DeskGhl() {
  const toast = useToast();
  const q = useAdminQuery(deskKeys.ghl, fetchGhl, { staleTime: 15_000 });
  const retry = useAdminMutation((id: string) => retryGhl(id), {
    onSuccess: (ev) => toast.show(`Retried: ${ev?.status || "done"}.`),
    invalidates: [deskKeys.ghl],
  });
  const g = q.data;
  const yes = (v: boolean) => (v ? <StatusBadge tone="success">Yes</StatusBadge> : <StatusBadge tone="neutral">No</StatusBadge>);
  return (
    <div className="space-y-4" data-desk-tab="ghl">
      {q.isLoading ? (
        <SkeletonRows count={3} label="Loading GHL status" />
      ) : q.error && !g ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : g ? (
        <>
          {!g.liveVerified && (
            <div role="status" className="rounded-adm-md border-2 border-adm-attn bg-adm-attn-bg px-4 py-3" data-ghl-live="pending">
              <p className="text-[16px] font-semibold text-adm-attn">Live verification pending</p>
              <p className="mt-1 text-[14px] text-adm-ink">{g.liveNote}</p>
            </div>
          )}
          <Panel title="Inbound sync">
            <Facts
              rows={[
                ["Sync enabled", yes(g.enabled)],
                ["Signature key configured", yes(g.signatureKeyConfigured)],
                ["Location configured", yes(g.locationConfigured)],
                ["Last event received", g.lastReceivedAt ? dateTimeText(g.lastReceivedAt) : "Never"],
              ]}
            />
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" data-ghl-counts="">
              {["received", "processed", "ignored", "unmapped", "failed"].map((k) => (
                <div key={k} className="rounded-adm-sm border border-adm-line px-2.5 py-2">
                  <dt className="text-[12px] capitalize text-adm-text-2">{k}</dt>
                  <dd className="adm-num text-[16px] font-semibold text-adm-ink">{g.counts[k] || 0}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[12px] text-adm-text-3">Only call and text metadata is stored (never message text or recordings).</p>
          </Panel>
          <Panel title={`Failures (${g.failures.length})`}>
            {g.failures.length ? (
              <ul className="space-y-2" data-ghl-failures="">
                {g.failures.map((f) => (
                  <li key={f._id} className="flex flex-wrap items-center gap-2 rounded-adm-sm border border-adm-line px-3 py-2 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-adm-ink">
                        {f.type} · contact {f.contactId}
                      </p>
                      <p className="break-words text-adm-text-2">
                        {f.attempts} attempts · {f.lastError} · received {dateTimeText(f.receivedAt)}
                      </p>
                    </div>
                    <Button variant="secondary" busy={retry.busy} onClick={() => retry.mutate(f._id)} data-ghl-retry={f._id}>
                      Retry
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-text-2">No failures.</p>
            )}
            {retry.error ? <div className="mt-2"><Problem>{errorMessage(retry.error)}</Problem></div> : null}
          </Panel>
          <Panel title={`Unmapped contacts (${g.unmapped.length})`}>
            {g.unmapped.length ? (
              <ul className="space-y-1 text-[13px]" data-ghl-unmapped="">
                {g.unmapped.map((u) => (
                  <li key={u.contactId}>
                    <span className="font-mono">{u.contactId}</span> · {u.events} event{u.events === 1 ? "" : "s"} · last {dateTimeText(u.lastAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-text-2">Every GHL contact that sent events is mapped to a lead.</p>
            )}
            <p className="mt-2 text-[12px] text-adm-text-3">Map a contact from the lead (Leads › open the lead › GHL contact); its waiting events are replayed then.</p>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
