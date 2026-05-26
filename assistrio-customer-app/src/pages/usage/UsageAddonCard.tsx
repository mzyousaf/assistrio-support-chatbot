import { Package } from 'lucide-react';
import type { WorkspaceBillingAddonCatalogCard } from '@/api/types';
import { Button } from '@/components/ui';
import {
  formatAddonBillingInterval,
  formatAddonScopeLabel,
} from '@/pages/billing/billingSummaryDisplay';

type Props = {
  addon: WorkspaceBillingAddonCatalogCard;
};

export function UsageAddonCard({ addon }: Props) {
  const cadence =
    formatAddonBillingInterval(addon.billingInterval) === 'one-time' ? 'One-time' : 'Monthly';

  return (
    <article className="flex w-full flex-col gap-4 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100"
          aria-hidden
        >
          <Package size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-semibold text-slate-900">{addon.name}</h3>
          <p className="m-0 mt-0.5 text-xs text-slate-500">
            {cadence} · {formatAddonScopeLabel(addon.scope)}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        <p className="m-0 text-sm font-semibold tabular-nums text-slate-800">${addon.priceUsd}</p>
        <Button type="button" variant="secondary" size="sm" disabled>
          Coming soon
        </Button>
      </div>
    </article>
  );
}
