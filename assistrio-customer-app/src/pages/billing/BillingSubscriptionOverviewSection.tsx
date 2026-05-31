import { useState } from 'react';
import type { ReactNode } from 'react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { PlansModal } from '@/components/billing/PlansModal';
import { Button, Tooltip } from '@/components/ui';
import { useBillingSubscriptionActions } from '@/hooks/useBillingSubscriptionActions';
import { BillingAddonsList } from '@/pages/billing/BillingAddonsSection';
import { BillingPeriodToggle } from '@/pages/billing/BillingPeriodToggle';
import { AnimatedPlanPriceDisplay } from '@/pages/billing/AnimatedPlanPriceDisplay';
import {
  BillingUpgradeButtonIcon,
  BillingUpgradeComparisonCard,
  BillingUpgradePanelHeader,
  buildBillingUpgradeButtonTooltip,
} from '@/pages/billing/BillingUpgradeComparisonCard';
import { BillingPlanIcon } from '@/pages/billing/BillingPlanIcon';
import {
  buildCurrentPlanContextLine,
  buildCurrentPlanDisplay,
  buildCurrentPlanRenewalDisplay,
  formatScheduledBillingIntervalEffectiveDate,
  formatScheduledPlanEffectiveDate,
  resolveNextPlanPanel,
  resolveScheduledBillingIntervalChange,
} from '@/pages/billing/billingSubscriptionOverviewDisplay';
import { BillingSwitchIntervalModal } from '@/pages/billing/BillingSwitchIntervalModal';
import { useBillingIntervalActions } from '@/hooks/useBillingIntervalActions';
import { formatBillingIntervalLabel, oppositeBillingInterval, ANNUAL_BILLING_UNAVAILABLE_MESSAGE, isAnnualBillingAvailableForCatalog, planBillingPeriodToInterval } from '@/lib/billingInterval.util';
import { buildBillingUpgradeComparison } from '@/pages/billing/billingUpgradeComparisonDisplay';
import { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { BillingDowngradePlanModal } from '@/pages/billing/BillingDowngradePlanModal';
import { BillingUpgradePlanModal } from '@/pages/billing/BillingUpgradePlanModal';
import { BillingManageInLemonButton } from '@/pages/billing/BillingManageInLemonButton';
import { BillingPaymentIssueBadge } from '@/pages/billing/BillingPaymentIssueBadge';
import {
  canOpenBillingCustomerPortal,
  hasSubscriptionPaymentIssue,
  PAYMENT_ISSUE_RECOVERY_COPY,
} from '@/pages/billing/billingPaymentIssueDisplay';
import { planCheckoutButtonLabel, type PaidPlanCheckoutKey } from '@/lib/billingCheckout';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import {
  formatPlanOverviewPriceLine,
  isPlanCheckoutAvailableForPeriod,
  shouldShowBillingPeriodToggle,
  type PlanBillingPeriod,
} from '@/pages/billing/planPricingCardDisplay';
import type { BillingInterval } from '@/api/types';

type Props = {
  workspaceId: string;
  role: string | undefined;
  summary: WorkspaceBillingSummary;
  checkoutEnabled: boolean;
  onSummaryUpdated?: () => void;
  showViewPlansLink?: boolean;
};

function PlanDetailRow(props: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-x-3 gap-y-0.5">
      <dt className="m-0 text-xs text-slate-500">{props.label}</dt>
      <dd className="m-0 text-sm font-medium text-slate-900">{props.value}</dd>
    </div>
  );
}

function isActivePlanStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === 'active' || normalized === 'free trial' || normalized === 'trialing';
}

function PlanStatusDot(props: { label: string; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
      {props.active ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      ) : null}
      {props.label}
    </span>
  );
}

const adjustPlanLinkClassName =
  'inline-flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--ui-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 text-xs font-medium leading-none text-slate-800 no-underline shadow-none transition-[background-color,border-color,color,box-shadow] duration-150 ease-out hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]';

