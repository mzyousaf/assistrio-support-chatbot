import { useCallback, useState } from 'react';
import type {
  BillingInterval,
  WorkspaceBillingAddonCatalogCard,
  WorkspaceBillingExtraBotAddonInstance,
  WorkspaceBillingSummary,
} from '@/api/types';
import { PaidPlanFeatureCalloutForReason } from '@/components/billing/PaidPlanFeatureCallout';
import { Button, Switch } from '@/components/ui';
import { useBillingAddonActions } from '@/hooks/useBillingAddonActions';
import { useBillingCreditAutoTopUp } from '@/hooks/useBillingCreditAutoTopUp';
import { useBillingAutoTopUp } from '@/hooks/useBillingAutoTopUp';
import { EnableAutoTopUpModal } from '@/components/billing/EnableAutoTopUpModal';
import { DisableAutoTopUpModal } from '@/components/billing/DisableAutoTopUpModal';
import type { WorkspaceBillingAutoTopUpSummary } from '@/api/types';
import { useBillingCheckout } from '@/hooks/useBillingCheckout';
import { useBillingIntervalActions } from '@/hooks/useBillingIntervalActions';
import {
  ANNUAL_BILLING_UNAVAILABLE_MESSAGE,
  formatBillingIntervalLabel,
  isAnnualBillingAvailableForCatalog,
  isRecurringAddonCatalogCard,
  oppositeBillingInterval,
} from '@/lib/billingInterval.util';
import {
  AI_CREDITS_TOP_UP_USAGE_ORDER_COPY,
  formatAddonRenewalLabel,
  formatAddonStatusLabel,
  formatAutoTopUpStatusLabel,
} from '@/lib/billingAddonCatalogDisplay';
import { formatExtraAiAgentInstanceLabel } from '@/lib/customerAgentTerminology';
import { isTopUpAddonKey } from '@/lib/billingCheckout';
import { isWorkspaceManagerRole, isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import { BillingCancelAddonModal } from '@/pages/billing/BillingCancelAddonModal';
import { BillingSwitchIntervalModal } from '@/pages/billing/BillingSwitchIntervalModal';
import { BillingManageInLemonButton } from '@/pages/billing/BillingManageInLemonButton';
import { BillingPaymentIssueBadge } from '@/pages/billing/BillingPaymentIssueBadge';
import { canOpenBillingCustomerPortal, isAddonPaymentIssueStatus } from '@/pages/billing/billingPaymentIssueDisplay';
import { BillingAddonIcon } from '@/pages/billing/BillingAddonIcon';
import { isBillingAddonAdded } from '@/pages/billing/billingAddonCardIconDisplay';
import {
  formatAddonDescription,
  formatAddonDisplayName,
} from '@/pages/billing/billingSummaryDisplay';
import { computeTopUpCreditsUsage } from '@/pages/usage/usagePageFormat';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';
import { cn } from '@/lib/utils';
import { isAllowedBillingAddonKey } from '@/lib/planModalDisplay';
import { BillingPeriodToggle } from '@/pages/billing/BillingPeriodToggle';
import { AnimatedPlanPriceDisplay } from '@/pages/billing/AnimatedPlanPriceDisplay';
import {
  isAddonCheckoutAvailableForPeriod,
  shouldShowBillingPeriodToggle,
  type PlanBillingPeriod,
} from '@/pages/billing/planPricingCardDisplay';

type ListProps = {
  workspaceId: string;
  role: string | null | undefined;
  summary: WorkspaceBillingSummary;
  onSummaryUpdated?: () => void;
  /** When set, only these add-on keys are shown (must be allowlisted). */
  addonKeysFilter?: readonly string[];
  billingPeriod?: PlanBillingPeriod;
};

type SectionProps = ListProps & {
  checkoutEnabled: boolean;
  compact?: boolean;
  /** When true, the section renders its own monthly/annual toggle. */
  showBillingPeriodToggle?: boolean;
};

type PendingCancel = {
  addonKey: string;
  addonName: string;
  addonInstanceId?: string;
  targetBotId?: string | null;
};

type PendingIntervalSwitch = {
  addonKey: string;
  addonName: string;
  currentInterval: BillingInterval;
  targetInterval: BillingInterval;
  addonInstanceId?: string;
  effectiveDate?: string | null;
};

const COMPACT_ADDON_KEYS = ['ai_credits_1000', 'remove_branding'] as const;

function partitionAddonCatalog(catalog: WorkspaceBillingAddonCatalogCard[]) {
  const allowedCatalog = catalog.filter((addon) => isAllowedBillingAddonKey(addon.key));
  const extraBotAddon = allowedCatalog.find((addon) => addon.key === 'extra_bot');
  const compactAddons = COMPACT_ADDON_KEYS.map((key) =>
    allowedCatalog.find((addon) => addon.key === key),
  ).filter((addon): addon is WorkspaceBillingAddonCatalogCard => Boolean(addon));

  return { extraBotAddon, compactAddons, otherAddons: [] as WorkspaceBillingAddonCatalogCard[] };
}

function isActiveAddonStatus(status: string): boolean {
  return status === 'active' || status === 'cancel_at_period_end';
}

function AddonStatusIndicator(props: { status: string }) {
  if (isAddonPaymentIssueStatus(props.status)) {
    return <BillingPaymentIssueBadge className="normal-case tracking-normal" />;
  }

  const label = formatAddonStatusLabel(props.status);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      {isActiveAddonStatus(props.status) ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

function AddonPaymentIssueActions(props: {
  workspaceId: string;
  showManageInLemon: boolean;
}) {
  if (!props.showManageInLemon) {
    return <BillingPaymentIssueBadge className="normal-case tracking-normal" />;
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <BillingPaymentIssueBadge className="self-start normal-case tracking-normal sm:self-end" />
      <BillingManageInLemonButton workspaceId={props.workspaceId} className="self-start sm:self-end" />
    </div>
  );
}

function AddonCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        'h-full rounded-xl border border-slate-200/70 bg-slate-50/30 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        props.className,
      )}
    >
      {props.children}
    </article>
  );
}

