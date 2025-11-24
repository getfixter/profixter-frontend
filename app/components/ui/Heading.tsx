import React from 'react';

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4;
  accent?: 'primary' | 'default';
  tight?: boolean;
};

const sizeByLevel: Record<NonNullable<HeadingProps['level']>, string> = {
  1: 'text-[64px]',
  2: 'text-5xl',
  3: 'text-3xl',
  4: 'text-2xl'
};

export function Heading({ level = 2, accent = 'default', tight = true, className = '', ...props }: HeadingProps) {
  // Using `any` here keeps TS happy across React JSX runtimes without importing JSX types
  const Tag: any = `h${level}` as any;
  return (
    <Tag
      className={[
        'font-bold uppercase tracking-[-0.05em]',
        sizeByLevel[level],
        tight ? 'leading-[89%]' : 'leading-tight',
        accent === 'primary' ? 'text-[#306EEC]' : 'text-[#313234]',
        className
      ].join(' ')}
      {...props}
    />
  );
}

export default Heading;
