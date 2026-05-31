import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { resolveTrialUxState } from '@/lib/trialUxDisplay';
import { cn } from '@/lib/utils';

const actionLinkClass =
  'inline-flex h-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-[var(--ui-radius)] border px-2.5 text-xs font-medium leading-none no-underline transition-[background-color,border-color,color] duration-150 ease-out sm:self-center';

type Props = {
  summary: WorkspaceBillingSummary;
  className?: string;
};

export function BillingTrialAlerts({ summary, className }: Props) {
  const state = resolveTrialUxState(summary);

  if (state === 'none' || state === 'active') return null;

  if (state === 'ending_soon') {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          className,
        )}
        role="alert"
      >
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <p className="m-0 text-sm leading-relaxed text-amber-950">
            Your trial ends soon. Upgrade to keep AI chat active.
          </p>
        </div>
        <Link
          to="/settings/billing"
          className={cn(
            actionLinkClass,
            'border-[var(--ui-border)] bg-[var(--ui-surface)] text-slate-800 hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]',
          )}
        >
          View plans
        </Link>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          className,
        )}
        role="alert"
      >
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
          <p className="m-0 text-sm leading-relaxed text-red-950">
            Your free trial has ended. Upgrade to continue using AI chat.
          </p>
        </div>
        <Link
          to="/settings/billing"
          className={cn(
            actionLinkClass,
            'border-transparent bg-[var(--color-teal-600)] text-white hover:bg-[var(--color-teal-700)]',
          )}
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <p className="m-0 text-sm leading-relaxed text-amber-950">
          You&apos;ve used all {summary.entitlements.monthlyAiCredits.toLocaleString()} trial credits.
        </p>
      </div>
      <Link
        to="/settings/billing"
        className={cn(
          actionLinkClass,
          'border-transparent bg-[var(--color-teal-600)] text-white hover:bg-[var(--color-teal-700)]',
        )}
      >
        Upgrade
      </Link>
    </div>
  );
}
