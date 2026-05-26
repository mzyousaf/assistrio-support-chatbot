import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { UsageProgressBar } from '@/pages/usage/UsageProgressBar';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  icon: LucideIcon;
  headline: string;
  subtext?: string;
  helper?: string;
  progressPercent?: number;
  progressAriaLabel?: string;
  progressTone?: 'default' | 'warning' | 'danger';
  footer?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
};

export function UsageMetricCard({
  title,
  icon: Icon,
  headline,
  subtext,
  helper,
  progressPercent,
  progressAriaLabel,
  progressTone = 'default',
  footer,
  tone = 'default',
}: Props) {
  const showProgress = progressPercent != null && progressAriaLabel;

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border shadow-[var(--shadow-card)]',
        tone === 'danger'
          ? 'border-red-200/80 bg-red-50/20'
          : tone === 'warning'
            ? 'border-amber-200/80 bg-amber-50/20'
            : 'border-slate-200/90 bg-white',
      )}
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-sm font-semibold text-slate-900">{title}</h2>
            {helper ? (
              <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500">{helper}</p>
            ) : null}
          </div>
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
              tone === 'danger'
                ? 'bg-red-50 text-red-700 ring-red-100'
                : tone === 'warning'
                  ? 'bg-amber-50 text-amber-800 ring-amber-100'
                  : 'bg-teal-50 text-teal-700 ring-teal-100',
            )}
            aria-hidden
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
        </div>

        <div className="space-y-2">
          <p
            className={cn(
              'm-0 text-2xl font-semibold tracking-tight tabular-nums',
              tone === 'danger' ? 'text-red-900' : 'text-slate-900',
            )}
          >
            {headline}
          </p>
          {subtext ? <p className="m-0 text-sm leading-relaxed text-slate-600">{subtext}</p> : null}
        </div>

        {showProgress ? (
          <UsageProgressBar
            percent={progressPercent}
            ariaLabel={progressAriaLabel}
            tone={progressTone}
          />
        ) : null}

        {footer ? <div className="mt-auto space-y-2">{footer}</div> : null}
      </div>
    </article>
  );
}
