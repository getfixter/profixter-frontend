'use client';

import React from 'react';
import AddressField, { type AddressValue } from '@/app/components/address/AddressField';
import { inputClass, labelClass } from './AdminSheet';

/*
 * The address lookup plus an Apt / Unit field that is always there (J-23 /
 * W-8): staff type the unit while the customer says it, whether the street
 * came from the lookup or was typed by hand. A unit Google returned with the
 * lookup fills the field when it is still empty.
 *
 * The unit travels as its own `unit` field; the server folds it into line1
 * once (utils/addressVerification) and keeps it separately too.
 */
export default function AddressWithUnit({
  value,
  onChange,
  unit,
  onUnitChange,
  testId,
}: {
  value: AddressValue | null;
  onChange: (value: AddressValue | null) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  testId?: string;
}) {
  return (
    <div className="space-y-2" data-address-with-unit={testId}>
      <AddressField
        value={value}
        hideUnit
        onChange={(next) => {
          if (next?.unit && !unit.trim()) onUnitChange(next.unit);
          onChange(next);
        }}
      />
      <label className="block">
        <span className={labelClass}>Apt / Unit (optional)</span>
        <input
          value={unit}
          onChange={(e) => onUnitChange(e.target.value.slice(0, 30))}
          maxLength={30}
          autoComplete="off"
          placeholder="Apt 2, Unit B, Suite 100"
          className={inputClass}
          data-input={testId ? `${testId}-unit` : 'unit'}
        />
      </label>
    </div>
  );
}
