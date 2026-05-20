import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function ConversationDetailRow({ label, value, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3', className)}>
      <div className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{value}</div>
    </div>
  );
}
