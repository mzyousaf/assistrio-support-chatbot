import { PLAN_CATALOG, type PlanDefinition, type PlanKey } from '../entitlements/plan-catalog';
import { WORKSPACE_ADDON_CATALOG, type WorkspaceAddonKey } from '../entitlements/addon-catalog';
import type { WorkspaceEntitlements } from '../entitlements/workspace-entitlements.types';
import type { WorkspaceAiCreditsUsageSummary } from '../entitlements/workspace-ai-credits-usage.types';
import type { WorkspaceMemberUsage } from '../entitlements/workspace-member-limit.service';
import type { PlanLimitWorkspaceBotsUsage } from '../entitlements/workspace-bot-limit.service';
import type { KnowledgeUsageBreakdown } from '../knowledge/knowledge-usage.util';
import type {
  WorkspaceBillingAddonCatalogCard,
  WorkspaceBillingAiCreditsUsageSummary,
  WorkspaceBillingEntitlementsSummary,
  WorkspaceBillingMemberUsageSummary,
  WorkspaceBillingPlanCatalogCard,
  WorkspaceBillingPlanSummary,
  WorkspaceBillingTrainedKnowledgeBotUsage,
  WorkspaceBillingTrainedKnowledgeUsageSummary,
} from './workspace-billing-summary.types';

export const TRAINED_KNOWLEDGE_USAGE_NOTE =
  'Trained knowledge storage counts extracted text your agent learns from, not original uploaded file size.';

