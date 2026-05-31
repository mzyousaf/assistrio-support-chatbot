import { useState } from 'react';
import { Crown, Layers } from 'lucide-react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { Modal } from '@/components/ui';
import type { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { BillingPeriodToggle } from '@/pages/billing/BillingPeriodToggle';
import { ANNUAL_BILLING_UNAVAILABLE_MESSAGE, isAnnualBillingAvailableForCatalog } from '@/lib/billingInterval.util';
import { PlansPricingCardsSection } from '@/pages/billing/BillingCatalogSections';
import type { PlanBillingPeriod } from '@/pages/billing/planPricingCardDisplay';
import { BillingAddonsList } from '@/pages/billing/BillingAddonsSection';
import { BillingPlanIcon } from '@/pages/billing/BillingPlanIcon';
import {
  buildCurrentPlanDisplay,
  buildCurrentPlanRenewalDisplay,
} from '@/pages/billing/billingSubscriptionOverviewDisplay';
import type { UpgradePlanReason } from '@/lib/planLimitError';
import { resolveUpgradePlanReasonSubtitle } from '@/lib/planLimitError';
import {
  resolvePlansModalDescription,
  resolvePlansModalTitle,
  resolveRelevantAddonKeysForReason,
  shouldShowHighestPlanPanel,
  type PlansModalMode,
} from '@/lib/planModalDisplay';
import { cn } from '@/lib/utils';

type CheckoutApi = Pick<
  ReturnType<typeof useBillingCheckout>,
  | 'startPlanCheckout'
  | 'startAddonCheckout'
  | 'startTopUpCheckout'
  | 'isPlanLoading'
  | 'isAddonLoading'
>;

export type PlansModalProps = {
  open: boolean;
  onClose: () => void;
  summary: WorkspaceBillingSummary;
  workspaceId: string;
  role: string | undefined;
  isOwner: boolean;
  checkout: CheckoutApi;
  onDowngradeToStarter?: () => void;
  onUpgradeToPro?: () => void;
  downgradeLoading?: boolean;
  upgradeLoading?: boolean;
  mode?: PlansModalMode;
  upgradeReason?: UpgradePlanReason;
  onSummaryUpdated?: () => void;
};

function PlansModalHighestPlanPanel(props: {
  summary: WorkspaceBillingSummary;
  upgradeReason?: UpgradePlanReason;
}) {
  const plan = buildCurrentPlanDisplay(props.summary);
  const renewal = buildCurrentPlanRenewalDisplay(props.summary);
  const reasonSubtitle = props.upgradeReason
    ? resolveUpgradePlanReasonSubtitle(props.upgradeReason)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="rounded-xl border border-teal-200/45 bg-[color-mix(in_srgb,var(--teal-50)_88%,white_12%)] p-5 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-teal-700 ring-1 ring-teal-100">
          <Crown size={18} strokeWidth={1.75} aria-hidden />
        </div>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-teal-900/80">
          Current plan
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <BillingPlanIcon planKey={props.summary.plan.key} size={16} />
          <h3 className="m-0 text-lg font-semibold text-slate-900">{plan.name}</h3>
        </div>
        <p className="m-0 mt-1 text-sm font-medium text-teal-800">You&apos;re on the highest plan</p>
        <p className="m-0 mt-2 text-xs text-slate-500">{plan.price}</p>
        <p className="m-0 mt-2 text-xs leading-relaxed text-slate-500">{renewal.line}</p>
      </div>
      {reasonSubtitle ? (
        <p className="m-0 text-center text-sm leading-relaxed text-slate-600">{reasonSubtitle}</p>
      ) : null}
    </div>
  );
}

export function PlansModal({
  open,
  onClose,
  summary,
  workspaceId,
  role,
  isOwner,
  checkout,
  onDowngradeToStarter,
  onUpgradeToPro,
  downgradeLoading,
  upgradeLoading,
  mode = 'billing',
  upgradeReason,
  onSummaryUpdated,
}: PlansModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<PlanBillingPeriod>('monthly');
  const currentPlanKey = summary.plan?.key ?? 'free';
  const showHighestPlan = shouldShowHighestPlanPanel({ mode, currentPlanKey });
  const title = resolvePlansModalTitle(mode, currentPlanKey);
  const description = resolvePlansModalDescription(mode, currentPlanKey, upgradeReason);
  const relevantAddonKeys = showHighestPlan
    ? resolveRelevantAddonKeysForReason(upgradeReason)
    : undefined;
  const annualAvailable = (summary.planCatalog ?? []).some(
    (plan) => plan.key !== 'free' && isAnnualBillingAvailableForCatalog(plan),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="inline-flex items-center gap-2.5">
          <span className="shrink-0 text-teal-600">
            <Layers size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <span>{title}</span>
        </span>
      }
      description={description}
      overlayClassName="items-center p-4 sm:p-5"
      className="flex w-full max-w-[48.875rem] !max-h-[calc(100dvh-1.5rem)] flex-col !bg-white"
      headerClassName="!border-slate-200/90 !bg-white !px-4 !py-4"
      headerActions={
        showHighestPlan ? null : (
          <BillingPeriodToggle
            value={billingPeriod}
            onChange={setBillingPeriod}
            compact
            annualAvailable={annualAvailable}
            annualUnavailableMessage={ANNUAL_BILLING_UNAVAILABLE_MESSAGE}
          />
        )
      }
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !bg-white !p-0"
      footer={null}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {upgradeReason && !showHighestPlan ? (
          <p className="mx-auto mb-5 max-w-lg text-center text-sm leading-relaxed text-slate-600">
            {resolveUpgradePlanReasonSubtitle(upgradeReason)}
          </p>
        ) : null}

        {showHighestPlan ? (
          <div className="flex flex-col gap-6">
            <PlansModalHighestPlanPanel summary={summary} upgradeReason={upgradeReason} />
            <div className={cn('border-t border-slate-200/80 pt-5')}>
              <BillingAddonsList
                workspaceId={workspaceId}
                role={role}
                summary={summary}
                onSummaryUpdated={onSummaryUpdated}
                addonKeysFilter={relevantAddonKeys}
              />
            </div>
          </div>
        ) : (
          <PlansPricingCardsSection
            summary={summary}
            billingPeriod={billingPeriod}
            isOwner={isOwner}
            checkout={checkout}
            showCardIncludes
            mode={mode}
            onDowngradeToStarter={onDowngradeToStarter}
            onUpgradeToPro={onUpgradeToPro}
            downgradeLoading={downgradeLoading}
            upgradeLoading={upgradeLoading}
          />
        )}
      </div>
    </Modal>
  );
}
