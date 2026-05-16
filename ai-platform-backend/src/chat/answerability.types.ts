/**
 * Types for answerability and fallback logic (unified evidence path).
 * Distinguishes question types, evidence strength, and when to answer confidently vs use fallback.
 */

/** Classification of the user's question intent (heuristic). */
export type QuestionClassification =
  | 'company_factual'
  | 'general_conversational'
  | 'greeting_small_talk'
  | 'open_ended_advice'
  | 'unclear_underspecified_factual';

/** Summary of evidence strength from unified retrieval (for fallback decision). */
export interface EvidenceStrengthSummary {
  /** Top combined score among kept/retrieved items (0–1). */
  topCombinedScore: number;
  /** Gap between first and second score (0–1); high gap can indicate a clear best match. */
  scoreGap: number;
  /** Number of evidence items available after diversity and budgeting. */
  evidenceItemCount: number;
  /** Whether any item had a strong exact phrase / title / FAQ-style match (if available). */
  hasStrongMatchSignal?: boolean;
}

/** Answerability context: inputs for prompt and debug (behavior-only signals). */
export interface AnswerabilityContext {
  /** Question was classified as company-specific factual. */
  companySpecificQuestion: boolean;
  /** Evidence is strong enough to answer confidently from retrieval. */
  evidenceStrongEnough: boolean;
  /** A direct answer from evidence is likely (top score high, clear match). */
  directAnswerLikely: boolean;
  /** Should use safe fallback language (don't invent; say couldn't find). */
  shouldUseFallback: boolean;
  /** Can answer generally / conversationally without strict KB grounding. */
  shouldAnswerGenerally: boolean;
  /** Short explanation for debug (why this decision). */
  decisionExplanation: string;
  /** Question classification label. */
  questionClassification: QuestionClassification;
  /** Evidence strength summary (for debug). */
  evidenceStrengthSummary: EvidenceStrengthSummary;
}
