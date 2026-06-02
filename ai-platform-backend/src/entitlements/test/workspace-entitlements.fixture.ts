import { megabytesToBytes } from '../plan-catalog';
import type { WorkspaceEntitlements } from '../workspace-entitlements.types';

export function mockFreeWorkspaceEntitlements(
  overrides: Partial<WorkspaceEntitlements> = {},
): WorkspaceEntitlements {
  return {
    workspaceId: '507f1f77bcf86cd799439011',
    planKey: 'free',
    planName: 'Free',
    subscriptionStatus: 'free',
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    kbStorageBytesPerBot: megabytesToBytes(5),
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: megabytesToBytes(40),
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    isTrialPlan: true,
    trialDays: 7,
    trialStartedAt: null,
    trialEndsAt: null,
    isTrialExpired: false,
    creditsRenewMonthly: false,
    autoTrainAllowed: false,
    addonsAllowed: false,
    memberInvitesAllowed: false,
    sharePreviewAllowed: false,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
    kbStorageBonusMbByBotId: {},
    ...overrides,
  };
}

export function mockStarterWorkspaceEntitlements(
  overrides: Partial<WorkspaceEntitlements> = {},
): WorkspaceEntitlements {
  return mockFreeWorkspaceEntitlements({
    planKey: 'starter',
    planName: 'Starter',
    subscriptionStatus: 'active',
    memberLimit: 5,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    kbStorageBytesPerBot: megabytesToBytes(15),
    analyticsHistoryDays: null,
    canExportReports: true,
    isTrialPlan: false,
    trialDays: null,
    creditsRenewMonthly: true,
    autoTrainAllowed: true,
    addonsAllowed: true,
    memberInvitesAllowed: true,
    ...overrides,
  });
}

export function mockProWorkspaceEntitlements(
  overrides: Partial<WorkspaceEntitlements> = {},
): WorkspaceEntitlements {
  return mockFreeWorkspaceEntitlements({
    planKey: 'pro',
    planName: 'Pro',
    subscriptionStatus: 'active',
    memberLimit: 10,
    monthlyAiCredits: 2000,
    kbStorageMbPerBot: 30,
    kbStorageBytesPerBot: megabytesToBytes(30),
    analyticsHistoryDays: null,
    canExportReports: true,
    isTrialPlan: false,
    trialDays: null,
    creditsRenewMonthly: true,
    autoTrainAllowed: true,
    addonsAllowed: true,
    memberInvitesAllowed: true,
    ...overrides,
  });
}
