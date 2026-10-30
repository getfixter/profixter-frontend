'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AddressField, { type AddressValue } from '@/app/components/address/AddressField';
import AdminSheet, { FieldError, Notice, PrimaryButton, Segmented, deliveryText, inputClass, labelClass } from './AdminSheet';
import { openInNewTab } from './BuyMembershipSheet';
import { compressImage } from '@/lib/compressImage';
import { getFullDayAvailability, getTimeSlots } from '@/lib/booking-service';
import { getBookableSlots, normalizeDayAvailability } from '@/lib/booking-calendar-availability';
import { createVisit, getSalesOptions, readFailure, type Channel, type SalesOptions, type VisitType } from '@/lib/admin-tools-service';
import type { User } from '@/lib/admin-service';

/*
 * Admin → Create Visit, for an existing customer or a guest with no account.
 *
 *  Membership Visit   the home's active plan and its limit apply (server-checked)
 *  One-Time / Full Day  paid: pay by phone (Stripe opens here) or send a link
 *  Free Visit — Admin   the owner's discretionary visit: no payment, and it
 *                       never touches the free-first-visit offer or a plan's limit
 *
 * Times come from the same availability the customer sees (company lead time;
 * the member seven-day rule is the customer's own and does not bind Admin).
 * Photos are optional, from the library or the camera.
 */

type Customer = Pick<User, '_id' | 'userId' | 'name' | 'email' | 'phone' | 'addresses'> & {
  addressesDetailed?: Array<{ _id: string; plan?: string | null }>;
};

const MAX_PHOTOS = 10;
const todayNY = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

