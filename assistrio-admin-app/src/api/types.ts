export type ApiErrorBody = {
  error?: string;
  errorCode?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false;
      status: number;
      error: string;
      errorCode?: string;
      body: unknown;
    };

/** GET /api/admin/me */
export type AdminMe = {
  id: string;
  email: string;
  role: string;
  workspaceIds: string[];
};

/** GET /api/admin/bots list item */
export type AdminBotListItem = {
  _id: string;
  name: string;
  agentsPackAgent: boolean;
  category: string;
  status: string;
  isPublic: boolean;
  visibility: string;
  createdAt: string | null;
  slug: string;
  primaryColor: string;
  avatarEmoji?: string;
  imageUrl?: string;
  shortDescription?: string;
  activeOrigins?: string[];
  leadCaptureEnabled?: boolean;
  totalConversations?: number;
  totalMessages?: number;
  knowledgeDocs?: number;
  knowledgeFaqs?: number;
  knowledgeSnippets?: number;
  knowledgeDatasheets?: number;
  lastActivityAt?: string | null;
  lastTrainedAt?: string | null;
  workspaceId?: string;
  ownerId?: string;
  isPlatformBot?: boolean;
  platformBotType?: PlatformBotType | string;
};

export type PlatformBotType = 'landing_demo' | 'showcase' | 'support' | 'internal';

export type AdminPlatformBotListItem = {
  _id: string;
  name: string;
  platformBotType: PlatformBotType | null;
  platformBotTypeLabel: string;
  status: 'draft' | 'published' | string;
  visibility: 'public' | 'private' | string;
  isPublic: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminPlatformBotDetail = AdminPlatformBotListItem & {
  description: string;
  shortDescription?: string;
  slug: string;
  accessKey?: string;
  welcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
  exampleQuestions?: string[];
  allowedOrigins: AdminBotAllowedOrigin[];
};

export type AdminBotAllowedOrigin = {
  origin: string;
  label?: string;
  isActive?: boolean;
};

/** GET /api/admin/bots/:id — `bot` subset */
export type AdminBotDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  status: string;
  isPublic?: boolean;
  visibility?: string;
  allowedOrigins?: AdminBotAllowedOrigin[];
  workspaceId?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  categories?: string[];
  imageUrl?: string;
  avatarEmoji?: string;
  avatarSource?: string;
  accessKey?: string;
  secretKey?: string;
  welcomeMessage?: string;
  welcomeMessageEnabled?: boolean;
  exampleQuestions?: unknown[];
  personality?: Record<string, unknown>;
  config?: Record<string, unknown>;
  chatUI?: Record<string, unknown>;
  leadCapture?: Record<string, unknown>;
  faqs?: unknown[];
  knowledgeSnippets?: unknown[];
  knowledgeDatasheets?: unknown[];
  knowledgeDescription?: string;
  includeNameInKnowledge?: boolean;
  isPlatformBot?: boolean;
  platformBotType?: string;
};

/** Full bot document from admin GET (editor sections). */
export type AdminBotWorkspaceBot = AdminBotDetail & Record<string, unknown>;

/** Mirrors customer `GET …/knowledge/status` rows (admin uses same backend shape). */
export type AdminKnowledgeStatusItem = {
  id?: string;
  active?: boolean;
  status?: string;
  trainingStatus?: string;
  extractionStatus?: string;
  extractionError?: string | null;
  lastQueuedAt?: string | null;
  runAfter?: string | null;
  lastTrainingStartedAt?: string | null;
  lastTrainedAt?: string | null;
  trainingError?: string | null;
  displayStatus?: string;
  displayLabel?: string;
  faqIndex?: number;
  snippetIndex?: number;
  tableIndex?: number;
  suggestionIndex?: number;
  sourceType?: string;
  isTraining?: boolean;
  isExtracting?: boolean;
  isImporting?: boolean;
  knowledgeItemId?: string;
  documentId?: string;
  updatedAt?: string | null;
  extractManualRetrySuggested?: boolean;
  trainingManualRetrySuggested?: boolean;
  displayMessage?: string | null;
  documentStatus?: string;
  knowledgeItemStatus?: string;
  latestIngestJobStatus?: string | null;
  storedTextUtf8Bytes?: number;
};

export type KnowledgeReplyPriorityMode = 'default' | 'priority';
export type KnowledgeReplyPrioritySourceType = 'faq' | 'note' | 'table' | 'document' | 'suggestion';
export type KnowledgeReplyPrioritySettings = {
  mode: KnowledgeReplyPriorityMode;
  sourceOrder: KnowledgeReplyPrioritySourceType[];
};

export type AdminKnowledgeUsage = {
  totalBytes: number;
  trainableBytes?: number;
  maxBytes: number;
  remainingBytes: number;
  percentUsed: number;
  documentBytes?: number;
  faqBytes?: number;
  noteBytes?: number;
  tableBytes?: number;
  suggestionBytes?: number;
  sectionLimits?: Record<string, unknown>;
};

