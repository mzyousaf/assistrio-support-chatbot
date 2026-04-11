/**
 * Trial knowledge draft — FAQ shape aligned with backend `normalizeKnowledgeFaqs` (6.0.3a / 6.1).
 */

import { TRIAL_MAX_FAQ_ITEMS } from "./trial-knowledge-limits";

export { TRIAL_MAX_FAQ_ITEMS };
export const TRIAL_MAX_FAQ_QUESTION = 2000;
export const TRIAL_MAX_FAQ_ANSWER = 8000;
export const TRIAL_MAX_FAQ_ID = 80;

export type TrialKnowledgeFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export function parseTrialFaqsFromApi(raw: unknown): TrialKnowledgeFaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TrialKnowledgeFaqItem[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim().slice(0, TRIAL_MAX_FAQ_ID) : "";
    const question = typeof o.question === "string" ? o.question.slice(0, TRIAL_MAX_FAQ_QUESTION) : "";
    const answer = typeof o.answer === "string" ? o.answer.slice(0, TRIAL_MAX_FAQ_ANSWER) : "";
    if (!id) continue;
    out.push({ id, question, answer });
    if (out.length >= TRIAL_MAX_FAQ_ITEMS) break;
  }
  return out;
}

export function newFaqItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `faq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
