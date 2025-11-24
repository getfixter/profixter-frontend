import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'light' | 'dark' | 'glass';
  rounded?: 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'lg';
};

const roundedMap = { md: 'rounded-[10px]', lg: 'rounded-[14px]', xl: 'rounded-[20px]' } as const;
const shadowMap = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  lg: 'shadow-[0_10px_80px_rgba(0,0,0,0.25)]'
} as const;
const variantMap = {
  light: 'bg-[#EEF2FF] border border-[#C5CBD8]',
  dark: 'bg-[#3A3C3E] border border-[#4A4C4E]',
  glass: 'bg-[#313234]/30 backdrop-blur-[8px]'
} as const;

export function Card({
  variant = 'light',
  rounded = 'lg',
  shadow = 'sm',
  className = '',
  ...props
}: CardProps) {
  return (
    <div className={[variantMap[variant], roundedMap[rounded], shadowMap[shadow], className].join(' ')} {...props} />
  );
}

export default Card;
