import type { WorkspaceBillingSummary } from '@/api/types';
import { formatPlanDisplayName } from '@/lib/planEntitlements';
import {
  formatTrialCreditsTotalLabel,
  formatTrialDaysRemaining,
  resolveTrialUxState,
} from '@/lib/trialUxDisplay';
import { cn } from '@/lib/utils';
import { formatBillingSubscriptionStatusLabel } from '@/pages/billing/billingSubscriptionDisplay';
import { BillingPlanIcon } from '@/pages/billing/BillingPlanIcon';
import { usagePlanStatusTagClassName } from '@/pages/usage/usagePageFormat';

type Props = {
  summary: WorkspaceBillingSummary;
};

export function UsagePlanStatusChips({ summary }: Props) {
  const planName = formatPlanDisplayName(summary.plan?.name ?? '', summary.entitlements?.isTrialPlan);
  const planKey = summary.plan?.key ?? 'free';
  const statusLabel = formatBillingSubscriptionStatusLabel(summary);
  const trialState = resolveTrialUxState(summary);
  const periodEnd = summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd;

  if (summary.entitlements.isTrialPlan) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-xs)]',
            usagePlanStatusTagClassName(summary),
          )}
          aria-label={`${planName}, ${statusLabel}`}
        >
          <BillingPlanIcon planKey={planKey} size={14} className="text-current" />
          Free trial
        </span>
        {trialState !== 'expired' ? (
          <TrialMetaChip>{formatTrialDaysRemaining(periodEnd)}</TrialMetaChip>
        ) : null}
        <TrialMetaChip>{formatTrialCreditsTotalLabel(summary.entitlements.monthlyAiCredits)}</TrialMetaChip>
        <TrialMetaChip>Trial credits do not renew</TrialMetaChip>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-xs)]',
        usagePlanStatusTagClassName(summary),
      )}
      aria-label={`${planName}, ${statusLabel}`}
    >
      <BillingPlanIcon planKey={planKey} size={14} className="text-current" />
      {planName}
    </span>
  );
}

function TrialMetaChip(props: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
      {props.children}
    </span>
  );
}
