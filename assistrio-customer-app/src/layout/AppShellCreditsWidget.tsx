import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, Coins } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { WorkspaceBillingSummary, WorkspaceBillingTopUpRow } from '@/api/types';
import type { WorkspaceBillingLoadState } from '@/hooks/useWorkspaceBillingSummary';
import {
  buildAppShellCreditsDisplay,
  buildAppShellPlanFooterDisplay,
} from '@/layout/appShellCreditsDisplay';
import {
  type AppShellCreditsWidgetCollapseContext,
  useAppShellCreditsWidgetCollapsed,
} from '@/layout/appShellCreditsWidgetCollapse';
import type { WorkspaceBillingAiCreditsUsageSummary } from '@/api/types';
import {
  buildBillingUpgradeComparisonRowTooltip,
  type BillingUpgradeComparisonRow,
} from '@/pages/billing/billingUpgradeComparisonDisplay';
import { BillingPlanIcon } from '@/pages/billing/BillingPlanIcon';
import {
  BillingUpgradeButtonIcon,
  BillingUpgradeComparisonRowTooltipContent,
  BillingUpgradeSidebarHeader,
  buildBillingUpgradeButtonTooltip,
} from '@/pages/billing/BillingUpgradeComparisonCard';
import { Tooltip } from '@/components/ui';
import {
  AI_CREDITS_SIDEBAR_TOP_UP_TOOLTIP,
  formatAutoTopUpStatusLabel,
} from '@/lib/billingAddonCatalogDisplay';
import {
  formatTrialCreditsTotalLabel,
  formatTrialDaysRemaining,
} from '@/lib/trialUxDisplay';
import { hasPurchasedTopUpCredits } from '@/pages/usage/usagePageFormat';
import { cn } from '@/lib/utils';

export type AppShellCreditsWidgetProps = {
  activeWorkspaceId: string | null;
  loadState: WorkspaceBillingLoadState;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
  topUps?: WorkspaceBillingTopUpRow[];
  billingSummary?: WorkspaceBillingSummary | null;
  variant: 'peek' | 'card';
  collapseContext?: AppShellCreditsWidgetCollapseContext;
  onNavigatePlans?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function CreditsUpgradeLink(props: {
  className?: string;
  tooltip: string;
  label?: ReactNode;
  onNavigatePlans?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Tooltip content={props.tooltip} side="top" fullWidth panelClassName="max-w-[18rem] text-pretty">
      <NavLink
        to="/settings/billing"
        onClick={props.onNavigatePlans}
        className={props.className}
      >
        {props.label ?? (
          <>
            <BillingUpgradeButtonIcon size={11} />
            Upgrade
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}

function CreditsCompactUpgradeLabel(props: { planKey: string; planName: string }) {
  return (
    <>
      <span>Upgrade to</span>
      <BillingPlanIcon planKey={props.planKey} size={12} className="text-white" />
      <span className="truncate">{props.planName}</span>
    </>
  );
}

function CreditsHeading(props: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', props.className)}>
      <Coins size={13} strokeWidth={1.75} className="shrink-0 text-teal-600" aria-hidden />
      <p className="m-0 text-xs font-semibold text-slate-600">AI credits</p>
    </div>
  );
}

const CREDITS_WIDGET_COLLAPSE_MS = 280;
const CREDITS_WIDGET_COLLAPSE_TRANSITION =
  'transition-[grid-template-rows] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';
const CREDITS_WIDGET_HEADER_TRANSITION =
  'transition-[max-width,opacity,transform] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';

function useCollapsiblePanelMount(
  isOpen: boolean,
  options?: { durationMs?: number; openDelayMs?: number },
) {
  const durationMs = options?.durationMs ?? CREDITS_WIDGET_COLLAPSE_MS;
  const openDelayMs = options?.openDelayMs ?? 0;
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      const mountTimeout = window.setTimeout(() => {
        setMounted(true);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setVisible(true));
        });
      }, openDelayMs);
      return () => window.clearTimeout(mountTimeout);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, isOpen, openDelayMs]);

  return { mounted, visible };
}

