import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';
import { Button, Modal } from '@/components/ui';
import {
  defaultRecommendedPlanKeyForReason,
  resolveUpgradePlanReasonSubtitle,
  type UpgradePlanReason,
} from '@/lib/planLimitError';
import { resolvePlanCardCheckoutAction } from '@/lib/billingCheckout';
import type { PaidPlanCheckoutKey } from '@/lib/billingCheckout';
import { resolveUpgradeModalPaidPlans } from '@/lib/upgradePlanCatalog';
import { BillingPlanCard } from '@/pages/billing/BillingPlanCard';

export type UpgradePlanModalProps = {
  open: boolean;
  onClose: () => void;
  reason: UpgradePlanReason;
  currentPlanKey: string;
  plans?: WorkspaceBillingPlanCatalogCard[];
  planCatalog?: WorkspaceBillingPlanCatalogCard[];
  recommendedPlanKey?: 'starter' | 'pro';
  canUpgrade?: boolean;
  isTrialPlan?: boolean;
  onPlanCheckout?: (planKey: PaidPlanCheckoutKey) => void;
  isPlanCheckoutLoading?: (planKey: string) => boolean;
};

function resolveEffectiveRecommendedPlanKey(
  reason: UpgradePlanReason,
  currentPlanKey: string,
  recommendedPlanKey?: 'starter' | 'pro',
): 'starter' | 'pro' {
  const requested = recommendedPlanKey ?? defaultRecommendedPlanKeyForReason(reason);
  if (currentPlanKey === 'pro' && requested === 'starter') {
    return 'pro';
  }
  if (currentPlanKey === requested) {
    return requested === 'starter' ? 'pro' : 'starter';
  }
  return requested;
}

export function UpgradePlanModal({
  open,
  onClose,
  reason,
  currentPlanKey,
  plans,
  planCatalog,
  recommendedPlanKey,
  canUpgrade = true,
  isTrialPlan = false,
  onPlanCheckout,
  isPlanCheckoutLoading,
}: UpgradePlanModalProps) {
  const subtitle = resolveUpgradePlanReasonSubtitle(reason);
  const paidPlans = resolveUpgradeModalPaidPlans(plans ?? planCatalog);
  const effectiveRecommended = resolveEffectiveRecommendedPlanKey(
    reason,
    currentPlanKey,
    recommendedPlanKey,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Upgrade to continue"
      description={subtitle}
      className="max-w-5xl"
      bodyClassName="max-h-[min(70vh,48rem)]"
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!canUpgrade ? (
            <p className="m-0 text-xs text-slate-500">Only the workspace owner can upgrade this workspace.</p>
          ) : paidPlans.every((p) => !p.checkoutAvailable) ? (
            <p className="m-0 text-xs text-slate-500">Checkout is not enabled yet.</p>
          ) : (
            <p className="m-0 text-xs text-slate-500">Choose a plan to continue to secure checkout.</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {currentPlanKey === 'free' ? (
          <p className="m-0 text-xs text-slate-500">Current plan: Free trial</p>
        ) : (
          <p className="m-0 text-xs text-slate-500">Current plan: {currentPlanKey}</p>
        )}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
          {paidPlans.map((plan) => {
            const isCurrent = plan.key === currentPlanKey;
            const recommended = !isCurrent && effectiveRecommended === plan.key;
            const action = resolvePlanCardCheckoutAction({
              planKey: plan.key,
              currentPlanKey,
              isTrialPlan,
              checkoutAvailable: plan.checkoutAvailable,
              isOwner: canUpgrade,
            });
            const loading = isPlanCheckoutLoading?.(plan.key) ?? false;
            return (
              <BillingPlanCard
                key={plan.key}
                plan={plan}
                isCurrent={isCurrent}
                recommended={recommended}
                showRecommendedBadge={recommended}
                actionLabel={action.label}
                actionDisabled={action.disabled}
                actionLoading={loading}
                onAction={
                  action.canCheckout && onPlanCheckout && (plan.key === 'starter' || plan.key === 'pro')
                    ? () => onPlanCheckout(plan.key as PaidPlanCheckoutKey)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
