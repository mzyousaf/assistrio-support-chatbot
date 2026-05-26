import type { WorkspaceBillingSummary } from '@/api/types';
import { formatPlanChipLabel, formatSubscriptionStatusLabel } from '@/pages/usage/usagePageFormat';

type Props = {
  summary: WorkspaceBillingSummary;
};

export function UsagePlanStatusChips({ summary }: Props) {
  const planLabel = formatPlanChipLabel(summary.plan?.name);
  const statusLabel = formatSubscriptionStatusLabel(summary.plan?.status);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[var(--shadow-xs)]">
        {planLabel}
      </span>
      <span className="inline-flex items-center rounded-full border border-teal-200/80 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-teal-800 shadow-[var(--shadow-xs)]">
        {statusLabel}
      </span>
    </div>
  );
}
