import type { PlanKey } from '../entitlements/plan-catalog';
import type { WorkspaceAddonKey } from '../entitlements/addon-catalog';
import type { BillingProvider } from '../billing/billing-provider.types';
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
  isTrialPlan: boolean;
  trialDays: number | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  isTrialExpired: boolean;
  creditsRenewMonthly: boolean;
  autoTrainAllowed: boolean;
  addonsAllowed: boolean;
  memberInvitesAllowed: boolean;
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
  isOverMemberLimit: boolean;
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
  checkoutAvailable: boolean;
};

export type WorkspaceBillingAddonCatalogCard = {
  key: WorkspaceAddonKey;
  name: string;
  billingInterval: 'one_time' | 'monthly';
  priceUsd: number;
  scope: 'workspace' | 'bot';
  checkoutAvailable: boolean;
  description?: string;
  active?: boolean;
  status?: 'active' | 'inactive' | 'cancel_at_period_end' | 'expired' | 'cancelled';
  targetBotId?: string | null;
  targetBotName?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  effectLabel?: string | null;
};

export type WorkspaceBillingTopUpRow = {
  creditsPurchased: number;
  creditsRemaining: number;
  expiresAt: string;
  createdAt: string;
  amountFormatted?: string | null;
  receiptUrl?: string | null;
};

export type WorkspaceBillingPaymentMethodSummary = {
  brand?: string;
  last4?: string;
  label?: string;
};

export type WorkspaceBillingActiveAddonRow = {
  addonKey: string;
  name: string;
  status: string;
  targetBotId: string | null;
  targetBotName: string | null;
  billingInterval?: 'one_time' | 'monthly';
  priceUsd?: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  effectLabel?: string | null;
};

/** Customer-safe subscription / provider flags (no API secrets or raw provider IDs). */
export type WorkspaceBillingSubscriptionSummary = {
  provider: BillingProvider | null;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  hasActivePaidSubscription: boolean;
  hasPaymentIssue: boolean;
  paymentMethod: WorkspaceBillingPaymentMethodSummary | null;
  customerPortalAvailable: boolean;
  manageBillingAvailable: boolean;
};

export type WorkspaceBillingInvoiceRow = {
  id: string;
  provider: BillingProvider;
  date: string;
  amount: number;
  amountCents: number;
  amountFormatted: string;
  currency: string;
  status: string;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  description: string;
  itemType?: 'plan' | 'addon' | 'top_up' | 'unknown';
  itemKey?: string;
  itemName?: string;
  billingReason?: string;
  providerSubscriptionId?: string | null;
  providerVariantId?: string | null;
  providerOrderId?: string | null;
  source?: 'lemon_subscription_invoice' | 'lemon_order' | 'local_top_up';
};

/** GET /api/customer/workspaces/:workspaceId/billing/summary */
export type WorkspaceBillingSummary = {
  workspaceId: string;
  plan: WorkspaceBillingPlanSummary;
  subscription: WorkspaceBillingSubscriptionSummary;
  entitlements: WorkspaceBillingEntitlementsSummary;
  usage: WorkspaceBillingUsageSummary;
  planCatalog: WorkspaceBillingPlanCatalogCard[];
  addonCatalog: WorkspaceBillingAddonCatalogCard[];
  activeAddons: WorkspaceBillingActiveAddonRow[];
  topUps: WorkspaceBillingTopUpRow[];
};

export type AdminWorkspaceBillingMetadata = {
  workspaceName: string;
  workspaceOwnerEmail: string | null;
  subscriptionId: string | null;
  subscriptionCreatedAt: string | null;
  subscriptionUpdatedAt: string | null;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  activeAddons: string[];
  topUpCreditsRemaining: number;
  usageLedgerCount: number | null;
};

export type AdminBillingProviderDetails = {
  provider: BillingProvider | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  providerVariantId: string | null;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

export type AdminBillingAddonRow = {
  addonKey: string;
  targetBotId: string | null;
  status: string;
  providerSubscriptionId: string | null;
  providerOrderId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export type AdminBillingTopUpRow = {
  creditsPurchased: number;
  creditsRemaining: number;
  expiresAt: string;
  providerOrderId: string;
  createdAt: string;
};

export type AdminBillingWebhookEventRow = {
  id: string;
  eventName: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  processingError: string | null;
};

export type AdminWorkspaceBillingSupport = {
  provider: AdminBillingProviderDetails;
  addons: AdminBillingAddonRow[];
  topUps: AdminBillingTopUpRow[];
  webhookEvents: AdminBillingWebhookEventRow[];
};

/** GET /api/admin/workspaces/:workspaceId/billing/summary */
export type AdminWorkspaceBillingSummary = WorkspaceBillingSummary & {
  admin: AdminWorkspaceBillingMetadata;
  support: AdminWorkspaceBillingSupport;
};
