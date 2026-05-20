export type AdminAnalyticsScope = 'all' | 'platform' | 'customer';

/** Query params for `/api/admin/analytics/*` time-bounded endpoints. */
export type AdminAnalyticsDateParams = {
  from?: string;
  to?: string;
  scope?: AdminAnalyticsScope;
  platformOnly?: boolean;
  customerId?: string;
};

export type AdminAnalyticsRange = {
  from: string;
  to: string;
  label: string;
};

export type AdminAnalyticsOverviewResponse = {
  schemaVersion: 1;
  range: AdminAnalyticsRange;
  overview: {
    totalVisitorEvents: number;
    pageViews: number;
    ctaClicks: number;
    demoOpened: number;
    legacyVisitorEventCounts: {
      trial_bot_created: number;
      trial_create_started: number;
      trial_create_succeeded: number;
    };
  };
  messages: {
    legacyTaggedUserMessagesBucket1: number;
    legacyTaggedUserMessagesBucket2: number;
    totalMessages: number;
    totalConversations: number;
  };
  bots: {
    botsCreatedInRange: number;
    publishedBotsCount: number;
  };
  leads: {
    conversationsWithCapturedLeads: number;
  };
  caveats: string[];
};

export type AdminAnalyticsPlatformBotType = 'landing_demo' | 'showcase' | 'support' | 'internal';

export type AdminAnalyticsBotsSummaryRow = {
  botId: string;
  name: string;
  slug: string;
  agentsPackAgent: boolean;
  status: string;
  visibility: string;
  isPublic: boolean;
  shortDescription: string | null;
  category: string | null;
  leadCaptureEnabled: boolean;
  createdAt: string;
  isPlatformBot: boolean;
  platformBotType?: AdminAnalyticsPlatformBotType | null;
  workspaceId?: string | null;
  ownerId?: string | null;
  messageCount: number;
  conversationCount: number;
  legacyTaggedUserMessagesBucket1: number;
  legacyTaggedUserMessagesBucket2: number;
  conversationsWithCapturedLeads: number;
};

export type AdminAnalyticsScopeFilter = {
  scope: AdminAnalyticsScope;
  customerId?: string;
};

export type AdminAnalyticsBotsSummaryResponse = {
  schemaVersion: 1;
  range: AdminAnalyticsRange;
  filter?: AdminAnalyticsScopeFilter;
  truncated: boolean;
  bots: AdminAnalyticsBotsSummaryRow[];
  caveats: string[];
};

export type AdminAnalyticsLeadsByBotRow = {
  botId: string;
  name: string;
  slug: string;
  conversationsWithCapturedLeads: number;
  leadFieldsCaptured: number;
};

export type AdminAnalyticsLeadsSummaryResponse = {
  schemaVersion: 1;
  range: AdminAnalyticsRange;
  filter?: AdminAnalyticsScopeFilter;
  totals: {
    conversationsWithCapturedLeads: number;
    totalLeadFieldsCaptured: number;
  };
  byBot: AdminAnalyticsLeadsByBotRow[];
  caveats: string[];
};

export type AdminAnalyticsBotDetailResponse = {
  schemaVersion: 1;
  range: AdminAnalyticsRange;
  bot: {
    botId: string;
    name: string;
    slug: string;
    agentsPackAgent: boolean;
    status: string;
    visibility: string;
    isPublic: boolean;
    shortDescription: string | null;
    category: string | null;
    leadCaptureEnabled: boolean;
    createdAt: string;
    isPlatformBot: boolean;
    platformBotType?: AdminAnalyticsPlatformBotType | null;
    workspaceId?: string | null;
    ownerId: string | null;
  };
  metrics: {
    messageCount: number;
    conversationCount: number;
    legacyTaggedUserMessagesBucket1: number;
    legacyTaggedUserMessagesBucket2: number;
    conversationsWithCapturedLeads: number;
  };
  activity: {
    lastMessageAtInRange: string | null;
    lastConversationCreatedAtInRange: string | null;
    lastConversationActivityAtInRange: string | null;
  };
  caveats: string[];
};

export type AdminCustomerAnalyticsOverviewBot = {
  botId: string;
  name: string;
  status: 'draft' | 'published';
  isPlatformBot: boolean;
  platformBotType?: string | null;
  conversationCount: number;
  messageCount: number;
  conversationsWithCapturedLeads: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminCustomerAnalyticsOverviewResponse = {
  ok: true;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  range: {
    from: string;
    to: string;
  };
  totals: {
    botCount: number;
    publishedBotCount: number;
    draftBotCount: number;
    conversationCount: number;
    messageCount: number;
    conversationsWithCapturedLeads: number;
  };
  bots: AdminCustomerAnalyticsOverviewBot[];
  caveats?: string[];
};
