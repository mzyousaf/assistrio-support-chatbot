/**
 * String limits for bot documents (profile, behavior, chat UI, lead capture).
 * Keep in sync with:
 * - `ai-platform-backend/src/workspace/shared/bot-field-limits.ts`
 * - `ai-platform-backend/src/knowledge/knowledge-plan-limits.ts` (raw upload caps)
 * - `ai-platform-app-admin/src/lib/botFieldLimits.ts`
 */
export const BOT_FIELD_MAX = {
  name: 120,
  shortDescription: 120,
  description: 2000,
  leadFieldLabel: 60,
  brandingMessage: 60,
  privacyText: 60,
  personalityName: 120,
  personalityLanguage: 80,
  personalityDescription: 8000,
  personalitySystemPrompt: 100_000,
  thingsToAvoid: 4000,
  welcomeMessage: 2000,
  knowledgeDescription: 2000,
  /** Titled knowledge snippet (title) */
  knowledgeSnippetTitle: 200,
  /** Single snippet / cell text */
  knowledgeSnippetBody: 12_000,
  /** Q&A group title */
  knowledgeQaTitle: 200,
  /** One phrasing in a Q&A group */
  knowledgeQaQuestion: 2000,
  knowledgeQaAnswer: 12_000,
  exampleQuestion: 140,
  /** Scoped facts when a suggestion chip is used (first reply; no full KB). */
  exampleQuestionContext: 4000,
  categoryText: 200,
  senderName: 120,
  scrollToBottomLabel: 120,
  menuQuickLinkText: 120,
  menuQuickLinkRoute: 2000,
  responseStyleDescription: 1500,
  responseStyleInstructions: 1200,
} as const;

export function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/** Keep in sync with `ai-platform-backend/.../bot-field-limits.ts`. */
export const LEAD_CAPTURE_FIELDS_MAX = 10;

/**
 * Max document files per multipart upload — sync with backend `KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX`.
 * Total documents per bot: {@link KNOWLEDGE_DOCUMENTS_MAX}.
 */
export const KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX = 5;

/** Max knowledge documents (file/url KB rows) per bot — sync with backend `KNOWLEDGE_DOCUMENTS_MAX`. */
export const KNOWLEDGE_DOCUMENTS_MAX = 50;

/** Max knowledge datasheets (tables) per bot — sync with backend `KNOWLEDGE_TABLES_MAX`. */
export const KNOWLEDGE_TABLES_MAX = 50;

/** Max distinct FAQ question strings per Q&A row — sync with backend `KNOWLEDGE_QA_QUESTIONS_MAX`. */
export const KNOWLEDGE_QA_QUESTIONS_MAX = 24;

/**
 * Central caps for raw KB file uploads — keep in sync with
 * `ai-platform-backend/src/knowledge/knowledge-plan-limits.ts` → `DEFAULT_KB_FIELD_LIMITS`
 * (`documentMaxUploadBytes`, `datasheetMaxUploadBytes`).
 */
export const KB_PLAN_DOCUMENT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const KB_PLAN_DATASHEET_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export const CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE = 'Document files can be up to 20 MB.';
export const CUSTOMER_DATASHEET_UPLOAD_SIZE_MESSAGE = 'Datasheet files can be up to 20 MB.';

/** Datasheet CSV/Excel import file size (upload), not grid UTF-8 limits. */
export const MAX_DATASHEET_IMPORT_FILE_BYTES = KB_PLAN_DATASHEET_UPLOAD_MAX_BYTES;

/** Customer workspace document upload (Knowledge → Documents). */
export const CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES = KB_PLAN_DOCUMENT_UPLOAD_MAX_BYTES;
