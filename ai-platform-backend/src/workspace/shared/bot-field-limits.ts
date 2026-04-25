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
  /** Per suggested-question string */
  exampleQuestion: 140,
  /** Single custom category or comma-joined (customer UI) */
  categoryText: 200,
  senderName: 120,
  scrollToBottomLabel: 120,
  messageLimitUpgradeMessage: 500,
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
