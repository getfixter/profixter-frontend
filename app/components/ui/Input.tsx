"use client";
import { useState, useEffect } from 'react';
// Lightweight clsx replacement to avoid adding dependency
function cx(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  outerClassName?: string;
}

export function Input({ label, error, hint, outerClassName, className, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState(rest.value?.toString() || rest.defaultValue?.toString() || '');

  useEffect(() => {
    if (rest.value !== undefined) setValue(rest.value.toString());
  }, [rest.value]);

  return (
    <div className={cx('flex flex-col gap-2', outerClassName)}>
      {label && (
        <label className="text-xs font-medium uppercase tracking-wide text-white/70">
          {label}
        </label>
      )}
      <div className="relative">
  <input
          {...rest}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            rest.onChange?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          className={cx(
            'w-full bg-transparent border-b text-white placeholder-white/40 outline-none transition-colors pb-3 pr-10',
            error
              ? 'border-red-500 focus:border-red-500'
              : focused
                ? 'border-[#306EEC]'
                : 'border-white',
            className
          )}
        />
        {/* Error / status icon area */}
        {error && (
          <span className="absolute right-0 bottom-3 text-red-500 text-xs font-medium">
            !
          </span>
        )}
      </div>
      {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
      {!error && hint && (
        <p className="text-white/50 text-xs">{hint}</p>
      )}
    </div>
  );
}

export default Input;
