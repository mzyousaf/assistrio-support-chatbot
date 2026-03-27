export type ChatMode = 'user';

/** Lead field as used by chat (key, label, type, required). */
export interface BotLikeLeadField {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
}

export interface BotLikeLeadCapture {
  enabled?: boolean;
  fields?: BotLikeLeadField[];
}

export interface BotLike {
  _id: { toString(): string };
  name?: string;
  shortDescription?: string;
  description?: string;
  category?: string;
  openaiApiKeyOverride?: string;
  welcomeMessage?: string;
  /** Knowledge notes / internal description (included in RAG context). */
  knowledgeDescription?: string;
  leadCapture?: BotLikeLeadCapture;
  personality?: {
    name?: string;
    description?: string;
    behaviorPreset?: string;
    tone?: 'friendly' | 'formal' | 'playful' | 'technical';
    language?: string;
    systemPrompt?: string;
    thingsToAvoid?: string;
  };
  config?: {
    temperature?: number;
    maxTokens?: number;
    responseLength?: 'short' | 'medium' | 'long';
  };
  faqs?: Array<{ question: string; answer: string }>;
}

export interface RunChatInput {
  bot: BotLike;
  /**
   * Chat identity for Conversation/Message association (chatVisitorId).
   * This identity is managed by the embedded widget.
   */
  chatVisitorId: string;

  /**
   * Optional platform visitor id for quota + platform analytics.
   * Only used when bot.creatorType === 'visitor' (trial bots).
   */
  platformVisitorId?: string;
  message: string;
  mode: ChatMode;
  userApiKey?: string;
  /** Optional request id for logging/dedupe. */
  requestId?: string;
  /** When true (e.g. admin), result may include debug info. */
  debug?: boolean;
}

/** Single source item (chunk-level, deduped by chunkId; order by retrieval score). */
export interface ChatSource {
  documentId: string;
  chunkId: string;
  title: string;
  sourceType: string;
  url?: string;
  text: string;
  score?: number;
}

/** Display-oriented source: one per document with chunks, for cleaner UI. */
export interface DisplaySourceChunk {
  chunkId: string;
  text: string;
  score?: number;
}

export interface DisplaySource {
  documentId: string;
  title: string;
  sourceType: string;
  url?: string;
  chunks: DisplaySourceChunk[];
}

/** Internal debug payload for observability (admin-only when requested). Unified pipeline only. No embeddings or secrets. */
export interface ChatDebugInfo {
  userQuery?: string;
  /** Always 'unified' (single pipeline). */
  finalAnswerPipeline?: 'unified';
  /** How the answer was framed: grounded in evidence, general chat, or safe fallback. */
  finalAnswerMode?: 'grounded' | 'general' | 'safe_fallback';
  /** Retrieval outcome: none (no items), weak, or strong. */
  retrievalOutcome?: 'none' | 'weak' | 'strong';

  retrievalConfidence: 'high' | 'medium' | 'low';
  /** Evidence item ids included in the prompt. */
  usedChunkIds: string[];
  historyMessageCount: number;
  leadCaptureState?: {
    collectedKeys: string[];
    missingRequired: string[];
    declinedFields: string[];
    postponedFields: string[];
    shouldAskNow: boolean;
  };
  promptSectionSizes?: { systemChars: number; userChars: number };
  lowConfidenceMode?: boolean;
  /** Token budget: evidence + conversation + current message. */
  tokenBudget?: {
    conversationTokens: number;
    evidenceTokens: number;
    currentMessageTokens: number;
    totalUserEstimate: number;
    historyDropped: number;
    evidenceDropped: number;
  };
  topChunkScores?: number[];
  extractionMethodsByField?: Record<string, string>;
  leadOverwritten?: string[];
  leadSkipped?: string[];
  intentClassification?: string;
  summaryUsed?: boolean;
  summaryEligible?: boolean;
  summaryAttempted?: boolean;
  summaryGenerated?: boolean;
  summaryEnqueued?: boolean;
  summaryError?: string;

  retrievalDurationMs?: number;
  completionDurationMs?: number;
  summaryEnqueueDurationMs?: number;
  totalDurationMs?: number;

