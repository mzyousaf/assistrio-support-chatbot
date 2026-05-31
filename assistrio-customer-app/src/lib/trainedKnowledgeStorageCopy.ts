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

/** Plans modal core-limit tooltip — what counts toward trained knowledge storage. */
export const TRAINED_KNOWLEDGE_MODAL_LIMIT_TOOLTIP_LEAD =
  'Trained knowledge storage counts extracted text, not original file size.';

/** Knowledge source types counted toward trained knowledge storage (Plans modal tooltip). */
export const TRAINED_KNOWLEDGE_MODAL_LIMIT_SOURCE_TYPES = [
  'Documents (.pdf, .doc, .docx, .txt, .md)',
  'Snippets',
  'Q&A',
  'Spreadsheets (.csv, .xlsx, .xls)',
  'Suggestions',
] as const;

export const TRAINED_KNOWLEDGE_MODAL_LIMIT_UPLOAD_NOTE = 'Upload files up to 20 MB each.';

/** Detail-page actions when plan cap blocks an item. */
export const TRAINED_KNOWLEDGE_STORAGE_VIEW_ACTION = 'View trained knowledge storage';

/** Plans upgrade CTA when trained knowledge quota is full. */
export const TRAINED_KNOWLEDGE_STORAGE_UPGRADE_ACTION = 'Upgrade plan';
