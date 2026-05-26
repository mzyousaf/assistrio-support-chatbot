/** User-facing label for plan-enforced trained text quota (not raw upload file size). */
export const TRAINED_KNOWLEDGE_STORAGE_LABEL = 'Trained knowledge storage';

/** Explains that quota counts extracted/trainable text, not original file bytes. */
export const TRAINED_KNOWLEDGE_STORAGE_HELPER =
  'We count the extracted text your agent learns from, not the original file size. For example, a 10 MB PDF may become much smaller after text extraction.';

/** Compact helper for tight UI (sidebar, badges, inline hints). */
export const TRAINED_KNOWLEDGE_STORAGE_SHORT_HELPER =
  'Based on extracted text, not original file size.';

/** Modal / limit-reached title using trained-knowledge wording. */
export const TRAINED_KNOWLEDGE_STORAGE_LIMIT_TITLE = 'Trained knowledge storage limit reached';

/** Short label for badges and inline status when plan cap blocks training. */
export const TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT = 'Trained knowledge limit reached';

/** Low-storage warning title. */
export const TRAINED_KNOWLEDGE_STORAGE_LOW_TITLE = 'Low trained knowledge storage';

/** Document upload file-size cap (separate from trained knowledge quota). */
export const MAX_KB_UPLOAD_FILE_SIZE_LABEL = 'Maximum file size: 20 MB';

/** Detail-page actions when plan cap blocks an item. */
export const TRAINED_KNOWLEDGE_STORAGE_VIEW_ACTION = 'View trained knowledge storage';

/** Plans upgrade CTA when trained knowledge quota is full. */
export const TRAINED_KNOWLEDGE_STORAGE_UPGRADE_ACTION = 'Upgrade plan';
