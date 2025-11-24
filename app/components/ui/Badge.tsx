import React from 'react';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: 'primary' | 'neutral' | 'success';
  rounded?: 'sm' | 'md' | 'lg';
};

const colorMap = {
  primary: 'bg-[#306EEC] text-white',
  neutral: 'bg-[#EEF2FF] text-[#313234] border border-[#C5CBD8]',
  success: 'bg-[#43A047] text-white'
} as const;

const roundedMap = { sm: 'rounded', md: 'rounded-md', lg: 'rounded-xl' } as const;

export function Badge({ color = 'primary', rounded = 'md', className = '', ...props }: BadgeProps) {
  return (
    <span className={[
      'inline-flex items-center px-2.5 py-1 text-xs font-semibold',
      colorMap[color],
      roundedMap[rounded],
      className
    ].join(' ')} {...props} />
  );
}

export default Badge;
