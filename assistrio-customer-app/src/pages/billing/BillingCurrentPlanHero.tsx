import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { BillingEntitlementGrid } from '@/pages/billing/BillingEntitlementGrid';
import { formatPlanPriceMonthly } from '@/pages/billing/billingSummaryDisplay';
import { formatSubscriptionStatusLabel, formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';
import { cn } from '@/lib/utils';

type Props = {
  summary: WorkspaceBillingSummary;
  variant?: 'hero' | 'compact';
  showViewPlansLink?: boolean;
};

export function BillingCurrentPlanHero({
  summary,
  variant = 'hero',
  showViewPlansLink = false,
}: Props) {
  const { plan, entitlements } = summary;
  const isCompact = variant === 'compact';

  return (
    <section
      aria-labelledby="billing-current-plan-heading"
      className={cn(
        'rounded-2xl border shadow-[var(--shadow-card)]',
        'border-teal-200/70 bg-gradient-to-br from-teal-50/50 via-white to-white',
      )}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-6">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100/80 text-teal-800 ring-1 ring-teal-200/80"
          aria-hidden
        >
          <Crown size={22} strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-teal-800">
                Current plan
              </p>
              <h2
                id="billing-current-plan-heading"
                className="m-0 mt-1 text-xl font-semibold tracking-tight text-slate-900"
              >
                {plan.name}
              </h2>
              <p className="m-0 mt-1 text-sm text-slate-600">
                {formatPlanPriceMonthly(plan.priceMonthly)} ·{' '}
                {formatSubscriptionStatusLabel(plan.status)}
              </p>
              {!isCompact ? (
                <p className="m-0 mt-1 text-sm text-slate-500">
                  Billing period: {formatUsagePeriodDate(plan.currentPeriodStart)} –{' '}
                  {formatUsagePeriodDate(plan.currentPeriodEnd)}
                </p>
              ) : null}
            </div>
            {isCompact && showViewPlansLink ? (
              <Link
                to="/settings/plans"
                className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-[var(--ui-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 text-xs font-medium leading-none text-slate-800 no-underline shadow-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]"
              >
                View plans
              </Link>
            ) : null}
          </div>

          {isCompact ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CompactStat label="Status" value={formatSubscriptionStatusLabel(plan.status)} />
              <CompactStat
                label="Billing period"
                value={`${formatUsagePeriodDate(plan.currentPeriodStart)} – ${formatUsagePeriodDate(plan.currentPeriodEnd)}`}
              />
              <CompactStat
                label="Credits included"
                value={`${entitlements.monthlyAiCredits.toLocaleString()} / month`}
              />
              <CompactStat label="Plan price" value={formatPlanPriceMonthly(plan.priceMonthly)} />
            </div>
          ) : (
            <BillingEntitlementGrid summary={summary} />
          )}
        </div>
      </div>
    </section>
  );
}

function CompactStat(props: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/70 px-3.5 py-3">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <p className="m-0 mt-1 text-sm font-medium leading-relaxed text-slate-900">{props.value}</p>
    </div>
  );
}