function AddonTitleRow(props: {
  title: string;
  priceDisplay?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {props.icon ? <div className="mt-1 shrink-0">{props.icon}</div> : null}
        <div className="min-w-0">
          <h4 className="m-0 text-base font-semibold tracking-tight text-slate-900">{props.title}</h4>
          {props.priceDisplay ? <div className="min-w-0">{props.priceDisplay}</div> : null}
        </div>
      </div>
      {props.actions ? <AddonActionGroup>{props.actions}</AddonActionGroup> : null}
    </div>
  );
}

function AddonPriceDisplay(props: {
  addon: WorkspaceBillingAddonCatalogCard;
  billingPeriod: PlanBillingPeriod;
}) {
  if (props.addon.billingInterval === 'one_time') {
    return (
      <p className="m-0 mt-1 text-sm font-medium tabular-nums text-slate-500">
        ${props.addon.priceUsd.toLocaleString()} one-time
      </p>
    );
  }

  return (
    <AnimatedPlanPriceDisplay
      priceMonthly={props.addon.priceUsd}
      billingPeriod={props.billingPeriod}
      pricing={{
        priceMonthly: props.addon.priceUsd,
        priceYearly: props.addon.priceYearly,
        monthlyEquivalentYearly: props.addon.monthlyEquivalentYearly,
        yearlyDiscountPercent: props.addon.yearlyDiscountPercent,
      }}
      size="embedded"
    />
  );
}

function AddonBillingIntervalLine(props: {
  scheduledChange?: WorkspaceBillingAddonCatalogCard['scheduledIntervalChange'];
}) {
  if (!props.scheduledChange?.toInterval) return null;

  return (
    <p className="m-0 text-xs text-teal-800">
      Switching to {formatBillingIntervalLabel(props.scheduledChange.toInterval).toLowerCase()} billing
      {props.scheduledChange.effectiveDate ? (
        <> on {formatUsagePeriodDate(props.scheduledChange.effectiveDate)}</>
      ) : (
        ' at next renewal'
      )}
      .
    </p>
  );
}

function AddonSwitchIntervalButton(props: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={props.disabled}
      className="h-7 shrink-0 px-2.5 text-xs whitespace-nowrap"
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}

function AddonCancelButton(props: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondaryDanger"
      size="sm"
      disabled={props.disabled}
      className="h-7 shrink-0 px-2.5 text-xs whitespace-nowrap"
      onClick={props.onClick}
    >
      Cancel add-on
    </Button>
  );
}

function AddonActionGroup(props: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{props.children}</div>
  );
}

