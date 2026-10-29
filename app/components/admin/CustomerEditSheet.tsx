'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AddressField, { type AddressValue } from '@/app/components/address/AddressField';
import type { User } from '@/lib/admin-service';
import {
  getCustomerProfile,
  saveCustomerProfile,
  type CustomerProfile,
  type ProfileAddressInput,
  type ProfilePatch,
  type ProfileSaveError,
  type ProfileWarning,
} from './customer-profile-api';

/*
 * Edit one customer's names, phone, email and saved addresses.
 *
 * The server is the authority on every rule here (owner-only phone and email,
 * validation, the sign-in guarantee, address history); this sheet shows its
 * answers next to the fields they belong to. Only fields that actually changed
 * are sent, so a staff member saving an address never "touches" the phone.
 */

type AddressDraft = {
  key: string;
  _id?: string;
  label: string;
  line1: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
  hasHistory: boolean;
  hasActivePlan: boolean;
  introVisitStatus: string | null;
};

interface Props {
  userId: string;
  onClose: () => void;
  onSaved: (user: User) => void;
}

const inputClass =
  'block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500';

let draftSeq = 0;
const newKey = () => `new-${++draftSeq}`;

function draftsFrom(profile: CustomerProfile): AddressDraft[] {
  return profile.addresses.map((a) => ({
    key: a._id,
    _id: a._id,
    label: a.label,
    line1: a.line1,
    unit: '',
    city: a.city,
    state: a.state || 'NY',
    zip: a.zip,
    county: a.county,
    placeId: a.placeId,
    lat: null,
    lng: null,
    hasHistory: a.hasHistory,
    hasActivePlan: a.hasActivePlan,
    introVisitStatus: a.introVisitStatus,
  }));
}

function toInput(draft: AddressDraft, isDefault: boolean): ProfileAddressInput {
  return {
    ...(draft._id ? { _id: draft._id } : {}),
    label: draft.label.trim(),
    line1: draft.line1.trim(),
    unit: draft.unit.trim(),
    city: draft.city.trim(),
    state: draft.state.trim().toUpperCase(),
    zip: draft.zip.trim(),
    ...(draft.placeId ? { placeId: draft.placeId, lat: draft.lat, lng: draft.lng } : {}),
    isDefault,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs font-semibold text-rose-600" role="alert">
      {message}
    </p>
  );
}

function VerifiedChip({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      Verified
    </span>
  ) : (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      Not verified
    </span>
  );
}

const METHOD_LABELS: Record<string, string> = { email: 'Email', phone: 'Phone', google: 'Google', apple: 'Apple' };

