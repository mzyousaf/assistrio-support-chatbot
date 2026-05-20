import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingsInfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-start">
      <p className="m-0 text-[0.75rem] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className={cn('m-0 text-sm text-slate-900', mono && 'font-mono text-[0.8125rem] break-all')}>
        {value}
      </div>
    </div>
  );
}

export function SettingsStatusBadge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral' | 'danger';
  children: ReactNode;
}) {
  const classes = {
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    neutral: 'bg-slate-100 text-slate-700',
    danger: 'bg-red-50 text-red-700',
  }[tone];
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold', classes)}>
      {children}
    </span>
  );
}
