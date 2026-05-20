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

export type AnswerMode = 'knowledge_first' | 'knowledge_only';

export function normalizeAnswerMode(raw: unknown): AnswerMode {
  return raw === 'knowledge_only' ? 'knowledge_only' : 'knowledge_first';
}

// --- Thresholds (tunable) ---
const TOP_SCORE_STRONG = 0.38;
const TOP_SCORE_DIRECT = 0.48;
const TOP_SCORE_OVERVIEW_MIN = 0.16;
const TOP_SCORE_MULTI_CHUNK_MIN = 0.2;
const SCORE_GAP_CLEAR = 0.12;
const MIN_ITEMS_FOR_STRONG = 1;
const MIN_ITEMS_FOR_DIRECT = 1;
const MIN_ITEMS_OVERVIEW_SYNTHESIS = 2;
const MIN_ITEMS_MULTI_CHUNK = 3;

/** Patterns for question classification (heuristic). */
const GREETING_PATTERNS = /\b(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings)\b/i;
const SMALL_TALK_PATTERNS = /\b(how\s+are\s+you|what'?s\s+up|how\s+do\s+you\s+do|nice\s+to\s+meet|thanks?|thank\s+you)\b/i;
const COMPANY_FACTUAL_PATTERNS =
  /\b(price|pricing|cost|fee|hours?|open|close|refund|return\s+policy|policy|policies|service|services|features?|products?|do\s+you\s+offer|what\s+do\s+you\s+offer|when\s+do\s+you|where\s+are\s+you|address|phone|contact|availability|available|delivery|shipping|warranty|guarantee)\b/i;
const COMPANY_OVERVIEW_PATTERNS =
  /\b(explain|describe|tell\s+me\s+about|overview|what\s+does|what\s+do\b|how\s+does|how\s+do\b|main\s+features?|key\s+features?|what\s+are\s+(?:the\s+)?(?:main\s+)?features?|who\s+is)\b/i;
/** Typo-tolerant: fearture, featur, etc. */
const MAIN_FEATURES_LOOSE_PATTERN = /\b(?:main|key)\s+featur\w*/i;
/** "what [Assitro] do" with words between what and do */
const WHAT_DO_LOOSE_PATTERN = /\bwhat\b[\s\S]{0,60}\bdo\b/i;
const WHAT_ARE_FEATURES_LOOSE_PATTERN = /\bwhat\s+are\b[\s\S]{0,40}\bfeatur\w*/i;
/** Company/product name variants when paired with overview intent */
const COMPANY_NAME_OVERVIEW_PATTERN =
  /\b(?:assistrio|assitro|assistri\w*)\b[\s\S]{0,80}\b(?:do|does|work|works|feature|featur|product|service|company|platform)\b/i;
const OVERVIEW_INTENT_AFTER_COMPANY_NAME_PATTERN =
  /\b(?:do|does|work|works|feature|featur|product|service|company|platform)\b[\s\S]{0,80}\b(?:assistrio|assitro|assistri\w*)\b/i;
const OPEN_ENDED_ADVICE_PATTERNS = /\b(how\s+can\s+I|what\s+should\s+I|can\s+you\s+help\s+me|advice|recommend|suggest)\b/i;
const CREATIVE_GENERATIVE_PATTERNS = [
  /\bwelcome\s+messages?\b/i,
  /\b(write|draft|create|generate|come up with|give me|suggest)\b[^.?!]{0,120}\b(messages?|copy|paragraph|email|template|examples?|ideas?|taglines?)\b/i,
  /\b(rewrite|re-?write|rephrase)\b/i,
  /\bmarketing\s+(copy|text|paragraph)\b/i,
  /\bemail\s+copy\b/i,
  /\bgive\s+me\s+\d+\b/i,
];
const GENERATIVE_EXAMPLE_MARKERS = /\b(example|sample|template|e\.g\.|for instance)\b/i;
const LIST_LIKE_MARKERS = /\n\s*\d+[\.\):]|\n\s*[-*•]\s+/;

