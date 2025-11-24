import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
};

const base = 'inline-flex items-center justify-center rounded-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#306EEC] disabled:opacity-50 disabled:pointer-events-none';
const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-base',
  lg: 'h-[60px] px-8 text-[20px]'
};
const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[#306EEC] text-[#EEF2FF] border border-[#306EEC] hover:bg-[#2558c9]',
  secondary: 'bg-[#EEF2FF] text-[#313234] border border-[#C5CBD8] hover:bg-white',
  ghost: 'bg-transparent text-[#EEF2FF] border border-[#EEF2FF] hover:bg-white/10'
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button className={[base, sizes[size], variants[variant], className].join(' ')} {...props} />
  );
}

export default Button;
