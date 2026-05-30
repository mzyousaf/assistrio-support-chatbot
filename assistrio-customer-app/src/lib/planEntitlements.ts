import type { CustomerWorkspaceSummary, WorkspaceBillingSummary } from '@/api/types';
import { formatUsagePeriodDate } from '@/pages/usage/usagePageFormat';

export const FREE_TRIAL_INVITE_UPGRADE_COPY = 'Upgrade to invite teammates.';
export const PAID_PLAN_AUTO_TRAIN_COPY = 'Auto-train is available on paid plans.';
export const PAID_PLAN_ADDON_COPY = 'Available on paid plans.';

export function workspaceMemberInvitesAllowed(
  workspace: Pick<CustomerWorkspaceSummary, 'memberInvitesAllowed' | 'planKey'> | null | undefined,
): boolean {
  if (workspace?.memberInvitesAllowed === false) return false;
  if (workspace?.memberInvitesAllowed === true) return true;
  return workspace?.planKey !== 'free';
}

export function workspaceAutoTrainAllowed(
  workspace: Pick<CustomerWorkspaceSummary, 'autoTrainAllowed' | 'planKey'> | null | undefined,
): boolean {
  if (workspace?.autoTrainAllowed === false) return false;
  if (workspace?.autoTrainAllowed === true) return true;
  return workspace?.planKey !== 'free';
}

export function formatCreditsIncludedLabel(summary: WorkspaceBillingSummary): string {
  if (summary.entitlements.isTrialPlan) {
    return `${summary.entitlements.monthlyAiCredits.toLocaleString()} trial AI credits`;
  }
  return `${summary.entitlements.monthlyAiCredits.toLocaleString()} / month`;
}

export function formatBillingPeriodHeading(summary: WorkspaceBillingSummary): string {
  if (summary.entitlements.isTrialPlan) {
    return `Trial ends ${formatUsagePeriodDate(summary.plan.currentPeriodEnd)}`;
  }
  return `Billing period: ${formatUsagePeriodDate(summary.plan.currentPeriodStart)} – ${formatUsagePeriodDate(summary.plan.currentPeriodEnd)}`;
}

export function formatBillingPeriodCompact(summary: WorkspaceBillingSummary): string {
  if (summary.entitlements.isTrialPlan) {
    return `Trial ends ${formatUsagePeriodDate(summary.plan.currentPeriodEnd)}`;
  }
  return `${formatUsagePeriodDate(summary.plan.currentPeriodStart)} – ${formatUsagePeriodDate(summary.plan.currentPeriodEnd)}`;
}

export function formatAiCreditsHelperText(summary: WorkspaceBillingSummary | null): string {
  if (summary?.entitlements.isTrialPlan) {
    return 'Trial credits do not renew. Upgrade for monthly AI credits.';
  }
  return 'AI credits reset each billing period.';
}

export function formatAiCreditsRingAriaLabel(summary: WorkspaceBillingSummary | null): string {
  if (summary?.entitlements.isTrialPlan) {
    return 'Trial AI credits used';
  }
  return 'AI credits used this billing period';
}

export function formatPlanDisplayName(planName: string, isTrialPlan?: boolean): string {
  const name = String(planName ?? '').trim() || 'Free';
  if (isTrialPlan && !name.toLowerCase().includes('trial')) {
    return 'Free trial';
  }
  return name;
}

export function mockTrialBillingEntitlements(
  overrides: Partial<import('@/api/types').WorkspaceBillingEntitlementsSummary> = {},
): import('@/api/types').WorkspaceBillingEntitlementsSummary {
  return {
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    maxKbStorageMbPerBot: 40,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    isTrialPlan: true,
    trialDays: 7,
    trialStartedAt: '2026-05-01T00:00:00.000Z',
    trialEndsAt: '2026-06-08T00:00:00.000Z',
    isTrialExpired: false,
    creditsRenewMonthly: false,
    autoTrainAllowed: false,
    addonsAllowed: false,
    memberInvitesAllowed: false,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
    ...overrides,
  };
}

export function mockTrialWorkspaceSummary(
  overrides: Partial<import('@/api/types').CustomerWorkspaceSummary> = {},
): import('@/api/types').CustomerWorkspaceSummary {
  return {
    id: 'ws-1',
    name: 'Acme',
    planKey: 'free',
    planName: 'Free',
    subscriptionStatus: 'trialing',
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    isTrialPlan: true,
    trialDays: 7,
    memberInvitesAllowed: false,
    autoTrainAllowed: false,
    addonsAllowed: false,
    creditsRenewMonthly: false,
    ...overrides,
  };
}
