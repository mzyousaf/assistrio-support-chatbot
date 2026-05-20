/**
 * Env-configurable chat retrieval caps (defaults unchanged from production behavior).
 */

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CHAT_RETRIEVAL_LIMIT_DEFAULT = 25;
export const CHAT_MAX_ITEMS_TO_SCORE_DEFAULT = 300;
export const CHAT_MAX_EVIDENCE_ITEMS_DEFAULT = 8;
export const CHAT_MAX_EVIDENCE_TOKENS_DEFAULT = 2200;

export function getChatRetrievalLimit(): number {
  return readPositiveIntEnv('CHAT_RETRIEVAL_LIMIT', CHAT_RETRIEVAL_LIMIT_DEFAULT);
}

export function getChatMaxItemsToScore(): number {
  return readPositiveIntEnv('CHAT_MAX_ITEMS_TO_SCORE', CHAT_MAX_ITEMS_TO_SCORE_DEFAULT);
}

export function getChatMaxEvidenceItems(): number {
  return readPositiveIntEnv('CHAT_MAX_EVIDENCE_ITEMS', CHAT_MAX_EVIDENCE_ITEMS_DEFAULT);
}

export function getChatMaxEvidenceTokens(): number {
  return readPositiveIntEnv('CHAT_MAX_EVIDENCE_TOKENS', CHAT_MAX_EVIDENCE_TOKENS_DEFAULT);
}

/** Evidence budget options from env (defaults match production). */
export function buildEvidenceBudgetOptionsFromEnv(): {
  maxEvidenceItems: number;
  maxEvidenceTokens: number;
} {
  return {
    maxEvidenceItems: getChatMaxEvidenceItems(),
    maxEvidenceTokens: getChatMaxEvidenceTokens(),
  };
}
