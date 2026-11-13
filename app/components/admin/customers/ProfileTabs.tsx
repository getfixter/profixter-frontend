"use client";

import { ArrowTopRightOnSquareIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import CommunicationHistory from "@/app/components/admin/CommunicationHistory";
import CustomerProfileHistory from "@/app/components/admin/CustomerProfileHistory";
import ReviewedUsPanel from "@/app/components/admin/ReviewedUsPanel";
import { LoyaltyCard } from "@/app/components/admin/LoyaltyProgress";
import { getCustomerActivity, getCustomerLoyalty, type CustomerActivityItem, type CustomerLoyaltyResponse } from "@/lib/admin-service";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { formatAddressLine } from "@/lib/admin/address";
import { errorMessage, setQueryData, useAdminQuery } from "@/lib/admin/query";
import {
  addNote,
  customerKeys,
  dateTime,
  fetchBilling,
  fetchGifts,
  fetchNotes,
  fetchPaymentLinks,
  fetchVisits,
  hasLiveMembership,
  membershipSentence,
  planChip,
  planLabel,
  shortDate,
  type BillingAvailable,
  type CustomerProfileSummary,
  type Note,
  type ProfileAddress,
  type CustomerProject,
  type CustomerProjects,
  type Visit,
} from "@/lib/admin/customers";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  Field,
  IconButton,
  ListRow,
  Section,
  SkeletonRows,
  StatusBadge,
  Textarea,
  TypeBadge,
  cx,
  formatCents,
  jobTypeOf,
  useToast,
  type StatusTone,
} from "@/app/components/admin/ui";
import { ConsentBlock, ConsentHistory } from "./ConsentBlock";
import { BlockHistory } from "./AccountSheets";
import { Notice } from "./MembershipSheets";
import { ExtraChargesBlock } from "@/app/components/admin/jobs/ChargeExtra";
import { customerScope } from "@/lib/admin/extraCharges";

export type MembershipAction = "change" | "cancel" | "complimentary" | "sell";

/* ================================================================ Overview */

function CopyButton({ text, what }: { text: string; what: string }) {
  const toast = useToast();
  return (
    <IconButton
      label={`Copy ${what.toLowerCase()}`}
      icon={<DocumentDuplicateIcon />}
      data-copy={what.toLowerCase()}
      onClick={async () => {
        const ok = await writeToClipboard(text);
        toast.show(ok ? `${what} copied` : `Could not copy the ${what.toLowerCase()}. Select it and copy it by hand.`);
      }}
    />
  );
}

