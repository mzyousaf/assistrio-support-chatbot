import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
};

export function Tooltip({ content, children, className, side = 'top' }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute left-1/2 z-30 w-max max-w-[16rem] -translate-x-1/2',
          'rounded-[var(--ui-radius)] border border-white/10 bg-slate-900 px-2 py-1',
          'text-center text-[0.6875rem] font-medium leading-snug tracking-[-0.01em] text-slate-50',
          'shadow-[0_2px_8px_rgba(15,23,42,0.12)]',
          'transition-[opacity,transform] duration-200 ease-out',
          side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          open ? 'translate-y-0 opacity-100' : side === 'top' ? 'translate-y-0.5 opacity-0' : '-translate-y-0.5 opacity-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}
