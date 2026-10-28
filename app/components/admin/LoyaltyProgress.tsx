'use client';

import React, { useEffect, useState } from 'react';
import {
  getCustomerLoyalty,
  type AdminLoyaltyRow,
  type CustomerLoyaltyResponse,
} from '@/lib/admin-service';
import { formatDateNY } from '@/lib/utils/timezone-helpers';

/*
 * Completed visits and Loyalty Benefits, for Admin only.
 *
 * Nothing here counts or decides anything. Months, rewards, dates and the
 * reason a date is missing all arrive composed by the server, from the same
 * function the customer's own account screen uses, so the owner and the member
 * can never be told different things.
 */

const TONE_CLASS: Record<string, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
};

function formatDay(value?: string | null) {
  if (!value) return '';
  try {
    return formatDateNY(value);
  } catch {
    return '';
  }
}

function addressLine(row: AdminLoyaltyRow) {
  const source = row.address || row.addressSnapshot;
  if (!source) return 'Address removed';
  return [source.line1, source.city, `${source.state || ''} ${source.zip || ''}`.trim()]
    .filter(Boolean)
    .join(', ');
}

function onLadder(row: AdminLoyaltyRow) {
  const { reason } = row.loyalty;
  return row.membership.state !== 'none' && reason !== 'program_inactive' && reason !== 'annual_membership';
}

function progressLabel(row: AdminLoyaltyRow) {
  const { countedMonths, nextMilestone, ladderComplete, previousRunOnly } = row.loyalty;
  if (previousRunOnly) {
    return `Starts again at 0 · previous run reached ${countedMonths} ${countedMonths === 1 ? 'month' : 'months'}`;
  }
  if (ladderComplete || !nextMilestone) return `${countedMonths} qualifying months · all benefits earned`;
  return `${countedMonths} of ${nextMilestone} qualifying months`;
}

function progressPercent(row: AdminLoyaltyRow) {
  const { countedMonths, nextMilestone, ladderComplete, previousRunOnly } = row.loyalty;
  if (previousRunOnly) return 0;
  if (ladderComplete || !nextMilestone) return 100;
  return Math.max(0, Math.min(100, Math.round((countedMonths / nextMilestone) * 100)));
}

