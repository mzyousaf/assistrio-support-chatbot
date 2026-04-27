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
};

/** POST /api/customer/bots/:id/datasheets/preview (multipart `file`) */
export type CustomerDatasheetPreviewResponse = {
  ok: true;
  fileName: string;
  columns: string[];
  previewRows: string[][];
  totalDataRows: number;
};

/** POST /api/customer/bots/:id/datasheets/import (multipart `file`) */
export type CustomerDatasheetImportResponse = {
  ok: true;
  botId: string;
  sheetIndex: number;
  sourceFile: { bucket: string; key: string };
};

/** Subset of `leadCapture` aligned with backend `BotLeadCaptureV2` / workspace PATCH. */
export type CustomerLeadField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'url';
  required?: boolean;
  disabled?: boolean;
  aliases?: string[];
};

export type CustomerLeadCapture = {
  enabled?: boolean;
  fields?: CustomerLeadField[];
  askStrategy?: 'soft' | 'balanced' | 'direct';
  politeMode?: boolean;
  captureMode?: 'chat' | 'form' | 'hybrid';
};

/** Pipeline state for a snippet/FAQ row from knowledge base items (`GET` bot). */
export type CustomerKnowledgeItemTrainingStatus = 'queued' | 'processing' | 'ready' | 'failed';

/** Q&A group from KB (`PATCH` `faqs`). Legacy rows may only have `question` + `answer`. */
export type CustomerKnowledgeFaq = {
  /** Group label shown in the library. */
  title?: string;
  /** Phrasing variants for retrieval; first maps to `question` for older clients. */
  questions?: string[];
  question: string;
  answer: string;
  active?: boolean;
  trainingStatus?: CustomerKnowledgeItemTrainingStatus;
  lastTrainedAt?: string | null;
};

export type CustomerKnowledgeSnippet = {
  title: string;
  snippet: string;
  active?: boolean;
  trainingStatus?: CustomerKnowledgeItemTrainingStatus;
  lastTrainedAt?: string | null;
};

export type CustomerKnowledgeDatasheet = {
  title: string;
  columns: string[];
  rows: string[][];
  active?: boolean;
  /** KB pipeline status for this datasheet (from `GET` bot). */
  trainingStatus?: CustomerKnowledgeItemTrainingStatus;
  lastTrainedAt?: string | null;
  /** Original import file size in bytes, when available. */
  importFileSize?: number | null;
  importFileName?: string | null;
};

/** Document row from GET `/api/customer/bots/:botId/documents` (list). */
export type CustomerWorkspaceDocument = {
  _id?: string | { toString(): string };
  botId?: string | { toString(): string };
  title?: string;
  sourceType?: string;
  status?: string;
  error?: string;
  ingestedAt?: string | Date;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  active?: boolean;
  createdAt?: string | Date;
  /** Populated on GET single-document when ingested. */
  text?: string;
};

/** Subset of `personality` aligned with backend `BotPersonality` / workspace PATCH. */
export type CustomerBotPersonality = {
  name?: string;
  description?: string;
  systemPrompt?: string;
  behaviorPreset?: string;
  tone?: string;
  language?: string;
  thingsToAvoid?: string;
};

/** GET /api/customer/bots/:id — `bot` subset used by onboarding and workspace UI. */
export type CustomerBotDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  /** Bot avatar image URL (widget / profile). */
  imageUrl?: string;
  /** Single emoji used when no custom image URL is set. */
  avatarEmoji?: string;
  /** Persisted avatar mode (legacy bots infer from `imageUrl` / `avatarEmoji`). */
  avatarSource?: 'upload' | 'url' | 'emoji' | 'none';
  category?: string;
  categories?: string[];
  knowledgeDescription?: string;
  knowledgeSnippets?: CustomerKnowledgeSnippet[];
  knowledgeDatasheets?: CustomerKnowledgeDatasheet[];
  welcomeMessage?: string;
  /** When false, welcome text is kept but not shown in the widget. */
  welcomeMessageEnabled?: boolean;
  status: string;
  isPublic?: boolean;
  visibility?: string;
  faqs?: CustomerKnowledgeFaq[];
  /** Legacy: `string`. New: `{ label, context? }` — optional `context` limits the first reply to that text (no full KB). */
  exampleQuestions?: Array<string | { label: string; context?: string }>;
  personality?: CustomerBotPersonality;
  config?: Record<string, unknown>;
  allowedOrigins?: Array<{ origin: string; label?: string; isActive?: boolean }>;
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  leadCapture?: CustomerLeadCapture;
  chatUI?: unknown;
  clientDraftId?: string;
  accessKey?: string;
  secretKey?: string;
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
  /** ISO timestamp: last document ingest used as training signal (see list stats). */
  lastTrainedAt?: string | null;
};

/** POST /api/customer/bots/:id/lifecycle-action — success JSON body */
export type CustomerBotLifecycleResponse =
  | {
      ok: true;
      action: 'publish';
      status: 'published';
      embedSnippet: string;
      accessKey: string;
      allowedOrigins: string[];
    }
  | { ok: true; action: 'draft'; status: 'draft' };

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
  documents: CustomerWorkspaceDocument[];
  total: number;
  counts: {
    total?: number;
    queued?: number;
    processing?: number;
    ready?: number;
    failed?: number;
  };
  lastIngestedAt?: string | null;
  lastFailedDoc?: unknown;
};

/** GET /api/customer/bots/:botId/documents/:id/download-url */
export type CustomerDocumentDownloadUrlResponse = {
  url: string;
};

/** One row returned from POST /api/customer/bots/:botId/documents (multipart, 1–5 files). */
export type CustomerDocumentUploadRow = {
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

/** POST /api/customer/bots/:botId/documents (multipart: repeat field `file`, max 5 per request) */
export type CustomerDocumentUploadResponse = {
  ok: true;
  documents: CustomerDocumentUploadRow[];
  ingestions?: Array<{ jobStatus: 'queued' }>;
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
