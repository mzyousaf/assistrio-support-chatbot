import type {
  WorkspaceBillingAiCreditsUsageSummary,
  WorkspaceBillingSummary,
  WorkspaceBillingTopUpRow,
} from '@/api/types';
import { buildAiCreditsSidebarMonthlyTooltip } from '@/lib/billingAddonCatalogDisplay';
import {
  buildCurrentPlanDisplay,
  buildCurrentPlanRenewalDisplay,
  resolveNextPlanPanel,
} from '@/pages/billing/billingSubscriptionOverviewDisplay';
import {
  buildBillingUpgradeComparison,
  type BillingUpgradeComparisonRow,
} from '@/pages/billing/billingUpgradeComparisonDisplay';
import {
  computeTopUpCreditsUsage,
  formatAiCreditsPercent,
  hasPurchasedTopUpCredits,
} from '@/pages/usage/usagePageFormat';

export type AppShellCreditsDisplay = {
  used: number;
  monthlyTotal: number;
  monthlyRemaining: number;
  monthlyPercent: number;
  monthlyTooltip: string;
  topUpRemaining: number;
  topUpUsed: number;
  topUpTotal: number;
  topUpPercent: number;
  showTopUpBar: boolean;
  totalRemaining: number;
  isOverLimit: boolean;
};

export type AppShellPlanFooterDisplay =
  | {
      kind: 'upgrade';
      fromPlanKey: string;
      toPlanKey: string;
      planName: string;
      price: string;
      comparisonRows: BillingUpgradeComparisonRow[];
    }
  | {
      kind: 'current';
      planKey: string;
      planName: string;
      price: string;
      renewalLine: string;
      isHighestPlan?: boolean;
    };

export function buildAppShellPlanFooterDisplay(
  summary: WorkspaceBillingSummary | null | undefined,
): AppShellPlanFooterDisplay | null {
  if (!summary) return null;

  const nextPlanPanel = resolveNextPlanPanel(summary);
  if (nextPlanPanel?.kind === 'upgrade') {
    const comparisonRows =
      buildBillingUpgradeComparison(summary, nextPlanPanel.upgrade.planKey) ?? [];

    return {
      kind: 'upgrade',
      fromPlanKey: summary.plan.key,
      toPlanKey: nextPlanPanel.upgrade.planKey,
      planName: nextPlanPanel.upgrade.planName,
      price: nextPlanPanel.upgrade.price,
      comparisonRows,
    };
  }

  const plan = buildCurrentPlanDisplay(summary);
  const renewal = buildCurrentPlanRenewalDisplay(summary);

  return {
    kind: 'current',
    planKey: summary.plan.key,
    planName: plan.name,
    price: plan.price,
    renewalLine: renewal.line,
    isHighestPlan: summary.plan.key === 'pro',
  };
}

export function buildAppShellCreditsDisplay(
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | null | undefined,
  topUps?: WorkspaceBillingTopUpRow[],
): AppShellCreditsDisplay | null {
  if (!aiCredits) return null;

  const used = Number.isFinite(aiCredits.monthlyCreditsUsed) ? aiCredits.monthlyCreditsUsed : 0;
  const monthlyTotal = Number.isFinite(aiCredits.monthlyCredits) ? aiCredits.monthlyCredits : 0;
  const monthlyRemaining = Number.isFinite(aiCredits.monthlyCreditsRemaining)
    ? aiCredits.monthlyCreditsRemaining
    : Math.max(0, monthlyTotal - used);
  const topUpRemaining = Number.isFinite(aiCredits.topUpCreditsRemaining)
    ? aiCredits.topUpCreditsRemaining
    : 0;
  const totalRemaining = Number.isFinite(aiCredits.totalCreditsRemaining)
    ? aiCredits.totalCreditsRemaining
    : monthlyRemaining + topUpRemaining;
  const monthlyPercent = formatAiCreditsPercent(used, monthlyTotal);
  const showTopUpBar = hasPurchasedTopUpCredits(topUpRemaining, topUps);
  const { used: topUpUsed, totalPurchased: topUpTotal } = computeTopUpCreditsUsage(
    topUpRemaining,
    topUps,
  );
  const topUpPercent = formatAiCreditsPercent(topUpUsed, topUpTotal);

  return {
    used,
    monthlyTotal,
    monthlyRemaining,
    monthlyPercent,
    monthlyTooltip: buildAiCreditsSidebarMonthlyTooltip(aiCredits.periodEnd),
    topUpRemaining,
    topUpUsed,
    topUpTotal,
    topUpPercent,
    showTopUpBar,
    totalRemaining,
    isOverLimit: Boolean(aiCredits.isOverLimit),
  };
}
