'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminSheet, { Notice, PrimaryButton, Segmented, deliveryText, labelClass } from './AdminSheet';
import {
  getMembershipOptions,
  getSalesOptions,
  readFailure,
  sellMembership,
  type Channel,
  type MembershipHome,
  type SalesOptions,
} from '@/lib/admin-tools-service';

/*
 * Customer details → Buy Membership.
 *
 * Pay by phone: Stripe's own checkout opens in a new tab on THIS device and
 * the card the customer reads out is typed there - never into Profixter.
 * Send link: the customer gets a secure profixter.com/pay link by email/text.
 * Either way the membership switches on by itself when Stripe confirms the
 * payment, and a home that is already billed is refused by the server.
 */

export function openInNewTab(): Window | null {
  // Opened on the tap itself: browsers block a tab opened after an await.
  try {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    return tab;
  } catch {
    return null;
  }
}

export default function BuyMembershipSheet({
  customer,
  onClose,
  onDone,
}: {
  customer: { _id: string; name: string; email?: string; phone?: string };
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const [options, setOptions] = useState<SalesOptions | null>(null);
  const [homes, setHomes] = useState<MembershipHome[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [method, setMethod] = useState<'phone' | 'link'>('phone');
  const [channels, setChannels] = useState<Channel[]>(['email', 'sms']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneUrl, setPhoneUrl] = useState('');

  useEffect(() => {
    Promise.all([getSalesOptions(), getMembershipOptions(customer._id)])
      .then(([sales, membership]) => {
        setOptions(sales);
        setHomes(membership.homes);
        const firstOpen = membership.homes.find((h) => h.canBuy);
        if (firstOpen) setAddressId(firstOpen.addressId);
      })
      .catch((err) => setError(readFailure(err).message));
  }, [customer._id]);

  const selectedPlan = useMemo(() => options?.plans.find((p) => p.key === plan) || null, [options, plan]);
  const price = selectedPlan ? (cycle === 'annual' ? selectedPlan.annual : selectedPlan.monthly) : null;
  const ready = !!addressId && !!plan && (method === 'phone' || channels.length > 0);

  const toggleChannel = (channel: Channel) =>
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));

  const submit = async () => {
    if (!ready || !addressId || !plan) return;
    setBusy(true);
    setError('');
    const tab = method === 'phone' ? openInNewTab() : null;
    try {
      const result = await sellMembership(customer._id, { addressId, plan, billingCycle: cycle, method, channels });
      if (result.method === 'phone') {
        setPhoneUrl(result.url);
        if (tab) tab.location.href = result.url;
      } else {
        onDone(`Payment link sent to ${customer.name || 'customer'}. ${deliveryText(result.delivery)}.`);
      }
    } catch (err) {
      tab?.close();
      setError(readFailure(err).message);
    } finally {
      setBusy(false);
    }
  };

  const noHomes = homes && homes.length === 0;

  return (
    <AdminSheet
      eyebrow="Buy membership"
      title={customer.name || 'Customer'}
      subtitle={[customer.phone, customer.email].filter(Boolean).join(' · ')}
      onClose={onClose}
      busy={busy}
      testId="buy-membership"
      footer={
        phoneUrl ? (
          <div className="space-y-2">
            <a
              href={phoneUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-action="open-stripe"
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-sky-600 px-4 text-[15px] font-bold text-white"
            >
              Open payment page
            </a>
            <button type="button" onClick={() => onDone('Membership checkout opened. It activates when Stripe confirms payment.')} className="w-full text-sm font-semibold text-slate-600">
              Done
            </button>
          </div>
        ) : (
          <PrimaryButton disabled={!ready || busy || !!noHomes} onClick={submit} testId="buy-membership-submit">
            {busy ? 'Working…' : method === 'phone' ? `Take payment${price ? ` · $${price.toLocaleString()}` : ''}` : 'Send payment link'}
          </PrimaryButton>
        )
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      {phoneUrl && (
        <Notice tone="ok">
          Stripe&apos;s checkout is open in a new tab. Type the card the customer reads out there. The membership turns on by itself once paid.
        </Notice>
      )}
      {!options || !homes ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading…</div>
      ) : noHomes ? (
        <Notice tone="warn">Add a home address first (Edit), then sell the membership.</Notice>
      ) : (
        <>
          <div>
            <span className={labelClass}>Home</span>
            <div className="space-y-2">
              {homes.map((home) => (
                <button
                  key={home.addressId}
                  type="button"
                  disabled={!home.canBuy}
                  onClick={() => setAddressId(home.addressId)}
                  data-home={home.addressId}
                  className={`block w-full rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed ${
                    addressId === home.addressId ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200' : 'border-slate-200 bg-white'
                  } ${home.canBuy ? '' : 'opacity-60'}`}
                >
                  <span className="block font-semibold text-slate-900">{home.line}</span>
                  {home.blocked && <span className="mt-0.5 block text-xs font-semibold text-amber-700">{home.blocked.message}</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelClass}>Plan</span>
            <Segmented
              name="Plan"
              value={plan}
              onChange={setPlan}
              options={options.plans.map((p) => ({ value: p.key, label: p.label, hint: `$${(cycle === 'annual' ? p.annual : p.monthly).toLocaleString()}/${cycle === 'annual' ? 'yr' : 'mo'}` }))}
            />
          </div>

          <div>
            <span className={labelClass}>Billing</span>
            <Segmented
              name="Billing"
              value={cycle}
              onChange={setCycle}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'annual', label: 'Annual' },
              ]}
            />
          </div>

          <div>
            <span className={labelClass}>Payment</span>
            <Segmented
              name="Payment"
              value={method}
              onChange={setMethod}
              options={[
                { value: 'phone', label: 'Pay by phone', hint: 'Type their card in Stripe' },
                { value: 'link', label: 'Send payment link', hint: 'They pay themselves' },
              ]}
            />
          </div>

          {method === 'link' && (
            <div className="flex gap-2">
              {(['email', 'sms'] as Channel[]).map((channel) => (
                <label key={channel} className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${channels.includes(channel) ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-700'}`}>
                  <input type="checkbox" className="h-4 w-4" checked={channels.includes(channel)} onChange={() => toggleChannel(channel)} />
                  {channel === 'email' ? 'Email' : 'Text'}
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </AdminSheet>
  );
}