/** Matches active add-on cards (e.g. 1,000 extra AI credits) in BillingAddonsSection. */
const billingAddonPanelClassName =
  'rounded-xl border border-slate-200/70 bg-slate-50/30 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

function PlanPanelShell(props: {
  label: ReactNode;
  children: ReactNode;
  surface?: 'plain' | 'addon';
}) {
  return (
    <div className={props.surface === 'addon' ? billingAddonPanelClassName : 'p-4'}>
      <div className="flex flex-col gap-3">
        <div className="m-0 min-w-0">{props.label}</div>
        {props.children}
      </div>
    </div>
  );
}

function PlanInsetCard(props: { label: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-teal-200/45 bg-[color-mix(in_srgb,var(--teal-50)_88%,white_12%)] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(13,148,136,0.14),transparent_48%),radial-gradient(circle_at_100%_0%,rgba(45,212,191,0.1),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(15,118,110,0.08),transparent_44%),linear-gradient(165deg,rgba(240,253,250,0.95),rgba(248,250,252,0.35))]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 bg-[repeating-linear-gradient(-45deg,rgba(20,184,166,0.09)_0px,rgba(20,184,166,0.09)_1px,transparent_1px,transparent_11px)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18] bg-[repeating-linear-gradient(0deg,rgba(13,148,136,0.12)_0px,rgba(13,148,136,0.12)_1px,transparent_1px,transparent_24px)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-teal-900/80">
          {props.label}
        </p>
        {props.children}
      </div>
    </div>
  );
}

