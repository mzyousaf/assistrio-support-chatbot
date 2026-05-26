import { Check } from 'lucide-react';
import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';
import { Button } from '@/components/ui';
import {
  formatPlanPriceMonthly,
  planCatalogFeatureLines,
} from '@/pages/billing/billingSummaryDisplay';
import { cn } from '@/lib/utils';

type Props = {
  plan: WorkspaceBillingPlanCatalogCard;
  isCurrent: boolean;
};

export function BillingPlanCard({ plan, isCurrent }: Props) {
  const features = planCatalogFeatureLines(plan);

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border bg-white p-5 shadow-[var(--shadow-card)]',
        isCurrent
          ? 'border-teal-300/80 ring-2 ring-teal-200/60'
          : 'border-slate-200/90',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-lg font-semibold tracking-tight text-slate-900">{plan.name}</h3>
          <p className="m-0 mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {formatPlanPriceMonthly(plan.priceMonthly)}
          </p>
        </div>
        {isCurrent ? (
          <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-200/80">
            Current plan
          </span>
        ) : null}
      </div>

      <ul className="m-0 mt-5 flex-1 space-y-2.5 p-0">
        {features.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
            <Check
              size={16}
              strokeWidth={2.25}
              className="mt-0.5 shrink-0 text-teal-600"
              aria-hidden
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant={isCurrent ? 'secondary' : 'primary'}
        size="sm"
        disabled
        className="mt-5 self-start"
      >
        {isCurrent ? 'Current plan' : 'Coming soon'}
      </Button>
    </article>
  );
}
