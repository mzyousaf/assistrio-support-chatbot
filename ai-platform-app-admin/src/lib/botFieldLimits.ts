/**
 * String limits for bot documents (profile, behavior, chat UI, lead capture).
 * Keep in sync with:
 * - `ai-platform-backend/src/workspace/shared/bot-field-limits.ts`
 * - `assistrio-customer-app/src/lib/botFieldLimits.ts`
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
  exampleQuestion: 140,
  exampleQuestionContext: 4000,
  categoryText: 200,
  senderName: 120,
  scrollToBottomLabel: 120,
  menuQuickLinkText: 120,
  menuQuickLinkRoute: 2000,
} as const;

export function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/** Keep in sync with `ai-platform-backend/.../bot-field-limits.ts`. */
export const LEAD_CAPTURE_FIELDS_MAX = 10;

/** Max document files per multipart upload — sync with backend `KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX`. */
export const KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX = 5;

/** Max knowledge documents per bot — sync with backend `KNOWLEDGE_DOCUMENTS_MAX`. */
export const KNOWLEDGE_DOCUMENTS_MAX = 50;

/** Max knowledge datasheets per bot — sync with backend `KNOWLEDGE_TABLES_MAX`. */
export const KNOWLEDGE_TABLES_MAX = 50;

/** Datasheet import upload cap — sync with backend `DEFAULT_KB_FIELD_LIMITS.datasheetMaxUploadBytes` / `bot-document-upload.constants.ts`. */
export const MAX_DATASHEET_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