function CurrentPlanPanel(props: {
  planKey: string;
  planName: string;
  status: string;
  price: string;
  billingIntervalLabel?: string | null;
  scheduledIntervalBanner?: ReactNode;
  renewalLine: string;
  renewalRemainingLabel: string | null;
  contextLine: string;
  showAdjustPlanLink?: boolean;
  onAdjustPlan?: () => void;
  showSwitchInterval?: boolean;
  switchIntervalLabel?: string;
  onSwitchInterval?: () => void;
  switchIntervalBusy?: boolean;
  showPaymentIssue?: boolean;
  showManageInLemon?: boolean;
  workspaceId?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BillingPlanIcon planKey={props.planKey} size={18} />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="m-0 text-xl font-semibold tracking-tight text-slate-900">{props.planName}</h3>
            <span className="text-sm text-slate-500">{props.price}</span>
            {props.billingIntervalLabel ? (
              <span className="text-xs font-medium text-slate-500">
                · {props.billingIntervalLabel} billing
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
        {props.showSwitchInterval && props.onSwitchInterval ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs"
            disabled={props.switchIntervalBusy}
            onClick={props.onSwitchInterval}
          >
            {props.switchIntervalLabel}
          </Button>
        ) : null}
        {props.showAdjustPlanLink && props.onAdjustPlan ? (
          <button type="button" className={adjustPlanLinkClassName} onClick={props.onAdjustPlan}>
            Adjust Plan
          </button>
        ) : null}
        </div>
      </div>
      {props.scheduledIntervalBanner ? (
        <div className="rounded-lg border border-teal-200/70 bg-teal-50/60 px-3 py-2.5 text-xs leading-relaxed text-teal-950">
          {props.scheduledIntervalBanner}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {props.showPaymentIssue ? (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
            <BillingPaymentIssueBadge className="self-start normal-case tracking-normal" />
            <p className="m-0 text-xs leading-relaxed text-amber-950/90">{PAYMENT_ISSUE_RECOVERY_COPY}</p>
            {props.showManageInLemon && props.workspaceId ? (
              <BillingManageInLemonButton
                workspaceId={props.workspaceId}
                className="self-start"
              />
            ) : null}
          </div>
        ) : (
          <PlanStatusDot label={props.status} active={isActivePlanStatus(props.status)} />
        )}
        <p className="m-0 text-sm font-medium text-slate-800">
          {props.renewalLine}
          {props.renewalRemainingLabel ? (
            <span className="text-[11px] font-normal text-slate-600">
              {' '}
              ({props.renewalRemainingLabel})
            </span>
          ) : null}
        </p>
        <p className="m-0 text-xs leading-relaxed text-slate-600">{props.contextLine}</p>
      </div>
    </div>
  );
}

export function BillingSubscriptionOverviewSection({
  workspaceId,
  role,
  summary,
  checkoutEnabled,
  onSummaryUpdated,
  showViewPlansLink = true,
}: Props) {
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [downgradeBillingPeriod, setDowngradeBillingPeriod] = useState<PlanBillingPeriod>('monthly');
  const [upgradeBillingPeriod, setUpgradeBillingPeriod] = useState<PlanBillingPeriod>('monthly');
  const [addonBillingPeriod, setAddonBillingPeriod] = useState<PlanBillingPeriod>('monthly');
  const [pendingPlanInterval, setPendingPlanInterval] = useState<BillingInterval | null>(null);
  const checkout = useBillingCheckout(workspaceId);
  const intervalActions = useBillingIntervalActions(workspaceId, onSummaryUpdated);
  const subscriptionActions = useBillingSubscriptionActions(workspaceId, () => {
    onSummaryUpdated?.();
  });
  const isOwner = isWorkspaceOwnerRole(role);
  const plan = buildCurrentPlanDisplay(summary);
  const contextLine = buildCurrentPlanContextLine(summary);
  const renewalDisplay = buildCurrentPlanRenewalDisplay(summary);
  const scheduledIntervalChange = resolveScheduledBillingIntervalChange(summary);
  const scheduledIntervalStarts = scheduledIntervalChange
    ? formatScheduledBillingIntervalEffectiveDate(scheduledIntervalChange)
    : null;
  const currentSubscriptionInterval =
    summary.subscription.billingInterval ?? ('monthly' as BillingInterval);
  const showPaymentIssue = hasSubscriptionPaymentIssue(summary);
  const showManageInLemon = canOpenBillingCustomerPortal({
    role,
    summary,
    checkoutEnabled,
  });
  const nextPlanPanel = resolveNextPlanPanel(summary);
  const upgradeCatalogPlan =
    nextPlanPanel?.kind === 'upgrade'
      ? summary.planCatalog?.find((entry) => entry.key === nextPlanPanel.upgrade.planKey)
      : null;
  const upgradePlanPriceLine =
    upgradeCatalogPlan != null
      ? formatPlanOverviewPriceLine(upgradeCatalogPlan.priceMonthly, {
          planKey: upgradeCatalogPlan.key,
          billingPeriod: upgradeBillingPeriod,
          pricing: upgradeCatalogPlan,
        })
      : null;
  const showBillingPeriodToggle = shouldShowBillingPeriodToggle({
    checkoutEnabled,
    planCatalog: summary.planCatalog,
    currentPlanPriceMonthly: summary.plan.priceMonthly,
  });
  const scheduledStarts =
    nextPlanPanel?.kind === 'scheduled'
      ? formatScheduledPlanEffectiveDate(nextPlanPanel.scheduled)
      : null;

  const upgradeComparisonRows =
    nextPlanPanel?.kind === 'upgrade'
      ? buildBillingUpgradeComparison(summary, nextPlanPanel.upgrade.planKey)
      : null;

  const canUpgrade =
    checkoutEnabled &&
    isOwner &&
    nextPlanPanel?.kind === 'upgrade' &&
    upgradeCatalogPlan != null &&
    isPlanCheckoutAvailableForPeriod(upgradeCatalogPlan, upgradeBillingPeriod);

  const upgradeViaPlanChange =
    canUpgrade &&
    summary.plan.key === 'starter' &&
    !summary.entitlements.isTrialPlan &&
    nextPlanPanel?.kind === 'upgrade' &&
    nextPlanPanel.upgrade.planKey === 'pro';

  const currentCatalogPlan = summary.planCatalog?.find((entry) => entry.key === summary.plan.key);
  const upgradeAnnualAvailable = upgradeCatalogPlan
    ? isAnnualBillingAvailableForCatalog(upgradeCatalogPlan)
    : true;
  const addonAnnualAvailable = (summary.addonCatalog ?? []).some(
    (addon) => addon.billingInterval === 'monthly' && isAnnualBillingAvailableForCatalog(addon),
  );
  const planSwitchTargetInterval = oppositeBillingInterval(currentSubscriptionInterval);
  const canSwitchTargetIntervalCheckout =
    currentCatalogPlan != null &&
    isPlanCheckoutAvailableForPeriod(
      currentCatalogPlan,
      planSwitchTargetInterval === 'yearly' ? 'annual' : 'monthly',
    );

  const canSwitchPlanInterval =
    checkoutEnabled &&
    isOwner &&
    summary.subscription.hasActivePaidSubscription &&
    summary.plan.key !== 'free' &&
    !summary.entitlements.isTrialPlan &&
    !scheduledIntervalChange &&
    !summary.subscription.cancelAtPeriodEnd &&
    !summary.subscription.hasPaymentIssue &&
    !summary.subscription.scheduledPlanKey &&
    canSwitchTargetIntervalCheckout;

  const showUpgradeBillingPeriodToggle =
    showBillingPeriodToggle && nextPlanPanel?.kind === 'upgrade';

  const nextPlanPanelLabel =
    nextPlanPanel?.kind === 'scheduled' ? (
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Scheduled change
      </span>
    ) : nextPlanPanel?.kind === 'upgrade' ? (
      <BillingUpgradePanelHeader
        fromPlanKey={summary.plan.key}
        toPlanKey={nextPlanPanel.upgrade.planKey}
      />
    ) : (
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Next plan
      </span>
    );

  return (
    <section
      id="billing-subscription-overview"
      aria-labelledby="billing-subscription-overview-heading"
      data-testid="billing-subscription-overview"
      className="rounded-2xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="billing-subscription-overview-heading"
            className="m-0 text-base font-semibold tracking-tight text-slate-900"
          >
            Subscription overview
          </h2>
          {showUpgradeBillingPeriodToggle ? (
            <BillingPeriodToggle
              value={upgradeBillingPeriod}
              onChange={setUpgradeBillingPeriod}
              compact
              className="shrink-0 self-start"
              annualAvailable={upgradeAnnualAvailable}
              annualUnavailableMessage={ANNUAL_BILLING_UNAVAILABLE_MESSAGE}
            />
          ) : null}
        </div>

        <div
          className={
            nextPlanPanel
              ? 'grid gap-6 border-t border-slate-200/80 pt-6 lg:grid-cols-2 lg:gap-8'
              : 'border-t border-slate-200/80 pt-6'
          }
          data-testid="billing-plan-summary-row"
        >
          <div className="min-w-0" data-testid="billing-current-plan">
            <PlanInsetCard label="Current plan">
              <CurrentPlanPanel
                planKey={summary.plan.key}
                planName={plan.name}
                status={plan.status}
                price={plan.price}
                billingIntervalLabel={plan.billingIntervalLabel}
                scheduledIntervalBanner={
                  scheduledIntervalChange ? (
                    <div className="flex flex-col gap-2">
                      <span>
                        Switching to{' '}
                        <span className="font-medium">
                          {formatBillingIntervalLabel(scheduledIntervalChange.targetInterval).toLowerCase()}
                        </span>{' '}
                        billing
                        {scheduledIntervalStarts ? (
                          <>
                            {' '}
                            on <span className="font-medium">{scheduledIntervalStarts}</span>
                          </>
                        ) : (
                          ' at next renewal'
                        )}
                        .
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="self-start"
                        disabled={intervalActions.busy}
                        onClick={() => void intervalActions.cancelScheduledSubscriptionInterval()}
                      >
                        Keep current plan
                      </Button>
                    </div>
                  ) : null
                }
                showSwitchInterval={canSwitchPlanInterval}
                switchIntervalLabel={`Switch to ${formatBillingIntervalLabel(planSwitchTargetInterval).toLowerCase()}`}
                onSwitchInterval={() => setPendingPlanInterval(planSwitchTargetInterval)}
                switchIntervalBusy={intervalActions.busy}
                renewalLine={renewalDisplay.line}
                renewalRemainingLabel={renewalDisplay.remainingLabel}
                contextLine={contextLine}
                showAdjustPlanLink={showViewPlansLink && checkoutEnabled}
                onAdjustPlan={() => setPlansModalOpen(true)}
                showPaymentIssue={showPaymentIssue}
                showManageInLemon={showManageInLemon}
                workspaceId={workspaceId}
              />
            </PlanInsetCard>
          </div>

          {nextPlanPanel ? (
            <div
              className="min-w-0 border-t border-slate-200/80 pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0"
              data-testid="billing-next-plan"
            >
              <PlanPanelShell
                label={nextPlanPanelLabel}
                surface={nextPlanPanel.kind === 'upgrade' ? 'addon' : 'plain'}
              >
                {nextPlanPanel.kind === 'scheduled' ? (
                  <div className="space-y-3">
                    <h3 className="m-0 text-sm font-semibold text-slate-900">
                      {nextPlanPanel.scheduled.planName}
                    </h3>
                    <dl className="m-0 space-y-2">
                      {scheduledStarts ? (
                        <PlanDetailRow label="Starts" value={scheduledStarts} />
                      ) : (
                        <PlanDetailRow label="Starts" value="At next renewal" />
                      )}
                    </dl>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <BillingPlanIcon planKey={nextPlanPanel.upgrade.planKey} size={18} />
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <h3 className="m-0 shrink-0 text-xl font-semibold tracking-tight text-slate-900">
                            {nextPlanPanel.upgrade.planName}
                          </h3>
                          {upgradeCatalogPlan != null ? (
                            <AnimatedPlanPriceDisplay
                              priceMonthly={upgradeCatalogPlan.priceMonthly}
                              planKey={upgradeCatalogPlan.key}
                              billingPeriod={upgradeBillingPeriod}
                              pricing={upgradeCatalogPlan}
                              size="embedded"
                              inlineWithTitle
                            />
                          ) : null}
                        </div>
                      </div>
                      {canUpgrade ? (
                        <Tooltip
                          content={buildBillingUpgradeButtonTooltip({
                            planName: nextPlanPanel.upgrade.planName,
                            price: upgradePlanPriceLine ?? nextPlanPanel.upgrade.price,
                            action: upgradeViaPlanChange ? 'change-plan' : 'checkout',
                          })}
                          side="top"
                          panelClassName="max-w-[18rem] text-pretty"
                        >
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              upgradeViaPlanChange
                                ? subscriptionActions.busy
                                : checkout.isPlanLoading(
                                    nextPlanPanel.upgrade.planKey,
                                    upgradeBillingPeriod,
                                  )
                            }
                            className="shrink-0 self-start gap-1.5 sm:self-center"
                            onClick={() =>
                              upgradeViaPlanChange
                                ? setUpgradeOpen(true)
                                : void checkout.startPlanCheckout(
                                    nextPlanPanel.upgrade.planKey as PaidPlanCheckoutKey,
                                    upgradeBillingPeriod,
                                  )
                            }
                          >
                            {upgradeViaPlanChange ? (
                              subscriptionActions.busy ? (
                                'Upgrading…'
                              ) : (
                                <>
                                  <BillingUpgradeButtonIcon size={12} />
                                  Upgrade to Pro
                                </>
                              )
                            ) : checkout.isPlanLoading(
                                nextPlanPanel.upgrade.planKey,
                                upgradeBillingPeriod,
                              ) ? (
                              'Starting checkout…'
                            ) : (
                              <>
                                <BillingUpgradeButtonIcon size={12} />
                                {planCheckoutButtonLabel(
                                  summary.plan.key,
                                  nextPlanPanel.upgrade.planKey as PaidPlanCheckoutKey,
                                  { isTrialPlan: summary.entitlements.isTrialPlan },
                                )}
                              </>
                            )}
                          </Button>
                        </Tooltip>
                      ) : null}
                    </div>
                    {upgradeComparisonRows?.length ? (
                      <BillingUpgradeComparisonCard rows={upgradeComparisonRows} />
                    ) : null}
                  </div>
                )}
              </PlanPanelShell>
            </div>
          ) : null}
        </div>

        {checkoutEnabled ? (
          <div
            className="border-t border-slate-200/80 pt-6"
            data-testid="billing-addons-subsection"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p
                  id="billing-addons-heading"
                  className="m-0 text-[11px] font-medium uppercase tracking-wide text-slate-400"
                >
                  Add-ons
                </p>
                <p className="m-0 text-xs leading-relaxed text-slate-500">
                  Workspace extras, recurring add-ons, and credit top-ups.
                </p>
              </div>
              {showBillingPeriodToggle ? (
                <BillingPeriodToggle
                  value={addonBillingPeriod}
                  onChange={setAddonBillingPeriod}
                  compact
                  className="shrink-0 self-start"
                  annualAvailable={addonAnnualAvailable}
                  annualUnavailableMessage={ANNUAL_BILLING_UNAVAILABLE_MESSAGE}
                />
              ) : null}
            </div>
            <BillingAddonsList
              workspaceId={workspaceId}
              role={role}
              summary={summary}
              onSummaryUpdated={onSummaryUpdated}
              billingPeriod={addonBillingPeriod}
            />
          </div>
        ) : null}
      </div>

      {checkoutEnabled && summary ? (
        <>
          <PlansModal
            open={plansModalOpen}
            onClose={() => setPlansModalOpen(false)}
            summary={summary}
            workspaceId={workspaceId}
            role={role}
            isOwner={isOwner}
            checkout={checkout}
            mode="billing"
            onSummaryUpdated={onSummaryUpdated}
            onDowngradeToStarter={() => {
              setDowngradeBillingPeriod(upgradeBillingPeriod);
              setDowngradeOpen(true);
            }}
            onUpgradeToPro={() => setUpgradeOpen(true)}
            downgradeLoading={subscriptionActions.busy}
            upgradeLoading={subscriptionActions.busy}
          />
          <BillingUpgradePlanModal
            open={upgradeOpen}
            onClose={() => setUpgradeOpen(false)}
            busy={subscriptionActions.busy}
            onConfirm={async () => {
              const ok = await subscriptionActions.changePlan(
                'pro',
                planBillingPeriodToInterval(upgradeBillingPeriod),
              );
              if (ok) {
                setUpgradeOpen(false);
                setPlansModalOpen(false);
              }
            }}
          />
          <BillingDowngradePlanModal
            open={downgradeOpen}
            onClose={() => setDowngradeOpen(false)}
            busy={subscriptionActions.busy}
            effectiveDate={summary.subscription.currentPeriodEnd}
            onConfirm={async () => {
              const ok = await subscriptionActions.changePlan(
                'starter',
                planBillingPeriodToInterval(downgradeBillingPeriod),
              );
              if (ok) {
                setDowngradeOpen(false);
                setPlansModalOpen(false);
              }
            }}
          />
          <BillingSwitchIntervalModal
            open={Boolean(pendingPlanInterval)}
            itemLabel={plan.name}
            currentInterval={currentSubscriptionInterval}
            targetInterval={pendingPlanInterval ?? currentSubscriptionInterval}
            effectiveDate={summary.subscription.currentPeriodEnd}
            busy={intervalActions.busy}
            onClose={() => setPendingPlanInterval(null)}
            onConfirm={() => {
              if (!pendingPlanInterval) return;
              void intervalActions
                .scheduleSubscriptionInterval(pendingPlanInterval)
                .then((ok) => {
                  if (ok) setPendingPlanInterval(null);
                });
            }}
          />
        </>
      ) : null}
    </section>
  );
}
