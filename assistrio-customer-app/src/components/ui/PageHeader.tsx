import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-lg font-semibold leading-tight tracking-[-0.02em] text-slate-900">
          {title}
        </h2>
        {description ? (
          <div className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-slate-500">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
