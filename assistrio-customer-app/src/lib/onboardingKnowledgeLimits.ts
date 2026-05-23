/** Onboarding KB limits — sync with backend `workspace-onboarding-knowledge-limits.constants.ts`. */
export const ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX = 10;
export const ONBOARDING_KNOWLEDGE_DATASHEETS_MAX = 5;
export const ONBOARDING_KNOWLEDGE_SNIPPETS_MAX = 5;
export const ONBOARDING_KNOWLEDGE_QA_MAX = 20;
export const ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX = 5;
export const ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const ONBOARDING_KNOWLEDGE_LIST_PAGE_SIZE = 5;

export const ONBOARDING_QA_IMPORT_SKIPPED_REASON =
  'Only the first 20 valid Q&A items are imported.';

/** Page-size choices for onboarding KB lists, capped by each section's max item count. */
export function onboardingKnowledgePageSizeOptions(maxItems: number): number[] {
  const max = Math.max(1, maxItems);
  const steps = [5, 10, 20].filter((n) => n < max);
  const options = [...steps, max];
  return [...new Set(options)].sort((a, b) => a - b);
}

export function clampOnboardingKnowledgePageSize(size: number, maxItems: number): number {
  const options = onboardingKnowledgePageSizeOptions(maxItems);
  if (options.includes(size)) return size;
  return options[0] ?? ONBOARDING_KNOWLEDGE_LIST_PAGE_SIZE;
}
