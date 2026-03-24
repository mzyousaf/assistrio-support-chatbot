/**
 * Typed structures for the layered chat context (behavior, knowledge, conversation, lead capture).
 * Used to build the LLM prompt in a clear, sectioned way.
 */

export interface ChatContextIdentity {
  botName: string;
  category?: string;
}

export interface ChatContextBehavior {
  personalityPreset?: string;
  personalityDescription?: string;
  thingsToAvoid?: string;
  tone?: string;
  language?: string;
  responseLength?: string;
  /** Optional response behavior rules (HOW to answer). Do not put company-specific facts here; those belong in knowledge/retrieval. */
  systemPrompt?: string;
}

/** One item in the unified evidence list for evidence-first prompt (sourceType, title, section, text, optional URL). */
export interface ChatContextEvidenceItem {
  sourceType: string;
  title: string;
  section?: string;
  text: string;
  /** Optional URL for documents/HTML (when useful for grounding). */
  url?: string;
}

/** Knowledge context: unified evidence only (ranked docs/FAQs/notes from unified retrieval). */
export interface ChatContextKnowledge {
  /** Ranked evidence items for the prompt (evidence-first). */
  unifiedEvidence?: ChatContextEvidenceItem[];
}

export interface ChatContextLeadCapture {
  enabled: boolean;
  requiredFields: string[];
  optionalFields: string[];
  collected: Record<string, string>;
  missingRequired: string[];
  shouldAskNow: boolean;
  /** Human-readable field labels for prompting (key -> label) */
  fieldLabels: Record<string, string>;
  /** When true, prompt asks for polite wording when requesting lead info. */
  politeMode?: boolean;
  askStrategy?: 'soft' | 'balanced' | 'direct';
}

export interface ChatContextConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
}

export interface ChatContextConversation {
  messages: ChatContextConversationMessage[];
  /** Optional short summary for long conversations; empty if not yet available. */
  summary?: string;
}

/** Retrieval confidence for grounding: low → do not invent company facts. */
export type RetrievalConfidence = 'high' | 'medium' | 'low';

/**
 * Full structured context passed to the prompt formatter.
 * Built from bot config, RAG results, conversation history, and lead state.
 */
export interface ChatKnowledgeContext {
  identity: ChatContextIdentity;
  behavior: ChatContextBehavior;
  knowledge: ChatContextKnowledge;
  leadCapture: ChatContextLeadCapture;
  conversation: ChatContextConversation;
  /** The current user message (included in conversation.messages but also here for clarity). */
  currentUserMessage: string;
  /** When 'low', prompt instructs not to invent company-specific facts. */
  retrievalConfidence?: RetrievalConfidence;
  /** True when retrieval suggests a direct document answer (strong score/lexical); strengthen doc-first grounding. */
  documentDirectAnswerLikely?: boolean;
  /** Answerability signals for evidence path (behavior-only; no factual content). */
  answerability?: {
    evidenceStrongEnough: boolean;
    directAnswerLikely: boolean;
    shouldUseFallback: boolean;
    shouldAnswerGenerally: boolean;
  };
}
