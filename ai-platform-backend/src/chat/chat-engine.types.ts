export type ChatMode = 'demo' | 'trial' | 'super_admin';

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
  visitorId: string;
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

/** Internal debug payload for observability (admin-only when requested). No embeddings or secrets. */
export interface ChatDebugInfo {
  /** User message that triggered this run (admin/test debug). */
  userQuery?: string;
  /** Count of eligible knowledge items by source type: notes, FAQs, document chunks. */
  eligibleCountBySourceType?: EligibleCountBySourceType;
  /** Chunk counts by document sourceType (upload/url/manual). */
  eligibleChunkCountByDocumentSourceType?: EligibleCountByDocumentSourceType;
  retrievalConfidence: 'high' | 'medium' | 'low';
  usedChunkIds: string[];
  usedFaqCount: number;
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
  /** Token budget: estimated totals and trimmed counts. */
  tokenBudget?: {
    conversationTokens: number;
    chunksTokens: number;
    faqsTokens: number;
    currentMessageTokens: number;
    notesTokens: number;
    totalUserEstimate: number;
    historyDropped: number;
    chunksDropped: number;
    faqsDropped: number;
  };
  /** Top chunk scores (combined) for retrieval quality visibility. */
  topChunkScores?: number[];
  extractionMethodsByField?: Record<string, string>;
  /** Fields overwritten by extraction this turn; fields skipped (existing kept). */
  leadOverwritten?: string[];
  leadSkipped?: string[];
  intentClassification?: string;
  summaryUsed?: boolean;
  summaryEligible?: boolean;
  summaryAttempted?: boolean;
  summaryGenerated?: boolean;
  /** True when summary job was enqueued (background flow). */
  summaryEnqueued?: boolean;
  /** Safe internal message only (e.g. "timeout", "empty response"). */
  summaryError?: string;
  /** Latency breakdown (ms) for observability. */
  retrievalDurationMs?: number;
  completionDurationMs?: number;
  summaryEnqueueDurationMs?: number;
  totalDurationMs?: number;
  /** Document RAG observability (admin debug). */
  /** Bot ID used for retrieval; retrievedChunkBotIds should equal [this] when isolated. */
  retrievalRequestBotId?: string;
  eligibleDocumentCount?: number;
  eligibleChunkCount?: number;
  chunksWithValidEmbeddingCount?: number;
  retrievedDocumentChunkCount?: number;
  /** Unique bot IDs in retrieved chunks; valid request should have exactly one. */
  retrievedChunkBotIds?: string[];
  trimmedDocumentChunkCount?: number;
  finalPromptDocumentChunkCount?: number;
  selectedDocumentTitles?: string[];
  selectedDocumentChunkIds?: string[];
  faqCountBeforeTrim?: number;
  faqCountAfterTrim?: number;
  /** Deep doc RAG: top retrieved chunks with scores and excerpt (admin debug). */
  topRetrievedDocumentChunks?: DebugChunkExcerpt[];
  /** Doc chunks that made it into the final prompt. */
  finalPromptDocumentChunks?: DebugChunkExcerpt[];
  /** Chunks that were retrieved but trimmed out by budget. */
  documentChunksTrimmedOut?: DebugChunkExcerpt[];
  /** FAQs that made it into the final prompt (excerpts). */
  faqEntriesUsed?: { questionExcerpt: string; answerExcerpt: string }[];
  /** Short summary of retrieval/prompt composition. */
  retrievalModeSummary?: string;
  /** True if at least one document chunk is in the final prompt. */
  documentChunksInPrompt?: boolean;
  /** Chunk text quality signals (avg length, too-short count). */
  chunkQualitySignals?: { avgChunkLength: number; minChunkLength: number; anyTooShort: boolean; tooShortCount: number };
  /** Prompt composition: documents are always placed before FAQs in knowledge context. */
  documentsBeforeFaqs?: boolean;
  /** True when retrieval suggests a direct document answer (strong score/lexical); doc-first grounding strengthened. */
  documentDirectAnswerLikely?: boolean;
  /** Short summary of prompt knowledge composition (e.g. "Notes: 1, Documents: 3, Supporting FAQs: 2"). */
  promptKnowledgeSummary?: string;
  /** Max combinedScore among document chunks in the final prompt (retrieval strength). */
  strongestDocumentChunkScore?: number;
  /** Number of FAQ entries in the final prompt. */
  strongestFaqCount?: number;
  /** True if at least one document chunk in prompt has combinedScore >= 0.35. */
  finalPromptContainsStrongDoc?: boolean;
  /** Heuristic: true if the assistant reply overlaps substantially with any prompt document snippet. */
  answerUsedDocumentLikely?: boolean;
  /** True when prompt chunks look like pre-improvement format; re-ingest document to get new chunking. */
  reIngestionRecommended?: boolean;
  /** Final prompt token estimates by block (system, user notes/documents/faqs/conversation/current). */
  promptTokenEstimatesByBlock?: PromptTokenEstimatesByBlock;
  /** When true, unified knowledge retrieval (documents + FAQs + notes) was run and attached below (feature flag + debug). */
  unifiedRetrievalUsed?: boolean;
  /** Eligible counts by source type from unified retrieval (when unifiedRetrievalUsed). */
  unifiedRetrievalEligibleCounts?: { document?: number; faq?: number; note?: number; html?: number };
  /** Top ranked items from unified retrieval, by source type (when unifiedRetrievalUsed). */
  unifiedRetrievalBySourceType?: Record<string, Array<{ sourceType: string; title: string; combinedScore: number }>>;
  /** Score breakdown for top unified retrieval items (when unifiedRetrievalUsed). */
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
  /** Diversity/dedup: removed duplicate ids, skipped by cap, final count (when unifiedRetrievalUsed). */
  unifiedRetrievalDiversityDebug?: {
    removedAsDuplicate: string[];
    skippedByCap: Array<{ id: string; reason: string }>;
    finalSelectedCount: number;
    finalSelectedIds?: string[];
  };
  /** True when evidence-first prompt was used (useUnifiedEvidencePrompt). */
  useUnifiedEvidencePrompt?: boolean;
  /** Number of evidence items included in the prompt (when useUnifiedEvidencePrompt). */
  evidenceItemsInPrompt?: number;
  /** Evidence item ids trimmed out by token budget (when useUnifiedEvidencePrompt). */
  evidenceItemsTrimmedOut?: string[];
  /** Token count for the evidence block in the prompt (when useUnifiedEvidencePrompt). */
  evidenceBlockTokens?: number;
  /** Token estimate per prompt block (evidence mode). */
  evidencePromptTokenDistribution?: {
    system: number;
    userEvidence: number;
    userConversation: number;
    userCurrentMessage: number;
    userTotal: number;
  };
  /** Number of top evidence items protected from trimming (evidence mode). */
  protectedEvidenceCount?: number;
  /** Evidence item ids kept in prompt (evidence mode). */
  evidenceItemsKeptIds?: string[];
  /** Conversation messages trimmed out count (evidence mode). */
  conversationMessagesTrimmedOut?: number;
  /** Why evidence trimming happened (evidence mode). */
  evidenceTrimReason?: string;
  /** Why conversation trimming happened (evidence mode). */
  conversationTrimReason?: string;
  /** Final token distribution by block summary (evidence mode). */
  evidenceTrimSummary?: string;
  /** Question classification (evidence path answerability). */
  questionClassification?: string;
  /** Evidence strength summary: top score, gap, count (evidence path). */
  evidenceStrengthSummary?: {
    topCombinedScore: number;
    scoreGap: number;
    evidenceItemCount: number;
    hasStrongMatchSignal?: boolean;
  };
  /** Evidence strong enough to answer confidently (evidence path). */
  evidenceStrongEnough?: boolean;
  /** Direct answer from evidence likely (evidence path). */
  directAnswerLikely?: boolean;
  /** Company-specific factual question (evidence path). */
  companySpecificQuestion?: boolean;
  /** Should use fallback language; do not invent (evidence path). */
  shouldUseFallback?: boolean;
  /** May answer generally without strict KB (evidence path). */
  shouldAnswerGenerally?: boolean;
  /** Short explanation of answerability decision (evidence path). */
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

/** Eligible knowledge item counts by source type (admin/test debug only). */
export interface EligibleCountBySourceType {
  /** Number of notes blocks (0 or 1; from bot knowledge description). */
  notes: number;
  /** Number of FAQ entries eligible for context. */
  faqs: number;
  /** Number of document chunks eligible for retrieval (from RAG). */
  documentChunks: number;
}

/** Document/chunk counts by document sourceType (upload | url | manual). Admin/test debug only. */
export interface EligibleCountByDocumentSourceType {
  upload?: number;
  url?: number;
  manual?: number;
}

/** Final prompt token estimates by block (admin/test debug only). No embeddings or secrets. */
export interface PromptTokenEstimatesByBlock {
  system: number;
  userNotes: number;
  userDocuments: number;
  userFaqs: number;
  userConversation: number;
  userCurrentMessage: number;
  userTotal: number;
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