function CreditsCollapsibleSection(props: {
  open: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  return (
    <div
      id={props.id}
      aria-hidden={!props.open}
      className={cn(
        CREDITS_WIDGET_COLLAPSE_TRANSITION,
        'grid',
        props.open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        props.className,
      )}
    >
      <div className={cn('min-h-0 overflow-hidden', props.contentClassName)}>{props.children}</div>
    </div>
  );
}

function CreditsWidgetToggleHeader(props: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md border-none bg-transparent p-0 text-left cursor-pointer"
      onClick={props.onToggle}
      aria-expanded={!props.collapsed}
      aria-controls="app-shell-credits-widget-body"
    >
      <CreditsHeading className="min-w-0 flex-1" />
      <ChevronDown
        size={14}
        strokeWidth={2}
        className={cn(
          'shrink-0 text-slate-400',
          CREDITS_WIDGET_HEADER_TRANSITION,
          !props.collapsed && 'rotate-180',
        )}
        aria-hidden
      />
    </button>
  );
}

function CreditsCollapsedCreditsSummary(props: {
  activeWorkspaceId: string | null;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
  topUps?: WorkspaceBillingTopUpRow[];
  isTrialPlan?: boolean;
}) {
  if (!props.activeWorkspaceId) return null;

  const display = buildAppShellCreditsDisplay(props.aiCredits, props.topUps);
  if (!display) return null;

  const showTopUpOnly = display.monthlyRemaining <= 0 && display.showTopUpBar;

  if (showTopUpOnly) {
    return (
      <CreditsBarRow
        label="Top-up credits"
        valueLabel={display.topUpValueLabel}
        percent={display.topUpPercent}
        ariaLabel="Top-up credits used"
        tooltip={AI_CREDITS_SIDEBAR_TOP_UP_TOOLTIP}
      />
    );
  }

  return (
    <CreditsBarRow
      label={props.isTrialPlan ? 'Trial AI credits' : 'Monthly AI credits'}
      valueLabel={display.monthlyValueLabel}
      percent={display.monthlyPercent}
      isOverLimit={display.isOverLimit}
      ariaLabel={
        props.isTrialPlan
          ? 'Trial AI credits used'
          : 'Monthly AI credits used this billing period'
      }
      tooltip={display.monthlyTooltip}
    />
  );
}

