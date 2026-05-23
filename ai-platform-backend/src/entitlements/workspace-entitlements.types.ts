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
  /** Deferred until remove_branding add-on is enforced. */
  canRemoveBranding: boolean;
  /** Deferred until add-on purchases exist. */
  activeAddons: string[];
  /** Deferred until credit top-ups exist. */
  topUpCreditsRemaining: number;
};