export type AdminKnowledgeOverviewResponse = {
  botId: string;
  knowledgeTraining?: {
    autoTrainEnabled?: boolean;
    trainingDelayMinutes?: number;
    scheduleMode?: string;
  };
  knowledgeReplyPriority?: KnowledgeReplyPrioritySettings;
  knowledgeStats?: {
    totalCharacters?: number;
    totalItems?: number;
    readyCharacters?: number;
    readyItems?: number;
    pendingItems?: number;
    queuedItems?: number;
    processingItems?: number;
    failedItems?: number;
    byType?: {
      documents?: { items?: number; characters?: number };
      snippets?: { items?: number; characters?: number };
      qna?: { items?: number; characters?: number };
      datasheets?: { items?: number; characters?: number };
      suggestions?: { items?: number; characters?: number };
    };
    lastTrainedAt?: string | null;
  };
  queue?: Record<string, unknown>;
  pending?: { items?: number; characters?: number };
  failed?: { items?: number; characters?: number };
  knowledgeUsage?: AdminKnowledgeUsage;
};

export type AdminPendingTrainingSectionType = 'document' | 'faq' | 'note' | 'table' | 'suggestion';
export type AdminPendingTrainingItemDisplayStatus =
  | 'needs_training'
  | 'failed'
  | 'scheduled'
  | 'extraction_failed'
  | 'in_training'
  | 'training_queued';

export type AdminPendingTrainingItemsResponse = {
  total: number;
  sections: Array<{
    type: AdminPendingTrainingSectionType;
    label: string;
    count: number;
    items: Array<{
      id: string;
      title: string;
      displayStatus: AdminPendingTrainingItemDisplayStatus;
      nextRunAfter?: string | null;
    }>;
  }>;
};

export type AdminAgentTrainingDisplayPhase =
  | 'empty'
  | 'ready'
  | 'training_required'
  | 'extracting'
  | 'importing'
  | 'training'
  | 'partially_ready'
  | 'failed';

export type AdminAgentTrainingDataSourceRow = {
  key: 'documents' | 'qna' | 'snippets' | 'datasheets' | 'suggestions';
  trainingRequired: number;
  trainingQueued?: number;
  inTraining: number;
  trained: number;
  failed: number;
  total: number;
};

export type AdminAgentTrainingStatusResponse = {
  status: 'trained' | 'training' | 'needs_training' | 'failed';
  label: string;
  displayPhase?: AdminAgentTrainingDisplayPhase;
  isTraining: boolean;
  training_queued?: boolean;
  isTextExtracting: boolean;
  isExtracting?: boolean;
  isImporting?: boolean;
  isTrained: boolean;
  needsTraining: boolean;
  hasFailed: boolean;
  counts: {
    pending: number;
    queued: number;
    processing: number;
    ready: number;
    failed: number;
    total: number;
  };
  characters: {
    pending: number;
    queued: number;
    processing: number;
    ready: number;
    failed: number;
    total: number;
  };
  lastQueuedAt?: string | null;
  lastTrainingStartedAt?: string | null;
  lastTrainedAt?: string | null;
  nextRunAfter?: string | null;
  estimatedTrainingSeconds: number;
  estimatedLabel: string;
  lifecycleCounts?: Record<string, number>;
  dataSources: AdminAgentTrainingDataSourceRow[];
  affectedTypes?: AdminPendingTrainingSectionType[];
  knowledgeUsage: AdminKnowledgeUsage;
};

export type AdminKnowledgeStatusResponse = {
  items: AdminKnowledgeStatusItem[];
};

export type AdminKnowledgeItemManualRetryResponse = {
  ok: true;
  action: string;
  status: string;
  extractionStatus: string;
  displayStatus: string;
  displayMessage: string;
};

export type AdminWorkspaceDocument = {
  _id?: string;
  id?: string;
  title?: string;
  text?: string;
  fileName?: string;
  status?: string;
  documentStatus?: string;
  trainingStatus?: string;
  uploadStatus?: string;
  sourceType?: string;
  fileType?: string;
  fileSize?: number;
  active?: boolean;
  createdAt?: string;
  knowledgeItemId?: string;
  downloadUrl?: string;
  hasFile?: boolean;
  trainingError?: string | null;
  extractionError?: string | null;
  displayStatus?: string;
  displayMessage?: string | null;
  lastQueuedAt?: string | null;
  lastTrainingStartedAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

export type AdminDocumentsResponse = {
  documents: AdminWorkspaceDocument[];
  total?: number;
  pagination?: Record<string, unknown>;
  healthCounts?: Record<string, number>;
};

export type AdminDocumentUploadResponse = {
  ok: true;
  documents: AdminWorkspaceDocument[];
  ingestions?: Array<{ jobStatus: string }>;
};

export type AdminDocumentDownloadUrlResponse = {
  url: string;
  expiresAt?: string;
};

export type AdminBotDetailResponse = {
  ok: true;
  bot: AdminBotDetail & Record<string, unknown>;
  health: Record<string, unknown>;
};

export type AdminLoginResponse = {
  success: boolean;
};

export type AdminLogoutResponse = {
  success: boolean;
};

export type AdminPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminCustomerListItem = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActiveAt?: string | null;
  workspaceCount: number;
  botCount: number;
  publishedBotCount: number;
  draftBotCount: number;
};

