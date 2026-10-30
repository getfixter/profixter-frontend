'use client';

import React, { useState } from 'react';
import AddressField, { type AddressValue } from '@/app/components/address/AddressField';
import AdminSheet, { FieldError, Notice, PrimaryButton, Switch, deliveryText, inputClass, labelClass } from './AdminSheet';
import { createCustomer, readFailure, type CommunicationKey, type CreatedCustomer } from '@/lib/admin-tools-service';

/*
 * Admin → Create Customer, for someone on the phone.
 *
 * The account is active at once; the customer gets an email and a text with
 * their temporary password (their phone number) and must set their own on
 * first sign-in. All four communication switches start on: the call is the
 * consent, and the server records who took it.
 */

const SWITCHES: Array<{ key: CommunicationKey; label: string }> = [
  { key: 'service.email', label: 'Service email' },
  { key: 'service.sms', label: 'Service texts' },
  { key: 'marketing.email', label: 'Marketing email' },
  { key: 'marketing.sms', label: 'Marketing texts' },
];

type Existing = { id: string; name: string; email?: string } | Array<{ id: string; name: string; email?: string }> | null;

export default function CreateCustomerSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: CreatedCustomer, note: string) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState<AddressValue | null>(null);
  const [communication, setCommunication] = useState<Record<CommunicationKey, boolean>>({
    'service.email': true,
    'service.sms': true,
    'marketing.email': true,
    'marketing.sms': true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [existing, setExisting] = useState<Existing>(null);
  const [phoneShared, setPhoneShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (allowSharedPhone = false) => {
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      const result = await createCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        addresses: address?.line1
          ? [{ line1: address.line1, unit: address.unit, city: address.city, state: address.state || 'NY', zip: address.zip, placeId: address.placeId, lat: address.lat, lng: address.lng }]
          : [],
        communication,
        allowSharedPhone,
      });
      const warn = result.warnings.includes('address_outside_service_area') ? ' Address is outside the service area.' : '';
      onCreated(result.customer, `${result.customer.name} created. ${deliveryText(result.delivery)}.${warn}`);
    } catch (error) {
      const failure = readFailure(error);
      setErrors(failure.errors);
      setMessage(failure.message);
      setExisting((failure.existing as Existing) || null);
      setPhoneShared(failure.code === 'PHONE_IN_USE');
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) => errors[key] || errors[key.replace('addresses.0.', '')];

  return (
    <AdminSheet
      eyebrow="New customer"
      title="Create customer"
      subtitle="Active right away · sign-in details sent by email and text"
      onClose={onClose}
      busy={saving}
      testId="create-customer"
      footer={
        <PrimaryButton disabled={saving} onClick={() => submit(false)} testId="create-customer-submit">
          {saving ? 'Creating…' : 'Create customer'}
        </PrimaryButton>
      }
    >
      {message && (
        <Notice tone={phoneShared ? 'warn' : 'error'}>
          <div>{message}</div>
          {existing && !Array.isArray(existing) && existing.name && <div className="mt-1 text-xs">Existing account: {existing.name}</div>}
          {Array.isArray(existing) && existing.length > 0 && (
            <div className="mt-1 text-xs">On: {existing.map((e) => `${e.name || 'Unnamed'}${e.email ? ` (${e.email})` : ''}`).join(', ')}</div>
          )}
          {phoneShared && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={saving}
              data-action="create-customer-shared-phone"
              className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900"
            >
              It&apos;s a different person — create anyway
            </button>
          )}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>First name</span>
          <input name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" className={inputClass} />
          <FieldError message={errors.firstName} />
        </label>
        <label className="block">
          <span className={labelClass}>Last name</span>
          <input name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" className={inputClass} />
          <FieldError message={errors.lastName} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Phone</span>
        <input name="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" className={inputClass} />
        <FieldError message={errors.phone} />
        <span className="mt-1 block text-xs text-slate-500">Also their temporary password.</span>
      </label>
      <label className="block">
        <span className={labelClass}>Email</span>
        <input name="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={inputClass} />
        <FieldError message={errors.email} />
      </label>

      <div>
        <span className={labelClass}>Home address (optional)</span>
        <AddressField value={address} onChange={setAddress} />
        <FieldError message={fieldError('addresses.0.line1') || fieldError('addresses.0.city') || fieldError('addresses.0.zip') || errors.addresses} />
      </div>

      <div className="rounded-2xl border border-slate-200 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Messages (agreed on this call)</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {SWITCHES.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{item.label}</span>
              <Switch
                checked={communication[item.key]}
                label={item.label}
                testId={`new-${item.key}`}
                onChange={(next) => setCommunication((prev) => ({ ...prev, [item.key]: next }))}
              />
            </div>
          ))}
        </div>
      </div>
    </AdminSheet>
  );
}
