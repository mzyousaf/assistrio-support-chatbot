/**
 * Response shapes for `GET /api/user/analytics/*` (authenticated operator dashboards only).
 * Do not use for PV UIs — see `ai-platform-backend/docs/ANALYTICS_BOUNDARIES.md`.
 */
export type InternalAnalyticsOverviewResponse = {
  schemaVersion: 1;
  range: {
    from: string;
    to: string;
    label: string;
  };
  overview: {
    totalVisitorEvents: number;
    trialBotsCreated: number;
    pageViews: number;
    ctaClicks: number;
    demoOpened: number;
    trialCreateStarted: number;
    trialCreateSucceeded: number;
  };
  messages: {
    showcaseRuntimeUserMessages: number;
    trialRuntimeUserMessages: number;
    totalMessages: number;
    totalConversations: number;
  };
  bots: {
    visitorOwnedBotsCreated: number;
    showcaseBotsActive: number;
  };
  leads: {
    conversationsWithCapturedLeads: number;
  };
  caveats: string[];
};

export type InternalAnalyticsDatePreset = "7d" | "30d" | "90d";

/** Shared `range` block from internal `/api/user/analytics/*` responses. */
export type InternalAnalyticsRangeBlock = {
  from: string;
  to: string;
  label: string;
};

/** GET /api/user/analytics/bots/summary */
export type InternalBotsSummaryResponse = {
  schemaVersion: 1;
  range: InternalAnalyticsRangeBlock;
  truncated: boolean;
  bots: Array<{
    botId: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    visibility: string;
    isPublic: boolean;
    shortDescription: string | null;
    category: string | null;
    leadCaptureEnabled: boolean;
    createdAt: string;
    messageCount: number;
    conversationCount: number;
    showcaseRuntimeUserMessages: number;
    trialRuntimeUserMessages: number;
    conversationsWithCapturedLeads: number;
  }>;
  caveats: string[];
};

/** GET /api/user/analytics/leads/summary */
export type InternalLeadsSummaryResponse = {
  schemaVersion: 1;
  range: InternalAnalyticsRangeBlock;
  totals: {
    conversationsWithCapturedLeads: number;
    totalLeadFieldsCaptured: number;
  };
  byBot: Array<{
    botId: string;
    name: string;
    slug: string;
    conversationsWithCapturedLeads: number;
    leadFieldsCaptured: number;
  }>;
  caveats: string[];
};
