import { Package } from 'lucide-react';
import type { WorkspaceBillingAddonCatalogCard } from '@/api/types';
import { Button } from '@/components/ui';
import { PAID_PLAN_ADDON_COPY } from '@/lib/planEntitlements';
import { isTopUpAddonKey } from '@/lib/billingCheckout';
import {
  formatAddonCardPriceLine,
  formatAddonDescription,
  formatAddonDisplayName,
} from '@/pages/billing/billingSummaryDisplay';

type Props = {
  addon: WorkspaceBillingAddonCatalogCard;
  currentPlanKey?: string | null;
  isOwner?: boolean;
  addonsAllowed?: boolean;
  checkoutLoading?: boolean;
  onPurchase?: () => void;
};

export function UsageAddonCard({
  addon,
  currentPlanKey,
  isOwner = false,
  addonsAllowed = false,
  checkoutLoading = false,
  onPurchase,
}: Props) {
  const title = formatAddonDisplayName(addon);
  const priceLine = formatAddonCardPriceLine(addon);
  const description = formatAddonDescription(addon);
  const onFreePlan = currentPlanKey === 'free' || !currentPlanKey;
  const canPurchase = isOwner && addonsAllowed && addon.checkoutAvailable && Boolean(onPurchase);
  const addonStatusCopy = onFreePlan ? PAID_PLAN_ADDON_COPY : 'Coming soon';
  const purchaseLabel =
    addon.billingInterval === 'one_time' || isTopUpAddonKey(addon.key) ? 'Buy add-on' : 'Add';

  return (
    <article className="w-full rounded-xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100"
          aria-hidden
        >
          <Package size={17} strokeWidth={1.75} />
        </div>
        <h3 className="m-0 min-w-0 pt-1 text-base font-semibold text-slate-900">{title}</h3>
      </div>

      {onFreePlan || !addonsAllowed ? (
        <p className="m-0 mt-4 text-sm text-slate-500">{addonStatusCopy}</p>
      ) : !isOwner ? (
        <p className="m-0 mt-4 text-sm text-slate-500">
          Only the workspace owner can manage billing.
        </p>
      ) : !addon.checkoutAvailable ? (
        <p className="m-0 mt-4 text-sm text-slate-500">Coming soon</p>
      ) : null}

      <p className="m-0 mt-3 text-sm font-semibold tabular-nums text-slate-900">{priceLine}</p>
      <p className="m-0 mt-2 text-sm leading-relaxed text-slate-600">{description}</p>

      {canPurchase ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 w-full sm:w-auto"
          disabled={checkoutLoading}
          onClick={onPurchase}
        >
          {checkoutLoading ? 'Starting checkout…' : purchaseLabel}
        </Button>
      ) : null}
    </article>
  );
}