/**
 * Typo-tolerant company/product overview intent (what X do, main fearture, explain Assistrio, etc.).
 * Excludes creative/generative asks so Knowledge-only stays strict for welcome messages and copy.
 */
export function isRoughCompanyOverviewIntent(message: string): boolean {
  const q = (message || '').trim();
  if (!q || isCreativeOrGenerativeRequest(q)) return false;
  const lower = q.toLowerCase();
  if (COMPANY_OVERVIEW_PATTERNS.test(lower)) return true;
  if (MAIN_FEATURES_LOOSE_PATTERN.test(lower)) return true;
  if (WHAT_DO_LOOSE_PATTERN.test(lower)) return true;
  if (WHAT_ARE_FEATURES_LOOSE_PATTERN.test(lower)) return true;
  if (/\bexplain\b/i.test(lower) && q.length < 220) return true;
  if (COMPANY_NAME_OVERVIEW_PATTERN.test(lower) || OVERVIEW_INTENT_AFTER_COMPANY_NAME_PATTERN.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Broad product/company overview questions that should synthesize from multiple KB chunks.
 */
export function isCompanyOverviewQuestion(
  message: string,
  classification?: QuestionClassification,
): boolean {
  const lower = (message || '').trim().toLowerCase();
  if (!lower) return false;
  if (isRoughCompanyOverviewIntent(message)) return true;
  if (classification === 'company_factual' && /\b(feature|product|service|offer|platform|assist|featur)\b/i.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Classify the user message into a question/intent type (heuristic).
 */
export function classifyQuestion(message: string): QuestionClassification {
  const q = (message || '').trim();
  const lower = q.toLowerCase();
  if (GREETING_PATTERNS.test(lower) && q.length < 80) return 'greeting_small_talk';
  if (SMALL_TALK_PATTERNS.test(lower) && q.length < 120) return 'greeting_small_talk';
  if (q.length < 3) return 'unclear_underspecified_factual';

  if (isRoughCompanyOverviewIntent(q)) return 'company_factual';
  if (COMPANY_OVERVIEW_PATTERNS.test(lower)) return 'company_factual';
  if (COMPANY_FACTUAL_PATTERNS.test(lower)) return 'company_factual';
  if (OPEN_ENDED_ADVICE_PATTERNS.test(lower)) return 'open_ended_advice';

  if (q.length < 15 && !/\?/.test(q)) return 'unclear_underspecified_factual';
  if (
    /\?/.test(q) &&
    (lower.includes('what') ||
      lower.includes('when') ||
      lower.includes('where') ||
      lower.includes('how much') ||
      lower.includes('which'))
  ) {
    return 'company_factual';
  }

  return 'general_conversational';
}

/** Creative/generative asks (welcome messages, copy, templates) that need explicit KB examples in strict mode. */
export function isCreativeOrGenerativeRequest(message: string): boolean {
  const q = (message || '').trim();
  if (!q) return false;
  return CREATIVE_GENERATIVE_PATTERNS.some((re) => re.test(q));
}

/** True when retrieved evidence appears to contain explicit generative examples for this request. */
export function evidenceSupportsGenerativeRequest(
  message: string,
  items: RankedKnowledgeItem[],
): boolean {
  if (items.length === 0) return false;
  const blob = items.map((i) => `${i.title}\n${i.text}`).join('\n');
  const lower = blob.toLowerCase();
  if (/\bwelcome\s+messages?\b/i.test(message)) {
    if (!/\bwelcome\s+messages?\b/i.test(lower) && !/\bwelcome\s+message\b/i.test(lower)) {
      return false;
    }
    return GENERATIVE_EXAMPLE_MARKERS.test(blob) || LIST_LIKE_MARKERS.test(blob) || /["'`]/.test(blob);
  }
  if (isCreativeOrGenerativeRequest(message)) {
    return GENERATIVE_EXAMPLE_MARKERS.test(blob) && blob.trim().length >= 80;
  }
  return false;
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

function computeEvidenceStrongEnough(
  evidenceStrength: EvidenceStrengthSummary,
  overviewQuestion: boolean,
): boolean {
  const { topCombinedScore, evidenceItemCount, hasStrongMatchSignal } = evidenceStrength;
  if (evidenceItemCount < MIN_ITEMS_FOR_STRONG) return false;
  if (topCombinedScore >= TOP_SCORE_STRONG || hasStrongMatchSignal === true) return true;
  if (
    overviewQuestion &&
    evidenceItemCount >= MIN_ITEMS_OVERVIEW_SYNTHESIS &&
    topCombinedScore >= TOP_SCORE_OVERVIEW_MIN
  ) {
    return true;
  }
  if (evidenceItemCount >= MIN_ITEMS_MULTI_CHUNK && topCombinedScore >= TOP_SCORE_MULTI_CHUNK_MIN) {
    return true;
  }
  return false;
}

function computeKnowledgeOnlyAnswerability(
  questionClassification: QuestionClassification,
  evidenceStrength: EvidenceStrengthSummary,
  userMessage: string,
  evidenceItems: RankedKnowledgeItem[],
): AnswerabilityContext {
  const { topCombinedScore, evidenceItemCount } = evidenceStrength;
  const overviewIntent = isCompanyOverviewQuestion(userMessage, questionClassification);
  const overviewQuestion = overviewIntent;
  const companySpecific =
    questionClassification === 'company_factual' ||
    questionClassification === 'unclear_underspecified_factual' ||
    overviewIntent;
  const greetingOnly =
    questionClassification === 'greeting_small_talk' && !isCreativeOrGenerativeRequest(userMessage);
  const generalOrAdvice =
    (questionClassification === 'general_conversational' ||
      questionClassification === 'open_ended_advice') &&
    !overviewIntent;

  const evidenceStrongEnough = computeEvidenceStrongEnough(evidenceStrength, overviewQuestion);
  const directAnswerLikely =
    evidenceItemCount >= MIN_ITEMS_FOR_DIRECT &&
    (topCombinedScore >= TOP_SCORE_DIRECT || evidenceStrength.hasStrongMatchSignal === true);

  let shouldUseFallback = false;
  let shouldAnswerGenerally = false;
  let decisionExplanation: string;

  if (greetingOnly && evidenceItemCount === 0) {
    shouldAnswerGenerally = true;
    shouldUseFallback = false;
    decisionExplanation = 'Knowledge-only mode: greeting with no KB; respond naturally.';
  } else if (isCreativeOrGenerativeRequest(userMessage)) {
    if (evidenceSupportsGenerativeRequest(userMessage, evidenceItems) && evidenceStrongEnough) {
      shouldUseFallback = false;
      shouldAnswerGenerally = false;
      decisionExplanation =
        'Knowledge-only mode: generative request with explicit examples in retrieved evidence.';
    } else {
      shouldUseFallback = true;
      shouldAnswerGenerally = false;
      decisionExplanation =
        'Knowledge-only mode: creative/generative request without explicit examples in the knowledge sources.';
    }
  } else if (companySpecific && !evidenceStrongEnough) {
    shouldUseFallback = true;
    shouldAnswerGenerally = false;
    decisionExplanation =
      evidenceItemCount === 0
        ? 'Knowledge-only mode: factual question with no supporting evidence; use fallback.'
        : `Knowledge-only mode: insufficient direct evidence (top score ${topCombinedScore.toFixed(2)}); use fallback.`;
  } else if (companySpecific && evidenceStrongEnough) {
    shouldUseFallback = false;
    shouldAnswerGenerally = false;
    decisionExplanation = overviewQuestion
      ? 'Knowledge-only mode: overview question with sufficient direct evidence.'
      : directAnswerLikely
        ? 'Knowledge-only mode: factual question with strong direct evidence.'
        : 'Knowledge-only mode: factual question with sufficient evidence.';
  } else if ((generalOrAdvice || greetingOnly) && evidenceItemCount > 0) {
    shouldUseFallback = true;
    shouldAnswerGenerally = false;
    decisionExplanation =
      'Knowledge-only mode: conversational request cannot be answered from tangentially related knowledge alone.';
  } else if (evidenceItemCount === 0) {
    shouldUseFallback = true;
    shouldAnswerGenerally = false;
    decisionExplanation = 'Knowledge-only mode: no knowledge evidence available; use fallback.';
  } else {
    shouldUseFallback = true;
    shouldAnswerGenerally = false;
    decisionExplanation = 'Knowledge-only mode: could not verify a direct KB-supported answer.';
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

/**
 * Compute answerability context: when to answer confidently vs use fallback vs answer generally.
 */
export function computeAnswerabilityContext(
  questionClassification: QuestionClassification,
  evidenceStrength: EvidenceStrengthSummary,
  userMessage?: string,
  options?: {
    answerMode?: AnswerMode;
    evidenceItems?: RankedKnowledgeItem[];
  },
): AnswerabilityContext {
  const msg = userMessage ?? '';
  const answerMode = normalizeAnswerMode(options?.answerMode);
  const evidenceItems = options?.evidenceItems ?? [];

  if (answerMode === 'knowledge_only') {
    return computeKnowledgeOnlyAnswerability(
      questionClassification,
      evidenceStrength,
      msg,
      evidenceItems,
    );
  }

  const { topCombinedScore, evidenceItemCount } = evidenceStrength;
  const overviewQuestion = isCompanyOverviewQuestion(msg, questionClassification);
  const companySpecific =
    questionClassification === 'company_factual' || questionClassification === 'unclear_underspecified_factual';
  const generalOrGreeting =
    questionClassification === 'general_conversational' ||
    questionClassification === 'greeting_small_talk' ||
    questionClassification === 'open_ended_advice';

  const evidenceStrongEnough = computeEvidenceStrongEnough(evidenceStrength, overviewQuestion);
  const directAnswerLikely =
    evidenceItemCount >= MIN_ITEMS_FOR_DIRECT &&
    (topCombinedScore >= TOP_SCORE_DIRECT || evidenceStrength.hasStrongMatchSignal === true);

  let shouldUseFallback = false;
  let shouldAnswerGenerally = false;
  let decisionExplanation: string;

  if (generalOrGreeting && evidenceItemCount === 0) {
    shouldAnswerGenerally = true;
    shouldUseFallback = false;
    decisionExplanation = 'General or greeting question with no KB evidence; answer naturally.';
  } else if (generalOrGreeting && evidenceItemCount > 0) {
    shouldAnswerGenerally = false;
    shouldUseFallback = false;
    decisionExplanation =
      'General question but relevant KB evidence is present; answer from evidence when it helps.';
  } else if (companySpecific && !evidenceStrongEnough) {
    shouldUseFallback = true;
    shouldAnswerGenerally = false;
    decisionExplanation =
      evidenceItemCount === 0
        ? 'Company-specific question but no evidence retrieved; use fallback and do not invent.'
        : `Company-specific question with insufficient evidence (top score ${topCombinedScore.toFixed(2)}, ${evidenceItemCount} items); use fallback.`;
  } else if (companySpecific && evidenceStrongEnough) {
    shouldUseFallback = false;
    shouldAnswerGenerally = false;
    decisionExplanation = overviewQuestion
      ? 'Company overview question with relevant evidence; synthesize a helpful answer from the retrieved chunks.'
      : directAnswerLikely
        ? 'Company-specific question with strong evidence; answer directly from evidence.'
        : 'Company-specific question with sufficient evidence; base answer on retrieved content.';
  } else {
    shouldAnswerGenerally = evidenceItemCount === 0;
    shouldUseFallback = false;
    decisionExplanation =
      evidenceItemCount > 0
        ? 'Unclassified question with evidence; answer using retrieved content when relevant.'
        : 'Unclassified or conversational; allow general response.';
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
