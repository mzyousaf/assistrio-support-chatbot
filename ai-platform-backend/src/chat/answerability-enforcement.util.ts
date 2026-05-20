/**
 * Hard enforcement when answerability decides shouldUseFallback — skip LLM completion
 * and return a fixed knowledge-sources fallback message.
 */

import type { AnswerMode } from './answerability.helper';
import { isCreativeOrGenerativeRequest } from './answerability.helper';
import type { AnswerabilityContext } from './answerability.types';

/** Fixed copy when answerability blocks a normal grounded answer. */
export const KNOWLEDGE_SOURCES_FALLBACK_MESSAGE =
  "I don't have enough information in the available knowledge sources to answer that.";

export type FallbackEnforcementReason =
  | 'knowledge_only_creative_request'
  | 'knowledge_only_insufficient_evidence'
  | 'knowledge_only_no_evidence'
  | 'knowledge_only_unsupported'
  | 'company_factual_insufficient_evidence';

export function shouldSkipCompletionForAnswerabilityFallback(shouldUseFallback: boolean): boolean {
  return shouldUseFallback === true;
}

export function shouldPersistAssistantSourcesForTurn(enforceAnswerabilityFallback: boolean): boolean {
  return !enforceAnswerabilityFallback;
}

export function resolveAnswerabilityEnforcedFallbackMessage(): string {
  return KNOWLEDGE_SOURCES_FALLBACK_MESSAGE;
}

/** Log-friendly fallback reason when completion is skipped for answerability. */
export function resolveAnswerabilityFallbackLogReason(
  enforceAnswerabilityFallback: boolean,
  fallbackEnforcementReason?: FallbackEnforcementReason,
): string | undefined {
  if (!enforceAnswerabilityFallback) return undefined;
  return fallbackEnforcementReason ?? 'answerability_fallback_enforced';
}

export function deriveFallbackEnforcementReason(
  answerMode: AnswerMode,
  ctx: Pick<AnswerabilityContext, 'shouldUseFallback' | 'decisionExplanation'>,
  userMessage: string,
): FallbackEnforcementReason | undefined {
  if (!ctx.shouldUseFallback) return undefined;

  if (answerMode === 'knowledge_only' && isCreativeOrGenerativeRequest(userMessage)) {
    return 'knowledge_only_creative_request';
  }

  const explanation = ctx.decisionExplanation.toLowerCase();

  if (answerMode === 'knowledge_only') {
    if (explanation.includes('no knowledge evidence') || explanation.includes('no supporting evidence')) {
      return 'knowledge_only_no_evidence';
    }
    if (explanation.includes('insufficient')) {
      return 'knowledge_only_insufficient_evidence';
    }
    return 'knowledge_only_unsupported';
  }

  if (explanation.includes('insufficient evidence') || explanation.includes('no evidence retrieved')) {
    return 'company_factual_insufficient_evidence';
  }

  return 'company_factual_insufficient_evidence';
}
