import { ArrowRight, Zap } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { BillingPlanIcon } from '@/pages/billing/BillingPlanIcon';
import {
  buildBillingUpgradeComparisonRowTooltip,
  formatBillingUpgradeComparisonHeading,
  type BillingUpgradeComparisonRow,
  type BillingUpgradeComparisonRowTooltip,
} from '@/pages/billing/billingUpgradeComparisonDisplay';
import { cn } from '@/lib/utils';

export const billingUpgradeButtonIconClassName = 'fill-white text-white';

export function buildBillingUpgradeButtonTooltip(input: {
  planName: string;
  price?: string;
  action?: 'checkout' | 'navigate' | 'change-plan';
}): string {
  const priceSuffix = input.price?.trim() ? ` (${input.price.trim()})` : '';

  if (input.action === 'navigate') {
    return `Go to Billing & Plans to upgrade to ${input.planName}${priceSuffix}.`;
  }

  if (input.action === 'change-plan') {
    return `Upgrade to ${input.planName} immediately${priceSuffix}. Lemon Squeezy will calculate any prorated charge.`;
  }

  return `Start checkout to upgrade to ${input.planName}${priceSuffix}.`;
}

export function BillingUpgradeButtonIcon(props: { size?: number; className?: string }) {
  return (
    <Zap
      size={props.size ?? 12}
      className={cn('shrink-0', billingUpgradeButtonIconClassName, props.className)}
      aria-hidden
    />
  );
}

export function BillingUpgradePlanRouteTitle(props: {
  fromPlanKey: string;
  toPlanKey: string;
  iconSize?: number;
  arrowSize?: number;
}) {
  const iconSize = props.iconSize ?? 12;
  const arrowSize = props.arrowSize ?? 12;
  const [fromPlan, toPlan] = formatBillingUpgradeComparisonHeading(
    props.fromPlanKey,
    props.toPlanKey,
  ).split(' → ');

  return (
    <span className="inline-flex flex-nowrap items-center gap-1">
      <BillingPlanIcon planKey={props.fromPlanKey} size={iconSize} />
      <span>{fromPlan}</span>
      <ArrowRight
        size={arrowSize}
        strokeWidth={2.25}
        className="shrink-0 text-teal-600"
        aria-hidden
      />
      <BillingPlanIcon planKey={props.toPlanKey} size={iconSize} />
      <span>{toPlan}</span>
    </span>
  );
}

export function BillingUpgradeSidebarHeader(props: { fromPlanKey: string; toPlanKey: string }) {
  return (
    <div className="mb-2 flex flex-col gap-1">
      <p className="m-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Upgrade Available
      </p>
      <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <BillingUpgradePlanRouteTitle
          fromPlanKey={props.fromPlanKey}
          toPlanKey={props.toPlanKey}
          iconSize={10}
          arrowSize={10}
        />
      </p>
    </div>
  );
}

export function BillingUpgradePanelHeader(props: { fromPlanKey: string; toPlanKey: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Upgrade Available
      </span>
      <span
        className="hidden h-3 w-px shrink-0 bg-slate-200/90 sm:inline-block"
        aria-hidden
      />
      <span className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <BillingUpgradePlanRouteTitle
          fromPlanKey={props.fromPlanKey}
          toPlanKey={props.toPlanKey}
        />
      </span>
    </span>
  );
}

export function BillingUpgradeComparisonRowTooltipContent(
  props: BillingUpgradeComparisonRowTooltip,
) {
  return (
    <div className="space-y-1.5">
      <p className="m-0 font-medium text-white">{props.label}</p>
      <p className="m-0 flex items-center gap-1 tabular-nums">
        <span className="text-slate-300">{props.fromValue}</span>
        <ArrowRight size={10} strokeWidth={2.5} className="shrink-0 text-teal-300" aria-hidden />
        <span className="font-semibold text-white">{props.toValue}</span>
      </p>
      <p className="m-0 text-slate-300">{props.description}</p>
    </div>
  );
}

function UpgradeComparisonRow(props: BillingUpgradeComparisonRow) {
  const tooltip = buildBillingUpgradeComparisonRowTooltip(props);

  return (
    <Tooltip
      content={<BillingUpgradeComparisonRowTooltipContent {...tooltip} />}
      side="top"
      fullWidth
      panelClassName="max-w-[16rem] text-pretty"
    >
      <p className="m-0 flex min-w-0 cursor-default flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-snug text-slate-500">
        <span className="whitespace-nowrap">
          {props.label} {props.fromValue}
        </span>
        <ArrowRight
          size={12}
          strokeWidth={2.25}
          className="shrink-0 text-teal-600"
          aria-hidden
        />
        <span className="whitespace-nowrap font-semibold text-slate-900">{props.toValue}</span>
      </p>
    </Tooltip>
  );
}

export function BillingUpgradeComparisonCard(props: {
  rows: readonly BillingUpgradeComparisonRow[];
}) {
  return (
    <div className="rounded-lg border border-slate-200/60 bg-slate-100/70 px-3 py-2.5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {props.rows.map((row) => (
          <UpgradeComparisonRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}
