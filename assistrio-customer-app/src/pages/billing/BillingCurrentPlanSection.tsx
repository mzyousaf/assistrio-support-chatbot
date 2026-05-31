import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { formatPlanPriceMonthly } from '@/pages/billing/billingSummaryDisplay';
import {
  formatBillingRenewsOrEndsLabel,
  formatBillingSubscriptionStatusLabel,
} from '@/pages/billing/billingSubscriptionDisplay';
import {
  formatBillingPeriodCompact,
  formatCreditsIncludedLabel,
  formatPlanDisplayName,
} from '@/lib/planEntitlements';
import { TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';
import { cn } from '@/lib/utils';

type Props = {
  summary: WorkspaceBillingSummary;
  showViewPlansLink?: boolean;
  compact?: boolean;
};

function PlanStatusBadge(props: { summary: WorkspaceBillingSummary }) {
  const label = formatBillingSubscriptionStatusLabel(props.summary);
  const isActive =
    label === 'Active' ||
    label === 'Free trial' ||
    (props.summary.subscription.hasActivePaidSubscription && label !== 'Past due');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        isActive
          ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100/80'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60',
      )}
    >
      {label}
    </span>
  );
}

function renewalMetricValue(summary: WorkspaceBillingSummary): string {
  const end = summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd;
  if (!end) return '—';
  return formatUsagePeriodDate(end);
}

export function BillingCurrentPlanSection({
  summary,
  showViewPlansLink = true,
  compact = false,
}: Props) {
  const { plan, entitlements } = summary;
  const planName = formatPlanDisplayName(plan.name, entitlements.isTrialPlan);
  const renewsLabel =
    summary.subscription.cancelAtPeriodEnd && summary.subscription.hasActivePaidSubscription
      ? 'Cancels on'
      : entitlements.isTrialPlan
        ? 'Trial ends'
        : 'Renews on';

  const metrics = [
    {
      label: entitlements.isTrialPlan ? 'Trial period' : 'Billing period',
      value: formatBillingPeriodCompact(summary),
    },
    {
      label: renewsLabel,
      value: formatBillingRenewsOrEndsLabel(summary)
        ? renewalMetricValue(summary)
        : '—',
    },
    { label: 'Included credits', value: formatCreditsIncludedLabel(summary) },
    { label: 'Members', value: String(entitlements.memberLimit) },
    {
      label: TRAINED_KNOWLEDGE_STORAGE_LABEL,
      value: `${entitlements.kbStorageMbPerBot} MB / AI Agent`,
    },
  ];

  return (
    <section
      aria-labelledby="billing-current-plan-heading"
      data-testid="billing-current-plan"
      className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100/80"
            aria-hidden
          >
            <Crown size={18} strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <p className="m-0 text-xs font-medium text-slate-500">Current plan</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="billing-current-plan-heading"
                    className="m-0 text-base font-semibold tracking-tight text-slate-900"
                  >
                    {planName}
                  </h2>
                  <PlanStatusBadge summary={summary} />
                </div>
                <p className="m-0 text-sm font-semibold text-slate-900">
                  {formatPlanPriceMonthly(plan.priceMonthly)}
                </p>
              </div>
              {showViewPlansLink ? (
                <Link
                  to="/settings/billing"
                  className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-[var(--ui-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 text-xs font-medium leading-none text-slate-800 no-underline shadow-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]"
                >
                  View plans
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'grid gap-x-4 gap-y-2.5 border-t border-slate-100 pt-4',
            compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2',
          )}
        >
          {metrics.map((metric) => (
            <PlanMetricRow key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanMetricRow(props: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
      <p className="m-0 shrink-0 text-xs text-slate-500">{props.label}</p>
      <p className="m-0 text-right text-sm font-medium text-slate-900 sm:mt-0.5 sm:text-left">
        {props.value}
      </p>
    </div>
  );
}
