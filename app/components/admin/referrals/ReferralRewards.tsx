"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  ListRow,
  MoneyBlock,
  PageHeader,
  Section,
  SkeletonRows,
  StatusBadge,
  TextInput,
  Textarea,
  useToast,
} from "@/app/components/admin/ui";
import type { StatusTone } from "@/app/components/admin/ui";
import { useAdminQuery } from "@/lib/admin/query";
import {
  acknowledgeReward,
  approveReward,
  cents,
  clearRewardFlags,
  confirmRewardPayee,
  fetchReward,
  fetchRewards,
  markRewardMailed,
  readRewardError,
  recheckReward,
  voidReward,
  type RewardDetail,
  type RewardFilter,
  type RewardInvoice,
  type RewardRow,
  type RewardStatus,
} from "@/lib/admin/referrals";

/**
 * Admin > Referrals (owner only). Ready rewards first: who referred whom, the
 * amount, both payments, any flags, and where the check goes. Approve and
 * Mark mailed each re-read Stripe on the server first (routes/adminReferrals).
 * The owner writes and mails the check; nothing here moves money.
 */

const TONE: Record<RewardStatus, StatusTone> = {
  attributed: "neutral",
  pending: "info",
  eligible: "attention",
  approved: "info",
  mailed: "success",
  void: "neutral",
  not_eligible: "neutral",
};
const FILTERS: { key: RewardFilter; label: string }[] = [
  { key: "ready", label: "Ready" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "mailed", label: "Mailed" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-");
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

function Badges({ r }: { r: RewardRow }) {
  return (
    <>
      <StatusBadge tone={TONE[r.status]}>{r.statusLabel}</StatusBadge>
      {r.attention ? <StatusBadge tone="problem">Needs a look</StatusBadge> : null}
      {r.flagCount && !r.flagsCleared ? <StatusBadge tone="attention">{`${r.flagCount} flag${r.flagCount === 1 ? "" : "s"}`}</StatusBadge> : null}
      {r.status === "eligible" && !r.payeeConfirmed ? <StatusBadge tone="neutral">No payee yet</StatusBadge> : null}
    </>
  );
}

export function ReferralRewards() {
  const [filter, setFilter] = useState<RewardFilter>("ready");
  const q = useAdminQuery(["referral-rewards", filter], (signal) => fetchRewards(filter, signal), { staleTime: 15_000 });
  const counts = q.data?.counts;
  return (
    <div data-section="referrals" className="space-y-3">
      <PageHeader title="Referrals" description="Rewards for customers whose friends joined. Approve, then mail the check yourself." />
      <FilterBar label="Referral rewards">
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            onClick={() => setFilter(f.key)}
            selected={filter === f.key}
            tone={f.key === "ready" && (counts?.ready || counts?.attention) ? "attention" : "default"}
            count={f.key === "ready" ? (counts ? counts.ready + counts.attention : undefined) : f.key === "pending" ? counts?.pending : f.key === "approved" ? counts?.approved : undefined}
          >
            {f.label}
          </Chip>
        ))}
      </FilterBar>
      {q.isLoading ? (
        <SkeletonRows count={4} />
      ) : q.error ? (
        <ErrorState message="Referral rewards couldn't be loaded." onRetry={q.refetch} />
      ) : !q.data?.rewards.length ? (
        <EmptyState message={filter === "ready" ? "Nothing to approve" : "No referrals here"} detail={filter === "ready" ? "When a referred friend's second membership payment clears, the reward appears here." : undefined} />
      ) : (
        <Section>
          <ul role="list" data-referral-list="">
            {q.data.rewards.map((r) => (
              <ListRow
                key={r.id}
                href={`/admin/referrals/${r.id}`}
                title={r.referrer?.name || "Customer"}
                subtitle={`Referred ${r.referred?.name || "a friend"}${r.plan ? ` · ${r.plan}${r.cycle === "annual" ? " annual" : ""}` : ""}${r.secondPaidAt ? ` · 2nd payment ${day(r.secondPaidAt)}` : r.firstPaidAt ? ` · 1st payment ${day(r.firstPaidAt)}` : ""}`}
                meta={r.amountCents ? cents(r.amountCents) : undefined}
                footer={<Badges r={r} />}
              />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function InvoiceRows({ label, inv }: { label: string; inv: RewardInvoice | null }) {
  if (!inv) return <p className="text-[14px] text-adm-text-2">{label}: not yet.</p>;
  return (
    <MoneyBlock
      title={`${label} · ${day(inv.paidAt)}`}
      rows={[
        { label: `${inv.plan || "Membership"}${inv.cycle === "annual" ? " (annual)" : ""}`, cents: inv.baseCents, note: inv.billingReason === "subscription_create" ? "First invoice" : "Renewal" },
        ...(inv.discountCents ? [{ label: "Discount", cents: -inv.discountCents, note: inv.discountSource || undefined }] : []),
        { label: "Membership paid, before tax", cents: inv.paidPreTaxCents },
        { label: "Tax (not counted)", cents: inv.taxCents },
        ...(inv.refundedCents ? [{ label: "Refunded", cents: -inv.refundedCents, note: `${cents(inv.refundedPreTaxCents)} of it before tax`, tone: "problem" as const }] : []),
      ]}
      footer={
        <span>
          {inv.disputed ? <b className="text-adm-problem">Chargeback open. </b> : null}
          <a className="text-adm-accent-ink underline-offset-2 hover:underline" href={inv.stripeUrl} target="_blank" rel="noreferrer">
            Invoice {inv.invoiceId} in Stripe
          </a>
        </span>
      }
    />
  );
}

export function ReferralRewardDetail({ id }: { id: string }) {
  const toast = useToast();
  const q = useAdminQuery(["referral-rewards", "one", id], (signal) => fetchReward(id, signal), { staleTime: 5_000 });
  const [override, setOverride] = useState<RewardDetail | null>(null);
  const r = override && override.id === id && (!q.data || Date.parse(override.updatedAt) >= Date.parse(q.data.updatedAt)) ? override : q.data;
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState<{ message: string; changes: string[] } | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [payeeOpen, setPayeeOpen] = useState(false);
  const [payee, setPayee] = useState({ name: "", line1: "", line2: "", city: "", state: "NY", zip: "", note: "" });
  const [checked, setChecked] = useState(false);
  const [check, setCheck] = useState({ reference: "", mailedAt: new Date().toISOString().slice(0, 10), note: "" });
  const [voidReason, setVoidReason] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);

  if (q.isLoading && !r) return <SkeletonRows count={6} />;
  if (q.error && !r) return <ErrorState message="This referral couldn't be loaded." onRetry={q.refetch} />;
  if (!r) return null;

  const run = async (name: string, fn: () => Promise<{ reward: RewardDetail; ok?: boolean; changes?: string[] }>, done?: string) => {
    setBusy(name);
    setProblem(null);
    try {
      const res = await fn();
      setOverride(res.reward);
      if (res.ok === false) setProblem({ message: "Stripe shows something different now:", changes: res.changes || [] });
      else if (done) toast.show(done);
      void q.refetch();
      return true;
    } catch (err) {
      const e = readRewardError(err);
      if (e.reward) setOverride(e.reward);
      setProblem({ message: e.message, changes: e.changes });
      void q.refetch();
      return false;
    } finally {
      setBusy("");
    }
  };

  const blocking = r.flags.filter((f) => f.strength !== "info");
  const open = ["attributed", "pending", "eligible", "approved"].includes(r.status);

  return (
    <div data-section="referrals" data-referral-detail={r.status} className="space-y-3">
      <Link href="/admin/referrals" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-adm-text-2">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Referrals
      </Link>
      <PageHeader
        title={`${r.referrer?.name || "Customer"}: ${cents(r.status === "mailed" ? r.approval?.amountCents || r.amountCents : r.amountCents)}`}
        description={`Referred ${r.referred?.name || "a friend"} · link ${r.code} · recorded ${day(r.createdAt)}`}
        actions={<Badges r={r} />}
      />

      {r.attention ? (
        <Card className="border-adm-problem bg-adm-problem-bg">
          <p className="text-[14px] text-adm-ink" data-referral-attention="">
            {r.attention}
          </p>
          <div className="mt-2">
            <Button variant="secondary" busy={busy === "ack"} onClick={() => run("ack", () => acknowledgeReward(id, { note: "Seen" }), "Marked as seen.")}>
              Mark as seen
            </Button>
          </div>
        </Card>
      ) : null}
      {problem ? (
        <Card className="border-adm-attn bg-adm-attn-bg">
          <p className="text-[14px] font-semibold text-adm-ink" role="alert">
            {problem.message}
          </p>
          {problem.changes.length ? (
            <ul className="mt-1 list-disc pl-5 text-[14px] text-adm-ink" data-referral-changes="">
              {problem.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Who">
          <dl className="grid gap-2 text-[14px]">
            <div>
              <dt className="text-adm-text-3">Referrer</dt>
              <dd className="text-adm-ink">
                {r.referrer ? (
                  <Link className="font-semibold text-adm-accent-ink underline-offset-2 hover:underline" href={`/admin/customers/${r.referrer.id}`}>
                    {r.referrer.name}
                  </Link>
                ) : (
                  "Deleted account"
                )}
                {r.referrer ? <span className="block text-adm-text-2">{[r.referrer.phone, r.referrer.email].filter(Boolean).join(" · ")}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-adm-text-3">Friend</dt>
              <dd className="text-adm-ink">
                {r.referred ? (
                  <Link className="font-semibold text-adm-accent-ink underline-offset-2 hover:underline" href={`/admin/customers/${r.referred.id}`}>
                    {r.referred.name}
                  </Link>
                ) : (
                  "Deleted account"
                )}
                {r.referred ? <span className="block text-adm-text-2">{[r.referred.phone, r.referred.email].filter(Boolean).join(" · ")}</span> : null}
              </dd>
            </div>
          </dl>
        </Card>

        <MoneyBlock
          title="Reward"
          rows={[
            { label: "First membership payment, before tax", cents: (r.first?.paidPreTaxCents || 0) - (r.first?.refundedPreTaxCents || 0), note: r.first?.refundedPreTaxCents ? "after refunds" : undefined },
            { label: "Cap", cents: r.capCents },
            { label: "Reward (the lesser)", cents: r.amountCents, strong: true },
          ]}
          footer={
            r.status === "pending"
              ? r.rule === "annual"
                ? `Annual plan: ready after 60 days of active membership (${day(r.qualifiesAt)}), if the payment still stands.`
                : "Waiting for the friend's second paid membership payment."
              : r.reason
                ? r.reason
                : r.lastRecheck
                  ? `Checked against Stripe ${when(r.lastRecheck.at)}${r.lastRecheck.ok ? ": matches." : "."}`
                  : "Stripe is checked again before you approve and before you mark the check mailed."
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <InvoiceRows label="1st payment" inv={r.first} />
        {r.rule === "annual" ? (
          <Card title="Annual plan: 60 days of active membership">
            <dl className="grid gap-1 text-[14px]" data-referral-annual="">
              <div className="flex justify-between gap-3">
                <dt className="text-adm-text-2">Qualifies on</dt>
                <dd className="adm-num font-medium text-adm-ink">{day(r.qualifiesAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-adm-text-2">Membership in Stripe</dt>
                <dd className="font-medium text-adm-ink">
                  {r.membership ? `${r.membership.status || "unknown"}${r.membership.endedAt ? `, ended ${day(r.membership.endedAt)}` : ""}` : "Not read yet"}
                </dd>
              </div>
              {r.membership ? <p className="text-[12px] text-adm-text-3">Read {when(r.membership.checkedAt)}. Read again before you approve and before you mark the check mailed.</p> : null}
            </dl>
          </Card>
        ) : (
          <InvoiceRows label="2nd payment" inv={r.second} />
        )}
      </div>

      {r.flags.length ? (
        <Card title="Flags" className={blocking.some((f) => !f.reviewed) ? "border-adm-attn" : ""}>
          <ul className="grid gap-2" data-referral-flags="">
            {r.flags.map((f) => (
              <li key={f.code} className="flex flex-wrap items-start gap-2 text-[14px] text-adm-ink" data-referral-flag={f.code}>
                <StatusBadge tone={f.strength === "info" ? "info" : f.reviewed ? "success" : "attention"}>{f.strength === "info" ? "Info" : f.reviewed ? "Checked" : "Check"}</StatusBadge>
                <span className="min-w-0 flex-1">{f.text}</span>
              </li>
            ))}
          </ul>
          {r.flagsReview ? <p className="mt-2 text-[13px] text-adm-text-2">You checked these {day(r.flagsReview.at)}: {r.flagsReview.note}</p> : null}
          {open && blocking.some((f) => !f.reviewed) ? (
            <div className="mt-3 grid gap-2">
              <Field label="What you checked" required>
                <Textarea value={flagNote} onChange={(e) => setFlagNote(e.target.value)} rows={2} data-flag-note="" />
              </Field>
              <div>
                <Button variant="secondary" busy={busy === "flags"} disabled={flagNote.trim().length < 3} onClick={() => run("flags", () => clearRewardFlags(id, { note: flagNote }), "Flags marked as checked.")} data-clear-flags="">
                  I checked these flags
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card title="Check payee and mailing address">
        {r.payee ? (
          <div className="text-[14px] text-adm-ink" data-referral-payee="">
            <p className="font-semibold">{r.payee.name}</p>
            <p>{r.payee.line1}{r.payee.line2 ? `, ${r.payee.line2}` : ""}</p>
            <p>
              {r.payee.city}, {r.payee.state} {r.payee.zip}
            </p>
            <p className="mt-1 text-[13px] text-adm-text-2">
              {r.payee.confirmedBy === "customer"
                ? `Entered by the referrer, signed in and confirmed by code, ${when(r.payee.confirmedAt)}.`
                : `Entered by you ${when(r.payee.confirmedAt)}: ${r.payee.note}`}
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-adm-text-2">Not confirmed yet. The referrer was emailed to confirm it in their account, or enter it here after you confirm it with them.</p>
        )}
        {open ? (
          payeeOpen ? (
            <div className="mt-3 grid gap-2" data-owner-payee-form="">
              <Field label="Name on the check" required>
                <TextInput value={payee.name} onChange={(e) => setPayee({ ...payee, name: e.target.value })} />
              </Field>
              <Field label="Street address" required>
                <TextInput value={payee.line1} onChange={(e) => setPayee({ ...payee, line1: e.target.value })} />
              </Field>
              <Field label="Apt, suite">
                <TextInput value={payee.line2} onChange={(e) => setPayee({ ...payee, line2: e.target.value })} />
              </Field>
              <div className="grid grid-cols-[1fr_72px_104px] gap-2">
                <Field label="City" required>
                  <TextInput value={payee.city} onChange={(e) => setPayee({ ...payee, city: e.target.value })} />
                </Field>
                <Field label="State" required>
                  <TextInput value={payee.state} maxLength={2} onChange={(e) => setPayee({ ...payee, state: e.target.value })} />
                </Field>
                <Field label="ZIP" required>
                  <TextInput value={payee.zip} inputMode="numeric" onChange={(e) => setPayee({ ...payee, zip: e.target.value })} />
                </Field>
              </div>
              <Field label="How you confirmed it" required help="For example: called the referrer at the number on their account.">
                <TextInput value={payee.note} onChange={(e) => setPayee({ ...payee, note: e.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button busy={busy === "payee"} onClick={async () => (await run("payee", () => confirmRewardPayee(id, payee), "Payee saved.")) && setPayeeOpen(false)}>
                  Save payee
                </Button>
                <Button variant="tertiary" onClick={() => setPayeeOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <Button
                variant="tertiary"
                onClick={() => {
                  setPayee({ name: r.payee?.name || r.referrer?.name || "", line1: r.payee?.line1 || "", line2: r.payee?.line2 || "", city: r.payee?.city || "", state: r.payee?.state || "NY", zip: r.payee?.zip || "", note: "" });
                  setPayeeOpen(true);
                }}
              >
                {r.payee ? "Correct it" : "Enter it after confirming with them"}
              </Button>
            </div>
          )
        ) : null}
      </Card>

      {r.status === "eligible" ? (
        <Card title="Approve" className="border-adm-accent">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 text-[14px] text-adm-ink">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={checked} onChange={(e) => setChecked(e.target.checked)} data-payee-checked="" />
            <span>I checked the payee name and mailing address with the referrer.</span>
          </label>
          {!r.payee ? <p className="text-[13px] text-adm-text-2">Confirm the payee first.</p> : null}
          {blocking.some((f) => !f.reviewed) ? <p className="text-[13px] text-adm-text-2">Check the flags first.</p> : null}
          <div className="mt-2">
            <Button
              busy={busy === "approve"}
              disabled={!checked || !r.canApprove}
              onClick={() => run("approve", () => approveReward(id, { expectedAmountCents: r.amountCents, payeeConfirmed: true }), "Approved. Mail the check, then record it here.")}
              data-approve=""
            >
              {`Recheck Stripe and approve ${cents(r.amountCents)}`}
            </Button>
          </div>
        </Card>
      ) : null}

      {r.status === "approved" ? (
        <Card title={`Mail the check: ${cents(r.approval?.amountCents)} to ${r.payee?.name || ""}`} className="border-adm-accent">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Check number or reference" required>
              <TextInput value={check.reference} onChange={(e) => setCheck({ ...check, reference: e.target.value })} data-check-reference="" />
            </Field>
            <Field label="Mailed on" required>
              <TextInput type="date" value={check.mailedAt} onChange={(e) => setCheck({ ...check, mailedAt: e.target.value })} />
            </Field>
          </div>
          <Field label="Note">
            <TextInput value={check.note} onChange={(e) => setCheck({ ...check, note: e.target.value })} />
          </Field>
          <div className="mt-2">
            <Button busy={busy === "mailed"} disabled={!check.reference.trim()} onClick={() => run("mailed", () => markRewardMailed(id, check), "Check recorded as mailed. The referrer was emailed.")} data-mark-mailed="">
              Mark check mailed
            </Button>
          </div>
        </Card>
      ) : null}

      {r.check ? (
        <Card title="Check mailed">
          <p className="text-[14px] text-adm-ink" data-referral-check="">
            {r.check.reference} · {cents(r.approval?.amountCents)} · mailed {day(r.check.mailedAt)}
            {r.check.note ? ` · ${r.check.note}` : ""}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {r.first ? (
          <Button variant="secondary" busy={busy === "recheck"} onClick={() => run("recheck", () => recheckReward(id), "Stripe matches.")} data-recheck="">
            Recheck Stripe now
          </Button>
        ) : null}
        {open && !voidOpen ? (
          <Button variant="tertiary" onClick={() => setVoidOpen(true)}>
            Void this reward
          </Button>
        ) : null}
      </div>
      {voidOpen ? (
        <Card title="Void this reward">
          <Field label="Reason" required>
            <TextInput value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="destructive" busy={busy === "void"} disabled={voidReason.trim().length < 3} onClick={async () => (await run("void", () => voidReward(id, { reason: voidReason }), "Voided.")) && setVoidOpen(false)}>
              Void
            </Button>
            <Button variant="tertiary" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Section title="History">
        <ul role="list" className="divide-y divide-adm-line">
          {r.history.map((h, i) => (
            <li key={`${h.at}-${i}`} className="px-4 py-2 text-[13px]">
              <span className="adm-num text-adm-text-3">{when(h.at)}</span> <span className="text-adm-ink">{h.detail || h.event}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
