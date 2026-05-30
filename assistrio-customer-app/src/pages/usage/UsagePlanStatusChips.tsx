import type { WorkspaceBillingSummary } from '@/api/types';
import { formatPlanDisplayName } from '@/lib/planEntitlements';
import { formatPlanChipLabel, formatSubscriptionStatusLabel } from '@/pages/usage/usagePageFormat';

type Props = {
  summary: WorkspaceBillingSummary;
};

export function UsagePlanStatusChips({ summary }: Props) {
  const planLabel = formatPlanChipLabel(
    formatPlanDisplayName(summary.plan?.name ?? '', summary.entitlements?.isTrialPlan),
  );
  const statusLabel = formatSubscriptionStatusLabel(summary.plan?.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-[var(--shadow-xs)]">
        {planLabel}
      </span>
      <span className="inline-flex items-center rounded-full border border-teal-200/80 bg-teal-50/80 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-[var(--shadow-xs)]">
        {statusLabel}
      </span>
    </div>
  );
}
