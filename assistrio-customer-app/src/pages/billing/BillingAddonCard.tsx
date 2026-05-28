import { Package } from 'lucide-react';
import type { WorkspaceBillingAddonCatalogCard } from '@/api/types';
import { Button } from '@/components/ui';
import {
  formatAddonDisplayName,
  formatAddonTablePriceLabel,
  formatAddonTableScopeLabel,
} from '@/pages/billing/billingSummaryDisplay';

type Props = {
  addon: WorkspaceBillingAddonCatalogCard;
};

export function BillingAddonCard({ addon }: Props) {
  const scopeLabel = formatAddonTableScopeLabel(addon.scope);
  const priceLabel = formatAddonTablePriceLabel(addon);
  const cadenceLabel = addon.billingInterval === 'one_time' ? 'One-time' : 'Monthly';

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-200/80"
          aria-hidden
        >
          <Package size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm font-semibold text-slate-900">{formatAddonDisplayName(addon)}</h3>
          <p className="m-0 mt-1 text-xs text-slate-500">
            {cadenceLabel} · {scopeLabel}
          </p>
        </div>
      </div>

      <p className="m-0 mt-4 text-xl font-semibold tabular-nums text-slate-900">{priceLabel}</p>

      <Button type="button" variant="secondary" size="sm" disabled className="mt-4 w-full">
        Coming soon
      </Button>
    </article>
  );
}