  /** Evidence items trimmed out by token budget. */
  trimmedEvidenceCount?: number;
  /** Evidence items in final prompt. */
  evidenceItemsInFinalPrompt?: number;
  selectedDocumentTitles?: string[];
  selectedDocumentChunkIds?: string[];
  topRetrievedDocumentChunks?: DebugChunkExcerpt[];
  finalPromptDocumentChunks?: DebugChunkExcerpt[];
  documentChunksTrimmedOut?: DebugChunkExcerpt[];
  retrievalModeSummary?: string;
  documentChunksInPrompt?: boolean;
  chunkQualitySignals?: { avgChunkLength: number; minChunkLength: number; anyTooShort: boolean; tooShortCount: number };
  documentDirectAnswerLikely?: boolean;
  strongestDocumentChunkScore?: number;
  finalPromptContainsStrongDoc?: boolean;
  answerUsedDocumentLikely?: boolean;
  reIngestionRecommended?: boolean;
  /** Token estimates by block (evidence pipeline). */
  promptTokenEstimatesByBlock?: {
    system: number;
    userEvidence: number;
    userConversation: number;
    userCurrentMessage: number;
    userTotal: number;
  };

  unifiedRetrievalUsed?: boolean;
  /** Distinct knowledge base item ids in the retrieval result (for debug/source). */
  knowledgeBaseItemIds?: string[];
  unifiedRetrievalEligibleCounts?: { document?: number; faq?: number; note?: number; html?: number };
  unifiedRetrievalBySourceType?: Record<string, Array<{ sourceType: string; title: string; combinedScore: number }>>;
  unifiedRetrievalScoreBreakdown?: Array<{
    id: string;
    sourceType: string;
    title: string;
    semanticScore: number;
    lexicalScore: number;
    exactPhraseScore: number;
    headingMatchScore: number;
    titleMatchScore: number;
    faqQuestionMatchScore: number;
    combinedScore: number;
  }>;
  unifiedRetrievalDiversityDebug?: {
    removedAsDuplicate: string[];
    skippedByCap: Array<{ id: string; reason: string }>;
    finalSelectedCount: number;
    finalSelectedIds?: string[];
  };

  evidenceItemsInPrompt?: number;
  evidenceItemsTrimmedOut?: string[];
  evidenceBlockTokens?: number;
  evidencePromptTokenDistribution?: {
    system: number;
    userEvidence: number;
    userConversation: number;
    userCurrentMessage: number;
    userTotal: number;
  };
  protectedEvidenceCount?: number;
  evidenceItemsKeptIds?: string[];
  conversationMessagesTrimmedOut?: number;
  evidenceTrimReason?: string;
  conversationTrimReason?: string;
  evidenceTrimSummary?: string;

  questionClassification?: string;
  evidenceStrengthSummary?: {
    topCombinedScore: number;
    scoreGap: number;
    evidenceItemCount: number;
    hasStrongMatchSignal?: boolean;
  };
  evidenceStrongEnough?: boolean;
  directAnswerLikely?: boolean;
  companySpecificQuestion?: boolean;
  shouldUseFallback?: boolean;
  shouldAnswerGenerally?: boolean;
  answerabilityExplanation?: string;
}

/** Inferred from chunk text (no schema); helps distinguish FAQ vs section chunks in debug. */
export type ChunkKind = 'faq' | 'section';

/** Lexical score component breakdown (admin-safe, for debug). */
export interface DebugLexicalBreakdown {
  titleBonus: number;
  headingBonus: number;
  phraseBonus: number;
  faqQuestionBonus: number;
}

/** Admin-safe chunk excerpt for debug (no full text, no embeddings). */
export interface DebugChunkExcerpt {
  documentId: string;
  /** Document title (safe). */
  title: string;
  chunkId: string;
  /** Source type of the document (e.g. upload, url, manual). */
  sourceType: string;
  /** Same as documentId; id of the source document. */
  sourceId: string;
  /** Short text preview for debug; no full content. */
  textExcerpt: string;
  semanticScore: number;
  lexicalScore: number;
  /** Exact phrase match bonus from lexical scoring. */
  exactPhraseScore: number;
  /** Heading + title bonus from lexical scoring. */
  headingTitleScore: number;
  combinedScore: number;
  /** Section heading when chunk starts with "[Section Title]" (section-aware chunking). */
  chunkHeading?: string;
  /** Alias for chunkHeading for debug UI. */
  section?: string;
  /** Inferred from text: FAQ-style (Q:/A:) vs section; improves debug visibility. */
  chunkKind?: ChunkKind;
  /** Lexical score bonuses (title, heading, phrase, FAQ question) for retrieval debug. */
  lexicalBreakdown?: DebugLexicalBreakdown;
}

export type RunChatResult =
  | {
    ok: true;
    conversationId: string;
    assistantMessage: string;
    sources?: ChatSource[];
    displaySources?: DisplaySource[];
    isNewConversation: boolean;
    /** Present only when RunChatInput.debug is true; safe for admin. */
    debug?: ChatDebugInfo;
  }
  | {
    ok: false;
    error: 'missing_openai_key';
  };
