/** Trial Knowledge Base caps — keep in sync with `assistrio-landing-site/lib/trial/trial-knowledge-limits.ts`. */

export const TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS = 15_000;

export const TRIAL_MAX_KNOWLEDGE_DOCUMENTS = 3;
/** Per-file upload cap */
export const TRIAL_MAX_KNOWLEDGE_FILE_BYTES = 5 * 1024 * 1024;
/** Trial avatar uploads (onboarding + playground sync) — match product UI (PNG, JPG, WebP, max 2MB). */
export const TRIAL_MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024;
/** Combined size of all knowledge documents on the draft */
export const TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES = 15 * 1024 * 1024;

export const TRIAL_MAX_FAQ_ITEMS = 10;
