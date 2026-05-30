import { useCallback, useState } from 'react';
import { Package } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { PaidPlanFeatureCalloutForReason } from '@/components/billing/PaidPlanFeatureCallout';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { Button } from '@/components/ui';
import { useBillingAddonActions } from '@/hooks/useBillingAddonActions';
import { useBillingCheckout } from '@/hooks/useBillingCheckout';
import {
  formatAddonBillingIntervalLabel,
  formatAddonRenewalLabel,
  formatAddonStatusLabel,
  resolveAddonPurchaseLabel,
} from '@/lib/billingAddonCatalogDisplay';
import { isTopUpAddonKey } from '@/lib/billingCheckout';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import { BillingCancelAddonModal } from '@/pages/billing/BillingCancelAddonModal';
import {
  formatAddonCardPriceLine,
  formatAddonDisplayName,
} from '@/pages/billing/billingSummaryDisplay';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';
import { cn } from '@/lib/utils';

type Props = {
  workspaceId: string;
  role: string | undefined;
  summary: WorkspaceBillingSummary;
  checkoutEnabled: boolean;
  onSummaryUpdated?: () => void;
  compact?: boolean;
};

function AddonStatusBadge(props: { status: string }) {
  const label = formatAddonStatusLabel(props.status);
  const isActive = props.status === 'active' || props.status === 'cancel_at_period_end';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold',
        isActive ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-100' : 'bg-slate-100 text-slate-600',
      )}
    >
      {label}
    </span>
  );
}

export function BillingAddonsSection({
  workspaceId,
  role,
  summary,
  checkoutEnabled,
  onSummaryUpdated,
  compact = false,
}: Props) {
  const checkout = useBillingCheckout(workspaceId);
  const addonActions = useBillingAddonActions(workspaceId, onSummaryUpdated);
  const isOwner = isWorkspaceOwnerRole(role);
  const addonsAllowed = summary.entitlements.addonsAllowed;
  const onFreePlan = summary.plan.key === 'free' || summary.entitlements.isTrialPlan;

  const [pendingCancel, setPendingCancel] = useState<{
    addonKey: string;
    addonName: string;
    targetBotId?: string | null;
  } | null>(null);

  const addonCatalog = summary.addonCatalog ?? [];
  const topUps = summary.topUps ?? [];
  const topUpCreditsRemaining =
    topUps.reduce((sum, row) => sum + (row.creditsRemaining ?? 0), 0) ||
    (summary.usage.aiCredits.topUpCreditsRemaining ?? 0);

  const handlePurchase = useCallback(
    async (addonKey: string) => {
      if (isTopUpAddonKey(addonKey)) {
        await checkout.startTopUpCheckout('ai_credits_1000');
        return;
      }

      await checkout.startAddonCheckout(addonKey);
    },
    [checkout],
  );

  if (!checkoutEnabled) return null;

  return (
    <>
      <SettingsInfoCard
        id="billing-addons"
        icon={Package}
        title="Add-ons"
        description="Workspace extras, recurring add-ons, and credit top-ups."
        variant="default"
        className="h-full"
      >
        <div className="space-y-2">
          {addonCatalog.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">No add-ons available.</p>
          ) : (
            addonCatalog.map((addon) => {
              const title = formatAddonDisplayName(addon);
              const renewalLabel = formatAddonRenewalLabel(addon);
              const isTopUp = isTopUpAddonKey(addon.key);
              const canPurchase =
                isOwner &&
                addonsAllowed &&
                !onFreePlan &&
                addon.checkoutAvailable &&
                (addon.status === 'inactive' || isTopUp);
              const canCancel =
                isOwner &&
                addon.billingInterval === 'monthly' &&
                addon.status === 'active' &&
                !addon.cancelAtPeriodEnd;

              return (
                <article
                  key={addon.key}
                  className={cn(
                    'rounded-xl border border-slate-200/80 bg-slate-50/40',
                    compact ? 'p-3' : 'p-4',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="m-0 text-sm font-semibold text-slate-900">{title}</h3>
                        <AddonStatusBadge status={addon.status ?? 'inactive'} />
                      </div>
                      <p className="m-0 text-xs text-slate-500">
                        {formatAddonBillingIntervalLabel(addon.billingInterval)} ·{' '}
                        {formatAddonCardPriceLine(addon)}
                      </p>
                      {renewalLabel ? (
                        <p className="m-0 text-xs text-slate-600">{renewalLabel}</p>
                      ) : null}
                      {isTopUp ? (
                        <div className="space-y-1 pt-1 text-xs leading-relaxed text-slate-600">
                          <p className="m-0">
                            Top-up credits are used only after monthly plan credits are used.
                          </p>
                          {topUps.length > 0
                            ? topUps.map((row) => (
                                <p key={`${row.createdAt}-${row.expiresAt}`} className="m-0">
                                  {row.creditsRemaining.toLocaleString()} of{' '}
                                  {row.creditsPurchased.toLocaleString()} remaining
                                  {row.expiresAt
                                    ? ` · expires ${formatUsagePeriodDate(row.expiresAt)}`
                                    : ''}
                                  {row.amountFormatted ? ` · ${row.amountFormatted}` : ''}
                                </p>
                              ))
                            : topUpCreditsRemaining > 0
                              ? (
                                  <p className="m-0">
                                    {topUpCreditsRemaining.toLocaleString()} credits remaining
                                  </p>
                                )
                              : null}
                        </div>
                      ) : (
                        <p className="m-0 pt-1 text-xs leading-relaxed text-slate-600">
                          {addon.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      {onFreePlan && !isTopUp ? (
                        <PaidPlanFeatureCalloutForReason reason="addons" compact />
                      ) : null}
                      {!isOwner && !onFreePlan ? (
                        <p className="m-0 text-xs text-slate-500">
                          Only the workspace owner can manage add-ons.
                        </p>
                      ) : null}
                      {canPurchase ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={checkout.isAddonLoading(addon.key)}
                          onClick={() => void handlePurchase(addon.key)}
                        >
                          {checkout.isAddonLoading(addon.key)
                            ? 'Starting checkout…'
                            : resolveAddonPurchaseLabel(addon)}
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={addonActions.busy}
                          onClick={() =>
                            setPendingCancel({
                              addonKey: addon.key,
                              addonName: title,
                              targetBotId: addon.targetBotId,
                            })
                          }
                        >
                          Cancel add-on
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </SettingsInfoCard>

      <BillingCancelAddonModal
        open={Boolean(pendingCancel)}
        addonName={pendingCancel?.addonName ?? 'Add-on'}
        busy={addonActions.busy}
        onClose={() => setPendingCancel(null)}
        onConfirm={() => {
          if (!pendingCancel) return;
          void addonActions
            .cancelAddon(pendingCancel.addonKey, pendingCancel.targetBotId)
            .then((ok) => {
              if (ok) setPendingCancel(null);
            });
        }}
      />
    </>
  );
}
