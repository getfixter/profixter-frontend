'use client';

import React, { useEffect } from 'react';

/*
 * The shell and small parts shared by Admin's phone tools (create customer,
 * buy membership, create visit). Same look as CustomerEditSheet: a bottom
 * sheet on a phone, a centred card from sm up, dark header, compact body.
 */

export const inputClass =
  'block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
export const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500';

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-rose-600">{message}</p>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: React.ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  } as const;
  return <div className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${tones[tone]}`}>{children}</div>;
}

/* A two-to-four way choice, big enough to hit while holding a phone to your ear. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T | null;
  options: Array<{ value: T; label: string; hint?: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`grid gap-2 ${options.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            data-choice={option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-[48px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              selected ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
            }`}
          >
            <span className="block leading-tight">{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-xs font-medium text-slate-500">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  busy = false,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      data-switch={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      } ${busy ? 'animate-pulse' : ''}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function AdminSheet({
  title,
  eyebrow,
  subtitle,
  onClose,
  busy = false,
  children,
  footer,
  testId,
}: {
  title: string;
  eyebrow: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:px-3 sm:py-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-admin-sheet={testId}
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">{eyebrow}</div>
            <h3 className="mt-1 truncate text-xl font-black leading-tight">{title}</h3>
            {subtitle && <div className="mt-1 truncate text-xs text-slate-300">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick, type = 'button', testId }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit'; testId?: string }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-action={testId}
      className="min-h-[48px] w-full rounded-xl bg-sky-600 px-4 text-[15px] font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {children}
    </button>
  );
}

export function deliveryText(delivery: { email?: string | null; sms?: string | null }) {
  const part = (label: string, value?: string | null) => {
    if (!value || value === 'not_requested') return null;
    if (value === 'sent' || value === 'queued' || value === 'delivered' || value === 'simulated') return `${label} sent`;
    if (value.startsWith('suppressed')) return `${label} not sent (no text consent)`;
    return `${label} failed`;
  };
  return [part('Email', delivery.email), part('Text', delivery.sms)].filter(Boolean).join(' · ') || 'Nothing sent';
}