export function StandingBadge({ row }: { row: AdminLoyaltyRow }) {
  const { standing } = row.loyalty;
  const label =
    standing.key === 'ending' && standing.cancelsOn
      ? `Cancels ${formatDay(standing.cancelsOn)}`
      : standing.label;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        TONE_CLASS[standing.tone] || TONE_CLASS.neutral
      }`}
    >
      {label}
    </span>
  );
}

export function CompletedBookingsChip({ count }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
      Completed bookings
      <span className="text-sm font-bold tabular-nums text-slate-950">{count ?? 0}</span>
    </span>
  );
}

function ProgressBar({ row }: { row: AdminLoyaltyRow }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPercent(row)}
      aria-label={progressLabel(row)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width]"
        style={{ width: `${progressPercent(row)}%` }}
      />
    </div>
  );
}

/** What will happen next, as a date when one can be trusted, else what is still needed. */
function NextStep({ row }: { row: AdminLoyaltyRow }) {
  const { expectedDate, requirement, dateNote } = row.loyalty;
  if (expectedDate) {
    return <span className="font-semibold text-slate-950">{formatDay(expectedDate)}</span>;
  }
  return (
    <span>
      <span className="font-semibold text-slate-950">{requirement || 'Not available'}</span>
      {dateNote && <span className="mt-0.5 block text-xs text-slate-500">{dateNote}</span>}
    </span>
  );
}

/**
 * One line per membership in the Members list. Wraps on a phone rather than
 * scrolling sideways.
 */
export function LoyaltyStrip({ row }: { row?: AdminLoyaltyRow | null }) {
  if (!row) return <span className="text-xs text-slate-400">Loyalty not available</span>;
  if (!onLadder(row)) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StandingBadge row={row} />
      </div>
    );
  }
  const { nextReward, expectedDate, requirement, benefitsEarned, ladderComplete } = row.loyalty;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StandingBadge row={row} />
        <span className="text-xs font-semibold text-slate-700">{progressLabel(row)}</span>
      </div>
      <ProgressBar row={row} />
      {row.loyalty.standing.key === 'manual' ? (
        <div className="text-xs leading-relaxed text-amber-800">{requirement}</div>
      ) : !ladderComplete && nextReward && (
        <div className="text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Next:</span> {nextReward.headline}
          <span className="text-slate-400"> · </span>
          {expectedDate ? formatDay(expectedDate) : requirement}
        </div>
      )}
      {benefitsEarned > 0 && (
        <div className="text-xs text-slate-500">
          Benefits earned <span className="font-bold text-slate-900">{benefitsEarned}</span>
        </div>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{children}</dd>
    </div>
  );
}

const BENEFIT_PILL: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  upcoming: { label: 'Upcoming', className: 'bg-sky-100 text-sky-800' },
  used: { label: 'Used', className: 'bg-slate-200 text-slate-700' },
  expired: { label: 'Expired', className: 'bg-slate-100 text-slate-500' },
  needs_review: { label: 'Needs review', className: 'bg-rose-100 text-rose-700' },
};

/** The membership's own state in plain words, with the one date that matters. */
function membershipLine(row: AdminLoyaltyRow) {
  const { membership } = row;
  switch (membership.state) {
    case 'active':
      return membership.currentPeriodEnd ? `Active · renews ${formatDay(membership.currentPeriodEnd)}` : 'Active';
    case 'ending':
      return `Active · cancels ${formatDay(membership.cancelsOn)}`;
    case 'renewal_pending':
      return 'Renewal not on record yet';
    case 'payment_issue':
      return `Payment issue (${String(membership.status || '').replace(/_/g, ' ')})`;
    case 'paused':
      return 'Paused';
    case 'ended':
      return 'Ended';
    default:
      return 'No membership at this address';
  }
}

function dateRange(from?: string | null, until?: string | null) {
  if (from && until) return `${formatDay(from)} – ${formatDay(until)}`;
  if (from) return `from ${formatDay(from)}`;
  return '';
}

/**
 * The 3 / 6 / 12 month ladder. Reached rungs show what they produced; rungs
 * ahead show the reward and, only when it can be estimated, a date.
 */
function Ladder({ row }: { row: AdminLoyaltyRow }) {
  const ladder = row.loyalty.ladder || [];
  if (!ladder.length) return null;
  const hasDates = ladder.some((rung) => rung.estimatedDate);

  return (
    <div>
      <ol className="space-y-2">
        {ladder.map((rung) => {
          const reached = rung.position === 'reached';
          const next = rung.position === 'next';
          return (
            <li
              key={rung.milestone}
              className={`flex gap-3 rounded-xl border px-3 py-2.5 ${
                next ? 'border-sky-200 bg-sky-50/60' : reached ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <span
                className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-xs font-bold ${
                  reached ? 'bg-emerald-600 text-white' : next ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                aria-hidden="true"
              >
                {reached ? '✓' : rung.milestone}
              </span>
              <div className="min-w-0 flex-1 text-xs text-slate-600">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-semibold text-slate-950">{rung.milestone} months</span>
                  <span className={`font-semibold ${reached ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {reached
                      ? rung.benefitStateLabel
                      : rung.estimatedDate
                        ? `Est. ${formatDay(rung.estimatedDate)}`
                        : `${rung.monthsRemaining} more ${rung.monthsRemaining === 1 ? 'renewal' : 'renewals'}`}
                  </span>
                </div>
                {rung.reward && <div className="mt-0.5 text-[13px] text-slate-800">{rung.reward.headline}</div>}
                {rung.duration && (
                  <div className="mt-0.5">
                    Lasts: {rung.duration}
                    {!reached && rung.benefitFrom && rung.benefitUntil && (
                      <span className="text-slate-500"> ({dateRange(rung.benefitFrom, rung.benefitUntil)}, est.)</span>
                    )}
                  </div>
                )}
                {rung.basis && <div className="mt-0.5 font-medium text-amber-700">{rung.basis}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      {hasDates && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Estimated dates assume every monthly renewal is paid on time. A missed or refunded payment moves them.
        </p>
      )}
    </div>
  );
}

function BenefitList({ row }: { row: AdminLoyaltyRow }) {
  const { benefits, loyaltyFullDaysAvailable } = row.loyalty;
  if (!benefits.length) return <span className="text-sm text-slate-500">None yet</span>;
  return (
    <ul className="space-y-1.5">
      {benefits.map((benefit) => {
        const pill = BENEFIT_PILL[benefit.state] || BENEFIT_PILL.expired;
        return (
          <li key={benefit.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">
                {benefit.milestone} months · {benefit.headline}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pill.className}`}>{pill.label}</span>
            </div>
            <div className="mt-0.5">
              {benefit.stateLabel}
              {benefit.grantedAt ? ` · earned ${formatDay(benefit.grantedAt)}` : ''}
              {!benefit.currentRun ? ' · earlier membership' : ''}
            </div>
            {benefit.duration && <div className="mt-0.5 text-slate-500">Lasts: {benefit.duration}</div>}
          </li>
        );
      })}
      {loyaltyFullDaysAvailable > 0 && (
        <li className="text-xs font-semibold text-emerald-700">
          {loyaltyFullDaysAvailable} Loyalty Full Day{loyaltyFullDaysAvailable === 1 ? '' : 's'} available to book
        </li>
      )}
    </ul>
  );
}

