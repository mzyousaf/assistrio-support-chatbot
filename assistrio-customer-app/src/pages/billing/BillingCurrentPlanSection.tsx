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
import { cn } from '@/lib/utils';

type Props = {
  summary: WorkspaceBillingSummary;
  showViewPlansLink?: boolean;
  compact?: boolean;
};

export function BillingCurrentPlanSection({
  summary,
  showViewPlansLink = true,
  compact = false,
}: Props) {
  const { plan, entitlements } = summary;

  return (
    <section
      aria-labelledby="billing-current-plan-heading"
      data-testid="billing-current-plan"
      className={cn(
        'h-full rounded-2xl border shadow-[var(--shadow-card)]',
        'border-teal-200/70 bg-gradient-to-br from-teal-50/50 via-white to-white',
      )}
    >
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100/80 text-teal-800 ring-1 ring-teal-200/80"
            aria-hidden
          >
            <Crown size={20} strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-teal-800">
                  Current plan
                </p>
                <h2
                  id="billing-current-plan-heading"
                  className="m-0 mt-1 text-lg font-semibold tracking-tight text-slate-900"
                >
                  {formatPlanDisplayName(plan.name, entitlements.isTrialPlan)}
                </h2>
                <p className="m-0 mt-1 text-sm text-slate-600">
                  {formatBillingSubscriptionStatusLabel(summary)} ·{' '}
                  {formatPlanPriceMonthly(plan.priceMonthly)}
                </p>
              </div>
              {showViewPlansLink ? (
                <Link
                  to="/settings/plans"
                  className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-[var(--ui-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 text-xs font-medium leading-none text-slate-800 no-underline shadow-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]"
                >
                  View plans
                </Link>
              ) : null}
            </div>

            <div
              className={cn(
                'grid gap-2',
                compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4',
              )}
            >
              <PlanStat
                label={entitlements.isTrialPlan ? 'Trial period' : 'Billing period'}
                value={formatBillingPeriodCompact(summary)}
              />
              <PlanStat
                label={
                  summary.subscription.cancelAtPeriodEnd &&
                  summary.subscription.hasActivePaidSubscription
                    ? 'Cancels on'
                    : entitlements.isTrialPlan
                      ? 'Trial ends'
                      : 'Renews on'
                }
                value={formatBillingRenewsOrEndsLabel(summary) ?? '—'}
              />
              <PlanStat label="Included credits" value={formatCreditsIncludedLabel(summary)} />
              <PlanStat label="Members" value={String(entitlements.memberLimit)} />
              <PlanStat
                label={TRAINED_KNOWLEDGE_STORAGE_LABEL}
                value={`${entitlements.kbStorageMbPerBot} MB / bot`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanStat(props: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <p className="m-0 mt-1 text-sm font-medium leading-relaxed text-slate-900">{props.value}</p>
    </div>
  );
}
