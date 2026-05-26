import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { UsageCircularProgress } from '@/pages/usage/UsageCircularProgress';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  icon: LucideIcon;
  valueLabel: string;
  ringPercent: number;
  ringAriaLabel: string;
  ringTone?: 'default' | 'warning' | 'danger';
  supportText?: string;
  helper?: string;
  footer?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
};

export function UsageMetricCard({
  title,
  icon: Icon,
  valueLabel,
  ringPercent,
  ringAriaLabel,
  ringTone = 'default',
  supportText,
  helper,
  footer,
  tone = 'default',
}: Props) {
  const resolvedRingTone = tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : ringTone;

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-xl border shadow-[var(--shadow-card)]',
        tone === 'danger'
          ? 'border-red-200/80 bg-red-50/20'
          : tone === 'warning'
            ? 'border-amber-200/80 bg-amber-50/20'
            : 'border-slate-200/90 bg-white',
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
              tone === 'danger'
                ? 'bg-red-50 text-red-700 ring-red-100'
                : tone === 'warning'
                  ? 'bg-amber-50 text-amber-800 ring-amber-100'
                  : 'bg-teal-50 text-teal-700 ring-teal-100',
            )}
            aria-hidden
          >
            <Icon size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold text-slate-900">{title}</h2>
            {helper ? (
              <p className="m-0 mt-0.5 text-xs leading-relaxed text-slate-500">{helper}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'm-0 text-xl font-semibold tracking-tight tabular-nums',
                tone === 'danger' ? 'text-red-900' : 'text-slate-900',
              )}
            >
              {valueLabel}
            </p>
            {supportText ? (
              <p className="m-0 mt-1 text-sm leading-relaxed text-slate-600">{supportText}</p>
            ) : null}
          </div>
          <UsageCircularProgress
            percent={ringPercent}
            ariaLabel={ringAriaLabel}
            tone={resolvedRingTone}
            size={48}
            strokeWidth={4}
          />
        </div>

        {footer ? <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">{footer}</div> : null}
      </div>
    </article>
  );
}
