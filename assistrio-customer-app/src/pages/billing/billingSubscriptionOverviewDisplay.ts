import type { WorkspaceBillingPlanCatalogCard, WorkspaceBillingSummary } from '@/api/types';
import { formatPlanDisplayName } from '@/lib/planEntitlements';
import { resolveContextualUpgradePlans } from '@/lib/upgradePlanCatalog';
import { formatBillingSubscriptionStatusLabel } from '@/pages/billing/billingSubscriptionDisplay';
import type { BillingInterval } from '@/api/types';
import {
  formatBillingIntervalLabel,
  intervalToPlanBillingPeriod,
} from '@/lib/billingInterval.util';
import { formatPlanPriceMonthly } from '@/pages/billing/billingSummaryDisplay';
import {
  formatPlanOverviewPriceLine,
  planPricingCardWhySection,
} from '@/pages/billing/planPricingCardDisplay';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

const EXCLUDED_BILLING_UPGRADE_BULLETS = new Set(['Best for larger teams and higher traffic']);

export type ScheduledPlanChangeDisplay = {
  planKey: string;
  planName: string;
  effectiveDate: string | null;
};

export type UpgradePlanPanelDisplay = {
  planKey: string;
  planName: string;
  price: string;
};

export type NextPlanPanelDisplay =
  | { kind: 'scheduled'; scheduled: ScheduledPlanChangeDisplay }
  | { kind: 'upgrade'; upgrade: UpgradePlanPanelDisplay };

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Reads scheduled/next plan fields only when present on the billing summary response. */
export function resolveScheduledPlanChange(
  summary: WorkspaceBillingSummary,
): ScheduledPlanChangeDisplay | null {
  const sub = summary.subscription as typeof summary.subscription & Record<string, unknown>;
  const plan = summary.plan as typeof summary.plan & Record<string, unknown>;

  const planKey =
    readOptionalString(sub.scheduledPlanKey) ??
    readOptionalString(sub.nextPlanKey) ??
    readOptionalString(sub.pendingPlanKey) ??
    readOptionalString(plan.scheduledPlanKey) ??
    readOptionalString(plan.nextPlanKey) ??
    readOptionalString(plan.pendingPlanKey);

  if (!planKey) return null;

  const planName =
    readOptionalString(sub.scheduledPlanName) ??
    readOptionalString(sub.nextPlanName) ??
    readOptionalString(sub.pendingPlanName) ??
    readOptionalString(plan.scheduledPlanName) ??
    readOptionalString(plan.nextPlanName) ??
    readOptionalString(plan.pendingPlanName) ??
    formatPlanDisplayName(planKey, false);

  const effectiveRaw =
    readOptionalString(sub.scheduledPlanEffectiveDate) ??
    readOptionalString(sub.planChangeEffectiveDate) ??
    readOptionalString(sub.nextPlanEffectiveDate) ??
    readOptionalString(plan.scheduledPlanEffectiveDate) ??
    readOptionalString(plan.planChangeEffectiveDate) ??
    readOptionalString(plan.nextPlanEffectiveDate);

  return {
    planKey,
    planName,
    effectiveDate: effectiveRaw,
  };
}

/** Scheduled plan change takes priority; otherwise show the contextual upgrade target. */
export function resolveNextPlanPanel(summary: WorkspaceBillingSummary): NextPlanPanelDisplay | null {
  const scheduled = resolveScheduledPlanChange(summary);
  if (scheduled) {
    return { kind: 'scheduled', scheduled };
  }

  const upgradePlans = resolveContextualUpgradePlans(
    summary.planCatalog,
    summary.plan.key,
    summary.entitlements.isTrialPlan,
  );
  const upgradePlan = upgradePlans[0];
  if (!upgradePlan) return null;

  return {
    kind: 'upgrade',
    upgrade: {
      planKey: upgradePlan.key,
      planName: upgradePlan.name,
      price: formatPlanPriceMonthly(upgradePlan.priceMonthly),
    },
  };
}

/** Feature bullets for the billing upgrade panel (excludes marketing footnotes). */
export function buildBillingUpgradeBullets(
  planKey: string,
  catalog?: WorkspaceBillingPlanCatalogCard,
): readonly string[] {
  if (planKey === 'pro' && catalog) {
    return [
      'Higher limits',
      'Priority support',
      `${catalog.monthlyAiCredits.toLocaleString()} AI credits/month`,
      `${catalog.kbStorageMbPerBot} MB trained knowledge storage`,
      `${catalog.memberLimit} workspace members`,
    ];
  }

  return planPricingCardWhySection(planKey).bullets.filter(
    (bullet) => !EXCLUDED_BILLING_UPGRADE_BULLETS.has(bullet),
  );
}

