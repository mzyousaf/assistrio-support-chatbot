import type { PlanKey } from './plan-catalog';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';

/** Effective workspace entitlements (read-only; no enforcement in Epic 2 Step 2). */
export type WorkspaceEntitlements = {
  workspaceId: string;
  planKey: PlanKey;
  planName: string;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  kbStorageBytesPerBot: number;
  maxKbStorageMbPerBot: number;
  maxKbStorageBytesPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
  isTrialPlan: boolean;
  trialDays: number | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  isTrialExpired: boolean;
  creditsRenewMonthly: boolean;
  autoTrainAllowed: boolean;
  addonsAllowed: boolean;
  memberInvitesAllowed: boolean;
  sharePreviewAllowed: boolean;
  canRemoveBranding: boolean;
  activeAddons: string[];
  topUpCreditsRemaining: number;
  /** Extra trained-KB MB from active per-bot storage add-ons (botId -> MB). */
  kbStorageBonusMbByBotId: Record<string, number>;
};