export type AdminCustomerDetail = AdminCustomerListItem;

export type AdminCustomersListResponse = {
  ok: true;
  customers: AdminCustomerListItem[];
  pagination: AdminPagination;
};

export type AdminCustomerDetailResponse = {
  ok: true;
  customer: AdminCustomerDetail;
};

export type AdminCustomerWorkspace = {
  id: string;
  name: string;
  role?: string;
  memberCount?: number;
  botCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  planKey?: string;
  planName?: string;
  subscriptionStatus?: string;
  monthlyAiCredits?: number;
  aiCreditsUsedThisPeriod?: number;
  botLimit?: number;
  memberLimit?: number;
  currentBots?: number;
  currentMembers?: number;
};

export type AdminCustomerWorkspacesResponse = {
  ok: true;
  workspaces: AdminCustomerWorkspace[];
};

export type AdminCustomerBot = {
  id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'published';
  visibility?: 'public' | 'private';
  workspaceId?: string | null;
  workspaceName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminCustomerBotsResponse = {
  ok: true;
  bots: AdminCustomerBot[];
};

export type AdminWorkspaceBillingPlanSummary = {
  key: string;
  name: string;
  priceMonthly: number;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

export type AdminWorkspaceBillingEntitlementsSummary = {
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

export type AdminWorkspaceBillingUsageSummary = {
  bots: { current: number; limit: number };
  members: { current: number; pendingInvites: number; used: number; limit: number };
  aiCredits: {
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
  trainedKnowledge: {
    perBot: Array<{
      botId: string;
      botName: string;
      usedBytes: number;
      maxBytes: number;
      usedMb: number;
      maxMb: number;
      percentUsed: number;
    }>;
    totalUsedBytes: number;
    note: string;
  };
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

export type AdminWorkspaceBillingSummary = {
  workspaceId: string;
  plan: AdminWorkspaceBillingPlanSummary;
  entitlements: AdminWorkspaceBillingEntitlementsSummary;
  usage: AdminWorkspaceBillingUsageSummary;
  planCatalog: Array<{ key: string; name: string }>;
  addonCatalog: Array<{ key: string; name: string; checkoutAvailable: false }>;
  admin: AdminWorkspaceBillingMetadata;
};

export type AdminCustomersListParams = {
  q?: string;
  page?: number;
  limit?: number;
};

export type {
  AdminBotConversationsListParams,
  AdminBotConversationsListResponse,
  AdminConversationDetail,
  AdminConversationDeviceDetail,
  AdminConversationDeviceSummary,
  AdminConversationListItem,
  AdminConversationLocationDetail,
  AdminConversationLocationSummary,
  AdminConversationMessage,
  AdminConversationMessageAiMeta,
  AdminConversationMessageAttachment,
  AdminConversationMessageCreditBreakdownRow,
  AdminConversationMessageFeedback,
  AdminConversationMessageSentiment,
  AdminConversationMessageSource,
  AdminConversationMessageSpeechInput,
  AdminConversationMessageTopics,
  AdminConversationOriginDetail,
  AdminConversationOriginSummary,
  AdminConversationSentimentSummary,
  AdminConversationTopicsSummary,
  AdminConversationVoiceMeta,
} from './adminConversationTypes';

export type {
  AdminChatsAnalyticsStartedFromKey,
  AdminSentimentLabelId,
  AdminTopicsAnalyticsTopicId,
} from './adminAnalyticsFilterTypes';

export { ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS } from './adminAnalyticsFilterTypes';

export type {
  AdminAnalyticsBotDetailResponse,
  AdminAnalyticsBotsSummaryResponse,
  AdminAnalyticsBotsSummaryRow,
  AdminAnalyticsDateParams,
  AdminAnalyticsLeadsByBotRow,
  AdminAnalyticsLeadsSummaryResponse,
  AdminAnalyticsOverviewResponse,
  AdminAnalyticsRange,
  AdminAnalyticsScope,
  AdminCustomerAnalyticsOverviewBot,
  AdminCustomerAnalyticsOverviewResponse,
} from './adminAnalyticsTypes';

export type {
  AdminVisitorDetailBot,
  AdminVisitorDetailResponse,
  AdminVisitorEventRow,
  AdminVisitorEventType,
  AdminVisitorKind,
  AdminVisitorListItem,
  AdminVisitorsListParams,
} from './adminVisitorsTypes';

export type {
  AdminOpenAiTestKeyResponse,
  AdminOpenAiTestPlatformKeyResponse,
  BackendHealthResponse,
} from './adminSettingsTypes';