export function formatPlanRenewalDate(summary: WorkspaceBillingSummary): string {
  const end = summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd;
  if (!end) return '—';
  return formatUsagePeriodDate(end);
}

export function formatScheduledPlanEffectiveDate(
  scheduled: ScheduledPlanChangeDisplay,
): string | null {
  if (!scheduled.effectiveDate) return null;
  return formatUsagePeriodDate(scheduled.effectiveDate);
}

export function formatScheduledBillingIntervalEffectiveDate(
  scheduled: ScheduledBillingIntervalChangeDisplay,
): string | null {
  if (!scheduled.effectiveDate) return null;
  return formatUsagePeriodDate(scheduled.effectiveDate);
}

export type ScheduledBillingIntervalChangeDisplay = {
  targetInterval: BillingInterval;
  effectiveDate: string | null;
};

export function resolveScheduledBillingIntervalChange(
  summary: WorkspaceBillingSummary,
): ScheduledBillingIntervalChangeDisplay | null {
  const sub = summary.subscription;

  if (sub.cancelAtPeriodEnd && sub.hasActivePaidSubscription) {
    return null;
  }

  if (String(sub.scheduledPlanKey ?? '').trim()) {
    return null;
  }

  const targetInterval = sub.scheduledBillingInterval;
  if (!targetInterval) return null;

  const effectiveRaw =
    sub.scheduledBillingIntervalEffectiveDate?.trim() ||
    sub.currentPeriodEnd ||
    summary.plan.currentPeriodEnd ||
    null;

  return {
    targetInterval,
    effectiveDate: effectiveRaw,
  };
}

export function buildCurrentPlanDisplay(summary: WorkspaceBillingSummary) {
  const { plan, entitlements, subscription } = summary;
  const catalogPlan = summary.planCatalog?.find((entry) => entry.key === plan.key);
  const billingPeriod = intervalToPlanBillingPeriod(subscription.billingInterval);
  return {
    name: formatPlanDisplayName(plan.name, entitlements.isTrialPlan),
    status: formatBillingSubscriptionStatusLabel(summary),
    price: formatPlanOverviewPriceLine(plan.priceMonthly, {
      planKey: plan.key,
      billingPeriod,
      pricing: catalogPlan,
    }),
    billingIntervalLabel: subscription.billingInterval
      ? formatBillingIntervalLabel(subscription.billingInterval)
      : null,
    renewsOn: formatPlanRenewalDate(summary),
    renewsLabel:
      summary.subscription.cancelAtPeriodEnd && summary.subscription.hasActivePaidSubscription
        ? 'Cancels on'
        : entitlements.isTrialPlan
          ? 'Trial ends'
          : 'Renews on',
  };
}

export function buildCurrentPlanContextLine(summary: WorkspaceBillingSummary): string {
  const { name } = buildCurrentPlanDisplay(summary);
  return `Your workspace is currently on ${name}.`;
}

export function resolveBillingPeriodEnd(summary: WorkspaceBillingSummary): string | null {
  return summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd ?? null;
}

export function formatBillingPeriodRemainingDaysLabel(
  periodEnd: string | null | undefined,
  now = new Date(),
): string | null {
  if (!periodEnd) return null;

  const end = new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return days === 1 ? '1 day remaining' : `${days} days remaining`;
}

export function formatCurrentPlanRenewalLine(
  plan: ReturnType<typeof buildCurrentPlanDisplay>,
): string {
  return `${plan.renewsLabel} ${plan.renewsOn}`
    .replace(/^Renews on /, 'Renews ')
    .replace(/^Cancels on /, 'Cancels ')
    .replace(/^Trial ends /, 'Trial ends ');
}

export function buildCurrentPlanRenewalDisplay(
  summary: WorkspaceBillingSummary,
  now = new Date(),
): { line: string; remainingLabel: string | null } {
  const plan = buildCurrentPlanDisplay(summary);
  return {
    line: formatCurrentPlanRenewalLine(plan),
    remainingLabel:
      plan.renewsOn === '—'
        ? null
        : formatBillingPeriodRemainingDaysLabel(resolveBillingPeriodEnd(summary), now),
  };
}
