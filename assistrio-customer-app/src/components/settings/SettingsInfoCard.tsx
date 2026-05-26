import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'hero' | 'muted';
  id?: string;
};

export function SettingsInfoCard({
  icon: Icon,
  title,
  description,
  children,
  action,
  variant = 'default',
  id,
}: Props) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={cn(
        'rounded-2xl border shadow-[var(--shadow-card)]',
        variant === 'hero'
          ? 'border-teal-200/70 bg-gradient-to-br from-teal-50/50 via-white to-white'
          : variant === 'muted'
            ? 'border-slate-200/80 bg-slate-50/70'
            : 'border-slate-200/90 bg-white',
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
            variant === 'hero'
              ? 'bg-teal-100/80 text-teal-800 ring-teal-200/80'
              : 'bg-teal-50 text-teal-700 ring-teal-100',
          )}
          aria-hidden
        >
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2
                id={id ? `${id}-heading` : undefined}
                className="m-0 text-base font-semibold tracking-tight text-slate-900"
              >
                {title}
              </h2>
              {description ? (
                <p className="m-0 mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
              ) : null}
            </div>
            {action ? <div className="shrink-0 sm:pt-0.5">{action}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
