import { Lock, Package } from 'lucide-react';
import type { WorkspaceBillingAddonCatalogCard } from '@/api/types';
import { Switch } from '@/components/ui';
import {
  formatAddonCardPriceLine,
  formatAddonDescription,
  formatAddonDisplayName,
} from '@/pages/billing/billingSummaryDisplay';

type Props = {
  addon: WorkspaceBillingAddonCatalogCard;
};

export function UsageAddonCard({ addon }: Props) {
  const title = formatAddonDisplayName(addon);
  const priceLine = formatAddonCardPriceLine(addon);
  const description = formatAddonDescription(addon);

  return (
    <article className="w-full rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100"
            aria-hidden
          >
            <Package size={17} strokeWidth={1.75} />
          </div>
          <h3 className="m-0 min-w-0 pt-1 text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-amber-200/90 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
          <Lock size={13} strokeWidth={2} className="shrink-0 text-amber-700" aria-hidden />
          The add-on requires a paid plan
        </span>
      </div>

      <p className="m-0 mt-3 text-sm font-semibold tabular-nums text-slate-900">{priceLine}</p>
      <p className="m-0 mt-2 text-sm leading-relaxed text-slate-600">{description}</p>

      <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-4">
        <Switch
          checked={false}
          onCheckedChange={() => undefined}
          disabled
          aria-label={`${title} auto charge`}
        />
        <span className="text-sm text-slate-500">Auto charge</span>
      </div>
    </article>
  );
}