export function bytesToMegabytes(bytes: number): number {
  if (!Number.isFinite(bytes)) return 0;
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

export function mapEntitlementsToBillingSummary(
  entitlements: WorkspaceEntitlements,
): WorkspaceBillingEntitlementsSummary {
  return {
    botLimit: entitlements.botLimit,
    memberLimit: entitlements.memberLimit,
    monthlyAiCredits: entitlements.monthlyAiCredits,
    kbStorageMbPerBot: entitlements.kbStorageMbPerBot,
    maxKbStorageMbPerBot: entitlements.maxKbStorageMbPerBot,
    analyticsHistoryDays: entitlements.analyticsHistoryDays,
    canExportReports: entitlements.canExportReports,
    showPoweredByAssistrio: entitlements.showPoweredByAssistrio,
    isTrialPlan: entitlements.isTrialPlan,
    trialDays: entitlements.trialDays,
    trialStartedAt: entitlements.trialStartedAt,
    trialEndsAt: entitlements.trialEndsAt,
    isTrialExpired: entitlements.isTrialExpired,
    creditsRenewMonthly: entitlements.creditsRenewMonthly,
    autoTrainAllowed: entitlements.autoTrainAllowed,
    addonsAllowed: entitlements.addonsAllowed,
    memberInvitesAllowed: entitlements.memberInvitesAllowed,
    canRemoveBranding: entitlements.canRemoveBranding,
    activeAddons: entitlements.activeAddons,
    topUpCreditsRemaining: entitlements.topUpCreditsRemaining,
  };
}

export function mapPlanSummary(input: {
  entitlements: WorkspaceEntitlements;
  priceMonthly: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}): WorkspaceBillingPlanSummary {
  return {
    key: input.entitlements.planKey,
    name: input.entitlements.planName,
    priceMonthly: input.priceMonthly,
    status: input.entitlements.subscriptionStatus,
    currentPeriodStart: input.currentPeriodStart.toISOString(),
    currentPeriodEnd: input.currentPeriodEnd.toISOString(),
  };
}

export function mapMemberUsageToBillingSummary(
  memberUsage: WorkspaceMemberUsage,
): WorkspaceBillingMemberUsageSummary {
  return {
    current: memberUsage.memberCount,
    pendingInvites: memberUsage.pendingInviteCount,
    used: memberUsage.current,
    limit: memberUsage.limit,
    isOverMemberLimit: memberUsage.isOverMemberLimit,
  };
}

export function mapAiCreditsUsageToBillingSummary(
  usage: WorkspaceAiCreditsUsageSummary,
): WorkspaceBillingAiCreditsUsageSummary {
  const totalCreditsRemaining = usage.monthlyCreditsRemaining + usage.topUpCreditsRemaining;
  return {
    periodStart: usage.billingPeriod.start,
    periodEnd: usage.billingPeriod.end,
    monthlyCredits: usage.monthlyAiCredits,
    monthlyCreditsUsed: usage.monthlyCreditsUsed,
    monthlyCreditsRemaining: usage.monthlyCreditsRemaining,
    topUpCreditsRemaining: usage.topUpCreditsRemaining,
    totalCreditsAvailable: usage.totalCreditsAvailable,
    totalCreditsRemaining,
    isOverLimit: usage.isOverLimit,
    byBot: usage.byBot,
  };
}

export function mapBotKnowledgeUsageRow(input: {
  botId: string;
  botName: string;
  usage: KnowledgeUsageBreakdown;
}): WorkspaceBillingTrainedKnowledgeBotUsage {
  const usedBytes = input.usage.totalBytes;
  const maxBytes =
    typeof input.usage.maxBytes === 'number' && Number.isFinite(input.usage.maxBytes) && input.usage.maxBytes > 0
      ? input.usage.maxBytes
      : 0;
  const percentRaw =
    typeof input.usage.percentUsed === 'number' && Number.isFinite(input.usage.percentUsed)
      ? input.usage.percentUsed
      : maxBytes > 0
        ? (usedBytes / maxBytes) * 100
        : 0;

  return {
    botId: input.botId,
    botName: input.botName,
    usedBytes,
    maxBytes,
    usedMb: bytesToMegabytes(usedBytes),
    maxMb: bytesToMegabytes(maxBytes),
    percentUsed: Math.round(percentRaw * 100) / 100,
  };
}

export function buildTrainedKnowledgeUsageSummary(
  perBot: WorkspaceBillingTrainedKnowledgeBotUsage[],
): WorkspaceBillingTrainedKnowledgeUsageSummary {
  return {
    perBot,
    totalUsedBytes: perBot.reduce((sum, row) => sum + row.usedBytes, 0),
    note: TRAINED_KNOWLEDGE_USAGE_NOTE,
  };
}

export function mapBotUsageToBillingSummary(
  botUsage: PlanLimitWorkspaceBotsUsage,
): { current: number; limit: number } {
  return {
    current: botUsage.current,
    limit: botUsage.limit,
  };
}

export function mapPlanDefinitionToCatalogCard(
  plan: PlanDefinition,
  checkoutAvailable: boolean,
): WorkspaceBillingPlanCatalogCard {
  return {
    key: plan.key,
    name: plan.name,
    priceMonthly: plan.priceMonthlyUsd,
    botLimit: plan.botLimit,
    memberLimit: plan.memberLimit,
    monthlyAiCredits: plan.monthlyAiCredits,
    kbStorageMbPerBot: plan.kbStorageMbPerBot,
    analyticsHistoryDays: plan.analyticsHistoryDays,
    canExportReports: plan.canExportReports,
    checkoutAvailable: checkoutAvailable && plan.key !== 'free',
  };
}

export function buildPublicPlanCatalogSnapshot(
  checkoutAvailableForPlan: (planKey: PlanKey) => boolean = () => false,
): WorkspaceBillingPlanCatalogCard[] {
  return PLAN_CATALOG.map((plan) =>
    mapPlanDefinitionToCatalogCard(
      plan,
      plan.key === 'free' ? false : checkoutAvailableForPlan(plan.key),
    ),
  );
}

export function buildPublicAddonCatalogSnapshot(
  checkoutAvailableForAddon: (addonKey: WorkspaceAddonKey) => boolean = () => false,
): WorkspaceBillingAddonCatalogCard[] {
  return WORKSPACE_ADDON_CATALOG.map((addon) => ({
    key: addon.key,
    name: addon.name,
    billingInterval: addon.billingInterval,
    priceUsd: addon.priceUsd,
    scope: addon.scope,
    checkoutAvailable: checkoutAvailableForAddon(addon.key),
  }));
}
