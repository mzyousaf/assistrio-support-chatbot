import type { PlanKey } from '../entitlements/plan-catalog';
import type { WorkspaceAddonKey } from '../entitlements/addon-catalog';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';

export type WorkspaceBillingPlanSummary = {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  status: WorkspaceSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

export type WorkspaceBillingEntitlementsSummary = {
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  maxKbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
  showPoweredByAssistrio: boolean;
  canRemoveBranding: boolean;
  activeAddons: string[];
  topUpCreditsRemaining: number;
};

export type WorkspaceBillingBotUsageSummary = {
  current: number;
  limit: number;
};

export type WorkspaceBillingMemberUsageSummary = {
  current: number;
  pendingInvites: number;
  used: number;
  limit: number;
};

export type WorkspaceBillingAiCreditsUsageSummary = {
  periodStart: string;
  periodEnd: string;
  monthlyCredits: number;
  monthlyCreditsUsed: number;
  monthlyCreditsRemaining: number;
  topUpCreditsRemaining: number;
  totalCreditsAvailable: number;
  totalCreditsRemaining: number;
  isOverLimit: boolean;
  byBot: Array<{ botId: string; creditsUsed: number }>;
};

export type WorkspaceBillingTrainedKnowledgeBotUsage = {
  botId: string;
  botName: string;
  usedBytes: number;
  maxBytes: number;
  usedMb: number;
  maxMb: number;
  percentUsed: number;
};

export type WorkspaceBillingTrainedKnowledgeUsageSummary = {
  perBot: WorkspaceBillingTrainedKnowledgeBotUsage[];
  totalUsedBytes: number;
  note: string;
};

export type WorkspaceBillingUsageSummary = {
  bots: WorkspaceBillingBotUsageSummary;
  members: WorkspaceBillingMemberUsageSummary;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary;
  trainedKnowledge: WorkspaceBillingTrainedKnowledgeUsageSummary;
};

export type WorkspaceBillingPlanCatalogCard = {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  botLimit: number;
  memberLimit: number;
  monthlyAiCredits: number;
  kbStorageMbPerBot: number;
  analyticsHistoryDays: number | null;
  canExportReports: boolean;
};

export type WorkspaceBillingAddonCatalogCard = {
  key: WorkspaceAddonKey;
  name: string;
  billingInterval: 'one_time' | 'monthly';
  priceUsd: number;
  scope: 'workspace' | 'bot';
  checkoutAvailable: false;
};

/** GET /api/customer/workspaces/:workspaceId/billing/summary */
export type WorkspaceBillingSummary = {
  workspaceId: string;
  plan: WorkspaceBillingPlanSummary;
  entitlements: WorkspaceBillingEntitlementsSummary;
  usage: WorkspaceBillingUsageSummary;
  planCatalog: WorkspaceBillingPlanCatalogCard[];
  addonCatalog: WorkspaceBillingAddonCatalogCard[];
};

export type AdminWorkspaceBillingMetadata = {
  workspaceName: string;
  workspaceOwnerEmail: string | null;
  subscriptionId: string | null;
  subscriptionCreatedAt: string | null;
  subscriptionUpdatedAt: string | null;
  activeAddons: string[];
  topUpCreditsRemaining: number;
  usageLedgerCount: number | null;
};

/** GET /api/admin/workspaces/:workspaceId/billing/summary */
export type AdminWorkspaceBillingSummary = WorkspaceBillingSummary & {
  admin: AdminWorkspaceBillingMetadata;
};
