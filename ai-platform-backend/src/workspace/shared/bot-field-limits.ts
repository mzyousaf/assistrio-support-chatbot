/**
 * String limits for bot documents (profile, behavior, chat UI, lead capture).
 * Keep in sync with:
 * - `ai-platform-app-admin/src/lib/botFieldLimits.ts`
 * - `assistrio-customer-app/src/lib/botFieldLimits.ts`
 */
export const BOT_FIELD_MAX = {
  name: 120,
  shortDescription: 120,
  description: 2000,
  leadFieldLabel: 60,
  brandingMessage: 60,
  privacyText: 60,
  /** `personality.name` */
  personalityName: 120,
  personalityLanguage: 80,
  /** `personality.description` — behavior instructions */
  personalityDescription: 8000,
  /** `personality.systemPrompt` — assembled / stored prompt */
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
  /** Per spreadsheet table title */
  knowledgeDatasheetTitle: 200,
  knowledgeDatasheetCell: 2000,
  /** Original import filename stored with a datasheet (metadata only). */
  knowledgeDatasheetImportFileName: 255,
  /** Shown on the chip */
  exampleQuestion: 140,
  /** Per-suggestion scoped facts (first reply when chip has context; no full KB) */
  exampleQuestionContext: 4000,
  /** Single custom category or comma-joined (customer UI) */
  categoryText: 200,
  senderName: 120,
  scrollToBottomLabel: 120,
  /** Header menu quick link label */
  menuQuickLinkText: 120,
  /** Path or full URL for a quick link */
  menuQuickLinkRoute: 2000,
} as const;

export function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/** Max `leadCapture.fields` entries per bot (UI + API normalization). */
export const LEAD_CAPTURE_FIELDS_MAX = 10;

export const KNOWLEDGE_SNIPPETS_MAX = 80;
export const KNOWLEDGE_QA_MAX = 200;
export const KNOWLEDGE_TABLES_MAX = 40;
export const KNOWLEDGE_TABLE_MAX_COLUMNS = 64;
export const KNOWLEDGE_TABLE_MAX_ROWS = 2000;
export const KNOWLEDGE_QA_QUESTIONS_MAX = 24;