function HomeCard({
  home,
  loyaltyRow,
  canMembers,
  actions,
}: {
  home: ProfileAddress;
  loyaltyRow?: CustomerLoyaltyResponse["addresses"][number];
  canMembers: boolean;
  actions?: React.ReactNode;
}) {
  const chip = planChip(home);
  const address = formatAddressLine(home) || "Address details missing";
  const l = home.loyalty;
  return (
    <li className="rounded-adm-md border border-adm-line bg-adm-surface p-4" data-home={home.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-adm-text-2">{home.label || "Home"}</span>
            {home.isDefault && <span className="rounded-adm-xs border border-adm-line-2 px-1.5 text-[12px] font-semibold leading-6 text-adm-text-2">Default</span>}
            {home.introVisitStatus && ["claimed", "consumed"].includes(home.introVisitStatus) && <StatusBadge tone="attention">Free visit used</StatusBadge>}
          </div>
          <p className="mt-1 text-[15px] font-semibold text-adm-ink [overflow-wrap:anywhere]" data-home-address="">
            {address}
          </p>
        </div>
        <CopyButton text={address} what="Address" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {chip ? <StatusBadge tone={chip.tone}>{chip.text}</StatusBadge> : <span className="text-[13px] text-adm-text-3">{membershipSentence(home)}</span>}
        {chip && <span className="text-[13px] text-adm-text-2">{membershipSentence(home)}</span>}
      </div>
      {canMembers && l && (l.countedMonths > 0 || l.nextMilestone) && (
        <p className="mt-2 text-[13px] text-adm-text-2" data-loyalty-line="">
          Loyalty: {l.standing ? `${l.standing} · ` : ""}
          {l.nextMilestone ? `${l.countedMonths} of ${l.nextMilestone} months` : `${l.countedMonths} months`}
          {l.nextReward?.headline ? ` · next: ${l.nextReward.headline}` : ""}
          {l.expectedDate ? ` (est. ${shortDate(l.expectedDate)})` : ""}
          {l.benefitsEarned ? ` · ${l.benefitsEarned} earned` : ""}
        </p>
      )}
      {canMembers && loyaltyRow && (loyaltyRow.membership.state !== "none" || loyaltyRow.loyalty.benefitsEarned > 0) && (
        <details className="mt-2 rounded-adm-sm bg-adm-sunk px-3 py-1">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-adm-accent-ink">Loyalty progress and benefits</summary>
          <div className="pb-2">
            <LoyaltyCard row={loyaltyRow} embedded />
          </div>
        </details>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </li>
  );
}

export function OverviewTab({
  profile,
  canMembers,
  canProjects,
  projects,
  onOpenTab,
  onEdit,
}: {
  profile: CustomerProfileSummary;
  canMembers: boolean;
  canProjects: boolean;
  projects: CustomerProjects | undefined;
  onOpenTab: (tab: string) => void;
  onEdit?: () => void;
}) {
  const id = profile.customer.id;
  const loyaltyQ = useAdminQuery<CustomerLoyaltyResponse>(customerKeys.loyalty(id), () => getCustomerLoyalty(id), { enabled: canMembers });
  const notesQ = useAdminQuery<Note[]>(customerKeys.notes(id), (signal) => fetchNotes(id, signal));
  const byAddress = new Map((loyaltyQ.data?.addresses || []).map((row) => [String(row.addressId), row]));
  const openProject = (projects?.items || []).find((p) => !/complete|cancel|closed|lost|declin/i.test(`${p.status} ${p.derivedStage?.key || ""}`));
  const latest = (notesQ.data || []).slice(0, 3);

  return (
    <div className="flex flex-col gap-5" data-tab-panel="overview">
      {profile.flags.blocked && (
        <Notice tone="problem" role="status">
          Blocked: they cannot book, buy or claim online.{profile.flags.blockedReason ? ` Reason: ${profile.flags.blockedReason}` : ""}
        </Notice>
      )}
      {profile.flags.archived && <Notice tone="attention">Archived {shortDate(profile.customer.archivedAt)}. Hidden from lists and search; nothing else changed.</Notice>}

      <Section title="Homes" count={profile.addresses.length} flush action={onEdit && <Button variant="tertiary" onClick={onEdit}>Edit</Button>}>
        {profile.addresses.length ? (
          <ul className="flex flex-col gap-3">
            {profile.addresses.map((home) => (
              <HomeCard key={home.id} home={home} loyaltyRow={byAddress.get(home.id)} canMembers={canMembers} />
            ))}
          </ul>
        ) : (
          <EmptyState message="No address yet" detail={onEdit ? "Add one with Edit." : undefined} />
        )}
      </Section>

      <Section
        title="Internal notes"
        count={notesQ.data?.length}
        flush
        action={
          <Button variant="tertiary" onClick={() => onOpenTab("notes")}>
            {latest.length ? "All notes" : "Add a note"}
          </Button>
        }
      >
        {notesQ.isLoading ? (
          <SkeletonRows count={1} leading={false} label="Loading notes" />
        ) : latest.length ? (
          <ul className="flex flex-col gap-2">
            {latest.map((n) => (
              <NoteItem key={n.id} note={n} />
            ))}
          </ul>
        ) : (
          <p className="px-1 text-[14px] text-adm-text-3">No notes yet. Only staff see notes.</p>
        )}
      </Section>

      {canProjects && openProject && (
        <Section title="Open project" flush>
          <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
            <ProjectRow project={openProject} money={Boolean(projects?.moneyVisible)} />
          </ul>
        </Section>
      )}
    </div>
  );
}

/* ================================================================== Visits */

const TERMINAL = /^\s*(completed|done|cancel+ed|failed|no-show|declined|expired)\s*$/i;

function VisitRow({ visit }: { visit: Visit }) {
  return (
    <ListRow
      href={visit.href || `/admin/jobs/${visit.id}`}
      title={
        <span className="flex items-center gap-2">
          <span className="adm-num">{dateTime(visit.date) || "No date"}</span>
        </span>
      }
      subtitle={[visit.bookingNumber, visit.service, visit.assignedFixterName || "Unassigned", visit.address].filter(Boolean).join(" · ")}
      trailing={
        <span className="flex flex-col items-end gap-1">
          <StatusBadge status={visit.status} />
          <TypeBadge type={jobTypeOf(visit)} />
        </span>
      }
    />
  );
}

export function VisitsTab({ profile }: { profile: CustomerProfileSummary }) {
  const id = profile.customer.id;
  const key = customerKeys.visits(id);
  const q = useAdminQuery(key, (signal) => fetchVisits(id, null, signal), { refetchOnFocus: false });
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const items = q.data?.items || [];
  const now = Date.now();
  const upcoming = items.filter((v) => new Date(v.date).getTime() >= now && !TERMINAL.test(v.status || "")).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const past = items.filter((v) => !upcoming.includes(v));

  const loadMore = async () => {
    if (!q.data?.nextCursor) return;
    setMore(true);
    setMoreError("");
    try {
      const next = await fetchVisits(id, q.data.nextCursor);
      setQueryData<{ items: Visit[]; nextCursor: string | null }>(key, (cur) => ({ items: [...(cur?.items || []), ...next.items], nextCursor: next.nextCursor }));
    } catch (error) {
      setMoreError(errorMessage(error, "More visits could not be loaded."));
    } finally {
      setMore(false);
    }
  };

  if (q.isLoading) return <SkeletonRows count={4} label="Loading visits" />;
  if (q.error && !q.data) return <ErrorState title="Visits could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />;
  return (
    <div className="flex flex-col gap-5" data-tab-panel="visits">
      <p className="adm-num px-1 text-[14px] text-adm-text-2" data-visit-counts="">
        {upcoming.length} upcoming · {profile.visits.completed} completed
      </p>
      <Section title="Upcoming" count={upcoming.length}>
        {upcoming.length ? (
          <ul role="list">
            {upcoming.map((v) => (
              <VisitRow key={v.id} visit={v} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-adm-text-3">Nothing booked.</p>
        )}
      </Section>
      <Section title="Past" count={past.length}>
        {past.length ? (
          <ul role="list">
            {past.map((v) => (
              <VisitRow key={v.id} visit={v} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-adm-text-3">No past visits.</p>
        )}
      </Section>
      {q.data?.nextCursor && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" busy={more} onClick={loadMore}>
            Show older visits
          </Button>
          {moreError && <p className="text-[13px] text-adm-problem">{moreError}</p>}
        </div>
      )}
    </div>
  );
}

/* ====================================================== Membership & billing */

const STRIPE_TONE: Record<string, StatusTone> = {
  active: "info",
  trialing: "info",
  paid: "success",
  succeeded: "success",
  open: "attention",
  draft: "neutral",
  past_due: "problem",
  unpaid: "problem",
  incomplete: "problem",
  failed: "problem",
  uncollectible: "problem",
  void: "neutral",
  canceled: "neutral",
  requires_payment_method: "problem",
};
const toneFor = (s: string): StatusTone => STRIPE_TONE[String(s || "").toLowerCase()] || "neutral";
const words = (s: string | null | undefined) => String(s || "").replace(/_/g, " ");

function StripeLink({ href, label = "Open in Stripe" }: { href?: string; label?: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn--tertiary !px-1" data-stripe-link="">
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
      </span>
    </a>
  );
}

function BillingBlock({ billing, chargesShown = false }: { billing: BillingAvailable; chargesShown?: boolean }) {
  return (
    <div className="flex flex-col gap-4" data-billing="">
      {billing.customers.map((c) => (
        <Card key={c.id} title="Stripe customer" action={<StripeLink href={c.dashboardUrl} />}>
          <p className="text-[14px] text-adm-ink">
            {c.deleted
              ? "Deleted in Stripe"
              : c.defaultPaymentMethod
                ? `${c.defaultPaymentMethod.brand?.toUpperCase() || "Card"} ending ${c.defaultPaymentMethod.last4}, expires ${String(c.defaultPaymentMethod.expMonth).padStart(2, "0")}/${String(c.defaultPaymentMethod.expYear).slice(-2)}`
                : "No default card saved"}
          </p>
        </Card>
      ))}

      {billing.upcoming.length > 0 && (
        <Card title="Next charge">
          <ul className="flex flex-col gap-1">
            {billing.upcoming.map((u, i) => (
              <li key={`${u.subscriptionId || i}`} className="flex justify-between gap-3 text-[14px]">
                <span className="text-adm-text-2">{shortDate(u.nextPaymentAttempt || u.periodEnd) || "Scheduled"}</span>
                <span className="adm-num font-semibold text-adm-ink">{formatCents(u.amountDueCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {billing.subscriptions.length > 0 && (
        <Section title="Subscriptions" count={billing.subscriptions.length}>
          <ul role="list">
            {billing.subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-adm-ink">
                    {planLabel(s.plan)} · {s.billingCycle === "annual" ? "annual" : "monthly"}
                    {s.priceCents !== null && s.priceCents !== undefined ? ` · ${formatCents(s.priceCents)}` : ""}
                  </p>
                  <p className="text-[13px] text-adm-text-2">
                    {s.cancelAt || s.cancelAtPeriodEnd ? `Cancels ${shortDate(s.cancelAt || s.currentPeriodEnd)}` : s.currentPeriodEnd ? `Period ends ${shortDate(s.currentPeriodEnd)}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge tone={toneFor(s.status)}>{words(s.status)}</StatusBadge>
                  <StripeLink href={s.dashboardUrl} label="Stripe" />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Invoices" count={billing.invoices.length}>
        {billing.invoices.length ? (
          <ul role="list">
            {billing.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-3 last:border-b-0" data-invoice="">
                <div className="min-w-0">
                  <p className="adm-num text-[15px] font-semibold text-adm-ink">
                    {formatCents(inv.totalCents)} <span className="font-normal text-adm-text-2">· {shortDate(inv.createdAt)}</span>
                  </p>
                  <p className="text-[13px] text-adm-text-2">
                    {[inv.number, words(inv.billingReason), inv.amountRemainingCents > 0 ? `${formatCents(inv.amountRemainingCents)} still due` : "", inv.attemptCount > 1 ? `${inv.attemptCount} attempts` : "", inv.nextPaymentAttempt ? `next try ${shortDate(inv.nextPaymentAttempt)}` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge tone={toneFor(inv.status)}>{words(inv.status)}</StatusBadge>
                  <StripeLink href={inv.dashboardUrl} label="Stripe" />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-adm-text-3">No invoices.</p>
        )}
      </Section>

      <Section title="Payments" count={billing.payments.length}>
        {billing.payments.length ? (
          <ul role="list">
            {billing.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-3 last:border-b-0" data-payment="">
                <div className="min-w-0">
                  <p className="adm-num text-[15px] font-semibold text-adm-ink">
                    {formatCents(p.amountCents)} <span className="font-normal text-adm-text-2">· {shortDate(p.createdAt)}</span>
                  </p>
                  {p.extraCharge ? (
                    <p className="text-[13px] text-adm-text-2" data-payment-extra={p.extraCharge.bookingId ? "job" : "direct"}>
                      {p.extraCharge.bookingId ? (
                        <a href={`/admin/jobs/${encodeURIComponent(p.extraCharge.bookingId)}`} className="font-semibold text-adm-accent-ink underline-offset-4 hover:underline">
                          Extra on job #{p.extraCharge.bookingNumber}
                        </a>
                      ) : (
                        <span className="font-semibold text-adm-ink">Direct charge</span>
                      )}
                      {[p.extraCharge.description ? ": " + p.extraCharge.description : "", p.card ? ` · ${p.card.brand} ${p.card.last4}` : "", p.amountRefundedCents > 0 ? ` · ${formatCents(p.amountRefundedCents)} refunded` : ""].join("")}
                    </p>
                  ) : (
                    <p className="text-[13px] text-adm-text-2">
                      {[p.description, p.card ? `${p.card.brand} ${p.card.last4}` : "", p.amountRefundedCents > 0 ? `${formatCents(p.amountRefundedCents)} refunded` : "", p.failureMessage || ""].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge tone={p.refunded ? "neutral" : toneFor(p.status)}>{p.refunded ? "refunded" : words(p.status)}</StatusBadge>
                  <StripeLink href={p.dashboardUrl} label="Stripe" />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-adm-text-3">No payments.</p>
        )}
      </Section>
      {(() => {
        // Paid charges that Stripe does not list under this customer (a link paid without the account): shown once.
        // The owner already sees every charge in Charges above, so the list is not repeated for them.
        const elsewhere = chargesShown ? [] : (billing.additionalCharges || []).filter((a) => !a.inPayments && ["paid", "partially_refunded", "refunded"].includes(a.status));
        if (!elsewhere.length) return null;
        return (
          <Section title="Charges paid by link" count={elsewhere.length}>
            <ul role="list">
              {elsewhere.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-3 last:border-b-0" data-extra-elsewhere="">
                  <div className="min-w-0">
                    <p className="adm-num text-[15px] font-semibold text-adm-ink">
                      {formatCents(a.totalCents)} <span className="font-normal text-adm-text-2">· {shortDate(a.paidAt || a.createdAt)}</span>
                    </p>
                    <p className="text-[13px] text-adm-text-2">
                      {a.bookingId ? (
                        <a href={`/admin/jobs/${encodeURIComponent(a.bookingId)}`} className="font-semibold text-adm-accent-ink">
                          Extra on job #{a.bookingNumber}
                        </a>
                      ) : (
                        <span className="font-semibold text-adm-ink">Direct charge</span>
                      )}
                      {a.description ? `: ${a.description}` : ""}
                      {a.refundedCents > 0 ? ` · ${formatCents(a.refundedCents)} refunded` : ""}
                    </p>
                  </div>
                  {a.stripeUrl && <StripeLink href={a.stripeUrl} label="Stripe" />}
                </li>
              ))}
            </ul>
          </Section>
        );
      })()}
      <p className="px-1 text-[13px] text-adm-text-3">{billing.refundsNote || "Refunds are made in Stripe. Cancelling a membership does not refund."}</p>
      {billing.cachedAt && <p className="px-1 text-[12px] text-adm-text-3">From Stripe, {dateTime(billing.cachedAt)}.</p>}
    </div>
  );
}

const GIFT_TONE: Record<string, StatusTone> = { claimed: "success", paid: "info", pending: "attention", canceled: "neutral", cancelled: "neutral", expired: "neutral", refunded: "neutral" };
const LINK_TONE: Record<string, StatusTone> = { sent: "attention", paid: "success", expired: "neutral", canceled: "neutral" };

export function BillingTab({
  profile,
  onAction,
  onCharge,
}: {
  profile: CustomerProfileSummary;
  onAction: (action: MembershipAction, addressId?: string) => void;
  /** Open Charge customer (no booking). Offered to the owner only. */
  onCharge?: () => void;
}) {
  const id = profile.customer.id;
  const a = profile.allowedActions;
  const billingQ = useAdminQuery(customerKeys.billing(id), (signal) => fetchBilling(id, signal), { enabled: a.viewBilling, staleTime: 60_000 });
  const giftsQ = useAdminQuery(customerKeys.gifts(id), (signal) => fetchGifts(id, signal));
  const linksQ = useAdminQuery(customerKeys.paymentLinks(id), (signal) => fetchPaymentLinks(id, signal));
  const billing = billingQ.data;
  const toast = useToast();

  return (
    <div className="flex flex-col gap-5" data-tab-panel="billing">
      {a.chargeCustomer && (
        <ErrorBoundary label="Charges" resetKey={id}>
          {/* Every charge of this customer, once: made on their jobs and made directly (no booking). */}
          <ExtraChargesBlock scope={customerScope(id)} canCharge onCharge={() => onCharge?.()} />
        </ErrorBoundary>
      )}
      <Section title="Memberships" flush>
        {profile.addresses.length ? (
          <ul className="flex flex-col gap-3">
            {profile.addresses.map((home) => {
              const live = hasLiveMembership(home);
              const changeable = live && home.stripeManaged && ["active", "trialing"].includes(home.planStatus) && !home.cancelAt;
              return (
                <HomeCard
                  key={home.id}
                  home={home}
                  canMembers={false}
                  actions={
                    <>
                      {a.changePlan && changeable && (
                        <Button variant="secondary" onClick={() => onAction("change", home.id)} data-action="change-plan">
                          Change plan
                        </Button>
                      )}
                      {a.scheduleCancellation && live && (
                        <Button variant="secondary" onClick={() => onAction("cancel", home.id)} data-action="cancellation">
                          {home.cancelAt || home.planStatus === "ending" ? "Change or clear cancellation" : "Schedule cancellation"}
                        </Button>
                      )}
                      {a.sellMembership && !live && (
                        <Button variant="secondary" onClick={() => onAction("sell", home.id)} data-action="sell-membership">
                          Sell a membership
                        </Button>
                      )}
                      {a.grantComplimentary && (
                        <Button variant="tertiary" onClick={() => onAction("complimentary", home.id)} data-action="complimentary">
                          Complimentary…
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </ul>
        ) : (
          <EmptyState message="No home on file" detail="A membership belongs to a home. Add an address first." />
        )}
      </Section>

      <Section
        title="Billing from Stripe"
        flush
        action={
          a.viewBilling && billing ? (
            <Button
              variant="tertiary"
              onClick={async () => {
                try {
                  billingQ.setData(await fetchBilling(id, undefined, true));
                } catch (err) {
                  toast.show(errorMessage(err, "Billing could not be refreshed."));
                }
              }}
              data-action="refresh-billing"
            >
              Refresh
            </Button>
          ) : undefined
        }
      >
        {!a.viewBilling ? (
          <p className="px-1 text-[14px] text-adm-text-3">Billing is not available to you.</p>
        ) : billingQ.isLoading ? (
          <SkeletonRows count={3} leading={false} label="Loading billing" />
        ) : billingQ.error && !billing ? (
          <ErrorState title="Billing could not be loaded" message={errorMessage(billingQ.error)} onRetry={billingQ.refetch} />
        ) : billing && !billing.available ? (
          <Notice tone="attention" role="status">
            <span data-billing-unavailable="">
              {billing.reason === "stripe_not_configured"
                ? "Stripe is not set up on this server, so billing cannot be shown here."
                : "Stripe could not be reached just now, so invoices and payments cannot be shown. Nothing is wrong with the membership because of this. Try again in a minute."}
            </span>
          </Notice>
        ) : billing && billing.available ? (
          <BillingBlock billing={billing} chargesShown={a.chargeCustomer} />
        ) : null}
      </Section>

      <Section title="Gifts" count={giftsQ.data?.length}>
        {giftsQ.isLoading ? (
          <SkeletonRows count={1} leading={false} label="Loading gifts" />
        ) : (giftsQ.data || []).length ? (
          <ul role="list">
            {(giftsQ.data || []).map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-3 last:border-b-0" data-gift="">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-adm-ink">
                    {planLabel(g.plan)} · {g.durationMonths} {g.durationMonths === 1 ? "month" : "months"}
                  </p>
                  <p className="text-[13px] text-adm-text-2">
                    {g.role === "purchased" ? `Bought for ${g.recipientName || g.recipientEmail || "someone"}` : `From ${g.purchaserName || "someone"}`}
                    {g.purchasedAt ? ` · ${shortDate(g.purchasedAt)}` : ""}
                    {g.claimedAt ? ` · claimed ${shortDate(g.claimedAt)}` : ""}
                    {g.giftNumber ? ` · ${g.giftNumber}` : ""}
                  </p>
                </div>
                <StatusBadge tone={GIFT_TONE[g.status] || "neutral"}>{words(g.status)}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-adm-text-3">No gifts.</p>
        )}
      </Section>

      <Section title="Payment links" count={linksQ.data?.length}>
        {linksQ.isLoading ? (
          <SkeletonRows count={1} leading={false} label="Loading payment links" />
        ) : (linksQ.data || []).length ? (
          <ul role="list">
            {(linksQ.data || []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-adm-line px-4 py-3 last:border-b-0" data-payment-link={l.status}>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-adm-ink">{l.itemLabel || (l.plan ? `${planLabel(l.plan)} membership` : "Payment link")}</p>
                  <p className="text-[13px] text-adm-text-2">
                    {[
                      l.createdAt && `sent ${shortDate(l.createdAt)}`,
                      l.sentVia?.length ? `by ${l.sentVia.join(" and ")}` : "",
                      l.createdByName && `by ${l.createdByName}`,
                      l.openedCount ? `opened ${l.openedCount}×` : "not opened",
                      l.status === "paid" && l.paidAt ? `paid ${shortDate(l.paidAt)}` : "",
                      l.status === "sent" && l.expiresAt ? `expires ${shortDate(l.expiresAt)}` : "",
                      l.bookingNumber ? `visit ${l.bookingNumber}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusBadge tone={LINK_TONE[l.status] || "neutral"}>{l.status}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[14px] text-adm-text-3">No payment links sent.</p>
        )}
      </Section>
    </div>
  );
}

/* ====================================================== Messages & consent */

export function MessagesTab({ profile, showReviewed }: { profile: CustomerProfileSummary; showReviewed: boolean }) {
  const id = profile.customer.id;
  return (
    <div className="flex flex-col gap-5" data-tab-panel="messages">
      <ConsentBlock customerId={id} canEdit={profile.allowedActions.changeCommunication} />
      {showReviewed && (
        <Card>
          <ReviewedUsPanel userId={id} />
        </Card>
      )}
      <Card title="Messages sent">
        <CommunicationHistory userId={id} hideHeading />
      </Card>
      <ConsentHistory customerId={id} />
    </div>
  );
}

/* ================================================================ Projects */

function ProjectRow({ project: p, money }: { project: CustomerProject; money: boolean }) {
  const title = [p.projectNumber ? `#${p.projectNumber}` : "", p.title || p.projectType || "Project"].filter(Boolean).join(" · ");
  const amounts = money
    ? [
        p.executedValueCents ? `Signed ${formatCents(p.executedValueCents)}` : "",
        p.paidCents ? `paid ${formatCents(p.paidCents)}` : "",
        p.outstandingCents ? `${formatCents(p.outstandingCents)} outstanding` : "",
      ].filter(Boolean)
    : [];
  return (
    <ListRow
      href={p.href}
      title={title}
      subtitle={[p.projectType && p.title ? p.projectType : "", ...amounts, p.createdAt ? `since ${shortDate(p.createdAt)}` : ""].filter(Boolean).join(" · ")}
      trailing={<StatusBadge tone="info">{p.derivedStage?.label || words(p.status)}</StatusBadge>}
    />
  );
}

export function ProjectsTab({ projects, loading, error }: { projects: CustomerProjects | undefined; loading: boolean; error: unknown }) {
  const items = projects?.items || [];
  return (
    <div className="flex flex-col gap-3" data-tab-panel="projects">
      {loading ? (
        <SkeletonRows count={2} label="Loading projects" />
      ) : error && !projects ? (
        <ErrorState title="Projects could not be loaded" message={errorMessage(error)} />
      ) : items.length ? (
        <>
          <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-customer-projects="">
            {items.map((p) => (
              <ProjectRow key={p.id} project={p} money={projects?.moneyVisible === true} />
            ))}
          </ul>
          <p className="px-1 text-[13px] text-adm-text-3">Projects linked to this customer&apos;s account (deleted projects are not listed).</p>
        </>
      ) : (
        <EmptyState message="No projects" detail="No project is linked to this customer's account." action={<ButtonLink href="/admin/projects" variant="secondary">Open Projects</ButtonLink>} />
      )}
    </div>
  );
}

/* ================================================================ Activity */

function actorLine(item: CustomerActivityItem) {
  const name = String(item.actorName || "").trim();
  const role = String(item.actorRole || "").replace(/[_-]+/g, " ").trim();
  if (!name || name.toLowerCase() === "system" || role.toLowerCase() === "system") return "By System";
  return role ? `By ${name} · ${role.replace(/\b\w/g, (c) => c.toUpperCase())}` : `By ${name}`;
}

export function ActivityTab({ profile, showProfileHistory }: { profile: CustomerProfileSummary; showProfileHistory: boolean }) {
  const id = profile.customer.id;
  const [limit, setLimit] = useState<10 | "all">(10);
  const q = useAdminQuery(customerKeys.activity(id, limit), () => getCustomerActivity(id, limit));
  const items = q.data?.items || [];
  return (
    <div className="flex flex-col gap-5" data-tab-panel="activity">
      <Section
        title="Activity"
        count={q.data?.total}
        flush
        action={
          (q.data?.total || 0) > 10 && (
            <Button variant="tertiary" onClick={() => setLimit(limit === 10 ? "all" : 10)}>
              {limit === 10 ? "Show all" : "Last 10"}
            </Button>
          )
        }
      >
        {q.isLoading ? (
          <SkeletonRows count={3} leading={false} label="Loading activity" />
        ) : q.error && !q.data ? (
          <ErrorState title="Activity could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
        ) : items.length ? (
          <ol className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-activity="">
            {items.map((item) => {
              const lines = (item.descriptionLines?.length ? item.descriptionLines : String(item.description || "").split(/\n+/)).map((l) => String(l || "").trim()).filter(Boolean);
              return (
                <li key={item.id} className="border-b border-adm-line px-4 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-adm-ink">
                      {item.title}
                      {item.relatedBookingNumber && <span className="adm-num text-[13px] font-normal text-adm-text-2">#{String(item.relatedBookingNumber).replace(/^#/, "")}</span>}
                    </span>
                    <time className="adm-num text-[13px] text-adm-text-3">{dateTime(item.timestamp)}</time>
                  </div>
                  {lines.map((line, i) => (
                    <p key={i} className="text-[14px] text-adm-text-2">
                      {line}
                    </p>
                  ))}
                  <p className="mt-0.5 text-[13px] text-adm-text-3">{actorLine(item)}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-1 text-[14px] text-adm-text-3">No Profixter activity yet.</p>
        )}
        {!!q.data?.unavailableSources?.length && (
          <div className="mt-2 rounded-adm-sm bg-adm-sunk px-3 py-2 text-[13px] text-adm-text-2">
            Not yet fully tracked: {q.data.unavailableSources.join("; ")}
          </div>
        )}
      </Section>

      {profile.blockHistory && (
        <Card title="Block history">
          <BlockHistory history={profile.blockHistory} />
        </Card>
      )}

      {showProfileHistory && (
        <Card title="Profile changes">
          <CustomerProfileHistory userId={id} refreshKey={profile.customer.updatedAt ? new Date(profile.customer.updatedAt).getTime() : 0} />
        </Card>
      )}
    </div>
  );
}

/* =================================================================== Notes */

function NoteItem({ note }: { note: Note }) {
  return (
    <li className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-3" data-note="">
      <p className="whitespace-pre-wrap text-[15px] text-adm-ink [overflow-wrap:anywhere]">{note.text}</p>
      <p className="mt-1 text-[13px] text-adm-text-3">
        {note.authorName || "Staff"} · {dateTime(note.at)}
      </p>
    </li>
  );
}

export function NotesTab({ profile }: { profile: CustomerProfileSummary }) {
  const id = profile.customer.id;
  const toast = useToast();
  const key = customerKeys.notes(id);
  const q = useAdminQuery<Note[]>(key, (signal) => fetchNotes(id, signal));
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const canAdd = profile.allowedActions.addNote;
  const save = async () => {
    const value = text.trim();
    if (!value) {
      setError("Write the note first.");
      return;
    }
    setError("");
    try {
      const note = await addNote(id, value);
      setQueryData<Note[]>(key, (list = []) => [note, ...list]);
      setText("");
      toast.show("Note added");
    } catch (err) {
      setError(errorMessage(err, "The note was not saved."));
    }
  };
  return (
    <div className="flex flex-col gap-4" data-tab-panel="notes">
      {canAdd && (
        <Card>
          <Field label="New note" help="Only staff see notes. Each one shows who wrote it and when." error={error}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} autoCapitalize="sentences" data-input="note" />
          </Field>
          <div className={cx("mt-3 flex items-center justify-between gap-3")}>
            <span className="adm-num text-[12px] text-adm-text-3">{text.length}/2000</span>
            <Button onClick={save} disabled={!text.trim()} data-action="add-note">
              Add note
            </Button>
          </div>
        </Card>
      )}
      {q.isLoading ? (
        <SkeletonRows count={2} leading={false} label="Loading notes" />
      ) : q.error && !q.data ? (
        <ErrorState title="Notes could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : (q.data || []).length ? (
        <ul className="flex flex-col gap-2">
          {(q.data || []).map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      ) : (
        <EmptyState message="No notes yet" />
      )}
    </div>
  );
}