function formatTime12(t: string) {
  const [hh, mm] = t.split(':').map(Number);
  if (!Number.isFinite(hh)) return t;
  const period = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(mm || 0).padStart(2, '0')} ${period}`;
}

async function shrink(file: File): Promise<File> {
  // A photo the browser cannot decode (HEIC outside Safari) is sent as-is; the server re-encodes it.
  return Promise.race([compressImage(file), new Promise<File>((resolve) => setTimeout(() => resolve(file), 8000))]);
}

export default function CreateVisitSheet({
  customers = [],
  presetCustomer = null,
  onClose,
  onCreated,
}: {
  customers?: Customer[];
  presetCustomer?: Customer | null;
  onClose: () => void;
  onCreated: (note: string) => void;
}) {
  const [mode, setMode] = useState<'existing' | 'guest'>(presetCustomer || customers.length ? 'existing' : 'guest');
  const [customer, setCustomer] = useState<Customer | null>(presetCustomer);
  const [query, setQuery] = useState('');
  const [addressId, setAddressId] = useState<string | null>(presetCustomer?.addresses?.[0]?._id || null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState<AddressValue | null>(null);
  const [guestSms, setGuestSms] = useState(true);

  const [type, setType] = useState<VisitType | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [fullDayOk, setFullDayOk] = useState<null | { ok: boolean; reason: string }>(null);
  const [task, setTask] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<'phone' | 'link'>('phone');
  const [channels, setChannels] = useState<Channel[]>(['email', 'sms']);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [options, setOptions] = useState<SalesOptions | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneUrl, setPhoneUrl] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSalesOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || customer) return [];
    const digits = q.replace(/\D/g, '');
    return customers
      .filter((c) => {
        const phone = String(c.phone || '').replace(/\D/g, '');
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.email || '').toLowerCase().includes(q) ||
          (digits.length >= 3 && phone.includes(digits)) ||
          (c.addresses || []).some((a) => String(a.line1 || '').toLowerCase().includes(q))
        );
      })
      .slice(0, 8);
  }, [customers, customer, query]);

  const hasPlan = useMemo(() => {
    if (!customer || !addressId) return false;
    const detailed = customer.addressesDetailed?.find((a) => String(a._id) === String(addressId));
    return Boolean(detailed?.plan);
  }, [customer, addressId]);

  const isFullDay = type === 'full_day';
  const paid = type === 'one_time' || type === 'full_day';

  useEffect(() => {
    setTime('');
    setSlots(null);
    setFullDayOk(null);
    if (!date || !type) return;
    let alive = true;
    if (isFullDay) {
      getFullDayAvailability(date, date)
        .then((res) => alive && setFullDayOk({ ok: !!res.days?.[0]?.available, reason: res.days?.[0]?.reason || '' }))
        .catch(() => alive && setFullDayOk({ ok: false, reason: 'Could not check this day.' }));
    } else {
      getTimeSlots(date)
        .then((res) => alive && setSlots(getBookableSlots(normalizeDayAvailability(res as never)).map((s) => s.time)))
        .catch(() => alive && setSlots([]));
    }
    return () => {
      alive = false;
    };
  }, [date, type, isFullDay]);

  const addPhotos = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(list).slice(0, Math.max(0, room));
    const ready = await Promise.all(picked.map(shrink));
    setPhotos((prev) => [...prev, ...ready].slice(0, MAX_PHOTOS));
  };

  const pickCustomer = (c: Customer) => {
    setCustomer(c);
    setAddressId(c.addresses?.[0]?._id || null);
    setQuery('');
    if (type === 'membership') setType(null);
  };

  const whoReady = mode === 'existing' ? !!customer && !!addressId : !!guestName.trim() && !!guestPhone.trim() && !!guestEmail.trim() && !!guestAddress?.line1;
  const whenReady = isFullDay ? !!date && fullDayOk?.ok !== false : !!date && !!time;
  const ready = whoReady && !!type && whenReady && !!task.trim() && (!paid || payment === 'phone' || channels.length > 0);

  const submit = async () => {
    if (!ready || !type) return;
    setBusy(true);
    setErrors({});
    setMessage('');
    const tab = paid && payment === 'phone' ? openInNewTab() : null;
    try {
      const result = await createVisit({
        mode,
        userId: customer?._id,
        addressId: addressId || undefined,
        guest:
          mode === 'guest' && guestAddress
            ? { name: guestName.trim(), phone: guestPhone.trim(), email: guestEmail.trim(), line1: guestAddress.line1, unit: guestAddress.unit, city: guestAddress.city, state: guestAddress.state || 'NY', zip: guestAddress.zip, smsConsent: guestSms }
            : undefined,
        type,
        date,
        time: isFullDay ? undefined : time,
        task: task.trim(),
        description: description.trim(),
        notes: notes.trim(),
        payment: paid ? payment : undefined,
        channels: paid && payment === 'link' ? channels : undefined,
        photos,
      });
      const label = `#${result.booking.bookingNumber}`;
      if (result.payment?.method === 'phone') {
        setPhoneUrl(result.payment.url);
        if (tab) tab.location.href = result.payment.url;
      } else if (result.payment?.method === 'link') {
        onCreated(`Visit ${label} held · payment link sent. ${deliveryText(result.payment.delivery)}.`);
      } else {
        onCreated(`Visit ${label} created.`);
      }
    } catch (err) {
      tab?.close();
      const failure = readFailure(err);
      setErrors(failure.errors);
      setMessage(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const typeOptions: Array<{ value: VisitType; label: string; hint?: string; disabled?: boolean }> = [
    { value: 'membership', label: 'Membership Visit', hint: mode === 'guest' ? 'Account needed' : hasPlan ? 'Included in plan' : 'No active plan here', disabled: mode === 'guest' || !hasPlan },
    { value: 'one_time', label: 'One-Time Visit', hint: options?.oneTime ? `$${Math.round(options.oneTime.priceCents / 100)}` : 'Paid', disabled: options ? !options.oneTime.enabled : false },
    { value: 'full_day', label: 'Full Day', hint: options?.fullDay ? `$${Math.round(options.fullDay.priceCents / 100)}` : 'Paid', disabled: options ? !options.fullDay.enabled : false },
    { value: 'admin_free', label: 'Free Visit — Admin', hint: 'No payment' },
  ];

  return (
    <AdminSheet
      eyebrow="Create visit"
      title={mode === 'existing' && customer ? customer.name || 'Customer' : mode === 'guest' ? 'Guest visit' : 'Choose a customer'}
      subtitle={mode === 'existing' && customer ? [customer.phone, customer.email].filter(Boolean).join(' · ') : 'No account needed'}
      onClose={onClose}
      busy={busy}
      testId="create-visit"
      footer={
        phoneUrl ? (
          <div className="space-y-2">
            <a href={phoneUrl} target="_blank" rel="noopener noreferrer" data-action="open-stripe" className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-sky-600 px-4 text-[15px] font-bold text-white">
              Open payment page
            </a>
            <button type="button" onClick={() => onCreated('Visit held. It confirms when Stripe confirms payment.')} className="w-full text-sm font-semibold text-slate-600">
              Done
            </button>
          </div>
        ) : (
          <PrimaryButton disabled={!ready || busy} onClick={submit} testId="create-visit-submit">
            {busy ? 'Creating…' : paid ? (payment === 'phone' ? 'Hold time & take payment' : 'Hold time & send link') : 'Create visit'}
          </PrimaryButton>
        )
      }
    >
      {message && <Notice tone="error">{message}</Notice>}
      {phoneUrl && <Notice tone="ok">The time is held. Stripe&apos;s checkout is open in a new tab — type the card the customer reads out there.</Notice>}

      {!presetCustomer && (
        <Segmented
          name="Customer"
          value={mode}
          onChange={(next) => {
            setMode(next);
            if (next === 'guest' && type === 'membership') setType(null);
          }}
          options={[
            { value: 'existing', label: 'Existing customer' },
            { value: 'guest', label: 'New / guest', hint: 'No account' },
          ]}
        />
      )}

      {mode === 'existing' ? (
        <div className="space-y-2">
          {customer ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{customer.name || 'Unnamed'}</div>
                <div className="truncate text-xs text-slate-500">{customer.phone || customer.email}</div>
              </div>
              {!presetCustomer && (
                <button type="button" onClick={() => setCustomer(null)} className="text-xs font-bold text-sky-700">
                  Change
                </button>
              )}
            </div>
          ) : (
            <div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, email or street"
                className={inputClass}
                data-input="customer-search"
              />
              {matches.length > 0 && (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {matches.map((c) => (
                    <button key={c._id} type="button" onClick={() => pickCustomer(c)} data-customer-hit={c._id} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50">
                      <div className="text-sm font-semibold text-slate-900">{c.name || 'Unnamed'}</div>
                      <div className="text-xs text-slate-500">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && !matches.length && <div className="mt-1 text-xs text-slate-500">No match. Use “New / guest”, or create the customer first.</div>}
            </div>
          )}
          {customer && (
            <div>
              <span className={labelClass}>Service address</span>
              {(customer.addresses || []).length ? (
                <select value={addressId || ''} onChange={(e) => setAddressId(e.target.value)} className={inputClass} data-input="address">
                  {customer.addresses.map((a) => (
                    <option key={a._id} value={a._id}>
                      {[a.line1, a.city, a.zip].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
              ) : (
                <Notice tone="warn">No address on this account. Add one with Edit, or book as a guest.</Notice>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputClass} data-input="guest-name" />
            <FieldError message={errors.guestName} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Phone</span>
              <input type="tel" inputMode="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={inputClass} data-input="guest-phone" />
              <FieldError message={errors.guestPhone} />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input type="email" inputMode="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={inputClass} data-input="guest-email" />
              <FieldError message={errors.guestEmail} />
            </label>
          </div>
          <div>
            <span className={labelClass}>Service address</span>
            <AddressField value={guestAddress} onChange={setGuestAddress} />
            <FieldError message={errors.guest_line1 || errors.guest_city || errors.guest_zip} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={guestSms} onChange={(e) => setGuestSms(e.target.checked)} />
            OK to text about this visit (agreed on the call)
          </label>
        </div>
      )}

      <div>
        <span className={labelClass}>Visit type</span>
        <Segmented name="Visit type" value={type} onChange={setType} options={typeOptions} />
      </div>

      <div className={isFullDay ? '' : 'grid grid-cols-1 gap-3'}>
        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" min={todayNY()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} data-input="date" />
          <FieldError message={errors.date} />
        </label>
        {type && date && !isFullDay && (
          <div>
            <span className={labelClass}>Time</span>
            {slots === null ? (
              <div className="text-sm text-slate-500">Checking times…</div>
            ) : slots.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    data-slot={slot}
                    className={`min-h-[44px] rounded-xl border text-sm font-bold ${time === slot ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-800'}`}
                  >
                    {formatTime12(slot)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm font-semibold text-amber-700">No open times this day.</div>
            )}
            <FieldError message={errors.time} />
          </div>
        )}
        {isFullDay && date && fullDayOk && !fullDayOk.ok && <div className="mt-1 text-sm font-semibold text-amber-700">{fullDayOk.reason || 'This day is not available.'}</div>}
      </div>

      <label className="block">
        <span className={labelClass}>Task</span>
        <input value={task} onChange={(e) => setTask(e.target.value)} maxLength={120} placeholder="e.g. Fix leaking faucet" className={inputClass} data-input="task" />
        <FieldError message={errors.task} />
      </label>
      <label className="block">
        <span className={labelClass}>Details (optional)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} data-input="description" />
      </label>
      <label className="block">
        <span className={labelClass}>Internal notes (optional)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Only staff see this" className={inputClass} />
      </label>

      <div>
        <span className={labelClass}>Photos (optional)</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={photos.length >= MAX_PHOTOS} className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 disabled:opacity-50">
            Take photo
          </button>
          <button type="button" onClick={() => libraryRef.current?.click()} disabled={photos.length >= MAX_PHOTOS} className="min-h-[44px] flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 disabled:opacity-50">
            Choose photos
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" data-input="camera" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" data-input="photos" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
        {previews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" data-photo-count={previews.length}>
            {previews.map((src, index) => (
              <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove photo" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-950/70 text-xs text-white">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {paid && (
        <div className="space-y-2">
          <span className={labelClass}>Payment</span>
          <Segmented
            name="Payment"
            value={payment}
            onChange={setPayment}
            options={[
              { value: 'phone', label: 'Pay by phone', hint: 'Type their card in Stripe' },
              { value: 'link', label: 'Send payment link', hint: 'Time held 24h' },
            ]}
          />
          {payment === 'link' && (
            <div className="flex gap-2">
              {(['email', 'sms'] as Channel[]).map((channel) => (
                <label key={channel} className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${channels.includes(channel) ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-700'}`}>
                  <input type="checkbox" className="h-4 w-4" checked={channels.includes(channel)} onChange={() => setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]))} />
                  {channel === 'email' ? 'Email' : 'Text'}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminSheet>
  );
}
