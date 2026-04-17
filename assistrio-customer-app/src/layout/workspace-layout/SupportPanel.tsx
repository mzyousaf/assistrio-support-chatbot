import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function SupportPanel({ title, children, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-[var(--shadow-card)] md:p-5',
        className,
      )}
      style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 92%, #0f766e 8%)' }}
    >
      {title ? (
        <p className="mb-3 mt-0 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}
