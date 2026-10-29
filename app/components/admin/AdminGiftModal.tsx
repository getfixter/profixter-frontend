'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { GiftIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AddressDetailed, User } from '@/lib/admin-service';
import {
  createGiftCheckoutSession,
  formatMoneyCents,
  getGiftOptions,
  GiftError,
  monthsLabel,
  planLabel,
  type GiftOptions,
  type GiftPlan,
} from '@/lib/gift-service';

/*
 * The owner buying a gift membership for a registered customer.
 *
 * Not a second gifting system: plans, lengths and prices come from the same
 * /gifts/options catalogue the public gift page reads, and Pay opens the same
 * Stripe checkout every customer gets, on the owner's own account. The gift is
 * created only when Stripe confirms the payment, and the customer claims it the
 * usual way, by signing in with the email shown here. The server reads that
 * email from the customer's account, so the gift cannot land on anyone else.
 */

type Step = 'choose' | 'review';

const PLAN_ORDER: GiftPlan[] = ['basic', 'plus', 'premium', 'elite'];

function splitName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function addressLine(address: { line1?: string; city?: string; state?: string; zip?: string }) {
  return [address.line1, address.city, `${address.state || ''} ${address.zip || ''}`.trim()].filter(Boolean).join(', ');
}

function usableAddress(address: AddressDetailed) {
  return Boolean(String(address.line1 || '').trim() && (String(address.city || '').trim() || String(address.zip || '').trim()));
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-slate-950">{children}</dd>
    </div>
  );
}

