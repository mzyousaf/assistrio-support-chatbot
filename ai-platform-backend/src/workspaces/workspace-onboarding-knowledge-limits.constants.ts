/** Onboarding KB count limits (Epic 3B Step 10). */
export const ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX = 10;
export const ONBOARDING_KNOWLEDGE_DATASHEETS_MAX = 5;
export const ONBOARDING_KNOWLEDGE_SNIPPETS_MAX = 5;
export const ONBOARDING_KNOWLEDGE_QA_MAX = 20;
export const ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX = 5;

/** Per staged document/datasheet upload file size cap (20 MB). */
export const ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES = 20 * 1024 * 1024;

export const ONBOARDING_QA_IMPORT_SKIPPED_REASON =
  'Only the first 20 valid Q&A items are imported during onboarding.';

export const ONBOARDING_SNIPPET_IMPORT_SKIPPED_REASON =
  'Only the first 5 snippets are imported during onboarding.';