/**
 * The support card for one property: the answers to "where am I with my
 * membership?" in the order a call goes, then the whole ladder, then history.
 */
export function LoyaltyCard({ row }: { row: AdminLoyaltyRow }) {
  const { membership, loyalty } = row;
  const showNext = onLadder(row) && !loyalty.ladderComplete && loyalty.standing.key !== 'manual';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Membership & loyalty</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">{addressLine(row)}</div>
        </div>
        <StandingBadge row={row} />
      </div>

      <dl className="mt-2 divide-y divide-slate-100">
        <Fact label="Membership">
          {membership.state === 'none' ? (
            'No membership at this address'
          ) : (
            <>
              <span className="font-semibold text-slate-950">{membership.planLabel}</span>
              {membership.billingCycle === 'annual' && <span className="text-slate-500"> · Annual</span>}
              <span className="mt-0.5 block text-xs text-slate-600">{membershipLine(row)}</span>
              {membership.complimentaryPlanLabel && (
                <span className="mt-0.5 block text-xs font-semibold text-emerald-700">
                  Complimentary {membership.complimentaryPlanLabel} benefits until{' '}
                  {formatDay(membership.complimentaryUntil)}
                </span>
              )}
            </>
          )}
        </Fact>

        {loyalty.reason === 'program_inactive' && (
          <Fact label="Loyalty">The loyalty program is not active.</Fact>
        )}

        {loyalty.reason === 'annual_membership' && (
          <Fact label="Loyalty">
            Not on the monthly ladder.{loyalty.annualNote ? ` ${loyalty.annualNote}` : ''}
          </Fact>
        )}

        {onLadder(row) && (
          <>
            <Fact label="Progress">
              <span className="font-semibold text-slate-950">{progressLabel(row)}</span>
              <div className="mt-2">
                <ProgressBar row={row} />
              </div>
            </Fact>

            {showNext && loyalty.nextReward && (
              <Fact label="Next benefit">
                <span className="font-semibold text-slate-950">{loyalty.nextReward.headline}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{loyalty.nextReward.detail}</span>
                {loyalty.nextRewardDuration && (
                  <span className="mt-0.5 block text-xs text-slate-600">Lasts: {loyalty.nextRewardDuration}</span>
                )}
                {loyalty.nextRewardBasis && (
                  <span className="mt-0.5 block text-xs font-medium text-amber-700">{loyalty.nextRewardBasis}</span>
                )}
              </Fact>
            )}

            {!loyalty.ladderComplete && loyalty.nextMilestone && (
              <Fact label={loyalty.expectedDate ? 'Expected to qualify' : 'Still required'}>
                <NextStep row={row} />
                {loyalty.expectedDate && (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Estimate: {loyalty.requirement.replace(/\.$/, '')}, each paid on time.
                  </span>
                )}
              </Fact>
            )}

            {loyalty.continuity && (
              <Fact label="If they return">
                <span className={loyalty.continuity.lost ? 'text-rose-700' : 'text-slate-700'}>
                  {loyalty.continuity.lost
                    ? loyalty.continuity.note
                    : `Progress is kept if a paid month resumes by ${formatDay(loyalty.continuity.keptUntil)}.`}
                </span>
              </Fact>
            )}

            <Fact label="All milestones">
              <Ladder row={row} />
            </Fact>
          </>
        )}

        {(onLadder(row) || loyalty.benefits.length > 0) && (
          <Fact label="Benefits earned">
            {loyalty.benefits.length > 0 && (
              <span className="mb-1.5 block font-semibold text-slate-950">{loyalty.benefitsEarned}</span>
            )}
            <BenefitList row={row} />
          </Fact>
        )}
      </dl>
    </section>
  );
}

/**
 * Completed visits and loyalty for one customer, inside the customer detail.
 *
 * Loads on open and on its own, so the rest of the detail never waits for it
 * and a failure here costs only this panel. Render it with key={userId} so a
 * different customer starts from a clean panel.
 */
export function CustomerLoyaltyPanel({ userId, fallbackCompleted }: { userId: string; fallbackCompleted?: number }) {
  const [data, setData] = useState<CustomerLoyaltyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void getCustomerLoyalty(userId)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load loyalty progress right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const completed = data?.completedBookings ?? fallbackCompleted;
  const memberships = (data?.addresses || []).filter(
    (row) => row.membership.state !== 'none' || row.loyalty.benefitsEarned > 0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 px-4 py-3 text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Completed bookings</div>
        <div className="text-2xl font-bold tabular-nums">{completed ?? '–'}</div>
      </div>

      {loading ? (
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
      ) : memberships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          No membership on record, so there is no loyalty progress to show.
        </div>
      ) : (
        memberships.map((row) => <LoyaltyCard key={row.addressId} row={row} />)
      )}
    </div>
  );
}
