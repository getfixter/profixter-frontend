'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import type { AddressDetailed } from '@/lib/admin-service';
import { writeToClipboard } from '@/lib/utils/clipboard';

/*
 * A one-tap copy of a customer's address, for pasting into maps, a supplier
 * order or a text to a Fixter.
 *
 * Small to look at, comfortable to hit: the visible icon is a 28px square,
 * and an invisible ring around it takes the touch target past 40px without
 * pushing the address text around. It only reads the address it is given and
 * never writes anything back.
 */

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * The address as one line a person or a maps app can use, or null when there
 * is not enough of it to be worth copying.
 *
 * A street is required, and so is a city or a ZIP to place it. Without those
 * the copy would paste something nobody could drive to, so no button is shown.
 */
export function fullAddressText(address: AddressDetailed | null | undefined): string | null {
  if (!address) return null;
  const street = String(address.line1 || '').trim();
  const city = String(address.city || '').trim();
  const state = String(address.state || '').trim();
  const zip = String(address.zip || '').trim();
  if (!street || (!city && !zip)) return null;
  return [street, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export default function CopyAddressButton({
  address,
  className = '',
}: {
  address: AddressDetailed | null | undefined;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = fullAddressText(address);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!text) return null;

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Never let the tap reach a row, a card or a form around it.
    event.preventDefault();
    event.stopPropagation();
    const copied = await writeToClipboard(text);
    setState(copied ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1600);
  };

  const copied = state === 'copied';
  const failed = state === 'failed';

  return (
    <span className={`relative inline-flex flex-shrink-0 align-middle ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy address: ${text}`}
        title="Copy address"
        className={`relative grid h-7 w-7 place-items-center rounded-lg border transition after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 ${
          copied
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
            : failed
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-sky-700 active:scale-95'
        }`}
      >
        {copied ? (
          <CheckIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {state !== 'idle' && (
        <span
          className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-lg ${
            copied ? 'bg-slate-900' : 'bg-rose-600'
          }`}
        >
          {copied ? 'Copied!' : 'Copy failed'}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Address copied' : failed ? 'Address could not be copied' : ''}
      </span>
    </span>
  );
}
