import React, { useState } from 'react';

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  placeholder?: string;
  ariaLabel?: string;
  inputClassName?: string;
  iconSize?: number; // 24 default, 20 for smaller variant
  initialType?: 'password' | 'text';
}

// Password field with show/hide toggle. Visual output matches original markup.
export function PasswordField({
  id,
  placeholder = 'Password',
  ariaLabel,
  inputClassName = '',
  iconSize = 24,
  initialType = 'password',
  ...rest
}: PasswordFieldProps) {
  const [show, setShow] = useState(initialType === 'text');
  const sizeAttrs = { width: iconSize, height: iconSize };
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={`bg-transparent border-b border-white text-white placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors pr-10 ${inputClassName}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className={`absolute right-0 bottom-3 text-white/60 hover:text-white transition-colors ${iconSize === 20 ? 'bottom-2 sm:bottom-3' : ''}`}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        <svg {...sizeAttrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {show ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          ) : (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
