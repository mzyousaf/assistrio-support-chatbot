import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

export function SettingsInfoRow({ label, value, mono }: Props) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span
        className={cn(
          'min-w-0 break-words text-sm text-slate-900 sm:text-right',
          mono && 'font-mono text-[0.8125rem]',
        )}
      >
        {value}
      </span>
    </div>
  );
}
