/**
 * String limits for bot documents (profile, behavior, chat UI, lead capture).
 * Keep in sync with:
 * - `ai-platform-backend/src/workspace/shared/bot-field-limits.ts`
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
  exampleQuestion: 140,
  /** Scoped facts when a suggestion chip is used (first reply; no full KB). */
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

/** Datasheet CSV/Excel import. Sync with `MAX_DATASHEET_IMPORT_BYTES` in `bot-document-upload.constants.ts` (backend). */
export const MAX_DATASHEET_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