export default function CustomerEditSheet({ userId, onClose, onSaved }: Props) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [canEditContact, setCanEditContact] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addresses, setAddresses] = useState<AddressDraft[]>([]);
  const [removed, setRemoved] = useState<AddressDraft[]>([]);
  const [defaultKey, setDefaultKey] = useState<string | null>(null);
  const [lookupKey, setLookupKey] = useState<string | null>(null);
  const [lookupValue, setLookupValue] = useState<AddressValue | null>(null);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [warnings, setWarnings] = useState<ProfileWarning[]>([]);
  const [success, setSuccess] = useState<{ notices: string[]; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCustomerProfile(userId)
      .then((response) => {
        if (cancelled) return;
        const p = response.profile;
        setProfile(p);
        setCanEditContact(response.access.canEditContact);
        setFirstName(p.firstName);
        setLastName(p.lastName);
        setPhone(p.phone);
        setEmail(p.email);
        setAddresses(draftsFrom(p));
        setRemoved([]);
        setDefaultKey(p.defaultAddressId);
      })
      .catch((error) => {
        console.error('Failed to load customer profile:', error);
        if (!cancelled) setLoadError('Could not load this customer. Close and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const patch = useMemo<ProfilePatch>(() => {
    if (!profile) return {};
    const out: ProfilePatch = {};
    if (firstName.trim() !== profile.firstName) out.firstName = firstName;
    if (lastName.trim() !== profile.lastName) out.lastName = lastName;
    if (canEditContact && phone.trim() !== profile.phone) out.phone = phone.trim();
    if (canEditContact && email.trim().toLowerCase() !== profile.email.toLowerCase()) out.email = email.trim();
    const original = JSON.stringify(draftsFrom(profile).map((d) => toInput(d, d.key === profile.defaultAddressId)));
    const current = JSON.stringify(addresses.map((d) => toInput(d, d.key === defaultKey)));
    if (original !== current) out.addresses = addresses.map((d) => toInput(d, d.key === defaultKey));
    return out;
  }, [addresses, canEditContact, defaultKey, email, firstName, lastName, phone, profile]);

  const dirty = Object.keys(patch).length > 0;
  const contactChanging = patch.phone !== undefined || patch.email !== undefined;

  const updateAddress = (key: string, change: Partial<AddressDraft>) => {
    setAddresses((list) => list.map((a) => (a.key === key ? { ...a, ...change } : a)));
    setWarnings([]);
  };

  const addAddress = () => {
    const key = newKey();
    setAddresses((list) => [
      ...list,
      {
        key,
        label: list.length ? 'Home' : 'Primary',
        line1: '',
        unit: '',
        city: '',
        state: 'NY',
        zip: '',
        county: '',
        placeId: '',
        lat: null,
        lng: null,
        hasHistory: false,
        hasActivePlan: false,
        introVisitStatus: null,
      },
    ]);
    if (!defaultKey) setDefaultKey(key);
    setLookupKey(key);
    setLookupValue(null);
  };

  const removeAddress = (draft: AddressDraft) => {
    setAddresses((list) => list.filter((a) => a.key !== draft.key));
    if (draft._id) setRemoved((list) => [...list, draft]);
    if (defaultKey === draft.key) setDefaultKey(addresses.find((a) => a.key !== draft.key)?.key || null);
    if (lookupKey === draft.key) setLookupKey(null);
    setWarnings([]);
  };

  const restoreAddress = (draft: AddressDraft) => {
    setRemoved((list) => list.filter((a) => a.key !== draft.key));
    setAddresses((list) => [...list, draft]);
  };

  /* A picked lookup result fills the card; the fields stay editable afterwards. */
  const applyLookup = (key: string, value: AddressValue | null) => {
    setLookupValue(value);
    if (!value?.verified) return;
    updateAddress(key, {
      line1: value.line1,
      unit: value.unit || '',
      city: value.city,
      state: value.state || 'NY',
      zip: value.zip,
      placeId: value.placeId || '',
      lat: value.lat ?? null,
      lng: value.lng ?? null,
    });
    setLookupKey(null);
    setLookupValue(null);
  };

  const save = async (acknowledgeWarnings = false) => {
    if (!profile || !dirty || saving) return;
    setSaving(true);
    setErrors({});
    setFormError('');
    try {
      const result = await saveCustomerProfile(userId, {
        ...patch,
        expectedUpdatedAt: profile.updatedAt,
        ...(acknowledgeWarnings ? { acknowledgeWarnings: true } : {}),
      });
      setWarnings([]);
      onSaved(result.user);
      setProfile((current) => (current ? { ...current, name: result.user.name || '' } : current));
      setSuccess({ notices: result.notices || [], count: result.changes.length });
    } catch (error) {
      const failure = error as ProfileSaveError;
      if (failure.code === 'CONFIRM_WARNINGS') {
        setWarnings(failure.warnings);
      } else {
        setWarnings([]);
        setErrors(failure.errors || {});
        setFormError(failure.message || 'Could not save.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:px-3 sm:py-4"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-edit-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-4 text-white sm:px-6">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Edit customer</div>
            <h3 id="customer-edit-title" className="mt-1 truncate text-xl font-black leading-tight">
              {profile ? profile.name || 'Unnamed user' : 'Loading...'}
            </h3>
            {profile && <div className="mt-1 text-xs text-slate-300">ID {profile.userId}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Close editor"
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="space-y-4 px-5 py-6 sm:px-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status">
              <div className="text-base font-black text-emerald-800">Saved</div>
              <div className="mt-1 text-sm text-emerald-800">
                {success.count === 0 ? 'Nothing needed changing.' : `${success.count} change${success.count === 1 ? '' : 's'} saved. The list is updated.`}
              </div>
            </div>
            {success.notices.length > 0 && (
              <ul className="space-y-2">
                {success.notices.map((notice) => (
                  <li key={notice} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    {notice}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        ) : loadError ? (
          <div className="px-5 py-6 sm:px-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{loadError}</div>
          </div>
        ) : !profile ? (
          <div className="space-y-3 px-5 py-6 sm:px-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <>
            <form
              className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
              onSubmit={(event) => {
                event.preventDefault();
                void save(false);
              }}
              noValidate
            >
              <section className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>First name</span>
                  <input value={firstName} onChange={(e) => { setFirstName(e.target.value); setWarnings([]); }} maxLength={60} autoComplete="off" className={inputClass} />
                  <FieldError message={errors.firstName} />
                </label>
                <label className="block">
                  <span className={labelClass}>Last name</span>
                  <input value={lastName} onChange={(e) => { setLastName(e.target.value); setWarnings([]); }} maxLength={60} autoComplete="off" className={inputClass} />
                  <FieldError message={errors.lastName} />
                </label>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">Contact and sign-in</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.signInMethods.map((method) => (
                      <span key={method} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {METHOD_LABELS[method] || method}
                      </span>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className={labelClass.replace('mb-1 block ', '')}>Phone</span>
                    <VerifiedChip verified={Boolean(profile.phoneVerifiedAt) && phone.trim() === profile.phone} />
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setWarnings([]); }}
                    disabled={!canEditContact}
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="(631) 555-0100"
                    className={inputClass}
                  />
                  <FieldError message={errors.phone} />
                </label>
                <label className="block">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className={labelClass.replace('mb-1 block ', '')}>Email</span>
                    <VerifiedChip verified={Boolean(profile.emailVerifiedAt) && email.trim().toLowerCase() === profile.email.toLowerCase()} />
                  </span>
                  <input
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setWarnings([]); }}
                    disabled={!canEditContact}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="name@example.com"
                    className={inputClass}
                  />
                  <FieldError message={errors.email} />
                </label>
                {!canEditContact ? (
                  <p className="text-xs text-slate-500">Only the owner can change a phone or email: they are how the customer signs in.</p>
                ) : contactChanging ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    A new phone or email is saved as <strong>not verified</strong>. The customer must verify it themselves before it can sign
                    them in. Whoever controls a new email inbox can sign in with an email code, so double-check it.
                    {profile.stripeCustomer && patch.email !== undefined ? ' Stripe receipts keep going to the email saved in Stripe.' : ''}
                  </p>
                ) : null}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">Saved addresses</div>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100"
                  >
                    + Add address
                  </button>
                </div>
                <FieldError message={errors.addresses} />
                {addresses.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    No saved addresses.
                  </div>
                )}
                {addresses.map((draft, index) => {
                  const err = (field: string) => errors[`addresses.${index}.${field}`];
                  return (
                    <div key={draft.key} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" data-testid="address-card">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="default-address"
                            checked={defaultKey === draft.key}
                            onChange={() => setDefaultKey(draft.key)}
                            className="h-4 w-4 accent-sky-600"
                          />
                          Default
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {draft.hasActivePlan && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active plan</span>
                          )}
                          {draft.introVisitStatus && ['claimed', 'consumed'].includes(draft.introVisitStatus) && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Free visit used</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setLookupKey(lookupKey === draft.key ? null : draft.key);
                              setLookupValue(null);
                            }}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            {lookupKey === draft.key ? 'Close lookup' : 'Look up'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAddress(draft)}
                            disabled={draft.hasHistory}
                            title={draft.hasHistory ? 'Has bookings, a plan, a gift, loyalty or a free visit on record. Correct it instead.' : 'Remove this address'}
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <FieldError message={errors[`addresses.${index}`]} />

                      {lookupKey === draft.key && (
                        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                          <div className="mb-2 text-xs font-semibold text-sky-900">Search, pick the address, then check the fields below.</div>
                          <AddressField value={lookupValue} onChange={(value) => applyLookup(draft.key, value)} />
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <label className="block">
                          <span className={labelClass}>Street address</span>
                          <input value={draft.line1} onChange={(e) => updateAddress(draft.key, { line1: e.target.value, placeId: '' })} maxLength={120} className={inputClass} />
                          <FieldError message={err('line1')} />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Apt / Unit</span>
                          <input value={draft.unit} onChange={(e) => updateAddress(draft.key, { unit: e.target.value })} maxLength={30} placeholder="Optional" className={inputClass} />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_80px_110px]">
                        <label className="col-span-2 block sm:col-span-1">
                          <span className={labelClass}>City</span>
                          <input value={draft.city} onChange={(e) => updateAddress(draft.key, { city: e.target.value })} maxLength={60} className={inputClass} />
                          <FieldError message={err('city')} />
                        </label>
                        <label className="block">
                          <span className={labelClass}>State</span>
                          <input
                            value={draft.state}
                            onChange={(e) => updateAddress(draft.key, { state: e.target.value.toUpperCase().slice(0, 2) })}
                            maxLength={2}
                            className={`${inputClass} uppercase`}
                          />
                          <FieldError message={err('state')} />
                        </label>
                        <label className="block">
                          <span className={labelClass}>ZIP</span>
                          <input
                            value={draft.zip}
                            onChange={(e) => updateAddress(draft.key, { zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10), placeId: '' })}
                            inputMode="numeric"
                            className={inputClass}
                          />
                          <FieldError message={err('zip')} />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className={labelClass}>Label</span>
                          <input value={draft.label} onChange={(e) => updateAddress(draft.key, { label: e.target.value })} maxLength={40} className={inputClass} />
                        </label>
                        <div>
                          <span className={labelClass}>County</span>
                          <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600">
                            {draft._id && draft.county ? draft.county : 'Set from ZIP'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {removed.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {removed.map((draft) => (
                      <div key={draft.key} className="flex items-center justify-between gap-2">
                        <span className="truncate">Removing: {[draft.line1, draft.city].filter(Boolean).join(', ')}</span>
                        <button type="button" onClick={() => restoreAddress(draft)} className="font-bold text-sky-700 hover:underline">
                          Undo
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </form>

            <div className="space-y-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              {warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3" role="alert">
                  <div className="text-sm font-bold text-amber-900">Please review before saving</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
                    {warnings.map((warning) => (
                      <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {formError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
                  {formError}
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save(warnings.length > 0)}
                  disabled={!dirty || saving}
                  className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    warnings.length > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {saving ? 'Saving...' : warnings.length > 0 ? 'Save anyway' : 'Save changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
