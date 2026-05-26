import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  children?: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
  headerAction?: ReactNode;
  testId?: string;
};

export function UsageSectionCard({
  title,
  description,
  children,
  id,
  className,
  bodyClassName,
  headerAction,
  testId,
}: Props) {
  return (
    <section
      id={id}
      data-testid={testId}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={cn(
        'flex h-full flex-col rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2
            id={id ? `${id}-heading` : undefined}
            className="m-0 text-sm font-semibold tracking-tight text-slate-900"
          >
            {title}
          </h2>
          {description ? (
            <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          ) : null}
        </div>
        {headerAction ? <div className="shrink-0 pt-0.5">{headerAction}</div> : null}
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}
