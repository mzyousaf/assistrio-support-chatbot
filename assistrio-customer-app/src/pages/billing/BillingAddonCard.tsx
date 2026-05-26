import { Bot, Package, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspaceBillingAddonCatalogCard } from '@/api/types';
import { Button } from '@/components/ui';
import {
  formatAddonBillingInterval,
  formatAddonDisplayName,
  formatAddonPriceLabel,
  formatAddonScopeLabel,
} from '@/pages/billing/billingSummaryDisplay';
import { cn } from '@/lib/utils';

function addonIcon(key: string): LucideIcon {
  if (key.includes('bot')) return Bot;
  if (key.includes('member') || key.includes('seat')) return Users;
  if (key.includes('credit') || key.includes('branding')) return Sparkles;
  return Package;
}

type Props = {
  addon: WorkspaceBillingAddonCatalogCard;
};

export function BillingAddonCard({ addon }: Props) {
  const Icon = addonIcon(addon.key);
  const cadence =
    formatAddonBillingInterval(addon.billingInterval) === 'one-time' ? 'One-time' : 'Monthly';

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100',
          )}
          aria-hidden
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm font-semibold text-slate-900">
            {formatAddonDisplayName(addon)}
          </h3>
          <p className="m-0 mt-1 text-xs uppercase tracking-wide text-slate-500">
            {cadence} · {formatAddonScopeLabel(addon.scope)}
          </p>
          <p className="m-0 mt-2 text-base font-semibold tabular-nums text-slate-800">
            {formatAddonPriceLabel(addon)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled
        className="mt-4 self-start"
      >
        Coming soon
      </Button>
    </article>
  );
}
