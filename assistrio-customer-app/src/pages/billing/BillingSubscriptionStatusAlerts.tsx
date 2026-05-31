import { AlertTriangle } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { formatPastDueBillingWarning } from '@/pages/billing/billingSubscriptionDisplay';
import { BILLING_MANAGE_PAYMENTS_SECTION_ID } from '@/pages/billing/billingPaymentIssueDisplay';
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
          <p className="m-0 min-w-0 flex-1 leading-relaxed">
            {pastDueMessage}{' '}
            <a
              href={`#${BILLING_MANAGE_PAYMENTS_SECTION_ID}`}
              className="font-medium text-amber-950 underline decoration-amber-700/40 underline-offset-2 hover:decoration-amber-800"
            >
              Manage payments
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
