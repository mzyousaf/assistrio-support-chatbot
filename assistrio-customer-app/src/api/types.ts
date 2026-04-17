/** GET /api/customer/me */
export type CustomerMe = {
  id: string;
  email: string;
  role: string;
  workspaceIds: string[];
  /** Display names for workspaces (same order as `workspaceIds` when present). */
  workspaces?: Array<{ id: string; name: string }>;
  firstName?: string;
  lastName?: string;
  /** Profile image URL (e.g. Google picture). */
  picture?: string;
};

/** GET /api/customer/bots list item */
export type CustomerBotListItem = {
  _id: string;
  name: string;
  agentsPackAgent: boolean;
  category: string;
  status: string;
  isPublic: boolean;
  visibility: string;
  messageLimitMode: string;
  messageLimitTotal: number | null;
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
  lastActivityAt?: string | null;
  lastTrainedAt?: string | null;
};

/** GET /api/customer/bots/:id — `bot` subset used by onboarding and workspace UI. */
export type CustomerBotDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  category?: string;
  categories?: string[];
  knowledgeDescription?: string;
  welcomeMessage?: string;
  status: string;
  isPublic?: boolean;
  visibility?: string;
  faqs?: Array<{ question: string; answer: string; active?: boolean }>;
  exampleQuestions?: string[];
  personality?: Record<string, unknown>;
  config?: Record<string, unknown>;
  allowedOrigins?: Array<{ origin: string; label?: string; isActive?: boolean }>;
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  messageLimitMode?: string;
  messageLimitTotal?: number | null;
  messageLimitUpgradeMessage?: string | null;
  leadCapture?: unknown;
  chatUI?: unknown;
  clientDraftId?: string;
  accessKey?: string;
  secretKey?: string;
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
};

/** GET /api/customer/bots/:id */
export type CustomerBotDetailResponse = {
  ok: true;
  bot: CustomerBotDetail & Record<string, unknown>;
  health: Record<string, unknown>;
};

/** GET /api/customer/bots/:id/insights */
export type CustomerBotInsightsResponse = {
  schemaVersion: 1;
  bot: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  metrics: {
    totalConversations: number;
    totalMessages: number;
    conversationsWithCapturedLeads: number;
    knowledgeDocuments: number;
  };
  activity: {
    lastActivityAt: string | null;
  };
};

export type CreateDraftResponse = {
  botId: string;
  slug: string;
};

export type CustomerDocumentsResponse = {
  documents: unknown[];
  total: number;
  counts: Record<string, unknown>;
  lastIngestedAt?: unknown;
  lastFailedDoc?: unknown;
};

/** GET /api/customer/bots/:botId/documents/:id/download-url */
export type CustomerDocumentDownloadUrlResponse = {
  url: string;
};

/** POST /api/customer/bots/:botId/documents (multipart) */
export type CustomerDocumentUploadResponse = {
  ok: true;
  document: {
    _id: string;
    botId: string;
    title: string;
    sourceType: string;
    status: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    active: boolean;
    createdAt: string;
  };
  ingestion: { jobStatus: 'queued' };
};

export type ChatResponse = {
  ok: true;
  conversationId: string;
  assistantMessage: string;
  sources?: unknown;
};

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