function AddonPurchaseButton(props: {
  loading: boolean;
  onClick: () => void;
  title: string;
  label?: string;
}) {
  const buttonLabel = props.label ?? 'Buy Add-on';
  const ariaLabel = props.loading ? 'Starting checkout' : `Buy add-on: ${props.title}`;
  return (
    <Button
      type="button"
      variant="outlinePrimary"
      size="sm"
      disabled={props.loading}
      className="h-7 shrink-0 px-2.5 text-xs whitespace-nowrap"
      aria-label={props.label ? undefined : ariaLabel}
      onClick={props.onClick}
    >
      {props.loading ? 'Starting checkout…' : buttonLabel}
    </Button>
  );
}

function AddonOwnerNotice(props: { isOwner: boolean; onFreePlan: boolean; isTopUp?: boolean }) {
  if (props.onFreePlan) {
    return <PaidPlanFeatureCalloutForReason reason="addons" compact />;
  }
  if (!props.isOwner && !props.onFreePlan) {
    return (
      <p className="m-0 text-xs text-slate-500">Only the workspace owner can manage add-ons.</p>
    );
  }
  return null;
}

function resolveMergedTopUpBalance(
  topUps: WorkspaceBillingSummary['topUps'] | undefined,
  topUpCreditsRemaining: number,
): { creditsRemaining: number; creditsPurchased: number } | null {
  const { totalPurchased } = computeTopUpCreditsUsage(topUpCreditsRemaining, topUps);
  if (totalPurchased <= 0) return null;

  return {
    creditsRemaining: topUpCreditsRemaining,
    creditsPurchased: totalPurchased,
  };
}