function CreditsMeter(props: { percent: number; isOverLimit: boolean; ariaLabel: string }) {
  const barClass = props.isOverLimit
    ? 'bg-gradient-to-r from-red-500 to-red-600'
    : 'bg-gradient-to-r from-teal-400 to-teal-500';

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.percent}
      aria-label={props.ariaLabel}
    >
      <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${props.percent}%` }} />
    </div>
  );
}

function CreditsBarRow(props: {
  label: string;
  valueLabel: string;
  percent: number;
  isOverLimit?: boolean;
  ariaLabel: string;
  tooltip?: string;
}) {
  const content = (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">{props.label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-slate-500">{props.valueLabel}</span>
      </div>
      <CreditsMeter
        percent={props.percent}
        isOverLimit={props.isOverLimit ?? false}
        ariaLabel={props.ariaLabel}
      />
    </div>
  );

  if (!props.tooltip) return content;

  return (
    <Tooltip content={props.tooltip} side="top" fullWidth panelClassName="max-w-[18rem] text-pretty">
      <div className="cursor-default">{content}</div>
    </Tooltip>
  );
}

function CreditsBarsSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 2;
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-10 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-1.5 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function CreditsPlanFooterSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-8 w-full animate-pulse rounded-md bg-slate-100" />
    </div>
  );
}

function chunkComparisonRows<T>(items: readonly T[]): T[][] {
  const pairs: T[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    pairs.push(items.slice(index, index + 2));
  }
  return pairs;
}

function SidebarUpgradeComparisonCell(props: BillingUpgradeComparisonRow & { wide?: boolean }) {
  const tooltip = buildBillingUpgradeComparisonRowTooltip(props);
  const content = (
    <div className={cn('min-w-0 cursor-default', props.wide && 'pl-0.5')}>
      <p className="m-0 text-[10px] font-medium leading-none text-slate-400">{props.label}</p>
      <p className="m-0 mt-1 flex min-w-0 items-center gap-0.5 text-[10px] leading-none text-slate-500">
        <span className={cn('tabular-nums', props.wide ? 'shrink-0' : 'truncate')}>{props.fromValue}</span>
        <ArrowRight size={8} strokeWidth={2.5} className="shrink-0 text-teal-600/90" aria-hidden />
        <span
          className={cn(
            'font-semibold tabular-nums text-slate-800',
            props.wide ? 'min-w-0 truncate' : 'truncate',
          )}
        >
          {props.toValue}
        </span>
      </p>
    </div>
  );

  return (
    <Tooltip
      content={<BillingUpgradeComparisonRowTooltipContent {...tooltip} />}
      side="top"
      fullWidth
      panelClassName="max-w-[16rem] text-pretty"
    >
      {content}
    </Tooltip>
  );
}

function SidebarUpgradeComparison(props: { rows: readonly BillingUpgradeComparisonRow[] }) {
  if (!props.rows.length) return null;

  const rowPairs = chunkComparisonRows(props.rows);

  return (
    <div
      className="mb-2.5 space-y-2 rounded-md border border-slate-100 bg-slate-50/70 px-2 py-2"
      aria-label="Plan upgrade comparison"
    >
      {rowPairs.map((pair, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-2">
          {pair.map((row, columnIndex) => (
            <SidebarUpgradeComparisonCell
              key={row.label}
              {...row}
              wide={columnIndex === 1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CreditsTrialFooterMeta(props: { summary: WorkspaceBillingSummary }) {
  const periodEnd = props.summary.subscription?.currentPeriodEnd ?? props.summary.plan.currentPeriodEnd;

  return (
    <div className="mb-2 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
      <p className="m-0 font-semibold text-slate-700">Free trial</p>
      <p className="m-0">{formatTrialDaysRemaining(periodEnd)}</p>
      <p className="m-0">{formatTrialCreditsTotalLabel(props.summary.entitlements.monthlyAiCredits)}</p>
      <p className="m-0">Trial credits do not renew</p>
    </div>
  );
}

function CreditsPlanFooter(props: {
  billingSummary: WorkspaceBillingSummary | null | undefined;
  loadState: WorkspaceBillingLoadState;
  variant: 'peek' | 'card';
  compact?: boolean;
  onNavigatePlans?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const display = buildAppShellPlanFooterDisplay(props.billingSummary);
  const isLoading = props.loadState === 'loading' && !display;

  if (isLoading) {
    if (props.variant === 'peek' || props.compact) return null;
    return (
      <div className="p-3 bg-white" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <CreditsPlanFooterSkeleton />
      </div>
    );
  }

  if (!display) return null;

  if (display.kind === 'upgrade') {
    const upgradeTooltip = buildBillingUpgradeButtonTooltip({
      planName: display.planName,
      price: display.price,
      action: 'navigate',
    });
    const upgradeButtonClassName = props.compact
      ? 'flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-1 text-[11px] font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]'
      : 'flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-1 text-[11px] font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]';

    if (props.variant === 'peek' || props.compact) {
      return (
        <CreditsUpgradeLink
          tooltip={upgradeTooltip}
          onNavigatePlans={props.onNavigatePlans}
          className={
            props.compact
              ? upgradeButtonClassName
              : 'mt-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]'
          }
          label={
            props.compact ? (
              <CreditsCompactUpgradeLabel
                planKey={display.toPlanKey}
                planName={display.planName}
              />
            ) : undefined
          }
        />
      );
    }

    return (
      <div className="p-3 bg-white" style={{ borderTop: '1px solid var(--border-soft)' }}>
        {props.billingSummary?.entitlements.isTrialPlan ? (
          <CreditsTrialFooterMeta summary={props.billingSummary} />
        ) : null}
        <BillingUpgradeSidebarHeader
          fromPlanKey={display.fromPlanKey}
          toPlanKey={display.toPlanKey}
        />
        <SidebarUpgradeComparison rows={display.comparisonRows} />
        <CreditsUpgradeLink
          tooltip={upgradeTooltip}
          onNavigatePlans={props.onNavigatePlans}
          className={upgradeButtonClassName}
        />
      </div>
    );
  }

  if (display.kind === 'current') {
    if (props.compact) {
      return (
        <div className="mt-2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <BillingPlanIcon planKey={display.planKey} size={12} />
            <span className="text-[11px] font-semibold text-slate-600">{display.planName} plan</span>
          </div>
          {display.isHighestPlan ? (
            <p className="m-0 mt-0.5 text-[10px] font-medium text-slate-400">Highest plan</p>
          ) : (
            <p className="m-0 mt-0.5 text-[10px] text-slate-400">{display.price}</p>
          )}
        </div>
      );
    }

    if (props.variant === 'peek') {
      return (
        <NavLink
          to="/settings/billing"
          onClick={props.onNavigatePlans}
          className="mt-2.5 block text-center text-xs font-medium text-slate-500 no-underline transition-colors hover:text-teal-700"
        >
          {display.isHighestPlan ? `${display.planName} plan · Highest plan` : `${display.planName} plan`}
        </NavLink>
      );
    }

    return (
      <div className="p-3 bg-white" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Current plan
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <BillingPlanIcon planKey={display.planKey} size={14} />
          <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{display.planName}</span>
          <span className="shrink-0 text-xs text-slate-400">{display.price}</span>
        </div>
        {display.isHighestPlan ? (
          <p className="mb-0 mt-1 text-[11px] font-medium text-teal-700">Highest plan</p>
        ) : null}
        <p className="mb-0 mt-2 text-xs leading-relaxed text-slate-400">{display.renewalLine}</p>
      </div>
    );
  }

  return null;
}

function CreditsAutoTopUpStatus(props: {
  autoTopUp: WorkspaceBillingSummary['autoTopUp'];
}) {
  const status = props.autoTopUp?.status;
  if (!status || status === 'off') return null;

  const toneClass =
    status === 'payment_issue'
      ? 'text-red-700'
      : status === 'active'
        ? 'text-teal-700'
        : 'text-slate-600';

  return (
    <p className={cn('m-0 text-[11px] font-medium', toneClass)}>
      Auto top-up: {formatAutoTopUpStatusLabel(status)}
    </p>
  );
}

function CreditsBody(props: {
  activeWorkspaceId: string | null;
  loadState: WorkspaceBillingLoadState;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
  topUps?: WorkspaceBillingTopUpRow[];
  autoTopUp?: WorkspaceBillingSummary['autoTopUp'];
  footer?: ReactNode;
  showHeading?: boolean;
}) {
  const showHeading = props.showHeading ?? true;
  const display = buildAppShellCreditsDisplay(props.aiCredits, props.topUps);
  const showTopUpSkeleton =
    display?.showTopUpBar ??
    hasPurchasedTopUpCredits(props.aiCredits?.topUpCreditsRemaining, props.topUps);

  if (!props.activeWorkspaceId) {
    return (
      <div className="space-y-2">
        <p className="m-0 text-xs text-slate-500">No workspace</p>
        {props.footer}
      </div>
    );
  }

  if (props.loadState === 'loading' && !display) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading credits">
        {showHeading ? <CreditsHeading className="mb-3" /> : null}
        <CreditsBarsSkeleton rows={showTopUpSkeleton ? 2 : 1} />
        {props.footer}
      </div>
    );
  }

  if (props.loadState === 'error' || !display) {
    return (
      <div className="space-y-2">
        {showHeading ? <CreditsHeading className="mb-3" /> : null}
        <p className="m-0 text-xs text-slate-500">Usage unavailable</p>
        {props.footer}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeading ? <CreditsHeading className="mb-3" /> : null}
      <div className="space-y-2.5">
        <CreditsBarRow
          label="Monthly AI credits"
          valueLabel={display.monthlyValueLabel}
          percent={display.monthlyPercent}
          isOverLimit={display.isOverLimit}
          ariaLabel="Monthly AI credits used this billing period"
          tooltip={display.monthlyTooltip}
        />
        {display.showTopUpBar ? (
          <CreditsBarRow
            label="Top-up credits"
            valueLabel={display.topUpValueLabel}
            percent={display.topUpPercent}
            ariaLabel="Top-up credits used"
            tooltip={AI_CREDITS_SIDEBAR_TOP_UP_TOOLTIP}
          />
        ) : null}
      </div>
      <CreditsAutoTopUpStatus autoTopUp={props.autoTopUp} />
      {display.isOverLimit ? (
        <p className="m-0 text-[11px] font-medium text-red-700">Over monthly limit</p>
      ) : null}
      {props.footer}
    </div>
  );
}

export function AppShellCreditsWidget(props: AppShellCreditsWidgetProps) {
  const collapseContext = props.collapseContext ?? 'primary';
  const { collapsed, toggleCollapsed } = useAppShellCreditsWidgetCollapsed(collapseContext);
  const isCollapsibleCard = props.variant === 'card' && Boolean(props.activeWorkspaceId);
  const prevCollapsedRef = useRef(collapsed);
  const expandingNow = prevCollapsedRef.current && !collapsed;
  const collapsingNow = !prevCollapsedRef.current && collapsed;

  useEffect(() => {
    prevCollapsedRef.current = collapsed;
  }, [collapsed]);

  const expandedPanel = useCollapsiblePanelMount(isCollapsibleCard && !collapsed, {
    openDelayMs: expandingNow ? CREDITS_WIDGET_COLLAPSE_MS : 0,
  });
  const collapsedPanel = useCollapsiblePanelMount(isCollapsibleCard && collapsed, {
    openDelayMs: collapsingNow ? CREDITS_WIDGET_COLLAPSE_MS : 0,
  });

  if (props.variant === 'peek') {
    if (!props.activeWorkspaceId) return null;

    return (
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <CreditsBody
          activeWorkspaceId={props.activeWorkspaceId}
          loadState={props.loadState}
          aiCredits={props.aiCredits}
          topUps={props.topUps}
          autoTopUp={props.billingSummary?.autoTopUp}
          footer={
            <CreditsPlanFooter
              billingSummary={props.billingSummary}
              loadState={props.loadState}
              variant="peek"
              onNavigatePlans={props.onNavigatePlans}
            />
          }
        />
      </div>
    );
  }

  if (!props.activeWorkspaceId) return null;

  return (
    <div
      className="mb-3 overflow-hidden rounded-xl shadow-[var(--shadow-card)]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
    >
      <div className="p-3 pb-0">
        <CreditsWidgetToggleHeader collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>
      {expandedPanel.mounted ? (
        <CreditsCollapsibleSection
          id="app-shell-credits-widget-body"
          open={expandedPanel.visible}
        >
          <div>
            <div className="px-3 pb-3 pt-3">
              <CreditsBody
                activeWorkspaceId={props.activeWorkspaceId}
                loadState={props.loadState}
                aiCredits={props.aiCredits}
                topUps={props.topUps}
                autoTopUp={props.billingSummary?.autoTopUp}
                showHeading={false}
              />
            </div>
            <CreditsPlanFooter
              billingSummary={props.billingSummary}
              loadState={props.loadState}
              variant="card"
              onNavigatePlans={props.onNavigatePlans}
            />
          </div>
        </CreditsCollapsibleSection>
      ) : null}
      {collapsedPanel.mounted ? (
        <CreditsCollapsibleSection open={collapsedPanel.visible} contentClassName="px-3 pb-3 pt-2">
          <div>
            <CreditsCollapsedCreditsSummary
              activeWorkspaceId={props.activeWorkspaceId}
              aiCredits={props.aiCredits}
              topUps={props.topUps}
              isTrialPlan={props.billingSummary?.entitlements.isTrialPlan}
            />
            <div className="mt-2">
              <CreditsPlanFooter
                billingSummary={props.billingSummary}
                loadState={props.loadState}
                variant="card"
                compact
                onNavigatePlans={props.onNavigatePlans}
              />
            </div>
          </div>
        </CreditsCollapsibleSection>
      ) : null}
    </div>
  );
}
