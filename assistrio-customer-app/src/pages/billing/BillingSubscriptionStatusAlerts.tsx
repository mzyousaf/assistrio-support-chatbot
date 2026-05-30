import { AlertTriangle } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { formatPastDueBillingWarning } from '@/pages/billing/billingSubscriptionDisplay';
import { cn } from '@/lib/utils';

type Props = {
  summary: WorkspaceBillingSummary;
  className?: string;
};

export function BillingSubscriptionStatusAlerts({ summary, className }: Props) {
  const pastDueMessage = formatPastDueBillingWarning(summary);

  if (!pastDueMessage) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {pastDueMessage ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
          <p className="m-0 min-w-0 flex-1 leading-relaxed">{pastDueMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
