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

export function BillingAddonListRow({ addon }: Props) {
  const scopeLabel = formatAddonTableScopeLabel(addon.scope);
  const priceLabel = formatAddonTablePriceLabel(addon);
  const cadenceLabel = addon.billingInterval === 'one_time' ? 'One-time' : 'Monthly';

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200/80"
          aria-hidden
        >
          <Package size={16} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-slate-900">{formatAddonDisplayName(addon)}</p>
          <p className="m-0 mt-0.5 text-xs text-slate-500">
            {priceLabel} · {cadenceLabel} · {scopeLabel}
          </p>
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" disabled className="shrink-0 self-start sm:self-auto">
        Coming soon
      </Button>
    </div>
  );
}
