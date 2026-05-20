import { chatLog } from './chat-logger';
import type { CompletionFallbackReason, CompletionParseStatus } from './chat-completion-parse.util';

export function isRagDecisionDebugEnabled(): boolean {
  return process.env.DEBUG_RAG_DECISION?.trim().toLowerCase() === 'true';
}

export function isCompletionParseDebugEnabled(): boolean {
  return (
    isRagDecisionDebugEnabled() ||
    process.env.DEBUG_CHAT_AI_SETTINGS?.trim().toLowerCase() === 'true'
  );
}

export type CompletionParseDebugPayload = {
  rawCompletionPreview: string;
  /** @deprecated Prefer parseStatus — false also means recovered_json_field succeeded. */
  parsedJsonOk: boolean;
  parseStatus: CompletionParseStatus;
  recoveredFromRawText: boolean;
  recoveryMethod?: string;
  assistantReplyTextLength: number;
  assistantEnglishTextLength: number;
  fallbackReason: CompletionFallbackReason;
  retried?: boolean;
};

export function logCompletionParseDebug(payload: CompletionParseDebugPayload): void {
  if (!isCompletionParseDebugEnabled()) return;
  chatLog({
    event: 'chat_completion_parse_debug',
    level: 'info',
    metadata: payload as unknown as Record<string, unknown>,
  });
}

export type RagDecisionDebugPayload = {
  question: string;
  retrievalConfidence: string;
  selectedChunksCount: number;
  selectedChunkTitles: string[];
  answerabilityDecision: {
    questionClassification: string;
    shouldUseFallback: boolean;
    shouldAnswerGenerally: boolean;
    evidenceStrongEnough: boolean;
    directAnswerLikely: boolean;
    decisionExplanation: string;
    topCombinedScore?: number;
    evidenceItemCount?: number;
  };
  answerMode?: string;
  fallbackEnforced?: boolean;
  fallbackEnforcementReason?: string;
  completionSkipped?: boolean;
  fallbackReason?: string;
  evidencePromptPreview: string;
};

export type AnswerabilityFallbackEnforcementPayload = {
  answerMode: string;
  shouldUseFallback: boolean;
  fallbackEnforced: boolean;
  fallbackEnforcementReason: string;
  completionSkipped: boolean;
};

export function logAnswerabilityFallbackEnforcement(
  payload: AnswerabilityFallbackEnforcementPayload,
): void {
  if (!isRagDecisionDebugEnabled()) return;
  chatLog({
    event: 'answerability_fallback_enforced',
    level: 'info',
    metadata: payload as unknown as Record<string, unknown>,
  });
}

export function logRagDecisionDebug(payload: RagDecisionDebugPayload): void {
  if (!isRagDecisionDebugEnabled()) return;
  chatLog({
    event: 'rag_decision_debug',
    level: 'info',
    metadata: payload as unknown as Record<string, unknown>,
  });
}
