import type { AdminWorkspaceBillingSummary, AdminBillingWebhookEventRow } from './workspace-billing-summary.types';
import type { WorkspaceUsageAnalyticsResponse } from './workspace-usage-analytics.types';

export type AdminWorkspaceSupportWorkspace = {
  id: string;
  name: string;
  onboardingStatus: string | null;
  createdAt: string | null;
};

export type AdminWorkspaceSupportOwner = {
  userId: string;
  name: string;
  email: string | null;
};

export type AdminWorkspaceSupportAgent = {
  id: string;
  name: string;
  status: string;
  visibility: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isOverLimitLocked: boolean;
  lockedReason: string | null;
  sharePreviewEnabled: boolean;
  sharePreviewStatus: string | null;
  kbUsedMb: number | null;
  kbMaxMb: number | null;
  conversationCount: number | null;
  creditsUsedThisPeriod: number;
};

export type AdminWorkspaceSupportMember = {
  userId: string;
  email: string;
  name: string;
  role: string;
  membershipStatus: string;
  joinedAt: string | null;
};

export type AdminWorkspaceSupportInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string | null;
  expiresAt: string | null;
};

export type AdminWorkspaceSupportKnowledgeAgent = {
  botId: string;
  botName: string;
  usedMb: number;
  maxMb: number;
  percentUsed: number;
};

export type AdminWorkspaceSupportConversation = {
  id: string;
  botId: string;
  botName: string;
  startedFrom: string | null;
  messageCount: number | null;
  creditsUsed: number | null;
  lastActivityAt: string | null;
  leadCaptured: boolean;
  country: string | null;
  device: string | null;
};

export type AdminWorkspaceSupportWebhookHealth = {
  failedCount: number;
  recentFailureCount: number;
  lastProcessedAt: string | null;
};

/** GET /api/admin/workspaces/:workspaceId/support-summary */
export type AdminWorkspaceSupportSummary = {
  workspace: AdminWorkspaceSupportWorkspace;
  owner: AdminWorkspaceSupportOwner | null;
  subscription: AdminWorkspaceBillingSummary['subscription'];
  entitlements: AdminWorkspaceBillingSummary['entitlements'];
  usage: AdminWorkspaceBillingSummary['usage'] & {
    lockedAgentsCount: number;
    inactiveMembersCount: number;
  };
  agents: AdminWorkspaceSupportAgent[];
  members: AdminWorkspaceSupportMember[];
  invites: AdminWorkspaceSupportInvite[];
  knowledge: AdminWorkspaceSupportKnowledgeAgent[];
  conversations: AdminWorkspaceSupportConversation[];
  billing: AdminWorkspaceBillingSummary;
  webhookHealth: AdminWorkspaceSupportWebhookHealth;
  recentEvents: AdminBillingWebhookEventRow[];
};

export type AdminWorkspaceSupportUsageAnalytics = WorkspaceUsageAnalyticsResponse;
