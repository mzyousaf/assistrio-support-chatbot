import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Coins,
  CreditCard,
  FileDown,
  HardDrive,
  Users,
} from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
} from '@/lib/trainedKnowledgeStorageCopy';
import {
  formatAnalyticsHistoryLabel,
  formatExportReportsLabel,
  formatPlanPriceMonthly,
} from '@/pages/billing/billingSummaryDisplay';
import {
  formatBillingPeriodCompact,
  formatCreditsIncludedLabel,
} from '@/lib/planEntitlements';

type EntitlementItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
};

export function buildBillingEntitlementItems(summary: WorkspaceBillingSummary): EntitlementItem[] {
  const { plan, entitlements } = summary;

  return [
    {
      icon: Coins,
      label: 'AI credits',
      value: formatCreditsIncludedLabel(summary),
    },
    {
      icon: Users,
      label: 'Member limit',
      value: String(entitlements.memberLimit),
    },
    {
      icon: Bot,
      label: 'Agent limit',
      value: String(entitlements.botLimit),
    },
    {
      icon: HardDrive,
      label: TRAINED_KNOWLEDGE_STORAGE_LABEL,
      value: `${entitlements.kbStorageMbPerBot} MB / bot`,
      hint: TRAINED_KNOWLEDGE_STORAGE_HELPER,
    },
    {
      icon: BarChart3,
      label: 'Analytics history',
      value: formatAnalyticsHistoryLabel(entitlements.analyticsHistoryDays),
    },
    {
      icon: FileDown,
      label: 'Export reports',
      value: formatExportReportsLabel(entitlements.canExportReports),
    },
    {
      icon: CreditCard,
      label: 'Plan price',
      value: formatPlanPriceMonthly(plan.priceMonthly),
    },
    {
      icon: CreditCard,
      label: entitlements.isTrialPlan ? 'Trial period' : 'Billing period',
      value: formatBillingPeriodCompact(summary),
    },
  ];
}

type Props = {
  summary: WorkspaceBillingSummary;
  compact?: boolean;
};

export function BillingEntitlementGrid({ summary, compact = false }: Props) {
  const items = buildBillingEntitlementItems(summary);
  const visibleItems = compact
    ? items.filter((item) =>
        ['AI credits', 'Plan price', 'Billing period'].includes(item.label),
      )
    : items.filter((item) => item.label !== 'Billing period');

  return (
    <dl
      className={
        compact
          ? 'grid gap-4 sm:grid-cols-3'
          : 'grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3'
      }
    >
      {visibleItems.map((item) => (
        <div key={item.label} className="flex min-w-0 items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 text-teal-700 ring-1 ring-teal-100"
            aria-hidden
          >
            <item.icon size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <dt className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </dt>
            <dd className="m-0 mt-1 text-sm font-medium leading-relaxed text-slate-900">
              {item.value}
            </dd>
            {item.hint ? (
              <dd className="m-0 mt-1 text-xs leading-relaxed text-slate-500">{item.hint}</dd>
            ) : null}
          </div>
        </div>
      ))}
    </dl>
  );
}