export default function AdminGiftModal({
  user,
  addressId,
  onClose,
}: {
  user: User;
  addressId?: string | null;
  onClose: () => void;
}) {
  const addresses = useMemo(() => (user.addressesDetailed || []).filter(usableAddress), [user.addressesDetailed]);
  const startAddress =
    addresses.find((address) => address._id === addressId) ||
    addresses.find((address) => address.isDefault) ||
    addresses[0] ||
    null;
  const name = splitName(user.name);

  const [options, setOptions] = useState<GiftOptions | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'off' | 'error'>('loading');
  const [step, setStep] = useState<Step>('choose');
  const [plan, setPlan] = useState<GiftPlan>(() => {
    const current = String(startAddress?.plan || '').toLowerCase();
    return (PLAN_ORDER as string[]).includes(current) ? (current as GiftPlan) : 'basic';
  });
  const [months, setMonths] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(startAddress?._id || '');
  const [firstName, setFirstName] = useState(name.firstName);
  const [lastName, setLastName] = useState(name.lastName);
  const [phone, setPhone] = useState(user.phone || '');
  const [manualAddress, setManualAddress] = useState({ line1: '', city: '', state: 'NY', zip: '' });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getGiftOptions()
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setLoadState('off');
          return;
        }
        setOptions(data);
        setMonths((current) => current ?? data.defaultDurationMonths ?? data.durations[0] ?? null);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !paying) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, paying]);

  const planOption = options?.plans.find((option) => option.plan === plan) || null;
  const quote = planOption?.quotes.find((entry) => entry.durationMonths === months) || null;
  const chosenAddress = addresses.find((address) => address._id === selectedAddressId) || null;
  const needsManualAddress = addresses.length === 0;
  const manualComplete = Boolean(
    manualAddress.line1.trim() && manualAddress.city.trim() && manualAddress.state.trim() && manualAddress.zip.trim()
  );
  const canReview = Boolean(quote && firstName.trim() && (needsManualAddress ? manualComplete : chosenAddress));
  const currency = options?.currency || 'usd';

  const handlePay = async () => {
    if (!quote || paying) return;
    setPaying(true);
    setError('');
    try {
      const { url } = await createGiftCheckoutSession({
        plan,
        durationMonths: quote.durationMonths,
        // The email is not sent: the server takes it from the customer's account.
        recipient: { firstName: firstName.trim(), lastName: lastName.trim(), email: '', phone: phone.trim() },
        address: needsManualAddress ? manualAddress : { line1: '', city: '', state: '', zip: '' },
        forCustomer: { userId: user._id, addressId: needsManualAddress ? null : selectedAddressId },
      });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof GiftError ? err.message : 'Checkout could not be opened. Please try again.');
      setPaying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:items-center"
      onClick={() => !paying && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Gift a membership to ${user.name}`}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-2xl bg-white/10">
                <GiftIcon className="h-5 w-5 text-violet-200" aria-hidden="true" />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Gift a membership</div>
                <div className="mt-0.5 text-lg font-black leading-tight">{user.name || 'Customer'}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={paying}
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              aria-label="Close gift"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
            <span className={step === 'choose' ? 'text-white' : 'text-slate-500'}>1 Choose</span>
            <span className="text-slate-600">·</span>
            <span className={step === 'review' ? 'text-white' : 'text-slate-500'}>2 Review & pay</span>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loadState === 'loading' && <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />}
          {loadState === 'off' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              Gift memberships are switched off right now.
            </div>
          )}
          {loadState === 'error' && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              Gift options could not be loaded. Close this and try again.
            </div>
          )}

          {loadState === 'ready' && options && step === 'choose' && (
            <div className="space-y-5">
              <section>
                <div className={labelClass}>Recipient</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" aria-label="First name" />
                    <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" aria-label="Last name" />
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                    <LockClosedIcon className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="min-w-0 truncate font-medium">{user.email}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    The gift is tied to this account email. They claim it by signing in with it.
                  </p>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Phone (optional), for a text invitation</span>
                    <input
                      className={inputClass}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      aria-label="Phone (optional)"
                      inputMode="tel"
                    />
                  </label>
                </div>
              </section>

              <section>
                <div className={labelClass}>Address</div>
                {needsManualAddress ? (
                  <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                    <p className="text-xs font-medium text-amber-800">No address on file. Add the home this gift is for.</p>
                    <input className={inputClass} placeholder="Street address" aria-label="Street address" value={manualAddress.line1} onChange={(e) => setManualAddress({ ...manualAddress, line1: e.target.value })} />
                    <div className="grid grid-cols-[1fr_64px_88px] gap-2">
                      <input className={inputClass} placeholder="City" aria-label="City" value={manualAddress.city} onChange={(e) => setManualAddress({ ...manualAddress, city: e.target.value })} />
                      <input className={inputClass} placeholder="State" aria-label="State" value={manualAddress.state} onChange={(e) => setManualAddress({ ...manualAddress, state: e.target.value.toUpperCase().slice(0, 2) })} />
                      <input className={inputClass} placeholder="ZIP" aria-label="ZIP" inputMode="numeric" value={manualAddress.zip} onChange={(e) => setManualAddress({ ...manualAddress, zip: e.target.value.slice(0, 10) })} />
                    </div>
                  </div>
                ) : addresses.length === 1 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">
                    {addressLine(addresses[0])}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addresses.map((address) => (
                      <label
                        key={address._id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                          selectedAddressId === address._id ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gift-address"
                          className="mt-1 accent-violet-600"
                          checked={selectedAddressId === address._id}
                          onChange={() => setSelectedAddressId(address._id)}
                        />
                        <span>
                          <span className="font-medium text-slate-900">{addressLine(address)}</span>
                          {address.label && <span className="ml-2 text-xs text-slate-500">{address.label}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className={labelClass}>Plan</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PLAN_ORDER.filter((key) => options.plans.some((option) => option.plan === key)).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlan(key)}
                      aria-pressed={plan === key}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                        plan === key ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {planLabel(key)}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className={labelClass}>Length</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {options.durations.map((length) => {
                    const lengthQuote = planOption?.quotes.find((entry) => entry.durationMonths === length);
                    if (!lengthQuote) return null;
                    const active = months === length;
                    return (
                      <button
                        key={length}
                        type="button"
                        onClick={() => setMonths(length)}
                        aria-pressed={active}
                        className={`rounded-xl border px-2 py-2 text-center transition ${
                          active ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-sm font-bold text-slate-950">{monthsLabel(length)}</span>
                        <span className="block text-xs text-slate-500">{formatMoneyCents(lengthQuote.totalCents, currency)}</span>
                      </button>
                    );
                  })}
                </div>
                {quote?.savingsCents ? (
                  <p className="mt-1.5 text-xs font-semibold text-emerald-700">
                    Saves {formatMoneyCents(quote.savingsCents, currency)} at the annual rate.
                  </p>
                ) : null}
              </section>
            </div>
          )}

          {loadState === 'ready' && step === 'review' && quote && (
            <div>
              <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
                <Row label="Recipient">
                  {`${firstName} ${lastName}`.trim()}
                  <span className="block text-xs font-medium text-slate-500">{user.email}</span>
                </Row>
                <Row label="Home">
                  <span className="font-medium">{needsManualAddress ? addressLine(manualAddress) : chosenAddress ? addressLine(chosenAddress) : ''}</span>
                </Row>
                <Row label="Plan">{planLabel(plan)}</Row>
                <Row label="Duration">{monthsLabel(quote.durationMonths)}</Row>
                <Row label="Price">{formatMoneyCents(quote.totalCents, currency)}</Row>
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-sm font-bold text-slate-950">Total payable</dt>
                  <dd className="text-right">
                    <span className="text-lg font-black text-slate-950">{formatMoneyCents(quote.totalCents, currency)}</span>
                    <span className="block text-[11px] font-medium text-slate-500">plus sales tax, calculated at checkout</span>
                  </dd>
                </div>
              </dl>
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
                <li>• You pay by card on Stripe, like any customer. A promotion code can be entered there.</li>
                <li>• Nothing is created until the payment succeeds.</li>
                <li>
                  • {firstName || 'They'} will get the gift invitation by email at {user.email} and claim it by signing in.
                  If they already pay for a membership at that home, the gift starts after it ends.
                </li>
              </ul>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
          )}
        </div>

        {loadState === 'ready' && (
          <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {step === 'choose' ? (
              <>
                <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  disabled={!canReview}
                  className="flex-[2] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Review{quote ? ` · ${formatMoneyCents(quote.totalCents, currency)}` : ''}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep('choose')} disabled={paying} className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                  Back
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying}
                  className="flex-[2] rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {paying ? 'Opening secure checkout…' : 'Pay with Stripe'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
