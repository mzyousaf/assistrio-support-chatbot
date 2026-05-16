import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageIntroStrip({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        'mb-8 border-b pb-5',
        className,
      )}
      style={{ borderColor: 'color-mix(in srgb, var(--border-soft) 85%, transparent)' }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
            {title}
          </h1>
          {description ? (
            <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500 [&_p]:m-0 [&_p+p]:mt-2">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
