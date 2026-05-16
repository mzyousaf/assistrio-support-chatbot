/**
 * Answerability and fallback logic for the unified evidence path.
 * Classifies questions, evaluates evidence strength, and decides when to answer confidently vs use safe fallback.
 */

import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';
import type {
  EvidenceStrengthSummary,
  QuestionClassification,
  AnswerabilityContext,
} from './answerability.types';

// --- Thresholds (tunable) ---
const TOP_SCORE_STRONG = 0.4;
const TOP_SCORE_DIRECT = 0.5;
const SCORE_GAP_CLEAR = 0.15;
const MIN_ITEMS_FOR_STRONG = 1;
const MIN_ITEMS_FOR_DIRECT = 1;

/** Patterns for question classification (heuristic). */
const GREETING_PATTERNS = /\b(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings)\b/i;
const SMALL_TALK_PATTERNS = /\b(how\s+are\s+you|what'?s\s+up|how\s+do\s+you\s+do|nice\s+to\s+meet|thanks?|thank\s+you)\b/i;
const COMPANY_FACTUAL_PATTERNS = /\b(price|pricing|cost|fee|hours?|open|close|refund|return\s+policy|policy|policies|service|services|do\s+you\s+offer|what\s+do\s+you\s+offer|when\s+do\s+you|where\s+are\s+you|address|phone|contact|availability|available|delivery|shipping|warranty|guarantee)\b/i;
const OPEN_ENDED_ADVICE_PATTERNS = /\b(how\s+can\s+I|what\s+should\s+I|can\s+you\s+help\s+me|advice|recommend|suggest)\b/i;

/**
 * Classify the user message into a question/intent type (heuristic).
 */
export function classifyQuestion(message: string): QuestionClassification {
  const q = (message || '').trim();
  const lower = q.toLowerCase();
  if (GREETING_PATTERNS.test(lower) && q.length < 80) return 'greeting_small_talk';
  if (SMALL_TALK_PATTERNS.test(lower) && q.length < 120) return 'greeting_small_talk';
  if (q.length < 3) return 'unclear_underspecified_factual';

  if (COMPANY_FACTUAL_PATTERNS.test(lower)) return 'company_factual';
  if (OPEN_ENDED_ADVICE_PATTERNS.test(lower)) return 'open_ended_advice';

  if (q.length < 15 && !/\?/.test(q)) return 'unclear_underspecified_factual';
  if (/\?/.test(q) && (lower.includes('what') || lower.includes('when') || lower.includes('where') || lower.includes('how much') || lower.includes('which'))) {
    return 'company_factual';
  }

  return 'general_conversational';
}

/**
 * Evaluate evidence strength from the ranked retrieval result (items already after diversity/budgeting).
 */
export function evaluateEvidenceStrength(items: RankedKnowledgeItem[]): EvidenceStrengthSummary {
  if (items.length === 0) {
    return {
      topCombinedScore: 0,
      scoreGap: 0,
      evidenceItemCount: 0,
      hasStrongMatchSignal: false,
    };
  }
  const top = items[0].combinedScore ?? 0;
  const second = items.length > 1 ? (items[1].combinedScore ?? 0) : 0;
  const scoreGap = Math.max(0, top - second);
  const hasStrongMatchSignal = top >= TOP_SCORE_DIRECT || scoreGap >= SCORE_GAP_CLEAR;
  return {
    topCombinedScore: top,
    scoreGap,
    evidenceItemCount: items.length,
    hasStrongMatchSignal,
  };
}

/**
 * Compute answerability context: when to answer confidently vs use fallback vs answer generally.
 */
export function computeAnswerabilityContext(
  questionClassification: QuestionClassification,
  evidenceStrength: EvidenceStrengthSummary,
): AnswerabilityContext {
  const { topCombinedScore, evidenceItemCount, hasStrongMatchSignal } = evidenceStrength;
  const companySpecific = questionClassification === 'company_factual' || questionClassification === 'unclear_underspecified_factual';
  const generalOrGreeting =
    questionClassification === 'general_conversational' ||
    questionClassification === 'greeting_small_talk' ||
    questionClassification === 'open_ended_advice';

  const evidenceStrongEnough =
    evidenceItemCount >= MIN_ITEMS_FOR_STRONG && (topCombinedScore >= TOP_SCORE_STRONG || hasStrongMatchSignal === true);
  const directAnswerLikely =
    evidenceItemCount >= MIN_ITEMS_FOR_DIRECT && (topCombinedScore >= TOP_SCORE_DIRECT || hasStrongMatchSignal === true);

  let shouldUseFallback = false;
  let shouldAnswerGenerally = false;
  let decisionExplanation: string;

  if (generalOrGreeting) {
    shouldAnswerGenerally = true;
    shouldUseFallback = false;
    decisionExplanation = 'General or greeting question; answer naturally without requiring strong KB evidence.';
  } else if (companySpecific && !evidenceStrongEnough) {
    shouldUseFallback = true;
    shouldAnswerGenerally = false;
    decisionExplanation =
      evidenceItemCount === 0
        ? 'Company-specific factual question but no evidence retrieved; use fallback and do not invent.'
        : `Company-specific question with weak evidence (top score ${topCombinedScore.toFixed(2)}, ${evidenceItemCount} items); use fallback.`;
  } else if (companySpecific && evidenceStrongEnough) {
    shouldUseFallback = false;
    shouldAnswerGenerally = false;
    decisionExplanation = directAnswerLikely
      ? 'Company-specific question with strong evidence; answer directly from evidence.'
      : 'Company-specific question with sufficient evidence; base answer on retrieved content.';
  } else {
    shouldAnswerGenerally = true;
    shouldUseFallback = false;
    decisionExplanation = 'Unclassified or conversational; allow general response.';
  }

  return {
    companySpecificQuestion: companySpecific,
    evidenceStrongEnough,
    directAnswerLikely,
    shouldUseFallback,
    shouldAnswerGenerally,
    decisionExplanation,
    questionClassification,
    evidenceStrengthSummary: evidenceStrength,
  };
}