function TopUpCreditsBalance(props: { creditsRemaining: number; creditsPurchased: number }) {
  const { creditsRemaining, creditsPurchased } = props;
  const creditsUsed = Math.max(0, creditsPurchased - creditsRemaining);
  const percent =
    creditsPurchased > 0
      ? Math.min(100, Math.round((creditsUsed / creditsPurchased) * 100))
      : 0;
  const balanceLabel = `${creditsUsed.toLocaleString()} of ${creditsPurchased.toLocaleString()} extra AI credits used`;

  return (
    <div className="rounded-md border border-slate-200/60 bg-slate-100/70 px-2.5 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">Extra AI Credits Used</span>
        <p className="m-0 text-right text-[11px] tabular-nums leading-none" aria-hidden>
          <span className="font-semibold text-slate-800">{creditsUsed.toLocaleString()}</span>
          <span className="text-slate-400"> / </span>
          <span className="text-slate-500">{creditsPurchased.toLocaleString()}</span>
        </p>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-white ring-1 ring-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={creditsPurchased}
        aria-valuenow={creditsUsed}
        aria-label={balanceLabel}
      >
        <div
          className="h-full rounded-full bg-teal-500/80 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function AutoTopUpControls(props: {
  autoTopUp?: WorkspaceBillingAutoTopUpSummary;
  canManage: boolean;
  onFreePlan: boolean;
  addonsAllowed: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const autoTopUp = props.autoTopUp;
  const canConfigure =
    props.canManage && props.addonsAllowed && !props.onFreePlan && Boolean(autoTopUp?.checkoutAvailable);
  const status = autoTopUp?.status ?? 'off';
  const isActive = status === 'active' || status === 'payment_issue' || status === 'scheduled_disable';

  return (
    <div className="rounded-md border border-slate-200/60 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xs font-medium text-slate-800">Auto top-up</p>
          <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-500">
            When monthly and existing top-up credits run out, automatically add 1,000 credits via
            Lemon Squeezy after you authorize billing.
          </p>
          {status !== 'off' ? (
            <p className="m-0 mt-1 text-[11px] font-medium text-slate-600">
              Status: {formatAutoTopUpStatusLabel(status)}
            </p>
          ) : null}
        </div>
        {canConfigure ? (
          isActive || status === 'pending' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={props.busy || status === 'pending'}
              onClick={props.onDisable}
            >
              Turn off
            </Button>
          ) : (
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              disabled={props.busy}
              onClick={props.onEnable}
            >
              Enable auto top-up
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}

function CreditAutoTopUpToggle(props: {
  enabled: boolean;
  disabled: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200/60 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="m-0 text-xs font-medium text-slate-800">Reminder for top-up</p>
        <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-500">
          When credits run out, we&apos;ll remind workspace owners to buy 1,000 extra credits.
        </p>
        <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-500">
          This does not charge your card automatically. You&apos;ll confirm the purchase in Lemon
          Squeezy.
        </p>
      </div>
      <Switch
        checked={props.enabled}
        disabled={props.disabled || props.busy}
        onCheckedChange={props.onChange}
        aria-label="Reminder for top-up"
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

function formatExtraBotInstanceRenewalLine(
  instance: WorkspaceBillingExtraBotAddonInstance,
): string {
  const isCanceling =
    instance.status === 'cancel_at_period_end' || instance.cancelAtPeriodEnd;
  const date = instance.currentPeriodEnd
    ? formatUsagePeriodDate(instance.currentPeriodEnd)
    : null;

  if (isCanceling && date) return `Cancels ${date}`;
  if (date) return `Renews ${date}`;
  return isCanceling ? 'Cancels at period end' : 'Active';
}

export function BillingAddonsList({
  workspaceId,
  role,
  summary,
  onSummaryUpdated,
  addonKeysFilter,
  billingPeriod = 'monthly',
}: ListProps) {
  const checkout = useBillingCheckout(workspaceId);
  const intervalActions = useBillingIntervalActions(workspaceId, onSummaryUpdated);
  const addonActions = useBillingAddonActions(workspaceId, onSummaryUpdated);
  const creditAutoTopUp = useBillingCreditAutoTopUp(workspaceId, onSummaryUpdated);
  const billingAutoTopUp = useBillingAutoTopUp(workspaceId, onSummaryUpdated);
  const isOwner = isWorkspaceOwnerRole(role);
  const canManageBilling = isWorkspaceManagerRole(role);
  const addonsAllowed = summary.entitlements.addonsAllowed;
  const onFreePlan = summary.plan.key === 'free' || summary.entitlements.isTrialPlan;
  const [enableAutoTopUpOpen, setEnableAutoTopUpOpen] = useState(false);
  const [disableAutoTopUpOpen, setDisableAutoTopUpOpen] = useState(false);

  const [pendingCancel, setPendingCancel] = useState<PendingCancel | null>(null);
  const [pendingIntervalSwitch, setPendingIntervalSwitch] = useState<PendingIntervalSwitch | null>(
    null,
  );

  const addonCatalog = (summary.addonCatalog ?? []).filter((addon) => {
    if (!isAllowedBillingAddonKey(addon.key)) return false;
    if (!addonKeysFilter?.length) return true;
    return addonKeysFilter.includes(addon.key);
  });
  const extraBotInstances = summary.extraBotAddons ?? [];
  const topUps = summary.topUps ?? [];
  const topUpCreditsRemaining =
    topUps.reduce((sum, row) => sum + (row.creditsRemaining ?? 0), 0) ||
    (summary.usage.aiCredits.topUpCreditsRemaining ?? 0);
  const showManageInLemon = canOpenBillingCustomerPortal({
    role,
    summary,
    checkoutEnabled: true,
  });

  const handlePurchase = useCallback(
    async (addonKey: string) => {
      if (isTopUpAddonKey(addonKey)) {
        await checkout.startTopUpCheckout('ai_credits_1000');
        return;
      }

      await checkout.startAddonCheckout(addonKey, undefined, billingPeriod);
    },
    [checkout, billingPeriod],
  );

  const { extraBotAddon, compactAddons, otherAddons } = partitionAddonCatalog(addonCatalog);

  const renderStandardAddonRow = (addon: WorkspaceBillingAddonCatalogCard) => (
    <AddonRow
      key={addon.key}
      addon={addon}
      billingPeriod={billingPeriod}
      topUps={topUps}
      topUpCreditsRemaining={topUpCreditsRemaining}
      isOwner={isOwner}
      addonsAllowed={addonsAllowed}
      onFreePlan={onFreePlan}
      checkoutLoading={checkout.isAddonLoading(addon.key)}
      actionsBusy={addonActions.busy}
      workspaceId={workspaceId}
      showManageInLemon={showManageInLemon}
      onPurchase={() => void handlePurchase(addon.key)}
      onSwitchInterval={(targetInterval) =>
        setPendingIntervalSwitch({
          addonKey: addon.key,
          addonName: formatAddonDisplayName(addon),
          currentInterval: addon.subscriptionBillingInterval ?? 'monthly',
          targetInterval,
          effectiveDate: addon.currentPeriodEnd,
        })
      }
      intervalActionsBusy={intervalActions.busy}
      onCancel={() =>
        setPendingCancel({
          addonKey: addon.key,
          addonName: formatAddonDisplayName(addon),
          targetBotId: addon.targetBotId,
        })
      }
      autoTopUpPromptEnabled={Boolean(addon.autoTopUpPromptEnabled)}
      autoTopUpPromptBusy={creditAutoTopUp.busy}
      canConfigureAutoTopUpPrompt={
        canManageBilling && addonsAllowed && !onFreePlan && addon.checkoutAvailable && isTopUpAddonKey(addon.key)
      }
      autoTopUp={summary.autoTopUp}
      onEnableAutoTopUp={() => setEnableAutoTopUpOpen(true)}
      onDisableAutoTopUp={() => setDisableAutoTopUpOpen(true)}
      autoTopUpBusy={billingAutoTopUp.busy}
      canManageAutoTopUp={canManageBilling}
      onAutoTopUpPromptChange={(next) => void creditAutoTopUp.setAutoTopUpEnabled(next)}
    />
  );

  return (
    <>
      <div id="billing-addons" className="flex flex-col gap-3">
        {addonCatalog.length === 0 ? (
          <p className="m-0 py-1 text-sm text-slate-500">No add-ons available.</p>
        ) : (
          <>
            {compactAddons.length > 0 ? (
              <div className="flex flex-col gap-3" data-testid="billing-addons-compact-row">
                {compactAddons.map((addon) => renderStandardAddonRow(addon))}
              </div>
            ) : null}

            {extraBotAddon ? (
              <ExtraBotAddonRow
                addon={extraBotAddon}
                billingPeriod={billingPeriod}
                instances={extraBotInstances}
                isOwner={isOwner}
                addonsAllowed={addonsAllowed}
                onFreePlan={onFreePlan}
                checkoutLoading={checkout.isAddonLoading(extraBotAddon.key)}
                actionsBusy={addonActions.busy}
                workspaceId={workspaceId}
                showManageInLemon={showManageInLemon}
                onPurchase={() => void handlePurchase(extraBotAddon.key)}
                onCancelInstance={(instance, index) =>
                  setPendingCancel({
                    addonKey: extraBotAddon.key,
                    addonName: formatExtraAiAgentInstanceLabel(index),
                    addonInstanceId: instance.id,
                  })
                }
                onSwitchInstanceInterval={(instance, index, targetInterval) =>
                  setPendingIntervalSwitch({
                    addonKey: extraBotAddon.key,
                    addonName: formatExtraAiAgentInstanceLabel(index),
                    currentInterval: instance.billingInterval ?? 'monthly',
                    targetInterval,
                    addonInstanceId: instance.id,
                    effectiveDate: instance.currentPeriodEnd,
                  })
                }
                intervalActionsBusy={intervalActions.busy}
              />
            ) : null}

            {otherAddons.map((addon) => renderStandardAddonRow(addon))}
          </>
        )}
      </div>

      <BillingCancelAddonModal
        open={Boolean(pendingCancel)}
        addonName={pendingCancel?.addonName ?? 'Add-on'}
        busy={addonActions.busy}
        onClose={() => setPendingCancel(null)}
        onConfirm={() => {
          if (!pendingCancel) return;
          void addonActions
            .cancelAddon({
              addonKey: pendingCancel.addonKey,
              targetBotId: pendingCancel.targetBotId,
              addonInstanceId: pendingCancel.addonInstanceId,
            })
            .then((ok) => {
              if (ok) setPendingCancel(null);
            });
        }}
      />
      <BillingSwitchIntervalModal
        open={Boolean(pendingIntervalSwitch)}
        itemLabel={pendingIntervalSwitch?.addonName ?? 'Add-on'}
        currentInterval={pendingIntervalSwitch?.currentInterval ?? 'monthly'}
        targetInterval={pendingIntervalSwitch?.targetInterval ?? 'yearly'}
        effectiveDate={pendingIntervalSwitch?.effectiveDate}
        busy={intervalActions.busy}
        onClose={() => setPendingIntervalSwitch(null)}
        onConfirm={() => {
          if (!pendingIntervalSwitch?.addonInstanceId) return;
          void intervalActions
            .scheduleAddonInterval({
              addonKey: pendingIntervalSwitch.addonKey,
              billingInterval: pendingIntervalSwitch.targetInterval,
              addonInstanceId: pendingIntervalSwitch.addonInstanceId,
            })
            .then((ok) => {
              if (ok) setPendingIntervalSwitch(null);
            });
        }}
      />
      <EnableAutoTopUpModal
        open={enableAutoTopUpOpen}
        busy={billingAutoTopUp.busy}
        onClose={() => setEnableAutoTopUpOpen(false)}
        onConfirm={async () => {
          const ok = await billingAutoTopUp.startEnableCheckout();
          if (ok) setEnableAutoTopUpOpen(false);
        }}
      />
      <DisableAutoTopUpModal
        open={disableAutoTopUpOpen}
        busy={billingAutoTopUp.busy}
        cancelAtPeriodEnd={Boolean(summary.autoTopUp?.cancelAtPeriodEnd)}
        onClose={() => setDisableAutoTopUpOpen(false)}
        onConfirm={async () => {
          const ok = await billingAutoTopUp.disableAutoTopUp();
          if (ok) setDisableAutoTopUpOpen(false);
        }}
      />
    </>
  );
}

export function BillingAddonsSection({
  checkoutEnabled,
  showBillingPeriodToggle = true,
  billingPeriod: billingPeriodProp,
  ...listProps
}: SectionProps) {
  const [billingPeriodInternal, setBillingPeriodInternal] = useState<PlanBillingPeriod>('monthly');
  const billingPeriod = billingPeriodProp ?? billingPeriodInternal;
  const canShowBillingPeriodToggle =
    showBillingPeriodToggle &&
    billingPeriodProp == null &&
    shouldShowBillingPeriodToggle({
      checkoutEnabled,
      planCatalog: listProps.summary.planCatalog,
      currentPlanPriceMonthly: listProps.summary.plan.priceMonthly,
    });
  const addonAnnualAvailable = (listProps.summary.addonCatalog ?? []).some(
    (addon) => addon.billingInterval === 'monthly' && isAnnualBillingAvailableForCatalog(addon),
  );

  if (!checkoutEnabled) return null;

  return (
    <section
      id="billing-addons-section"
      aria-labelledby="billing-addons-section-heading"
      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 id="billing-addons-section-heading" className="m-0 text-base font-semibold text-slate-900">
            Add-ons
          </h2>
          <p className="m-0 text-sm text-slate-500">
            Workspace extras, recurring add-ons, and credit top-ups.
          </p>
        </div>
        {canShowBillingPeriodToggle ? (
          <BillingPeriodToggle
            value={billingPeriod}
            onChange={setBillingPeriodInternal}
            compact
            className="shrink-0 self-start"
            annualAvailable={addonAnnualAvailable}
            annualUnavailableMessage={ANNUAL_BILLING_UNAVAILABLE_MESSAGE}
          />
        ) : null}
      </div>
      <BillingAddonsList {...listProps} billingPeriod={billingPeriod} />
    </section>
  );
}

type ExtraBotAddonRowProps = {
  addon: WorkspaceBillingAddonCatalogCard;
  billingPeriod: PlanBillingPeriod;
  instances: WorkspaceBillingExtraBotAddonInstance[];
  isOwner: boolean;
  addonsAllowed: boolean;
  onFreePlan: boolean;
  checkoutLoading: boolean;
  actionsBusy: boolean;
  intervalActionsBusy: boolean;
  workspaceId: string;
  showManageInLemon: boolean;
  onPurchase: () => void;
  onCancelInstance: (instance: WorkspaceBillingExtraBotAddonInstance, index: number) => void;
  onSwitchInstanceInterval: (
    instance: WorkspaceBillingExtraBotAddonInstance,
    index: number,
    targetInterval: BillingInterval,
  ) => void;
};

function ExtraBotAddonRow(props: ExtraBotAddonRowProps) {
  const { addon, instances } = props;
  const activeCount = instances.length;
  const title = formatAddonDisplayName(addon);
  const canPurchase =
    props.isOwner &&
    props.addonsAllowed &&
    !props.onFreePlan &&
    isAddonCheckoutAvailableForPeriod(addon, props.billingPeriod);

  const summaryLine =
    activeCount === 0
      ? null
      : activeCount === 1
        ? '1 active add-on'
        : `${activeCount} active add-ons`;

  const description =
    activeCount > 0
        ? `Adds ${activeCount} extra ${activeCount === 1 ? 'AI Agent' : 'AI Agents'} to this workspace.`
      : formatAddonDescription(addon);

  return (
    <AddonCard>
      <div className="flex flex-col gap-4">
        <AddonTitleRow
          title={title}
          priceDisplay={<AddonPriceDisplay addon={addon} billingPeriod={props.billingPeriod} />}
          icon={
            <BillingAddonIcon
              addonKey={addon.key}
              added={isBillingAddonAdded({
                addonKey: addon.key,
                extraBotInstanceCount: activeCount,
              })}
            />
          }
          actions={
            canPurchase ? (
              <AddonPurchaseButton
                loading={props.checkoutLoading}
                title={title}
                onClick={props.onPurchase}
              />
            ) : null
          }
        />
        <AddonOwnerNotice
          isOwner={props.isOwner}
          onFreePlan={props.onFreePlan}
        />

        <div className="flex flex-col gap-2">
          {summaryLine && !isAddonPaymentIssueStatus(addon.status) ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              {summaryLine}
            </span>
          ) : isAddonPaymentIssueStatus(addon.status) && instances.length === 0 ? (
            <AddonPaymentIssueActions
              workspaceId={props.workspaceId}
              showManageInLemon={props.showManageInLemon}
            />
          ) : summaryLine ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              {summaryLine}
            </span>
          ) : (
            <AddonStatusIndicator status={addon.status ?? 'inactive'} />
          )}
          <p className="m-0 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>

        {instances.length > 0 ? (
          <ul className="m-0 list-none space-y-2 border-t border-slate-200/70 p-0 pt-3">
            {instances.map((instance, index) => {
              const canCancelInstance =
                props.isOwner &&
                !instance.cancelAtPeriodEnd &&
                instance.status !== 'cancel_at_period_end' &&
                !isAddonPaymentIssueStatus(instance.status);
              const instanceStatus =
                instance.status === 'cancel_at_period_end' || instance.cancelAtPeriodEnd
                  ? 'cancel_at_period_end'
                  : instance.status;
              const instanceHasPaymentIssue = isAddonPaymentIssueStatus(instanceStatus);
              const instanceInterval = instance.billingInterval ?? 'monthly';
              const canSwitchInstanceInterval =
                props.isOwner &&
                isActiveAddonStatus(instanceStatus) &&
                !instance.cancelAtPeriodEnd &&
                !instance.scheduledIntervalChange;

              return (
                <li
                  key={instance.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200/60 bg-slate-100/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="m-0 text-xs font-medium text-slate-800">
                      {formatExtraAiAgentInstanceLabel(index)}
                    </p>
                    {instanceHasPaymentIssue ? (
                      <AddonPaymentIssueActions
                        workspaceId={props.workspaceId}
                        showManageInLemon={props.showManageInLemon}
                      />
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          {isActiveAddonStatus(instanceStatus) ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                          ) : null}
                          {formatExtraBotInstanceRenewalLine(instance)}
                        </span>
                        {isActiveAddonStatus(instanceStatus) ? (
                          <AddonBillingIntervalLine
                            scheduledChange={instance.scheduledIntervalChange}
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                  <AddonActionGroup>
                    {canSwitchInstanceInterval ? (
                      <AddonSwitchIntervalButton
                        label={`Switch to ${formatBillingIntervalLabel(oppositeBillingInterval(instanceInterval)).toLowerCase()}`}
                        disabled={props.intervalActionsBusy}
                        onClick={() =>
                          props.onSwitchInstanceInterval(
                            instance,
                            index,
                            oppositeBillingInterval(instanceInterval),
                          )
                        }
                      />
                    ) : null}
                    {canCancelInstance ? (
                      <AddonCancelButton
                        disabled={props.actionsBusy}
                        onClick={() => props.onCancelInstance(instance, index)}
                      />
                    ) : null}
                  </AddonActionGroup>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </AddonCard>
  );
}

type AddonRowProps = {
  addon: WorkspaceBillingAddonCatalogCard;
  billingPeriod: PlanBillingPeriod;
  topUps: WorkspaceBillingSummary['topUps'];
  topUpCreditsRemaining: number;
  isOwner: boolean;
  addonsAllowed: boolean;
  onFreePlan: boolean;
  checkoutLoading: boolean;
  actionsBusy: boolean;
  intervalActionsBusy: boolean;
  workspaceId: string;
  showManageInLemon: boolean;
  onPurchase: () => void;
  onCancel: () => void;
  onSwitchInterval: (targetInterval: BillingInterval) => void;
  autoTopUpPromptEnabled?: boolean;
  autoTopUpPromptBusy?: boolean;
  canConfigureAutoTopUpPrompt?: boolean;
  onAutoTopUpPromptChange?: (next: boolean) => void;
  autoTopUp?: WorkspaceBillingAutoTopUpSummary;
  autoTopUpBusy?: boolean;
  canManageAutoTopUp?: boolean;
  onEnableAutoTopUp?: () => void;
  onDisableAutoTopUp?: () => void;
};

function AddonRow(props: AddonRowProps) {
  const { addon } = props;
  const title = formatAddonDisplayName(addon);
  const renewalLabel = formatAddonRenewalLabel(addon);
  const isTopUp = isTopUpAddonKey(addon.key);
  const description = isTopUp
    ? AI_CREDITS_TOP_UP_USAGE_ORDER_COPY
    : formatAddonDescription(addon);
  const topUpBalance = isTopUp
    ? resolveMergedTopUpBalance(props.topUps, props.topUpCreditsRemaining)
    : null;

  const isRecurring = isRecurringAddonCatalogCard(addon.billingInterval);
  const subscriptionInterval = addon.subscriptionBillingInterval ?? 'monthly';
  const canPurchase =
    props.isOwner &&
    props.addonsAllowed &&
    !props.onFreePlan &&
    isAddonCheckoutAvailableForPeriod(addon, props.billingPeriod) &&
    (addon.status === 'inactive' || isTopUp);
  const canCancel =
    props.isOwner &&
    isRecurring &&
    addon.key !== 'extra_bot' &&
    addon.status === 'active' &&
    !addon.cancelAtPeriodEnd;
  const canSwitchInterval =
    props.isOwner &&
    isRecurring &&
    addon.status === 'active' &&
    !addon.cancelAtPeriodEnd &&
    !addon.scheduledIntervalChange;
  const hasPaymentIssue = isAddonPaymentIssueStatus(addon.status);
  const added = isBillingAddonAdded({
    addonKey: addon.key,
    status: addon.status,
    hasTopUpBalance: Boolean(topUpBalance),
  });

  return (
    <AddonCard>
      <div className="flex flex-col gap-4">
        <AddonTitleRow
          title={title}
          priceDisplay={<AddonPriceDisplay addon={addon} billingPeriod={props.billingPeriod} />}
          icon={<BillingAddonIcon addonKey={addon.key} added={added} />}
          actions={
            <>
              {canPurchase ? (
                <AddonPurchaseButton
                  loading={props.checkoutLoading}
                  title={title}
                  onClick={props.onPurchase}
                />
              ) : null}
              {canSwitchInterval ? (
                <AddonSwitchIntervalButton
                  label={`Switch to ${formatBillingIntervalLabel(oppositeBillingInterval(subscriptionInterval)).toLowerCase()}`}
                  disabled={props.intervalActionsBusy}
                  onClick={() =>
                    props.onSwitchInterval(oppositeBillingInterval(subscriptionInterval))
                  }
                />
              ) : null}
              {canCancel ? (
                <AddonCancelButton disabled={props.actionsBusy} onClick={props.onCancel} />
              ) : null}
            </>
          }
        />
        <AddonOwnerNotice
          isOwner={props.isOwner}
          onFreePlan={props.onFreePlan}
          isTopUp={isTopUp}
        />

        <div className="flex flex-col gap-2">
          {!isTopUp ? (
            hasPaymentIssue ? (
              <AddonPaymentIssueActions
                workspaceId={props.workspaceId}
                showManageInLemon={props.showManageInLemon}
              />
            ) : (
              <AddonStatusIndicator status={addon.status ?? 'inactive'} />
            )
          ) : null}
          {!isTopUp && renewalLabel ? (
            <p className="m-0 text-xs text-slate-500">{renewalLabel}</p>
          ) : null}
          {!isTopUp && addon.status === 'active' && isRecurring ? (
            <AddonBillingIntervalLine scheduledChange={addon.scheduledIntervalChange} />
          ) : null}
          {topUpBalance ? (
            <TopUpCreditsBalance
              creditsRemaining={topUpBalance.creditsRemaining}
              creditsPurchased={topUpBalance.creditsPurchased}
            />
          ) : null}
          {isTopUp ? (
            <>
              <AutoTopUpControls
                autoTopUp={props.autoTopUp}
                canManage={Boolean(props.canManageAutoTopUp)}
                onFreePlan={props.onFreePlan}
                addonsAllowed={props.addonsAllowed}
                busy={Boolean(props.autoTopUpBusy)}
                onEnable={() => props.onEnableAutoTopUp?.()}
                onDisable={() => props.onDisableAutoTopUp?.()}
              />
              <CreditAutoTopUpToggle
                enabled={Boolean(props.autoTopUpPromptEnabled)}
                disabled={!props.canConfigureAutoTopUpPrompt}
                busy={Boolean(props.autoTopUpPromptBusy)}
                onChange={(next) => props.onAutoTopUpPromptChange?.(next)}
              />
            </>
          ) : null}
          <p className="m-0 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
    </AddonCard>
  );
}
