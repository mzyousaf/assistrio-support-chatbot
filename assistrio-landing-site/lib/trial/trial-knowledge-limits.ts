/** Trial Knowledge Base caps (aligned with backend). */

export const TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS = 15_000;

export const TRIAL_MAX_KNOWLEDGE_DOCUMENTS = 3;
/** Per-file upload cap (same as server). */
export const TRIAL_MAX_KNOWLEDGE_FILE_BYTES = 5 * 1024 * 1024;
/** Avatar uploads — same cap as backend `TRIAL_MAX_AVATAR_FILE_BYTES`. */
export const TRIAL_MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024;
/** Combined size of all knowledge documents on the draft. */
export const TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES = 15 * 1024 * 1024;

export const TRIAL_MAX_FAQ_ITEMS = 10;
